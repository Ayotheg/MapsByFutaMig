import { useEffect, useRef } from 'react';
import { Navigation, Users, Flag } from 'lucide-react';
import styles from './Friends.module.css';

/**
 * What the Nav tab (mobile) and the Navigate rail item (desktop) open:
 * plain navigation, or one of the two friends modes. `anchor` is the
 * desktop rail button's rect; mobile centres the menu over the Nav tab.
 */
export default function NavMenu({ anchor, isMobile, activeMode, onClose, onNavigate, onMeet, onRace }) {
  const firstRef = useRef(null);
  useEffect(() => {
    firstRef.current?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const style =
    !isMobile && anchor ? { left: anchor.right + 12, top: Math.max(12, anchor.top + anchor.height / 2 - 76) } : undefined;

  return (
    <>
      <button type="button" className={styles.menuScrim} aria-label="Close menu" onClick={onClose} />
      <div className={`${styles.menu} ${isMobile || !anchor ? styles.menuMobile : ''}`} style={style} role="menu">
        <button ref={firstRef} type="button" role="menuitem" className={styles.menuItem} onClick={onNavigate}>
          <Navigation size={18} strokeWidth={2} />
          Navigate
        </button>
        <button type="button" role="menuitem" className={styles.menuItem} onClick={onMeet}>
          <Users size={18} strokeWidth={2} />
          Meet a friend
          {activeMode === 'meet' && <span className={styles.menuBadge}>Live</span>}
        </button>
        <button type="button" role="menuitem" className={styles.menuItem} onClick={onRace}>
          <Flag size={18} strokeWidth={2} className={styles.teal} />
          Race to a place
          {activeMode === 'race' && <span className={styles.menuBadge}>Live</span>}
        </button>
      </div>
    </>
  );
}
