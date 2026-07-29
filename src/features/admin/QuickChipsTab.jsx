import { useMemo, useState } from 'react';
import { X, MapPin, ChevronRight } from 'lucide-react';
import { LEGACY_ICON_MAP } from '../../lib/legacyIconMap';
import styles from './AdminPanel.module.css';
import chipStyles from './QuickChipsTab.module.css';
import { nameOrTypeMatches } from '../shared/placeCategories';
import {
  createChip,
  updateChip,
  deleteChip,
  togglePinned,
  toggleExcluded,
  splitKeywords,
  joinKeywords,
  describeError,
} from './quickChipsApi';

/**
 * Admin "Chips" tab — built minimal-on-purpose per the person's ask
 * ("designed with minimalism in mind and functionality"):
 *
 *   - Add a chip by keyword: type a name + keywords (comma separated),
 *     Save. Every place whose name OR type contains one of those
 *     keywords shows up under it automatically.
 *   - Add a chip by hand-picking places: search for a waypoint by name
 *     and add it directly, with no keyword at all. This is the escape
 *     hatch for keyword clashes — if two categories would both want to
 *     claim "shop" or "spot", skip the keyword for the one that should
 *     stay curated and just pin its places by name instead.
 *   - Both at once, always: every chip has a `keywords` list AND a
 *     `pinnedIds` list — a place shows up if it matches either. Same
 *     rule while editing an existing chip.
 *   - Each chip shows its live matched-place count; expanding it lists
 *     every matched place with a one-click ✕ to exclude one that
 *     doesn't belong (stays excluded even if a keyword still technically
 *     matches it), plus a name search to pin more.
 *   - Any chip — including the 16 built-in defaults — can be deleted.
 *
 * All writes go through `quickChipsApi.js` (Supabase `quick_chips`
 * table); every successful write calls `onChipsChanged()` so MapPage's
 * `useQuickChips()` refetches and the live chip bar / results panel pick
 * up the change immediately.
 *
 * Every write below is wrapped in try/catch with an inline error message
 * — a fetch to a brand-new table can legitimately fail (table not
 * created yet, a privacy extension blocking the request, the project
 * being paused) and silently doing nothing on failure looked like a
 * bug. See `describeError()` in quickChipsApi.js for what these messages
 * mean.
 *
 * Search/pin covers BOTH place sources, not just the Supabase
 * `waypoints` table: `kmlAnnotations` (the campus's own hand-drawn KML
 * files, rendered by StaticKmlLayer) are a second, separate dataset —
 * previously invisible here, so searching for one of "our own" KML
 * points to pin turned up nothing while imported waypoints (which trace
 * back to an OSM import) did. Both are merged into `allPlaces` below,
 * each tagged with `source` so the UI can show which is which.
 */
export default function QuickChipsTab({ chips, waypoints, kmlAnnotations, onChipsChanged }) {
  const [expandedId, setExpandedId] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newKeywords, setNewKeywords] = useState('');
  const [newPinned, setNewPinned] = useState([]); // [{id, name}]
  const [pinSearch, setPinSearch] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');

  const list = chips || [];

  const allPlaces = useMemo(
    () => [
      ...(waypoints || []).map((wp) => ({ ...wp, source: wp.source || 'waypoint' })),
      ...(kmlAnnotations || []).map((a) => ({ ...a, source: 'kml' })),
    ],
    [waypoints, kmlAnnotations]
  );

  const pinSearchResults = useMemo(() => {
    const q = pinSearch.trim().toLowerCase();
    if (q.length < 2) return [];
    const already = new Set(newPinned.map((p) => p.id));
    return allPlaces
      .filter((wp) => !already.has(wp.id) && (wp.name || '').toLowerCase().includes(q))
      .slice(0, 6);
  }, [pinSearch, allPlaces, newPinned]);

  async function handleCreate() {
    const keywords = splitKeywords(newKeywords);
    if (!newLabel.trim() || (!keywords.length && !newPinned.length)) {
      setError('Give the chip a name, and either a keyword or at least one hand-picked place.');
      return;
    }
    setError('');
    setBusyId('__new__');
    try {
      await createChip({
        label: newLabel,
        keywordsText: newKeywords,
        pinnedIds: newPinned.map((p) => p.id),
        sortOrder: list.length,
      });
      setNewLabel('');
      setNewKeywords('');
      setNewPinned([]);
      setPinSearch('');
      setShowAddForm(false);
      await onChipsChanged?.();
    } catch (e) {
      setError(describeError(e));
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(chip) {
    if (!window.confirm(`Remove the "${chip.label}" chip? This cannot be undone.`)) return;
    setBusyId(chip.id);
    setError('');
    try {
      await deleteChip(chip.id);
      if (expandedId === chip.id) setExpandedId(null);
      await onChipsChanged?.();
    } catch (e) {
      setError(describeError(e));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className={styles.tabContent}>
      <div className={styles.toolbar}>
        <span className={styles.countBadge}>{list.length} of {list.length} chips</span>
        <input className={styles.searchInput} placeholder="Search chips…" disabled style={{ visibility: 'hidden' }} />
        <button type="button" className={styles.addBtn} onClick={() => setShowAddForm((v) => !v)}>
          {showAddForm ? 'Cancel' : '+ Add Chip'}
        </button>
      </div>

      {showAddForm && (
        <div className={styles.inlineForm}>
          <div className={styles.formTitle}>New chip</div>
          <div className={styles.fieldGroup}>
            <label>Name</label>
            <input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="e.g. Barber Shops" />
          </div>

          <div className={styles.fieldGroup}>
            <label>Keywords (optional — matched against every place's name or tag)</label>
            <input
              value={newKeywords}
              onChange={(e) => setNewKeywords(e.target.value)}
              placeholder="e.g. barber, barbing salon"
            />
          </div>

          <div className={styles.fieldGroup}>
            <label>Or pick specific places by name (skip this if a keyword above already clashes with another chip)</label>
            <input
              className={styles.searchInput}
              placeholder="Search places to add…"
              value={pinSearch}
              onChange={(e) => setPinSearch(e.target.value)}
            />
            {pinSearchResults.map((wp) => (
              <div key={wp.id} className={chipStyles.placeRow}>
                <span className={chipStyles.placeName}>
                  {wp.name}
                  {wp.source === 'kml' && <span className={chipStyles.pinnedTag}>kml</span>}
                </span>
                <button
                  type="button"
                  className={styles.formCancel}
                  onClick={() => {
                    setNewPinned((prev) => [...prev, { id: wp.id, name: wp.name }]);
                    setPinSearch('');
                  }}
                >
                  + Add
                </button>
              </div>
            ))}
            {!!newPinned.length && (
              <div className={chipStyles.keywordPills} style={{ marginTop: 4 }}>
                {newPinned.map((p) => (
                  <span key={p.id} className={chipStyles.pill}>
                    {p.name}
                    <button
                      type="button"
                      className={chipStyles.pillRemove}
                      onClick={() => setNewPinned((prev) => prev.filter((x) => x.id !== p.id))}
                    >
                      <X size={11} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {error && <div className={`${styles.saveStatus} ${styles.saveStatusError}`}>{error}</div>}
          <div className={styles.formActions}>
            <button type="button" className={styles.formSave} disabled={busyId === '__new__'} onClick={handleCreate}>
              {busyId === '__new__' ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </div>
      )}

      {!showAddForm && error && <div className={`${styles.saveStatus} ${styles.saveStatusError}`}>{error}</div>}

      {!list.length && <div className={styles.empty}>No chips yet — add one above.</div>}

      <div className={styles.list}>
        {list.map((chip) => (
          <ChipRow
            key={chip.id}
            chip={chip}
            places={allPlaces}
            expanded={expandedId === chip.id}
            onToggleExpand={() => setExpandedId((id) => (id === chip.id ? null : chip.id))}
            onDelete={() => handleDelete(chip)}
            busy={busyId === chip.id}
            onChanged={onChipsChanged}
          />
        ))}
      </div>
    </div>
  );
}

function ChipRow({ chip, places, expanded, onToggleExpand, onDelete, busy, onChanged }) {
  const [editingKeywords, setEditingKeywords] = useState(false);
  const [keywordsText, setKeywordsText] = useState(joinKeywords(chip.keywords));
  const [pinQuery, setPinQuery] = useState('');
  const [savingKeywords, setSavingKeywords] = useState(false);
  const [rowBusy, setRowBusy] = useState(null); // wpId currently being toggled, or 'keywords'
  const [rowError, setRowError] = useState('');

  const pinnedIds = useMemo(() => new Set(chip.pinnedIds || []), [chip.pinnedIds]);
  const excludedIds = useMemo(() => new Set(chip.excludedIds || []), [chip.excludedIds]);

  const matched = useMemo(() => {
    return (places || []).filter((wp) => {
      if (excludedIds.has(wp.id)) return false;
      return pinnedIds.has(wp.id) || nameOrTypeMatches(wp.name, wp.type, chip.keywords);
    });
  }, [places, chip.keywords, pinnedIds, excludedIds]);

  const pinCandidates = useMemo(() => {
    const q = pinQuery.trim().toLowerCase();
    if (q.length < 2) return [];
    const already = new Set(matched.map((wp) => wp.id));
    return (places || [])
      .filter((wp) => !already.has(wp.id) && (wp.name || '').toLowerCase().includes(q))
      .slice(0, 6);
  }, [pinQuery, places, matched]);

  async function saveKeywords() {
    setSavingKeywords(true);
    setRowError('');
    try {
      await updateChip(chip.id, { keywordsText });
      setEditingKeywords(false);
      await onChanged?.();
    } catch (e) {
      setRowError(describeError(e));
    } finally {
      setSavingKeywords(false);
    }
  }

  async function excludePlace(wpId) {
    setRowBusy(wpId);
    setRowError('');
    try {
      await toggleExcluded(chip, wpId, true);
      await onChanged?.();
    } catch (e) {
      setRowError(describeError(e));
    } finally {
      setRowBusy(null);
    }
  }

  async function restorePlace(wpId) {
    setRowBusy(wpId);
    setRowError('');
    try {
      await toggleExcluded(chip, wpId, false);
      await onChanged?.();
    } catch (e) {
      setRowError(describeError(e));
    } finally {
      setRowBusy(null);
    }
  }

  async function pinPlace(wpId) {
    setRowBusy(wpId);
    setRowError('');
    try {
      await togglePinned(chip, wpId, true);
      setPinQuery('');
      await onChanged?.();
    } catch (e) {
      setRowError(describeError(e));
    } finally {
      setRowBusy(null);
    }
  }

  return (
    <div className={chipStyles.row}>
      <div className={styles.item} onClick={onToggleExpand} style={{ cursor: 'pointer' }}>
        <div className={styles.itemIcon}>
          {(() => {
            const Icon = LEGACY_ICON_MAP[chip.iconKey] || MapPin;
            return <Icon size={16} />;
          })()}
        </div>
        <div className={styles.itemBody}>
          <div className={styles.itemName}>{chip.label}</div>
          <div className={styles.itemMeta}>{joinKeywords(chip.keywords) || 'no keywords — hand-picked only'}</div>
        </div>
        <span className={chipStyles.matchCount}>{matched.length} places</span>
        <span className={styles.itemChevron} style={{ transform: expanded ? 'rotate(90deg)' : undefined }}>
          <ChevronRight size={14} />
        </span>
      </div>

      {expanded && (
        <div className={chipStyles.detail}>
          {rowError && <div className={`${styles.saveStatus} ${styles.saveStatusError}`}>{rowError}</div>}

          <div className={chipStyles.detailSection}>
            <div className={chipStyles.detailLabel}>Keywords</div>
            {editingKeywords ? (
              <div className={chipStyles.editRow}>
                <input
                  className={styles.searchInput}
                  value={keywordsText}
                  onChange={(e) => setKeywordsText(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  placeholder="leave blank for a hand-picked-only chip"
                />
                <button type="button" className={styles.formSave} disabled={savingKeywords} onClick={saveKeywords}>
                  {savingKeywords ? '…' : 'Save'}
                </button>
              </div>
            ) : (
              <div className={chipStyles.editRow}>
                <div className={chipStyles.keywordPills}>
                  {(chip.keywords || []).length ? (
                    chip.keywords.map((kw) => (
                      <span key={kw} className={chipStyles.pill}>
                        {kw}
                      </span>
                    ))
                  ) : (
                    <span className={chipStyles.emptySmall}>none — this chip is hand-picked places only</span>
                  )}
                </div>
                <button
                  type="button"
                  className={styles.formCancel}
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingKeywords(true);
                  }}
                >
                  Edit
                </button>
              </div>
            )}
          </div>

          <div className={chipStyles.detailSection}>
            <div className={chipStyles.detailLabel}>Places in this chip ({matched.length})</div>
            {!matched.length && <div className={chipStyles.emptySmall}>Nothing matches yet.</div>}
            {matched.map((wp) => (
              <div key={wp.id} className={chipStyles.placeRow}>
                <span className={chipStyles.placeName}>
                  {wp.name}
                  {pinnedIds.has(wp.id) && <span className={chipStyles.pinnedTag}>pinned</span>}
                  {wp.source === 'kml' && <span className={chipStyles.pinnedTag}>kml</span>}
                </span>
                <button
                  type="button"
                  className={chipStyles.removeBtn}
                  title="Remove from this chip"
                  disabled={rowBusy === wp.id}
                  onClick={() => excludePlace(wp.id)}
                >
                  {rowBusy === wp.id ? '…' : <X size={12} />}
                </button>
              </div>
            ))}
          </div>

          <div className={chipStyles.detailSection}>
            <div className={chipStyles.detailLabel}>Add a place by name (even if no keyword matches it)</div>
            <input
              className={styles.searchInput}
              placeholder="Search places to add…"
              value={pinQuery}
              onChange={(e) => setPinQuery(e.target.value)}
              onClick={(e) => e.stopPropagation()}
            />
            {pinCandidates.map((wp) => (
              <div key={wp.id} className={chipStyles.placeRow}>
                <span className={chipStyles.placeName}>
                  {wp.name}
                  {wp.source === 'kml' && <span className={chipStyles.pinnedTag}>kml</span>}
                </span>
                <button
                  type="button"
                  className={styles.formCancel}
                  disabled={rowBusy === wp.id}
                  onClick={() => pinPlace(wp.id)}
                >
                  {rowBusy === wp.id ? '…' : '+ Add'}
                </button>
              </div>
            ))}
          </div>

          {!!(chip.excludedIds || []).length && (
            <div className={chipStyles.detailSection}>
              <div className={chipStyles.detailLabel}>Excluded ({chip.excludedIds.length})</div>
              {(chip.excludedIds || []).map((id) => {
                const wp = (places || []).find((w) => w.id === id);
                if (!wp) return null;
                return (
                  <div key={id} className={chipStyles.placeRow}>
                    <span className={chipStyles.placeName}>{wp.name}</span>
                    <button
                      type="button"
                      className={styles.formCancel}
                      disabled={rowBusy === id}
                      onClick={() => restorePlace(id)}
                    >
                      {rowBusy === id ? '…' : 'Restore'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          <div className={chipStyles.detailSection}>
            <button type="button" className={chipStyles.deleteChipBtn} disabled={busy} onClick={onDelete}>
              {busy ? 'Removing…' : 'Remove this chip'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
