import { Navigation } from 'lucide-react';
import { fmtMeters } from './chipConfig';
import { getTypeIcon } from '../../lib/typeIcons';
import { useImageStatus } from '../../lib/useImageStatus';
import styles from './ChipResultRow.module.css';

/**
 * Ports `_buildResultRow` (app.js ~6589–6692) — one row shared by both the
 * desktop panel and the mobile sheet.
 *
 * `onNavigate` bubbles up through ChipResultsPanel to MapPage's
 * `handlePlaceCardNavigate`, same "Where to?" seeding the place card's
 * own Navigate button uses.
 *
 * Oct 2026 Quick Chips revamp ("Category results · mobile"): white card,
 * photo or type-icon tile, name, a violet type pill and the live distance
 * from the person ("120 m" / "2.4 km"), round Navigate button.
 */
export default function ChipResultRow({ result, fallbackIconKey, onOpen, onNavigate, style }) {
  const handleRowClick = (e) => {
    if (e.target.closest('[data-nav-btn]')) return;
    onOpen(result);
  };

  const handleNavClick = (e) => {
    e.stopPropagation();
    onNavigate?.(result);
  };

  const ThumbIcon = getTypeIcon(result.type, fallbackIconKey);
  const firstImage = result.imageUrls && result.imageUrls[0];
  const img = useImageStatus(firstImage);
  const typeLabel = (result.type || '').replace(/_/g, ' ');

  return (
    <div className={styles.row} style={style} onClick={handleRowClick}>
      <div className={styles.thumb}>
        {/* The type icon is always underneath: it's what shows while the
            (full-size) photo downloads, and what stays if it never loads.
            The photo fades in on top once it has actually arrived, and is
            lazy so a long list only fetches the rows near the viewport. */}
        <div className={styles.thumbPh}>
          <ThumbIcon size={26} />
        </div>
        {firstImage && !img.failed && (
          <img
            className={`${styles.thumbImg} ${img.loaded ? styles.thumbImgLoaded : ''}`}
            src={firstImage}
            alt={result.name}
            loading="lazy"
            decoding="async"
            onLoad={img.onLoad}
            onError={img.onError}
          />
        )}
      </div>

      <div className={styles.info}>
        <div className={styles.name} title={result.name}>
          {result.name}
        </div>
        <div className={styles.meta}>
          {typeLabel && <span className={styles.type}>{typeLabel}</span>}
          {result.dist !== null && <span className={styles.dist}>{fmtMeters(result.dist)}</span>}
        </div>
      </div>

      {/* Business rows (chipConfig.js) have no lat/lng, so there's
          nowhere for this button to navigate to — same reason
          PlaceCard.jsx swaps its own Navigate button out for a
          link-out one instead of showing a dead action here. Tapping
          the row itself still opens the place card, which has the
          real "Visit Link" button. */}
      {!result.isBusiness && (
        <button
          className={styles.navBtn}
          data-nav-btn
          title={`Navigate to ${result.name}`}
          aria-label={`Navigate to ${result.name}`}
          onClick={handleNavClick}
          type="button"
        >
          <Navigation size={18} />
        </button>
      )}
    </div>
  );
}
