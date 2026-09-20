import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, ZoomIn, ZoomOut, RotateCcw, ChevronLeft, ChevronRight } from 'lucide-react';
import styles from './PhotoLightbox.module.css';

const MIN_SCALE = 1;
const MAX_SCALE = 5;
const DOUBLE_TAP_SCALE = 2.5;
const DOUBLE_TAP_MS = 300;
const TAP_SLOP_PX = 8;
const SWIPE_MIN_PX = 60;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/**
 * Full-screen photo viewer for PlaceCard's hero image.
 *
 * Why this exists: the hero image in the card is a 192px-tall `object-fit:
 * cover` crop, so photos look small and soft. Tapping it now opens the
 * whole, uncropped photo at full-screen size with a zoom tool.
 *
 * Zoom tool:
 *  - toolbar: − / slider / + / reset, plus a live % readout
 *  - pinch (two fingers), double-tap / double-click, mouse wheel and
 *    trackpad pinch (ctrl+wheel) — all zoom around the pointer
 *  - drag to pan when zoomed in (pan is clamped so the photo can't be
 *    flung off screen)
 *  - when NOT zoomed, swipe left/right (or ←/→) moves between photos
 *  - Esc, the ✕ button, or tapping the dark area outside the photo closes
 *
 * `photos` is the same `imageUrls` array PlaceCard already has; `index` /
 * `onIndexChange` keep PlaceCard's hero image in sync with what's being
 * viewed, so closing the viewer lands on the photo the user last looked at.
 *
 * Rendered through a portal to <body> so PlaceCard's `overflow: hidden` /
 * `transform` (which would otherwise trap `position: fixed`) can't clip it.
 */
export default function PhotoLightbox({ photos, index, onIndexChange, onClose, title }) {
  const src = photos[index];

  const stageRef = useRef(null);
  const imgRef = useRef(null);
  const closeBtnRef = useRef(null);

  // View transform lives in a ref (so pointer handlers always see the latest
  // value with no stale closures) and is mirrored into state to re-render.
  const viewRef = useRef({ s: 1, x: 0, y: 0 });
  const [view, setView] = useState(viewRef.current);
  const [smooth, setSmooth] = useState(false); // animate button / double-tap zooms only
  const [fit, setFit] = useState({ w: 0, h: 0 }); // photo size at scale 1 (px)
  const [status, setStatus] = useState('loading'); // loading | ready | error

  const pointers = useRef(new Map()); // pointerId -> {x, y}
  const gesture = useRef(null); // { type: 'pan'|'pinch', ... }
  const tapRef = useRef({ t: 0, x: 0, y: 0 });
  const natural = useRef({ w: 0, h: 0 });

  // ── geometry ───────────────────────────────────────────────────────────
  const computeFit = useCallback(() => {
    const stage = stageRef.current;
    const { w: nw, h: nh } = natural.current;
    if (!stage || !nw || !nh) return;
    const ratio = Math.min(stage.clientWidth / nw, stage.clientHeight / nh);
    setFit({ w: nw * ratio, h: nh * ratio });
  }, []);

  // Keep the photo from being panned out of view: at scale s the photo is
  // (fit * s) big; it may only travel by half the overflow past the stage.
  const clampView = useCallback(
    (s, x, y) => {
      const stage = stageRef.current;
      const scale = clamp(s, MIN_SCALE, MAX_SCALE);
      if (!stage) return { s: scale, x, y };
      const maxX = Math.max(0, (fit.w * scale - stage.clientWidth) / 2);
      const maxY = Math.max(0, (fit.h * scale - stage.clientHeight) / 2);
      return {
        s: scale,
        x: scale === MIN_SCALE ? 0 : clamp(x, -maxX, maxX),
        y: scale === MIN_SCALE ? 0 : clamp(y, -maxY, maxY),
      };
    },
    [fit.w, fit.h],
  );

  const commit = useCallback(
    (next) => {
      viewRef.current = clampView(next.s, next.x, next.y);
      setView(viewRef.current);
    },
    [clampView],
  );

  // Zoom to `nextScale`, keeping the point (cx, cy) — measured from the
  // stage centre — fixed under the finger/cursor.
  const zoomAt = useCallback(
    (nextScale, cx = 0, cy = 0) => {
      const { s, x, y } = viewRef.current;
      const s2 = clamp(nextScale, MIN_SCALE, MAX_SCALE);
      const ratio = s2 / s;
      commit({ s: s2, x: cx - (cx - x) * ratio, y: cy - (cy - y) * ratio });
    },
    [commit],
  );

  const toStagePoint = (clientX, clientY) => {
    const r = stageRef.current.getBoundingClientRect();
    return { x: clientX - (r.left + r.width / 2), y: clientY - (r.top + r.height / 2) };
  };

  const animated = (fn) => {
    setSmooth(true);
    fn();
  };

  const resetView = useCallback(() => {
    viewRef.current = { s: 1, x: 0, y: 0 };
    setView(viewRef.current);
  }, []);

  // ── photo changes ──────────────────────────────────────────────────────
  useLayoutEffect(() => {
    // New photo: reset zoom, then either show the loader until it decodes or,
    // if the browser already has it cached (`complete`), go straight to ready
    // — a cached image can finish before React attaches onLoad.
    natural.current = { w: 0, h: 0 };
    setFit({ w: 0, h: 0 });
    setSmooth(false);
    resetView();
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth) {
      natural.current = { w: img.naturalWidth, h: img.naturalHeight };
      computeFit();
      setStatus('ready');
    } else {
      setStatus('loading');
    }
  }, [src, computeFit, resetView]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => {
      computeFit();
      commit(viewRef.current); // re-clamp for the new size
    });
    ro.observe(stage);
    return () => ro.disconnect();
  }, [computeFit, commit]);

  const go = useCallback(
    (delta) => {
      const next = index + delta;
      if (next >= 0 && next < photos.length) onIndexChange(next);
    },
    [index, photos.length, onIndexChange],
  );

  // ── keyboard ───────────────────────────────────────────────────────────
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      } else if (e.key === 'ArrowLeft') go(-1);
      else if (e.key === 'ArrowRight') go(1);
      else if (e.key === '+' || e.key === '=') animated(() => zoomAt(viewRef.current.s * 1.5));
      else if (e.key === '-' || e.key === '_') animated(() => zoomAt(viewRef.current.s / 1.5));
      else if (e.key === '0') animated(resetView);
    }
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [go, onClose, zoomAt, resetView]);

  // ── focus + wheel (needs a non-passive listener to preventDefault) ─────
  useEffect(() => {
    const prev = document.activeElement;
    closeBtnRef.current?.focus();
    return () => prev?.focus?.();
  }, []);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return undefined;
    function onWheel(e) {
      e.preventDefault();
      setSmooth(false);
      const p = toStagePoint(e.clientX, e.clientY);
      // ctrlKey = trackpad pinch; it reports much smaller deltas.
      const k = e.ctrlKey ? 0.01 : 0.0018;
      zoomAt(viewRef.current.s * Math.exp(-e.deltaY * k), p.x, p.y);
    }
    stage.addEventListener('wheel', onWheel, { passive: false });
    return () => stage.removeEventListener('wheel', onWheel);
  }, [zoomAt]);

  // ── pointer gestures ───────────────────────────────────────────────────
  function startPan(pt) {
    gesture.current = {
      type: 'pan',
      sx: pt.x,
      sy: pt.y,
      ox: viewRef.current.x,
      oy: viewRef.current.y,
      t0: performance.now(),
      moved: false,
    };
  }

  function startPinch() {
    const [a, b] = [...pointers.current.values()];
    gesture.current = {
      type: 'pinch',
      dist: Math.hypot(a.x - b.x, a.y - b.y) || 1,
      scale: viewRef.current.s,
      moved: true,
    };
  }

  function onPointerDown(e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    setSmooth(false);
    e.currentTarget.setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) startPinch();
    else if (pointers.current.size === 1) startPan({ x: e.clientX, y: e.clientY });
  }

  function onPointerMove(e) {
    if (!pointers.current.has(e.pointerId) || !gesture.current) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;

    if (g.type === 'pinch' && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const mid = toStagePoint((a.x + b.x) / 2, (a.y + b.y) / 2);
      zoomAt(g.scale * (dist / g.dist), mid.x, mid.y);
      return;
    }

    if (g.type === 'pan') {
      const dx = e.clientX - g.sx;
      const dy = e.clientY - g.sy;
      if (!g.moved && Math.hypot(dx, dy) > TAP_SLOP_PX) g.moved = true;
      if (g.moved && viewRef.current.s > MIN_SCALE) {
        commit({ s: viewRef.current.s, x: g.ox + dx, y: g.oy + dy });
      }
    }
  }

  function onPointerUp(e) {
    const g = gesture.current;
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.delete(e.pointerId);

    // Lifting one finger of a pinch: carry on as a pan with the other.
    if (g?.type === 'pinch') {
      if (pointers.current.size === 1) {
        const [rest] = [...pointers.current.values()];
        startPan(rest);
        gesture.current.moved = true; // never counts as a tap
      } else if (pointers.current.size === 0) {
        gesture.current = null;
      }
      return;
    }

    gesture.current = null;
    if (!g || e.type === 'pointercancel') return;

    const dx = e.clientX - g.sx;
    const dy = e.clientY - g.sy;

    // Swipe between photos (only when not zoomed in, so it can't fight pan).
    if (
      g.moved &&
      viewRef.current.s === MIN_SCALE &&
      Math.abs(dx) > SWIPE_MIN_PX &&
      Math.abs(dx) > Math.abs(dy) * 1.5
    ) {
      go(dx < 0 ? 1 : -1);
      return;
    }
    if (g.moved) return;

    // ── tap ──
    const now = performance.now();
    const last = tapRef.current;
    const isDouble =
      now - last.t < DOUBLE_TAP_MS && Math.hypot(e.clientX - last.x, e.clientY - last.y) < 30;
    tapRef.current = { t: now, x: e.clientX, y: e.clientY };

    if (isDouble) {
      tapRef.current = { t: 0, x: 0, y: 0 };
      const p = toStagePoint(e.clientX, e.clientY);
      animated(() => (viewRef.current.s > 1.05 ? resetView() : zoomAt(DOUBLE_TAP_SCALE, p.x, p.y)));
      return;
    }

    // Single tap on the dark backdrop (outside the photo) closes.
    const r = imgRef.current?.getBoundingClientRect();
    const outside =
      !r || e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
    if (outside) onClose();
  }

  const pct = Math.round(view.s * 100);
  const canZoomIn = view.s < MAX_SCALE - 0.01;
  const canZoomOut = view.s > MIN_SCALE + 0.01;

  return createPortal(
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-label={title ? `Photo of ${title}` : 'Photo viewer'}
    >
      <div className={styles.topBar}>
        <div className={styles.counter}>
          {title && <span className={styles.title}>{title}</span>}
          {photos.length > 1 && (
            <span className={styles.count}>
              {index + 1} / {photos.length}
            </span>
          )}
        </div>
        <button
          ref={closeBtnRef}
          type="button"
          className={styles.iconBtn}
          aria-label="Close photo viewer"
          onClick={onClose}
        >
          <X size={20} strokeWidth={2.5} />
        </button>
      </div>

      <div
        ref={stageRef}
        className={`${styles.stage} ${view.s > 1 ? styles.zoomed : ''}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {status === 'loading' && <div className={styles.spinner} aria-label="Loading photo" />}
        {status === 'error' && <div className={styles.error}>Couldn’t load this photo.</div>}

        <img
          key={src}
          ref={imgRef}
          src={src}
          alt={title || ''}
          draggable={false}
          className={`${styles.img} ${smooth ? styles.smooth : ''}`}
          style={{
            width: fit.w || undefined,
            height: fit.h || undefined,
            opacity: status === 'ready' ? 1 : 0,
            transform: `translate3d(${view.x}px, ${view.y}px, 0) scale(${view.s})`,
          }}
          onLoad={(e) => {
            natural.current = { w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight };
            computeFit();
            setStatus('ready');
          }}
          onError={() => setStatus('error')}
        />

        {photos.length > 1 && index > 0 && (
          <button
            type="button"
            className={`${styles.navBtn} ${styles.prev}`}
            aria-label="Previous photo"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => go(-1)}
          >
            <ChevronLeft size={26} />
          </button>
        )}
        {photos.length > 1 && index < photos.length - 1 && (
          <button
            type="button"
            className={`${styles.navBtn} ${styles.next}`}
            aria-label="Next photo"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => go(1)}
          >
            <ChevronRight size={26} />
          </button>
        )}
      </div>

      <div className={styles.bottomBar}>
        <div className={styles.zoomTool} role="group" aria-label="Zoom controls">
          <button
            type="button"
            className={styles.iconBtn}
            aria-label="Zoom out"
            disabled={!canZoomOut}
            onClick={() => animated(() => zoomAt(viewRef.current.s / 1.5))}
          >
            <ZoomOut size={18} />
          </button>
          <input
            type="range"
            className={styles.slider}
            aria-label="Zoom level"
            min={MIN_SCALE}
            max={MAX_SCALE}
            step={0.01}
            value={view.s}
            onChange={(e) => {
              setSmooth(false);
              zoomAt(Number(e.target.value));
            }}
          />
          <button
            type="button"
            className={styles.iconBtn}
            aria-label="Zoom in"
            disabled={!canZoomIn}
            onClick={() => animated(() => zoomAt(viewRef.current.s * 1.5))}
          >
            <ZoomIn size={18} />
          </button>
          <span className={styles.pct} aria-live="polite">
            {pct}%
          </span>
          <button
            type="button"
            className={styles.iconBtn}
            aria-label="Reset zoom"
            disabled={!canZoomOut}
            onClick={() => animated(resetView)}
          >
            <RotateCcw size={16} />
          </button>
        </div>
        <div className={styles.help}>Pinch or double-tap to zoom · drag to move</div>
      </div>
    </div>,
    document.body,
  );
}
