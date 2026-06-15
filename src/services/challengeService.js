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
import { CHALLENGE_FORMATS } from "../config/constants";
export async function loadChallenges() {
  try {
    const snap = await getDocs(collection(db, "challenges"));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.date + a.timeWindow) > (b.date + b.timeWindow) ? 1 : -1);
  } catch { return []; }
}

export async function joinChallengeInDb(challengeId, myUid, myUsername, myOvr) {
  try {
    await runTransaction(db, async tx => {
      const ref = doc(db, "challenges", challengeId);
      const snap = await tx.get(ref);
      if (!snap.exists()) return;
      const data = snap.data();
      const already = (data.joinedBy || []).some(u => u.uid === myUid);
      if (!already) tx.update(ref, { joinedBy: [...(data.joinedBy || []), { uid: myUid, username: myUsername, ovr: myOvr || 0 }] });
    });
    return true;
  } catch { return false; }
}

export async function deleteChallengeInDb(challengeId) {
  try { await deleteDoc(doc(db, "challenges", challengeId)); return true; } catch { return false; }
}

export async function recordChallengeScore(challengeId, myUid, myUsername, totalScore) {
  try {
    let settled = false, winner = null, wager = 0;
    await runTransaction(db, async tx => {
      const ref = doc(db, "challenges", challengeId);
      const snap = await tx.get(ref);
      if (!snap.exists()) return;
      const data = snap.data();
      if (data.settled) return;
      const updatedScores = { ...(data.scores || {}), [myUid]: totalScore };
      const participants = [{ uid: data.uid, username: data.username }, ...(data.joinedBy || [])];
      const maxPlayers = data.maxPlayers || 2;
      const fmt = CHALLENGE_FORMATS.find(f => f.id === data.format);
      const canAutoSettle = fmt ? fmt.autoSettle : true;
      const allScored = participants.length >= maxPlayers && participants.every(p => updatedScores[p.uid] != null);
      if (allScored && canAutoSettle) {
        winner = participants.reduce((best, p) => updatedScores[p.uid] < updatedScores[best.uid] ? p : best);
        wager = data.wager || 0;
        tx.update(ref, { scores: updatedScores, settled: true, winner });
        if (wager > 0) {
          const winnerRef = doc(db, "users", winner.uid);
          const wSnap = await tx.get(winnerRef);
          if (wSnap.exists()) tx.update(winnerRef, { coins: (wSnap.data().coins || 0) + wager * 2 });
        }
        settled = true;
      } else {
        tx.update(ref, { scores: updatedScores });
      }
    });
    return { settled, winner, wager };
  } catch (e) { console.error(e); return null; }
}

export async function submitChallengeReview(challengeId, reviewerUid, review) {
  try {
    await updateDoc(doc(db, "challenges", challengeId), { [`reviews.${reviewerUid}`]: review });
    return true;
  } catch (e) { console.error(e); return false; }
}

export async function settleChallengeInDb(challengeId, winner, wager) {
  try {
    await updateDoc(doc(db, "challenges", challengeId), { settled: true, winner });
    if (wager > 0) {
      await runTransaction(db, async tx => {
        const ref = doc(db, "users", winner.uid);
        const snap = await tx.get(ref);
        if (!snap.exists()) return;
        tx.update(ref, { coins: (snap.data().coins || 0) + wager * 2 });
      });
    }
    return true;
  } catch (e) { console.error(e); return false; }
}

export function formatChallengeDate(dateStr) {
  if (!dateStr) return dateStr;
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const days = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const s = d === 1 || d === 21 || d === 31 ? "st" : d === 2 || d === 22 ? "nd" : d === 3 || d === 23 ? "rd" : "th";
  return `${days[date.getDay()]}, ${months[m-1]} ${d}${s}`;
}
