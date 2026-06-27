export default function OVRTrendChart({ history, accent = "#7DA27E" }) {
  if (!history || history.length < 2) return null;
  const data = [...history].reverse().slice(-12);
  const ovrs = data.map(r => r.ovrAfter);
  const minV = Math.max(40, Math.min(...ovrs) - 3);
  const maxV = Math.min(99, Math.max(...ovrs) + 3);
  const w = 320, h = 90, padL = 28, padR = 8, padT = 8, padB = 20;
  const W = w - padL - padR, H = h - padT - padB;
  const x = i => padL + (i / (data.length - 1)) * W;
  const y = v => padT + H - ((v - minV) / (maxV - minV)) * H;
  const pathD = ovrs.map((v, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(v)}`).join(" ");
  const areaD = pathD + ` L${x(ovrs.length-1)},${padT+H} L${x(0)},${padT+H} Z`;
  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} style={{ display: "block" }}>
      {[minV, Math.round((minV+maxV)/2), maxV].map(v => (
        <g key={v}><line x1={padL} y1={y(v)} x2={w-padR} y2={y(v)} stroke="rgba(0,0,0,0.06)" strokeWidth="1" /><text x={padL-4} y={y(v)+4} fontSize="9" fill="#bbb" textAnchor="end">{v}</text></g>
      ))}
      <defs><linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={accent} stopOpacity="0.18" /><stop offset="100%" stopColor={accent} stopOpacity="0" /></linearGradient></defs>
      <path d={areaD} fill="url(#trendGrad)" />
      <path d={pathD} fill="none" stroke={accent} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {ovrs.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r="3" fill={accent} />)}
      {data.map((r, i) => { if (data.length <= 6 || i % 2 === 0) { const d = new Date(r.date); return <text key={i} x={x(i)} y={h-4} fontSize="8" fill="#bbb" textAnchor="middle">{`${d.getMonth()+1}/${d.getDate()}`}</text>; } return null; })}
    </svg>
  );
}
