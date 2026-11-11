import { LocateFixed, Eye, User } from 'lucide-react';
import styles from './MobFabCluster.module.css';

/**
 * Ported from legacy `index.html` ~1110–1130-ish (`.mob-fab-cluster`:
 * `#mobLocateBtn`, `#mobViewToggleBtn`, `#mobAuthBtn`) and their handlers
 * (app.js ~5765–5800). Mobile-only, positioned above the bottom sheet —
 * `sheetState` shifts it up/down to stay clear of the sheet's current
 * height, mirroring legacy's `body.mob-sheet-half`/`.mob-sheet-full` CSS
 * coupling but as a prop instead of a body class (Slice 7 already
 * established this "controlled prop, not body class" convention for
 * sheet state).
 *
 * `onAuthClick`/`user` (Slice 10): wired now — legacy's
 * `updateSidebarBtn`'s mobile-FAB mirror (app.js ~7341–7360) swaps the
 * plain icon for the user's avatar (or initials, no avatar case) once
 * signed in, matching `.mob-fab--auth.signed-in`/`.mob-auth-avatar`
 * (style.css ~3399–3410). `onAuthClick` opens `AuthModal` — same handler
 * regardless of signed-in/out, matching legacy's single `mobAuthBtn`
 * click listener (app.js ~5765–5769) which always calls
 * `FUTA_AUTH.openModal()` and lets the modal itself decide login vs
 * profile tab.
 */
export default function MobFabCluster({ sheetState, tracking, onLocateClick, onViewToggleClick, onAuthClick, user, guestNavRemaining }) {
  const avatarUrl = user?.user_metadata?.avatar_url || user?.user_metadata?.picture;
  return (
    <div className={`${styles.cluster} ${styles[sheetState] || ''}`}>
      <button
        type="button"
        className={`${styles.fab} ${user ? styles.signedIn : ''}`}
        title={
          user
            ? 'Account'
            : guestNavRemaining != null
              ? `Sign In — ${guestNavRemaining} free navigation${guestNavRemaining === 1 ? '' : 's'} left`
              : 'Sign In'
        }
        onClick={onAuthClick}
      >
        {!user && guestNavRemaining != null && (
          <span className={styles.guestBadge}>{guestNavRemaining}</span>
        )}
        {user && avatarUrl ? (
          <img className={styles.avatar} src={avatarUrl} alt="" />
        ) : (
          <User size={18} />
        )}
      </button>
      <button type="button" className={styles.fab} title="Toggle view mode" onClick={onViewToggleClick}>
        <Eye size={18} />
      </button>
      <button type="button" className={`${styles.fab} ${styles.locate} ${tracking ? styles.tracking : ''}`} title="Find my location" onClick={onLocateClick}>
        <LocateFixed size={19} />
      </button>
    </div>
  );
}
