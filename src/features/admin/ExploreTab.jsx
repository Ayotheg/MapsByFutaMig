import { useMemo, useState } from 'react';
import { Star, MapPin, X } from 'lucide-react';
import styles from './AdminPanel.module.css';
import exploreStyles from './ExploreTab.module.css';
import { createExplorePick, updateExplorePick, deleteExplorePick, describeError } from './explorePicksApi';

/**
 * Admin "Explore" tab — built to the person's exact spec: no new images
 * or data are ever entered here. An admin searches for a place *by name*
 * (the same `waypoints` list every other admin tab already has, pulled
 * from the map) and adds it to the Explore rotation; the panel that
 * students see (src/features/explore/) then pulls that waypoint's real
 * name/type/photo/rating live, the same way ChipResultRow etc. already
 * do — this tab only stores curation metadata (tags, promoted/sponsor,
 * priority) referencing that waypoint by id.
 *
 * Mirrors QuickChipsTab.jsx's shape (search-to-add, inline edit, no
 * confirmation-heavy UI) since it's the closest existing precedent for
 * "a lightweight curation layer over the waypoints table admins already
 * know how to search."
 */
export default function ExploreTab({ user, waypoints, explorePicks, onExplorePicksChanged }) {
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');

  const list = explorePicks || [];
  const waypointById = useMemo(() => {
    const map = new Map();
    for (const wp of waypoints || []) map.set(wp.id, wp);
    return map;
  }, [waypoints]);

  const pickedIds = useMemo(() => new Set(list.map((p) => p.waypointId)), [list]);

  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (q.length < 2) return [];
    return (waypoints || [])
      .filter((wp) => !pickedIds.has(wp.id) && (wp.name || '').toLowerCase().includes(q))
      .slice(0, 6);
  }, [search, waypoints, pickedIds]);

  async function handleAdd(waypoint) {
    if (!user) {
      setError('You must be signed in to add a place to Explore.');
      return;
    }
    setBusyId('__new__');
    setError('');
    try {
      await createExplorePick({ waypointId: waypoint.id, sortOrder: list.length });
      setSearch('');
      await onExplorePicksChanged?.();
    } catch (e) {
      setError(describeError(e));
    } finally {
      setBusyId(null);
    }
  }

  async function handleRemove(pick) {
    if (!user) {
      setError('You must be signed in to edit Explore.');
      return;
    }
    const wp = waypointById.get(pick.waypointId);
    if (!window.confirm(`Remove "${wp?.name || 'this place'}" from Explore? This cannot be undone.`)) return;
    setBusyId(pick.id);
    setError('');
    try {
      await deleteExplorePick(pick.id);
      await onExplorePicksChanged?.();
    } catch (e) {
      setError(describeError(e));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className={styles.tabContent}>
      <div className={styles.toolbar}>
        <span className={styles.countBadge}>{list.length} in rotation</span>
        <input
          className={styles.searchInput}
          placeholder="Search places by name to add…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {!!searchResults.length && (
        <div className={exploreStyles.searchResults}>
          {searchResults.map((wp) => (
            <div key={wp.id} className={exploreStyles.searchRow}>
              <span className={exploreStyles.searchName}>
                <MapPin size={12} /> {wp.name}
                <span className={exploreStyles.searchType}>{(wp.type || '').replace(/_/g, ' ')}</span>
              </span>
              <button
                type="button"
                className={styles.formCancel}
                disabled={busyId === '__new__'}
                onClick={() => handleAdd(wp)}
              >
                {busyId === '__new__' ? '…' : '+ Add'}
              </button>
            </div>
          ))}
        </div>
      )}

      {error && <div className={`${styles.saveStatus} ${styles.saveStatusError}`}>{error}</div>}

      {!list.length && (
        <div className={styles.empty}>
          Nothing curated yet — search above to add a place. Until you add any, students see an
          auto-picked list of top-rated places instead, so Explore is never empty.
        </div>
      )}

      <div className={styles.list}>
        {list.map((pick) => (
          <ExplorePickRow
            key={pick.id}
            user={user}
            pick={pick}
            waypoint={waypointById.get(pick.waypointId)}
            busy={busyId === pick.id}
            onRemove={() => handleRemove(pick)}
            onChanged={onExplorePicksChanged}
            setError={setError}
          />
        ))}
      </div>
    </div>
  );
}

function ExplorePickRow({ user, pick, waypoint, busy, onRemove, onChanged, setError }) {
  const [expanded, setExpanded] = useState(false);
  const [tagsText, setTagsText] = useState((pick.tags || []).join(', '));
  const [isPromoted, setIsPromoted] = useState(pick.isPromoted);
  const [sponsorName, setSponsorName] = useState(pick.sponsorName || '');
  const [promoLabel, setPromoLabel] = useState(pick.promoLabel || 'Promoted');
  const [priority, setPriority] = useState(pick.priority ?? 0);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!user) {
      setError('You must be signed in to edit Explore.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await updateExplorePick(pick.id, {
        tags: tagsText.split(',').map((s) => s.trim()).filter(Boolean),
        isPromoted,
        sponsorName,
        promoLabel,
        priority: Number(priority) || 0,
      });
      setExpanded(false);
      await onChanged?.();
    } catch (e) {
      setError(e?.message || 'Failed to save.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={exploreStyles.row}>
      <div className={styles.item} onClick={() => setExpanded((v) => !v)} style={{ cursor: 'pointer' }}>
        <div className={styles.itemIcon}>
          <MapPin size={16} />
        </div>
        <div className={styles.itemBody}>
          <div className={styles.itemName}>
            {waypoint?.name || '(deleted waypoint)'}
            {pick.isPromoted && <span className={exploreStyles.promotedTag}><Star size={9} /> {pick.promoLabel}</span>}
          </div>
          <div className={styles.itemMeta}>
            {(pick.tags || []).length ? pick.tags.join(' · ') : 'no tags'} · priority {pick.priority}
          </div>
        </div>
        <button
          type="button"
          className={exploreStyles.removeBtn}
          title="Remove from Explore"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          disabled={busy}
        >
          {busy ? '…' : <X size={13} />}
        </button>
      </div>

      {expanded && (
        <div className={exploreStyles.detail}>
          <div className={styles.fieldGroup}>
            <label>Tags shown on the card (comma separated)</label>
            <input value={tagsText} onChange={(e) => setTagsText(e.target.value)} placeholder="e.g. Quick bite, Open late" />
          </div>

          <div className={exploreStyles.promoRow}>
            <label className={exploreStyles.checkboxLabel}>
              <input type="checkbox" checked={isPromoted} onChange={(e) => setIsPromoted(e.target.checked)} />
              Promoted (shows an ad badge, pinned first in the rotation)
            </label>
          </div>

          {isPromoted && (
            <>
              <div className={styles.fieldGroup}>
                <label>Sponsor name</label>
                <input value={sponsorName} onChange={(e) => setSponsorName(e.target.value)} placeholder="e.g. Chicken Republic" />
              </div>
              <div className={styles.fieldGroup}>
                <label>Badge label</label>
                <input value={promoLabel} onChange={(e) => setPromoLabel(e.target.value)} placeholder="Promoted / Ad / Sponsored" />
              </div>
            </>
          )}

          <div className={styles.fieldGroup}>
            <label>Priority (higher shows first / more often)</label>
            <input type="number" value={priority} onChange={(e) => setPriority(e.target.value)} />
          </div>

          <div className={styles.formActions}>
            <button type="button" className={styles.formSave} disabled={saving} onClick={save}>
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
