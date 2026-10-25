import { Info, MapPin, Navigation, X } from 'lucide-react';
import { LEGACY_ICON_MAP } from '../../lib/legacyIconMap';
import { dotColor } from '../search/chipConfig';
import { fmtDist } from './turnHelpers';
import TravelModePicker from './TravelModePicker';
import styles from './NavDestDesktop.module.css';

const START_LABEL = { walk: 'Start walking', bike: 'Start riding' };

/**
 * Desktop "Directions" panel (designer's desktop screen; phones use
 * NavDestPanel's bottom sheet): your location → where to, the travel mode,
 * the places featured in Explore while no destination is picked, and Start.
 *
 * Same props as NavDestPanel, plus `hasDest` and `onClearDest` (the field's
 * clear button). `goLabel` is 'Start Navigation' when idle, otherwise the
 * progress text ("Getting your location…"). Popular places carry
 * `distance` in metres (straight line from here).
 */
export default function NavDestDesktop({
  destInputValue,
  onDestInputChange,
  dropdownResults,
  onPickResult,
  icon,
  highlight,
  onGo,
  goDisabled,
  goLabel,
  hint,
  onClose,
  popularPlaces,
  onPopularPlaceSelect,
  travelMode,
  onTravelModeChange,
  shuttleStop,
  hasDest,
  onClearDest,
}) {
  const busy = goLabel && goLabel !== 'Start Navigation';
  const label = busy ? goLabel : !hasDest ? 'Pick a destination' : START_LABEL[travelMode] || 'Start ride';
  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <h2 className={styles.title}>Directions</h2>
        <button type="button" className={styles.close} onClick={onClose} aria-label="Close">
          <X size={16} />
        </button>
      </div>

      <div className={styles.body}>
        <div className={styles.routeCard}>
          <div className={styles.routeRow}>
            <span className={styles.fromDot} aria-hidden="true" />
            <span className={styles.fromText}>Your location</span>
          </div>
          <span className={styles.routeLink} aria-hidden="true" />
          <div className={styles.routeRow}>
            <MapPin size={16} className={styles.toPin} aria-hidden="true" />
            <div className={styles.toInputWrap}>
              <input
                type="text"
                placeholder="Where to?"
                aria-label="Where to?"
                autoComplete="off"
                value={destInputValue}
                onChange={(e) => onDestInputChange(e.target.value)}
              />
              {dropdownResults.length > 0 && (
                <div className={styles.dropdown}>
                  {dropdownResults.map((r, i) => {
                    const Icon = LEGACY_ICON_MAP[icon(r)] || MapPin;
                    return (
                      <div
                        key={r.id || `${r.lat}-${r.lng}-${i}`}
                        className={styles.ddItem}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          onPickResult(r);
                        }}
                      >
                        <div className={styles.ddIcon}>
                          <Icon size={14} />
                        </div>
                        <div>
                          <div className={styles.ddName} dangerouslySetInnerHTML={{ __html: highlight(r.name, destInputValue) }} />
                          {r.desc && <div className={styles.ddSub}>{r.desc}</div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            {!!destInputValue && (
              <button type="button" className={styles.clearBtn} onClick={onClearDest} aria-label="Clear destination">
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        <TravelModePicker travelMode={travelMode} onTravelModeChange={onTravelModeChange} shuttleStop={shuttleStop} />

        {!!hint && (
          <div className={styles.hintCard}>
            <span className={styles.hintIconBg}>
              <Info size={12} />
            </span>
            <div className={styles.hintText}>{hint}</div>
          </div>
        )}

        {!hasDest && !!popularPlaces?.length && (
          <div className={styles.popularSection}>
            <div className={styles.popularLabel}>Popular on campus</div>
            <div className={styles.popularList}>
              {popularPlaces.map((place) => {
                const Icon = LEGACY_ICON_MAP[icon(place.waypoint)] || MapPin;
                return (
                  <button key={place.id} type="button" className={styles.popularRow} onClick={() => onPopularPlaceSelect(place)}>
                    <span className={styles.popularIconBg} style={{ '--place-colour': dotColor(place.type) }}>
                      <Icon size={16} />
                    </span>
                    <span className={styles.popularName}>{place.name}</span>
                    {place.distance != null && <span className={styles.popularDist}>{fmtDist(place.distance)}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className={styles.footer}>
        <button type="button" className={styles.goBtn} disabled={goDisabled || !hasDest} onClick={onGo}>
          <Navigation size={16} />
          {label}
        </button>
      </div>
    </div>
  );
}
