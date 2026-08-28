export const SHOP_ITEMS = [

  // ══════════════════════════════════════════════════
  // BANNERS
  // ══════════════════════════════════════════════════

  // ── Free Banners ──
  { id: "banner_fairway",     type: "banner", label: "Fairway Morning",    price: 400,   level: 1,  preview: "linear-gradient(135deg, #14532d 0%, #22c55e 60%)" },
  { id: "banner_links",       type: "banner", label: "Links Classic",      price: 600,   level: 4,  preview: "linear-gradient(135deg, #78716c 0%, #d6d3d1 60%)" },
  { id: "banner_dusk",        type: "banner", label: "Dusk Round",         price: 800,   level: 8,  preview: "linear-gradient(135deg, #7c2d12 0%, #c2410c 50%, #fbbf24 100%)" },
  { id: "banner_overcast",    type: "banner", label: "Overcast Round",     price: 800,   level: 10, preview: "linear-gradient(135deg, #374151 0%, #6b7280 60%, #9ca3af 100%)" },
  { id: "banner_camo",        type: "banner", label: "Course Camo",        price: 900,   level: 11, preview: "repeating-linear-gradient(45deg,#3d5a1e 0px,#3d5a1e 10px,#4a6b25 10px,#4a6b25 20px,#2d4418 20px,#2d4418 30px,#5a7a30 30px,#5a7a30 40px)" },
  { id: "banner_coastal",     type: "banner", label: "Coastal Pines",      price: 1000,  level: 15, preview: "linear-gradient(135deg, #0c4a6e 0%, #0369a1 40%, #7dd3fc 100%)" },
  { id: "banner_major",       type: "banner", label: "Major Ready",        price: 1200,  level: 21, preview: "linear-gradient(135deg, #0f172a 0%, #1e3a8a 50%, #fbbf24 100%)" },
  { id: "banner_plaid",       type: "banner", label: "Club Plaid",         price: 1000,  level: 23, preview: "repeating-linear-gradient(0deg,transparent,transparent 10px,rgba(239,68,68,0.3) 10px,rgba(239,68,68,0.3) 12px),repeating-linear-gradient(90deg,#1e3a5f,#1e3a5f 10px,#1a3354 10px,#1a3354 12px)" },
  { id: "banner_midnight",    type: "banner", label: "Night Round",        price: 1200,  level: 31, preview: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 60%)" },
  { id: "banner_crimson",     type: "banner", label: "Red Course",         price: 1400,  level: 35, preview: "linear-gradient(135deg, #450a0a 0%, #b91c1c 60%)" },
  { id: "banner_carbon",      type: "banner", label: "Carbon Driver",      price: 1500,  level: 39, preview: "repeating-linear-gradient(45deg,#1a1a1a 0px,#1a1a1a 4px,#2a2a2a 4px,#2a2a2a 8px)" },
  { id: "banner_purple",      type: "banner", label: "Augusta Dusk",       price: 1600,  level: 43, preview: "linear-gradient(135deg, #3b0764 0%, #7c3aed 60%)" },
  { id: "banner_iron",        type: "banner", label: "Iron Curtain",       price: 2000,  level: 55, preview: "linear-gradient(135deg, #111827 0%, #374151 50%, #6b7280 100%)" },

  // ── Free Seasonal ──
  { id: "banner_snow",        type: "banner", label: "Winter Course",      price: 1200,  level: 5,  preview: "linear-gradient(135deg,#e0f2fe 0%,#bae6fd 50%,#7dd3fc 100%)", seasonal: true, seasonLabel: "WINTER" },
  { id: "banner_harvest",     type: "banner", label: "Fall Classic",       price: 1200,  level: 5,  preview: "linear-gradient(135deg,#431407 0%,#9a3412 40%,#d97706 100%)", seasonal: true, seasonLabel: "FALL" },
  { id: "banner_july4",       type: "banner", label: "Stars & Stripes",    price: 1200,  level: 10, preview: "repeating-linear-gradient(180deg,#b91c1c 0px,#b91c1c 14px,#f9fafb 14px,#f9fafb 28px,#1e3a8a 28px,#1e3a8a 42px)", seasonal: true, seasonLabel: "4TH OF JULY" },
  { id: "banner_fireworks",   type: "banner", label: "Fireworks",          price: 1500,  level: 15, preview: "linear-gradient(135deg,#0f172a 0%,#1e3a8a 40%,#ef4444 70%,#fbbf24 100%)", animated: "pulse", seasonal: true, seasonLabel: "4TH OF JULY", tag: "ANIMATED" },
  { id: "banner_independence",type: "banner", label: "Independence Day",   price: 1800,  level: 20, preview: "linear-gradient(135deg,#1e3a8a 0%,#f9fafb 50%,#b91c1c 100%)", seasonal: true, seasonLabel: "4TH OF JULY" },

  // ── Basic Exclusive Banners ──
  { id: "banner_basic_coral",    type: "banner", label: "Coral Sunset",      price: 1200, level: 15, preview: "linear-gradient(135deg,#ff6b6b 0%,#feca57 60%,#ff9ff3 100%)", tier: "basic" },
  { id: "banner_basic_teal",     type: "banner", label: "Teal Links",        price: 1200, level: 18, preview: "linear-gradient(135deg,#0d7377 0%,#14a085 50%,#84fab0 100%)", tier: "basic" },
  { id: "banner_basic_lavender", type: "banner", label: "Lavender Rough",    price: 1300, level: 20, preview: "linear-gradient(135deg,#667eea 0%,#764ba2 60%)", tier: "basic" },
  { id: "banner_basic_slate",    type: "banner", label: "Slate Fairway",     price: 1300, level: 22, preview: "linear-gradient(135deg,#2c3e50 0%,#4ca1af 100%)", tier: "basic" },
  { id: "banner_basic_rose",     type: "banner", label: "Rose Garden",       price: 1400, level: 25, preview: "linear-gradient(135deg,#f953c6 0%,#b91d73 60%)", tier: "basic" },
  { id: "banner_basic_forest",   type: "banner", label: "Deep Forest",       price: 1400, level: 28, preview: "linear-gradient(135deg,#134e5e 0%,#71b280 100%)", tier: "basic" },
  { id: "banner_basic_checker",  type: "banner", label: "Checkered Flag",    price: 1500, level: 30, preview: "repeating-conic-gradient(#1e293b 0% 25%,#f1f5f9 0% 50%) 0 0/20px 20px", tier: "basic" },
  { id: "banner_basic_stripe_v", type: "banner", label: "Vertical Stripes",  price: 1500, level: 32, preview: "repeating-linear-gradient(90deg,#14532d 0px,#14532d 12px,#f9fafb 12px,#f9fafb 24px)", tier: "basic" },
  { id: "banner_basic_neon_p",   type: "banner", label: "Neon Pink",         price: 1600, level: 35, preview: "linear-gradient(135deg,#0f0c29 0%,#302b63 50%,#24243e 100%)", tier: "basic", tag: "ANIMATED", animated: "pulse" },
  { id: "banner_basic_copper",   type: "banner", label: "Copper Driver",     price: 1700, level: 38, preview: "linear-gradient(135deg,#b5541c 0%,#e07b39 40%,#f0a500 100%)", tier: "basic" },

  // ── Pro Exclusive Banners ──
  { id: "banner_pro_galaxy",     type: "banner", label: "Galaxy",           price: 2000, level: 30, preview: "linear-gradient(135deg,#0f0c29 0%,#302b63 40%,#24243e 70%,#7c3aed 100%)", tier: "pro", animated: "aurora", tag: "ANIMATED" },
  { id: "banner_pro_plasma",     type: "banner", label: "Plasma",           price: 2200, level: 35, preview: "linear-gradient(135deg,#f953c6 0%,#b91d73 30%,#7c3aed 70%,#3b82f6 100%)", tier: "pro", animated: "aurora", tag: "ANIMATED" },
  { id: "banner_pro_holographic",type: "banner", label: "Holographic",      price: 2500, level: 40, preview: "linear-gradient(135deg,#a78bfa 0%,#6ee7b7 25%,#fbbf24 50%,#f87171 75%,#818cf8 100%)", tier: "pro", animated: "shimmer", tag: "ANIMATED" },
  { id: "banner_pro_carbon_gold",type: "banner", label: "Carbon Gold",      price: 2500, level: 42, preview: "repeating-linear-gradient(45deg,#111 0px,#111 4px,#222 4px,#222 8px)", tier: "pro" },
  { id: "banner_pro_midnight_oil",type:"banner", label: "Midnight Oil",     price: 2800, level: 45, preview: "linear-gradient(135deg,#0a0a0a 0%,#1a1a2e 40%,#16213e 70%,#0f3460 100%)", tier: "pro", animated: "aurora", tag: "ANIMATED" },
  { id: "banner_pro_lava",       type: "banner", label: "Lava Flow",        price: 3000, level: 50, preview: "linear-gradient(135deg,#0f0c29 0%,#cc2b5e 50%,#753a88 100%)", tier: "pro", animated: "pulse", tag: "ANIMATED" },
  { id: "banner_pro_diamond",    type: "banner", label: "Diamond Course",   price: 3500, level: 55, preview: "linear-gradient(135deg,#e0eafc 0%,#cfdef3 50%,#ffffff 100%)", tier: "pro", animated: "shimmer", tag: "ANIMATED" },
  { id: "banner_pro_matrix",     type: "banner", label: "Matrix",           price: 3500, level: 60, preview: "linear-gradient(135deg,#000000 0%,#0d2b0d 50%,#00ff41 100%)", tier: "pro", animated: "pulse", tag: "ANIMATED" },
  { id: "banner_neon",           type: "banner", label: "Neon Fairway",     price: 1800, level: 47, preview: "linear-gradient(135deg, #0f172a 0%, #312e81 50%, #0c4a6e 100%)", animated: "pulse", tag: "ANIMATED" },
  { id: "banner_shimmer",        type: "banner", label: "Trophy Gold",      price: 2500, level: 58, preview: "linear-gradient(90deg,#451a03,#b45309,#fbbf24,#f59e0b,#b45309,#451a03)", animated: "shimmer" },
  { id: "banner_aurora",         type: "banner", label: "Aurora Pines",     price: 3000, level: 65, preview: "linear-gradient(-45deg,#0c4a6e,#3b0764,#052e16,#0f172a,#164e63)", animated: "aurora" },
  { id: "banner_masters",        type: "banner", label: "The Masters",      price: 4000, level: 75, preview: "linear-gradient(135deg, #052e16 0%, #14532d 30%, #fbbf24 70%, #052e16 100%)", animated: "shimmer", tier: "pro" },
  { id: "banner_goat",           type: "banner", label: "G.O.A.T.",         price: 9999, level: 99, preview: "linear-gradient(90deg,#7c3aed,#3b82f6,#22c55e,#f59e0b,#ef4444,#7c3aed)", animated: "aurora", tag: "LEGENDARY", tier: "pro" },

  // ══════════════════════════════════════════════════
  // BORDERS
  // ══════════════════════════════════════════════════

  // ── Free Borders ──
  { id: "border_basic",       type: "border", label: "Starter Ring",    price: 200,  level: 1,  preview: "#6b7280", style: { border: "3px solid #6b7280" } },
  { id: "border_sand",        type: "border", label: "Sand Wash",       price: 350,  level: 2,  preview: "#d97706", style: { border: "3px dashed #d97706" } },
  { id: "border_dashed",      type: "border", label: "Dashed Green",    price: 500,  level: 3,  preview: "#22c55e", style: { border: "3px dashed #22c55e" } },
  { id: "border_gold",        type: "border", label: "Gold Ring",       price: 700,  level: 7,  preview: "#f59e0b", style: { border: "3px solid #f59e0b", boxShadow: "0 0 14px rgba(245,158,11,0.5)" } },
  { id: "border_silver",      type: "border", label: "Silver Club",     price: 650,  level: 9,  preview: "#94a3b8", style: { border: "3px solid #94a3b8", boxShadow: "0 0 10px rgba(148,163,184,0.4)" } },
  { id: "border_cobalt",      type: "border", label: "Water Hazard",    price: 900,  level: 15, preview: "#3b82f6", style: { border: "3px solid #3b82f6", boxShadow: "0 0 14px rgba(59,130,246,0.5)" } },
  { id: "border_purple",      type: "border", label: "Twilight",        price: 800,  level: 13, preview: "#a855f7", style: { border: "3px solid #a855f7", boxShadow: "0 0 14px rgba(168,85,247,0.5)" } },
  { id: "border_neon_green",  type: "border", label: "Neon Green",      price: 1000, level: 18, preview: "#4ade80", style: { border: "3px solid #4ade80", boxShadow: "0 0 20px rgba(74,222,128,0.8)" } },
  { id: "border_crimson",     type: "border", label: "Sunday Red",      price: 1100, level: 21, preview: "#ef4444", style: { border: "3px solid #ef4444", boxShadow: "0 0 14px rgba(239,68,68,0.5)" } },
  { id: "border_moss",        type: "border", label: "Mossy Oak",       price: 1250, level: 28, preview: "#365314", style: { border: "3px double #365314", boxShadow: "0 0 10px rgba(54,83,20,0.4)" } },
  { id: "border_ice",         type: "border", label: "Frost",           price: 1300, level: 32, preview: "#67e8f9", style: { border: "3px solid #67e8f9", boxShadow: "0 0 14px rgba(103,232,249,0.5)" } },
  { id: "border_ace",         type: "border", label: "Hole In One",     price: 1300, level: 17, preview: "#f9fafb", style: { border: "3px solid #f9fafb", boxShadow: "0 0 0 2px #f59e0b, 0 0 20px rgba(255,255,255,0.6)" } },
  { id: "border_tour",        type: "border", label: "Tour Pro",        price: 1600, level: 26, preview: "#0f172a", style: { border: "3px solid #1e293b", outline: "2px solid #fbbf24", outlineOffset: "3px", boxShadow: "0 0 14px rgba(251,191,36,0.5)" } },

  // ── Free Seasonal Borders ──
  { id: "border_july4",       type: "border", label: "Patriot",         price: 900,  level: 10, preview: "#ef4444", style: { border: "3px solid #ef4444", outline: "2px solid #1e3a8a", outlineOffset: "2px", boxShadow: "0 0 14px rgba(239,68,68,0.5)" }, seasonal: true, seasonLabel: "4TH OF JULY" },

  // ── Basic Exclusive Borders ──
  { id: "border_basic_coral",   type: "border", label: "Coral",          price: 800,  level: 12, preview: "#ff6b6b", style: { border: "3px solid #ff6b6b", boxShadow: "0 0 14px rgba(255,107,107,0.6)" }, tier: "basic" },
  { id: "border_basic_teal",    type: "border", label: "Deep Teal",      price: 900,  level: 15, preview: "#0d7377", style: { border: "3px solid #0d7377", boxShadow: "0 0 14px rgba(13,115,119,0.6)" }, tier: "basic" },
  { id: "border_basic_rose",    type: "border", label: "Rose Gold",      price: 1000, level: 18, preview: "#f953c6", style: { border: "3px solid #f953c6", boxShadow: "0 0 14px rgba(249,83,198,0.6)" }, tier: "basic" },
  { id: "border_basic_mint",    type: "border", label: "Mint",           price: 900,  level: 14, preview: "#6ee7b7", style: { border: "3px solid #6ee7b7", boxShadow: "0 0 14px rgba(110,231,183,0.6)" }, tier: "basic" },
  { id: "border_basic_lavender",type: "border", label: "Lavender",       price: 950,  level: 16, preview: "#a78bfa", style: { border: "3px solid #a78bfa", boxShadow: "0 0 14px rgba(167,139,250,0.6)" }, tier: "basic" },
  { id: "border_basic_amber",   type: "border", label: "Amber Glow",     price: 1000, level: 20, preview: "#f59e0b", style: { border: "3px solid #f59e0b", outline: "2px solid #fbbf24", outlineOffset: "3px", boxShadow: "0 0 18px rgba(245,158,11,0.7)" }, tier: "basic" },
  { id: "border_basic_dbl_grn", type: "border", label: "Double Green",   price: 1100, level: 22, preview: "#22c55e", style: { border: "3px solid #22c55e", outline: "2px solid #4ade80", outlineOffset: "3px", boxShadow: "0 0 14px rgba(34,197,94,0.5)" }, tier: "basic" },
  { id: "border_basic_sunset",  type: "border", label: "Sunset",         price: 1200, level: 25, preview: "#f97316", style: { border: "3px solid #f97316", outline: "2px solid #fbbf24", outlineOffset: "2px", boxShadow: "0 0 16px rgba(249,115,22,0.6)" }, tier: "basic" },
  { id: "border_fireworks",     type: "border", label: "Fireworks Ring",  price: 1400, level: 18, preview: "#fbbf24", style: { border: "3px solid transparent", background: "linear-gradient(#1f2937,#1f2937) padding-box, linear-gradient(135deg,#ef4444,#f9fafb,#1e3a8a,#ef4444) border-box", boxShadow: "0 0 18px rgba(251,191,36,0.6)" }, animated: "spin", seasonal: true, seasonLabel: "4TH OF JULY", tag: "ANIMATED", tier: "basic" },

  // ── Pro Exclusive Borders ──
  { id: "border_pro_galaxy",    type: "border", label: "Galaxy Ring",    price: 1800, level: 35, preview: "#7c3aed", style: { border: "3px solid transparent", background: "linear-gradient(#0f0c29,#0f0c29) padding-box, linear-gradient(135deg,#7c3aed,#3b82f6,#22c55e,#f59e0b,#ef4444,#7c3aed) border-box", boxShadow: "0 0 20px rgba(124,58,237,0.8)" }, animated: "spin", tag: "ANIMATED", tier: "pro" },
  { id: "border_pro_plasma",    type: "border", label: "Plasma",         price: 2000, level: 40, preview: "#f953c6", style: { border: "3px solid transparent", background: "linear-gradient(#0f0c29,#0f0c29) padding-box, linear-gradient(135deg,#f953c6,#b91d73,#7c3aed,#3b82f6) border-box", boxShadow: "0 0 24px rgba(249,83,198,0.8)" }, animated: "spin", tag: "ANIMATED", tier: "pro" },
  { id: "border_pro_gold_glow", type: "border", label: "Championship",   price: 2200, level: 45, preview: "#fbbf24", style: { border: "4px solid #fbbf24", outline: "2px solid #f59e0b", outlineOffset: "3px", boxShadow: "0 0 0 6px rgba(251,191,36,0.15), 0 0 30px rgba(251,191,36,0.6)" }, animated: "pulse", tag: "ANIMATED", tier: "pro" },
  { id: "border_pro_hologram",  type: "border", label: "Hologram",       price: 2500, level: 50, preview: "#a78bfa", style: { border: "3px solid transparent", background: "linear-gradient(#111,#111) padding-box, linear-gradient(90deg,#a78bfa,#6ee7b7,#fbbf24,#f87171,#818cf8) border-box", boxShadow: "0 0 28px rgba(167,139,250,0.7)" }, animated: "shimmer", tag: "ANIMATED", tier: "pro" },
  { id: "border_rainbow",       type: "border", label: "Rainbow Spin",   price: 3500, level: 68, preview: "conic", style: { border: "3px solid transparent", background: "linear-gradient(#1f2937,#1f2937) padding-box, conic-gradient(red,orange,yellow,green,blue,violet,red) border-box", boxShadow: "0 0 16px rgba(255,255,255,0.3)" }, animated: "spin", tier: "pro" },
  { id: "border_diamond",       type: "border", label: "Diamond Pin",    price: 5000, level: 82, preview: "#e0f2fe", style: { border: "3px solid #e0f2fe", outline: "2px solid #bae6fd", outlineOffset: "3px", boxShadow: "0 0 0 5px rgba(186,230,253,0.2), 0 0 24px rgba(255,255,255,0.5)" }, animated: "pulse", tier: "pro" },
  { id: "border_masters",       type: "border", label: "Augusta Green",  price: 9999, level: 99, preview: "#22c55e", style: { border: "4px solid #22c55e", boxShadow: "0 0 0 2px #fbbf24, 0 0 20px rgba(34,197,94,0.8)" }, tag: "LEGENDARY", tier: "pro" },

  // ══════════════════════════════════════════════════
  // NAMEPLATES
  // ══════════════════════════════════════════════════

  // ── Free Nameplates ──
  { id: "nameplate_basic",    type: "nameplate", label: "Clean White",   price: 200,  level: 1,  style: { color: "#f9fafb" } },
  { id: "nameplate_sand",     type: "nameplate", label: "Sand Text",     price: 300,  level: 3,  style: { color: "#d97706" } },
  { id: "nameplate_shadow",   type: "nameplate", label: "Drop Shadow",   price: 500,  level: 5,  style: { textShadow: "2px 2px 8px rgba(0,0,0,0.9)" } },
  { id: "nameplate_cobalt",   type: "nameplate", label: "Cobalt Blue",   price: 600,  level: 10, style: { color: "#60a5fa", textShadow: "0 0 10px rgba(96,165,250,0.6)" } },
  { id: "nameplate_stroke",   type: "nameplate", label: "Stroke Play",   price: 700,  level: 12, style: { color: "#f9fafb", textShadow: "0 0 0 1px #111, 1px 1px 0 #111, -1px -1px 0 #111, 1px -1px 0 #111, -1px 1px 0 #111" } },
  { id: "nameplate_glow",     type: "nameplate", label: "Green Glow",    price: 800,  level: 16, style: { textShadow: "0 0 10px rgba(34,197,94,0.9),0 0 30px rgba(34,197,94,0.5)" } },
  { id: "nameplate_crimson",  type: "nameplate", label: "Sunday Red",    price: 900,  level: 20, style: { color: "#f87171", textShadow: "0 0 10px rgba(248,113,113,0.7)" } },
  { id: "nameplate_bronze",   type: "nameplate", label: "Bronze Medal",  price: 1000, level: 27, style: { background: "linear-gradient(180deg,#d97706 0%,#92400e 50%,#d97706 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" } },
  { id: "nameplate_chrome",   type: "nameplate", label: "Chrome",        price: 1200, level: 29, style: { background: "linear-gradient(180deg,#fff 0%,#94a3b8 50%,#fff 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" } },
  { id: "nameplate_gold",     type: "nameplate", label: "Gold Text",     price: 2500, level: 71, style: { color: "#fbbf24", textShadow: "0 0 10px rgba(251,191,36,0.6)" } },

  // ── Free Seasonal Nameplates ──
  { id: "nameplate_july4",    type: "nameplate", label: "American Spirit", price: 1000, level: 12, style: { background: "linear-gradient(90deg,#ef4444,#f9fafb,#1e3a8a)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }, seasonal: true, seasonLabel: "4TH OF JULY" },

  // ── Basic Exclusive Nameplates ──
  { id: "nameplate_basic_coral",    type: "nameplate", label: "Coral",        price: 700,  level: 12, style: { color: "#ff6b6b", textShadow: "0 0 10px rgba(255,107,107,0.7)" }, tier: "basic" },
  { id: "nameplate_basic_teal",     type: "nameplate", label: "Deep Teal",    price: 750,  level: 14, style: { color: "#0d7377", textShadow: "0 0 10px rgba(13,115,119,0.7)" }, tier: "basic" },
  { id: "nameplate_basic_mint",     type: "nameplate", label: "Mint",         price: 800,  level: 16, style: { color: "#6ee7b7", textShadow: "0 0 10px rgba(110,231,183,0.7)" }, tier: "basic" },
  { id: "nameplate_basic_lavender", type: "nameplate", label: "Lavender",     price: 800,  level: 18, style: { color: "#a78bfa", textShadow: "0 0 10px rgba(167,139,250,0.7)" }, tier: "basic" },
  { id: "nameplate_basic_rose",     type: "nameplate", label: "Rose",         price: 900,  level: 20, style: { color: "#fb7185", textShadow: "0 0 10px rgba(251,113,133,0.7)" }, tier: "basic" },
  { id: "nameplate_basic_sunset",   type: "nameplate", label: "Sunset",       price: 1000, level: 24, style: { background: "linear-gradient(90deg,#f97316,#fbbf24,#ef4444)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }, tier: "basic" },
  { id: "nameplate_basic_ocean",    type: "nameplate", label: "Ocean",        price: 1000, level: 26, style: { background: "linear-gradient(90deg,#0369a1,#0ea5e9,#67e8f9)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }, tier: "basic" },
  { id: "nameplate_basic_forest",   type: "nameplate", label: "Forest",       price: 1100, level: 28, style: { background: "linear-gradient(90deg,#14532d,#22c55e,#86efac)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }, tier: "basic" },
  { id: "nameplate_neon",           type: "nameplate", label: "Neon Fairway", price: 1500, level: 44, style: { color: "#4ade80", textShadow: "0 0 8px rgba(74,222,128,0.9), 0 0 30px rgba(74,222,128,0.5)" }, tier: "basic" },
  { id: "nameplate_fire",           type: "nameplate", label: "Fire Text",    price: 1500, level: 44, style: { background: "linear-gradient(180deg,#fbbf24 0%,#ef4444 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }, tier: "basic" },
  { id: "nameplate_fireworks",      type: "nameplate", label: "Fireworks",    price: 1400, level: 20, style: { background: "linear-gradient(90deg,#ef4444,#fbbf24,#f9fafb,#1e3a8a,#ef4444)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", textShadow: "none" }, seasonal: true, seasonLabel: "4TH OF JULY", tag: "ANIMATED", tier: "basic" },

  // ── Pro Exclusive Nameplates ──
  { id: "nameplate_pro_galaxy",    type: "nameplate", label: "Galaxy",       price: 2000, level: 40, style: { background: "linear-gradient(90deg,#7c3aed,#3b82f6,#06b6d4,#7c3aed)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }, tier: "pro" },
  { id: "nameplate_pro_plasma",    type: "nameplate", label: "Plasma",       price: 2200, level: 45, style: { background: "linear-gradient(90deg,#f953c6,#b91d73,#7c3aed,#3b82f6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }, tier: "pro" },
  { id: "nameplate_pro_holo",      type: "nameplate", label: "Holographic",  price: 2500, level: 50, style: { background: "linear-gradient(90deg,#a78bfa,#6ee7b7,#fbbf24,#f87171,#818cf8)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }, tier: "pro" },
  { id: "nameplate_purple",        type: "nameplate", label: "Purple Rain",  price: 1600, level: 50, style: { background: "linear-gradient(180deg,#c084fc 0%,#7c3aed 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }, tier: "pro" },
  { id: "nameplate_rainbow",       type: "nameplate", label: "Rainbow",      price: 2200, level: 62, style: { background: "linear-gradient(90deg,#22c55e,#3b82f6,#a855f7,#f59e0b,#ef4444)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }, tier: "pro" },
  { id: "nameplate_obsidian",      type: "nameplate", label: "Obsidian",     price: 3500, level: 80, style: { background: "linear-gradient(180deg,#475569 0%,#0f172a 60%,#334155 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }, tier: "pro" },
  { id: "nameplate_platinum",      type: "nameplate", label: "Platinum",     price: 5500, level: 88, style: { background: "linear-gradient(90deg,#cbd5e1,#fff,#94a3b8,#fff,#cbd5e1)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", textShadow: "none" }, tier: "pro" },
  { id: "nameplate_legend",        type: "nameplate", label: "Legend",       price: 9999, level: 99, style: { background: "linear-gradient(90deg,#fbbf24,#f59e0b,#fff,#f59e0b,#fbbf24)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", textShadow: "none" }, tag: "LEGENDARY", tier: "pro" },

  // ══════════════════════════════════════════════════
  // COIN BOOSTS
  // ══════════════════════════════════════════════════
  { id: "boost_2x_1",  type: "boost", label: "2× Coin Boost", price: 200,  multiplier: 2, rounds: 1,  desc: "Double your coins for your next round" },
  { id: "boost_5x_1",  type: "boost", label: "5× Coin Boost", price: 500,  multiplier: 5, rounds: 1,  desc: "5× coins for your next round — make it count" },
  { id: "boost_2x_3",  type: "boost", label: "2× Coin Boost", price: 600,  multiplier: 2, rounds: 3,  desc: "Double your coins for your next 3 rounds" },
  { id: "boost_2x_5",  type: "boost", label: "2× Coin Boost", price: 900,  multiplier: 2, rounds: 5,  desc: "Double your coins for your next 5 rounds" },
  { id: "boost_3x_3",  type: "boost", label: "3× Coin Boost", price: 1200, multiplier: 3, rounds: 3,  desc: "Triple your coins for your next 3 rounds" },
];
