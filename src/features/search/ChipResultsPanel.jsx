import { useMemo } from 'react';
import { ArrowLeft, MapPin, LocateOff } from 'lucide-react';
import { gatherResults, fmtMeters, NEARBY_RADIUS_M } from './chipConfig';
import { useLiveLocation } from './useLiveLocation';
import { LEGACY_ICON_MAP } from '../../lib/legacyIconMap';
import ChipResultRow from './ChipResultRow';
import styles from './ChipResultsPanel.module.css';

/**
 * Ports the results-display half of `initQuickChips` (app.js ~6545–6799,
 * ~6694–6779) — the desktop `#deskChipResults` floating panel and the
 * mobile `#catCard` overlay. One component switching on `isMobile`.
 *
 * Results are computed via `useMemo` off the live `waypoints` prop (no
 * legacy retry/polling loop) — as soon as `useWaypoints()` finishes, the
 * panel updates on its own. `kmlAnnotations` is in the memo's deps even
 * though `gatherResults` reads KML entries via `searchIndex.indexRef` (a
 * plain ref whose identity never changes): without it a chip opened
 * before StaticKmlLayer's staggered batches finish would never pick them
 * up.
 *
 * Oct 2026 Quick Chips revamp (public/Maps By FUTA — Quick-chips-png.zip,
 * "Category results · mobile"):
 *   - Nearest first, live. `useLiveLocation` follows the person through
 *     the app's shared GPS watch while the panel is open; every time they
 *     move ≥10 m the results are re-gathered and re-ranked by straight-
 *     line distance from them to each place's coordinates.
 *   - Fallback when nothing is close: if even the nearest match is
 *     further than NEARBY_RADIUS_M, a notice says so and how far the
 *     closest one is; the list still shows every match, nearest first,
 *     each with its own m/km distance.
 *   - No location (blocked / unavailable / still warming up): A–Z, with
 *     a one-line note saying why.
 *   - Restyled to the redesign: a floating card on both — under the chip
 *     row on mobile (stopping above the navbar, like the old card), in
 *     the search column on desktop.
 */
export default function ChipResultsPanel({ activeChip, waypoints, kmlAnnotations, waypointsLoaded, searchIndex, map, onSelect, onNavigate, onClose, isMobile, collapsed }) {
  const user = useLiveLocation(!!activeChip);

  const results = useMemo(() => {
    if (!activeChip) return [];
    return gatherResults(activeChip, { waypoints, searchIndex, user });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChip, waypoints, searchIndex, kmlAnnotations, user]);

  if (!activeChip) return null;

  const ChipIcon = LEGACY_ICON_MAP[activeChip.iconKey] || MapPin;
  const loading = !waypointsLoaded;
  const ranked = !!user && results.some((r) => r.dist !== null);
  const nearest = ranked ? results.find((r) => r.dist !== null) : null;
  const noneNearby = !!nearest && nearest.dist > NEARBY_RADIUS_M;

  const subtitle = loading
    ? 'Loading…'
    : !results.length
      ? 'No places found'
      : `${results.length} place${results.length !== 1 ? 's' : ''} · ${ranked ? 'nearest first' : 'A–Z'}`;

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

  const label = activeChip.label.toLowerCase();

  let notice = null;
  if (!loading && results.length) {
    if (noneNearby) {
      notice = (
        <div className={styles.notice} role="status">
          <span className={styles.noticeIcon}>
            <MapPin size={16} />
          </span>
          <span>
            No {label} within {fmtMeters(NEARBY_RADIUS_M)} of you. The closest, <strong>{nearest.name}</strong>, is{' '}
            <span className={styles.noticeDist}>{fmtMeters(nearest.dist)}</span> away.
          </span>
        </div>
      );
    } else if (!ranked) {
      notice = (
        <div className={`${styles.notice} ${styles.noticeMuted}`} role="status">
          <span className={styles.noticeIcon}>
            <LocateOff size={16} />
          </span>
          <span>Turn on location to see the closest {label} first.</span>
        </div>
      );
    }
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
      No <strong>{label}</strong> places mapped yet.
    </div>
  ) : (
    <>
      {notice}
      {results.map((r, i) => (
        <ChipResultRow
          key={r.id || r.name + i}
          result={r}
          fallbackIconKey={activeChip.iconKey}
          onOpen={handleOpen}
          onNavigate={handleNavigate}
          style={{ animationDelay: Math.min(i * 0.035, 0.4) + 's' }}
        />
      ))}
    </>
  );

  return (
    <div
      className={isMobile ? styles.sheet : styles.panel}
      style={!isMobile && collapsed ? { left: 'calc(var(--sidebar-rail-w) + 16px)' } : undefined}
      role="dialog"
      aria-label={`${activeChip.label} near you`}
    >
      <div className={styles.header}>
        <button className={styles.back} onClick={onClose} aria-label="Back" type="button">
          <ArrowLeft size={22} />
        </button>
        <div className={styles.titles}>
          <h2 className={styles.title}>{activeChip.label}</h2>
          <div className={styles.subtitle}>{subtitle}</div>
        </div>
      </div>
      <div className={styles.list}>{body}</div>
    </div>
  );
}
