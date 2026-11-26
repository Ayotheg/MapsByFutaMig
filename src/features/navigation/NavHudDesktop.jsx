import { Volume2, VolumeX, X } from 'lucide-react';
import { LEGACY_ICON_MAP } from '../../lib/legacyIconMap';
import styles from './NavHudDesktop.module.css';

/**
 * Desktop turn-by-turn navigation HUD: a floating capsule pill at the top
 * center of the map that expands downward to reveal the "UP NEXT" strip,
 * matching mobile NavHud's exact props and behaviour.
 */
export default function NavHudDesktop({
  arriving,
  arrived,
  turnIcon,
  turnInstruction,
  turnDist,
  nextPreview,
  distRemain,
  destName,
  voiceEnabled,
  onToggleVoice,
  onClose,
}) {
  const TurnIcon = LEGACY_ICON_MAP[turnIcon] || LEGACY_ICON_MAP['arrow-up'];
  const eyebrow = !turnDist || turnDist.endsWith(' remaining') ? 'NOW' : turnDist;

  return (
    <div
      className={`${styles.card} ${arriving ? styles.arriving : ''} ${arrived ? styles.arrived : ''}`}
      role="region"
      aria-label="Turn-by-turn navigation"
    >
      <div className={styles.main}>
        <div className={styles.turnIcon} aria-hidden="true">
          <TurnIcon size={22} strokeWidth={2.25} />
        </div>

        <div className={styles.turnInfo}>
          <div className={styles.eyebrow}>{eyebrow}</div>
          <div className={styles.turnInstruction} title={turnInstruction}>
            {turnInstruction}
          </div>
        </div>

        <div className={styles.tripMeta}>
          <div className={styles.distRemain}>{distRemain}</div>
          {destName && (
            <div className={styles.destName} title={destName}>
              {destName}
            </div>
          )}
        </div>

        <span className={styles.divider} aria-hidden="true" />

        <div className={styles.actions}>
          <button
            type="button"
            className={`${styles.voiceBtn} ${!voiceEnabled ? styles.voiceMuted : ''}`}
            title="Toggle voice navigation"
            aria-label={voiceEnabled ? 'Mute voice navigation' : 'Unmute voice navigation'}
            aria-pressed={voiceEnabled}
            onClick={onToggleVoice}
          >
            {voiceEnabled ? <Volume2 size={17} /> : <VolumeX size={17} />}
          </button>
          <button type="button" className={styles.closeBtn} onClick={onClose}>
            <X size={14} aria-hidden="true" />
            <span>End</span>
          </button>
        </div>
      </div>

      {nextPreview && (
        <div className={styles.nextPreview}>
          <span className={styles.nextLabel}>UP NEXT</span>
          <span className={styles.nextText} title={nextPreview}>
            {nextPreview}
          </span>
        </div>
      )}
    </div>
  );
}
