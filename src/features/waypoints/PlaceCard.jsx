import { useEffect, useRef, useState } from 'react';
import { Star, X, Navigation, Maximize2, ExternalLink } from 'lucide-react';
import styles from './PlaceCard.module.css';
import { isRateablePOI } from './wpTypeMeta';
import PhotoLightbox from './PhotoLightbox';
import { getTypeIcon } from '../../lib/typeIcons';
import { channelPlatformMeta } from '../../lib/channelMeta';
import { track } from '../../lib/analytics';

// ── Rating badge ─────────────────────────────────────────────────────────
// Ported from legacy `_ratingBadgeHtml` (app.js ~2450–2456), now that
// Slice 8 added `avg_rating`/`review_count` (via `useWaypoints.js` reading
// the new columns) + the `reviews` table/trigger that populates them (see
// FIREBASE_TO_SUPABASE_MIGRATION.md's "Step 6"). Non-rateable types render
// nothing at all, matching legacy exactly.
function RatingBadge({ type, avgRating, reviewCount }) {
  if (!isRateablePOI(type)) return null;
  const count = reviewCount || 0;
  if (!count) {
    return (
      <span className={styles.ratingEmpty}>
        <Star size={12} /> No reviews yet — be the first!
      </span>
    );
  }
  const avg = (avgRating || 0).toFixed(1);
  return (
    <span className={styles.ratingFilled}>
      <Star size={12} fill="currentColor" /> {avg}{' '}
      <span className={styles.ratingCount}>
        ({count} review{count === 1 ? '' : 's'})
      </span>
    </span>
  );
}

/**
 * Google Maps-style place card. `data` is the same shape legacy's
 * `window.openPlaceCard(opts)` accepted: { name, badge, description, lat,
 * lng, imageUrls, id, type }, plus Slice 8's { avgRating, reviewCount }
 * (from `useWaypoints.js`'s `avg_rating`/`review_count` columns) for the
 * rating badge. Pass `data={null}` to render closed.
 *
 * Photo full-view: the hero image is a small, cropped (`object-fit:
 * cover`) preview, so tapping/clicking it opens `PhotoLightbox` — the
 * whole photo, full-screen, with a zoom tool (pinch / double-tap / wheel /
 * slider). An animated "Tap to view full photo" pill on the hero tells
 * users it's tappable; it collapses to just its icon after a few seconds
 * (see `.tapHint` in PlaceCard.module.css). The viewer shares `photoIdx`
 * with the card, so closing it leaves the hero on the last-viewed photo.
 *
 * UI_REDESIGN_GUIDE.md pass (this session): restyled to v2 light theme
 * per Figma node 7:943 ("Bottom Sheet Card") — see PlaceCard.module.css's
 * header comment. Two structural (not functional) notes:
 *  - Close button: Figma shows it floating on the hero photo, not in the
 *    header. Rendered there when a photo exists; falls back to the old
 *    header-close placement (`!hasPhotos`) when a waypoint has no photos,
 *    so closing is never unreachable. Same `onClose` handler either way —
 *    no behavior change.
 *  - Badge/rating row: Figma pairs the type badge with a secondary text
 *    label (a location string this app's data shape doesn't have — see
 *    UI_REDESIGN_GUIDE.md's flags). Paired the existing `data.badge` chip
 *    with the existing rating indicator instead, side by side, to match
 *    the visual pattern without inventing a new data field.
 */
export default function PlaceCard({ data, onClose, onNavigate, collapsed, isMobile }) {
  const [photoIdx, setPhotoIdx] = useState(0);
  const [dragY, setDragY] = useState(0);
  const [viewerOpen, setViewerOpen] = useState(false);
  // Bumped whenever a (new) waypoint opens so the tap-hint animation replays.
  const [hintRun, setHintRun] = useState(0);
  // Photo URLs that failed to load (Supabase unreachable, file gone…).
  // Shared by the hero and the thumbnail strip so a dead photo shows the
  // place's type icon in both, instead of a broken-image box.
  const [failedUrls, setFailedUrls] = useState({});
  const dragging = useRef(false);
  const dragStartY = useRef(0);

  useEffect(() => {
    setPhotoIdx(0);
    setDragY(0);
    setViewerOpen(false);
    setHintRun((n) => n + 1);
    setFailedUrls({});
  }, [data]);

  const isOpen = Boolean(data);
  const photos = data?.imageUrls || [];
  const hasPhotos = photos.length > 0;
  const heroUrl = photos[photoIdx];
  const heroFailed = Boolean(failedUrls[heroUrl]);
  const TypeIcon = getTypeIcon(data?.isBusiness ? 'shop' : data?.type);
  const markFailed = (url) => setFailedUrls((prev) => (prev[url] ? prev : { ...prev, [url]: true }));

  function handleTouchStart(e) {
    dragging.current = true;
    dragStartY.current = e.touches[0].clientY;
  }
  function handleTouchMove(e) {
    if (!dragging.current) return;
    const dy = e.touches[0].clientY - dragStartY.current;
    if (dy > 0) setDragY(dy);
  }
  function handleTouchEnd(e) {
    if (!dragging.current) return;
    dragging.current = false;
    const dy = e.changedTouches[0].clientY - dragStartY.current;
    setDragY(0);
    if (dy > 80) onClose();
  }

  // Fix: the desktop card is anchored past the *full* sidebar
  // (`left: var(--sidebar-total-w)`, ~304px) unconditionally. Every other
  // floating panel (QuickChips, DesktopSearchBar, ChipResultsPanel,
  // ViewModeToggle) shifts left when the sidebar collapses to its
  // ~64px icon rail, but this one never did — so collapsing the sidebar
  // left the card stranded with a ~240px gap of bare map between the rail
  // and the card instead of sliding over to meet it. Same fix pattern as
  // those other components: swap the anchor via inline style.
  const cardStyle = {};
  if (dragY) {
    cardStyle.transform = `translateY(${dragY}px)`;
    cardStyle.transition = 'none';
  }
  if (collapsed) {
    cardStyle.left = 'calc(var(--sidebar-rail-w) + 16px)';
  }

  return (
    <>
      <div
        className={`${styles.scrim} ${isMobile ? '' : styles.desktop} ${isOpen ? '' : styles.hidden}`}
        onClick={onClose}
      />
      <div
        className={`${styles.card} ${isMobile ? '' : styles.desktop} ${isOpen ? styles.visible : ''}`}
        style={Object.keys(cardStyle).length ? cardStyle : undefined}
      >
        <div
          className={`${styles.handle} ${isMobile ? '' : styles.desktop}`}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className={styles.handleBar} />
        </div>

        {hasPhotos && (
          <div className={styles.hero}>
            {/* The type icon is always underneath: it shows while the
                (full-size) photo downloads and stays if the photo can't
                be fetched. The <img> paints over it once bytes arrive. */}
            <div className={styles.heroFallback} aria-hidden="true">
              <TypeIcon size={44} strokeWidth={1.75} />
            </div>
            {!heroFailed && (
              <img
                src={heroUrl}
                alt=""
                decoding="async"
                onError={() => markFailed(heroUrl)}
              />
            )}
            <div className={styles.heroOverlay} />
            {/* Whole hero is the tap target; controls below sit above it
                (z-index 2) so close / prev / next still work. Not offered
                when the photo failed — the viewer would have nothing to
                show. */}
            {!heroFailed && (
              <>
                <button
                  type="button"
                  className={styles.heroTap}
                  aria-label="View photo full screen"
                  onClick={() => setViewerOpen(true)}
                />
                <div className={styles.tapHint} key={hintRun} aria-hidden="true">
                  <span className={styles.tapHintIcon}>
                    <Maximize2 size={12} strokeWidth={2.5} />
                  </span>
                  <span className={styles.tapHintText}>Tap to view full photo</span>
                </div>
              </>
            )}
            <button className={styles.closeOnHero} aria-label="Close" onClick={onClose}>
              <X size={14} strokeWidth={2.5} />
            </button>
            {photos.length > 1 && (
              <div className={styles.photoCount}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" />
                </svg>
                <span>{photoIdx + 1} / {photos.length}</span>
              </div>
            )}
            {photoIdx > 0 && (
              <button
                className={`${styles.photoNav} ${styles.prev}`}
                aria-label="Previous photo"
                onClick={() => setPhotoIdx((i) => Math.max(0, i - 1))}
              >
                &#8249;
              </button>
            )}
            {photoIdx < photos.length - 1 && (
              <button
                className={`${styles.photoNav} ${styles.next}`}
                aria-label="Next photo"
                onClick={() => setPhotoIdx((i) => Math.min(photos.length - 1, i + 1))}
              >
                &#8250;
              </button>
            )}
          </div>
        )}

        <div className={styles.header}>
          <div className={styles.titleWrap}>
            <h2 className={styles.name}>{data?.name || 'Location'}</h2>
            <div className={styles.metaRow}>
              {data?.badge && <span className={styles.badge}>{data.badge}</span>}
              <span className={styles.rating}>
                <RatingBadge type={data?.type} avgRating={data?.avgRating} reviewCount={data?.reviewCount} />
              </span>
            </div>
          </div>
          {!hasPhotos && (
            <button className={styles.close} aria-label="Close" onClick={onClose}>
              <X size={16} strokeWidth={2.5} />
            </button>
          )}
        </div>

        <div className={styles.coords}>
          {data?.lat != null && data?.lng != null
            ? `${Number(data.lat).toFixed(6)}, ${Number(data.lng).toFixed(6)}`
            : ''}
        </div>

        {data?.description?.trim() && (
          <div className={styles.desc}>{data.description}</div>
        )}

        {hasPhotos && photos.length > 1 && (
          <div className={styles.strip}>
            <div className={styles.stripInner}>
              {photos.map((url, i) =>
                failedUrls[url] ? (
                  <span
                    key={url + i}
                    className={`${styles.stripFallback} ${i === photoIdx ? styles.active : ''}`}
                    role="button"
                    aria-label={`Photo ${i + 1} (unavailable)`}
                    onClick={() => setPhotoIdx(i)}
                  >
                    <TypeIcon size={20} />
                  </span>
                ) : (
                  <img
                    key={url + i}
                    src={url}
                    alt={`Photo ${i + 1}`}
                    className={i === photoIdx ? styles.active : ''}
                    loading="lazy"
                    decoding="async"
                    onClick={() => setPhotoIdx(i)}
                    onError={() => markFailed(url)}
                  />
                )
              )}
            </div>
          </div>
        )}

        {/* People entries (supabase/people_entries.sql) have no lat/lng —
            there's nowhere to navigate to, so the button is left out
            entirely rather than firing with null coordinates. Business
            entries (supabase/business_entries.sql) also have no lat/lng,
            but DO have somewhere to send someone — their WhatsApp/
            Telegram/Instagram/website link — so they get a different
            button in the same slot instead of nothing. This is the one
            place that distinction is drawn; everything else about this
            card (photos, name, description, rating badge) renders
            identically for a Business as for a normal waypoint, per the
            person's own "card displays normally" instruction. */}
        {data?.lat != null && data?.lng != null ? (
          <div className={styles.actions}>
            {/* Ported from legacy's live place-card controller
                (app.js ~5995–6140, `onNavigate` opt): `window.openPlaceCard({
                ..., onNavigate: () => window.NAV.navigateTo({lat,lng,name,id,type}) })`.
                MapPage wires this to NavigationController's seed-destination
                path (the same one `window.NAV.navigateTo` fed in legacy). */}
            <button
              className={styles.navBtn}
              title="Navigate here"
              onClick={() => {
                onNavigate?.({ lat: data.lat, lng: data.lng, name: data.name, id: data.id, type: data.type });
                onClose();
              }}
            >
              <Navigation size={16} />
              Navigate Here
            </button>
          </div>
        ) : (
          data?.isBusiness &&
          data?.businessLink && (
            <div className={styles.actions}>
              <button
                className={styles.navBtn}
                title={`Open ${channelPlatformMeta(data.businessPlatform).label} link`}
                onClick={() => {
                  track('business_link_click', { source: 'place_card', platform: data.businessPlatform || null });
                  window.open(data.businessLink, '_blank', 'noopener,noreferrer');
                }}
              >
                <ExternalLink size={16} />
                {data.businessPlatform && data.businessPlatform !== 'other'
                  ? `Visit ${channelPlatformMeta(data.businessPlatform).label}`
                  : 'Visit Link'}
              </button>
            </div>
          )
        )}
      </div>

      {viewerOpen && hasPhotos && (
        <PhotoLightbox
          photos={photos}
          index={Math.min(photoIdx, photos.length - 1)}
          onIndexChange={setPhotoIdx}
          onClose={() => setViewerOpen(false)}
          title={data?.name}
        />
      )}
    </>
  );
}
