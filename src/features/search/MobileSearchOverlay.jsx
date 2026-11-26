import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, X } from 'lucide-react';
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
import styles from './MobileSearchOverlay.module.css';
import { readPersistentState, writePersistentState } from '../../lib/persistentState';
import { track } from '../../lib/analytics';

/**
 * Full-screen mobile search overlay opened by MobileSearchBar.
 */
export default function MobileSearchOverlay({ open, map, searchIndex, onSelect, onClose, chips, onChipClick }) {
  const [query, setQuery] = useState(() => readPersistentState('mobile-search-query', ''));
  const [osmResults, setOsmResults] = useState(null);
  const [loadingOsm, setLoadingOsm] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [recentSearches, setRecentSearches] = useState(() => getRecentSearches());

  const inputRef = useRef(null);
  const debounceRef = useRef(null);
  const abortRef = useRef(null);
  const latestQueryRef = useRef(query);
  latestQueryRef.current = query;
  const typedRef = useRef(false);
  const osmForRef = useRef('');
  const osmFailedForRef = useRef('');

  const user = useLiveLocation(open);
  const { selectResult } = useSelectResult({ map, searchIndex, onSelect });

  const searchIndexRef = useRef(searchIndex);
  searchIndexRef.current = searchIndex;
  const userRef = useRef(user);
  userRef.current = user;

  const trimmed = query.trim();
  const localResults = trimmed ? searchIndex.query(trimmed, 8, { user }) : [];
  const matchedChip = trimmed ? matchCategoryChip(trimmed, chips) : null;

  function cancelOsm() {
    clearTimeout(debounceRef.current);
    abortRef.current?.abort();
  }

  function scheduleOsmLookup(qTrim, nextLocal) {
    if (!qTrim || !shouldQueryNominatim(nextLocal, qTrim)) {
      cancelOsm();
      osmForRef.current = '';
      setOsmResults(null);
      setLoadingOsm(false);
      return;
    }

    if (osmForRef.current === qTrim && osmResults !== null) {
      setLoadingOsm(false);
      return;
    }

    cancelOsm();
    osmForRef.current = '';
    setOsmResults(null);
    setLoadingOsm(true);

    debounceRef.current = setTimeout(async () => {
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const raw = await fetchNominatim(qTrim, { limit: 4, signal: controller.signal });
        if (latestQueryRef.current.trim() !== qTrim) return;
        const idx = searchIndexRef.current.indexRef.current;
        const filtered = raw.filter((r) => !findDuplicate(r.lat, r.lng, r.name, idx));
        osmForRef.current = qTrim;
        setOsmResults(filtered);
      } catch (err) {
        if (err?.name !== 'AbortError' && latestQueryRef.current.trim() === qTrim) {
          osmFailedForRef.current = qTrim;
          osmForRef.current = '';
          setOsmResults(null);
        }
      } finally {
        if (latestQueryRef.current.trim() === qTrim) {
          setLoadingOsm(false);
        }
      }
    }, 420);
  }

  useEffect(() => {
    return () => {
      clearTimeout(debounceRef.current);
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (open) {
      typedRef.current = false;
      osmForRef.current = '';
      osmFailedForRef.current = '';
      setSearchError(null);
      setLoadingOsm(false);
      setOsmResults(null);
      setRecentSearches(getRecentSearches());
      const restored = readPersistentState('mobile-search-query', '');
      latestQueryRef.current = restored;
      setQuery(restored);

      const restoredTrim = restored.trim();
      if (restoredTrim) {
        const restoredLocal = searchIndexRef.current.query(restoredTrim, 8, { user: userRef.current });
        if (shouldQueryNominatim(restoredLocal, restoredTrim)) {
          setLoadingOsm(true);
          debounceRef.current = setTimeout(async () => {
            const controller = new AbortController();
            abortRef.current = controller;
            try {
              const raw = await fetchNominatim(restoredTrim, { limit: 4, signal: controller.signal });
              if (latestQueryRef.current.trim() !== restoredTrim) return;
              const idx = searchIndexRef.current.indexRef.current;
              const filtered = raw.filter((r) => !findDuplicate(r.lat, r.lng, r.name, idx));
              osmForRef.current = restoredTrim;
              setOsmResults(filtered);
            } catch (err) {
              if (err?.name !== 'AbortError' && latestQueryRef.current.trim() === restoredTrim) {
                osmFailedForRef.current = restoredTrim;
                osmForRef.current = '';
                setOsmResults(null);
              }
            } finally {
              if (latestQueryRef.current.trim() === restoredTrim) {
                setLoadingOsm(false);
              }
            }
          }, 420);
        }
      }

      const t = setTimeout(() => inputRef.current?.focus(), 80);
      return () => clearTimeout(t);
    }
    clearTimeout(debounceRef.current);
    abortRef.current?.abort();
    osmForRef.current = '';
    latestQueryRef.current = '';
    setLoadingOsm(false);
    setQuery('');
    setOsmResults(null);
    setSearchError(null);
    return undefined;
  }, [open]);

  useEffect(() => {
    if (open) writePersistentState('mobile-search-query', query);
  }, [open, query]);

  function resultCount() {
    const osm = osmForRef.current === query.trim() && osmResults ? osmResults.length : 0;
    return localResults.length + osm;
  }

  function handleSelect(entry, overrideCount = null) {
    cancelOsm();
    setLoadingOsm(false);
    const qTrim = query.trim();
    if (qTrim) {
      track('search_query', { query: qTrim, result_count: overrideCount ?? resultCount() });
    }
    if (entry.source !== 'coord' && entry.type !== 'coord') {
      setRecentSearches(addRecentSearch(entry));
    }
    selectResult(entry, qTrim);
    onClose();
  }

  function handleSelectChip(chip) {
    cancelOsm();
    setLoadingOsm(false);
    onChipClick?.(chip);
    onClose();
  }

  // Leaving with a query that found nothing signals a content gap to Insights.
  function handleClose() {
    cancelOsm();
    const q = query.trim();
    const osmSettled = !shouldQueryNominatim(localResults, q) || (osmForRef.current === q && !loadingOsm);
    if (q && typedRef.current && osmSettled && osmFailedForRef.current !== q && resultCount() === 0) {
      track('search_query', { query: q, result_count: 0 });
    }
    setLoadingOsm(false);
    onClose();
  }

  function handleInputChange(e) {
    const q = e.target.value;
    latestQueryRef.current = q;
    typedRef.current = true;
    setQuery(q);
    setSearchError(null);

    const qTrim = q.trim();
    if (!qTrim) {
      scheduleOsmLookup('', []);
      return;
    }

    const nextLocal = searchIndex.query(qTrim, 8, { user });
    scheduleOsmLookup(qTrim, nextLocal);
  }

  async function handleKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      const q = query.trim();
      if (!q) return;
      if (localResults.length) {
        handleSelect(localResults[0]);
        return;
      }
      if (osmForRef.current === q && osmResults && osmResults.length) {
        handleSelect(osmResults[0]);
        return;
      }
      const resolved = searchIndex.resolve(q, { user });
      if (resolved) {
        handleSelect(resolved, 1);
        return;
      }

      cancelOsm();
      const controller = new AbortController();
      abortRef.current = controller;
      setLoadingOsm(true);
      setSearchError(null);
      try {
        const raw = await fetchNominatim(q, { limit: 1, signal: controller.signal });
        if (latestQueryRef.current.trim() !== q) return;
        osmForRef.current = q;
        if (raw.length) {
          setOsmResults(raw);
          handleSelect(raw[0], raw.length);
        } else {
          setOsmResults([]);
        }
      } catch (err) {
        if (err?.name === 'AbortError') return;
        osmFailedForRef.current = q;
        setSearchError('Search failed — check your connection.');
        track('error_occurred', { context: 'search_query', message: err?.message || String(err) });
      } finally {
        if (latestQueryRef.current.trim() === q) setLoadingOsm(false);
      }
    } else if (e.key === 'Escape') {
      handleClose();
    }
  }

  function handleClear() {
    cancelOsm();
    osmForRef.current = '';
    latestQueryRef.current = '';
    setQuery('');
    setOsmResults(null);
    setLoadingOsm(false);
    setSearchError(null);
    inputRef.current?.focus();
  }

  const validOsmResults = osmForRef.current === trimmed ? osmResults : null;
  const emptyMessage =
    osmForRef.current === trimmed &&
    validOsmResults !== null &&
    validOsmResults.length === 0 &&
    localResults.length === 0
      ? `Nothing found for "${trimmed}". Try a more specific name.`
      : null;

  return (
    <div className={`${styles.overlay} ${open ? styles.active : ''}`}>
      <div className={styles.ovBar}>
        <button className={styles.back} onClick={handleClose} aria-label="Back" type="button">
          <ArrowLeft size={20} />
        </button>
        <input
          ref={inputRef}
          className={styles.input}
          placeholder="Search FUTA campus…"
          autoComplete="off"
          spellCheck="false"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
        />
        {query && (
          <button className={styles.clear} onClick={handleClear} aria-label="Clear" type="button">
            <X size={16} />
          </button>
        )}
      </div>
      <div className={styles.results}>
        <SearchDropdownList
          localResults={localResults}
          osmResults={validOsmResults}
          query={query}
          loading={loadingOsm}
          icon={searchIndex.icon}
          highlight={searchIndex.highlight}
          onSelect={handleSelect}
          showBadge={false}
          matchedChip={matchedChip}
          onSelectChip={handleSelectChip}
          recentSearches={recentSearches}
          onRemoveRecent={(entry) => setRecentSearches(removeRecentSearch(entry))}
          onClearRecent={() => setRecentSearches(clearRecentSearches())}
          searchError={searchError}
          emptyMessage={emptyMessage}
        />
      </div>
    </div>
  );
}
