import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Search, X } from "lucide-react";
import { useWaypoints } from "../waypoints/useWaypoints";
import { TYPE_ICON_KEYS } from "../../lib/typeIcons";
import { WP_TYPE_LABELS, resolveWaypointType } from "../waypoints/wpTypeMeta";
import { highlight } from "../search/highlight";
import SearchResultItem from "../search/SearchResultItem";
import styles from "./WaypointSearchPanel.module.css";

const MAX_RESULTS = 8;

function norm(s) {
  return (s || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .trim();
}

// Lightweight relevance score, name-only — this list is at most a few
// hundred approved waypoints (see useWaypoints.js's DATA SCALE note), so
// no need for useSearchIndex's fuller weighting (desc terms, source
// boosts); exact/prefix/substring/word-match covers this well.
function scoreEntry(entry, q) {
  const nq = norm(q);
  if (!nq) return 0;
  const nn = norm(entry.name);
  if (nn === nq) return 100;
  if (nn.startsWith(nq)) return 60;
  if (nn.includes(nq)) return 40;
  return nq.split(/\s+/).some((w) => w && nn.includes(w)) ? 15 : 0;
}

function iconFor(entry) {
  return TYPE_ICON_KEYS[entry.type] || "geo-alt-fill";
}

// ── Search on Map ───────────────────────────────────────────────────────
//
// Replaces PromotePage's old "Pick on Map" — a cross-route round trip
// (navigate to /map with `state: { pickCoordFor: '/promote' }`, wait for
// one click, navigate back with `state: { pickedCoord }`; see
// MapPage.jsx's now-removed `externalPick` effect). A business owner
// promoting a listing is almost always promoting a place that's *already*
// on the map — their own shop, a hostel gate, a faculty building — so
// searching FUTA Maps' own waypoint database and picking the existing pin
// is fewer steps and more accurate than a fresh GPS/map click. Reuses
// SearchResultItem (features/search/) so result rows match the ones the
// map's own search bar renders elsewhere in the app.
export default function WaypointSearchPanel({ onSelect, onClose }) {
  const { waypoints, loading, error } = useWaypoints();
  const [query, setQuery] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // People/Channel entries have no lat/lng (same exclusion useSearchIndex
  // applies to its own waypoint registration) — not a pickable location.
  const entries = useMemo(
    () =>
      (waypoints || [])
        .filter((wp) => !wp.isPerson && !wp.isChannel && wp.lat != null && wp.lng != null)
        .map((wp) => ({
          id: wp.id,
          name: wp.name,
          desc: wp.description || "",
          lat: wp.lat,
          lng: wp.lng,
          type: wp.type,
          subtype: WP_TYPE_LABELS[resolveWaypointType(wp)] || "Place",
          source: "waypoint",
        })),
    [waypoints],
  );

  const trimmedQuery = query.trim();

  const results = useMemo(() => {
    if (!trimmedQuery) return [];
    return entries
      .map((e) => ({ ...e, _score: scoreEntry(e, trimmedQuery) }))
      .filter((e) => e._score > 0)
      .sort((a, b) => b._score - a._score)
      .slice(0, MAX_RESULTS);
  }, [entries, trimmedQuery]);

  function handleKeyDown(e) {
    if (e.key === "Escape") onClose();
  }

  return (
    <div className={styles.panel}>
      <div className={styles.searchRow}>
        <Search size={15} strokeWidth={2} className={styles.searchIcon} />
        <input
          ref={inputRef}
          type="text"
          className={styles.searchInput}
          placeholder="Search waypoints by name…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        {query !== "" && (
          <button
            type="button"
            className={styles.clearBtn}
            onClick={() => setQuery("")}
            aria-label="Clear search"
          >
            <X size={13} strokeWidth={2.5} />
          </button>
        )}
        <button type="button" className={styles.closeBtn} onClick={onClose}>
          Cancel
        </button>
      </div>

      {loading && (
        <div className={styles.status}>
          <Loader2 size={14} strokeWidth={2} className={styles.spin} />
          <span>Loading waypoints…</span>
        </div>
      )}

      {!loading && error && (
        <div className={styles.status}>Couldn’t load waypoints. Try again shortly.</div>
      )}

      {!loading && !error && trimmedQuery === "" && (
        <div className={styles.hint}>
          Start typing your shop or building’s name to find its pin.
        </div>
      )}

      {!loading && !error && trimmedQuery !== "" && results.length === 0 && (
        <div className={styles.status}>No waypoints match “{trimmedQuery}”.</div>
      )}

      {results.length > 0 && (
        <div className={styles.results}>
          {results.map((entry) => (
            <SearchResultItem
              key={entry.id}
              entry={entry}
              query={query}
              icon={iconFor}
              highlight={highlight}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}
