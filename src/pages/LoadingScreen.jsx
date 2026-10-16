import { useEffect, useRef, useState } from "react";
import { Navigation, Volume2, VolumeX } from "lucide-react";
import {
  claimLoadingMusic,
  isLoadingMusicMuted,
  setLoadingMusicMuted,
  startLoadingMusic,
  stopLoadingMusic,
} from "../lib/loadingMusic";
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
// The anthem (lib/loadingMusic.js) plays while this screen is up and fades
// out when it unmounts — bar filled and map revealed, or "Continue with
// saved data". It may already be playing when this mounts (started by the
// tap on the landing page's link to /map, which is what makes it work on
// iPhones). If the browser refused to start it, every tap/key press on this
// screen tries again, and a small "Tap for sound" pill appears at the top
// to invite that tap. A faded mute toggle sits in the top-right corner for
// anyone who'd rather not hear it; muting lasts for the rest of the visit
// (in memory only). Nothing is stored anywhere.
const SOUND_PROMPT_DELAY_MS = 500; // don't flash the pill on fast loads

function useLoadingMusic() {
  const [blocked, setBlocked] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [muted, setMuted] = useState(isLoadingMusicMuted);
  const tryStartRef = useRef(null);

  useEffect(() => {
    let active = true;
    claimLoadingMusic();

    const tryStart = (e) => {
      // A press on the mute toggle shouldn't count as "tap for sound" —
      // pointerup fires before its click, so the song would blip on first.
      if (e?.target?.closest?.("[data-music-toggle]")) return;
      startLoadingMusic().then((ok) => {
        if (!active) return;
        setBlocked(!ok);
        if (ok) removeUnlock();
      });
    };

    // Only these count as "the person interacted" for sound. On touch
    // screens that's the finger lifting (touchend/pointerup/click) — not
    // touchstart/pointerdown, which phones (iOS Safari especially) reject.
    // Listeners stay attached until playback actually starts.
    const unlockEvents = ["pointerup", "touchend", "click", "keydown"];
    const removeUnlock = () => {
      unlockEvents.forEach((e) => window.removeEventListener(e, tryStart, true));
    };
    unlockEvents.forEach((e) => window.addEventListener(e, tryStart, true));

    tryStartRef.current = tryStart;
    tryStart();
    const promptTimer = setTimeout(() => active && setShowPrompt(true), SOUND_PROMPT_DELAY_MS);

    return () => {
      active = false;
      clearTimeout(promptTimer);
      removeUnlock();
      stopLoadingMusic();
    };
  }, []);

  const toggleMute = () => {
    const next = !muted;
    setLoadingMusicMuted(next);
    setMuted(next);
    // Unmuting happens inside this tap, so the browser lets it play.
    if (!next) tryStartRef.current?.();
  };

  return { showPrompt: blocked && showPrompt && !muted, muted, toggleMute };
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
  const { showPrompt: showSoundPrompt, muted, toggleMute } = useLoadingMusic();
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
      {showSoundPrompt && (
        // The tap itself starts the music (window listeners in
        // useLoadingMusic); the click handler is a direct second attempt.
        <button type="button" className={styles.soundPrompt} onClick={() => startLoadingMusic()}>
          <Volume2 size={14} strokeWidth={2} />
          Tap for sound
        </button>
      )}

      <button
        type="button"
        data-music-toggle
        className={styles.muteToggle}
        onClick={toggleMute}
        aria-pressed={muted}
        aria-label={muted ? "Unmute music" : "Mute music"}
        title={muted ? "Unmute music" : "Mute music"}
      >
        {muted ? <VolumeX size={18} strokeWidth={2} /> : <Volume2 size={18} strokeWidth={2} />}
      </button>

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