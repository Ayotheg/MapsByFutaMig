import { lazy, Suspense, useState } from 'react';
import styles from './ImportTrigger.module.css';

const KmlImportPanel = lazy(() => import('./KmlImportPanel'));

/**
 * ImportTrigger — small always-in-bundle button that lazy-loads the whole
 * KML/GPX import pipeline (parsers, geoUtils, exportBuilders, SaveModal,
 * the `@tmcw/togeojson` library) only once clicked. Follows CLAUDE.md's
 * bundle-size policy exactly: "Slice 5's admin-only KML upload sub-panel
 * ... must be lazy-loaded" — this file is the small eager half of that
 * split, `KmlImportPanel.jsx` is the lazy half.
 *
 * ── Placement, corrected against legacy's real markup (Slice 11) ──────
 * Slice 5's original comment here assumed `#adminImportBtn` "lives INSIDE
 * the admin overlay" and was just waiting on Slice 11 to relocate this
 * trigger there. Having now actually read legacy's `index.html` while
 * building that overlay: `#adminImportBtn`/`#adminImportInput` don't
 * exist anywhere in it. `processImportPipeline` (app.js ~1696) is only
 * ever wired up at app.js ~1838–1846, guarded by
 * `if (adminImportBtn && adminImportInput)` — both `getElementById` calls
 * return null against the real DOM, so that whole block is silently dead
 * code in the live legacy app, not a feature reserved for the admin panel.
 * There is no legacy placement to relocate this into.
 *
 * So this stays exactly where Slice 5 put it — a standalone floating
 * button, independent of admin auth (legacy never gated it either, since
 * it was never reachable there in the first place) — rather than folding
 * it into the now-real `AdminPanel.jsx` on a guess about where it
 * "should" go. `open`/`onOpenChange` (added when Sidebar's Admin button
 * briefly pointed here as a stopgap, see MapPage.jsx's git history) are
 * unused by anything now that Admin opens the real panel instead, but are
 * left in place — harmless, and this component still falls back to fully
 * self-contained local state when they aren't passed.
 */
export default function ImportTrigger({ waypoints, segments, onSaved, open: openProp, onOpenChange }) {
  const [localOpen, setLocalOpen] = useState(false);
  const isControlled = openProp !== undefined;
  const open = isControlled ? openProp : localOpen;

  function setOpen(next) {
    if (isControlled) onOpenChange?.(next);
    else setLocalOpen(next);
  }

  return (
    <>
      <button
        type="button"
        className={styles.trigger}
        onClick={() => setOpen(true)}
        title="Import KML/GPX (admin)"
      >
        ⬆ Import
      </button>

      {open && (
        <Suspense fallback={null}>
          <KmlImportPanel
            waypoints={waypoints}
            segments={segments}
            onSaved={onSaved}
            onClose={() => setOpen(false)}
          />
        </Suspense>
      )}
    </>
  );
}
