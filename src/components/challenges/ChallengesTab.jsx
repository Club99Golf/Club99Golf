export default function ChallengesTab(props) {
  const { ACCENT, BadgeIcon, CHALLENGE_FORMATS, COURSE_DB, ChallengeCard, S, Theme, authUser, challengeBusy, challengeCourseSuggestions, challengeForm, challengePostError, challengeStep, challengerStats, challenges, challengesLoading, collection, db, deleteChallengeInDb, doc, friends, getDoc, getDocs, getUnlockedBadges, handlePostChallenge, handleSendRequest, joinChallengeInDb, profile, profilePic, query, removeFriendInDb, searchGolfCourseAPI, sentRequests, setActiveChallengeId, setChallengeCourseSuggestions, setChallengeForm, setChallengePostError, setChallengeStep, setChallengerStats, setChallenges, setFriends, setLeaderboard, setProfile, setShowChallengeModal, setTab, setViewingChallenger, setViewingPic, setViewingProfile, settleChallengeInDb, showChallengeModal, startLiveRound, submitChallengeReview, tab, username, viewingChallenger, viewingPic, viewingProfile, where } = props;
  return (
        <>
        <div className="tab-scroll" style={{ paddingBottom: 80 }}>
          <div style={{ padding: "20px 16px 12px" }}>
            <div style={{ fontSize: 24, fontWeight: 900, fontFamily: "Bebas Neue", letterSpacing: 2, marginBottom: 12 }}>CHALLENGES</div>
            {challengePostError && (
              <div style={{ marginBottom: 10, padding: "10px 14px", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10, fontSize: 12, color: "#92400e", fontWeight: 600 }}>
                {challengePostError}
                <button onClick={() => setChallengePostError("")} style={{ marginLeft: 10, background: "none", border: "none", cursor: "pointer", color: "#92400e", fontWeight: 800, fontSize: 13, lineHeight: 1 }}>✕</button>
              </div>
            )}
            <button
              onClick={() => { setChallengePostError(""); setChallengeStep(1); setShowChallengeModal(true); }}
              style={{ width: "100%", padding: "14px 0", background: Theme.primaryGreen, border: "none", borderRadius: 12, color: "#fff", fontWeight: 800, fontSize: 14, cursor: "pointer", marginBottom: 16, letterSpacing: 0.3, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Post New Challenge
            </button>
          </div>
          {challengesLoading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={Theme.primaryGreen} strokeWidth="2" strokeLinecap="round" style={{ animation: "spin 1s linear infinite" }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
            </div>
          ) : challenges.filter(c => !c.settled).length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 24px", color: "#9ca3af" }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>⛳</div>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6, color: "#374151" }}>No challenges yet</div>
              <div style={{ fontSize: 13 }}>Post one and find your next round</div>
            </div>
          ) : (
            <div style={{ padding: "0 16px" }}>
              {challenges.filter(c => !c.settled).map(c => (
                <ChallengeCard key={c.id} challenge={c} myUid={authUser?.uid} myUsername={profile.username} myCoins={profile.coins || 0}
                  onJoin={async (id, wager) => {
                    if (wager > 0) setProfile(p => ({ ...p, coins: Math.max(0, (p.coins || 0) - wager) }));
                    const ok = await joinChallengeInDb(id, authUser.uid, profile.username, profile.ovr || 0);
                    if (ok) setChallenges(prev => prev.map(ch => ch.id === id ? { ...ch, joinedBy: [...(ch.joinedBy || []), { uid: authUser.uid, username: profile.username, ovr: profile.ovr || 0 }] } : ch));
                    else if (wager > 0) setProfile(p => ({ ...p, coins: (p.coins || 0) + wager }));
                  }}
                  onDelete={async (id, wager, joinedCount) => {
                    setChallenges(prev => prev.filter(ch => ch.id !== id));
                    if (wager > 0 && joinedCount === 0) setProfile(p => ({ ...p, coins: (p.coins || 0) + wager }));
                    await deleteChallengeInDb(id);
                  }}
                  onSettle={async (id, winner, wager) => {
                    const ok = await settleChallengeInDb(id, winner, wager);
                    if (ok) {
                      setChallenges(prev => prev.map(ch => ch.id === id ? { ...ch, settled: true, winner } : ch));
                      if (winner.uid === authUser.uid) setProfile(p => ({ ...p, coins: (p.coins || 0) + wager * 2 }));
                    }
                  }}
                  onReview={async (id, reviewerUid, review) => {
                    const ok = await submitChallengeReview(id, reviewerUid, review);
                    if (ok) setChallenges(prev => prev.map(ch => ch.id === id ? { ...ch, reviews: { ...(ch.reviews || {}), [reviewerUid]: review } } : ch));
                  }}
                  onStartRound={(challengeId, course, teeColor, holes, nineHolesSide) => {
                    setActiveChallengeId(challengeId);
                    startLiveRound(course, teeColor || "white", String(holes || 18), { nineSide: nineHolesSide || "front" });
                    setTab("live");
                  }}
                  onViewProfile={async (poster) => {
                    setViewingChallenger(poster);
                    setChallengerStats({ loading: true });
                    try {
                      // Load user profile
                      const userSnap = await getDoc(doc(db, "users", poster.uid));
                      const userData = userSnap.exists() ? userSnap.data() : {};
                      // Query their posted challenges for W/L and reviews
                      const q = query(collection(db, "challenges"), where("uid", "==", poster.uid));
                      const snap = await getDocs(q);
                      let wins = 0, losses = 0;
                      const reviews = [];
                      snap.forEach(d => {
                        const ch = d.data();
                        if (ch.settled) {
                          if (ch.winner?.uid === poster.uid) wins++;
                          else losses++;
                        }
                        // Collect reviews targeting this poster
                        Object.values(ch.reviews || {}).forEach(r => {
                          if (r.targetUid === poster.uid || !r.targetUid) reviews.push(r);
                        });
                      });
                      setChallengerStats({ loading: false, wins, losses, reviews, rounds: userData.history?.length || 0, level: userData.level || 1, ovr: userData.ovr || poster.ovr });
                    } catch {
                      setChallengerStats({ loading: false, wins: 0, losses: 0, reviews: [], error: true });
                    }
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── Post Challenge Modal (2-step) ── */}
        {showChallengeModal && (() => {
          const closeModal = () => { setShowChallengeModal(false); setChallengeCourseSuggestions([]); setChallengeStep(1); };
          const TEAM_META = { A: { color: Theme.primaryGreen, bg: "rgba(125,162,126,0.12)" }, B: { color: "#3b82f6", bg: "rgba(59,130,246,0.09)" }, C: { color: "#f97316", bg: "rgba(249,115,22,0.09)" }, D: { color: "#a855f7", bg: "rgba(168,85,247,0.09)" } };
          const TEE_COLORS = [
            { id: "white", label: "White", dot: "#ffffff", border: "#d1d5db" },
            { id: "yellow", label: "Yellow", dot: "#eab308", border: "#eab308" },
            { id: "red", label: "Red", dot: "#ef4444", border: "#ef4444" },
            { id: "blue", label: "Blue", dot: "#3b82f6", border: "#3b82f6" },
            { id: "gold", label: "Gold", dot: "#f59e0b", border: "#f59e0b" },
            { id: "black", label: "Black", dot: "#111827", border: "#111827" },
          ];
          const newFormatIds = ["stroke", "match_play", "scramble", "best_ball", "skins"];
          const filteredFmts = CHALLENGE_FORMATS.filter(f => newFormatIds.includes(f.id));
          const selectedFmt = CHALLENGE_FORMATS.find(f => f.id === challengeForm.format) || filteredFmts[0] || CHALLENGE_FORMATS[0];
          const step2Ready = challengeForm.courseName && challengeForm.date && challengeForm.timeFrom && challengeForm.timeTo;

          const cycleTeam = (slotIndex) => {
            setChallengeForm(f => {
              const newSlots = [...f.slots];
              const order = ["A", "B", "C", "D"];
              const cur = order.indexOf(newSlots[slotIndex]);
              // advance to next team that has room (max 2 per team)
              let next = (cur + 1) % 4;
              for (let tries = 0; tries < 4; tries++) {
                const teamLetter = order[next];
                const occupants = newSlots.filter((s, j) => j !== slotIndex && s === teamLetter).length;
                if (occupants < 2) break;
                next = (next + 1) % 4;
              }
              newSlots[slotIndex] = order[next];
              return { ...f, slots: newSlots };
            });
          };

          return (
            <div onClick={closeModal} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "flex-end", zIndex: 300 }}>
              <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: "20px 20px 0 0", width: "100%", maxHeight: "92vh", display: "flex", flexDirection: "column", boxSizing: "border-box" }}>

                {/* ── Step 1: Players + Format + Teams ── */}
                {challengeStep === 1 && (
                  <>
                    <div style={{ padding: "20px 20px 0", flexShrink: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
                        <div>
                          <div style={{ fontSize: 20, fontWeight: 900, fontFamily: "Bebas Neue", letterSpacing: 1, lineHeight: 1 }}>POST A CHALLENGE</div>
                          <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>Step 1 of 2 — Set up your group</div>
                        </div>
                        <button onClick={closeModal} style={{ background: "none", border: "none", fontSize: 20, color: "#9ca3af", cursor: "pointer", lineHeight: 1 }}>✕</button>
                      </div>
                    </div>

                    <div style={{ overflowY: "auto", flex: 1, padding: "0 20px 28px" }}>

                      {/* Player count */}
                      <div style={{ fontSize: 10, fontWeight: 800, color: "#9ca3af", letterSpacing: 1.5, marginBottom: 10 }}>PLAYERS</div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
                        {[2, 3, 4, 5, 6, 7, 8].map(n => {
                          const sel = challengeForm.playerCount === n;
                          return (
                            <button
                              key={n}
                              onClick={() => {
                                const defaultSlots = Array.from({ length: n }, (_, i) => ["A","B","A","B","A","B","A","B"][i]);
                                setChallengeForm(f => ({ ...f, playerCount: n, slots: defaultSlots }));
                              }}
                              style={{ width: 38, height: 38, borderRadius: "50%", border: sel ? `2.5px solid ${Theme.primaryGreen}` : "2px solid #e5e7eb", background: sel ? "rgba(125,162,126,0.1)" : "#f9fafb", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", outline: "none", flexShrink: 0 }}
                            >
                              <span style={{ fontSize: 16, fontWeight: 900, fontFamily: "Bebas Neue", color: sel ? Theme.primaryGreen : "#374151", lineHeight: 1 }}>{n}</span>
                            </button>
                          );
                        })}
                      </div>

                      {/* Format */}
                      <div style={{ fontSize: 10, fontWeight: 800, color: "#9ca3af", letterSpacing: 1.5, marginBottom: 10 }}>FORMAT</div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7, marginBottom: 20 }}>
                        {filteredFmts.map(fmt => {
                          const sel = challengeForm.format === fmt.id;
                          return (
                            <button key={fmt.id} onClick={() => setChallengeForm(f => ({ ...f, format: fmt.id }))} style={{ padding: "10px 12px", background: sel ? "rgba(125,162,126,0.1)" : "#f9fafb", border: sel ? `2px solid ${Theme.primaryGreen}` : "2px solid transparent", borderRadius: 11, cursor: "pointer", textAlign: "left", outline: "none" }}>
                              <div style={{ fontSize: 12, fontWeight: 800, color: sel ? Theme.primaryGreen : "#111827", marginBottom: 2 }}>{fmt.label}</div>
                              <div style={{ fontSize: 10, color: "#9ca3af", lineHeight: 1.3 }}>{fmt.desc}</div>
                            </button>
                          );
                        })}
                        {filteredFmts.length === 0 && <div style={{ gridColumn: "1/-1", fontSize: 12, color: "#9ca3af", padding: "8px 0" }}>No formats for this player count.</div>}
                      </div>

                      {/* Teams — 2×2 grid */}
                      <div style={{ fontSize: 10, fontWeight: 800, color: "#9ca3af", letterSpacing: 1.5, marginBottom: 10 }}>TEAMS</div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                        {["A","B","C","D"].map(team => {
                          const { color, bg } = TEAM_META[team];
                          const teamSlots = challengeForm.slots.map((t, i) => ({ t, i })).filter(s => s.t === team);
                          const isEmpty = teamSlots.length === 0;
                          return (
                            <div key={team} style={{ background: isEmpty ? "#f9fafb" : bg, borderRadius: 14, padding: "10px 8px", minHeight: 80, border: isEmpty ? "1.5px dashed #e5e7eb" : `1.5px solid ${color}22`, transition: "all 0.2s" }}>
                              <div style={{ fontSize: 10, fontWeight: 800, color: isEmpty ? "#d1d5db" : color, letterSpacing: 1.2, textAlign: "center", marginBottom: 8 }}>TEAM {team}</div>
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center" }}>
                                {teamSlots.map(({ i }) => {
                                  const isMe = i === 0;
                                  return (
                                    <button
                                      key={i}
                                      onClick={() => cycleTeam(i)}
                                      style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, background: "none", border: "none", cursor: "pointer", padding: 2 }}
                                    >
                                      <div style={{ width: 40, height: 40, borderRadius: "50%", background: isMe ? "#f3f4f6" : "#e5e7eb", border: `2.5px solid ${color}`, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                        {isMe && profilePic
                                          ? <img src={profilePic} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" />
                                          : <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>}
                                      </div>
                                      <span style={{ fontSize: 9, fontWeight: 700, color, maxWidth: 44, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{isMe ? (profile.username || "You") : `P${i + 1}`}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <div style={{ fontSize: 10, color: "#9ca3af", textAlign: "center", marginBottom: 20 }}>Tap a player bubble to move them to the next team</div>

                      <button
                        onClick={() => setChallengeStep(2)}
                      style={{ width: "100%", padding: "14px 0", background: Theme.primaryGreen, border: "none", borderRadius: 12, color: "#fff", fontSize: 14, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
                      >
                        Continue
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                      </button>
                    </div>
                  </>
                )}

                {/* ── Step 2: Details ── */}
                {challengeStep === 2 && (
                  <>
                    <div style={{ padding: "20px 20px 0", flexShrink: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <button onClick={() => setChallengeStep(1)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", color: "#9ca3af" }}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                          </button>
                          <div>
                            <div style={{ fontSize: 20, fontWeight: 900, fontFamily: "Bebas Neue", letterSpacing: 1, lineHeight: 1 }}>DETAILS</div>
                            <div style={{ fontSize: 10, fontWeight: 800, color: Theme.primaryGreen, marginTop: 1 }}>{selectedFmt.label} · {challengeForm.playerCount} players</div>
                          </div>
                        </div>
                        <button onClick={closeModal} style={{ background: "none", border: "none", fontSize: 20, color: "#9ca3af", cursor: "pointer", lineHeight: 1 }}>✕</button>
                      </div>
                    </div>

                    <div style={{ overflowY: "auto", flex: 1, padding: "0 20px 32px" }}>

                      {/* Course */}
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 10, fontWeight: 800, color: "#9ca3af", letterSpacing: 1.5, marginBottom: 5 }}>COURSE</div>
                        <div style={{ position: "relative" }}>
                          <input
                            value={challengeForm.courseQuery}
                            onChange={async e => {
                              const val = e.target.value;
                              setChallengeForm(f => ({ ...f, courseQuery: val, courseName: "" }));
                              setChallengeCourseSuggestions([]);
                              if (val.length < 2) return;
                              const localMatches = Object.entries(COURSE_DB).filter(([k]) => k.toLowerCase().includes(val.toLowerCase())).slice(0, 5).map(([k]) => k);
                              const apiResults = await searchGolfCourseAPI(val);
                              const apiNames = apiResults.map(c => c.club_name || c.course_name || "").filter(n => n && !localMatches.includes(n)).slice(0, 5);
                              setChallengeCourseSuggestions([...localMatches, ...apiNames]);
                            }}
                            placeholder="Search and select a course…"
                            style={{ ...S.fInput, borderColor: challengeForm.courseName ? Theme.primaryGreen : undefined }}
                          />
                          {challengeForm.courseName && <div style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)" }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={Theme.primaryGreen} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg></div>}
                          {challengeCourseSuggestions.length > 0 && (
                            <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, zIndex: 10, boxShadow: "0 4px 12px rgba(0,0,0,0.1)", overflow: "hidden" }}>
                              {challengeCourseSuggestions.map((name, i) => (
                                <div key={i} onClick={() => { setChallengeForm(f => ({ ...f, courseQuery: name, courseName: name })); setChallengeCourseSuggestions([]); }} style={{ padding: "10px 14px", cursor: "pointer", borderBottom: i < challengeCourseSuggestions.length - 1 ? "1px solid #f0f0f0" : "none", fontSize: 13, fontWeight: 600, color: "#111827" }}>{name}</div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Tee Color */}
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 10, fontWeight: 800, color: "#9ca3af", letterSpacing: 1.5, marginBottom: 8 }}>TEE COLOR</div>
                        <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                          {TEE_COLORS.map(tc => {
                            const sel = challengeForm.teeColor === tc.id;
                            return (
                              <button
                                key={tc.id}
                                onClick={() => setChallengeForm(f => ({ ...f, teeColor: tc.id }))}
                                style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 11px", borderRadius: 20, border: sel ? `2px solid ${tc.border}` : "2px solid #e5e7eb", background: sel ? (tc.id === "white" ? "#f9fafb" : `${tc.dot}18`) : "#f9fafb", cursor: "pointer", outline: "none" }}
                              >
                                <div style={{ width: 12, height: 12, borderRadius: "50%", background: tc.dot, border: `1.5px solid ${tc.border}`, flexShrink: 0 }} />
                                <span style={{ fontSize: 11, fontWeight: 700, color: sel ? (tc.id === "white" ? "#374151" : tc.border) : "#6b7280" }}>{tc.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Holes */}
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 10, fontWeight: 800, color: "#9ca3af", letterSpacing: 1.5, marginBottom: 8 }}>HOLES</div>
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          {[18, 9].map(h => {
                            const sel = challengeForm.holes === h;
                            return (
                              <button key={h} onClick={() => setChallengeForm(f => ({ ...f, holes: h }))} style={{ padding: "8px 22px", borderRadius: 10, border: sel ? `2px solid ${Theme.primaryGreen}` : "2px solid #e5e7eb", background: sel ? "rgba(125,162,126,0.1)" : "#f9fafb", cursor: "pointer", fontSize: 13, fontWeight: 800, color: sel ? Theme.primaryGreen : "#6b7280", outline: "none" }}>
                                {h} holes
                              </button>
                            );
                          })}
                          {challengeForm.holes === 9 && (
                            <>
                              <div style={{ width: 1, height: 24, background: "#e5e7eb" }} />
                              {["front", "back"].map(side => {
                                const sel = challengeForm.nineHolesSide === side;
                                return (
                                  <button key={side} onClick={() => setChallengeForm(f => ({ ...f, nineHolesSide: side }))} style={{ padding: "8px 16px", borderRadius: 10, border: sel ? `2px solid ${Theme.primaryGreen}` : "2px solid #e5e7eb", background: sel ? "rgba(125,162,126,0.1)" : "#f9fafb", cursor: "pointer", fontSize: 12, fontWeight: 800, color: sel ? Theme.primaryGreen : "#6b7280", outline: "none", textTransform: "capitalize" }}>
                                    {side} 9
                                  </button>
                                );
                              })}
                            </>
                          )}
                        </div>
                      </div>

                      {/* Date */}
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 10, fontWeight: 800, color: "#9ca3af", letterSpacing: 1.5, marginBottom: 5 }}>DATE</div>
                        <input type="date" value={challengeForm.date} onChange={e => setChallengeForm(f => ({ ...f, date: e.target.value }))} style={{ ...S.fInput }} />
                      </div>

                      {/* Wager */}
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 10, fontWeight: 800, color: "#9ca3af", letterSpacing: 1.5, marginBottom: 5 }}>WAGER</div>
                        <input type="number" min={0} max={profile.coins || 0} value={challengeForm.wager} onChange={e => { const val = Math.max(0, Math.min(parseInt(e.target.value) || 0, profile.coins || 0)); setChallengeForm(f => ({ ...f, wager: val || "" })); }} placeholder="0" style={{ ...S.fInput }} />
                        <div style={{ fontSize: 9, color: "#9ca3af", marginTop: 2 }}>Bal: {(profile.coins || 0).toLocaleString()}</div>
                      </div>

                      {/* Tee time */}
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 10, fontWeight: 800, color: "#9ca3af", letterSpacing: 1.5, marginBottom: 5 }}>TEE TIME WINDOW</div>
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <input type="time" value={challengeForm.timeFrom || ""} onChange={e => setChallengeForm(f => ({ ...f, timeFrom: e.target.value }))} style={{ ...S.fInput, flex: 1 }} />
                          <span style={{ color: "#9ca3af", fontWeight: 700, flexShrink: 0 }}>to</span>
                          <input type="time" value={challengeForm.timeTo || ""} onChange={e => setChallengeForm(f => ({ ...f, timeTo: e.target.value }))} style={{ ...S.fInput, flex: 1 }} />
                        </div>
                      </div>

                      {/* Message */}
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 10, fontWeight: 800, color: "#9ca3af", letterSpacing: 1.5, marginBottom: 5 }}>MESSAGE <span style={{ fontWeight: 600, opacity: 0.7 }}>(optional)</span></div>
                        <textarea value={challengeForm.message} onChange={e => setChallengeForm(f => ({ ...f, message: e.target.value }))} placeholder="e.g. All skill levels welcome!" maxLength={140} rows={2} style={{ ...S.fInput, resize: "none", fontFamily: "inherit", lineHeight: 1.5 }} />
                        {challengeForm.message.length > 0 && <div style={{ fontSize: 10, color: "#9ca3af", textAlign: "right", marginTop: 2 }}>{challengeForm.message.length}/140</div>}
                      </div>

                      {challengePostError && <div style={{ marginBottom: 10, padding: "9px 12px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, fontSize: 12, color: "#dc2626", fontWeight: 600 }}>{challengePostError}</div>}

                      <button
                        disabled={challengeBusy || !step2Ready}
                        onClick={handlePostChallenge}
                        style={{ width: "100%", padding: "14px 0", background: step2Ready ? Theme.primaryGreen : "#e5e7eb", border: "none", borderRadius: 12, color: step2Ready ? "#fff" : "#9ca3af", fontSize: 14, fontWeight: 800, cursor: step2Ready ? "pointer" : "default", transition: "background 0.15s" }}
                      >
                        {challengeBusy ? "Posting…" : "Post Challenge"}
                      </button>
                    </div>
                  </>
                )}

              </div>
            </div>
          );
        })()}
      

      {/* ── Challenger Profile Modal ── */}
      {viewingChallenger && (
        <div onClick={() => { setViewingChallenger(null); setChallengerStats(null); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "flex-end", zIndex: 350 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: "20px 20px 0 0", width: "100%", maxHeight: "75vh", display: "flex", flexDirection: "column" }}>
            {/* Header */}
            <div style={{ padding: "20px 20px 16px", display: "flex", alignItems: "center", gap: 14, flexShrink: 0, borderBottom: "1px solid #f3f4f6" }}>
              <div style={{ width: 54, height: 54, borderRadius: "50%", background: "#f3f4f6", overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {viewingChallenger.profilePic ? <img src={viewingChallenger.profilePic} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" /> : <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 22, fontWeight: 900, fontFamily: "Bebas Neue", letterSpacing: 1, lineHeight: 1.1 }}>{viewingChallenger.username}</div>
                {challengerStats && !challengerStats.loading && (
                  <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>Lvl {challengerStats.level} · OVR {challengerStats.ovr} · {challengerStats.rounds} rounds</div>
                )}
              </div>
              <button onClick={() => { setViewingChallenger(null); setChallengerStats(null); }} style={{ background: "none", border: "none", fontSize: 20, color: "#9ca3af", cursor: "pointer", lineHeight: 1 }}>✕</button>
            </div>

            <div style={{ overflowY: "auto", flex: 1, padding: "16px 20px 40px" }}>
              {!challengerStats || challengerStats.loading ? (
                <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={Theme.primaryGreen} strokeWidth="2" strokeLinecap="round" style={{ animation: "spin 1s linear infinite" }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                </div>
              ) : (
                <>
                  {/* W/L Record */}
                  <div style={{ fontSize: 10, fontWeight: 800, color: "#9ca3af", letterSpacing: 1.5, marginBottom: 10 }}>CHALLENGE RECORD</div>
                  <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
                    <div style={{ flex: 1, background: "rgba(125,162,126,0.1)", border: "1.5px solid rgba(125,162,126,0.25)", borderRadius: 14, padding: "14px 0", textAlign: "center" }}>
                      <div style={{ fontSize: 32, fontWeight: 900, fontFamily: "Bebas Neue", color: Theme.primaryGreen, lineHeight: 1 }}>{challengerStats.wins}</div>
                      <div style={{ fontSize: 10, fontWeight: 800, color: Theme.primaryGreen, letterSpacing: 1.5, marginTop: 2 }}>WINS</div>
                    </div>
                    <div style={{ flex: 1, background: "#f9fafb", border: "1.5px solid #e5e7eb", borderRadius: 14, padding: "14px 0", textAlign: "center" }}>
                      <div style={{ fontSize: 32, fontWeight: 900, fontFamily: "Bebas Neue", color: "#374151", lineHeight: 1 }}>{challengerStats.losses}</div>
                      <div style={{ fontSize: 10, fontWeight: 800, color: "#9ca3af", letterSpacing: 1.5, marginTop: 2 }}>LOSSES</div>
                    </div>
                    <div style={{ flex: 1, background: "#f9fafb", border: "1.5px solid #e5e7eb", borderRadius: 14, padding: "14px 0", textAlign: "center" }}>
                      <div style={{ fontSize: 32, fontWeight: 900, fontFamily: "Bebas Neue", color: "#374151", lineHeight: 1 }}>{challengerStats.wins + challengerStats.losses > 0 ? Math.round(challengerStats.wins / (challengerStats.wins + challengerStats.losses) * 100) : "—"}{challengerStats.wins + challengerStats.losses > 0 ? "%" : ""}</div>
                      <div style={{ fontSize: 10, fontWeight: 800, color: "#9ca3af", letterSpacing: 1.5, marginTop: 2 }}>WIN %</div>
                    </div>
                  </div>

                  {/* Reviews */}
                  <div style={{ fontSize: 10, fontWeight: 800, color: "#9ca3af", letterSpacing: 1.5, marginBottom: 10 }}>
                    REVIEWS {challengerStats.reviews.length > 0 && (() => {
                      const avg = challengerStats.reviews.reduce((a, r) => a + (r.rating || 0), 0) / challengerStats.reviews.length;
                      return <span style={{ color: "#f59e0b", fontWeight: 900 }}>{"★".repeat(Math.round(avg))} {avg.toFixed(1)}</span>;
                    })()}
                  </div>
                  {challengerStats.reviews.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "24px 0", color: "#9ca3af", fontSize: 13 }}>No reviews yet</div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {challengerStats.reviews.map((r, i) => (
                        <div key={i} style={{ background: "#f9fafb", borderRadius: 12, padding: "12px 14px" }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: "#374151" }}>{r.reviewerUsername || "Anonymous"}</span>
                            <span style={{ fontSize: 13, color: "#f59e0b", letterSpacing: 1 }}>{"★".repeat(r.rating || 0)}{"☆".repeat(5 - (r.rating || 0))}</span>
                          </div>
                          {r.text && <div style={{ fontSize: 12, color: "#6b7280", fontStyle: "italic", lineHeight: 1.4 }}>"{r.text}"</div>}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Profile viewer modal */}
      {viewingPic && (
        <div onClick={() => setViewingPic(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 400 }}>
          <img src={viewingPic} alt="" style={{ maxWidth: "90vw", maxHeight: "90vh", borderRadius: 16, objectFit: "contain" }} />
          <button onClick={() => setViewingPic(null)} style={{ position: "absolute", top: 20, right: 20, background: "rgba(255,255,255,0.15)", border: "none", borderRadius: "50%", width: 40, height: 40, color: "#fff", fontSize: 20, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
        </div>
      )}

      {viewingProfile && (
        <div onClick={() => setViewingProfile(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "flex-end", zIndex: 300 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: "20px 20px 0 0", padding: "24px 20px 40px", width: "100%", maxHeight: "70vh", overflowY: "auto" }}>
            <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 16 }}>
              <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#f3f4f6", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {viewingProfile.profilePic ? <img src={viewingProfile.profilePic} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" /> : <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>}
              </div>
              <div>
                <div style={{ fontSize: 22, fontWeight: 900, fontFamily: "Bebas Neue", letterSpacing: 1 }}>{viewingProfile.username}</div>
                <div style={{ fontSize: 12, color: "#9ca3af" }}>Lvl {viewingProfile.level || 1} · OVR {viewingProfile.ovr} · {viewingProfile.history?.length || 0} rounds</div>
              </div>
            </div>
            {viewingProfile.history && viewingProfile.history.length > 0 && (
              <div>
                <div style={{ fontSize: 10, fontWeight: 800, color: "#9ca3af", letterSpacing: 1.5, marginBottom: 8 }}>RECENT ROUNDS</div>
                {viewingProfile.history.slice(0, 5).map((r, i) => (
                  <div key={i} style={{ background: "#f9fafb", borderRadius: 10, padding: "10px 12px", marginBottom: 6, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div><div style={{ fontSize: 13, fontWeight: 700 }}>{r.course || "Unknown"}</div><div style={{ fontSize: 11, color: "#9ca3af" }}>{r.date}</div></div>
                    <div style={{ display: "flex", gap: 12 }}>
                      <div style={{ textAlign: "center" }}><div style={{ fontSize: 18, fontWeight: 900, fontFamily: "Bebas Neue" }}>{r.score}</div><div style={{ fontSize: 8, color: "#9ca3af", fontWeight: 800 }}>SCORE</div></div>
                      <div style={{ textAlign: "center" }}><div style={{ fontSize: 18, fontWeight: 900, fontFamily: "Bebas Neue", color: ACCENT }}>{r.ovrAfter}</div><div style={{ fontSize: 8, color: "#9ca3af", fontWeight: 800 }}>OVR</div></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {(() => {
              const theirBadges = getUnlockedBadges(viewingProfile);
              if (theirBadges.length === 0) return null;
              return (
                <div style={{ marginTop: 14 }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: "#9ca3af", letterSpacing: 1.5, marginBottom: 8 }}>BADGES</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {theirBadges.slice(0, 12).map(a => (
                      <div key={a.id} title={a.label}><BadgeIcon id={a.id} size={32} /></div>
                    ))}
                  </div>
                </div>
              );
            })()}
            {viewingProfile.uid !== authUser?.uid && (
              friends.includes(viewingProfile.uid) ? (
                <button onClick={async () => { await removeFriendInDb(authUser.uid, viewingProfile.uid); setFriends(prev => prev.filter(id => id !== viewingProfile.uid)); setLeaderboard(prev => prev.filter(p => p.uid !== viewingProfile.uid)); setViewingProfile(null); }} style={{ width: "100%", padding: "12px 0", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, color: "#dc2626", fontSize: 13, fontWeight: 700, cursor: "pointer", marginTop: 8 }}>
                  Remove Friend
                </button>
              ) : (
                <button onClick={() => { handleSendRequest(viewingProfile); setViewingProfile(null); }} disabled={sentRequests.includes(viewingProfile.uid)} style={{ width: "100%", padding: "12px 0", background: sentRequests.includes(viewingProfile.uid) ? "#f3f4f6" : Theme.primaryGreen, border: "none", borderRadius: 10, color: sentRequests.includes(viewingProfile.uid) ? "#9ca3af" : "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", marginTop: 8 }}>
                  {sentRequests.includes(viewingProfile.uid) ? "Request Sent" : "Add Friend"}
                </button>
              )
            )}
          </div>
        </div>
      )}
    </>
  );
}
