export default function BottomNav(props) {
  const { Theme, challenges, leaderboard, liveRound, profile, setBadgeFlash, setFlash, setTab, tab } = props;
  return (
      <nav className="bottom-nav" style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "#fff", borderTop: "1px solid #e5e7eb", display: (tab === "profile" && liveRound) ? "none" : "flex", zIndex: 100 }}>
        {[
          { id: "profile", label: "Profile", icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg> },
          { id: "leaderboard", label: "Rankings", icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="18" y="3" width="4" height="18" rx="1"/><rect x="10" y="8" width="4" height="13" rx="1"/><rect x="2" y="13" width="4" height="8" rx="1"/></svg> },
          { id: "challenges", label: "Challenges", icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg> },
          { id: "bag", label: "Bag", icon: (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              {/* Club shafts fanning out */}
              <line x1="10" y1="8" x2="6" y2="1"/>
              <line x1="12" y1="8" x2="12" y2="1"/>
              <line x1="14" y1="8" x2="18" y2="1"/>
              {/* Collar separating shafts from body */}
              <line x1="8" y1="8" x2="16" y2="8"/>
              {/* Bag body — tall and narrow */}
              <path d="M9 8 L9 21 Q9 23 12 23 Q15 23 15 21 L15 8 Z"/>
              {/* Shoulder strap */}
              <path d="M15 10 Q20 14 19 21"/>
            </svg>
          ) },
          { id: "shop", label: "Shop", icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 001.99 1.61h9.72a2 2 0 001.99-1.61L23 6H6"/></svg> },
        ].map(({ id, label, icon, badge }) => (
          <button key={id} onClick={() => { setTab(id); setFlash(null); setBadgeFlash(null); }} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "10px 0 12px", border: "none", background: "transparent", color: tab === id ? Theme.primaryGreen : "#374151", cursor: "pointer", position: "relative", transition: "color 0.15s" }}>
            {icon}
            <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: 0.5, marginTop: 3 }}>{label}</span>
            {badge && <div style={{ position: "absolute", top: 6, right: "calc(50% - 16px)", width: 16, height: 16, borderRadius: "50%", background: "#ef4444", color: "#fff", fontSize: 9, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{badge}</div>}
          </button>
        ))}
      </nav>
  );
}
