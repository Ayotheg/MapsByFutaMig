import { Crosshair, Gauge, Compass, LocateFixed, CircleStop, ChevronDown, X } from 'lucide-react';
import styles from './GpsPanel.module.css';

/**
 * GPS Signal panel body — Oct 2026 redesign (screens "GPS panel · V2
 * desktop", "· mobile" and "· V3 mobile"). Same `gps` object from
 * `useGpsTracking.js` as before, plus its Live tracking state
 * (`isFollowing`/`toggleFollow`).
 *
 * Two variants, same pattern as ExplorePanel:
 *  - `variant="compact"` (mobile, sheetState === 'half'): "Your location",
 *    the Find my location button and a one-line signal row whose
 *    "Details" link calls `onExpand`.
 *  - `variant="full"` (mobile sheetState === 'full', and always on
 *    desktop, where Sidebar shows it as a floating card): big signal
 *    card, button, Accuracy/Speed/Heading and the Live tracking switch.
 *    The header adds a close button (`onClose`), plus collapse
 *    (`onCollapse`) on mobile.
 *
 * Two separate actions: the button (`toggleTracking`) finds you once and
 * puts the dot on the map, then turns into "Stop tracking", which clears
 * it. The Live tracking switch (`toggleFollow`) keeps the dot, map, speed
 * and heading following you — it stays disabled until you've been found.
 *
 * Signal readout is the real `activeBars`/`tier` (5 bars, matching the
 * hook's granularity) — no satellite count or altitude, which the app
 * doesn't have.
 */
export default function GpsPanel({ gps, embedded = false, variant = 'full', onExpand, onCollapse, onClose }) {
  const {
    tier,
    signalBadgeText,
    signalBadgeClass,
    activeBars,
    accuracyText,
    speedText,
    headingText,
    warning,
    gpsBtnLabel,
    isTracking,
    isFollowing,
    toggleTracking,
    toggleFollow,
    acquiring,
    approximate,
    error,
  } = gps;
  const compact = embedded && variant === 'compact';

  // `error`/`acquiring`/`approximate` are text-only states from the hook:
  // a GeolocationPositionError message, a fresh fix being acquired, and the
  // weak-signal fallback fix respectively.
  const statusText = error
    ? error
    : !isTracking
      ? compact
        ? 'Tap below to show where you are'
        : 'Check your signal, then find yourself'
      : acquiring
        ? 'Getting a fresh GPS fix…'
        : approximate
          ? 'Approximate location — weak signal'
          : isFollowing
            ? 'Live tracking — following you'
            : 'Found you — shown on the map';

  const signalLabel =
    activeBars === 0
      ? 'Waiting for signal'
      : tier === 'good'
        ? 'Strong signal'
        : tier === 'fair'
          ? 'Fair signal'
          : 'Weak signal';

  // The hook's own label ("FIND MY LOCATION" / "LOCATE ANYWAY" / "RETRY" /
  // "STOP TRACKING"), sentence-cased to match the design.
  const btnLabel = gpsBtnLabel.charAt(0) + gpsBtnLabel.slice(1).toLowerCase();
  const canFollow = isTracking && !acquiring;

  const bars = (small) => (
    <div className={small ? styles.miniBars : styles.bars} aria-hidden="true">
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className={`${small ? styles.miniBar : styles.bar} ${i <= activeBars ? styles[`active${tier}`] || '' : ''}`}
          style={{ height: `${i * 20}%` }}
        />
      ))}
    </div>
  );

  const warningEl = warning.visible && (
    <div className={`${styles.warning} ${warning.poor ? styles.poorWarn : ''}`}>{warning.text}</div>
  );

  return (
    <div className={`${styles.body} ${embedded ? styles.bodyEmbedded : styles.bodyDesktop}`}>
      {embedded && <div className={styles.grabber} aria-hidden="true" />}

      <div className={styles.header}>
        <div className={styles.headerText}>
          <h2 className={styles.title}>{compact ? 'Your location' : 'GPS signal'}</h2>
          <p className={styles.subtitle}>{statusText}</p>
        </div>
        <div className={styles.headerActions}>
          {!compact && (
            <span className={`${styles.badge} ${styles[signalBadgeClass] || ''}`}>
              <span className={styles.badgeDot} />
              {signalBadgeText}
            </span>
          )}
          {embedded && !compact && onCollapse && (
            <button type="button" className={styles.iconBtn} onClick={onCollapse} aria-label="Show less">
              <ChevronDown size={18} strokeWidth={2} />
            </button>
          )}
          {onClose && (
            <button type="button" className={`${styles.iconBtn} ${styles.iconBtnClose}`} onClick={onClose} aria-label="Close">
              <X size={18} strokeWidth={2} />
            </button>
          )}
        </div>
      </div>

      {!compact && (
        <div className={styles.visCard}>
          <div className={styles.visOrb} aria-hidden="true" />
          {bars(false)}
          <div className={styles.visReadout}>
            <span className={`${styles.visNumber} ${styles[`text${tier}`] || ''}`}>{activeBars}/5</span>
            <span className={styles.visCaption}>{signalLabel}</span>
          </div>
        </div>
      )}

      <button
        type="button"
        className={`${styles.gpsBtn} ${isTracking ? styles.stop : ''} ${acquiring ? styles.acquiring : ''}`}
        onClick={toggleTracking}
        aria-busy={acquiring || undefined}
      >
        {isTracking ? <CircleStop size={18} strokeWidth={2.2} /> : <LocateFixed size={18} strokeWidth={2.2} />}
        {btnLabel}
      </button>

      {compact ? (
        <>
          <div className={styles.signalRow}>
            {bars(true)}
            <div className={styles.signalRowText}>
              <span className={styles.signalRowTitle}>
                {signalLabel}
                {activeBars > 0 && <span className={styles.signalRowScore}> · {activeBars}/5</span>}
              </span>
              <span className={styles.signalRowSub} title={accuracyText}>
                Accuracy {accuracyText}
              </span>
            </div>
            {onExpand && (
              <button type="button" className={styles.detailsBtn} onClick={onExpand}>
                Details
                <ChevronDown size={16} strokeWidth={2.2} />
              </button>
            )}
          </div>
          {warningEl}
        </>
      ) : (
        <>
          {warningEl}
          <div className={styles.grid}>
            <Stat Icon={Crosshair} label="Accuracy" value={accuracyText} wide />
            <Stat Icon={Gauge} label="Speed" value={speedText} />
            <Stat Icon={Compass} label="Heading" value={headingText} />
          </div>

          <div className={styles.liveRow}>
            <div className={styles.liveText}>
              <span className={styles.liveTitle} id="gps-live-label">
                Live tracking
              </span>
              <span className={styles.liveSub}>
                {canFollow ? 'Follows you and fills in speed and heading' : 'Find your location first'}
              </span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={isFollowing}
              aria-labelledby="gps-live-label"
              className={`${styles.switch} ${isFollowing ? styles.switchOn : ''}`}
              disabled={!canFollow}
              onClick={toggleFollow}
            >
              <span className={styles.switchThumb} />
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ Icon, label, value, wide }) {
  return (
    <div className={`${styles.stat} ${wide ? styles.statWide : ''}`}>
      <div className={styles.statHead}>
        <Icon size={14} strokeWidth={2} className={styles.statIcon} />
        <span className={styles.statLabel}>{label}</span>
      </div>
      <div className={styles.statValue} title={value}>
        {value}
      </div>
    </div>
  );
}
