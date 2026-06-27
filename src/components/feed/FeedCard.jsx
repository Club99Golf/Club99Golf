import { useEffect, useState } from "react";
import { REACTIONS, loadReactions, setReaction, loadComments, addComment } from "../../services/reactionService";

export default function FeedCard({ r, isNew, myUid, myUsername, accent, onTapRound }) {
  const [reactions, setReactions] = useState(null);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState("");
  const [commentBusy, setCommentBusy] = useState(false);
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  const ownerUid = r.ownerUid || r.uid || "";
  const roundId = String(r.id);
  useEffect(() => { loadReactions(ownerUid, roundId).then(setReactions); }, [ownerUid, roundId]);
  function handleReaction(key) {
    if (!myUid) return;
    const prev = reactions || {};
    const updated = { ...prev };
    if (updated[myUid] === key) delete updated[myUid]; else updated[myUid] = key;
    setReactions(updated);
    setReaction(ownerUid, roundId, myUid, key).then(setReactions);
  }
  function handleOpenComments() {
    setShowComments(v => !v);
    if (!commentsLoaded) { loadComments(ownerUid, roundId).then(c => { setComments(c); setCommentsLoaded(true); }); }
  }
  async function handleAddComment() {
    if (!commentText.trim() || commentBusy) return;
    setCommentBusy(true);
    const ok = await addComment(ownerUid, roundId, myUid, myUsername, commentText);
    if (ok) { setComments(c => [...c, { id: Date.now(), uid: myUid, username: myUsername, text: commentText.trim() }]); setCommentText(""); }
    setCommentBusy(false);
  }
  const reactionCounts = {};
  Object.values(reactions || {}).forEach(k => { reactionCounts[k] = (reactionCounts[k] || 0) + 1; });
  const myReaction = reactions ? reactions[myUid] : null;
  const commentCount = commentsLoaded ? comments.length : (r.commentCount || 0);
  return (
    <div style={{ background: "#fff", borderRadius: 14, border: isNew ? "1.5px solid #fecaca" : "1px solid #e5e7eb", boxShadow: "0 1px 4px rgba(0,0,0,0.05)", marginBottom: 10, overflow: "hidden", animation: "fadeUp 0.3s ease" }}>
      <div onClick={() => onTapRound && onTapRound(r)} style={{ padding: "14px 16px 10px", cursor: "pointer" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 2 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 30, height: 30, borderRadius: "50%", background: "#f3f4f6", overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {r.ownerProfilePic ? <img src={r.ownerProfilePic} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" /> : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>}
            </div>
            <div>
              <span style={{ fontSize: 12, fontWeight: 800, color: "#6D8F6E", fontFamily: "Bebas Neue", letterSpacing: 1, marginRight: 6 }}>{r.username}</span><span style={{ fontSize: 12, color: "#374151", fontWeight: 600 }}>{r.course}</span>
            </div>
          </div>

        </div>
        <div style={{ fontSize: 11, color: "#9ca3af", fontWeight: 500, marginBottom: 10 }}>{r.date} · {r.holes} holes{r.tee ? " · " + r.tee + " tees" : ""}</div>
        <div style={{ display: "flex", gap: 0 }}>
          {[{ val: r.score, lbl: "SCORE", color: "#111827" }, { val: `${r.ovrAfter} (${r.ovrDelta >= 0 ? "+" : ""}${r.ovrDelta})`, lbl: "OVR", color: r.ovrDelta >= 0 ? "#7DA27E" : "#5B7282" }, { val: `+${r.coins ?? r.xp ?? 0} 🪙`, lbl: "COINS", color: "#a78bfa" }].map(({ val, lbl, color }) => (
            <div key={lbl} style={{ flex: 1, textAlign: "center" }}>
              <div style={{ fontSize: 22, fontWeight: 900, fontFamily: "Bebas Neue", color, lineHeight: 1.1 }}>{val}</div>
              <div style={{ fontSize: 9, fontWeight: 800, color: "#9ca3af", letterSpacing: 1.5 }}>{lbl}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ borderTop: "1px solid #f3f4f6", padding: "8px 12px", display: "flex", alignItems: "center", gap: 4 }}>
        {REACTIONS.map(rx => {
          const count = reactionCounts[rx.key] || 0;
          const isMine = myReaction === rx.key;
          return (
            <button key={rx.key} onClick={() => handleReaction(rx.key)} title={rx.title} style={{ display: "flex", alignItems: "center", gap: 3, padding: "4px 8px", borderRadius: 20, border: isMine ? "1.5px solid rgba(125,162,126,0.5)" : "1.5px solid #e5e7eb", background: isMine ? "rgba(125,162,126,0.1)" : "#fafafa", cursor: "pointer", transition: "all 0.15s", fontSize: 13 }}>
              <span style={{ fontSize: 14, lineHeight: 1 }}>{rx.label}</span>
              {count > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: isMine ? "#6D8F6E" : "#6b7280" }}>{count}</span>}
            </button>
          );
        })}
        <button onClick={handleOpenComments} style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 20, border: "1.5px solid #e5e7eb", background: showComments ? "#f9fafb" : "#fafafa", cursor: "pointer", fontSize: 12, fontWeight: 700, color: "#6b7280" }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          {commentCount > 0 ? commentCount : ""}
        </button>
      </div>
      {showComments && (
        <div style={{ borderTop: "1px solid #f3f4f6", padding: "10px 14px 12px", background: "#fafafa" }}>
          {comments.length === 0 && <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 8, textAlign: "center" }}>No comments yet</div>}
          {comments.map(c => (
            <div key={c.id} style={{ marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: "#111827", fontFamily: "Bebas Neue", letterSpacing: 0.5, marginRight: 5 }}>{c.username}</span>
              <span style={{ fontSize: 13, color: "#374151" }}>{c.text}</span>
            </div>
          ))}
          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            <input value={commentText} onChange={e => setCommentText(e.target.value)} onKeyDown={e => e.key === "Enter" && handleAddComment()} placeholder="Add a comment…" maxLength={120} style={{ flex: 1, padding: "8px 12px", borderRadius: 20, border: "1px solid #e5e7eb", fontSize: 13, outline: "none", fontFamily: "DM Sans", background: "#fff" }} />
            <button onClick={handleAddComment} disabled={!commentText.trim() || commentBusy} style={{ padding: "8px 14px", borderRadius: 20, border: "none", background: commentText.trim() ? "#7DA27E" : "#e5e7eb", color: "#fff", fontWeight: 800, fontSize: 12, cursor: commentText.trim() ? "pointer" : "default", transition: "background 0.15s" }}>Post</button>
          </div>
        </div>
      )}
    </div>
  );
}
