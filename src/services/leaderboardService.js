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
export async function loadLeaderboard() {
  try { const snap = await getDocs(collection(db, "users")); return snap.docs.map(d => ({ uid: d.id, ...d.data() })).filter(u => u.username).sort((a, b) => b.ovr - a.ovr); } catch { return []; }
}
