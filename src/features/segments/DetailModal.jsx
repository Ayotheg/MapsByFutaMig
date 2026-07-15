import styles from './DetailModal.module.css';

/**
 * Ported from legacy `openDetailModal` (app.js ~2797–2852) + `#detailModal`
 * markup (index.html ~757–765).
 *
 * `segment` is the shaped object from useSegments.js, or `null` to render
 * closed. Only the ✕ button dismisses it — legacy never wires a
 * backdrop-click handler for any modal (checked: no `modal-overlay`
 * listener anywhere in app.js), so that's intentionally not added here
 * either.
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
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <div className={styles.title}>{name?.toUpperCase()}</div>
          <button type="button" className={styles.close} onClick={onClose}>
            ✕
          </button>
        </div>

        <div className={styles.body}>
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
        </div>
      </div>
    </div>
  );
}