import { useEffect, useRef, useState } from "react";
import { Navigation } from "lucide-react";
import styles from "./LoadingScreen.module.css";

// Default sequence of things the app is actually assembling on first
// paint (base map shell, waypoints, KML, auth, etc). Callers driving
// real async work can pass their own `steps` / `current` instead.
const DEFAULT_STEPS = [
  "Initializing map shell",
  "Connecting to Supabase",
  "Loading waypoints",
  "Loading waypoint images",
  "Loading segments",
  "Loading OSM annotations",
  "Loading KML tracks",
  "Loading place type legend",
  "Restoring session",
  "Loading admin config",
  "Warming marker cache",
  "Finalizing map view",
];

// ── Loading music ─────────────────────────────────────────────────────
// The FUTA anthem plays from the start every time this screen mounts (new
// and returning visitors alike) and fades out when it unmounts, i.e. once
// the bar has filled and the map is revealed, or the person taps
// "Continue with saved data". Nothing is stored anywhere — no
// localStorage, no "already heard it" flag.
//
// Browsers only allow sound once the person has interacted with the site.
// Arriving from the landing page by tap/click counts, so it plays straight
// away. On a cold load (typed URL, refresh, shared link) play() is
// refused; it then starts on the first tap/key press while this screen is
// still up.
//
// MP3 plays in every browser (iPhones included), so one file covers all.
const LOADING_MUSIC_SRC = "/futa-new-anthem.mp3";
const MUSIC_VOLUME = 0.6;
const FADE_IN_MS = 800;
const FADE_OUT_MS = 700;

function fadeVolume(audio, to, ms, done) {
  const from = audio.volume;
  const start = performance.now();
  let frame = requestAnimationFrame(function tick(now) {
    const t = Math.min(1, (now - start) / ms);
    audio.volume = Math.max(0, Math.min(1, from + (to - from) * t));
    if (t < 1) frame = requestAnimationFrame(tick);
    else done?.();
  });
  return () => cancelAnimationFrame(frame);
}

function useLoadingMusic() {
  useEffect(() => {
    if (typeof Audio === "undefined") return undefined;
    const audio = new Audio(LOADING_MUSIC_SRC);
    audio.loop = true;
    audio.preload = "auto";
    audio.volume = 0;
    let stopped = false;
    let cancelFade = null;

    const start = () => {
      if (stopped) return;
      audio.currentTime = 0;
      audio
        .play()
        .then(() => {
          // The screen may have closed while play() was still pending.
          if (stopped) {
            audio.pause();
            return;
          }
          removeUnlock();
          cancelFade?.();
          cancelFade = fadeVolume(audio, MUSIC_VOLUME, FADE_IN_MS);
        })
        .catch(() => {
          // Autoplay blocked (no interaction yet) or format unsupported —
          // wait for the first interaction below and try once more.
        });
    };

    const unlockEvents = ["pointerdown", "keydown", "touchstart"];
    const onFirstInteraction = () => {
      removeUnlock();
      start();
    };
    const removeUnlock = () => {
      unlockEvents.forEach((e) => window.removeEventListener(e, onFirstInteraction, true));
    };
    unlockEvents.forEach((e) => window.addEventListener(e, onFirstInteraction, true));

    start();

    return () => {
      stopped = true;
      removeUnlock();
      cancelFade?.();
      if (audio.paused) {
        audio.removeAttribute("src");
        audio.load();
        return;
      }
      fadeVolume(audio, 0, FADE_OUT_MS, () => {
        audio.pause();
        audio.removeAttribute("src");
        audio.load(); // release the network/decoder
      });
    };
  }, []);
}

function LoadingScreen({
  steps = DEFAULT_STEPS,
  current,
  label = "Loading data",
  onComplete,
  // Failsafe UI (HomeRoute.jsx's BOOT_TIMEOUT_MS): when boot has taken too
  // long, `stuck` renders a message + retry/continue affordance instead of
  // leaving the person watching a bar that may never fill. `onRetry`
  // re-runs the failed data loads; `onContinue` (only shown when provided
  // — HomeRoute only offers it once there's at least something to show,
  // e.g. cached data) dismisses the loading screen anyway.
  stuck = false,
  isOffline = false,
  // True when this device already has a saved copy of the map data (a
  // returning visitor). First-time visitors have none, so their message
  // explains that the first load needs a connection instead of hinting
  // at saved data that doesn't exist.
  hasSavedData = true,
  onRetry,
  onContinue,
}) {
  const total = steps.length;
  useLoadingMusic();
  const isControlled = typeof current === "number";
  const [autoStep, setAutoStep] = useState(1);
  const intervalRef = useRef(null);

  // Auto-advance one step at a time (uncontrolled/demo mode only).
  useEffect(() => {
    if (isControlled) return undefined;
    intervalRef.current = setInterval(() => {
      setAutoStep((prev) => {
        if (prev >= total) {
          if (onComplete) {
            clearInterval(intervalRef.current);
            return prev;
          }
          return 1;
        }
        return prev + 1;
      });
    }, 550);
    return () => clearInterval(intervalRef.current);
  }, [isControlled, total, onComplete]);

  const step = isControlled ? Math.min(Math.max(current, 0), total) : autoStep;

  // Fire onComplete once the bar is actually full — works the same whether
  // that happened because a caller fed us real `current` progress or
  // because the demo timer ran out.
  useEffect(() => {
    if (!onComplete || step < total) return undefined;
    // Small pause on the completed bar so it doesn't feel like it cuts off.
    const timeout = setTimeout(onComplete, 450);
    return () => clearTimeout(timeout);
  }, [onComplete, step, total]);

  const percent = total > 0 ? (step / total) * 100 : 0;
  // Show what's actually loading right now rather than a single static
  // string, e.g. "Loading waypoints… (2/5)" — falls back to `label` if
  // the caller didn't supply a `steps` list with real per-stage text.
  const currentLabel = steps[Math.min(Math.max(step - 1, 0), total - 1)] ?? label;

  return (
    <div className={`${styles.screen} ${stuck ? styles.screenStuck : ""}`}>
      <div className={styles.content}>
        <div className={styles.iconWrap} aria-hidden="true">
          {/* Wide background rings + ripples. Reach up toward the top of
              the screen; masked to fade out just below the icon so they
              never sit behind the title or progress text. */}
          <span className={styles.halo}>
            <span className={`${styles.ring} ${styles.ringXl}`} />
            <span className={`${styles.ring} ${styles.ringLg}`} />
            <span className={`${styles.ring} ${styles.ringMd}`} />
            <span className={styles.ripple} />
            <span className={`${styles.ripple} ${styles.rippleDelayed}`} />
          </span>
          <span className={styles.ringOuter} />
          <span className={styles.orbit}>
            <span className={styles.orbitDot} />
          </span>
          <span className={styles.iconCircle}>
            <Navigation className={styles.pinIcon} strokeWidth={1.75} />
          </span>
        </div>

        <h1 className={styles.title}>Maps By Futa</h1>
        <p className={styles.subtitle}>
          Your personal guide to campus navigation.
        </p>

        <div
          className={styles.barTrack}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(percent)}
          aria-label={currentLabel}
        >
          <div className={styles.barFill} style={{ width: `${percent}%` }} />
        </div>

        <div className={styles.status}>
          {/* keyed so each new step fades in */}
          <span key={currentLabel} className={styles.statusLabel}>
            {currentLabel}
            <span aria-hidden="true">&hellip;</span>
          </span>
          <span className={styles.statusPercent}>{Math.round(percent)}%</span>
        </div>

        {stuck && (
          <div className={styles.stuckPanel} role="status">
            <p className={styles.stuckMessage}>
              {isOffline
                ? hasSavedData
                  ? "You seem to be offline. Check your connection and try again."
                  : "You seem to be offline. Check your connection and try again."
                : hasSavedData
                  ? "This is taking longer than usual — your connection may be slow."
                  : "This is taking longer than usual — your connection may be slow. Tap Retry."}
            </p>
            {onRetry && (
              <button type="button" className={styles.stuckButtonPrimary} onClick={onRetry}>
                Retry
              </button>
            )}
          </div>
        )}
      </div>

      {/* A quiet way out, kept down by the footer so it doesn't crowd the
          progress bar or compete with Retry. */}
      {stuck && onContinue && (
        <button type="button" className={styles.continueOption} onClick={onContinue}>
          Continue with saved data
        </button>
      )}

      <p className={styles.footerMeta}>Navigating made easy</p>
    </div>
  );
}

export default LoadingScreen;