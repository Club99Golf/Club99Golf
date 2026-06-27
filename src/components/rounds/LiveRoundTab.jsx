export default function LiveRoundTab(props) {
  const { ACCENT, COURSE_DB, COURSE_MAP_CENTERS, DEFAULT_BAG, MAPBOX_TOKEN, Map, Marker, Theme, _isWaterAtPoint, abandonLiveRound, authUser, bearingDeg, calculateWindEffect, communityPinCount, communityPinCourseKey, communityPinSource, computeGreenPoints, computeStats, confirmDeleteRound, db, degToArrow, deleteRound, doc, flagPin, getPlaysLikeDistance, gpsPermissionDenied, hapticTap, haversineYards, lastPlayerPosRef, liveFairwaysArr, livePuttsArr, liveRound, liveStrokesArr, liveWeather, mapRef, mapTilesLoading, mapUserPannedRef, offsetLatLng, parPickerHole, pendingFitBoundsRef, placingMode, playerPos, playerSpeed, profile, pushPinVote, recTicker, roundSaving, roundSubmittedRef, savePinLayout, scorePickerHole, setAttrToast, setCommunityPinCount, setCommunityPinSource, setConfirmDeleteRound, setDoc, setFlagPin, setGpsPermissionDenied, setLiveFairwaysArr, setLivePuttsArr, setLiveRound, setLiveStrokesArr, setMapTilesLoading, setMapUserPanned, setMapZoom, setParPickerHole, setPendingShotEndPos, setPendingShotYards, setPlacingMode, setPlayerPos, setScorePickerHole, setShotHistoryArr, setShotInFairway, setShotStartPos, setShowScorecard, setTargetPin, setTeePin, setTeePinManual, setViewingRound, shotHistoryArr, showScorecard, submitLiveRound, suggestClub, tab, targetPin, teePin, updateLivePar, updateLiveScore, viewingRound } = props;
  if (!liveRound) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100vh", background: Theme.backgroundBlack, color: Theme.offWhite }}>
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={Theme.primaryGreen} strokeWidth="2" strokeLinecap="round" style={{ animation: "spin 1s linear infinite", marginBottom: 16 }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
      <span style={{ fontSize: 13, color: "rgba(255,255,255,0.45)" }}>Loading round...</span>
    </div>
  );
  return (
    <>
{(() => {
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
        // Safe map fallback:
        // Prefer user/course pins, then known course geometry, then live GPS.
        // This prevents Live Round from mounting into an unstable no-center state
        // when GPS is denied/unavailable or pins have not been placed yet.
        const courseFallbackCenter =
          holeGeo?.green?.center ||
          holeGeo?.green?.front ||
          holeGeo?.green?.back ||
          holeGeo?.tee ||
          liveRound?.apiCourseLocation ||
          COURSE_MAP_CENTERS[course] ||
          // Setup fallback: for a brand-new/unplayed course with no saved pins yet,
          // use the player's current GPS position so the map still opens and the user can drop tee/flag pins.
          effectivePlayerPos ||
          null;
        // Privacy-safe map center:
        // Do NOT fall back to raw user GPS as the default map center.
        // If course/pin geometry is missing, show the fallback/recovery UI instead
        // of exposing the user's current location on the map.
        const mapCenter = pinCenter || courseFallbackCenter || null;
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

        // Show the player marker only when the player is actually near the course/hole.
        // Exception: if the course has no API center, no saved pins, and no known geometry,
        // allow GPS as a setup fallback so a player physically at the course can drop pins.
        const usingGpsSetupFallback =
          !!effectivePlayerPos &&
          !pinCenter &&
          !holeGeo?.green?.center &&
          !holeGeo?.green?.front &&
          !holeGeo?.green?.back &&
          !holeGeo?.tee &&
          !liveRound?.apiCourseLocation &&
          !COURSE_MAP_CENTERS[course];

        const showPlayerMarker = !!effectivePlayerPos && (onCourse || usingGpsSetupFallback);

        // On course: live GPS-to-flag. Off course: static tee-to-flag (or GPS if no tee).
        let pinYards = effectiveFlag
          ? (onCourse && effectivePlayerPos
              ? haversineYards(effectivePlayerPos.lat, effectivePlayerPos.lng, effectiveFlag.lat, effectiveFlag.lng)
              : effectiveTee
                ? haversineYards(effectiveTee.lat, effectiveTee.lng, effectiveFlag.lat, effectiveFlag.lng)
                : null)
          : null;

        // Sanity guard: do not display absurd GPS/map distances.
        // If tee/flag/course data is incomplete or mismatched, fail gracefully instead.
        if (pinYards != null && (!Number.isFinite(pinYards) || pinYards < 0 || pinYards > 1000)) {
          pinYards = null;
        }

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
                    dragPan={true}
                    scrollZoom={true}
                    doubleClickZoom={true}
                    keyboard={true}
                    pitchWithRotate={false}
                    dragRotate={false}
                    touchPitch={false}
                    onZoom={e => setMapZoom(e.viewState.zoom)}
                    onDragStart={() => { mapUserPannedRef.current = true; setMapUserPanned(true); }}
                    onZoomStart={e => { if (e.originalEvent) { mapUserPannedRef.current = true; setMapUserPanned(true); } }}
                    onMoveStart={e => { if (e.originalEvent) { mapUserPannedRef.current = true; setMapUserPanned(true); } }}
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
                        // Disabled during Phase 1: Mapbox 3D terrain was causing pointCoordinate3D/unproject runtime crashes.
                        // map.setTerrain({ source: "mapbox-dem", exaggeration: 1.5 });
                      } catch (_) {}

                      // Inject invisible fill layers so water/landuse/natural are always
                      // queryable under satellite imagery (queryRenderedFeatures skips
                      // layers that aren't in the render tree, even if data exists).
                      try {
                        [
                          { id: '_hz-water',   sourceLayer: 'water'   },
                          { id: '_hz-landuse', sourceLayer: 'landuse' },
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
                        const fromPos = onCourse ? effectivePlayerPos : effectiveTee;
                        let targetDist = fromPos
                          ? Math.round(haversineYards(fromPos.lat, fromPos.lng, targetPin.lat, targetPin.lng))
                          : null;
                        if (targetDist != null && (!Number.isFinite(targetDist) || targetDist < 0 || targetDist > 1000)) targetDist = null;
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
                                  <span style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.55)", whiteSpace: "nowrap" }}>Set target distance</span>
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
                      {showPlayerMarker && (
                        <Marker longitude={effectivePlayerPos.lng} latitude={effectivePlayerPos.lat} anchor="center" pitchAlignment="viewport" rotationAlignment="viewport" style={{ pointerEvents: placingMode ? "none" : "auto" }}>
                          <div style={{ position: "relative", width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <div className="stroke-marker-halo" style={{ position: "absolute", width: 24, height: 24, borderRadius: "50%", background: "rgba(125,162,126,0.15)", border: "1px solid rgba(125,162,126,0.85)" }} />
                            <div style={{ width: 14, height: 14, borderRadius: "50%", background: Theme.primaryGreen, border: "2px solid #fff", boxShadow: "0 0 8px rgba(125,162,126,0.7)", zIndex: 1 }} />
                          </div>
                        </Marker>
                      )}
                      {/* Course green markers — hidden when a manual flag is placed */}
                      {!flagPin && greenFront  && <Marker longitude={greenFront.lng}  latitude={greenFront.lat}  anchor="bottom" pitchAlignment="viewport" rotationAlignment="viewport" style={{ pointerEvents: placingMode ? "none" : "auto" }}><div style={{ width: 10, height: 10, borderRadius: "50%", background: "#16a34a", border: "2px solid #052e16", boxShadow: "0 0 6px rgba(0,0,0,0.7)" }} /></Marker>}
                      {!flagPin && greenCenter && <Marker longitude={greenCenter.lng} latitude={greenCenter.lat} anchor="bottom" pitchAlignment="viewport" rotationAlignment="viewport" style={{ pointerEvents: placingMode ? "none" : "auto" }}><div style={{ width: 13, height: 13, borderRadius: "50%", background: "#15803d", border: "2px solid #052e16", boxShadow: "0 0 8px rgba(0,0,0,0.7)" }} /></Marker>}
                      {!flagPin && greenBack   && <Marker longitude={greenBack.lng}   latitude={greenBack.lat}   anchor="bottom" pitchAlignment="viewport" rotationAlignment="viewport" style={{ pointerEvents: placingMode ? "none" : "auto" }}><div style={{ width: 10, height: 10, borderRadius: "50%", background: "#166534", border: "2px solid #052e16", boxShadow: "0 0 6px rgba(0,0,0,0.7)" }} /></Marker>}
                      {/* Manual Tee Pin — only shown when user explicitly dropped it */}
                      {teePin && (
                        <Marker key="tee-marker" longitude={teePin.lng} latitude={teePin.lat} anchor="bottom" pitchAlignment="viewport" rotationAlignment="viewport" style={{ pointerEvents: "none" }}>
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
                        <Marker key="flag-marker" longitude={flagPin.lng} latitude={flagPin.lat} anchor="bottom" pitchAlignment="viewport" rotationAlignment="viewport" style={{ pointerEvents: "none" }}>
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
                          <Marker key={`hz-${hi}-${pi}`} longitude={pt.lng} latitude={pt.lat} anchor="center" pitchAlignment="viewport" rotationAlignment="viewport" style={{ pointerEvents: "none" }}>
                            <div style={{ width: 12, height: 12, borderRadius: "50%", background: hz.type === "water" ? "#2563eb" : hz.type === "ob" ? "#dc2626" : "#ca8a04", border: "1.5px solid #000", boxShadow: "0 0 4px rgba(0,0,0,0.6)" }} />
                          </Marker>
                        ))
                      )}

                      {/* ── Previous round shot dots (faded) — hidden once current round has shots on this hole ── */}
                      {(shotHistoryArr[currentHole] || []).length === 0 && (profile.courseShots?.[liveRound?.course]?.holes?.[currentHole] || []).map((shot, si) => (
                        <Marker key={`prev-shot-${si}`} longitude={shot.lng} latitude={shot.lat} anchor="bottom" pitchAlignment="viewport" rotationAlignment="viewport" style={{ pointerEvents: "none" }}>
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                            <div style={{ background: "rgba(0,0,0,0.5)", borderRadius: 5, padding: "1px 5px", border: "1px solid rgba(156,163,175,0.35)" }}>
                              <span style={{ fontSize: 9, fontFamily: "Bebas Neue", color: "rgba(156,163,175,0.65)", letterSpacing: 0.5 }}>{shot.club}</span>
                            </div>
                            <div style={{ width: 9, height: 9, borderRadius: "50%", background: "rgba(156,163,175,0.45)", border: "2px solid rgba(255,255,255,0.3)", boxShadow: "0 0 4px rgba(0,0,0,0.4)" }} />
                          </div>
                        </Marker>
                      ))}

                      {/* ── Shot history dots (current round) — colored by shot number ── */}
                      {(shotHistoryArr[currentHole] || []).map((shot, si) => {
                        const isOB = shot.isOB;
                        const shotColors = ["#60a5fa","#fbbf24","#fb923c","#a78bfa","#34d399","#f87171"];
                        const dotColor = isOB ? "#ef4444" : shotColors[si % shotColors.length];
                        const borderColor = isOB ? "rgba(239,68,68,0.6)" : `${dotColor}88`;
                        return (
                          <Marker key={`shot-${si}`} longitude={shot.lng} latitude={shot.lat} anchor="bottom" pitchAlignment="viewport" rotationAlignment="viewport" style={{ pointerEvents: "none" }}>
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                              <div style={{ background: "rgba(0,0,0,0.72)", borderRadius: 5, padding: "1px 5px", border: `1px solid ${borderColor}` }}>
                                <span style={{ fontSize: 9, fontFamily: "Bebas Neue", color: dotColor, letterSpacing: 0.5 }}>#{si + 1}{shot.yards ? ` · ${shot.yards}y` : ""}</span>
                              </div>
                              <div style={{ width: 9, height: 9, borderRadius: "50%", background: dotColor, border: "2px solid #fff", boxShadow: "0 0 5px rgba(0,0,0,0.6)" }} />
                            </div>
                          </Marker>
                        );
                      })}
                    </Map>
                ) : (
                  <div style={{ height: "100%", background: "radial-gradient(circle at center, #111827 0%, #020617 65%)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, padding: 24, textAlign: "center" }}>
                    <div style={{ fontSize: 28 }}>{gpsPermissionDenied ? "🚫" : "📍"}</div>

                    <div style={{ fontSize: 18, color: Theme.primaryGreen, fontWeight: 900, letterSpacing: 2, fontFamily: "Bebas Neue" }}>
                      COURSE MAP SETUP NEEDED
                    </div>

                    <div style={{ maxWidth: 320, fontSize: 12, color: "rgba(255,255,255,0.72)", lineHeight: 1.45, fontFamily: "'DM Sans', sans-serif" }}>
                      This course or hole does not have saved tee/flag coordinates yet. Use the TEE and FLAG buttons on the left to place pins and map this hole. Saved and community-confirmed pins will load automatically next time.
                    </div>

                    {gpsPermissionDenied && (
                      <div style={{ maxWidth: 300, fontSize: 11, color: "rgba(239,68,68,0.8)", lineHeight: 1.4, fontFamily: "'DM Sans', sans-serif" }}>
                        GPS access is currently denied. The app will not use your private location as the default map center.
                      </div>
                    )}

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
                        style={{ marginTop: 10, padding: "9px 22px", background: Theme.primaryGreen, color: "#000", fontFamily: "Bebas Neue", fontSize: 13, letterSpacing: 2, border: "none", borderRadius: 8, cursor: "pointer" }}
                      >
                        REQUEST GPS
                      </button>
                    )}

                    <button
                      onClick={abandonLiveRound}
                      style={{ marginTop: 6, padding: "9px 22px", background: "transparent", color: "#ef4444", fontFamily: "Bebas Neue", fontSize: 13, letterSpacing: 2, border: "1px solid rgba(239,68,68,0.5)", borderRadius: 8, cursor: "pointer" }}
                    >
                      EXIT LIVE ROUND
                    </button>
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
            {!targetPin && !flagPin && !teePin && !placingMode && mapCenter && !mapTilesLoading && false && (
              <div style={{ position: "absolute", bottom: 118, left: "50%", transform: "translateX(-50%)", zIndex: 20, background: "rgba(0,0,0,0.78)", borderRadius: 20, padding: "8px 18px", border: "1px solid rgba(255,255,255,0.14)", backdropFilter: "blur(12px)", pointerEvents: "none", whiteSpace: "nowrap", animation: "fadeUp 0.5s ease" }}>
                <span style={{ fontSize: 11, fontFamily: "'Inter',sans-serif", fontWeight: 600, color: "rgba(255,255,255,0.82)", letterSpacing: 0.3 }}>
                  <span style={{ color: Theme.primaryGreen, fontWeight: 800 }}>Tap</span> to drop target · use buttons to place tee & flag
                </span>
              </div>
            )}

            {/* ══ COMMUNITY PINS BADGE ══ */}
            {communityPinSource && !placingMode && (
              <div style={{ position: "absolute", bottom: 118, left: "50%", transform: "translateX(-50%)", zIndex: 20, background: "rgba(26,26,26,0.88)", borderRadius: 20, padding: "5px 14px", border: `1px solid rgba(212,175,55,0.45)`, backdropFilter: "blur(12px)", pointerEvents: "none", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 6 }}>
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                  <circle cx="6" cy="6" r="5.5" stroke={Theme.mutedGold} strokeWidth="1.2"/>
                  <path d="M4 6l1.5 1.5L8.5 4" stroke={Theme.mutedGold} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span style={{ fontSize: 9, fontFamily: "Bebas Neue", color: Theme.mutedGold, letterSpacing: 1.5 }}>
                  PINS LOADED · {communityPinCount} {communityPinCount === 1 ? "GOLFER" : "GOLFERS"}
                </span>
              </div>
            )}

            {/* ══ LOCAL SAVED PINS BADGE ══ */}
            {!communityPinSource && !placingMode && (teePin || flagPin) && (
              <div style={{ position: "absolute", bottom: 118, left: "50%", transform: "translateX(-50%)", zIndex: 20, background: "rgba(17,24,39,0.88)", borderRadius: 20, padding: "5px 14px", border: "1px solid rgba(34,197,94,0.45)", backdropFilter: "blur(12px)", pointerEvents: "none", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 10 }}>💾</span>
                <span style={{ fontSize: 9, fontFamily: "Bebas Neue", color: Theme.primaryGreen, letterSpacing: 1.5 }}>
                  SAVED PINS LOADED
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
              <div style={{ position: "absolute", bottom: 64, left: "50%", transform: "translateX(-50%)", zIndex: 25, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                {(() => {
                  const currentShots = shotHistoryArr[currentHole] || [];
                  const lastNonOB = currentShots.filter(s => s.club !== "OB").slice(-1)[0];
                  const fromPos = lastNonOB || teePin;
                  const trackingPos = onCourse ? playerPos : targetPin;
                  const d = trackingPos
                    ? Math.round(haversineYards(fromPos.lat, fromPos.lng, trackingPos.lat, trackingPos.lng))
                    : null;
                  return <span style={{ fontSize: 9, fontFamily: "Bebas Neue", color: "rgba(255,255,255,0.5)", letterSpacing: 1.5 }}>{d}y {lastNonOB ? "from last shot" : "from tee"}</span>;
                })()}
                <div style={{ display: "flex", gap: 14, alignItems: "center", background: "rgba(0,0,0,0.35)", padding: "6px", borderRadius: 30, backdropFilter: "blur(10px)" }}>
                  <button
                    onClick={() => {
                      hapticTap();
                      const currentShots = shotHistoryArr[currentHole] || [];
                      const lastNonOB = currentShots.filter(s => s.club !== "OB").slice(-1)[0];
                      const fromPos = lastNonOB || teePin;
                      const yards = fromPos
                        ? Math.round(haversineYards(fromPos.lat, fromPos.lng, playerPos.lat, playerPos.lng))
                        : null;
                      // Drop a colored marker at current position and count the stroke — no club picker
                      setShotHistoryArr(arr => {
                        const n = [...arr];
                        if (!n[currentHole]) n[currentHole] = [];
                        n[currentHole] = [...n[currentHole], { lat: playerPos.lat, lng: playerPos.lng, club: "SHOT", yards: yards || 0 }];
                        return n;
                      });
                      setLiveStrokesArr(a => { const n = [...a]; n[currentHole] = (n[currentHole] ?? 0) + 1; return n; });
                      setLiveRound(r => { const sc = [...r.scores]; sc[currentHole] = (sc[currentHole] ?? 0) + 1; const next = { ...r, scores: sc }; if (authUser && !roundSubmittedRef.current) setDoc(doc(db, "users", authUser.uid), { liveRound: next }, { merge: true }).catch(() => {}); return next; });
                      setAttrToast(yards ? `SHOT · ${yards}y` : "SHOT TRACKED");
                      setTimeout(() => setAttrToast(null), 1500);
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
                    style={{ background: "rgba(220,38,38,0.15)", border: "1.5px solid rgba(220,38,38,0.4)", backdropFilter: "blur(12px)", borderRadius: 22, padding: "8px 16px", display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}
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
                  onClick={() => {
                          if (flagPin) {
                            setFlagPin(null);
                            setTargetPin(null);
                            setCommunityPinSource(false);
                          } else {
                            setPlacingMode("flag");
                          }
                        }}
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
    </>
  );
}
