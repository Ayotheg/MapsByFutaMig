import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, X } from 'lucide-react';
import { fetchNominatim } from './nominatimSearch';
import { useSelectResult } from './useSelectResult';
import { findDuplicate } from '../osm-annotations/osmAnnotationUtils';
import SearchDropdownList from './SearchDropdownList';
import styles from './MobileSearchOverlay.module.css';

/**
 * Ported from legacy's dynamically-built `#mobSearchOverlay` (app.js
 * ~5808–5958) — a comment-flagged fix: "mobSearchTrig was captured but
 * never wired — this fixes it." Full-screen overlay opened by
 * MobileSearchBar, giving mobile the same live local+OSM suggestions as
 * desktop.
 *
 * Reuses SearchDropdownList/SearchResultItem (built for the desktop
 * dropdown) rather than re-implementing legacy's near-identical but
 * slightly-larger `.mob-ov-item` row style, and passes `showBadge={false}`
 * to match one real difference: legacy's mobile rows never render the
 * type badge desktop's `.sd-item` does. The row padding/font-size here
 * matches the desktop dropdown rather than legacy's separate (marginally
 * larger) mobile numbers — a minor, flagged simplification, not a
 * behavioral one.
 *
 * Faithfully NOT ported: unlike the desktop bar's Enter-with-no-selection
 * behavior (`deskDoSearch`, which falls back to a full OSM search),
 * legacy's mobile overlay Enter handler (~5939–5948) only tries
 * `FUTA_SEARCH.resolve()` and does nothing if that comes up empty — no OSM
 * fallback. Reproduced exactly as-is.
 */
export default function MobileSearchOverlay({ open, map, searchIndex, onSelect, onClose }) {
  const [query, setQuery] = useState('');
  const [osmResults, setOsmResults] = useState(null);
  const [loadingOsm, setLoadingOsm] = useState(false);
  const inputRef = useRef(null);
  const debounceRef = useRef(null);
  const lastOsmQRef = useRef('');

  const { selectResult } = useSelectResult({ map, searchIndex, onSelect });
  const localResults = query.trim() ? searchIndex.query(query, 6) : [];

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 80);
      return () => clearTimeout(t);
    }
    setQuery('');
    setOsmResults(null);
  }, [open]);

  function handleSelect(entry) {
    selectResult(entry);
    onClose();
  }

  function handleInputChange(e) {
    const q = e.target.value;
    setQuery(q);
    if (!q.trim()) {
      setOsmResults(null);
      return;
    }
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
          // matches legacy's silent .catch(() => {})
        } finally {
          setLoadingOsm(false);
        }
      }, 420);
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') {
      const q = query.trim();
      if (!q) return;
      const local = searchIndex.resolve(q);
      if (local) handleSelect(local);
    } else if (e.key === 'Escape') {
      onClose();
    }
  }

  function handleClear() {
    setQuery('');
    setOsmResults(null);
    inputRef.current?.focus();
  }

  return (
    <div className={`${styles.overlay} ${open ? styles.active : ''}`}>
      <div className={styles.ovBar}>
        <button className={styles.back} onClick={onClose} aria-label="Back" type="button">
          <ArrowLeft size={18} />
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
            <X size={14} />
          </button>
        )}
      </div>
      <div className={styles.results}>
        <SearchDropdownList
          localResults={localResults}
          osmResults={osmResults}
          query={query}
          loading={loadingOsm}
          icon={searchIndex.icon}
          highlight={searchIndex.highlight}
          onSelect={handleSelect}
          showBadge={false}
        />
      </div>
    </div>
  );
}
