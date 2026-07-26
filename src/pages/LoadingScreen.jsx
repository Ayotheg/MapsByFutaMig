import { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";
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
          <span className={styles.ringInner} aria-hidden="true" />
          <MapPin className={styles.pinIcon} strokeWidth={1.75} />
        </div>

        <h1 className={styles.title}>Maps By Futa</h1>
        <p className={styles.subtitle}>
          Please wait while the map and its components load
        </p>

        <div className={styles.barTrack}>
          <div className={styles.barFill} style={{ width: `${percent}%` }} />
        </div>

        <p className={styles.status}>
          {currentLabel}
          <span aria-hidden="true">&hellip; </span>
          (<strong>{step}</strong>/{total})
        </p>
      </div>
    </div>
  );
}

export default LoadingScreen;