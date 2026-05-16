# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm start        # Start dev server (localhost:3000)
npm run build    # Production build
npm test         # Run tests (Jest/React Testing Library)
npm test -- --testPathPattern=App  # Run a single test file
```

## Architecture

This is a single-page React app (Create React App, React 19) with **no routing** — all UI is controlled by a `tab` state variable in the root `GolfApp` component. There is intentionally **no component file splitting**: all logic lives in `src/App.js` (~2500 lines).

### Firebase (Firestore + Auth)

Firebase is initialized twice — once in `src/firebase.js` (exported `db`/`auth`) and again inline at the top of `App.js` (the inline copy is what's actually used). The `firebase.js` file is vestigial.

**Firestore collections:**
- `users/{uid}` — player profile (ovr, xp, level, rounds[], history[], ownedItems, equipped cosmetics, bag, coins, liveRound, etc.)
- `courses/{courseId}` — user-contributed course data
- `friends/{uid1_uid2}` — bidirectional friendship pairs (one doc per direction)
- `friendRequests/{fromUid_toUid}` — pending friend requests
- `reactions/{ownerUid_roundId}` — per-round emoji reactions (map of uid→reactionKey)
- `reactions/{ownerUid_roundId}/comments` — subcollection for round comments

Profile pictures are stored in **localStorage** (base64), not Firestore, except the URL is synced to the `users` doc as `profilePic`.

### Navigation tabs

Bottom nav drives a `tab` state with six values: `profile`, `live`, `leaderboard`, `feed`, `bag`, `shop`.

### OVR / Rating System

- `calcRoundOVR(score, courseData, holes)` — converts a round score to a 40–99 OVR using course rating and slope
- `calcOVRFromRounds(rounds[])` — weighted average of recent round OVRs (confidence weight scales up to 5 rounds)
- Player attributes (PWR, ACC, CON, REC, EFF) are derived from OVR via `computeStats()`, then offset by attribute deltas collected via post-round survey (`ROUND_QUESTIONS`)
- `skillTier(ovr)` — maps OVR to a tier label (COURSE EXPLORER → SCRATCH)

### XP & Leveling

- `xpForLevel(level)` — XP required to reach a level: `200 * 1.18^(level-2)`, capped at level 50
- `levelFromXP(xp)` — reverse lookup
- XP earned per round is stored on history entries; boosts are tracked in `profile.xpBoost`

### Course Database

`COURSE_DB` (hardcoded in App.js, ~40 Wisconsin-area courses) stores par, hole-by-hole pars, and tee ratings/slopes. `getCourseData()` and `getCourseHolePars()` are the accessors.

### Key UI Components (all in App.js)

- `FeedCard` — social feed card with emoji reactions and comments
- `OVRTrendChart` — SVG sparkline of OVR over last 12 rounds
- `RadarChart` — SVG pentagon for PWR/ACC/CON/REC/EFF display
- `BadgeIcon` — inline SVG achievement icons (keyed by achievement id)
- `GolfApp` — root component holding all state; renders the correct tab view

### Admin Utility

`window.repairAllUsers` is exposed in the browser console (calls `repairAllUsersInFirestore`), used for one-off data migrations.
