import styles from './PlaceTypeFilter.module.css';
import { GROUP_META, GROUP_ROWS } from './placeTypeGroups';

/**
 * Ported from legacy `index.html` lines ~133–436 (#placeTypeFilter markup)
 * and `app.js` `initPlaceTypeFilter` (~6154–6301).
 *
 * Deliberate deviation from legacy: group headers are rendered non-
 * interactive (no collapse/expand). Legacy's CSS/markup still has the
 * chevron and `.ptf-group-body.open` collapse mechanics, but the actual
 * JS explicitly disables it — `header.style.cursor = 'default'` with no
 * click listener attached (app.js ~6257–6260), and every group is force-
 * opened on init and never re-collapsed. That's dead code in legacy, not
 * a feature to port; matching what the code *does*, not what the CSS
 * hints it could do, per CLAUDE.md.
 *
 * Also not ported: `_setGroupVisible`/`ptfToggle<Group>` — a group-level
 * toggle checkbox legacy's JS supports but no corresponding checkbox
 * exists anywhere in the HTML. Vestigial, skipped for the same reason.
 */
export default function PlaceTypeFilter({
  typeVisible,
  setTypeVisible,
  resetAll,
  typeCounts,
  groupCounts,
  isGroupFullyVisible,
}) {
  return (
    <>
      <div className={styles.sectionLabel}>
        Place Types
        <button
          type="button"
          className={styles.resetBtn}
          title="Show all place types"
          onClick={resetAll}
        >
          RESET
        </button>
      </div>

      <div>
        {GROUP_META.map((group) => {
          const rows = GROUP_ROWS[group.key];
          const groupOff = !isGroupFullyVisible(group.key);
          return (
            <div
              key={group.key}
              className={`${styles.group} ${groupOff ? styles.groupOff : ''}`}
            >
              <div className={styles.groupHeader}>
                <span className={styles.groupSwatch} style={{ background: group.swatch }} />
                <span className={styles.groupName}>{group.name}</span>
                <span className={styles.groupCount}>{groupCounts[group.key] || ''}</span>
                {/* Chevron intentionally not rendered: legacy's later CSS
                    (style.css ~4559-4562, ~4627-4634) sets
                    .ptf-group-chevron{display:none!important} — groups
                    are always-expanded cards in the current UI, the
                    collapse affordance is fully dead. */}
              </div>
              <div className={styles.groupBody}>
                {rows.map(([type, name, swatch]) => {
                  const visible = typeVisible[type] !== false;
                  return (
                    <div
                      key={type}
                      className={`${styles.typeRow} ${!visible ? styles.typeOff : ''}`}
                      onClick={() => setTypeVisible(type, !visible)}
                    >
                      <span className={styles.pin} style={{ background: swatch }} />
                      <span className={styles.typeName}>{name}</span>
                      <span className={styles.typeCount}>{typeCounts[type] || ''}</span>
                      <input
                        type="checkbox"
                        className={styles.typeCb}
                        checked={visible}
                        onChange={(e) => setTypeVisible(type, e.target.checked)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
