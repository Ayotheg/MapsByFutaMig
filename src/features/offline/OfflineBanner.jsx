import { useEffect, useRef, useState } from 'react';
import { Check, WifiOff } from 'lucide-react';
import StatusAlert from '../shared/StatusAlert';

// Unlike SubmissionToast, this does NOT auto-dismiss while offline. A
// person browsing on stale/cached data needs to keep knowing that until
// it's no longer true, not just for four seconds.
//
// `isOffline`/`cachedAt` come from MapPage, which merges two signals: the
// browser's own live connectivity state (useOnlineStatus.js — catches a
// mid-session disconnect even with no fetch in flight) and the data
// hooks' own fallback state (useWaypoints/useSegments — catches a fetch
// that failed/timed out despite the browser still reporting "online",
// e.g. a captive portal or a route to Supabase specifically being down).
// `onRetry` re-runs both loads (MapPage wires this to refetchWaypoints +
// refetchSegments).
//
// Look: shared StatusAlert (design: "Alert · all four states").
function formatAge(cachedAt) {
  if (!cachedAt) return null;
  const mins = Math.round((Date.now() - cachedAt) / 60000);
  if (mins < 1) return 'moments ago';
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;
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

  useEffect(() => {
    if (isOffline) {
      wasOffline.current = true;
      setPhase('offline');
      return undefined;
    }
    if (wasOffline.current) {
      wasOffline.current = false;
      setPhase('reconnected');
      const t = setTimeout(() => setPhase('hidden'), 2500);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [isOffline]);

  // Lets the "map isn't loading" alert step aside while this one shows
  // (StatusAlert.module.css).
  useEffect(() => {
    document.body.classList.toggle('status-offline', phase === 'offline');
    return () => document.body.classList.remove('status-offline');
  }, [phase]);

  if (phase === 'hidden') return null;

  if (phase === 'reconnected') {
    return <StatusAlert icon={Check} tone="ok" title="Back online" />;
  }

  const age = formatAge(cachedAt);

  return (
    <StatusAlert
      icon={WifiOff}
      tone="offline"
      title="You're offline"
      message={age ? `Showing saved data from ${age}.` : 'Turn on mobile data or Wi-Fi.'}
      onRetry={onRetry}
      // Data hooks resolve (success or fail-again) within their own 8s
      // timeout, so the spin stops then either way.
      retrySpinMs={8000}
      // Keeps trying on its own (only while the browser says it's online —
      // a dropped connection already refetches on the 'online' event).
      autoRetryMs={20000}
    />
  );
}
