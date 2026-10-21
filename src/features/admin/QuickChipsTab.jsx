import { useMemo, useState } from 'react';
import { X, MapPin, ChevronRight, Search } from 'lucide-react';
import { LEGACY_ICON_MAP } from '../../lib/legacyIconMap';
import styles from './AdminPanel.module.css';
import chipStyles from './QuickChipsTab.module.css';
import {
  nameOrTypeMatches,
  CHIP_GROUPS,
  PICKABLE_CHIP_GROUPS,
  chipGroupOf,
  chipIconKey,
} from '../shared/placeCategories';
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
 *
 * Oct 2026 revamp: every chip belongs to a category (CHIP_GROUPS in
 * shared/placeCategories.js) — the heading it's listed under in the
 * map's "All places" panel. A new chip must be given one, an existing
 * chip's can be changed from its expanded row, and the list below is
 * grouped the same way the panel is.
 */
export default function QuickChipsTab({ user, chips, waypoints, kmlAnnotations, onChipsChanged }) {
  const [expandedId, setExpandedId] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [newKeywords, setNewKeywords] = useState('');
  const [newPinned, setNewPinned] = useState([]); // [{id, name}]
  const [pinSearch, setPinSearch] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');

  const list = useMemo(() => chips || [], [chips]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((c) =>
      [c.label, c.shortLabel, ...(c.keywords || [])].some((s) => s && s.toLowerCase().includes(q))
    );
  }, [list, search]);

  const grouped = useMemo(
    () =>
      CHIP_GROUPS.map((g) => ({ ...g, chips: filtered.filter((c) => chipGroupOf(c) === g.key) })).filter(
        (g) => g.chips.length
      ),
    [filtered]
  );

  // Chips pinned to the map's top bar, in bar order — for the "position N"
  // hint, and so a newly pinned chip goes on the end.
  const barChips = useMemo(
    () => list.filter((c) => c.barOrder != null).sort((a, b) => a.barOrder - b.barOrder),
    [list]
  );
  const barChipIds = barChips.map((c) => c.id);
  const nextBarOrder = barChips.length ? barChips[barChips.length - 1].barOrder + 1 : 0;

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
    if (!user) {
      setError('You must be signed in to create a chip.');
      return;
    }
    const keywords = splitKeywords(newKeywords);
    if (!newLabel.trim() || (!keywords.length && !newPinned.length)) {
      setError('Give the chip a name, and either a keyword or at least one hand-picked place.');
      return;
    }
    if (!newCategory) {
      setError('Pick the category this chip goes under.');
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
        category: newCategory,
      });
      setNewLabel('');
      setNewCategory('');
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
    if (!user) {
      setError('You must be signed in to delete a chip.');
      return;
    }
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
        <div className={styles.countBadge}>
          <span className={styles.countBadgeDot} />
          {filtered.length} <span className={styles.countBadgeMuted}>of {list.length} chips</span>
        </div>
        <div className={styles.searchWrap}>
          <span className={styles.searchIcon}>
            <Search size={16} />
          </span>
          <input
            className={styles.searchInput}
            placeholder="Search chips or keywords…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button type="button" className={styles.addBtn} onClick={() => setShowAddForm((v) => !v)}>
          {showAddForm ? 'Cancel' : '+ Add Chip'}
        </button>
      </div>

      {!showAddForm && error && (
        <div className={`${styles.saveStatus} ${styles.saveStatusError} ${chipStyles.tabError}`}>{error}</div>
      )}

      {/* One scroll area for every category. Each group is a header row
          (name + count) followed by its chips, in All places order. */}
      <div className={styles.list}>
        {showAddForm && (
          <div className={`${styles.inlineForm} ${chipStyles.addForm}`}>
            <div className={styles.formTitle}>New chip</div>
            <div className={styles.fieldGroup}>
              <label>Name</label>
              <input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="e.g. Barber Shops" />
            </div>

            <div className={styles.fieldGroup}>
              <label>Category (the heading it's listed under in All places)</label>
              <select value={newCategory} onChange={(e) => setNewCategory(e.target.value)}>
                <option value="" disabled>
                  Choose a category…
                </option>
                {PICKABLE_CHIP_GROUPS.map((g) => (
                  <option key={g.key} value={g.key}>
                    {g.label}
                  </option>
                ))}
              </select>
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
                placeholder="Search places to add…"
                value={pinSearch}
                onChange={(e) => setPinSearch(e.target.value)}
              />
              {pinSearchResults.map((wp) => (
                <div key={wp.id} className={chipStyles.placeRow}>
                  <span className={chipStyles.placeName}>
                    <span className={chipStyles.placeText}>{wp.name}</span>
                    {wp.source === 'kml' && <span className={chipStyles.tag}>kml</span>}
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
                <div className={chipStyles.keywordPills}>
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

        {!list.length && <div className={styles.empty}>No chips yet — add one above.</div>}
        {!!list.length && !filtered.length && <div className={styles.empty}>No chips match "{search}".</div>}

        {grouped.map((group) => (
          <section key={group.key} className={chipStyles.group}>
            <div className={chipStyles.groupHeader}>
              <span className={chipStyles.groupLabel}>{group.label}</span>
              <span className={chipStyles.groupCount}>{group.chips.length}</span>
            </div>
            {group.chips.map((chip) => (
              <ChipRow
                key={chip.id}
                user={user}
                chip={chip}
                places={allPlaces}
                expanded={expandedId === chip.id}
                onToggleExpand={() => setExpandedId((id) => (id === chip.id ? null : chip.id))}
                onDelete={() => handleDelete(chip)}
                busy={busyId === chip.id}
                onChanged={onChipsChanged}
                barChipIds={barChipIds}
                nextBarOrder={nextBarOrder}
              />
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}

function ChipRow({ user, chip, places, expanded, onToggleExpand, onDelete, busy, onChanged, barChipIds, nextBarOrder }) {
  const [shortLabel, setShortLabel] = useState(chip.shortLabel || '');
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
    if (!user) {
      setRowError('You must be signed in to edit keywords.');
      return;
    }
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

  const inBar = chip.barOrder != null;
  const barPosition = inBar ? barChipIds.indexOf(chip.id) + 1 : null;
  const ChipIcon = LEGACY_ICON_MAP[chipIconKey(chip)] || MapPin;

  async function saveBar(patch) {
    if (!user) {
      setRowError('You must be signed in to change the top bar.');
      return;
    }
    setRowBusy('bar');
    setRowError('');
    try {
      await updateChip(chip.id, patch);
      await onChanged?.();
    } catch (e) {
      setRowError(describeError(e));
    } finally {
      setRowBusy(null);
    }
  }

  async function saveCategory(category) {
    if (!user) {
      setRowError('You must be signed in to change a category.');
      return;
    }
    setRowBusy('category');
    setRowError('');
    try {
      await updateChip(chip.id, { category });
      await onChanged?.();
    } catch (e) {
      setRowError(describeError(e));
    } finally {
      setRowBusy(null);
    }
  }

  async function excludePlace(wpId) {
    if (!user) {
      setRowError('You must be signed in to modify chips.');
      return;
    }
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
    if (!user) {
      setRowError('You must be signed in to modify chips.');
      return;
    }
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
    if (!user) {
      setRowError('You must be signed in to modify chips.');
      return;
    }
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
    <div className={`${chipStyles.row} ${expanded ? chipStyles.rowExpanded : ''}`}>
      <div className={styles.item} onClick={onToggleExpand}>
        <div className={styles.itemIcon}>
          <ChipIcon size={16} />
        </div>
        <div className={styles.itemBody}>
          <div className={chipStyles.nameRow}>
            <span className={styles.itemName}>{chip.label}</span>
            {inBar && <span className={chipStyles.barTag}>Top bar {barPosition}</span>}
          </div>
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
            <div className={chipStyles.detailLabel}>Category</div>
            <div className={styles.fieldGroup}>
              <select
                value={chipGroupOf(chip)}
                disabled={rowBusy === 'category'}
                onChange={(e) => saveCategory(e.target.value)}
              >
                {chipGroupOf(chip) === 'other' && (
                  <option value="other" disabled>
                    Choose a category…
                  </option>
                )}
                {PICKABLE_CHIP_GROUPS.map((g) => (
                  <option key={g.key} value={g.key}>
                    {g.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className={chipStyles.detailSection}>
            <div className={chipStyles.detailLabel}>Top chip bar</div>
            <label className={chipStyles.checkRow}>
              <input
                type="checkbox"
                checked={inBar}
                disabled={rowBusy === 'bar'}
                onChange={(e) => saveBar({ barOrder: e.target.checked ? nextBarOrder : null })}
              />
              Show in the top bar {inBar ? `(position ${barPosition})` : '(otherwise only in All places)'}
            </label>
            {inBar && (
              <div className={chipStyles.editRow}>
                <input
                  className={chipStyles.input}
                  value={shortLabel}
                  onChange={(e) => setShortLabel(e.target.value)}
                  placeholder={`Shorter name for the bar (optional) — e.g. "${chip.label.split(/[ &/]/)[0]}"`}
                />
                <button
                  type="button"
                  className={styles.formSave}
                  disabled={rowBusy === 'bar' || shortLabel === (chip.shortLabel || '')}
                  onClick={() => saveBar({ shortLabel })}
                >
                  {rowBusy === 'bar' ? '…' : 'Save'}
                </button>
              </div>
            )}
          </div>

          <div className={chipStyles.detailSection}>
            <div className={chipStyles.detailLabel}>Keywords</div>
            {editingKeywords ? (
              <div className={chipStyles.editRow}>
                <input
                  className={chipStyles.input}
                  value={keywordsText}
                  onChange={(e) => setKeywordsText(e.target.value)}
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
                <button type="button" className={styles.formCancel} onClick={() => setEditingKeywords(true)}>
                  Edit
                </button>
              </div>
            )}
          </div>

          <div className={chipStyles.detailSection}>
            <div className={chipStyles.detailLabel}>Places in this chip ({matched.length})</div>
            {!matched.length ? (
              <div className={chipStyles.emptySmall}>Nothing matches yet.</div>
            ) : (
              <div className={chipStyles.placeList}>
                {matched.map((wp) => (
                  <div key={wp.id} className={chipStyles.placeRow}>
                    <span className={chipStyles.placeName}>
                      <span className={chipStyles.placeText}>{wp.name}</span>
                      {pinnedIds.has(wp.id) && <span className={`${chipStyles.tag} ${chipStyles.tagPinned}`}>pinned</span>}
                      {wp.source === 'kml' && <span className={chipStyles.tag}>kml</span>}
                    </span>
                    <button
                      type="button"
                      className={chipStyles.removeBtn}
                      title="Remove from this chip"
                      aria-label={`Remove ${wp.name} from this chip`}
                      disabled={rowBusy === wp.id}
                      onClick={() => excludePlace(wp.id)}
                    >
                      {rowBusy === wp.id ? '…' : <X size={12} />}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className={chipStyles.detailSection}>
            <div className={chipStyles.detailLabel}>Add a place by name (even if no keyword matches it)</div>
            <input
              className={chipStyles.input}
              placeholder="Search places to add…"
              value={pinQuery}
              onChange={(e) => setPinQuery(e.target.value)}
            />
            {pinCandidates.map((wp) => (
              <div key={wp.id} className={chipStyles.placeRow}>
                <span className={chipStyles.placeName}>
                  <span className={chipStyles.placeText}>{wp.name}</span>
                  {wp.source === 'kml' && <span className={chipStyles.tag}>kml</span>}
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
                    <span className={chipStyles.placeName}>
                      <span className={chipStyles.placeText}>{wp.name}</span>
                    </span>
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

          <div className={`${chipStyles.detailSection} ${chipStyles.detailFooter}`}>
            <button type="button" className={chipStyles.deleteChipBtn} disabled={busy} onClick={onDelete}>
              {busy ? 'Removing…' : 'Remove this chip'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
