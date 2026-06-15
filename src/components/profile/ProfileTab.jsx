export default function ProfileTab(props) {
  const { ACCENT, ACHIEVEMENTS, BadgeIcon, COINS, COURSE_DB, RadarChart, S, Theme, animOVR, apiCourseTeeNames, bannerClass, bannerStyle, calcHandicapIndex, compressImage, courseSuggestions, deleteBusy, deleteError, deletePassword, editCourse, editHolePars, editHoleScores, editHoles, editNineSide, editRating, editSlope, editTee, equippedBorder, extractApiTeeData, getCourseData, getCourseHolePars, handleCourseSearch, handleDeleteAccount, handleLogout, hapticTap, isHandicapView, isMobileLayout, last5, liveRound, nameplateStyle, profile, profilePic, profilePicRef, scanError, scanState, selectCourse, selectedApiCourse, selectedBadge, setDeleteError, setDeletePassword, setEditHolePars, setEditHoleScores, setEditHoles, setEditNineSide, setEditRating, setEditScore, setEditSlope, setEditTee, setIsHandicapView, setNewCourseForm, setProfile, setProfilePic, setScanError, setScanState, setSelectedBadge, setShowAttrModal, setShowBadgeManager, setShowCreateCourse, setShowDeleteConfirm, setShowSettings, setViewingRound, showAttrModal, showBadgeManager, showDeleteConfirm, showSettings, startLiveRound, submitRound, stats, tab, tier, unlockedBadges, username } = props;
  return (
        <div className="tab-scroll" style={{ paddingBottom: "calc(150px + env(safe-area-inset-bottom))", overflowX: "hidden" }}>

          {/* ── DARK HEADER ── */}
          <div style={{ position: "relative", background: "#0f0f0f", ...bannerStyle }} className={bannerClass}>
            {/* App wordmark — top strip */}
            <div style={{ padding: "8px 16px 0", display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ fontSize: 11, fontWeight: 900, fontFamily: "'Inter','DM Sans',sans-serif", letterSpacing: 0.5, color: "rgba(255,255,255,0.45)", textTransform: "uppercase" }}>CLUB</span>
              <span style={{ fontSize: 11, fontWeight: 900, fontFamily: "'Inter','DM Sans',sans-serif", letterSpacing: 0.5, color: Theme.primaryGreen, textTransform: "uppercase" }}>99</span>
            </div>
            <div style={{ padding: "8px 16px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              {/* Left: avatar + name */}
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ position: "relative" }}>
                  <div onClick={() => profilePicRef.current.click()} style={{ width: 56, height: 56, borderRadius: "50%", background: "#1f2937", border: `2.5px solid ${Theme.primaryGreen}`, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", ...(equippedBorder ? equippedBorder.style : {}) }} className={equippedBorder?.animated === "spin" ? "border-spin" : ""}>
                    {profilePic ? <img src={profilePic} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="pic" /> : <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4b5563" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>}
                  </div>
                  <input ref={profilePicRef} type="file" accept="image/*" style={{ display: "none" }} onChange={async e => {
                    const file = e.target.files[0]; if (!file) return;
                    const reader = new FileReader();
                    reader.onload = async ev => { const compressed = await compressImage(ev.target.result, 200); setProfilePic(compressed); };
                    reader.readAsDataURL(file);
                  }} />
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
                  <span style={{ fontSize: 22, fontWeight: 900, fontFamily: "Bebas Neue", letterSpacing: 2, color: "#fff", ...nameplateStyle }}>{profile.username}</span>
                  {/* Rank tier badge */}
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 5, marginTop: 4, background: tier.bg, border: `1px solid ${tier.border}`, borderRadius: 20, padding: "3px 10px" }}>
                    <svg width="8" height="8" viewBox="0 0 24 24" fill={tier.color} stroke="none"><polygon points="12,2 15,9 22,9 17,14 19,21 12,17 5,21 7,14 2,9 9,9"/></svg>
                    <span style={{ fontSize: 10, fontWeight: 800, color: tier.color, letterSpacing: 1 }}>{tier.label}</span>
                  </div>
                </div>
              </div>

              {/* Right: OVR / HCP toggle block */}
              <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
                {/* Tappable OVR ↔ HCP block */}
                {(() => {
                  const hcap = calcHandicapIndex(profile.history);
                  const bigNum   = isHandicapView ? (hcap != null ? hcap.toFixed(1) : "—") : animOVR;
                  const bigLabel = isHandicapView ? "HCP" : "OVR";
                  const labelColor = isHandicapView ? Theme.primaryGreen : "#9ca3af";
                  return (
                    <button
                      onClick={() => { hapticTap(); setIsHandicapView(v => !v); }}
                      style={{ background: "none", border: "none", cursor: "pointer", padding: 0, textAlign: "right", WebkitTapHighlightColor: "transparent", outline: "none" }}
                    >
                      <div
                        key={`ovr-${isHandicapView}`}
                        style={{ fontSize: 64, fontWeight: 900, fontFamily: "Bebas Neue", color: "#fff", lineHeight: 1, animation: "countUp 0.35s ease", letterSpacing: isHandicapView ? 0 : 2 }}
                      >
                        {bigNum}
                      </div>
                      <div style={{ fontSize: 9, fontWeight: 800, color: labelColor, letterSpacing: 2, textAlign: "right", transition: "color 0.25s" }}>
                        {bigLabel}
                      </div>
                    </button>
                  );
                })()}
                {/* OVR delta — only visible in score mode */}
                {!isHandicapView && profile.history.length > 0 && (() => {
                  const last = profile.history[0];
                  const delta = last.ovrDelta;
                  return delta !== undefined ? (
                    <div style={{ marginTop: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 900, color: delta >= 0 ? "#6D8F6E" : "#C57B7B", fontFamily: "Bebas Neue" }}>{delta >= 0 ? "+" : ""}{delta}</span>
                    </div>
                  ) : null;
                })()}
                {/* Settings gear */}
                <div style={{ position: "relative" }}>
                  <button onClick={() => setShowSettings(v => !v)} style={{ background: "rgba(255,255,255,0.08)", border: "none", borderRadius: 8, padding: "6px 7px", color: "#9ca3af", cursor: "pointer", marginTop: 2 }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                  </button>
                  {showSettings && (
                    <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, boxShadow: "0 8px 24px rgba(0,0,0,0.15)", padding: 8, minWidth: 160, zIndex: 50 }}>
                      <button onClick={handleLogout} style={{ width: "100%", padding: "10px 14px", background: "none", border: "none", borderRadius: 8, color: "#374151", fontSize: 13, fontWeight: 700, cursor: "pointer", textAlign: "left", display: "block" }}>Sign Out</button>
                      <div style={{ height: 1, background: "#f3f4f6", margin: "4px 0" }} />
                      <button onClick={() => { setShowSettings(false); setShowDeleteConfirm(true); }} style={{ width: "100%", padding: "10px 14px", background: "none", border: "none", borderRadius: 8, color: "#dc2626", fontSize: 13, fontWeight: 700, cursor: "pointer", textAlign: "left", display: "block" }}>Delete Account</button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {profile.coinBoost && profile.coinBoost.roundsLeft > 0 && (
              <div style={{ padding: "3px 16px", background: "#0a0a0a", fontSize: 10, color: "#f59e0b", fontWeight: 700 }}>⚡ {profile.coinBoost.multiplier}× Coin Boost active · {profile.coinBoost.roundsLeft} rounds left</div>
            )}
          </div>

          {/* Settings Dropdown */}

          {showDeleteConfirm && (
            <div style={{ background: "#fff", border: "1px solid #fecaca", padding: "14px 16px" }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#dc2626", marginBottom: 6 }}>Delete Account</div>
              <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 10 }}>This permanently deletes your account and all data.</div>
              <input type="password" value={deletePassword} onChange={e => setDeletePassword(e.target.value)} placeholder="Your password" style={{ ...S.fInput, marginBottom: 8 }} />
              {deleteError && <div style={{ ...S.errBox, marginBottom: 8 }}>{deleteError}</div>}
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => { setShowDeleteConfirm(false); setDeletePassword(""); setDeleteError(""); }} style={{ flex: 1, padding: 11, background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Cancel</button>
                <button onClick={handleDeleteAccount} disabled={deleteBusy} style={{ flex: 1, padding: 11, background: "#dc2626", border: "none", borderRadius: 8, color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>{deleteBusy ? "Deleting…" : "Delete"}</button>
              </div>
            </div>
          )}

          {/* ── 3-COL STATS STRIP ── */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", width: "100%", maxWidth: "100%", background: "#fff", borderBottom: "1px solid #e5e7eb", overflow: "hidden" }}>
            {[
              { val: profile.history.length, label: "ROUNDS", color: "#111827" },
              { val: profile.history.length > 0 ? Math.min(...profile.history.map(r => r.score)) : "—", label: "BEST RND", color: "#111827" },
              { val: profile.streak > 0 ? `${profile.streak}🔥` : "—", label: "STREAK", color: "#111827" },
              { val: (profile.coins || 0).toLocaleString(), label: "🪙 COINS", color: "#d97706" },
            ].map(({ val, label, color }, i) => (
              <div key={label} style={{ minWidth: 0, padding: "10px 0", textAlign: "center", borderRight: i < 3 ? "1px solid #e5e7eb" : "none", overflow: "hidden" }}>
                <div style={{ fontSize: 20, fontWeight: 900, color, fontFamily: "Bebas Neue", lineHeight: 1 }}>{val}</div>
                <div style={{ fontSize: 8, fontWeight: 800, color: "#9ca3af", letterSpacing: 1.5, marginTop: 2 }}>{label}</div>
              </div>
            ))}
          </div>

          {/* ── TWO-COLUMN BODY: Attributes left | Last 5 right ── */}
          <div style={{ display: isMobileLayout ? "block" : "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", background: "#fff", borderBottom: "1px solid #e5e7eb", minHeight: 240, width: "100%", maxWidth: "100%", overflow: "hidden" }}>
            {/* Left: Attributes radar */}
            <div style={{ minWidth: 0, borderRight: isMobileLayout ? "none" : "1px solid #e5e7eb", borderBottom: isMobileLayout ? "1px solid #e5e7eb" : "none", padding: "12px 8px 12px", overflow: "hidden" }}>
              <div style={{ fontSize: 9, fontWeight: 800, color: "#9ca3af", letterSpacing: 1.5, marginBottom: 6, textAlign: "center" }}>ATTRIBUTES</div>
              <div style={{ display: "flex", justifyContent: "center" }}>
                <RadarChart stats={stats} accent={Theme.primaryGreen} />
              </div>
              <button onClick={() => setShowAttrModal(true)} style={{ display: "block", margin: "6px auto 0", background: "none", border: "none", fontSize: 10, fontWeight: 700, color: Theme.primaryGreen, cursor: "pointer", letterSpacing: 0.5 }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 3, verticalAlign: "middle" }}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                DETAILS
              </button>
            </div>

            {/* Right: Last 5 rounds */}
            <div style={{ minWidth: 0, padding: "12px 12px", overflow: "hidden" }}>
              <div style={{ fontSize: 9, fontWeight: 800, color: "#9ca3af", letterSpacing: 1.5, marginBottom: 8 }}>LAST 5</div>
              {profile.history.length === 0 ? (
                <div style={{ fontSize: 12, color: "#9ca3af", textAlign: "center", paddingTop: 40 }}>No rounds yet</div>
              ) : (
                profile.history.slice(0, 5).map((r, i) => (
                  <div key={r.id} onClick={() => setViewingRound(r)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 0", borderBottom: i < Math.min(profile.history.length, 5) - 1 ? "1px solid #f3f4f6" : "none", cursor: "pointer" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ fontSize: 20, fontWeight: 900, fontFamily: "Bebas Neue", color: "#111827", width: 28, lineHeight: 1 }}>{r.score}</div>
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: "#374151", lineHeight: 1.3 }}>{r.date ? r.date.slice(5).replace("-", "/") : ""}</div>
                        <div style={{ fontSize: 9, color: "#9ca3af", lineHeight: 1.3 }}>{r.course ? r.course.replace(" Golf Course","").replace(" Golf Club","") : "Unknown"}{r.tee ? ` · ${r.tee}` : ""}</div>
                      </div>
                    </div>
                    {(() => { const diff = r.par ? r.score - r.par : null; const label = diff === null ? "" : diff === 0 ? "E" : diff > 0 ? `+${diff}` : `${diff}`; const color = diff === null ? "#9ca3af" : diff < 0 ? "#3b82f6" : diff === 0 ? "#6b7280" : "#C57B7B"; return <div style={{ fontSize: 13, fontWeight: 900, color, fontFamily: "Bebas Neue" }}>{label}</div>; })()}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Badges strip (if any) */}
          {unlockedBadges.length > 0 && (
            <div style={{ background: "#fff", borderBottom: "1px solid #e5e7eb", padding: "10px 16px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <div style={{ fontSize: 9, fontWeight: 800, color: "#9ca3af", letterSpacing: 1.5 }}>BADGES</div>
                <button onClick={() => setShowBadgeManager(v => !v)} style={{ fontSize: 10, fontWeight: 700, color: Theme.primaryGreen, background: "none", border: "none", cursor: "pointer" }}>{showBadgeManager ? "Done" : "Manage"}</button>
              </div>
              {showBadgeManager ? (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 8 }}>
                  {ACHIEVEMENTS.map(a => {
                    const unlocked = unlockedBadges.some(b => b.id === a.id);
                    const pinned = (profile.pinnedBadges || []).includes(a.id);
                    return (
                      <div key={a.id} onClick={() => {
                        if (!unlocked) return;
                        const next = pinned ? (profile.pinnedBadges || []).filter(x => x !== a.id) : [...(profile.pinnedBadges || []).slice(0, 4), a.id];
                        setProfile(p => ({ ...p, pinnedBadges: next }));
                      }} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, cursor: unlocked ? "pointer" : "default", opacity: unlocked ? 1 : 0.25 }}>
                        <div style={{ position: "relative" }}>
                          <BadgeIcon id={a.id} size={30} />
                          {pinned && <div style={{ position: "absolute", top: -2, right: -2, width: 8, height: 8, borderRadius: "50%", background: ACCENT, border: "1px solid #fff" }} />}
                        </div>
                        <div style={{ fontSize: 6, fontWeight: 700, color: "#6b7280", textAlign: "center", lineHeight: 1.2 }}>{a.label}</div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ display: "flex", gap: 8 }}>
                  {((profile.pinnedBadges || []).length > 0 ? ACHIEVEMENTS.filter(a => (profile.pinnedBadges || []).includes(a.id)).slice(0, 6) : unlockedBadges.slice(0, 6)).map(a => (
                    <div key={a.id} onClick={() => setSelectedBadge(a)} style={{ cursor: "pointer" }}><BadgeIcon id={a.id} size={32} /></div>
                  ))}
                </div>
              )}
              {selectedBadge && (
                <div onClick={() => setSelectedBadge(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }}>
                  <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 16, padding: 24, maxWidth: 240, width: "90%", textAlign: "center" }}>
                    <BadgeIcon id={selectedBadge.id} size={48} />
                    <div style={{ fontSize: 16, fontWeight: 900, color: "#111827", marginTop: 8 }}>{selectedBadge.label}</div>
                    <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>{selectedBadge.desc}</div>
                    <button onClick={() => setSelectedBadge(null)} style={{ marginTop: 14, padding: "8px 20px", background: ACCENT, border: "none", borderRadius: 8, color: "#fff", fontWeight: 700, cursor: "pointer" }}>Close</button>
                  </div>
                </div>
              )}
            </div>
          )}


          {/* Attr modal */}
          {showAttrModal && (() => {
            const STAT_META = {
              PWR: {
                color: "#f59e0b", bg: "#fffbeb", iconBg: "#fef3c7",
                icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>,
                fullName: "POWER",
                desc: "Measures your driving distance and ability to generate clubhead speed off the tee.",
                subs: [
                  { name: "Driving Distance", desc: "How far you move the ball off the tee" },
                  { name: "Clubhead Speed", desc: "Raw power through the hitting zone" },
                  { name: "Long Iron Play", desc: "Ability to cover long yardages on approach" },
                ],
                tips: {
                  up: "You\'re bombing it lately — keep swinging free and this will keep climbing.",
                  flat: "Improve by answering post-round questions about driving distance. Consistently bombing it will push this up.",
                  down: "Your driving power has been dipping. Focus on generating more speed off the tee.",
                },
              },
              ACC: {
                color: "#3b82f6", bg: "#eff6ff", iconBg: "#dbeafe",
                icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1" fill="#3b82f6" stroke="none"/></svg>,
                fullName: "ACCURACY",
                desc: "Reflects your ability to hit fairways and land approach shots on or near the green.",
                subs: [
                  { name: "Fairway %", desc: "How often you find the short grass off the tee" },
                  { name: "Greens in Regulation", desc: "Approach shot precision" },
                  { name: "Shot Shaping", desc: "Control over ball flight and shape" },
                ],
                tips: {
                  up: "You\'ve been finding fairways — that\'s directly pushing ACC up. Keep it up.",
                  flat: "Hitting more fairways in your post-round answers directly boosts ACC.",
                  down: "Your accuracy has been slipping. Focus on finding more fairways and greens.",
                },
              },
              CON: {
                color: "#22c55e", bg: "#f0fdf4", iconBg: "#dcfce7",
                icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
                fullName: "CONSISTENCY",
                desc: "Tracks how reliably you make solid ball contact round after round.",
                subs: [
                  { name: "Ball Striking", desc: "Quality of contact across all clubs" },
                  { name: "Mishit Rate", desc: "How often you catch it thin or fat" },
                  { name: "Round-to-Round", desc: "Repeatability across multiple rounds" },
                ],
                tips: {
                  up: "Your ball striking has been dialed in — CON rewards this kind of consistency.",
                  flat: "Log rounds consistently and report clean striking to build this stat over time.",
                  down: "Inconsistent contact is dragging CON down. Focus on solid ball striking.",
                },
              },
              REC: {
                color: "#a855f7", bg: "#faf5ff", iconBg: "#f3e8ff",
                icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#a855f7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>,
                fullName: "RECOVERY",
                desc: "How well you escape trouble and save par from difficult situations.",
                subs: [
                  { name: "Scrambling %", desc: "Up-and-down success from off the green" },
                  { name: "Sand Saves", desc: "Getting out of bunkers in regulation" },
                  { name: "Penalty Avoidance", desc: "Keeping the ball in play under pressure" },
                ],
                tips: {
                  up: "Your scrambling has been clutch — saving pars is what builds REC.",
                  flat: "Rate your short game and scrambling ability after each round to move this needle.",
                  down: "You\'ve been struggling to escape trouble. Work on your short game and up-and-downs.",
                },
              },
              EFF: {
                color: "#ef4444", bg: "#fff5f5", iconBg: "#fee2e2",
                icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M2 12h3M19 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12"/></svg>,
                fullName: "EFFICIENCY",
                desc: "Putting and scoring efficiency — turning your ball position into the fewest possible strokes.",
                subs: [
                  { name: "Putts Per Round", desc: "Total putts taken across 18 holes" },
                  { name: "3-Putt Avoidance", desc: "Staying out of three-putt territory" },
                  { name: "Birdie Conversion", desc: "Capitalizing on scoring opportunities" },
                ],
                tips: {
                  up: "You\'ve been cashing in on the greens — keep making those putts count.",
                  flat: "Report your putting performance honestly — making long putts and avoiding 3-putts is how this grows.",
                  down: "Too many 3-putts lately. Focus on lag putting and converting short ones.",
                },
              },
            };

            // Compute per-stat trends from history attrDeltas (last 5 rounds that have answers)
            const roundsWithAttrs = profile.history.filter(r => r.attrDeltas);
            const last5 = roundsWithAttrs.slice(0, 5);

            function getStatTrend(stat) {
              if (last5.length === 0) return "flat";
              const avg = last5.reduce((sum, r) => sum + (r.attrDeltas[stat] || 0), 0) / last5.length;
              if (avg > 0.5) return "up";
              if (avg < -0.5) return "down";
              return "flat";
            }

            function getStatBadge(statKey, val) {
              const base = profile.ovr;
              const diff = val - base;
              if (diff >= 3) return { label: "STRENGTH", color: "#16a34a", bg: "#f0fdf4", border: "#bbf7d0" };
              if (diff <= -3) return { label: "NEEDS WORK", color: "#ef4444", bg: "#fff1f2", border: "#fecaca" };
              return { label: "AVERAGE", color: "#f59e0b", bg: "#fffbeb", border: "#fde68a" };
            }

            const statEntries = Object.entries(stats);
            const minVal = Math.min(...statEntries.map(([,v]) => v));
            const maxVal = Math.max(...statEntries.map(([,v]) => v));

            return (
              <div style={{ position: "fixed", inset: 0, background: "#f4f5f7", zIndex: 300, overflowY: "auto", fontFamily: "'DM Sans', sans-serif" }}>
                {/* Header */}
                <div style={{ background: "#fff", borderBottom: "1px solid #e5e7eb", padding: "16px 20px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 10 }}>
                  <div>
                    <div style={{ fontSize: 20, fontWeight: 900, color: "#111827", letterSpacing: 0.5 }}>ATTRIBUTE BREAKDOWN</div>
                    <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>Based on your round history & self-reported performance</div>
                  </div>
                  <button onClick={() => setShowAttrModal(false)} style={{ background: "none", border: "1px solid #e5e7eb", borderRadius: "50%", width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#6b7280", fontSize: 16 }}>✕</button>
                </div>

                {/* Overview: radar + bars */}
                <div style={{ background: "#fff", margin: "12px 12px 0", borderRadius: 14, border: "1px solid #e5e7eb", padding: "16px", display: "flex", gap: 16, alignItems: "center" }}>
                  <div style={{ flexShrink: 0 }}>
                    <RadarChart stats={stats} accent={Theme.primaryGreen} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {statEntries.map(([k, v]) => {
                      const m = STAT_META[k];
                      const isWeakest = v === minVal;
                      const isBest = v === maxVal;
                      const trend = getStatTrend(k);
                      return (
                        <div key={k} style={{ marginBottom: 10 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                              <span style={{ fontSize: 11, fontWeight: 800, color: "#374151", letterSpacing: 0.5 }}>{k}</span>
                              <span style={{ fontSize: 11 }}>{trend === "up" ? "↑" : trend === "down" ? "↓" : "→"}</span>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                              {(isWeakest || isBest) && <span style={{ fontSize: 8, fontWeight: 800, color: isWeakest ? "#ef4444" : "#22c55e", letterSpacing: 0.5 }}>{isWeakest ? "WEAKEST" : "BEST"}</span>}
                              <span style={{ fontSize: 12, fontWeight: 900, color: m.color }}>{v}</span>
                            </div>
                          </div>
                          <div style={{ height: 5, borderRadius: 3, background: "#f3f4f6", overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${v}%`, background: m.color, borderRadius: 3 }} />
                          </div>
                        </div>
                      );
                    })}
                    {roundsWithAttrs.length === 0 && (
                      <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 8, fontStyle: "italic" }}>Answer post-round questions to see trends</div>
                    )}
                  </div>
                </div>

                {/* Per-stat cards */}
                <div style={{ padding: "12px 12px 24px", display: "flex", flexDirection: "column", gap: 10 }}>
                  {statEntries.map(([k, v]) => {
                    const m = STAT_META[k];
                    const badge = getStatBadge(k, v);
                    const trend = getStatTrend(k);
                    const tip = m.tips[trend];
                    return (
                      <div key={k} style={{ background: "#fff", borderRadius: 14, border: "1px solid #e5e7eb", overflow: "hidden" }}>
                        <div style={{ padding: "14px 16px 10px" }}>
                          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 6 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <div style={{ width: 40, height: 40, borderRadius: 10, background: m.iconBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                {m.icon}
                              </div>
                              <div>
                                <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                                  <span style={{ fontSize: 15, fontWeight: 900, color: "#111827", letterSpacing: 0.5 }}>{m.fullName}</span>
                                  <span style={{ fontSize: 9, fontWeight: 800, color: badge.color, background: badge.bg, border: `1px solid ${badge.border}`, borderRadius: 4, padding: "2px 6px", letterSpacing: 0.5 }}>{badge.label}</span>
                                  <span style={{ fontSize: 13, color: trend === "up" ? "#16a34a" : trend === "down" ? "#ef4444" : "#9ca3af" }} title={trend === "up" ? "Trending up" : trend === "down" ? "Trending down" : "Holding steady"}>
                                    {trend === "up" ? "↑" : trend === "down" ? "↓" : "→"}
                                  </span>
                                </div>
                                <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2, lineHeight: 1.4 }}>{m.desc}</div>
                              </div>
                            </div>
                            <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 8 }}>
                              <span style={{ fontSize: 28, fontWeight: 900, color: m.color, fontFamily: "Bebas Neue", lineHeight: 1 }}>{v}</span>
                              <div style={{ fontSize: 10, color: "#9ca3af" }}>/ 99</div>
                            </div>
                          </div>
                          <div style={{ height: 5, borderRadius: 3, background: "#f3f4f6", overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${v}%`, background: m.color, borderRadius: 3 }} />
                          </div>
                        </div>
                        <div style={{ padding: "4px 16px 10px" }}>
                          {m.subs.map((s, i) => (
                            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, paddingBottom: 7 }}>
                              <div style={{ width: 7, height: 7, borderRadius: "50%", background: m.color, flexShrink: 0, marginTop: 5 }} />
                              <div>
                                <div style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>{s.name}</div>
                                <div style={{ fontSize: 11, color: "#9ca3af" }}>{s.desc}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div style={{ background: m.bg, borderTop: `1px solid ${m.iconBg}`, padding: "10px 16px", display: "flex", alignItems: "flex-start", gap: 8 }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={m.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                          <span style={{ fontSize: 12, color: "#374151", lineHeight: 1.5 }}>{tip}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* ── ROUND ENTRY ── always visible unless entering scores ── */}
          {scanState !== "scores" && (
            <div style={{ padding: "0 16px 16px" }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: "#9ca3af", letterSpacing: 2, paddingTop: 16, marginBottom: 10 }}>LOG A ROUND</div>
              <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", padding: "12px 12px", marginBottom: 10 }}>
                <div style={{ fontSize: 9, fontWeight: 800, color: "#9ca3af", letterSpacing: 1.5, marginBottom: 5 }}>COURSE NAME</div>
                <div style={{ position: "relative", marginBottom: 12 }}>
                  <input value={editCourse} onChange={e => handleCourseSearch(e.target.value)} placeholder="Search course name…" style={S.fInput} />
                  <div style={{ fontSize: 9, color: selectedApiCourse ? Theme.primaryGreen : "#9ca3af", fontWeight: 700, marginTop: 4 }}>
                    {selectedApiCourse ? "📡 GolfCourseAPI course selected — map location available" : "Choose a dropdown result for best map support"}
                  </div>
                  {courseSuggestions.length > 0 && (
                    <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, zIndex: 10, boxShadow: "0 4px 12px rgba(0,0,0,0.1)", overflow: "hidden" }}>
                      {courseSuggestions.map((c, i) => (
                        <div key={i} onClick={() => selectCourse(c)} style={{ padding: "12px 12px", cursor: "pointer", borderBottom: "1px solid #f0f0f0", fontSize: 12, fontWeight: 600 }}>
                          <div style={{ color: "#111827", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                            {c.source === "golfcourseapi" ? "📡 " : ""}{c.name}
                            {c.community && (
                              <span style={{ fontSize: 8, fontWeight: 800, background: c.communityVerified ? "#dcfce7" : "#fef3c7", color: c.communityVerified ? "#16a34a" : "#92400e", border: `1px solid ${c.communityVerified ? "#86efac" : "#fde68a"}`, borderRadius: 4, padding: "1px 5px", letterSpacing: 0.5 }}>
                                {c.communityVerified ? "✓ VERIFIED" : `COMMUNITY ${c.verificationCount || 1}/5`}
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: 10, color: "#9ca3af" }}>
                            {c.source === "golfcourseapi"
                              ? `📡 GolfCourseAPI · ${c.location?.city || ""}${c.location?.state ? ", " + c.location.state : ""}`
                              : c.tees ? Object.keys(c.tees).join(" · ") + " tees" : `Rating ${c.rating} · Slope ${c.slope}`}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div style={{ fontSize: 9, fontWeight: 800, color: "#9ca3af", letterSpacing: 1.5, marginBottom: 6 }}>TEE COLOR</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
                  {(() => {
                    const TEE_META = [
                      { label: "Black", dot: "#111827", dotOpacity: 0.8 },
                      { label: "Blue",  dot: "#3b82f6", dotOpacity: 0.8 },
                      { label: "White", dot: "#e5e7eb", border: "#9ca3af" },
                      { label: "Gold",  dot: "#f59e0b", dotOpacity: 0.8 },
                      { label: "Red",   dot: "#ef4444" },
                    ];
                    // Determine available tees: API course → its tee names; COURSE_DB → its tee keys; otherwise all
                    const apiTeeNames = selectedApiCourse ? apiCourseTeeNames(selectedApiCourse) : null;
                    const available = TEE_META.filter(t => {
                      if (apiTeeNames) return apiTeeNames.includes(t.label);
                      if (COURSE_DB[editCourse]) return !!COURSE_DB[editCourse].tees[t.label];
                      return true;
                    });
                    return available.map(t => {
                      const active = editTee === t.label;
                      return (
                        <button key={t.label} onClick={() => setEditTee(t.label)} style={{ display: "flex", alignItems: "center", gap: 4, padding: "6px 10px", borderRadius: 7, border: active ? `2px solid ${t.border || t.dot}` : "1px solid #e5e7eb", background: active ? "#f9fafb" : "#fff", cursor: "pointer", fontWeight: 700, fontSize: 11, color: Theme.textMain }}>
                          <div style={{ width: 9, height: 9, borderRadius: "50%", background: t.dot, border: t.border ? `1px solid ${t.border}` : "none", opacity: t.dotOpacity ?? 1 }} />
                          {t.label}
                        </button>
                      );
                    });
                  })()}
                </div>
                {(() => {
                  // Rating/slope confirmed badge — prefer API data, fall back to COURSE_DB
                  const apiTee = selectedApiCourse ? extractApiTeeData(selectedApiCourse, editTee) : null;
                  const localData = getCourseData(editCourse, editTee);
                  if (apiTee) return <div style={{ fontSize: 10, color: Theme.primaryGreen, fontWeight: 600 }}>📡 {apiTee.tee_name} tees · Rating {apiTee.rating} · Slope {apiTee.slope}</div>;
                  if (localData) return <div style={{ fontSize: 10, color: Theme.primaryGreen, fontWeight: 600 }}>✓ {editTee} tees · Rating {localData.rating} · Slope {localData.slope}</div>;
                  if (editCourse) return (
                    <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                      <div style={{ flex: 1 }}><div style={S.fLabel}>RATING</div><input value={editRating} onChange={e => setEditRating(e.target.value)} placeholder="72.4" style={S.fInput} type="number" step="0.1" /></div>
                      <div style={{ flex: 1 }}><div style={S.fLabel}>SLOPE</div><input value={editSlope} onChange={e => setEditSlope(e.target.value)} placeholder="128" style={S.fInput} type="number" /></div>
                    </div>
                  );
                  return null;
                })()}
              </div>
              {/* Can't find course CTA */}
              <button onClick={() => { setNewCourseForm(f => ({ ...f, courseName: editCourse || "", holes: editHoles })); setShowCreateCourse(true); }} style={{ width: "100%", paddingTop: 10, paddingBottom: 8, background: "transparent", border: "none", cursor: "pointer", fontSize: "0.85rem", fontWeight: 500, color: Theme.softSlate, letterSpacing: 0.2, marginBottom: 8, textAlign: "center" }}>
                Can't find your course? Add course to community
              </button>
              {/* Holes toggle */}
              <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", padding: "12px", marginBottom: 12 }}>
                <div style={{ fontSize: 9, fontWeight: 800, color: "#9ca3af", letterSpacing: 1.5, marginBottom: 8 }}>HOLES PLAYED</div>
                <div style={{ display: "flex", gap: 6 }}>
                  {["9","18"].map(h => (
                    <button key={h} onClick={() => { setEditHoles(h); setEditHoleScores(Array(parseInt(h)).fill(null)); setEditScore(""); }} style={{ flex: 1, padding: "9px 0", background: editHoles === h ? Theme.gradientGreen : "#f9fafb", border: editHoles === h ? `1.5px solid ${Theme.primaryGreen}` : "1px solid #e5e7eb", borderRadius: 12, color: editHoles === h ? "#fff" : Theme.textMuted, fontSize: 11, fontWeight: 800, letterSpacing: 1, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
                      {h} HOLES
                    </button>
                  ))}
                </div>
                {editHoles === "9" && (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ fontSize: 9, fontWeight: 800, color: "#9ca3af", letterSpacing: 1.5, marginBottom: 8 }}>WHICH 9?</div>
                    <div style={{ display: "flex", gap: 6 }}>
                      {[["front","FRONT 9"],["back","BACK 9"]].map(([val, label]) => (
                        <button key={val} onClick={() => setEditNineSide(val)} style={{ flex: 1, padding: "9px 0", background: editNineSide === val ? Theme.gradientGreen : "#f9fafb", border: editNineSide === val ? `1.5px solid ${Theme.primaryGreen}` : "1px solid #e5e7eb", borderRadius: 12, color: editNineSide === val ? "#fff" : Theme.textMuted, fontSize: 11, fontWeight: 800, letterSpacing: 1, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => { if (!editCourse) return; const extra = { ...(editRating && editSlope ? { overrideRating: parseFloat(editRating), overrideSlope: parseInt(editSlope) } : {}), ...(editHoles === "9" ? { nineSide: editNineSide } : {}) }; startLiveRound(editCourse, editTee, editHoles, Object.keys(extra).length ? extra : undefined); }} disabled={!editCourse} style={{ flex: 1, padding: "14px 0", background: editCourse ? Theme.gradientGreen : "#e5e7eb", border: "none", borderRadius: 12, color: editCourse ? "#fff" : "#9ca3af", cursor: editCourse ? "pointer" : "default", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, boxShadow: editCourse ? "0 4px 14px rgba(125,162,126,0.35)" : "none" }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={editCourse ? "#fff" : "#9ca3af"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8" fill="currentColor" stroke="none"/></svg>
                  <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: 1.5, fontFamily: "'DM Sans', sans-serif" }}>START LIVE</div>
                </button>
                <button onClick={() => { const hp = getCourseHolePars(editCourse, editHoles); setEditHoleScores(Array(parseInt(editHoles) || 18).fill(null)); setEditHolePars(hp || []); setScanState("scores"); setScanError(null); }} style={{ flex: 1, padding: "14px 0", background: "#fff", border: "2px solid #e5e7eb", borderRadius: 12, color: "#374151", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                  <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: 1.5, fontFamily: "'DM Sans', sans-serif" }}>ENTER MANUALLY</div>
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Scores grid */}
          {scanState === "scores" && (
            <div style={{ padding: "0 16px 16px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0 8px" }}>
                <div>
                  <div style={{ fontSize: 17, fontWeight: 900, fontFamily: "Bebas Neue", letterSpacing: 1.5, color: "#111827" }}>ENTER SCORES</div>
                </div>
                <button onClick={() => { setScanState("idle"); setScanError(null); }} style={{ background: "none", border: "none", fontSize: 11, fontWeight: 700, color: "#9ca3af", cursor: "pointer" }}>← Back</button>
              </div>
              {/* Course summary pill */}
              <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: "8px 12px", marginBottom: 8, fontSize: 12, fontWeight: 700, color: "#166534" }}>
                {editCourse || "No course"}{editTee ? ` · ${editTee} tees` : ""} · {editHoles} holes
              </div>
              {scanError && <div style={{ background: "#fef3c7", border: "1px solid #fde68a", borderRadius: 8, padding: "8px 12px", fontSize: 11, color: "#92400e", fontWeight: 600, marginBottom: 8 }}>⚠️ {scanError}</div>}
              <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", padding: "12px 10px", marginBottom: 8 }}>
                {(() => {
                  const holeCount = parseInt(editHoles) || 18;
                  const hs = editHoleScores.length === holeCount ? editHoleScores : Array(holeCount).fill(null);
                  const front = Array.from({ length: Math.min(9, holeCount) }, (_, i) => i);
                  const back = holeCount === 18 ? Array.from({ length: 9 }, (_, i) => i + 9) : [];
                  const focusGridIdx = nextIdx => {
                    setTimeout(() => {
                      const all = document.querySelectorAll("[data-holegrid] input");
                      if (all[nextIdx]) { all[nextIdx].focus(); all[nextIdx].select(); }
                    }, 0);
                  };
                  const advanceToNext = el => {
                    const all = Array.from(document.querySelectorAll("[data-holegrid] input"));
                    const cur = all.indexOf(el);
                    if (cur >= 0 && cur < all.length - 1) focusGridIdx(cur + 1);
                  };
                  const updateHole = (idx, val, el) => {
                    const next = [...hs];
                    const p = val === "" ? null : parseInt(val);
                    next[idx] = p;
                    setEditHoleScores(next);
                    const total = next.reduce((a, b) => a + (b != null ? b : 0), 0);
                    if (total > 0) setEditScore(String(total));
                    // Capture advance index before re-render, then defer focus
                    if (el && (val.length === 2 || (val.length === 1 && p >= 2 && p <= 9))) {
                      const all = Array.from(document.querySelectorAll("[data-holegrid] input"));
                      const cur = all.indexOf(el);
                      if (cur >= 0 && cur < all.length - 1) focusGridIdx(cur + 1);
                    }
                  };
                  const hasPars = editHolePars && editHolePars.length > 0;
                  const HoleRow = ({ idxs, label }) => {
                    const tot = idxs.reduce((a, i) => a + (hs[i] != null ? hs[i] : 0), 0);
                    const parTot = hasPars ? idxs.reduce((a, i) => a + (editHolePars[i] || 0), 0) : null;
                    return (
                      <div style={{ marginBottom: 6 }}>
                        {/* Hole numbers row */}
                        <div style={{ display: "flex", alignItems: "center", gap: 2, marginBottom: 2 }}>
                          <div style={{ width: 24, fontSize: 7, fontWeight: 800, color: "#9ca3af" }}>{label}</div>
                          {idxs.map(i => <div key={i} style={{ flex: 1, textAlign: "center", fontSize: 7, fontWeight: 800, color: "#9ca3af" }}>{i+1}</div>)}
                          <div style={{ width: 24, textAlign: "center", fontSize: 7, fontWeight: 800, color: "#9ca3af" }}>TOT</div>
                        </div>
                        {/* PAR row */}
                        <div style={{ display: "flex", alignItems: "center", gap: 2, marginBottom: 3 }}>
                          <div style={{ width: 24, fontSize: 7, fontWeight: 800, color: "#6b7280" }}>PAR</div>
                          {idxs.map(i => {
                            const p = editHolePars[i] || 4;
                            return (
                              <div
                                key={i}
                                onClick={() => {
                                  const next = [...editHolePars];
                                  next[i] = p === 3 ? 4 : p === 4 ? 5 : 3;
                                  setEditHolePars(next);
                                }}
                                style={{ flex: 1, textAlign: "center", fontSize: 9, fontWeight: 800, color: "#1d4ed8", background: "#eff6ff", borderRadius: 3, padding: "3px 0", cursor: "pointer", userSelect: "none" }}
                              >
                                {p}
                              </div>
                            );
                          })}
                          <div style={{ width: 24, textAlign: "center", fontSize: 9, fontWeight: 800, color: "#374151", background: "#f3f4f6", borderRadius: 3, padding: "3px 0" }}>
                            {parTot || "–"}
                          </div>
                        </div>
                        {/* Score inputs row */}
                        <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
                          <div style={{ width: 24 }} />
                          {idxs.map(i => {
                            const sc = hs[i];
                            const par = hasPars ? editHolePars[i] : null;
                            const diff = sc != null && par ? sc - par : null;
                            const borderColor = diff === null ? "#e5e7eb" : diff <= -2 ? "#1d4ed8" : diff === -1 ? "#3b82f6" : diff === 0 ? "#d1d5db" : diff === 1 ? "#f59e0b" : "#ef4444";
                            const bgColor    = diff === null ? "#fff" : diff <= -2 ? "#dbeafe" : diff === -1 ? "#eff6ff" : diff === 0 ? "#f9fafb" : diff === 1 ? "#fffbeb" : "#fef2f2";
                            return (
                              <input key={i} type="tel" inputMode="numeric" pattern="[0-9]*"
                                value={sc ?? ""}
                                onChange={e => { const v = e.target.value.replace(/[^0-9]/g, "").slice(0, 2); updateHole(i, v, e.target); }}
                                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); advanceToNext(e.target); } }}
                                onFocus={e => e.target.select()}
                                style={{ flex: 1, width: 0, minWidth: 0, textAlign: "center", fontSize: 12, fontWeight: 900, color: "#111827", border: `1.5px solid ${borderColor}`, borderRadius: 5, padding: "6px 0", background: bgColor, fontFamily: "DM Mono, monospace", outline: "none" }}
                              />
                            );
                          })}
                          <div style={{ width: 24, textAlign: "center", fontSize: 13, fontWeight: 900, color: "#111827", fontFamily: "Bebas Neue" }}>{tot || "–"}</div>
                        </div>
                      </div>
                    );
                  };
                  const filled = hs.filter(v => v != null && v > 0).length;
                  const total = hs.reduce((a, b) => a + (b != null ? b : 0), 0);
                  const totalPar = hasPars ? editHolePars.slice(0, holeCount).reduce((a, b) => a + (b || 0), 0) : null;
                  const vsParNum = total > 0 && totalPar ? total - totalPar : null;
                  const vsPar = vsParNum === null ? null : vsParNum === 0 ? "E" : vsParNum > 0 ? `+${vsParNum}` : `${vsParNum}`;
                  return (
                    <div data-holegrid>
                      <HoleRow idxs={front} label="OUT" />
                      {back.length > 0 && <HoleRow idxs={back} label="IN" />}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8, paddingTop: 6, borderTop: "1px solid #e5e7eb" }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: filled === holeCount ? ACCENT : "#9ca3af" }}>{filled === holeCount ? "✓ All holes entered" : `${filled}/${holeCount} holes`}</span>
                        <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                          {vsPar !== null && (
                            <span style={{ fontSize: 12, fontWeight: 900, color: vsParNum < 0 ? "#1d4ed8" : vsParNum === 0 ? "#6b7280" : "#dc2626", background: vsParNum < 0 ? "#dbeafe" : vsParNum === 0 ? "#f3f4f6" : "#fef2f2", border: `1px solid ${vsParNum < 0 ? "#93c5fd" : vsParNum === 0 ? "#d1d5db" : "#fecaca"}`, borderRadius: 6, padding: "1px 6px" }}>
                              {vsPar}
                            </span>
                          )}
                          <span style={{ fontSize: 9, fontWeight: 700, color: "#9ca3af" }}>TOTAL</span>
                          <span style={{ fontSize: 24, fontWeight: 900, color: total > 0 ? "#111827" : "#d1d5db", fontFamily: "Bebas Neue" }}>{total || "—"}</span>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
              <button onClick={() => {
                const holeCount = parseInt(editHoles) || 18;
                const hs = editHoleScores.length === holeCount ? editHoleScores : Array(holeCount).fill(null);
                const filled = hs.filter(v => v != null && v > 0).length;
                if (filled < holeCount) { setScanError(`Please fill all ${holeCount} holes. (${filled}/${holeCount})`); return; }
                setScanError(null); submitRound();
              }} style={{ width: "100%", padding: "15px 0", background: Theme.primaryGreen, border: "none", borderRadius: 10, color: "#fff", fontSize: 13, fontWeight: 900, letterSpacing: 2, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
                LOCK IN ROUND
              </button>
            </div>
          )}

        </div>
  );
}
