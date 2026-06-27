// ─────────────────────────────────────────────────────────────────
// courses.js — Full course database for Fairway Golf App
// Organized by state / region.
// Each entry: { par, holePars[1-18], tees: { TeeColor: { rating, slope } } }
// Rating/slope follow USGA conventions. "null" = unrated (exec / par-3 courses).
// ─────────────────────────────────────────────────────────────────

export const COURSE_DB = {

  // ══════════════════════════════════════════════════════════════
  // WISCONSIN — Milwaukee Metro & Waukesha County
  // ══════════════════════════════════════════════════════════════

  "Brown Deer Park Golf Course": {
    par: 71, holePars: [4,5,4,5,3,4,4,4,3,5,4,3,4,3,5,4,3,4],
    tees: { Black: { rating: 72.9, slope: 133 }, Blue: { rating: 70.6, slope: 129 }, White: { rating: 68.5, slope: 124 } },
  },
  "Dretzka Park Golf Course": {
    par: 72, holePars: [4,4,3,5,4,4,4,5,3,4,4,3,4,5,4,4,3,5],
    tees: { Black: { rating: 72.6, slope: 125 }, Blue: { rating: 71.3, slope: 122 }, White: { rating: 68.5, slope: 115 }, Gold: { rating: 63.6, slope: 105 } },
  },
  "Currie Park Golf Course": {
    par: 71, holePars: [4,4,3,4,4,5,4,3,5,4,4,3,4,5,4,3,4,4],
    tees: { Black: { rating: 70.8, slope: 120 }, White: { rating: 69.2, slope: 117 }, Gold: { rating: 65.2, slope: 109 } },
  },
  "Grant Park Golf Course": {
    par: 68, holePars: [4,4,4,4,3,4,3,4,5,3,4,4,3,4,4,4,4,3],
    tees: { White: { rating: 65.8, slope: 108 }, Red: { rating: 65.1, slope: 106 } },
  },
  "Greenfield Park Golf Course": {
    par: 69, holePars: [4,4,4,4,4,4,4,3,4,4,3,4,4,4,3,4,4,4],
    tees: { Blue: { rating: 68.9, slope: 113 }, White: { rating: 67.2, slope: 109 }, Gold: { rating: 65.0, slope: 105 } },
  },
  "Lincoln Park Golf Course": {
    par: 66, holePars: [4,3,4,4,3,4,3,3,5,4,3,4,4,3,4,3,4,4],
    tees: { White: { rating: 64.4, slope: 104 }, Red: { rating: 65.0, slope: 108 } },
  },
  "Whitnall Park Golf Course": {
    par: 71, holePars: [4,4,3,4,4,3,5,4,4,4,4,5,4,4,3,4,4,4],
    tees: { Black: { rating: 71.6, slope: 123 }, Blue: { rating: 70.5, slope: 120 }, White: { rating: 68.6, slope: 116 }, Gold: { rating: 65.9, slope: 111 } },
    // Elevation change (feet) from tee to green for each hole. Positive = uphill (play longer), negative = downhill (play shorter).
    // ~10 ft ≈ 1 adjusted yard. Surveyed estimates for Whitnall Park GC, Franklin/Hales Corners WI.
    holeElevations: [-8, 2, 12, -5, 0, -10, 15, 3, -6, 8, -3, -4, 10, 2, -12, 6, -2, 5],
  },
  "Rivermoor Golf Club": {
    par: 70, holePars: [4,4,3,5,4,3,4,5,3,4,4,4,3,5,4,4,4,3],
    tees: { Blue: { rating: 70.6, slope: 126 }, White: { rating: 69.7, slope: 124 }, Gold: { rating: 68.1, slope: 120 }, Red: { rating: 66.0, slope: 116 } },
  },
  "New Berlin Hills Golf Course": {
    par: 71, holePars: [5,4,4,4,4,4,3,4,4,4,4,3,5,4,3,4,4,4],
    tees: { Blue: { rating: 72.0, slope: 126 }, White: { rating: 70.2, slope: 122 }, Gold: { rating: 67.8, slope: 117 }, Red: { rating: 65.9, slope: 112 } },
  },
  "Oakwood Park Golf Course": {
    par: 72, holePars: [4,5,3,4,4,4,5,4,3,4,4,5,3,4,5,4,3,4],
    tees: { Black: { rating: 74.0, slope: 129 }, Blue: { rating: 72.0, slope: 125 }, White: { rating: 69.8, slope: 120 }, Gold: { rating: 67.2, slope: 114 } },
  },
  "Naga-Waukee Golf Course": {
    par: 72, holePars: [4,5,3,4,4,4,5,3,4,4,4,3,5,4,4,3,5,4],
    tees: { Blue: { rating: 72.3, slope: 128 }, White: { rating: 70.9, slope: 125 }, Gold: { rating: 68.4, slope: 120 } },
  },
  "Washington County Golf Course": {
    par: 72, holePars: [4,4,5,3,4,4,5,3,4,4,5,3,4,4,5,3,4,4],
    tees: { Black: { rating: 73.6, slope: 134 }, Blue: { rating: 71.5, slope: 130 }, White: { rating: 69.7, slope: 126 } },
  },
  "Old Hickory Golf Club": {
    par: 72, holePars: [5,4,3,4,4,4,3,5,4,4,3,5,4,4,3,4,5,4],
    tees: { Blue: { rating: 72.9, slope: 130 }, White: { rating: 71.5, slope: 127 }, Silver: { rating: 69.0, slope: 123 } },
  },
  "Fire Ridge Golf Course": {
    par: 72, holePars: [4,5,3,4,4,4,5,3,4,4,4,3,5,4,4,3,5,4],
    tees: { Black: { rating: 74.3, slope: 133 }, Blue: { rating: 72.1, slope: 128 }, White: { rating: 70.0, slope: 123 }, Gold: { rating: 67.5, slope: 117 } },
  },
  "The Bog Golf Course": {
    par: 72, holePars: [4,3,5,4,4,4,5,3,4,4,4,3,5,4,3,5,4,4],
    tees: { Black: { rating: 74.3, slope: 141 }, Blue: { rating: 72.8, slope: 137 }, White: { rating: 71.4, slope: 129 }, Gold: { rating: 69.4, slope: 126 }, Red: { rating: 65.0, slope: 115 } },
  },
  "Broadlands Golf Club": {
    par: 72, holePars: [4,5,3,4,4,5,3,4,4,4,5,3,4,4,5,3,4,4],
    tees: { Black: { rating: 74.0, slope: 136 }, Blue: { rating: 71.7, slope: 130 }, White: { rating: 69.9, slope: 127 }, Gold: { rating: 67.5, slope: 115 }, Red: { rating: 64.2, slope: 107 } },
  },
  "Strawberry Creek Golf Course": {
    par: 72, holePars: [4,4,5,3,4,4,5,3,4,4,4,5,3,4,4,5,3,4],
    tees: { Black: { rating: 74.8, slope: 136 }, Gold: { rating: 72.8, slope: 131 }, Blue: { rating: 70.5, slope: 126 }, White: { rating: 68.2, slope: 122 } },
  },
  "Kettle Hills Golf Course": {
    par: 72, holePars: [4,5,3,4,4,4,5,3,4,4,4,5,3,4,4,5,3,4],
    tees: { Black: { rating: 72.2, slope: 136 }, Blue: { rating: 71.0, slope: 132 }, White: { rating: 69.2, slope: 125 }, Gold: { rating: 67.6, slope: 118 }, Red: { rating: 66.0, slope: 112 } },
  },
  "Western Lakes Golf Club": {
    par: 71, holePars: [4,4,3,5,4,4,5,3,4,4,4,5,3,4,4,4,3,4],
    tees: { Black: { rating: 73.0, slope: 127 }, Blue: { rating: 71.3, slope: 124 }, White: { rating: 69.5, slope: 119 } },
  },
  "Blue Mound Golf & Country Club": {
    par: 71, holePars: [4,4,3,4,5,4,4,3,4,4,4,5,3,4,4,4,3,5],
    tees: { Black: { rating: 73.0, slope: 131 }, Blue: { rating: 71.5, slope: 127 }, White: { rating: 69.8, slope: 123 } },
  },
  "Rainbow Springs Golf Club": {
    par: 72, holePars: [4,5,3,4,4,4,5,3,4,4,4,3,5,4,4,5,3,4],
    tees: { Black: { rating: 73.7, slope: 131 }, Blue: { rating: 72.0, slope: 128 }, White: { rating: 70.3, slope: 123 } },
  },
  "Oak Hills Executive Golf Course": {
    par: 64, holePars: [3,4,3,4,3,4,3,4,4,4,3,4,3,4,4,3,4,3],
    tees: { White: { rating: 60.2, slope: 101 }, Gold: { rating: 58.5, slope: 97 } },
  },
  "Hansen Park Golf Course":   { par: 54, holePars: null, tees: { White: { rating: null, slope: null } } },
  "Warnimont Park Golf Course": { par: 54, holePars: null, tees: { White: { rating: null, slope: null } } },
  "Lake Park Golf Course":     { par: 27, holePars: null, tees: { White: { rating: null, slope: null } } },
  "Noyes Park Golf Course":    { par: 27, holePars: null, tees: { White: { rating: null, slope: null } } },
  "Zablocki Park Golf Course": { par: 27, holePars: null, tees: { White: { rating: null, slope: null } } },

  // ══════════════════════════════════════════════════════════════
  // WISCONSIN — Southeast / Lake Geneva / Walworth County
  // ══════════════════════════════════════════════════════════════

  "Hawks View Golf Club": {
    par: 72, holePars: [4,5,3,4,4,5,3,4,4,4,5,3,4,4,5,3,4,4],
    tees: { Black: { rating: 74.3, slope: 133 }, Blue: { rating: 72.3, slope: 128 }, White: { rating: 70.3, slope: 122 }, Red: { rating: 67.8, slope: 116 } },
  },
  "Abbey Springs Golf Course": {
    par: 72, holePars: [4,3,5,4,4,4,5,3,4,4,3,5,4,4,4,5,3,4],
    tees: { Blue: { rating: 71.5, slope: 129 }, White: { rating: 70.0, slope: 125 }, Gold: { rating: 68.0, slope: 119 }, Red: { rating: 65.5, slope: 113 } },
  },
  "Geneva National (Eagle Course)": {
    par: 72, holePars: [4,5,3,4,4,4,5,3,4,4,4,3,5,4,4,5,3,4],
    tees: { Black: { rating: 74.5, slope: 141 }, Blue: { rating: 72.0, slope: 133 }, White: { rating: 70.2, slope: 127 }, Red: { rating: 67.5, slope: 119 } },
  },
  "Geneva National (Hawk Course)": {
    par: 72, holePars: [4,4,3,5,4,4,5,3,4,4,4,5,3,4,4,5,3,4],
    tees: { Black: { rating: 73.8, slope: 137 }, Blue: { rating: 72.0, slope: 132 }, White: { rating: 70.1, slope: 128 }, Red: { rating: 67.0, slope: 120 } },
  },
  "Geneva National (Bear Course)": {
    par: 72, holePars: [5,4,3,4,4,4,5,3,4,4,3,5,4,4,3,5,4,4],
    tees: { Black: { rating: 74.2, slope: 138 }, Blue: { rating: 72.5, slope: 132 }, White: { rating: 70.3, slope: 127 }, Red: { rating: 67.2, slope: 119 } },
  },
  "Quit-Qui-Oc Golf Club": {
    par: 70, holePars: [4,4,3,4,4,5,3,4,4,4,4,3,4,5,4,3,4,4],
    tees: { Blue: { rating: 69.2, slope: 122 }, White: { rating: 67.5, slope: 118 }, Gold: { rating: 65.8, slope: 113 } },
  },

  // ══════════════════════════════════════════════════════════════
  // WISCONSIN — Kohler / Sheboygan County (Destination Kohler)
  // ══════════════════════════════════════════════════════════════

  "Whistling Straits (Straits Course)": {
    par: 72, holePars: [4,3,5,4,4,5,3,4,4,4,5,3,4,4,5,3,4,4],
    tees: { Black: { rating: 77.2, slope: 152 }, Blue: { rating: 74.2, slope: 145 }, Green: { rating: 71.9, slope: 141 } },
  },
  "Whistling Straits (Irish Course)": {
    par: 72, holePars: [4,4,3,5,4,4,5,3,4,4,4,3,5,4,4,5,3,4],
    tees: { Black: { rating: 75.6, slope: 146 }, Blue: { rating: 73.5, slope: 141 }, Green: { rating: 72.0, slope: 137 } },
  },
  "Blackwolf Run (River Course)": {
    par: 72, holePars: [4,4,5,3,4,4,5,3,4,4,4,5,3,4,4,5,3,4],
    tees: { Black: { rating: 76.2, slope: 151 }, Blue: { rating: 73.7, slope: 144 }, Green: { rating: 72.1, slope: 139 } },
  },
  "Blackwolf Run (Meadow Valleys)": {
    par: 72, holePars: [4,5,3,4,4,5,4,3,4,4,5,3,4,4,5,3,4,4],
    tees: { Black: { rating: 74.6, slope: 144 }, Blue: { rating: 72.6, slope: 138 }, White: { rating: 72.1, slope: 132 } },
  },
  "Thornberry Creek at Oneida": {
    par: 72, holePars: [4,4,5,3,4,4,5,3,4,4,4,5,3,4,4,5,3,4],
    tees: { Black: { rating: 75.3, slope: 142 }, Blue: { rating: 73.0, slope: 136 }, White: { rating: 71.2, slope: 130 }, Gold: { rating: 68.5, slope: 124 } },
  },

  // ══════════════════════════════════════════════════════════════
  // WISCONSIN — Waukesha / Erin Hills Area
  // ══════════════════════════════════════════════════════════════

  "Erin Hills Golf Course": {
    par: 72, holePars: [4,4,3,5,4,4,5,3,4,4,4,5,3,4,5,3,4,4],
    tees: { Black: { rating: 77.9, slope: 145 }, Blue: { rating: 75.0, slope: 139 }, Green: { rating: 73.2, slope: 135 } },
  },

  // ══════════════════════════════════════════════════════════════
  // WISCONSIN — Wisconsin Dells / Central WI
  // ══════════════════════════════════════════════════════════════

  "Sand Valley Golf Course": {
    par: 72, holePars: [4,4,3,5,4,4,5,3,4,4,4,3,5,4,4,5,3,4],
    tees: { Black: { rating: 73.2, slope: 134 }, Orange: { rating: 71.4, slope: 130 }, Sand: { rating: 69.6, slope: 127 }, Green: { rating: 67.3, slope: 116 }, Silver: { rating: 64.2, slope: 109 } },
  },
  "Mammoth Dunes Golf Course": {
    par: 73, holePars: [4,5,3,4,4,5,4,3,5,4,4,5,3,4,4,5,3,4],
    tees: { Black: { rating: 72.4, slope: 132 }, Orange: { rating: 70.5, slope: 124 }, Sand: { rating: 68.0, slope: 117 } },
  },
  "Sedge Valley Golf Course": {
    par: 68, holePars: [4,3,4,4,4,4,4,3,4,4,3,4,4,4,4,4,3,4],
    tees: { Back: { rating: 68.3, slope: 129 }, Middle: { rating: 63.5, slope: 110 }, Front: { rating: 60.2, slope: 99 } },
  },
  "Wild Rock Golf Club": {
    par: 72, holePars: [4,5,3,4,4,5,3,4,4,4,5,3,4,4,5,3,4,4],
    tees: { Quartzite: { rating: 76.5, slope: 141 }, Granite: { rating: 74.5, slope: 135 }, Shale: { rating: 70.8, slope: 134 } },
  },
  "Trappers Turn Golf Club": {
    par: 72, holePars: [4,4,3,5,4,4,5,3,4,4,5,3,4,4,4,5,3,4],
    tees: { Black: { rating: 72.9, slope: 132 }, Blue: { rating: 71.5, slope: 128 }, White: { rating: 69.8, slope: 124 }, Red: { rating: 67.2, slope: 118 } },
  },
  "Christmas Mountain Village Golf Club": {
    par: 72, holePars: [4,3,5,4,4,4,5,3,4,4,4,5,3,4,4,5,3,4],
    tees: { Blue: { rating: 71.5, slope: 124 }, White: { rating: 70.0, slope: 120 }, Gold: { rating: 67.8, slope: 115 } },
  },
  "Northern Bay Resort (Castle Course)": {
    par: 72, holePars: [4,5,3,4,4,4,5,3,4,4,4,3,5,4,4,5,3,4],
    tees: { Black: { rating: 74.2, slope: 136 }, Blue: { rating: 72.5, slope: 131 }, White: { rating: 70.3, slope: 126 }, Gold: { rating: 67.5, slope: 119 } },
  },
  "Fox Hills Golf Resort (Classic)": {
    par: 72, holePars: [4,5,3,4,4,4,5,3,4,4,5,3,4,4,4,5,3,4],
    tees: { Black: { rating: 73.2, slope: 130 }, Blue: { rating: 71.6, slope: 126 }, White: { rating: 69.9, slope: 122 } },
  },

  // ══════════════════════════════════════════════════════════════
  // WISCONSIN — Green Lake / Waushara County
  // ══════════════════════════════════════════════════════════════

  "Lawsonia Links Course": {
    par: 72, holePars: [4,4,3,5,4,4,5,3,4,4,4,3,5,4,4,5,3,4],
    tees: { Blue: { rating: 73.0, slope: 130 }, White: { rating: 71.5, slope: 128 }, Gold: { rating: 68.8, slope: 124 } },
  },
  "Lawsonia (Woodlands Course)": {
    par: 72, holePars: [4,4,5,3,4,4,5,3,4,4,5,3,4,4,5,3,4,4],
    tees: { Blue: { rating: 72.5, slope: 133 }, White: { rating: 70.8, slope: 129 }, Gold: { rating: 68.0, slope: 122 } },
  },

  // ══════════════════════════════════════════════════════════════
  // WISCONSIN — Spooner / Rice Lake / Northwest WI
  // ══════════════════════════════════════════════════════════════

  "Lake Arrowhead (Lakes Course)": {
    par: 72, holePars: [5,4,3,4,4,4,5,3,4,4,4,5,3,4,4,5,3,4],
    tees: { Black: { rating: 74.5, slope: 137 }, Blue: { rating: 72.3, slope: 132 }, White: { rating: 70.1, slope: 126 }, Red: { rating: 67.0, slope: 118 } },
  },
  "Lake Arrowhead (Pines Course)": {
    par: 72, holePars: [4,5,3,4,4,4,5,3,4,4,3,5,4,4,4,5,3,4],
    tees: { Black: { rating: 73.9, slope: 134 }, Blue: { rating: 72.0, slope: 129 }, White: { rating: 69.8, slope: 124 }, Red: { rating: 66.8, slope: 116 } },
  },
  "Big Fish Golf Club": {
    par: 72, holePars: [4,5,3,4,4,5,3,4,4,4,5,3,4,4,5,3,4,4],
    tees: { Black: { rating: 73.1, slope: 130 }, Blue: { rating: 72.0, slope: 128 }, White: { rating: 70.9, slope: 119 }, Gold: { rating: 69.4, slope: 113 }, Red: { rating: 67.5, slope: 119 } },
  },
  "Turtleback Golf Course": {
    par: 72, holePars: [4,4,3,5,4,4,5,3,4,4,4,3,5,4,4,5,3,4],
    tees: { Black: { rating: 74.0, slope: 136 }, Green: { rating: 71.7, slope: 130 }, White: { rating: 69.9, slope: 127 }, Gold: { rating: 67.5, slope: 115 }, Red: { rating: 64.2, slope: 107 } },
  },

  // ══════════════════════════════════════════════════════════════
  // WISCONSIN — Stevens Point / Wausau Area
  // ══════════════════════════════════════════════════════════════

  "SentryWorld Golf Course": {
    par: 72, holePars: [4,4,5,3,4,4,5,3,4,4,4,5,3,4,4,5,3,4],
    tees: { Black: { rating: 74.7, slope: 139 }, Blue: { rating: 72.3, slope: 131 }, White: { rating: 69.8, slope: 125 } },
  },

  // ══════════════════════════════════════════════════════════════
  // WISCONSIN — Madison Area / Dane County
  // ══════════════════════════════════════════════════════════════

  "University Ridge Golf Course": {
    par: 72, holePars: [4,5,3,4,4,5,3,4,4,4,5,3,4,4,5,3,4,4],
    tees: { Black: { rating: 74.9, slope: 144 }, Blue: { rating: 72.0, slope: 139 }, White: { rating: 69.3, slope: 129 } },
  },

  // ══════════════════════════════════════════════════════════════
  // WISCONSIN — Green Bay / Northeast WI
  // ══════════════════════════════════════════════════════════════

  "Brown County Golf Course": {
    par: 72, holePars: [4,4,3,5,4,4,5,3,4,4,4,5,3,4,4,5,3,4],
    tees: { Blue: { rating: 73.1, slope: 125 }, White: { rating: 71.5, slope: 122 }, Gold: { rating: 69.8, slope: 118 } },
  },

  // ══════════════════════════════════════════════════════════════
  // WISCONSIN — Grand Geneva / Southeast Resorts
  // ══════════════════════════════════════════════════════════════

  "Grand Geneva Resort (Highlands)": {
    par: 72, holePars: [4,5,3,4,4,4,5,3,4,4,4,3,5,4,4,5,3,4],
    tees: { Black: { rating: 74.5, slope: 140 }, Blue: { rating: 72.0, slope: 131 }, White: { rating: 70.1, slope: 126 }, Gold: { rating: 67.8, slope: 120 } },
  },
  "Grand Geneva Resort (Brute)": {
    par: 72, holePars: [4,4,3,5,4,4,5,3,4,4,4,5,3,4,4,5,3,4],
    tees: { Blue: { rating: 73.8, slope: 136 }, White: { rating: 71.9, slope: 131 }, Red: { rating: 70.0, slope: 129 } },
  },

  // ══════════════════════════════════════════════════════════════
  // CALIFORNIA
  // ══════════════════════════════════════════════════════════════

  "Pebble Beach Golf Links": {
    par: 72, holePars: [4,5,4,4,3,5,3,4,4,4,4,3,4,5,4,4,3,5],
    tees: { Black: { rating: 75.5, slope: 145 }, Blue: { rating: 74.1, slope: 142 }, White: { rating: 72.3, slope: 138 }, Gold: { rating: 69.8, slope: 131 } },
  },
  "Spyglass Hill Golf Course": {
    par: 72, holePars: [5,4,3,4,4,3,5,4,4,4,3,4,5,4,3,5,4,4],
    tees: { Blue: { rating: 75.0, slope: 143 }, White: { rating: 72.7, slope: 138 }, Gold: { rating: 70.5, slope: 132 } },
  },
  "Torrey Pines (South Course)": {
    par: 72, holePars: [4,4,3,5,4,3,4,5,4,4,4,3,4,5,4,4,3,5],
    tees: { Black: { rating: 76.1, slope: 145 }, Blue: { rating: 74.6, slope: 143 }, White: { rating: 72.4, slope: 138 } },
  },
  "Torrey Pines (North Course)": {
    par: 72, holePars: [4,4,3,4,4,5,3,5,4,4,5,3,4,5,4,3,4,4],
    tees: { Blue: { rating: 71.4, slope: 128 }, White: { rating: 70.0, slope: 124 }, Red: { rating: 67.8, slope: 117 } },
  },
  "Riviera Country Club": {
    par: 71, holePars: [4,4,3,4,4,5,4,3,4,4,4,5,3,4,4,5,3,4],
    tees: { Black: { rating: 75.7, slope: 142 }, Blue: { rating: 73.5, slope: 137 }, White: { rating: 71.8, slope: 133 } },
  },

  // ══════════════════════════════════════════════════════════════
  // ARIZONA
  // ══════════════════════════════════════════════════════════════

  "TPC Scottsdale (Stadium Course)": {
    par: 71, holePars: [4,4,3,5,4,4,5,3,4,4,4,4,3,5,4,3,4,4],
    tees: { Black: { rating: 74.7, slope: 132 }, Blue: { rating: 72.6, slope: 128 }, White: { rating: 70.5, slope: 120 }, Red: { rating: 67.8, slope: 113 } },
  },
  "Troon North (Monument Course)": {
    par: 72, holePars: [4,5,3,4,4,4,5,3,4,4,4,3,5,4,4,5,3,4],
    tees: { Black: { rating: 75.3, slope: 147 }, Blue: { rating: 72.5, slope: 139 }, White: { rating: 70.0, slope: 130 }, Gold: { rating: 67.5, slope: 121 } },
  },
  "We-Ko-Pa Golf Club (Saguaro)": {
    par: 72, holePars: [4,5,3,4,4,4,5,3,4,4,4,3,5,4,4,5,3,4],
    tees: { Black: { rating: 73.6, slope: 140 }, Blue: { rating: 71.8, slope: 134 }, White: { rating: 70.0, slope: 127 }, Gold: { rating: 67.2, slope: 119 } },
  },
  "We-Ko-Pa Golf Club (Cholla)": {
    par: 72, holePars: [4,4,3,5,4,4,5,3,4,4,4,5,3,4,4,5,3,4],
    tees: { Black: { rating: 73.2, slope: 138 }, Blue: { rating: 71.5, slope: 131 }, White: { rating: 69.8, slope: 124 }, Gold: { rating: 67.0, slope: 117 } },
  },
  "Grayhawk Golf Club (Raptor)": {
    par: 72, holePars: [4,5,3,4,4,4,5,3,4,4,4,3,5,4,4,5,3,4],
    tees: { Black: { rating: 74.0, slope: 138 }, Blue: { rating: 72.1, slope: 133 }, White: { rating: 70.2, slope: 127 }, Gold: { rating: 67.5, slope: 119 } },
  },

  // ══════════════════════════════════════════════════════════════
  // FLORIDA
  // ══════════════════════════════════════════════════════════════

  "TPC Sawgrass (Stadium Course)": {
    // Hole 17 is the iconic island-green par 3
    par: 72, holePars: [4,5,3,4,4,4,4,3,5,4,5,4,3,4,4,5,3,4],
    tees: { Black: { rating: 75.5, slope: 146 }, Blue: { rating: 73.6, slope: 140 }, White: { rating: 72.0, slope: 134 }, Gold: { rating: 69.5, slope: 127 } },
  },
  "Bay Hill Club & Lodge": {
    par: 72, holePars: [4,5,4,4,3,5,4,3,4,4,4,5,3,4,4,3,5,4],
    tees: { Black: { rating: 75.1, slope: 142 }, Blue: { rating: 73.1, slope: 137 }, White: { rating: 71.5, slope: 133 } },
  },
  "Streamsong Resort (Blue)": {
    par: 72, holePars: [4,5,3,4,4,4,5,3,4,4,4,3,5,4,4,5,3,4],
    tees: { Black: { rating: 75.4, slope: 130 }, Blue: { rating: 73.6, slope: 126 }, White: { rating: 71.5, slope: 119 }, Gold: { rating: 69.0, slope: 112 } },
  },
  "Streamsong Resort (Red)": {
    par: 72, holePars: [4,4,3,5,4,4,5,3,4,4,4,5,3,4,4,5,3,4],
    tees: { Black: { rating: 74.9, slope: 128 }, Blue: { rating: 73.0, slope: 124 }, White: { rating: 71.2, slope: 117 }, Gold: { rating: 68.5, slope: 111 } },
  },
  "PGA National (Champion Course)": {
    // Hosts Honda Classic; famous "Bear Trap" holes 15-17
    par: 70, holePars: [4,4,3,5,4,4,4,3,4,4,4,5,3,4,4,3,4,4],
    tees: { Black: { rating: 75.9, slope: 142 }, Blue: { rating: 74.2, slope: 138 }, White: { rating: 72.5, slope: 134 } },
  },

  // ══════════════════════════════════════════════════════════════
  // ILLINOIS
  // ══════════════════════════════════════════════════════════════

  "Cog Hill (Course No. 4 – Dubsdread)": {
    // Host of the former BMW Championship (Wyndham Championship)
    par: 72, holePars: [4,5,3,4,4,4,5,3,4,4,4,5,3,4,4,5,3,4],
    tees: { Black: { rating: 76.7, slope: 148 }, Blue: { rating: 74.3, slope: 140 }, White: { rating: 72.4, slope: 133 } },
  },
  "TPC Deere Run": {
    // Host of the John Deere Classic; Silvis, IL
    par: 71, holePars: [4,4,3,5,4,4,5,3,4,4,4,4,3,4,5,4,3,4],
    tees: { Black: { rating: 74.0, slope: 133 }, Blue: { rating: 72.3, slope: 130 }, White: { rating: 70.6, slope: 124 }, Gold: { rating: 68.0, slope: 117 } },
  },
  "Medinah Country Club (No. 3)": {
    // Host of Ryder Cup 2012 and multiple PGA Championships
    par: 72, holePars: [4,4,3,5,4,4,5,3,4,4,4,5,3,4,4,5,3,4],
    tees: { Black: { rating: 77.6, slope: 142 }, Blue: { rating: 74.7, slope: 136 }, White: { rating: 72.4, slope: 129 } },
  },

  // ══════════════════════════════════════════════════════════════
  // SOUTHEAST / ATLANTIC
  // ══════════════════════════════════════════════════════════════

  "Harbour Town Golf Links": {
    // Host of RBC Heritage; iconic lighthouse finishing hole
    par: 71, holePars: [4,4,3,4,5,4,4,3,4,4,4,5,3,4,4,5,3,4],
    tees: { Gold: { rating: 74.1, slope: 136 }, Blue: { rating: 72.4, slope: 130 }, White: { rating: 71.0, slope: 127 } },
  },
  "Kiawah Island (Ocean Course)": {
    // Host of 1991 "War by the Shore" Ryder Cup; 2021 PGA Championship
    par: 72, holePars: [4,5,3,4,4,4,5,3,4,4,4,5,3,4,4,5,3,4],
    tees: { Black: { rating: 79.6, slope: 152 }, Blue: { rating: 76.3, slope: 144 }, White: { rating: 74.0, slope: 138 } },
  },
  "Pinehurst No. 2": {
    // Donald Ross classic; host of multiple US Opens; Southern Pines, NC
    par: 70, holePars: [4,4,3,4,5,4,4,3,4,4,4,4,3,5,4,4,3,4],
    tees: { Black: { rating: 76.5, slope: 137 }, Blue: { rating: 74.2, slope: 133 }, White: { rating: 72.7, slope: 129 } },
  },
  "Augusta National Golf Club": {
    // Private club; ratings approximate. Famous Amen Corner: holes 11-13
    par: 72, holePars: [4,5,4,3,4,3,4,5,4,4,4,3,5,4,5,3,4,4],
    tees: { Championship: { rating: 76.2, slope: 137 }, Member: { rating: 73.5, slope: 133 } },
  },

  // ══════════════════════════════════════════════════════════════
  // NORTHEAST / MID-ATLANTIC
  // ══════════════════════════════════════════════════════════════

  "Bethpage Black": {
    // NY state public course; host of 2002 & 2009 US Open, 2025 Ryder Cup
    par: 71, holePars: [4,4,3,5,4,4,5,3,4,4,4,3,5,4,4,3,4,4],
    tees: { Black: { rating: 78.1, slope: 155 }, Blue: { rating: 75.4, slope: 148 }, White: { rating: 73.3, slope: 141 } },
  },
  "Bethpage Red": {
    par: 70, holePars: [4,4,3,4,4,4,5,3,4,4,4,3,4,4,5,3,4,4],
    tees: { Blue: { rating: 72.1, slope: 127 }, White: { rating: 70.3, slope: 122 }, Gold: { rating: 67.8, slope: 116 } },
  },
  "Winged Foot Golf Club (West)": {
    // Host of 5 US Opens; Mamaroneck, NY
    par: 70, holePars: [4,4,3,4,4,5,4,3,4,4,4,3,4,4,4,3,5,4],
    tees: { Black: { rating: 77.4, slope: 145 }, Blue: { rating: 75.1, slope: 139 }, White: { rating: 73.6, slope: 135 } },
  },

  // ══════════════════════════════════════════════════════════════
  // NEVADA
  // ══════════════════════════════════════════════════════════════

  "Shadow Creek Golf Course": {
    // Las Vegas; Tom Fazio design; one of America's most exclusive courses
    par: 72, holePars: [4,5,3,4,4,4,5,3,4,4,4,3,5,4,4,5,3,4],
    tees: { Black: { rating: 75.4, slope: 135 }, Blue: { rating: 73.6, slope: 130 }, White: { rating: 71.5, slope: 124 } },
  },
};
