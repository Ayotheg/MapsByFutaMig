import { useEffect } from 'react';
import { PartyPopper, Heart, Check, Footprints } from 'lucide-react';
import styles from './NavArrivedBanner.module.css';

// Same campaign link used on the landing page's donate CTA
// (src/pages/landing/CrowdrCampaignCard.jsx, Footer.jsx) — kept as its
// own local constant here rather than importing from `pages/landing/`,
// since Rule 5 keeps this in-app surface decoupled from that directory.
const CROWDR_CAMPAIGN_URL = 'https://www.oncrowdr.com/explore/c/fund-mapsbyfuta';

/**
 * Ported from legacy `arrivedAtDestination()` (app.js ~4949–4976) —
 * the dynamically-created `.nav-arrived-banner` DOM node. Legacy
 * auto-dismisses after 8 s; same here via `useEffect` + `setTimeout`.
 *
 * v2 (this session): redesigned against Figma node 67:130
 * ("Destination Arrived"), pulled via the Figma MCP connection. Same
 * props/data flow as before — `destName` and `onDismiss` are untouched,
 * only the markup/CSS changed. Reuses the shared v2 Modal contract
 * (overlay/scrim/pop-in animation,
 * first set by `Modal.module.css`) even though this component doesn't
 * render through `Modal.jsx` itself (it never has — it's a standalone
 * fixed-position banner, not a dismiss-on-backdrop-click modal, and
 * changing that would be a functionality change per Rule 1/7, so it's
 * left as its own component with matching v2 visual language instead).
 *
 * One content decision, flagged: the Figma frame's subtitle is the
 * literal static string "Destination Reached", with no destination
 * name shown anywhere on the card. Rule 3 ("same data in, same data
 * out") means `destName` still has to render somewhere real, not get
 * silently dropped — so the subtitle keeps showing `{destName}` (same
 * data as before), just restyled to the frame's subtitle
 * typography/color contract instead of adopting the frame's literal
 * copy.
 *
 * "Support FUTA Maps" is new content, not in the pre-redesign version —
 * added per explicit instruction, linking out to the same Crowdr
 * campaign the landing page already points at. Plain external link,
 * `target="_blank"` + `rel="noopener noreferrer"` — opens the campaign
 * page, doesn't touch `onDismiss` or any existing handler.
 */
/*
 * `shortcut` (optional): the user walked a shorter way than the route.
 *   { state: 'ask', saved } → ask whether to share it (onShortcutAnswer(bool));
 *   { state: 'shared', saved } → thank them. The banner doesn't auto-close
 *   while it's asking.
 */
export default function NavArrivedBanner({ destName, onDismiss, shortcut, onShortcutAnswer }) {
  const asking = shortcut?.state === 'ask';
  useEffect(() => {
    if (asking) return undefined;
    const t = setTimeout(onDismiss, 8000);
    return () => clearTimeout(t);
  }, [onDismiss, asking]);

  return (
    <div className={styles.overlay}>
      <div className={styles.banner}>
        <div className={styles.iconRing}>
          <PartyPopper size={28} />
        </div>

        <h2 className={styles.heading}>You&apos;ve Arrived!</h2>
        <p className={styles.subtitle}>{destName}</p>

        {shortcut && (
          <div className={styles.shortcutBox}>
            <p className={styles.shortcutTitle}>
              <Footprints size={16} />
              You found a shorter way{shortcut.saved >= 10 ? ` (about ${Math.round(shortcut.saved / 10) * 10} m shorter)` : ''}
            </p>
            {asking ? (
              <>
                <p className={styles.shortcutText}>
                  Share it so the app can guide other students this way too? Only the shorter stretch is shared, never
                  where you started.
                </p>
                <div className={styles.shortcutActions}>
                  <button type="button" className={styles.shareBtn} onClick={() => onShortcutAnswer(true)}>
                    Share it
                  </button>
                  <button type="button" className={styles.skipBtn} onClick={() => onShortcutAnswer(false)}>
                    No thanks
                  </button>
                </div>
              </>
            ) : (
              <p className={styles.shortcutText}>Shared. Thanks for helping other students!</p>
            )}
          </div>
        )}

        <div className={styles.supportRow}>
          <div className={styles.divider} />
          <a
            className={styles.supportLink}
            href={CROWDR_CAMPAIGN_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Heart size={14} />
            Support FUTA Maps
          </a>
        </div>

        <button type="button" className={styles.doneBtn} onClick={onDismiss}>
          Done
          <Check size={18} />
        </button>
      </div>
    </div>
  );
}