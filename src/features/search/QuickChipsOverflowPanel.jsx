import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, X, MapPin } from 'lucide-react';
import { LEGACY_ICON_MAP } from '../../lib/legacyIconMap';
import styles from './QuickChipsOverflowPanel.module.css';

/**
 * The "Others" dropdown QuickChips.jsx opens when more categories exist
 * than the bar has room to show. Per Figma node 89:2 ("Categories" —
 * MAPSBYFUTA file) — a searchable grid of every category, so the chip
 * row itself can stay short without losing quick access to the rest.
 *
 * Deviation from the Figma reference, on explicit instruction: that node
 * is a centered, full-screen modal (own scrim + close button, fixed
 * card size). Here it's anchored as a dropdown directly under the Quick
 * Chips bar instead — same visual language (search input, icon-grid,
 * active-state styling) but positioned/sized like ChipResultsPanel's
 * desktop panel / mobile card rather than a centered dialog. Icons reuse
 * the app's existing `LEGACY_ICON_MAP` (already covers every chip,
 * same as the row above) instead of the Figma frame's own exported
 * per-category glyphs.
 *
 * Reads only — selecting a chip calls the same `onChipClick` QuickChips
 * already threads to the bar/results panel, so activeChip/toggle/close
 * behavior is untouched. This component owns nothing but the search text
 * and its own open/close chrome.
 */
export default function QuickChipsOverflowPanel({ chips, activeChip, onChipClick, onClose, isMobile, collapsed }) {
  const [query, setQuery] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    function handleKey(e) {
      if (e.key === 'Escape') onClose?.();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return chips;
    return chips.filter((chip) => chip.label.toLowerCase().includes(q));
  }, [chips, query]);

  function isActive(chip) {
    return activeChip?.id ? activeChip.id === chip.id : activeChip?.label === chip.label;
  }

  const grid = results.length ? (
    <div className={styles.grid}>
      {results.map((chip) => {
        const Icon = (chip.iconKey ? LEGACY_ICON_MAP[chip.iconKey] : null) || MapPin;
        const active = isActive(chip);
        return (
          <button
            key={chip.id || chip.label}
            type="button"
            className={`${styles.item} ${active ? styles.active : ''}`}
            onClick={() => onChipClick(chip)}
          >
            <span className={styles.itemIcon}>
              <Icon size={17} />
            </span>
            <span className={styles.itemLabel}>{chip.label}</span>
          </button>
        );
      })}
    </div>
  ) : (
    <div className={styles.empty}>No categories match "{query}"</div>
  );

  const body = (
    <>
      <div className={styles.header}>
        <div className={styles.searchWrap}>
          <Search size={14} className={styles.searchIcon} />
          <input
            ref={inputRef}
            className={styles.search}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find a category..."
          />
        </div>
        <button className={styles.close} onClick={onClose} aria-label="Close" type="button">
          <X size={14} />
        </button>
      </div>
      <div className={styles.body}>{grid}</div>
    </>
  );

  if (isMobile) {
    return (
      <>
        <div className={styles.scrim} onClick={onClose} />
        <div className={styles.mobileCard} role="dialog" aria-label="All categories">
          {body}
        </div>
      </>
    );
  }

  return (
    <div
      className={styles.panel}
      role="dialog"
      aria-label="All categories"
      style={collapsed ? { left: 'calc(var(--sidebar-rail-w) + 16px)' } : undefined}
    >
      {body}
    </div>
  );
}
