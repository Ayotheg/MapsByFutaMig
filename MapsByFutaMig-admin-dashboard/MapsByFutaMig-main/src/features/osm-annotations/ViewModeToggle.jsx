import { Info } from 'lucide-react';
import styles from './ViewModeToggle.module.css';

/**
 * Floating INFO/RAW view toggle. Ported from legacy `#viewToggleBtn`
 * (index.html ~767–771, style.css ~666–701). The icon (`bi-info-circle-fill`
 * → lucide's `Info`, per `src/lib/legacyIconMap.js`) stays constant in
 * legacy — only the label text and accent color swap between modes, no
 * icon swap — kept identical here.
 *
 * Desktop-only: legacy hides this at the same `≤768px` breakpoint that
 * kills the sidebar (`style.css` ~3271). Rendered conditionally by
 * MapPage's existing `isMobile` check, same pattern as Sidebar vs
 * MobileSheet, rather than a CSS media-query hide.
 *
 * Position reacts to the sidebar's collapsed state via the shared
 * `body.sidebar-collapsed` global class (Slice 4) — see
 * ViewModeToggle.module.css.
 */
export default function ViewModeToggle({ viewMode, onToggle }) {
  const isRaw = viewMode === 'raw';
  return (
    <button
      type="button"
      className={`${styles.toggle} ${isRaw ? styles.raw : ''}`}
      title="Toggle Info / Raw view"
      onClick={onToggle}
    >
      <Info size={11} className={styles.icon} />
      <span className={styles.label}>{isRaw ? 'RAW MODE' : 'INFO MODE'}</span>
    </button>
  );
}
