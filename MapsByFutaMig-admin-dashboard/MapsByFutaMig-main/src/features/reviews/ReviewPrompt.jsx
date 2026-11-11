import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Star, X } from 'lucide-react';
import { track } from '../../lib/analytics';
import { setTawkHidden } from '../../lib/tawk';
import { checkPendingReview, clearPendingReview } from './pendingReview';
import styles from './ReviewPrompt.module.css';

// "How was <place>?" corner card on the live map, shown once a visit
// remembered by pendingReview.js is due (an hour after arriving).
// Same out-of-the-way rules as ChannelPrompt: small, non-modal, never on
// top of anything (`blocked`), only on /map once it's loaded. If something
// opens over it, it steps aside and the visit stays pending, so it comes
// back later. "Rate" opens ReviewModal; "Not now" drops it for good.
const RECHECK_MS = 60 * 1000;

export default function ReviewPrompt({ ready, blocked, isMobile, onRate, onVisibleChange }) {
  const { pathname } = useLocation();
  const onMap = pathname === '/map';
  const [dest, setDest] = useState(null);
  const shownForRef = useRef(null);

  // Check now, whenever the tab comes back into view, and every minute
  // while it's open (covers a tab left open past the hour).
  useEffect(() => {
    if (!ready || !onMap) return undefined;
    const check = () => {
      if (document.visibilityState === 'visible') setDest(checkPendingReview().dest);
    };
    check();
    const id = setInterval(check, RECHECK_MS);
    document.addEventListener('visibilitychange', check);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', check);
    };
  }, [ready, onMap]);

  const visible = !!dest && !blocked && onMap;

  useEffect(() => {
    onVisibleChange?.(visible);
  }, [visible, onVisibleChange]);

  // Same corner as the Tawk chat bubble — hide the bubble while this is up.
  useEffect(() => {
    setTawkHidden('review-prompt', visible);
    return () => setTawkHidden('review-prompt', false);
  }, [visible]);

  useEffect(() => {
    if (!visible || shownForRef.current === dest.id) return;
    shownForRef.current = dest.id;
    track('review_prompt_shown', { place: dest.name });
  }, [visible, dest]);

  useEffect(() => {
    if (!visible) return undefined;
    function onKey(e) {
      if (e.key === 'Escape') dismiss();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  function dismiss() {
    track('review_prompt_dismissed', { place: dest.name });
    clearPendingReview();
    setDest(null);
  }

  function rate() {
    track('review_prompt_rate', { place: dest.name });
    clearPendingReview();
    const target = dest;
    setDest(null);
    onRate(target);
  }

  if (!visible) return null;

  return (
    <aside className={`${styles.card} ${isMobile ? styles.mobile : styles.desktop}`} aria-label="Rate your visit">
      <span className={styles.badge} aria-hidden="true">
        <Star size={17} />
      </span>
      <div className={styles.text}>
        <p className={styles.title}>How was {dest.name}?</p>
        <p className={styles.sub}>Your rating helps other students choose.</p>
      </div>
      <button type="button" className={styles.rate} onClick={rate}>
        Rate
      </button>
      <button type="button" className={styles.close} onClick={dismiss} aria-label="Not now">
        <X size={16} />
      </button>
    </aside>
  );
}
