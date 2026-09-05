export default function RoundDetailModal(props) {
  const { ACCENT, Theme, authUser, confirmDeleteRound, deleteRound, setConfirmDeleteRound, setViewingRound, viewingRound } = props;

  if (!viewingRound) return null;

  return (
    <div onClick={() => { setViewingRound(null); setConfirmDeleteRound(false); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "flex-end", zIndex: 300 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: "20px 20px 0 0", padding: "24px 20px", width: "100%", maxHeight: "80vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 900, fontFamily: "Bebas Neue", letterSpacing: 1 }}>{viewingRound.course || "Unknown"}</div>
            <div style={{ fontSize: 12, color: "#9ca3af" }}>{viewingRound.date} · {viewingRound.holes} holes{viewingRound.tee ? ` · ${viewingRound.tee} tees` : ""}</div>
          </div>
          <button onClick={() => { setViewingRound(null); setConfirmDeleteRound(false); }} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#9ca3af" }}>✕</button>
        </div>
        <div style={{ display: "flex", gap: 0, marginBottom: 20 }}>
          {(() => {
            const ovrDelta = viewingRound.ovrDelta;
            const ovrSub = ovrDelta != null ? { label: ovrDelta === 0 ? "—" : ovrDelta > 0 ? `+${ovrDelta}` : `${ovrDelta}`, color: ovrDelta > 0 ? ACCENT : ovrDelta < 0 ? "#C57B7B" : "#9ca3af" } : null;
            return [{ v: viewingRound.score, l: "SCORE", c: "#111827", sub: null }, { v: viewingRound.ovrAfter, l: "OVR", c: ACCENT, sub: ovrSub }, { v: `+${viewingRound.coins || 0}`, l: "🪙", c: "#f59e0b", sub: null }].map(({ v, l, c, sub }) => (
              <div key={l} style={{ flex: 1, textAlign: "center" }}>
                <div style={{ fontSize: 32, fontWeight: 900, fontFamily: "Bebas Neue", color: c, lineHeight: 1 }}>{v}</div>
                {sub && <div style={{ fontSize: 13, fontWeight: 900, fontFamily: "Bebas Neue", color: sub.color, letterSpacing: 1, lineHeight: 1.3 }}>{sub.label}</div>}
                <div style={{ fontSize: 9, fontWeight: 800, color: "#9ca3af", letterSpacing: 1.5, marginTop: 2 }}>{l}</div>
              </div>
            ));
          })()}
        </div>
        {viewingRound.holeScores && viewingRound.holeScores.length > 0 && (() => {
          const sc = viewingRound.holeScores;
          const pars = viewingRound.holePars;
          const hOffset = viewingRound.holeOffset || 0;
          const holeCount = sc.length;
          const front = sc.slice(0, Math.min(9, holeCount));
          const back = holeCount > 9 ? sc.slice(9) : [];
          const pFront = pars ? pars.slice(0, Math.min(9, holeCount)) : null;
          const pBack = pars && holeCount > 9 ? pars.slice(9) : null;
          const fTotal = front.reduce((a, b) => a + (b || 0), 0);
          const bTotal = back.reduce((a, b) => a + (b || 0), 0);
          const fPar = pFront ? pFront.reduce((a, b) => a + (b || 4), 0) : null;
          const bPar = pBack ? pBack.reduce((a, b) => a + (b || 4), 0) : null;
          const totalScore = fTotal + bTotal;
          const totalPar = (fPar || 0) + (bPar || 0);
          const totalDiff = (fPar || bPar) ? totalScore - totalPar : null;
          const cellBg = (score, par) => {
            if (score == null) return "#f3f4f6";
            if (par == null) return "#f3f4f6";
            const d = score - par;
            return d <= -2 ? "#bfdbfe" : d === -1 ? "#dbeafe" : d === 0 ? "#dcfce7" : d === 1 ? "#fef3c7" : d === 2 ? "#fee2e2" : "#fecaca";
          };
          const diffLabel = d => d === null ? null : d === 0 ? "E" : d > 0 ? `+${d}` : `${d}`;
          const diffColor = d => d === null ? "#d1d5db" : d < 0 ? "#3b82f6" : d === 0 ? Theme.primaryGreen : d <= 4 ? "#d97706" : "#dc2626";
          const HoleGrid = ({ scores, pRow, startHole }) => (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(9, 1fr)", gap: 4, marginBottom: 8 }}>
              {scores.map((score, i) => {
                const par = pRow ? pRow[i] : null;
                return (
                  <div key={i} style={{ background: cellBg(score, par), border: "1px solid #e5e7eb", borderRadius: 8, padding: "8px 4px 6px", display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                    <span style={{ fontSize: 7, fontFamily: "Bebas Neue", color: "#9ca3af", letterSpacing: 1 }}>{startHole + i + 1}</span>
                    <span style={{ fontSize: 20, fontFamily: "Bebas Neue", color: score == null ? "#d1d5db" : "#111827", lineHeight: 1 }}>{score ?? "·"}</span>
                    <span style={{ fontSize: 6, fontFamily: "Bebas Neue", color: "#9ca3af", letterSpacing: 0.5 }}>{par ? `P${par}` : ""}</span>
                  </div>
                );
              })}
            </div>
          );
          return (
            <div style={{ background: "#f9fafb", borderRadius: 16, padding: "14px", marginBottom: 12, border: "1px solid #e5e7eb" }}>
              <HoleGrid scores={front} pRow={pFront} startHole={hOffset} />
              {back.length > 0 && <HoleGrid scores={back} pRow={pBack} startHole={9} />}
              <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                {holeCount <= 9 && (
                  <div style={{ flex: 1, background: "#f3f4f6", borderRadius: 8, padding: "8px 10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 9, fontFamily: "Bebas Neue", color: "#9ca3af", letterSpacing: 1.5 }}>{hOffset === 9 ? "BACK" : "FRONT"}</span>
                    <span style={{ fontSize: 16, fontFamily: "Bebas Neue", color: "#111827" }}>{fTotal}</span>
                  </div>
                )}
                {back.length > 0 && <>
                  <div style={{ flex: 1, background: "#f3f4f6", borderRadius: 8, padding: "8px 10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 9, fontFamily: "Bebas Neue", color: "#9ca3af", letterSpacing: 1.5 }}>FRONT</span>
                    <span style={{ fontSize: 16, fontFamily: "Bebas Neue", color: "#111827" }}>{fTotal}</span>
                  </div>
                  <div style={{ flex: 1, background: "#f3f4f6", borderRadius: 8, padding: "8px 10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 9, fontFamily: "Bebas Neue", color: "#9ca3af", letterSpacing: 1.5 }}>BACK</span>
                    <span style={{ fontSize: 16, fontFamily: "Bebas Neue", color: "#111827" }}>{bTotal}</span>
                  </div>
                </>}
                <div style={{ flex: 1, background: "rgba(125,162,126,0.1)", borderRadius: 8, padding: "8px 10px", display: "flex", justifyContent: "space-between", alignItems: "center", border: "1px solid rgba(125,162,126,0.3)" }}>
                  <span style={{ fontSize: 9, fontFamily: "Bebas Neue", color: Theme.primaryGreen, letterSpacing: 1.5 }}>TOTAL</span>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
                    <span style={{ fontSize: 16, fontFamily: "Bebas Neue", color: "#111827" }}>{totalScore}</span>
                    {diffLabel(totalDiff) && <span style={{ fontSize: 12, fontFamily: "Bebas Neue", color: diffColor(totalDiff) }}>{diffLabel(totalDiff)}</span>}
                  </div>
                </div>
              </div>
            </div>
          );
        })()}
        {authUser && viewingRound.id && (viewingRound.ownerUid ? viewingRound.ownerUid === authUser.uid : true) && (
          <div>
            {!confirmDeleteRound ? (
              <button onClick={() => setConfirmDeleteRound(true)} style={{ width: "100%", padding: "12px 0", background: "#fff5f5", border: "1px solid #fecaca", borderRadius: 10, color: "#dc2626", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Delete Round</button>
            ) : (
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setConfirmDeleteRound(false)} style={{ flex: 1, padding: "12px 0", background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Cancel</button>
                <button onClick={() => { deleteRound(viewingRound.id); setViewingRound(null); setConfirmDeleteRound(false); }} style={{ flex: 1, padding: "12px 0", background: "#dc2626", border: "none", borderRadius: 10, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Confirm Delete</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
