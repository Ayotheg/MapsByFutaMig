import { useCallback, useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { haversine } from '../../lib/geoUtils';
import { SMOOTH_WALK, SMOOTH_VEHICLE, VEHICLE_SPEED_KMH, TRAIL_MAX, tier } from './gpsConstants';
import { announceCurrentLocation } from './announceLocation';
import { subscribeGps, restartGpsWatch, gpsErrorText } from './gpsWatch';
import { unlockSpeech } from '../../lib/speech';
import './navMapLayers.css';

// "Find my location" waits this long for a fix inside the accuracy
// threshold (anything better than `poor`) before settling for the best
// reading it has and labelling it approximate.
const ACQUIRE_FALLBACK_MS = 18000;
// A fix the live watcher delivered this recently is current enough to use
// on tap without restarting acquisition.
const RECENT_FIX_MS = 10000;

// ── Divicon caches, module-scope like legacy's `_dotIconCache`/`_arrowIconCache` ──
const dotIconCache = {};
const arrowIconCache = {};

function makeDot(color) {
  if (dotIconCache[color]) return dotIconCache[color];
  dotIconCache[color] = L.divIcon({
    className: '',
    html: `<div class="gps-dot-wrap"><div class="gps-dot-pulse" style="background:${color};"></div><div class="gps-dot-core" style="background:${color};"></div></div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
  return dotIconCache[color];
}

function makeArrow(heading, color) {
  const h = Math.round(heading / 5) * 5;
  const key = `${h}_${color}`;
  if (arrowIconCache[key]) return arrowIconCache[key];
  arrowIconCache[key] = L.divIcon({
    className: '',
    html: `<div class="gps-arrow-wrap" style="transform:rotate(${h}deg);"><svg width="26" height="26" viewBox="0 0 26 26"><polygon points="13,2 22,22 13,16 4,22" fill="${color}" fill-opacity=".9" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/></svg></div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
  return arrowIconCache[key];
}

// ── Fix 2: Dead Reckoning ────────────────────────────────────────────────
// Between GPS fixes (every ~1–2 s) the dot freezes then jumps. DeviceMotion
// accelerometer events (~10–50 Hz) nudge the smoothed position forward
// between fixes. Ported 1:1 from legacy's `DR` IIFE (app.js ~1389–1493),
// including its comments — see there for the full physics writeup.
function createDeadReckoning({ getSmoothed, applyNudge }) {
  let active = false;
  let vx = 0,
    vy = 0;
  let dx = 0,
    dy = 0;
  let lastT = null;
  let baseLat = null,
    baseLng = null;

  const M_PER_LAT = 111320;
  const mPerLng = (lat) => 111320 * Math.cos((lat * Math.PI) / 180);
  const DECAY = 0.85;
  const ACCEL_THRESHOLD = 0.08;

  function onMotion(e) {
    if (!active || baseLat === null) return;
    const ag = e.accelerationIncludingGravity;
    if (!ag) return;

    const now = e.timeStamp || Date.now();
    if (lastT === null) {
      lastT = now;
      return;
    }
    const dt = Math.min((now - lastT) / 1000, 0.1);
    lastT = now;

    let ax = ag.x || 0;
    let ay = ag.y || 0;
    if (Math.abs(ax) < ACCEL_THRESHOLD) ax = 0;
    if (Math.abs(ay) < ACCEL_THRESHOLD) ay = 0;

    const decayFactor = Math.pow(DECAY, dt);
    vx = (vx + ax * dt) * decayFactor;
    vy = (vy + ay * dt) * decayFactor;

    const spd = Math.sqrt(vx * vx + vy * vy);
    if (spd > 12) {
      vx *= 12 / spd;
      vy *= 12 / spd;
    }

    dx += vx * dt;
    dy += vy * dt;

    const nudgeLat = baseLat + dy / M_PER_LAT;
    const nudgeLng = baseLng + dx / mPerLng(baseLat);

    if (getSmoothed().lat !== null) {
      applyNudge(nudgeLat, nudgeLng);
    }
  }

  return {
    anchor(lat, lng) {
      baseLat = lat;
      baseLng = lng;
      dx = 0;
      dy = 0;
      vx = 0;
      vy = 0;
      lastT = null;
    },
    start() {
      if (active) return;
      active = true;
      lastT = null;
      if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
        DeviceMotionEvent.requestPermission()
          .then((r) => {
            if (r === 'granted') window.addEventListener('devicemotion', onMotion);
          })
          .catch(() => {});
      } else {
        window.addEventListener('devicemotion', onMotion);
      }
    },
    stop() {
      active = false;
      window.removeEventListener('devicemotion', onMotion);
      vx = 0;
      vy = 0;
      dx = 0;
      dy = 0;
      baseLat = null;
      baseLng = null;
      lastT = null;
    },
  };
}

const TIER_COLOR = { good: '#00c896', fair: '#ffc107', poor: '#ff4d4d' };

/**
 * Ported from legacy `app.js` ~1208–1590 (accuracy gauge, warm-up watcher,
 * `onPositionUpdate`, the GPS `#gpsBtn` start/stop handler, Fix 1/Fix 2's
 * warm-up-watcher-vs-tracking-watcher exclusivity + dead reckoning).
 *
 * Raw-Leaflet, per CLAUDE.md: the dot/arrow/accuracy-circle/trail layers
 * are managed imperatively via refs, not React state, same as every other
 * marker layer in this project.
 *
 * `hidden` (driven by nav-active state, lifted to MapPage) mirrors
 * legacy's `if (window.NAV && window.NAV.isActive())` early-return inside
 * `onPositionUpdate` (app.js ~1512–1515) — while true, a live GPS fix
 * still updates `lastKnownPos`/the gauge (nav's own "smart location
 * resolver" and the sidebar gauge both still need it), but the
 * accuracy-circle is torn down and the dot/arrow markers are hidden via
 * opacity rather than removed, matching legacy's
 * `gpsMarker.setOpacity(0)` at nav start / `setOpacity(1)` at nav stop
 * (app.js ~5067–5068, ~5137–5138) — not this hook's own concern to
 * recreate them, so the marker instances persist and just fade.
 */
export function useGpsTracking(map, { hidden = false } = {}) {
  const [state, setState] = useState({
    tier: 'poor',
    isTracking: false,
    // Live tracking: the dot, map, speed and heading follow every fix.
    // Only possible once "Find my location" has placed the dot.
    isFollowing: false,
    isWarmedUp: false,
    accuracyText: '—',
    speedText: '—',
    headingText: '—°',
    signalBadgeText: 'INACTIVE',
    signalBadgeClass: '',
    activeBars: 0,
    warning: { visible: false, poor: false, text: '' },
    gpsBtnDisabled: false,
    gpsBtnLabel: 'FIND MY LOCATION',
    // True between a "Find my location" tap and the fix it accepts.
    acquiring: false,
    // True while the shown position is the weak-signal fallback fix.
    approximate: false,
    // Message for the last GeolocationPositionError, null once a fix lands.
    error: null,
  });

  const lastKnownPosRef = useRef(null);
  const lastFixAtRef = useRef(0);
  const lastAccuracyRef = useRef(Infinity);
  const isWarmedUpRef = useRef(false);
  const isTrackingRef = useRef(false);
  const followRef = useRef(false);
  const hiddenRef = useRef(hidden);
  hiddenRef.current = hidden;

  const acquiringRef = useRef(false);
  const approximateRef = useRef(false);
  const bestFixRef = useRef(null);
  const acquireTimerRef = useRef(null);

  const gpsMarkerRef = useRef(null);
  const headingMarkerRef = useRef(null);
  const accCircleRef = useRef(null);
  const trailLineRef = useRef(null);
  const trailPtsRef = useRef([]);
  const smoothRef = useRef({ lat: null, lng: null });

  const drRef = useRef(null);
  if (!drRef.current) {
    drRef.current = createDeadReckoning({
      getSmoothed: () => smoothRef.current,
      applyNudge: (lat, lng) => {
        smoothRef.current = { lat, lng };
        if (gpsMarkerRef.current) gpsMarkerRef.current.setLatLng([lat, lng]);
        if (headingMarkerRef.current) headingMarkerRef.current.setLatLng([lat, lng]);
        if (accCircleRef.current) accCircleRef.current.setLatLng([lat, lng]);
      },
    });
  }

  const smoothPos = useCallback((rawLat, rawLng, spd) => {
    const a = spd > VEHICLE_SPEED_KMH ? SMOOTH_VEHICLE : SMOOTH_WALK;
    const s = smoothRef.current;
    if (s.lat === null) {
      smoothRef.current = { lat: rawLat, lng: rawLng };
    } else {
      smoothRef.current = { lat: a * rawLat + (1 - a) * s.lat, lng: a * rawLng + (1 - a) * s.lng };
    }
    return smoothRef.current;
  }, []);

  const updateGauge = useCallback((accuracy, speedKmh, headingDeg) => {
    lastAccuracyRef.current = accuracy;
    const t = tier(accuracy);
    const nBars = { good: 5, fair: 3, poor: 1 }[t];
    const isTracking = isTrackingRef.current;
    const acquiring = acquiringRef.current;
    const approximate = approximateRef.current;
    const following = followRef.current;

    setState((prev) => {
      const next = { ...prev };
      next.tier = t;
      next.isTracking = isTracking;
      next.isFollowing = following;
      next.acquiring = acquiring;
      next.approximate = approximate;
      next.error = null;
      next.activeBars = nBars;
      next.signalBadgeClass = following && !acquiring ? 'tracking' : t;
      next.signalBadgeText = acquiring ? 'LOCATING' : following ? 'LIVE' : t.toUpperCase();
      // The live reading is shown even while warming up, so "weak
      // readings" can be told apart from "no readings at all".
      const acc = `±${Math.round(accuracy)}m`;
      next.accuracyText = acquiring ? `Warming up · ${acc}` : approximate ? `Approximate · ${acc}` : acc;
      next.speedText = speedKmh !== null && speedKmh >= 0 ? `${speedKmh.toFixed(1)} km/h` : '—';
      if (headingDeg !== null && headingDeg >= 0) {
        const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
        next.headingText = `${Math.round(headingDeg)}° ${dirs[Math.round(headingDeg / 45) % 8]}`;
      } else {
        next.headingText = '—°';
      }

      if (!isTracking) {
        if (t === 'good') {
          next.warning = { visible: false, poor: false, text: '' };
          next.gpsBtnDisabled = false;
          next.gpsBtnLabel = 'FIND MY LOCATION';
        } else if (t === 'fair') {
          next.warning = { visible: true, poor: false, text: 'Weak signal. May be off ~100m. Go outdoors.' };
          next.gpsBtnDisabled = false;
          next.gpsBtnLabel = 'LOCATE ANYWAY';
        } else {
          // No longer a dead end: tapping still starts acquisition, which
          // falls back to an approximate fix (see ACQUIRE_FALLBACK_MS).
          next.warning = { visible: true, poor: true, text: 'Signal too weak. Step outside.' };
          next.gpsBtnDisabled = false;
          next.gpsBtnLabel = 'LOCATE ANYWAY';
        }
      } else {
        next.gpsBtnDisabled = false;
        next.gpsBtnLabel = 'STOP TRACKING';
        next.warning = approximate
          ? { visible: true, poor: false, text: `Approximate location (${acc}). Go outdoors for a better fix.` }
          : { visible: false, poor: false, text: '' };
      }
      return next;
    });
  }, []);

  const onPositionUpdate = useCallback(
    (pos) => {
      lastKnownPosRef.current = pos;
      const rawLat = pos.coords.latitude;
      const rawLng = pos.coords.longitude;
      const accuracy = pos.coords.accuracy;
      const spd = (pos.coords.speed || 0) * 3.6;
      const hdg = pos.coords.heading;

      updateGauge(accuracy, spd, hdg);
      const { lat: sLat, lng: sLng } = smoothPos(rawLat, rawLng, spd);
      const ll = [sLat, sLng];

      drRef.current.anchor(sLat, sLng);
      const t = tier(accuracy);
      const c = TIER_COLOR[t];

      if (hiddenRef.current) {
        if (accCircleRef.current) {
          map.removeLayer(accCircleRef.current);
          accCircleRef.current = null;
        }
        return;
      }

      if (!accCircleRef.current) {
        accCircleRef.current = L.circle(ll, { radius: accuracy, color: c, fillColor: c, fillOpacity: 0.07, weight: 1 }).addTo(map);
      } else {
        accCircleRef.current.setLatLng(ll);
        accCircleRef.current.setRadius(accuracy);
        accCircleRef.current.setStyle({ color: c, fillColor: c });
      }

      if (!gpsMarkerRef.current) {
        gpsMarkerRef.current = L.marker(ll, { icon: makeDot(c), zIndexOffset: 1000 }).addTo(map).bindPopup('');
      } else {
        gpsMarkerRef.current.setLatLng(ll);
        gpsMarkerRef.current.setIcon(makeDot(c));
      }
      gpsMarkerRef.current.setPopupContent(
        `<strong style="color:${c}">You Are Here</strong><br><small>±${Math.round(accuracy)}m · ${spd.toFixed(1)} km/h</small>`
      );

      if (hdg !== null && spd > 1) {
        if (!headingMarkerRef.current) headingMarkerRef.current = L.marker(ll, { icon: makeArrow(hdg, c), zIndexOffset: 999 }).addTo(map);
        else {
          headingMarkerRef.current.setLatLng(ll);
          headingMarkerRef.current.setIcon(makeArrow(hdg, c));
        }
      } else if (headingMarkerRef.current) {
        map.removeLayer(headingMarkerRef.current);
        headingMarkerRef.current = null;
      }

      // A one-off "Find my location" fix: centre on it, no trail.
      if (!followRef.current) {
        map.panTo(ll, { animate: true, duration: 0.8, easeLinearity: 0.5 });
        return;
      }

      // Trail: only record a point if the user moved ≥3 m.
      const trailPts = trailPtsRef.current;
      const lastPt = trailPts[trailPts.length - 1];
      const movedM = lastPt ? haversine(lastPt[0], lastPt[1], ll[0], ll[1]) : Infinity;
      if (movedM >= 3) {
        trailPts.push(ll);
        if (trailPts.length > TRAIL_MAX) trailPts.shift();
      }

      if (!trailLineRef.current) {
        trailLineRef.current = L.polyline(trailPts, { color: c, weight: 3, opacity: 0.55, dashArray: '2 7' }).addTo(map);
      } else {
        trailLineRef.current.setLatLngs(trailPts);
        trailLineRef.current.setStyle({ color: c });
      }

      if (!map._userInteracting) map.panTo(ll, { animate: true, duration: 0.8, easeLinearity: 0.5 });
    },
    [map, smoothPos, updateGauge]
  );

  // Hide/restore dot+arrow markers when nav becomes active/inactive —
  // mirrors legacy's `gpsMarker.setOpacity(0/1)` at nav start/stop.
  useEffect(() => {
    if (gpsMarkerRef.current) gpsMarkerRef.current.setOpacity(hidden ? 0 : 1);
    if (headingMarkerRef.current) headingMarkerRef.current.setOpacity(hidden ? 0 : 1);
    if (hidden && accCircleRef.current && map) {
      map.removeLayer(accCircleRef.current);
      accCircleRef.current = null;
    }
  }, [hidden, map]);

  const stopTracking = useCallback(() => {
    clearTimeout(acquireTimerRef.current);
    acquiringRef.current = false;
    approximateRef.current = false;
    bestFixRef.current = null;
    isTrackingRef.current = false;
    followRef.current = false;
    drRef.current.stop();
    if (gpsMarkerRef.current) {
      map.removeLayer(gpsMarkerRef.current);
      gpsMarkerRef.current = null;
    }
    if (trailLineRef.current) {
      map.removeLayer(trailLineRef.current);
      trailLineRef.current = null;
    }
    if (headingMarkerRef.current) {
      map.removeLayer(headingMarkerRef.current);
      headingMarkerRef.current = null;
    }
    if (accCircleRef.current) {
      map.removeLayer(accCircleRef.current);
      accCircleRef.current = null;
    }
    trailPtsRef.current = [];
    smoothRef.current = { lat: null, lng: null };
  }, [map]);

  // The fix "Find my location" settles on — the only place the voice
  // announcement is triggered, always with the coordinates of this fix.
  const acceptFix = useCallback(
    (pos, approximate) => {
      clearTimeout(acquireTimerRef.current);
      acquiringRef.current = false;
      approximateRef.current = approximate;
      bestFixRef.current = null;
      announceCurrentLocation(pos.coords.latitude, pos.coords.longitude, { approximate });
      onPositionUpdate(pos);
    },
    [onPositionUpdate]
  );

  const failWithError = useCallback(
    (text, accuracyText) => {
      stopTracking();
      setState((s) => ({
        ...s,
        isTracking: false,
        isFollowing: false,
        acquiring: false,
        approximate: false,
        error: text,
        accuracyText,
        signalBadgeText: 'INACTIVE',
        signalBadgeClass: '',
        activeBars: 0,
        warning: { visible: true, poor: true, text },
        gpsBtnDisabled: false,
        gpsBtnLabel: 'RETRY',
      }));
    },
    [stopTracking]
  );

  const handleFix = useCallback(
    (pos) => {
      lastKnownPosRef.current = pos;
      lastFixAtRef.current = Date.now();
      if (!isWarmedUpRef.current) {
        isWarmedUpRef.current = true;
        setState((s) => ({ ...s, isWarmedUp: true }));
      }
      const accuracy = pos.coords.accuracy;

      if (acquiringRef.current) {
        if (!bestFixRef.current || accuracy <= bestFixRef.current.coords.accuracy) bestFixRef.current = pos;
        if (tier(accuracy) !== 'poor') acceptFix(pos, false);
        else updateGauge(accuracy, null, null);
        return;
      }
      if (isTrackingRef.current) {
        const upgrade = approximateRef.current && tier(accuracy) !== 'poor';
        if (upgrade) approximateRef.current = false;
        // Without live tracking the dot stays where it was found, except
        // that an approximate fix is replaced by the first good one.
        if (followRef.current || upgrade) onPositionUpdate(pos);
        else updateGauge(accuracy, null, null);
      } else {
        updateGauge(accuracy, null, null);
      }
    },
    [acceptFix, onPositionUpdate, updateGauge]
  );

  const handleError = useCallback(
    (err) => {
      if (acquiringRef.current && err.code === 3 && bestFixRef.current) {
        acceptFix(bestFixRef.current, true);
        return;
      }
      // A timeout between fixes while already tracking isn't fatal — the
      // watch keeps running and the next fix carries on.
      if (isTrackingRef.current && !acquiringRef.current && err.code === 3) {
        console.warn('GPS err:', err.message);
        return;
      }
      failWithError(gpsErrorText(err), err.code === 1 ? 'Location blocked' : err.code === 2 ? 'GPS unavailable' : 'No GPS signal');
    },
    [acceptFix, failWithError]
  );

  // ── Subscribes to the shared watcher unconditionally on mount, matching
  // legacy's unconditional warm-up `if (navigator.geolocation) {...}` at
  // script load (app.js ~1301–1313). Real, flagged consequence: this means
  // GPS warm-up begins on first paint regardless of whether the sidebar's
  // GPS panel is even open — see the Slice 9 tracker note on why the GPS
  // *tracking* logic (this hook) is NOT part of the Slice 9 lazy-load
  // boundary even though the Navigation feature (destination search +
  // HUD) is. Warm-up and tracking are the same subscription now (see
  // gpsWatch.js); the handlers go through refs so it's made exactly once.
  const handleFixRef = useRef(handleFix);
  const handleErrorRef = useRef(handleError);
  handleFixRef.current = handleFix;
  handleErrorRef.current = handleError;

  useEffect(() => {
    if (!navigator.geolocation) return undefined;
    setState((s) => ({ ...s, accuracyText: 'Warming up…' }));
    const unsubscribe = subscribeGps(
      (pos) => handleFixRef.current(pos),
      (err) => handleErrorRef.current(err)
    );
    return () => {
      unsubscribe();
      clearTimeout(acquireTimerRef.current);
      drRef.current.stop();
    };
  }, []);

  const toggleTracking = useCallback(() => {
    if (!navigator.geolocation) {
      alert('Geolocation not supported.');
      return;
    }
    if (isTrackingRef.current) {
      stopTracking();
      setState((s) => ({
        ...s,
        isTracking: false,
        isFollowing: false,
        acquiring: false,
        approximate: false,
        signalBadgeText: s.tier.toUpperCase(),
        signalBadgeClass: s.tier,
        speedText: '—',
        headingText: '—°',
        gpsBtnLabel: 'FIND MY LOCATION',
        gpsBtnDisabled: false,
        warning: { visible: false, poor: false, text: '' },
      }));
      return;
    }

    // Also the retry path: every tap resets the acquisition state below.
    unlockSpeech();
    isTrackingRef.current = true;
    approximateRef.current = false;
    bestFixRef.current = null;
    smoothRef.current = { lat: null, lng: null };
    trailPtsRef.current = [];

    // Speak the current location out loud on every "Find my location"
    // tap — see announceLocation.js. Only a fix the live watcher delivered
    // moments ago is used straight away; otherwise the watch is restarted
    // and the announcement waits for the fix that acquisition accepts.
    const recent = lastKnownPosRef.current;
    if (recent && Date.now() - lastFixAtRef.current <= RECENT_FIX_MS && tier(recent.coords.accuracy) !== 'poor') {
      acceptFix(recent, false);
      return;
    }

    acquiringRef.current = true;
    setState((s) => ({
      ...s,
      isTracking: true,
      acquiring: true,
      approximate: false,
      error: null,
      accuracyText: 'Warming up…',
      signalBadgeText: 'LOCATING',
      signalBadgeClass: '',
      warning: { visible: false, poor: false, text: '' },
      gpsBtnDisabled: false,
      gpsBtnLabel: 'STOP TRACKING',
    }));
    restartGpsWatch();
    clearTimeout(acquireTimerRef.current);
    acquireTimerRef.current = setTimeout(() => {
      if (!acquiringRef.current) return;
      if (bestFixRef.current) acceptFix(bestFixRef.current, true);
      else failWithError('No GPS readings yet. Turn on Location, move outdoors, then retry.', 'No GPS signal');
    }, ACQUIRE_FALLBACK_MS);
  }, [stopTracking, acceptFix, failWithError]);

  // Live tracking switch. Needs a found location first (see toggleTracking);
  // switching it off freezes the dot where it is, Stop tracking clears it.
  const toggleFollow = useCallback(() => {
    if (!isTrackingRef.current || acquiringRef.current) return;
    if (followRef.current) {
      followRef.current = false;
      drRef.current.stop();
      if (trailLineRef.current) {
        map.removeLayer(trailLineRef.current);
        trailLineRef.current = null;
      }
      if (headingMarkerRef.current) {
        map.removeLayer(headingMarkerRef.current);
        headingMarkerRef.current = null;
      }
      trailPtsRef.current = [];
      setState((s) => ({
        ...s,
        isFollowing: false,
        signalBadgeText: s.tier.toUpperCase(),
        signalBadgeClass: s.tier,
        speedText: '—',
        headingText: '—°',
      }));
      return;
    }
    followRef.current = true;
    drRef.current.start();
    setState((s) => ({ ...s, isFollowing: true, signalBadgeText: 'LIVE', signalBadgeClass: 'tracking' }));
    if (lastKnownPosRef.current) onPositionUpdate(lastKnownPosRef.current);
  }, [map, onPositionUpdate]);

  return {
    ...state,
    toggleTracking,
    toggleFollow,
    lastKnownPosRef,
  };
}
