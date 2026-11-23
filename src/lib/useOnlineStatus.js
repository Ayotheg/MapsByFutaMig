import { useEffect, useState } from 'react';

// `navigator.onLine` alone is only a snapshot — useWaypoints.js/
// useSegments.js already read it once at the start of a fetch, but
// nothing was watching for it to *change* mid-session. The browser fires
// real `online`/`offline` events the instant connectivity flips either
// way; this just mirrors those into React state so UI (OfflineBanner)
// can react immediately, without waiting for something else to trigger a
// fetch first.
export function useOnlineStatus() {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  return online;
}
