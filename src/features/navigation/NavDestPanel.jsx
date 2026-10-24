import { useEffect, useState } from 'react';
import { Info, MapPin, Navigation, Search, X } from 'lucide-react';
import { LEGACY_ICON_MAP } from '../../lib/legacyIconMap';
import { dotColor } from '../search/chipConfig';
import styles from './NavDestPanel.module.css';
import TravelModePicker from './TravelModePicker';

/**
 * Ported from legacy `index.html` ~634–671 (`#navDestPanel`). Desktop:
 * fixed left panel next to the sidebar. Mobile: becomes an Apple Maps-
 * style bottom sheet (`NavDestPanel.module.css`'s `@media (max-width:
 * 768px)` block) — purely a CSS-driven layout swap, same component.
 *
 * Redesigned to v2 light tokens this session, per Figma node 1:311
 * ("Navigation Mode"). Two real functionality changes on direct user
 * instruction:
 *  - Travel mode (TravelModePicker: Walk / Bike / Ride, Ride's Shuttle /
 *    Keke / Car-Cab) sits where the "tap a pin" tip was; `travelMode`,
 *    `onTravelModeChange`, `shuttleStop` come from NavigationController.
 *  - "Popular places on campus" section added — `popularPlaces` is
 *    `NavigationController`'s slice of the *same* `explorePicks` array
 *    MapPage's Explore panel already renders from, not a separate
 *    list, so this always agrees with Explore about what's featured.
 * The static "Your current location" from/to route rows (no prop tied
 * to them, just markup) were also dropped to match the frame, which
 * shows a single "Where to?" destination search only.
 */

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

export default function NavDestPanel({
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
}) {
  const kb = useKeyboardInset();
  return (
    <div
      className={styles.panel}
      data-kb={kb.inset > 0 ? 'open' : undefined}
      style={{ '--kb-inset': `${kb.inset}px`, ...(kb.height && { '--vv-h': `${kb.height}px` }) }}
    >
      <div className={styles.dragHandle}>
        <span />
      </div>

      <div className={styles.body}>
        <div className={styles.searchRow}>
          <Search size={16} className={styles.searchIcon} />
          <div className={styles.toInputWrap}>
            <input
              type="text"
              placeholder="Where to?"
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
                    styling. Reusing the shared component would silently pick up
                    Slice 7's hover color instead of the nav panel's own, which is a
                    real (if small) visual regression from "pixel-identical
                    continuity". Kept feature-local. */}
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
            <X size={14} />
          </button>
        </div>

        {/* Where the "tap a pin" tip used to be: Walk / Bike / Ride. */}
        <TravelModePicker travelMode={travelMode} onTravelModeChange={onTravelModeChange} shuttleStop={shuttleStop} />

        {!!hint && (
          <div className={styles.hintCard}>
            <span className={styles.hintIconBg}>
              <Info size={12} />
            </span>
            <div className={styles.hintText}>{hint}</div>
          </div>
        )}

        {!!(popularPlaces && popularPlaces.length) && (
          <div className={styles.popularSection}>
            <div className={styles.popularLabel}>Popular places on campus</div>
            <div className={styles.popularGrid}>
              {popularPlaces.map((place) => {
                const Icon = LEGACY_ICON_MAP[icon(place.waypoint)] || MapPin;
                return (
                  <button
                    key={place.id}
                    type="button"
                    className={styles.popularCard}
                    onClick={() => onPopularPlaceSelect(place)}
                  >
                    <span className={styles.popularIconBg} style={{ background: dotColor(place.type) }}>
                      <Icon size={13} />
                    </span>
                    <div className={styles.popularName}>{place.name}</div>
                    <div className={styles.popularMeta}>{place.distanceLabel || (place.type || '').replace(/_/g, ' ') || 'Campus spot'}</div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className={styles.footer}>
        <button type="button" className={styles.goBtn} disabled={goDisabled} onClick={onGo}>
          <Navigation size={15} />
          {goLabel}
        </button>
      </div>
    </div>
  );
}
