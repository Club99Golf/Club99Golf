export const MAPBOX_TOKEN = process.env.REACT_APP_MAPBOX_TOKEN || "";
export const OWM_API_KEY = process.env.REACT_APP_OWM_API_KEY || "";

export const IS_CAPACITOR_WRAPPER = typeof window !== "undefined" && !!window.Capacitor;
export const DISABLE_STRIPE_PURCHASES = IS_CAPACITOR_WRAPPER;

export const STRIPE_PK = "pk_live_51TWhShRJ9CQrTS8psr510iWuwXjKkAPObrgUDUqPWGyC6M3WlbxXZBi7BOqvaNoyymf7PfK10Ck1oDWC88doKo0n00AI7y9CZh";

export const COIN_PACKS = [
  { id: "starter", coins: 500, price: 0.99, label: "Starter" },
  { id: "value", coins: 1500, price: 2.99, label: "Value", tag: "POPULAR" },
  { id: "pro", coins: 4000, price: 4.99, label: "Pro", tag: "BEST VALUE" },
  { id: "elite", coins: 10000, price: 9.99, label: "Elite" },
];

export const CLUB_ACCENT = "#000000";
export const ELEVATION_OFFSET = 0;
export const LOFT_DEGREE_RE = /^\d+°$/;

export const COURSE_MAP_CENTERS = {
  "Northern Bay Resort (Castle Course)": { lat: 43.8928, lng: -89.7896 },
  "Kiawah Island (Ocean Course)": { lat: 32.613026, lng: -80.019651 },
  "Pebble Beach Golf Links": { lat: 36.5689, lng: -121.9506 },
};
export const CHALLENGE_FORMATS = [
  { id: "stroke",     label: "Stroke Play",  desc: "Lowest total score wins",      minPlayers: 2, maxPlayers: 8, hasTeams: false, autoSettle: true  },
  { id: "match_play", label: "Match Play",   desc: "Hole-by-hole, most holes won", minPlayers: 2, maxPlayers: 2, hasTeams: false, autoSettle: false },
  { id: "scramble",   label: "Scramble",     desc: "Teams · Best shot each hole",  minPlayers: 4, maxPlayers: 8, hasTeams: true,  autoSettle: false },
  { id: "best_ball",  label: "Best Ball",    desc: "Teams · Best score per hole",  minPlayers: 4, maxPlayers: 8, hasTeams: true,  autoSettle: false },
  { id: "skins",      label: "Skins",        desc: "Win holes, carry ties over",   minPlayers: 2, maxPlayers: 8, hasTeams: false, autoSettle: false },
  // Legacy IDs for existing Firestore docs
  { id: "stroke_1v1",   label: "1v1 Stroke Play", desc: "Lowest total score wins",           minPlayers: 2, maxPlayers: 2, hasTeams: false, autoSettle: true  },
  { id: "scramble_2v2", label: "2v2 Scramble",    desc: "Teams of 2 · Best shot each hole", minPlayers: 4, maxPlayers: 4, hasTeams: true,  autoSettle: false },
  { id: "group",        label: "Group Round",      desc: "Open group · Lowest score wins",   minPlayers: 2, maxPlayers: 8, hasTeams: false, autoSettle: true  },
];
