import Modal from '../../components/ui/Modal';
import styles from './Detailmodal.module.css';

/**
 * Ported from legacy `openDetailModal` (app.js ~2797–2852) + `#detailModal`
 * markup (index.html ~757–765).
 *
 * `segment` is the shaped object from useSegments.js, or `null` to render
 * closed.
 *
 * Photo click: legacy's `onclick="openPhoto(i, seg.id)"` (app.js ~2828)
 * resolves `window.__segments[segId].imageUrls[idx]` and calls
 * `window.open(url, '_blank')` for non-`data:` URLs — Supabase Storage
 * always returns real https URLs (no more `data:` case, unlike legacy's
 * Firebase-era base64 fallback), so this simplifies to a direct
 * `window.open()`, same deviation PlaceCard.jsx already made for waypoint
 * photos in Slice 2.
 *
 * No footer/export button — legacy's `#detailModal` markup has no
 * `.modal-footer` at all (unlike `#saveModal`), confirmed against
 * index.html. Exporting an already-saved segment isn't a legacy feature to
 * port, not an omission here.
 *
 * As of Slice 5: overlay/header/close/body-wrapper markup now comes from
 * the shared `components/ui/Modal` shell (see that file's comment for why
 * this was the trigger to extract it). Only the body content below is
 * this component's own.
 */
export default function DetailModal({ segment, onClose }) {
  if (!segment) return null;

  const {
    name,
    category,
    description,
    distance,
    points,
    waypoints,
    imageUrls,
  } = segment;

  return (
    <Modal title={name?.toUpperCase()} onClose={onClose}>
      <div className={styles.section}>
        <div className={styles.sectionLabel}>Category</div>
        <span className={styles.badge}>{category}</span>
      </div>

      {description && (
        <div className={styles.section}>
          <div className={styles.sectionLabel}>Description</div>
          <div className={styles.text}>{description}</div>
        </div>
      )}

      <div className={styles.section}>
        <div className={styles.sectionLabel}>Stats</div>
        <div className={styles.text}>
          {((distance || 0) / 1000).toFixed(2)} km · {(points || []).length} GPS points
        </div>
      </div>

      {waypoints?.length > 0 && (
        <div className={styles.section}>
          <div className={styles.sectionLabel}>Waypoints ({waypoints.length})</div>
          <div className={styles.waypoints}>
            {waypoints.map((w) => (
              <div key={w.id} className={styles.waypoint}>
                <div className={styles.wpName}>📍 {w.name}</div>
                {w.desc && <div className={styles.wpDesc}>{w.desc}</div>}
                <div className={styles.wpCoord}>
                  {Number(w.lat).toFixed(6)}, {Number(w.lng).toFixed(6)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {imageUrls?.length > 0 && (
        <div className={styles.section}>
          <div className={styles.sectionLabel}>Photos</div>
          <div className={styles.images}>
            {imageUrls.map((url) => (
              <img
                key={url}
                src={url}
                alt=""
                onClick={() => window.open(url, '_blank')}
              />
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
}