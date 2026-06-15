import { calcOVRFromRounds } from "./golfScoring";
import { levelFromXP } from "./xp";
export function sanitizeForFirestore(val) {
  if (val === undefined) return null;
  if (val === null || typeof val !== "object") return val;
  if (Array.isArray(val)) return val.map(sanitizeForFirestore);
  const out = {};
  for (const k of Object.keys(val)) out[k] = sanitizeForFirestore(val[k]);
  return out;
}

export function sanitizeBagDistances(bag = []) {
  return (bag || []).map(item => {
    const d = parseFloat(item.distance);
    if (!Number.isFinite(d) || d <= 0 || d > 500) {
      return { ...item, distance: "", trackedCount: 0 };
    }
    return item;
  });
}

export function repairProfile(p) {
  if (!p || !p.history) return p;

  // history is stored newest-first, but calcOVRFromRounds expects rounds oldest→newest
  // so the most recent round receives the strongest recency weight.
  const recentHistory = p.history.slice(0, 10);
  const roundOVRsNewestFirst = recentHistory
    .map(r => r.roundOVR)
    .filter(v => v != null && !isNaN(v));
  const roundOVRs = [...roundOVRsNewestFirst].reverse();

  // Users with 0 rounds get a clean slate: OVR 50, all attrs zeroed
  if (roundOVRs.length === 0) {
    return {
      ...p,
      bag: sanitizeBagDistances(p.bag || []),
      ovr: 50,
      rounds: [],
      attrs: { PWR: 0, ACC: 0, CON: 0, REC: 0, EFF: 0 },
      experience: 0,
      level: 1,
      coins: Math.max(0, p.coins || 0)
    };
  }

  const correctOVR = calcOVRFromRounds(roundOVRs);

  // Recompute cumulative attrs from history attrDeltas
  const correctedAttrs = { PWR: 0, ACC: 0, CON: 0, REC: 0, EFF: 0 };
  p.history.forEach(r => {
    if (r.attrDeltas) Object.keys(correctedAttrs).forEach(k => { correctedAttrs[k] += (r.attrDeltas[k] || 0); });
  });

  // Experience = total coins ever earned (drives level). Recompute from history.
  const correctExperience = p.history.reduce((sum, r) => sum + (r.coins || 0), 0);
  const correctLevel = levelFromXP(correctExperience);

  // Preserve actual coin balance — don't recalculate it
  return {
    ...p,
    bag: sanitizeBagDistances(p.bag || []),
    ovr: correctOVR,
    rounds: roundOVRs,
    experience: correctExperience,
    level: correctLevel,
    attrs: correctedAttrs
  };
}

// Runs on login — silently fixes own profile if OVR is wrong
