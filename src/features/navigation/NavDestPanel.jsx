import { useEffect, useState } from 'react';
import { Bike, BusFront, Car, CarFront, CarTaxiFront, Footprints, Info, MapPin, Navigation, Search, X } from 'lucide-react';
import { LEGACY_ICON_MAP } from '../../lib/legacyIconMap';
import { dotColor } from '../search/chipConfig';
import styles from './NavDestPanel.module.css';
import { fmtRouteDistance } from './routeSummary';

/**
 * Ported from legacy `index.html` ~634–671 (`#navDestPanel`). Desktop:
 * fixed left panel next to the sidebar. Mobile: becomes an Apple Maps-
 * style bottom sheet (`NavDestPanel.module.css`'s `@media (max-width:
 * 768px)` block) — purely a CSS-driven layout swap, same component.
 *
 * "Popular on campus" is every place featured in Explore (the same
 * `explorePicks` array MapPage's Explore panel renders from).
 */

// The tabs; Ride opens RIDE_OPTIONS (NavigationController maps each mode
// to a routing server and remembers the last Ride option).
const TRAVEL_TABS = [
  { tab: 'walk', label: 'Walk', Icon: Footprints },
  { tab: 'bike', label: 'Bike', Icon: Bike },
  { tab: 'ride', label: 'Ride', Icon: Car },
];
const RIDE_OPTIONS = [
  { mode: 'shuttle', label: 'Shuttle', Icon: BusFront },
  { mode: 'keke', label: 'Keke', Icon: CarFront },
  { mode: 'car', label: 'Car / Cab', Icon: CarTaxiFront },
];
const START_LABEL = {
  walk: 'Start walking',
  bike: 'Start riding',
  shuttle: 'Start ride',
  keke: 'Start ride',
  car: 'Start ride',
};

// Bug fix (reported directly): on mobile the on-screen keyboard covered the
// "Where to?" field. Browsers now overlay the keyboard on the page instead
// of shrinking the layout viewport, so a `position: fixed; bottom: 0` sheet
// stays put underneath it. Track how much of the layout viewport the
// keyboard hides (visualViewport) and lift the sheet by that much — the
// mobile CSS reads it as `--kb-inset` / `--vv-h`.
function useKeyboardInset() {
  const [vp, setVp] = useState({ inset: 0, height: null });
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return undefined;
    const update = () => {
      const inset = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
      setVp({ inset, height: Math.round(vv.height) });
    };
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, []);
  return vp;
}

/*
 * Two steps (designer's screens, same on desktop): "Where to?" with the
 * places featured in Explore, then once a destination is picked, "From your
 * location to …" with Change, the travel mode and Start. The route is
 * planned in the background as soon as a destination is picked
 * (NavigationController), so Start begins straight away.
 *
 * A row picks that place; its arrow (`onPopularPlaceGo`) starts navigating
 * there at once in the remembered mode. `shuttleStop`: in Shuttle mode, the
 * stop to get off at, if one is near the destination. `busyLabel` replaces
 * the Start label while it's getting a location or route. `onClearDest`
 * (Change) goes back to step one.
 */
export default function NavDestPanel({
  destInputValue,
  onDestInputChange,
  dropdownResults,
  onPickResult,
  icon,
  highlight,
  onGo,
  goDisabled,
  busyLabel,
  hint,
  onClose,
  popularPlaces,
  onPopularPlaceSelect,
  onPopularPlaceGo,
  travelMode,
  onTravelModeChange,
  hasDest,
  onClearDest,
  shuttleStop,
}) {
  const kb = useKeyboardInset();
  const tab = travelMode === 'walk' || travelMode === 'bike' ? travelMode : 'ride';
  return (
    <div
      className={styles.panel}
      data-kb={kb.inset > 0 ? 'open' : undefined}
      style={{ '--kb-inset': `${kb.inset}px`, ...(kb.height && { '--vv-h': `${kb.height}px` }) }}
    >
      <div className={styles.dragHandle}>
        <span />
      </div>

      {!hasDest ? (
        <div className={`${styles.body} ${styles.stepIn}`}>
          <div className={styles.searchRow}>
            <div className={styles.searchField}>
              <Search size={18} className={styles.searchIcon} aria-hidden="true" />
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
                  {/* Deliberately not reusing <SearchResultItem> (Slice 7's shared
                      search-row component) here — legacy itself keeps this as a 4th,
                      visually distinct duplicate (`.nav-dd-item`, style.css ~2233–2260)
                      with its own violet hover tint that doesn't match `.sd-item`'s
                      styling. Kept feature-local. */}
                  {dropdownResults.map((r, i) => (
                    <div
                      key={r.id || `${r.lat}-${r.lng}-${i}`}
                      className={styles.ddItem}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        onPickResult(r);
                      }}
                    >
                      <div className={styles.ddIcon}>
                        {(() => { const Icon = LEGACY_ICON_MAP[icon(r)] || MapPin; return <Icon size={14} />; })()}
                      </div>
                      <div>
                        <div className={styles.ddName} dangerouslySetInnerHTML={{ __html: highlight(r.name, destInputValue) }} />
                        {r.desc && <div className={styles.ddSub}>{r.desc}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button type="button" className={styles.close} onClick={onClose} aria-label="Close">
              <X size={16} />
            </button>
          </div>

          {!!hint && <Hint text={hint} />}

          {!!(popularPlaces && popularPlaces.length) && (
            <div className={styles.popularSection}>
              <div className={styles.popularLabel}>Popular on campus</div>
              <div className={styles.popularList}>
                {popularPlaces.map((place) => {
                  const Icon = LEGACY_ICON_MAP[icon(place.waypoint)] || MapPin;
                  return (
                    <div key={place.id} className={styles.popularRow}>
                      <button type="button" className={styles.popularPick} onClick={() => onPopularPlaceSelect(place)}>
                        <span className={styles.popularIconBg} style={{ '--place-colour': dotColor(place.type) }}>
                          <Icon size={16} />
                        </span>
                        <span className={styles.popularText}>
                          <span className={styles.popularName}>{place.name}</span>
                          {place.distance != null && <span className={styles.popularDist}>{fmtRouteDistance(place.distance)}</span>}
                        </span>
                      </button>
                      <button
                        type="button"
                        className={styles.popularGo}
                        onClick={() => onPopularPlaceGo(place)}
                        aria-label={`Start navigating to ${place.name}`}
                      >
                        <Navigation size={16} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ) : (
        <>
          <div className={`${styles.body} ${styles.bodyCompact} ${styles.stepIn}`}>
            <div className={styles.destCard}>
              <span className={styles.destIcon} aria-hidden="true">
                <MapPin size={18} />
              </span>
              <span className={styles.destText}>
                <span className={styles.destLabel}>From your location to</span>
                <span className={styles.destName}>{destInputValue}</span>
              </span>
              <button type="button" className={styles.changeBtn} onClick={onClearDest}>
                Change
              </button>
            </div>

            <div className={styles.modePicker} role="radiogroup" aria-label="How are you travelling?">
              {TRAVEL_TABS.map(({ tab: t, label, Icon }) => (
                <button
                  key={t}
                  type="button"
                  role="radio"
                  aria-checked={tab === t}
                  className={`${styles.modeOption} ${tab === t ? styles.modeOptionActive : ''}`}
                  onClick={() => tab !== t && onTravelModeChange(t)}
                >
                  <Icon size={15} />
                  {label}
                </button>
              ))}
            </div>

            {tab === 'ride' && (
              <div className={styles.rideOptions} role="radiogroup" aria-label="What are you riding?">
                {RIDE_OPTIONS.map(({ mode, label, Icon }) => (
                  <button
                    key={mode}
                    type="button"
                    role="radio"
                    aria-checked={travelMode === mode}
                    className={`${styles.rideOption} ${travelMode === mode ? styles.rideOptionActive : ''}`}
                    onClick={() => onTravelModeChange(mode)}
                  >
                    <Icon size={15} />
                    {label}
                  </button>
                ))}
              </div>
            )}

            {travelMode === 'shuttle' && shuttleStop && (
              <p className={styles.shuttleNote}>
                <BusFront size={14} />
                <span>
                  Get off at <strong>{shuttleStop}</strong>
                </span>
              </p>
            )}

            {!!hint && <Hint text={hint} />}
          </div>

          <div className={`${styles.footer} ${styles.stepIn}`}>
            <button type="button" className={styles.goBtn} disabled={goDisabled} onClick={onGo}>
              <Navigation size={16} />
              {busyLabel || START_LABEL[travelMode] || START_LABEL.walk}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function Hint({ text }) {
  return (
    <div className={styles.hintCard}>
      <span className={styles.hintIconBg}>
        <Info size={12} />
      </span>
      <div className={styles.hintText}>{text}</div>
    </div>
  );
}
