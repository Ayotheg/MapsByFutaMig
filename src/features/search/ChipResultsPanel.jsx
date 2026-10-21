import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, X, MapPin } from 'lucide-react';
import { gatherResults, fmtMeters, NEARBY_RADIUS_M } from './chipConfig';
import { useLiveLocation } from './useLiveLocation';
import { LEGACY_ICON_MAP } from '../../lib/legacyIconMap';
import { chipIconKey } from '../shared/placeCategories';
import ChipResultRow from './ChipResultRow';
import styles from './ChipResultsPanel.module.css';

// Longest row stagger (0.4s) plus the slide itself, with some slack.
const ROW_ENTRANCE_MS = 800;

/**
 * Ports the results-display half of `initQuickChips` (app.js ~6545–6799,
 * ~6694–6779) — the desktop `#deskChipResults` floating panel and the
 * mobile `#catCard` overlay+scrim. Legacy builds these as two branches of
 * one `openResultsPanel()` function reaching into raw DOM; here they're
 * one component switching on `isMobile` (passed down from MapPage, same
 * source of truth Sidebar/MobileSheet already use).
 *
 * Deviation, flagged: legacy has a 14-try, 700ms-interval "retry loop"
 * (`_waitAndOpen`) that polls `window._waypointLayers` while Firestore is
 * still loading, since the vanilla click handler computes results once at
 * click time and has no way to know when data later arrives. Results here
 * are computed via `useMemo` off the live `waypoints` prop instead — as
 * soon as `useWaypoints()` finishes its fetch, this panel updates on its
 * own the next render. Same eventual outcome (results appear once data's
 * in), no polling loop needed. The "Fetching map data…" loading state is
 * kept for the brief window before `waypoints` first resolves.
 *
 * `kmlAnnotations` is in the memo's dependency list even though
 * `gatherResults` reads KML entries via `searchIndex.indexRef` (a plain
 * ref) rather than this prop directly. Necessary anyway: `searchIndex`'s
 * own object identity never changes across the session (its
 * register/query/resolve callbacks all have stable `useCallback` deps —
 * see useSearchIndex.js), so `searchIndex` alone in this array can't tell
 * React "KML data changed, recompute". Without `kmlAnnotations` here, a
 * chip opened before StaticKmlLayer's staggered batches finish loading
 * would keep showing whatever was in the index at that first render,
 * forever — exactly what looked like "KML points aren't in Quick Chips"
 * even after the underlying matching logic was already correct.
 *
 * `panelCatResults` (the sidebar-panel version of this, index.html
 * `#panelCatResults`/`#catRp*`) is confirmed dead: its inner refs
 * (`rIcon`/`rTitle`/`rBadge`/`rList`) are captured at app.js ~6344–6350
 * but never once written to anywhere in `initQuickChips` — only its back
 * button (`rBack`) is wired, and the panel that button would close is
 * itself never opened by anything. Not ported.
 */
export default function ChipResultsPanel({ activeChip, waypoints, kmlAnnotations, waypointsLoaded, searchIndex, map, onSelect, onNavigate, onClose, isMobile, collapsed }) {
  // Live position while the panel is open (shared GPS watch). Each move of
  // 10 m+ re-gathers the results, so the list stays nearest-first.
  const user = useLiveLocation(!!activeChip);

  const results = useMemo(() => {
    if (!activeChip) return [];
    return gatherResults(activeChip, { waypoints, searchIndex, user });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChip, waypoints, searchIndex, kmlAnnotations, user]);

  const loading = !waypointsLoaded;

  // Rows slide in once per opened chip. A move re-sorts them, which
  // re-inserts the DOM nodes and would replay the slide on every 10 m.
  const chipKey = activeChip ? activeChip.id || activeChip.label : null;
  const [settledFor, setSettledFor] = useState(null);
  if (!chipKey && settledFor !== null) setSettledFor(null);
  const rowsShown = !!chipKey && !loading && results.length > 0;
  useEffect(() => {
    if (!rowsShown || settledFor === chipKey) return undefined;
    const t = setTimeout(() => setSettledFor(chipKey), ROW_ENTRANCE_MS);
    return () => clearTimeout(t);
  }, [rowsShown, chipKey, settledFor]);
  const animateRows = settledFor !== chipKey;

  if (!activeChip) return null;

  const chipIcon = chipIconKey(activeChip);
  const ChipIcon = LEGACY_ICON_MAP[chipIcon] || MapPin;
  const badge = loading ? '…' : String(results.length || 0);
  // Consolidated status line — Figma node 4:323's header shows one line
  // under the title ("Showing 63 places") instead of the two separate
  // pieces of copy the previous layout split across the header
  // ("Sorted alphabetically") and a list-embedded bar ("Showing N
  // places · nearest first"). Same three states as before (loading /
  // empty / count), just rendered in one place now — see handoff notes.
  const subtitle = loading
    ? 'Loading…'
    : !results.length
      ? 'No places found'
      : `Showing ${results.length} place${results.length !== 1 ? 's' : ''}`;
  // How the list is ordered, on its own line so it can wrap instead of
  // being cut off on narrow screens. Nothing within NEARBY_RADIUS_M → say
  // how far the closest one is.
  const nearest = user ? results.find((r) => r.dist !== null) : null;
  // With location on but nothing measurable (e.g. only online stores),
  // asking to turn location on would be wrong.
  const sortNote =
    loading || !results.length
      ? null
      : !user
        ? 'Sorted A–Z · turn on location for nearest first'
        : !nearest
          ? 'Sorted A–Z'
          : nearest.dist > NEARBY_RADIUS_M
            ? `None nearby · closest is ${fmtMeters(nearest.dist)} away`
            : 'Nearest first';
  const sortLine = sortNote && (
    <div className={`${styles.sortNote} ${nearest && nearest.dist > NEARBY_RADIUS_M ? styles.sortNoteFar : ''}`}>
      {sortNote}
    </div>
  );

  function handleOpen(r) {
    // Business rows (see chipConfig.js) have nothing to fly to — open the
    // place card directly, same short-circuit useSelectResult.js already
    // does for search, and same badge/shape PlaceCard.jsx expects to
    // swap Navigate for the "Visit Link" button.
    if (r.isBusiness) {
      onSelect?.({
        name: r.name,
        badge: 'ONLINE STORE',
        description: r.desc || '',
        lat: null,
        lng: null,
        imageUrls: r.imageUrls || [],
        id: r.id,
        type: r.type,
        isBusiness: true,
        businessLink: r.businessLink || '',
        businessPlatform: r.businessPlatform || '',
      });
      return;
    }

    map?.flyTo([r.lat, r.lng], 18, { duration: 1.0 });
    setTimeout(() => {
      onSelect?.({
        name: r.name,
        badge: (r.type || 'poi').replace(/_/g, ' ').toUpperCase(),
        description: r.desc || '',
        area: r.area || '',
        lat: r.lat,
        lng: r.lng,
        imageUrls: r.imageUrls || [],
        id: r.id,
        type: r.type,
      });
    }, 450);
  }

  function handleNavigate(r) {
    onNavigate?.({ lat: r.lat, lng: r.lng, name: r.name, id: r.id, type: r.type });
    onClose?.();
  }

  const body = loading ? (
    <div className={styles.empty}>
      <div className={styles.loadingDots}>
        <span />
        <span />
        <span />
      </div>
      Fetching map data…
    </div>
  ) : !results.length ? (
    <div className={styles.empty}>
      <div className={styles.emptyIcon}>
        <ChipIcon size={22} />
      </div>
      No <strong>{activeChip.label.toLowerCase()}</strong> places mapped yet.
    </div>
  ) : (
    results.map((r, i) => (
      <ChipResultRow
        key={r.id || r.name + i}
        result={r}
        fallbackIconKey={chipIcon}
        onOpen={handleOpen}
        onNavigate={handleNavigate}
        animate={animateRows}
        style={animateRows ? { animationDelay: Math.min(i * 0.035, 0.4) + 's' } : undefined}
      />
    ))
  );

  if (isMobile) {
    return (
      <>
        <div className={styles.scrim} onClick={onClose} />
        <div className={styles.card}>
          <div className={styles.header}>
            <span className={styles.icon}>
              <ChipIcon size={16} />
            </span>
            <div className={styles.titles}>
              <div className={styles.title}>{activeChip.label}</div>
              <div className={styles.metaRow}>
                <span className={styles.badge}>{badge}</span>
                <span className={styles.subtitle}>{subtitle}</span>
              </div>
              {sortLine}
            </div>
            <button className={styles.close} onClick={onClose} aria-label="Close" type="button">
              <X size={14} />
            </button>
          </div>
          <div className={styles.list}>{body}</div>
        </div>
      </>
    );
  }

  return (
    <div className={styles.panel} style={collapsed ? { left: 'calc(var(--sidebar-rail-w) + 16px)' } : undefined}>
      <div className={styles.header}>
        <button className={styles.back} onClick={onClose} aria-label="Back" type="button">
          <ArrowLeft size={15} />
        </button>
        <span className={styles.icon}>
          <ChipIcon size={17} />
        </span>
        <div className={styles.titles}>
          <div className={styles.title}>{activeChip.label}</div>
          <div className={styles.metaRow}>
            <span className={styles.badge}>{badge}</span>
            <span className={styles.subtitle}>{subtitle}</span>
          </div>
          {sortLine}
        </div>
      </div>
      <div className={styles.list}>{body}</div>
    </div>
  );
}
