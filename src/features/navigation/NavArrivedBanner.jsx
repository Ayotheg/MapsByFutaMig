import { useEffect } from 'react';
import styles from './NavArrivedBanner.module.css';

/**
 * Ported from legacy `arrivedAtDestination()` (app.js ~4949–4976) —
 * the dynamically-created `.nav-arrived-banner` DOM node. Legacy
 * auto-dismisses after 8 s; same here via `useEffect` + `setTimeout`.
 */
export default function NavArrivedBanner({ destName, onDismiss }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 8000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <div className={styles.banner}>
      <h2>🎉 You&apos;ve Arrived!</h2>
      <p>{destName}</p>
      <button type="button" onClick={onDismiss}>
        Done
      </button>
    </div>
  );
}
