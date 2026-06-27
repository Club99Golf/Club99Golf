import { getCourseData } from "./golfScoring";

export function calcHandicapIndex(history) {
  const rounds18 = (history || []).filter(r => r.holes === "18");
  if (rounds18.length === 0) return null;
  const recent = rounds18.slice(0, 20); // cap at 20
  const diffs = recent.map(r => {
    const cd = getCourseData(r.course, r.tee);
    const rating = cd?.rating ?? 72.0;
    const slope  = cd?.slope  ?? 113;
    return (r.score - rating) * (113 / slope);
  });
  const n = diffs.length;
  const numBest =
    n <= 5  ? 1 :
    n <= 8  ? 2 :
    n <= 11 ? 3 :
    n <= 13 ? 4 :
    n <= 15 ? 5 :
    n <= 17 ? 6 :
    n === 18 ? 7 : 8;
  const best = [...diffs].sort((a, b) => a - b).slice(0, numBest);
  const avg  = best.reduce((s, v) => s + v, 0) / best.length;
  return Math.round(avg * 10) / 10; // e.g. 14.3 (can be negative for scratch)
}
