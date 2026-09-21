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
    <div className={styles.screen}>
      <div className={styles.content}>
        <div className={styles.iconWrap}>
          <span className={styles.ringOuter} aria-hidden="true" />
          <span className={styles.iconCircle}>
            <Navigation className={styles.pinIcon} strokeWidth={1.75} />
          </span>
        </div>

        <h1 className={styles.title}>Maps By Futa</h1>
        <p className={styles.subtitle}>
          Your personal guide to campus navigation.
        </p>

        <div className={styles.barTrack}>
          <div className={styles.barFill} style={{ width: `${percent}%` }} />
        </div>

        <div className={styles.status}>
          <span className={styles.statusLabel}>
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
                  : "This is taking longer than usual — your connection may be slow. tap Retry."}
            </p>
            <div className={styles.stuckActions}>
              {onRetry && (
                <button type="button" className={styles.stuckButtonPrimary} onClick={onRetry}>
                  Retry
                </button>
              )}
              {onContinue && (
                <button type="button" className={styles.stuckButtonSecondary} onClick={onContinue}>
                  Continue with saved data
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <p className={styles.footerMeta}>Navigating made easy..</p>
    </div>
  );
}

export default LoadingScreen;