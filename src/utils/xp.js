export function xpForLevel(level) {
  if (level <= 1) return 0;
  return Math.floor(200 * Math.pow(1.18, level - 2));
}

export function totalXPForLevel(level) {
  let total = 0;
  for (let i = 2; i <= level; i++) total += xpForLevel(i);
  return total;
}

export function levelFromXP(xp) {
  let level = 1;
  while (totalXPForLevel(level + 1) <= xp) level++;
  return Math.min(level, 50);
}

export function xpIntoCurrentLevel(xp) {
  const level = levelFromXP(xp);
  return xp - totalXPForLevel(level);
}

export function xpNeededForNextLevel(xp) {
  const level = levelFromXP(xp);
  return xpForLevel(level + 1);
}

export function computeStats(ovr, attrs) {
  const b = Math.min(99, Math.max(40, ovr));
  const base = {
    PWR: Math.min(99, Math.round(b * 0.97 + 2)),
    ACC: Math.min(99, Math.round(b * 1.03 - 1)),
    CON: Math.min(99, Math.round(b * 1.08 - 3)),
    REC: Math.min(99, Math.round(b * 0.99 + 1)),
    EFF: Math.min(99, Math.round(b * 0.98 + 2)),
  };
  if (!attrs) return base;
  return {
    PWR: Math.min(99, Math.max(40, base.PWR + (attrs.PWR || 0))),
    ACC: Math.min(99, Math.max(40, base.ACC + (attrs.ACC || 0))),
    CON: Math.min(99, Math.max(40, base.CON + (attrs.CON || 0))),
    REC: Math.min(99, Math.max(40, base.REC + (attrs.REC || 0))),
    EFF: Math.min(99, Math.max(40, base.EFF + (attrs.EFF || 0))),
  };
}
