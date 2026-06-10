export function hapticTap() { try { navigator.vibrate && navigator.vibrate(10); } catch (_) {} }

// Stable unique ID generator for Mapbox Source/Layer pairs

export function mkId(prefix) { return `${prefix}-${++_mlId}`; }

// GeoJSON polygon approximating a geographic circle around center {lat,lng} with radiusYards

export function geoJSONCircle(center, radiusYards, steps = 64) {
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

export function haversineYards(lat1, lng1, lat2, lng2) {
  const R = 6371000; // Earth radius metres
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const metres = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(metres * 1.09361);
}

// Compass bearing in degrees (0=N, 90=E) from point 1 → point 2

export function bearingDeg(lat1, lng1, lat2, lng2) {
  const toRad = d => d * Math.PI / 180;
  const dLng = toRad(lng2 - lng1);
  const y = Math.sin(dLng) * Math.cos(toRad(lat2));
  const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) - Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLng);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

// Returns signed headwind component in mph.
// Positive = headwind (play longer), negative = tailwind (play shorter).
// windDeg: meteorological direction wind comes FROM (e.g. 270 = west wind, blowing east).

export function calculateWindEffect(plat, plng, glat, glng, windSpeed, windDeg) {
  if (!windSpeed || windSpeed <= 0) return 0;
  const ballBearing = bearingDeg(plat, plng, glat, glng);
  const windGoingTo = (windDeg + 180) % 360; // direction wind travels toward
  const angleDiff = (windGoingTo - ballBearing) * Math.PI / 180;
  return windSpeed * Math.cos(angleDiff); // +headwind / −tailwind
}

// Moves a lat/lng point a given number of yards along a compass bearing.

export function offsetLatLng(lat, lng, bearing, yards) {
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

export function _isWaterAtPoint(map, pos) {
  try {
    const pt = map.project([pos.lng, pos.lat]);
    const bbox = [[pt.x - 2, pt.y - 2], [pt.x + 2, pt.y + 2]];

    // Prefer querying our injected invisible layers (most reliable under satellite)
    const HZ_LAYERS = ['_hz-water', '_hz-landuse', '_hz-natural'];
    const availableLayers = HZ_LAYERS.filter(id => { try { return !!map.getLayer(id); } catch (_) { return false; } });
    const features = availableLayers.length > 0
      ? map.queryRenderedFeatures(bbox, { layers: availableLayers })
      : map.queryRenderedFeatures(bbox);

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

export function adjustLandingZoneForHazards(map, playerPos, bearing, originalDist, sortedBagClubs, colorFn) {
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

export function computeGreenPoints(greenCenter, playerPos, depthYards = 15) {
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

export function getPlaysLikeDistance(actualDistance, headwindMph, holeElevFt, tempF) {
  if (actualDistance == null || actualDistance <= 0) return actualDistance;
  const windAdj = headwindMph > 0 ? Math.round(headwindMph) : Math.round(headwindMph * 0.5);
  const elevAdj = Math.round((holeElevFt || 0) / 3);
  const tempAdj = (tempF != null && tempF < 70) ? Math.round((70 - tempF) / 10 * 2) : 0;
  return Math.max(10, Math.round(actualDistance + windAdj + elevAdj + tempAdj));
}

// Map compass degrees → arrow character for display (8-point rose)

export function degToArrow(deg) {
  const dirs = ["↑","↗","→","↘","↓","↙","←","↖"];
  return dirs[Math.round(((deg % 360) + 360) % 360 / 45) % 8];
}

// ── PRO CADDIE: Stock bag yardages & club suggestion ──
