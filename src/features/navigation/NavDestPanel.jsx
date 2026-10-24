import { useEffect, useState } from 'react';
import { Bike, Car, Footprints, Info, MapPin, Navigation, X } from 'lucide-react';
import { LEGACY_ICON_MAP } from '../../lib/legacyIconMap';
import { dotColor } from '../search/chipConfig';
import styles from './NavDestPanel.module.css';
import { arrivalTime, fmtDuration, fmtRouteDistance } from './routeSummary';

/**
 * Ported from legacy `index.html` ~634–671 (`#navDestPanel`). Desktop:
 * fixed left panel next to the sidebar. Mobile: becomes an Apple Maps-
 * style bottom sheet (`NavDestPanel.module.css`'s `@media (max-width:
 * 768px)` block) — purely a CSS-driven layout swap, same component.
 *
 * "Popular on campus" is `NavigationController`'s slice of the same
 * `explorePicks` array MapPage's Explore panel renders from, so it always
 * agrees with Explore about what's featured.
 */

// Bike is keke/okada (bike routing); Ride is a car or cab (car routing).
const TRAVEL_OPTIONS = [
  { mode: 'walk', label: 'Walk', Icon: Footprints, start: 'Start walking', by: 'walking' },
  { mode: 'bike', label: 'Bike', Icon: Bike, start: 'Start riding', by: 'by bike' },
  { mode: 'car', label: 'Ride', Icon: Car, start: 'Start ride', by: 'by car' },
];

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
 * "Directions" (designer's mobile screens, Oct 2026): your location → where
 * to, travel mode, then either "Popular on campus" (no destination yet) or
 * the route summary card (time, distance, arrival). The route is planned in
 * the background as soon as a destination is picked (`preview`, from
 * NavigationController), so Start begins straight away.
 *
 * `preview`: null (nothing to show), { loading: true }, or { distance,
 * duration } in metres / seconds. `busyLabel` replaces the Start label
 * while it's getting a location or route. `onClearDest` empties the field.
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
  travelMode,
  onTravelModeChange,
  hasDest,
  onClearDest,
  preview,
}) {
  const kb = useKeyboardInset();
  const option = TRAVEL_OPTIONS.find((o) => o.mode === travelMode) || TRAVEL_OPTIONS[0];
  return (
    <div
      className={styles.panel}
      data-kb={kb.inset > 0 ? 'open' : undefined}
      style={{ '--kb-inset': `${kb.inset}px`, ...(kb.height && { '--vv-h': `${kb.height}px` }) }}
    >
      <div className={styles.dragHandle}>
        <span />
      </div>

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
            {!!destInputValue && (
              <button type="button" className={styles.clearBtn} onClick={onClearDest} aria-label="Clear destination">
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        <div className={styles.modePicker} role="radiogroup" aria-label="How are you travelling?">
          {TRAVEL_OPTIONS.map(({ mode, label, Icon }) => (
            <button
              key={mode}
              type="button"
              role="radio"
              aria-checked={travelMode === mode}
              className={`${styles.modeOption} ${travelMode === mode ? styles.modeOptionActive : ''}`}
              onClick={() => onTravelModeChange(mode)}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </div>

        {!!hint && (
          <div className={styles.hintCard}>
            <span className={styles.hintIconBg}>
              <Info size={12} />
            </span>
            <div className={styles.hintText}>{hint}</div>
          </div>
        )}

        {hasDest && preview && (
          <div className={styles.summary} aria-live="polite">
            {preview.loading ? (
              <span className={styles.summaryLoading}>Finding the quickest way…</span>
            ) : (
              <>
                <div>
                  <div className={styles.summaryTime}>{fmtDuration(preview.duration)}</div>
                  <div className={styles.summaryMeta}>
                    {fmtRouteDistance(preview.distance)} · {option.by}
                  </div>
                </div>
                <div className={styles.summaryArrive}>
                  <div className={styles.summaryMeta}>Arrive</div>
                  <div className={styles.summaryClock}>{arrivalTime(preview.duration)}</div>
                </div>
              </>
            )}
          </div>
        )}

        {!hasDest && !!(popularPlaces && popularPlaces.length) && (
          <div className={styles.popularSection}>
            <div className={styles.popularLabel}>Popular on campus</div>
            <div className={styles.popularList}>
              {popularPlaces.map((place) => {
                const Icon = LEGACY_ICON_MAP[icon(place.waypoint)] || MapPin;
                const colour = dotColor(place.type);
                return (
                  <button
                    key={place.id}
                    type="button"
                    className={styles.popularRow}
                    onClick={() => onPopularPlaceSelect(place)}
                  >
                    <span className={styles.popularIconBg} style={{ '--place-colour': colour }}>
                      <Icon size={16} />
                    </span>
                    <span className={styles.popularName}>{place.name}</span>
                    {place.distance != null && <span className={styles.popularDist}>{fmtRouteDistance(place.distance)}</span>}
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
          {busyLabel || (hasDest ? option.start : 'Pick a destination')}
        </button>
      </div>
    </div>
  );
}
