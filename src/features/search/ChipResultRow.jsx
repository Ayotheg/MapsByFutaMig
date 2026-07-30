import { Navigation, Images } from 'lucide-react';
import { dotColor, fmtDist } from './chipConfig';
import { getTypeIcon } from '../../lib/typeIcons';
import styles from './ChipResultRow.module.css';

/**
 * Ports `_buildResultRow` (app.js ~6589–6692) — one row shared by both the
 * desktop floating panel and the mobile card (legacy literally reuses the
 * same `.dcr-row` markup/class for both, built once, not two functions).
 *
 * `onNavigate` was left as a no-op stub with a comment ("Slice 9's
 * territory") — Slice 9 (navigation) is built now, so this wires it up
 * for real: bubbles the click up through ChipResultsPanel to MapPage's
 * `handlePlaceCardNavigate`, same "Where to?" seeding the place card's
 * own Navigate button already uses.
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

  return (
    <div className={styles.row} style={style} onClick={handleRowClick}>
      <div className={styles.thumb}>
        {result.imageUrls && result.imageUrls.length > 0 ? (
          <img src={result.imageUrls[0]} alt={result.name} loading="lazy" />
        ) : (
          <div className={styles.thumbPh}>
            <ThumbIcon size={18} />
          </div>
        )}
      </div>

      <div className={styles.info}>
        <div className={styles.name} title={result.name}>
          {result.name}
        </div>
        {result.desc && <div className={styles.desc}>{result.desc}</div>}
        <div className={styles.meta}>
          <span className={styles.type} style={{ borderColor: dotColor(result.type) + '55', color: dotColor(result.type) }}>
            {(result.type || '').replace(/_/g, ' ')}
          </span>
          {result.dist !== null && <span className={styles.dist}>{fmtDist(result.dist)}</span>}
          {result.imageUrls && result.imageUrls.length > 1 && (
            <span className={styles.photos}>
              <Images size={9} /> {result.imageUrls.length}
            </span>
          )}
        </div>
      </div>

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
    </div>
  );
}
