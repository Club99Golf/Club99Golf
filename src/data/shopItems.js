export const SHOP_ITEMS = [
  // ── BANNERS ──
  { id: "banner_fairway",   type: "banner", label: "Fairway Morning",  price: 400,   level: 1,  preview: "linear-gradient(135deg, #14532d 0%, #22c55e 60%)" },
  { id: "banner_links",     type: "banner", label: "Links Classic",    price: 600,   level: 4,  preview: "linear-gradient(135deg, #78716c 0%, #d6d3d1 60%)" },
  { id: "banner_dusk",      type: "banner", label: "Dusk Round",       price: 800,   level: 8,  preview: "linear-gradient(135deg, #7c2d12 0%, #c2410c 50%, #fbbf24 100%)" },
  { id: "banner_camo",      type: "banner", label: "Course Camo",      price: 900,   level: 11, preview: "repeating-linear-gradient(45deg,#3d5a1e 0px,#3d5a1e 10px,#4a6b25 10px,#4a6b25 20px,#2d4418 20px,#2d4418 30px,#5a7a30 30px,#5a7a30 40px)" },
  { id: "banner_coastal",   type: "banner", label: "Coastal Pines",    price: 1000,  level: 15, preview: "linear-gradient(135deg, #0c4a6e 0%, #0369a1 40%, #7dd3fc 100%)" },
  { id: "banner_plaid",     type: "banner", label: "Club Plaid",       price: 1000,  level: 23, preview: "repeating-linear-gradient(0deg,transparent,transparent 10px,rgba(239,68,68,0.3) 10px,rgba(239,68,68,0.3) 12px),repeating-linear-gradient(90deg,#1e3a5f,#1e3a5f 10px,#1a3354 10px,#1a3354 12px)" },
  { id: "banner_midnight",  type: "banner", label: "Night Round",      price: 1200,  level: 31, preview: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 60%)" },
  { id: "banner_crimson",   type: "banner", label: "Red Course",       price: 1400,  level: 35, preview: "linear-gradient(135deg, #450a0a 0%, #b91c1c 60%)" },
  { id: "banner_carbon",    type: "banner", label: "Carbon Driver",    price: 1500,  level: 39, preview: "repeating-linear-gradient(45deg,#1a1a1a 0px,#1a1a1a 4px,#2a2a2a 4px,#2a2a2a 8px)" },
  { id: "banner_purple",    type: "banner", label: "Augusta Dusk",     price: 1600,  level: 43, preview: "linear-gradient(135deg, #3b0764 0%, #7c3aed 60%)" },
  { id: "banner_neon",      type: "banner", label: "Neon Fairway",     price: 1800,  level: 47, preview: "linear-gradient(135deg, #0f172a 0%, #312e81 50%, #0c4a6e 100%)", animated: "pulse", tag: "ANIMATED" },
  { id: "banner_shimmer",   type: "banner", label: "Trophy Gold",      price: 2500,  level: 58, preview: "linear-gradient(90deg,#451a03,#b45309,#fbbf24,#f59e0b,#b45309,#451a03)", animated: "shimmer" },
  { id: "banner_aurora",    type: "banner", label: "Aurora Pines",     price: 3000,  level: 65, preview: "linear-gradient(-45deg,#0c4a6e,#3b0764,#052e16,#0f172a,#164e63)", animated: "aurora" },
  { id: "banner_masters",   type: "banner", label: "The Masters",      price: 4000,  level: 75, preview: "linear-gradient(135deg, #052e16 0%, #14532d 30%, #fbbf24 70%, #052e16 100%)", animated: "shimmer" },
  { id: "banner_goat",      type: "banner", label: "G.O.A.T.",         price: 9999,  level: 99, preview: "linear-gradient(90deg,#7c3aed,#3b82f6,#22c55e,#f59e0b,#ef4444,#7c3aed)", animated: "aurora", tag: "LEGENDARY" },
  { id: "banner_snow",      type: "banner", label: "Winter Course",    price: 1200,  level: 5,  preview: "linear-gradient(135deg,#e0f2fe 0%,#bae6fd 50%,#7dd3fc 100%)", seasonal: true, seasonLabel: "WINTER" },
  { id: "banner_harvest",   type: "banner", label: "Fall Classic",     price: 1200,  level: 5,  preview: "linear-gradient(135deg,#431407 0%,#9a3412 40%,#d97706 100%)", seasonal: true, seasonLabel: "FALL" },
  { id: "banner_overcast",  type: "banner", label: "Overcast Round",   price: 800,   level: 10, preview: "linear-gradient(135deg,#374151 0%,#6b7280 60%,#9ca3af 100%)" },
  { id: "banner_major",     type: "banner", label: "Major Ready",      price: 1200,  level: 21, preview: "linear-gradient(135deg,#0f172a 0%,#1e3a8a 50%,#fbbf24 100%)" },
  { id: "banner_iron",      type: "banner", label: "Iron Curtain",     price: 2000,  level: 55, preview: "linear-gradient(135deg,#111827 0%,#374151 50%,#6b7280 100%)" },

  // ── 4TH OF JULY BANNERS ──
  { id: "banner_july4",        type: "banner", label: "Stars & Stripes",   price: 1200, level: 10, preview: "repeating-linear-gradient(180deg,#b91c1c 0px,#b91c1c 14px,#f9fafb 14px,#f9fafb 28px,#1e3a8a 28px,#1e3a8a 42px)", seasonal: true, seasonLabel: "4TH OF JULY" },
  { id: "banner_fireworks",    type: "banner", label: "Fireworks",         price: 1500, level: 15, preview: "linear-gradient(135deg,#0f172a 0%,#1e3a8a 40%,#ef4444 70%,#fbbf24 100%)", animated: "pulse", seasonal: true, seasonLabel: "4TH OF JULY", tag: "ANIMATED" },
  { id: "banner_independence", type: "banner", label: "Independence Day",  price: 1800, level: 20, preview: "linear-gradient(135deg,#1e3a8a 0%,#f9fafb 50%,#b91c1c 100%)", seasonal: true, seasonLabel: "4TH OF JULY" },

  // ── AVATAR BORDERS ──
  { id: "border_basic",       type: "border", label: "Starter Ring",   price: 200,   level: 1,  preview: "#6b7280", style: { border: "3px solid #6b7280" } },
  { id: "border_sand",        type: "border", label: "Sand Wash",      price: 350,   level: 2,  preview: "#d97706", style: { border: "3px dashed #d97706" } },
  { id: "border_dashed",      type: "border", label: "Dashed Green",   price: 500,   level: 3,  preview: "#22c55e", style: { border: "3px dashed #22c55e" } },
  { id: "border_gold",        type: "border", label: "Gold Ring",      price: 700,   level: 7,  preview: "#f59e0b", style: { border: "3px solid #f59e0b", boxShadow: "0 0 14px rgba(245,158,11,0.5)" } },
  { id: "border_silver",      type: "border", label: "Silver Club",    price: 650,   level: 9,  preview: "#94a3b8", style: { border: "3px solid #94a3b8", boxShadow: "0 0 10px rgba(148,163,184,0.4)" } },
  { id: "border_cobalt",      type: "border", label: "Water Hazard",   price: 900,   level: 15, preview: "#3b82f6", style: { border: "3px solid #3b82f6", boxShadow: "0 0 14px rgba(59,130,246,0.5)" } },
  { id: "border_purple",      type: "border", label: "Twilight",       price: 800,   level: 13, preview: "#a855f7", style: { border: "3px solid #a855f7", boxShadow: "0 0 14px rgba(168,85,247,0.5)" } },
  { id: "border_neon_green",  type: "border", label: "Neon Green",     price: 1000,  level: 18, preview: "#4ade80", style: { border: "3px solid #4ade80", boxShadow: "0 0 20px rgba(74,222,128,0.8)" } },
  { id: "border_crimson",     type: "border", label: "Sunday Red",     price: 1100,  level: 21, preview: "#ef4444", style: { border: "3px solid #ef4444", boxShadow: "0 0 14px rgba(239,68,68,0.5)" } },
  { id: "border_moss",        type: "border", label: "Mossy Oak",      price: 1250,  level: 28, preview: "#365314", style: { border: "3px double #365314", boxShadow: "0 0 10px rgba(54,83,20,0.4)" } },
  { id: "border_ice",         type: "border", label: "Frost",          price: 1300,  level: 32, preview: "#67e8f9", style: { border: "3px solid #67e8f9", boxShadow: "0 0 14px rgba(103,232,249,0.5)" } },
  { id: "border_ace",         type: "border", label: "Hole In One",    price: 1300,  level: 17, preview: "#f9fafb", style: { border: "3px solid #f9fafb", boxShadow: "0 0 0 2px #f59e0b, 0 0 20px rgba(255,255,255,0.6)" } },
  { id: "border_tour",        type: "border", label: "Tour Pro",       price: 1600,  level: 26, preview: "#0f172a", style: { border: "3px solid #1e293b", outline: "2px solid #fbbf24", outlineOffset: "3px", boxShadow: "0 0 14px rgba(251,191,36,0.5)" } },
  { id: "border_rainbow",     type: "border", label: "Rainbow Spin",   price: 3500,  level: 68, preview: "conic",   style: { border: "3px solid transparent", background: "linear-gradient(#1f2937,#1f2937) padding-box, conic-gradient(red,orange,yellow,green,blue,violet,red) border-box", boxShadow: "0 0 16px rgba(255,255,255,0.3)" }, animated: "spin" },
  { id: "border_diamond",     type: "border", label: "Diamond Pin",    price: 5000,  level: 82, preview: "#e0f2fe", style: { border: "3px solid #e0f2fe", outline: "2px solid #bae6fd", outlineOffset: "3px", boxShadow: "0 0 0 5px rgba(186,230,253,0.2), 0 0 24px rgba(255,255,255,0.5)" }, animated: "pulse" },
  { id: "border_masters",     type: "border", label: "Augusta Green",  price: 9999,  level: 99, preview: "#22c55e", style: { border: "4px solid #22c55e", boxShadow: "0 0 0 2px #fbbf24, 0 0 20px rgba(34,197,94,0.8)" }, tag: "LEGENDARY" },

  // ── 4TH OF JULY BORDERS ──
  { id: "border_july4",     type: "border", label: "Patriot",        price: 900,  level: 10, preview: "#ef4444", style: { border: "3px solid #ef4444", outline: "2px solid #1e3a8a", outlineOffset: "2px", boxShadow: "0 0 14px rgba(239,68,68,0.5)" }, seasonal: true, seasonLabel: "4TH OF JULY" },
  { id: "border_fireworks", type: "border", label: "Fireworks Ring", price: 1400, level: 18, preview: "#fbbf24", style: { border: "3px solid transparent", background: "linear-gradient(#1f2937,#1f2937) padding-box, linear-gradient(135deg,#ef4444,#f9fafb,#1e3a8a,#ef4444) border-box", boxShadow: "0 0 18px rgba(251,191,36,0.6)" }, animated: "spin", seasonal: true, seasonLabel: "4TH OF JULY", tag: "ANIMATED" },

  // ── NAMEPLATES ──
  { id: "nameplate_basic",    type: "nameplate", label: "Clean White",    price: 200,   level: 1,  style: { color: "#f9fafb" } },
  { id: "nameplate_sand",     type: "nameplate", label: "Sand Text",      price: 300,   level: 3,  style: { color: "#d97706" } },
  { id: "nameplate_shadow",   type: "nameplate", label: "Drop Shadow",    price: 500,   level: 5,  style: { textShadow: "2px 2px 8px rgba(0,0,0,0.9)" } },
  { id: "nameplate_cobalt",   type: "nameplate", label: "Cobalt Blue",    price: 600,   level: 10, style: { color: "#60a5fa", textShadow: "0 0 10px rgba(96,165,250,0.6)" } },
  { id: "nameplate_stroke",   type: "nameplate", label: "Stroke Play",    price: 700,   level: 12, style: { color: "#f9fafb", textShadow: "0 0 0 1px #111, 1px 1px 0 #111, -1px -1px 0 #111, 1px -1px 0 #111, -1px 1px 0 #111" } },
  { id: "nameplate_glow",     type: "nameplate", label: "Green Glow",     price: 800,   level: 16, style: { textShadow: "0 0 10px rgba(34,197,94,0.9),0 0 30px rgba(34,197,94,0.5)" } },
  { id: "nameplate_crimson",  type: "nameplate", label: "Sunday Red",     price: 900,   level: 20, style: { color: "#f87171", textShadow: "0 0 10px rgba(248,113,113,0.7)" } },
  { id: "nameplate_bronze",   type: "nameplate", label: "Bronze Medal",   price: 1000,  level: 27, style: { background: "linear-gradient(180deg,#d97706 0%,#92400e 50%,#d97706 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" } },
  { id: "nameplate_chrome",   type: "nameplate", label: "Chrome",         price: 1200,  level: 29, style: { background: "linear-gradient(180deg,#fff 0%,#94a3b8 50%,#fff 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" } },
  { id: "nameplate_neon",     type: "nameplate", label: "Neon Fairway",   price: 1500,  level: 44, style: { color: "#4ade80", textShadow: "0 0 8px rgba(74,222,128,0.9), 0 0 30px rgba(74,222,128,0.5)" } },
  { id: "nameplate_fire",     type: "nameplate", label: "Fire Text",      price: 1500,  level: 44, style: { background: "linear-gradient(180deg,#fbbf24 0%,#ef4444 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" } },
  { id: "nameplate_purple",   type: "nameplate", label: "Purple Rain",    price: 1600,  level: 50, style: { background: "linear-gradient(180deg,#c084fc 0%,#7c3aed 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" } },
  { id: "nameplate_rainbow",  type: "nameplate", label: "Rainbow",        price: 2200,  level: 62, style: { background: "linear-gradient(90deg,#22c55e,#3b82f6,#a855f7,#f59e0b,#ef4444)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" } },
  { id: "nameplate_gold",     type: "nameplate", label: "Gold Text",      price: 2500,  level: 71, style: { color: "#fbbf24", textShadow: "0 0 10px rgba(251,191,36,0.6)" } },
  { id: "nameplate_obsidian", type: "nameplate", label: "Obsidian",       price: 3500,  level: 80, style: { background: "linear-gradient(180deg,#475569 0%,#0f172a 60%,#334155 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" } },
  { id: "nameplate_platinum", type: "nameplate", label: "Platinum",       price: 5500,  level: 88, style: { background: "linear-gradient(90deg,#cbd5e1,#fff,#94a3b8,#fff,#cbd5e1)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", textShadow: "none" } },
  { id: "nameplate_legend",   type: "nameplate", label: "Legend",         price: 9999,  level: 99, style: { background: "linear-gradient(90deg,#fbbf24,#f59e0b,#fff,#f59e0b,#fbbf24)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", textShadow: "none" }, tag: "LEGENDARY" },

  // ── 4TH OF JULY NAMEPLATES ──
  { id: "nameplate_july4",     type: "nameplate", label: "American Spirit", price: 1000, level: 12, style: { background: "linear-gradient(90deg,#ef4444,#f9fafb,#1e3a8a)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }, seasonal: true, seasonLabel: "4TH OF JULY" },
  { id: "nameplate_fireworks", type: "nameplate", label: "Fireworks",       price: 1400, level: 20, style: { background: "linear-gradient(90deg,#ef4444,#fbbf24,#f9fafb,#1e3a8a,#ef4444)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", textShadow: "none" }, seasonal: true, seasonLabel: "4TH OF JULY", tag: "ANIMATED" },

  // ── COIN BOOSTS ──
  { id: "boost_2x_1",  type: "boost", label: "2× Coin Boost", price: 200,  multiplier: 2, rounds: 1,  desc: "Double your coins for your next round" },
  { id: "boost_5x_1",  type: "boost", label: "5× Coin Boost", price: 500,  multiplier: 5, rounds: 1,  desc: "5× coins for your next round — make it count" },
  { id: "boost_2x_3",  type: "boost", label: "2× Coin Boost", price: 600,  multiplier: 2, rounds: 3,  desc: "Double your coins for your next 3 rounds" },
  { id: "boost_2x_5",  type: "boost", label: "2× Coin Boost", price: 900,  multiplier: 2, rounds: 5,  desc: "Double your coins for your next 5 rounds" },
  { id: "boost_3x_3",  type: "boost", label: "3× Coin Boost", price: 1200, multiplier: 3, rounds: 3,  desc: "Triple your coins for your next 3 rounds" },
].sort((a, b) => (a.level || 0) - (b.level || 0))
 .map(item => {
   if (item.level == null) return item;
   if (item.tag === "LEGENDARY") return { ...item, price: 99999 };
   const computed = Math.round((500 + item.level * item.level * 8) / 500) * 500;
   return { ...item, price: computed };
 });
