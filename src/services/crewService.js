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
export async function createCrewInFirestore(leaderUid, leaderUsername, leaderOvr, leaderLevel, leaderProfilePic, crewName) {
  const nameUpper = crewName.trim().toUpperCase();
  const q = query(collection(db, "crews"), where("name", "==", nameUpper));
  const snap = await getDocs(q);
  if (!snap.empty) throw new Error("NAME_TAKEN");
  const crewRef = await addDoc(collection(db, "crews"), {
    name: nameUpper, leaderUid, leaderUsername,
    members: [{ uid: leaderUid, username: leaderUsername, ovr: leaderOvr, level: leaderLevel || 1, profilePic: leaderProfilePic || null }],
    memberCount: 1, createdAt: serverTimestamp(),
  });
  await updateDoc(doc(db, "users", leaderUid), { crewId: crewRef.id, crewName: nameUpper });
  return crewRef.id;
}

export async function requestJoinCrew(crewId, crewName, fromUid, fromUsername, fromOvr, fromLevel, fromProfilePic) {
  const ref = await addDoc(collection(db, "crewRequests"), { crewId, crewName, fromUid, fromUsername, fromOvr, fromLevel: fromLevel || 1, fromProfilePic: fromProfilePic || null, createdAt: serverTimestamp() });
  return ref.id;
}

export async function acceptCrewRequest(requestId, crewId, crewName, newMember) {
  await runTransaction(db, async tx => {
    const crewRef = doc(db, "crews", crewId);
    const crewSnap = await tx.get(crewRef);
    if (!crewSnap.exists()) throw new Error("CREW_NOT_FOUND");
    const crew = crewSnap.data();
    if ((crew.members || []).length >= 8) throw new Error("CREW_FULL");
    const updatedMembers = [...(crew.members || []), newMember];
    tx.update(crewRef, { members: updatedMembers, memberCount: updatedMembers.length });
    tx.delete(doc(db, "crewRequests", requestId));
    tx.update(doc(db, "users", newMember.uid), { crewId, crewName });
  });
}

export async function declineCrewRequest(requestId) { await deleteDoc(doc(db, "crewRequests", requestId)); }

export async function leaveCrewInFirestore(crewId, uid, isLeader, allMembers) {
  if (isLeader) {
    await deleteDoc(doc(db, "crews", crewId));
    for (const m of (allMembers || [])) {
      await updateDoc(doc(db, "users", m.uid), { crewId: null, crewName: null }).catch(() => {});
    }
  } else {
    await runTransaction(db, async tx => {
      const crewRef = doc(db, "crews", crewId);
      const snap = await tx.get(crewRef);
      if (!snap.exists()) return;
      const updated = snap.data().members.filter(m => m.uid !== uid);
      tx.update(crewRef, { members: updated, memberCount: updated.length });
      tx.update(doc(db, "users", uid), { crewId: null, crewName: null });
    });
  }
}

export async function fetchPublicCrews() {
  try {
    const q = query(collection(db, "crews"), orderBy("memberCount", "desc"), limit(20));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch { return []; }
}
