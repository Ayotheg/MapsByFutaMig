import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { MapPin, LayoutGrid } from 'lucide-react';
import { LEGACY_ICON_MAP } from '../../lib/legacyIconMap';
import AllPlacesPanel from './AllPlacesPanel';
import styles from './QuickChips.module.css';

// Always show at least this many chips before the rest live only in
// "All places", even on a viewport too narrow to fit them without a nudge —
// same floor the person asked for ("first few 4").
const MIN_VISIBLE = 4;

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
 *
 * v2 redesign: restyled to v2 tokens per Figma node 29:23's
 * Category Chips row — white/bordered by default, teal-green
 * (`--v2-chip-active-*`) when active. Structure/props/handlers unchanged.
 *
 * This session (on explicit instruction): the row was growing without
 * bound as more chips get added, so it now only shows as many chips as
 * actually fit the bar's own width (floor of MIN_VISIBLE) and folds
 * everything else behind a trailing "All places" chip, which opens
 * AllPlacesPanel — every category grouped under its heading, with a
 * "Find a category" filter. Fit is measured
 * off an identical hidden row (`.measureRow`) so the visible row never
 * flashes full-then-clipped, and re-measures on resize / sidebar
 * collapse / whenever admin edits change the chip list. Selecting any
 * chip — visible or from the Others panel — still goes through the same
 * `onChipClick` prop MapPage already owns; only the bar's own display
 * logic changed here.
 */
export default function QuickChips({ chips, activeChip, onChipClick, collapsed, isMobile }) {
  const allChips = useMemo(() => chips || [], [chips]);
  // The bar shows the chips pinned to it (`barOrder`, set from the admin
  // Chips tab) in that order — Lecture halls · Food · Printing · POS / ATM
  // · Hostels. Every chip is in All places. Nothing pinned → all chips.
  const list = useMemo(() => {
    const pinned = allChips.filter((c) => c.barOrder != null).sort((a, b) => a.barOrder - b.barOrder);
    return pinned.length ? pinned : allChips;
  }, [allChips]);
  const barRef = useRef(null);
  const rowRef = useRef(null);
  const measureRef = useRef(null);
  const panelRef = useRef(null);
  const [visibleCount, setVisibleCount] = useState(list.length);
  const [overflowOpen, setOverflowOpen] = useState(false);

  const isActive = useCallback(
    (chip) => (activeChip?.id ? activeChip.id === chip.id : activeChip?.label === chip.label),
    [activeChip]
  );

  useLayoutEffect(() => {
    const container = rowRef.current;
    const measure = measureRef.current;
    if (!container || !measure || !list.length) {
      setVisibleCount(list.length);
      return undefined;
    }

    function recompute() {
      const available = container.clientWidth;
      const items = Array.from(measure.children);
      if (!available || items.length < list.length + 1) {
        setVisibleCount(list.length);
        return;
      }
      // Last measured child is the "All places" chip itself — reserve its
      // width up front so the real row always has room for it.
      const othersWidth = items[items.length - 1].offsetWidth + 6;
      let used = othersWidth;
      let count = 0;
      for (let i = 0; i < list.length; i++) {
        const w = items[i].offsetWidth + 6;
        if (count >= MIN_VISIBLE && used + w > available) break;
        used += w;
        count++;
      }
      setVisibleCount(Math.min(Math.max(count, MIN_VISIBLE), list.length));
    }

    recompute();
    const ro = new ResizeObserver(recompute);
    ro.observe(container);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list, collapsed, isMobile]);

  // Dismiss the Others panel on an outside click/tap, same convention
  // MapPage uses to close the chip results panel on a map click.
  useEffect(() => {
    if (!overflowOpen) return undefined;
    function handlePointerDown(e) {
      // AllPlacesPanel is portalled to <body>, so it isn't inside barRef.
      if (barRef.current?.contains(e.target) || panelRef.current?.contains(e.target)) return;
      setOverflowOpen(false);
    }
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, [overflowOpen]);

  if (!allChips.length) return null;

  const hiddenCount = Math.max(list.length - visibleCount, 0);

  // Keep the active chip visible in the row even if it isn't pinned to the
  // bar or would have overflowed, so picking one from All places doesn't
  // leave the bar showing nothing selected.
  let shown = list.slice(0, visibleCount);
  if (activeChip && !shown.some(isActive)) {
    const activeInAll = allChips.find(isActive);
    if (activeInAll) shown = hiddenCount > 0 ? [...shown.slice(0, -1), activeInAll] : [...shown, activeInAll];
  }

  function renderChip(chip, { measuring = false } = {}) {
    const Icon = (chip.iconKey ? LEGACY_ICON_MAP[chip.iconKey] : null) || MapPin;
    const active = isActive(chip);
    return (
      <button
        key={chip.id || chip.label}
        className={`${styles.chip} ${active ? styles.active : ''}`}
        onClick={measuring ? undefined : () => onChipClick(chip)}
        type="button"
        tabIndex={measuring ? -1 : 0}
        aria-hidden={measuring || undefined}
      >
        <Icon size={13} />
        <span className={styles.label}>{chip.shortLabel || chip.label}</span>
      </button>
    );
  }

  return (
    <div
      ref={barRef}
      className={styles.bar}
      style={!isMobile && collapsed ? { left: 'calc(var(--sidebar-rail-w) + 16px)' } : undefined}
    >
      <div ref={rowRef} className={styles.scroll}>
        {shown.map((chip) => renderChip(chip))}
        {/* Always shown: All places lists every category, not just the
            ones that didn't fit. */}
        <button
          className={`${styles.chip} ${styles.othersChip} ${overflowOpen ? styles.active : ''}`}
          onClick={() => setOverflowOpen((open) => !open)}
          type="button"
          aria-expanded={overflowOpen}
        >
          <LayoutGrid size={13} />
          <span className={styles.label}>All places</span>
        </button>
      </div>

      {/* Off-screen measuring row — identical markup to the real row (plus
          one trailing Others chip) so offsetWidth reflects true rendered
          sizes; used only to decide how many chips fit above. Never
          visible, never interactive. */}
      <div ref={measureRef} className={styles.measureRow} aria-hidden="true">
        {list.map((chip) => renderChip(chip, { measuring: true }))}
        <button className={`${styles.chip} ${styles.othersChip}`} type="button" tabIndex={-1}>
          <LayoutGrid size={13} />
          <span className={styles.label}>All places</span>
        </button>
      </div>

      {overflowOpen && (
        <AllPlacesPanel
          chips={allChips}
          activeChip={activeChip}
          onChipClick={(chip) => {
            onChipClick(chip);
            setOverflowOpen(false);
          }}
          onClose={() => setOverflowOpen(false)}
          isMobile={isMobile}
          collapsed={collapsed}
          panelRef={panelRef}
        />
      )}
    </div>
  );
}
