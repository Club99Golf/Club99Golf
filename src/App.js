import { useState, useEffect, useRef } from "react";
import { Theme } from "./Theme";
import { COURSE_DB } from "./courses";
import Map, { Marker, Source, Layer } from "react-map-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { initializeApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, deleteUser, reauthenticateWithCredential, EmailAuthProvider } from "firebase/auth";
import { getFirestore, initializeFirestore, persistentLocalCache, doc, setDoc, getDoc, getDocFromCache, collection, getDocs, query, where, orderBy, limit, deleteDoc, addDoc, serverTimestamp, onSnapshot, runTransaction, updateDoc, deleteField } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { loadStripe } from "@stripe/stripe-js";

const MAPBOX_TOKEN = process.env.REACT_APP_MAPBOX_TOKEN || "";
const OWM_API_KEY = process.env.REACT_APP_OWM_API_KEY || "";
const GCAPI_KEY = process.env.REACT_APP_GOLF_COURSE_API_KEY || "";
const GCAPI_BASE = "https://api.golfcourseapi.com/v1";
const GCAPI_HDRS = { "Authorization": `Key ${GCAPI_KEY}` };

/** Search GolfCourseAPI by name — returns array of course objects */
async function searchGolfCourseAPI(query) {
  if (!GCAPI_KEY || query.length < 2) return [];
  try {
    const res = await fetch(`${GCAPI_BASE}/search?search_query=${encodeURIComponent(query)}`, { headers: GCAPI_HDRS });
    if (!res.ok) return [];
    const data = await res.json();
    return data.courses || [];
  } catch { return []; }
}

/** Fetch full course detail by numeric ID — localStorage cached */
async function fetchGolfCourseAPIById(courseId) {
  const cacheKey = `gcapi_${courseId}`;
  const cached = localStorage.getItem(cacheKey);
  if (cached) { try { return JSON.parse(cached); } catch {} }
  try {
    const res = await fetch(`${GCAPI_BASE}/courses/${courseId}`, { headers: GCAPI_HDRS });
    if (!res.ok) return null;
    const data = await res.json();
    const course = data.course || null;
    if (course) localStorage.setItem(cacheKey, JSON.stringify(course));
    return course;
  } catch { return null; }
}

/**
 * Given a full GolfCourseAPI course object and a tee name preference,
 * return { rating, slope, par, holePars, tee_name } from the best-matching tee.
 * Priority: exact tee name → White → first male tee → first female tee.
 */
function extractApiTeeData(apiCourse, teeName) {
  const male   = apiCourse?.tees?.male   || [];
  const female = apiCourse?.tees?.female || [];
  const all    = [...male, ...female];
  const find   = (name) => all.find(t => t.tee_name.toLowerCase() === name.toLowerCase());
  const tee = find(teeName) || find("White") || find("Blue") || male[0] || female[0];
  if (!tee) return null;
  return {
    tee_name: tee.tee_name,
    rating:   tee.course_rating,
    slope:    tee.slope_rating,
    par:      tee.par_total,
    holePars: tee.holes.map(h => h.par),
  };
}

/** Collect all unique tee names from an API course object */
function apiCourseTeeNames(apiCourse) {
  const male   = (apiCourse?.tees?.male   || []).map(t => t.tee_name);
  const female = (apiCourse?.tees?.female || []).map(t => t.tee_name);
  return [...new Set([...male, ...female])];
}

const firebaseConfig = {
  apiKey: "AIzaSyCtvMnSnohd3GvTvgT0qfEUaHhp6KFnyR8",
  authDomain: "golf-app-9c01f.firebaseapp.com",
  projectId: "golf-app-9c01f",
  storageBucket: "golf-app-9c01f.appspot.com",
  messagingSenderId: "919346751838",
  appId: "1:919346751838:web:da2906170d5254267e07cf",
  measurementId: "G-SR5KQZERKF"
};

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
// Use persistentLocalCache so writes are cached to IndexedDB and survive page refreshes
const db = initializeFirestore(firebaseApp, { localCache: persistentLocalCache() });

const STRIPE_PK = "pk_live_51TWhShRJ9CQrTS8psr510iWuwXjKkAPObrgUDUqPWGyC6M3WlbxXZBi7BOqvaNoyymf7PfK10Ck1oDWC88doKo0n00AI7y9CZh";
const COIN_PACKS = [
  { id: "starter", coins: 500,   price: 0.99, label: "Starter" },
  { id: "value",   coins: 1500,  price: 2.99, label: "Value",   tag: "POPULAR" },
  { id: "pro",     coins: 4000,  price: 4.99, label: "Pro",     tag: "BEST VALUE" },
  { id: "elite",   coins: 10000, price: 9.99, label: "Elite" },
];

const fontLink = document.createElement("link");
fontLink.rel = "stylesheet";
fontLink.href = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Bebas+Neue&family=DM+Sans:wght@400;500;600;700;800;900&family=DM+Mono:wght@500&display=swap";
document.head.appendChild(fontLink);

const styleEl = document.createElement("style");
styleEl.textContent = `
  @keyframes fadeUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
  @keyframes countUp { from{opacity:0;transform:scale(0.8)} to{opacity:1;transform:scale(1)} }
  @keyframes slideIn { from{opacity:0;transform:translateX(-12px)} to{opacity:1;transform:translateX(0)} }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
  @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
  @keyframes shimmer { 0%{background-position:200% center} 100%{background-position:-200% center} }
  @keyframes aurora { 0%{background-position:0% 50%} 50%{background-position:100% 50%} 100%{background-position:0% 50%} }
  @keyframes borderSpin { from{--angle:0deg} to{--angle:360deg} }
  @keyframes gradientSpin { 0%{transform:rotate(0deg)} 100%{transform:rotate(360deg)} }
  @keyframes gpsPulse { 0%{transform:scale(1);opacity:0.8} 70%{transform:scale(2.4);opacity:0} 100%{transform:scale(2.4);opacity:0} }
  @keyframes strokeHalo { 0%{opacity:0.7;transform:scale(1)} 70%{opacity:0;transform:scale(2.5)} 100%{opacity:0;transform:scale(2.5)} }
  @keyframes dataBarIn { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
  .gps-dot-ring { animation:gpsPulse 1.8s ease-out infinite; }
  .stroke-marker-halo { animation:strokeHalo 2.2s ease-out infinite; }
  .banner-shimmer { background-size:200% auto !important; animation:shimmer 3s linear infinite; }
  .banner-aurora { background-size:400% 400% !important; animation:aurora 6s ease infinite; }
  .banner-pulse { animation:pulse 2s ease-in-out infinite; }
  .border-spin { animation:gradientSpin 3s linear infinite; }
  * { box-sizing:border-box; margin:0; padding:0; font-family:'Inter','DM Sans',system-ui,sans-serif; }
  html, body { height:100%; overflow:hidden; }
  #root { height:100%; overflow:hidden; }
  body { background:#f4f5f7; }
  .tab-scroll { height:100dvh; overflow-y:auto; -webkit-overflow-scrolling:touch; }
  @keyframes golfSpin {
    0%   { transform: rotate(0deg) scale(1);   opacity:1; }
    50%  { transform: rotate(180deg) scale(1.08); opacity:0.85; }
    100% { transform: rotate(360deg) scale(1);  opacity:1; }
  }
  .golf-ball-loader {
    width:38px; height:38px; border-radius:50%;
    background: radial-gradient(circle at 36% 34%, #fff 60%, #d4d4d4 100%);
    box-shadow: inset -3px -3px 6px rgba(0,0,0,0.22), 0 0 0 3px rgba(255,255,255,0.12);
    animation: golfSpin 1.1s cubic-bezier(0.4,0,0.6,1) infinite;
    position:relative;
  }
  .golf-ball-loader::after {
    content:'';
    position:absolute; inset:0; border-radius:50%;
    background: radial-gradient(ellipse at 30% 30%, rgba(255,255,255,0.55) 0%, transparent 65%);
  }
  input[type=number]::-webkit-inner-spin-button { -webkit-appearance:none; }
  ::-webkit-scrollbar { width:3px; }
  ::-webkit-scrollbar-thumb { background:#d1d5db; border-radius:2px; }
  input::placeholder { color:#b0b8c4; }
  .mapboxgl-logo, .mapboxgl-ctrl-attrib { display:none !important; }
  .mapboxgl-canvas { outline:none; }
  /* Safe-area shorthand variables */
  :root {
    --sat: env(safe-area-inset-top, 0px);
    --sab: env(safe-area-inset-bottom, 0px);
    --sal: env(safe-area-inset-left, 0px);
    --sar: env(safe-area-inset-right, 0px);
  }
  /* Bottom nav always clears the home indicator */
  nav.bottom-nav { padding-bottom: env(safe-area-inset-bottom, 0px); }
  /* Notch-aware top inset for the map controls */
  .safe-top { padding-top: env(safe-area-inset-top, 0px); }
`;
document.head.appendChild(styleEl);

// Light haptic tap — uses Web Vibration API on Android; silently no-ops on iOS/desktop
function hapticTap() { try { navigator.vibrate && navigator.vibrate(10); } catch (_) {} }

// Stable unique ID generator for Mapbox Source/Layer pairs
let _mlId = 0;
function mkId(prefix) { return `${prefix}-${++_mlId}`; }

// GeoJSON polygon approximating a geographic circle around center {lat,lng} with radiusYards
function geoJSONCircle(center, radiusYards, steps = 64) {
  const R = 6371000; // earth radius metres
  const r = radiusYards * 0.9144; // yards → metres
  const lat = center.lat * Math.PI / 180;
  const lng = center.lng * Math.PI / 180;
  const d = r / R;
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const b = (i / steps) * 2 * Math.PI;
    const pLat = Math.asin(Math.sin(lat) * Math.cos(d) + Math.cos(lat) * Math.sin(d) * Math.cos(b));
    const pLng = lng + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(lat), Math.cos(d) - Math.sin(lat) * Math.sin(pLat));
    pts.push([pLng * 180 / Math.PI, pLat * 180 / Math.PI]);
  }
  return { type: "Feature", geometry: { type: "Polygon", coordinates: [pts] } };
}

// Renders a Mapbox GeoJSON line — must be rendered inside react-map-gl <Map>
function MapPolyline({ path, strokeColor, strokeWeight, strokeOpacity, lineBlur }) {
  const id = useRef(mkId("mpl")).current;
  if (!path || path.length < 2) return null;
  const data = { type: "Feature", geometry: { type: "LineString", coordinates: path.map(p => [p.lng, p.lat]) } };
  return (
    <Source id={id} type="geojson" data={data}>
      <Layer id={`${id}-l`} type="line" paint={{ "line-color": strokeColor || "#fff", "line-opacity": strokeOpacity ?? 0.9, "line-width": strokeWeight ?? 2, "line-blur": lineBlur || 0 }} layout={{ "line-cap": "round", "line-join": "round" }} />
    </Source>
  );
}

// Renders a geographic circle — must be rendered inside react-map-gl <Map>
function MapCircle({ center, radiusYards, strokeColor, fillColor, fillOpacity, strokeWeight }) {
  const id = useRef(mkId("mcirc")).current;
  if (!center || !radiusYards) return null;
  const data = geoJSONCircle(center, radiusYards);
  return (
    <Source id={id} type="geojson" data={data}>
      <Layer id={`${id}-fill`} type="fill" paint={{ "fill-color": fillColor || strokeColor || "#C0C0C0", "fill-opacity": fillOpacity ?? 0 }} />
      <Layer id={`${id}-line`} type="line" paint={{ "line-color": strokeColor || "#C0C0C0", "line-opacity": 0.85, "line-width": strokeWeight ?? 2 }} />
    </Source>
  );
}

// COURSE_DB is imported from ./courses.js

function getCourseData(courseName, teeColor) {
  const c = COURSE_DB[courseName];
  if (!c) return null;
  const tee = c.tees[teeColor] || Object.values(c.tees)[0];
  if (!tee || tee.rating === null || tee.slope === null) return null;
  return { rating: tee.rating, slope: tee.slope, par: c.par, holePars: c.holePars || null };
}

function getCourseHolePars(courseName, holes) {
  const c = COURSE_DB[courseName];
  if (!c || !c.holePars) return null;
  if (holes === "9") return c.holePars.slice(0, 9);
  return c.holePars;
}

function calcRoundOVR(score, courseData, holes = 18) {
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

function calcOVRFromRounds(rounds) {
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
function calcHandicapIndex(history) {
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

function skillTier(ovr) {
  if (ovr >= 95) return { label: "SCRATCH",    sub: "Has no excuse to miss",          color: "#e2e8f0", bg: "rgba(226,232,240,0.15)", border: "rgba(226,232,240,0.4)", rank: 7 };
  if (ovr >= 88) return { label: "CHAMPION",   sub: "Playing at another level",        color: "#f87171", bg: "rgba(239,68,68,0.12)",   border: "rgba(239,68,68,0.45)",   rank: 6 };
  if (ovr >= 80) return { label: "ALBATROSS",  sub: "Rare and dangerous",              color: "#a78bfa", bg: "rgba(139,92,246,0.12)",  border: "rgba(139,92,246,0.45)",  rank: 5 };
  if (ovr >= 72) return { label: "EAGLE",      sub: "Better than most will ever be",   color: "#22d3ee", bg: "rgba(6,182,212,0.12)",   border: "rgba(6,182,212,0.45)",   rank: 4 };
  if (ovr >= 64) return { label: "BIRDIE",     sub: "Knows their way around a course", color: "#fbbf24", bg: "rgba(251,191,36,0.12)",  border: "rgba(251,191,36,0.45)",  rank: 3 };
  if (ovr >= 55) return { label: "PAR HUNTER", sub: "Getting there",                   color: "#94a3b8", bg: "rgba(148,163,184,0.12)", border: "rgba(148,163,184,0.4)",  rank: 2 };
  return         {         label: "BOGEY",      sub: "Finding every hazard",            color: "#cd7f32", bg: "rgba(205,127,50,0.12)",  border: "rgba(205,127,50,0.4)",   rank: 1 };
}

// Haversine formula — returns straight-line distance in yards between two GPS points
function haversineYards(lat1, lng1, lat2, lng2) {
  const R = 6371000; // Earth radius metres
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const metres = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(metres * 1.09361);
}

// Compass bearing in degrees (0=N, 90=E) from point 1 → point 2
function bearingDeg(lat1, lng1, lat2, lng2) {
  const toRad = d => d * Math.PI / 180;
  const dLng = toRad(lng2 - lng1);
  const y = Math.sin(dLng) * Math.cos(toRad(lat2));
  const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) - Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLng);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

// Returns signed headwind component in mph.
// Positive = headwind (play longer), negative = tailwind (play shorter).
// windDeg: meteorological direction wind comes FROM (e.g. 270 = west wind, blowing east).
function calculateWindEffect(plat, plng, glat, glng, windSpeed, windDeg) {
  if (!windSpeed || windSpeed <= 0) return 0;
  const ballBearing = bearingDeg(plat, plng, glat, glng);
  const windGoingTo = (windDeg + 180) % 360; // direction wind travels toward
  const angleDiff = (windGoingTo - ballBearing) * Math.PI / 180;
  return windSpeed * Math.cos(angleDiff); // +headwind / −tailwind
}

// Moves a lat/lng point a given number of yards along a compass bearing.
function offsetLatLng(lat, lng, bearing, yards) {
  const R = 6371000;
  const d = (yards * 0.9144) / R; // angular distance in radians
  const brng = bearing * Math.PI / 180;
  const lat1 = lat * Math.PI / 180;
  const lon1 = lng * Math.PI / 180;
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(brng));
  const lon2 = lon1 + Math.atan2(Math.sin(brng) * Math.sin(d) * Math.cos(lat1), Math.cos(d) - Math.sin(lat1) * Math.sin(lat2));
  return { lat: lat2 * 180 / Math.PI, lng: lon2 * 180 / Math.PI };
}

// Returns true if the rendered features at pos include water, scrub, or wood hazards.
// Queries a 3×3 px bounding box (prevents misses on thin vector polygon edges).
// Priority: our injected _hz-* layers → fallback to unfiltered query.
// Checks sourceLayer, layer ID prefix, AND class/type properties for maximum coverage.
function _isWaterAtPoint(map, pos) {
  try {
    const pt = map.project([pos.lng, pos.lat]);
    const bbox = [[pt.x - 2, pt.y - 2], [pt.x + 2, pt.y + 2]];

    // Prefer querying our injected invisible layers (most reliable under satellite)
    const HZ_LAYERS = ['_hz-water', '_hz-landuse', '_hz-natural'];
    const availableLayers = HZ_LAYERS.filter(id => { try { return !!map.getLayer(id); } catch (_) { return false; } });
    const features = availableLayers.length > 0
      ? map.queryRenderedFeatures(bbox, { layers: availableLayers })
      : map.queryRenderedFeatures(bbox);

    console.log('Hazard Detection layers found:', features);

    return features.some(f => {
      const sl  = f.sourceLayer || '';
      const lid = f.layer?.id   || '';
      const cls = f.properties?.class || '';
      const typ = f.properties?.type  || '';
      return (
        sl === 'water'      || sl === 'waterway'        ||
        /^(water|marine|wetland)/i.test(lid)            ||
        cls === 'water'     || cls === 'wetland'        ||
        cls === 'scrub'     || cls === 'marine'         ||
        typ === 'wood'      || typ === 'wetland'
      );
    });
  } catch (_) { return false; }
}

// Hazard-avoidance for landing zone placement.
// If the original carry lands in water/marine/wetland, pulls back in 5y steps
// toward the player until reaching dry ground ("shoreline layup").
// Club-down: always re-selects the longest bag club that fits the safe distance.
// Returns { pos, isInHazard, isWarning, warningLabel, clubOverride }
function adjustLandingZoneForHazards(map, playerPos, bearing, originalDist, sortedBagClubs, colorFn) {
  const origPos    = offsetLatLng(playerPos.lat, playerPos.lng, bearing, originalDist);
  const isInHazard = _isWaterAtPoint(map, origPos);

  if (!isInHazard) {
    return { pos: origPos, isInHazard: false, isWarning: false, warningLabel: null, clubOverride: null };
  }

  // Pull back in 5y steps to find the shoreline (up to 20y of carry loss)
  for (let cut = 5; cut <= 20; cut += 5) {
    const layupDist = originalDist - cut;
    if (layupDist <= 0) break;
    const layupPos = offsetLatLng(playerPos.lat, playerPos.lng, bearing, layupDist);
    if (!_isWaterAtPoint(map, layupPos)) {
      const c = sortedBagClubs.find(b => parseFloat(b.distance) <= layupDist);
      const clubOverride = c
        ? { club: c.club, distance: parseFloat(c.distance), color: colorFn(c.club) }
        : null;
      return { pos: layupPos, isInHazard: true, isWarning: false, warningLabel: 'LAYUP', clubOverride };
    }
  }

  // Shoreline not found within 20y — caution at original carry
  return { pos: origPos, isInHazard: true, isWarning: true, warningLabel: 'HAZARD AHEAD', clubOverride: null };
}

// Derives front/back green edge points by offsetting greenCenter 15 yards
// along the player→green bearing (back) and the reverse (front).
function computeGreenPoints(greenCenter, playerPos, depthYards = 15) {
  if (!greenCenter || !playerPos) return { front: null, back: null };
  const brng = bearingDeg(playerPos.lat, playerPos.lng, greenCenter.lat, greenCenter.lng);
  const back  = offsetLatLng(greenCenter.lat, greenCenter.lng, brng,              depthYards); // deeper
  const front = offsetLatLng(greenCenter.lat, greenCenter.lng, (brng + 180) % 360, depthYards); // closer
  return { front, back };
}

// Plays-like distance: adjusts raw GPS yardage for wind, elevation, and temperature.
//   headwindMph: positive = into the wind (+1 yd/mph), negative = tailwind (-0.5 yd/mph)
//   holeElevFt:  positive = uphill (adds distance), ±1 yd per 3 ft
//   tempF:       cold air is denser — +2 yds per 10°F below 70°F
function getPlaysLikeDistance(actualDistance, headwindMph, holeElevFt, tempF) {
  if (actualDistance == null || actualDistance <= 0) return actualDistance;
  const windAdj = headwindMph > 0 ? Math.round(headwindMph) : Math.round(headwindMph * 0.5);
  const elevAdj = Math.round((holeElevFt || 0) / 3);
  const tempAdj = (tempF != null && tempF < 70) ? Math.round((70 - tempF) / 10 * 2) : 0;
  return Math.max(10, Math.round(actualDistance + windAdj + elevAdj + tempAdj));
}

// Map compass degrees → arrow character for display (8-point rose)
function degToArrow(deg) {
  const dirs = ["↑","↗","→","↘","↓","↙","←","↖"];
  return dirs[Math.round(((deg % 360) + 360) % 360 / 45) % 8];
}

// ── PRO CADDIE: Stock bag yardages & club suggestion ──
const DEFAULT_BAG = [
  { club: "Driver", distance: "275" },
  { club: "3W",     distance: "240" },
  { club: "5W",     distance: "220" },
  { club: "3H",     distance: "210" },
  { club: "4i",     distance: "195" },
  { club: "5i",     distance: "185" },
  { club: "6i",     distance: "175" },
  { club: "7i",     distance: "165" },
  { club: "8i",     distance: "150" },
  { club: "9i",     distance: "140" },
  { club: "PW",     distance: "130" },
  { club: "48°",    distance: "120" },
  { club: "50°",    distance: "110" },
  { club: "52°",    distance: "100" },
  { club: "54°",    distance: "90"  },
  { club: "56°",    distance: "85"  },
  { club: "58°",    distance: "80"  },
  { club: "60°",    distance: "70"  },
];

// Elevation offset baseline (Whitnall Park area — relatively flat)
const ELEVATION_OFFSET = 0;

// Suggest the best club for a given adjusted target distance.
// 2K Logic: on an exact tie, go shorter (lower club) when PWR > 75.
const LOFT_DEGREE_RE = /^\d+°$/;
function suggestClub(adjustedTarget, bagItems, pwr) {
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
function getRecommendedClub(targetYards, bagItems) {
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

const CLUB_ACCENT = "#000000";

// ─── Hole Pin Layout Persistence (localStorage) ───────────────────────────────
// Key: "pins_<slugified course>_h<0-indexed hole>"
// Value: { teePin: {lat,lng} | null, flagPin: {lat,lng} | null }
function _pinKey(courseName, holeIdx) {
  return `pins_${(courseName || "unknown").replace(/\W+/g, "_").toLowerCase()}_h${holeIdx}`;
}
function savePinLayout(courseName, holeIdx, teePin, flagPin) {
  if (!teePin && !flagPin) return;
  try { localStorage.setItem(_pinKey(courseName, holeIdx), JSON.stringify({ teePin: teePin || null, flagPin: flagPin || null })); } catch {}
}
function loadPinLayout(courseName, holeIdx) {
  try { const d = localStorage.getItem(_pinKey(courseName, holeIdx)); return d ? JSON.parse(d) : null; } catch { return null; }
}

// ─── Community Pin Cloud (global_course_pins) ────────────────────────────────
// Doc ID: "{courseKey}_h{1-indexed hole}"
// Fields: courseKey, holeNumber, count, teeLat, teeLng, flagLat, flagLng

function communityPinCourseKey(round) {
  return round?.apiCourseId
    ? String(round.apiCourseId)
    : (round?.course || "unknown").replace(/\W+/g, "_").toLowerCase();
}

async function fetchCommunityPins(courseKey, holeIdx) {
  if (!courseKey) return null;
  const docId = `${courseKey}_h${holeIdx + 1}`;
  try {
    const snap = await getDoc(doc(db, "global_course_pins", docId));
    if (!snap.exists()) return null;
    const d = snap.data();
    if (!d.count) return null;
    return {
      count:   d.count,
      teePin:  d.teeLat  != null && d.teeLng  != null ? { lat: d.teeLat,  lng: d.teeLng  } : null,
      flagPin: d.flagLat != null && d.flagLng != null ? { lat: d.flagLat, lng: d.flagLng } : null,
    };
  } catch (e) {
    console.warn("[CommunityPins] fetch failed:", e);
    return null;
  }
}

async function pushPinVote(courseKey, holeIdx, teePin, flagPin) {
  if (!courseKey || (!teePin && !flagPin)) return;
  const docId = `${courseKey}_h${holeIdx + 1}`;
  const ref = doc(db, "global_course_pins", docId);
  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) {
        tx.set(ref, {
          courseKey,
          holeNumber: holeIdx + 1,
          count:   1,
          teeLat:  teePin?.lat  ?? null,
          teeLng:  teePin?.lng  ?? null,
          flagLat: flagPin?.lat ?? null,
          flagLng: flagPin?.lng ?? null,
        });
      } else {
        const d = snap.data();
        const n = (d.count || 0) + 1;
        const update = { count: n };
        if (teePin) {
          update.teeLat = ((d.teeLat ?? teePin.lat) * (n - 1) + teePin.lat) / n;
          update.teeLng = ((d.teeLng ?? teePin.lng) * (n - 1) + teePin.lng) / n;
        }
        if (flagPin) {
          update.flagLat = ((d.flagLat ?? flagPin.lat) * (n - 1) + flagPin.lat) / n;
          update.flagLng = ((d.flagLng ?? flagPin.lng) * (n - 1) + flagPin.lng) / n;
        }
        tx.update(ref, update);
      }
    });
  } catch (e) {
    console.warn("[CommunityPins] vote failed:", e);
  }
}

// Single golf ball icon used for every club — solid circle with 3 arc dimple rows
const GOLF_BALL_ICON = (
  <svg width="30" height="30" viewBox="0 0 30 30" fill="none">
    <circle cx="15" cy="15" r="12" fill="#1a1a1a"/>
    {/* dimple arcs — subtle white curves suggesting surface texture */}
    <path d="M9,11 Q15,8 21,11" stroke="rgba(255,255,255,0.25)" strokeWidth="1.2" strokeLinecap="round" fill="none"/>
    <path d="M7,15 Q15,11 23,15" stroke="rgba(255,255,255,0.2)"  strokeWidth="1.2" strokeLinecap="round" fill="none"/>
    <path d="M9,19 Q15,16 21,19" stroke="rgba(255,255,255,0.15)" strokeWidth="1.2" strokeLinecap="round" fill="none"/>
  </svg>
);

function xpForLevel(level) {
  if (level <= 1) return 0;
  return Math.floor(200 * Math.pow(1.18, level - 2));
}
function totalXPForLevel(level) {
  let total = 0;
  for (let i = 2; i <= level; i++) total += xpForLevel(i);
  return total;
}
function levelFromXP(xp) {
  let level = 1;
  while (totalXPForLevel(level + 1) <= xp) level++;
  return Math.min(level, 50);
}
function xpIntoCurrentLevel(xp) {
  const level = levelFromXP(xp);
  return xp - totalXPForLevel(level);
}
function xpNeededForNextLevel(xp) {
  const level = levelFromXP(xp);
  return xpForLevel(level + 1);
}

function computeStats(ovr, attrs) {
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


const REACTIONS = [
  { key: "fire", label: "🔥", title: "Fire round" },
  { key: "skull", label: "💀", title: "Rough day" },
  { key: "lock", label: "🎯", title: "Dialed in" },
  { key: "goat", label: "🐐", title: "GOAT" },
];

function FeedCard({ r, isNew, myUid, myUsername, accent, onTapRound }) {
  const [reactions, setReactions] = useState(null);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState("");
  const [commentBusy, setCommentBusy] = useState(false);
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  const ownerUid = r.ownerUid || r.uid || "";
  const roundId = String(r.id);
  useEffect(() => { loadReactions(ownerUid, roundId).then(setReactions); }, [ownerUid, roundId]);
  function handleReaction(key) {
    if (!myUid) return;
    const prev = reactions || {};
    const updated = { ...prev };
    if (updated[myUid] === key) delete updated[myUid]; else updated[myUid] = key;
    setReactions(updated);
    setReaction(ownerUid, roundId, myUid, key).then(setReactions);
  }
  function handleOpenComments() {
    setShowComments(v => !v);
    if (!commentsLoaded) { loadComments(ownerUid, roundId).then(c => { setComments(c); setCommentsLoaded(true); }); }
  }
  async function handleAddComment() {
    if (!commentText.trim() || commentBusy) return;
    setCommentBusy(true);
    const ok = await addComment(ownerUid, roundId, myUid, myUsername, commentText);
    if (ok) { setComments(c => [...c, { id: Date.now(), uid: myUid, username: myUsername, text: commentText.trim() }]); setCommentText(""); }
    setCommentBusy(false);
  }
  const reactionCounts = {};
  Object.values(reactions || {}).forEach(k => { reactionCounts[k] = (reactionCounts[k] || 0) + 1; });
  const myReaction = reactions ? reactions[myUid] : null;
  const commentCount = commentsLoaded ? comments.length : (r.commentCount || 0);
  return (
    <div style={{ background: "#fff", borderRadius: 14, border: isNew ? "1.5px solid #fecaca" : "1px solid #e5e7eb", boxShadow: "0 1px 4px rgba(0,0,0,0.05)", marginBottom: 10, overflow: "hidden", animation: "fadeUp 0.3s ease" }}>
      <div onClick={() => onTapRound && onTapRound(r)} style={{ padding: "14px 16px 10px", cursor: "pointer" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 2 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 30, height: 30, borderRadius: "50%", background: "#f3f4f6", overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {r.ownerProfilePic ? <img src={r.ownerProfilePic} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" /> : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>}
            </div>
            <div>
              <span style={{ fontSize: 12, fontWeight: 800, color: "#6D8F6E", fontFamily: "Bebas Neue", letterSpacing: 1, marginRight: 6 }}>{r.username}</span><span style={{ fontSize: 12, color: "#374151", fontWeight: 600 }}>{r.course}</span>
            </div>
          </div>

        </div>
        <div style={{ fontSize: 11, color: "#9ca3af", fontWeight: 500, marginBottom: 10 }}>{r.date} · {r.holes} holes{r.tee ? " · " + r.tee + " tees" : ""}</div>
        <div style={{ display: "flex", gap: 0 }}>
          {[{ val: r.score, lbl: "SCORE", color: "#111827" }, { val: `${r.ovrAfter} (${r.ovrDelta >= 0 ? "+" : ""}${r.ovrDelta})`, lbl: "OVR", color: r.ovrDelta >= 0 ? "#7DA27E" : "#5B7282" }, { val: `+${r.coins ?? r.xp ?? 0} 🪙`, lbl: "COINS", color: "#a78bfa" }].map(({ val, lbl, color }) => (
            <div key={lbl} style={{ flex: 1, textAlign: "center" }}>
              <div style={{ fontSize: 22, fontWeight: 900, fontFamily: "Bebas Neue", color, lineHeight: 1.1 }}>{val}</div>
              <div style={{ fontSize: 9, fontWeight: 800, color: "#9ca3af", letterSpacing: 1.5 }}>{lbl}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ borderTop: "1px solid #f3f4f6", padding: "8px 12px", display: "flex", alignItems: "center", gap: 4 }}>
        {REACTIONS.map(rx => {
          const count = reactionCounts[rx.key] || 0;
          const isMine = myReaction === rx.key;
          return (
            <button key={rx.key} onClick={() => handleReaction(rx.key)} title={rx.title} style={{ display: "flex", alignItems: "center", gap: 3, padding: "4px 8px", borderRadius: 20, border: isMine ? "1.5px solid rgba(125,162,126,0.5)" : "1.5px solid #e5e7eb", background: isMine ? "rgba(125,162,126,0.1)" : "#fafafa", cursor: "pointer", transition: "all 0.15s", fontSize: 13 }}>
              <span style={{ fontSize: 14, lineHeight: 1 }}>{rx.label}</span>
              {count > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: isMine ? "#6D8F6E" : "#6b7280" }}>{count}</span>}
            </button>
          );
        })}
        <button onClick={handleOpenComments} style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 20, border: "1.5px solid #e5e7eb", background: showComments ? "#f9fafb" : "#fafafa", cursor: "pointer", fontSize: 12, fontWeight: 700, color: "#6b7280" }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          {commentCount > 0 ? commentCount : ""}
        </button>
      </div>
      {showComments && (
        <div style={{ borderTop: "1px solid #f3f4f6", padding: "10px 14px 12px", background: "#fafafa" }}>
          {comments.length === 0 && <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 8, textAlign: "center" }}>No comments yet</div>}
          {comments.map(c => (
            <div key={c.id} style={{ marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: "#111827", fontFamily: "Bebas Neue", letterSpacing: 0.5, marginRight: 5 }}>{c.username}</span>
              <span style={{ fontSize: 13, color: "#374151" }}>{c.text}</span>
            </div>
          ))}
          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            <input value={commentText} onChange={e => setCommentText(e.target.value)} onKeyDown={e => e.key === "Enter" && handleAddComment()} placeholder="Add a comment…" maxLength={120} style={{ flex: 1, padding: "8px 12px", borderRadius: 20, border: "1px solid #e5e7eb", fontSize: 13, outline: "none", fontFamily: "DM Sans", background: "#fff" }} />
            <button onClick={handleAddComment} disabled={!commentText.trim() || commentBusy} style={{ padding: "8px 14px", borderRadius: 20, border: "none", background: commentText.trim() ? "#7DA27E" : "#e5e7eb", color: "#fff", fontWeight: 800, fontSize: 12, cursor: commentText.trim() ? "pointer" : "default", transition: "background 0.15s" }}>Post</button>
          </div>
        </div>
      )}
    </div>
  );
}

function OVRTrendChart({ history, accent = "#7DA27E" }) {
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

function RadarChart({ stats, accent = "#7DA27E" }) {
  const size = 200, cx = 100, cy = 100, r = 68;
  const keys = Object.keys(stats);
  const n = keys.length;
  const angle = i => (Math.PI * 2 * i) / n - Math.PI / 2;
  const pt = (i, scale) => [cx + Math.cos(angle(i)) * r * scale, cy + Math.sin(angle(i)) * r * scale];
  // Scale: 0→center, 99→edge, 50→exactly the 50% ring
  const dataPoints = keys.map((k, i) => pt(i, Math.max(0, stats[k]) / 99));
  const dataPath = dataPoints.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x},${y}`).join(" ") + "Z";
  return (
    <svg width={size} height={size} style={{ overflow: "visible" }}>
      {[0.25, 0.5, 0.75, 1].map(sc => { const pts = keys.map((_, i) => pt(i, sc)); const p = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x},${y}`).join(" ") + "Z"; return <path key={sc} d={p} fill="none" stroke="rgba(0,0,0,0.07)" strokeWidth="1" />; })}
      {keys.map((_, i) => { const [x, y] = pt(i, 1); return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="rgba(0,0,0,0.07)" strokeWidth="1" />; })}
      <path d={dataPath} fill={`${accent}33`} stroke={accent} strokeWidth="2" />
      {dataPoints.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={3.5} fill={accent} />)}
      {keys.map((k, i) => { const [x, y] = pt(i, 1.32); return (<g key={k}><text x={x} y={y - 5} textAnchor="middle" fill="#9ca3af" fontSize="8" fontFamily="DM Sans" fontWeight="700" letterSpacing="1">{k}</text><text x={x} y={y + 9} textAnchor="middle" fill="#111827" fontSize="13" fontFamily="DM Sans" fontWeight="900">{stats[k]}</text></g>); })}
    </svg>
  );
}

function StatBar({ label, value, accent }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", letterSpacing: 1, fontFamily: "DM Sans" }}>{label}</span>
        <span style={{ fontSize: 13, fontWeight: 900, color: "#fff", fontFamily: "DM Sans" }}>{value}</span>
      </div>
      <div style={{ height: 4, borderRadius: 2, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${value}%`, background: accent, borderRadius: 2, transition: "width 0.6s ease" }} />
      </div>
    </div>
  );
}

const FAKE_HISTORY = [
  { id: 1, course: "Whitnall Park GC", score: 108, holes: "18", roundOVR: 55.8, ovrAfter: 58, ovrDelta: 2, xp: 500, date: "2025-05-14", aiScanned: true },
  { id: 2, course: "Rivermoor GC", score: 112, holes: "18", roundOVR: 53.4, ovrAfter: 57, ovrDelta: -1, xp: 500, date: "2025-05-07", aiScanned: false },
  { id: 3, course: "Whitnall Park GC", score: 105, holes: "18", roundOVR: 57.9, ovrAfter: 58, ovrDelta: 1, xp: 700, date: "2025-04-30", aiScanned: true },
];
const FAKE_ROUNDS = FAKE_HISTORY.map(r => r.roundOVR);

const BLANK_PROFILE = {
  username: "", ovr: 50, experience: 0, level: 1, streak: 0,
  rounds: [], lastRoundDate: null, history: [],
  attrs: { PWR: 0, ACC: 0, CON: 0, REC: 0, EFF: 0 },
  ownedItems: [], equippedBanner: null, equippedBorder: null, equippedTitle: null,
  equippedNameplate: null,
  coinBoost: null, pinnedBadges: [], bag: [], coins: 0,
  courseShots: {}, crewId: null, crewName: null,
};


const BadgeIcon = ({ id, size = 36 }) => {
  const s = size;
  const icons = {
    first_round: <svg width={s} height={s} viewBox="0 0 36 36"><circle cx="18" cy="18" r="18" fill="#dcfce7"/><line x1="13" y1="8" x2="13" y2="28" stroke="#16a34a" strokeWidth="2" strokeLinecap="round"/><polygon points="13,8 24,12 13,16" fill="#22c55e"/><ellipse cx="13" cy="28" rx="4" ry="1.5" fill="#bbf7d0"/></svg>,
    five_rounds: <svg width={s} height={s} viewBox="0 0 36 36"><circle cx="18" cy="18" r="18" fill="#fef3c7"/><path d="M18 27c-4 0-7-3-7-6.5 0-2 1-3.5 2.5-5C15 17 16 15 16 13c1.5 2 .5 4 2 5.5C19.5 17 20 15.5 20 14c2 2 3 4 3 6.5C23 24 21 27 18 27z" fill="#f59e0b"/><path d="M18 25c-2 0-3.5-1.5-3.5-3.5 0-1 .5-2 1.5-2.5C16.5 20.5 17 22 18 22s1.5-1.5 2-3c1 1 1.5 2 1.5 3C21.5 23.5 20 25 18 25z" fill="#fcd34d"/></svg>,
    ten_rounds: <svg width={s} height={s} viewBox="0 0 36 36"><circle cx="18" cy="18" r="18" fill="#ede9fe"/><rect x="11" y="9" width="14" height="18" rx="2" fill="#7c3aed"/><rect x="14" y="13" width="8" height="1.5" rx="0.75" fill="#fff" opacity="0.9"/><rect x="14" y="16.5" width="6" height="1.5" rx="0.75" fill="#fff" opacity="0.7"/><rect x="14" y="20" width="7" height="1.5" rx="0.75" fill="#fff" opacity="0.7"/><rect x="14" y="23.5" width="5" height="1.5" rx="0.75" fill="#fff" opacity="0.5"/></svg>,
    "25_rounds": <svg width={s} height={s} viewBox="0 0 36 36"><circle cx="18" cy="18" r="18" fill="#fef9c3"/><polygon points="18,9 20.5,15.5 27.5,15.5 22,19.5 24,26 18,22 12,26 14,19.5 8.5,15.5 15.5,15.5" fill="#eab308"/></svg>,
    "50_rounds": <svg width={s} height={s} viewBox="0 0 36 36"><circle cx="18" cy="18" r="18" fill="#e0f2fe"/><polygon points="18,8 26,15 18,28 10,15" fill="#0ea5e9"/><polygon points="18,8 26,15 18,16 10,15" fill="#38bdf8"/></svg>,
    break_100: <svg width={s} height={s} viewBox="0 0 36 36"><circle cx="18" cy="18" r="18" fill="#fee2e2"/><circle cx="18" cy="18" r="9" fill="none" stroke="#ef4444" strokeWidth="2"/><circle cx="18" cy="18" r="5" fill="none" stroke="#ef4444" strokeWidth="2"/><circle cx="18" cy="18" r="2" fill="#ef4444"/></svg>,
    break_90: <svg width={s} height={s} viewBox="0 0 36 36"><circle cx="18" cy="18" r="18" fill="#fce7f3"/><circle cx="14" cy="18" r="6" fill="none" stroke="#db2777" strokeWidth="1.5"/><circle cx="14" cy="18" r="2.5" fill="#db2777"/><line x1="18" y1="18" x2="27" y2="10" stroke="#be185d" strokeWidth="2" strokeLinecap="round"/><polygon points="27,10 24,10 27,13" fill="#be185d"/></svg>,
    break_85: <svg width={s} height={s} viewBox="0 0 36 36"><circle cx="18" cy="18" r="18" fill="#f0fdf4"/><circle cx="14" cy="16" r="5" fill="none" stroke="#16a34a" strokeWidth="2"/><line x1="18" y1="19" x2="27" y2="27" stroke="#16a34a" strokeWidth="2" strokeLinecap="round"/><line x1="24" y1="24" x2="24" y2="27" stroke="#16a34a" strokeWidth="2" strokeLinecap="round"/><line x1="26.5" y1="26" x2="26.5" y2="28" stroke="#16a34a" strokeWidth="2" strokeLinecap="round"/></svg>,
    break_80: <svg width={s} height={s} viewBox="0 0 36 36"><circle cx="18" cy="18" r="18" fill="#fff7ed"/><path d="M9 21C9 21 13 14 18 14C23 14 27 21 27 21" fill="none" stroke="#ea580c" strokeWidth="2" strokeLinecap="round"/><circle cx="18" cy="13" r="2" fill="#ea580c"/><line x1="16" y1="23" x2="16" y2="27" stroke="#ea580c" strokeWidth="1.5" strokeLinecap="round"/><line x1="20" y1="23" x2="20" y2="27" stroke="#ea580c" strokeWidth="1.5" strokeLinecap="round"/><line x1="14" y1="27" x2="22" y2="27" stroke="#ea580c" strokeWidth="1.5" strokeLinecap="round"/></svg>,
    break_75: <svg width={s} height={s} viewBox="0 0 36 36"><circle cx="18" cy="18" r="18" fill="#fefce8"/><polygon points="8,24 11,14 18,20 25,14 28,24" fill="#ca8a04"/><rect x="8" y="24" width="20" height="3" rx="1" fill="#a16207"/><circle cx="18" cy="20" r="1.5" fill="#fde047"/><circle cx="11" cy="14" r="1.5" fill="#fde047"/><circle cx="25" cy="14" r="1.5" fill="#fde047"/></svg>,
    even_par: <svg width={s} height={s} viewBox="0 0 36 36"><circle cx="18" cy="18" r="18" fill="#f0f9ff"/><line x1="18" y1="9" x2="18" y2="27" stroke="#0369a1" strokeWidth="2" strokeLinecap="round"/><line x1="12" y1="14" x2="24" y2="14" stroke="#0369a1" strokeWidth="1.5"/><path d="M9 14 L12 20 L15 14" fill="none" stroke="#0369a1" strokeWidth="1.5" strokeLinejoin="round"/><path d="M21 14 L24 20 L27 14" fill="none" stroke="#0369a1" strokeWidth="1.5" strokeLinejoin="round"/><line x1="14" y1="27" x2="22" y2="27" stroke="#0369a1" strokeWidth="2" strokeLinecap="round"/></svg>,
    ovr_70: <svg width={s} height={s} viewBox="0 0 36 36"><circle cx="18" cy="18" r="18" fill="#f0fdf4"/><path d="M18 8C13.6 8 10 11.6 10 16C10 21.5 18 28 18 28C18 28 26 21.5 26 16C26 11.6 22.4 8 18 8Z" fill="#22c55e"/><circle cx="18" cy="16" r="3.5" fill="#fff"/></svg>,
    ovr_80: <svg width={s} height={s} viewBox="0 0 36 36"><circle cx="18" cy="18" r="18" fill="#fdf4ff"/><path d="M11 10L11 20C11 24 15 27 18 27C21 27 25 24 25 20L25 10" fill="none" stroke="#a855f7" strokeWidth="3" strokeLinecap="round"/><line x1="9" y1="10" x2="13" y2="10" stroke="#e879f9" strokeWidth="3" strokeLinecap="round"/><line x1="23" y1="10" x2="27" y2="10" stroke="#c026d3" strokeWidth="3" strokeLinecap="round"/></svg>,
    ovr_90: <svg width={s} height={s} viewBox="0 0 36 36"><circle cx="18" cy="18" r="18" fill="#fef9c3"/><path d="M12 9L24 9L24 19C24 23 21 26 18 26C15 26 12 23 12 19Z" fill="#eab308"/><rect x="16" y="26" width="4" height="3" fill="#ca8a04"/><rect x="13" y="29" width="10" height="2" rx="1" fill="#a16207"/><circle cx="18" cy="17" r="2.5" fill="#fde047"/></svg>,
    level_5: <svg width={s} height={s} viewBox="0 0 36 36"><circle cx="18" cy="18" r="18" fill="#ecfdf5"/><polygon points="18,9 25,19 21,19 21,27 15,27 15,19 11,19" fill="#10b981"/></svg>,
    level_10: <svg width={s} height={s} viewBox="0 0 36 36"><circle cx="18" cy="18" r="18" fill="#fff7ed"/><circle cx="18" cy="22" r="7" fill="#f97316"/><circle cx="18" cy="22" r="4.5" fill="#fed7aa"/><line x1="15" y1="9" x2="17" y2="15" stroke="#fb923c" strokeWidth="3" strokeLinecap="round"/><line x1="21" y1="9" x2="19" y2="15" stroke="#ea580c" strokeWidth="3" strokeLinecap="round"/><line x1="15" y1="9" x2="21" y2="9" stroke="#f97316" strokeWidth="2.5" strokeLinecap="round"/></svg>,
    streak_3: <svg width={s} height={s} viewBox="0 0 36 36"><circle cx="18" cy="18" r="18" fill="#e0f2fe"/><path d="M7 20C9 17 11 23 13 20C15 17 17 23 19 20C21 17 23 23 25 20C27 17 29 20 29 20" fill="none" stroke="#0ea5e9" strokeWidth="2.5" strokeLinecap="round"/></svg>,
    streak_5: <svg width={s} height={s} viewBox="0 0 36 36"><circle cx="18" cy="18" r="18" fill="#fef3c7"/><polygon points="20,8 12,20 17,20 16,28 24,16 19,16" fill="#f59e0b"/><polygon points="20,8 14,19 18,19 17,27 23,17 19.5,17" fill="#fcd34d"/></svg>,
    five_courses: <svg width={s} height={s} viewBox="0 0 36 36"><circle cx="18" cy="18" r="18" fill="#f0fdf4"/><circle cx="18" cy="18" r="9" fill="none" stroke="#16a34a" strokeWidth="1.5"/><polygon points="18,11 20,18 18,16 16,18" fill="#16a34a"/><polygon points="18,25 16,18 18,20 20,18" fill="#dc2626"/><circle cx="18" cy="18" r="1.5" fill="#111"/><line x1="9" y1="18" x2="11" y2="18" stroke="#16a34a" strokeWidth="1.5" strokeLinecap="round"/><line x1="25" y1="18" x2="27" y2="18" stroke="#16a34a" strokeWidth="1.5" strokeLinecap="round"/></svg>,
    ten_courses: <svg width={s} height={s} viewBox="0 0 36 36"><circle cx="18" cy="18" r="18" fill="#fff7ed"/><rect x="12" y="13" width="12" height="14" rx="3" fill="#f97316"/><rect x="15" y="11" width="6" height="4" rx="2" fill="#ea580c"/><rect x="15" y="18" width="6" height="4" rx="1" fill="#fed7aa"/></svg>,
  };
  return icons[id] || <svg width={s} height={s} viewBox="0 0 36 36"><circle cx="18" cy="18" r="18" fill="#f3f4f6"/><text x="18" y="23" textAnchor="middle" fontSize="12" fontWeight="900" fill="#9ca3af" fontFamily="sans-serif">?</text></svg>;
};

const ACHIEVEMENTS = [
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

function getUnlockedBadges(profile) {
  return ACHIEVEMENTS.filter(a => a.check(profile));
}

const SHOP_ITEMS = [
  // ── BANNERS (named after course vibes & famous courses) ──
  { id: "banner_fairway",   type: "banner", label: "Fairway Morning",  price: 400,   level: 1,  preview: "linear-gradient(135deg, #14532d 0%, #22c55e 60%)" },
  { id: "banner_links",     type: "banner", label: "Links Classic",    price: 600,   level: 4,  preview: "linear-gradient(135deg, #78716c 0%, #d6d3d1 60%)" },
  { id: "banner_dusk",      type: "banner", label: "Dusk Round",       price: 800,   level: 8,  preview: "linear-gradient(135deg, #7c2d12 0%, #c2410c 50%, #fbbf24 100%)" },
  { id: "banner_camo",      type: "banner", label: "Course Camo",      price: 900,   level: 11, preview: "repeating-linear-gradient(45deg,#3d5a1e 0px,#3d5a1e 10px,#4a6b25 10px,#4a6b25 20px,#2d4418 20px,#2d4418 30px,#5a7a30 30px,#5a7a30 40px)" },
  { id: "banner_coastal",   type: "banner", label: "Coastal Pines",    price: 1000,  level: 15, preview: "linear-gradient(135deg, #0c4a6e 0%, #0369a1 40%, #7dd3fc 100%)" },
  { id: "banner_highland",  type: "banner", label: "Highland",         price: 1100,  level: 19, preview: "linear-gradient(135deg, #3f6212 0%, #65a30d 60%)" },
  { id: "banner_plaid",     type: "banner", label: "Club Plaid",       price: 1000,  level: 23, preview: "repeating-linear-gradient(0deg,transparent,transparent 10px,rgba(239,68,68,0.3) 10px,rgba(239,68,68,0.3) 12px),repeating-linear-gradient(90deg,#1e3a5f,#1e3a5f 10px,#1a3354 10px,#1a3354 12px)" },
  { id: "banner_pebble",    type: "banner", label: "Pebble Beach",     price: 1200,  level: 27, preview: "linear-gradient(135deg, #0c1a2e 0%, #164e63 50%, #67e8f9 100%)" },
  { id: "banner_midnight",  type: "banner", label: "Night Round",      price: 1200,  level: 31, preview: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 60%)" },
  { id: "banner_crimson",   type: "banner", label: "Red Course",       price: 1400,  level: 35, preview: "linear-gradient(135deg, #450a0a 0%, #b91c1c 60%)" },
  { id: "banner_carbon",    type: "banner", label: "Carbon Driver",    price: 1500,  level: 39, preview: "repeating-linear-gradient(45deg,#1a1a1a 0px,#1a1a1a 4px,#2a2a2a 4px,#2a2a2a 8px)" },
  { id: "banner_purple",    type: "banner", label: "Augusta Dusk",     price: 1600,  level: 43, preview: "linear-gradient(135deg, #3b0764 0%, #7c3aed 60%)" },
  { id: "banner_neon",      type: "banner", label: "Neon Fairway",     price: 1800,  level: 47, preview: "linear-gradient(135deg, #0f172a 0%, #312e81 50%, #0c4a6e 100%)", animated: "pulse", tag: "ANIMATED" },
  { id: "banner_gold",      type: "banner", label: "Gold Member",      price: 2000,  level: 52, preview: "linear-gradient(135deg, #451a03 0%, #b45309 40%, #fbbf24 100%)" },
  { id: "banner_shimmer",   type: "banner", label: "Trophy Gold",      price: 2500,  level: 58, preview: "linear-gradient(90deg,#451a03,#b45309,#fbbf24,#f59e0b,#b45309,#451a03)", animated: "shimmer" },
  { id: "banner_aurora",    type: "banner", label: "Aurora Pines",     price: 3000,  level: 65, preview: "linear-gradient(-45deg,#0c4a6e,#3b0764,#052e16,#0f172a,#164e63)", animated: "aurora" },
  { id: "banner_masters",   type: "banner", label: "The Masters",      price: 4000,  level: 75, preview: "linear-gradient(135deg, #052e16 0%, #14532d 30%, #fbbf24 70%, #052e16 100%)", animated: "shimmer" },
  { id: "banner_goat",      type: "banner", label: "G.O.A.T.",         price: 9999,  level: 99, preview: "linear-gradient(90deg,#7c3aed,#3b82f6,#22c55e,#f59e0b,#ef4444,#7c3aed)", animated: "aurora", tag: "LEGENDARY" },
  { id: "banner_snow",      type: "banner", label: "Winter Course",    price: 1200,  level: 5,  preview: "linear-gradient(135deg,#e0f2fe 0%,#bae6fd 50%,#7dd3fc 100%)", seasonal: true, seasonLabel: "WINTER" },
  { id: "banner_harvest",   type: "banner", label: "Fall Classic",     price: 1200,  level: 5,  preview: "linear-gradient(135deg,#431407 0%,#9a3412 40%,#d97706 100%)", seasonal: true, seasonLabel: "FALL" },
  { id: "banner_sunrise",   type: "banner", label: "Sunrise Tee Time", price: 600,   level: 6,  preview: "linear-gradient(135deg,#431407 0%,#f97316 40%,#fde68a 100%)" },
  { id: "banner_overcast",  type: "banner", label: "Overcast Round",   price: 800,   level: 10, preview: "linear-gradient(135deg,#374151 0%,#6b7280 60%,#9ca3af 100%)" },
  { id: "banner_dogleg",    type: "banner", label: "Dogleg Left",      price: 900,   level: 12, preview: "linear-gradient(135deg,#052e16 0%,#14532d 45%,#4d7c0f 100%)" },
  { id: "banner_water",     type: "banner", label: "Water Carry",      price: 900,   level: 14, preview: "linear-gradient(135deg,#0c4a6e 0%,#0284c7 50%,#7dd3fc 100%)" },
  { id: "banner_18th",      type: "banner", label: "18th Hole",        price: 1100,  level: 17, preview: "linear-gradient(135deg,#1c1917 0%,#44403c 50%,#fbbf24 100%)" },
  { id: "banner_major",     type: "banner", label: "Major Ready",      price: 1200,  level: 21, preview: "linear-gradient(135deg,#0f172a 0%,#1e3a8a 50%,#fbbf24 100%)" },
  { id: "banner_teebox",    type: "banner", label: "Tee Box",          price: 1200,  level: 25, preview: "linear-gradient(135deg,#f8fafc 0%,#cbd5e1 60%)" },
  { id: "banner_back9",     type: "banner", label: "Back Nine Blues",  price: 1400,  level: 29, preview: "linear-gradient(135deg,#1e1b4b 0%,#312e81 45%,#0c4a6e 100%)" },
  { id: "banner_sunday",    type: "banner", label: "Sunday Pin",       price: 1400,  level: 33, preview: "linear-gradient(135deg,#450a0a 0%,#ef4444 50%,#f9fafb 100%)" },
  { id: "banner_range",     type: "banner", label: "Range Stripes",    price: 1700,  level: 45, preview: "repeating-linear-gradient(90deg,#f9fafb 0px,#f9fafb 18px,#d1d5db 18px,#d1d5db 20px)" },
  { id: "banner_iron",      type: "banner", label: "Iron Curtain",     price: 2000,  level: 55, preview: "linear-gradient(135deg,#111827 0%,#374151 50%,#6b7280 100%)" },

  // ── AVATAR BORDERS ──
  { id: "border_basic",       type: "border", label: "Starter Ring",   price: 200,   level: 1,  preview: "#6b7280", style: { border: "3px solid #6b7280" } },
  { id: "border_sand",        type: "border", label: "Sand Wash",      price: 350,   level: 2,  preview: "#d97706", style: { border: "3px dashed #d97706" } },
  { id: "border_dashed",      type: "border", label: "Dashed Green",   price: 500,   level: 3,  preview: "#22c55e", style: { border: "3px dashed #22c55e" } },
  { id: "border_pine",        type: "border", label: "Pine Straw",     price: 550,   level: 5,  preview: "#15803d", style: { border: "3px dotted #15803d" } },
  { id: "border_silver",      type: "border", label: "Silver Club",    price: 650,   level: 9,  preview: "#94a3b8", style: { border: "3px solid #94a3b8", boxShadow: "0 0 10px rgba(148,163,184,0.4)" } },
  { id: "border_gold",        type: "border", label: "Gold Ring",      price: 700,   level: 7,  preview: "#f59e0b", style: { border: "3px solid #f59e0b", boxShadow: "0 0 14px rgba(245,158,11,0.5)" } },
  { id: "border_cobalt",      type: "border", label: "Water Hazard",   price: 900,   level: 15, preview: "#3b82f6", style: { border: "3px solid #3b82f6", boxShadow: "0 0 14px rgba(59,130,246,0.5)" } },
  { id: "border_purple",      type: "border", label: "Twilight",       price: 800,   level: 13, preview: "#a855f7", style: { border: "3px solid #a855f7", boxShadow: "0 0 14px rgba(168,85,247,0.5)" } },
  { id: "border_neon_green",  type: "border", label: "Neon Green",     price: 1000,  level: 18, preview: "#4ade80", style: { border: "3px solid #4ade80", boxShadow: "0 0 20px rgba(74,222,128,0.8)" } },
  { id: "border_crimson",     type: "border", label: "Sunday Red",     price: 1100,  level: 21, preview: "#ef4444", style: { border: "3px solid #ef4444", boxShadow: "0 0 14px rgba(239,68,68,0.5)" } },
  { id: "border_red",         type: "border", label: "Danger Flag",    price: 1100,  level: 24, preview: "#dc2626", style: { border: "3px solid #dc2626", boxShadow: "0 0 14px rgba(220,38,38,0.5)" } },
  { id: "border_moss",        type: "border", label: "Mossy Oak",      price: 1250,  level: 28, preview: "#365314", style: { border: "3px double #365314", boxShadow: "0 0 10px rgba(54,83,20,0.4)" } },
  { id: "border_ice",         type: "border", label: "Frost",          price: 1300,  level: 32, preview: "#67e8f9", style: { border: "3px solid #67e8f9", boxShadow: "0 0 14px rgba(103,232,249,0.5)" } },
  { id: "border_copper",      type: "border", label: "Copper Club",    price: 1400,  level: 36, preview: "#c2410c", style: { border: "3px solid #c2410c", boxShadow: "0 0 14px rgba(194,65,12,0.6)" } },
  { id: "border_double",      type: "border", label: "Double Bogey",   price: 1600,  level: 41, preview: "#f59e0b", style: { border: "3px solid #f59e0b", outline: "3px solid #f59e0b", outlineOffset: "3px", boxShadow: "0 0 14px rgba(245,158,11,0.4)" } },
  { id: "border_midnight",    type: "border", label: "Midnight Blue",  price: 1600,  level: 44, preview: "#1e3a8a", style: { border: "3px solid #1d4ed8", boxShadow: "0 0 18px rgba(29,78,216,0.7)" } },
  { id: "border_white",       type: "border", label: "Platinum",       price: 2200,  level: 53, preview: "#e2e8f0", style: { border: "3px solid #e2e8f0", boxShadow: "0 0 14px rgba(226,232,240,0.6)" } },
  { id: "border_emerald",     type: "border", label: "Emerald Cut",    price: 2800,  level: 63, preview: "#059669", style: { border: "3px double #059669", boxShadow: "0 0 0 2px #34d399, 0 0 20px rgba(5,150,105,0.7)" } },
  { id: "border_rainbow",     type: "border", label: "Rainbow Spin",   price: 3500,  level: 68, preview: "conic",   style: { border: "3px solid transparent", background: "linear-gradient(#1f2937,#1f2937) padding-box, conic-gradient(red,orange,yellow,green,blue,violet,red) border-box", boxShadow: "0 0 16px rgba(255,255,255,0.3)" }, animated: "spin" },
  { id: "border_diamond",     type: "border", label: "Diamond Pin",    price: 5000,  level: 82, preview: "#e0f2fe", style: { border: "3px solid #e0f2fe", outline: "2px solid #bae6fd", outlineOffset: "3px", boxShadow: "0 0 0 5px rgba(186,230,253,0.2), 0 0 24px rgba(255,255,255,0.5)" }, animated: "pulse" },
  { id: "border_birdie",      type: "border", label: "Birdie Blue",    price: 600,   level: 6,  preview: "#38bdf8", style: { border: "3px solid #38bdf8", boxShadow: "0 0 12px rgba(56,189,248,0.5)" } },
  { id: "border_eagle",       type: "border", label: "Eagle Gold",     price: 900,   level: 11, preview: "#f59e0b", style: { border: "3px solid #f59e0b", outline: "2px solid #fbbf24", outlineOffset: "2px", boxShadow: "0 0 16px rgba(245,158,11,0.6)" } },
  { id: "border_ace",         type: "border", label: "Hole In One",    price: 1300,  level: 17, preview: "#f9fafb", style: { border: "3px solid #f9fafb", boxShadow: "0 0 0 2px #f59e0b, 0 0 20px rgba(255,255,255,0.6)" } },
  { id: "border_tour",        type: "border", label: "Tour Pro",       price: 1600,  level: 26, preview: "#0f172a", style: { border: "3px solid #1e293b", outline: "2px solid #fbbf24", outlineOffset: "3px", boxShadow: "0 0 14px rgba(251,191,36,0.5)" } },
  { id: "border_caddie",      type: "border", label: "Caddie Vest",    price: 2000,  level: 35, preview: "#166534", style: { border: "3px solid #166534", boxShadow: "0 0 0 2px #4ade80, 0 0 18px rgba(22,101,52,0.7)" } },
  { id: "border_masters",     type: "border", label: "Augusta Green",  price: 9999,  level: 99, preview: "#22c55e", style: { border: "4px solid #22c55e", boxShadow: "0 0 0 2px #fbbf24, 0 0 20px rgba(34,197,94,0.8)" }, tag: "LEGENDARY" },

  // ── NAMEPLATES ──
  { id: "nameplate_basic",    type: "nameplate", label: "Clean White",    price: 200,   level: 1,  style: { color: "#f9fafb" } },
  { id: "nameplate_sand",     type: "nameplate", label: "Sand Text",      price: 300,   level: 3,  style: { color: "#d97706" } },
  { id: "nameplate_pine",     type: "nameplate", label: "Pine Green",     price: 400,   level: 7,  style: { color: "#22c55e" } },
  { id: "nameplate_shadow",   type: "nameplate", label: "Drop Shadow",    price: 500,   level: 5,  style: { textShadow: "2px 2px 8px rgba(0,0,0,0.9)" } },
  { id: "nameplate_cobalt",   type: "nameplate", label: "Cobalt Blue",    price: 600,   level: 10, style: { color: "#60a5fa", textShadow: "0 0 10px rgba(96,165,250,0.6)" } },
  { id: "nameplate_stroke",   type: "nameplate", label: "Stroke Play",    price: 700,   level: 12, style: { color: "#f9fafb", textShadow: "0 0 0 1px #111, 1px 1px 0 #111, -1px -1px 0 #111, 1px -1px 0 #111, -1px 1px 0 #111" } },
  { id: "nameplate_glow",     type: "nameplate", label: "Green Glow",     price: 800,   level: 16, style: { textShadow: "0 0 10px rgba(34,197,94,0.9),0 0 30px rgba(34,197,94,0.5)" } },
  { id: "nameplate_crimson",  type: "nameplate", label: "Sunday Red",     price: 900,   level: 20, style: { color: "#f87171", textShadow: "0 0 10px rgba(248,113,113,0.7)" } },
  { id: "nameplate_bronze",   type: "nameplate", label: "Bronze Medal",   price: 1000,  level: 27, style: { background: "linear-gradient(180deg,#d97706 0%,#92400e 50%,#d97706 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" } },
  { id: "nameplate_chrome",   type: "nameplate", label: "Chrome",         price: 1200,  level: 29, style: { background: "linear-gradient(180deg,#fff 0%,#94a3b8 50%,#fff 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" } },
  { id: "nameplate_silver",   type: "nameplate", label: "Silver Pin",     price: 1300,  level: 36, style: { background: "linear-gradient(180deg,#e2e8f0 0%,#64748b 50%,#e2e8f0 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" } },
  { id: "nameplate_neon",     type: "nameplate", label: "Neon Fairway",   price: 1500,  level: 44, style: { color: "#4ade80", textShadow: "0 0 8px rgba(74,222,128,0.9), 0 0 30px rgba(74,222,128,0.5)" } },
  { id: "nameplate_fire",     type: "nameplate", label: "Fire Text",      price: 1500,  level: 44, style: { background: "linear-gradient(180deg,#fbbf24 0%,#ef4444 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" } },
  { id: "nameplate_purple",   type: "nameplate", label: "Purple Rain",    price: 1600,  level: 50, style: { background: "linear-gradient(180deg,#c084fc 0%,#7c3aed 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" } },
  { id: "nameplate_ice",      type: "nameplate", label: "Frost Text",     price: 1600,  level: 56, style: { color: "#67e8f9", textShadow: "0 0 10px rgba(103,232,249,0.7)" } },
  { id: "nameplate_rainbow",  type: "nameplate", label: "Rainbow",        price: 2200,  level: 62, style: { background: "linear-gradient(90deg,#22c55e,#3b82f6,#a855f7,#f59e0b,#ef4444)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" } },
  { id: "nameplate_gold",     type: "nameplate", label: "Gold Text",      price: 2500,  level: 71, style: { color: "#fbbf24", textShadow: "0 0 10px rgba(251,191,36,0.6)" } },
  { id: "nameplate_obsidian", type: "nameplate", label: "Obsidian",       price: 3500,  level: 80, style: { background: "linear-gradient(180deg,#475569 0%,#0f172a 60%,#334155 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" } },
  { id: "nameplate_platinum", type: "nameplate", label: "Platinum",       price: 5500,  level: 88, style: { background: "linear-gradient(90deg,#cbd5e1,#fff,#94a3b8,#fff,#cbd5e1)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", textShadow: "none" } },
  { id: "nameplate_legend",   type: "nameplate", label: "Legend",         price: 9999,  level: 99, style: { background: "linear-gradient(90deg,#fbbf24,#f59e0b,#fff,#f59e0b,#fbbf24)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", textShadow: "none" }, tag: "LEGENDARY" },


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

// Firestore rejects writes containing `undefined`. Recursively replace undefined→null.
function sanitizeForFirestore(val) {
  if (val === undefined) return null;
  if (val === null || typeof val !== "object") return val;
  if (Array.isArray(val)) return val.map(sanitizeForFirestore);
  const out = {};
  for (const k of Object.keys(val)) out[k] = sanitizeForFirestore(val[k]);
  return out;
}

async function saveProfileToFirestore(uid, profile) {
  try { await setDoc(doc(db, "users", uid), sanitizeForFirestore(profile), { merge: true }); } catch(e) { console.error(e); }
}

// Recalculates OVR, level, rounds array from stored history for a single profile object
function repairProfile(p) {
  if (!p || !p.history) return p;
  const roundOVRs = p.history.slice(0, 10).map(r => r.roundOVR).filter(v => v != null && !isNaN(v));
  // Users with 0 rounds get a clean slate: OVR 50, all attrs zeroed
  if (roundOVRs.length === 0) {
    return { ...p, ovr: 50, rounds: [], attrs: { PWR: 0, ACC: 0, CON: 0, REC: 0, EFF: 0 }, experience: 0, level: 1, coins: Math.max(0, p.coins || 0) };
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
  return { ...p, ovr: correctOVR, rounds: roundOVRs, experience: correctExperience, level: correctLevel, attrs: correctedAttrs };
}

// Runs on login — silently fixes own profile if OVR is wrong
async function selfRepairProfile(uid, profile) {
  const repaired = repairProfile(profile);
  const ovrDiff = Math.abs((repaired.ovr || 0) - (profile.ovr || 0));
  const xpDiff = Math.abs((repaired.experience || 0) - (profile.experience || 0));
  const levelDiff = Math.abs((repaired.level || 0) - (profile.level || 0));
  if (ovrDiff > 1 || xpDiff > 50 || levelDiff > 0) {
    console.log(`[Club99] Repairing profile for ${uid}: OVR ${profile.ovr}→${repaired.ovr}, XP ${profile.experience}→${repaired.experience}`);
    await saveProfileToFirestore(uid, repaired);
    return repaired;
  }
  return profile;
}

// Admin: repairs ALL users in Firestore (call from console: window.repairAllUsers())
async function repairAllUsersInFirestore() {
  try {
    const snap = await getDocs(collection(db, "users"));
    const users = snap.docs.map(d => ({ uid: d.id, ...d.data() })).filter(u => u.username);
    console.log(`[Club99] Repairing ${users.length} users...`);
    let fixed = 0;
    for (const u of users) {
      const repaired = repairProfile(u);
      const ovrDiff = Math.abs((repaired.ovr || 0) - (u.ovr || 0));
      const xpDiff = Math.abs((repaired.experience || 0) - (u.experience || 0));
      const levelDiff = Math.abs((repaired.level || 0) - (u.level || 0));
      if (ovrDiff > 1 || xpDiff > 50 || levelDiff > 0) {
        console.log(`  Fixing ${u.username}: OVR ${u.ovr}→${repaired.ovr}, XP ${u.experience}→${repaired.experience}, LVL ${u.level}→${repaired.level}`);
        await saveProfileToFirestore(u.uid, repaired);
        fixed++;
      }
    }
    console.log(`[Club99] Done. Fixed ${fixed}/${users.length} users.`);
    return { total: users.length, fixed };
  } catch(e) {
    console.error("[Club99] Repair failed:", e);
    return { error: e.message };
  }
}
async function loadProfileFromFirestore(uid) {
  const ref = doc(db, "users", uid);
  try {
    // Prefer local cache — it includes any pending writes (e.g. liveRound cleared on submit)
    // that haven't been confirmed by the server yet. Falls back to server on cache miss.
    const cached = await getDocFromCache(ref);
    if (cached.exists()) return cached.data();
  } catch { /* cache miss — fall through */ }
  try { const snap = await getDoc(ref); return snap.exists() ? snap.data() : null; } catch { return null; }
}
async function saveCourseToFirestore(courseName, rating, slope) {
  // merge:true so we never clobber community course fields
  try { const id = courseName.toLowerCase().replace(/[^a-z0-9]/g, "_"); await setDoc(doc(db, "courses", id), { name: courseName, rating: parseFloat(rating), slope: parseFloat(slope), updatedAt: Date.now() }, { merge: true }); } catch(e) { console.error(e); }
}
// Upsert a community-contributed course. Pass createIfMissing=true only when creating a brand-new entry.
async function uploadCourseToFirestore(courseData, playerUid, createIfMissing) {
  try {
    const id = courseData.name.toLowerCase().replace(/[^a-z0-9]/g, "_");
    const ref = doc(db, "courses", id);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      if (!createIfMissing) return;
      const holeCount = (courseData.holePars || []).length;
      await setDoc(ref, {
        name: courseData.name,
        location: courseData.location || "",
        rating: parseFloat(courseData.rating) || 72.0,
        slope: parseInt(courseData.slope) || 113,
        par: (courseData.holePars || []).reduce((a, b) => a + (b || 4), 0) || (holeCount === 9 ? 36 : 72),
        holePars: courseData.holePars || [],
        holeYards: courseData.holeYards || [],
        holeCenters: courseData.capturedHoleCenters || {},
        community: true,
        communityVerified: false,
        verificationCount: 1,
        verifiedPlayerUIDs: [playerUid],
        submittedBy: playerUid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      const existing = snap.data();
      const verifiedUIDs = [...(existing.verifiedPlayerUIDs || [])];
      if (!verifiedUIDs.includes(playerUid)) verifiedUIDs.push(playerUid);
      const verificationCount = verifiedUIDs.length;
      const communityVerified = verificationCount >= 5;
      // Average new hole centers with existing positions
      const existingCenters = existing.holeCenters || {};
      const newCenters = courseData.capturedHoleCenters || {};
      const mergedCenters = { ...existingCenters };
      for (const [holeIdx, coords] of Object.entries(newCenters)) {
        if (!mergedCenters[holeIdx]) { mergedCenters[holeIdx] = coords; }
        else { mergedCenters[holeIdx] = { lat: (mergedCenters[holeIdx].lat + coords.lat) / 2, lng: (mergedCenters[holeIdx].lng + coords.lng) / 2 }; }
      }
      await setDoc(ref, { verifiedPlayerUIDs: verifiedUIDs, verificationCount, communityVerified, holeCenters: mergedCenters, updatedAt: serverTimestamp() }, { merge: true });
    }
  } catch(e) { console.error("[Club99] uploadCourseToFirestore:", e); }
}
async function searchCoursesInFirestore(term) {
  try {
    const snap = await getDocs(collection(db, "courses"));
    const all = snap.docs.map(d => d.data());
    return all.filter(c => c.name.toLowerCase().includes(term.toLowerCase())).slice(0, 6);
  } catch { return []; }
}
async function loadLeaderboard() {
  try { const snap = await getDocs(collection(db, "users")); return snap.docs.map(d => ({ uid: d.id, ...d.data() })).filter(u => u.username).sort((a, b) => b.ovr - a.ovr); } catch { return []; }
}
async function removeFriendInDb(uid, friendUid) {
  await Promise.all([
    deleteDoc(doc(db, "friends", `${uid}_${friendUid}`)).catch(() => {}),
    deleteDoc(doc(db, "friends", `${friendUid}_${uid}`)).catch(() => {}),
  ]);
}
async function createCrewInFirestore(leaderUid, leaderUsername, leaderOvr, leaderLevel, leaderProfilePic, crewName) {
  const nameUpper = crewName.trim().toUpperCase();
  const q = query(collection(db, "crews"), where("name", "==", nameUpper));
  const snap = await getDocs(q);
  if (!snap.empty) throw new Error("NAME_TAKEN");
  const crewRef = await addDoc(collection(db, "crews"), {
    name: nameUpper, leaderUid, leaderUsername,
    members: [{ uid: leaderUid, username: leaderUsername, ovr: leaderOvr, level: leaderLevel || 1, profilePic: leaderProfilePic || null }],
    memberCount: 1, createdAt: serverTimestamp(),
  });
  await updateDoc(doc(db, "users", leaderUid), { crewId: crewRef.id, crewName: nameUpper });
  return crewRef.id;
}
async function requestJoinCrew(crewId, crewName, fromUid, fromUsername, fromOvr, fromLevel, fromProfilePic) {
  const ref = await addDoc(collection(db, "crewRequests"), { crewId, crewName, fromUid, fromUsername, fromOvr, fromLevel: fromLevel || 1, fromProfilePic: fromProfilePic || null, createdAt: serverTimestamp() });
  return ref.id;
}
async function acceptCrewRequest(requestId, crewId, crewName, newMember) {
  await runTransaction(db, async tx => {
    const crewRef = doc(db, "crews", crewId);
    const crewSnap = await tx.get(crewRef);
    if (!crewSnap.exists()) throw new Error("CREW_NOT_FOUND");
    const crew = crewSnap.data();
    if ((crew.members || []).length >= 8) throw new Error("CREW_FULL");
    const updatedMembers = [...(crew.members || []), newMember];
    tx.update(crewRef, { members: updatedMembers, memberCount: updatedMembers.length });
    tx.delete(doc(db, "crewRequests", requestId));
    tx.update(doc(db, "users", newMember.uid), { crewId, crewName });
  });
}
async function declineCrewRequest(requestId) { await deleteDoc(doc(db, "crewRequests", requestId)); }
async function leaveCrewInFirestore(crewId, uid, isLeader, allMembers) {
  if (isLeader) {
    await deleteDoc(doc(db, "crews", crewId));
    for (const m of (allMembers || [])) {
      await updateDoc(doc(db, "users", m.uid), { crewId: null, crewName: null }).catch(() => {});
    }
  } else {
    await runTransaction(db, async tx => {
      const crewRef = doc(db, "crews", crewId);
      const snap = await tx.get(crewRef);
      if (!snap.exists()) return;
      const updated = snap.data().members.filter(m => m.uid !== uid);
      tx.update(crewRef, { members: updated, memberCount: updated.length });
      tx.update(doc(db, "users", uid), { crewId: null, crewName: null });
    });
  }
}
async function fetchPublicCrews() {
  try {
    const q = query(collection(db, "crews"), orderBy("memberCount", "desc"), limit(20));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch { return []; }
}
async function searchUserByUsername(username) {
  try { const snap = await getDocs(collection(db, "users")); return snap.docs.map(d => ({ uid: d.id, ...d.data() })).find(u => u.username === username.toUpperCase()) || null; } catch { return null; }
}
async function sendFriendRequest(fromUid, fromUsername, toUid) {
  try { await setDoc(doc(db, "friendRequests", `${fromUid}_${toUid}`), { from: fromUid, fromUsername, to: toUid, status: "pending", createdAt: Date.now() }); } catch(e) { console.error(e); }
}
async function loadFriendRequests(uid) {
  try { const snap = await getDocs(collection(db, "friendRequests")); return snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(r => r.to === uid && r.status === "pending"); } catch { return []; }
}
async function respondToFriendRequest(requestId, fromUid, toUid, accept) {
  await deleteDoc(doc(db, "friendRequests", requestId));
  if (accept) {
    await setDoc(doc(db, "friends", `${fromUid}_${toUid}`), { users: [fromUid, toUid], createdAt: Date.now() });
    await setDoc(doc(db, "friends", `${toUid}_${fromUid}`), { users: [toUid, fromUid], createdAt: Date.now() });
  }
}
async function loadFriends(uid) {
  try { const snap = await getDocs(collection(db, "friends")); return snap.docs.map(d => d.data()).filter(f => f.users.includes(uid)).map(f => f.users.find(u => u !== uid)); } catch { return []; }
}
async function loadFriendsFeed(friendUids, myUid) {
  try {
    const snap = await getDocs(collection(db, "users"));
    const allUsers = snap.docs.map(d => ({ uid: d.id, ...d.data() }));
    // Include own profile + friends
    const relevant = allUsers.filter(u => u.uid === myUid || friendUids.includes(u.uid));
    const entries = [];
    relevant.forEach(f => {
      (f.history || []).slice(0, 5).forEach(r => entries.push({
        ...r,
        username: f.username,
        ownerUid: f.uid,
        ownerProfilePic: f.profilePic || null,
      }));
    });
    return entries.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 30);
  } catch { return []; }
}
function roundReactionKey(ownerUid, roundId) { return `${ownerUid}_${roundId}`; }
async function loadReactions(ownerUid, roundId) {
  try { const snap = await getDoc(doc(db, "reactions", roundReactionKey(ownerUid, roundId))); return snap.exists() ? snap.data() : {}; } catch { return {}; }
}
async function setReaction(ownerUid, roundId, myUid, reaction) {
  try {
    const key = roundReactionKey(ownerUid, roundId);
    const ref = doc(db, "reactions", key);
    const snap = await getDoc(ref);
    const data = snap.exists() ? snap.data() : {};
    if (data[myUid] === reaction) { const updated = { ...data }; delete updated[myUid]; await setDoc(ref, updated); return updated; }
    else { const updated = { ...data, [myUid]: reaction }; await setDoc(ref, updated); return updated; }
  } catch { return {}; }
}
async function loadComments(ownerUid, roundId) {
  try { const ref = collection(db, "reactions", roundReactionKey(ownerUid, roundId), "comments"); const snap = await getDocs(query(ref, orderBy("createdAt", "asc"), limit(50))); return snap.docs.map(d => ({ id: d.id, ...d.data() })); } catch { return []; }
}
async function addComment(ownerUid, roundId, uid, username, text) {
  try { const ref = collection(db, "reactions", roundReactionKey(ownerUid, roundId), "comments"); await addDoc(ref, { uid, username, text: text.trim(), createdAt: serverTimestamp() }); return true; } catch { return false; }
}
async function loadChallenges() {
  try {
    const snap = await getDocs(collection(db, "challenges"));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.date + a.timeWindow) > (b.date + b.timeWindow) ? 1 : -1);
  } catch { return []; }
}
async function joinChallengeInDb(challengeId, myUid, myUsername, myOvr) {
  try {
    await runTransaction(db, async tx => {
      const ref = doc(db, "challenges", challengeId);
      const snap = await tx.get(ref);
      if (!snap.exists()) return;
      const data = snap.data();
      const already = (data.joinedBy || []).some(u => u.uid === myUid);
      if (!already) tx.update(ref, { joinedBy: [...(data.joinedBy || []), { uid: myUid, username: myUsername, ovr: myOvr || 0 }] });
    });
    return true;
  } catch { return false; }
}
async function deleteChallengeInDb(challengeId) {
  try { await deleteDoc(doc(db, "challenges", challengeId)); return true; } catch { return false; }
}
const CHALLENGE_FORMATS = [
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

async function recordChallengeScore(challengeId, myUid, myUsername, totalScore) {
  try {
    let settled = false, winner = null, wager = 0;
    await runTransaction(db, async tx => {
      const ref = doc(db, "challenges", challengeId);
      const snap = await tx.get(ref);
      if (!snap.exists()) return;
      const data = snap.data();
      if (data.settled) return;
      const updatedScores = { ...(data.scores || {}), [myUid]: totalScore };
      const participants = [{ uid: data.uid, username: data.username }, ...(data.joinedBy || [])];
      const maxPlayers = data.maxPlayers || 2;
      const fmt = CHALLENGE_FORMATS.find(f => f.id === data.format);
      const canAutoSettle = fmt ? fmt.autoSettle : true;
      const allScored = participants.length >= maxPlayers && participants.every(p => updatedScores[p.uid] != null);
      if (allScored && canAutoSettle) {
        winner = participants.reduce((best, p) => updatedScores[p.uid] < updatedScores[best.uid] ? p : best);
        wager = data.wager || 0;
        tx.update(ref, { scores: updatedScores, settled: true, winner });
        if (wager > 0) {
          const winnerRef = doc(db, "users", winner.uid);
          const wSnap = await tx.get(winnerRef);
          if (wSnap.exists()) tx.update(winnerRef, { coins: (wSnap.data().coins || 0) + wager * 2 });
        }
        settled = true;
      } else {
        tx.update(ref, { scores: updatedScores });
      }
    });
    return { settled, winner, wager };
  } catch (e) { console.error(e); return null; }
}
async function submitChallengeReview(challengeId, reviewerUid, review) {
  try {
    await updateDoc(doc(db, "challenges", challengeId), { [`reviews.${reviewerUid}`]: review });
    return true;
  } catch (e) { console.error(e); return false; }
}
async function settleChallengeInDb(challengeId, winner, wager) {
  try {
    await updateDoc(doc(db, "challenges", challengeId), { settled: true, winner });
    if (wager > 0) {
      await runTransaction(db, async tx => {
        const ref = doc(db, "users", winner.uid);
        const snap = await tx.get(ref);
        if (!snap.exists()) return;
        tx.update(ref, { coins: (snap.data().coins || 0) + wager * 2 });
      });
    }
    return true;
  } catch (e) { console.error(e); return false; }
}

function formatChallengeDate(dateStr) {
  if (!dateStr) return dateStr;
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const days = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const s = d === 1 || d === 21 || d === 31 ? "st" : d === 2 || d === 22 ? "nd" : d === 3 || d === 23 ? "rd" : "th";
  return `${days[date.getDay()]}, ${months[m-1]} ${d}${s}`;
}

function ChallengeCard({ challenge, myUid, myUsername, myCoins, onJoin, onDelete, onSettle, onReview, onStartRound, onViewProfile }) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [settling, setSettling] = useState(false);
  const [settleTarget, setSettleTarget] = useState(null);
  const [reviewStars, setReviewStars] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [reviewBusy, setReviewBusy] = useState(false);
  const [booked, setBooked] = useState(false);
  const alreadyJoined = (challenge.joinedBy || []).some(u => u.uid === myUid);
  const isOwn = challenge.uid === myUid;
  const isParticipant = isOwn || alreadyJoined;
  const joinedCount = (challenge.joinedBy || []).length;
  const wager = challenge.wager || 0;
  const maxPlayers = challenge.maxPlayers || 2;
  const isFull = joinedCount >= maxPlayers - 1;
  const fmt = CHALLENGE_FORMATS.find(f => f.id === challenge.format) || CHALLENGE_FORMATS[0];
  const canAffordJoin = myCoins >= wager;
  const myReview = (challenge.reviews || {})[myUid];
  // For 1v1 the opponent is one person; for group formats it's all other participants
  const opponent = isOwn ? (challenge.joinedBy || [])[0] : { uid: challenge.uid, username: challenge.username };

  async function handleConfirmJoin() {
    if (wager > 0 && !canAffordJoin) { setJoinError(`You need ${wager.toLocaleString()} coins to join this wager.`); return; }
    setJoining(true);
    setJoinError("");
    try {
      await addDoc(collection(db, "notifications"), {
        toUid: challenge.uid,
        type: "challenge_joined",
        fromUsername: myUsername,
        course: challenge.course,
        date: challenge.date,
        createdAt: serverTimestamp(),
      });
    } catch {}
    await onJoin(challenge.id, wager);
    setJoining(false);
    setShowConfirm(false);
  }

  async function handleSettle(winner) {
    setSettling(true);
    await onSettle(challenge.id, winner, wager);
    setSettling(false);
    setSettleTarget(null);
  }

  async function handleReview() {
    if (!reviewStars) return;
    setReviewBusy(true);
    const review = { rating: reviewStars, text: reviewText.trim(), reviewerUsername: myUsername, targetUid: opponent?.uid, targetUsername: opponent?.username, createdAt: new Date().toISOString() };
    await onReview(challenge.id, myUid, review);
    setReviewBusy(false);
  }

  const dateLabel = `${formatChallengeDate(challenge.date)} • ${challenge.timeWindow}`;

  return (
    <>
      <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e5e7eb", boxShadow: "0 2px 8px rgba(0,0,0,0.06)", marginBottom: 12, overflow: "hidden", animation: "fadeUp 0.3s ease" }}>

        {/* ── Header: avatar + username / OVR badge ── */}
        <div style={{ padding: "16px 16px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button onClick={() => onViewProfile?.({ uid: challenge.uid, username: challenge.username, profilePic: challenge.profilePic, ovr: challenge.ovr })} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", width: 46, height: 46, borderRadius: "50%", background: "#f3f4f6", overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid rgba(125,162,126,0.22)" }}>
              {challenge.profilePic
                ? <img src={challenge.profilePic} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" />
                : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>}
            </button>
            <div>
              <button onClick={() => onViewProfile?.({ uid: challenge.uid, username: challenge.username, profilePic: challenge.profilePic, ovr: challenge.ovr })} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 16, fontWeight: 900, fontFamily: "Bebas Neue", letterSpacing: 1.2, color: "#111827", lineHeight: 1.1 }}>{challenge.username}</button>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
                <span style={{ fontSize: 10, fontWeight: 800, color: Theme.primaryGreen, background: "rgba(125,162,126,0.1)", borderRadius: 6, padding: "2px 7px", letterSpacing: 0.5 }}>{fmt.label}</span>
                <span style={{ fontSize: 10, color: "#9ca3af", fontWeight: 600 }}>{joinedCount + 1}/{maxPlayers} joined</span>
              </div>
            </div>
          </div>

          {/* Poster OVR badge */}
          <div style={{ background: "rgba(125,162,126,0.08)", border: "1.5px solid rgba(125,162,126,0.28)", borderRadius: 10, padding: "5px 11px", textAlign: "center", flexShrink: 0 }}>
            <div style={{ fontSize: 22, fontWeight: 900, fontFamily: "Bebas Neue", color: Theme.primaryGreen, lineHeight: 1 }}>{challenge.ovr || "—"}</div>
            <div style={{ fontSize: 8, fontWeight: 800, color: Theme.primaryGreen, letterSpacing: 1.5, opacity: 0.75, marginTop: 1 }}>OVR</div>
          </div>
        </div>

        {/* ── Divider ── */}
        <div style={{ height: 1, background: "#f3f4f6", margin: "0 16px" }} />

        {/* ── Course + Date/Time ── */}
        <div style={{ padding: "13px 16px 16px", display: "flex", flexDirection: "column", gap: 9 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={Theme.primaryGreen} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
            <span style={{ fontSize: 14, fontWeight: 800, color: "#111827" }}>{challenge.course}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            <span style={{ fontSize: 13, color: "#374151", fontWeight: 600 }}>{dateLabel}</span>
          </div>
          {challenge.wager > 0 && (
            <div style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "rgba(234,179,8,0.1)", border: "1.5px solid rgba(234,179,8,0.35)", borderRadius: 20, padding: "4px 10px", alignSelf: "flex-start" }}>
              <span style={{ fontSize: 13 }}>🪙</span>
              <span style={{ fontSize: 12, fontWeight: 800, color: "#b45309" }}>{challenge.wager.toLocaleString()} coin wager</span>
            </div>
          )}
          {challenge.message ? (
            <div style={{ fontSize: 13, color: "#4b5563", fontStyle: "italic", lineHeight: 1.45, paddingTop: 2 }}>"{challenge.message}"</div>
          ) : null}
          {/* Roster — all participants with OVR */}
          {(() => {
            const allPlayers = [
              { uid: challenge.uid, username: challenge.username, ovr: challenge.ovr, isOwner: true },
              ...(challenge.joinedBy || []).map(u => ({ ...u, isOwner: false })),
            ];
            const slots = maxPlayers - allPlayers.length;
            return (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, paddingTop: 2 }}>
                {allPlayers.map(p => (
                  <div key={p.uid} style={{ display: "flex", alignItems: "center", gap: 5, background: p.isOwner ? "rgba(125,162,126,0.08)" : "#f3f4f6", border: p.isOwner ? "1px solid rgba(125,162,126,0.25)" : "1px solid #e5e7eb", borderRadius: 20, padding: "4px 10px 4px 6px" }}>
                    <div style={{ background: Theme.primaryGreen, borderRadius: "50%", width: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <span style={{ fontSize: 9, fontWeight: 900, color: "#fff", fontFamily: "Bebas Neue", letterSpacing: 0.3 }}>{p.ovr || "—"}</span>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#374151" }}>{p.username}</span>
                    {p.isOwner && <span style={{ fontSize: 9, color: Theme.primaryGreen, fontWeight: 800 }}>HOST</span>}
                  </div>
                ))}
                {Array.from({ length: slots }).map((_, i) => (
                  <div key={`open-${i}`} style={{ display: "flex", alignItems: "center", gap: 5, background: "#fafafa", border: "1px dashed #d1d5db", borderRadius: 20, padding: "4px 10px 4px 6px" }}>
                    <div style={{ width: 18, height: 18, borderRadius: "50%", border: "1.5px dashed #d1d5db", flexShrink: 0 }} />
                    <span style={{ fontSize: 11, color: "#9ca3af", fontWeight: 600 }}>Open</span>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>

        {/* ── Action ── */}
        <div style={{ padding: "0 16px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
          {challenge.settled ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "12px 0", background: "rgba(234,179,8,0.08)", border: "1.5px solid rgba(234,179,8,0.3)", borderRadius: 12 }}>
                <span style={{ fontSize: 18 }}>🏆</span>
                <div>
                  <span style={{ fontSize: 13, fontWeight: 800, color: "#b45309" }}>{challenge.winner?.username} won{wager > 0 ? ` · 🪙 ${(wager * 2).toLocaleString()} coins` : ""}!</span>
                  {challenge.scores && (() => {
                    const participants = [{ uid: challenge.uid, username: challenge.username }, ...(challenge.joinedBy || [])];
                    return (
                      <div style={{ fontSize: 11, color: "#92400e", marginTop: 2 }}>
                        {participants.map(p => `${p.username}: ${challenge.scores[p.uid] ?? "—"}`).join("  ·  ")}
                      </div>
                    );
                  })()}
                </div>
              </div>
              {/* Review section — only for participants who haven't reviewed yet */}
              {isParticipant && opponent && (
                myReview ? (
                  <div style={{ padding: "10px 14px", background: "#f9fafb", borderRadius: 12 }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: "#9ca3af", letterSpacing: 1.2, marginBottom: 4 }}>YOUR REVIEW</div>
                    <div style={{ display: "flex", gap: 2, marginBottom: 4 }}>
                      {[1,2,3,4,5].map(s => <span key={s} style={{ fontSize: 16, color: s <= myReview.rating ? "#f59e0b" : "#d1d5db" }}>★</span>)}
                    </div>
                    {myReview.text && <div style={{ fontSize: 12, color: "#6b7280", fontStyle: "italic" }}>"{myReview.text}"</div>}
                  </div>
                ) : (
                  <div style={{ padding: "12px 14px", background: "#f9fafb", borderRadius: 12 }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: "#9ca3af", letterSpacing: 1.2, marginBottom: 8 }}>RATE {opponent.username?.toUpperCase()}</div>
                    <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
                      {[1,2,3,4,5].map(s => (
                        <button key={s} onClick={() => setReviewStars(s)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 24, color: s <= reviewStars ? "#f59e0b" : "#d1d5db", padding: 0, lineHeight: 1 }}>★</button>
                      ))}
                    </div>
                    <textarea
                      value={reviewText}
                      onChange={e => setReviewText(e.target.value)}
                      placeholder="Leave a comment… (optional)"
                      maxLength={200}
                      rows={2}
                      style={{ width: "100%", padding: "8px 10px", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 12, fontFamily: "inherit", resize: "none", boxSizing: "border-box", outline: "none" }}
                    />
                    <button
                      onClick={handleReview}
                      disabled={!reviewStars || reviewBusy}
                      style={{ marginTop: 8, width: "100%", padding: "10px 0", background: reviewStars ? Theme.primaryGreen : "#e5e7eb", border: "none", borderRadius: 10, color: reviewStars ? "#fff" : "#9ca3af", fontWeight: 800, fontSize: 13, cursor: reviewStars ? "pointer" : "default" }}
                    >
                      {reviewBusy ? "Submitting…" : "Submit Review"}
                    </button>
                  </div>
                )
              )}
              {/* Show opponent's review of you */}
              {isParticipant && opponent && (challenge.reviews || {})[opponent.uid] && (
                <div style={{ padding: "10px 14px", background: "#f9fafb", borderRadius: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: "#9ca3af", letterSpacing: 1.2, marginBottom: 4 }}>{opponent.username}'s REVIEW</div>
                  <div style={{ display: "flex", gap: 2, marginBottom: 4 }}>
                    {[1,2,3,4,5].map(s => <span key={s} style={{ fontSize: 16, color: s <= (challenge.reviews || {})[opponent.uid].rating ? "#f59e0b" : "#d1d5db" }}>★</span>)}
                  </div>
                  {(challenge.reviews || {})[opponent.uid].text && <div style={{ fontSize: 12, color: "#6b7280", fontStyle: "italic" }}>"{(challenge.reviews || {})[opponent.uid].text}"</div>}
                </div>
              )}
            </div>
          ) : isOwn ? (
            <>
              {joinedCount > 0 ? (
                <>
                  {!(challenge.scores?.[myUid] != null) && (
                    <button
                      onClick={() => onStartRound?.(challenge.id, challenge.course, challenge.teeColor, challenge.holes, challenge.nineHolesSide)}
                      style={{ width: "100%", padding: "13px 0", background: "#111827", border: "none", borderRadius: 12, color: "#fff", fontWeight: 800, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, letterSpacing: 0.5, boxSizing: "border-box" }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8" fill="currentColor" stroke="none"/></svg>
                      Start Round
                    </button>
                  )}
                  {challenge.scores?.[myUid] != null && (
                    <div style={{ textAlign: "center", fontSize: 12, color: "#9ca3af", fontWeight: 700 }}>Score submitted: {challenge.scores[myUid]}</div>
                  )}
                  <a
                    href={`https://www.golfnow.com/tee-times/search?when=${challenge.date}&searchQuery=${encodeURIComponent(challenge.course)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setBooked(false)}
                    style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, width: "100%", padding: "13px 0", background: Theme.primaryGreen, border: "none", borderRadius: 12, color: "#fff", fontWeight: 800, fontSize: 14, textDecoration: "none", boxSizing: "border-box" }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                    Book on GolfNow
                  </a>
                  {!booked ? (
                    <button
                      onClick={() => setBooked(true)}
                      style={{ width: "100%", padding: "11px 0", background: "transparent", border: `1.5px solid ${Theme.primaryGreen}`, borderRadius: 12, color: Theme.primaryGreen, fontWeight: 800, fontSize: 13, cursor: "pointer", boxSizing: "border-box" }}
                    >
                      ✓ Booked
                    </button>
                  ) : (
                    <div style={{ width: "100%", padding: "11px 0", background: "rgba(125,162,126,0.12)", border: `1.5px solid ${Theme.primaryGreen}`, borderRadius: 12, color: Theme.primaryGreen, fontWeight: 800, fontSize: 13, textAlign: "center", boxSizing: "border-box" }}>
                      ✓ Tee Time Booked!
                    </div>
                  )}
                  {wager > 0 && (
                    settleTarget ? (
                      <div style={{ background: "#f9fafb", borderRadius: 12, padding: "14px", marginTop: 4 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 10, textAlign: "center" }}>
                          Award <strong style={{ color: "#b45309" }}>🪙 {(wager * 2).toLocaleString()} coins</strong> to {settleTarget.username}?
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button onClick={() => setSettleTarget(null)} style={{ flex: 1, padding: "10px 0", background: "#f3f4f6", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, color: "#374151", cursor: "pointer" }}>Cancel</button>
                          <button onClick={() => handleSettle(settleTarget)} disabled={settling} style={{ flex: 1, padding: "10px 0", background: "rgba(234,179,8,0.9)", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 800, color: "#fff", cursor: settling ? "default" : "pointer" }}>{settling ? "Saving…" : "Confirm"}</button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ marginTop: 4 }}>
                        <div style={{ fontSize: 10, fontWeight: 800, color: "#9ca3af", letterSpacing: 1.5, textAlign: "center", marginBottom: 7 }}>DECLARE WINNER</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                          <button onClick={() => setSettleTarget({ uid: challenge.uid, username: challenge.username })} style={{ flex: "1 1 calc(50% - 4px)", padding: "10px 6px", background: "rgba(234,179,8,0.1)", border: "1.5px solid rgba(234,179,8,0.35)", borderRadius: 10, fontSize: 12, fontWeight: 800, color: "#b45309", cursor: "pointer" }}>🏆 I Won</button>
                          {(challenge.joinedBy || []).map(u => (
                            <button key={u.uid} onClick={() => setSettleTarget(u)} style={{ flex: "1 1 calc(50% - 4px)", padding: "10px 6px", background: "rgba(234,179,8,0.1)", border: "1.5px solid rgba(234,179,8,0.35)", borderRadius: 10, fontSize: 12, fontWeight: 800, color: "#b45309", cursor: "pointer" }}>🏆 {u.username} Won</button>
                          ))}
                        </div>
                      </div>
                    )
                  )}
                </>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ padding: "12px 0", background: "rgba(125,162,126,0.07)", borderRadius: 12, textAlign: "center", fontSize: 13, fontWeight: 800, color: Theme.primaryGreen, letterSpacing: 0.3 }}>
                    {`Waiting for players… (${joinedCount + 1}/${maxPlayers})`}
                  </div>
                </div>
              )}
              {confirmDelete ? (
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <button onClick={() => setConfirmDelete(false)} style={{ flex: 1, padding: "10px 0", background: "#f3f4f6", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, color: "#374151", cursor: "pointer" }}>Cancel</button>
                  <button onClick={() => onDelete(challenge.id, wager, joinedCount)} style={{ flex: 1, padding: "10px 0", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, fontSize: 13, fontWeight: 800, color: "#dc2626", cursor: "pointer" }}>Delete</button>
                </div>
              ) : (
                <button onClick={() => setConfirmDelete(true)} style={{ width: "100%", marginTop: 8, padding: "9px 0", background: "none", border: "none", fontSize: 12, fontWeight: 700, color: "#9ca3af", cursor: "pointer" }}>
                  Delete challenge
                </button>
              )}
            </>
          ) : alreadyJoined ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ width: "100%", padding: "10px 0", background: "#f0fdf4", border: `1.5px solid ${Theme.primaryGreen}`, borderRadius: 12, color: Theme.primaryGreen, fontWeight: 800, fontSize: 13, textAlign: "center" }}>✓  Joined</div>
              {!(challenge.scores?.[myUid] != null) && (
                <button
                  onClick={() => onStartRound?.(challenge.id, challenge.course, challenge.teeColor, challenge.holes, challenge.nineHolesSide)}
                  style={{ width: "100%", padding: "13px 0", background: "#111827", border: "none", borderRadius: 12, color: "#fff", fontWeight: 800, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, letterSpacing: 0.5 }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8" fill="currentColor" stroke="none"/></svg>
                  Start Round
                </button>
              )}
              {challenge.scores?.[myUid] != null && (
                <div style={{ textAlign: "center", fontSize: 12, color: "#9ca3af", fontWeight: 700 }}>Score submitted: {challenge.scores[myUid]}</div>
              )}
            </div>
          ) : (
            <button
              onClick={() => !isFull && setShowConfirm(true)}
              disabled={isFull}
              style={{ width: "100%", padding: "13px 0", background: isFull ? "#f3f4f6" : Theme.primaryGreen, border: "none", borderRadius: 12, color: isFull ? "#9ca3af" : "#fff", fontWeight: 800, fontSize: 14, cursor: isFull ? "default" : "pointer", transition: "background 0.15s", letterSpacing: 0.3 }}
            >
              {isFull ? "Lobby Full" : "Join Challenge"}
            </button>
          )}
        </div>
      </div>

      {/* ── Confirmation modal ── */}
      {showConfirm && (
        <div onClick={() => setShowConfirm(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 400, padding: "0 28px" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 20, padding: "28px 24px 24px", width: "100%", maxWidth: 360, animation: "fadeUp 0.2s ease" }}>
            <div style={{ fontSize: 22, fontWeight: 900, fontFamily: "Bebas Neue", letterSpacing: 1, marginBottom: 14 }}>JOIN THIS ROUND?</div>
            <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 6 }}>
              You're joining <strong style={{ color: "#111827" }}>{challenge.username}</strong>'s challenge at:
            </div>
            <div style={{ background: "#f9fafb", borderRadius: 12, padding: "12px 14px", marginBottom: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: "#111827", marginBottom: 4 }}>{challenge.course}</div>
              <div style={{ fontSize: 13, color: "#6b7280" }}>{dateLabel}</div>
              {challenge.wager > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 8, padding: "6px 10px", background: "rgba(234,179,8,0.1)", border: "1.5px solid rgba(234,179,8,0.35)", borderRadius: 10 }}>
                  <span style={{ fontSize: 14 }}>🪙</span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: "#b45309" }}>This round has a {challenge.wager.toLocaleString()} coin wager</span>
                </div>
              )}
            </div>
            {wager > 0 && !canAffordJoin && (
              <div style={{ marginBottom: 12, padding: "10px 14px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, fontSize: 12, fontWeight: 700, color: "#dc2626" }}>
                You need {wager.toLocaleString()} coins to join. Your balance: {myCoins.toLocaleString()}.
              </div>
            )}
            {joinError && <div style={{ marginBottom: 12, padding: "10px 14px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, fontSize: 12, fontWeight: 700, color: "#dc2626" }}>{joinError}</div>}
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => { setShowConfirm(false); setJoinError(""); }} style={{ flex: 1, padding: "13px 0", background: "#f3f4f6", border: "none", borderRadius: 12, fontSize: 13, fontWeight: 700, color: "#374151", cursor: "pointer" }}>Cancel</button>
              <button onClick={handleConfirmJoin} disabled={joining || (wager > 0 && !canAffordJoin)} style={{ flex: 2, padding: "13px 0", background: (wager > 0 && !canAffordJoin) ? "#e5e7eb" : Theme.primaryGreen, border: "none", borderRadius: 12, fontSize: 13, fontWeight: 800, color: (wager > 0 && !canAffordJoin) ? "#9ca3af" : "#fff", cursor: (joining || (wager > 0 && !canAffordJoin)) ? "default" : "pointer" }}>
                {joining ? "Joining…" : "Confirm Join"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
function compressImage(dataUrl, maxSize = 200, maxBytes = 200000) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      // Scale so longest side = maxSize, never upscale
      const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      let quality = 0.85;
      let result = canvas.toDataURL("image/jpeg", quality);
      while (result.length > maxBytes && quality > 0.2) {
        quality = Math.round((quality - 0.1) * 10) / 10;
        result = canvas.toDataURL("image/jpeg", quality);
      }
      resolve(result);
    };
    img.src = dataUrl;
  });
}
function saveProfilePic(pic) { try { if (pic) localStorage.setItem("club99_pic", pic); else localStorage.removeItem("club99_pic"); } catch {} }
function loadProfilePic() { try { return localStorage.getItem("club99_pic") || null; } catch { return null; } }


export default function GolfApp() {
  const [profile, setProfile] = useState(BLANK_PROFILE);
  const [authUser, setAuthUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Expose admin repair tool to browser console
  useEffect(() => { window.repairAllUsers = repairAllUsersInFirestore; }, []);
  const [authMode, setAuthMode] = useState("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authUsername, setAuthUsername] = useState("");
  const [authError, setAuthError] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [tab, setTab] = useState("profile");
  const [animOVR, setAnimOVR] = useState(50);
  const [editingName, setEditingName] = useState(false);
  const [username, setUsername] = useState("");
  const [flash, setFlash] = useState(null);
  const [badgeFlash, setBadgeFlash] = useState(null);
  const [selectedBadge, setSelectedBadge] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [showBadgeManager, setShowBadgeManager] = useState(false);
  const [confirmDeleteRound, setConfirmDeleteRound] = useState(false);
  const [shopCategory, setShopCategory] = useState("banner");
  const [shopConfirm, setShopConfirm] = useState(null);
  const [coinShopPack, setCoinShopPack] = useState(null);
  const [coinPaymentBusy, setCoinPaymentBusy] = useState(false);
  const [coinPaymentError, setCoinPaymentError] = useState("");
  const [coinPaymentSuccess, setCoinPaymentSuccess] = useState(false);
  const [coinClientSecret, setCoinClientSecret] = useState(null);
  const stripeRef = useRef(null);
  const cardElementRef = useRef(null);
  const [shopPreview, setShopPreview] = useState(null);
  const [profilePic, setProfilePic] = useState(loadProfilePic());
  const [showTierSub, setShowTierSub] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isHandicapView, setIsHandicapView] = useState(false); // toggles OVR block → Handicap Index
  const profilePicRef = useRef();
  const [courseSuggestions, setCourseSuggestions] = useState([]);
  const [selectedApiCourse, setSelectedApiCourse] = useState(null); // full GolfCourseAPI course object
  const [leaderboard, setLeaderboard] = useState([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [leaderboardView, setLeaderboardView] = useState("friends");
  const [globalLeaderboard, setGlobalLeaderboard] = useState([]);
  const [expandedCrewUid, setExpandedCrewUid] = useState(null);
  const [challenges, setChallenges] = useState([]);
  const [challengesLoading, setChallengesLoading] = useState(false);
  const [showChallengeModal, setShowChallengeModal] = useState(false);
  const [challengeStep, setChallengeStep] = useState(1);
  const [challengeForm, setChallengeForm] = useState({ courseQuery: "", courseName: "", date: "", timeFrom: "", timeTo: "", message: "", wager: "", format: "stroke", playerCount: 2, slots: ["A", "B"], teeColor: "white", holes: 18, nineHolesSide: "front" });
  const [challengeCourseSuggestions, setChallengeCourseSuggestions] = useState([]);
  const [challengeBusy, setChallengeBusy] = useState(false);
  const [challengePostError, setChallengePostError] = useState("");
  const challengeAutoSwitchedRef = useRef(false);
  const [activeChallengeId, setActiveChallengeId] = useState(null);
  // ── CREW STATE ──
  const [myCrewData, setMyCrewData] = useState(null);
  const [crewRequests, setCrewRequests] = useState([]);
  const [showCreateCrewModal, setShowCreateCrewModal] = useState(false);
  const [createCrewName, setCreateCrewName] = useState("");
  const [createCrewBusy, setCreateCrewBusy] = useState(false);
  const [createCrewError, setCreateCrewError] = useState("");
  const [crewBrowse, setCrewBrowse] = useState([]);
  const [crewBrowseLoading, setCrewBrowseLoading] = useState(false);
  const [sentCrewRequests, setSentCrewRequests] = useState([]); // crewIds already requested
  const [viewingChallenger, setViewingChallenger] = useState(null); // {uid,username,profilePic,ovr}
  const [challengerStats, setChallengerStats] = useState(null);     // {wins,losses,reviews,loading}
  const [viewingProfile, setViewingProfile] = useState(null);
  const [viewingPic, setViewingPic] = useState(null);
  const [roundSaving, setRoundSaving] = useState(false);
  const [viewingRound, setViewingRound] = useState(null);
  const [showAttrModal, setShowAttrModal] = useState(false);
  const [friends, setFriends] = useState([]);
  const [friendRequests, setFriendRequests] = useState([]);
  const [sentRequests, setSentRequests] = useState([]);
  const [bagEditClub, setBagEditClub] = useState(null);
  const [activeBagClub, setActiveBagClub] = useState(null);
  const [friendSearch, setFriendSearch] = useState("");
  const [friendSearchResult, setFriendSearchResult] = useState(null);
  const [friendSearchMsg, setFriendSearchMsg] = useState("");
  const [friendSearchBusy, setFriendSearchBusy] = useState(false);
  const [friendsData, setFriendsData] = useState([]);
  const [feedItems, setFeedItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [feedLoading, setFeedLoading] = useState(false);

  // ── LIVE ROUND TRACKING STATE ──
  const [liveRound, setLiveRound] = useState(null);
  // liveRound: { course, tee, holes, holePars, scores:[null,...], currentHole:0, startedAt }
  const [playerPos, setPlayerPos] = useState(null); // { lat, lng, accuracy }
  const [gpsPermissionDenied, setGpsPermissionDenied] = useState(false);
  const geoWatchRef = useRef(null);
  const lastPlayerPosRef = useRef(null); // tracks last pos that triggered a state update (5m filter)
  const [shotStartPos, setShotStartPos] = useState(null); // { lat, lng } — first tap of Track Shot
  const [pendingShotYards, setPendingShotYards] = useState(null); // number — triggers club picker modal
  const [pendingShotEndPos, setPendingShotEndPos] = useState(null); // { lat, lng } — where ball landed
  const [shotInFairway, setShotInFairway] = useState(false); // fairway hit toggle in club picker
  const [liveGIRArr, setLiveGIRArr] = useState([]); // greens in regulation per hole
  const [shotHistoryArr, setShotHistoryArr] = useState([]); // [{lat,lng,club,yards}] per hole
  const [liveStrokesArr, setLiveStrokesArr] = useState([]); // total strokes per hole (auto-tracked)
  const [liveAttrGains, setLiveAttrGains] = useState({ PWR: 0, ACC: 0 }); // GPS attr gains this round
  const [attrToast, setAttrToast] = useState(null); // string — "Driver: 285 yds · +PWR", auto-clears
  const [liveWeather, setLiveWeather] = useState(null); // { windSpeed (mph), windDeg (meteorological °) }
  const weatherFetchRef = useRef(0); // timestamp ms of last successful weather fetch
  const [totalDistanceWalked, setTotalDistanceWalked] = useState(0); // yards walked this round
  const [parPickerHole, setParPickerHole] = useState(null); // null=closed, number=hole index for par picker
  const [scorePickerHole, setScorePickerHole] = useState(null); // null=closed, number=hole index for score keypad
  const [showScorecard, setShowScorecard] = useState(false); // full round scorecard modal
  const [livePuttsArr, setLivePuttsArr] = useState([]); // putts per hole, indexed by hole
  const [liveFairwaysArr, setLiveFairwaysArr] = useState([]); // fairways hit per hole, indexed by hole
  const [recTicker, setRecTicker] = useState(0); // increments every 5s to refresh recommendation
  const [teePin, setTeePin] = useState(null); // manually placed tee { lat, lng }
  const [teePinManual, setTeePinManual] = useState(false); // true only when user explicitly dropped a new tee pin
  const [flagPin, setFlagPin] = useState(null); // manually placed flag { lat, lng }
  const [placingMode, setPlacingMode] = useState(null); // null | "tee" | "flag"
  const [communityPinSource, setCommunityPinSource] = useState(false); // true when pins were auto-set from community data
  const [communityPinCount, setCommunityPinCount] = useState(0); // # of community votes for current hole
  const [mapTilesLoading, setMapTilesLoading] = useState(true);
  const [mapZoom, setMapZoom] = useState(17); // mirrors current map zoom — used to scale 3D yardage bubbles
  const [playerSpeed, setPlayerSpeed] = useState(0); // GPS speed in mph
  const playerSpeedRef = useRef(0); // mirror of playerSpeed, readable inside intervals without re-triggering
  const liveRoundRef = useRef(null); // mirror of liveRound, readable inside intervals
  const pendingFitBoundsRef = useRef(null); // { tee:{lat,lng}, flag:{lat,lng} } applied on next map onLoad
  const mapRef = useRef(null); // mapbox-gl map instance — used for programmatic bearing updates
  const mapUserPannedRef = useRef(false); // true when user has manually panned/zoomed the map
  const [mapUserPanned, setMapUserPanned] = useState(false); // drives re-center button visibility
  const pinsRef = useRef({ teePin: null, flagPin: null }); // mirrors pin state for GPS callback closure
  const [targetPin, setTargetPin] = useState(null); // draggable target crosshair { lat, lng }

  // ── CREATE COURSE STATE ──
  const [showCreateCourse, setShowCreateCourse] = useState(false);
  const [newCourseForm, setNewCourseForm] = useState({
    courseName: "", location: "", teeColor: "White", rating: "", slope: "",
    holes: "18", holePars: Array(18).fill(4), holeYards: Array(18).fill(""),
  });

  // ── ROUND ENTRY STATE (new 2-step flow) ──
  // scanState: "idle" | "scores"
  const [scanState, setScanState] = useState("idle");
  const [scanError, setScanError] = useState(null);
  const [editCourse, setEditCourse] = useState("");
  const [editScore, setEditScore] = useState("");
  const [editHoles, setEditHoles] = useState("18");
  const [editNineSide, setEditNineSide] = useState("front"); // "front" | "back"
  const [editRating, setEditRating] = useState("");
  const [editSlope, setEditSlope] = useState("");
  const [editTee, setEditTee] = useState("White");
  const [editHoleScores, setEditHoleScores] = useState([]);
  const [editHolePars, setEditHolePars] = useState([]);

  useEffect(() => {
    if (tab === "leaderboard" && authUser) {
      setLeaderboardLoading(true);
      Promise.all([loadLeaderboard(), loadFriends(authUser.uid)]).then(([all, friendUids]) => {
        setFriends(friendUids);
        setGlobalLeaderboard(all.map(u => ({ ...u, profilePic: u.uid === authUser.uid ? (profilePic || u.profilePic) : u.profilePic })));
        const crew = all.filter(u => u.uid === authUser.uid || friendUids.includes(u.uid)).map(u => ({ ...u, profilePic: u.uid === authUser.uid ? (profilePic || u.profilePic) : u.profilePic }));
        setLeaderboard(crew);
        setLeaderboardLoading(false);
      }).catch(() => setLeaderboardLoading(false));
    }
    if (tab === "challenges" && authUser) {
      setChallengesLoading(true);
      loadChallenges().then(items => {
        setChallenges(items);
        setChallengesLoading(false);
      });
    }
    if (authUser && profile.history && profile.history.length > 0) {
      // Check if own rounds have new reactions since last seen
      const lastSeen = parseInt(localStorage.getItem("club99_feed_seen") || "0");
      const recentRounds = profile.history.slice(0, 5);
      Promise.all(
        recentRounds.map(r => loadReactions(authUser.uid, String(r.id)))
      ).then(allReactions => {
        const totalReactions = allReactions.reduce((sum, rxMap) => {
          return sum + Object.keys(rxMap).filter(uid => uid !== authUser.uid).length;
        }, 0);
        const storedTotal = parseInt(localStorage.getItem("club99_reaction_count") || "0");
        if (totalReactions > storedTotal) {
          setUnreadCount(totalReactions - storedTotal);
        }
        localStorage.setItem("club99_reaction_count", String(totalReactions));
      });
    }
  }, [tab, authUser, profilePic]);

  useEffect(() => {
    if (!authUser) return;
    loadFriends(authUser.uid).then(setFriends);
    const q = query(collection(db, "friendRequests"), where("to", "==", authUser.uid), where("status", "==", "pending"));
    const unsub = onSnapshot(q, snap => { setFriendRequests(snap.docs.map(d => ({ id: d.id, ...d.data() }))); });
    return unsub;
  }, [authUser]);

  // ── CREW DATA — load user's crew when crewId changes ──
  useEffect(() => {
    if (!profile.crewId) { setMyCrewData(null); return; }
    getDoc(doc(db, "crews", profile.crewId)).then(snap => {
      setMyCrewData(snap.exists() ? { id: snap.id, ...snap.data() } : null);
    }).catch(() => setMyCrewData(null));
  }, [profile.crewId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── CREW REQUESTS — real-time listener for leaders ──
  useEffect(() => {
    if (!myCrewData || myCrewData.leaderUid !== authUser?.uid) { setCrewRequests([]); return; }
    const q = query(collection(db, "crewRequests"), where("crewId", "==", myCrewData.id));
    const unsub = onSnapshot(q, snap => setCrewRequests(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return unsub;
  }, [myCrewData?.id, myCrewData?.leaderUid, authUser?.uid]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── GPS TRACKING — start when live round begins, stop when it ends ──
  useEffect(() => {
    if (liveRound && navigator.geolocation) {
      geoWatchRef.current = navigator.geolocation.watchPosition(
        pos => {
          const { latitude: lat, longitude: lng, accuracy } = pos.coords;
          const speedMph = (pos.coords.speed || 0) * 2.237;
          playerSpeedRef.current = speedMph;
          setPlayerSpeed(speedMph);
          const last = lastPlayerPosRef.current;
          // distanceInterval equivalent: only update state when player moves ≥2 metres (2.19 yds)
          const movedYards = last ? haversineYards(last.lat, last.lng, lat, lng) : 999;
          if (movedYards >= 2.19) {
            const newPos = { lat, lng, accuracy };
            if (last) setTotalDistanceWalked(d => d + movedYards);
            lastPlayerPosRef.current = newPos;
            setPlayerPos(newPos);
            if (!mapUserPannedRef.current) {
              const { teePin: tp, flagPin: fp } = pinsRef.current;
              const holeRef = tp || fp;
              const distToHole = holeRef ? haversineYards(lat, lng, holeRef.lat, holeRef.lng) : 0;
              if (!holeRef || distToHole <= 500) {
                mapRef.current?.flyTo({ center: [lng, lat], zoom: 18, animate: false });
              } else {
                // Player is far from the hole — keep map focused on the hole
                const holeCenter = (tp && fp)
                  ? [(tp.lng + fp.lng) / 2, (tp.lat + fp.lat) / 2]
                  : [holeRef.lng, holeRef.lat];
                mapRef.current?.flyTo({ center: holeCenter, zoom: 17, animate: false });
              }
            }
          }
        },
        err => {
          console.warn("GPS error:", err);
          if (err.code === 1) setGpsPermissionDenied(true);
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
      );
    } else {
      if (geoWatchRef.current != null) {
        navigator.geolocation.clearWatch(geoWatchRef.current);
        geoWatchRef.current = null;
      }
      lastPlayerPosRef.current = null;
      setPlayerPos(null);
    }
    return () => {
      if (geoWatchRef.current != null) {
        navigator.geolocation.clearWatch(geoWatchRef.current);
        geoWatchRef.current = null;
      }
    };
  }, [!!liveRound]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── LIVE WEATHER — fetch from OpenWeatherMap when GPS is active, throttled to 10 min ──
  useEffect(() => {
    if (!liveRound || !playerPos || !OWM_API_KEY) return;
    const now = Date.now();
    if (now - weatherFetchRef.current < 10 * 60 * 1000) return;
    weatherFetchRef.current = now;
    fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${playerPos.lat}&lon=${playerPos.lng}&appid=${OWM_API_KEY}&units=imperial`)
      .then(r => r.json())
      .then(data => {
        if (data?.wind) setLiveWeather({ windSpeed: data.wind.speed || 0, windDeg: data.wind.deg ?? 0, temp: data.main?.temp ?? null });
      })
      .catch(() => {});
  }, [playerPos, liveRound]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── RECOMMENDATION TICKER — force re-render every 5s so HUD stays fresh ──
  useEffect(() => {
    if (!liveRound) return;
    const id = setInterval(() => setRecTicker(t => t + 1), 5000);
    return () => clearInterval(id);
  }, [!!liveRound]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── LIVE ROUND REF — keep liveRoundRef in sync so geofencing interval can read it ──
  useEffect(() => { liveRoundRef.current = liveRound; }, [liveRound]);

  // ── AUTO-PLACE TARGET — when both tee and flag are set, init target at midpoint if not already placed ──
  useEffect(() => {
    if (teePin && flagPin && !targetPin) {
      setTargetPin({
        lat: (teePin.lat + flagPin.lat) / 2,
        lng: (teePin.lng + flagPin.lng) / 2,
      });
    }
  }, [teePin, flagPin]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep pinsRef in sync so the GPS callback always has fresh pin values
  useEffect(() => { pinsRef.current = { teePin, flagPin }; }, [teePin, flagPin]);

  // ── PIN AUTO-SAVE — write to localStorage the moment both pins are confirmed ──
  useEffect(() => {
    if (!liveRound || !teePin || !flagPin) return;
    const absHole = liveRound.currentHole + (liveRound.holeOffset || 0);
    savePinLayout(liveRound.course, absHole, teePin, flagPin);
  }, [teePin, flagPin, liveRound?.course, liveRound?.currentHole]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── PIN AUTO-LOAD — restore saved pins; fall back to community average ──
  // pendingFitBoundsRef is read by the Map's onLoad handler to fitBounds after tile load.
  useEffect(() => {
    if (!liveRound) return;
    setCommunityPinSource(false);
    setCommunityPinCount(0);
    pendingFitBoundsRef.current = null;

    const absHole = liveRound.currentHole + (liveRound.holeOffset || 0);
    const saved = loadPinLayout(liveRound.course, absHole);
    if (saved?.teePin) setTeePin(saved.teePin);
    if (saved?.flagPin) setFlagPin(saved.flagPin);

    // Async community fetch — fills any missing tee/flag pins
    const courseKey = communityPinCourseKey(liveRound);
    const holeIdx   = absHole;
    fetchCommunityPins(courseKey, holeIdx).then(community => {
      if (!community) return;
      setCommunityPinCount(community.count);
      let fromCommunity = false;
      if (!saved?.teePin && community.teePin) { setTeePin(community.teePin); fromCommunity = true; }
      if (!saved?.flagPin && community.flagPin) { setFlagPin(community.flagPin); fromCommunity = true; }
      if (fromCommunity) setCommunityPinSource(true);
    });
  }, [liveRound?.course, liveRound?.currentHole]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── AUTO-BEARING — rotate map so the flag is always at the top ──
  // Uses tee→flag bearing so orientation is stable regardless of player position.
  useEffect(() => {
    if (!liveRound || !mapRef.current) return;
    const hg = COURSE_DB[liveRound.course]?.holes?.[liveRound.currentHole + (liveRound.holeOffset || 0)];
    const target = flagPin || hg?.green?.center || hg?.green?.front || null;
    if (!target) return;
    const origin = teePin || hg?.tee || null;
    if (!origin) return;
    const brng = bearingDeg(origin.lat, origin.lng, target.lat, target.lng);
    try { if (!mapUserPannedRef.current) mapRef.current.rotateTo(brng, { duration: 600 }); } catch (_) {}
  }, [flagPin?.lat, flagPin?.lng, teePin?.lat, teePin?.lng, liveRound?.course, liveRound?.currentHole]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── HOLE GEOFENCING — auto-advance hole when player is near green and moving fast ──
  useEffect(() => {
    if (!liveRound) return;
    const id = setInterval(() => {
      const pos = lastPlayerPosRef.current;
      const speed = playerSpeedRef.current;
      if (!pos || speed <= 5) return; // must be moving >5 mph (driving to next tee)
      const r = liveRoundRef.current;
      if (!r) return;
      const holeCount = parseInt(r.holes);
      const ch = r.currentHole;
      if (ch >= holeCount - 1) return; // already on last hole
      const holeGeo = COURSE_DB[r.course]?.holes?.[ch + (r.holeOffset || 0)];
      const gc = holeGeo?.green?.center || holeGeo?.green?.front || holeGeo?.green?.back || null;
      if (!gc) return; // no green coords for this hole
      const dist = haversineYards(pos.lat, pos.lng, gc.lat, gc.lng);
      if (dist >= 30) return; // must be within 30 yards of green
      // Save current pins before clearing (same as chevron navigation)
      const { teePin: tp, flagPin: fp } = pinsRef.current;
      const absHoleIdx = ch + (r.holeOffset || 0);
      if (tp || fp) {
        savePinLayout(r.course, absHoleIdx, tp, fp);
        pushPinVote(communityPinCourseKey(r), absHoleIdx, tp, fp);
      }
      setTeePin(null); setTeePinManual(false); setFlagPin(null); setTargetPin(null); setShotStartPos(null); setPlacingMode(null);
      setLiveRound(prev => prev ? { ...prev, currentHole: Math.min(holeCount - 1, ch + 1) } : prev);
    }, 10000);
    return () => clearInterval(id);
  }, [!!liveRound]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSelectCoinPack(pack) {
    setCoinShopPack(pack);
    setCoinPaymentError("");
    setCoinPaymentSuccess(false);
    setCoinClientSecret(null);
    setCoinPaymentBusy(true);
    try {
      const fns = getFunctions(firebaseApp);
      const createIntent = httpsCallable(fns, "createCoinPaymentIntent");
      const result = await createIntent({ packId: pack.id });
      setCoinClientSecret(result.data.clientSecret);
    } catch (e) {
      setCoinPaymentError(e.message || "Failed to start payment.");
    }
    setCoinPaymentBusy(false);
  }

  async function handleCoinPayment() {
    if (!stripeRef.current || !cardElementRef.current || !coinClientSecret || !coinShopPack) return;
    setCoinPaymentBusy(true);
    setCoinPaymentError("");
    const { error, paymentIntent } = await stripeRef.current.confirmCardPayment(coinClientSecret, {
      payment_method: { card: cardElementRef.current },
    });
    if (error) { setCoinPaymentError(error.message); setCoinPaymentBusy(false); return; }
    try {
      const fns = getFunctions(firebaseApp);
      const fulfill = httpsCallable(fns, "fulfillCoinPurchase");
      await fulfill({ paymentIntentId: paymentIntent.id, packId: coinShopPack.id });
      setProfile(p => ({ ...p, coins: (p.coins || 0) + coinShopPack.coins }));
      setCoinPaymentSuccess(true);
    } catch (e) {
      setCoinPaymentError("Payment succeeded but coin credit failed — please contact support.");
    }
    setCoinPaymentBusy(false);
  }

  // Callback ref — mounts Stripe card element the instant the div enters the DOM
  const { useCallback } = require("react");
  const mountCardElement = useCallback((node) => {
    if (!node) {
      if (cardElementRef.current) { try { cardElementRef.current.unmount(); } catch (_) {} cardElementRef.current = null; }
      return;
    }
    if (!coinClientSecret) return;
    (async () => {
      if (!stripeRef.current) stripeRef.current = await loadStripe(STRIPE_PK);
      if (cardElementRef.current) { try { cardElementRef.current.unmount(); } catch (_) {} }
      // Classic Card Element: do NOT pass clientSecret to elements() — that's for Payment Element only
      const elements = stripeRef.current.elements();
      cardElementRef.current = elements.create("card", {
        style: { base: { fontSize: "16px", color: "#111827", fontFamily: "inherit", "::placeholder": { color: "#9ca3af" } } },
      });
      cardElementRef.current.mount(node);
    })();
  }, [coinClientSecret]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleFriendSearch() {
    if (!friendSearch.trim()) return;
    setFriendSearchBusy(true); setFriendSearchMsg(""); setFriendSearchResult(null);
    const found = await searchUserByUsername(friendSearch.trim());
    if (!found) setFriendSearchMsg("No player found with that username.");
    else if (found.uid === authUser.uid) setFriendSearchMsg("That's you!");
    else if (friends.includes(found.uid)) setFriendSearchMsg("Already friends!");
    else setFriendSearchResult(found);
    setFriendSearchBusy(false);
  }
  async function handleSendRequest(toUser) {
    await sendFriendRequest(authUser.uid, profile.username, toUser.uid);
    setSentRequests(prev => [...prev, toUser.uid]);
    setFriendSearchMsg(`Friend request sent to ${toUser.username}!`);
    setFriendSearchResult(null); setFriendSearch("");
  }
  async function handleRespondRequest(req, accept) {
    try {
      await respondToFriendRequest(req.id, req.from, authUser.uid, accept);
      setFriendRequests(prev => prev.filter(r => r.id !== req.id));
      if (accept) {
        setFriends(prev => [...prev, req.from]);
        loadLeaderboard().then(all => {
          setGlobalLeaderboard(all.map(u => u.uid === authUser.uid ? { ...u, profilePic: profilePic || u.profilePic } : u));
          const updatedFriends = [...friends, req.from];
          const crew = all.filter(u => u.uid === authUser.uid || updatedFriends.includes(u.uid)).map(u => u.uid === authUser.uid ? { ...u, profilePic: profilePic || u.profilePic } : u);
          setLeaderboard(crew);
        });
      }
    } catch(e) { console.error("Friend request response failed:", e); }
  }

  async function handlePostChallenge() {
    if (!authUser || challengeBusy) return;
    setChallengePostError("");
    if (!challengeForm.courseName) {
      setChallengePostError("Please select a course from the suggestions list.");
      return;
    }
    if (!challengeForm.date || !challengeForm.timeFrom || !challengeForm.timeTo) {
      setChallengePostError("Please fill in the date and tee time window.");
      return;
    }
    setChallengeBusy(true);
    const fmt = t => { const [h, m] = t.split(":"); const hr = parseInt(h); return `${hr % 12 || 12}:${m} ${hr >= 12 ? "PM" : "AM"}`; };
    const timeWindow = `${fmt(challengeForm.timeFrom)} – ${fmt(challengeForm.timeTo)}`;
    const tempId = `temp_${Date.now()}`;
    const newChallenge = {
      uid: authUser.uid,
      username: profile.username,
      profilePic: profilePic || null,
      ovr: profile.ovr || 0,
      course: challengeForm.courseName,
      date: challengeForm.date,
      timeWindow,
      message: challengeForm.message.trim(),
      wager: challengeForm.wager ? parseInt(challengeForm.wager) : 0,
      format: challengeForm.format,
      maxPlayers: challengeForm.playerCount,
      teamAssignments: challengeForm.slots,
      teeColor: challengeForm.teeColor,
      holes: challengeForm.holes,
      nineHolesSide: challengeForm.holes === 9 ? challengeForm.nineHolesSide : null,
      joinedBy: [],
      createdAt: new Date(),
      id: tempId,
    };
    // Deduct wager from owner's coins immediately
    if (newChallenge.wager > 0) setProfile(p => ({ ...p, coins: Math.max(0, (p.coins || 0) - newChallenge.wager) }));
    // Optimistic update: prepend immediately, then sort chronologically
    setChallenges(prev => [newChallenge, ...prev].sort((a, b) => (a.date + a.timeWindow) > (b.date + b.timeWindow) ? 1 : -1));
    setShowChallengeModal(false);
    setChallengeForm({ courseQuery: "", courseName: "", date: "", timeFrom: "", timeTo: "", message: "", wager: "", format: "stroke", playerCount: 2, slots: ["A", "B"], teeColor: "white", holes: 18, nineHolesSide: "front" });
    setChallengeCourseSuggestions([]);
    console.log("Posting challenge:", newChallenge);
    try {
      // Strip base64 profilePic from the Firestore write — store the synced URL from profile instead
      const firestoreDoc = {
        uid: newChallenge.uid,
        username: newChallenge.username,
        profilePic: profile.profilePic || null,
        ovr: newChallenge.ovr,
        course: newChallenge.course,
        date: newChallenge.date,
        timeWindow: newChallenge.timeWindow,
        message: newChallenge.message,
        wager: newChallenge.wager,
        format: newChallenge.format,
        maxPlayers: newChallenge.maxPlayers,
        teamAssignments: newChallenge.teamAssignments,
        teeColor: newChallenge.teeColor,
        holes: newChallenge.holes,
        nineHolesSide: newChallenge.nineHolesSide,
        joinedBy: [],
        createdAt: serverTimestamp(),
      };
      const ref = await addDoc(collection(db, "challenges"), firestoreDoc);
      // Swap temp id for real Firestore id
      setChallenges(prev => prev.map(c => c.id === tempId ? { ...c, id: ref.id } : c));
    } catch (e) {
      console.error("Failed to sync challenge to Firestore:", e);
      // Card stays visible locally — just flag the sync failure
      const code = e?.code || e?.message || "unknown";
      setChallengePostError(`Saved locally but not synced (${code}). It will disappear on refresh.`);
    }
    setChallengeBusy(false);
  }

  async function handleCourseSearch(val) {
    setEditCourse(val);
    setCourseSuggestions([]);
    setSelectedApiCourse(null);
    if (val.length < 2) return;
    // 1. COURSE_DB local matches
    const localMatches = Object.entries(COURSE_DB)
      .filter(([k]) => k.toLowerCase().includes(val.toLowerCase()))
      .map(([k, v]) => ({ name: k, tees: v.tees, par: v.par, source: "local" }));
    // 2. GolfCourseAPI + Firestore in parallel (skip API search if local results found)
    const [apiResults, firestoreResults] = await Promise.all([
      searchGolfCourseAPI(val),
      localMatches.length > 0 ? Promise.resolve([]) : searchCoursesInFirestore(val),
    ]);
    const apiMatches = apiResults
      .filter(c => !localMatches.some(l => l.name.toLowerCase() === (c.club_name || c.course_name).toLowerCase()))
      .map(c => ({
        name: c.club_name || c.course_name,
        apiId: c.id,
        location: c.location,
        source: "golfcourseapi",
      }));
    setCourseSuggestions([...localMatches, ...apiMatches, ...(localMatches.length > 0 ? [] : firestoreResults)]);
  }
  async function selectCourse(course) {
    setEditCourse(course.name);
    setCourseSuggestions([]);
    setSelectedApiCourse(null);
    if (course.source === "golfcourseapi" && course.apiId) {
      // Fetch full details (from cache if available)
      const full = await fetchGolfCourseAPIById(course.apiId);
      if (full) {
        setSelectedApiCourse(full);
        setEditRating("");
        setEditSlope("");
      }
    } else if (course.tees) {
      setEditRating("");
      setEditSlope("");
    } else {
      setEditRating(String(course.rating || ""));
      setEditSlope(String(course.slope || ""));
    }
  }

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setAuthUser(user);
      if (user) {
        const saved = await loadProfileFromFirestore(user.uid);
        if (saved) {
          // Strip liveRound out of profile state — it's managed separately
          const { liveRound: savedLiveRound, ...savedProfile } = saved;
          // Silently repair OVR/XP/level if they look wrong
          const repaired = await selfRepairProfile(user.uid, savedProfile);
          setProfile(repaired);
          setAnimOVR(repaired.ovr);
          if (repaired.profilePic) { const compressed = await compressImage(repaired.profilePic); setProfilePic(compressed); }
          // Restore an in-progress or completed-but-unsaved live round
          if (savedLiveRound) setLiveRound(savedLiveRound);
        } else {
          const newProfile = { ...BLANK_PROFILE, username: user.displayName || user.email.split("@")[0].toUpperCase() };
          setProfile(newProfile);
          setAnimOVR(50);
          await saveProfileToFirestore(user.uid, newProfile);
        }
        profileLoadedRef.current = true;
      }
      setAuthLoading(false);
    });
    return unsub;
  }, []);

  const deletingRef = useRef(false);
  const profileLoadedRef = useRef(false);
  const roundSubmittedRef = useRef(false); // prevents in-flight liveRound writes from racing submit
  const roundSavingRef = useRef(false);   // suppresses redundant useEffect write while submit await is in progress
  useEffect(() => {
    if (authUser && profile.username && !deletingRef.current && profileLoadedRef.current && !roundSavingRef.current) {
      saveProfileToFirestore(authUser.uid, profile);
    }
  }, [profile]);

  // Real-time listener: detect when another user (crew leader) sets crewId on our profile
  useEffect(() => {
    if (!authUser) return;
    const unsub = onSnapshot(doc(db, "users", authUser.uid), snap => {
      if (!snap.exists() || !profileLoadedRef.current) return;
      const { crewId, crewName } = snap.data();
      setProfile(p => {
        if ((p.crewId || null) === (crewId || null) && (p.crewName || null) === (crewName || null)) return p;
        return { ...p, crewId: crewId || null, crewName: crewName || null };
      });
    });
    return unsub;
  }, [authUser?.uid]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSignup() {
    setAuthError(""); setAuthBusy(true);
    try {
      const name = authUsername.trim().toUpperCase();
      if (!name) { setAuthError("Please enter a username."); setAuthBusy(false); return; }
      const cred = await createUserWithEmailAndPassword(auth, authEmail, authPassword);
      const newProfile = { ...BLANK_PROFILE, username: name };
      setProfile(newProfile);
      await saveProfileToFirestore(cred.user.uid, newProfile);
    } catch(e) { setAuthError(e.message.replace("Firebase: ", "").replace(/\(auth.*\)/, "").trim()); }
    setAuthBusy(false);
  }
  async function handleLogin() {
    setAuthError(""); setAuthBusy(true);
    try { await signInWithEmailAndPassword(auth, authEmail, authPassword); }
    catch(e) { setAuthError("Invalid email or password."); }
    setAuthBusy(false);
  }
  async function handleLogout() { await signOut(auth); setProfile(BLANK_PROFILE); setAnimOVR(50); setTab("profile"); }
  async function handleDeleteAccount() {
    if (!deletePassword.trim()) { setDeleteError("Please enter your password to confirm."); return; }
    deletingRef.current = true;
    setDeleteBusy(true); setDeleteError("");
    try {
      const credential = EmailAuthProvider.credential(authUser.email, deletePassword);
      await reauthenticateWithCredential(authUser, credential);
      await deleteDoc(doc(db, "users", authUser.uid));
      const friendsSnap = await getDocs(collection(db, "friends"));
      const toDelete = friendsSnap.docs.filter(d => d.data().users.includes(authUser.uid));
      await Promise.all(toDelete.map(d => deleteDoc(doc(db, "friends", d.id))));
      const reqSnap = await getDocs(collection(db, "friendRequests"));
      const reqToDelete = reqSnap.docs.filter(d => d.data().from === authUser.uid || d.data().to === authUser.uid);
      await Promise.all(reqToDelete.map(d => deleteDoc(doc(db, "friendRequests", d.id))));
      localStorage.removeItem("club99_pic");
      localStorage.removeItem("club99_feed_seen");
      await deleteUser(authUser);
      setProfile(BLANK_PROFILE); setProfilePic(null); setAuthUser(null); setTab("profile"); setShowDeleteConfirm(false); setDeletePassword("");
    } catch(e) {
      if (e.code === "auth/wrong-password" || e.code === "auth/invalid-credential") setDeleteError("Incorrect password. Please try again.");
      else setDeleteError("Something went wrong. Please try again.");
      setDeleteBusy(false);
    }
  }

  useEffect(() => {
    let cur = animOVR;
    const target = profile.ovr;
    if (cur === target) return;
    const step = cur < target ? 1 : -1;
    const id = setInterval(() => { cur += step; setAnimOVR(cur); if (cur === target) clearInterval(id); }, 20);
    return () => clearInterval(id);
  }, [profile.ovr]);

  useEffect(() => {
    saveProfilePic(profilePic);
    if (authUser && profilePic) {
      if (profilePic.length < 900000) {
        setDoc(doc(db, "users", authUser.uid), { profilePic }, { merge: true }).catch(err => console.warn("profilePic save failed:", err.message));
      }
    }
  }, [profilePic]);

  // ── resetScan ──
  function resetScan() {
    setScanState("idle"); setScanError(null);
    setEditScore(""); setEditHoleScores([]); setEditHolePars([]);
    setEditCourse(""); setEditRating(""); setEditSlope(""); setEditTee("White"); setCourseSuggestions([]);
  }

  function startLiveRound(course, tee, holes, extraFields) {
    const nineSide = extraFields?.nineSide || "front";
    const holeOffset = holes === "9" && nineSide === "back" ? 9 : 0;
    // If a GolfCourseAPI course is selected, use its verified pars + rating/slope
    let holePars;
    let apiOverrides = {};
    if (selectedApiCourse) {
      const apiTee = extractApiTeeData(selectedApiCourse, tee);
      if (apiTee) {
        const count = parseInt(holes);
        holePars = count === 9
          ? (nineSide === "back" ? apiTee.holePars.slice(9) : apiTee.holePars.slice(0, 9))
          : apiTee.holePars;
        apiOverrides = {
          overrideRating: apiTee.rating,
          overrideSlope:  apiTee.slope,
          // Store course lat/lng so the map can fly to the course on start
          apiCourseLocation: selectedApiCourse.location
            ? { lat: selectedApiCourse.location.latitude, lng: selectedApiCourse.location.longitude }
            : null,
          apiCourseId: selectedApiCourse.id,
        };
      }
    }
    if (!holePars) {
      const allPars = getCourseHolePars(course, "18");
      if (holes === "9") {
        holePars = allPars ? (nineSide === "back" ? allPars.slice(9) : allPars.slice(0, 9)) : null;
      } else {
        holePars = allPars;
      }
    }
    holePars = holePars || Array(parseInt(holes)).fill(4);
    const round = { course, tee, holes, holePars, holeOffset, scores: Array(parseInt(holes)).fill(null), currentHole: 0, startedAt: Date.now(), ...apiOverrides, ...(extraFields || {}) };
    setLiveRound(round);
    setTotalDistanceWalked(0);
    setLiveWeather(null);
    weatherFetchRef.current = 0;
    setParPickerHole(null);
    setScorePickerHole(null);
    setLivePuttsArr([]);
    setLiveFairwaysArr([]);
    setTeePin(null); setTeePinManual(false); setFlagPin(null); setTargetPin(null);
    setShotStartPos(null);
    setPendingShotYards(null);
    setPendingShotEndPos(null);
    setShotInFairway(false);
    setLiveGIRArr([]);
    setShotHistoryArr([]);
    setLiveStrokesArr([]);
    setLiveAttrGains({ PWR: 0, ACC: 0 });
    roundSubmittedRef.current = false;
    if (authUser) setDoc(doc(db, "users", authUser.uid), { liveRound: round }, { merge: true }).catch(() => {});
  }

  function updateLiveScore(holeIdx, score) {
    // Check before the state update whether the hole will advance, and if so save pins
    const r = liveRoundRef.current;
    if (r && score != null) {
      const prevHole = r.currentHole;
      const nextHole = Math.max(prevHole, Math.min(holeIdx + 1, parseInt(r.holes) - 1));
      if (nextHole > prevHole) {
        const { teePin: tp, flagPin: fp } = pinsRef.current;
        if (tp || fp) {
          const absHoleIdx = prevHole + (r.holeOffset || 0);
          savePinLayout(r.course, absHoleIdx, tp, fp);
          pushPinVote(communityPinCourseKey(r), absHoleIdx, tp, fp);
        }
      }
    }
    setLiveRound(r => {
      const scores = [...r.scores];
      scores[holeIdx] = score;
      const next = { ...r, scores, currentHole: Math.max(r.currentHole, score != null ? Math.min(holeIdx + 1, parseInt(r.holes) - 1) : r.currentHole) };
      if (authUser && !roundSubmittedRef.current) setDoc(doc(db, "users", authUser.uid), { liveRound: next }, { merge: true }).catch(() => {});
      return next;
    });
  }

  function updateLivePar(holeIdx, newPar) {
    setLiveRound(r => {
      const holePars = [...r.holePars];
      holePars[holeIdx] = newPar;
      const next = { ...r, holePars };
      if (authUser && !roundSubmittedRef.current) setDoc(doc(db, "users", authUser.uid), { liveRound: next }, { merge: true }).catch(() => {});
      return next;
    });
  }

  function submitLiveRound() {
    if (!liveRound) return;
    roundSubmittedRef.current = true; // block any in-flight score writes before we dispatch ours
    const { course, tee, holes, holePars, scores, isNewCourse, capturedHoleCenters, overrideRating, overrideSlope, courseLocation, holeYards: roundHoleYards } = liveRound;
    const filled = scores.filter(s => s != null && s > 0);
    if (filled.length < parseInt(holes)) { roundSubmittedRef.current = false; return; }
    // Vote on tee + flag pins for the final hole before clearing state
    if (teePin || flagPin) {
      const absHole = liveRound.currentHole + (liveRound.holeOffset || 0);
      savePinLayout(liveRound.course, absHole, teePin, flagPin);
      pushPinVote(communityPinCourseKey(liveRound), absHole, teePin, flagPin);
    }
    // Populate round entry state then submit
    setEditCourse(course);
    setEditTee(tee);
    setEditHoles(holes);
    setEditHoleScores(scores);
    setEditHolePars(holePars);
    const total = scores.reduce((a, b) => a + (b || 0), 0);
    setEditScore(String(total));
    const courseData = getCourseData(course, tee);
    if (courseData) { setEditRating(String(courseData.rating)); setEditSlope(String(courseData.slope)); }
    setLiveRound(null);
    setLivePuttsArr([]);
    setLiveFairwaysArr([]);
    setShotStartPos(null);
    setPendingShotYards(null);
    setPendingShotEndPos(null);
    setTeePin(null); setTeePinManual(false); setFlagPin(null); setTargetPin(null);
    setShotHistoryArr([]); setLiveStrokesArr([]); setLiveGIRArr([]);
    setPlacingMode(null);
    // Directly submit using the values we just set
    const s = total;
    const holeCount = parseInt(holes);
    const known = getCourseData(course, tee);
    const cData = known || (overrideRating && overrideSlope
      ? { rating: overrideRating, slope: overrideSlope, par: holePars.reduce((a, b) => a + (b || 4), 0) }
      : { rating: 72.0, slope: 113, par: parseInt(holes) === 9 ? 36 : 72 });
    const today = new Date().toISOString().split("T")[0];
    let coins = holes === "18" ? 100 : 60;
    let newStreak = profile.streak;
    if (profile.lastRoundDate) {
      const days = Math.round((new Date(today) - new Date(profile.lastRoundDate)) / 86400000);
      if (days >= 1 && days <= 7) { newStreak += 1; if (newStreak >= 2) coins += 25 * Math.min(newStreak, 10); }
      else newStreak = 0;
    }
    const roundOVR = calcRoundOVR(s, cData, holeCount);
    const newRounds = [...profile.rounds, roundOVR].slice(-10);
    const newOVR = calcOVRFromRounds(newRounds);
    const ovrDelta = newOVR - profile.ovr;
    if (ovrDelta > 0) coins += ovrDelta * 50;
    const adjPar = holes === "9" ? Math.round(cData.par / 2) : cData.par;
    // Sliding scale par bonus — everyone earns something, drops off gradually over 36 strokes
    coins += Math.round(75 * Math.max(0, 1 - Math.max(0, s - adjPar) / 36));
    // ── ANTI-FARMING: GPS movement gate + daily diminishing returns ──
    const movementThreshold = holeCount >= 18 ? 2000 : 1000;
    const gpsVerified = totalDistanceWalked >= movementThreshold;
    const roundsToday = profile.history.filter(r => r.date === today).length;
    const dailyMultiplier = roundsToday >= 2 ? 0.25 : 1.0;
    const rewardMultiplier = (gpsVerified ? 1.0 : 0.25) * dailyMultiplier;
    coins = Math.round(coins * rewardMultiplier);
    const coinBoostMultiplier = profile.coinBoost && profile.coinBoost.roundsLeft > 0 ? profile.coinBoost.multiplier : 1;
    const newCoinBoost = coinBoostMultiplier > 1 ? { ...profile.coinBoost, roundsLeft: profile.coinBoost.roundsLeft - 1 } : profile.coinBoost;
    // Firestore cannot serialize `undefined`. livePuttsArr/liveFairwaysArr/shotHistoryArr are sparse
    // arrays (e.g. n[5]=1 leaves indices 0-4 as undefined). Sanitize before any Firestore write.
    const safePuttsArr = Array.from({ length: holeCount }, (_, i) => livePuttsArr[i] ?? null);
    const safeFairwaysArr = Array.from({ length: holeCount }, (_, i) => liveFairwaysArr[i] ?? null);
    const safeShotHistoryArr = Array.from({ length: holeCount }, (_, i) => shotHistoryArr[i] ?? null);
    const totalPutts = safePuttsArr.reduce((a, b) => a + (b || 0), 0);
    const totalFairways = safeFairwaysArr.filter(v => v === true).length;
    const girPerHole = scores.map((sc, i) => {
      const putts = safePuttsArr[i] ?? 0;
      return sc != null ? (sc - putts) <= (holePars[i] - 2) : null;
    });
    const totalGIR = girPerHole.filter(v => v === true).length;
    // Compute attr deltas from live round data — no survey needed
    const par3Count = holePars.filter(p => p === 3).length;
    const fairwayHoles = Math.max(1, holeCount - par3Count);
    const computedAttrDeltas = {
      PWR: liveAttrGains.PWR,
      ACC: liveAttrGains.ACC,
      CON: Math.max(-2, Math.min(2, Math.round(((holeCount * 2 - totalPutts) / (holeCount / 3)) * 10) / 10)),
      REC: Math.max(-2, Math.min(2, Math.round((-(s - adjPar) / (holeCount / 3)) * 10) / 10)),
      EFF: Math.max(-2, Math.min(2, Math.round(((totalFairways / fairwayHoles) - 0.5) * 4 * 10) / 10)),
    };
    setLiveAttrGains({ PWR: 0, ACC: 0 });
    const entry = { id: Date.now(), course: course || "Unknown", score: s, holes, par: adjPar, tee, roundOVR: Math.round(roundOVR * 10) / 10, ovrAfter: newOVR, ovrDelta, date: today, holeScores: scores, holePars, putts: totalPutts, fairways: totalFairways, gir: totalGIR, puttsPerHole: safePuttsArr, fairwaysPerHole: safeFairwaysArr, girPerHole, attrDeltas: computedAttrDeltas };
    const newProfileState = { ...profile, ovr: newOVR, streak: newStreak, rounds: newRounds, lastRoundDate: today, history: [entry, ...profile.history], coinBoost: newCoinBoost };
    const prevBadges = new Set(getUnlockedBadges(profile).map(a => a.id));
    const newBadges = getUnlockedBadges(newProfileState).filter(a => !prevBadges.has(a.id));
    const badgeBonus = newBadges.length * 150;
    const coinsEarned = Math.round((coins + badgeBonus) * coinBoostMultiplier);
    const newExperience = (profile.experience || 0) + coinsEarned;
    const finalLevel = levelFromXP(newExperience);
    const finalLevelUp = finalLevel > profile.level;
    const entryWithCoins = { ...entry, coins: coinsEarned };
    const newHistoryFinal = [entryWithCoins, ...profile.history];
    const cumulativeFinal = { PWR: 0, ACC: 0, CON: 0, REC: 0, EFF: 0 };
    newHistoryFinal.forEach(r => { if (r.attrDeltas) Object.keys(cumulativeFinal).forEach(k => { cumulativeFinal[k] += (r.attrDeltas[k] || 0); }); });
    const hasTrackedShots = safeShotHistoryArr.some(h => h && h.length > 0);
    const updatedCourseShots = hasTrackedShots
      ? { ...(profile.courseShots || {}), [course]: { holes: safeShotHistoryArr, date: today } }
      : (profile.courseShots || {});
    const finalProfile = { ...profile, ovr: newOVR, experience: newExperience, level: finalLevel, streak: newStreak, rounds: newRounds, lastRoundDate: today, history: newHistoryFinal, coins: (profile.coins || 0) + coinsEarned, coinBoost: newCoinBoost, attrs: cumulativeFinal, courseShots: updatedCourseShots };
    setProfile(finalProfile);
    if (authUser) {
      // Single atomic write: save profile + clear liveRound together.
      // Using merge:true so we don't clobber fields written by other code paths (profilePic, etc).
      // persistentLocalCache writes this to IndexedDB immediately, so it survives a page refresh.
      setDoc(doc(db, "users", authUser.uid), sanitizeForFirestore({ ...finalProfile, liveRound: null }), { merge: true })
        .catch(e => console.error("[Club99] submitLiveRound save failed:", e));
    }
    if (newBadges.length > 0) setTimeout(() => setBadgeFlash(newBadges[0]), 800);
    if (course && cData.rating && cData.slope) saveCourseToFirestore(course, cData.rating, cData.slope);
    // Upload / verify community course data
    if (authUser && course) {
      if (isNewCourse) {
        uploadCourseToFirestore({ name: course, location: courseLocation || "", rating: cData.rating, slope: cData.slope, holePars, holeYards: roundHoleYards || [], capturedHoleCenters: capturedHoleCenters || {} }, authUser.uid, true).catch(console.error);
      } else if (!known) {
        uploadCourseToFirestore({ name: course, capturedHoleCenters: {} }, authUser.uid, false).catch(console.error);
      }
    }
    const rewardNote = rewardMultiplier < 1 ? (!gpsVerified ? " · Low GPS movement" : " · Daily limit") : "";
    setFlash({ type: ovrDelta >= 0 ? "up" : "down", msg: `OVR ${ovrDelta >= 0 ? "+" : ""}${ovrDelta}  ·  +${coinsEarned} 🪙${rewardNote}` });
    setTab("profile");
    // Record score to linked challenge (explicit via Start Round, or auto-detect by course+date)
    if (authUser) {
      const matchingChallenge = activeChallengeId
        ? challenges.find(c => c.id === activeChallengeId)
        : challenges.find(c =>
            !c.settled && c.date === today && c.course === course &&
            (c.uid === authUser.uid || (c.joinedBy || []).some(u => u.uid === authUser.uid))
          );
      if (matchingChallenge) {
        recordChallengeScore(matchingChallenge.id, authUser.uid, profile.username, s).then(result => {
          if (!result) return;
          const updatedScores = { ...(matchingChallenge.scores || {}), [authUser.uid]: s };
          if (result.settled) {
            setChallenges(prev => prev.map(ch => ch.id === matchingChallenge.id ? { ...ch, settled: true, winner: result.winner, scores: updatedScores } : ch));
            if (result.winner?.uid === authUser.uid && result.wager > 0)
              setProfile(p => ({ ...p, coins: (p.coins || 0) + result.wager * 2 }));
          } else {
            setChallenges(prev => prev.map(ch => ch.id === matchingChallenge.id ? { ...ch, scores: updatedScores } : ch));
          }
        });
      }
      setActiveChallengeId(null);
    }
  }

  function abandonLiveRound() {
    // Save current hole pins before clearing state
    if (liveRound && (teePin || flagPin)) {
      const absHole = liveRound.currentHole + (liveRound.holeOffset || 0);
      savePinLayout(liveRound.course, absHole, teePin, flagPin);
      pushPinVote(communityPinCourseKey(liveRound), absHole, teePin, flagPin);
    }
    if (authUser) setDoc(doc(db, "users", authUser.uid), { liveRound: null }, { merge: true }).catch(() => {});
    setLiveRound(null);
    setLivePuttsArr([]);
    setLiveFairwaysArr([]);
    setTotalDistanceWalked(0);
    setLiveWeather(null);
    weatherFetchRef.current = 0;
    setParPickerHole(null);
    setScorePickerHole(null);
    setLivePuttsArr([]);
    setLiveFairwaysArr([]);
    setShotStartPos(null);
    setPendingShotYards(null);
    setPendingShotEndPos(null);
    setLiveGIRArr([]);
    setShotHistoryArr([]);
    setLiveStrokesArr([]);
    setLiveAttrGains({ PWR: 0, ACC: 0 });
    setShotInFairway(false);
    setTeePin(null); setTeePinManual(false); setFlagPin(null); setTargetPin(null);
    setPlacingMode(null);
    setTab("profile");
  }

  function handleCreateCourse() {
    const { courseName, location, teeColor, rating, slope, holes, holePars, holeYards } = newCourseForm;
    if (!courseName.trim() || !rating || !slope) return;
    const holeCount = parseInt(holes);
    const extraFields = {
      isNewCourse: true,
      overrideRating: parseFloat(rating),
      overrideSlope: parseInt(slope),
      courseLocation: location,
      holeYards: holeYards.slice(0, holeCount).map(y => y ? parseFloat(y) : null),
      capturedHoleCenters: {},
    };
    startLiveRound(courseName.trim(), teeColor, holes, { ...extraFields, holePars: holePars.slice(0, holeCount) });
    setShowCreateCourse(false);
  }

  // Updates a club's distance average using the rolling mean of GPS-tracked shots.
  // Stores trackedCount on each bag item so subsequent shots keep refining the average.
  // Also applies GPS-based PWR/ACC attr gains when the shot qualifies.
  function updateClubAverage(clubIdx, yards) {
    // Compute gains from current snapshot (before the updater runs)
    const currentItem = (profile.bag || [])[clubIdx] || {};
    const prevAvg = parseFloat(currentItem.distance) || 0;
    const clubName = currentItem.club || "Club";
    // PWR gain: shot is ≥5% longer than an established average
    const pwrGain = prevAvg > 0 && yards >= prevAvg * 1.05 ? 0.3 : 0;
    // ACC gain: user explicitly marked this shot as a fairway hit
    const accGain = shotInFairway ? 0.2 : 0;

    setProfile(p => {
      const bag = [...(p.bag || [])];
      const item = { ...bag[clubIdx] };
      const count = item.trackedCount || 0;
      const pAvg = parseFloat(item.distance) || 0;
      const newAvg = (count === 0 || pAvg === 0)
        ? yards
        : Math.round((pAvg * count + yards) / (count + 1));
      item.distance = String(newAvg);
      item.trackedCount = count + 1;
      bag[clubIdx] = item;
      if (authUser) setDoc(doc(db, "users", authUser.uid), { bag }, { merge: true }).catch(() => {});
      return { ...p, bag };
    });

    if (pwrGain || accGain) {
      setLiveAttrGains(g => ({ PWR: g.PWR + pwrGain, ACC: g.ACC + accGain }));
      const parts = [];
      if (pwrGain) parts.push("+PWR");
      if (accGain) parts.push("+ACC");
      const msg = `${clubName}: ${yards} yds · ${parts.join(" · ")}`;
      setAttrToast(msg);
      setTimeout(() => setAttrToast(null), 2500);
    }

    if (pendingShotEndPos && liveRound) {
      const holeIdx = liveRound.currentHole;
      setShotHistoryArr(arr => {
        const n = [...arr];
        if (!n[holeIdx]) n[holeIdx] = [];
        n[holeIdx] = [...n[holeIdx], { lat: pendingShotEndPos.lat, lng: pendingShotEndPos.lng, club: clubName, yards }];
        return n;
      });
    }
    setShotInFairway(false);
    setPendingShotEndPos(null);
    setPendingShotYards(null);
  }

    function submitRound() {
    const s = parseInt(editScore);
    const holeCount = parseInt(editHoles);
    const filledHoles = editHoleScores.filter(v => v != null && v > 0).length;
    if (filledHoles < holeCount) { setScanError(`Please enter a score for all ${holeCount} holes. (${filledHoles}/${holeCount} filled)`); return; }
    if (!editScore || isNaN(s) || s < 30 || s > 180) { setScanError("Invalid total score. Check your hole scores."); return; }
    const known = getCourseData(editCourse, editTee);
    const courseData = known || (editRating && editSlope ? { rating: parseFloat(editRating), slope: parseFloat(editSlope), par: editHoles === "9" ? 36 : 72 } : { rating: 72.0, slope: 113, par: 72 });
    const today = new Date().toISOString().split("T")[0];

    let newStreak = profile.streak;
    if (profile.lastRoundDate) {
      const days = Math.round((new Date(today) - new Date(profile.lastRoundDate)) / 86400000);
      if (days >= 1 && days <= 7) newStreak += 1;
      else newStreak = 0;
    }
    const roundOVR = calcRoundOVR(s, courseData, parseInt(editHoles));
    const newRounds = [...profile.rounds, roundOVR].slice(-10);
    const newOVR = calcOVRFromRounds(newRounds);
    const ovrDelta = newOVR - profile.ovr;
    const par = courseData.par;
    const adjPar = editHoles === "9" ? Math.round(par / 2) : par;
    const courseHolePars = getCourseHolePars(editCourse, editHoles);
    const entryPar = editHoles === "9" ? Math.round(courseData.par / 2) : courseData.par;
    // Compute attr deltas from available data (manual round — no live tracking)
    const manualHoleCount = parseInt(editHoles);
    const manualAttrDeltas = {
      PWR: 0,
      ACC: 0,
      CON: 0,
      REC: Math.max(-2, Math.min(2, Math.round((-(s - entryPar) / (manualHoleCount / 3)) * 10) / 10)),
      EFF: 0,
    };
    // Manual rounds earn no coins and don't consume a boost charge
    const entry = { id: Date.now(), course: editCourse || "Unknown", score: s, holes: editHoles, par: entryPar, tee: editTee, roundOVR: Math.round(roundOVR * 10) / 10, ovrAfter: newOVR, ovrDelta, date: today, holeScores: editHoleScores.length > 0 ? editHoleScores : null, holePars: editHolePars.length > 0 ? editHolePars : (courseHolePars || null), attrDeltas: manualAttrDeltas, coins: 0 };
    const newProfileState = { ...profile, ovr: newOVR, streak: newStreak, rounds: newRounds, lastRoundDate: today, history: [entry, ...profile.history] };
    const prevBadges = new Set(getUnlockedBadges(profile).map(a => a.id));
    const newBadges = getUnlockedBadges(newProfileState).filter(a => !prevBadges.has(a.id));
    setProfile(p => {
      const newHistory = [entry, ...p.history];
      const cumulative = { PWR: 0, ACC: 0, CON: 0, REC: 0, EFF: 0 };
      newHistory.forEach(r => { if (r.attrDeltas) Object.keys(cumulative).forEach(k => { cumulative[k] += (r.attrDeltas[k] || 0); }); });
      // experience/level/coins unchanged — manual rounds earn nothing
      return { ...p, ovr: newOVR, streak: newStreak, rounds: newRounds, lastRoundDate: today, history: newHistory, attrs: cumulative };
    });
    if (newBadges.length > 0) setTimeout(() => setBadgeFlash(newBadges[0]), 800);
    if (editCourse && courseData.rating && courseData.slope) saveCourseToFirestore(editCourse, courseData.rating, courseData.slope);
    setFlash({ type: ovrDelta >= 0 ? "up" : "down", msg: `OVR ${ovrDelta >= 0 ? "+" : ""}${ovrDelta} · No coins (manual entry)` });
    resetScan();
    setTab("profile");
    // Auto-settle any matching challenge
    if (authUser) {
      const matchingChallenge = challenges.find(c =>
        !c.settled && c.date === today && c.course === editCourse &&
        (c.uid === authUser.uid || (c.joinedBy || []).some(u => u.uid === authUser.uid))
      );
      if (matchingChallenge) {
        recordChallengeScore(matchingChallenge.id, authUser.uid, profile.username, s).then(result => {
          if (!result) return;
          const updatedScores = { ...(matchingChallenge.scores || {}), [authUser.uid]: s };
          if (result.settled) {
            setChallenges(prev => prev.map(ch => ch.id === matchingChallenge.id ? { ...ch, settled: true, winner: result.winner, scores: updatedScores } : ch));
            if (result.winner?.uid === authUser.uid && result.wager > 0)
              setProfile(p => ({ ...p, coins: (p.coins || 0) + result.wager * 2 }));
          } else {
            setChallenges(prev => prev.map(ch => ch.id === matchingChallenge.id ? { ...ch, scores: updatedScores } : ch));
          }
        });
      }
    }
  }

  function deleteRound(id) {
    setProfile(p => {
      const round = p.history.find(r => r.id === id);
      if (!round) return p;
      // Deduct coins this round earned from experience (experience = total coins ever earned)
      const coinsToDeduct = round.coins || 0;
      const newExperience = Math.max(0, (p.experience || 0) - coinsToDeduct);
      const newLevel = levelFromXP(newExperience);
      const newHistory = p.history.filter(r => r.id !== id);
      const newRoundOVRs = newHistory.slice(0, 10).map(r => r.roundOVR).filter(Boolean);
      const newOVR = calcOVRFromRounds(newRoundOVRs);
      // Recompute streak from remaining history
      const newStreak = (() => {
        if (newHistory.length < 1) return 0;
        const sorted = [...newHistory].sort((a, b) => new Date(b.date) - new Date(a.date));
        let streak = 1;
        for (let i = 1; i < sorted.length; i++) {
          const days = Math.round((new Date(sorted[i-1].date) - new Date(sorted[i].date)) / 86400000);
          if (days >= 1 && days <= 7) streak++; else break;
        }
        return streak;
      })();
      // Recompute cumulative attrs from remaining rounds that have attrDeltas
      const newAttrs = { PWR: 0, ACC: 0, CON: 0, REC: 0, EFF: 0 };
      newHistory.forEach(r => {
        if (r.attrDeltas) Object.keys(newAttrs).forEach(k => { newAttrs[k] += (r.attrDeltas[k] || 0); });
      });
      const tempProfile = { ...p, history: newHistory, ovr: newOVR, level: newLevel, streak: newStreak, experience: newExperience, attrs: newAttrs };
      const stillUnlocked = new Set(getUnlockedBadges(tempProfile).map(b => b.id));
      const newPinnedBadges = (p.pinnedBadges || []).filter(id => stillUnlocked.has(id));
      const newCoins = Math.max(0, (p.coins || 0) - coinsToDeduct);
      const updated = { ...p, history: newHistory, rounds: newRoundOVRs, ovr: newOVR, experience: newExperience, level: newLevel, streak: newStreak, attrs: newAttrs, pinnedBadges: newPinnedBadges, coins: newCoins };
      if (authUser) saveProfileToFirestore(authUser.uid, updated);
      return updated;
    });
  }

  const tier = skillTier(profile.ovr);
  // New users with no rounds always show a clean 50 baseline on every attribute
  const stats = (!profile.history || profile.history.length === 0)
    ? { PWR: 50, ACC: 50, CON: 50, REC: 50, EFF: 50 }
    : computeStats(profile.ovr, profile.attrs);
  const last5 = profile.history.slice(0, 5);
  const ACCENT = "#22c55e";

  if (authLoading) return (
    <div style={{ minHeight: "100vh", background: "#0f0f0f", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
        <div className="golf-ball-loader" />
        <div style={{ display: "flex", alignItems: "baseline", gap: 4, opacity: 0.55 }}>
          <span style={{ fontSize: 11, fontWeight: 900, fontFamily: "'Inter','DM Sans',sans-serif", letterSpacing: 1.5, color: "rgba(255,255,255,0.6)", textTransform: "uppercase" }}>CLUB</span>
          <span style={{ fontSize: 11, fontWeight: 900, fontFamily: "'Inter','DM Sans',sans-serif", letterSpacing: 1.5, color: Theme.primaryGreen, textTransform: "uppercase" }}>99</span>
        </div>
      </div>
    </div>
  );

  if (!authUser) return (
    <div style={{ minHeight: "100vh", background: "#0f0f0f", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "32px 24px", fontFamily: "'Inter','DM Sans',sans-serif" }}>

      {/* ── FF Golf-flag monogram ── */}
      <div style={{ marginBottom: 24 }}>
        <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
          <circle cx="32" cy="32" r="31" stroke={Theme.primaryGreen} strokeWidth="1.5" fill="rgba(125,162,126,0.07)" />
          {/* Flag pin */}
          <line x1="24" y1="46" x2="24" y2="20" stroke={Theme.primaryGreen} strokeWidth="2.2" strokeLinecap="round" />
          <polygon points="24,20 40,26.5 24,33" fill={Theme.primaryGreen} />
          {/* Golf ball */}
          <circle cx="41" cy="43" r="5" fill="#ffffff" />
          <circle cx="39.5" cy="41.5" r="1.2" fill="rgba(0,0,0,0.12)" />
          <circle cx="42.5" cy="41" r="0.9" fill="rgba(0,0,0,0.1)" />
          <circle cx="40.5" cy="44.5" r="0.9" fill="rgba(0,0,0,0.1)" />
        </svg>
      </div>

      {/* ── Wordmark ── */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 8 }}>
        <span style={{ fontSize: 40, fontWeight: 900, fontFamily: "'Inter','DM Sans',sans-serif", letterSpacing: -1.5, color: "#ffffff", lineHeight: 1 }}>CLUB</span>
        <span style={{ fontSize: 40, fontWeight: 900, fontFamily: "'Inter','DM Sans',sans-serif", letterSpacing: -1.5, color: Theme.primaryGreen, lineHeight: 1 }}>99</span>
      </div>

      {/* ── Tagline ── */}
      <div style={{ fontSize: 13, fontWeight: 500, color: "#6b7280", marginBottom: 40, letterSpacing: 0.2, textAlign: "center" }}>
        Real-time strategy. Better rounds.
      </div>

      {/* ── Auth card ── */}
      <div style={{ width: "100%", maxWidth: 360, background: "#ffffff", borderRadius: 24, padding: "24px 24px 28px", boxShadow: "0 24px 64px rgba(0,0,0,0.55), 0 1px 0 rgba(255,255,255,0.05)" }}>

        {/* Sign In / Sign Up toggle */}
        <div style={{ display: "flex", marginBottom: 22, background: "#f3f4f6", borderRadius: 12, padding: 3 }}>
          {["login","signup"].map(m => (
            <button key={m} onClick={() => { setAuthMode(m); setAuthError(""); }} style={{ flex: 1, padding: "9px 0", border: "none", borderRadius: 10, background: authMode === m ? "#0f0f0f" : "transparent", color: authMode === m ? "#ffffff" : "#6b7280", fontWeight: 800, fontSize: 12, letterSpacing: 1, cursor: "pointer", textTransform: "uppercase", fontFamily: "'Inter','DM Sans',sans-serif", transition: "all 0.15s" }}>
              {m === "login" ? "Sign In" : "Sign Up"}
            </button>
          ))}
        </div>

        {/* Username field (sign-up only) */}
        {authMode === "signup" && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: "#9ca3af", letterSpacing: 2, marginBottom: 6, fontFamily: "'Inter',sans-serif" }}>USERNAME</div>
            <input value={authUsername} onChange={e => setAuthUsername(e.target.value)} placeholder="e.g. TIGER" style={{ width: "100%", padding: "13px 14px", background: "#0f0f0f", border: "1.5px solid #1f2937", borderRadius: 10, color: "#f0f0f5", fontSize: 15, fontWeight: 700, outline: "none", fontFamily: "'Inter','DM Sans',sans-serif", letterSpacing: 1 }} />
          </div>
        )}

        {/* Email */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: "#9ca3af", letterSpacing: 2, marginBottom: 6, fontFamily: "'Inter',sans-serif" }}>EMAIL</div>
          <input value={authEmail} onChange={e => setAuthEmail(e.target.value)} placeholder="you@email.com" type="email" style={{ width: "100%", padding: "13px 14px", background: "#f9fafb", border: "1.5px solid #e5e7eb", borderRadius: 10, color: "#111827", fontSize: 14, fontWeight: 500, outline: "none", fontFamily: "'Inter','DM Sans',sans-serif" }} />
        </div>

        {/* Password */}
        <div style={{ marginBottom: 22 }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: "#9ca3af", letterSpacing: 2, marginBottom: 6, fontFamily: "'Inter',sans-serif" }}>PASSWORD</div>
          <input value={authPassword} onChange={e => setAuthPassword(e.target.value)} placeholder="••••••••" type="password" onKeyDown={e => e.key === "Enter" && (authMode === "login" ? handleLogin() : handleSignup())} style={{ width: "100%", padding: "13px 14px", background: "#f9fafb", border: "1.5px solid #e5e7eb", borderRadius: 10, color: "#111827", fontSize: 14, fontWeight: 500, outline: "none", fontFamily: "'Inter','DM Sans',sans-serif" }} />
        </div>

        {/* Error */}
        {authError && <div style={{ fontSize: 12, fontWeight: 600, color: "#dc2626", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 14px", marginBottom: 14, textAlign: "center", fontFamily: "'Inter',sans-serif" }}>{authError}</div>}

        {/* Submit */}
        <button
          onClick={authMode === "login" ? handleLogin : handleSignup}
          disabled={authBusy}
          style={{ width: "100%", padding: "15px 0", background: "#22c55e", border: "none", borderRadius: 12, color: "#fff", fontSize: 13, fontWeight: 900, letterSpacing: 2, cursor: authBusy ? "default" : "pointer", fontFamily: "'Inter','DM Sans',sans-serif", opacity: authBusy ? 0.6 : 1, display: "flex", alignItems: "center", justifyContent: "center", textTransform: "uppercase" }}
        >
          {authBusy ? "…" : authMode === "login" ? "Sign In" : "Create Account"}
        </button>
      </div>
    </div>
  );

  const S = {
    fLabel: { fontSize: 10, fontWeight: 800, color: "#9ca3af", letterSpacing: 1.5, marginBottom: 6 },
    fInput: { width: "100%", padding: "11px 14px", background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8, color: "#111827", fontSize: 14, fontWeight: 600, outline: "none", fontFamily: "'DM Sans', sans-serif" },
    errBox: { background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: "10px 14px", fontSize: 12, color: "#dc2626", fontWeight: 600 },
  };

  const equippedBanner = profile.equippedBanner ? SHOP_ITEMS.find(i => i.id === profile.equippedBanner) : null;
  const equippedBorder = profile.equippedBorder ? SHOP_ITEMS.find(i => i.id === profile.equippedBorder) : null;
  const equippedNameplate = profile.equippedNameplate ? SHOP_ITEMS.find(i => i.id === profile.equippedNameplate) : null;
  const unlockedBadges = getUnlockedBadges(profile);
  const COINS = profile.coins || 0;

  const bannerStyle = equippedBanner
    ? { background: equippedBanner.preview, ...(equippedBanner.animated === "shimmer" ? {} : equippedBanner.animated === "aurora" ? {} : {}) }
    : { background: "linear-gradient(135deg, #111827 0%, #1f2937 60%)" };
  const bannerClass = equippedBanner?.animated === "shimmer" ? "banner-shimmer" : equippedBanner?.animated === "aurora" ? "banner-aurora" : equippedBanner?.animated === "pulse" ? "banner-pulse" : "";

  const nameplateStyle = equippedNameplate ? equippedNameplate.style : {};

  return (
    <div style={{ height: "100dvh", overflow: "hidden", fontFamily: "'DM Sans', sans-serif" }}>
      {/* Flash Banner */}
      {flash && (
        <div onClick={() => setFlash(null)} style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 999, padding: "14px 20px", background: flash.type === "up" ? ACCENT : "#ef4444", color: "#fff", textAlign: "center", fontSize: 15, fontWeight: 900, letterSpacing: 2, fontFamily: "Bebas Neue", cursor: "pointer", animation: "fadeUp 0.3s ease" }}>
          {flash.msg}
        </div>
      )}
      {/* Badge Flash */}
      {badgeFlash && (
        <div onClick={() => setBadgeFlash(null)} style={{ position: "fixed", top: flash ? 50 : 0, left: 0, right: 0, zIndex: 998, padding: "12px 20px", background: "#fff", borderBottom: "2px solid #fbbf24", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, cursor: "pointer", animation: "fadeUp 0.3s ease" }}>
          <BadgeIcon id={badgeFlash.id} size={28} />
          <div><div style={{ fontSize: 11, fontWeight: 800, color: "#f59e0b", letterSpacing: 1 }}>BADGE UNLOCKED</div><div style={{ fontSize: 14, fontWeight: 900, color: "#111827" }}>{badgeFlash.label}</div></div>
        </div>
      )}

      {/* ── PROFILE TAB ── */}
      {tab === "profile" && !liveRound && (
        <div className="tab-scroll" style={{ paddingBottom: 80 }}>

          {/* ── DARK HEADER ── */}
          <div style={{ position: "relative", background: "#0f0f0f", ...bannerStyle }} className={bannerClass}>
            {/* App wordmark — top strip */}
            <div style={{ padding: "8px 16px 0", display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ fontSize: 11, fontWeight: 900, fontFamily: "'Inter','DM Sans',sans-serif", letterSpacing: 0.5, color: "rgba(255,255,255,0.45)", textTransform: "uppercase" }}>CLUB</span>
              <span style={{ fontSize: 11, fontWeight: 900, fontFamily: "'Inter','DM Sans',sans-serif", letterSpacing: 0.5, color: Theme.primaryGreen, textTransform: "uppercase" }}>99</span>
            </div>
            <div style={{ padding: "8px 16px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              {/* Left: avatar + name */}
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ position: "relative" }}>
                  <div onClick={() => profilePicRef.current.click()} style={{ width: 56, height: 56, borderRadius: "50%", background: "#1f2937", border: `2.5px solid ${Theme.primaryGreen}`, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", ...(equippedBorder ? equippedBorder.style : {}) }} className={equippedBorder?.animated === "spin" ? "border-spin" : ""}>
                    {profilePic ? <img src={profilePic} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="pic" /> : <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4b5563" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>}
                  </div>
                  <input ref={profilePicRef} type="file" accept="image/*" style={{ display: "none" }} onChange={async e => {
                    const file = e.target.files[0]; if (!file) return;
                    const reader = new FileReader();
                    reader.onload = async ev => { const compressed = await compressImage(ev.target.result, 200); setProfilePic(compressed); };
                    reader.readAsDataURL(file);
                  }} />
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
                  <span style={{ fontSize: 22, fontWeight: 900, fontFamily: "Bebas Neue", letterSpacing: 2, color: "#fff", ...nameplateStyle }}>{profile.username}</span>
                  {/* Rank tier badge */}
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 5, marginTop: 4, background: tier.bg, border: `1px solid ${tier.border}`, borderRadius: 20, padding: "3px 10px" }}>
                    <svg width="8" height="8" viewBox="0 0 24 24" fill={tier.color} stroke="none"><polygon points="12,2 15,9 22,9 17,14 19,21 12,17 5,21 7,14 2,9 9,9"/></svg>
                    <span style={{ fontSize: 10, fontWeight: 800, color: tier.color, letterSpacing: 1 }}>{tier.label}</span>
                  </div>
                </div>
              </div>

              {/* Right: OVR / HCP toggle block */}
              <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
                {/* Tappable OVR ↔ HCP block */}
                {(() => {
                  const hcap = calcHandicapIndex(profile.history);
                  const bigNum   = isHandicapView ? (hcap != null ? hcap.toFixed(1) : "—") : animOVR;
                  const bigLabel = isHandicapView ? "HCP" : "OVR";
                  const labelColor = isHandicapView ? Theme.primaryGreen : "#9ca3af";
                  return (
                    <button
                      onClick={() => { hapticTap(); setIsHandicapView(v => !v); }}
                      style={{ background: "none", border: "none", cursor: "pointer", padding: 0, textAlign: "right", WebkitTapHighlightColor: "transparent", outline: "none" }}
                    >
                      <div
                        key={`ovr-${isHandicapView}`}
                        style={{ fontSize: 64, fontWeight: 900, fontFamily: "Bebas Neue", color: "#fff", lineHeight: 1, animation: "countUp 0.35s ease", letterSpacing: isHandicapView ? 0 : 2 }}
                      >
                        {bigNum}
                      </div>
                      <div style={{ fontSize: 9, fontWeight: 800, color: labelColor, letterSpacing: 2, textAlign: "right", transition: "color 0.25s" }}>
                        {bigLabel}
                      </div>
                    </button>
                  );
                })()}
                {/* OVR delta — only visible in score mode */}
                {!isHandicapView && profile.history.length > 0 && (() => {
                  const last = profile.history[0];
                  const delta = last.ovrDelta;
                  return delta !== undefined ? (
                    <div style={{ marginTop: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 900, color: delta >= 0 ? "#6D8F6E" : "#C57B7B", fontFamily: "Bebas Neue" }}>{delta >= 0 ? "+" : ""}{delta}</span>
                    </div>
                  ) : null;
                })()}
                {/* Settings gear */}
                <div style={{ position: "relative" }}>
                  <button onClick={() => setShowSettings(v => !v)} style={{ background: "rgba(255,255,255,0.08)", border: "none", borderRadius: 8, padding: "6px 7px", color: "#9ca3af", cursor: "pointer", marginTop: 2 }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                  </button>
                  {showSettings && (
                    <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, boxShadow: "0 8px 24px rgba(0,0,0,0.15)", padding: 8, minWidth: 160, zIndex: 50 }}>
                      <button onClick={handleLogout} style={{ width: "100%", padding: "10px 14px", background: "none", border: "none", borderRadius: 8, color: "#374151", fontSize: 13, fontWeight: 700, cursor: "pointer", textAlign: "left", display: "block" }}>Sign Out</button>
                      <div style={{ height: 1, background: "#f3f4f6", margin: "4px 0" }} />
                      <button onClick={() => { setShowSettings(false); setShowDeleteConfirm(true); }} style={{ width: "100%", padding: "10px 14px", background: "none", border: "none", borderRadius: 8, color: "#dc2626", fontSize: 13, fontWeight: 700, cursor: "pointer", textAlign: "left", display: "block" }}>Delete Account</button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {profile.coinBoost && profile.coinBoost.roundsLeft > 0 && (
              <div style={{ padding: "3px 16px", background: "#0a0a0a", fontSize: 10, color: "#f59e0b", fontWeight: 700 }}>⚡ {profile.coinBoost.multiplier}× Coin Boost active · {profile.coinBoost.roundsLeft} rounds left</div>
            )}
          </div>

          {/* Settings Dropdown */}

          {showDeleteConfirm && (
            <div style={{ background: "#fff", border: "1px solid #fecaca", padding: "14px 16px" }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#dc2626", marginBottom: 6 }}>Delete Account</div>
              <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 10 }}>This permanently deletes your account and all data.</div>
              <input type="password" value={deletePassword} onChange={e => setDeletePassword(e.target.value)} placeholder="Your password" style={{ ...S.fInput, marginBottom: 8 }} />
              {deleteError && <div style={{ ...S.errBox, marginBottom: 8 }}>{deleteError}</div>}
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => { setShowDeleteConfirm(false); setDeletePassword(""); setDeleteError(""); }} style={{ flex: 1, padding: 11, background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Cancel</button>
                <button onClick={handleDeleteAccount} disabled={deleteBusy} style={{ flex: 1, padding: 11, background: "#dc2626", border: "none", borderRadius: 8, color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>{deleteBusy ? "Deleting…" : "Delete"}</button>
              </div>
            </div>
          )}

          {/* ── 3-COL STATS STRIP ── */}
          <div style={{ display: "flex", background: "#fff", borderBottom: "1px solid #e5e7eb" }}>
            {[
              { val: profile.history.length, label: "ROUNDS", color: "#111827" },
              { val: profile.history.length > 0 ? Math.min(...profile.history.map(r => r.score)) : "—", label: "BEST RND", color: "#111827" },
              { val: profile.streak > 0 ? `${profile.streak}🔥` : "—", label: "STREAK", color: "#111827" },
              { val: (profile.coins || 0).toLocaleString(), label: "🪙 COINS", color: "#d97706" },
            ].map(({ val, label, color }, i) => (
              <div key={label} style={{ flex: 1, padding: "10px 0", textAlign: "center", borderRight: i < 3 ? "1px solid #e5e7eb" : "none" }}>
                <div style={{ fontSize: 20, fontWeight: 900, color, fontFamily: "Bebas Neue", lineHeight: 1 }}>{val}</div>
                <div style={{ fontSize: 8, fontWeight: 800, color: "#9ca3af", letterSpacing: 1.5, marginTop: 2 }}>{label}</div>
              </div>
            ))}
          </div>

          {/* ── TWO-COLUMN BODY: Attributes left | Last 5 right ── */}
          <div style={{ display: "flex", background: "#fff", borderBottom: "1px solid #e5e7eb", minHeight: 240 }}>
            {/* Left: Attributes radar */}
            <div style={{ flex: 1, borderRight: "1px solid #e5e7eb", padding: "12px 8px 12px" }}>
              <div style={{ fontSize: 9, fontWeight: 800, color: "#9ca3af", letterSpacing: 1.5, marginBottom: 6, textAlign: "center" }}>ATTRIBUTES</div>
              <div style={{ display: "flex", justifyContent: "center" }}>
                <RadarChart stats={stats} accent={Theme.primaryGreen} />
              </div>
              <button onClick={() => setShowAttrModal(true)} style={{ display: "block", margin: "6px auto 0", background: "none", border: "none", fontSize: 10, fontWeight: 700, color: Theme.primaryGreen, cursor: "pointer", letterSpacing: 0.5 }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 3, verticalAlign: "middle" }}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                DETAILS
              </button>
            </div>

            {/* Right: Last 5 rounds */}
            <div style={{ flex: 1, padding: "12px 12px" }}>
              <div style={{ fontSize: 9, fontWeight: 800, color: "#9ca3af", letterSpacing: 1.5, marginBottom: 8 }}>LAST 5</div>
              {profile.history.length === 0 ? (
                <div style={{ fontSize: 12, color: "#9ca3af", textAlign: "center", paddingTop: 40 }}>No rounds yet</div>
              ) : (
                profile.history.slice(0, 5).map((r, i) => (
                  <div key={r.id} onClick={() => setViewingRound(r)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 0", borderBottom: i < Math.min(profile.history.length, 5) - 1 ? "1px solid #f3f4f6" : "none", cursor: "pointer" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ fontSize: 20, fontWeight: 900, fontFamily: "Bebas Neue", color: "#111827", width: 28, lineHeight: 1 }}>{r.score}</div>
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: "#374151", lineHeight: 1.3 }}>{r.date ? r.date.slice(5).replace("-", "/") : ""}</div>
                        <div style={{ fontSize: 9, color: "#9ca3af", lineHeight: 1.3 }}>{r.course ? r.course.replace(" Golf Course","").replace(" Golf Club","") : "Unknown"}{r.tee ? ` · ${r.tee}` : ""}</div>
                      </div>
                    </div>
                    {(() => { const diff = r.par ? r.score - r.par : null; const label = diff === null ? "" : diff === 0 ? "E" : diff > 0 ? `+${diff}` : `${diff}`; const color = diff === null ? "#9ca3af" : diff < 0 ? "#3b82f6" : diff === 0 ? "#6b7280" : "#C57B7B"; return <div style={{ fontSize: 13, fontWeight: 900, color, fontFamily: "Bebas Neue" }}>{label}</div>; })()}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Badges strip (if any) */}
          {unlockedBadges.length > 0 && (
            <div style={{ background: "#fff", borderBottom: "1px solid #e5e7eb", padding: "10px 16px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <div style={{ fontSize: 9, fontWeight: 800, color: "#9ca3af", letterSpacing: 1.5 }}>BADGES</div>
                <button onClick={() => setShowBadgeManager(v => !v)} style={{ fontSize: 10, fontWeight: 700, color: Theme.primaryGreen, background: "none", border: "none", cursor: "pointer" }}>{showBadgeManager ? "Done" : "Manage"}</button>
              </div>
              {showBadgeManager ? (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 8 }}>
                  {ACHIEVEMENTS.map(a => {
                    const unlocked = unlockedBadges.some(b => b.id === a.id);
                    const pinned = (profile.pinnedBadges || []).includes(a.id);
                    return (
                      <div key={a.id} onClick={() => {
                        if (!unlocked) return;
                        const next = pinned ? (profile.pinnedBadges || []).filter(x => x !== a.id) : [...(profile.pinnedBadges || []).slice(0, 4), a.id];
                        setProfile(p => ({ ...p, pinnedBadges: next }));
                      }} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, cursor: unlocked ? "pointer" : "default", opacity: unlocked ? 1 : 0.25 }}>
                        <div style={{ position: "relative" }}>
                          <BadgeIcon id={a.id} size={30} />
                          {pinned && <div style={{ position: "absolute", top: -2, right: -2, width: 8, height: 8, borderRadius: "50%", background: ACCENT, border: "1px solid #fff" }} />}
                        </div>
                        <div style={{ fontSize: 6, fontWeight: 700, color: "#6b7280", textAlign: "center", lineHeight: 1.2 }}>{a.label}</div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ display: "flex", gap: 8 }}>
                  {((profile.pinnedBadges || []).length > 0 ? ACHIEVEMENTS.filter(a => (profile.pinnedBadges || []).includes(a.id)).slice(0, 6) : unlockedBadges.slice(0, 6)).map(a => (
                    <div key={a.id} onClick={() => setSelectedBadge(a)} style={{ cursor: "pointer" }}><BadgeIcon id={a.id} size={32} /></div>
                  ))}
                </div>
              )}
              {selectedBadge && (
                <div onClick={() => setSelectedBadge(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }}>
                  <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 16, padding: 24, maxWidth: 240, width: "90%", textAlign: "center" }}>
                    <BadgeIcon id={selectedBadge.id} size={48} />
                    <div style={{ fontSize: 16, fontWeight: 900, color: "#111827", marginTop: 8 }}>{selectedBadge.label}</div>
                    <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>{selectedBadge.desc}</div>
                    <button onClick={() => setSelectedBadge(null)} style={{ marginTop: 14, padding: "8px 20px", background: ACCENT, border: "none", borderRadius: 8, color: "#fff", fontWeight: 700, cursor: "pointer" }}>Close</button>
                  </div>
                </div>
              )}
            </div>
          )}


          {/* Attr modal */}
          {showAttrModal && (() => {
            const STAT_META = {
              PWR: {
                color: "#f59e0b", bg: "#fffbeb", iconBg: "#fef3c7",
                icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>,
                fullName: "POWER",
                desc: "Measures your driving distance and ability to generate clubhead speed off the tee.",
                subs: [
                  { name: "Driving Distance", desc: "How far you move the ball off the tee" },
                  { name: "Clubhead Speed", desc: "Raw power through the hitting zone" },
                  { name: "Long Iron Play", desc: "Ability to cover long yardages on approach" },
                ],
                tips: {
                  up: "You\'re bombing it lately — keep swinging free and this will keep climbing.",
                  flat: "Improve by answering post-round questions about driving distance. Consistently bombing it will push this up.",
                  down: "Your driving power has been dipping. Focus on generating more speed off the tee.",
                },
              },
              ACC: {
                color: "#3b82f6", bg: "#eff6ff", iconBg: "#dbeafe",
                icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1" fill="#3b82f6" stroke="none"/></svg>,
                fullName: "ACCURACY",
                desc: "Reflects your ability to hit fairways and land approach shots on or near the green.",
                subs: [
                  { name: "Fairway %", desc: "How often you find the short grass off the tee" },
                  { name: "Greens in Regulation", desc: "Approach shot precision" },
                  { name: "Shot Shaping", desc: "Control over ball flight and shape" },
                ],
                tips: {
                  up: "You\'ve been finding fairways — that\'s directly pushing ACC up. Keep it up.",
                  flat: "Hitting more fairways in your post-round answers directly boosts ACC.",
                  down: "Your accuracy has been slipping. Focus on finding more fairways and greens.",
                },
              },
              CON: {
                color: "#22c55e", bg: "#f0fdf4", iconBg: "#dcfce7",
                icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
                fullName: "CONSISTENCY",
                desc: "Tracks how reliably you make solid ball contact round after round.",
                subs: [
                  { name: "Ball Striking", desc: "Quality of contact across all clubs" },
                  { name: "Mishit Rate", desc: "How often you catch it thin or fat" },
                  { name: "Round-to-Round", desc: "Repeatability across multiple rounds" },
                ],
                tips: {
                  up: "Your ball striking has been dialed in — CON rewards this kind of consistency.",
                  flat: "Log rounds consistently and report clean striking to build this stat over time.",
                  down: "Inconsistent contact is dragging CON down. Focus on solid ball striking.",
                },
              },
              REC: {
                color: "#a855f7", bg: "#faf5ff", iconBg: "#f3e8ff",
                icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#a855f7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>,
                fullName: "RECOVERY",
                desc: "How well you escape trouble and save par from difficult situations.",
                subs: [
                  { name: "Scrambling %", desc: "Up-and-down success from off the green" },
                  { name: "Sand Saves", desc: "Getting out of bunkers in regulation" },
                  { name: "Penalty Avoidance", desc: "Keeping the ball in play under pressure" },
                ],
                tips: {
                  up: "Your scrambling has been clutch — saving pars is what builds REC.",
                  flat: "Rate your short game and scrambling ability after each round to move this needle.",
                  down: "You\'ve been struggling to escape trouble. Work on your short game and up-and-downs.",
                },
              },
              EFF: {
                color: "#ef4444", bg: "#fff5f5", iconBg: "#fee2e2",
                icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M2 12h3M19 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12"/></svg>,
                fullName: "EFFICIENCY",
                desc: "Putting and scoring efficiency — turning your ball position into the fewest possible strokes.",
                subs: [
                  { name: "Putts Per Round", desc: "Total putts taken across 18 holes" },
                  { name: "3-Putt Avoidance", desc: "Staying out of three-putt territory" },
                  { name: "Birdie Conversion", desc: "Capitalizing on scoring opportunities" },
                ],
                tips: {
                  up: "You\'ve been cashing in on the greens — keep making those putts count.",
                  flat: "Report your putting performance honestly — making long putts and avoiding 3-putts is how this grows.",
                  down: "Too many 3-putts lately. Focus on lag putting and converting short ones.",
                },
              },
            };

            // Compute per-stat trends from history attrDeltas (last 5 rounds that have answers)
            const roundsWithAttrs = profile.history.filter(r => r.attrDeltas);
            const last5 = roundsWithAttrs.slice(0, 5);

            function getStatTrend(stat) {
              if (last5.length === 0) return "flat";
              const avg = last5.reduce((sum, r) => sum + (r.attrDeltas[stat] || 0), 0) / last5.length;
              if (avg > 0.5) return "up";
              if (avg < -0.5) return "down";
              return "flat";
            }

            function getStatBadge(statKey, val) {
              const base = profile.ovr;
              const diff = val - base;
              if (diff >= 3) return { label: "STRENGTH", color: "#16a34a", bg: "#f0fdf4", border: "#bbf7d0" };
              if (diff <= -3) return { label: "NEEDS WORK", color: "#ef4444", bg: "#fff1f2", border: "#fecaca" };
              return { label: "AVERAGE", color: "#f59e0b", bg: "#fffbeb", border: "#fde68a" };
            }

            const statEntries = Object.entries(stats);
            const minVal = Math.min(...statEntries.map(([,v]) => v));
            const maxVal = Math.max(...statEntries.map(([,v]) => v));

            return (
              <div style={{ position: "fixed", inset: 0, background: "#f4f5f7", zIndex: 300, overflowY: "auto", fontFamily: "'DM Sans', sans-serif" }}>
                {/* Header */}
                <div style={{ background: "#fff", borderBottom: "1px solid #e5e7eb", padding: "16px 20px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 10 }}>
                  <div>
                    <div style={{ fontSize: 20, fontWeight: 900, color: "#111827", letterSpacing: 0.5 }}>ATTRIBUTE BREAKDOWN</div>
                    <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>Based on your round history & self-reported performance</div>
                  </div>
                  <button onClick={() => setShowAttrModal(false)} style={{ background: "none", border: "1px solid #e5e7eb", borderRadius: "50%", width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#6b7280", fontSize: 16 }}>✕</button>
                </div>

                {/* Overview: radar + bars */}
                <div style={{ background: "#fff", margin: "12px 12px 0", borderRadius: 14, border: "1px solid #e5e7eb", padding: "16px", display: "flex", gap: 16, alignItems: "center" }}>
                  <div style={{ flexShrink: 0 }}>
                    <RadarChart stats={stats} accent={Theme.primaryGreen} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {statEntries.map(([k, v]) => {
                      const m = STAT_META[k];
                      const isWeakest = v === minVal;
                      const isBest = v === maxVal;
                      const trend = getStatTrend(k);
                      return (
                        <div key={k} style={{ marginBottom: 10 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                              <span style={{ fontSize: 11, fontWeight: 800, color: "#374151", letterSpacing: 0.5 }}>{k}</span>
                              <span style={{ fontSize: 11 }}>{trend === "up" ? "↑" : trend === "down" ? "↓" : "→"}</span>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                              {(isWeakest || isBest) && <span style={{ fontSize: 8, fontWeight: 800, color: isWeakest ? "#ef4444" : "#22c55e", letterSpacing: 0.5 }}>{isWeakest ? "WEAKEST" : "BEST"}</span>}
                              <span style={{ fontSize: 12, fontWeight: 900, color: m.color }}>{v}</span>
                            </div>
                          </div>
                          <div style={{ height: 5, borderRadius: 3, background: "#f3f4f6", overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${v}%`, background: m.color, borderRadius: 3 }} />
                          </div>
                        </div>
                      );
                    })}
                    {roundsWithAttrs.length === 0 && (
                      <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 8, fontStyle: "italic" }}>Answer post-round questions to see trends</div>
                    )}
                  </div>
                </div>

                {/* Per-stat cards */}
                <div style={{ padding: "12px 12px 24px", display: "flex", flexDirection: "column", gap: 10 }}>
                  {statEntries.map(([k, v]) => {
                    const m = STAT_META[k];
                    const badge = getStatBadge(k, v);
                    const trend = getStatTrend(k);
                    const tip = m.tips[trend];
                    return (
                      <div key={k} style={{ background: "#fff", borderRadius: 14, border: "1px solid #e5e7eb", overflow: "hidden" }}>
                        <div style={{ padding: "14px 16px 10px" }}>
                          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 6 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <div style={{ width: 40, height: 40, borderRadius: 10, background: m.iconBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                {m.icon}
                              </div>
                              <div>
                                <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                                  <span style={{ fontSize: 15, fontWeight: 900, color: "#111827", letterSpacing: 0.5 }}>{m.fullName}</span>
                                  <span style={{ fontSize: 9, fontWeight: 800, color: badge.color, background: badge.bg, border: `1px solid ${badge.border}`, borderRadius: 4, padding: "2px 6px", letterSpacing: 0.5 }}>{badge.label}</span>
                                  <span style={{ fontSize: 13, color: trend === "up" ? "#16a34a" : trend === "down" ? "#ef4444" : "#9ca3af" }} title={trend === "up" ? "Trending up" : trend === "down" ? "Trending down" : "Holding steady"}>
                                    {trend === "up" ? "↑" : trend === "down" ? "↓" : "→"}
                                  </span>
                                </div>
                                <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2, lineHeight: 1.4 }}>{m.desc}</div>
                              </div>
                            </div>
                            <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 8 }}>
                              <span style={{ fontSize: 28, fontWeight: 900, color: m.color, fontFamily: "Bebas Neue", lineHeight: 1 }}>{v}</span>
                              <div style={{ fontSize: 10, color: "#9ca3af" }}>/ 99</div>
                            </div>
                          </div>
                          <div style={{ height: 5, borderRadius: 3, background: "#f3f4f6", overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${v}%`, background: m.color, borderRadius: 3 }} />
                          </div>
                        </div>
                        <div style={{ padding: "4px 16px 10px" }}>
                          {m.subs.map((s, i) => (
                            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, paddingBottom: 7 }}>
                              <div style={{ width: 7, height: 7, borderRadius: "50%", background: m.color, flexShrink: 0, marginTop: 5 }} />
                              <div>
                                <div style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>{s.name}</div>
                                <div style={{ fontSize: 11, color: "#9ca3af" }}>{s.desc}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div style={{ background: m.bg, borderTop: `1px solid ${m.iconBg}`, padding: "10px 16px", display: "flex", alignItems: "flex-start", gap: 8 }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={m.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                          <span style={{ fontSize: 12, color: "#374151", lineHeight: 1.5 }}>{tip}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* ── ROUND ENTRY ── always visible unless entering scores ── */}
          {scanState !== "scores" && (
            <div style={{ padding: "0 16px 16px" }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: "#9ca3af", letterSpacing: 2, paddingTop: 16, marginBottom: 10 }}>LOG A ROUND</div>
              <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", padding: "12px 12px", marginBottom: 10 }}>
                <div style={{ fontSize: 9, fontWeight: 800, color: "#9ca3af", letterSpacing: 1.5, marginBottom: 5 }}>COURSE NAME</div>
                <div style={{ position: "relative", marginBottom: 12 }}>
                  <input value={editCourse} onChange={e => handleCourseSearch(e.target.value)} placeholder="Search course name…" style={S.fInput} />
                  {courseSuggestions.length > 0 && (
                    <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, zIndex: 10, boxShadow: "0 4px 12px rgba(0,0,0,0.1)", overflow: "hidden" }}>
                      {courseSuggestions.map((c, i) => (
                        <div key={i} onClick={() => selectCourse(c)} style={{ padding: "9px 12px", cursor: "pointer", borderBottom: "1px solid #f0f0f0", fontSize: 12, fontWeight: 600 }}>
                          <div style={{ color: "#111827", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                            {c.name}
                            {c.community && (
                              <span style={{ fontSize: 8, fontWeight: 800, background: c.communityVerified ? "#dcfce7" : "#fef3c7", color: c.communityVerified ? "#16a34a" : "#92400e", border: `1px solid ${c.communityVerified ? "#86efac" : "#fde68a"}`, borderRadius: 4, padding: "1px 5px", letterSpacing: 0.5 }}>
                                {c.communityVerified ? "✓ VERIFIED" : `COMMUNITY ${c.verificationCount || 1}/5`}
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: 10, color: "#9ca3af" }}>
                            {c.source === "golfcourseapi"
                              ? `📡 GolfCourseAPI · ${c.location?.city || ""}${c.location?.state ? ", " + c.location.state : ""}`
                              : c.tees ? Object.keys(c.tees).join(" · ") + " tees" : `Rating ${c.rating} · Slope ${c.slope}`}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div style={{ fontSize: 9, fontWeight: 800, color: "#9ca3af", letterSpacing: 1.5, marginBottom: 6 }}>TEE COLOR</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
                  {(() => {
                    const TEE_META = [
                      { label: "Black", dot: "#111827", dotOpacity: 0.8 },
                      { label: "Blue",  dot: "#3b82f6", dotOpacity: 0.8 },
                      { label: "White", dot: "#e5e7eb", border: "#9ca3af" },
                      { label: "Gold",  dot: "#f59e0b", dotOpacity: 0.8 },
                      { label: "Red",   dot: "#ef4444" },
                    ];
                    // Determine available tees: API course → its tee names; COURSE_DB → its tee keys; otherwise all
                    const apiTeeNames = selectedApiCourse ? apiCourseTeeNames(selectedApiCourse) : null;
                    const available = TEE_META.filter(t => {
                      if (apiTeeNames) return apiTeeNames.includes(t.label);
                      if (COURSE_DB[editCourse]) return !!COURSE_DB[editCourse].tees[t.label];
                      return true;
                    });
                    return available.map(t => {
                      const active = editTee === t.label;
                      return (
                        <button key={t.label} onClick={() => setEditTee(t.label)} style={{ display: "flex", alignItems: "center", gap: 4, padding: "6px 10px", borderRadius: 7, border: active ? `2px solid ${t.border || t.dot}` : "1px solid #e5e7eb", background: active ? "#f9fafb" : "#fff", cursor: "pointer", fontWeight: 700, fontSize: 11, color: Theme.textMain }}>
                          <div style={{ width: 9, height: 9, borderRadius: "50%", background: t.dot, border: t.border ? `1px solid ${t.border}` : "none", opacity: t.dotOpacity ?? 1 }} />
                          {t.label}
                        </button>
                      );
                    });
                  })()}
                </div>
                {(() => {
                  // Rating/slope confirmed badge — prefer API data, fall back to COURSE_DB
                  const apiTee = selectedApiCourse ? extractApiTeeData(selectedApiCourse, editTee) : null;
                  const localData = getCourseData(editCourse, editTee);
                  if (apiTee) return <div style={{ fontSize: 10, color: Theme.primaryGreen, fontWeight: 600 }}>📡 {apiTee.tee_name} tees · Rating {apiTee.rating} · Slope {apiTee.slope}</div>;
                  if (localData) return <div style={{ fontSize: 10, color: Theme.primaryGreen, fontWeight: 600 }}>✓ {editTee} tees · Rating {localData.rating} · Slope {localData.slope}</div>;
                  if (editCourse) return (
                    <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                      <div style={{ flex: 1 }}><div style={S.fLabel}>RATING</div><input value={editRating} onChange={e => setEditRating(e.target.value)} placeholder="72.4" style={S.fInput} type="number" step="0.1" /></div>
                      <div style={{ flex: 1 }}><div style={S.fLabel}>SLOPE</div><input value={editSlope} onChange={e => setEditSlope(e.target.value)} placeholder="128" style={S.fInput} type="number" /></div>
                    </div>
                  );
                  return null;
                })()}
              </div>
              {/* Can't find course CTA */}
              <button onClick={() => { setNewCourseForm(f => ({ ...f, courseName: editCourse || "", holes: editHoles })); setShowCreateCourse(true); }} style={{ width: "100%", paddingTop: 10, paddingBottom: 8, background: "transparent", border: "none", cursor: "pointer", fontSize: "0.85rem", fontWeight: 500, color: Theme.softSlate, letterSpacing: 0.2, marginBottom: 8, textAlign: "center" }}>
                Can't find your course? Add course to community
              </button>
              {/* Holes toggle */}
              <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", padding: "12px", marginBottom: 12 }}>
                <div style={{ fontSize: 9, fontWeight: 800, color: "#9ca3af", letterSpacing: 1.5, marginBottom: 8 }}>HOLES PLAYED</div>
                <div style={{ display: "flex", gap: 6 }}>
                  {["9","18"].map(h => (
                    <button key={h} onClick={() => { setEditHoles(h); setEditHoleScores(Array(parseInt(h)).fill(null)); setEditScore(""); }} style={{ flex: 1, padding: "9px 0", background: editHoles === h ? Theme.gradientGreen : "#f9fafb", border: editHoles === h ? `1.5px solid ${Theme.primaryGreen}` : "1px solid #e5e7eb", borderRadius: 12, color: editHoles === h ? "#fff" : Theme.textMuted, fontSize: 11, fontWeight: 800, letterSpacing: 1, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
                      {h} HOLES
                    </button>
                  ))}
                </div>
                {editHoles === "9" && (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ fontSize: 9, fontWeight: 800, color: "#9ca3af", letterSpacing: 1.5, marginBottom: 8 }}>WHICH 9?</div>
                    <div style={{ display: "flex", gap: 6 }}>
                      {[["front","FRONT 9"],["back","BACK 9"]].map(([val, label]) => (
                        <button key={val} onClick={() => setEditNineSide(val)} style={{ flex: 1, padding: "9px 0", background: editNineSide === val ? Theme.gradientGreen : "#f9fafb", border: editNineSide === val ? `1.5px solid ${Theme.primaryGreen}` : "1px solid #e5e7eb", borderRadius: 12, color: editNineSide === val ? "#fff" : Theme.textMuted, fontSize: 11, fontWeight: 800, letterSpacing: 1, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => { if (!editCourse) return; const extra = { ...(editRating && editSlope ? { overrideRating: parseFloat(editRating), overrideSlope: parseInt(editSlope) } : {}), ...(editHoles === "9" ? { nineSide: editNineSide } : {}) }; startLiveRound(editCourse, editTee, editHoles, Object.keys(extra).length ? extra : undefined); }} disabled={!editCourse} style={{ flex: 1, padding: "14px 0", background: editCourse ? Theme.gradientGreen : "#e5e7eb", border: "none", borderRadius: 12, color: editCourse ? "#fff" : "#9ca3af", cursor: editCourse ? "pointer" : "default", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, boxShadow: editCourse ? "0 4px 14px rgba(125,162,126,0.35)" : "none" }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={editCourse ? "#fff" : "#9ca3af"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8" fill="currentColor" stroke="none"/></svg>
                  <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: 1.5, fontFamily: "'DM Sans', sans-serif" }}>START LIVE</div>
                </button>
                <button onClick={() => { const hp = getCourseHolePars(editCourse, editHoles); setEditHoleScores(Array(parseInt(editHoles) || 18).fill(null)); setEditHolePars(hp || []); setScanState("scores"); setScanError(null); }} style={{ flex: 1, padding: "14px 0", background: "#fff", border: "2px solid #e5e7eb", borderRadius: 12, color: "#374151", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                  <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: 1.5, fontFamily: "'DM Sans', sans-serif" }}>ENTER MANUALLY</div>
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Scores grid */}
          {scanState === "scores" && (
            <div style={{ padding: "0 16px 16px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0 8px" }}>
                <div>
                  <div style={{ fontSize: 17, fontWeight: 900, fontFamily: "Bebas Neue", letterSpacing: 1.5, color: "#111827" }}>ENTER SCORES</div>
                </div>
                <button onClick={() => { setScanState("idle"); setScanError(null); }} style={{ background: "none", border: "none", fontSize: 11, fontWeight: 700, color: "#9ca3af", cursor: "pointer" }}>← Back</button>
              </div>
              {/* Course summary pill */}
              <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: "8px 12px", marginBottom: 8, fontSize: 12, fontWeight: 700, color: "#166534" }}>
                {editCourse || "No course"}{editTee ? ` · ${editTee} tees` : ""} · {editHoles} holes
              </div>
              {scanError && <div style={{ background: "#fef3c7", border: "1px solid #fde68a", borderRadius: 8, padding: "8px 12px", fontSize: 11, color: "#92400e", fontWeight: 600, marginBottom: 8 }}>⚠️ {scanError}</div>}
              <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", padding: "12px 10px", marginBottom: 8 }}>
                {(() => {
                  const holeCount = parseInt(editHoles) || 18;
                  const hs = editHoleScores.length === holeCount ? editHoleScores : Array(holeCount).fill(null);
                  const front = Array.from({ length: Math.min(9, holeCount) }, (_, i) => i);
                  const back = holeCount === 18 ? Array.from({ length: 9 }, (_, i) => i + 9) : [];
                  const focusGridIdx = nextIdx => {
                    setTimeout(() => {
                      const all = document.querySelectorAll("[data-holegrid] input");
                      if (all[nextIdx]) { all[nextIdx].focus(); all[nextIdx].select(); }
                    }, 0);
                  };
                  const advanceToNext = el => {
                    const all = Array.from(document.querySelectorAll("[data-holegrid] input"));
                    const cur = all.indexOf(el);
                    if (cur >= 0 && cur < all.length - 1) focusGridIdx(cur + 1);
                  };
                  const updateHole = (idx, val, el) => {
                    const next = [...hs];
                    const p = val === "" ? null : parseInt(val);
                    next[idx] = p;
                    setEditHoleScores(next);
                    const total = next.reduce((a, b) => a + (b != null ? b : 0), 0);
                    if (total > 0) setEditScore(String(total));
                    // Capture advance index before re-render, then defer focus
                    if (el && (val.length === 2 || (val.length === 1 && p >= 2 && p <= 9))) {
                      const all = Array.from(document.querySelectorAll("[data-holegrid] input"));
                      const cur = all.indexOf(el);
                      if (cur >= 0 && cur < all.length - 1) focusGridIdx(cur + 1);
                    }
                  };
                  const hasPars = editHolePars && editHolePars.length > 0;
                  const HoleRow = ({ idxs, label }) => {
                    const tot = idxs.reduce((a, i) => a + (hs[i] != null ? hs[i] : 0), 0);
                    const parTot = hasPars ? idxs.reduce((a, i) => a + (editHolePars[i] || 0), 0) : null;
                    return (
                      <div style={{ marginBottom: 6 }}>
                        {/* Hole numbers row */}
                        <div style={{ display: "flex", alignItems: "center", gap: 2, marginBottom: 2 }}>
                          <div style={{ width: 24, fontSize: 7, fontWeight: 800, color: "#9ca3af" }}>{label}</div>
                          {idxs.map(i => <div key={i} style={{ flex: 1, textAlign: "center", fontSize: 7, fontWeight: 800, color: "#9ca3af" }}>{i+1}</div>)}
                          <div style={{ width: 24, textAlign: "center", fontSize: 7, fontWeight: 800, color: "#9ca3af" }}>TOT</div>
                        </div>
                        {/* PAR row */}
                        <div style={{ display: "flex", alignItems: "center", gap: 2, marginBottom: 3 }}>
                          <div style={{ width: 24, fontSize: 7, fontWeight: 800, color: "#6b7280" }}>PAR</div>
                          {idxs.map(i => {
                            const p = editHolePars[i] || 4;
                            return (
                              <div
                                key={i}
                                onClick={() => {
                                  const next = [...editHolePars];
                                  next[i] = p === 3 ? 4 : p === 4 ? 5 : 3;
                                  setEditHolePars(next);
                                }}
                                style={{ flex: 1, textAlign: "center", fontSize: 9, fontWeight: 800, color: "#1d4ed8", background: "#eff6ff", borderRadius: 3, padding: "3px 0", cursor: "pointer", userSelect: "none" }}
                              >
                                {p}
                              </div>
                            );
                          })}
                          <div style={{ width: 24, textAlign: "center", fontSize: 9, fontWeight: 800, color: "#374151", background: "#f3f4f6", borderRadius: 3, padding: "3px 0" }}>
                            {parTot || "–"}
                          </div>
                        </div>
                        {/* Score inputs row */}
                        <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
                          <div style={{ width: 24 }} />
                          {idxs.map(i => {
                            const sc = hs[i];
                            const par = hasPars ? editHolePars[i] : null;
                            const diff = sc != null && par ? sc - par : null;
                            const borderColor = diff === null ? "#e5e7eb" : diff <= -2 ? "#1d4ed8" : diff === -1 ? "#3b82f6" : diff === 0 ? "#d1d5db" : diff === 1 ? "#f59e0b" : "#ef4444";
                            const bgColor    = diff === null ? "#fff" : diff <= -2 ? "#dbeafe" : diff === -1 ? "#eff6ff" : diff === 0 ? "#f9fafb" : diff === 1 ? "#fffbeb" : "#fef2f2";
                            return (
                              <input key={i} type="tel" inputMode="numeric" pattern="[0-9]*"
                                value={sc ?? ""}
                                onChange={e => { const v = e.target.value.replace(/[^0-9]/g, "").slice(0, 2); updateHole(i, v, e.target); }}
                                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); advanceToNext(e.target); } }}
                                onFocus={e => e.target.select()}
                                style={{ flex: 1, width: 0, minWidth: 0, textAlign: "center", fontSize: 12, fontWeight: 900, color: "#111827", border: `1.5px solid ${borderColor}`, borderRadius: 5, padding: "6px 0", background: bgColor, fontFamily: "DM Mono, monospace", outline: "none" }}
                              />
                            );
                          })}
                          <div style={{ width: 24, textAlign: "center", fontSize: 13, fontWeight: 900, color: "#111827", fontFamily: "Bebas Neue" }}>{tot || "–"}</div>
                        </div>
                      </div>
                    );
                  };
                  const filled = hs.filter(v => v != null && v > 0).length;
                  const total = hs.reduce((a, b) => a + (b != null ? b : 0), 0);
                  const totalPar = hasPars ? editHolePars.slice(0, holeCount).reduce((a, b) => a + (b || 0), 0) : null;
                  const vsParNum = total > 0 && totalPar ? total - totalPar : null;
                  const vsPar = vsParNum === null ? null : vsParNum === 0 ? "E" : vsParNum > 0 ? `+${vsParNum}` : `${vsParNum}`;
                  return (
                    <div data-holegrid>
                      <HoleRow idxs={front} label="OUT" />
                      {back.length > 0 && <HoleRow idxs={back} label="IN" />}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8, paddingTop: 6, borderTop: "1px solid #e5e7eb" }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: filled === holeCount ? ACCENT : "#9ca3af" }}>{filled === holeCount ? "✓ All holes entered" : `${filled}/${holeCount} holes`}</span>
                        <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                          {vsPar !== null && (
                            <span style={{ fontSize: 12, fontWeight: 900, color: vsParNum < 0 ? "#1d4ed8" : vsParNum === 0 ? "#6b7280" : "#dc2626", background: vsParNum < 0 ? "#dbeafe" : vsParNum === 0 ? "#f3f4f6" : "#fef2f2", border: `1px solid ${vsParNum < 0 ? "#93c5fd" : vsParNum === 0 ? "#d1d5db" : "#fecaca"}`, borderRadius: 6, padding: "1px 6px" }}>
                              {vsPar}
                            </span>
                          )}
                          <span style={{ fontSize: 9, fontWeight: 700, color: "#9ca3af" }}>TOTAL</span>
                          <span style={{ fontSize: 24, fontWeight: 900, color: total > 0 ? "#111827" : "#d1d5db", fontFamily: "Bebas Neue" }}>{total || "—"}</span>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
              <button onClick={() => {
                const holeCount = parseInt(editHoles) || 18;
                const hs = editHoleScores.length === holeCount ? editHoleScores : Array(holeCount).fill(null);
                const filled = hs.filter(v => v != null && v > 0).length;
                if (filled < holeCount) { setScanError(`Please fill all ${holeCount} holes. (${filled}/${holeCount})`); return; }
                setScanError(null); submitRound();
              }} style={{ width: "100%", padding: "15px 0", background: Theme.primaryGreen, border: "none", borderRadius: 10, color: "#fff", fontSize: 13, fontWeight: 900, letterSpacing: 2, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
                LOCK IN ROUND
              </button>
            </div>
          )}

        </div>
      )}

      {/* ── LIVE ROUND (shown on Profile tab when active) ── */}
      {tab === "profile" && liveRound && (() => {
        const { course, tee, holes, holePars, scores, currentHole, holeOffset: _holeOffset } = liveRound;
        const holeOffset = _holeOffset || 0;
        const absHole = currentHole + holeOffset;
        const holeCount = parseInt(holes);
        const filled = scores.filter(s => s != null && s > 0).length;
        const total = scores.reduce((a, b) => a + (b || 0), 0);
        const parTotal = holePars.slice(0, filled).reduce((a, b) => a + b, 0);
        const diff = total - parTotal;
        const diffStr = diff === 0 ? "E" : diff > 0 ? `+${diff}` : `${diff}`;
        const diffColor = diff === 0 ? "#6b7280" : diff < 0 ? "#3b82f6" : "#C57B7B";
        const holePar = holePars[currentHole] || 4;
        const holeScore = scores[currentHole] ?? null;
        const holeScoreDiff = holeScore != null ? holeScore - holePar : null;
        const holeScoreLabel = holeScore == null ? null : holeScore === 1 ? "ACE" : holeScoreDiff <= -2 ? "EAGLE" : holeScoreDiff === -1 ? "BIRDIE" : holeScoreDiff === 0 ? "PAR" : holeScoreDiff === 1 ? "BOGEY" : holeScoreDiff === 2 ? "DBL BOGEY" : `+${holeScoreDiff}`;
        const holeScoreColor = holeScore == null ? "rgba(255,255,255,0.25)" : holeScoreDiff <= -2 ? "#3b82f6" : holeScoreDiff === -1 ? "#60a5fa" : holeScoreDiff === 0 ? Theme.primaryGreen : holeScoreDiff === 1 ? Theme.mutedGold : "#C57B7B";

        // GPS / course geometry
        const courseData = COURSE_DB[course];
        const holeCoords = courseData?.holeCoords || null;
        const holeGeo = holeCoords ? holeCoords[currentHole] : null;
        const effectivePlayerPos = playerPos;

        // Prefer hole/pin location over raw GPS for map centering
        const pinCenter = (teePin && flagPin)
          ? { lat: (teePin.lat + flagPin.lat) / 2, lng: (teePin.lng + flagPin.lng) / 2 }
          : teePin || flagPin || null;
        const mapCenter = pinCenter || effectivePlayerPos || null;
        const mapRenderCenter = mapCenter;

        // ── AUTO-ORIENT: bearing & zoom for initial map view when entering a hole ──
        // Uses tee→green bearing so the pin is always "up" when the hole loads.
        // Falls back to 0°/zoom-16 when holeCoords are unavailable.
        const _aoTee   = holeGeo?.tee;
        const _aoGreen = holeGeo?.green?.center || holeGeo?.green?.front;
        const autoOrientBearing = (_aoTee && _aoGreen)
          ? bearingDeg(_aoTee.lat, _aoTee.lng, _aoGreen.lat, _aoGreen.lng)
          : (holeGeo?.bearing ?? 0);
        const _aoDistYds = (_aoTee && _aoGreen)
          ? haversineYards(_aoTee.lat, _aoTee.lng, _aoGreen.lat, _aoGreen.lng)
          : 0;
        // Zoom calibrated so full tee-to-green corridor fits on screen
        const autoOrientZoom =
          _aoDistYds > 500 ? 15.5 :
          _aoDistYds > 350 ? 16   :
          _aoDistYds > 175 ? 16.5 : 16.5;
        // Center the initial view at the midpoint between tee and green (or pins as fallback)
        const autoOrientCenter = (_aoTee && _aoGreen)
          ? { lat: (_aoTee.lat + _aoGreen.lat) / 2, lng: (_aoTee.lng + _aoGreen.lng) / 2 }
          : pinCenter || null;

        // ── CADDIE RECOMMENDATION ENGINE ──
        // Pin distance: prefer center, fall back to front/back
        const greenCenter = holeGeo?.green?.center || holeGeo?.green?.front || holeGeo?.green?.back || null;
        // Manual pin overrides — flagPin is the source of truth when dropped
        const effectiveTee  = teePin  || holeGeo?.tee || null;
        const effectiveFlag = flagPin || greenCenter;
        // Use flagPin as the green center for all calculations when available
        const effectiveGreenCenter = flagPin || greenCenter;
        // On-course detection: within 500y of the tee (or flag as fallback) → use live GPS
        const _courseRef = effectiveTee || effectiveFlag;
        const distFromCourse = (effectivePlayerPos && _courseRef)
          ? haversineYards(effectivePlayerPos.lat, effectivePlayerPos.lng, _courseRef.lat, _courseRef.lng)
          : null;
        const onCourse = distFromCourse != null && distFromCourse < 500;
        // On course: live GPS-to-flag. Off course: static tee-to-flag (or GPS if no tee).
        const pinYards = effectiveFlag
          ? (onCourse && effectivePlayerPos
              ? haversineYards(effectivePlayerPos.lat, effectivePlayerPos.lng, effectiveFlag.lat, effectiveFlag.lng)
              : effectiveTee
                ? haversineYards(effectiveTee.lat, effectiveTee.lng, effectiveFlag.lat, effectiveFlag.lng)
                : effectivePlayerPos
                  ? haversineYards(effectivePlayerPos.lat, effectivePlayerPos.lng, effectiveFlag.lat, effectiveFlag.lng)
                  : null)
          : null;

        // PWR adjustment: high PWR → player carries farther → suggest shorter club.
        // Neutral baseline is PWR 70. Each point = ±0.3% carry shift.
        // We divide pinYards by pwrMultiplier to get the club distance to look for.
        const liveStats = computeStats(profile.ovr, profile.attrs || {});
        const pwr = liveStats.PWR;
        const pwrMultiplier = 1 + (pwr - 70) * 0.003; // e.g. PWR 90 → 1.06, PWR 50 → 0.94
        const adjustedTarget = pinYards != null ? Math.round(pinYards / pwrMultiplier) : null;
        // Pro-Caddie: suggestClub handles bag fallback to DEFAULT_BAG and 2K Logic
        const clubRec = suggestClub(adjustedTarget, profile.bag || [], pwr);

        // ── PASSIVE CADDIE: play-as distance — auto Wind (bearing-based) + auto Elevation ──
        const driverItem = (profile.bag || []).find(b => b.club === "Driver") || DEFAULT_BAG[0];
        const avgDriverDist = Math.round(parseFloat(driverItem?.distance) || 275);

        // Wind: heading component from bearing calculation
        const windSpeed = liveWeather?.windSpeed || 0;
        const windDegAuto = liveWeather?.windDeg ?? 0;
        const headwindMph = (playerPos && effectiveGreenCenter && windSpeed > 0)
          ? calculateWindEffect(playerPos.lat, playerPos.lng, effectiveGreenCenter.lat, effectiveGreenCenter.lng, windSpeed, windDegAuto)
          : 0;

        // Wind display string (direction arrow + speed)
        const windGoingToDeg = (windDegAuto + 180) % 360;
        const windDisplayStr = windSpeed > 0
          ? `${degToArrow(windGoingToDeg)} ${Math.round(windSpeed)}mph`
          : null;

        // Elevation: pull from course data for current hole (±1 yd per 3 ft)
        const courseElev = COURSE_DB[course]?.holeElevations;
        const holeElevFt = courseElev ? (courseElev[currentHole] || 0) : 0;
        const elevDisplayStr = holeElevFt !== 0
          ? `${holeElevFt > 0 ? "▲" : "▼"} ${holeElevFt > 0 ? "+" : ""}${Math.round(holeElevFt / 3)}yds`
          : null;

        // Temperature from weather API (imperial °F)
        const tempF = liveWeather?.temp ?? null;

        // Plays-like: full algorithm using wind, elevation, temperature
        const playAsYards = adjustedTarget != null ? getPlaysLikeDistance(adjustedTarget, headwindMph, holeElevFt, tempF) : null;
        const playAsClub = suggestClub(playAsYards, profile.bag || [], pwr);

        // ── SHORT-GAME OVERRIDE: within 30 yards → putter or shortest wedge ──
        const livePinYards = pinYards != null ? Math.round(pinYards) : null;
        const shortGame = livePinYards != null && livePinYards < 30;
        const shortGameClub = (() => {
          if (!shortGame) return null;
          const bag = profile.bag || [];
          if (livePinYards < 10) {
            return bag.find(b => /putter/i.test(b.club)) || { club: "PUTTER", distance: "5" };
          }
          // Chip range: use the shortest-distance non-putter club (wedge)
          const wedges = bag.filter(b => !/putter/i.test(b.club) && parseFloat(b.distance) > 0)
            .sort((a, b) => parseFloat(a.distance) - parseFloat(b.distance));
          return wedges[0] || { club: "WEDGE", distance: "50" };
        })();

        const activeRec = shortGameClub || playAsClub || clubRec;
        const recClubYards = Math.round(parseFloat(activeRec?.distance) || 0);
        void recTicker; // consumed here so ESLint knows it triggers re-renders


        // 3-Point Green — when flagPin is dropped, derive front/back from it for accuracy;
        // otherwise prefer explicit holeGeo coords, fall back to bearing-derived ±15 yds
        const { front: computedFront, back: computedBack } = computeGreenPoints(effectiveGreenCenter, effectivePlayerPos);
        const greenFront = flagPin ? computedFront : (holeGeo?.green?.front || computedFront);
        const greenBack  = flagPin ? computedBack  : (holeGeo?.green?.back  || computedBack);

        const distToBack  = effectivePlayerPos && greenBack  ? Math.round(haversineYards(effectivePlayerPos.lat, effectivePlayerPos.lng, greenBack.lat,  greenBack.lng))  : null;
        const distToFront = effectivePlayerPos && greenFront ? Math.round(haversineYards(effectivePlayerPos.lat, effectivePlayerPos.lng, greenFront.lat, greenFront.lng)) : null;

        // ── CADDIE LANDING ZONE: single context-aware recommendation ──
        // Color by club type: Driver/Woods=red, Hybrids=blue, Irons/Wedges=white
        const lzColorForClub = name => {
          const n = (name || '').trim().toUpperCase();
          if (/^DRIVER$|^\d+\s*W(OOD)?$/.test(n)) return '#ef4444';
          if (/HYBRID|^\d+\s*H$|RESCUE/i.test(n)) return '#3b82f6';
          return '#ffffff';
        };
        const sortedBagClubs = [...(profile.bag || [])].filter(b => b.club && parseFloat(b.distance) > 0)
          .sort((a, b) => parseFloat(b.distance) - parseFloat(a.distance));

        return (
          <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: "#0a0a0a", overflow: "hidden" }}>

            {/* ══ MAP SECTION — fills remaining space ══ */}
            <div style={{ flex: 1, position: "relative", minHeight: 0, zIndex: 1, cursor: "default" }}>
            <div style={{ position: "absolute", inset: 0 }}>
              {mapRenderCenter ? (
                  <Map
                    key={`mbx-hole-${currentHole}`}
                    mapboxAccessToken={MAPBOX_TOKEN}
                    mapStyle="mapbox://styles/mapbox/satellite-streets-v12"
                    initialViewState={{ longitude: (autoOrientCenter || mapRenderCenter || { lng: 0 }).lng, latitude: (autoOrientCenter || mapRenderCenter || { lat: 0 }).lat, zoom: autoOrientZoom, pitch: 0, bearing: autoOrientBearing }}
                    style={{ width: "100%", height: "100%" }}
                    attributionControl={false}
                    pitchWithRotate={true}
                    onZoom={e => setMapZoom(e.viewState.zoom)}
                    onDragStart={() => { mapUserPannedRef.current = true; setMapUserPanned(true); }}
                    onZoomStart={e => { if (e.originalEvent) { mapUserPannedRef.current = true; setMapUserPanned(true); } }}
                    onLoad={({ target: map }) => {
                      mapRef.current = map;
                      setMapTilesLoading(false);

                      // Apply flag-up bearing immediately after map loads
                      try {
                        const hg = COURSE_DB[liveRound?.course]?.holes?.[liveRound?.currentHole + (liveRound?.holeOffset || 0)];
                        const target = flagPin || hg?.green?.center || hg?.green?.front || null;
                        const origin = teePin || hg?.tee || null;
                        if (target && origin) {
                          const brng = bearingDeg(origin.lat, origin.lng, target.lat, target.lng);
                          map.rotateTo(brng, { duration: 0 });
                        }
                      } catch (_) {}

                      // Strip road labels — keep pure course satellite imagery
                      try {
                        map.getStyle().layers.forEach(layer => {
                          if (layer.type === "symbol" && (
                            layer["source-layer"] === "road" ||
                            layer["source-layer"] === "transit" ||
                            /road|highway|shield|street/.test(layer.id)
                          )) {
                            map.setLayoutProperty(layer.id, "visibility", "none");
                          }
                        });
                      } catch (_) {}

                      // 3D Terrain — DEM elevation with 1.5× exaggeration for fairway depth
                      try {
                        if (!map.getSource("mapbox-dem")) {
                          map.addSource("mapbox-dem", {
                            type: "raster-dem",
                            url: "mapbox://mapbox.mapbox-terrain-dem-v1",
                            tileSize: 512,
                            maxzoom: 14,
                          });
                        }
                        map.setTerrain({ source: "mapbox-dem", exaggeration: 1.5 });
                      } catch (_) {}

                      // Inject invisible fill layers so water/landuse/natural are always
                      // queryable under satellite imagery (queryRenderedFeatures skips
                      // layers that aren't in the render tree, even if data exists).
                      try {
                        [
                          { id: '_hz-water',   sourceLayer: 'water'   },
                          { id: '_hz-landuse', sourceLayer: 'landuse' },
                          { id: '_hz-natural', sourceLayer: 'natural' },
                        ].forEach(({ id, sourceLayer }) => {
                          if (!map.getLayer(id)) {
                            map.addLayer({
                              id,
                              type: 'fill',
                              source: 'composite',
                              'source-layer': sourceLayer,
                              paint: { 'fill-opacity': 0, 'fill-color': '#000' },
                            });
                          }
                        });
                      } catch (_) {}

                      // If pins were auto-loaded from cache, fit the viewport around them
                      const fb = pendingFitBoundsRef.current;
                      if (fb) {
                        pendingFitBoundsRef.current = null;
                        try {
                          map.fitBounds(
                            [[Math.min(fb.tee.lng, fb.flag.lng), Math.min(fb.tee.lat, fb.flag.lat)],
                             [Math.max(fb.tee.lng, fb.flag.lng), Math.max(fb.tee.lat, fb.flag.lat)]],
                            { padding: 80, duration: 900, pitch: 60, bearing: autoOrientBearing }
                          );
                        } catch (_) {}
                      }
                    }}
                    onClick={e => {
                      // Mapbox GL onClick only fires when the pointer hasn't moved (no drag),
                      // so accidental taps-while-scrolling are already filtered out natively.
                      const { lat, lng } = e.lngLat;
                      if (placingMode === "tee") {
                        setTeePin({ lat, lng }); setTeePinManual(true); setCommunityPinSource(false);
                        setPlacingMode(null);
                      } else if (placingMode === "flag") {
                        setFlagPin({ lat, lng }); setCommunityPinSource(false);
                        setPlacingMode(null);
                      } else {
                        // Single tap → place / move target crosshair
                        hapticTap();
                        setTargetPin({ lat, lng });
                      }
                    }}
                  >
                      {/* ── Target Crosshair ── draggable, club-recommending ── */}
                      {targetPin && (() => {
                        // Distance from current GPS position to the target
                        const fromPos = effectivePlayerPos;
                        const targetDist = fromPos
                          ? Math.round(haversineYards(fromPos.lat, fromPos.lng, targetPin.lat, targetPin.lng))
                          : null;
                        const targetClub = (targetDist != null && sortedBagClubs.length > 0)
                          ? sortedBagClubs.find(c => parseFloat(c.distance) <= targetDist) || null
                          : null;
                        const inHazard = !!(mapRef.current && (() => { try { return _isWaterAtPoint(mapRef.current, targetPin); } catch { return false; } })());
                        const labelColor = inHazard ? "#ef4444" : Theme.primaryGreen;
                        return (
                          <Marker
                            longitude={targetPin.lng}
                            latitude={targetPin.lat}
                            anchor="center"
                            draggable
                            pitchAlignment="viewport"
                            rotationAlignment="viewport"
                            onDrag={e => {
                              const maxDist = sortedBagClubs.length > 0 ? parseFloat(sortedBagClubs[0].distance) : Infinity;
                              const from = effectivePlayerPos;
                              if (!from || !isFinite(maxDist)) return;
                              const lat = e.lngLat.lat, lng = e.lngLat.lng;
                              const dist = haversineYards(from.lat, from.lng, lat, lng);
                              if (dist > maxDist) {
                                const brng = bearingDeg(from.lat, from.lng, lat, lng);
                                const clamped = offsetLatLng(from.lat, from.lng, brng, maxDist);
                                setTargetPin({ lat: clamped.lat, lng: clamped.lng });
                              }
                            }}
                            onDragEnd={e => {
                              const maxDist = sortedBagClubs.length > 0 ? parseFloat(sortedBagClubs[0].distance) : Infinity;
                              const from = effectivePlayerPos;
                              let lat = e.lngLat.lat, lng = e.lngLat.lng;
                              if (from && isFinite(maxDist)) {
                                const dist = haversineYards(from.lat, from.lng, lat, lng);
                                if (dist > maxDist) {
                                  const brng = bearingDeg(from.lat, from.lng, lat, lng);
                                  const clamped = offsetLatLng(from.lat, from.lng, brng, maxDist);
                                  lat = clamped.lat; lng = clamped.lng;
                                }
                              }
                              setTargetPin({ lat, lng });
                            }}
                          >
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, cursor: "grab" }}>
                              {/* Floating label */}
                              <div style={{ background: inHazard ? "rgba(180,0,0,0.88)" : "rgba(0,0,0,0.82)", border: `1px solid ${labelColor}55`, borderRadius: 8, padding: "4px 10px", backdropFilter: "blur(8px)", display: "flex", flexDirection: "column", alignItems: "center", gap: 1, pointerEvents: "none" }}>
                                {inHazard ? (
                                  <span style={{ fontSize: 10, fontWeight: 800, color: "#fff", letterSpacing: 0.5, whiteSpace: "nowrap" }}>⚠ WARNING: HAZARD</span>
                                ) : targetClub ? (
                                  <span style={{ fontSize: 10, fontWeight: 700, color: Theme.primaryGreen, letterSpacing: 0.3, whiteSpace: "nowrap" }}>
                                    {targetClub.club} · {Math.round(parseFloat(targetClub.distance))}y
                                  </span>
                                ) : (
                                  <span style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.55)", whiteSpace: "nowrap" }}>No club in range</span>
                                )}
                                {targetDist != null && (
                                  <span style={{ fontSize: 9, color: "rgba(255,255,255,0.45)", letterSpacing: 0.3 }}>{targetDist}y from you</span>
                                )}
                              </div>
                              {/* Crosshair SVG */}
                              <svg width="30" height="30" viewBox="0 0 30 30" fill="none" style={{ filter: `drop-shadow(0 0 4px ${inHazard ? "#ef444488" : "rgba(255,255,255,0.5)"})` }}>
                                <circle cx="15" cy="15" r="10" stroke={inHazard ? "#ef4444" : "#fff"} strokeWidth="1.5" strokeOpacity="0.85"/>
                                <line x1="15" y1="1" x2="15" y2="9" stroke={inHazard ? "#ef4444" : "#fff"} strokeWidth="1.5" strokeOpacity="0.85"/>
                                <line x1="15" y1="21" x2="15" y2="29" stroke={inHazard ? "#ef4444" : "#fff"} strokeWidth="1.5" strokeOpacity="0.85"/>
                                <line x1="1" y1="15" x2="9" y2="15" stroke={inHazard ? "#ef4444" : "#fff"} strokeWidth="1.5" strokeOpacity="0.85"/>
                                <line x1="21" y1="15" x2="29" y2="15" stroke={inHazard ? "#ef4444" : "#fff"} strokeWidth="1.5" strokeOpacity="0.85"/>
                                <circle cx="15" cy="15" r="2.5" fill={inHazard ? "#ef4444" : "#fff"} opacity="0.9"/>
                              </svg>
                            </div>
                          </Marker>
                        );
                      })()}
                      {/* Player marker — green dot */}
                      {effectivePlayerPos && (
                        <Marker longitude={effectivePlayerPos.lng} latitude={effectivePlayerPos.lat} anchor="center" pitchAlignment="viewport" rotationAlignment="viewport" occludedOpacity={0} style={{ pointerEvents: placingMode ? "none" : "auto" }}>
                          <div style={{ position: "relative", width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <div className="stroke-marker-halo" style={{ position: "absolute", width: 24, height: 24, borderRadius: "50%", background: "rgba(125,162,126,0.15)", border: "1px solid rgba(125,162,126,0.85)" }} />
                            <div style={{ width: 14, height: 14, borderRadius: "50%", background: Theme.primaryGreen, border: "2px solid #fff", boxShadow: "0 0 8px rgba(125,162,126,0.7)", zIndex: 1 }} />
                          </div>
                        </Marker>
                      )}
                      {/* Course green markers — hidden when a manual flag is placed */}
                      {!flagPin && greenFront  && <Marker longitude={greenFront.lng}  latitude={greenFront.lat}  anchor="bottom" pitchAlignment="viewport" rotationAlignment="viewport" occludedOpacity={0} style={{ pointerEvents: placingMode ? "none" : "auto" }}><div style={{ width: 10, height: 10, borderRadius: "50%", background: "#16a34a", border: "2px solid #052e16", boxShadow: "0 0 6px rgba(0,0,0,0.7)" }} /></Marker>}
                      {!flagPin && greenCenter && <Marker longitude={greenCenter.lng} latitude={greenCenter.lat} anchor="bottom" pitchAlignment="viewport" rotationAlignment="viewport" occludedOpacity={0} style={{ pointerEvents: placingMode ? "none" : "auto" }}><div style={{ width: 13, height: 13, borderRadius: "50%", background: "#15803d", border: "2px solid #052e16", boxShadow: "0 0 8px rgba(0,0,0,0.7)" }} /></Marker>}
                      {!flagPin && greenBack   && <Marker longitude={greenBack.lng}   latitude={greenBack.lat}   anchor="bottom" pitchAlignment="viewport" rotationAlignment="viewport" occludedOpacity={0} style={{ pointerEvents: placingMode ? "none" : "auto" }}><div style={{ width: 10, height: 10, borderRadius: "50%", background: "#166534", border: "2px solid #052e16", boxShadow: "0 0 6px rgba(0,0,0,0.7)" }} /></Marker>}
                      {/* Manual Tee Pin — only shown when user explicitly dropped it */}
                      {teePin && teePinManual && (
                        <Marker key="tee-marker" longitude={teePin.lng} latitude={teePin.lat} anchor="bottom" pitchAlignment="viewport" rotationAlignment="viewport" occludedOpacity={0} style={{ pointerEvents: "none" }}>
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", filter: "drop-shadow(0 0 5px rgba(59,130,246,0.9))" }}>
                            <svg width="16" height="26" viewBox="0 0 16 26">
                              <ellipse cx="8" cy="5" rx="7" ry="3" fill="#fff"/>
                              <polygon points="7,7.5 9,7.5 8,24" fill="#fff"/>
                              <circle cx="8" cy="2.5" r="4" fill="#dbeafe" stroke="#fff" strokeWidth="0.5"/>
                            </svg>
                          </div>
                        </Marker>
                      )}
                      {/* Manual Flag Pin — locked once placed */}
                      {flagPin && (
                        <Marker key="flag-marker" longitude={flagPin.lng} latitude={flagPin.lat} anchor="bottom" pitchAlignment="viewport" rotationAlignment="viewport" occludedOpacity={0} style={{ pointerEvents: "none" }}>
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", filter: "drop-shadow(0 0 5px rgba(239,68,68,0.9))" }}>
                            <svg width="24" height="38" viewBox="0 0 24 38">
                              <line x1="6" y1="3" x2="6" y2="36" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
                              <polygon points="6,3 22,9 6,15" fill="#ef4444"/>
                              <ellipse cx="6" cy="36" rx="5" ry="2" fill="rgba(255,255,255,0.55)"/>
                            </svg>
                          </div>
                        </Marker>
                      )}
                      {/* Hazard markers */}
                      {holeGeo?.hazards?.map((hz, hi) =>
                        hz.coords?.map((pt, pi) => (
                          <Marker key={`hz-${hi}-${pi}`} longitude={pt.lng} latitude={pt.lat} anchor="center" pitchAlignment="viewport" rotationAlignment="viewport" occludedOpacity={0} style={{ pointerEvents: "none" }}>
                            <div style={{ width: 12, height: 12, borderRadius: "50%", background: hz.type === "water" ? "#2563eb" : hz.type === "ob" ? "#dc2626" : "#ca8a04", border: "1.5px solid #000", boxShadow: "0 0 4px rgba(0,0,0,0.6)" }} />
                          </Marker>
                        ))
                      )}

                      {/* ── Previous round shot dots (faded) ── */}
                      {(profile.courseShots?.[liveRound?.course]?.holes?.[currentHole] || []).map((shot, si) => (
                        <Marker key={`prev-shot-${si}`} longitude={shot.lng} latitude={shot.lat} anchor="bottom" pitchAlignment="viewport" rotationAlignment="viewport" occludedOpacity={0} style={{ pointerEvents: "none" }}>
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                            <div style={{ background: "rgba(0,0,0,0.5)", borderRadius: 5, padding: "1px 5px", border: "1px solid rgba(156,163,175,0.35)" }}>
                              <span style={{ fontSize: 9, fontFamily: "Bebas Neue", color: "rgba(156,163,175,0.65)", letterSpacing: 0.5 }}>{shot.club}</span>
                            </div>
                            <div style={{ width: 9, height: 9, borderRadius: "50%", background: "rgba(156,163,175,0.45)", border: "2px solid rgba(255,255,255,0.3)", boxShadow: "0 0 4px rgba(0,0,0,0.4)" }} />
                          </div>
                        </Marker>
                      ))}

                      {/* ── Shot history dots (current round) ── */}
                      {(shotHistoryArr[currentHole] || []).map((shot, si) => {
                        const isOB = shot.isOB;
                        const dotColor = isOB ? "#ef4444" : "#fbbf24";
                        const borderColor = isOB ? "rgba(239,68,68,0.6)" : "rgba(251,191,36,0.5)";
                        return (
                          <Marker key={`shot-${si}`} longitude={shot.lng} latitude={shot.lat} anchor="bottom" pitchAlignment="viewport" rotationAlignment="viewport" occludedOpacity={0} style={{ pointerEvents: "none" }}>
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                              <div style={{ background: "rgba(0,0,0,0.72)", borderRadius: 5, padding: "1px 5px", border: `1px solid ${borderColor}` }}>
                                <span style={{ fontSize: 9, fontFamily: "Bebas Neue", color: dotColor, letterSpacing: 0.5 }}>{shot.club}</span>
                              </div>
                              <div style={{ width: 9, height: 9, borderRadius: "50%", background: dotColor, border: "2px solid #fff", boxShadow: "0 0 5px rgba(0,0,0,0.6)" }} />
                            </div>
                          </Marker>
                        );
                      })}
                    </Map>
                ) : (
                  <div style={{ height: "100%", background: "#000", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8 }}>
                    <div style={{ fontSize: 22 }}>{gpsPermissionDenied ? "🚫" : "📡"}</div>
                    <div style={{ fontSize: 11, color: Theme.primaryGreen, fontWeight: 800, letterSpacing: 2, fontFamily: "Bebas Neue" }}>
                      {gpsPermissionDenied ? "GPS ACCESS DENIED" : "ACQUIRING GPS SIGNAL"}
                    </div>
                    {gpsPermissionDenied && (
                      <button
                        onClick={() => {
                          setGpsPermissionDenied(false);
                          navigator.geolocation.getCurrentPosition(
                            pos => {
                              const { latitude: lat, longitude: lng, accuracy } = pos.coords;
                              const newPos = { lat, lng, accuracy };
                              lastPlayerPosRef.current = newPos;
                              setPlayerPos(newPos);
                            },
                            err => { if (err.code === 1) setGpsPermissionDenied(true); },
                            { enableHighAccuracy: true, timeout: 15000 }
                          );
                        }}
                        style={{ marginTop: 8, padding: "8px 20px", background: Theme.primaryGreen, color: "#000", fontFamily: "Bebas Neue", fontSize: 13, letterSpacing: 2, border: "none", borderRadius: 6, cursor: "pointer" }}
                      >
                        REQUEST PERMISSION
                      </button>
                    )}
                  </div>
                )}
            </div>{/* ── end absoluteFill map canvas ── */}

            {/* ══ GOLF BALL LOADER — shown while Mapbox tiles are fetching ══ */}
            {mapTilesLoading && mapCenter && (
              <div style={{ position: "absolute", inset: 0, zIndex: 50, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, background: "rgba(0,0,0,0.55)", pointerEvents: "none" }}>
                <div className="golf-ball-loader" />
                <span style={{ fontSize: 10, fontFamily: "'Inter',sans-serif", fontWeight: 700, color: "rgba(255,255,255,0.65)", letterSpacing: 2, textTransform: "uppercase" }}>Loading Map…</span>
              </div>
            )}


            {/* ══ EMPTY-STATE TOOLTIP — shown until pins are placed ══ */}
            {!targetPin && !flagPin && !teePin && !placingMode && mapCenter && !mapTilesLoading && (
              <div style={{ position: "absolute", bottom: 58, left: "50%", transform: "translateX(-50%)", zIndex: 20, background: "rgba(0,0,0,0.78)", borderRadius: 20, padding: "8px 18px", border: "1px solid rgba(255,255,255,0.14)", backdropFilter: "blur(12px)", pointerEvents: "none", whiteSpace: "nowrap", animation: "fadeUp 0.5s ease" }}>
                <span style={{ fontSize: 11, fontFamily: "'Inter',sans-serif", fontWeight: 600, color: "rgba(255,255,255,0.82)", letterSpacing: 0.3 }}>
                  <span style={{ color: Theme.primaryGreen, fontWeight: 800 }}>Tap</span> to drop target · use buttons to place tee & flag
                </span>
              </div>
            )}

            {/* ══ COMMUNITY PINS BADGE ══ */}
            {communityPinSource && !placingMode && (
              <div style={{ position: "absolute", bottom: 58, left: "50%", transform: "translateX(-50%)", zIndex: 20, background: "rgba(26,26,26,0.88)", borderRadius: 20, padding: "5px 14px", border: `1px solid rgba(212,175,55,0.45)`, backdropFilter: "blur(12px)", pointerEvents: "none", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 6 }}>
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                  <circle cx="6" cy="6" r="5.5" stroke={Theme.mutedGold} strokeWidth="1.2"/>
                  <path d="M4 6l1.5 1.5L8.5 4" stroke={Theme.mutedGold} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span style={{ fontSize: 9, fontFamily: "Bebas Neue", color: Theme.mutedGold, letterSpacing: 1.5 }}>
                  PINS LOADED · {communityPinCount} {communityPinCount === 1 ? "GOLFER" : "GOLFERS"}
                </span>
              </div>
            )}

            {/* ══ PLACEMENT MODE BANNER ══ */}
            {placingMode && (
              <div style={{ position: "absolute", bottom: 10, left: "50%", transform: "translateX(-50%)", zIndex: 30, background: placingMode === "tee" ? "rgba(59,130,246,0.95)" : "rgba(220,38,38,0.95)", borderRadius: 24, padding: "7px 20px", display: "flex", alignItems: "center", gap: 8, pointerEvents: "none", boxShadow: `0 0 20px ${placingMode === "tee" ? "rgba(59,130,246,0.6)" : "rgba(220,38,38,0.6)"}`, whiteSpace: "nowrap" }}>
                <span style={{ fontSize: 13, fontFamily: "Bebas Neue", color: "#fff", letterSpacing: 2 }}>
                  {placingMode === "tee" ? "🏌️ TAP THE MAP TO PLACE THE TEE" : "⛳ TAP THE MAP TO PLACE THE FLAG"}
                </span>
              </div>
            )}

            {/* ══ FOUND BALL / OB — bottom-center ══ */}
            {playerPos && !placingMode && teePin && flagPin && playerSpeed < 1 && (
              <div style={{ position: "absolute", bottom: 58, left: "50%", transform: "translateX(-50%)", zIndex: 25, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                {(() => {
                  const currentShots = shotHistoryArr[currentHole] || [];
                  const lastNonOB = currentShots.filter(s => s.club !== "OB").slice(-1)[0];
                  const fromPos = lastNonOB || teePin;
                  const d = Math.round(haversineYards(fromPos.lat, fromPos.lng, playerPos.lat, playerPos.lng));
                  return <span style={{ fontSize: 9, fontFamily: "Bebas Neue", color: "rgba(255,255,255,0.5)", letterSpacing: 1.5 }}>{d}y {lastNonOB ? "from last shot" : "from tee"}</span>;
                })()}
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <button
                    onClick={() => {
                      hapticTap();
                      const currentShots = shotHistoryArr[currentHole] || [];
                      const lastNonOB = currentShots.filter(s => s.club !== "OB").slice(-1)[0];
                      const fromPos = lastNonOB || teePin;
                      const distToFlag = effectiveFlag ? haversineYards(playerPos.lat, playerPos.lng, effectiveFlag.lat, effectiveFlag.lng) : Infinity;
                      if (distToFlag <= 30) {
                        const puttYards = Math.round(haversineYards(fromPos.lat, fromPos.lng, playerPos.lat, playerPos.lng));
                        setLivePuttsArr(a => { const n = [...a]; n[currentHole] = (n[currentHole] ?? 0) + 1; return n; });
                        setLiveStrokesArr(a => { const n = [...a]; n[currentHole] = (n[currentHole] ?? 0) + 1; return n; });
                        setLiveRound(r => { const sc = [...r.scores]; sc[currentHole] = (sc[currentHole] ?? 0) + 1; const next = { ...r, scores: sc }; if (authUser && !roundSubmittedRef.current) setDoc(doc(db, "users", authUser.uid), { liveRound: next }, { merge: true }).catch(() => {}); return next; });
                        setShotHistoryArr(arr => { const n = [...arr]; if (!n[currentHole]) n[currentHole] = []; n[currentHole] = [...n[currentHole], { lat: playerPos.lat, lng: playerPos.lng, club: "PUTT", yards: puttYards }]; return n; });
                        setAttrToast("PUTT TRACKED");
                        setTimeout(() => setAttrToast(null), 1500);
                      } else {
                        const yards = Math.round(haversineYards(fromPos.lat, fromPos.lng, playerPos.lat, playerPos.lng));
                        setShotInFairway(false);
                        setPendingShotYards(yards);
                        setPendingShotEndPos({ lat: playerPos.lat, lng: playerPos.lng });
                        setLiveStrokesArr(a => { const n = [...a]; n[currentHole] = (n[currentHole] ?? 0) + 1; return n; });
                        setLiveRound(r => { const sc = [...r.scores]; sc[currentHole] = (sc[currentHole] ?? 0) + 1; const next = { ...r, scores: sc }; if (authUser && !roundSubmittedRef.current) setDoc(doc(db, "users", authUser.uid), { liveRound: next }, { merge: true }).catch(() => {}); return next; });
                      }
                    }}
                    style={{ background: "rgba(0,0,0,0.75)", border: "1.5px solid rgba(255,255,255,0.2)", backdropFilter: "blur(12px)", borderRadius: 24, padding: "8px 20px", display: "flex", alignItems: "center", gap: 7, cursor: "pointer" }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3" fill="rgba(255,255,255,0.85)"/>
                    </svg>
                    <span style={{ fontSize: 12, fontFamily: "Bebas Neue", color: "rgba(255,255,255,0.85)", letterSpacing: 1.5 }}>FOUND BALL</span>
                  </button>
                  <button
                    onClick={() => {
                      hapticTap();
                      setShotHistoryArr(arr => { const n = [...arr]; if (!n[currentHole]) n[currentHole] = []; n[currentHole] = [...n[currentHole], { lat: playerPos.lat, lng: playerPos.lng, club: "OB", yards: 0, isOB: true }]; return n; });
                      setLiveStrokesArr(a => { const n = [...a]; n[currentHole] = (n[currentHole] ?? 0) + 2; return n; });
                      setLiveRound(r => { const sc = [...r.scores]; sc[currentHole] = (sc[currentHole] ?? 0) + 2; const next = { ...r, scores: sc }; if (authUser && !roundSubmittedRef.current) setDoc(doc(db, "users", authUser.uid), { liveRound: next }, { merge: true }).catch(() => {}); return next; });
                      setAttrToast("OB · +2 STROKES");
                      setTimeout(() => setAttrToast(null), 2000);
                    }}
                    style={{ background: "rgba(220,38,38,0.15)", border: "1.5px solid rgba(220,38,38,0.4)", backdropFilter: "blur(12px)", borderRadius: 24, padding: "8px 14px", display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}
                  >
                    <span style={{ fontSize: 12, fontFamily: "Bebas Neue", color: "#ef4444", letterSpacing: 1.5 }}>OB</span>
                  </button>
                </div>
              </div>
            )}

            {/* ══ TEE + FLAG PLACE BUTTONS — bottom-left ══ */}
            {!placingMode && (
              <div style={{ position: "absolute", left: 10, bottom: 58, zIndex: 20, display: "flex", flexDirection: "column", gap: 6 }}>
                <button
                  onClick={() => { if (teePin) { setTeePin(null); setTeePinManual(false); setTargetPin(null); setCommunityPinSource(false); setPlacingMode("tee"); } else setPlacingMode("tee"); }}
                  style={{ width: 40, height: 40, borderRadius: 10, background: teePin ? "rgba(59,130,246,0.85)" : "rgba(0,0,0,0.65)", border: `1.5px solid ${teePin ? "rgba(59,130,246,0.9)" : "rgba(255,255,255,0.15)"}`, backdropFilter: "blur(10px)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: "pointer", gap: 1 }}
                >
                  <svg width="16" height="22" viewBox="0 0 16 26" fill="none">
                    <ellipse cx="8" cy="5" rx="7" ry="3" fill={teePin ? "#fff" : "rgba(255,255,255,0.7)"}/>
                    <polygon points="7,7.5 9,7.5 8,24" fill={teePin ? "#fff" : "rgba(255,255,255,0.7)"}/>
                    <circle cx="8" cy="2.5" r="4" fill={teePin ? "#dbeafe" : "rgba(219,234,254,0.6)"} stroke={teePin ? "#fff" : "rgba(255,255,255,0.5)"} strokeWidth="0.5"/>
                  </svg>
                  <span style={{ fontSize: 6, fontFamily: "Bebas Neue", color: teePin ? "#fff" : "rgba(255,255,255,0.45)", letterSpacing: 0.8 }}>{teePin ? "CLEAR" : "TEE"}</span>
                </button>
                <button
                  onClick={() => { if (flagPin) { if (window.confirm("Remove flag pin?")) { setFlagPin(null); setTargetPin(null); setCommunityPinSource(false); } } else setPlacingMode("flag"); }}
                  style={{ width: 40, height: 40, borderRadius: 10, background: flagPin ? "rgba(220,38,38,0.85)" : "rgba(0,0,0,0.65)", border: `1.5px solid ${flagPin ? "rgba(220,38,38,0.9)" : "rgba(255,255,255,0.15)"}`, backdropFilter: "blur(10px)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: "pointer", gap: 1 }}
                >
                  <svg width="14" height="20" viewBox="0 0 24 38" fill="none">
                    <line x1="6" y1="3" x2="6" y2="28" stroke={flagPin ? "#fff" : "rgba(255,255,255,0.7)"} strokeWidth="2" strokeLinecap="round"/>
                    <polygon points="6,3 22,9 6,15" fill={flagPin ? "#ef4444" : "rgba(239,68,68,0.6)"}/>
                  </svg>
                  <span style={{ fontSize: 6, fontFamily: "Bebas Neue", color: flagPin ? "#fff" : "rgba(255,255,255,0.45)", letterSpacing: 0.8 }}>{flagPin ? "CLEAR" : "FLAG"}</span>
                </button>
              </div>
            )}

            {/* ══ FLOATING TOP BAR — hole · distance · par · plays-like ══ */}
            <div style={{ position: "absolute", top: "calc(10px + env(safe-area-inset-top, 0px))", left: "50%", transform: "translateX(-50%)", zIndex: 20, background: "rgba(0,0,0,0.80)", borderRadius: 28, border: "1px solid rgba(255,255,255,0.10)", padding: "7px 20px", display: "flex", alignItems: "center", gap: 14, backdropFilter: "blur(14px)", whiteSpace: "nowrap", boxShadow: "0 4px 24px rgba(0,0,0,0.55)" }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 7, fontFamily: "DM Sans", fontWeight: 700, color: "rgba(147,197,253,0.55)", letterSpacing: 2, lineHeight: 1 }}>HOLE</div>
                <div style={{ fontSize: 24, fontFamily: "Bebas Neue", color: "#93c5fd", letterSpacing: 1, lineHeight: 1 }}>{absHole + 1}</div>
              </div>
              <div style={{ width: 1, height: 30, background: "rgba(255,255,255,0.12)" }} />
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 7, fontFamily: "DM Sans", fontWeight: 700, color: "rgba(255,255,255,0.4)", letterSpacing: 2, lineHeight: 1 }}>{onCourse ? "TO PIN" : "TEE→PIN"}</div>
                <div style={{ fontSize: 24, fontFamily: "Bebas Neue", color: "#ffffff", letterSpacing: 1, lineHeight: 1 }}>
                  {livePinYards ?? "—"}<span style={{ fontSize: 11, color: "rgba(255,255,255,0.38)", marginLeft: 1 }}>y</span>
                </div>
              </div>
              <div style={{ width: 1, height: 30, background: "rgba(255,255,255,0.12)" }} />
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 7, fontFamily: "DM Sans", fontWeight: 700, color: "rgba(255,255,255,0.4)", letterSpacing: 2, lineHeight: 1 }}>PAR</div>
                <div style={{ fontSize: 24, fontFamily: "Bebas Neue", color: "#ffffff", letterSpacing: 1, lineHeight: 1 }}>{holePar}</div>
              </div>
              {!shortGame && playAsYards != null && playAsYards !== livePinYards && (
                <>
                  <div style={{ width: 1, height: 30, background: "rgba(255,255,255,0.12)" }} />
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 7, fontFamily: "DM Sans", fontWeight: 700, color: "rgba(125,162,126,0.7)", letterSpacing: 2, lineHeight: 1 }}>PLAYS</div>
                    <div style={{ fontSize: 24, fontFamily: "Bebas Neue", color: Theme.primaryGreen, letterSpacing: 1, lineHeight: 1 }}>
                      {playAsYards}<span style={{ fontSize: 11, color: "rgba(125,162,126,0.55)", marginLeft: 1 }}>y</span>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* ══ GPS ACCURACY — below center pill ══ */}
            {playerPos && (
              <div style={{ position: "absolute", top: "calc(72px + env(safe-area-inset-top, 0px))", left: 10, zIndex: 25, background: "rgba(0,0,0,0.55)", borderRadius: 5, padding: "2px 6px", fontSize: 8, color: "rgba(125,162,126,0.75)", letterSpacing: 0.5, border: "1px solid rgba(125,162,126,0.2)", fontFamily: "Bebas Neue", pointerEvents: "none" }}>
                ±{Math.round(playerPos.accuracy)}M
              </div>
            )}


            {/* ══ 3-POINT GREEN HUD — right side, below center pill ══ */}
            {onCourse && (distToBack != null || livePinYards != null || distToFront != null) && (
              <div style={{ position: "absolute", top: "calc(72px + env(safe-area-inset-top, 0px))", right: 10, zIndex: 20, background: "rgba(0,0,0,0.82)", borderRadius: 12, border: "1px solid rgba(255,255,255,0.09)", padding: "8px 12px", backdropFilter: "blur(14px)", display: "flex", flexDirection: "column", gap: 4, minWidth: 80 }}>
                {distToBack != null && (
                  <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                    <span style={{ fontSize: 10, fontFamily: "Bebas Neue", color: "#ef4444", letterSpacing: 1.5, lineHeight: 1 }}>B:</span>
                    <span style={{ fontSize: 18, fontFamily: "Bebas Neue", color: "#ef4444", lineHeight: 1 }}>{distToBack}</span>
                    <span style={{ fontSize: 9, fontFamily: "Bebas Neue", color: "rgba(239,68,68,0.5)" }}>y</span>
                  </div>
                )}
                <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                  <span style={{ fontSize: 10, fontFamily: "Bebas Neue", color: "rgba(255,255,255,0.5)", letterSpacing: 1.5, lineHeight: 1 }}>M:</span>
                  <span style={{ fontSize: 28, fontFamily: "Bebas Neue", color: "#ffffff", lineHeight: 1 }}>{livePinYards ?? "—"}</span>
                  <span style={{ fontSize: 10, fontFamily: "Bebas Neue", color: "rgba(255,255,255,0.35)" }}>y</span>
                </div>
                {distToFront != null && (
                  <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                    <span style={{ fontSize: 10, fontFamily: "Bebas Neue", color: Theme.softSlate, letterSpacing: 1.5, lineHeight: 1 }}>F:</span>
                    <span style={{ fontSize: 18, fontFamily: "Bebas Neue", color: Theme.offWhite, lineHeight: 1 }}>{distToFront}</span>
                    <span style={{ fontSize: 9, fontFamily: "Bebas Neue", color: "rgba(224,224,224,0.45)" }}>y</span>
                  </div>
                )}
              </div>
            )}


            {/* ══ FABs — conditions info, stacked bottom-right ══ */}
            <div style={{ position: "absolute", bottom: 10, right: 10, zIndex: 20, display: "flex", flexDirection: "column", gap: 8, alignItems: "center" }}>
              {windDisplayStr && (
                <div style={{ width: 44, height: 44, borderRadius: "50%", background: "rgba(0,0,0,0.84)", border: "1px solid rgba(147,197,253,0.3)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", backdropFilter: "blur(10px)", boxShadow: "0 2px 10px rgba(0,0,0,0.4)" }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ transform: `rotate(${windGoingToDeg}deg)`, flexShrink: 0 }}>
                    <path d="M12 3L7 14h10L12 3z" fill="#93c5fd" opacity="0.9"/>
                    <rect x="11" y="13" width="2" height="8" fill="#93c5fd" opacity="0.55" rx="1"/>
                  </svg>
                  <span style={{ fontSize: 7, fontFamily: "Bebas Neue", color: "#93c5fd", letterSpacing: 0.5, lineHeight: 1.1 }}>{Math.round(liveWeather?.windSpeed ?? 0)}mph</span>
                </div>
              )}
              {holeElevFt !== 0 && (
                <div style={{ width: 44, height: 44, borderRadius: "50%", background: "rgba(0,0,0,0.84)", border: "1px solid rgba(255,255,255,0.16)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", backdropFilter: "blur(10px)", boxShadow: "0 2px 10px rgba(0,0,0,0.4)" }}>
                  <span style={{ fontSize: 13, lineHeight: 1 }}>{holeElevFt > 0 ? "⬆️" : "⬇️"}</span>
                  <span style={{ fontSize: 7, fontFamily: "Bebas Neue", color: "#ffffff", letterSpacing: 0.5, lineHeight: 1.3 }}>{holeElevFt > 0 ? "+" : ""}{holeElevFt}ft</span>
                </div>
              )}
              {tempF != null && (
                <div style={{ width: 44, height: 44, borderRadius: "50%", background: "rgba(0,0,0,0.84)", border: "1px solid rgba(251,191,36,0.28)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", backdropFilter: "blur(10px)", boxShadow: "0 2px 10px rgba(0,0,0,0.4)" }}>
                  <span style={{ fontSize: 13, lineHeight: 1 }}>🌡️</span>
                  <span style={{ fontSize: 7, fontFamily: "Bebas Neue", color: "#fbbf24", letterSpacing: 0.5, lineHeight: 1.3 }}>{Math.round(tempF)}°F</span>
                </div>
              )}
            </div>{/* ── end FABs ── */}

            {/* ══ HOLE NAV CHEVRONS — overlaid on map edges ══ */}
            {currentHole > 0 && !placingMode && (
              <button onClick={() => { mapUserPannedRef.current = false; setMapUserPanned(false); savePinLayout(course, absHole, teePin, flagPin); if (teePin || flagPin) pushPinVote(communityPinCourseKey(liveRound), absHole, teePin, flagPin); setTeePin(null); setTeePinManual(false); setFlagPin(null); setTargetPin(null); setShotStartPos(null); setLiveRound(r => ({ ...r, currentHole: Math.max(0, r.currentHole - 1) })); setParPickerHole(null); setScorePickerHole(null); setPlacingMode(null); }}
                style={{ position: "absolute", left: 6, top: "50%", transform: "translateY(-50%)", zIndex: 20, width: 36, height: 60, borderRadius: 10, background: "rgba(0,0,0,0.52)", border: "1px solid rgba(255,255,255,0.1)", backdropFilter: "blur(10px)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 3L5 8l5 5" stroke="rgba(255,255,255,0.6)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
            )}
            {currentHole < holeCount - 1 && !placingMode && (
              <button onClick={() => { hapticTap(); mapUserPannedRef.current = false; setMapUserPanned(false); savePinLayout(course, absHole, teePin, flagPin); if (teePin || flagPin) pushPinVote(communityPinCourseKey(liveRound), absHole, teePin, flagPin); setCommunityPinSource(false); setCommunityPinCount(0); setMapTilesLoading(true); setLiveRound(r => { const sc = [...r.scores]; if (sc[r.currentHole] == null) sc[r.currentHole] = liveStrokesArr[r.currentHole] > 0 ? liveStrokesArr[r.currentHole] : (r.holePars?.[r.currentHole] || 4); const next = { ...r, scores: sc, currentHole: Math.min(holeCount - 1, r.currentHole + 1) }; if (r.isNewCourse && playerPos) { next.capturedHoleCenters = { ...(r.capturedHoleCenters || {}), [r.currentHole]: { lat: playerPos.lat, lng: playerPos.lng } }; } if (authUser) setDoc(doc(db, "users", authUser.uid), { liveRound: next }, { merge: true }).catch(() => {}); return next; }); setParPickerHole(null); setScorePickerHole(null); setTeePin(null); setTeePinManual(false); setFlagPin(null); setTargetPin(null); setShotStartPos(null); setPlacingMode(null); }}
                style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", zIndex: 20, width: 36, height: 60, borderRadius: 10, background: "rgba(0,0,0,0.52)", border: "1px solid rgba(255,255,255,0.1)", backdropFilter: "blur(10px)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 3l5 5-5 5" stroke="rgba(255,255,255,0.6)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
            )}
          </div>{/* ── end map section ── */}

          {/* ══ SINGLE-HOLE CONTROL BAR ══ */}
          <div style={{ flex: "0 0 auto", display: "flex", alignItems: "stretch", padding: "8px 10px", paddingBottom: "calc(8px + env(safe-area-inset-bottom, 0px))", background: "rgba(10,10,30,0.94)", backdropFilter: "blur(20px) saturate(1.4)", WebkitBackdropFilter: "blur(20px) saturate(1.4)", borderTop: "1.5px solid rgba(192,192,192,0.15)", gap: 6 }}>

            {/* SCORE tile — tap centre for scorecard, +/- to adjust */}
            <div style={{ flex: 1.5, display: "flex", flexDirection: "column", background: holeScore != null ? "rgba(125,162,126,0.08)" : "rgba(255,255,255,0.03)", border: `1.5px solid ${holeScore != null ? "rgba(125,162,126,0.4)" : "rgba(255,255,255,0.1)"}`, borderRadius: 12, overflow: "hidden" }}>
              <div onClick={() => setShowScorecard(true)} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: "4px 4px 0" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                  <span style={{ fontSize: 7, fontFamily: "Bebas Neue", color: "rgba(224,224,224,0.4)", letterSpacing: 1.5 }}>HOLE {absHole + 1}</span>
                  <button onClick={e => { e.stopPropagation(); setParPickerHole(currentHole); }}
                    style={{ background: "rgba(147,197,253,0.12)", border: "1px solid rgba(147,197,253,0.25)", borderRadius: 4, padding: "1px 5px", cursor: "pointer" }}>
                    <span style={{ fontSize: 7, fontFamily: "Bebas Neue", color: "#93c5fd", letterSpacing: 1 }}>PAR {holePar}</span>
                  </button>
                </div>
                <span style={{ fontSize: 46, fontFamily: "Bebas Neue", color: holeScoreColor, lineHeight: 1 }}>{holeScore ?? "·"}</span>
                {holeScoreLabel
                  ? <span style={{ fontSize: 8, fontFamily: "Bebas Neue", color: holeScoreColor, letterSpacing: 1.5 }}>{holeScoreLabel}</span>
                  : <span style={{ fontSize: 8, fontFamily: "Bebas Neue", color: "rgba(224,224,224,0.3)", letterSpacing: 1 }}>TAP SCORECARD</span>
                }
              </div>
              <div style={{ display: "flex", borderTop: "1px solid rgba(255,255,255,0.07)" }}>
                <button onClick={() => setLiveRound(r => { const sc = [...r.scores]; sc[currentHole] = Math.max(1, (sc[currentHole] ?? holePar) - 1); const next = { ...r, scores: sc }; if (authUser && !roundSubmittedRef.current) setDoc(doc(db, "users", authUser.uid), { liveRound: next }, { merge: true }).catch(() => {}); return next; })} style={{ flex: 1, padding: "5px 0", background: "transparent", border: "none", borderRight: "1px solid rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.55)", fontSize: 18, fontWeight: 900, cursor: "pointer" }}>−</button>
                <button onClick={() => setLiveRound(r => { const sc = [...r.scores]; sc[currentHole] = (sc[currentHole] ?? holePar) + 1; const next = { ...r, scores: sc }; if (authUser && !roundSubmittedRef.current) setDoc(doc(db, "users", authUser.uid), { liveRound: next }, { merge: true }).catch(() => {}); return next; })} style={{ flex: 1, padding: "5px 0", background: "transparent", border: "none", color: "rgba(255,255,255,0.55)", fontSize: 18, fontWeight: 900, cursor: "pointer" }}>+</button>
              </div>
            </div>

            {/* Divider */}
            <div style={{ width: 1, background: "rgba(255,255,255,0.08)", flexShrink: 0 }} />

            {/* PUTTS tile */}
            {(() => {
              const holePutts = livePuttsArr[currentHole] ?? 0;
              return (
                <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-between", background: "rgba(91,114,130,0.07)", border: "1px solid rgba(91,114,130,0.18)", borderRadius: 12, padding: "7px 4px" }}>
                  <span style={{ fontSize: 7, fontFamily: "Bebas Neue", color: "rgba(224,224,224,0.45)", letterSpacing: 1.5 }}>PUTTS</span>
                  <span style={{ fontSize: 30, fontFamily: "Bebas Neue", color: Theme.offWhite, lineHeight: 1 }}>{holePutts}</span>
                  <div style={{ display: "flex", gap: 5 }}>
                    <button onClick={() => { setLivePuttsArr(a => { const n = [...a]; n[currentHole] = Math.max(0, (n[currentHole] ?? 0) - 1); return n; }); setLiveRound(r => { const sc = [...r.scores]; sc[currentHole] = Math.max(1, (sc[currentHole] ?? 1) - 1); const next = { ...r, scores: sc }; if (authUser && !roundSubmittedRef.current) setDoc(doc(db, "users", authUser.uid), { liveRound: next }, { merge: true }).catch(() => {}); return next; }); }} style={{ width: 32, height: 26, borderRadius: 6, background: "rgba(91,114,130,0.15)", border: "1px solid rgba(91,114,130,0.3)", color: Theme.offWhite, fontSize: 18, fontWeight: 900, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
                    <button onClick={() => { setLivePuttsArr(a => { const n = [...a]; n[currentHole] = (n[currentHole] ?? 0) + 1; return n; }); setLiveRound(r => { const sc = [...r.scores]; sc[currentHole] = (sc[currentHole] ?? 0) + 1; const next = { ...r, scores: sc }; if (authUser && !roundSubmittedRef.current) setDoc(doc(db, "users", authUser.uid), { liveRound: next }, { merge: true }).catch(() => {}); return next; }); }} style={{ width: 32, height: 26, borderRadius: 6, background: "rgba(91,114,130,0.15)", border: "1px solid rgba(91,114,130,0.3)", color: Theme.offWhite, fontSize: 18, fontWeight: 900, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
                  </div>
                </div>
              );
            })()}

            {/* FWY tile — yes/no toggle, only relevant on par 4s and 5s */}
            {holePar > 3 && (() => {
              const holeFwy = liveFairwaysArr[currentHole] ?? null;
              return (
                <button
                  onClick={() => setLiveFairwaysArr(a => { const n = [...a]; n[currentHole] = n[currentHole] === true ? null : true; return n; })}
                  onContextMenu={e => { e.preventDefault(); setLiveFairwaysArr(a => { const n = [...a]; n[currentHole] = n[currentHole] === false ? null : false; return n; }); }}
                  style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, background: holeFwy === true ? "rgba(125,162,126,0.15)" : holeFwy === false ? "rgba(239,68,68,0.1)" : "rgba(91,114,130,0.07)", border: `1px solid ${holeFwy === true ? "rgba(125,162,126,0.4)" : holeFwy === false ? "rgba(239,68,68,0.35)" : "rgba(91,114,130,0.18)"}`, borderRadius: 12, padding: "7px 4px", cursor: "pointer" }}>
                  <span style={{ fontSize: 7, fontFamily: "Bebas Neue", color: "rgba(224,224,224,0.45)", letterSpacing: 1.5 }}>FWY</span>
                  <span style={{ fontSize: 26, fontFamily: "Bebas Neue", lineHeight: 1, color: holeFwy === true ? Theme.primaryGreen : holeFwy === false ? "#ef4444" : "rgba(255,255,255,0.2)" }}>
                    {holeFwy === true ? "✓" : holeFwy === false ? "✗" : "·"}
                  </span>
                  <span style={{ fontSize: 6, fontFamily: "Bebas Neue", color: "rgba(224,224,224,0.25)", letterSpacing: 1 }}>TAP</span>
                </button>
              );
            })()}

            {/* GIR tile — auto-computed from score and putts */}
            {(() => {
              const holeScore = scores[currentHole];
              const holePutts = livePuttsArr[currentHole] ?? 0;
              const shotsToGreen = holeScore != null ? holeScore - holePutts : null;
              const autoGIR = shotsToGreen != null ? shotsToGreen <= holePar - 2 : null;
              return (
                <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, background: autoGIR === true ? "rgba(125,162,126,0.1)" : autoGIR === false ? "rgba(239,68,68,0.07)" : "rgba(91,114,130,0.07)", border: `1px solid ${autoGIR === true ? "rgba(125,162,126,0.3)" : autoGIR === false ? "rgba(239,68,68,0.25)" : "rgba(91,114,130,0.18)"}`, borderRadius: 12, padding: "7px 4px" }}>
                  <span style={{ fontSize: 7, fontFamily: "Bebas Neue", color: "rgba(224,224,224,0.45)", letterSpacing: 1.5 }}>GIR</span>
                  <span style={{ fontSize: 26, fontFamily: "Bebas Neue", lineHeight: 1, color: autoGIR === true ? Theme.primaryGreen : autoGIR === false ? "#ef4444" : "rgba(255,255,255,0.2)" }}>
                    {autoGIR === true ? "✓" : autoGIR === false ? "✗" : "·"}
                  </span>
                  <span style={{ fontSize: 6, fontFamily: "Bebas Neue", color: "rgba(224,224,224,0.25)", letterSpacing: 1 }}>AUTO</span>
                </div>
              );
            })()}

            {/* Divider */}
            <div style={{ width: 1, background: "rgba(255,255,255,0.08)", flexShrink: 0 }} />

            {/* END / FINISH tile */}
            {currentHole === holeCount - 1
              ? <button onClick={submitLiveRound} disabled={filled < holeCount || roundSaving}
                  style={{ flex: "0 0 58px", borderRadius: 12, border: "none", background: filled >= holeCount && !roundSaving ? Theme.primaryGreen : "rgba(125,162,126,0.07)", color: filled >= holeCount && !roundSaving ? "#000" : "rgba(125,162,126,0.25)", fontSize: 9, fontWeight: 800, letterSpacing: 0.8, fontFamily: "Bebas Neue", cursor: filled >= holeCount && !roundSaving ? "pointer" : "default", lineHeight: 1.4 }}>{roundSaving ? "SAVING…" : "FINISH"}<br/>{roundSaving ? "" : "ROUND"}</button>
              : <button onClick={() => { if (window.confirm("End this round?")) abandonLiveRound(); }}
                  style={{ flex: "0 0 52px", borderRadius: 12, border: "1.5px solid rgba(220,38,38,0.45)", background: "rgba(220,38,38,0.1)", color: "#f87171", fontSize: 9, fontWeight: 800, letterSpacing: 0.8, fontFamily: "Bebas Neue", cursor: "pointer", lineHeight: 1.4 }}>END<br/>ROUND</button>
            }
          </div>{/* ── end control bar ── */}

            {/* ══ PAR PICKER MODAL ══ */}
            {parPickerHole !== null && (
              <div onClick={() => setParPickerHole(null)} style={{ position: "fixed", inset: 0, zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.55)" }}>
                <div onClick={e => e.stopPropagation()} style={{ background: "rgba(26,26,26,0.98)", border: "1px solid rgba(91,114,130,0.35)", borderRadius: 14, padding: "14px 18px", display: "flex", flexDirection: "column", alignItems: "center", gap: 10, boxShadow: "0 10px 40px rgba(0,0,0,0.5)", minWidth: 180 }}>
                  <div style={{ fontSize: 11, fontFamily: "Bebas Neue", color: "rgba(224,224,224,0.6)", letterSpacing: 2 }}>HOLE {parPickerHole + 1 + holeOffset} — SET PAR</div>
                  <div style={{ display: "flex", gap: 10 }}>
                    {[3, 4, 5].map(p => {
                      const active = (holePars[parPickerHole] || 4) === p;
                      return (
                        <button key={p} onClick={() => { updateLivePar(parPickerHole, p); setParPickerHole(null); }}
                          style={{ width: 54, height: 54, borderRadius: 10, border: active ? `2.5px solid ${Theme.mutedGold}` : "1px solid rgba(91,114,130,0.3)", background: active ? "rgba(212,175,55,0.15)" : "rgba(255,255,255,0.04)", color: active ? Theme.mutedGold : "rgba(224,224,224,0.5)", fontSize: 26, fontFamily: "Bebas Neue", cursor: "pointer" }}>
                          {p}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* ══ FULL SCORECARD MODAL ══ */}
            {showScorecard && (
              <div onClick={() => setShowScorecard(false)} style={{ position: "fixed", inset: 0, zIndex: 300, display: "flex", alignItems: "flex-end", justifyContent: "center", background: "rgba(0,0,0,0.5)" }}>
                <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: "20px 20px 0 0", padding: "16px 16px 32px", width: "100%", maxWidth: 480, borderTop: "1px solid #e5e7eb", maxHeight: "80vh", overflowY: "auto" }}>
                  {/* Header */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                    <div>
                      <div style={{ fontSize: 16, fontFamily: "Bebas Neue", color: "#111827", letterSpacing: 2 }}>{course || "SCORECARD"}</div>
                      <div style={{ fontSize: 9, color: "#9ca3af", letterSpacing: 1.5, fontFamily: "Bebas Neue" }}>
                        {holeCount} HOLES · PAR {holePars.slice(0, holeCount).reduce((a, b) => a + (b || 4), 0)}
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      {(() => {
                        const playedHoles = scores.slice(0, holeCount).map((s, i) => s != null ? { s, p: holePars[i] || 4 } : null).filter(Boolean);
                        const totalScore = playedHoles.reduce((a, h) => a + h.s, 0);
                        const totalPar = playedHoles.reduce((a, h) => a + h.p, 0);
                        const filled = playedHoles.length;
                        const diff = totalScore - totalPar;
                        const diffColor = diff < 0 ? "#3b82f6" : diff === 0 ? Theme.primaryGreen : diff <= 2 ? "#d97706" : "#dc2626";
                        return filled > 0 ? (
                          <div style={{ textAlign: "right" }}>
                            <div style={{ fontSize: 28, fontFamily: "Bebas Neue", color: "#111827", lineHeight: 1 }}>{totalScore}</div>
                            <div style={{ fontSize: 10, fontFamily: "Bebas Neue", color: diffColor, letterSpacing: 1 }}>
                              {diff === 0 ? "E" : diff > 0 ? `+${diff}` : diff}
                            </div>
                          </div>
                        ) : null;
                      })()}
                      <button onClick={() => setShowScorecard(false)} style={{ background: "#f3f4f6", border: "none", borderRadius: 8, width: 32, height: 32, color: "#6b7280", fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
                    </div>
                  </div>

                  {/* Hole grid */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(9, 1fr)", gap: 4 }}>
                    {Array.from({ length: holeCount }, (_, i) => {
                      const par = holePars[i] || 4;
                      const score = scores[i];
                      const d = score != null ? score - par : null;
                      const isCurrent = i === currentHole;
                      const bg = score == null
                        ? isCurrent ? "rgba(125,162,126,0.15)" : "#f3f4f6"
                        : d <= -2 ? "#bfdbfe"
                        : d === -1 ? "#dbeafe"
                        : d === 0 ? "#dcfce7"
                        : d === 1 ? "#fef3c7"
                        : d === 2 ? "#fee2e2"
                        : "#fecaca";
                      const scoreColor = score == null ? "#9ca3af" : "#111827";
                      return (
                        <button key={i} onClick={() => { setScorePickerHole(i); setShowScorecard(false); }}
                          style={{ background: bg, border: isCurrent ? `1.5px solid ${Theme.primaryGreen}` : "1px solid #e5e7eb", borderRadius: 8, padding: "8px 4px 6px", display: "flex", flexDirection: "column", alignItems: "center", gap: 2, cursor: "pointer" }}>
                          <span style={{ fontSize: 7, fontFamily: "Bebas Neue", color: "#9ca3af", letterSpacing: 1 }}>{i + 1 + holeOffset}</span>
                          <span style={{ fontSize: 20, fontFamily: "Bebas Neue", color: scoreColor, lineHeight: 1 }}>{score ?? "·"}</span>
                          <span style={{ fontSize: 6, fontFamily: "Bebas Neue", color: "#9ca3af", letterSpacing: 0.5 }}>P{par}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Totals row */}
                  {(() => {
                    const front = holeCount >= 18 ? { label: "FRONT", score: scores.slice(0,9).reduce((a,b)=>a+(b||0),0), par: holePars.slice(0,9).reduce((a,b)=>a+(b||4),0), filled: scores.slice(0,9).filter(s=>s!=null).length } : holeCount === 9 ? { label: holeOffset === 9 ? "BACK" : "FRONT", score: scores.slice(0,9).reduce((a,b)=>a+(b||0),0), par: holePars.slice(0,9).reduce((a,b)=>a+(b||4),0), filled: scores.slice(0,9).filter(s=>s!=null).length } : null;
                    const back  = holeCount >= 18 ? { label: "BACK", score: scores.slice(9,18).reduce((a,b)=>a+(b||0),0), par: holePars.slice(9,18).reduce((a,b)=>a+(b||4),0), filled: scores.slice(9,18).filter(s=>s!=null).length } : null;
                    const totalPlayed = scores.slice(0,holeCount).map((s,i)=>s!=null?{s,p:holePars[i]||4}:null).filter(Boolean);
                    const total = { score: totalPlayed.reduce((a,h)=>a+h.s,0), par: totalPlayed.reduce((a,h)=>a+h.p,0), filled: totalPlayed.length };
                    return (
                      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                        {front && <div style={{ flex: 1, background: "#f3f4f6", borderRadius: 8, padding: "8px 10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: 9, fontFamily: "Bebas Neue", color: "#9ca3af", letterSpacing: 1.5 }}>{front.label}</span>
                          <span style={{ fontSize: 16, fontFamily: "Bebas Neue", color: front.filled > 0 ? "#111827" : "#d1d5db" }}>{front.filled > 0 ? front.score : "—"}</span>
                        </div>}
                        {back && <div style={{ flex: 1, background: "#f3f4f6", borderRadius: 8, padding: "8px 10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: 9, fontFamily: "Bebas Neue", color: "#9ca3af", letterSpacing: 1.5 }}>{back.label}</span>
                          <span style={{ fontSize: 16, fontFamily: "Bebas Neue", color: back.filled > 0 ? "#111827" : "#d1d5db" }}>{back.filled > 0 ? back.score : "—"}</span>
                        </div>}
                        <div style={{ flex: 1, background: "rgba(125,162,126,0.1)", borderRadius: 8, padding: "8px 10px", display: "flex", justifyContent: "space-between", alignItems: "center", border: `1px solid rgba(125,162,126,0.3)` }}>
                          <span style={{ fontSize: 9, fontFamily: "Bebas Neue", color: Theme.primaryGreen, letterSpacing: 1.5 }}>TOTAL</span>
                          {total.filled > 0 ? (() => {
                            const diff = total.score - total.par;
                            const diffColor = diff < 0 ? "#3b82f6" : diff === 0 ? Theme.primaryGreen : diff <= 4 ? "#d97706" : "#dc2626";
                            return (
                              <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                                <span style={{ fontSize: 16, fontFamily: "Bebas Neue", color: "#111827" }}>{total.score}</span>
                                <span style={{ fontSize: 13, fontFamily: "Bebas Neue", color: diffColor }}>{diff === 0 ? "E" : diff > 0 ? `+${diff}` : diff}</span>
                              </div>
                            );
                          })() : <span style={{ fontSize: 16, fontFamily: "Bebas Neue", color: "#d1d5db" }}>—</span>}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* ══ SCORE KEYPAD MODAL — bottom sheet ══ */}
            {scorePickerHole !== null && (
              <div onClick={() => setScorePickerHole(null)} style={{ position: "fixed", inset: 0, zIndex: 300, display: "flex", alignItems: "flex-end", justifyContent: "center", background: "rgba(0,0,0,0.6)" }}>
                <div onClick={e => e.stopPropagation()} style={{ background: "rgba(26,26,26,0.98)", borderRadius: "16px 16px 0 0", padding: "12px 16px 24px", width: "100%", maxWidth: 420, borderTop: "1px solid rgba(91,114,130,0.25)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <span style={{ fontSize: 13, fontFamily: "Bebas Neue", color: Theme.offWhite, letterSpacing: 2 }}>HOLE {scorePickerHole + 1} · PAR {holePars[scorePickerHole] || 4}</span>
                    <button onClick={() => setScorePickerHole(null)} style={{ background: "none", border: "none", color: "rgba(224,224,224,0.5)", fontSize: 20, cursor: "pointer", lineHeight: 1 }}>✕</button>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6 }}>
                    {[1,2,3,4,5,6,7,8,9,10].map(n => {
                      const par = holePars[scorePickerHole] || 4;
                      const d = n - par;
                      const isSelected = scores[scorePickerHole] === n;
                      const label = n === 10 ? "10+" : String(n);
                      const scoreBg = isSelected ? Theme.mutedGold : d <= -2 ? "rgba(30,64,175,0.75)" : d === -1 ? "rgba(59,130,246,0.75)" : d === 0 ? "rgba(34,197,94,0.25)" : d === 1 ? "rgba(202,138,4,0.75)" : d === 2 ? "rgba(220,38,38,0.75)" : "rgba(69,10,10,0.85)";
                      const scoreSubLabel = n === 1 ? "ACE" : d <= -2 ? "EAGLE" : d === -1 ? "BIRDIE" : d === 0 ? "PAR" : d === 1 ? "BOGEY" : d === 2 ? "DBL" : "+" + d;
                      return (
                        <button key={n} onClick={() => { updateLiveScore(scorePickerHole, n); setScorePickerHole(null); setPlacingMode(null); }}
                          style={{ height: 52, borderRadius: 8, border: isSelected ? `2px solid ${Theme.mutedGold}` : "1px solid rgba(91,114,130,0.2)", background: scoreBg, color: isSelected ? "#000" : "#fff", fontSize: 18, fontFamily: "Bebas Neue", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1 }}>
                          <span style={{ fontSize: 18, lineHeight: 1 }}>{label}</span>
                          {n <= 9 && <span style={{ fontSize: 6, opacity: 0.7, letterSpacing: 0.3 }}>{scoreSubLabel}</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* Round detail modal */}
      {viewingRound && (
        <div onClick={() => { setViewingRound(null); setConfirmDeleteRound(false); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "flex-end", zIndex: 300 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: "20px 20px 0 0", padding: "24px 20px", width: "100%", maxHeight: "80vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 20, fontWeight: 900, fontFamily: "Bebas Neue", letterSpacing: 1 }}>{viewingRound.course || "Unknown"}</div>
                <div style={{ fontSize: 12, color: "#9ca3af" }}>{viewingRound.date} · {viewingRound.holes} holes{viewingRound.tee ? ` · ${viewingRound.tee} tees` : ""}</div>
              </div>
              <button onClick={() => { setViewingRound(null); setConfirmDeleteRound(false); }} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#9ca3af" }}>✕</button>
            </div>
            <div style={{ display: "flex", gap: 0, marginBottom: 20 }}>
              {(() => {
                const ovrDelta = viewingRound.ovrDelta;
                const ovrSub = ovrDelta != null ? { label: ovrDelta === 0 ? "—" : ovrDelta > 0 ? `+${ovrDelta}` : `${ovrDelta}`, color: ovrDelta > 0 ? ACCENT : ovrDelta < 0 ? "#C57B7B" : "#9ca3af" } : null;
                return [{ v: viewingRound.score, l: "SCORE", c: "#111827", sub: null }, { v: viewingRound.ovrAfter, l: "OVR", c: ACCENT, sub: ovrSub }, { v: `+${viewingRound.coins || 0}`, l: "🪙", c: "#f59e0b", sub: null }].map(({ v, l, c, sub }) => (
                  <div key={l} style={{ flex: 1, textAlign: "center" }}>
                    <div style={{ fontSize: 32, fontWeight: 900, fontFamily: "Bebas Neue", color: c, lineHeight: 1 }}>{v}</div>
                    {sub && <div style={{ fontSize: 13, fontWeight: 900, fontFamily: "Bebas Neue", color: sub.color, letterSpacing: 1, lineHeight: 1.3 }}>{sub.label}</div>}
                    <div style={{ fontSize: 9, fontWeight: 800, color: "#9ca3af", letterSpacing: 1.5, marginTop: 2 }}>{l}</div>
                  </div>
                ));
              })()}
            </div>
            {viewingRound.holeScores && viewingRound.holeScores.length > 0 && (() => {
              const sc = viewingRound.holeScores;
              const pars = viewingRound.holePars;
              const hOffset = viewingRound.holeOffset || 0;
              const holeCount = sc.length;
              const front = sc.slice(0, Math.min(9, holeCount));
              const back = holeCount > 9 ? sc.slice(9) : [];
              const pFront = pars ? pars.slice(0, Math.min(9, holeCount)) : null;
              const pBack = pars && holeCount > 9 ? pars.slice(9) : null;
              const fTotal = front.reduce((a, b) => a + (b || 0), 0);
              const bTotal = back.reduce((a, b) => a + (b || 0), 0);
              const fPar = pFront ? pFront.reduce((a, b) => a + (b || 4), 0) : null;
              const bPar = pBack ? pBack.reduce((a, b) => a + (b || 4), 0) : null;
              const totalScore = fTotal + bTotal;
              const totalPar = (fPar || 0) + (bPar || 0);
              const totalDiff = (fPar || bPar) ? totalScore - totalPar : null;
              const cellBg = (score, par) => {
                if (score == null) return "#f3f4f6";
                if (par == null) return "#f3f4f6";
                const d = score - par;
                return d <= -2 ? "#bfdbfe" : d === -1 ? "#dbeafe" : d === 0 ? "#dcfce7" : d === 1 ? "#fef3c7" : d === 2 ? "#fee2e2" : "#fecaca";
              };
              const diffLabel = d => d === null ? null : d === 0 ? "E" : d > 0 ? `+${d}` : `${d}`;
              const diffColor = d => d === null ? "#d1d5db" : d < 0 ? "#3b82f6" : d === 0 ? Theme.primaryGreen : d <= 4 ? "#d97706" : "#dc2626";
              const HoleGrid = ({ scores, pRow, startHole }) => (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(9, 1fr)", gap: 4, marginBottom: 8 }}>
                  {scores.map((score, i) => {
                    const par = pRow ? pRow[i] : null;
                    return (
                      <div key={i} style={{ background: cellBg(score, par), border: "1px solid #e5e7eb", borderRadius: 8, padding: "8px 4px 6px", display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                        <span style={{ fontSize: 7, fontFamily: "Bebas Neue", color: "#9ca3af", letterSpacing: 1 }}>{startHole + i + 1}</span>
                        <span style={{ fontSize: 20, fontFamily: "Bebas Neue", color: score == null ? "#d1d5db" : "#111827", lineHeight: 1 }}>{score ?? "·"}</span>
                        <span style={{ fontSize: 6, fontFamily: "Bebas Neue", color: "#9ca3af", letterSpacing: 0.5 }}>{par ? `P${par}` : ""}</span>
                      </div>
                    );
                  })}
                </div>
              );
              return (
                <div style={{ background: "#f9fafb", borderRadius: 16, padding: "14px", marginBottom: 12, border: "1px solid #e5e7eb" }}>
                  <HoleGrid scores={front} pRow={pFront} startHole={hOffset} />
                  {back.length > 0 && <HoleGrid scores={back} pRow={pBack} startHole={9} />}
                  <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                    {holeCount <= 9 && (
                      <div style={{ flex: 1, background: "#f3f4f6", borderRadius: 8, padding: "8px 10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 9, fontFamily: "Bebas Neue", color: "#9ca3af", letterSpacing: 1.5 }}>{hOffset === 9 ? "BACK" : "FRONT"}</span>
                        <span style={{ fontSize: 16, fontFamily: "Bebas Neue", color: "#111827" }}>{fTotal}</span>
                      </div>
                    )}
                    {back.length > 0 && <>
                      <div style={{ flex: 1, background: "#f3f4f6", borderRadius: 8, padding: "8px 10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 9, fontFamily: "Bebas Neue", color: "#9ca3af", letterSpacing: 1.5 }}>FRONT</span>
                        <span style={{ fontSize: 16, fontFamily: "Bebas Neue", color: "#111827" }}>{fTotal}</span>
                      </div>
                      <div style={{ flex: 1, background: "#f3f4f6", borderRadius: 8, padding: "8px 10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 9, fontFamily: "Bebas Neue", color: "#9ca3af", letterSpacing: 1.5 }}>BACK</span>
                        <span style={{ fontSize: 16, fontFamily: "Bebas Neue", color: "#111827" }}>{bTotal}</span>
                      </div>
                    </>}
                    <div style={{ flex: 1, background: "rgba(125,162,126,0.1)", borderRadius: 8, padding: "8px 10px", display: "flex", justifyContent: "space-between", alignItems: "center", border: "1px solid rgba(125,162,126,0.3)" }}>
                      <span style={{ fontSize: 9, fontFamily: "Bebas Neue", color: Theme.primaryGreen, letterSpacing: 1.5 }}>TOTAL</span>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
                        <span style={{ fontSize: 16, fontFamily: "Bebas Neue", color: "#111827" }}>{totalScore}</span>
                        {diffLabel(totalDiff) && <span style={{ fontSize: 12, fontFamily: "Bebas Neue", color: diffColor(totalDiff) }}>{diffLabel(totalDiff)}</span>}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
            {authUser && viewingRound.id && (viewingRound.ownerUid ? viewingRound.ownerUid === authUser.uid : true) && (
              <div>
                {!confirmDeleteRound ? (
                  <button onClick={() => setConfirmDeleteRound(true)} style={{ width: "100%", padding: "12px 0", background: "#fff5f5", border: "1px solid #fecaca", borderRadius: 10, color: "#dc2626", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Delete Round</button>
                ) : (
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => setConfirmDeleteRound(false)} style={{ flex: 1, padding: "12px 0", background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Cancel</button>
                    <button onClick={() => { deleteRound(viewingRound.id); setViewingRound(null); setConfirmDeleteRound(false); }} style={{ flex: 1, padding: "12px 0", background: "#dc2626", border: "none", borderRadius: 10, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Confirm Delete</button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── LEADERBOARD TAB ── */}
      {tab === "leaderboard" && (
        <>
        <div className="tab-scroll" style={{ paddingBottom: 80 }}>
          <div style={{ padding: "20px 16px 12px" }}>
            <div style={{ fontSize: 24, fontWeight: 900, fontFamily: "Bebas Neue", letterSpacing: 2, marginBottom: 12 }}>LEADERBOARD</div>
            {/* 3-tab toggle */}
            <div style={{ display: "flex", background: "#f3f4f6", borderRadius: 10, padding: 3, marginBottom: 16 }}>
              {["friends","crew","global"].map(v => (
                <button key={v} onClick={() => setLeaderboardView(v)} style={{ flex: 1, padding: "8px 0", border: "none", borderRadius: 8, background: leaderboardView === v ? "#fff" : "transparent", color: leaderboardView === v ? Theme.textMain : "#9ca3af", fontWeight: 800, fontSize: 11, letterSpacing: 0.8, cursor: "pointer", boxShadow: leaderboardView === v ? "0 1px 4px rgba(0,0,0,0.1)" : "none" }}>
                  {v.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* ── FRIENDS TAB ── */}
          {leaderboardView === "friends" && (
            <div style={{ padding: "0 16px" }}>
              {/* Friend requests */}
              {friendRequests.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  {friendRequests.map(req => (
                    <div key={req.id} style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", padding: "12px 14px", marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>🏌️ <strong>{req.fromUsername}</strong> wants to be friends</div>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button onClick={() => handleRespondRequest(req, true)} style={{ padding: "6px 12px", background: ACCENT, border: "none", borderRadius: 8, color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>Accept</button>
                        <button onClick={() => handleRespondRequest(req, false)} style={{ padding: "6px 12px", background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>Ignore</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {/* Find players search */}
              <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", padding: "12px 14px", marginBottom: 14 }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: "#9ca3af", letterSpacing: 1.5, marginBottom: 8 }}>FIND PLAYERS</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input value={friendSearch} onChange={e => setFriendSearch(e.target.value.toUpperCase())} onKeyDown={e => e.key === "Enter" && handleFriendSearch()} placeholder="Enter username…" style={{ ...S.fInput, flex: 1 }} />
                  <button onClick={handleFriendSearch} disabled={friendSearchBusy} style={{ padding: "0 16px", background: Theme.primaryGreen, border: "none", borderRadius: 8, color: "#fff", fontWeight: 800, fontSize: 12, cursor: "pointer" }}>Search</button>
                </div>
                {friendSearchMsg && <div style={{ fontSize: 12, color: "#6b7280", marginTop: 8 }}>{friendSearchMsg}</div>}
                {friendSearchResult && (
                  <div style={{ marginTop: 10, padding: "10px 12px", background: "#f9fafb", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div><div style={{ fontSize: 14, fontWeight: 900, fontFamily: "Bebas Neue" }}>{friendSearchResult.username}</div><div style={{ fontSize: 11, color: "#9ca3af" }}>OVR {friendSearchResult.ovr} · Lvl {friendSearchResult.level}</div></div>
                    <button onClick={() => handleSendRequest(friendSearchResult)} disabled={sentRequests.includes(friendSearchResult.uid)} style={{ padding: "7px 14px", background: sentRequests.includes(friendSearchResult.uid) ? "#f3f4f6" : Theme.primaryGreen, border: "none", borderRadius: 8, color: sentRequests.includes(friendSearchResult.uid) ? "#9ca3af" : "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                      {sentRequests.includes(friendSearchResult.uid) ? "Sent!" : "Add Friend"}
                    </button>
                  </div>
                )}
              </div>
              {/* Friends list */}
              {leaderboardLoading ? (
                <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={Theme.primaryGreen} strokeWidth="2" strokeLinecap="round" style={{ animation: "spin 1s linear infinite" }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                </div>
              ) : leaderboard.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px 20px", color: "#9ca3af" }}>
                  <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>No friends yet</div>
                  <div style={{ fontSize: 12 }}>Search for players above to add them</div>
                </div>
              ) : leaderboard.map((u, idx) => (
                <div key={u.uid} onClick={async () => { const snap = await getDoc(doc(db, "users", u.uid)); setViewingProfile(snap.exists() ? { uid: u.uid, ...snap.data() } : u); }} style={{ background: u.uid === authUser?.uid ? "rgba(125,162,126,0.07)" : "#fff", borderRadius: 12, border: u.uid === authUser?.uid ? `1.5px solid ${Theme.primaryGreen}` : "1px solid #e5e7eb", padding: "12px 14px", marginBottom: 8, display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}>
                  <div style={{ fontSize: 15, fontWeight: 900, fontFamily: "Bebas Neue", color: idx === 0 ? "#f59e0b" : idx === 1 ? "#6b7280" : idx === 2 ? "#b45309" : "#9ca3af", width: 24, textAlign: "center", flexShrink: 0 }}>#{idx+1}</div>
                  <div onClick={u.profilePic ? e => { e.stopPropagation(); setViewingPic(u.profilePic); } : undefined} style={{ width: 38, height: 38, borderRadius: "50%", background: "#f3f4f6", overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", cursor: u.profilePic ? "zoom-in" : "pointer" }}>
                    {u.profilePic ? <img src={u.profilePic} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" /> : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 900, fontFamily: "Bebas Neue", letterSpacing: 1 }}>{u.username}{u.uid === authUser?.uid ? " (you)" : ""}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 1 }}>
                      <span style={{ fontSize: 11, color: "#9ca3af" }}>Lvl {u.level || 1} · {u.history?.length || 0} rounds</span>
                      {u.crewName && <span style={{ fontSize: 10, fontWeight: 800, color: Theme.primaryGreen, background: "rgba(125,162,126,0.1)", borderRadius: 6, padding: "1px 6px" }}>{u.crewName}</span>}
                    </div>
                  </div>
                  <div style={{ textAlign: "center", flexShrink: 0 }}>
                    <div style={{ fontSize: 24, fontWeight: 900, fontFamily: "Bebas Neue", color: Theme.primaryGreen }}>{u.ovr}</div>
                    {(() => { const t = skillTier(u.ovr || 50); return <div style={{ fontSize: 7, fontWeight: 800, color: t.color, letterSpacing: 0.8, background: t.bg, border: `1px solid ${t.border}`, borderRadius: 10, padding: "1px 5px", whiteSpace: "nowrap" }}>{t.label}</div>; })()}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── CREW TAB ── */}
          {leaderboardView === "crew" && (
            <div style={{ padding: "0 16px" }}>
              {profile.crewId && myCrewData ? (
                /* ── In a crew ── */
                <>
                  {/* Crew header */}
                  <div style={{ background: Theme.primaryGreen, borderRadius: 16, padding: "16px 18px", marginBottom: 14 }}>
                    <div style={{ fontSize: 26, fontWeight: 900, fontFamily: "Bebas Neue", letterSpacing: 2, color: "#fff", lineHeight: 1 }}>{myCrewData.name}</div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.75)", marginTop: 3 }}>{(myCrewData.members || []).length}/8 members · Led by {myCrewData.leaderUsername}</div>
                  </div>
                  {/* Members list */}
                  <div style={{ fontSize: 10, fontWeight: 800, color: "#9ca3af", letterSpacing: 1.5, marginBottom: 8 }}>MEMBERS</div>
                  {[...(myCrewData.members || [])].sort((a, b) => (b.ovr || 0) - (a.ovr || 0)).map((m, i) => {
                    const isLeader = m.uid === myCrewData.leaderUid;
                    const isMe = m.uid === authUser?.uid;
                    return (
                      <div key={m.uid} onClick={async () => { if (isMe) return; const snap = await getDoc(doc(db, "users", m.uid)); setViewingProfile(snap.exists() ? { uid: m.uid, ...snap.data() } : m); }} style={{ background: isMe ? "rgba(125,162,126,0.07)" : "#fff", borderRadius: 12, border: isMe ? `1.5px solid ${Theme.primaryGreen}` : "1px solid #e5e7eb", padding: "12px 14px", marginBottom: 8, display: "flex", alignItems: "center", gap: 12, cursor: isMe ? "default" : "pointer" }}>
                        <div style={{ fontSize: 15, fontWeight: 900, fontFamily: "Bebas Neue", color: i === 0 ? "#f59e0b" : i === 1 ? "#6b7280" : i === 2 ? "#b45309" : "#9ca3af", width: 24, textAlign: "center", flexShrink: 0 }}>#{i+1}</div>
                        <div onClick={e => { const pic = isMe ? profilePic : m.profilePic; if (pic) { e.stopPropagation(); setViewingPic(pic); } }} style={{ width: 38, height: 38, borderRadius: "50%", background: "#f3f4f6", overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", cursor: (isMe ? profilePic : m.profilePic) ? "zoom-in" : "default" }}>
                          {(isMe ? profilePic : m.profilePic) ? <img src={isMe ? profilePic : m.profilePic} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" /> : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                            <span style={{ fontSize: 14, fontWeight: 900, fontFamily: "Bebas Neue", letterSpacing: 1 }}>{m.username}</span>
                            {isLeader && <span style={{ fontSize: 12 }}>⭐</span>}
                            {isMe && <span style={{ fontSize: 10, fontWeight: 700, color: Theme.primaryGreen }}>(you)</span>}
                          </div>
                          <div style={{ fontSize: 11, color: "#9ca3af" }}>Lvl {m.level || 1}</div>
                        </div>
                        <div style={{ textAlign: "center", flexShrink: 0 }}>
                          <div style={{ fontSize: 24, fontWeight: 900, fontFamily: "Bebas Neue", color: Theme.primaryGreen }}>{m.ovr || "—"}</div>
                          {m.ovr && (() => { const t = skillTier(m.ovr); return <div style={{ fontSize: 7, fontWeight: 800, color: t.color, letterSpacing: 0.8, background: t.bg, border: `1px solid ${t.border}`, borderRadius: 10, padding: "1px 5px", whiteSpace: "nowrap" }}>{t.label}</div>; })()}
                        </div>
                      </div>
                    );
                  })}

                  {/* Pending join requests (leader only) */}
                  {myCrewData.leaderUid === authUser?.uid && crewRequests.length > 0 && (
                    <div style={{ marginBottom: 14 }}>
                      <div style={{ fontSize: 10, fontWeight: 800, color: "#9ca3af", letterSpacing: 1.5, marginBottom: 8 }}>JOIN REQUESTS</div>
                      {crewRequests.map(req => (
                        <div key={req.id} style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", padding: "12px 14px", marginBottom: 8, display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, fontWeight: 800 }}>{req.fromUsername}</div>
                            <div style={{ fontSize: 11, color: "#9ca3af" }}>OVR {req.fromOvr || "—"}</div>
                          </div>
                          <button
                            onClick={async () => {
                              try {
                                const newMember = { uid: req.fromUid, username: req.fromUsername, ovr: req.fromOvr || 0, level: req.fromLevel || 1, profilePic: req.fromProfilePic || null };
                                await acceptCrewRequest(req.id, myCrewData.id, myCrewData.name, newMember);
                                setMyCrewData(prev => ({ ...prev, members: [...(prev.members || []), newMember], memberCount: (prev.memberCount || 0) + 1 }));
                                setCrewRequests(prev => prev.filter(r => r.id !== req.id));
                              } catch (e) { alert(e.message === "CREW_FULL" ? "Crew is full (8 max)" : "Failed to accept"); }
                            }}
                            style={{ padding: "6px 12px", background: ACCENT, border: "none", borderRadius: 8, color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer" }}
                          >Accept</button>
                          <button
                            onClick={async () => { await declineCrewRequest(req.id); setCrewRequests(prev => prev.filter(r => r.id !== req.id)); }}
                            style={{ padding: "6px 12px", background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: "pointer" }}
                          >Decline</button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Leave / Disband */}
                  <button
                    onClick={async () => {
                      const isLeader = myCrewData.leaderUid === authUser?.uid;
                      if (!window.confirm(isLeader ? `Disband ${myCrewData.name}? This removes all members.` : `Leave ${myCrewData.name}?`)) return;
                      await leaveCrewInFirestore(myCrewData.id, authUser.uid, isLeader, myCrewData.members);
                      const updated = { ...profile, crewId: null, crewName: null };
                      setProfile(updated);
                      if (authUser) saveProfileToFirestore(authUser.uid, updated);
                      setMyCrewData(null);
                    }}
                    style={{ width: "100%", padding: "11px 0", background: "none", border: "1px solid #fecaca", borderRadius: 12, color: "#dc2626", fontWeight: 700, fontSize: 13, cursor: "pointer" }}
                  >
                    {myCrewData.leaderUid === authUser?.uid ? `Disband ${myCrewData.name}` : `Leave ${myCrewData.name}`}
                  </button>
                </>
              ) : (
                /* ── Not in a crew ── */
                <>
                  <button
                    onClick={() => { setCreateCrewName(""); setCreateCrewError(""); setShowCreateCrewModal(true); }}
                    style={{ width: "100%", padding: "14px 0", background: Theme.primaryGreen, border: "none", borderRadius: 12, color: "#fff", fontWeight: 800, fontSize: 14, cursor: "pointer", marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Start a Crew
                  </button>

                  {/* Browse crews */}
                  <div style={{ fontSize: 10, fontWeight: 800, color: "#9ca3af", letterSpacing: 1.5, marginBottom: 10 }}>
                    FIND A CREW
                    {!crewBrowse.length && !crewBrowseLoading && (
                      <button onClick={async () => { setCrewBrowseLoading(true); const c = await fetchPublicCrews(); setCrewBrowse(c); setCrewBrowseLoading(false); }} style={{ marginLeft: 10, background: "none", border: "none", color: Theme.primaryGreen, fontWeight: 800, fontSize: 10, cursor: "pointer" }}>Load</button>
                    )}
                  </div>
                  {crewBrowseLoading && <div style={{ display: "flex", justifyContent: "center", padding: 24 }}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={Theme.primaryGreen} strokeWidth="2" strokeLinecap="round" style={{ animation: "spin 1s linear infinite" }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg></div>}
                  {crewBrowse.map(crew => {
                    const isFull = (crew.members || []).length >= 8;
                    const alreadySent = sentCrewRequests.includes(crew.id);
                    return (
                      <div key={crew.id} style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", padding: "12px 14px", marginBottom: 8, display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 15, fontWeight: 900, fontFamily: "Bebas Neue", letterSpacing: 1 }}>{crew.name}</div>
                          <div style={{ fontSize: 11, color: "#9ca3af" }}>Led by {crew.leaderUsername} · {(crew.members || []).length}/8 members</div>
                        </div>
                        <button
                          disabled={isFull || alreadySent}
                          onClick={async () => {
                            if (isFull || alreadySent) return;
                            await requestJoinCrew(crew.id, crew.name, authUser.uid, profile.username, profile.ovr || 0, profile.level || 1, profile.profilePic || null);
                            setSentCrewRequests(prev => [...prev, crew.id]);
                          }}
                          style={{ padding: "7px 14px", background: isFull ? "#f3f4f6" : alreadySent ? "#f3f4f6" : Theme.primaryGreen, border: "none", borderRadius: 8, color: (isFull || alreadySent) ? "#9ca3af" : "#fff", fontWeight: 700, fontSize: 12, cursor: (isFull || alreadySent) ? "default" : "pointer" }}
                        >
                          {isFull ? "Full" : alreadySent ? "Requested" : "Request"}
                        </button>
                      </div>
                    );
                  })}
                  {crewBrowse.length === 0 && !crewBrowseLoading && (
                    <div style={{ textAlign: "center", padding: "32px 0", color: "#9ca3af", fontSize: 13 }}>Tap Load to browse crews</div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ── GLOBAL TAB ── */}
          {leaderboardView === "global" && (
            <div style={{ padding: "0 16px" }}>
              {leaderboardLoading ? (
                <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={Theme.primaryGreen} strokeWidth="2" strokeLinecap="round" style={{ animation: "spin 1s linear infinite" }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                </div>
              ) : globalLeaderboard.map((u, idx) => (
                <div key={u.uid || idx} onClick={async () => { const snap = await getDoc(doc(db, "users", u.uid)); setViewingProfile(snap.exists() ? { uid: u.uid, ...snap.data() } : u); }} style={{ background: u.uid === authUser?.uid ? "rgba(125,162,126,0.07)" : "#fff", borderRadius: 12, border: u.uid === authUser?.uid ? `1.5px solid ${Theme.primaryGreen}` : "1px solid #e5e7eb", padding: "12px 14px", marginBottom: 8, display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}>
                  <div style={{ fontSize: 15, fontWeight: 900, fontFamily: "Bebas Neue", color: idx === 0 ? "#f59e0b" : idx === 1 ? "#6b7280" : idx === 2 ? "#b45309" : "#9ca3af", width: 24, textAlign: "center", flexShrink: 0 }}>#{idx+1}</div>
                  <div onClick={u.profilePic ? e => { e.stopPropagation(); setViewingPic(u.profilePic); } : undefined} style={{ width: 38, height: 38, borderRadius: "50%", background: "#f3f4f6", overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", cursor: u.profilePic ? "zoom-in" : "pointer" }}>
                    {u.profilePic ? <img src={u.profilePic} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" /> : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 900, fontFamily: "Bebas Neue", letterSpacing: 1 }}>{u.username}{u.uid === authUser?.uid ? " (you)" : ""}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 1 }}>
                      <span style={{ fontSize: 11, color: "#9ca3af" }}>Lvl {u.level || 1} · {u.history?.length || 0} rounds</span>
                      {u.crewName && <span style={{ fontSize: 10, fontWeight: 800, color: Theme.primaryGreen, background: "rgba(125,162,126,0.1)", borderRadius: 6, padding: "1px 6px" }}>{u.crewName}</span>}
                    </div>
                  </div>
                  <div style={{ textAlign: "center", flexShrink: 0 }}>
                    <div style={{ fontSize: 24, fontWeight: 900, fontFamily: "Bebas Neue", color: Theme.primaryGreen }}>{u.ovr}</div>
                    {(() => { const t = skillTier(u.ovr || 50); return <div style={{ fontSize: 7, fontWeight: 800, color: t.color, letterSpacing: 0.8, background: t.bg, border: `1px solid ${t.border}`, borderRadius: 10, padding: "1px 5px", whiteSpace: "nowrap" }}>{t.label}</div>; })()}
                  </div>
                </div>
              ))}
              {globalLeaderboard.length === 0 && !leaderboardLoading && (
                <div style={{ textAlign: "center", padding: "40px 20px", color: "#9ca3af" }}>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>No players found</div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Create Crew Modal ── */}
        {showCreateCrewModal && (
          <div onClick={() => setShowCreateCrewModal(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "flex-end", zIndex: 300 }}>
            <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: "20px 20px 0 0", padding: "24px 20px 40px", width: "100%", boxSizing: "border-box" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 900, fontFamily: "Bebas Neue", letterSpacing: 1, lineHeight: 1 }}>START A CREW</div>
                  <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>Choose a name — it cannot be changed</div>
                </div>
                <button onClick={() => setShowCreateCrewModal(false)} style={{ background: "none", border: "none", fontSize: 20, color: "#9ca3af", cursor: "pointer" }}>✕</button>
              </div>
              <div style={{ fontSize: 10, fontWeight: 800, color: "#9ca3af", letterSpacing: 1.5, marginBottom: 6 }}>CREW NAME</div>
              <input
                value={createCrewName}
                onChange={e => setCreateCrewName(e.target.value.toUpperCase())}
                placeholder="e.g. BIRDIE SQUAD"
                maxLength={24}
                style={{ ...S.fInput, marginBottom: 6, textTransform: "uppercase", fontWeight: 800, letterSpacing: 1 }}
              />
              <div style={{ fontSize: 10, color: "#9ca3af", marginBottom: 16 }}>{createCrewName.length}/24 · Up to 8 members · You will be the crew leader</div>
              {createCrewError && <div style={{ marginBottom: 12, padding: "9px 12px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, fontSize: 12, color: "#dc2626", fontWeight: 600 }}>{createCrewError}</div>}
              <button
                disabled={createCrewBusy || createCrewName.trim().length < 2}
                onClick={async () => {
                  if (!authUser || createCrewBusy || createCrewName.trim().length < 2) return;
                  setCreateCrewBusy(true); setCreateCrewError("");
                  try {
                    const crewId = await createCrewInFirestore(authUser.uid, profile.username, profile.ovr || 0, profile.level || 1, profile.profilePic || null, createCrewName.trim());
                    const crewName = createCrewName.trim().toUpperCase();
                    const updated = { ...profile, crewId, crewName };
                    setProfile(updated);
                    if (authUser) saveProfileToFirestore(authUser.uid, updated);
                    setMyCrewData({ id: crewId, name: crewName, leaderUid: authUser.uid, leaderUsername: profile.username, members: [{ uid: authUser.uid, username: profile.username, ovr: profile.ovr || 0, level: profile.level || 1, profilePic: profile.profilePic || null }], memberCount: 1 });
                    setShowCreateCrewModal(false);
                  } catch (e) {
                    setCreateCrewError(e.message === "NAME_TAKEN" ? "That crew name is already taken. Choose another." : "Failed to create crew. Try again.");
                  }
                  setCreateCrewBusy(false);
                }}
                style={{ width: "100%", padding: "14px 0", background: createCrewName.trim().length >= 2 ? Theme.primaryGreen : "#e5e7eb", border: "none", borderRadius: 12, color: createCrewName.trim().length >= 2 ? "#fff" : "#9ca3af", fontSize: 14, fontWeight: 800, cursor: createCrewName.trim().length >= 2 ? "pointer" : "default" }}
              >
                {createCrewBusy ? "Creating…" : "Create Crew"}
              </button>
            </div>
          </div>
        )}
        </>
      )}

      {/* ── CHALLENGES TAB ── */}
      {tab === "challenges" && (
        <>
        <div className="tab-scroll" style={{ paddingBottom: 80 }}>
          <div style={{ padding: "20px 16px 12px" }}>
            <div style={{ fontSize: 24, fontWeight: 900, fontFamily: "Bebas Neue", letterSpacing: 2, marginBottom: 12 }}>CHALLENGES</div>
            {challengePostError && (
              <div style={{ marginBottom: 10, padding: "10px 14px", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10, fontSize: 12, color: "#92400e", fontWeight: 600 }}>
                {challengePostError}
                <button onClick={() => setChallengePostError("")} style={{ marginLeft: 10, background: "none", border: "none", cursor: "pointer", color: "#92400e", fontWeight: 800, fontSize: 13, lineHeight: 1 }}>✕</button>
              </div>
            )}
            <button
              onClick={() => { setChallengePostError(""); setChallengeStep(1); setShowChallengeModal(true); }}
              style={{ width: "100%", padding: "14px 0", background: Theme.primaryGreen, border: "none", borderRadius: 12, color: "#fff", fontWeight: 800, fontSize: 14, cursor: "pointer", marginBottom: 16, letterSpacing: 0.3, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Post New Challenge
            </button>
          </div>
          {challengesLoading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={Theme.primaryGreen} strokeWidth="2" strokeLinecap="round" style={{ animation: "spin 1s linear infinite" }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
            </div>
          ) : challenges.filter(c => !c.settled).length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 24px", color: "#9ca3af" }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>⛳</div>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6, color: "#374151" }}>No challenges yet</div>
              <div style={{ fontSize: 13 }}>Post one and find your next round</div>
            </div>
          ) : (
            <div style={{ padding: "0 16px" }}>
              {challenges.filter(c => !c.settled).map(c => (
                <ChallengeCard key={c.id} challenge={c} myUid={authUser?.uid} myUsername={profile.username} myCoins={profile.coins || 0}
                  onJoin={async (id, wager) => {
                    if (wager > 0) setProfile(p => ({ ...p, coins: Math.max(0, (p.coins || 0) - wager) }));
                    const ok = await joinChallengeInDb(id, authUser.uid, profile.username, profile.ovr || 0);
                    if (ok) setChallenges(prev => prev.map(ch => ch.id === id ? { ...ch, joinedBy: [...(ch.joinedBy || []), { uid: authUser.uid, username: profile.username, ovr: profile.ovr || 0 }] } : ch));
                    else if (wager > 0) setProfile(p => ({ ...p, coins: (p.coins || 0) + wager }));
                  }}
                  onDelete={async (id, wager, joinedCount) => {
                    setChallenges(prev => prev.filter(ch => ch.id !== id));
                    if (wager > 0 && joinedCount === 0) setProfile(p => ({ ...p, coins: (p.coins || 0) + wager }));
                    await deleteChallengeInDb(id);
                  }}
                  onSettle={async (id, winner, wager) => {
                    const ok = await settleChallengeInDb(id, winner, wager);
                    if (ok) {
                      setChallenges(prev => prev.map(ch => ch.id === id ? { ...ch, settled: true, winner } : ch));
                      if (winner.uid === authUser.uid) setProfile(p => ({ ...p, coins: (p.coins || 0) + wager * 2 }));
                    }
                  }}
                  onReview={async (id, reviewerUid, review) => {
                    const ok = await submitChallengeReview(id, reviewerUid, review);
                    if (ok) setChallenges(prev => prev.map(ch => ch.id === id ? { ...ch, reviews: { ...(ch.reviews || {}), [reviewerUid]: review } } : ch));
                  }}
                  onStartRound={(challengeId, course, teeColor, holes, nineHolesSide) => {
                    setActiveChallengeId(challengeId);
                    startLiveRound(course, teeColor || "white", String(holes || 18), { nineSide: nineHolesSide || "front" });
                    setTab("live");
                  }}
                  onViewProfile={async (poster) => {
                    setViewingChallenger(poster);
                    setChallengerStats({ loading: true });
                    try {
                      // Load user profile
                      const userSnap = await getDoc(doc(db, "users", poster.uid));
                      const userData = userSnap.exists() ? userSnap.data() : {};
                      // Query their posted challenges for W/L and reviews
                      const q = query(collection(db, "challenges"), where("uid", "==", poster.uid));
                      const snap = await getDocs(q);
                      let wins = 0, losses = 0;
                      const reviews = [];
                      snap.forEach(d => {
                        const ch = d.data();
                        if (ch.settled) {
                          if (ch.winner?.uid === poster.uid) wins++;
                          else losses++;
                        }
                        // Collect reviews targeting this poster
                        Object.values(ch.reviews || {}).forEach(r => {
                          if (r.targetUid === poster.uid || !r.targetUid) reviews.push(r);
                        });
                      });
                      setChallengerStats({ loading: false, wins, losses, reviews, rounds: userData.history?.length || 0, level: userData.level || 1, ovr: userData.ovr || poster.ovr });
                    } catch {
                      setChallengerStats({ loading: false, wins: 0, losses: 0, reviews: [], error: true });
                    }
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── Post Challenge Modal (2-step) ── */}
        {showChallengeModal && (() => {
          const closeModal = () => { setShowChallengeModal(false); setChallengeCourseSuggestions([]); setChallengeStep(1); };
          const TEAM_META = { A: { color: Theme.primaryGreen, bg: "rgba(125,162,126,0.12)" }, B: { color: "#3b82f6", bg: "rgba(59,130,246,0.09)" }, C: { color: "#f97316", bg: "rgba(249,115,22,0.09)" }, D: { color: "#a855f7", bg: "rgba(168,85,247,0.09)" } };
          const TEE_COLORS = [
            { id: "white", label: "White", dot: "#ffffff", border: "#d1d5db" },
            { id: "yellow", label: "Yellow", dot: "#eab308", border: "#eab308" },
            { id: "red", label: "Red", dot: "#ef4444", border: "#ef4444" },
            { id: "blue", label: "Blue", dot: "#3b82f6", border: "#3b82f6" },
            { id: "gold", label: "Gold", dot: "#f59e0b", border: "#f59e0b" },
            { id: "black", label: "Black", dot: "#111827", border: "#111827" },
          ];
          const newFormatIds = ["stroke", "match_play", "scramble", "best_ball", "skins"];
          const filteredFmts = CHALLENGE_FORMATS.filter(f => newFormatIds.includes(f.id));
          const selectedFmt = CHALLENGE_FORMATS.find(f => f.id === challengeForm.format) || filteredFmts[0] || CHALLENGE_FORMATS[0];
          const step2Ready = challengeForm.courseName && challengeForm.date && challengeForm.timeFrom && challengeForm.timeTo;

          const cycleTeam = (slotIndex) => {
            setChallengeForm(f => {
              const newSlots = [...f.slots];
              const order = ["A", "B", "C", "D"];
              const cur = order.indexOf(newSlots[slotIndex]);
              // advance to next team that has room (max 2 per team)
              let next = (cur + 1) % 4;
              for (let tries = 0; tries < 4; tries++) {
                const teamLetter = order[next];
                const occupants = newSlots.filter((s, j) => j !== slotIndex && s === teamLetter).length;
                if (occupants < 2) break;
                next = (next + 1) % 4;
              }
              newSlots[slotIndex] = order[next];
              return { ...f, slots: newSlots };
            });
          };

          return (
            <div onClick={closeModal} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "flex-end", zIndex: 300 }}>
              <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: "20px 20px 0 0", width: "100%", maxHeight: "92vh", display: "flex", flexDirection: "column", boxSizing: "border-box" }}>

                {/* ── Step 1: Players + Format + Teams ── */}
                {challengeStep === 1 && (
                  <>
                    <div style={{ padding: "20px 20px 0", flexShrink: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
                        <div>
                          <div style={{ fontSize: 20, fontWeight: 900, fontFamily: "Bebas Neue", letterSpacing: 1, lineHeight: 1 }}>POST A CHALLENGE</div>
                          <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>Step 1 of 2 — Set up your group</div>
                        </div>
                        <button onClick={closeModal} style={{ background: "none", border: "none", fontSize: 20, color: "#9ca3af", cursor: "pointer", lineHeight: 1 }}>✕</button>
                      </div>
                    </div>

                    <div style={{ overflowY: "auto", flex: 1, padding: "0 20px 28px" }}>

                      {/* Player count */}
                      <div style={{ fontSize: 10, fontWeight: 800, color: "#9ca3af", letterSpacing: 1.5, marginBottom: 10 }}>PLAYERS</div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
                        {[2, 3, 4, 5, 6, 7, 8].map(n => {
                          const sel = challengeForm.playerCount === n;
                          return (
                            <button
                              key={n}
                              onClick={() => {
                                const defaultSlots = Array.from({ length: n }, (_, i) => ["A","B","A","B","A","B","A","B"][i]);
                                setChallengeForm(f => ({ ...f, playerCount: n, slots: defaultSlots }));
                              }}
                              style={{ width: 38, height: 38, borderRadius: "50%", border: sel ? `2.5px solid ${Theme.primaryGreen}` : "2px solid #e5e7eb", background: sel ? "rgba(125,162,126,0.1)" : "#f9fafb", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", outline: "none", flexShrink: 0 }}
                            >
                              <span style={{ fontSize: 16, fontWeight: 900, fontFamily: "Bebas Neue", color: sel ? Theme.primaryGreen : "#374151", lineHeight: 1 }}>{n}</span>
                            </button>
                          );
                        })}
                      </div>

                      {/* Format */}
                      <div style={{ fontSize: 10, fontWeight: 800, color: "#9ca3af", letterSpacing: 1.5, marginBottom: 10 }}>FORMAT</div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7, marginBottom: 20 }}>
                        {filteredFmts.map(fmt => {
                          const sel = challengeForm.format === fmt.id;
                          return (
                            <button key={fmt.id} onClick={() => setChallengeForm(f => ({ ...f, format: fmt.id }))} style={{ padding: "10px 12px", background: sel ? "rgba(125,162,126,0.1)" : "#f9fafb", border: sel ? `2px solid ${Theme.primaryGreen}` : "2px solid transparent", borderRadius: 11, cursor: "pointer", textAlign: "left", outline: "none" }}>
                              <div style={{ fontSize: 12, fontWeight: 800, color: sel ? Theme.primaryGreen : "#111827", marginBottom: 2 }}>{fmt.label}</div>
                              <div style={{ fontSize: 10, color: "#9ca3af", lineHeight: 1.3 }}>{fmt.desc}</div>
                            </button>
                          );
                        })}
                        {filteredFmts.length === 0 && <div style={{ gridColumn: "1/-1", fontSize: 12, color: "#9ca3af", padding: "8px 0" }}>No formats for this player count.</div>}
                      </div>

                      {/* Teams — 2×2 grid */}
                      <div style={{ fontSize: 10, fontWeight: 800, color: "#9ca3af", letterSpacing: 1.5, marginBottom: 10 }}>TEAMS</div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                        {["A","B","C","D"].map(team => {
                          const { color, bg } = TEAM_META[team];
                          const teamSlots = challengeForm.slots.map((t, i) => ({ t, i })).filter(s => s.t === team);
                          const isEmpty = teamSlots.length === 0;
                          return (
                            <div key={team} style={{ background: isEmpty ? "#f9fafb" : bg, borderRadius: 14, padding: "10px 8px", minHeight: 80, border: isEmpty ? "1.5px dashed #e5e7eb" : `1.5px solid ${color}22`, transition: "all 0.2s" }}>
                              <div style={{ fontSize: 10, fontWeight: 800, color: isEmpty ? "#d1d5db" : color, letterSpacing: 1.2, textAlign: "center", marginBottom: 8 }}>TEAM {team}</div>
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center" }}>
                                {teamSlots.map(({ i }) => {
                                  const isMe = i === 0;
                                  return (
                                    <button
                                      key={i}
                                      onClick={() => cycleTeam(i)}
                                      style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, background: "none", border: "none", cursor: "pointer", padding: 2 }}
                                    >
                                      <div style={{ width: 40, height: 40, borderRadius: "50%", background: isMe ? "#f3f4f6" : "#e5e7eb", border: `2.5px solid ${color}`, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                        {isMe && profilePic
                                          ? <img src={profilePic} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" />
                                          : <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>}
                                      </div>
                                      <span style={{ fontSize: 9, fontWeight: 700, color, maxWidth: 44, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{isMe ? (profile.username || "You") : `P${i + 1}`}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <div style={{ fontSize: 10, color: "#9ca3af", textAlign: "center", marginBottom: 20 }}>Tap a player bubble to move them to the next team</div>

                      <button
                        onClick={() => setChallengeStep(2)}
                      style={{ width: "100%", padding: "14px 0", background: Theme.primaryGreen, border: "none", borderRadius: 12, color: "#fff", fontSize: 14, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
                      >
                        Continue
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                      </button>
                    </div>
                  </>
                )}

                {/* ── Step 2: Details ── */}
                {challengeStep === 2 && (
                  <>
                    <div style={{ padding: "20px 20px 0", flexShrink: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <button onClick={() => setChallengeStep(1)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", color: "#9ca3af" }}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                          </button>
                          <div>
                            <div style={{ fontSize: 20, fontWeight: 900, fontFamily: "Bebas Neue", letterSpacing: 1, lineHeight: 1 }}>DETAILS</div>
                            <div style={{ fontSize: 10, fontWeight: 800, color: Theme.primaryGreen, marginTop: 1 }}>{selectedFmt.label} · {challengeForm.playerCount} players</div>
                          </div>
                        </div>
                        <button onClick={closeModal} style={{ background: "none", border: "none", fontSize: 20, color: "#9ca3af", cursor: "pointer", lineHeight: 1 }}>✕</button>
                      </div>
                    </div>

                    <div style={{ overflowY: "auto", flex: 1, padding: "0 20px 32px" }}>

                      {/* Course */}
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 10, fontWeight: 800, color: "#9ca3af", letterSpacing: 1.5, marginBottom: 5 }}>COURSE</div>
                        <div style={{ position: "relative" }}>
                          <input
                            value={challengeForm.courseQuery}
                            onChange={async e => {
                              const val = e.target.value;
                              setChallengeForm(f => ({ ...f, courseQuery: val, courseName: "" }));
                              setChallengeCourseSuggestions([]);
                              if (val.length < 2) return;
                              const localMatches = Object.entries(COURSE_DB).filter(([k]) => k.toLowerCase().includes(val.toLowerCase())).slice(0, 5).map(([k]) => k);
                              const apiResults = await searchGolfCourseAPI(val);
                              const apiNames = apiResults.map(c => c.club_name || c.course_name || "").filter(n => n && !localMatches.includes(n)).slice(0, 5);
                              setChallengeCourseSuggestions([...localMatches, ...apiNames]);
                            }}
                            placeholder="Search and select a course…"
                            style={{ ...S.fInput, borderColor: challengeForm.courseName ? Theme.primaryGreen : undefined }}
                          />
                          {challengeForm.courseName && <div style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)" }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={Theme.primaryGreen} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg></div>}
                          {challengeCourseSuggestions.length > 0 && (
                            <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, zIndex: 10, boxShadow: "0 4px 12px rgba(0,0,0,0.1)", overflow: "hidden" }}>
                              {challengeCourseSuggestions.map((name, i) => (
                                <div key={i} onClick={() => { setChallengeForm(f => ({ ...f, courseQuery: name, courseName: name })); setChallengeCourseSuggestions([]); }} style={{ padding: "10px 14px", cursor: "pointer", borderBottom: i < challengeCourseSuggestions.length - 1 ? "1px solid #f0f0f0" : "none", fontSize: 13, fontWeight: 600, color: "#111827" }}>{name}</div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Tee Color */}
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 10, fontWeight: 800, color: "#9ca3af", letterSpacing: 1.5, marginBottom: 8 }}>TEE COLOR</div>
                        <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                          {TEE_COLORS.map(tc => {
                            const sel = challengeForm.teeColor === tc.id;
                            return (
                              <button
                                key={tc.id}
                                onClick={() => setChallengeForm(f => ({ ...f, teeColor: tc.id }))}
                                style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 11px", borderRadius: 20, border: sel ? `2px solid ${tc.border}` : "2px solid #e5e7eb", background: sel ? (tc.id === "white" ? "#f9fafb" : `${tc.dot}18`) : "#f9fafb", cursor: "pointer", outline: "none" }}
                              >
                                <div style={{ width: 12, height: 12, borderRadius: "50%", background: tc.dot, border: `1.5px solid ${tc.border}`, flexShrink: 0 }} />
                                <span style={{ fontSize: 11, fontWeight: 700, color: sel ? (tc.id === "white" ? "#374151" : tc.border) : "#6b7280" }}>{tc.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Holes */}
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 10, fontWeight: 800, color: "#9ca3af", letterSpacing: 1.5, marginBottom: 8 }}>HOLES</div>
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          {[18, 9].map(h => {
                            const sel = challengeForm.holes === h;
                            return (
                              <button key={h} onClick={() => setChallengeForm(f => ({ ...f, holes: h }))} style={{ padding: "8px 22px", borderRadius: 10, border: sel ? `2px solid ${Theme.primaryGreen}` : "2px solid #e5e7eb", background: sel ? "rgba(125,162,126,0.1)" : "#f9fafb", cursor: "pointer", fontSize: 13, fontWeight: 800, color: sel ? Theme.primaryGreen : "#6b7280", outline: "none" }}>
                                {h} holes
                              </button>
                            );
                          })}
                          {challengeForm.holes === 9 && (
                            <>
                              <div style={{ width: 1, height: 24, background: "#e5e7eb" }} />
                              {["front", "back"].map(side => {
                                const sel = challengeForm.nineHolesSide === side;
                                return (
                                  <button key={side} onClick={() => setChallengeForm(f => ({ ...f, nineHolesSide: side }))} style={{ padding: "8px 16px", borderRadius: 10, border: sel ? `2px solid ${Theme.primaryGreen}` : "2px solid #e5e7eb", background: sel ? "rgba(125,162,126,0.1)" : "#f9fafb", cursor: "pointer", fontSize: 12, fontWeight: 800, color: sel ? Theme.primaryGreen : "#6b7280", outline: "none", textTransform: "capitalize" }}>
                                    {side} 9
                                  </button>
                                );
                              })}
                            </>
                          )}
                        </div>
                      </div>

                      {/* Date */}
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 10, fontWeight: 800, color: "#9ca3af", letterSpacing: 1.5, marginBottom: 5 }}>DATE</div>
                        <input type="date" value={challengeForm.date} onChange={e => setChallengeForm(f => ({ ...f, date: e.target.value }))} style={{ ...S.fInput }} />
                      </div>

                      {/* Wager */}
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 10, fontWeight: 800, color: "#9ca3af", letterSpacing: 1.5, marginBottom: 5 }}>WAGER</div>
                        <input type="number" min={0} max={profile.coins || 0} value={challengeForm.wager} onChange={e => { const val = Math.max(0, Math.min(parseInt(e.target.value) || 0, profile.coins || 0)); setChallengeForm(f => ({ ...f, wager: val || "" })); }} placeholder="0" style={{ ...S.fInput }} />
                        <div style={{ fontSize: 9, color: "#9ca3af", marginTop: 2 }}>Bal: {(profile.coins || 0).toLocaleString()}</div>
                      </div>

                      {/* Tee time */}
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 10, fontWeight: 800, color: "#9ca3af", letterSpacing: 1.5, marginBottom: 5 }}>TEE TIME WINDOW</div>
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <input type="time" value={challengeForm.timeFrom || ""} onChange={e => setChallengeForm(f => ({ ...f, timeFrom: e.target.value }))} style={{ ...S.fInput, flex: 1 }} />
                          <span style={{ color: "#9ca3af", fontWeight: 700, flexShrink: 0 }}>to</span>
                          <input type="time" value={challengeForm.timeTo || ""} onChange={e => setChallengeForm(f => ({ ...f, timeTo: e.target.value }))} style={{ ...S.fInput, flex: 1 }} />
                        </div>
                      </div>

                      {/* Message */}
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 10, fontWeight: 800, color: "#9ca3af", letterSpacing: 1.5, marginBottom: 5 }}>MESSAGE <span style={{ fontWeight: 600, opacity: 0.7 }}>(optional)</span></div>
                        <textarea value={challengeForm.message} onChange={e => setChallengeForm(f => ({ ...f, message: e.target.value }))} placeholder="e.g. All skill levels welcome!" maxLength={140} rows={2} style={{ ...S.fInput, resize: "none", fontFamily: "inherit", lineHeight: 1.5 }} />
                        {challengeForm.message.length > 0 && <div style={{ fontSize: 10, color: "#9ca3af", textAlign: "right", marginTop: 2 }}>{challengeForm.message.length}/140</div>}
                      </div>

                      {challengePostError && <div style={{ marginBottom: 10, padding: "9px 12px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, fontSize: 12, color: "#dc2626", fontWeight: 600 }}>{challengePostError}</div>}

                      <button
                        disabled={challengeBusy || !step2Ready}
                        onClick={handlePostChallenge}
                        style={{ width: "100%", padding: "14px 0", background: step2Ready ? Theme.primaryGreen : "#e5e7eb", border: "none", borderRadius: 12, color: step2Ready ? "#fff" : "#9ca3af", fontSize: 14, fontWeight: 800, cursor: step2Ready ? "pointer" : "default", transition: "background 0.15s" }}
                      >
                        {challengeBusy ? "Posting…" : "Post Challenge"}
                      </button>
                    </div>
                  </>
                )}

              </div>
            </div>
          );
        })()}
        </>
      )}

      {/* ── Challenger Profile Modal ── */}
      {viewingChallenger && (
        <div onClick={() => { setViewingChallenger(null); setChallengerStats(null); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "flex-end", zIndex: 350 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: "20px 20px 0 0", width: "100%", maxHeight: "75vh", display: "flex", flexDirection: "column" }}>
            {/* Header */}
            <div style={{ padding: "20px 20px 16px", display: "flex", alignItems: "center", gap: 14, flexShrink: 0, borderBottom: "1px solid #f3f4f6" }}>
              <div style={{ width: 54, height: 54, borderRadius: "50%", background: "#f3f4f6", overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {viewingChallenger.profilePic ? <img src={viewingChallenger.profilePic} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" /> : <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 22, fontWeight: 900, fontFamily: "Bebas Neue", letterSpacing: 1, lineHeight: 1.1 }}>{viewingChallenger.username}</div>
                {challengerStats && !challengerStats.loading && (
                  <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>Lvl {challengerStats.level} · OVR {challengerStats.ovr} · {challengerStats.rounds} rounds</div>
                )}
              </div>
              <button onClick={() => { setViewingChallenger(null); setChallengerStats(null); }} style={{ background: "none", border: "none", fontSize: 20, color: "#9ca3af", cursor: "pointer", lineHeight: 1 }}>✕</button>
            </div>

            <div style={{ overflowY: "auto", flex: 1, padding: "16px 20px 40px" }}>
              {!challengerStats || challengerStats.loading ? (
                <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={Theme.primaryGreen} strokeWidth="2" strokeLinecap="round" style={{ animation: "spin 1s linear infinite" }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                </div>
              ) : (
                <>
                  {/* W/L Record */}
                  <div style={{ fontSize: 10, fontWeight: 800, color: "#9ca3af", letterSpacing: 1.5, marginBottom: 10 }}>CHALLENGE RECORD</div>
                  <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
                    <div style={{ flex: 1, background: "rgba(125,162,126,0.1)", border: "1.5px solid rgba(125,162,126,0.25)", borderRadius: 14, padding: "14px 0", textAlign: "center" }}>
                      <div style={{ fontSize: 32, fontWeight: 900, fontFamily: "Bebas Neue", color: Theme.primaryGreen, lineHeight: 1 }}>{challengerStats.wins}</div>
                      <div style={{ fontSize: 10, fontWeight: 800, color: Theme.primaryGreen, letterSpacing: 1.5, marginTop: 2 }}>WINS</div>
                    </div>
                    <div style={{ flex: 1, background: "#f9fafb", border: "1.5px solid #e5e7eb", borderRadius: 14, padding: "14px 0", textAlign: "center" }}>
                      <div style={{ fontSize: 32, fontWeight: 900, fontFamily: "Bebas Neue", color: "#374151", lineHeight: 1 }}>{challengerStats.losses}</div>
                      <div style={{ fontSize: 10, fontWeight: 800, color: "#9ca3af", letterSpacing: 1.5, marginTop: 2 }}>LOSSES</div>
                    </div>
                    <div style={{ flex: 1, background: "#f9fafb", border: "1.5px solid #e5e7eb", borderRadius: 14, padding: "14px 0", textAlign: "center" }}>
                      <div style={{ fontSize: 32, fontWeight: 900, fontFamily: "Bebas Neue", color: "#374151", lineHeight: 1 }}>{challengerStats.wins + challengerStats.losses > 0 ? Math.round(challengerStats.wins / (challengerStats.wins + challengerStats.losses) * 100) : "—"}{challengerStats.wins + challengerStats.losses > 0 ? "%" : ""}</div>
                      <div style={{ fontSize: 10, fontWeight: 800, color: "#9ca3af", letterSpacing: 1.5, marginTop: 2 }}>WIN %</div>
                    </div>
                  </div>

                  {/* Reviews */}
                  <div style={{ fontSize: 10, fontWeight: 800, color: "#9ca3af", letterSpacing: 1.5, marginBottom: 10 }}>
                    REVIEWS {challengerStats.reviews.length > 0 && (() => {
                      const avg = challengerStats.reviews.reduce((a, r) => a + (r.rating || 0), 0) / challengerStats.reviews.length;
                      return <span style={{ color: "#f59e0b", fontWeight: 900 }}>{"★".repeat(Math.round(avg))} {avg.toFixed(1)}</span>;
                    })()}
                  </div>
                  {challengerStats.reviews.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "24px 0", color: "#9ca3af", fontSize: 13 }}>No reviews yet</div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {challengerStats.reviews.map((r, i) => (
                        <div key={i} style={{ background: "#f9fafb", borderRadius: 12, padding: "12px 14px" }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: "#374151" }}>{r.reviewerUsername || "Anonymous"}</span>
                            <span style={{ fontSize: 13, color: "#f59e0b", letterSpacing: 1 }}>{"★".repeat(r.rating || 0)}{"☆".repeat(5 - (r.rating || 0))}</span>
                          </div>
                          {r.text && <div style={{ fontSize: 12, color: "#6b7280", fontStyle: "italic", lineHeight: 1.4 }}>"{r.text}"</div>}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Profile viewer modal */}
      {viewingPic && (
        <div onClick={() => setViewingPic(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 400 }}>
          <img src={viewingPic} alt="" style={{ maxWidth: "90vw", maxHeight: "90vh", borderRadius: 16, objectFit: "contain" }} />
          <button onClick={() => setViewingPic(null)} style={{ position: "absolute", top: 20, right: 20, background: "rgba(255,255,255,0.15)", border: "none", borderRadius: "50%", width: 40, height: 40, color: "#fff", fontSize: 20, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
        </div>
      )}

      {viewingProfile && (
        <div onClick={() => setViewingProfile(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "flex-end", zIndex: 300 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: "20px 20px 0 0", padding: "24px 20px 40px", width: "100%", maxHeight: "70vh", overflowY: "auto" }}>
            <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 16 }}>
              <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#f3f4f6", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {viewingProfile.profilePic ? <img src={viewingProfile.profilePic} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" /> : <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>}
              </div>
              <div>
                <div style={{ fontSize: 22, fontWeight: 900, fontFamily: "Bebas Neue", letterSpacing: 1 }}>{viewingProfile.username}</div>
                <div style={{ fontSize: 12, color: "#9ca3af" }}>Lvl {viewingProfile.level || 1} · OVR {viewingProfile.ovr} · {viewingProfile.history?.length || 0} rounds</div>
              </div>
            </div>
            {viewingProfile.history && viewingProfile.history.length > 0 && (
              <div>
                <div style={{ fontSize: 10, fontWeight: 800, color: "#9ca3af", letterSpacing: 1.5, marginBottom: 8 }}>RECENT ROUNDS</div>
                {viewingProfile.history.slice(0, 5).map((r, i) => (
                  <div key={i} style={{ background: "#f9fafb", borderRadius: 10, padding: "10px 12px", marginBottom: 6, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div><div style={{ fontSize: 13, fontWeight: 700 }}>{r.course || "Unknown"}</div><div style={{ fontSize: 11, color: "#9ca3af" }}>{r.date}</div></div>
                    <div style={{ display: "flex", gap: 12 }}>
                      <div style={{ textAlign: "center" }}><div style={{ fontSize: 18, fontWeight: 900, fontFamily: "Bebas Neue" }}>{r.score}</div><div style={{ fontSize: 8, color: "#9ca3af", fontWeight: 800 }}>SCORE</div></div>
                      <div style={{ textAlign: "center" }}><div style={{ fontSize: 18, fontWeight: 900, fontFamily: "Bebas Neue", color: ACCENT }}>{r.ovrAfter}</div><div style={{ fontSize: 8, color: "#9ca3af", fontWeight: 800 }}>OVR</div></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {(() => {
              const theirBadges = getUnlockedBadges(viewingProfile);
              if (theirBadges.length === 0) return null;
              return (
                <div style={{ marginTop: 14 }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: "#9ca3af", letterSpacing: 1.5, marginBottom: 8 }}>BADGES</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {theirBadges.slice(0, 12).map(a => (
                      <div key={a.id} title={a.label}><BadgeIcon id={a.id} size={32} /></div>
                    ))}
                  </div>
                </div>
              );
            })()}
            {viewingProfile.uid !== authUser?.uid && (
              friends.includes(viewingProfile.uid) ? (
                <button onClick={async () => { await removeFriendInDb(authUser.uid, viewingProfile.uid); setFriends(prev => prev.filter(id => id !== viewingProfile.uid)); setLeaderboard(prev => prev.filter(p => p.uid !== viewingProfile.uid)); setViewingProfile(null); }} style={{ width: "100%", padding: "12px 0", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, color: "#dc2626", fontSize: 13, fontWeight: 700, cursor: "pointer", marginTop: 8 }}>
                  Remove Friend
                </button>
              ) : (
                <button onClick={() => { handleSendRequest(viewingProfile); setViewingProfile(null); }} disabled={sentRequests.includes(viewingProfile.uid)} style={{ width: "100%", padding: "12px 0", background: sentRequests.includes(viewingProfile.uid) ? "#f3f4f6" : Theme.primaryGreen, border: "none", borderRadius: 10, color: sentRequests.includes(viewingProfile.uid) ? "#9ca3af" : "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", marginTop: 8 }}>
                  {sentRequests.includes(viewingProfile.uid) ? "Request Sent" : "Add Friend"}
                </button>
              )
            )}
          </div>
        </div>
      )}

      {/* ── BAG TAB ── */}
      {tab === "bag" && (() => {
        const sorted = [...(profile.bag || [])].sort((a, b) => parseFloat(b.distance || 0) - parseFloat(a.distance || 0));

        return (
          <div className="tab-scroll" style={{ background: "#F9F9F9", display: "flex", flexDirection: "column", paddingBottom: 80 }}>

            {/* ── Header ── */}
            <div style={{ background: "#FFFFFF", padding: "clamp(20px,5vw,32px) 20px 0", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 2 }}>
                <div style={{ fontSize: 26, fontWeight: 900, fontFamily: "'Inter',sans-serif", letterSpacing: 0.5, color: Theme.textMain }}>MY BAG</div>
                <div style={{ fontSize: 12, color: Theme.textMuted, fontWeight: 600 }}>
                  {sorted.length} club{sorted.length !== 1 ? "s" : ""}
                </div>
              </div>
              <div style={{ fontSize: 11, color: Theme.textMuted, fontWeight: 500, marginBottom: 14 }}>
                Tap a club to select · quick-add below
              </div>
              {/* Quick-add pill bar */}
              <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 16, scrollbarWidth: "none" }}>
                {["Driver","3W","5W","2H","3H","4H","4i","5i","6i","7i","8i","9i","PW","AW","SW","48°","50°","52°","54°","56°","58°","60°","Putter"].map(c => {
                  const inBag = (profile.bag || []).some(b => b.club === c);
                  return (
                    <button key={c} onClick={() => { if (inBag) return; hapticTap(); setProfile(p => ({ ...p, bag: [...(p.bag || []), { club: c, distance: "", notes: "" }] })); }}
                      style={{ flexShrink: 0, padding: "6px 13px", background: inBag ? "rgba(125,162,126,0.12)" : "transparent", border: inBag ? `1px solid ${Theme.primaryGreen}` : "1px solid rgba(91,114,130,0.28)", borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: inBag ? "default" : "pointer", color: inBag ? Theme.primaryGreen : Theme.softSlate, whiteSpace: "nowrap" }}>
                      {c}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ── Club list ── */}
            <div style={{ flex: 1, overflowY: "auto", padding: "12px 20px" }}>
              {sorted.length === 0 && (
                <div style={{ paddingTop: 40, textAlign: "center", color: Theme.textMuted, fontSize: 13 }}>
                  Add clubs using the bar above
                </div>
              )}
              {sorted.map((item, idx) => {
                const isActive = activeBagClub === item.club;

                if (bagEditClub === idx) {
                  return (
                    <div key={idx} style={{ background: "#fff", borderRadius: 10, border: "1px solid rgba(0,0,0,0.08)", marginBottom: 10, padding: "14px 16px" }}>
                      <div style={{ display: "flex", gap: 7, marginBottom: 9 }}>
                        <input defaultValue={item.club} id={`club-name-${idx}`} placeholder="Club (e.g. 7i)" style={{ ...S.fInput, flex: 1, fontSize: 13 }} />
                        <input defaultValue={item.distance} id={`club-dist-${idx}`} placeholder="Avg yds" type="number" style={{ ...S.fInput, flex: 1, fontSize: 13 }} />
                      </div>
                      <div style={{ display: "flex", gap: 7 }}>
                        <button onClick={() => {
                          const name = document.getElementById(`club-name-${idx}`).value.trim();
                          const dist = document.getElementById(`club-dist-${idx}`).value.trim();
                          setProfile(p => { const b = [...(p.bag || [])]; b[idx] = { ...b[idx], club: name, distance: dist }; return { ...p, bag: b }; });
                          setBagEditClub(null);
                        }} style={{ flex: 1, padding: "9px 0", background: Theme.primaryGreen, border: "none", borderRadius: 8, color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>Save</button>
                        <button onClick={() => { setProfile(p => ({ ...p, bag: (p.bag || []).filter((_, i) => i !== idx) })); setBagEditClub(null); if (activeBagClub === item.club) setActiveBagClub(null); }}
                          style={{ padding: "9px 12px", background: "#FEF2F2", border: "none", borderRadius: 8, color: "#DC2626", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>Remove</button>
                        <button onClick={() => setBagEditClub(null)} style={{ padding: "9px 10px", background: "#F3F4F6", border: "none", borderRadius: 8, color: "#6B7280", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>✕</button>
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={idx}
                    onClick={() => { hapticTap(); setActiveBagClub(a => a === item.club ? null : item.club); }}
                    style={{
                      background: isActive ? "rgba(125,162,126,0.05)" : "#FFFFFF",
                      borderRadius: 10,
                      borderLeft: isActive ? `3px solid ${Theme.primaryGreen}` : "3px solid transparent",
                      borderTop: "1px solid rgba(0,0,0,0.06)",
                      borderRight: "1px solid rgba(0,0,0,0.06)",
                      borderBottom: "1px solid rgba(0,0,0,0.06)",
                      marginBottom: 10,
                      cursor: "pointer",
                      transition: "background 0.15s, border-left-color 0.15s",
                    }}>
                    <div style={{ padding: "16px 14px 16px 18px", display: "flex", alignItems: "center" }}>
                      {/* Club name */}
                      <div style={{ flex: 1, fontSize: 16, fontWeight: 700, color: Theme.textMain, fontFamily: "'Inter',sans-serif", letterSpacing: -0.2 }}>
                        {item.club}
                      </div>
                      {/* Yardage */}
                      <div style={{ fontSize: 14, fontWeight: 600, color: item.distance ? Theme.softSlate : "#D1D1D6", marginRight: 10 }}>
                        {item.distance ? `${item.distance} yds` : "—"}
                      </div>
                      {/* Edit chevron */}
                      <button onClick={e => { e.stopPropagation(); setBagEditClub(idx); }}
                        style={{ background: "none", border: "none", cursor: "pointer", padding: "2px", color: "#D1D1D6", flexShrink: 0 }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
                      </button>
                    </div>
                  </div>
                );
              })}
              {/* Add club */}
              <button onClick={() => setProfile(p => ({ ...p, bag: [...(p.bag || []), { club: "", distance: "", notes: "" }] }))}
                style={{ width: "100%", padding: "15px 0", background: "transparent", border: "1.5px dashed rgba(125,162,126,0.45)", borderRadius: 10, color: Theme.primaryGreen, fontSize: 13, fontWeight: 600, cursor: "pointer", marginTop: 4 }}>
                + Add Club
              </button>
            </div>
          </div>
        );
      })()}

      {/* ── SHOP TAB ── */}

            {tab === "shop" && (
        <div className="tab-scroll" style={{ paddingBottom: 80 }}>
          <div style={{ padding: "20px 16px 12px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
              <div style={{ fontSize: 24, fontWeight: 900, fontFamily: "Bebas Neue", letterSpacing: 2 }}>SHOP</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: Theme.mutedGold }}>🪙 {COINS.toLocaleString()} Coins</div>
            </div>

            {/* ── COIN PACKS ── */}
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: "#9ca3af", letterSpacing: 1.5, marginBottom: 8 }}>BUY COINS</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {COIN_PACKS.map(pack => (
                  <button key={pack.id} onClick={() => handleSelectCoinPack(pack)} style={{ position: "relative", background: "#fff", border: pack.tag ? `2px solid ${Theme.primaryGreen}` : "1px solid #e5e7eb", borderRadius: 14, padding: "14px 12px", textAlign: "center", cursor: "pointer", boxShadow: pack.tag ? "0 2px 12px rgba(125,162,126,0.15)" : "none" }}>
                    {pack.tag && <div style={{ position: "absolute", top: -9, left: "50%", transform: "translateX(-50%)", background: Theme.primaryGreen, color: "#fff", fontSize: 8, fontWeight: 800, letterSpacing: 1, borderRadius: 10, padding: "2px 8px", whiteSpace: "nowrap" }}>{pack.tag}</div>}
                    <div style={{ fontSize: 22, fontWeight: 900, color: Theme.mutedGold, fontFamily: "Bebas Neue", lineHeight: 1 }}>🪙 {pack.coins.toLocaleString()}</div>
                    <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>{pack.label}</div>
                    <div style={{ fontSize: 16, fontWeight: 900, color: "#111827", marginTop: 6 }}>${pack.price.toFixed(2)}</div>
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4 }}>
              {["banner","border","nameplate","boost"].map(cat => (
                <button key={cat} onClick={() => setShopCategory(cat)} style={{ padding: "7px 14px", background: shopCategory === cat ? Theme.primaryGreen : "#f9fafb", border: shopCategory === cat ? `1.5px solid ${Theme.primaryGreen}` : "1px solid #e5e7eb", borderRadius: 20, color: shopCategory === cat ? "#fff" : "#374151", fontWeight: 800, fontSize: 11, letterSpacing: 1, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>
                  {cat.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          <div style={{ padding: "0 16px" }}>
            {SHOP_ITEMS.filter(item => item.type === shopCategory).map(item => {
              const owned = (profile.ownedItems || []).includes(item.id);
              const equipped = profile[`equipped${item.type.charAt(0).toUpperCase() + item.type.slice(1)}`] === item.id;
              const canAfford = COINS >= item.price;
              const meetsLevel = true;
              return (
                <div key={item.id} style={{ background: equipped ? "rgba(125,162,126,0.05)" : "#fff", borderRadius: 14, border: equipped ? `2px solid ${Theme.primaryGreen}` : "1px solid #e5e7eb", padding: "14px", marginBottom: 10, display: "flex", gap: 14, alignItems: "center" }}>
                  {/* Preview */}
                  <div style={{ width: 52, height: 52, borderRadius: 10, flexShrink: 0, overflow: "hidden", position: "relative", ...(item.type === "banner" ? { background: item.preview } : { background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center" }) }} className={item.type === "banner" && item.animated === "shimmer" ? "banner-shimmer" : item.type === "banner" && item.animated === "aurora" ? "banner-aurora" : ""}>
                    {item.type === "border" && <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#e5e7eb", ...item.style }} />}
                    {item.type === "nameplate" && <div style={{ fontSize: 11, fontWeight: 900, fontFamily: "Bebas Neue", ...item.style }}>ABC</div>}
                    {item.type === "boost" && <div style={{ fontSize: 22 }}>⚡</div>}
                    {item.seasonal && <div style={{ position: "absolute", top: 3, right: 3, background: "rgba(0,0,0,0.6)", borderRadius: 4, padding: "1px 4px", fontSize: 7, fontWeight: 800, color: "#fff" }}>{item.seasonLabel}</div>}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: "#111827", marginBottom: 2 }}>{item.label}</div>
                    {item.type === "boost" && <div style={{ fontSize: 11, color: "#9ca3af" }}>{item.desc}</div>}
                    <div style={{ fontSize: 11, color: "#9ca3af" }}>🪙 {item.price.toLocaleString()}</div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 5, flexShrink: 0 }}>
                    {item.type !== "boost" && (
                      <button onClick={() => setShopPreview(item)} style={{ padding: "7px 12px", background: "#f3f4f6", border: "1px solid #e5e7eb", borderRadius: 8, color: "#374151", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                        Preview
                      </button>
                    )}
                    {owned ? (
                      item.type !== "boost" ? (
                        <button onClick={() => {
                          const key = `equipped${item.type.charAt(0).toUpperCase() + item.type.slice(1)}`;
                          setProfile(p => ({ ...p, [key]: p[key] === item.id ? null : item.id }));
                        }} style={{ padding: "7px 12px", background: equipped ? "rgba(125,162,126,0.1)" : "#f9fafb", border: `1px solid ${equipped ? Theme.primaryGreen : "#e5e7eb"}`, borderRadius: 8, color: equipped ? Theme.primaryGreen : "#374151", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                          {equipped ? "Equipped ✓" : "Equip"}
                        </button>
                      ) : <div style={{ fontSize: 12, color: Theme.primaryGreen, fontWeight: 700 }}>Owned</div>
                    ) : (
                      <button onClick={() => setShopConfirm(item)} disabled={!canAfford || !meetsLevel} style={{ padding: "7px 12px", background: canAfford && meetsLevel ? Theme.primaryGreen : "#f3f4f6", border: "none", borderRadius: 8, color: canAfford && meetsLevel ? "#fff" : "#9ca3af", fontWeight: 700, fontSize: 12, cursor: canAfford && meetsLevel ? "pointer" : "default" }}>
                        {!meetsLevel ? `Lvl ${item.level}` : !canAfford ? "Need 🪙" : `Buy`}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {/* Shop preview modal */}
          {shopPreview && (() => {
            const item = shopPreview;
            const owned = (profile.ownedItems || []).includes(item.id);
            const canAfford = COINS >= item.price;
            const meetsLevel = profile.level >= (item.level || 1);
            const equipped = profile[`equipped${item.type.charAt(0).toUpperCase() + item.type.slice(1)}`] === item.id;
            const displayName = profile.username || "Your Name";
            const equippedBannerItem = SHOP_ITEMS.find(i => i.id === profile.equippedBanner);
            const bannerBg = equippedBannerItem ? equippedBannerItem.preview : "linear-gradient(135deg, #14532d 0%, #22c55e 60%)";
            const bannerAnimClass = equippedBannerItem?.animated === "shimmer" ? "banner-shimmer" : equippedBannerItem?.animated === "aurora" ? "banner-aurora" : "";
            return (
              <div onClick={() => setShopPreview(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 350 }}>
                <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: "20px 20px 0 0", width: "100%", maxWidth: 480, maxHeight: "calc(85vh - env(safe-area-inset-bottom, 0px))", display: "flex", flexDirection: "column", overflow: "hidden" }}>
                  {/* Header — fixed */}
                  <div style={{ flexShrink: 0, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px 12px", borderBottom: "1px solid #f3f4f6" }}>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 900, color: "#111827" }}>{item.label}</div>
                      <div style={{ fontSize: 11, color: "#9ca3af" }}>🪙 {item.price.toLocaleString()}</div>
                    </div>
                    <button onClick={() => setShopPreview(null)} style={{ background: "#f3f4f6", border: "none", borderRadius: 8, width: 32, height: 32, fontSize: 18, cursor: "pointer", color: "#6b7280", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
                  </div>

                  {/* Preview area — scrollable */}
                  <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
                  <div style={{ background: "#f9fafb", borderRadius: 16, padding: 24, display: "flex", flexDirection: "column", alignItems: "center", gap: 16, border: "1px solid #e5e7eb" }}>
                    {/* BANNER */}
                    {item.type === "banner" && (
                      <div style={{ width: "100%", borderRadius: 12, overflow: "hidden" }}>
                        <div style={{ width: "100%", height: 90, background: item.preview, borderRadius: 12 }} className={item.animated === "shimmer" ? "banner-shimmer" : item.animated === "aurora" ? "banner-aurora" : ""} />
                        <div style={{ background: "#fff", borderRadius: "0 0 12px 12px", padding: "12px 14px", border: "1px solid #e5e7eb", borderTop: "none", display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#e5e7eb", flexShrink: 0, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            {profilePic ? <img src={profilePic} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: 16, fontWeight: 900, color: "#6b7280" }}>{(profile.username || "?")[0].toUpperCase()}</span>}
                          </div>
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 900, color: "#111827" }}>{displayName}</div>
                            <div style={{ fontSize: 10, color: "#9ca3af" }}>OVR {profile.ovr || 60}</div>
                          </div>
                        </div>
                      </div>
                    )}
                    {/* BORDER */}
                    {item.type === "border" && (
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, width: "100%" }}>
                        <div style={{ width: "100%", borderRadius: 12, overflow: "hidden" }}>
                          <div style={{ width: "100%", height: 60, background: bannerBg }} className={bannerAnimClass} />
                          <div style={{ background: "#fff", padding: "12px 14px 14px", display: "flex", alignItems: "center", gap: 12, borderTop: "none" }}>
                            <div style={{ width: 72, height: 72, borderRadius: "50%", background: "#e5e7eb", overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", ...item.style }}>
                              {profilePic
                                ? <img src={profilePic} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} />
                                : <span style={{ fontSize: 28, fontWeight: 900, color: "#6b7280" }}>{(profile.username || "?")[0].toUpperCase()}</span>
                              }
                            </div>
                            <div>
                              <div style={{ fontSize: 14, fontWeight: 900, color: "#111827" }}>{displayName}</div>
                              <div style={{ fontSize: 10, color: "#9ca3af" }}>OVR {profile.ovr || 60}</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    {/* NAMEPLATE */}
                    {item.type === "nameplate" && (
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, width: "100%" }}>
                        <div style={{ width: "100%", borderRadius: 12, overflow: "hidden" }}>
                          <div style={{ width: "100%", height: 70, background: bannerBg }} className={bannerAnimClass} />
                          <div style={{ background: "#fff", padding: "14px 18px 16px", display: "flex", alignItems: "center", gap: 12 }}>
                            <div style={{ width: 52, height: 52, borderRadius: "50%", background: "#e5e7eb", flexShrink: 0, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
                              {profilePic
                                ? <img src={profilePic} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                : <span style={{ fontSize: 22, fontWeight: 900, color: "#6b7280" }}>{(profile.username || "?")[0].toUpperCase()}</span>
                              }
                            </div>
                            <div>
                              <div style={{ fontSize: 20, fontWeight: 900, fontFamily: "Bebas Neue", letterSpacing: 1, ...item.style }}>{displayName}</div>
                              <div style={{ fontSize: 10, color: "#9ca3af", letterSpacing: 1.5 }}>OVR {profile.ovr || 60}</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  </div>{/* end scrollable area */}

                  {/* Action buttons — fixed at bottom */}
                  <div style={{ flexShrink: 0, display: "flex", gap: 10, padding: "12px 20px", paddingBottom: "calc(12px + env(safe-area-inset-bottom, 0px))", borderTop: "1px solid #f3f4f6" }}>
                    <button onClick={() => setShopPreview(null)} style={{ flex: 1, padding: 13, background: "#f3f4f6", border: "1px solid #e5e7eb", borderRadius: 12, fontWeight: 700, fontSize: 14, cursor: "pointer", color: "#374151" }}>Close</button>
                    {owned ? (
                      <button onClick={() => {
                        const key = `equipped${item.type.charAt(0).toUpperCase() + item.type.slice(1)}`;
                        setProfile(p => ({ ...p, [key]: p[key] === item.id ? null : item.id }));
                        setShopPreview(null);
                      }} style={{ flex: 1, padding: 13, background: equipped ? "#f3f4f6" : Theme.primaryGreen, border: `1px solid ${equipped ? "#e5e7eb" : Theme.primaryGreen}`, borderRadius: 12, fontWeight: 700, fontSize: 14, cursor: "pointer", color: equipped ? "#374151" : "#fff" }}>
                        {equipped ? "Unequip" : "Equip"}
                      </button>
                    ) : (
                      <button onClick={() => { setShopPreview(null); setShopConfirm(item); }} disabled={!canAfford || !meetsLevel} style={{ flex: 1, padding: 13, background: canAfford && meetsLevel ? Theme.primaryGreen : "#f3f4f6", border: "none", borderRadius: 12, fontWeight: 700, fontSize: 14, cursor: canAfford && meetsLevel ? "pointer" : "default", color: canAfford && meetsLevel ? "#fff" : "#9ca3af" }}>
                        {!meetsLevel ? `Requires Lvl ${item.level}` : !canAfford ? "Not enough coins" : `Buy · 🪙 ${item.price.toLocaleString()}`}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Shop confirm modal */}
          {/* ── COIN PURCHASE MODAL ── */}
          {coinShopPack && (
            <div onClick={() => { if (!coinPaymentBusy) { setCoinShopPack(null); setCoinClientSecret(null); setCoinPaymentSuccess(false); setCoinPaymentError(""); } }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 400 }}>
              <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: "20px 20px 0 0", width: "100%", maxWidth: 480, padding: "24px 20px 36px", boxSizing: "border-box" }}>
                {coinPaymentSuccess ? (
                  <div style={{ textAlign: "center", padding: "20px 0" }}>
                    <div style={{ fontSize: 48, marginBottom: 12 }}>🪙</div>
                    <div style={{ fontSize: 22, fontWeight: 900, fontFamily: "Bebas Neue", letterSpacing: 1, marginBottom: 6 }}>COINS ADDED!</div>
                    <div style={{ fontSize: 14, color: "#6b7280", marginBottom: 20 }}>+{coinShopPack.coins.toLocaleString()} coins have been added to your account.</div>
                    <button onClick={() => { setCoinShopPack(null); setCoinClientSecret(null); setCoinPaymentSuccess(false); }} style={{ width: "100%", padding: 14, background: Theme.primaryGreen, border: "none", borderRadius: 12, color: "#fff", fontWeight: 800, fontSize: 15, cursor: "pointer" }}>Done</button>
                  </div>
                ) : (
                  <>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                      <div>
                        <div style={{ fontSize: 18, fontWeight: 900 }}>{coinShopPack.label} Pack</div>
                        <div style={{ fontSize: 13, color: "#6b7280" }}>🪙 {coinShopPack.coins.toLocaleString()} coins · ${coinShopPack.price.toFixed(2)}</div>
                      </div>
                      <button onClick={() => { setCoinShopPack(null); setCoinClientSecret(null); setCoinPaymentError(""); }} style={{ background: "#f3f4f6", border: "none", borderRadius: 8, width: 32, height: 32, fontSize: 18, cursor: "pointer", color: "#6b7280" }}>✕</button>
                    </div>
                    {coinPaymentError && !coinClientSecret ? (
                      <div style={{ textAlign: "center", padding: "20px 0" }}>
                        <div style={{ fontSize: 13, color: "#ef4444", marginBottom: 16, lineHeight: 1.5 }}>{coinPaymentError}</div>
                        <button onClick={() => handleSelectCoinPack(coinShopPack)} style={{ padding: "10px 24px", background: Theme.primaryGreen, border: "none", borderRadius: 10, color: "#fff", fontWeight: 800, fontSize: 14, cursor: "pointer" }}>Try Again</button>
                      </div>
                    ) : !coinClientSecret ? (
                      <div style={{ textAlign: "center", padding: "32px 0", color: "#9ca3af", fontSize: 13 }}>Setting up payment...</div>
                    ) : (
                      <>
                        <div style={{ marginBottom: 16 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", marginBottom: 6, letterSpacing: 0.5 }}>CARD DETAILS</div>
                          <div ref={mountCardElement} style={{ border: "1.5px solid #e5e7eb", borderRadius: 10, padding: "14px 12px", background: "#fafafa", minHeight: 44 }} />
                        </div>
                        {coinPaymentError && <div style={{ fontSize: 12, color: "#ef4444", marginBottom: 12, textAlign: "center" }}>{coinPaymentError}</div>}
                        <button onClick={handleCoinPayment} disabled={coinPaymentBusy} style={{ width: "100%", padding: 14, background: coinPaymentBusy ? "#e5e7eb" : Theme.primaryGreen, border: "none", borderRadius: 12, color: coinPaymentBusy ? "#9ca3af" : "#fff", fontWeight: 800, fontSize: 15, cursor: coinPaymentBusy ? "default" : "pointer" }}>
                          {coinPaymentBusy ? "Processing..." : `Pay $${coinShopPack.price.toFixed(2)}`}
                        </button>
                        <div style={{ fontSize: 10, color: "#9ca3af", textAlign: "center", marginTop: 10 }}>Secured by Stripe · No card info stored</div>
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {shopConfirm && (
            <div onClick={() => setShopConfirm(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300 }}>
              <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 16, padding: 24, maxWidth: 280, width: "90%", textAlign: "center" }}>
                <div style={{ fontSize: 16, fontWeight: 900, marginBottom: 4 }}>Buy {shopConfirm.label}?</div>
                <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 16 }}>Cost: 🪙 {shopConfirm.price.toLocaleString()}<br/>Balance: {COINS.toLocaleString()} → {(COINS - shopConfirm.price).toLocaleString()} coins</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => setShopConfirm(null)} style={{ flex: 1, padding: 12, background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 10, fontWeight: 700, cursor: "pointer" }}>Cancel</button>
                  <button onClick={() => {
                    const key = `equipped${shopConfirm.type.charAt(0).toUpperCase() + shopConfirm.type.slice(1)}`;
                    let updates = { ownedItems: [...(profile.ownedItems || []), shopConfirm.id], coins: (profile.coins || 0) - shopConfirm.price };
                    if (shopConfirm.type === "boost") {
                      const cur = profile.coinBoost && profile.coinBoost.roundsLeft > 0 ? profile.coinBoost : null;
                      const merged = cur && cur.multiplier === shopConfirm.multiplier ? { ...cur, roundsLeft: cur.roundsLeft + shopConfirm.rounds } : { multiplier: shopConfirm.multiplier, roundsLeft: shopConfirm.rounds };
                      updates.coinBoost = merged;
                    } else { updates[key] = shopConfirm.id; }
                    setProfile(p => ({ ...p, ...updates }));
                    setShopConfirm(null);
                  }} style={{ flex: 1, padding: 12, background: Theme.primaryGreen, border: "none", borderRadius: 10, color: "#fff", fontWeight: 700, cursor: "pointer" }}>Confirm</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── CLUB PICKER MODAL (shot tracking) ── */}
      {pendingShotYards != null && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", display: "flex", alignItems: "flex-end", zIndex: 400 }}>
          <div style={{ background: "#fff", borderRadius: "20px 20px 0 0", padding: "24px 20px 40px", width: "100%", maxHeight: "75vh", overflowY: "auto" }}>
            {/* Yardage hero */}
            <div style={{ textAlign: "center", marginBottom: 16 }}>
              <div style={{ fontSize: 64, fontWeight: 900, fontFamily: "Bebas Neue", color: "#111827", lineHeight: 1 }}>{pendingShotYards}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#9ca3af", letterSpacing: 2 }}>YARDS</div>
              <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>Which club did you hit?</div>
            </div>

            {/* Fairway hit toggle */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: "#6b7280", letterSpacing: 1.5, marginBottom: 6 }}>FAIRWAY HIT?</div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => setShotInFairway(v => !v)}
                  style={{ flex: 1, padding: "10px 0", border: `2px solid ${shotInFairway ? "#059669" : "#e5e7eb"}`, borderRadius: 10, background: shotInFairway ? "#f0fdf4" : "#fff", color: shotInFairway ? "#059669" : "#9ca3af", fontSize: 13, fontWeight: 800, cursor: "pointer", transition: "all 0.15s" }}
                >
                  {shotInFairway ? "✓ In Fairway  (+ACC)" : "In Fairway?"}
                </button>
              </div>
            </div>

            {/* Round GPS gains so far */}
            {(liveAttrGains.PWR > 0 || liveAttrGains.ACC > 0) && (
              <div style={{ background: "#f0fdf4", border: "1px solid #dcfce7", borderRadius: 8, padding: "6px 12px", marginBottom: 12, display: "flex", gap: 12, alignItems: "center" }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: "#15803d", letterSpacing: 1 }}>THIS ROUND</div>
                {liveAttrGains.PWR > 0 && <div style={{ fontSize: 11, fontWeight: 700, color: "#15803d" }}>+{liveAttrGains.PWR.toFixed(1)} PWR</div>}
                {liveAttrGains.ACC > 0 && <div style={{ fontSize: 11, fontWeight: 700, color: "#15803d" }}>+{liveAttrGains.ACC.toFixed(1)} ACC</div>}
              </div>
            )}

            {/* Club list */}
            {(() => {
              const clubOrder = ["Driver","3W","4W","5W","7W","2h","3h","4h","2i","3i","4i","5i","6i","7i","8i","9i","PW","AW","GW","SW","LW","48°","50°","52°","54°","56°","58°","60°","Putter"];
              const sorted = [...(profile.bag || [])].map((item, origIdx) => ({ ...item, origIdx })).sort((a, b) => {
                const ai = clubOrder.indexOf(a.club), bi = clubOrder.indexOf(b.club);
                return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
              });
              if (sorted.length === 0) return <div style={{ textAlign: "center", color: "#9ca3af", fontSize: 13, padding: "12px 0" }}>Add clubs in My Bag first</div>;
              return (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {sorted.map(item => {
                    const prevAvg = parseFloat(item.distance) || 0;
                    const count = item.trackedCount || 0;
                    const newAvg = (count === 0 || prevAvg === 0) ? pendingShotYards : Math.round((prevAvg * count + pendingShotYards) / (count + 1));
                    const delta = prevAvg ? newAvg - prevAvg : null;
                    return (
                      <button key={item.origIdx} onClick={() => updateClubAverage(item.origIdx, pendingShotYards)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", background: "#f9fafb", border: "1.5px solid #e5e7eb", borderRadius: 12, cursor: "pointer", textAlign: "left" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <div>
                            <div style={{ fontSize: 15, fontWeight: 900, color: "#111827" }}>{item.club}</div>
                            <div style={{ fontSize: 11, color: "#9ca3af" }}>
                              {prevAvg ? `${prevAvg} yds avg · ${count} tracked` : "No avg yet"}
                            </div>
                          </div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: 18, fontWeight: 900, fontFamily: "Bebas Neue", color: "#059669" }}>{newAvg} yds</div>
                          {delta !== null && (
                            <div style={{ fontSize: 10, fontWeight: 700, color: delta >= 0 ? "#059669" : "#dc2626" }}>
                              {delta >= 0 ? "+" : ""}{delta} new avg
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              );
            })()}

            <button onClick={() => {
              // Roll back the stroke that was pre-incremented on FOUND BALL tap
              setLiveStrokesArr(a => { const n = [...a]; if (liveRound && n[liveRound.currentHole] > 0) n[liveRound.currentHole]--; return n; });
              setLiveRound(r => { if (!r) return r; const sc = [...r.scores]; if ((sc[r.currentHole] ?? 0) > 0) sc[r.currentHole]--; const next = { ...r, scores: sc }; if (authUser && !roundSubmittedRef.current) setDoc(doc(db, "users", authUser.uid), { liveRound: next }, { merge: true }).catch(() => {}); return next; });
              setPendingShotEndPos(null);
              setPendingShotYards(null);
            }} style={{ width: "100%", marginTop: 14, padding: "12px 0", background: "#f3f4f6", border: "none", borderRadius: 10, color: "#6b7280", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              Discard
            </button>
          </div>
        </div>
      )}

      {/* ── ATTR TOAST ── */}
      {attrToast && (
        <div style={{ position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)", zIndex: 500, background: "#111827", borderRadius: 12, padding: "10px 18px", display: "flex", alignItems: "center", gap: 10, boxShadow: "0 4px 20px rgba(0,0,0,0.35)", pointerEvents: "none", whiteSpace: "nowrap" }}>
          <span style={{ fontSize: 16 }}>⚡</span>
          <span style={{ fontSize: 13, fontWeight: 800, color: "#a3e635", letterSpacing: 0.5 }}>{attrToast}</span>
        </div>
      )}

      {/* ── CREATE COURSE MODAL ── */}
      {showCreateCourse && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "#f4f5f7", overflowY: "auto" }}>
          <div style={{ maxWidth: 430, margin: "0 auto", width: "100%", paddingBottom: 100 }}>
            {/* Header */}
            <div style={{ padding: "16px 16px 0", display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <button onClick={() => setShowCreateCourse(false)} style={{ background: "none", border: "1px solid #e5e7eb", borderRadius: 8, padding: "6px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer", color: "#374151" }}>← Back</button>
              <div style={{ fontSize: 24, fontFamily: "Bebas Neue", letterSpacing: 2 }}>NEW COURSE</div>
            </div>
            {/* Info banner */}
            <div style={{ margin: "0 16px 14px", background: "#fef3c7", border: "1px solid #fde68a", borderRadius: 10, padding: "10px 12px", display: "flex", gap: 8, alignItems: "flex-start" }}>
              <span style={{ fontSize: 15, flexShrink: 0 }}>⭐</span>
              <div style={{ fontSize: 11, color: "#92400e", lineHeight: 1.5 }}>
                Saved as <strong>Community</strong> until 5 players confirm GPS coordinates match. Your hole positions are captured silently each time you advance.
              </div>
            </div>
            {/* Course name + location */}
            <div style={{ margin: "0 16px 12px", background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", padding: "14px" }}>
              <div style={{ ...S.fLabel, marginBottom: 6 }}>COURSE NAME *</div>
              <input value={newCourseForm.courseName} onChange={e => setNewCourseForm(f => ({ ...f, courseName: e.target.value }))} placeholder="e.g. Brown Deer Park Golf Course" style={{ ...S.fInput, marginBottom: 12 }} />
              <div style={{ ...S.fLabel, marginBottom: 6 }}>LOCATION (CITY, STATE)</div>
              <input value={newCourseForm.location} onChange={e => setNewCourseForm(f => ({ ...f, location: e.target.value }))} placeholder="e.g. Milwaukee, WI" style={S.fInput} />
            </div>
            {/* Tee color + rating + slope */}
            <div style={{ margin: "0 16px 12px", background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", padding: "14px" }}>
              <div style={{ ...S.fLabel, marginBottom: 6 }}>TEE COLOR</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
                {[{ label: "Black", dot: "#111827", dotOpacity: 0.8 }, { label: "Blue", dot: "#3b82f6", dotOpacity: 0.8 }, { label: "White", dot: "#e5e7eb", border: "#9ca3af" }, { label: "Gold", dot: "#f59e0b", dotOpacity: 0.8 }, { label: "Red", dot: "#ef4444" }].map(t => {
                  const active = newCourseForm.teeColor === t.label;
                  return (
                    <button key={t.label} onClick={() => setNewCourseForm(f => ({ ...f, teeColor: t.label }))} style={{ display: "flex", alignItems: "center", gap: 4, padding: "6px 10px", borderRadius: 7, border: active ? `2px solid ${t.border || t.dot}` : "1px solid #e5e7eb", background: active ? "#f9fafb" : "#fff", cursor: "pointer", fontWeight: 700, fontSize: 11, color: Theme.textMain }}>
                      <div style={{ width: 9, height: 9, borderRadius: "50%", background: t.dot, border: t.border ? `1px solid ${t.border}` : "none", opacity: t.dotOpacity ?? 1 }} />
                      {t.label}
                    </button>
                  );
                })}
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ ...S.fLabel, marginBottom: 4 }}>COURSE RATING *</div>
                  <input value={newCourseForm.rating} onChange={e => setNewCourseForm(f => ({ ...f, rating: e.target.value }))} placeholder="72.4" style={S.fInput} type="number" step="0.1" />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ ...S.fLabel, marginBottom: 4 }}>SLOPE *</div>
                  <input value={newCourseForm.slope} onChange={e => setNewCourseForm(f => ({ ...f, slope: e.target.value }))} placeholder="128" style={S.fInput} type="number" />
                </div>
              </div>
            </div>
            {/* Holes + par grid */}
            <div style={{ margin: "0 16px 12px", background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", padding: "14px" }}>
              <div style={{ ...S.fLabel, marginBottom: 8 }}>HOLES PLAYED</div>
              <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
                {["9", "18"].map(h => (
                  <button key={h} onClick={() => setNewCourseForm(f => ({ ...f, holes: h }))} style={{ flex: 1, padding: "9px 0", background: newCourseForm.holes === h ? ACCENT : "#f9fafb", border: newCourseForm.holes === h ? `1.5px solid ${ACCENT}` : "1px solid #e5e7eb", borderRadius: 7, color: newCourseForm.holes === h ? "#fff" : "#9ca3af", fontSize: 11, fontWeight: 800, letterSpacing: 1, cursor: "pointer" }}>
                    {h} HOLES
                  </button>
                ))}
              </div>
              <div style={{ ...S.fLabel, marginBottom: 8 }}>HOLE PARS — TAP TO CYCLE 3→4→5</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(9, 1fr)", gap: 4 }}>
                {Array.from({ length: parseInt(newCourseForm.holes) }, (_, i) => {
                  const par = newCourseForm.holePars[i];
                  const bg = par === 3 ? "#dbeafe" : par === 5 ? "#fef9c3" : "#f0fdf4";
                  const border = par === 3 ? "#93c5fd" : par === 5 ? "#fef08a" : "#86efac";
                  return (
                    <button key={i} onClick={() => setNewCourseForm(f => { const p = [...f.holePars]; p[i] = p[i] === 5 ? 3 : p[i] + 1; return { ...f, holePars: p }; })} style={{ padding: "5px 0", borderRadius: 6, background: bg, border: `1px solid ${border}`, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
                      <div style={{ fontSize: 7, color: "#9ca3af", fontWeight: 700 }}>H{i + 1}</div>
                      <div style={{ fontSize: 13, fontWeight: 900, color: "#111827", lineHeight: 1 }}>{par}</div>
                    </button>
                  );
                })}
              </div>
            </div>
            {/* Yardages (optional) */}
            <div style={{ margin: "0 16px 16px", background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", padding: "14px" }}>
              <div style={{ ...S.fLabel, marginBottom: 2 }}>YARDAGES PER HOLE (OPTIONAL)</div>
              <div style={{ fontSize: 10, color: "#9ca3af", marginBottom: 10 }}>Helps GPS club recommendations. You can leave these blank.</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
                {Array.from({ length: parseInt(newCourseForm.holes) }, (_, i) => (
                  <div key={i}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: "#9ca3af", marginBottom: 2, letterSpacing: 0.5 }}>H{i + 1} · P{newCourseForm.holePars[i]}</div>
                    <input value={newCourseForm.holeYards[i]} onChange={e => setNewCourseForm(f => { const y = [...f.holeYards]; y[i] = e.target.value; return { ...f, holeYards: y }; })} placeholder="yds" type="number" style={{ ...S.fInput, fontSize: 12, padding: "7px 8px" }} />
                  </div>
                ))}
              </div>
            </div>
            {/* Submit */}
            <div style={{ padding: "0 16px" }}>
              {(!newCourseForm.courseName.trim() || !newCourseForm.rating || !newCourseForm.slope) && (
                <div style={{ fontSize: 11, color: "#9ca3af", textAlign: "center", marginBottom: 8 }}>Course name, rating, and slope are required.</div>
              )}
              <button onClick={handleCreateCourse} disabled={!newCourseForm.courseName.trim() || !newCourseForm.rating || !newCourseForm.slope} style={{ width: "100%", padding: "16px 0", background: (newCourseForm.courseName.trim() && newCourseForm.rating && newCourseForm.slope) ? ACCENT : "#e5e7eb", border: "none", borderRadius: 12, color: (newCourseForm.courseName.trim() && newCourseForm.rating && newCourseForm.slope) ? "#fff" : "#9ca3af", fontSize: 16, fontWeight: 900, letterSpacing: 2, cursor: (newCourseForm.courseName.trim() && newCourseForm.rating && newCourseForm.slope) ? "pointer" : "default", fontFamily: "Bebas Neue", boxShadow: (newCourseForm.courseName.trim() && newCourseForm.rating && newCourseForm.slope) ? "0 4px 14px rgba(34,197,94,0.3)" : "none" }}>
                CREATE &amp; START ROUND
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── BOTTOM NAV — hidden during live round ── */}
      <nav className="bottom-nav" style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "#fff", borderTop: "1px solid #e5e7eb", display: (tab === "profile" && liveRound) ? "none" : "flex", zIndex: 100 }}>
        {[
          { id: "profile", label: "Profile", icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg> },
          { id: "leaderboard", label: "Rankings", icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="18" y="3" width="4" height="18" rx="1"/><rect x="10" y="8" width="4" height="13" rx="1"/><rect x="2" y="13" width="4" height="8" rx="1"/></svg> },
          { id: "challenges", label: "Challenges", icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg> },
          { id: "bag", label: "Bag", icon: (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              {/* Club shafts fanning out */}
              <line x1="10" y1="8" x2="6" y2="1"/>
              <line x1="12" y1="8" x2="12" y2="1"/>
              <line x1="14" y1="8" x2="18" y2="1"/>
              {/* Collar separating shafts from body */}
              <line x1="8" y1="8" x2="16" y2="8"/>
              {/* Bag body — tall and narrow */}
              <path d="M9 8 L9 21 Q9 23 12 23 Q15 23 15 21 L15 8 Z"/>
              {/* Shoulder strap */}
              <path d="M15 10 Q20 14 19 21"/>
            </svg>
          ) },
          { id: "shop", label: "Shop", icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 001.99 1.61h9.72a2 2 0 001.99-1.61L23 6H6"/></svg> },
        ].map(({ id, label, icon, badge }) => (
          <button key={id} onClick={() => { setTab(id); setFlash(null); setBadgeFlash(null); }} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "10px 0 12px", border: "none", background: "transparent", color: tab === id ? Theme.primaryGreen : "#374151", cursor: "pointer", position: "relative", transition: "color 0.15s" }}>
            {icon}
            <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: 0.5, marginTop: 3 }}>{label}</span>
            {badge && <div style={{ position: "absolute", top: 6, right: "calc(50% - 16px)", width: 16, height: 16, borderRadius: "50%", background: "#ef4444", color: "#fff", fontSize: 9, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{badge}</div>}
          </button>
        ))}
      </nav>
    </div>
  );
}

