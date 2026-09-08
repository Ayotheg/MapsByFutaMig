import { useEffect, useRef, useState } from 'react';
import { WifiOff, RefreshCw, Wifi } from 'lucide-react';
import styles from './OfflineBanner.module.css';

// Feature-local, not a shared component — same "no premature shared
// components" call SubmissionToast.jsx made (grep-confirmed no shared
// toast/banner exists yet). This one differs from that toast in the one
// way that matters here: it does NOT auto-dismiss while offline. A
// person browsing on stale/cached data needs to keep knowing that until
// it's no longer true, not just for four seconds.
//
// `isOffline`/`cachedAt` come from useWaypoints/useSegments by way of
// MapPage — see their own header comments for how the cache fallback
// gets populated. `onRetry` re-runs both loads (MapPage wires this to
// refetchWaypoints + refetchSegments).
function formatAge(cachedAt) {
  if (!cachedAt) return null;
  const mins = Math.round((Date.now() - cachedAt) / 60000);
  if (mins < 1) return 'moments ago';
  if (mins < 60) return `${mins} min${mins === 1 ? '' : 's'} ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

export default function OfflineBanner({ isOffline, cachedAt, onRetry }) {
  // Tracks the transition, not just the current state — going from
  // offline -> online is worth a brief "you're back" confirmation, going
  // straight to "online, nothing to say" shouldn't render anything at all.
  const [phase, setPhase] = useState('hidden'); // 'hidden' | 'offline' | 'reconnected'
  const wasOffline = useRef(false);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    if (isOffline) {
      wasOffline.current = true;
      setPhase('offline');
      return undefined;
    }
    if (wasOffline.current) {
      wasOffline.current = false;
      setRetrying(false);
      setPhase('reconnected');
      const t = setTimeout(() => setPhase('hidden'), 2500);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [isOffline]);

  if (phase === 'hidden') return null;

  if (phase === 'reconnected') {
    return (
      <div className={`${styles.banner} ${styles.reconnected}`} role="status">
        <Wifi size={14} />
        <span>Back online — showing the latest data</span>
      </div>
    );
  }

  const age = formatAge(cachedAt);

  return (
    <div className={`${styles.banner} ${styles.offline}`} role="status">
      <WifiOff size={14} />
      <span>{age ? `Showing saved data from ${age}` : 'Showing saved data'}</span>
      <button
        type="button"
        className={styles.retryButton}
        disabled={retrying}
        onClick={() => {
          setRetrying(true);
          onRetry?.();
          // Data hooks resolve (success or fail-again) within their own
          // 8s timeout — release the spin either way rather than tracking
          // a separate in-flight flag just for this button.
          setTimeout(() => setRetrying(false), 8000);
        }}
      >
        <RefreshCw size={12} className={retrying ? styles.spinning : undefined} />
        Retry
      </button>
    </div>
  );
}
