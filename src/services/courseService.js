import {
  doc,
  setDoc,
  getDoc,
  getDocFromCache,
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  deleteDoc,
  addDoc,
  serverTimestamp,
  runTransaction,
  updateDoc,
  deleteField,
} from "firebase/firestore";
import { db } from "../config/firebase";
import { sanitizeForFirestore, repairProfile, sanitizeBagDistances } from "../utils/firestoreUtils";
import { DEFAULT_BAG } from "../data/defaultBag";
export async function saveCourseToFirestore(courseName, rating, slope) {
  // merge:true so we never clobber community course fields
  try { const id = courseName.toLowerCase().replace(/[^a-z0-9]/g, "_"); await setDoc(doc(db, "courses", id), { name: courseName, rating: parseFloat(rating), slope: parseFloat(slope), updatedAt: Date.now() }, { merge: true }); } catch(e) { console.error(e); }
}
// Upsert a community-contributed course. Pass createIfMissing=true only when creating a brand-new entry.

export async function uploadCourseToFirestore(courseData, playerUid, createIfMissing) {
  try {
    const id = courseData.name.toLowerCase().replace(/[^a-z0-9]/g, "_");
    const ref = doc(db, "courses", id);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      if (!createIfMissing) return;
      const holeCount = (courseData.holePars || []).length;
      await setDoc(ref, {
        name: courseData.name,
        location: courseData.location || "",
        rating: parseFloat(courseData.rating) || 72.0,
        slope: parseInt(courseData.slope) || 113,
        par: (courseData.holePars || []).reduce((a, b) => a + (b || 4), 0) || (holeCount === 9 ? 36 : 72),
        holePars: courseData.holePars || [],
        holeYards: courseData.holeYards || [],
        holeCenters: courseData.capturedHoleCenters || {},
        community: true,
        communityVerified: false,
        verificationCount: 1,
        verifiedPlayerUIDs: [playerUid],
        submittedBy: playerUid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      const existing = snap.data();
      const verifiedUIDs = [...(existing.verifiedPlayerUIDs || [])];
      if (!verifiedUIDs.includes(playerUid)) verifiedUIDs.push(playerUid);
      const verificationCount = verifiedUIDs.length;
      const communityVerified = verificationCount >= 5;
      // Average new hole centers with existing positions
      const existingCenters = existing.holeCenters || {};
      const newCenters = courseData.capturedHoleCenters || {};
      const mergedCenters = { ...existingCenters };
      for (const [holeIdx, coords] of Object.entries(newCenters)) {
        if (!mergedCenters[holeIdx]) { mergedCenters[holeIdx] = coords; }
        else { mergedCenters[holeIdx] = { lat: (mergedCenters[holeIdx].lat + coords.lat) / 2, lng: (mergedCenters[holeIdx].lng + coords.lng) / 2 }; }
      }
      await setDoc(ref, { verifiedPlayerUIDs: verifiedUIDs, verificationCount, communityVerified, holeCenters: mergedCenters, updatedAt: serverTimestamp() }, { merge: true });
    }
  } catch(e) { console.error("[Club99] uploadCourseToFirestore:", e); }
}

export async function searchCoursesInFirestore(term) {
  try {
    const snap = await getDocs(collection(db, "courses"));
    const all = snap.docs.map(d => d.data());
    return all.filter(c => c.name.toLowerCase().includes(term.toLowerCase())).slice(0, 6);
  } catch { return []; }
}

export async function fetchCommunityPins(courseKey, holeIdx) {
  if (!courseKey) return null;
  const docId = `${courseKey}_h${holeIdx + 1}`;
  try {
    const snap = await getDoc(doc(db, "global_course_pins", docId));
    if (!snap.exists()) return null;
    const d = snap.data();
    if (!d.count) return null;
    return {
      count:   d.count,
      teePin:  d.teeLat  != null && d.teeLng  != null ? { lat: d.teeLat,  lng: d.teeLng  } : null,
      flagPin: d.flagLat != null && d.flagLng != null ? { lat: d.flagLat, lng: d.flagLng } : null,
    };
  } catch (e) {
    console.warn("[CommunityPins] fetch failed:", e);
    return null;
  }
}

export async function pushPinVote(courseKey, holeIdx, teePin, flagPin) {
  if (!courseKey || (!teePin && !flagPin)) return;
  const docId = `${courseKey}_h${holeIdx + 1}`;
  const ref = doc(db, "global_course_pins", docId);
  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) {
        tx.set(ref, {
          courseKey,
          holeNumber: holeIdx + 1,
          count:   1,
          teeLat:  teePin?.lat  ?? null,
          teeLng:  teePin?.lng  ?? null,
          flagLat: flagPin?.lat ?? null,
          flagLng: flagPin?.lng ?? null,
        });
      } else {
        const d = snap.data();
        const n = (d.count || 0) + 1;
        const update = { count: n };
        if (teePin) {
          update.teeLat = ((d.teeLat ?? teePin.lat) * (n - 1) + teePin.lat) / n;
          update.teeLng = ((d.teeLng ?? teePin.lng) * (n - 1) + teePin.lng) / n;
        }
        if (flagPin) {
          update.flagLat = ((d.flagLat ?? flagPin.lat) * (n - 1) + flagPin.lat) / n;
          update.flagLng = ((d.flagLng ?? flagPin.lng) * (n - 1) + flagPin.lng) / n;
        }
        tx.update(ref, update);
      }
    });
  } catch (e) {
    console.warn("[CommunityPins] vote failed:", e);
  }
}

// Single golf ball icon used for every club — solid circle with 3 arc dimple rows
