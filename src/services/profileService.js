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
export async function saveProfileToFirestore(uid, profile) {
  try { await setDoc(doc(db, "users", uid), sanitizeForFirestore(profile), { merge: true }); } catch(e) { console.error(e); }
}

// Recalculates OVR, level, rounds array from stored history for a single profile object

export async function selfRepairProfile(uid, profile) {
  const repaired = repairProfile(profile);
  const ovrDiff = Math.abs((repaired.ovr || 0) - (profile.ovr || 0));
  const xpDiff = Math.abs((repaired.experience || 0) - (profile.experience || 0));
  const levelDiff = Math.abs((repaired.level || 0) - (profile.level || 0));
  if (ovrDiff > 1 || xpDiff > 50 || levelDiff > 0) {
    console.log(`[Club99] Repairing profile for ${uid}: OVR ${profile.ovr}→${repaired.ovr}, XP ${profile.experience}→${repaired.experience}`);
    await saveProfileToFirestore(uid, repaired);
    return repaired;
  }
  return profile;
}

// Admin: repairs ALL users in Firestore (call from console: window.repairAllUsers())

export async function repairAllUsersInFirestore() {
  try {
    const snap = await getDocs(collection(db, "users"));
    const users = snap.docs.map(d => ({ uid: d.id, ...d.data() })).filter(u => u.username);
    console.log(`[Club99] Repairing ${users.length} users...`);
    let fixed = 0;
    for (const u of users) {
      const repaired = repairProfile(u);
      const ovrDiff = Math.abs((repaired.ovr || 0) - (u.ovr || 0));
      const xpDiff = Math.abs((repaired.experience || 0) - (u.experience || 0));
      const levelDiff = Math.abs((repaired.level || 0) - (u.level || 0));
      if (ovrDiff > 1 || xpDiff > 50 || levelDiff > 0) {
        console.log(`  Fixing ${u.username}: OVR ${u.ovr}→${repaired.ovr}, XP ${u.experience}→${repaired.experience}, LVL ${u.level}→${repaired.level}`);
        await saveProfileToFirestore(u.uid, repaired);
        fixed++;
      }
    }
    console.log(`[Club99] Done. Fixed ${fixed}/${users.length} users.`);
    return { total: users.length, fixed };
  } catch(e) {
    console.error("[Club99] Repair failed:", e);
    return { error: e.message };
  }
}

export async function loadProfileFromFirestore(uid) {
  const ref = doc(db, "users", uid);
  try {
    // Prefer local cache — it includes any pending writes (e.g. liveRound cleared on submit)
    // that haven't been confirmed by the server yet. Falls back to server on cache miss.
    const cached = await getDocFromCache(ref);
    if (cached.exists()) return cached.data();
  } catch { /* cache miss — fall through */ }
  try { const snap = await getDoc(ref); return snap.exists() ? snap.data() : null; } catch { return null; }
}
