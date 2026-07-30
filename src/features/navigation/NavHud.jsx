import { Volume2, VolumeX, X } from 'lucide-react';
import { LEGACY_ICON_MAP } from '../../lib/legacyIconMap';
import styles from './NavHud.module.css';

/**
 * Ported from legacy `index.html` ~673–689 (`#navHud`). The voice
 * mute/unmute button (legacy injects it via `_injectVoiceBtn`, app.js
 * ~4444–4481, as a plain DOM node prepended before `#navHudClose`) is
 * just rendered directly here instead — no reason to replicate the
 * imperative injection-once dance in React, same call as every other
 * slice's "this was a DOM workaround, not a real requirement" cases.
 */
export default function NavHud({ arriving, arrived, turnIcon, turnInstruction, turnDist, nextPreview, distRemain, destName, voiceEnabled, onToggleVoice, onClose }) {
  const TurnIcon = LEGACY_ICON_MAP[turnIcon] || LEGACY_ICON_MAP['arrow-up'];
  return (
    <div className={`${styles.hud} ${arriving ? styles.arriving : ''} ${arrived ? styles.arrived : ''}`}>
      <div className={styles.top}>
        <div className={styles.turnIcon}>
          <TurnIcon size={22} />
        </div>
        <div className={styles.turnInfo}>
          <div className={styles.turnInstruction}>{turnInstruction}</div>
          <div className={styles.turnDist}>{turnDist}</div>
        </div>
        <button type="button" className={styles.voiceBtn} title="Toggle voice navigation" onClick={onToggleVoice}>
          {voiceEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
        </button>
        <button type="button" className={styles.closeBtn} onClick={onClose}>
          <X size={13} /> END
        </button>
      </div>

      {nextPreview && <div className={styles.nextPreview}>{nextPreview}</div>}

      <div className={styles.stats}>
        <div className={`${styles.stat} ${styles.statSingle}`}>
          <div className={styles.statLabel}>DISTANCE REMAINING</div>
          <div className={styles.statVal}>{distRemain}</div>
        </div>
      </div>
      <div className={styles.destName}>{destName}</div>
    </div>
  );
}
