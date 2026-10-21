import { Navigation, Images } from 'lucide-react';
import { fmtMeters } from './chipConfig';
import { getTypeIcon } from '../../lib/typeIcons';
import { useImageStatus } from '../../lib/useImageStatus';
import styles from './ChipResultRow.module.css';

/**
 * One result row, shared by the desktop panel and the mobile card:
 * photo (or type icon) · title + "area · distance" · Navigate.
 *
 * `onNavigate` bubbles up through ChipResultsPanel to MapPage's
 * `handlePlaceCardNavigate`, same "Where to?" seeding the place card's
 * own Navigate button uses.
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
  const imageCount = result.imageUrls?.length || 0;
  const firstImage = imageCount ? result.imageUrls[0] : null;
  const img = useImageStatus(firstImage);

  // Second line: where it is, then how far — either can be missing.
  const area = (result.desc || '').trim();
  const dist = result.dist !== null && result.dist !== undefined ? fmtMeters(result.dist) : '';

  return (
    <div className={styles.row} style={style} onClick={handleRowClick}>
      <div className={styles.thumb}>
        {/* The type icon is always underneath: it's what shows while the
            photo downloads, and what stays if it never loads. */}
        <div className={styles.thumbPh}>
          <ThumbIcon size={22} />
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
        {imageCount > 1 && (
          <span className={styles.photoCount}>
            <Images size={10} /> {imageCount}
          </span>
        )}
      </div>

      <div className={styles.info}>
        <div className={styles.name} title={result.name}>
          {result.name}
        </div>
        {(area || dist) && (
          <div className={styles.sub}>
            {area}
            {area && dist && <span className={styles.dot}> · </span>}
            {dist && <span className={styles.dist}>{dist}</span>}
          </div>
        )}
      </div>

      {/* Business rows (chipConfig.js) have no lat/lng, so there's nowhere
          to navigate to; tapping the row still opens the place card. */}
      {!result.isBusiness && (
        <button
          className={styles.navBtn}
          data-nav-btn
          title={`Navigate to ${result.name}`}
          aria-label={`Navigate to ${result.name}`}
          onClick={handleNavClick}
          type="button"
        >
          <Navigation size={14} />
        </button>
      )}
    </div>
  );
}
