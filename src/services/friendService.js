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
export async function removeFriendInDb(uid, friendUid) {
  await Promise.all([
    deleteDoc(doc(db, "friends", `${uid}_${friendUid}`)).catch(() => {}),
    deleteDoc(doc(db, "friends", `${friendUid}_${uid}`)).catch(() => {}),
  ]);
}

export async function searchUserByUsername(username) {
  try { const snap = await getDocs(collection(db, "users")); return snap.docs.map(d => ({ uid: d.id, ...d.data() })).find(u => u.username === username.toUpperCase()) || null; } catch { return null; }
}

export async function sendFriendRequest(fromUid, fromUsername, toUid) {
  try { await setDoc(doc(db, "friendRequests", `${fromUid}_${toUid}`), { from: fromUid, fromUsername, to: toUid, status: "pending", createdAt: Date.now() }); } catch(e) { console.error(e); }
}

export async function loadFriendRequests(uid) {
  try { const snap = await getDocs(collection(db, "friendRequests")); return snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(r => r.to === uid && r.status === "pending"); } catch { return []; }
}

export async function respondToFriendRequest(requestId, fromUid, toUid, accept) {
  await deleteDoc(doc(db, "friendRequests", requestId));
  if (accept) {
    await setDoc(doc(db, "friends", `${fromUid}_${toUid}`), { users: [fromUid, toUid], createdAt: Date.now() });
    await setDoc(doc(db, "friends", `${toUid}_${fromUid}`), { users: [toUid, fromUid], createdAt: Date.now() });
  }
}

export async function loadFriends(uid) {
  try { const snap = await getDocs(collection(db, "friends")); return snap.docs.map(d => d.data()).filter(f => f.users.includes(uid)).map(f => f.users.find(u => u !== uid)); } catch { return []; }
}

export async function loadFriendsFeed(friendUids, myUid) {
  try {
    const snap = await getDocs(collection(db, "users"));
    const allUsers = snap.docs.map(d => ({ uid: d.id, ...d.data() }));
    // Include own profile + friends
    const relevant = allUsers.filter(u => u.uid === myUid || friendUids.includes(u.uid));
    const entries = [];
    relevant.forEach(f => {
      (f.history || []).slice(0, 5).forEach(r => entries.push({
        ...r,
        username: f.username,
        ownerUid: f.uid,
        ownerProfilePic: f.profilePic || null,
      }));
    });
    return entries.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 30);
  } catch { return []; }
}
