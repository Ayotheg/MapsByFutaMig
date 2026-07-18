import { useEffect, useRef, useState } from 'react';
import styles from './PlaceCard.module.css';
import { isRateablePOI } from './wpTypeMeta';

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
      <span className={styles.ratingEmpty}>☆ No reviews yet — be the first!</span>
    );
  }
  const avg = (avgRating || 0).toFixed(1);
  return (
    <span className={styles.ratingFilled}>
      ★ {avg}{' '}
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
 * Photo full-view: legacy's thumbnail click called a segment-scoped
 * `openPhoto(idx, segmentId)` lightbox. Waypoint photos aren't
 * segment-scoped, so clicking a thumbnail/hero image here just opens the
 * full-res image in a new tab directly — same end result, no dependency on
 * Slice 4's segment registry. Revisit if a proper in-app lightbox is wanted.
 */
export default function PlaceCard({ data, onClose, onNavigate, collapsed }) {
  const [photoIdx, setPhotoIdx] = useState(0);
  const [dragY, setDragY] = useState(0);
  const dragging = useRef(false);
  const dragStartY = useRef(0);

  useEffect(() => {
    setPhotoIdx(0);
    setDragY(0);
  }, [data]);

  const isOpen = Boolean(data);
  const photos = data?.imageUrls || [];
  const hasPhotos = photos.length > 0;

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
        className={`${styles.scrim} ${isOpen ? '' : styles.hidden}`}
        onClick={onClose}
      />
      <div
        className={`${styles.card} ${isOpen ? styles.visible : ''}`}
        style={Object.keys(cardStyle).length ? cardStyle : undefined}
      >
        <div
          className={styles.handle}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className={styles.handleBar} />
        </div>

        {hasPhotos && (
          <div className={styles.hero}>
            <img
              src={photos[photoIdx]}
              alt=""
              style={{ cursor: 'pointer' }}
              onClick={() => window.open(photos[photoIdx], '_blank')}
            />
            <div className={styles.heroOverlay} />
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
            {data?.badge && <div className={styles.badge}>{data.badge}</div>}
            <div className={styles.rating}>
              <RatingBadge type={data?.type} avgRating={data?.avgRating} reviewCount={data?.reviewCount} />
            </div>
          </div>
          <button className={styles.close} aria-label="Close" onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
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
              {photos.map((url, i) => (
                <img
                  key={url + i}
                  src={url}
                  alt={`Photo ${i + 1}`}
                  className={i === photoIdx ? styles.active : ''}
                  onClick={() => setPhotoIdx(i)}
                />
              ))}
            </div>
          </div>
        )}

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
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="3 11 22 2 13 21 11 13 3 11" />
            </svg>
            Navigate Here
          </button>
        </div>
      </div>
    </>
  );
}
