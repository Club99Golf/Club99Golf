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

export const REACTIONS = [
  { key: "fire", label: "🔥", title: "Fire round" },
  { key: "skull", label: "💀", title: "Rough day" },
  { key: "lock", label: "🎯", title: "Dialed in" },
  { key: "goat", label: "🐐", title: "GOAT" },
];
export function roundReactionKey(ownerUid, roundId) { return `${ownerUid}_${roundId}`; }

export async function loadReactions(ownerUid, roundId) {
  try { const snap = await getDoc(doc(db, "reactions", roundReactionKey(ownerUid, roundId))); return snap.exists() ? snap.data() : {}; } catch { return {}; }
}

export async function setReaction(ownerUid, roundId, myUid, reaction) {
  try {
    const key = roundReactionKey(ownerUid, roundId);
    const ref = doc(db, "reactions", key);
    const snap = await getDoc(ref);
    const data = snap.exists() ? snap.data() : {};
    if (data[myUid] === reaction) { const updated = { ...data }; delete updated[myUid]; await setDoc(ref, updated); return updated; }
    else { const updated = { ...data, [myUid]: reaction }; await setDoc(ref, updated); return updated; }
  } catch { return {}; }
}

export async function loadComments(ownerUid, roundId) {
  try { const ref = collection(db, "reactions", roundReactionKey(ownerUid, roundId), "comments"); const snap = await getDocs(query(ref, orderBy("createdAt", "asc"), limit(50))); return snap.docs.map(d => ({ id: d.id, ...d.data() })); } catch { return []; }
}

export async function addComment(ownerUid, roundId, uid, username, text) {
  try { const ref = collection(db, "reactions", roundReactionKey(ownerUid, roundId), "comments"); await addDoc(ref, { uid, username, text: text.trim(), createdAt: serverTimestamp() }); return true; } catch { return false; }
}
