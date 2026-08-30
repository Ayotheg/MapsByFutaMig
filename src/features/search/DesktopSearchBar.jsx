import { useEffect, useRef, useState } from 'react';
import { Search, X, Navigation, Menu } from 'lucide-react';
import { fetchNominatim } from './nominatimSearch';
import { useSelectResult } from './useSelectResult';
import { findDuplicate } from '../osm-annotations/osmAnnotationUtils';
import SearchDropdownList from './SearchDropdownList';
import styles from './DesktopSearchBar.module.css';
import { track } from '../../lib/analytics';
import { readPersistentState, writePersistentState } from '../../lib/persistentState';

/**
 * Ported from legacy's `initDeskSearch` IIFE (app.js ~895–1131) — the
 * floating pill at the top-center of the map, the actual visible desktop
 * search UI.
 *
 * Not ported: the sidebar's `#panelSearch`/`#searchInput`/`#searchDropdown`
 * (app.js ~547–780, index.html ~566, `style="display:none"`). Traced every
 * call site: nothing in legacy ever removes that inline `display:none`, so
 * that panel — and the near-identical `handleSearchInput`/`doSearch`
 * functions built for it — are unreachable dead code, superseded by this
 * floating bar. `selectResult()` (app.js ~729–777), which both the dead
 * panel and this bar call, is real and shared — ported as `useSelectResult`.
 *
 * Also not ported here: `bindRouteInput`/`#routePlannerBar` (app.js
 * ~1135–1206, index.html ~580). Traced its only call site (~1193–1200):
 * it's invoked, but nothing anywhere ever removes `#routePlannerBar`'s
 * `hidden` class — no button, no rail item, nothing. It's real code for UI
 * legacy itself never surfaces, superseded by the actually-wired
 * `#navDestPanel` destination search (Slice 9's territory — `railNavigate`
 * → `panelNavigate`). Flagging rather than guessing a trigger or inventing
 * new UI not present in legacy; revisit if Slice 9 turns out to need it.
 *
 * UI_REDESIGN_GUIDE.md pass (this session, paired with MobileSearchBar
 * per the guide's pairing rule): the collapsed pill (`.bar`/`.pill` and
 * its buttons/input) is restyled to v2 light tokens, reusing the same
 * decisions just made for the mobile bar (glass pill, v2-primary nav
 * button, etc.) — no separate Figma frame was given for desktop, per
 * the pairing rule this reuses the mobile session's fresh choices
 * rather than reinventing them. The results `.dropdown` and
 * `SearchDropdownList`/`SearchResultItem` are deliberately left on v1
 * dark styling: that list is shared verbatim with MobileSearchOverlay
 * (still unredesigned, no Figma reference yet), so restyling it here
 * would put light-on-dark text on the still-dark overlay — same
 * shared-component precedent as the Layers panel tab-strip pass.
 * Flagged in UI_REDESIGN_GUIDE.md Section 7 rather than guessed at.
 */
export default function DesktopSearchBar({ map, searchIndex, onSelect, collapsed, onToggleCollapsed, onManualType, activeChipLabel, onNavigateClick }) {
  const [query, setQuery] = useState(() => readPersistentState('desktop-search-query', ''));
  const [open, setOpen] = useState(false);
  const [osmResults, setOsmResults] = useState(null);
  const [loadingOsm, setLoadingOsm] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const barRef = useRef(null);
  const inputRef = useRef(null);
  const debounceRef = useRef(null);
  const lastOsmQRef = useRef('');

  const { selectResult, clearMarker } = useSelectResult({ map, searchIndex, onSelect });
  const localResults = query.trim() ? searchIndex.query(query, 6) : [];

  useEffect(() => writePersistentState('desktop-search-query', query), [query]);

  // Chip click fills the input text (legacy: `deskInput.value = label`,
  // app.js ~6879) without opening the dropdown or counting as manual typing.
  useEffect(() => {
    if (activeChipLabel != null) {
      setQuery(activeChipLabel);
      setOpen(false);
    }
  }, [activeChipLabel]);

  // Close on outside click — matches legacy's document-level listener.
  useEffect(() => {
    function onDocClick(e) {
      if (barRef.current && !barRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, []);

  function handleSelect(entry) {
    if (!entry.lat || !entry.lng) return;
    selectResult(entry);
    setQuery(entry.name);
    setOpen(false);
    setActiveIdx(-1);
  }

  function handleInputChange(e) {
    const q = e.target.value;
    onManualType?.();
    setQuery(q);
    setActiveIdx(-1);
    if (!q.trim()) {
      setOpen(false);
      setOsmResults(null);
      return;
    }
    setOpen(true);

    clearTimeout(debounceRef.current);
    if (q.trim().length >= 3 && q !== lastOsmQRef.current) {
      setLoadingOsm(true);
      debounceRef.current = setTimeout(async () => {
        lastOsmQRef.current = q;
        try {
          const raw = await fetchNominatim(q, { limit: 4 });
          const filtered = raw.filter((r) => !findDuplicate(r.lat, r.lng, r.name, searchIndex.indexRef.current));
          setOsmResults(filtered.length ? filtered : null);
        } catch {
          // matches legacy's silent .catch(() => {}) on the live-suggestion path
        } finally {
          setLoadingOsm(false);
        }
      }, 420);
    } else if (q.trim().length < 3) {
      setOsmResults(null);
      setLoadingOsm(false);
    }
  }

  async function doFullSearch() {
    const q = query.trim();
    if (!q) return;
    const local = searchIndex.resolve(q);
    if (local) {
      // Slice 14 instrumentation (ANALYTICS_BUILD_PLAN.md §9).
      track('search_query', { query: q, result_count: 1 });
      handleSelect(local);
      return;
    }
    try {
      const raw = await fetchNominatim(q, { limit: 1 });
      track('search_query', { query: q, result_count: raw.length });
      if (raw.length) handleSelect(raw[0]);
      else setOsmResults([]); // triggers the "Nothing found" empty state below
    } catch (e) {
      alert('Search failed — check your connection.');
      // Slice 14 instrumentation (ANALYTICS_BUILD_PLAN.md §9) — only the
      // full-search failure, not the live-suggestion catch above (that
      // one's deliberately silent, matching legacy, and would fire on
      // every debounce network hiccup rather than a meaningful error).
      track('error_occurred', { context: 'search_query', message: e?.message || String(e) });
    }
  }

  const flatResults = [...localResults, ...(osmResults || [])];

  function handleKeyDown(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, flatResults.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIdx >= 0 && flatResults[activeIdx]) handleSelect(flatResults[activeIdx]);
      else doFullSearch();
    } else if (e.key === 'Escape') {
      setOpen(false);
      inputRef.current?.blur();
    }
  }

  function handleClear() {
    setQuery('');
    setOpen(false);
    setOsmResults(null);
    clearMarker();
    inputRef.current?.focus();
  }

  function handleLogoClick() {
    onToggleCollapsed?.(!collapsed);
    setTimeout(() => map?.invalidateSize({ animate: false }), 0);
  }

  function handleNavClick() {
    // Was a no-op stub left over from before Slice 9's navigation feature
    // was built (comment said "inert until Slice 9" — Slice 9 is done now,
    // this just never got wired up). Opens the same "Where to?" flow as
    // the sidebar's Navigate rail item / mobile FAB.
    onNavigateClick?.();
  }

  const noResultsMsg =
    osmResults !== null && osmResults.length === 0 && localResults.length === 0
      ? `Nothing found for "${query}". Try a more specific name.`
      : null;

  return (
    <div ref={barRef} className={styles.bar} style={collapsed ? { left: 'calc(var(--sidebar-rail-w) + 16px)' } : undefined}>
      <div className={styles.pill}>
        <button className={styles.logoBtn} onClick={handleLogoClick} title="Toggle sidebar" type="button">
          <Menu size={16} />
        </button>
        <div className={styles.divider} />
        <Search size={15} className={styles.searchIcon} />
        <input
          ref={inputRef}
          className={styles.input}
          placeholder="Search FUTA campus…"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => query.trim() && setOpen(true)}
        />
        {query && (
          <button className={styles.clearBtn} onClick={handleClear} type="button" aria-label="Clear search">
            <X size={14} />
          </button>
        )}
        <div className={styles.actionDivider} />
        <button className={styles.navBtn} onClick={handleNavClick} title="Navigate" type="button">
          <Navigation size={15} />
        </button>
      </div>

      {open && (
        <div className={styles.dropdown}>
          {noResultsMsg ? (
            <div className={styles.noResults}>{noResultsMsg}</div>
          ) : (
            <SearchDropdownList
              localResults={localResults}
              osmResults={osmResults}
              query={query}
              loading={loadingOsm}
              icon={searchIndex.icon}
              highlight={searchIndex.highlight}
              onSelect={handleSelect}
              activeIdx={activeIdx}
            />
          )}
        </div>
      )}
    </div>
  );
}