import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { MapPin, LayoutGrid } from 'lucide-react';
import { LEGACY_ICON_MAP } from '../../lib/legacyIconMap';
import { chipIconKey } from '../shared/placeCategories';
import AllPlacesPanel from './AllPlacesPanel';
import styles from './QuickChips.module.css';

// Desktop always shows at least this many chips (the row scrolls if they
// don't fit). Mobile isn't trimmed at all: every pinned chip shows in a
// swipeable row with "All places" at the end.
const MIN_VISIBLE = 4;
// `.scroll`'s flex gap.
const GAP = 6;

const chipKey = (chip) => chip.id || chip.label;

/**
 * The Quick Chips row under the search bar. MapPage owns `activeChip`
 * ("same chip again → close", clearing on manual typing, the mobile
 * placeholder swap); this component renders the row and reports clicks.
 *
 * Only as many chips as fit the bar's width are shown, followed by an
 * "All places" chip that opens AllPlacesPanel (every chip, grouped by
 * category). Fit is measured off an identical hidden row (`.measureRow`)
 * so the visible row never flashes full-then-clipped, and re-measures on
 * resize / sidebar collapse / chip-list edits / a new active chip.
 */
export default function QuickChips({ chips, activeChip, onChipClick, onAllPlacesOpen, collapsed, isMobile }) {
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
  // How many of the bar's non-active chips fit next to the active one.
  const [visibleCount, setVisibleCount] = useState(list.length);
  const [overflowOpen, setOverflowOpen] = useState(false);

  const isActive = useCallback(
    (chip) => (activeChip?.id ? activeChip.id === chip.id : activeChip?.label === chip.label),
    [activeChip]
  );
  // The active chip always shows in the row (even if it isn't pinned to the
  // bar), so picking one from All places doesn't leave nothing selected.
  const activeInAll = activeChip ? allChips.find(isActive) || null : null;
  const rest = useMemo(() => list.filter((c) => !isActive(c)), [list, isActive]);

  useLayoutEffect(() => {
    const container = rowRef.current;
    const measure = measureRef.current;
    // Mobile: the row scrolls sideways, so show every pinned chip instead
    // of cutting it down to what fits the screen width.
    if (isMobile || !container || !measure || !rest.length) {
      setVisibleCount(rest.length);
      return undefined;
    }

    function recompute() {
      // clientWidth includes the row's side padding, which chips can't use.
      const cs = getComputedStyle(container);
      const available =
        container.clientWidth - parseFloat(cs.paddingLeft || 0) - parseFloat(cs.paddingRight || 0);
      const widths = new Map();
      for (const el of measure.children) widths.set(el.dataset.key, el.offsetWidth + GAP);
      const allPlacesW = widths.get('__all__');
      if (!available || !allPlacesW) {
        setVisibleCount(rest.length);
        return;
      }
      // "All places" and the active chip are always in the row — reserve them first.
      let used = allPlacesW + (activeInAll ? widths.get(chipKey(activeInAll)) || 0 : 0);
      let count = 0;
      for (const chip of rest) {
        const w = widths.get(chipKey(chip)) || 0;
        if (count >= MIN_VISIBLE && used + w > available) break;
        used += w;
        count++;
      }
      setVisibleCount(count);
    }

    recompute();
    const ro = new ResizeObserver(recompute);
    ro.observe(container);
    return () => ro.disconnect();
  }, [rest, activeInAll, collapsed, isMobile]);

  // Desktop: dismiss All places on an outside click. Mobile relies on the
  // sheet's scrim instead — closing on touch/mousedown unmounts the scrim
  // before the click fires, so the tap lands on whatever is underneath.
  useEffect(() => {
    if (!overflowOpen || isMobile) return undefined;
    function handlePointerDown(e) {
      // AllPlacesPanel is portalled to <body>, so it isn't inside barRef.
      if (barRef.current?.contains(e.target) || panelRef.current?.contains(e.target)) return;
      setOverflowOpen(false);
    }
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [overflowOpen, isMobile]);

  if (!allChips.length) return null;

  const fitting = new Set(rest.slice(0, visibleCount));
  const shown = list.filter((c) => fitting.has(c) || isActive(c));
  if (activeInAll && !shown.includes(activeInAll)) shown.push(activeInAll);

  function toggleAllPlaces() {
    // All places and the chip results share one spot on desktop — only
    // one of them is ever open.
    if (!overflowOpen) onAllPlacesOpen?.();
    setOverflowOpen((open) => !open);
  }

  function renderChip(chip, { measuring = false } = {}) {
    const Icon = LEGACY_ICON_MAP[chipIconKey(chip)] || MapPin;
    const active = !measuring && isActive(chip);
    return (
      <button
        key={chipKey(chip)}
        data-key={measuring ? chipKey(chip) : undefined}
        className={`${styles.chip} ${active ? styles.active : ''}`}
        onClick={
          measuring
            ? undefined
            : () => {
                setOverflowOpen(false);
                onChipClick(chip);
              }
        }
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
          onClick={toggleAllPlaces}
          type="button"
          aria-expanded={overflowOpen}
        >
          <LayoutGrid size={13} />
          <span className={styles.label}>All places</span>
        </button>
      </div>

      {/* Off-screen measuring row — identical markup to the real row, for
          every chip (any of them can become the active one) plus the All
          places chip, so offsetWidth reflects true rendered sizes. Never
          visible, never interactive. */}
      <div ref={measureRef} className={styles.measureRow} aria-hidden="true">
        {allChips.map((chip) => renderChip(chip, { measuring: true }))}
        <button data-key="__all__" className={`${styles.chip} ${styles.othersChip}`} type="button" tabIndex={-1}>
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
