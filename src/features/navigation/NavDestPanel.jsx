import { Footprints, Bike, Car, MapPin, Navigation } from 'lucide-react';
import styles from './NavDestPanel.module.css';

const MODES = [
  { key: 'foot-walking', label: 'Walk', Icon: Footprints },
  { key: 'cycling-regular', label: 'Moto', Icon: Bike },
  { key: 'driving-car', label: 'Drive', Icon: Car },
];

/**
 * Ported from legacy `index.html` ~634–671 (`#navDestPanel`). Desktop:
 * fixed left panel next to the sidebar. Mobile: becomes an Apple Maps-
 * style bottom sheet (`NavDestPanel.module.css`'s `@media (max-width:
 * 768px)` block) — purely a CSS-driven layout swap, same component.
 */
export default function NavDestPanel({
  mode,
  onModeChange,
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
}) {
  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.title}>Where to?</span>
        <button type="button" className={styles.close} onClick={onClose} aria-label="Close">
          ✕
        </button>
      </div>

      <div className={styles.modeRow}>
        {MODES.map(({ key, label, Icon }) => (
          <button
            key={key}
            type="button"
            className={`${styles.modeBtn} ${mode === key ? styles.active : ''}`}
            onClick={() => onModeChange(key)}
          >
            <Icon size={20} />
            <span>{label}</span>
          </button>
        ))}
      </div>

      <div className={styles.body}>
        <div className={styles.routeInputs}>
          <div className={styles.fromRow}>
            <span className={`${styles.dot} ${styles.dotA}`} />
            <span className={styles.fromLabel}>Your current location</span>
          </div>
          <div className={styles.divider} />
          <div className={styles.toRow}>
            <span className={`${styles.dot} ${styles.dotB}`}>
              <MapPin size={11} />
            </span>
            <div className={styles.toInputWrap}>
              <input
                type="text"
                placeholder="Search destination on campus…"
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
                      continuity" — see BRAND_GUIDELINES.md. Kept feature-local. */}
                  {dropdownResults.map((r, i) => (
                    <div
                      key={r.id || `${r.lat}-${r.lng}-${i}`}
                      className={styles.ddItem}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        onPickResult(r);
                      }}
                    >
                      <div className={styles.ddIcon}>{icon(r)}</div>
                      <div>
                        <div className={styles.ddName} dangerouslySetInnerHTML={{ __html: highlight(r.name, destInputValue) }} />
                        {r.desc && <div className={styles.ddSub}>{r.desc}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <button type="button" className={styles.goBtn} disabled={goDisabled} onClick={onGo}>
          <Navigation size={15} />
          {goLabel}
        </button>

        <div className={styles.hintText}>{hint}</div>
      </div>
    </div>
  );
}
