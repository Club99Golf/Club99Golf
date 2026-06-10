const GCAPI_BASE = "https://api.golfcourseapi.com/v1";

export async function searchGolfCourseAPI(query) {
  const GCAPI_KEY = process.env.REACT_APP_GOLF_COURSE_API_KEY || "";
  if (!GCAPI_KEY || query.length < 2) return [];

  try {
    const res = await fetch(
      `${GCAPI_BASE}/search?search_query=${encodeURIComponent(query)}`,
      { headers: { Authorization: `Key ${GCAPI_KEY}` } }
    );

    if (!res.ok) return [];
    const data = await res.json();
    return data.courses || [];
  } catch {
    return [];
  }
}

export async function fetchGolfCourseAPIById(courseId) {
  const GCAPI_KEY = process.env.REACT_APP_GOLF_COURSE_API_KEY || "";
  const cacheKey = `gcapi_${courseId}`;
  const cached = localStorage.getItem(cacheKey);

  if (cached) {
    try {
      return JSON.parse(cached);
    } catch {}
  }

  try {
    const res = await fetch(`${GCAPI_BASE}/courses/${courseId}`, {
      headers: { Authorization: `Key ${GCAPI_KEY}` },
    });

    if (!res.ok) return null;

    const data = await res.json();
    const course = data.course || null;

    if (course) localStorage.setItem(cacheKey, JSON.stringify(course));
    return course;
  } catch {
    return null;
  }
}

export function extractApiTeeData(apiCourse, teeName) {
  const male = apiCourse?.tees?.male || [];
  const female = apiCourse?.tees?.female || [];
  const all = [...male, ...female];

  const find = name =>
    all.find(t => t.tee_name.toLowerCase() === name.toLowerCase());

  const tee = find(teeName) || find("White") || find("Blue") || male[0] || female[0];

  if (!tee) return null;

  return {
    tee_name: tee.tee_name,
    rating: tee.course_rating,
    slope: tee.slope_rating,
    par: tee.par_total,
    holePars: tee.holes.map(h => h.par),
  };
}

export function apiCourseTeeNames(apiCourse) {
  const male = (apiCourse?.tees?.male || []).map(t => t.tee_name);
  const female = (apiCourse?.tees?.female || []).map(t => t.tee_name);
  return [...new Set([...male, ...female])];
}