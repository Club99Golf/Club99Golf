export const FAKE_HISTORY = [
  { course: "Pebble Beach Golf Links", score: 83, tee: "white", holes: "18", roundOVR: 74, date: "2025-01-01" },
];
export const FAKE_ROUNDS = FAKE_HISTORY.map(r => r.roundOVR);

export const BLANK_PROFILE = {
  username: "", ovr: 50, experience: 0, level: 1, streak: 0,
  rounds: [], lastRoundDate: null, history: [],
  attrs: { PWR: 0, ACC: 0, CON: 0, REC: 0, EFF: 0 },
  ownedItems: [], equippedBanner: null, equippedBorder: null, equippedTitle: null,
  equippedNameplate: null,
  coinBoost: null, pinnedBadges: [], bag: [], coins: 0,
  courseShots: {}, crewId: null, crewName: null,
};

export const ACHIEVEMENTS = [
  { id: "first_round", label: "First Tee", desc: "Log your first round", check: p => p.history.length >= 1 },
  { id: "five_rounds", label: "Getting Warmed Up", desc: "Log 5 rounds", check: p => p.history.length >= 5 },
  { id: "ten_rounds", label: "Double Digits", desc: "Log 10 rounds", check: p => p.history.length >= 10 },
  { id: "25_rounds", label: "Regular", desc: "Log 25 rounds", check: p => p.history.length >= 25 },
  { id: "50_rounds", label: "Grinder", desc: "Log 50 rounds", check: p => p.history.length >= 50 },
  { id: "break_100", label: "Break 100", desc: "Shoot under 100", check: p => p.history.some(r => r.holes === "18" && r.score < 100) },
  { id: "break_90", label: "Break 90", desc: "Shoot under 90", check: p => p.history.some(r => r.holes === "18" && r.score < 90) },
  { id: "break_85", label: "Getting Serious", desc: "Shoot under 85", check: p => p.history.some(r => r.holes === "18" && r.score < 85) },
  { id: "break_80", label: "Break 80", desc: "Shoot under 80", check: p => p.history.some(r => r.holes === "18" && r.score < 80) },
  { id: "break_75", label: "Legit Player", desc: "Shoot under 75", check: p => p.history.some(r => r.holes === "18" && r.score < 75) },
  { id: "even_par", label: "Even Money", desc: "Shoot even par or better", check: p => p.history.some(r => r.holes === "18" && r.score <= (r.par || 72)) },
  { id: "ovr_70", label: "On The Map", desc: "Reach OVR 70", check: p => p.ovr >= 70 },
  { id: "ovr_80", label: "Single Digits", desc: "Reach OVR 80", check: p => p.ovr >= 80 },
  { id: "ovr_90", label: "Scratch Bound", desc: "Reach OVR 90", check: p => p.ovr >= 90 },
  { id: "level_5", label: "Level Up", desc: "Reach level 5", check: p => p.level >= 5 },
  { id: "level_10", label: "Dedicated", desc: "Reach level 10", check: p => p.level >= 10 },
  { id: "streak_3", label: "On A Roll", desc: "3-round streak", check: p => p.streak >= 3 },
  { id: "streak_5", label: "Hot Streak", desc: "5-round streak", check: p => p.streak >= 5 },
  { id: "five_courses", label: "Course Hopper", desc: "Play 5 different courses", check: p => new Set(p.history.map(r => r.course)).size >= 5 },
  { id: "ten_courses", label: "Explorer", desc: "Play 10 different courses", check: p => new Set(p.history.map(r => r.course)).size >= 10 },
];

export function getUnlockedBadges(profile) {
  return ACHIEVEMENTS.filter(a => a.check(profile));
}
