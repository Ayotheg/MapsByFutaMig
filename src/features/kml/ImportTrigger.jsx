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
 * ── Flagging a real placement ambiguity, not guessing past it ─────────
 * In legacy, this trigger (`#adminImportBtn`) lives INSIDE the admin
 * overlay (`#adminOverlay`) — i.e. it's already gated behind the admin
 * panel that doesn't exist in this port yet (Slice 11, "Not started" in
 * the progress tracker). Sidebar.jsx's `.adminBtn` is explicitly reserved,
 * inert chrome for Slice 11 to wire up ("the admin toggle is Slice 11") —
 * so this can't just hang off that button without reaching into a slice
 * that isn't built.
 *
 * Rather than block this whole slice on Slice 11, or wire into chrome
 * that's reserved for a different slice, this renders as its own small
 * floating button (bottom-left, clear of the existing sidebar/mobile-sheet
 * chrome) so the import pipeline is genuinely reachable and testable now.
 * This placement is a deliberate stand-in, not a final design decision —
 * flagged for confirmation, and Slice 11 should relocate/re-gate it behind
 * real admin auth once that panel exists, per legacy's actual structure.
 */
export default function ImportTrigger({ waypoints, segments, onSaved }) {
  const [open, setOpen] = useState(false);

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
