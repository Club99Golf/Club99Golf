import { useState, useEffect, useRef } from "react";
import { Theme } from "./Theme";
import Map, { Marker } from "react-map-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  deleteUser,
  reauthenticateWithCredential,
  EmailAuthProvider,
} from "firebase/auth";
import {
  doc,
  setDoc,
  getDoc,
  collection,
  getDocs,
  query,
  where,
  limit,
  deleteDoc,
  addDoc,
  serverTimestamp,
  onSnapshot,
  updateDoc,
} from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { loadStripe } from "@stripe/stripe-js";
import "./styles/globals.css";
import "./styles/animations.css";
import "./styles/layout.css";
import { MAPBOX_TOKEN, OWM_API_KEY, DISABLE_STRIPE_PURCHASES, STRIPE_PK, COIN_PACKS, CHALLENGE_FORMATS } from "./config/constants";
import { firebaseApp, auth, db } from "./config/firebase";
import { COURSE_DB } from "./data/courses";
import { BLANK_PROFILE, ACHIEVEMENTS, getUnlockedBadges } from "./data/badges";
import { SHOP_ITEMS } from "./data/shopItems";
import { DEFAULT_BAG } from "./data/defaultBag";
import { searchGolfCourseAPI, fetchGolfCourseAPIById, extractApiTeeData, apiCourseTeeNames } from "./services/golfCourseApi";
import { saveProfileToFirestore, selfRepairProfile, repairAllUsersInFirestore, loadProfileFromFirestore } from "./services/profileService";
import { saveCourseToFirestore, uploadCourseToFirestore, searchCoursesInFirestore, fetchCommunityPins, pushPinVote } from "./services/courseService";
import { loadLeaderboard } from "./services/leaderboardService";
import { removeFriendInDb, searchUserByUsername, sendFriendRequest, respondToFriendRequest, loadFriends } from "./services/friendService";
import { createCrewInFirestore, requestJoinCrew, acceptCrewRequest, declineCrewRequest, leaveCrewInFirestore, fetchPublicCrews } from "./services/crewService";
import { loadReactions } from "./services/reactionService";
import { loadChallenges, joinChallengeInDb, deleteChallengeInDb, recordChallengeScore, submitChallengeReview, settleChallengeInDb } from "./services/challengeService";
import { hapticTap, haversineYards, bearingDeg, calculateWindEffect, offsetLatLng, _isWaterAtPoint, computeGreenPoints, getPlaysLikeDistance, degToArrow } from "./utils/mapMath";
import { getCourseData, getCourseHolePars, calcRoundOVR, calcOVRFromRounds, skillTier, suggestClub } from "./utils/golfScoring";
import { calcHandicapIndex } from "./utils/handicap";
import { levelFromXP, computeStats } from "./utils/xp";
import { sanitizeForFirestore, sanitizeBagDistances } from "./utils/firestoreUtils";
import { savePinLayout, loadPinLayout, communityPinCourseKey, saveProfilePic, loadProfilePic } from "./utils/localStorage";
import { compressImage } from "./utils/imageUtils";
import RadarChart from "./components/charts/RadarChart";
import BadgeIcon from "./components/common/BadgeIcon";
import ChallengeCard from "./components/challenges/ChallengeCard";
import MapPolyline from "./components/map/MapPolyline";
import MapCircle from "./components/map/MapCircle";

export default function GolfApp() {
  const [isMobileLayout, setIsMobileLayout] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth <= 700 : false
  );

  useEffect(() => {
    const updateMobileLayout = () => setIsMobileLayout(window.innerWidth <= 700);
    updateMobileLayout();
    window.addEventListener("resize", updateMobileLayout);
    return () => window.removeEventListener("resize", updateMobileLayout);
  }, []);

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
              if (holeRef && distToHole <= 500) {
                // Only follow live GPS after we know the player is near the selected hole/course.
                mapRef.current?.flyTo({ center: [lng, lat], zoom: 18, animate: false });
              } else if (holeRef) {
                // Player is far from the hole — keep map focused on the hole, not the user's private location.
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

  // ── MAP LOADING RECOVERY — don't let Live Round stay trapped behind loading overlay ──
  useEffect(() => {
    if (!liveRound) return;
    const id = setTimeout(() => {
      setMapTilesLoading(false);
    }, 8000);
    return () => clearTimeout(id);
  }, [!!liveRound, liveRound?.currentHole]);

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
  // Important: do NOT run this effect just because currentHole changes.
  // Otherwise old hole pins can be saved under the next hole before auto-load clears/loads pins.
  useEffect(() => {
    if (!liveRound || !teePin || !flagPin) return;
    const absHole = liveRound.currentHole + (liveRound.holeOffset || 0);
    savePinLayout(liveRound.course, absHole, teePin, flagPin);
  }, [teePin, flagPin, liveRound?.course]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── PIN AUTO-LOAD — restore saved pins; fall back to community average ──
  // pendingFitBoundsRef is read by the Map's onLoad handler to fitBounds after tile load.
  useEffect(() => {
    if (!liveRound) return;
    setCommunityPinSource(false);
    setCommunityPinCount(0);
    pendingFitBoundsRef.current = null;

    const absHole = liveRound.currentHole + (liveRound.holeOffset || 0);
    const saved = loadPinLayout(liveRound.course, absHole);

    // Always reset pins for the newly selected hole first.
    // If this hole has no saved pins, it should show empty setup state — not stale pins from the previous hole.
    setTargetPin(null);
    setTeePinManual(false);
    setTeePin(saved?.teePin || null);
    setFlagPin(saved?.flagPin || null);

    // Async community fetch — fills any missing tee/flag pins
    const courseKey = communityPinCourseKey(liveRound);
    const holeIdx   = absHole;
    fetchCommunityPins(courseKey, holeIdx).then(community => {
      const activeRound = liveRoundRef.current;
      const activeAbsHole = activeRound ? activeRound.currentHole + (activeRound.holeOffset || 0) : null;

      // Prevent late async community data from a previous hole from overwriting the active hole.
      if (activeAbsHole !== holeIdx) return;
      if (!community) return;

      setCommunityPinCount(community.count);
      let fromCommunity = false;
      if (!saved?.teePin && community.teePin) { setTeePin(community.teePin); fromCommunity = true; }
      if (!saved?.flagPin && community.flagPin) { setFlagPin(community.flagPin); fromCommunity = true; }
      if (fromCommunity) setCommunityPinSource(true);
    });
  }, [liveRound?.course, liveRound?.currentHole]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── RESET MAP MANUAL-PAN LOCK ON HOLE CHANGE ──
  // Each new hole should re-orient tee→flag automatically.
  useEffect(() => {
    if (!liveRound) return;
    mapUserPannedRef.current = false;
    setMapUserPanned(false);
  }, [liveRound?.course, liveRound?.currentHole]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── AUTO-BEARING — rotate map so the flag is always at the top ──
  // Uses tee→flag bearing so orientation is stable regardless of player position.
  useEffect(() => {
    if (!liveRound || !mapRef.current) return;

    const absHole = liveRound.currentHole + (liveRound.holeOffset || 0);
    const hg = COURSE_DB[liveRound.course]?.holes?.[absHole];

    const target = flagPin || hg?.green?.center || hg?.green?.front || hg?.green?.back || null;
    const origin = teePin || hg?.tee || null;

    if (!target || !origin) return;

    const brng = bearingDeg(origin.lat, origin.lng, target.lat, target.lng);

    try {
      mapRef.current.rotateTo(brng, { duration: 600 });
    } catch (_) {}
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
    if (DISABLE_STRIPE_PURCHASES) {
      setCoinShopPack(null);
      setCoinClientSecret(null);
      setCoinPaymentSuccess(false);
      setCoinPaymentError("Coin purchases are disabled in the iOS wrapper. App Store purchases will be added in a later IAP phase.");
      return;
    }

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
    console.log("[CourseSearch Debug]", { val, localMatches, apiResults });
    const apiMatches = apiResults
      .map(c => ({
        name: c.club_name || c.course_name,
        apiId: c.id,
        location: c.location,
        source: "golfcourseapi",
      }));
    setCourseSuggestions([...apiMatches, ...localMatches, ...(localMatches.length > 0 ? [] : firestoreResults)]);
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
      try {
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
      } catch (e) {
        console.warn("[Auth] startup failed:", e);
      } finally {
        setAuthLoading(false);
      }
    });
    return unsub;
  }, []);

  // Capacitor/iOS WebView safety: never leave the app stuck on the loading screen.
  useEffect(() => {
    if (!authLoading) return;
    const id = setTimeout(() => {
      setAuthLoading(false);
    }, 6000);
    return () => clearTimeout(id);
  }, [authLoading]);

  const deletingRef = useRef(false);
  const profileLoadedRef = useRef(false);
  const roundSubmittedRef = useRef(false); // prevents in-flight liveRound writes from racing submit
  const roundSavingRef = useRef(false);   // suppresses redundant useEffect write while submit await is in progress
  useEffect(() => {
    if (!authUser || !profileLoadedRef.current) return;
    const cleanedBag = sanitizeBagDistances(profile.bag || []);
    const changed = JSON.stringify(cleanedBag) !== JSON.stringify(profile.bag || []);
    if (!changed) return;
    setProfile(p => ({ ...p, bag: cleanedBag }));
    setDoc(doc(db, "users", authUser.uid), { bag: cleanedBag }, { merge: true }).catch(() => {});
  }, [authUser?.uid, profile.bag]); // eslint-disable-line react-hooks/exhaustive-deps

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
    setAuthError("");
    setAuthBusy(true);

    const timeoutId = setTimeout(() => {
      setAuthBusy(false);
      setAuthError("Login timed out inside the iOS wrapper. Firebase network works, but SDK auth did not complete.");
    }, 12000);

    try {
      await signInWithEmailAndPassword(auth, authEmail, authPassword);
      clearTimeout(timeoutId);
      setAuthBusy(false);
    } catch(e) {
      clearTimeout(timeoutId);
      console.warn("[Auth] login failed:", e);
      setAuthError(e?.message || "Invalid email or password.");
      setAuthBusy(false);
    }
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
    if (selectedApiCourse?.location) {
      // Store course lat/lng even if tee data lookup fails.
      // This gives Live Round a safe course-level map center without exposing raw user GPS.
      apiOverrides.apiCourseLocation = {
        lat: selectedApiCourse.location.latitude,
        lng: selectedApiCourse.location.longitude
      };
      apiOverrides.apiCourseId = selectedApiCourse.id;
    }
    if (selectedApiCourse) {
      const apiTee = extractApiTeeData(selectedApiCourse, tee);
      if (apiTee) {
        const count = parseInt(holes);
        holePars = count === 9
          ? (nineSide === "back" ? apiTee.holePars.slice(9) : apiTee.holePars.slice(0, 9))
          : apiTee.holePars;
        apiOverrides = {
          ...apiOverrides,
          overrideRating: apiTee.rating,
          overrideSlope:  apiTee.slope,
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
    if (!Number.isFinite(yards) || yards <= 0 || yards > 500) {
      console.warn("[ClubAverage] Ignored invalid shot distance:", yards);
      setShotInFairway(false);
      setPendingShotEndPos(null);
      setPendingShotYards(null);
      return;
    }
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
      let pAvg = parseFloat(item.distance) || 0;
      if (!Number.isFinite(pAvg) || pAvg < 0 || pAvg > 500) pAvg = 0;
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
        {authError && <div style={{ fontSize: 13, fontWeight: 700, color: "#dc2626", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 14px", marginBottom: 14, textAlign: "center", fontFamily: "'Inter',sans-serif" }}>{authError}</div>}

        {/* Submit */}
        <button
          onClick={authMode === "login" ? handleLogin : handleSignup}
          disabled={authBusy}
          style={{ width: "100%", padding: "15px 0", background: Theme.primaryGreen, border: "none", borderRadius: 12, color: "#fff", fontSize: 13, fontWeight: 900, letterSpacing: 2, cursor: authBusy ? "default" : "pointer", fontFamily: "'Inter','DM Sans',sans-serif", opacity: authBusy ? 0.6 : 1, display: "flex", alignItems: "center", justifyContent: "center", textTransform: "uppercase" }}
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
        <div className="tab-scroll" style={{ paddingBottom: "calc(150px + env(safe-area-inset-bottom))", overflowX: "hidden" }}>

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
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", width: "100%", maxWidth: "100%", background: "#fff", borderBottom: "1px solid #e5e7eb", overflow: "hidden" }}>
            {[
              { val: profile.history.length, label: "ROUNDS", color: "#111827" },
              { val: profile.history.length > 0 ? Math.min(...profile.history.map(r => r.score)) : "—", label: "BEST RND", color: "#111827" },
              { val: profile.streak > 0 ? `${profile.streak}🔥` : "—", label: "STREAK", color: "#111827" },
              { val: (profile.coins || 0).toLocaleString(), label: "🪙 COINS", color: "#d97706" },
            ].map(({ val, label, color }, i) => (
              <div key={label} style={{ minWidth: 0, padding: "10px 0", textAlign: "center", borderRight: i < 3 ? "1px solid #e5e7eb" : "none", overflow: "hidden" }}>
                <div style={{ fontSize: 20, fontWeight: 900, color, fontFamily: "Bebas Neue", lineHeight: 1 }}>{val}</div>
                <div style={{ fontSize: 8, fontWeight: 800, color: "#9ca3af", letterSpacing: 1.5, marginTop: 2 }}>{label}</div>
              </div>
            ))}
          </div>

          {/* ── TWO-COLUMN BODY: Attributes left | Last 5 right ── */}
          <div style={{ display: isMobileLayout ? "block" : "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", background: "#fff", borderBottom: "1px solid #e5e7eb", minHeight: 240, width: "100%", maxWidth: "100%", overflow: "hidden" }}>
            {/* Left: Attributes radar */}
            <div style={{ minWidth: 0, borderRight: isMobileLayout ? "none" : "1px solid #e5e7eb", borderBottom: isMobileLayout ? "1px solid #e5e7eb" : "none", padding: "12px 8px 12px", overflow: "hidden" }}>
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
            <div style={{ minWidth: 0, padding: "12px 12px", overflow: "hidden" }}>
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
                  <div style={{ fontSize: 9, color: selectedApiCourse ? Theme.primaryGreen : "#9ca3af", fontWeight: 700, marginTop: 4 }}>
                    {selectedApiCourse ? "📡 GolfCourseAPI course selected — map location available" : "Choose a dropdown result for best map support"}
                  </div>
                  {courseSuggestions.length > 0 && (
                    <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, zIndex: 10, boxShadow: "0 4px 12px rgba(0,0,0,0.1)", overflow: "hidden" }}>
                      {courseSuggestions.map((c, i) => (
                        <div key={i} onClick={() => selectCourse(c)} style={{ padding: "12px 12px", cursor: "pointer", borderBottom: "1px solid #f0f0f0", fontSize: 12, fontWeight: 600 }}>
                          <div style={{ color: "#111827", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                            {c.source === "golfcourseapi" ? "📡 " : ""}{c.name}
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

                      {/* ── Previous round shot dots (faded) ── */}
                      {(profile.courseShots?.[liveRound?.course]?.holes?.[currentHole] || []).map((shot, si) => (
                        <Marker key={`prev-shot-${si}`} longitude={shot.lng} latitude={shot.lat} anchor="bottom" pitchAlignment="viewport" rotationAlignment="viewport" style={{ pointerEvents: "none" }}>
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
                          <Marker key={`shot-${si}`} longitude={shot.lng} latitude={shot.lat} anchor="bottom" pitchAlignment="viewport" rotationAlignment="viewport" style={{ pointerEvents: "none" }}>
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
                        const trackingPos = onCourse ? playerPos : targetPin;
                        const yards = trackingPos
                          ? Math.round(haversineYards(fromPos.lat, fromPos.lng, trackingPos.lat, trackingPos.lng))
                          : null;
                        setShotInFairway(false);
                        if (Number.isFinite(yards) && yards > 0 && yards <= 500) {
                          setPendingShotYards(yards);
                        } else {
                          setAttrToast("Set a target location before tracking the shot");
                          setTimeout(() => setAttrToast(null), 1800);
                        }
                        if (trackingPos) {
                          setPendingShotEndPos({ lat: trackingPos.lat, lng: trackingPos.lng });
                        }
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

            {/* ── COIN PACKS ── hidden in iOS wrapper until Apple IAP phase */}
            <div style={{ marginBottom: 18, display: DISABLE_STRIPE_PURCHASES ? "none" : "block" }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: "#9ca3af", letterSpacing: 1.5, marginBottom: 8 }}>BUY COINS</div>
              {DISABLE_STRIPE_PURCHASES && (
                <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10, padding: "9px 11px", fontSize: 11, color: "#92400e", fontWeight: 700, lineHeight: 1.4, marginBottom: 10 }}>
                  Coin purchases are disabled in the iOS wrapper. App Store purchases will be added in a later IAP phase.
                </div>
              )}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {COIN_PACKS.map(pack => (
                  <button key={pack.id} disabled={DISABLE_STRIPE_PURCHASES} onClick={() => handleSelectCoinPack(pack)} style={{ position: "relative", background: DISABLE_STRIPE_PURCHASES ? "#f9fafb" : "#fff", opacity: DISABLE_STRIPE_PURCHASES ? 0.65 : 1, border: pack.tag ? `2px solid ${Theme.primaryGreen}` : "1px solid #e5e7eb", borderRadius: 14, padding: "14px 12px", textAlign: "center", cursor: DISABLE_STRIPE_PURCHASES ? "not-allowed" : "pointer", boxShadow: pack.tag ? "0 2px 12px rgba(125,162,126,0.15)" : "none" }}>
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

