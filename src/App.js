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
import { MAPBOX_TOKEN, OWM_API_KEY, DISABLE_STRIPE_PURCHASES, STRIPE_PK, COIN_PACKS, CHALLENGE_FORMATS, COURSE_MAP_CENTERS } from "./config/constants";
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
import ProfileTab from "./components/profile/ProfileTab";
import LiveRoundTab from "./components/rounds/LiveRoundTab";
import LeaderboardTab from "./components/leaderboard/LeaderboardTab";
import ChallengesTab from "./components/challenges/ChallengesTab";
import BagTab from "./components/bag/BagTab";
import ShopTab from "./components/shop/ShopTab";
import BottomNav from "./components/common/BottomNav";

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
  const [joinableChallenge, setJoinableChallenge] = useState(null);
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
    if (!authUser?.uid) {
      setChallenges([]);
      setJoinableChallenge(null);
      return undefined;
    }

    setChallengesLoading(true);

    const sortChallenges = items =>
      items.sort((a, b) =>
        (a.date + a.timeWindow) > (b.date + b.timeWindow) ? 1 : -1
      );

    const unsubscribe = onSnapshot(
      collection(db, "challenges"),
      snap => {
        const now = new Date();

        const items = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(challenge => {
            if (challenge.status === "expired") return false;
            const expiresAt = challenge.expiresAt?.toDate
              ? challenge.expiresAt.toDate()
              : challenge.expiresAt
                ? new Date(challenge.expiresAt)
                : null;

            return !(
              expiresAt &&
              expiresAt <= now &&
              challenge.status !== "completed" &&
              !challenge.settled
            );
          });

        setChallenges(sortChallenges(items));
        setChallengesLoading(false);
      },
      error => {
        console.error("Challenge listener failed:", error);
        loadChallenges().then(items => {
          setChallenges(items);
          setChallengesLoading(false);
        });
      }
    );

    return unsubscribe;
  }, [authUser?.uid]);

  useEffect(() => {
    if (!authUser?.uid || !Array.isArray(challenges)) {
      setJoinableChallenge(null);
      return;
    }

    const availableChallenge = challenges.find(challenge => {
      const joinedBy = challenge.joinedBy || [];
      const scores = challenge.scores || {};

      const isCreator = challenge.uid === authUser.uid;
      const isJoinedPlayer = joinedBy.some(player => player.uid === authUser.uid);
      const isParticipant = isCreator || isJoinedPlayer;

      if (!isParticipant) return false;
      if (scores[authUser.uid] != null) return false;

      const isFinished =
        challenge.settled ||
        challenge.paidOut ||
        challenge.status === "completed" ||
        challenge.status === "expired";

      if (isFinished) return false;

      const hasAnotherPlayer = joinedBy.length > 0;
      const lobbyIsFull = 1 + joinedBy.length >= Number(challenge.maxPlayers || 2);

      return hasAnotherPlayer || lobbyIsFull;
    });

    setJoinableChallenge(availableChallenge || null);
  }, [authUser?.uid, challenges]);

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

    const fmt = t => {
      const [h, m] = t.split(":");
      const hr = parseInt(h);
      return `${hr % 12 || 12}:${m} ${hr >= 12 ? "PM" : "AM"}`;
    };

    const timeWindow = `${fmt(challengeForm.timeFrom)} – ${fmt(challengeForm.timeTo)}`;
    const tempId = `temp_${Date.now()}`;
    const wager = challengeForm.wager ? parseInt(challengeForm.wager) : 0;

    const newChallenge = {
      uid: authUser.uid,
      username: profile.username,
      profilePic: profile.profilePic || profilePic || null,
      ovr: profile.ovr || 0,
      course: challengeForm.courseName,
      date: challengeForm.date,
      timeWindow,
      message: challengeForm.message.trim(),
      wager,
      format: challengeForm.format,
      maxPlayers: challengeForm.playerCount,
      teamAssignments: challengeForm.slots,
      teeColor: challengeForm.teeColor,
      holes: challengeForm.holes,
      nineHolesSide: challengeForm.holes === 9 ? challengeForm.nineHolesSide : null,
      joinedBy: [],
      creatorPaid: false,
      pot: 0,
      status: "open",
      settled: false,
      paidOut: false,
      createdAt: new Date(),
      id: tempId,
    };

    // Do NOT deduct coins here. Coins are deducted when another player accepts/joins.
    setChallenges(prev =>
      [newChallenge, ...prev].sort((a, b) =>
        (a.date + a.timeWindow) > (b.date + b.timeWindow) ? 1 : -1
      )
    );

    setShowChallengeModal(false);
    setChallengeForm({ courseQuery: "", courseName: "", date: "", timeFrom: "", timeTo: "", message: "", wager: "", format: "stroke", playerCount: 2, slots: ["A", "B"], teeColor: "white", holes: 18, nineHolesSide: "front" });
    setChallengeCourseSuggestions([]);

    console.log("Posting challenge:", newChallenge);

    try {
      const firestoreDoc = {
        uid: newChallenge.uid,
        username: newChallenge.username,
        profilePic: profile.profilePic || profilePic || null,
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
        creatorPaid: false,
        pot: 0,
        status: "open",
        settled: false,
        paidOut: false,
        createdAt: serverTimestamp(),
      };

      const ref = await addDoc(collection(db, "challenges"), firestoreDoc);

      setChallenges(prev =>
        prev.map(c => c.id === tempId ? { ...c, id: ref.id } : c)
      );
    } catch (e) {
      console.error("Failed to sync challenge to Firestore:", e);
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
            setChallenges(prev => prev.map(ch => ch.id === matchingChallenge.id ? {
              ...ch,
              settled: true,
              paidOut: true,
              status: "completed",
              winner: result.winner,
              winnerUid: result.winner?.uid,
              winnerUsername: result.winner?.username,
              payoutAmount: result.payout || result.wager || 0,
              scores: updatedScores,
            } : ch));
            if (result.winner?.uid === authUser.uid && (result.payout || result.wager) > 0)
              setProfile(p => ({ ...p, coins: (p.coins || 0) + Number(result.payout || result.wager || 0) }));
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
            setChallenges(prev => prev.map(ch => ch.id === matchingChallenge.id ? {
              ...ch,
              settled: true,
              paidOut: true,
              status: "completed",
              winner: result.winner,
              winnerUid: result.winner?.uid,
              winnerUsername: result.winner?.username,
              payoutAmount: result.payout || result.wager || 0,
              scores: updatedScores,
            } : ch));
            if (result.winner?.uid === authUser.uid && (result.payout || result.wager) > 0)
              setProfile(p => ({ ...p, coins: (p.coins || 0) + Number(result.payout || result.wager || 0) }));
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

  const appCtx = {
    ACCENT,
    ACHIEVEMENTS,
    BadgeIcon,
    CHALLENGE_FORMATS,
    COINS,
    COIN_PACKS,
    COURSE_DB,
    COURSE_MAP_CENTERS,
    ChallengeCard,
    DEFAULT_BAG,
    DISABLE_STRIPE_PURCHASES,
    MAPBOX_TOKEN,
    Map,
    Marker,
    RadarChart,
    S,
    SHOP_ITEMS,
    Theme,
    _isWaterAtPoint,
    abandonLiveRound,
    acceptCrewRequest,
    activeBagClub,
    animOVR,
    apiCourseTeeNames,
    attrToast,
    authUser,
    bagEditClub,
    bannerClass,
    bannerStyle,
    bearingDeg,
    calcHandicapIndex,
    calculateWindEffect,
    challengeBusy,
    challengeCourseSuggestions,
    challengeForm,
    challengePostError,
    challengeStep,
    challengerStats,
    challenges,
    joinableChallenge,
    challengesLoading,
    coinClientSecret,
    coinPaymentBusy,
    coinPaymentError,
    coinPaymentSuccess,
    coinShopPack,
    collection,
    communityPinCount,
    communityPinCourseKey,
    communityPinSource,
    compressImage,
    computeGreenPoints,
    computeStats,
    confirmDeleteRound,
    courseSuggestions,
    createCrewBusy,
    createCrewError,
    createCrewInFirestore,
    createCrewName,
    crewBrowse,
    crewBrowseLoading,
    crewRequests,
    db,
    declineCrewRequest,
    degToArrow,
    deleteBusy,
    deleteChallengeInDb,
    deleteError,
    deletePassword,
    deleteRound,
    doc,
    editCourse,
    editHolePars,
    editHoleScores,
    editHoles,
    editNineSide,
    editRating,
    editSlope,
    editTee,
    equippedBanner,
    equippedBorder,
    extractApiTeeData,
    fetchPublicCrews,
    flagPin,
    friendRequests,
    friendSearch,
    friendSearchBusy,
    friendSearchMsg,
    friendSearchResult,
    friends,
    getCourseData,
    getCourseHolePars,
    getDoc,
    getDocs,
    getPlaysLikeDistance,
    getUnlockedBadges,
    globalLeaderboard,
    gpsPermissionDenied,
    handleCoinPayment,
    handleCourseSearch,
    handleCreateCourse,
    handleDeleteAccount,
    handleFriendSearch,
    handleLogout,
    handlePostChallenge,
    handleRespondRequest,
    handleSelectCoinPack,
    handleSendRequest,
    hapticTap,
    haversineYards,
    isHandicapView,
    isMobileLayout,
    joinChallengeInDb,
    last5,
    lastPlayerPosRef,
    leaderboard,
    leaderboardLoading,
    leaderboardView,
    leaveCrewInFirestore,
    liveAttrGains,
    liveFairwaysArr,
    livePuttsArr,
    liveRound,
    liveStrokesArr,
    liveWeather,
    mapRef,
    mapTilesLoading,
    mapUserPannedRef,
    mountCardElement,
    myCrewData,
    nameplateStyle,
    newCourseForm,
    offsetLatLng,
    parPickerHole,
    pendingFitBoundsRef,
    pendingShotYards,
    placingMode,
    playerPos,
    playerSpeed,
    profile,
    profilePic,
    profilePicRef,
    pushPinVote,
    query,
    recTicker,
    removeFriendInDb,
    requestJoinCrew,
    roundSaving,
    roundSubmittedRef,
    savePinLayout,
    saveProfileToFirestore,
    scanError,
    scanState,
    scorePickerHole,
    searchGolfCourseAPI,
    selectCourse,
    selectedApiCourse,
    selectedBadge,
    sentCrewRequests,
    sentRequests,
    setActiveBagClub,
    setActiveChallengeId,
    setAttrToast,
    setBadgeFlash,
    setBagEditClub,
    setChallengeCourseSuggestions,
    setChallengeForm,
    setChallengePostError,
    setChallengeStep,
    setChallengerStats,
    setChallenges,
    setCoinClientSecret,
    setCoinPaymentError,
    setCoinPaymentSuccess,
    setCoinShopPack,
    setCommunityPinCount,
    setCommunityPinSource,
    setConfirmDeleteRound,
    setCreateCrewBusy,
    setCreateCrewError,
    setCreateCrewName,
    setCrewBrowse,
    setCrewBrowseLoading,
    setCrewRequests,
    setDeleteError,
    setDeletePassword,
    setDoc,
    setEditHolePars,
    setEditHoleScores,
    setEditHoles,
    setEditNineSide,
    setEditRating,
    setEditScore,
    setEditSlope,
    setEditTee,
    setFlagPin,
    setFlash,
    setFriendSearch,
    setFriends,
    setGpsPermissionDenied,
    setIsHandicapView,
    setLeaderboard,
    setLeaderboardView,
    setLiveFairwaysArr,
    setLivePuttsArr,
    setLiveRound,
    setLiveStrokesArr,
    setMapTilesLoading,
    setMapUserPanned,
    setMapZoom,
    setMyCrewData,
    setNewCourseForm,
    setParPickerHole,
    setPendingShotEndPos,
    setPendingShotYards,
    setPlacingMode,
    setPlayerPos,
    setProfile,
    setProfilePic,
    setScanError,
    setScanState,
    setScorePickerHole,
    setSelectedBadge,
    setSentCrewRequests,
    setShopCategory,
    setShopConfirm,
    setShopPreview,
    setShotHistoryArr,
    setShotInFairway,
    setShotStartPos,
    setShowAttrModal,
    setShowBadgeManager,
    setShowChallengeModal,
    setShowCreateCourse,
    setShowCreateCrewModal,
    setShowDeleteConfirm,
    setShowScorecard,
    setShowSettings,
    setTab,
    setTargetPin,
    setTeePin,
    setTeePinManual,
    setViewingChallenger,
    setViewingPic,
    setViewingProfile,
    setViewingRound,
    settleChallengeInDb,
    shopCategory,
    shopConfirm,
    shopPreview,
    shotHistoryArr,
    shotInFairway,
    showAttrModal,
    showBadgeManager,
    showChallengeModal,
    showCreateCourse,
    showCreateCrewModal,
    showDeleteConfirm,
    showScorecard,
    showSettings,
    skillTier,
    startLiveRound,
    stats,
    submitChallengeReview,
    submitLiveRound,
    submitRound: submitLiveRound,
    suggestClub,
    tab,
    targetPin,
    teePin,
    tier,
    unlockedBadges,
    updateClubAverage,
    updateLivePar,
    updateLiveScore,
    username,
    viewingChallenger,
    viewingPic,
    viewingProfile,
    viewingRound,
    where,
  };

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
      {tab === "profile" && !liveRound && <ProfileTab {...appCtx} />}

      {/* ── LIVE ROUND (shown on Profile tab when active) ── */}
      {tab === "profile" && liveRound && <LiveRoundTab {...appCtx} />}

      {/* ── LEADERBOARD TAB ── */}
      {tab === "leaderboard" && <LeaderboardTab {...appCtx} />}

      {/* ── CHALLENGES TAB ── */}
      {tab === "challenges" && <ChallengesTab {...appCtx} />}

      {/* ── BAG TAB ── */}
      {tab === "bag" && <BagTab {...appCtx} />}

      {/* ── SHOP TAB ── */}
      {tab === "shop" && <ShopTab {...appCtx} />}

      {/* ── BOTTOM NAV — hidden during live round ── */}
      <BottomNav {...appCtx} />
    </div>
  );
}

