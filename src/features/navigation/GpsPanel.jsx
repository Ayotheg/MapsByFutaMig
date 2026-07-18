import styles from './GpsPanel.module.css';

/**
 * GPS Signal panel body. Ported from legacy `index.html` ~542–561
 * (`#panelGps`'s inner markup — the shell itself is Slice 3's
 * `.sidebar-panel`, already rendered by Sidebar.jsx/MobileSheet.jsx).
 *
 * Pure display — all the actual tracking logic lives in
 * `useGpsTracking.js`, lifted to MapPage and passed down here as props so
 * the same live state also drives `MobFabCluster`'s locate FAB.
 *
 * `embedded` (true when MobileSheet.jsx renders this): skips the
 * title+badge header row. Matches the precedent Slice 3/7 already set for
 * `LayersPanel` — the mobile sheet's tab strip already shows "Signal" as
 * the section label, so duplicating a "GPS Signal" title inside the body
 * would be redundant. Legacy instead keeps `.panel-header` visible on
 * mobile with `margin-top: 0 !important` (style.css ~3557–3561) rather
 * than hiding it outright — this port's simplification predates this
 * session (LayersPanel never renders a header in `MobileSheet.jsx` at
 * all), so `GpsPanel` follows the same already-established shape rather
 * than reintroducing a header treatment nothing else here uses.
 *
 * **Not ported — dead CSS, confirmed not a porting error:** legacy's
 * `.gps-panel`/`.sig-good`/`.sig-fair`/`.sig-poor`/`.sig-tracking` border-
 * glow rule (style.css ~804–834) targets a `.gps-panel` class that no
 * `#panelGps` element in the current legacy HTML actually has — the JS
 * (`gpsPanel.classList.add('sig-good')` etc., app.js ~1259–1260) adds
 * those classes to `#panelGps`, which only carries `.sidebar-panel`
 * (Slice 3's shell class) since the panel was moved inside the sidebar.
 * `grep`-confirmed no element anywhere in `index.html` has
 * `class="gps-panel"` — this is genuinely dead/unreachable CSS in
 * legacy, not something this port silently dropped by mistake. Likewise
 * `.gps-panel-header`/`.gps-panel-title` (~840–847) — also grep-confirmed
 * unused. Every *other* class here (`.gps-signal-badge`, `.signal-bars`/
 * `.bar`, `.stat-row/cell/label/value`, `.gps-btn`, `.gps-warning`) is
 * real and ported.
 */
export default function GpsPanel({ gps, embedded = false }) {
  const {
    tier,
    signalBadgeText,
    signalBadgeClass,
    activeBars,
    accuracyText,
    speedText,
    headingText,
    warning,
    gpsBtnDisabled,
    gpsBtnLabel,
    isTracking,
    toggleTracking,
  } = gps;

  return (
    <div className={styles.body}>
      {!embedded && (
        <div className={styles.header}>
          <span className={styles.title}>GPS Signal</span>
          <span className={`${styles.badge} ${styles[signalBadgeClass] || ''}`}>{signalBadgeText}</span>
        </div>
      )}
      {embedded && (
        <div className={styles.embeddedBadgeRow}>
          <span className={`${styles.badge} ${styles[signalBadgeClass] || ''}`}>{signalBadgeText}</span>
        </div>
      )}

      <div className={`${styles.content} ${embedded ? styles.contentEmbedded : ''}`}>
        <div className={styles.bars}>
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className={`${styles.bar} ${i <= activeBars ? styles[`active${tier}`] || '' : ''}`}
              style={{ height: `${i * 20}%` }}
            />
          ))}
        </div>

        <div className={styles.statRow}>
          <div className={styles.statCell}>
            <div className={styles.statLabel}>ACCURACY</div>
            <div className={`${styles.statValue} ${styles[tier] || ''}`}>{accuracyText}</div>
          </div>
          <div className={styles.statCell}>
            <div className={styles.statLabel}>SPEED</div>
            <div className={styles.statValue}>{speedText}</div>
          </div>
          <div className={styles.statCell}>
            <div className={styles.statLabel}>HEADING</div>
            <div className={styles.statValue}>{headingText}</div>
          </div>
        </div>

        <button type="button" className={`${styles.gpsBtn} ${isTracking ? styles.tracking : ''}`} disabled={gpsBtnDisabled} onClick={toggleTracking}>
          {gpsBtnLabel}
        </button>

        {warning.visible && <div className={`${styles.warning} ${warning.poor ? styles.poorWarn : ''}`}>{warning.text}</div>}
      </div>
    </div>
  );
}
