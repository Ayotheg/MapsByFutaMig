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
 * `onAuthClick` is inert for now — Slice 10's job (legacy opens the auth
 * modal / toggles a signed-in avatar here, app.js ~5765–5783, ~7342–7356).
 * Sidebar.jsx's `SIDEBAR_FOOTER_ACTIONS`/"Sign In" button is the same
 * kind of intentional stub; kept consistent with that precedent.
 */
export default function MobFabCluster({ sheetState, tracking, onLocateClick, onViewToggleClick, onAuthClick }) {
  return (
    <div className={`${styles.cluster} ${styles[sheetState] || ''}`}>
      <button type="button" className={styles.fab} title="Sign In" onClick={onAuthClick}>
        <User size={18} />
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
