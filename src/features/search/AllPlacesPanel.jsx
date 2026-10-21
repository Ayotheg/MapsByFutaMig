import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Search, X } from 'lucide-react';
import { CHIP_GROUPS, chipGroupOf } from '../shared/placeCategories';
import styles from './AllPlacesPanel.module.css';

/**
 * "All places" — opened by the trailing chip in QuickChips.jsx. Every
 * Quick Chip, grouped under its category (CHIP_GROUPS: Study, Food &
 * chops, Daily essentials, …) with a "Find a category" filter, per the
 * Oct 2026 redesign (public/Maps By FUTA — Quick-chips-png.zip, "All
 * places · desktop" / "All places · mobile"). Replaces the old "Others"
 * icon-grid dropdown.
 *
 * A compact dropdown card at the top of the map, never full-screen (the
 * person preferred the old "Others" dropdown's footprint): under the
 * search bar on desktop, under the chip row on mobile over a scrim. Selecting a chip calls the same
 * `onChipClick` the bar uses, so active-chip state stays in MapPage.
 */
export default function AllPlacesPanel({ chips, activeChip, onChipClick, onClose, isMobile, collapsed, panelRef }) {
  const [query, setQuery] = useState('');
  const inputRef = useRef(null);

  // Desktop only — on a phone, focusing would throw the keyboard up over
  // the list the person probably wants to scroll.
  useEffect(() => {
    if (!isMobile) inputRef.current?.focus({ preventScroll: true });
  }, [isMobile]);

  useEffect(() => {
    function handleKey(e) {
      if (e.key === 'Escape') onClose?.();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matching = q ? chips.filter((chip) => chip.label.toLowerCase().includes(q)) : chips;
    return CHIP_GROUPS.map((g) => ({ ...g, chips: matching.filter((c) => chipGroupOf(c) === g.key) })).filter(
      (g) => g.chips.length
    );
  }, [chips, query]);

  function isActive(chip) {
    return activeChip?.id ? activeChip.id === chip.id : activeChip?.label === chip.label;
  }

  const body = (
    <>
      <div className={styles.header}>
        <h2 className={styles.title}>All places</h2>
        <button className={styles.close} onClick={onClose} aria-label="Close" type="button">
          <X size={18} />
        </button>
      </div>
      <div className={styles.searchWrap}>
        <Search size={16} className={styles.searchIcon} />
        <input
          ref={inputRef}
          className={styles.search}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Find a category"
          aria-label="Find a category"
        />
      </div>
      <div className={styles.body}>
        {groups.length ? (
          groups.map((group) => (
            <section key={group.key} className={styles.group}>
              <h3 className={styles.groupLabel}>{group.label}</h3>
              <div className={styles.pills}>
                {group.chips.map((chip) => (
                  <button
                    key={chip.id || chip.label}
                    type="button"
                    className={`${styles.pill} ${isActive(chip) ? styles.active : ''}`}
                    onClick={() => onChipClick(chip)}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            </section>
          ))
        ) : (
          <div className={styles.empty}>No categories match "{query}"</div>
        )}
      </div>
    </>
  );

  // Portalled to <body>: QuickChips' `.bar` is fixed + z-indexed, so
  // anything rendered inside it can never stack above the search bar or
  // the mobile bottom sheet, however high its own z-index.
  if (isMobile) {
    return createPortal(
      <>
        <div className={styles.scrim} onClick={onClose} />
        <div className={styles.sheet} role="dialog" aria-label="All places">
          {body}
        </div>
      </>,
      document.body
    );
  }

  return createPortal(
    <div
      ref={panelRef}
      className={styles.panel}
      role="dialog"
      aria-label="All places"
      style={collapsed ? { left: 'calc(var(--sidebar-rail-w) + 16px)' } : undefined}
    >
      {body}
    </div>,
    document.body
  );
}
