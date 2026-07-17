import { Navigation, Images } from 'lucide-react';
import { dotColor, typeEmoji, fmtDist } from './chipConfig';
import styles from './ChipResultRow.module.css';

/**
 * Ports `_buildResultRow` (app.js ~6589–6692) — one row shared by both the
 * desktop floating panel and the mobile card (legacy literally reuses the
 * same `.dcr-row` markup/class for both, built once, not two functions).
 *
 * `onNavigate` is left as a no-op stub with a comment — Slice 9's
 * territory (`window.NAV.navigateTo`), same treatment as the other
 * Navigate-button stubs in this slice.
 */
export default function ChipResultRow({ result, iconText, onOpen, style }) {
  const handleRowClick = (e) => {
    if (e.target.closest('[data-nav-btn]')) return;
    onOpen(result);
  };

  const handleNavClick = (e) => {
    e.stopPropagation();
    // Inert until Slice 9 — mirrors legacy's `window.NAV.navigateTo(...)`.
  };

  return (
    <div className={styles.row} style={style} onClick={handleRowClick}>
      <div className={styles.thumb}>
        {result.imageUrls && result.imageUrls.length > 0 ? (
          <img src={result.imageUrls[0]} alt={result.name} loading="lazy" />
        ) : (
          <div className={styles.thumbPh}>{typeEmoji(result.type, iconText)}</div>
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
