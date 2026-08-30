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
 *
 * UI redesign (per UI_REDESIGN_GUIDE.md, Nav/GPS HUD session — Figma node
 * 4:429 "NAVIGATION pANEL", fetched directly via the Figma MCP connection
 * once it was confirmed available): the HUD is now two separate floating
 * cards instead of one edge-to-edge dark bar — a top instruction card
 * (icon, turn instruction, voice/end buttons, "up next" strip) and a
 * bottom "distance remaining" card that sits just above the tab bar,
 * matching the Figma frame's own split (4:437 vs. 4:475). Same props,
 * same data, same `arriving`/`arrived`/`nextPreview` gating as before —
 * only the layout changed. The `arriving`/`arrived` color signal, which
 * used to live on the whole bar's bottom border, now lives on the top
 * card's border + icon fill instead (same two states, just relocated
 * onto the element that still makes sense for it once there's no longer
 * one single bar to put it on).
 *
 * Figma's "Floating Controls" (a recenter button + a second FAB, node
 * 4:466) aren't built here — no wiring exists for a "recenter" action
 * (the map already auto-recenters via `panTo` whenever the person isn't
 * mid-gesture, see `useGpsTracking.js`/`NavigationController.jsx`), and
 * the second FAB would duplicate `MobFabCluster`'s existing locate
 * button. Flagged in the guide rather than guessed at.
 */
export default function NavHud({ arriving, arrived, turnIcon, turnInstruction, turnDist, nextPreview, distRemain, destName, voiceEnabled, onToggleVoice, onClose }) {
  const TurnIcon = LEGACY_ICON_MAP[turnIcon] || LEGACY_ICON_MAP['arrow-up'];
  return (
    <>
      <div className={`${styles.topCard} ${arriving ? styles.arriving : ''} ${arrived ? styles.arrived : ''}`}>
        <div className={styles.top}>
          <div className={styles.turnIcon}>
            <TurnIcon size={20} />
          </div>
          <div className={styles.turnInfo}>
            <div className={styles.instructionLabel}>NOW</div>
            <div className={styles.turnInstruction}>{turnInstruction}</div>
            <div className={styles.turnDist}>{turnDist}</div>
          </div>
          <button type="button" className={styles.voiceBtn} title="Toggle voice navigation" onClick={onToggleVoice}>
            {voiceEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>
          <button type="button" className={styles.closeBtn} onClick={onClose}>
            <X size={12} /> End
          </button>
        </div>

        {nextPreview && (
          <div className={styles.nextPreview}>
            <span className={styles.nextLabel}>UP NEXT</span>
            <span className={styles.nextText}>{nextPreview}</span>
          </div>
        )}
      </div>

      <div className={styles.distCard}>
        <div className={styles.distLabel}>DISTANCE REMAINING</div>
        <div className={styles.distVal}>{distRemain}</div>
        <div className={styles.destName}>{destName}</div>
      </div>
    </>
  );
}
