import React from "react";

export default function LeaderboardTab(props) {
  const { S, Theme, CREW_COST, subPerks, acceptCrewRequest, authUser, createCrewBusy, createCrewError, createCrewInFirestore, createCrewName, crewBrowse, crewBrowseLoading, crewRequests, db, declineCrewRequest, doc, fetchPublicCrews, friendRequests, friendSearch, friendSearchBusy, friendSearchMsg, friendSearchResult, getDoc, globalLeaderboard, handleFriendSearch, handleRespondRequest, handleSendRequest, leaderboard, leaderboardLoading, leaderboardView, leaveCrewInFirestore, myCrewData, profile, profilePic, requestJoinCrew, saveProfileToFirestore, sentCrewRequests, sentRequests, setCreateCrewBusy, setCreateCrewError, setCreateCrewName, setCrewBrowse, setCrewBrowseLoading, setCrewRequests, setFriendSearch, setLeaderboardView, setMyCrewData, setProfile, setSentCrewRequests, setShowCreateCrewModal, setViewingPic, setViewingProfile, showCreateCrewModal, viewingPic, skillTier } = props;

  const [expandedUid, setExpandedUid] = React.useState(null);
  const [expandedHistory, setExpandedHistory] = React.useState([]);
  const [expandedLoading, setExpandedLoading] = React.useState(false);

  async function handleRowTap(u) {
    if (expandedUid === u.uid) { setExpandedUid(null); setExpandedHistory([]); return; }
    setExpandedUid(u.uid);
    setExpandedHistory([]);
    setExpandedLoading(true);
    try {
      const snap = await getDoc(doc(db, "users", u.uid));
      const data = snap.exists() ? snap.data() : u;
      const history = Array.isArray(data.history) ? data.history : [];
      const recent = [...history].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0)).slice(0, 5);
      setExpandedHistory(recent);
    } catch { setExpandedHistory([]); }
    setExpandedLoading(false);
  }

  function RecentRoundsDropdown({ uid }) {
    if (expandedUid !== uid) return null;
    return (
      <div style={{ background: "#f9fafb", borderRadius: "0 0 12px 12px", border: "1px solid #e5e7eb", borderTop: "none", padding: "10px 14px 12px", marginTop: -8, marginBottom: 8 }}>
        <div style={{ fontSize: 10, fontWeight: 800, color: "#9ca3af", letterSpacing: 1.5, marginBottom: 8 }}>RECENT ROUNDS</div>
        {expandedLoading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "10px 0" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={Theme.primaryGreen} strokeWidth="2" strokeLinecap="round" style={{ animation: "spin 1s linear infinite" }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
          </div>
        ) : expandedHistory.length === 0 ? (
          <div style={{ fontSize: 12, color: "#9ca3af", textAlign: "center", padding: "6px 0" }}>No rounds yet</div>
        ) : expandedHistory.map((r, i) => {
          const dateStr = r.date ? new Date(r.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—";
          const score = r.totalScore ?? r.score ?? "—";
          const par = r.coursePar ?? r.par ?? null;
          const diff = par && score !== "—" ? score - par : null;
          const diffLabel = diff === null ? "" : diff === 0 ? "E" : diff > 0 ? `+${diff}` : `${diff}`;
          const diffColor = diff === null ? "#9ca3af" : diff < 0 ? "#16a34a" : diff === 0 ? "#2563eb" : "#dc2626";
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 0", borderBottom: i < expandedHistory.length - 1 ? "1px solid #f3f4f6" : "none" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#111827", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.courseName || r.course || "Unknown Course"}</div>
                <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 1 }}>{dateStr}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                {diffLabel ? <span style={{ fontSize: 12, fontWeight: 800, color: diffColor }}>{diffLabel}</span> : null}
                <span style={{ fontSize: 15, fontWeight: 900, fontFamily: "Bebas Neue", color: Theme.primaryGreen }}>{score}</span>
                {r.ovr && <span style={{ fontSize: 10, fontWeight: 800, color: "#9ca3af", background: "#f3f4f6", borderRadius: 6, padding: "2px 6px" }}>OVR {r.ovr}</span>}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
        <>
        <div className="tab-scroll" style={{ paddingBottom: 80 }}>
          <div style={{ padding: "20px 16px 12px" }}>
            <div style={{ fontSize: 24, fontWeight: 900, fontFamily: "Bebas Neue", letterSpacing: 2, marginBottom: 12 }}>LEADERBOARD</div>
            {/* 3-tab toggle */}
            <div style={{ display: "flex", background: "#f3f4f6", borderRadius: 10, padding: 3, marginBottom: 16 }}>
              {["friends","crew","global"].map(v => (
                <button key={v} onClick={() => setLeaderboardView(v)} style={{ flex: 1, padding: "8px 0", border: "none", borderRadius: 8, background: leaderboardView === v ? "#fff" : "transparent", color: leaderboardView === v ? Theme.textMain : "#9ca3af", fontWeight: 800, fontSize: 11, letterSpacing: 0.8, cursor: "pointer", boxShadow: leaderboardView === v ? "0 1px 4px rgba(0,0,0,0.1)" : "none" }}>
                  {v.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* ── FRIENDS TAB ── */}
          {leaderboardView === "friends" && (
            <div style={{ padding: "0 16px" }}>
              {/* Friend requests */}
              {friendRequests.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  {friendRequests.map(req => (
                    <div key={req.id} style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", padding: "12px 14px", marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>🏌️ <strong>{req.fromUsername}</strong> wants to be friends</div>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button onClick={() => handleRespondRequest(req, true)} style={{ padding: "6px 12px", background: Theme.primaryGreen, border: "none", borderRadius: 8, color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>Accept</button>
                        <button onClick={() => handleRespondRequest(req, false)} style={{ padding: "6px 12px", background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>Ignore</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {/* Find players search */}
              <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", padding: "12px 14px", marginBottom: 14 }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: "#9ca3af", letterSpacing: 1.5, marginBottom: 8 }}>FIND PLAYERS</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input value={friendSearch} onChange={e => setFriendSearch(e.target.value.toUpperCase())} onKeyDown={e => e.key === "Enter" && handleFriendSearch()} placeholder="Enter username…" style={{ ...S.fInput, flex: 1 }} />
                  <button onClick={handleFriendSearch} disabled={friendSearchBusy} style={{ padding: "0 16px", background: Theme.primaryGreen, border: "none", borderRadius: 8, color: "#fff", fontWeight: 800, fontSize: 12, cursor: "pointer" }}>Search</button>
                </div>
                {friendSearchMsg && <div style={{ fontSize: 12, color: "#6b7280", marginTop: 8 }}>{friendSearchMsg}</div>}
                {friendSearchResult && (
                  <div style={{ marginTop: 10, padding: "10px 12px", background: "#f9fafb", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div><div style={{ fontSize: 14, fontWeight: 900, fontFamily: "Bebas Neue" }}>{friendSearchResult.username}</div><div style={{ fontSize: 11, color: "#9ca3af" }}>OVR {friendSearchResult.ovr}</div></div>
                    <button onClick={() => handleSendRequest(friendSearchResult)} disabled={sentRequests.includes(friendSearchResult.uid)} style={{ padding: "7px 14px", background: sentRequests.includes(friendSearchResult.uid) ? "#f3f4f6" : Theme.primaryGreen, border: "none", borderRadius: 8, color: sentRequests.includes(friendSearchResult.uid) ? "#9ca3af" : "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                      {sentRequests.includes(friendSearchResult.uid) ? "Sent!" : "Add Friend"}
                    </button>
                  </div>
                )}
              </div>
              {/* Friends list */}
              {leaderboardLoading ? (
                <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={Theme.primaryGreen} strokeWidth="2" strokeLinecap="round" style={{ animation: "spin 1s linear infinite" }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                </div>
              ) : leaderboard.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px 20px", color: "#9ca3af" }}>
                  <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>No friends yet</div>
                  <div style={{ fontSize: 12 }}>Search for players above to add them</div>
                </div>
              ) : leaderboard.map((u, idx) => (
                <div key={u.uid}>
                  <div onClick={() => handleRowTap(u)} style={{ background: u.uid === authUser?.uid ? "rgba(125,162,126,0.07)" : "#fff", borderRadius: expandedUid === u.uid ? "12px 12px 0 0" : 12, border: u.uid === authUser?.uid ? `1.5px solid ${Theme.primaryGreen}` : "1px solid #e5e7eb", borderBottom: expandedUid === u.uid ? "none" : undefined, padding: "12px 14px", marginBottom: expandedUid === u.uid ? 0 : 8, display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}>
                    <div style={{ fontSize: 15, fontWeight: 900, fontFamily: "Bebas Neue", color: idx === 0 ? "#f59e0b" : idx === 1 ? "#6b7280" : idx === 2 ? "#b45309" : "#9ca3af", width: 24, textAlign: "center", flexShrink: 0 }}>#{idx+1}</div>
                    <div onClick={u.profilePic ? e => { e.stopPropagation(); setViewingPic(u.profilePic); } : undefined} style={{ width: 38, height: 38, borderRadius: "50%", background: "#f3f4f6", overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", cursor: u.profilePic ? "zoom-in" : "pointer" }}>
                      {u.profilePic ? <img src={u.profilePic} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" /> : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 900, fontFamily: "Bebas Neue", letterSpacing: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{u.username}{u.uid === authUser?.uid ? " (you)" : ""}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 1, flexWrap: "nowrap", minWidth: 0 }}>
                        <span style={{ fontSize: 11, color: "#9ca3af", flexShrink: 0 }}>{u.history?.length || 0} rounds</span>
                        {u.crewName && <span style={{ fontSize: 9, fontWeight: 800, color: Theme.primaryGreen, background: "rgba(125,162,126,0.1)", borderRadius: 6, padding: "1px 5px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 90 }}>{u.crewName}</span>}
                      </div>
                    </div>
                    <div style={{ width: 76, textAlign: "center", flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center" }}>
                      <div style={{ fontSize: 24, fontWeight: 900, fontFamily: "Bebas Neue", color: Theme.primaryGreen, lineHeight: 1 }}>{u.ovr}</div>
                      {(() => { const t = skillTier(u.ovr || 50); return <div style={{ fontSize: 7, fontWeight: 800, color: t.color, letterSpacing: 0.6, background: t.bg, border: `1px solid ${t.border}`, borderRadius: 10, padding: "2px 7px", whiteSpace: "nowrap", textAlign: "center", minWidth: 64 }}>{t.label}</div>; })()}
                    </div>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2.5" strokeLinecap="round" style={{ flexShrink: 0, transform: expandedUid === u.uid ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}><polyline points="6 9 12 15 18 9"/></svg>
                  </div>
                  <RecentRoundsDropdown uid={u.uid} />
                </div>
              ))}
            </div>
          )}

          {/* ── CREW TAB ── */}
          {leaderboardView === "crew" && (
            <div style={{ padding: "0 16px" }}>
              {profile.crewId && myCrewData ? (
                /* ── In a crew ── */
                <>
                  {/* Crew header */}
                  <div style={{ background: Theme.primaryGreen, borderRadius: 16, padding: "16px 18px", marginBottom: 14 }}>
                    <div style={{ fontSize: 26, fontWeight: 900, fontFamily: "Bebas Neue", letterSpacing: 2, color: "#fff", lineHeight: 1 }}>{myCrewData.name}</div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.75)", marginTop: 3 }}>{(myCrewData.members || []).length}/8 members · Led by {myCrewData.leaderUsername}</div>
                  </div>
                  {/* Members list */}
                  <div style={{ fontSize: 10, fontWeight: 800, color: "#9ca3af", letterSpacing: 1.5, marginBottom: 8 }}>MEMBERS</div>
                  {[...(myCrewData.members || [])].sort((a, b) => (b.ovr || 0) - (a.ovr || 0)).map((m, i) => {
                    const isLeader = m.uid === myCrewData.leaderUid;
                    const isMe = m.uid === authUser?.uid;
                    return (
                      <div key={m.uid}>
                        <div onClick={() => !isMe && handleRowTap(m)} style={{ background: isMe ? "rgba(125,162,126,0.07)" : "#fff", borderRadius: expandedUid === m.uid ? "12px 12px 0 0" : 12, border: isMe ? `1.5px solid ${Theme.primaryGreen}` : "1px solid #e5e7eb", borderBottom: expandedUid === m.uid ? "none" : undefined, padding: "12px 14px", marginBottom: expandedUid === m.uid ? 0 : 8, display: "flex", alignItems: "center", gap: 12, cursor: isMe ? "default" : "pointer" }}>
                          <div style={{ fontSize: 15, fontWeight: 900, fontFamily: "Bebas Neue", color: i === 0 ? "#f59e0b" : i === 1 ? "#6b7280" : i === 2 ? "#b45309" : "#9ca3af", width: 24, textAlign: "center", flexShrink: 0 }}>#{i+1}</div>
                          <div onClick={e => { const pic = isMe ? profilePic : m.profilePic; if (pic) { e.stopPropagation(); setViewingPic(pic); } }} style={{ width: 38, height: 38, borderRadius: "50%", background: "#f3f4f6", overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", cursor: (isMe ? profilePic : m.profilePic) ? "zoom-in" : "default" }}>
                            {(isMe ? profilePic : m.profilePic) ? <img src={isMe ? profilePic : m.profilePic} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" /> : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                              <span style={{ fontSize: 14, fontWeight: 900, fontFamily: "Bebas Neue", letterSpacing: 1 }}>{m.username}</span>
                              {isLeader && <span style={{ fontSize: 12 }}>⭐</span>}
                              {isMe && <span style={{ fontSize: 10, fontWeight: 700, color: Theme.primaryGreen }}>(you)</span>}
                            </div>
                            <div style={{ fontSize: 11, color: "#9ca3af" }}>{isLeader ? "Crew Leader" : "Crew Member"}</div>
                          </div>
                          <div style={{ width: 76, textAlign: "center", flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center" }}>
                            <div style={{ fontSize: 24, fontWeight: 900, fontFamily: "Bebas Neue", color: Theme.primaryGreen, lineHeight: 1 }}>{m.ovr || "—"}</div>
                            {m.ovr && (() => { const t = skillTier(m.ovr); return <div style={{ fontSize: 7, fontWeight: 800, color: t.color, letterSpacing: 0.6, background: t.bg, border: `1px solid ${t.border}`, borderRadius: 10, padding: "2px 7px", whiteSpace: "nowrap", textAlign: "center", minWidth: 64 }}>{t.label}</div>; })()}
                          </div>
                          {!isMe && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2.5" strokeLinecap="round" style={{ flexShrink: 0, transform: expandedUid === m.uid ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}><polyline points="6 9 12 15 18 9"/></svg>}
                        </div>
                        {!isMe && <RecentRoundsDropdown uid={m.uid} />}
                      </div>
                    );
                  })}

                  {/* Pending join requests (leader only) */}
                  {myCrewData.leaderUid === authUser?.uid && crewRequests.length > 0 && (
                    <div style={{ marginBottom: 14 }}>
                      <div style={{ fontSize: 10, fontWeight: 800, color: "#9ca3af", letterSpacing: 1.5, marginBottom: 8 }}>JOIN REQUESTS</div>
                      {crewRequests.map(req => (
                        <div key={req.id} style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", padding: "12px 14px", marginBottom: 8, display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, fontWeight: 800 }}>{req.fromUsername}</div>
                            <div style={{ fontSize: 11, color: "#9ca3af" }}>OVR {req.fromOvr || "—"}</div>
                          </div>
                          <button
                            onClick={async () => {
                              try {
                                const newMember = { uid: req.fromUid, username: req.fromUsername, ovr: req.fromOvr || 0, level: req.fromLevel || 1, profilePic: req.fromProfilePic || null };
                                await acceptCrewRequest(req.id, myCrewData.id, myCrewData.name, newMember);
                                setMyCrewData(prev => ({ ...prev, members: [...(prev.members || []), newMember], memberCount: (prev.memberCount || 0) + 1 }));
                                setCrewRequests(prev => prev.filter(r => r.id !== req.id));
                              } catch (e) { alert(e.message === "CREW_FULL" ? "Crew is full (8 max)" : "Failed to accept"); }
                            }}
                            style={{ padding: "6px 12px", background: Theme.primaryGreen, border: "none", borderRadius: 8, color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer" }}
                          >Accept</button>
                          <button
                            onClick={async () => { await declineCrewRequest(req.id); setCrewRequests(prev => prev.filter(r => r.id !== req.id)); }}
                            style={{ padding: "6px 12px", background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: "pointer" }}
                          >Decline</button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Leave / Disband */}
                  <button
                    onClick={async () => {
                      const isLeader = myCrewData.leaderUid === authUser?.uid;
                      if (!window.confirm(isLeader ? `Disband ${myCrewData.name}? This removes all members.` : `Leave ${myCrewData.name}?`)) return;
                      await leaveCrewInFirestore(myCrewData.id, authUser.uid, isLeader, myCrewData.members);
                      const updated = { ...profile, crewId: null, crewName: null };
                      setProfile(updated);
                      if (authUser) saveProfileToFirestore(authUser.uid, updated);
                      setMyCrewData(null);
                    }}
                    style={{ width: "100%", padding: "11px 0", background: "none", border: "1px solid #fecaca", borderRadius: 12, color: "#dc2626", fontWeight: 700, fontSize: 13, cursor: "pointer" }}
                  >
                    {myCrewData.leaderUid === authUser?.uid ? `Disband ${myCrewData.name}` : `Leave ${myCrewData.name}`}
                  </button>
                </>
              ) : (
                /* ── Not in a crew ── */
                <>
                  <button
                    onClick={() => {
                      if (CREW_COST > 0 && (profile.coins || 0) < CREW_COST) {
                        alert(`You need ${CREW_COST.toLocaleString()} coins to create a crew. Your balance: ${(profile.coins || 0).toLocaleString()}.`);
                        return;
                      }
                      setCreateCrewName(""); setCreateCrewError(""); setShowCreateCrewModal(true);
                    }}
                    style={{ width: "100%", padding: "14px 0", background: Theme.primaryGreen, border: "none", borderRadius: 12, color: "#fff", fontWeight: 800, fontSize: 14, cursor: "pointer", marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Start a Crew {CREW_COST > 0 ? `· 🪙 ${CREW_COST.toLocaleString()}` : "· FREE"}
                  </button>

                  {/* Browse crews */}
                  <div style={{ fontSize: 10, fontWeight: 800, color: "#9ca3af", letterSpacing: 1.5, marginBottom: 10 }}>
                    FIND A CREW
                    {!crewBrowse.length && !crewBrowseLoading && (
                      <button onClick={async () => { setCrewBrowseLoading(true); const c = await fetchPublicCrews(); setCrewBrowse(c); setCrewBrowseLoading(false); }} style={{ marginLeft: 10, background: "none", border: "none", color: Theme.primaryGreen, fontWeight: 800, fontSize: 10, cursor: "pointer" }}>Load</button>
                    )}
                  </div>
                  {crewBrowseLoading && <div style={{ display: "flex", justifyContent: "center", padding: 24 }}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={Theme.primaryGreen} strokeWidth="2" strokeLinecap="round" style={{ animation: "spin 1s linear infinite" }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg></div>}
                  {crewBrowse.map(crew => {
                    const isFull = (crew.members || []).length >= 8;
                    const alreadySent = sentCrewRequests.includes(crew.id);
                    return (
                      <div key={crew.id} style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", padding: "12px 14px", marginBottom: 8, display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 15, fontWeight: 900, fontFamily: "Bebas Neue", letterSpacing: 1 }}>{crew.name}</div>
                          <div style={{ fontSize: 11, color: "#9ca3af" }}>Led by {crew.leaderUsername} · {(crew.members || []).length}/8 members</div>
                        </div>
                        <button
                          disabled={isFull || alreadySent}
                          onClick={async () => {
                            if (isFull || alreadySent) return;
                            await requestJoinCrew(crew.id, crew.name, authUser.uid, profile.username, profile.ovr || 0, profile.level || 1, profile.profilePic || null);
                            setSentCrewRequests(prev => [...prev, crew.id]);
                          }}
                          style={{ padding: "7px 14px", background: isFull ? "#f3f4f6" : alreadySent ? "#f3f4f6" : Theme.primaryGreen, border: "none", borderRadius: 8, color: (isFull || alreadySent) ? "#9ca3af" : "#fff", fontWeight: 700, fontSize: 12, cursor: (isFull || alreadySent) ? "default" : "pointer" }}
                        >
                          {isFull ? "Full" : alreadySent ? "Requested" : "Request"}
                        </button>
                      </div>
                    );
                  })}
                  {crewBrowse.length === 0 && !crewBrowseLoading && (
                    <div style={{ textAlign: "center", padding: "32px 0", color: "#9ca3af", fontSize: 13 }}>Tap Load to browse crews</div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ── GLOBAL TAB ── */}
          {leaderboardView === "global" && (
            <div style={{ padding: "0 16px" }}>
              {leaderboardLoading ? (
                <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={Theme.primaryGreen} strokeWidth="2" strokeLinecap="round" style={{ animation: "spin 1s linear infinite" }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                </div>
              ) : globalLeaderboard.map((u, idx) => (
                <div key={u.uid || idx}>
                  <div onClick={() => handleRowTap(u)} style={{ background: u.uid === authUser?.uid ? "rgba(125,162,126,0.07)" : "#fff", borderRadius: expandedUid === u.uid ? "12px 12px 0 0" : 12, border: u.uid === authUser?.uid ? `1.5px solid ${Theme.primaryGreen}` : "1px solid #e5e7eb", borderBottom: expandedUid === u.uid ? "none" : undefined, padding: "12px 14px", marginBottom: expandedUid === u.uid ? 0 : 8, display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}>
                    <div style={{ fontSize: 15, fontWeight: 900, fontFamily: "Bebas Neue", color: idx === 0 ? "#f59e0b" : idx === 1 ? "#6b7280" : idx === 2 ? "#b45309" : "#9ca3af", width: 24, textAlign: "center", flexShrink: 0 }}>#{idx+1}</div>
                    <div onClick={u.profilePic ? e => { e.stopPropagation(); setViewingPic(u.profilePic); } : undefined} style={{ width: 38, height: 38, borderRadius: "50%", background: "#f3f4f6", overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", cursor: u.profilePic ? "zoom-in" : "pointer" }}>
                      {u.profilePic ? <img src={u.profilePic} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" /> : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 900, fontFamily: "Bebas Neue", letterSpacing: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{u.username}{u.uid === authUser?.uid ? " (you)" : ""}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 1, flexWrap: "nowrap", minWidth: 0 }}>
                      <span style={{ fontSize: 11, color: "#9ca3af", flexShrink: 0 }}>{u.history?.length || 0} rounds</span>
                      {u.crewName && <span style={{ fontSize: 9, fontWeight: 800, color: Theme.primaryGreen, background: "rgba(125,162,126,0.1)", borderRadius: 6, padding: "1px 5px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 90 }}>{u.crewName}</span>}
                    </div>
                  </div>
                  <div style={{ width: 76, textAlign: "center", flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <div style={{ fontSize: 24, fontWeight: 900, fontFamily: "Bebas Neue", color: Theme.primaryGreen, lineHeight: 1 }}>{u.ovr}</div>
                    {(() => { const t = skillTier(u.ovr || 50); return <div style={{ fontSize: 7, fontWeight: 800, color: t.color, letterSpacing: 0.6, background: t.bg, border: `1px solid ${t.border}`, borderRadius: 10, padding: "2px 7px", whiteSpace: "nowrap", textAlign: "center", minWidth: 64 }}>{t.label}</div>; })()}
                  </div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2.5" strokeLinecap="round" style={{ flexShrink: 0, transform: expandedUid === u.uid ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}><polyline points="6 9 12 15 18 9"/></svg>
                </div>
                <RecentRoundsDropdown uid={u.uid} />
              </div>
              ))}
              {globalLeaderboard.length === 0 && !leaderboardLoading && (
                <div style={{ textAlign: "center", padding: "40px 20px", color: "#9ca3af" }}>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>No players found</div>
                </div>
              )}
            </div>
          )}
        </div>


        {/* ── Profile Picture Viewer ── */}
        {viewingPic && (
          <div onClick={() => setViewingPic(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 500, padding: 18 }}>
            <img src={viewingPic} alt="Profile" style={{ width: "min(86vw, 420px)", maxHeight: "82vh", borderRadius: 18, objectFit: "contain", background: "#111", imageRendering: "auto", WebkitBackfaceVisibility: "hidden" }} />
            <button onClick={() => setViewingPic(null)} style={{ position: "absolute", top: 20, right: 20, background: "rgba(255,255,255,0.16)", border: "1px solid rgba(255,255,255,0.25)", borderRadius: "50%", width: 42, height: 42, color: "#fff", fontSize: 20, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
          </div>
        )}

        {/* ── Create Crew Modal ── */}
        {showCreateCrewModal && (
          <div onClick={() => setShowCreateCrewModal(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "flex-end", zIndex: 300 }}>
            <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: "20px 20px 0 0", padding: "24px 20px 40px", width: "100%", boxSizing: "border-box" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 900, fontFamily: "Bebas Neue", letterSpacing: 1, lineHeight: 1 }}>START A CREW</div>
                  <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>
                    {CREW_COST > 0 ? `Costs 🪙 ${CREW_COST.toLocaleString()} coins · ` : "FREE · "}Choose a name — it cannot be changed
                  </div>
                </div>
                <button onClick={() => setShowCreateCrewModal(false)} style={{ background: "none", border: "none", fontSize: 20, color: "#9ca3af", cursor: "pointer" }}>✕</button>
              </div>
              <div style={{ fontSize: 10, fontWeight: 800, color: "#9ca3af", letterSpacing: 1.5, marginBottom: 6 }}>CREW NAME</div>
              <input
                value={createCrewName}
                onChange={e => setCreateCrewName(e.target.value.toUpperCase())}
                placeholder="e.g. BIRDIE SQUAD"
                maxLength={24}
                style={{ ...S.fInput, marginBottom: 6, textTransform: "uppercase", fontWeight: 800, letterSpacing: 1 }}
              />
              <div style={{ fontSize: 10, color: "#9ca3af", marginBottom: 16 }}>{createCrewName.length}/24 · Up to 8 members · You will be the crew leader</div>
              {createCrewError && <div style={{ marginBottom: 12, padding: "9px 12px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, fontSize: 12, color: "#dc2626", fontWeight: 600 }}>{createCrewError}</div>}
              <button
                disabled={createCrewBusy || createCrewName.trim().length < 2}
                onClick={async () => {
                  if (!authUser || createCrewBusy || createCrewName.trim().length < 2) return;
                  setCreateCrewBusy(true); setCreateCrewError("");
                  try {
                    const crewId = await createCrewInFirestore(authUser.uid, profile.username, profile.ovr || 0, profile.level || 1, profile.profilePic || null, createCrewName.trim());
                    const crewName = createCrewName.trim().toUpperCase();
                    const coinDeduction = CREW_COST || 0;
                    const updated = { ...profile, crewId, crewName, coins: Math.max(0, (profile.coins || 0) - coinDeduction) };
                    setProfile(updated);
                    if (authUser) saveProfileToFirestore(authUser.uid, updated);
                    setMyCrewData({ id: crewId, name: crewName, leaderUid: authUser.uid, leaderUsername: profile.username, members: [{ uid: authUser.uid, username: profile.username, ovr: profile.ovr || 0, level: profile.level || 1, profilePic: profile.profilePic || null }], memberCount: 1 });
                    setShowCreateCrewModal(false);
                  } catch (e) {
                    setCreateCrewError(e.message === "NAME_TAKEN" ? "That crew name is already taken. Choose another." : "Failed to create crew. Try again.");
                  }
                  setCreateCrewBusy(false);
                }}
                style={{ width: "100%", padding: "14px 0", background: createCrewName.trim().length >= 2 ? Theme.primaryGreen : "#e5e7eb", border: "none", borderRadius: 12, color: createCrewName.trim().length >= 2 ? "#fff" : "#9ca3af", fontSize: 14, fontWeight: 800, cursor: createCrewName.trim().length >= 2 ? "pointer" : "default" }}
              >
                {createCrewBusy ? "Creating…" : "Create Crew"}
              </button>
            </div>
          </div>
        )}
        </>
  );
}
