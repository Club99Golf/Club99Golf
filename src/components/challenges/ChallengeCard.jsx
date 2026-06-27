import { useState } from "react";
import { Theme } from "../../Theme";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../../config/firebase";
import { CHALLENGE_FORMATS } from "../../config/constants";
import { formatChallengeDate } from "../../services/challengeService";

export default function ChallengeCard({ challenge, myUid, myUsername, myCoins, challengeFee, onJoin, onDelete, onSettle, onReview, onStartRound, onViewProfile }) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [reviewStars, setReviewStars] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [reviewBusy, setReviewBusy] = useState(false);
  const [booked, setBooked] = useState(false);
  const alreadyJoined = (challenge.joinedBy || []).some(u => u.uid === myUid);
  const isOwn = challenge.uid === myUid;
  const isParticipant = isOwn || alreadyJoined;
  const joinedCount = (challenge.joinedBy || []).length;
  const wager = challenge.wager || 0;
  // Use the joiner's subscription-based fee if passed, otherwise fall back to what's stored on the challenge
  const entryFee = challengeFee !== undefined ? challengeFee : (challenge.entryFee || 500);
  const totalCost = entryFee + wager;
  const maxPlayers = challenge.maxPlayers || 2;
  const isFull = joinedCount >= maxPlayers - 1;
  const fmt = CHALLENGE_FORMATS.find(f => f.id === challenge.format) || CHALLENGE_FORMATS[0];
  const canAffordJoin = myCoins >= totalCost;
  const myReview = (challenge.reviews || {})[myUid];

  const getChallengeProfilePic = player => {
    return (
      player?.profilePic ||
      player?.creatorProfilePic ||
      player?.photoURL ||
      player?.avatarUrl ||
      player?.profileImage ||
      player?.image ||
      null
    );
  };

  const creatorPlayer = {
    uid: challenge.uid,
    username: challenge.username,
    ovr: challenge.ovr,
    profilePic: challenge.profilePic || challenge.creatorProfilePic || null,
    isOwner: true,
  };

  const allPlayers = [
    creatorPlayer,
    ...(challenge.joinedBy || []).map(u => ({ ...u, isOwner: false })),
  ];

  const payoutAmount =
    Number(challenge.payoutAmount || 0) ||
    Number(challenge.pot || 0) ||
    Number(wager || 0) * allPlayers.length;

  // For 1v1 the opponent is one person; for group formats it's all other participants
  const opponent = isOwn ? (challenge.joinedBy || [])[0] : creatorPlayer;

  async function handleConfirmJoin() {
    if (!canAffordJoin) { setJoinError(`You need ${totalCost.toLocaleString()} coins to join this challenge.`); return; }
    setJoining(true);
    setJoinError("");
    try {
      await addDoc(collection(db, "notifications"), {
        toUid: challenge.uid,
        type: "challenge_joined",
        fromUsername: myUsername,
        course: challenge.course,
        date: challenge.date,
        createdAt: serverTimestamp(),
      });
    } catch {}
    const result = await onJoin(challenge.id, wager);
    setJoining(false);
    if (result?.error) {
      setJoinError(result.error);
    } else {
      setShowConfirm(false);
    }
  }

  async function handleReview() {
    if (!reviewStars) return;
    setReviewBusy(true);
    const review = { rating: reviewStars, text: reviewText.trim(), reviewerUsername: myUsername, targetUid: opponent?.uid, targetUsername: opponent?.username, createdAt: new Date().toISOString() };
    await onReview(challenge.id, myUid, review);
    setReviewBusy(false);
  }

  const dateLabel = `${formatChallengeDate(challenge.date)} • ${challenge.timeWindow}`;

  return (
    <>
      <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e5e7eb", boxShadow: "0 2px 8px rgba(0,0,0,0.06)", marginBottom: 12, overflow: "hidden", animation: "fadeUp 0.3s ease" }}>

        {/* ── Header: avatar + username / OVR badge ── */}
        <div style={{ padding: "16px 16px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button onClick={() => onViewProfile?.({ uid: challenge.uid, username: challenge.username, profilePic: getChallengeProfilePic(creatorPlayer), ovr: challenge.ovr })} style={{ border: "2px solid rgba(125,162,126,0.22)", padding: 0, cursor: "pointer", width: 46, height: 46, borderRadius: "50%", background: "#f3f4f6", overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {getChallengeProfilePic(creatorPlayer)
                ? <img src={getChallengeProfilePic(creatorPlayer)} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" />
                : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>}
            </button>
            <div>
              <button onClick={() => onViewProfile?.({ uid: challenge.uid, username: challenge.username, profilePic: getChallengeProfilePic(creatorPlayer), ovr: challenge.ovr })} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 16, fontWeight: 900, fontFamily: "Bebas Neue", letterSpacing: 1.2, color: "#111827", lineHeight: 1.1 }}>{challenge.username}</button>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
                <span style={{ fontSize: 10, fontWeight: 800, color: Theme.primaryGreen, background: "rgba(125,162,126,0.1)", borderRadius: 6, padding: "2px 7px", letterSpacing: 0.5 }}>{fmt.label}</span>
                <span style={{ fontSize: 10, color: "#9ca3af", fontWeight: 600 }}>{joinedCount + 1}/{maxPlayers} joined</span>
              </div>
            </div>
          </div>

          {/* Poster OVR badge */}
          <div style={{ background: "rgba(125,162,126,0.08)", border: "1.5px solid rgba(125,162,126,0.28)", borderRadius: 10, padding: "5px 11px", textAlign: "center", flexShrink: 0 }}>
            <div style={{ fontSize: 22, fontWeight: 900, fontFamily: "Bebas Neue", color: Theme.primaryGreen, lineHeight: 1 }}>{challenge.ovr || "—"}</div>
            <div style={{ fontSize: 8, fontWeight: 800, color: Theme.primaryGreen, letterSpacing: 1.5, opacity: 0.75, marginTop: 1 }}>OVR</div>
          </div>
        </div>

        {/* ── Divider ── */}
        <div style={{ height: 1, background: "#f3f4f6", margin: "0 16px" }} />

        {/* ── Course + Date/Time ── */}
        <div style={{ padding: "13px 16px 16px", display: "flex", flexDirection: "column", gap: 9 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={Theme.primaryGreen} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
            <span style={{ fontSize: 14, fontWeight: 800, color: "#111827" }}>{challenge.course}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            <span style={{ fontSize: 13, color: "#374151", fontWeight: 600 }}>{dateLabel}</span>
          </div>
          {challenge.wager > 0 && (
            <div style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "rgba(234,179,8,0.1)", border: "1.5px solid rgba(234,179,8,0.35)", borderRadius: 20, padding: "4px 10px", alignSelf: "flex-start" }}>
              <span style={{ fontSize: 13 }}>🪙</span>
              <span style={{ fontSize: 12, fontWeight: 800, color: "#b45309" }}>{challenge.wager.toLocaleString()} coin wager</span>
            </div>
          )}
          {challenge.message ? (
            <div style={{ fontSize: 13, color: "#4b5563", fontStyle: "italic", lineHeight: 1.45, paddingTop: 2 }}>"{challenge.message}"</div>
          ) : null}
          {/* Roster — all participants with OVR */}
          {(() => {
            const slots = maxPlayers - allPlayers.length;
            return (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, paddingTop: 2 }}>
                {allPlayers.map(p => {
                  const pic = getChallengeProfilePic(p);
                  return (
                    <div key={p.uid} style={{ display: "flex", alignItems: "center", gap: 5, background: p.isOwner ? "rgba(125,162,126,0.08)" : "#f3f4f6", border: p.isOwner ? "1px solid rgba(125,162,126,0.25)" : "1px solid #e5e7eb", borderRadius: 20, padding: "4px 10px 4px 6px" }}>
                      <div style={{ background: pic ? "#f3f4f6" : Theme.primaryGreen, borderRadius: "50%", width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden" }}>
                        {pic
                          ? <img src={pic} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" />
                          : <span style={{ fontSize: 9, fontWeight: 900, color: "#fff", fontFamily: "Bebas Neue", letterSpacing: 0.3 }}>{p.ovr || "—"}</span>}
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#374151" }}>{p.username}</span>
                      {p.isOwner && <span style={{ fontSize: 9, color: Theme.primaryGreen, fontWeight: 800 }}>HOST</span>}
                      <span style={{ fontSize: 9, color: "#9ca3af", fontWeight: 800 }}>{p.ovr || "—"} OVR</span>
                    </div>
                  );
                })}
                {Array.from({ length: slots }).map((_, i) => (
                  <div key={`open-${i}`} style={{ display: "flex", alignItems: "center", gap: 5, background: "#fafafa", border: "1px dashed #d1d5db", borderRadius: 20, padding: "4px 10px 4px 6px" }}>
                    <div style={{ width: 18, height: 18, borderRadius: "50%", border: "1.5px dashed #d1d5db", flexShrink: 0 }} />
                    <span style={{ fontSize: 11, color: "#9ca3af", fontWeight: 600 }}>Open</span>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>

        {/* ── Action ── */}
        <div style={{ padding: "0 16px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
          {challenge.settled ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "12px 0", background: "rgba(234,179,8,0.08)", border: "1.5px solid rgba(234,179,8,0.3)", borderRadius: 12 }}>
                <span style={{ fontSize: 18 }}>🏆</span>
                <div>
                  <span style={{ fontSize: 13, fontWeight: 800, color: "#b45309" }}>{challenge.winner?.username} won{payoutAmount > 0 ? ` · 🪙 ${payoutAmount.toLocaleString()} coins` : ""}!</span>
                  {challenge.scores && (() => {
                    const participants = [{ uid: challenge.uid, username: challenge.username }, ...(challenge.joinedBy || [])];
                    return (
                      <div style={{ fontSize: 11, color: "#92400e", marginTop: 2 }}>
                        {participants.map(p => `${p.username}: ${challenge.scores[p.uid] ?? "—"}`).join("  ·  ")}
                      </div>
                    );
                  })()}
                </div>
              </div>
              {/* Review section — only for participants who haven't reviewed yet */}
              {isParticipant && opponent && (
                myReview ? (
                  <div style={{ padding: "10px 14px", background: "#f9fafb", borderRadius: 12 }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: "#9ca3af", letterSpacing: 1.2, marginBottom: 4 }}>YOUR REVIEW</div>
                    <div style={{ display: "flex", gap: 2, marginBottom: 4 }}>
                      {[1,2,3,4,5].map(s => <span key={s} style={{ fontSize: 16, color: s <= myReview.rating ? "#f59e0b" : "#d1d5db" }}>★</span>)}
                    </div>
                    {myReview.text && <div style={{ fontSize: 12, color: "#6b7280", fontStyle: "italic" }}>"{myReview.text}"</div>}
                  </div>
                ) : (
                  <div style={{ padding: "12px 14px", background: "#f9fafb", borderRadius: 12 }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: "#9ca3af", letterSpacing: 1.2, marginBottom: 8 }}>RATE {opponent.username?.toUpperCase()}</div>
                    <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
                      {[1,2,3,4,5].map(s => (
                        <button key={s} onClick={() => setReviewStars(s)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 24, color: s <= reviewStars ? "#f59e0b" : "#d1d5db", padding: 0, lineHeight: 1 }}>★</button>
                      ))}
                    </div>
                    <textarea
                      value={reviewText}
                      onChange={e => setReviewText(e.target.value)}
                      placeholder="Leave a comment… (optional)"
                      maxLength={200}
                      rows={2}
                      style={{ width: "100%", padding: "8px 10px", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 12, fontFamily: "inherit", resize: "none", boxSizing: "border-box", outline: "none" }}
                    />
                    <button
                      onClick={handleReview}
                      disabled={!reviewStars || reviewBusy}
                      style={{ marginTop: 8, width: "100%", padding: "10px 0", background: reviewStars ? Theme.primaryGreen : "#e5e7eb", border: "none", borderRadius: 10, color: reviewStars ? "#fff" : "#9ca3af", fontWeight: 800, fontSize: 13, cursor: reviewStars ? "pointer" : "default" }}
                    >
                      {reviewBusy ? "Submitting…" : "Submit Review"}
                    </button>
                  </div>
                )
              )}
              {/* Show opponent's review of you */}
              {isParticipant && opponent && (challenge.reviews || {})[opponent.uid] && (
                <div style={{ padding: "10px 14px", background: "#f9fafb", borderRadius: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: "#9ca3af", letterSpacing: 1.2, marginBottom: 4 }}>{opponent.username}'s REVIEW</div>
                  <div style={{ display: "flex", gap: 2, marginBottom: 4 }}>
                    {[1,2,3,4,5].map(s => <span key={s} style={{ fontSize: 16, color: s <= (challenge.reviews || {})[opponent.uid].rating ? "#f59e0b" : "#d1d5db" }}>★</span>)}
                  </div>
                  {(challenge.reviews || {})[opponent.uid].text && <div style={{ fontSize: 12, color: "#6b7280", fontStyle: "italic" }}>"{(challenge.reviews || {})[opponent.uid].text}"</div>}
                </div>
              )}
            </div>
          ) : isOwn ? (
            <>
              {joinedCount > 0 ? (
                <>
                  {!(challenge.scores?.[myUid] != null) && (
                    <button
                      onClick={() => onStartRound?.(challenge.id, challenge.course, challenge.teeColor, challenge.holes, challenge.nineHolesSide)}
                      style={{ width: "100%", padding: "13px 0", background: "#111827", border: "none", borderRadius: 12, color: "#fff", fontWeight: 800, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, letterSpacing: 0.5, boxSizing: "border-box" }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8" fill="currentColor" stroke="none"/></svg>
                      Start Round
                    </button>
                  )}
                  {challenge.scores?.[myUid] != null && (
                    <div style={{ textAlign: "center", fontSize: 12, color: "#9ca3af", fontWeight: 700 }}>Score submitted: {challenge.scores[myUid]}</div>
                  )}
                  <a
                    href={`https://www.golfnow.com/tee-times/search?when=${challenge.date}&searchQuery=${encodeURIComponent(challenge.course)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setBooked(false)}
                    style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, width: "100%", padding: "13px 0", background: Theme.primaryGreen, border: "none", borderRadius: 12, color: "#fff", fontWeight: 800, fontSize: 14, textDecoration: "none", boxSizing: "border-box" }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                    Book on GolfNow
                  </a>
                  {!booked ? (
                    <button
                      onClick={() => setBooked(true)}
                      style={{ width: "100%", padding: "11px 0", background: "transparent", border: `1.5px solid ${Theme.primaryGreen}`, borderRadius: 12, color: Theme.primaryGreen, fontWeight: 800, fontSize: 13, cursor: "pointer", boxSizing: "border-box" }}
                    >
                      ✓ Booked
                    </button>
                  ) : (
                    <div style={{ width: "100%", padding: "11px 0", background: "rgba(125,162,126,0.12)", border: `1.5px solid ${Theme.primaryGreen}`, borderRadius: 12, color: Theme.primaryGreen, fontWeight: 800, fontSize: 13, textAlign: "center", boxSizing: "border-box" }}>
                      ✓ Tee Time Booked!
                    </div>
                  )}
                  {wager > 0 && !challenge.settled && (
                    <div style={{ marginTop: 4, padding: "10px 14px", background: "rgba(234,179,8,0.08)", border: "1.5px solid rgba(234,179,8,0.25)", borderRadius: 12, textAlign: "center" }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#b45309" }}>🏆 Waiting for all scores — winner paid out automatically</div>
                    </div>
                  )}
                </>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ padding: "12px 0", background: "rgba(125,162,126,0.07)", borderRadius: 12, textAlign: "center", fontSize: 13, fontWeight: 800, color: Theme.primaryGreen, letterSpacing: 0.3 }}>
                    {`Waiting for players… (${joinedCount + 1}/${maxPlayers})`}
                  </div>
                </div>
              )}
              {confirmDelete ? (
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <button onClick={() => setConfirmDelete(false)} style={{ flex: 1, padding: "10px 0", background: "#f3f4f6", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, color: "#374151", cursor: "pointer" }}>Cancel</button>
                  <button onClick={() => onDelete(challenge.id, wager, joinedCount)} style={{ flex: 1, padding: "10px 0", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, fontSize: 13, fontWeight: 800, color: "#dc2626", cursor: "pointer" }}>Delete</button>
                </div>
              ) : (
                <button onClick={() => setConfirmDelete(true)} style={{ width: "100%", marginTop: 8, padding: "9px 0", background: "none", border: "none", fontSize: 12, fontWeight: 700, color: "#9ca3af", cursor: "pointer" }}>
                  Delete challenge
                </button>
              )}
            </>
          ) : alreadyJoined ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ width: "100%", padding: "10px 0", background: "#f0fdf4", border: `1.5px solid ${Theme.primaryGreen}`, borderRadius: 12, color: Theme.primaryGreen, fontWeight: 800, fontSize: 13, textAlign: "center" }}>✓  Joined</div>
              {!(challenge.scores?.[myUid] != null) && (
                <button
                  onClick={() => onStartRound?.(challenge.id, challenge.course, challenge.teeColor, challenge.holes, challenge.nineHolesSide)}
                  style={{ width: "100%", padding: "13px 0", background: "#111827", border: "none", borderRadius: 12, color: "#fff", fontWeight: 800, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, letterSpacing: 0.5 }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8" fill="currentColor" stroke="none"/></svg>
                  Start Round
                </button>
              )}
              {challenge.scores?.[myUid] != null && (
                <div style={{ textAlign: "center", fontSize: 12, color: "#9ca3af", fontWeight: 700 }}>Score submitted: {challenge.scores[myUid]}</div>
              )}
            </div>
          ) : (
            <button
              onClick={() => !isFull && setShowConfirm(true)}
              disabled={isFull}
              style={{ width: "100%", padding: "13px 0", background: isFull ? "#f3f4f6" : Theme.primaryGreen, border: "none", borderRadius: 12, color: isFull ? "#9ca3af" : "#fff", fontWeight: 800, fontSize: 14, cursor: isFull ? "default" : "pointer", transition: "background 0.15s", letterSpacing: 0.3 }}
            >
              {isFull ? "Lobby Full" : "Join Challenge"}
            </button>
          )}
        </div>
      </div>

      {/* ── Confirmation modal ── */}
      {showConfirm && (
        <div onClick={() => setShowConfirm(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 400, padding: "0 28px" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 20, padding: "28px 24px 24px", width: "100%", maxWidth: 360, animation: "fadeUp 0.2s ease" }}>
            <div style={{ fontSize: 22, fontWeight: 900, fontFamily: "Bebas Neue", letterSpacing: 1, marginBottom: 14 }}>JOIN THIS ROUND?</div>
            <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 6 }}>
              You're joining <strong style={{ color: "#111827" }}>{challenge.username}</strong>'s challenge at:
            </div>
            <div style={{ background: "#f9fafb", borderRadius: 12, padding: "12px 14px", marginBottom: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: "#111827", marginBottom: 4 }}>{challenge.course}</div>
              <div style={{ fontSize: 13, color: "#6b7280" }}>{dateLabel}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 8, padding: "6px 10px", background: "rgba(234,179,8,0.1)", border: "1.5px solid rgba(234,179,8,0.35)", borderRadius: 10 }}>
                <span style={{ fontSize: 14 }}>🪙</span>
                <span style={{ fontSize: 13, fontWeight: 800, color: "#b45309" }}>{entryFee.toLocaleString()} coin entry fee</span>
              </div>
              {wager > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 6, padding: "6px 10px", background: "rgba(99,102,241,0.08)", border: "1.5px solid rgba(99,102,241,0.25)", borderRadius: 10 }}>
                  <span style={{ fontSize: 13 }}>🏆</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#4338ca" }}>{wager.toLocaleString()} coin wager — winner takes the pot</span>
                </div>
              )}
            </div>
            {!canAffordJoin && (
              <div style={{ marginBottom: 12, padding: "10px 14px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, fontSize: 12, fontWeight: 700, color: "#dc2626" }}>
                You need {totalCost.toLocaleString()} coins to join. Your balance: {myCoins.toLocaleString()}.
              </div>
            )}
            {joinError && <div style={{ marginBottom: 12, padding: "10px 14px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, fontSize: 12, fontWeight: 700, color: "#dc2626" }}>{joinError}</div>}
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => { setShowConfirm(false); setJoinError(""); }} style={{ flex: 1, padding: "13px 0", background: "#f3f4f6", border: "none", borderRadius: 12, fontSize: 13, fontWeight: 700, color: "#374151", cursor: "pointer" }}>Cancel</button>
              <button onClick={handleConfirmJoin} disabled={joining || !canAffordJoin} style={{ flex: 2, padding: "13px 0", background: !canAffordJoin ? "#e5e7eb" : Theme.primaryGreen, border: "none", borderRadius: 12, fontSize: 13, fontWeight: 800, color: !canAffordJoin ? "#9ca3af" : "#fff", cursor: (joining || !canAffordJoin) ? "default" : "pointer" }}>
                {joining ? "Joining…" : "Confirm Join"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
