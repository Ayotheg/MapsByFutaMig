import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import L from 'leaflet';
import { haversine } from '../../lib/geoUtils';
import { isRateablePOI } from '../waypoints/wpTypeMeta';
import { fetchNominatim } from '../search/nominatimSearch';
import { fetchRoute } from './osrmRoute';
import { turnIcon, fmtDist } from './turnHelpers';
import NavDestPanel from './NavDestPanel';
import NavHud from './NavHud';
import NavArrivedBanner from './NavArrivedBanner';
import './navMapLayers.css';

// Leaflet marker/popup content is raw HTML (not React), so the "arrived
// destination" flag glyph below is a hand-built inline SVG matching
// Lucide's own Flag icon path — same visual language as the rest of the
// app's icons, just usable outside a React tree.
const SVG_FLAG = (size, color = 'currentColor') =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 22V4a1 1 0 0 1 .4-.8A6 6 0 0 1 8 2c3 0 5 2 7.333 2q2 0 3.067-.8A1 1 0 0 1 20 4v10a1 1 0 0 1-.4.8A6 6 0 0 1 16 16c-3 0-5-2-8-2a6 6 0 0 0-4 1.528"/></svg>`;

/**
 * Ported from legacy's Navigation module IIFE (`app.js` ~4364–5317).
 * Renders `NavDestPanel` ("Where to?") and/or `NavHud` (turn-by-turn),
 * fully self-contained: owns the OSRM route fetch, the route/dest-
 * marker/nav-user-dot map layers, arrival detection, and voice
 * announcements. Talks to the outside world only through:
 *
 *  - `onActiveChange(bool)` — MapPage forces RAW view mode + hides
 *    `ViewModeToggle` while true (mirrors legacy's `_prevInfoMode`
 *    save/restore, app.js ~5058–5063, ~5160–5163 — kept in MapPage
 *    rather than here since it also touches a sibling component this
 *    module has no reason to know about).
 *  - `onArrival(dest)` — fired only when the arrived destination is a
 *    rateable POI (`isRateablePOI`), matching legacy's
 *    `finishArrival()` gate (app.js ~4966–4969). MapPage owns whether
 *    to actually show the review modal (see ReviewModal.jsx's wiring
 *    instructions).
 *  - `onRequestClose()` — fired once neither the destination panel nor
 *    an active nav session needs to be shown, so MapPage can unmount
 *    this component. Legacy just leaves the (still-loaded) DOM hidden;
 *    unmounting is this port's equivalent "dormant" state, and is what
 *    makes this component a real lazy-load boundary instead of a
 *    permanently-resident one.
 *  - `onNavigationSuccess()` — new (no legacy equivalent): fired once per
 *    real arrival, for ANY destination — unlike `onArrival` above this is
 *    NOT gated on `isRateablePOI`. This is what MapPage uses to count a
 *    guest's free navigations (see `useGuestUsage.js`); a guest "using the
 *    map successfully" isn't about whether the place happens to support
 *    reviews.
 *  - `guestNavBlocked` (bool) / `onGuestBlocked()` — the guest-limit gate
 *    itself. Checked at the top of `startNavigation()`, not just once at
 *    mount, so a guest who already has this controller open (e.g. picked a
 *    new destination in an already-open "Where to?" panel) is still
 *    stopped the moment their free tries run out, not only on first open.
 *
 * `gps` is `useGpsTracking()`'s return value, lifted to MapPage — used
 * for `gps.lastKnownPosRef` (legacy's shared `lastKnownPos` cache, read
 * by both the GPS panel and the nav module) as part of the "smart
 * location resolver" (below).
 */
const NavigationController = forwardRef(function NavigationController(
  { map, gps, searchIndex, initialDest, onRequestClose, onActiveChange, onArrival, guestNavBlocked, onGuestBlocked, onNavigationSuccess },
  ref
) {
  const [destPanelOpen, setDestPanelOpen] = useState(true);
  const [navActive, setNavActive] = useState(false);
  const [mode, setMode] = useState('foot-walking');
  const [destInputValue, setDestInputValue] = useState('');
  const [dropdownResults, setDropdownResults] = useState([]);
  const [hint, setHint] = useState('Tap a pin on the map or type a place name above');
  const [goDisabled, setGoDisabled] = useState(true);
  const [goLabel, setGoLabel] = useState('Start Navigation');
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [arrivedBannerDest, setArrivedBannerDest] = useState(null);
  const [hud, setHud] = useState({
    arriving: false,
    arrived: false,
    turnIcon: 'arrow-up',
    turnInstruction: 'Head towards destination',
    turnDist: 'Calculating…',
    nextPreview: '',
    distRemain: '—',
    destName: '',
  });

  // ── Refs mirroring state used inside stable callbacks/timers (avoids
  // stale closures — same rationale as useGpsTracking.js's *Ref pairs) ──
  const navActiveRef = useRef(false);
  const destPanelOpenRef = useRef(true);
  const voiceEnabledRef = useRef(true);
  voiceEnabledRef.current = voiceEnabled;

  // Guest-limit gate — read fresh on every `startNavigation()` call rather
  // than only at mount, since this controller can stay mounted across
  // several destination picks in one session (see this file's header
  // comment on `guestNavBlocked`).
  const guestNavBlockedRef = useRef(false);
  guestNavBlockedRef.current = guestNavBlocked;

  const navDestRef = useRef(null); // {lat,lng,name,id,type}
  const navModeRef = useRef('foot-walking');
  const navRouteDataRef = useRef(null);
  const navStepIndexRef = useRef(0);
  const navUserPosRef = useRef(null);
  const navWatchIdRef = useRef(null);
  const navRouteLayersRef = useRef(null); // { done, ahead, pulse }
  const navDestMarkerRef = useRef(null);
  const navUserMarkerRef = useRef(null);
  const navArrivalCountRef = useRef(0);
  const navGpsTicksRef = useRef(0);
  const navArrivedRef = useRef(false);
  const navGpsStaleTimerRef = useRef(null);
  const lastSpokenStepRef = useRef(-1);
  const spokenTurnNowRef = useRef(false);
  const nearArrivalSpokenRef = useRef(false);
  const navDropDebounceRef = useRef(null);
  const navClickAbortRef = useRef(null);
  const lastDrawFracRef = useRef(-1);

  // ── Voice (Web Speech API) — ported from app.js ~4433–4442 ────────────
  const speak = useCallback((text) => {
    if (!voiceEnabledRef.current) return;
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.rate = 1.05;
    utt.pitch = 1.0;
    utt.volume = 1.0;
    window.speechSynthesis.speak(utt);
  }, []);

  // ── Set destination (from dropdown pick, map click, or "Navigate Here") ──
  const setNavDest = useCallback((entry) => {
    navDestRef.current = {
      lat: parseFloat(entry.lat),
      lng: parseFloat(entry.lng),
      name: entry.name,
      id: entry.id || null,
      type: entry.type || entry.subtype || null,
    };
    setDestInputValue(entry.name);
    setDropdownResults([]);
    setHint(`Destination set: ${entry.name}`);
    setGoDisabled(false);
  }, []);

  // Seed from PlaceCard's "Navigate Here" / re-seed on a fresh click while
  // already mounted (MapPage always passes a *new* object reference).
  useEffect(() => {
    if (!initialDest) return;
    setNavDest(initialDest);
    setDestPanelOpen(true);
  }, [initialDest, setNavDest]);

  // ── Destination search — local index first, then debounced Nominatim ──
  const onDestInputChange = useCallback(
    (val) => {
      setDestInputValue(val);
      const q = val.trim();
      if (!q) {
        setDropdownResults([]);
        return;
      }
      const local = searchIndex.query(q, 7);
      setDropdownResults(local);

      clearTimeout(navDropDebounceRef.current);
      if (q.length >= 3) {
        navDropDebounceRef.current = setTimeout(async () => {
          try {
            const osm = await fetchNominatim(q, { limit: 4 });
            osm.forEach((r) => searchIndex.register(r));
            setDropdownResults([...searchIndex.query(q, 5), ...osm].slice(0, 7));
          } catch {
            /* silent — matches legacy */
          }
        }, 400);
      }
    },
    [searchIndex]
  );

  // ── Map click → set destination while the "Where to?" panel is open ──
  useEffect(() => {
    if (!map) return;
    function handleClick(e) {
      if (!destPanelOpenRef.current || navActiveRef.current) return;
      const { lat, lng } = e.latlng;
      if (navClickAbortRef.current) navClickAbortRef.current.abort();
      const abort = new AbortController();
      navClickAbortRef.current = abort;
      fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18`, {
        headers: { 'Accept-Language': 'en' },
        signal: abort.signal,
      })
        .then((r) => r.json())
        .then((d) => {
          const name = d?.display_name?.split(',').slice(0, 2).join(',').trim() || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
          setNavDest({ lat, lng, name });
        })
        .catch((err) => {
          if (err.name !== 'AbortError') setNavDest({ lat, lng, name: `${lat.toFixed(5)}, ${lng.toFixed(5)}` });
        });
    }
    map.on('click', handleClick);
    return () => map.off('click', handleClick);
  }, [map, setNavDest]);

  // ── Route + nav-user-dot map layers ────────────────────────────────
  const clearRouteLayers = useCallback(() => {
    if (navRouteLayersRef.current) {
      Object.values(navRouteLayersRef.current).forEach((l) => map.removeLayer(l));
      navRouteLayersRef.current = null;
    }
    lastDrawFracRef.current = -1;
  }, [map]);

  const drawRoute = useCallback(
    (coords, progressFraction, forceRedraw = false) => {
      if (!forceRedraw) {
        const lastFrac = lastDrawFracRef.current;
        const fracDelta = Math.abs(progressFraction - lastFrac);
        if (fracDelta < 0.005 && lastFrac !== -1) return;
      }
      lastDrawFracRef.current = progressFraction;
      if (!coords || !coords.length) {
        clearRouteLayers();
        return;
      }

      const splitIdx = Math.floor(coords.length * progressFraction);
      const done = coords.slice(0, Math.max(splitIdx + 1, 2));
      const ahead = coords.slice(Math.max(splitIdx, 0));

      if (!navRouteLayersRef.current) {
        navRouteLayersRef.current = {
          done: L.polyline([], { color: '#00c896', weight: 5, opacity: 0.25, dashArray: '4 8' }).addTo(map),
          ahead: L.polyline([], { color: '#00c896', weight: 6, opacity: 0.9 }).addTo(map),
          pulse: L.polyline([], { color: '#fff', weight: 2, opacity: 0.35, dashArray: '1 18' }).addTo(map),
        };
      }
      navRouteLayersRef.current.done.setLatLngs(done.length > 1 ? done : []);
      navRouteLayersRef.current.ahead.setLatLngs(ahead.length > 1 ? ahead : []);
      navRouteLayersRef.current.pulse.setLatLngs(ahead.length > 1 ? ahead : []);
    },
    [map, clearRouteLayers]
  );

  const placeDestMarker = useCallback(
    (lat, lng, name) => {
      if (navDestMarkerRef.current) map.removeLayer(navDestMarkerRef.current);
      navDestMarkerRef.current = L.marker([lat, lng], {
        icon: L.divIcon({
          className: '',
          html: `<div class="nav-dest-pin-wrap"><span class="nav-dest-pin-flag">${SVG_FLAG(18, '#fff')}</span></div>`,
          iconSize: [36, 36],
          iconAnchor: [18, 36],
        }),
        zIndexOffset: 1200,
      })
        .addTo(map)
        .bindPopup(
          `<div class="wp-popup"><div class="wp-popup-title" style="color:#ff4d4d;display:flex;align-items:center;gap:5px">${SVG_FLAG(14)} ${name}</div><div class="wp-popup-type">Navigation Destination</div></div>`,
          { className: 'futa-popup' }
        );
    },
    [map]
  );

  // Smooth animated glide — ported from `_animateMarkerTo` (app.js ~4764–4798).
  const animateMarkerTo = useCallback((marker, targetLatLng, durationMs) => {
    const start = marker.getLatLng();
    const dLat = targetLatLng.lat - start.lat;
    const dLng = targetLatLng.lng - start.lng;

    if (marker._animFrame) {
      cancelAnimationFrame(marker._animFrame);
      marker._animFrame = null;
    }
    const moveDeg = Math.sqrt(dLat * dLat + dLng * dLng);
    if (moveDeg < 0.000005) {
      marker.setLatLng([targetLatLng.lat, targetLatLng.lng]);
      return;
    }
    const dur = Math.min(durationMs, 800);
    const startTime = performance.now();
    function step(now) {
      const t = Math.min((now - startTime) / dur, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      marker.setLatLng([start.lat + dLat * ease, start.lng + dLng * ease]);
      if (t < 1) marker._animFrame = requestAnimationFrame(step);
      else marker._animFrame = null;
    }
    marker._animFrame = requestAnimationFrame(step);
  }, []);

  const updateNavUserDot = useCallback(
    (lat, lng) => {
      if (!navUserMarkerRef.current) {
        navUserMarkerRef.current = L.marker([lat, lng], {
          icon: L.divIcon({
            className: '',
            html: `<div class="nav-user-dot-wrap"><div class="nav-user-dot-pulse"></div><div class="nav-user-dot-core"></div></div>`,
            iconSize: [22, 22],
            iconAnchor: [11, 11],
          }),
          zIndexOffset: 1500,
        }).addTo(map);
        requestAnimationFrame(() => {
          const el = navUserMarkerRef.current?.getElement();
          if (el) el.style.transition = 'transform 1.2s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
        });
      } else {
        animateMarkerTo(navUserMarkerRef.current, { lat, lng }, 1200);
      }
    },
    [map, animateMarkerTo]
  );

  // ── Arrived ─────────────────────────────────────────────────────────
  const stopNavigationRef = useRef(null); // set below, forward-declared for arrivedAtDestination

  const arrivedAtDestination = useCallback(() => {
    if (navArrivedRef.current) return;
    navArrivedRef.current = true;

    const dest = navDestRef.current;
    setHud((h) => ({
      ...h,
      arrived: true,
      turnIcon: 'party-popper',
      turnInstruction: `You have arrived at ${dest.name}`,
      turnDist: 'Destination reached!',
      distRemain: '0 m',
    }));
    speak(`You have arrived at your destination, ${dest.name}!`);
    setArrivedBannerDest(dest.name);
    // Counts towards the guest free-navigation limit regardless of
    // destination type — see this file's header comment.
    onNavigationSuccess?.();
  }, [speak, onNavigationSuccess]);

  const dismissArrivedBanner = useCallback(() => {
    const dest = navDestRef.current;
    setArrivedBannerDest(null);
    stopNavigationRef.current?.();
    if (dest && dest.id && isRateablePOI(dest.type)) {
      onArrival?.(dest);
    }
  }, [onArrival]);

  // ── HUD update — ported from `updateHUD()` (app.js ~4800–4927) ────────
  const updateHUD = useCallback(() => {
    const routeData = navRouteDataRef.current;
    const userPos = navUserPosRef.current;
    const dest = navDestRef.current;
    if (!routeData || !userPos || !dest) return;
    const { lat, lng } = userPos;

    const distToDest = haversine(lat, lng, dest.lat, dest.lng);
    const steps = routeData.steps;
    let nearest = navStepIndexRef.current;
    let minD = Infinity;
    for (let i = navStepIndexRef.current; i < steps.length; i++) {
      if (!steps[i].location) continue;
      const d = haversine(lat, lng, steps[i].location[0], steps[i].location[1]);
      if (d < minD) {
        minD = d;
        nearest = i;
      }
    }
    if (nearest > navStepIndexRef.current && minD < 20) navStepIndexRef.current = nearest;

    if (navStepIndexRef.current !== lastSpokenStepRef.current) {
      lastSpokenStepRef.current = navStepIndexRef.current;
      spokenTurnNowRef.current = false;
      const spokenStep = steps[navStepIndexRef.current];
      if (spokenStep && spokenStep.instruction && spokenStep.type !== 'depart') {
        const dToStep = spokenStep.location ? fmtDist(haversine(lat, lng, spokenStep.location[0], spokenStep.location[1])) : null;
        speak(dToStep ? `In ${dToStep}, ${spokenStep.instruction}` : spokenStep.instruction);
      }
    }

    const currentStep = steps[navStepIndexRef.current];
    const nextHud = { destName: `To ${dest.name}`, distRemain: fmtDist(distToDest) };

    if (currentStep) {
      nextHud.turnIcon = turnIcon(currentStep.type, currentStep.modifier);
      nextHud.turnInstruction = currentStep.instruction || 'Continue straight';

      if (currentStep.location) {
        const dNext = haversine(lat, lng, currentStep.location[0], currentStep.location[1]);
        const isDeparting = currentStep.type === 'depart' || navStepIndexRef.current === 0;
        nextHud.turnDist = dNext < 50 && !isDeparting ? 'Turn now!' : dNext < 50 ? fmtDist(distToDest) + ' remaining' : `In ${fmtDist(dNext)}`;
        if (dNext < 50 && !isDeparting && !spokenTurnNowRef.current) {
          spokenTurnNowRef.current = true;
          speak(currentStep.instruction ? `${currentStep.instruction} now!` : 'Turn now!');
        }
      } else {
        nextHud.turnDist = fmtDist(distToDest) + ' remaining';
      }

      const nextStep = steps[navStepIndexRef.current + 1];
      nextHud.nextPreview =
        navGpsTicksRef.current >= 2 && nextStep && nextStep.type !== 'arrive' && nextStep.instruction
          ? `Then: ${nextStep.instruction}`
          : '';
    }

    const fracRemaining = Math.min(1, distToDest / routeData.distance);
    const progress = Math.max(0, 1 - fracRemaining);
    drawRoute(routeData.coords, progress);

    if (distToDest < 15 && navGpsTicksRef.current >= 2) {
      navArrivalCountRef.current++;
      if (navArrivalCountRef.current >= 3) {
        setHud((h) => ({ ...h, ...nextHud }));
        arrivedAtDestination();
        return;
      }
    } else {
      navArrivalCountRef.current = 0;
    }

    if (distToDest < 120) {
      nextHud.arriving = true;
      nextHud.turnIcon = 'flag';
      nextHud.turnInstruction = 'Destination is very close';
      if (!nearArrivalSpokenRef.current) {
        nearArrivalSpokenRef.current = true;
        speak(`${dest.name} is very close. Your destination is ahead.`);
      }
    } else {
      nextHud.arriving = false;
      nearArrivalSpokenRef.current = false;
    }

    setHud((h) => ({ ...h, ...nextHud }));

    if (!map._userInteracting) map.panTo([lat, lng], { animate: true, duration: 0.6 });
  }, [map, drawRoute, speak, arrivedAtDestination]);

  // ── Start / stop navigation ────────────────────────────────────────
  const startNavigation = useCallback(async () => {
    if (guestNavBlockedRef.current) {
      onGuestBlocked?.();
      return;
    }

    const dest = navDestRef.current;
    if (!dest) {
      setHint('Please choose a destination first.');
      return;
    }
    if (!('geolocation' in navigator)) {
      alert('Your device does not support GPS.');
      return;
    }

    setGoDisabled(true);
    setGoLabel('Getting your location…');

    // Smart location resolver — ported from app.js ~4991–5018.
    async function resolveStartPosition() {
      const MAX_CACHE_AGE_MS = 20000;
      const MAX_CACHE_ACCURACY_M = 80;
      const cached = gps.lastKnownPosRef.current;
      if (cached) {
        const ageMs = Date.now() - cached.timestamp;
        const acc = cached.coords?.accuracy ?? Infinity;
        if (ageMs <= MAX_CACHE_AGE_MS && acc <= MAX_CACHE_ACCURACY_M) return cached;
      }
      return new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          maximumAge: 0,
          timeout: 25000,
        });
      });
    }

    let pos;
    try {
      pos = await resolveStartPosition();
    } catch (err) {
      setGoDisabled(false);
      setGoLabel('Start Navigation');
      const reason =
        err.code === 1
          ? 'Location permission denied — enable it in browser settings.'
          : err.code === 2
            ? 'GPS unavailable. Move to an open area and try again.'
            : 'Could not get your location (timed out). Try again in a moment.';
      setHint(reason);
      return;
    }

    const { latitude: lat, longitude: lng } = pos.coords;
    navUserPosRef.current = { lat, lng };
    gps.lastKnownPosRef.current = pos;

    setGoLabel('Calculating route…');

    let routeData;
    try {
      routeData = await fetchRoute(lat, lng, dest.lat, dest.lng, navModeRef.current);
    } catch (e) {
      setGoDisabled(false);
      setGoLabel('Start Navigation');
      setHint(`Routing failed: ${e.message}. Check your connection.`);
      return;
    }
    navRouteDataRef.current = routeData;

    setDestPanelOpen(false);
    navActiveRef.current = true;
    setNavActive(true);
    onActiveChange?.(true);
    navStepIndexRef.current = 0;
    navArrivalCountRef.current = 0;
    navGpsTicksRef.current = 0;
    navArrivedRef.current = false;
    setHud((h) => ({ ...h, arrived: false, arriving: false }));

    placeDestMarker(dest.lat, dest.lng, dest.name);
    drawRoute(routeData.coords, 0, true);
    updateNavUserDot(lat, lng);

    lastSpokenStepRef.current = 0;
    spokenTurnNowRef.current = false;
    const firstInstruction = routeData.steps[0]?.instruction || 'Head towards your destination';
    speak(`Starting navigation to ${dest.name}. ${firstInstruction}.`);

    updateHUD();

    const bounds = L.latLngBounds(routeData.coords);
    map.fitBounds(bounds, { padding: [80, 80] });

    navWatchIdRef.current = navigator.geolocation.watchPosition(
      (p) => {
        const { latitude, longitude } = p.coords;
        navUserPosRef.current = { lat: latitude, lng: longitude };
        gps.lastKnownPosRef.current = p;
        navGpsTicksRef.current++;

        clearTimeout(navGpsStaleTimerRef.current);
        navGpsStaleTimerRef.current = setTimeout(() => {
          if (navActiveRef.current) setHud((h) => ({ ...h, turnInstruction: 'GPS signal lost — waiting…' }));
        }, 15000);

        updateNavUserDot(latitude, longitude);
        updateHUD();
      },
      (err) => console.warn('Nav GPS err:', err.message),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 }
    );

    setGoDisabled(false);
    setGoLabel('Start Navigation');
  }, [gps, map, placeDestMarker, drawRoute, updateNavUserDot, speak, updateHUD, onActiveChange, onGuestBlocked]);

  const stopNavigation = useCallback(() => {
    navActiveRef.current = false;
    setNavActive(false);
    onActiveChange?.(false);

    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    lastSpokenStepRef.current = -1;
    spokenTurnNowRef.current = false;
    nearArrivalSpokenRef.current = false;

    if (navWatchIdRef.current !== null) {
      navigator.geolocation.clearWatch(navWatchIdRef.current);
      navWatchIdRef.current = null;
    }

    clearRouteLayers();
    if (navDestMarkerRef.current) {
      map.removeLayer(navDestMarkerRef.current);
      navDestMarkerRef.current = null;
    }
    if (navUserMarkerRef.current) {
      if (navUserMarkerRef.current._animFrame) cancelAnimationFrame(navUserMarkerRef.current._animFrame);
      map.removeLayer(navUserMarkerRef.current);
      navUserMarkerRef.current = null;
    }

    clearTimeout(navGpsStaleTimerRef.current);
    navGpsStaleTimerRef.current = null;

    setHud({
      arriving: false,
      arrived: false,
      turnIcon: 'arrow-up',
      turnInstruction: 'Head towards destination',
      turnDist: 'Calculating…',
      nextPreview: '',
      distRemain: '—',
      destName: '',
    });
    navRouteDataRef.current = null;
    navDestRef.current = null;
    navUserPosRef.current = null;
    navStepIndexRef.current = 0;
    navArrivalCountRef.current = 0;
    navGpsTicksRef.current = 0;
    setDestInputValue('');
    setGoDisabled(true);
  }, [map, clearRouteLayers, onActiveChange]);

  stopNavigationRef.current = stopNavigation;

  const handleHudClose = useCallback(() => {
    // eslint-disable-next-line no-alert
    if (confirm('End navigation?')) stopNavigation();
  }, [stopNavigation]);

  // ── body.nav-panel-open — only reflects the *destination* panel being
  // shown, not active navigation (legacy's `setNavPanelVisible(false)` is
  // called the instant a route is found, app.js ~5049 — see
  // MapShell.module.css's `:global(.nav-panel-open)` rule for the desktop
  // map-offset it drives). ─────────────────────────────────────────────
  useEffect(() => {
    destPanelOpenRef.current = destPanelOpen;
    document.body.classList.toggle('nav-panel-open', destPanelOpen);
    return () => document.body.classList.remove('nav-panel-open');
  }, [destPanelOpen]);

  // Unmount this whole controller once there's nothing left to show —
  // this port's equivalent of legacy leaving both panels simply hidden.
  useEffect(() => {
    if (!destPanelOpen && !navActive) onRequestClose?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destPanelOpen, navActive]);

  useEffect(() => {
    navModeRef.current = mode;
  }, [mode]);

  useImperativeHandle(
    ref,
    () => ({
      requestLaunchToggle() {
        if (navActiveRef.current) {
          stopNavigation();
          return;
        }
        setDestPanelOpen((v) => !v);
      },
    }),
    [stopNavigation]
  );

  // Full teardown on unmount (covers navigating away entirely, not just
  // the user-driven stop/close paths above).
  useEffect(
    () => () => {
      if (navWatchIdRef.current !== null) navigator.geolocation.clearWatch(navWatchIdRef.current);
      clearTimeout(navGpsStaleTimerRef.current);
      clearTimeout(navDropDebounceRef.current);
      if (navClickAbortRef.current) navClickAbortRef.current.abort();
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      clearRouteLayers();
      if (navDestMarkerRef.current) map.removeLayer(navDestMarkerRef.current);
      if (navUserMarkerRef.current) {
        if (navUserMarkerRef.current._animFrame) cancelAnimationFrame(navUserMarkerRef.current._animFrame);
        map.removeLayer(navUserMarkerRef.current);
      }
      document.body.classList.remove('nav-panel-open');
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  return (
    <>
      {destPanelOpen && (
        <NavDestPanel
          mode={mode}
          onModeChange={setMode}
          destInputValue={destInputValue}
          onDestInputChange={onDestInputChange}
          dropdownResults={dropdownResults}
          onPickResult={setNavDest}
          icon={searchIndex.icon}
          highlight={searchIndex.highlight}
          onGo={startNavigation}
          goDisabled={goDisabled}
          goLabel={goLabel}
          hint={hint}
          onClose={() => setDestPanelOpen(false)}
        />
      )}
      {navActive && (
        <NavHud
          arriving={hud.arriving}
          arrived={hud.arrived}
          turnIcon={hud.turnIcon}
          turnInstruction={hud.turnInstruction}
          turnDist={hud.turnDist}
          nextPreview={hud.nextPreview}
          distRemain={hud.distRemain}
          destName={hud.destName}
          voiceEnabled={voiceEnabled}
          onToggleVoice={() => {
            setVoiceEnabled((v) => {
              const next = !v;
              if (!next && 'speechSynthesis' in window) window.speechSynthesis.cancel();
              return next;
            });
          }}
          onClose={handleHudClose}
        />
      )}
      {arrivedBannerDest && <NavArrivedBanner destName={arrivedBannerDest} onDismiss={dismissArrivedBanner} />}
    </>
  );
});

export default NavigationController;
