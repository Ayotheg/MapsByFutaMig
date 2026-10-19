import { useEffect, useId, useRef, useState } from 'react';
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
 * `items` comes from routeAhead.js's placesAlong(); each `place` is one of
 * MapPage's nearby candidates ({ key, name, type, lat, lng, card }).
 */
export default function NearbyPlaces({ items, onSelect, routeUp, onToggleRouteUp, mapBearing, hidden }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const toggleRef = useRef(null);
  const firstItemRef = useRef(null);

  useEffect(() => {
    if (hidden) setOpen(false);
  }, [hidden]);

  // Keyboard: focus moves into the list on open; Escape closes it.
  useEffect(() => {
    if (!open) return undefined;
    firstItemRef.current?.focus();
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      setOpen(false);
      toggleRef.current?.focus();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  if (hidden) return null;

  const count = items.length;
  const compassLabel = routeUp ? 'Map turns with your route. Switch to north up' : 'Map is north up. Switch to turning with your route';

  return (
    <div className={styles.stack}>
      <button
        type="button"
        className={`${styles.roundBtn} ${routeUp ? '' : styles.northUp}`}
        onClick={onToggleRouteUp}
        aria-label={compassLabel}
        title={compassLabel}
        aria-pressed={!routeUp}
      >
        <span className={styles.compass} style={{ transform: `rotate(${mapBearing}deg)` }} aria-hidden="true">
          <ArrowUp size={14} strokeWidth={2.5} />
          <span className={styles.compassN}>N</span>
        </span>
      </button>

      <button
        ref={toggleRef}
        type="button"
        className={`${styles.roundBtn} ${open ? styles.nearbyBtnOpen : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={count ? `Nearby places, ${count} along this road` : 'Nearby places'}
        title="Nearby places"
      >
        {!open && count > 0 && <span className={styles.pulse} aria-hidden="true" />}
        <Ellipsis size={20} aria-hidden="true" />
        {count > 0 && (
          <span className={styles.badge} aria-hidden="true">
            {count}
          </span>
        )}
      </button>

      {/* After the buttons in the DOM so Tab goes button → list; it's
          positioned to their left with CSS. */}
      {open && (
        <div id={panelId} className={styles.panel} role="dialog" aria-label="Nearby places">
          <div className={styles.panelHead}>
            <span className={styles.panelTitle}>Nearby places</span>
            <button type="button" className={styles.panelClose} onClick={() => setOpen(false)} aria-label="Close nearby places">
              <X size={14} />
            </button>
          </div>
          {count === 0 ? (
            <div className={styles.empty}>No places along this stretch yet. Keep going — the list updates as you move.</div>
          ) : (
            <ul className={styles.list}>
              {items.map(({ place, ahead, side }, i) => {
                const Icon = getTypeIcon(place.type);
                return (
                  <li key={place.key}>
                    <button
                      ref={i === 0 ? firstItemRef : undefined}
                      type="button"
                      className={styles.item}
                      onClick={() => {
                        setOpen(false);
                        onSelect(place);
                      }}
                    >
                      <span className={styles.itemIcon} aria-hidden="true">
                        <Icon size={15} />
                      </span>
                      <span className={styles.itemText}>
                        <span className={styles.itemName}>{place.name}</span>
                        <span className={styles.itemMeta}>
                          On your {side} ·{' '}
                          <span className={styles.itemDist}>{ahead < 15 ? 'here' : `in ${fmtDist(ahead)}`}</span>
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
    </div>
  );
}
