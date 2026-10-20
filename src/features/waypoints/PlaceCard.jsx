import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, ExternalLink, ImageIcon, Navigation, Star, X } from 'lucide-react';
import styles from './PlaceCard.module.css';
import { isRateablePOI } from './wpTypeMeta';
import PhotoLightbox from './PhotoLightbox';
import PlaceReviews from '../reviews/PlaceReviews';
import { getTypeIcon } from '../../lib/typeIcons';
import { businessPlatformMeta } from '../../lib/channelMeta';
import { track } from '../../lib/analytics';

// Some badges arrive in capitals (search results, OSM places); the design
// shows "Shop", not "SHOP".
function sentenceCase(text) {
  return text === text.toUpperCase() ? text.charAt(0) + text.slice(1).toLowerCase() : text;
}

/**
 * Place card (design: public "Auth Redesign" export — "Place card ·
 * desktop / mobile"). `data` is { name, badge, description, lat, lng,
 * imageUrls, id, type, area, avgRating, reviewCount, isBusiness, businessLink,
 * businessPlatform } — see placeCardData.js. `data={null}` renders closed.
 *
 * Desktop: floating card under the search bar and chips.
 * Mobile: bottom sheet that opens half-height; tapping or dragging the
 * handle up expands it, dragging down collapses, then closes.
 * During a trip (`duringNav`) it's a compact card in NavHud's distance
 * slot with no "Navigate here" (see PlaceCard.module.css).
 *
 * The close button and the mobile handle are sticky, so the card can always
 * be closed even when scrolled down to the reviews.
 */
export default function PlaceCard({ data, onClose, onNavigate, onWriteReview, collapsed, isMobile, duringNav, reviewsVersion }) {
  const [photoIdx, setPhotoIdx] = useState(0);
  const [dragY, setDragY] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  // Photos that failed to load show the place's type icon instead.
  const [failedUrls, setFailedUrls] = useState({});
  const cardRef = useRef(null);
  const dragging = useRef(false);
  const dragStartY = useRef(0);

  // A different place: start at the top, half-height, first photo.
  const placeKey = data ? `${data.id ?? ''}|${data.name}|${data.lat}|${data.lng}` : '';
  useEffect(() => {
    setPhotoIdx(0);
    setDragY(0);
    setExpanded(false);
    setViewerOpen(false);
    setFailedUrls({});
    if (cardRef.current) cardRef.current.scrollTop = 0;
  }, [placeKey]);

  const isOpen = Boolean(data);
  const photos = data?.imageUrls || [];
  const hasPhotos = photos.length > 0;
  const heroUrl = photos[photoIdx];
  const heroFailed = Boolean(failedUrls[heroUrl]);
  const TypeIcon = getTypeIcon(data?.isBusiness ? 'shop' : data?.type);
  const markFailed = (url) => setFailedUrls((prev) => (prev[url] ? prev : { ...prev, [url]: true }));
  const rateable = Boolean(data?.id) && isRateablePOI(data?.type);
  const reviewCount = data?.reviewCount || 0;
  // Mobile half/expanded sheet only for places with reviews; others are
  // short, so the sheet just fits its content (design: "place without
  // reviews").
  const sheet = isMobile && !duringNav && rateable;

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
    if (sheet && dy < -40) setExpanded(true);
    else if (dy > 80) {
      if (sheet && expanded) setExpanded(false);
      else onClose();
    }
  }

  // The desktop card follows the sidebar when it collapses to its rail,
  // like the search bar and chips do.
  const cardStyle = {};
  if (dragY) {
    // In trip mode the open card sits lifted by --nav-card-lift (CSS).
    cardStyle.transform =
      duringNav && isMobile ? `translateY(calc(${dragY}px - var(--nav-card-lift)))` : `translateY(${dragY}px)`;
    cardStyle.transition = 'none';
  }
  if (collapsed) {
    cardStyle.left = 'calc(var(--sidebar-rail-w) + 16px)';
  }

  const cardClass = [
    styles.card,
    isMobile ? styles.mobile : styles.desktop,
    duringNav ? styles.navMode : '',
    sheet && expanded ? styles.expanded : '',
    isMobile && !duringNav && !rateable ? styles.fit : '',
    hasPhotos ? styles.withHero : '',
    isOpen ? styles.visible : '',
  ].join(' ');

  return (
    <>
      <div
        className={`${styles.scrim} ${isMobile ? '' : styles.desktop} ${duringNav ? styles.navMode : ''} ${isOpen ? '' : styles.hidden}`}
        onClick={onClose}
      />
      <div ref={cardRef} className={cardClass} style={Object.keys(cardStyle).length ? cardStyle : undefined}>
        {isMobile && (
          <button
            type="button"
            className={styles.handle}
            onClick={() => sheet && setExpanded((v) => !v)}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            aria-label={sheet ? (expanded ? 'Show less' : 'Show more') : 'Drag down to close'}
            aria-expanded={sheet ? expanded : undefined}
          >
            <span className={styles.handleBar} />
          </button>
        )}

        {/* Zero-height sticky row: the button floats over the photo's
            top-right corner and stays in view while the card scrolls. */}
        <div className={styles.closeRow}>
          <button type="button" className={styles.close} aria-label="Close" onClick={onClose}>
            <X size={18} strokeWidth={2.25} />
          </button>
        </div>

        {/* No photos yet: a soft panel with the place type's icon, so every
            card keeps the same shape (lib/typeIcons.js). */}
        {!hasPhotos && (
          <div className={`${styles.hero} ${styles.heroEmpty}`} aria-hidden="true">
            <TypeIcon className={styles.heroEmptyIcon} size={44} strokeWidth={1.5} />
          </div>
        )}

        {hasPhotos && (
          <div className={styles.hero}>
            {/* Type icon underneath: shows while the photo downloads, and
                stays if it can't be fetched. */}
            <div className={styles.heroFallback} aria-hidden="true">
              <TypeIcon size={44} strokeWidth={1.75} />
            </div>
            {!heroFailed && <img src={heroUrl} alt="" decoding="async" onError={() => markFailed(heroUrl)} />}
            {!heroFailed && (
              <button
                type="button"
                className={styles.heroTap}
                aria-label="View photo full screen"
                onClick={() => setViewerOpen(true)}
              />
            )}
            {photos.length > 1 && (
              <>
                <button
                  type="button"
                  className={`${styles.photoNav} ${styles.prev}`}
                  aria-label="Previous photo"
                  disabled={photoIdx === 0}
                  onClick={() => setPhotoIdx((i) => Math.max(0, i - 1))}
                >
                  <ChevronLeft size={26} strokeWidth={2.25} />
                </button>
                <button
                  type="button"
                  className={`${styles.photoNav} ${styles.next}`}
                  aria-label="Next photo"
                  disabled={photoIdx === photos.length - 1}
                  onClick={() => setPhotoIdx((i) => Math.min(photos.length - 1, i + 1))}
                >
                  <ChevronRight size={26} strokeWidth={2.25} />
                </button>
                <div className={styles.photoCount}>
                  <ImageIcon size={14} aria-hidden="true" />
                  <span>
                    {photoIdx + 1} / {photos.length}
                  </span>
                </div>
              </>
            )}
          </div>
        )}

        <div className={styles.body}>
          <h2 className={styles.name}>{data?.name || 'Location'}</h2>

          <div className={styles.meta}>
            {/* No reviews yet → nothing here; the Reviews section's empty
                state already says so. */}
            {rateable && reviewCount > 0 && (
              <span className={styles.rating}>
                <Star size={15} className={styles.star} fill="currentColor" aria-hidden="true" />
                <span className={styles.ratingValue}>{(data.avgRating || 0).toFixed(1)}</span>
                <span className={styles.ratingCount}>({reviewCount})</span>
                <span className={styles.srOnly}> stars from {reviewCount} review{reviewCount === 1 ? '' : 's'}</span>
              </span>
            )}
            {data?.badge && <span className={styles.metaItem}>{sentenceCase(data.badge)}</span>}
            {data?.area && <span className={styles.metaItem}>{data.area}</span>}
          </div>

          {data?.description?.trim() && <p className={styles.desc}>{data.description}</p>}

          {/* People have no location; businesses have a link instead of a
              location. No "Navigate here" mid-trip: switching destination
              would silently end the current trip. */}
          {duringNav ? null : data?.lat != null && data?.lng != null ? (
            <button
              type="button"
              className={styles.primaryBtn}
              onClick={() => {
                onNavigate?.({ lat: data.lat, lng: data.lng, name: data.name, id: data.id, type: data.type });
                onClose();
              }}
            >
              <Navigation size={18} strokeWidth={2.25} />
              Navigate here
            </button>
          ) : (
            data?.isBusiness &&
            data?.businessLink && (
              <button
                type="button"
                className={styles.primaryBtn}
                onClick={() => {
                  track('business_link_click', { source: 'place_card', platform: data.businessPlatform || null });
                  window.open(data.businessLink, '_blank', 'noopener,noreferrer');
                }}
              >
                <ExternalLink size={18} strokeWidth={2.25} />
                {data.businessPlatform && data.businessPlatform !== 'other'
                  ? `Visit ${businessPlatformMeta(data.businessPlatform).label}`
                  : 'Visit link'}
              </button>
            )
          )}

          {rateable && (
            <PlaceReviews
              key={data.id}
              waypointId={data.id}
              reviewCount={reviewCount}
              version={reviewsVersion}
              onWriteReview={onWriteReview ? () => onWriteReview({ id: data.id, name: data.name, type: data.type }) : null}
            />
          )}
        </div>
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
