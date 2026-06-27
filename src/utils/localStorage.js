export function _pinKey(courseName, holeIdx) {
  return `pins_${(courseName || "unknown").replace(/\W+/g, "_").toLowerCase()}_h${holeIdx}`;
}

export function savePinLayout(courseName, holeIdx, teePin, flagPin) {
  if (!teePin && !flagPin) return;
  try { localStorage.setItem(_pinKey(courseName, holeIdx), JSON.stringify({ teePin: teePin || null, flagPin: flagPin || null })); } catch {}
}

export function loadPinLayout(courseName, holeIdx) {
  try { const d = localStorage.getItem(_pinKey(courseName, holeIdx)); return d ? JSON.parse(d) : null; } catch { return null; }
}

// ─── Community Pin Cloud (global_course_pins) ────────────────────────────────
// Doc ID: "{courseKey}_h{1-indexed hole}"
// Fields: courseKey, holeNumber, count, teeLat, teeLng, flagLat, flagLng

export function communityPinCourseKey(round) {
  return round?.apiCourseId
    ? String(round.apiCourseId)
    : (round?.course || "unknown").replace(/\W+/g, "_").toLowerCase();
}

export function saveProfilePic(pic) { try { if (pic) localStorage.setItem("club99_pic", pic); else localStorage.removeItem("club99_pic"); } catch {} }

export function loadProfilePic() { try { return localStorage.getItem("club99_pic") || null; } catch { return null; } }
