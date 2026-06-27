export default function StatBar({ label, value, accent }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", letterSpacing: 1, fontFamily: "DM Sans" }}>{label}</span>
        <span style={{ fontSize: 13, fontWeight: 900, color: "#fff", fontFamily: "DM Sans" }}>{value}</span>
      </div>
      <div style={{ height: 4, borderRadius: 2, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${value}%`, background: accent, borderRadius: 2, transition: "width 0.6s ease" }} />
      </div>
    </div>
  );
}
