import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { MapPin, LayoutGrid } from 'lucide-react';
import { LEGACY_ICON_MAP } from '../../lib/legacyIconMap';
import AllPlacesPanel from './AllPlacesPanel';
import styles from './QuickChips.module.css';

// Always show at least this many chips before the rest live only in
// "All places", even on a viewport too narrow to fit them without a
// nudge (the mobile row scrolls sideways).
const MIN_VISIBLE = 4;
// Lucide's default 2px stroke reads heavy next to the chip text at this
// size; the redesign's chip icons are drawn lighter.
const ICON_STROKE = 1.25;

/**
 * Ported from index.html's `.qc-bar`/`.qc-chip` markup (~1047–1062) and
 * the click-wiring half of `initQuickChips` (app.js ~6862–6924). The
 * results-gathering/panel half lives in ChipResultsPanel.jsx.
 *
 * `chips` comes from `useQuickChips()` (MapPage owns the hook), so admin
 * edits (add/remove/rename/re-categorise a chip) show up here without a
 * rebuild. "Same chip again → close", clearing on manual desktop typing,
 * and the mobile placeholder swap are all handled by MapPage, which owns
 * `activeChip` — this component only renders the row and reports clicks.
 *
 * The row shows as many chips as fit its own width (floor of
 * MIN_VISIBLE), measured off an identical hidden row (`.measureRow`) so it
 * never flashes full-then-clipped, and re-measures on resize / sidebar
 * collapse / admin edits.
 *
 * Oct 2026 Quick Chips revamp (public/Maps By FUTA — Quick-chips-png.zip):
 * the trailing "Others" chip is now an always-present "All places" chip
 * that opens AllPlacesPanel — every chip, grouped under its category
 * (Study, Food & chops, …) with a "Find a category" filter. On desktop
 * the row sits beside the search bar instead of under it.
 */
export default function QuickChips({ chips, activeChip, onChipClick, collapsed, isMobile }) {
  const allChips = useMemo(() => chips || [], [chips]);
  // The bar shows only the chips pinned to it (`barOrder`, set from the
  // admin Chips tab), in that order; everything else is in All places.
  // If nothing is pinned, fall back to the full list in its usual order.
  const list = useMemo(() => {
    const pinned = allChips.filter((c) => c.barOrder != null).sort((a, b) => a.barOrder - b.barOrder);
    return pinned.length ? pinned : allChips;
  }, [allChips]);
  const barRef = useRef(null);
  const rowRef = useRef(null);
  const measureRef = useRef(null);
  const allPanelRef = useRef(null);
  const [visibleCount, setVisibleCount] = useState(list.length);
  const [allOpen, setAllOpen] = useState(false);

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
      const allWidth = items[items.length - 1].offsetWidth + 8;
      let used = allWidth;
      let count = 0;
      for (let i = 0; i < list.length; i++) {
        const w = items[i].offsetWidth + 8;
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

  // Desktop: dismiss All places on an outside click, same convention
  // MapPage uses to close the chip results panel on a map click. (Mobile
  // has its own scrim.)
  useEffect(() => {
    if (!allOpen || isMobile) return undefined;
    function handlePointerDown(e) {
      // The panel is portalled to <body>, so it isn't inside barRef.
      if (barRef.current?.contains(e.target) || allPanelRef.current?.contains(e.target)) return;
      setAllOpen(false);
    }
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [allOpen, isMobile]);

  if (!allChips.length) return null;

  // Keep the currently active chip visible in the row even if it isn't
  // pinned to the bar or would otherwise have overflowed, so picking one
  // from All places doesn't leave the bar showing nothing selected.
  let shown = list.slice(0, visibleCount);
  if (activeChip && !shown.some(isActive)) {
    const activeChipInList = allChips.find(isActive);
    if (activeChipInList) shown = visibleCount < list.length ? [...shown.slice(0, -1), activeChipInList] : [...shown, activeChipInList];
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
        aria-pressed={measuring ? undefined : active}
      >
        <Icon size={16} strokeWidth={ICON_STROKE} />
        <span className={styles.label}>{chip.shortLabel || chip.label}</span>
      </button>
    );
  }

  function renderAllChip({ measuring = false } = {}) {
    return (
      <button
        className={`${styles.chip} ${styles.allChip}`}
        onClick={measuring ? undefined : () => setAllOpen((open) => !open)}
        type="button"
        tabIndex={measuring ? -1 : 0}
        aria-hidden={measuring || undefined}
        aria-expanded={measuring ? undefined : allOpen}
      >
        <LayoutGrid size={16} strokeWidth={ICON_STROKE} />
        <span className={styles.label}>All places</span>
      </button>
    );
  }

  return (
    <div
      ref={barRef}
      className={styles.bar}
      style={!isMobile && collapsed ? { left: 'calc(var(--sidebar-rail-w) + 32px + var(--search-col-w))' } : undefined}
    >
      <div ref={rowRef} className={styles.scroll}>
        {shown.map((chip) => renderChip(chip))}
        {renderAllChip()}
      </div>

      {/* Off-screen measuring row — identical markup to the real row (plus
          the trailing All places chip) so offsetWidth reflects true
          rendered sizes; used only to decide how many chips fit above.
          Never visible, never interactive. */}
      <div ref={measureRef} className={styles.measureRow} aria-hidden="true">
        {list.map((chip) => renderChip(chip, { measuring: true }))}
        {renderAllChip({ measuring: true })}
      </div>

      {allOpen && (
        <AllPlacesPanel
          chips={allChips}
          activeChip={activeChip}
          onChipClick={(chip) => {
            // Picking from the panel always opens that chip's results,
            // even if it's the one already active.
            if (!isActive(chip)) onChipClick(chip);
            setAllOpen(false);
          }}
          onClose={() => setAllOpen(false)}
          isMobile={isMobile}
          collapsed={collapsed}
          panelRef={allPanelRef}
        />
      )}
    </div>
  );
}
