import { MapPin } from 'lucide-react';
import { LEGACY_ICON_MAP } from '../../lib/legacyIconMap';
import styles from './QuickChips.module.css';

/**
 * Ported from index.html's `.qc-bar`/`.qc-chip` markup (~1047–1062) and
 * the click-wiring half of `initQuickChips` (app.js ~6862–6924). The
 * results-gathering/panel half lives in ChipResultsPanel.jsx.
 *
 * `chips` now comes from `useQuickChips()` (MapPage owns the hook) rather
 * than a static `CHIPS` import, so admin edits (add/remove/rename a chip)
 * show up here without a rebuild.
 *
 * "Same chip again → close", clearing on manual desktop typing, and the
 * mobile placeholder swap are all handled by MapPage, which owns
 * `activeChip` and threads it to DesktopSearchBar/MobileSearchBar too —
 * this component only renders the row and reports clicks upward.
 */
export default function QuickChips({ chips, activeChip, onChipClick, collapsed, isMobile }) {
  return (
    <div className={styles.bar} style={!isMobile && collapsed ? { left: 'calc(var(--sidebar-rail-w) + 16px)' } : undefined}>
      <div className={styles.scroll}>
        {(chips || []).map((chip) => {
          const Icon = (chip.iconKey ? LEGACY_ICON_MAP[chip.iconKey] : null) || MapPin;
          const isActive = activeChip?.id ? activeChip.id === chip.id : activeChip?.label === chip.label;
          return (
            <button
              key={chip.id || chip.label}
              className={`${styles.chip} ${isActive ? styles.active : ''}`}
              onClick={() => onChipClick(chip)}
              type="button"
            >
              <Icon size={13} />
              <span className={styles.label}>{chip.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
