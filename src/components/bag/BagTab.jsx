export default function BagTab(props) {
  const { S, Theme, activeBagClub, bagEditClub, hapticTap, profile, setActiveBagClub, setBagEditClub, setProfile, tab } = props;
  return (() => {
        const sorted = [...(profile.bag || [])].sort((a, b) => parseFloat(b.distance || 0) - parseFloat(a.distance || 0));

        return (
          <div className="tab-scroll" style={{ background: "#F9F9F9", display: "flex", flexDirection: "column", paddingBottom: 80 }}>

            {/* ── Header ── */}
            <div style={{ background: "#FFFFFF", padding: "clamp(20px,5vw,32px) 20px 0", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 2 }}>
                <div style={{ fontSize: 26, fontWeight: 900, fontFamily: "'Inter',sans-serif", letterSpacing: 0.5, color: Theme.textMain }}>MY BAG</div>
                <div style={{ fontSize: 12, color: Theme.textMuted, fontWeight: 600 }}>
                  {sorted.length} club{sorted.length !== 1 ? "s" : ""}
                </div>
              </div>
              <div style={{ fontSize: 11, color: Theme.textMuted, fontWeight: 500, marginBottom: 14 }}>
                Tap a club to select · quick-add below
              </div>
              {/* Quick-add pill bar */}
              <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 16, scrollbarWidth: "none" }}>
                {["Driver","3W","5W","2H","3H","4H","4i","5i","6i","7i","8i","9i","PW","AW","SW","48°","50°","52°","54°","56°","58°","60°","Putter"].map(c => {
                  const inBag = (profile.bag || []).some(b => b.club === c);
                  return (
                    <button key={c} onClick={() => { if (inBag) return; hapticTap(); setProfile(p => ({ ...p, bag: [...(p.bag || []), { club: c, distance: "", notes: "" }] })); }}
                      style={{ flexShrink: 0, padding: "6px 13px", background: inBag ? "rgba(125,162,126,0.12)" : "transparent", border: inBag ? `1px solid ${Theme.primaryGreen}` : "1px solid rgba(91,114,130,0.28)", borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: inBag ? "default" : "pointer", color: inBag ? Theme.primaryGreen : Theme.softSlate, whiteSpace: "nowrap" }}>
                      {c}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ── Club list ── */}
            <div style={{ flex: 1, overflowY: "auto", padding: "12px 20px" }}>
              {sorted.length === 0 && (
                <div style={{ paddingTop: 40, textAlign: "center", color: Theme.textMuted, fontSize: 13 }}>
                  Add clubs using the bar above
                </div>
              )}
              {sorted.map((item, idx) => {
                const isActive = activeBagClub === item.club;

                if (bagEditClub === idx) {
                  return (
                    <div key={idx} style={{ background: "#fff", borderRadius: 10, border: "1px solid rgba(0,0,0,0.08)", marginBottom: 10, padding: "14px 16px" }}>
                      <div style={{ display: "flex", gap: 7, marginBottom: 9 }}>
                        <input defaultValue={item.club} id={`club-name-${idx}`} placeholder="Club (e.g. 7i)" style={{ ...S.fInput, flex: 1, fontSize: 13 }} />
                        <input defaultValue={item.distance} id={`club-dist-${idx}`} placeholder="Avg yds" type="number" style={{ ...S.fInput, flex: 1, fontSize: 13 }} />
                      </div>
                      <div style={{ display: "flex", gap: 7 }}>
                        <button onClick={() => {
                          const name = document.getElementById(`club-name-${idx}`).value.trim();
                          const dist = document.getElementById(`club-dist-${idx}`).value.trim();
                          setProfile(p => { const b = [...(p.bag || [])]; b[idx] = { ...b[idx], club: name, distance: dist }; return { ...p, bag: b }; });
                          setBagEditClub(null);
                        }} style={{ flex: 1, padding: "9px 0", background: Theme.primaryGreen, border: "none", borderRadius: 8, color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>Save</button>
                        <button onClick={() => { setProfile(p => ({ ...p, bag: (p.bag || []).filter((_, i) => i !== idx) })); setBagEditClub(null); if (activeBagClub === item.club) setActiveBagClub(null); }}
                          style={{ padding: "9px 12px", background: "#FEF2F2", border: "none", borderRadius: 8, color: "#DC2626", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>Remove</button>
                        <button onClick={() => setBagEditClub(null)} style={{ padding: "9px 10px", background: "#F3F4F6", border: "none", borderRadius: 8, color: "#6B7280", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>✕</button>
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={idx}
                    onClick={() => { hapticTap(); setActiveBagClub(a => a === item.club ? null : item.club); }}
                    style={{
                      background: isActive ? "rgba(125,162,126,0.05)" : "#FFFFFF",
                      borderRadius: 10,
                      borderLeft: isActive ? `3px solid ${Theme.primaryGreen}` : "3px solid transparent",
                      borderTop: "1px solid rgba(0,0,0,0.06)",
                      borderRight: "1px solid rgba(0,0,0,0.06)",
                      borderBottom: "1px solid rgba(0,0,0,0.06)",
                      marginBottom: 10,
                      cursor: "pointer",
                      transition: "background 0.15s, border-left-color 0.15s",
                    }}>
                    <div style={{ padding: "16px 14px 16px 18px", display: "flex", alignItems: "center" }}>
                      {/* Club name */}
                      <div style={{ flex: 1, fontSize: 16, fontWeight: 700, color: Theme.textMain, fontFamily: "'Inter',sans-serif", letterSpacing: -0.2 }}>
                        {item.club}
                      </div>
                      {/* Yardage */}
                      <div style={{ fontSize: 14, fontWeight: 600, color: item.distance ? Theme.softSlate : "#D1D1D6", marginRight: 10 }}>
                        {item.distance ? `${item.distance} yds` : "—"}
                      </div>
                      {/* Edit chevron */}
                      <button onClick={e => { e.stopPropagation(); setBagEditClub(idx); }}
                        style={{ background: "none", border: "none", cursor: "pointer", padding: "2px", color: "#D1D1D6", flexShrink: 0 }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
                      </button>
                    </div>
                  </div>
                );
              })}
              {/* Add club */}
              <button onClick={() => setProfile(p => ({ ...p, bag: [...(p.bag || []), { club: "", distance: "", notes: "" }] }))}
                style={{ width: "100%", padding: "15px 0", background: "transparent", border: "1.5px dashed rgba(125,162,126,0.45)", borderRadius: 10, color: Theme.primaryGreen, fontSize: 13, fontWeight: 600, cursor: "pointer", marginTop: 4 }}>
                + Add Club
              </button>
            </div>
          </div>
        );
  })();
}
