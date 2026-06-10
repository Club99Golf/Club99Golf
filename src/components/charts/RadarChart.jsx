export default function RadarChart({ stats, accent = "#7DA27E" }) {
  const size = 200, cx = 100, cy = 100, r = 68;
  const keys = Object.keys(stats);
  const n = keys.length;
  const angle = i => (Math.PI * 2 * i) / n - Math.PI / 2;
  const pt = (i, scale) => [cx + Math.cos(angle(i)) * r * scale, cy + Math.sin(angle(i)) * r * scale];
  // Scale: 0→center, 99→edge, 50→exactly the 50% ring
  const dataPoints = keys.map((k, i) => pt(i, Math.max(0, stats[k]) / 99));
  const dataPath = dataPoints.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x},${y}`).join(" ") + "Z";
  return (
    <svg width={size} height={size} style={{ overflow: "visible" }}>
      {[0.25, 0.5, 0.75, 1].map(sc => { const pts = keys.map((_, i) => pt(i, sc)); const p = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x},${y}`).join(" ") + "Z"; return <path key={sc} d={p} fill="none" stroke="rgba(0,0,0,0.07)" strokeWidth="1" />; })}
      {keys.map((_, i) => { const [x, y] = pt(i, 1); return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="rgba(0,0,0,0.07)" strokeWidth="1" />; })}
      <path d={dataPath} fill={`${accent}33`} stroke={accent} strokeWidth="2" />
      {dataPoints.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={3.5} fill={accent} />)}
      {keys.map((k, i) => { const [x, y] = pt(i, 1.32); return (<g key={k}><text x={x} y={y - 5} textAnchor="middle" fill="#9ca3af" fontSize="8" fontFamily="DM Sans" fontWeight="700" letterSpacing="1">{k}</text><text x={x} y={y + 9} textAnchor="middle" fill="#111827" fontSize="13" fontFamily="DM Sans" fontWeight="900">{stats[k]}</text></g>); })}
    </svg>
  );
}
