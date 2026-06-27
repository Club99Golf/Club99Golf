export const GCAPI_KEY = process.env.REACT_APP_GOLF_COURSE_API_KEY || "";
export const GCAPI_BASE = "https://api.golfcourseapi.com/v1";
export const GCAPI_HDRS = { Authorization: `Key ${GCAPI_KEY}` };

export async function searchGolfCourseAPI(query) {
  if (!GCAPI_KEY || query.length < 2) return [];
  try {
    const res = await fetch(`${GCAPI_BASE}/search?search_query=${encodeURIComponent(query)}`, { headers: GCAPI_HDRS });
    if (!res.ok) return [];
    const data = await res.json();
    return data.courses || [];
  } catch { return []; }
}

/** Fetch full course detail by numeric ID — localStorage cached */

export async function fetchGolfCourseAPIById(courseId) {
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

export function extractApiTeeData(apiCourse, teeName) {
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

export function apiCourseTeeNames(apiCourse) {
  const male   = (apiCourse?.tees?.male   || []).map(t => t.tee_name);
  const female = (apiCourse?.tees?.female || []).map(t => t.tee_name);
  return [...new Set([...male, ...female])];
}
