import { useEffect, useRef, useState } from 'react';
import { X, Navigation, Heart } from 'lucide-react';
import { DONATE_URL } from '../../lib/donate';
import { fetchNominatim } from './nominatimSearch';
import { useSelectResult } from './useSelectResult';
import { useLiveLocation } from './useLiveLocation';
import { matchCategoryChip, shouldQueryNominatim } from './searchEngine';
import {
  addRecentSearch,
  clearRecentSearches,
  getRecentSearches,
  removeRecentSearch,
} from './recentSearches';
import { findDuplicate } from '../osm-annotations/osmAnnotationUtils';
import SearchDropdownList from './SearchDropdownList';
import styles from './DesktopSearchBar.module.css';
import { track } from '../../lib/analytics';
import { readPersistentState, writePersistentState } from '../../lib/persistentState';

/**
 * Floating desktop search pill + dropdown at top-center of the map.
 */
export default function DesktopSearchBar({
  map,
  searchIndex,
  onSelect,
  collapsed,
  onManualType,
  activeChipLabel,
  onNavigateClick,
  dismissKey,
  onDropdownOpen,
  chips,
  onChipClick,
}) {
  const [query, setQuery] = useState(() => readPersistentState('desktop-search-query', ''));
  const [open, setOpen] = useState(false);
  const [osmResults, setOsmResults] = useState(null);
  const [loadingOsm, setLoadingOsm] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [recentSearches, setRecentSearches] = useState(() => getRecentSearches());

  const barRef = useRef(null);
  const inputRef = useRef(null);
  const debounceRef = useRef(null);
  const abortRef = useRef(null);
  const lastOsmQRef = useRef('');
  const latestQueryRef = useRef(query);
  latestQueryRef.current = query;

  const user = useLiveLocation(open);
  const { selectResult, clearMarker } = useSelectResult({ map, searchIndex, onSelect });

  const trimmed = query.trim();
  const localResults = trimmed ? searchIndex.query(trimmed, 8, { user }) : [];
  const matchedChip = trimmed ? matchCategoryChip(trimmed, chips) : null;

  useEffect(() => writePersistentState('desktop-search-query', query), [query]);

  useEffect(() => {
    return () => {
      clearTimeout(debounceRef.current);
      abortRef.current?.abort();
    };
  }, []);

  // Chip click fills the input text without opening the dropdown or counting as manual typing.
  useEffect(() => {
    if (activeChipLabel != null) {
      latestQueryRef.current = activeChipLabel;
      setQuery(activeChipLabel);
      setOpen(false);
      setActiveIdx(-1);
      setSearchError(null);
    }
  }, [activeChipLabel]);

  // Only one map surface open at a time.
  useEffect(() => {
    if (open) onDropdownOpen?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    setOpen(false);
    setActiveIdx(-1);
  }, [dismissKey]);

  // Close on outside click.
  useEffect(() => {
    function onDocClick(e) {
      if (barRef.current && !barRef.current.contains(e.target)) {
        setOpen(false);
        setActiveIdx(-1);
      }
    }
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, []);

  const navigableItems = !trimmed
    ? recentSearches.map((entry) => ({ kind: 'result', entry }))
    : [
        ...(matchedChip ? [{ kind: 'chip', chip: matchedChip }] : []),
        ...localResults.map((entry) => ({ kind: 'result', entry })),
        ...(osmResults || []).map((entry) => ({ kind: 'result', entry: { ...entry, type: 'osm', subtype: 'osm' } })),
      ];

  function handleSelect(entry) {
    const isBusiness = entry.source === 'business' || entry.isBusiness;
    if (!isBusiness && (entry.lat == null || entry.lng == null)) return;
    const q = query.trim();
    selectResult(entry, q);
    if (entry.source !== 'coord' && entry.type !== 'coord') {
      setRecentSearches(addRecentSearch(entry));
    }
    latestQueryRef.current = entry.name;
    setQuery(entry.name);
    setOpen(false);
    setActiveIdx(-1);
    setSearchError(null);
  }

  function handlePick(entry) {
    const isBusiness = entry.source === 'business' || entry.isBusiness;
    if ((isBusiness || (entry.lat != null && entry.lng != null)) && query.trim()) {
      track('search_query', {
        query: query.trim(),
        result_count: localResults.length + (osmResults?.length || 0),
      });
    }
    handleSelect(entry);
  }

  function handleSelectChip(chip) {
    onChipClick?.(chip);
    setOpen(false);
    setActiveIdx(-1);
  }

  function handleInputChange(e) {
    const q = e.target.value;
    latestQueryRef.current = q;
    onManualType?.();
    setQuery(q);
    setActiveIdx(-1);
    setSearchError(null);

    clearTimeout(debounceRef.current);
    abortRef.current?.abort();

    const qTrim = q.trim();
    if (!qTrim) {
      setOsmResults(null);
      setLoadingOsm(false);
      lastOsmQRef.current = '';
      setOpen(recentSearches.length > 0);
      return;
    }
    setOpen(true);

    const nextLocal = searchIndex.query(qTrim, 8, { user });
    if (shouldQueryNominatim(nextLocal, qTrim) && qTrim !== lastOsmQRef.current) {
      setLoadingOsm(true);
      debounceRef.current = setTimeout(async () => {
        const controller = new AbortController();
        abortRef.current = controller;
        lastOsmQRef.current = qTrim;
        try {
          const raw = await fetchNominatim(qTrim, { limit: 4, signal: controller.signal });
          if (latestQueryRef.current.trim() !== qTrim) return;
          const filtered = raw.filter((r) => !findDuplicate(r.lat, r.lng, r.name, searchIndex.indexRef.current));
          setOsmResults(filtered);
        } catch (err) {
          if (err?.name !== 'AbortError' && latestQueryRef.current.trim() === qTrim) {
            setOsmResults(null);
          }
        } finally {
          if (latestQueryRef.current.trim() === qTrim) {
            setLoadingOsm(false);
          }
        }
      }, 420);
    } else {
      setOsmResults(null);
      setLoadingOsm(false);
      if (qTrim.length < 3) lastOsmQRef.current = '';
    }
  }

  async function doFullSearch() {
    const q = query.trim();
    if (!q) return;
    setSearchError(null);

    const local = searchIndex.resolve(q, { user });
    if (local) {
      track('search_query', { query: q, result_count: Math.max(1, localResults.length) });
      handleSelect(local);
      return;
    }

    clearTimeout(debounceRef.current);
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoadingOsm(true);
    try {
      const raw = await fetchNominatim(q, { limit: 1, signal: controller.signal });
      if (latestQueryRef.current.trim() !== q) return;
      track('search_query', { query: q, result_count: raw.length });
      if (raw.length) {
        handleSelect(raw[0]);
      } else {
        setOsmResults([]);
        setOpen(true);
      }
    } catch (e) {
      if (e?.name === 'AbortError') return;
      setSearchError('Search failed — check your connection.');
      setOpen(true);
      track('error_occurred', { context: 'search_query', message: e?.message || String(e) });
    } finally {
      if (latestQueryRef.current.trim() === q) setLoadingOsm(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open && (trimmed || recentSearches.length > 0)) setOpen(true);
      setActiveIdx((i) => Math.min(i + 1, navigableItems.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => (i <= 0 ? -1 : i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const picked = activeIdx >= 0 ? navigableItems[activeIdx] : null;
      if (picked?.kind === 'chip') handleSelectChip(picked.chip);
      else if (picked?.kind === 'result') handlePick(picked.entry);
      else if (trimmed) doFullSearch();
    } else if (e.key === 'Escape') {
      setOpen(false);
      setActiveIdx(-1);
      inputRef.current?.blur();
    }
  }

  function handleClear() {
    clearTimeout(debounceRef.current);
    abortRef.current?.abort();
    lastOsmQRef.current = '';
    latestQueryRef.current = '';
    setQuery('');
    setOsmResults(null);
    setLoadingOsm(false);
    setSearchError(null);
    setActiveIdx(-1);
    setOpen(recentSearches.length > 0);
    clearMarker();
    inputRef.current?.focus();
  }

  function handleRemoveRecent(entry) {
    const next = removeRecentSearch(entry);
    setRecentSearches(next);
    if (!next.length && !trimmed) setOpen(false);
  }

  function handleClearRecent() {
    clearRecentSearches();
    setRecentSearches([]);
    if (!trimmed) setOpen(false);
  }

  const emptyMessage =
    osmResults !== null && osmResults.length === 0 && localResults.length === 0
      ? `Nothing found for "${trimmed}". Try a more specific name.`
      : null;

  return (
    <div ref={barRef} className={styles.bar} style={collapsed ? { left: 'calc(var(--sidebar-rail-w) + 16px)' } : undefined}>
      <div className={styles.pill}>
        <a
          className={styles.logoBtn}
          href={DONATE_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Support Maps By FUTA"
          title="Support Maps By FUTA"
          onClick={() => track('donate_click', { source: 'search_bar' })}
        >
          <Heart size={16} />
        </a>
        <div className={styles.divider} />
        <input
          ref={inputRef}
          className={styles.input}
          placeholder="Search FUTA campus…"
          aria-label="Search FUTA campus"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            setRecentSearches(getRecentSearches());
            if (trimmed || getRecentSearches().length > 0) setOpen(true);
          }}
        />
        {query && (
          <button className={styles.clearBtn} onClick={handleClear} type="button" aria-label="Clear search">
            <X size={14} />
          </button>
        )}
        <button className={styles.navBtn} onClick={() => onNavigateClick?.()} title="Navigate" type="button">
          <Navigation size={15} />
        </button>
      </div>

      {open && (
        <div className={styles.dropdown}>
          <SearchDropdownList
            localResults={localResults}
            osmResults={osmResults}
            query={query}
            loading={loadingOsm}
            icon={searchIndex.icon}
            highlight={searchIndex.highlight}
            onSelect={handlePick}
            activeIdx={activeIdx}
            matchedChip={matchedChip}
            onSelectChip={handleSelectChip}
            recentSearches={recentSearches}
            onRemoveRecent={handleRemoveRecent}
            onClearRecent={handleClearRecent}
            searchError={searchError}
            emptyMessage={emptyMessage}
          />
        </div>
      )}
    </div>
  );
}
