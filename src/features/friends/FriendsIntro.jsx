import { useEffect, useRef } from 'react';
import { Flag, Navigation, X } from 'lucide-react';
import styles from './FriendsIntro.module.css';

// The little map behind the route. Stretches with the card (no slicing), so
// A and B stay fully visible on a narrow phone.
function HeroMap() {
  return (
    <svg className={styles.heroMap} viewBox="0 0 400 150" preserveAspectRatio="none" aria-hidden="true">
      <path className={styles.road} d="M0 8 C 120 30, 260 26, 400 12 L400 -10 L0 -10 Z" />
      <path className={styles.road} d="M100 0 L120 0 L112 150 L92 150 Z" />
      <path className={styles.road} d="M260 0 L276 0 L284 150 L268 150 Z" />
      <rect className={styles.block} x="-10" y="63" width="80" height="74" rx="10" />
      <rect className={styles.block} x="287" y="29" width="100" height="73" rx="10" />
      <rect className={styles.block} x="140" y="115" width="87" height="50" rx="10" />
      <path className={styles.routeTeal} d="M48 112 C 90 90, 130 83, 184 82" />
      <path className={styles.routeWhite} d="M216 81 C 260 80, 300 90, 346 106" />
    </svg>
  );
}

/**
 * One-time introduction to Meet a friend / Race to a place. useFriendsIntro
 * decides when it may open; this is only the card.
 */
export default function FriendsIntro({ onTry, onClose }) {
  const tryRef = useRef(null);
  const cardRef = useRef(null);

  useEffect(() => {
    const previous = document.activeElement;
    tryRef.current?.focus({ preventScroll: true });
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key !== 'Tab') return;
      // Tab stays inside the card, away from the dimmed map behind it.
      const buttons = cardRef.current?.querySelectorAll('button');
      if (!buttons?.length) return;
      const first = buttons[0];
      const last = buttons[buttons.length - 1];
      const inside = cardRef.current.contains(document.activeElement);
      if (!inside || (e.shiftKey && document.activeElement === first)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previous?.focus?.({ preventScroll: true });
    };
  }, [onClose]);

  return (
    <div className={styles.overlay} onClick={onClose}>
      <section
        ref={cardRef}
        className={styles.card}
        role="dialog"
        aria-modal="true"
        aria-labelledby="friends-intro-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.hero}>
          <HeroMap />
          <span className={styles.newBadge}>New</span>
          <button type="button" className={styles.close} aria-label="Close" onClick={onClose}>
            <X size={16} strokeWidth={2.2} />
          </button>
          <span className={`${styles.stop} ${styles.stopA}`} aria-hidden="true">
            A
          </span>
          <span className={`${styles.stop} ${styles.stopB}`} aria-hidden="true">
            B
          </span>
          <span className={styles.pin} aria-hidden="true">
            <Flag size={18} strokeWidth={2.2} />
          </span>
        </div>

        <div className={styles.body}>
          <h2 id="friends-intro-title" className={styles.title}>
            Meet a friend. <span className={styles.titleAccent}>Race to a place.</span>
          </h2>
          <p className={styles.text}>
            Create a code and share it. Friends join with the code to find each other, or race to the same spot.
          </p>
          <div className={styles.where}>
            <span className={styles.whereIcon}>
              <Navigation size={16} strokeWidth={2} />
            </span>
            <span>
              Find both under <strong className={styles.whereStrong}>Nav</strong>
            </span>
          </div>
          <button ref={tryRef} type="button" className={styles.tryBtn} onClick={onTry}>
            Try it now
          </button>
          <button type="button" className={styles.laterBtn} onClick={onClose}>
            Maybe later
          </button>
        </div>
      </section>
    </div>
  );
}
