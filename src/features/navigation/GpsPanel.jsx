import { Crosshair, Gauge, Compass, LocateFixed, CircleStop } from 'lucide-react';
import styles from './GpsPanel.module.css';

/**
 * GPS Signal panel body — v2 redesign (UI_REDESIGN_GUIDE.md, Nav/GPS HUD
 * row; Figma node 31:52 "GPS Screen", pulled via the Figma MCP
 * connection). Ported from legacy `index.html` ~542–561 originally; this
 * pass only restyles markup/CSS per the guide's Rule 1/2 — `gps` still
 * carries every value from `useGpsTracking.js` unchanged, same props in,
 * same props out, no new state.
 *
 * `embedded` (true when MobileSheet.jsx renders this) previously hid the
 * title row entirely (the mobile tab strip already said "Signal"). The
 * Figma reference for this screen is itself the mobile/embedded view and
 * shows the full title+subtitle+badge header, so that hide-on-embedded
 * behavior is dropped in favor of what the reference actually shows —
 * `embedded` now only adjusts content padding/density (mobile vs. the
 * desktop Sidebar panel), same role it already partly played before.
 *
 * **Subtitle line (`statusText` below) is computed inline from data the
 * hook already returns (`gpsBtnDisabled`/`isTracking`/`tier`/`warning`) —
 * no new prop, no new state.** Same precedent as ChipResultsPanel's
 * status-line consolidation (see UI_REDESIGN_GUIDE.md). The Figma copy
 * "Acquiring high-accuracy lock" is used verbatim for the
 * tracking-but-not-yet-`good` case, which is exactly what that phrase
 * describes.
 *
 * **Kept, not literally in the Figma frame:** the signal-strength bar
 * chart, now restyled as a full "Visualization Card" per Figma node 64:2
 * — but the card's own "8/12 Satellites in view" readout is dropped per
 * explicit instruction (this app has no satellite data anywhere) and
 * replaced with a real readout built from the same `activeBars`/`tier`
 * values the bars are drawn from, not a fabricated count. Bar count
 * stays at 5 (matching `activeBars`' real granularity) rather than the
 * frame's 15 decorative bars, since more bars would fake precision the
 * app doesn't have.
 *
 * **Not ported (unchanged from before this session):** the "Altitude"
 * stat cell shown in the Figma frame. `useGpsTracking.js` has no
 * altitude field to bind it to, and inventing a static/fake value would
 * misrepresent live GPS data — flagged rather than fabricated. The stat
 * grid keeps the three real fields (Accuracy, Speed, Heading) the app
 * actually has, with Heading spanning the second row.
 *
 * Value strings (`accuracyText`/`speedText`/`headingText`) are rendered
 * as the single already-formatted string `useGpsTracking.js` returns
 * (e.g. "±12m", "GPS unavailable", "Warming up…") rather than split into
 * a big-number + small-unit pair like the Figma frame — splitting would
 * mean parsing that string's format in this component, which reaches
 * into .js-owned formatting logic and would break on its non-numeric
 * edge-case text. Out of scope for a markup/CSS-only pass.
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

  const statusText = gpsBtnDisabled
    ? warning.text || 'Location unavailable'
    : !isTracking
      ? 'Tap start to begin tracking'
      : tier === 'good'
        ? 'Live GPS tracking active'
        : tier === 'fair'
          ? 'Locking in — accuracy improving'
          : 'Acquiring high-accuracy lock';

  // Visualization card caption — real data only (see file header): no
  // satellite count exists in useGpsTracking.js, so the Figma frame's
  // "8/12 Satellites in view" readout is replaced with the same
  // activeBars/tier values the bar chart itself is drawn from, not a
  // fabricated number.
  const signalLabel = tier === 'good' ? 'Strong signal' : tier === 'fair' ? 'Fair signal' : 'Weak signal';

  return (
    <div className={styles.body}>
      <div className={`${styles.header} ${!embedded ? styles.headerDesktop : ''}`}>
        <div className={styles.headerText}>
          <span className={styles.title}>GPS Status</span>
          <span className={styles.subtitle}>{statusText}</span>
        </div>
        <span className={`${styles.badge} ${styles[signalBadgeClass] || ''}`}>
          <span className={styles.badgeDot} />
          {signalBadgeText}
        </span>
      </div>

      <div className={`${styles.content} ${embedded ? styles.contentEmbedded : ''}`}>
        {/* Visualization Card — restyled per Figma node 64:2's "Visualization
            Card", which shows a tall abstract bar chart + a big number/
            caption readout ("8/12 Satellites in view"). Per explicit
            instruction, the satellite readout is dropped (no satellite data
            exists anywhere in this app) and replaced with the real signal
            data the old thin 5-bar strip already displayed — activeBars/tier
            — reusing this card's *visual language* (taller bars, soft
            violet-tinted card, decorative blur orb, big number + caption
            beneath) rather than its literal content. Bars stay real (5,
            matching activeBars' actual granularity) instead of the frame's
            15 decorative bars, since inventing extra bars with no data
            behind them would fake precision the app doesn't have. */}
        <div className={styles.visCard}>
          <div className={styles.visOrb} aria-hidden="true" />
          <div className={styles.bars} aria-hidden="true">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className={`${styles.bar} ${i <= activeBars ? styles[`active${tier}`] || '' : ''}`}
                style={{ height: `${i * 20}%` }}
              />
            ))}
          </div>
          <div className={styles.visReadout}>
            <div className={`${styles.visNumber} ${styles[`text${tier}`] || ''}`}>{activeBars}/5</div>
            <div className={styles.visCaption}>{signalLabel}</div>
          </div>
        </div>

        <div className={styles.grid}>
          <div className={styles.stat}>
            <div className={styles.statHead}>
              <Crosshair size={16} strokeWidth={2} className={styles.statIcon} />
              <span className={styles.statLabel}>Accuracy</span>
            </div>
            <div className={styles.statValue} title={accuracyText}>{accuracyText}</div>
          </div>
          <div className={styles.stat}>
            <div className={styles.statHead}>
              <Gauge size={16} strokeWidth={2} className={styles.statIcon} />
              <span className={styles.statLabel}>Speed</span>
            </div>
            <div className={styles.statValue} title={speedText}>{speedText}</div>
          </div>
          <div className={`${styles.stat} ${styles.statWide}`}>
            <div className={styles.statHead}>
              <Compass size={16} strokeWidth={2} className={styles.statIcon} />
              <span className={styles.statLabel}>Heading</span>
            </div>
            <div className={styles.statValue} title={headingText}>{headingText}</div>
          </div>
        </div>

        <button
          type="button"
          className={`${styles.gpsBtn} ${isTracking ? styles.tracking : ''}`}
          disabled={gpsBtnDisabled}
          onClick={toggleTracking}
        >
          {isTracking ? (
            <CircleStop size={15} strokeWidth={2} />
          ) : (
            <LocateFixed size={15} strokeWidth={2} />
          )}
          {gpsBtnLabel}
        </button>

        {warning.visible && (
          <div className={`${styles.warning} ${warning.poor ? styles.poorWarn : ''}`}>{warning.text}</div>
        )}
      </div>
    </div>
  );
}
