import { useMemo } from 'react';
import { ArrowLeft, X, MapPin } from 'lucide-react';
import { gatherResults } from './chipConfig';
import ChipResultRow from './ChipResultRow';
import styles from './ChipResultsPanel.module.css';

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
  const results = useMemo(() => {
    if (!activeChip) return [];
    return gatherResults(activeChip, { waypoints, searchIndex });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChip, waypoints, searchIndex, kmlAnnotations]);

  if (!activeChip) return null;

  const loading = !waypointsLoaded;
  const subtitle = loading ? 'Loading…' : results.length ? 'Sorted alphabetically' : 'No places found';
  const badge = loading ? '…' : String(results.length || 0);

  function handleOpen(r) {
    map?.flyTo([r.lat, r.lng], 18, { duration: 1.0 });
    setTimeout(() => {
      onSelect?.({
        name: r.name,
        badge: (r.type || 'poi').replace(/_/g, ' ').toUpperCase(),
        description: r.desc || '',
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
      <div className={styles.emptyIcon}>{activeChip.emoji}</div>
      No <strong>{activeChip.label.toLowerCase()}</strong> places mapped yet.
    </div>
  ) : (
    results.map((r, i) => (
      <ChipResultRow
        key={r.id || r.name + i}
        result={r}
        iconText={activeChip.emoji}
        onOpen={handleOpen}
        onNavigate={handleNavigate}
        style={{ animationDelay: Math.min(i * 0.035, 0.4) + 's' }}
      />
    ))
  );

  if (isMobile) {
    return (
      <>
        <div className={styles.scrim} onClick={onClose} />
        <div className={styles.card}>
          <div className={styles.hd}>
            <div className={styles.hdLeft}>
              <span className={styles.emoji}>{activeChip.emoji}</span>
              <span className={styles.title}>{activeChip.label}</span>
              <span className={styles.badge}>{badge}</span>
            </div>
            <button className={styles.close} onClick={onClose} aria-label="Close" type="button">
              <X size={14} />
            </button>
          </div>
          <div className={styles.list}>
            {!loading && results.length > 0 && (
              <div className={styles.locBar}>
                <MapPin size={11} />
                Showing {results.length} place{results.length !== 1 ? 's' : ''}
              </div>
            )}
            {body}
          </div>
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
        <span className={styles.icon}>{activeChip.emoji}</span>
        <div className={styles.titles}>
          <div className={styles.title}>{activeChip.label}</div>
          <div className={styles.subtitle}>{subtitle}</div>
        </div>
        <span className={styles.badge}>{badge}</span>
      </div>
      <div className={styles.list}>
        {!loading && results.length > 0 && (
          <div className={styles.locBar}>
            <MapPin size={11} />
            Showing {results.length} place{results.length !== 1 ? 's' : ''} · nearest first
          </div>
        )}
        {body}
      </div>
    </div>
  );
}
