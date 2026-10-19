import { useEffect, useState } from 'react';
import { ArrowUp, Ellipsis, X } from 'lucide-react';
import { getTypeIcon } from '../../lib/typeIcons';
import { fmtDist } from './turnHelpers';
import styles from './NearbyPlaces.module.css';

/**
 * Mid-trip controls on the right edge, between NavHud's two cards:
 *  - compass: switches between "route up" (map turns with the road) and a
 *    fixed north-up map. The arrow always points to north on screen.
 *  - "⋯" Nearby places: pins are hidden during a trip, so this lists the
 *    places along the road the user is on, with left/right instead of
 *    compass directions. Picking one opens its place card.
 * `items` comes from routeAhead.js's placesAlong().
 */
export default function NearbyPlaces({ items, onSelect, routeUp, onToggleRouteUp, mapBearing, hidden }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (hidden) setOpen(false);
  }, [hidden]);

  if (hidden) return null;

  return (
    <div className={styles.stack}>
      {open && (
        <div className={styles.panel} role="dialog" aria-label="Nearby places">
          <div className={styles.panelHead}>
            <span className={styles.panelTitle}>Nearby places</span>
            <button type="button" className={styles.panelClose} onClick={() => setOpen(false)} aria-label="Close nearby places">
              <X size={14} />
            </button>
          </div>
          {items.length === 0 ? (
            <div className={styles.empty}>No places along this stretch yet. Keep going — the list updates as you move.</div>
          ) : (
            <ul className={styles.list}>
              {items.map(({ place, ahead, side }) => {
                const Icon = getTypeIcon(place.type);
                return (
                  <li key={place.id}>
                    <button
                      type="button"
                      className={styles.item}
                      onClick={() => {
                        setOpen(false);
                        onSelect(place);
                      }}
                    >
                      <span className={styles.itemIcon}>
                        <Icon size={15} />
                      </span>
                      <span className={styles.itemText}>
                        <span className={styles.itemName}>{place.name}</span>
                        <span className={styles.itemMeta}>
                          On your {side} · {ahead < 15 ? 'here' : `in ${fmtDist(ahead)}`}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      <button
        type="button"
        className={`${styles.roundBtn} ${routeUp ? '' : styles.northUp}`}
        onClick={onToggleRouteUp}
        title={routeUp ? 'Map turns with your route — tap for north up' : 'North up — tap to turn the map with your route'}
        aria-pressed={!routeUp}
      >
        <span className={styles.compass} style={{ transform: `rotate(${mapBearing}deg)` }}>
          <ArrowUp size={14} strokeWidth={2.5} />
          <span className={styles.compassN}>N</span>
        </span>
      </button>

      <button
        type="button"
        className={`${styles.roundBtn} ${styles.nearbyBtn} ${open ? styles.nearbyBtnOpen : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        title="Nearby places"
      >
        {!open && items.length > 0 && <span className={styles.pulse} aria-hidden="true" />}
        <Ellipsis size={20} />
        {items.length > 0 && <span className={styles.badge}>{items.length}</span>}
      </button>
    </div>
  );
}
