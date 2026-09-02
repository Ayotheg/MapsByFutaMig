import { useCallback, useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { haversine } from '../../lib/geoUtils';
import { SMOOTH_WALK, SMOOTH_VEHICLE, VEHICLE_SPEED_KMH, TRAIL_MAX, tier } from './gpsConstants';
import './navMapLayers.css';

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
export function useGpsTracking(map, { hidden = false, navigationMode = false } = {}) {
  const [state, setState] = useState({
    tier: 'poor',
    isTracking: false,
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
  });

  const lastKnownPosRef = useRef(null);
  const lastAccuracyRef = useRef(Infinity);
  const isWarmedUpRef = useRef(false);
  const isTrackingRef = useRef(false);
  const hiddenRef = useRef(hidden);
  const navigationModeRef = useRef(navigationMode);
  hiddenRef.current = hidden;
  navigationModeRef.current = navigationMode;

  const mapRotationRef = useRef(0);
  const rotationThrottleRef = useRef(0);

  const applyMapRotation = useCallback((headingDeg, speedKmh) => {
    if (!map || !map.getContainer) return;

    const container = map.getContainer();
    if (!container) return;

    const setContainerRotation = (deg) => {
      container.style.transformOrigin = 'center center';
      container.style.transform = `rotate(${deg}deg)`;
      container.style.willChange = 'transform';
    };

    if (!Number.isFinite(headingDeg) || headingDeg < 0 || headingDeg > 360) {
      if (!navigationModeRef.current && Math.abs(mapRotationRef.current) > 0.1) {
        container.style.transition = 'transform 700ms ease-out';
        setContainerRotation(0);
        mapRotationRef.current = 0;
      }
      return;
    }

    const moving = speedKmh !== null && speedKmh >= 1.5;
    const target = -headingDeg;
    const current = mapRotationRef.current || 0;
    const delta = Math.abs((((target - current) + 540) % 360) - 180);
    const threshold = navigationModeRef.current ? 3 : moving ? 8 : 12;
    const now = Date.now();

    if (delta < threshold && now - rotationThrottleRef.current < 900 && !navigationModeRef.current) return;
    if (!moving && !navigationModeRef.current && delta < 15) return;

    container.style.transition = navigationModeRef.current ? 'transform 180ms ease-out' : 'transform 420ms ease-out';
    setContainerRotation(target);
    mapRotationRef.current = target;
    rotationThrottleRef.current = now;
  }, [map]);

  const warmupWatchIdRef = useRef(null);
  const watchIdRef = useRef(null);

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

    setState((prev) => {
      const next = { ...prev };
      next.tier = t;
      next.isTracking = isTracking;
      next.activeBars = nBars;
      next.signalBadgeClass = isTracking ? 'tracking' : t;
      next.signalBadgeText = isTracking ? 'LIVE' : t.toUpperCase();
      next.accuracyText = `±${Math.round(accuracy)}m`;
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
          next.warning = { visible: true, poor: true, text: 'Signal too weak. Step outside.' };
          next.gpsBtnDisabled = true;
          next.gpsBtnLabel = 'SIGNAL TOO WEAK';
        }
      }
      return next;
    });
  }, []);

  // ── Warm-up watcher — starts unconditionally on mount, matching
  // legacy's unconditional `if (navigator.geolocation) {...}` at script
  // load (app.js ~1301–1313). Real, flagged consequence: this means GPS
  // warm-up begins on first paint regardless of whether the sidebar's GPS
  // panel is even open — see this session's tracker note on why the GPS
  // *tracking* logic (this hook) is NOT part of the Slice 9 lazy-load
  // boundary even though the Navigation feature (destination search +
  // HUD) is.
  useEffect(() => {
    if (!navigator.geolocation) return;
    setState((s) => ({ ...s, accuracyText: 'Warming up…' }));
    warmupWatchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        isWarmedUpRef.current = true;
        lastKnownPosRef.current = pos;
        setState((s) => (s.isWarmedUp ? s : { ...s, isWarmedUp: true }));
        if (!isTrackingRef.current) updateGauge(pos.coords.accuracy, null, null);
      },
      () => setState((s) => ({ ...s, accuracyText: 'GPS unavailable' })),
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
    );
    return () => {
      if (warmupWatchIdRef.current !== null) navigator.geolocation.clearWatch(warmupWatchIdRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      applyMapRotation(hdg, spd);

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
    [map, smoothPos, updateGauge, applyMapRotation]
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

  const toggleTracking = useCallback(() => {
    if (!navigator.geolocation) {
      alert('Geolocation not supported.');
      return;
    }
    if (isTrackingRef.current) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
      isTrackingRef.current = false;
      drRef.current.stop();
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

      if (warmupWatchIdRef.current === null) {
        warmupWatchIdRef.current = navigator.geolocation.watchPosition(
          (pos) => {
            lastKnownPosRef.current = pos;
            updateGauge(pos.coords.accuracy, null, null);
          },
          () => {},
          { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
        );
      }
      setState((s) => ({ ...s, isTracking: false, gpsBtnLabel: 'FIND MY LOCATION', gpsBtnDisabled: false }));
    } else {
      if (!isWarmedUpRef.current) {
        alert('GPS warming up, wait a moment.');
        return;
      }
      if (tier(lastAccuracyRef.current) === 'poor') return;
      if (warmupWatchIdRef.current !== null) {
        navigator.geolocation.clearWatch(warmupWatchIdRef.current);
        warmupWatchIdRef.current = null;
      }
      isTrackingRef.current = true;
      smoothRef.current = { lat: null, lng: null };
      trailPtsRef.current = [];
      drRef.current.start();
      setState((s) => ({ ...s, isTracking: true, gpsBtnLabel: 'STOP TRACKING' }));
      watchIdRef.current = navigator.geolocation.watchPosition(onPositionUpdate, (err) => console.warn('GPS err:', err.message), {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 20000,
      });
    }
  }, [map, onPositionUpdate, updateGauge]);

  // Cleanup all watchers/layers on unmount.
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
      if (map && map.getContainer) {
        const container = map.getContainer();
        container.style.transform = 'rotate(0deg)';
        container.style.transition = 'transform 200ms ease-out';
      }
      drRef.current.stop();
    };
  }, [map]);

  return {
    ...state,
    toggleTracking,
    applyMapRotation,
    lastKnownPosRef,
  };
}
