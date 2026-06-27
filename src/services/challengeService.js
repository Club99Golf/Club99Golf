import {
  doc,
  collection,
  getDocs,
  deleteDoc,
  serverTimestamp,
  runTransaction,
  updateDoc,
} from "firebase/firestore";
import { db } from "../config/firebase";
import { CHALLENGE_FORMATS } from "../config/constants";

export async function loadChallenges() {
  try {
    const snap = await getDocs(collection(db, "challenges"));

    const challenges = snap.docs.map(d => ({
      id: d.id,
      ...d.data(),
    }));

    const now = new Date();
    const activeChallenges = [];

    for (const challenge of challenges) {
      const expiresAt = challenge.expiresAt?.toDate
        ? challenge.expiresAt.toDate()
        : challenge.expiresAt
          ? new Date(challenge.expiresAt)
          : null;

      const isExpired =
        expiresAt &&
        expiresAt <= now &&
        challenge.status !== "completed" &&
        challenge.status !== "expired" &&
        !challenge.settled;

      if (isExpired) {
        await updateDoc(doc(db, "challenges", challenge.id), {
          status: "expired",
          expiredAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        continue;
      }

      if (challenge.status !== "expired") {
        activeChallenges.push(challenge);
      }
    }

    return activeChallenges.sort((a, b) =>
      (a.date + a.timeWindow) > (b.date + b.timeWindow) ? 1 : -1
    );
  } catch (e) {
    console.error(e);
    return [];
  }
}

export async function joinChallengeInDb(
  challengeId,
  myUid,
  myUsername,
  myOvr,
  myProfilePic = null
) {
  try {
    await runTransaction(db, async tx => {
      const challengeRef = doc(db, "challenges", challengeId);
      const joinerRef = doc(db, "users", myUid);

      // ── ALL READS FIRST ──
      const challengeSnap = await tx.get(challengeRef);
      if (!challengeSnap.exists()) throw new Error("Challenge not found");

      const challenge = challengeSnap.data();
      const existingJoined = challenge.joinedBy || [];
      const alreadyJoined = existingJoined.some(user => user.uid === myUid);
      if (alreadyJoined || challenge.uid === myUid) return;

      const maxPlayers = challenge.maxPlayers || 2;
      if (existingJoined.length >= maxPlayers - 1) throw new Error("Challenge is full");

      const wager = Number(challenge.wager || 0);
      const entryFee = Number(challenge.entryFee || 500);

      const joinerSnap = await tx.get(joinerRef);
      if (!joinerSnap.exists()) throw new Error("User not found");
      const joinerData = joinerSnap.data();
      const joinerCoins = Number(joinerData.coins || 0);
      if (joinerCoins < entryFee + wager) throw new Error(`Not enough coins — you need ${entryFee + wager} coins to join`);

      let creatorData = null;
      let creatorRef = null;
      if (!challenge.creatorPaid) {
        creatorRef = doc(db, "users", challenge.uid);
        const creatorSnap = await tx.get(creatorRef);
        if (!creatorSnap.exists()) throw new Error("Challenge creator not found");
        creatorData = creatorSnap.data();
        if (Number(creatorData.coins || 0) < entryFee + wager) throw new Error("Challenge creator does not have enough coins");
      }

      // ── ALL WRITES AFTER ──
      let potIncrease = 0;
      const updates = {};

      tx.update(joinerRef, { coins: joinerCoins - entryFee - wager });
      if (wager > 0) potIncrease += wager;

      if (!challenge.creatorPaid && creatorRef && creatorData) {
        tx.update(creatorRef, { coins: Number(creatorData.coins || 0) - entryFee - wager });
        updates.creatorPaid = true;
        if (wager > 0) potIncrease += wager;
      }

      const newJoinedBy = [
        ...existingJoined,
        {
          uid: myUid,
          username: myUsername,
          ovr: myOvr || 0,
          profilePic: myProfilePic || joinerData.profilePic || null,
          paid: true,
          joinedAt: new Date().toISOString(),
        },
      ];

      tx.update(challengeRef, {
        ...updates,
        joinedBy: newJoinedBy,
        pot: Number(challenge.pot || 0) + potIncrease,
        status: "active",
        updatedAt: serverTimestamp(),
      });
    });

    return true;
  } catch (e) {
    console.error(e);
    return { error: e?.message || "Failed to join challenge" };
  }
}

export async function deleteChallengeInDb(challengeId) {
  try {
    await deleteDoc(doc(db, "challenges", challengeId));
    return true;
  } catch {
    return false;
  }
}

function getChallengeParticipants(challenge) {
  return [
    {
      uid: challenge.uid,
      username: challenge.username,
      ovr: challenge.ovr || 0,
      profilePic: challenge.profilePic || challenge.creatorProfilePic || null,
      paid: !!challenge.creatorPaid,
    },
    ...(challenge.joinedBy || []),
  ];
}

function getChallengeWinner(participants, scores) {
  const scoredPlayers = participants.filter(player => {
    const score = Number(scores?.[player.uid]);
    return Number.isFinite(score) && score > 0;
  });

  if (scoredPlayers.length === 0) {
    return null;
  }

  scoredPlayers.sort((a, b) => {
    const scoreA = Number(scores[a.uid]);
    const scoreB = Number(scores[b.uid]);

    if (scoreA !== scoreB) {
      return scoreA - scoreB;
    }

    return Number(b.ovr || 0) - Number(a.ovr || 0);
  });

  return scoredPlayers[0];
}

export async function recordChallengeScore(
  challengeId,
  myUid,
  myUsername,
  totalScore
) {
  try {
    let settled = false;
    let winner = null;
    let payout = 0;

    await runTransaction(db, async tx => {
      const challengeRef = doc(db, "challenges", challengeId);
      const challengeSnap = await tx.get(challengeRef);

      if (!challengeSnap.exists()) {
        throw new Error("Challenge not found");
      }

      const challenge = challengeSnap.data();

      if (challenge.settled || challenge.paidOut) {
        return;
      }

      const updatedScores = {
        ...(challenge.scores || {}),
        [myUid]: totalScore,
      };

      const participants = getChallengeParticipants(challenge);
      const maxPlayers = challenge.maxPlayers || 2;

      const fmt = CHALLENGE_FORMATS.find(f => f.id === challenge.format);
      const canAutoSettle = fmt ? fmt.autoSettle : true;

      const allScored =
        participants.length >= maxPlayers &&
        participants.every(player => updatedScores[player.uid] != null);

      if (!allScored || !canAutoSettle) {
        tx.update(challengeRef, {
          scores: updatedScores,
          updatedAt: serverTimestamp(),
        });

        return;
      }

      winner = getChallengeWinner(participants, updatedScores);

      if (!winner?.uid) {
        tx.update(challengeRef, {
          scores: updatedScores,
          updatedAt: serverTimestamp(),
        });

        return;
      }

      const wager = Number(challenge.wager || 0);
      // Payout = wager pot only; entry fees are burned and go to Club99
      payout = Number(challenge.pot || 0) || wager * participants.length;

      const winnerRef = doc(db, "users", winner.uid);
      const winnerSnap = await tx.get(winnerRef);

      if (!winnerSnap.exists()) {
        throw new Error("Winner profile not found");
      }

      const winnerData = winnerSnap.data();
      const currentCoins = Number(winnerData.coins || 0);

      if (payout > 0) {
        tx.update(winnerRef, {
          coins: currentCoins + payout,
        });
      }

      tx.update(challengeRef, {
        scores: updatedScores,
        settled: true,
        paidOut: true,
        status: "completed",
        winner,
        winnerUid: winner.uid,
        winnerUsername: winner.username || winnerData.username || "WINNER",
        winnerProfilePic: winner.profilePic || winnerData.profilePic || null,
        payoutAmount: payout,
        completedAt: serverTimestamp(),
        paidOutAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      settled = true;
    });

    return {
      settled,
      winner,
      wager: payout,
      payout,
    };
  } catch (e) {
    console.error(e);
    return null;
  }
}

export async function submitChallengeReview(challengeId, reviewerUid, review) {
  try {
    await updateDoc(doc(db, "challenges", challengeId), {
      [`reviews.${reviewerUid}`]: review,
    });
    return true;
  } catch (e) {
    console.error(e);
    return false;
  }
}

export async function settleChallengeInDb(challengeId, winner, wager = 0) {
  try {
    await runTransaction(db, async tx => {
      const challengeRef = doc(db, "challenges", challengeId);
      const challengeSnap = await tx.get(challengeRef);

      if (!challengeSnap.exists()) {
        throw new Error("Challenge not found");
      }

      const challenge = challengeSnap.data();

      if (challenge.settled || challenge.paidOut) {
        return;
      }

      const participants = getChallengeParticipants(challenge);

      const wagerPerPlayer = Number(challenge.wager || 0);
      // Payout = wager pot only; entry fees are burned and go to Club99
      const payout =
        Number(challenge.pot || 0) ||
        wagerPerPlayer * participants.length;

      const winnerRef = doc(db, "users", winner.uid);
      const winnerSnap = await tx.get(winnerRef);

      if (!winnerSnap.exists()) {
        throw new Error("Winner profile not found");
      }

      const winnerData = winnerSnap.data();
      const currentCoins = Number(winnerData.coins || 0);

      if (payout > 0) {
        tx.update(winnerRef, {
          coins: currentCoins + payout,
        });
      }

      tx.update(challengeRef, {
        settled: true,
        paidOut: true,
        status: "completed",
        winner,
        winnerUid: winner.uid,
        winnerUsername: winner.username || winnerData.username || "WINNER",
        winnerProfilePic: winner.profilePic || winnerData.profilePic || null,
        payoutAmount: payout,
        completedAt: serverTimestamp(),
        paidOutAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });

    return true;
  } catch (e) {
    console.error(e);
    return false;
  }
}

export async function expireChallengeIfNeeded(challengeId, challenge) {
  if (!challengeId || !challenge) {
    return false;
  }

  if (challenge.status === "completed" || challenge.status === "expired") {
    return false;
  }

  const expiresAt = challenge.expiresAt?.toDate
    ? challenge.expiresAt.toDate()
    : challenge.expiresAt
      ? new Date(challenge.expiresAt)
      : null;

  if (!expiresAt || expiresAt > new Date()) {
    return false;
  }

  await updateDoc(doc(db, "challenges", challengeId), {
    status: "expired",
    expiredAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return true;
}

export function formatChallengeDate(dateStr) {
  if (!dateStr) return dateStr;
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const s = d === 1 || d === 21 || d === 31 ? "st" : d === 2 || d === 22 ? "nd" : d === 3 || d === 23 ? "rd" : "th";
  return `${days[date.getDay()]}, ${months[m - 1]} ${d}${s}`;
}
