import { COURSE_DB } from "../data/courses";
import { DEFAULT_BAG } from "../data/defaultBag";
import { ELEVATION_OFFSET, LOFT_DEGREE_RE } from "../config/constants";

export function getCourseData(courseName, teeColor) {
  const c = COURSE_DB[courseName];
  if (!c) return null;
  const tee = c.tees[teeColor] || Object.values(c.tees)[0];
  if (!tee || tee.rating === null || tee.slope === null) return null;
  return { rating: tee.rating, slope: tee.slope, par: c.par, holePars: c.holePars || null };
}

export function getCourseHolePars(courseName, holes) {
  const c = COURSE_DB[courseName];
  if (!c || !c.holePars) return null;
  if (holes === "9") return c.holePars.slice(0, 9);
  return c.holePars;
}

export function calcRoundOVR(score, courseData, holes = 18) {
  if (!courseData) return 75;
  const adjScore = holes === 9 ? score * 2 : score;
  // Normalize difficulty: slope 113 = standard. Higher slope gives more credit for same score.
  const adjustedDiff = (adjScore - courseData.rating) * (113 / courseData.slope);
  // Even par (diff=0) → 90. Each stroke under par = +2.25 OVR. Each stroke over = -1.43 OVR.
  // Anchors: diff=-4 → 99, diff=+28 → ~50
  const raw = adjustedDiff <= 0
    ? 90 + (-adjustedDiff) * 2.25
    : 90 - adjustedDiff * 1.43;
  return Math.min(99, Math.max(40, Math.round(raw)));
}

export function calcOVRFromRounds(rounds) {
  if (!rounds || rounds.length === 0) return 50;
  const recent = rounds.slice(-10);
  // Exponential recency weights: most recent round = weight 1.0, each prior decays by 0.85
  const decay = 0.85;
  const weights = recent.map((_, i) => Math.pow(decay, recent.length - 1 - i));
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const weightedAvg = recent.reduce((sum, ovr, i) => sum + ovr * weights[i], 0) / totalWeight;
  return Math.min(99, Math.max(40, Math.round(weightedAvg)));
}

// WHS 2026 Handicap Index — uses the best N score differentials from the last 20 rounds.
// Score Differential = (Gross Score − Course Rating) × (113 / Slope Rating)
// Best-of lookup table follows the official WHS specification.

export function skillTier(ovr) {
  if (ovr >= 95) return { label: "SCRATCH",    sub: "Has no excuse to miss",          color: "#e2e8f0", bg: "rgba(226,232,240,0.15)", border: "rgba(226,232,240,0.4)", rank: 7 };
  if (ovr >= 88) return { label: "CHAMPION",   sub: "Playing at another level",        color: "#f87171", bg: "rgba(239,68,68,0.12)",   border: "rgba(239,68,68,0.45)",   rank: 6 };
  if (ovr >= 80) return { label: "ALBATROSS",  sub: "Rare and dangerous",              color: "#a78bfa", bg: "rgba(139,92,246,0.12)",  border: "rgba(139,92,246,0.45)",  rank: 5 };
  if (ovr >= 72) return { label: "EAGLE",      sub: "Better than most will ever be",   color: "#22d3ee", bg: "rgba(6,182,212,0.12)",   border: "rgba(6,182,212,0.45)",   rank: 4 };
  if (ovr >= 64) return { label: "BIRDIE",     sub: "Knows their way around a course", color: "#fbbf24", bg: "rgba(251,191,36,0.12)",  border: "rgba(251,191,36,0.45)",  rank: 3 };
  if (ovr >= 55) return { label: "PAR HUNTER", sub: "Getting there",                   color: "#94a3b8", bg: "rgba(148,163,184,0.12)", border: "rgba(148,163,184,0.4)",  rank: 2 };
  return         {         label: "BOGEY",      sub: "Finding every hazard",            color: "#cd7f32", bg: "rgba(205,127,50,0.12)",  border: "rgba(205,127,50,0.4)",   rank: 1 };
}

// Haversine formula — returns straight-line distance in yards between two GPS points

export function suggestClub(adjustedTarget, bagItems, pwr) {
  if (adjustedTarget == null || adjustedTarget <= 0) return null;
  const target = adjustedTarget - ELEVATION_OFFSET;
  const usable = (bagItems && bagItems.filter(b => b.club && parseFloat(b.distance) > 0).length > 0)
    ? bagItems.filter(b => b.club && parseFloat(b.distance) > 0)
    : DEFAULT_BAG;
  if (usable.length === 0) return null;

  // Under 100 yards: search loft-degree clubs first; only fall back to generics if none exist
  const searchPool = (target < 100)
    ? (() => {
        const loftClubs = usable.filter(b => LOFT_DEGREE_RE.test(b.club));
        return loftClubs.length > 0 ? loftClubs : usable;
      })()
    : usable;

  let best = null;
  let bestDiff = Infinity;
  for (const club of searchPool) {
    const d = parseFloat(club.distance);
    const diff = Math.abs(d - target);
    if (diff < bestDiff) {
      best = club;
      bestDiff = diff;
    } else if (diff === bestDiff && best) {
      // 2K Logic: exact tie → shorter club if PWR > 75, longer club otherwise
      const bDist = parseFloat(best.distance);
      if (pwr > 75 ? d < bDist : d > bDist) best = club;
    }
  }
  return best;
}

// Smart Club Selection — returns { primary, secondary, hasBag }
// primary: best club for the target. secondary: adjacent club if target falls in the gap (≤5y over / ≤8y under).
// If the user has no clubs in their bag, hasBag is false and DEFAULT_BAG is used silently.

export function getRecommendedClub(targetYards, bagItems) {
  if (!targetYards || targetYards <= 0) return { primary: null, secondary: null, hasBag: false };
  const userItems = (bagItems || []).filter(b => b.club && parseFloat(b.distance) > 0);
  const hasBag = userItems.length > 0;
  const pool = hasBag ? userItems : DEFAULT_BAG;
  // Sort longest → shortest
  const sorted = [...pool].sort((a, b) => parseFloat(b.distance) - parseFloat(a.distance));
  // Primary: first club whose stock distance doesn't exceed target by more than 5y
  let pri = null, priIdx = sorted.length - 1;
  for (let i = 0; i < sorted.length; i++) {
    if (parseFloat(sorted[i].distance) <= targetYards + 5) { pri = sorted[i]; priIdx = i; break; }
  }
  if (!pri) { pri = sorted[sorted.length - 1]; priIdx = sorted.length - 1; }
  // Secondary: the club one step longer — shown only when target sits in the gap between them
  let sec = null;
  if (priIdx > 0) {
    const above = sorted[priIdx - 1];
    const aboveDist = parseFloat(above.distance);
    const priDist   = parseFloat(pri.distance);
    if (aboveDist - targetYards <= 5 && targetYards - priDist <= 8) sec = above;
  }
  return { primary: pri, secondary: sec, hasBag };
}
