import { useEffect, useState } from 'react';
import { Target, CheckCircle2, Camera, ChevronRight, Search, User, Rss } from 'lucide-react';
import styles from './AdminPanel.module.css';
import { resolveWaypointType } from '../waypoints/wpTypeMeta';
import { WP_ALL_TYPES } from './adminTypeOptions';
import { badgeStyleFor } from './adminBadgeColors';
import { insertWaypoint } from './adminSave';
import { getTypeIcon } from '../../lib/typeIcons';
import { track } from '../../lib/analytics';

/**
 * Legacy: `renderWaypointList` (app.js ~3743–3771) + the "Add Point" inline
 * form + `_startPickingCoord`/`_stopPickingCoord`/`adminAddPointSave`
 * (app.js ~3368–3459). The map-click coordinate picker itself lives one
 * level up in `AdminPanel.jsx` (it needs to hide the whole overlay and
 * touch the Leaflet `map` instance directly, not just this tab).
 */
export default function PointsTab({ waypoints, onEditWaypoint, onAddPerson, onAddChannel, pickingCoord, onStartPicking, pickedCoord, onCoordConsumed, onWaypointsChanged }) {
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  // PLACES / PEOPLE / CHANNELS pill (supabase/people_entries.sql,
  // supabase/channel_entries.sql) — same waypoints list, filtered by
  // `isPerson`/`isChannel`. "Add Point" becomes "Add Person"/"Add
  // Channel" (both skip coordinates) while that pill is active — both
  // open the full AdminEditModal (via onAddPerson/onAddChannel) rather
  // than this tab's own inline mini-form, same as People already does.
  const [category, setCategory] = useState('places');
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [type, setType] = useState('lecture_hall');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [status, setStatus] = useState(null);
  const [saving, setSaving] = useState(false);

  const isPeopleMode = category === 'people';
  const isChannelMode = category === 'channels';

  useEffect(() => {
    if (pickedCoord) {
      setLat(pickedCoord.lat.toFixed(6));
      setLng(pickedCoord.lng.toFixed(6));
      setFormOpen(true);
      onCoordConsumed();
    }
  }, [pickedCoord, onCoordConsumed]);

  const categorized = waypoints.filter((wp) =>
    isPeopleMode ? wp.isPerson : isChannelMode ? wp.isChannel : !wp.isPerson && !wp.isChannel
  );
  const filter = search.toLowerCase();
  const filtered = categorized.filter(
    (wp) => !filter || wp.name?.toLowerCase().includes(filter) || wp.description?.toLowerCase().includes(filter)
  );

  function switchCategory(next) {
    setCategory(next);
    setFormOpen(false);
    setStatus(null);
  }

  async function handleSave() {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setStatus({ text: 'Name is required.', error: true });
      return;
    }
    let latNum = null;
    let lngNum = null;
    if (!isPeopleMode) {
      latNum = parseFloat(lat);
      lngNum = parseFloat(lng);
      if (Number.isNaN(latNum) || Number.isNaN(lngNum)) {
        setStatus({ text: 'Valid coordinates required.', error: true });
        return;
      }
    }
    setSaving(true);
    setStatus(null);
    try {
      await insertWaypoint({
        name: trimmedName,
        description: desc.trim(),
        type,
        lat: latNum,
        lng: lngNum,
        isPerson: isPeopleMode,
      });
      setStatus({ text: isPeopleMode ? 'Person added successfully!' : 'Point added successfully!', error: false, icon: true });
      setName('');
      setDesc('');
      setLat('');
      setLng('');
      onWaypointsChanged?.();
      setTimeout(() => setFormOpen(false), 1500);
    } catch (e) {
      setStatus({ text: `Error: ${e.message}`, error: true });
      // Slice 14 instrumentation (ANALYTICS_BUILD_PLAN.md §9).
      track('error_occurred', { context: isPeopleMode ? 'admin_insert_person' : 'admin_insert_waypoint', message: e?.message || String(e) });
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    setFormOpen(false);
    setStatus(null);
  }

  return (
    <div className={styles.tabContent}>
      <div className={styles.toolbar} style={{ flexWrap: 'wrap' }}>
        <div className={styles.countBadge}>
          <span className={styles.countBadgeDot} />
          {filtered.length}{' '}
          <span className={styles.countBadgeMuted}>
            of {categorized.length} {isPeopleMode ? 'people' : isChannelMode ? 'channels' : 'waypoints'}
          </span>
        </div>
        <button
          type="button"
          className={styles.addBtn}
          style={{ marginLeft: 'auto' }}
          onClick={() => {
            if (isPeopleMode) {
              onAddPerson?.();
              return;
            }
            if (isChannelMode) {
              onAddChannel?.();
              return;
            }
            setFormOpen((v) => !v);
          }}
        >
          + {isPeopleMode ? 'Add Person' : isChannelMode ? 'Add Channel' : 'Add Point'}
        </button>
        <div className={styles.categoryPillRow} style={{ flexBasis: '100%' }}>
          <button
            type="button"
            className={`${styles.categoryPill} ${category === 'places' ? styles.categoryPillActive : ''}`}
            onClick={() => switchCategory('places')}
          >
            Places
          </button>
          <button
            type="button"
            className={`${styles.categoryPill} ${isPeopleMode ? styles.categoryPillActive : ''}`}
            onClick={() => switchCategory('people')}
          >
            People
          </button>
          <button
            type="button"
            className={`${styles.categoryPill} ${isChannelMode ? styles.categoryPillActive : ''}`}
            onClick={() => switchCategory('channels')}
          >
            Channels
          </button>
        </div>
        <div className={styles.searchWrap} style={{ flexBasis: '100%' }}>
          <span className={styles.searchIcon}>
            <Search size={16} />
          </span>
          <input
            type="text"
            className={styles.searchInput}
            placeholder={isPeopleMode ? 'Search people…' : isChannelMode ? 'Search channels…' : 'Search points, tags or coords…'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <span className={styles.searchKbd}>⌘K</span>
        </div>
      </div>

      {formOpen && (
        <div className={styles.inlineForm}>
          <div className={styles.formTitle}>{isPeopleMode ? 'New Person' : 'New Annotated Point'}</div>
          <div className={styles.fieldGroup}>
            <label>Name *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder={isPeopleMode ? 'e.g. Prof. Adebayo Ogundimu' : 'e.g. Engineering Block A'} />
          </div>
          <div className={styles.fieldGroup}>
            <label>Description</label>
            <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Short note (optional)" />
          </div>
          <div className={styles.fieldGroup}>
            <label>Type</label>
            <select value={type} onChange={(e) => setType(e.target.value)}>
              {WP_ALL_TYPES.map(([t, label]) => (
                <option key={t} value={t}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          {/* People entries (supabase/people_entries.sql) have no map
              location — coordinates are Places-only. */}
          {!isPeopleMode && (
            <>
              <div className={styles.fieldRow}>
                <div className={styles.fieldGroup}>
                  <label>Latitude *</label>
                  <input value={lat} onChange={(e) => setLat(e.target.value)} placeholder="e.g. 7.30124" type="number" step="any" />
                </div>
                <div className={styles.fieldGroup}>
                  <label>Longitude *</label>
                  <input value={lng} onChange={(e) => setLng(e.target.value)} placeholder="e.g. 5.13441" type="number" step="any" />
                </div>
              </div>
              <div className={styles.fieldGroup}>
                <label>Or click map to pick coords</label>
                <button
                  type="button"
                  className={`${styles.pickBtn} ${pickingCoord ? styles.pickBtnActive : ''}`}
                  onClick={onStartPicking}
                >
                  <Target size={13} /> Pick from Map
                </button>
                {pickingCoord && <div className={styles.pickHint}>Click anywhere on the map…</div>}
              </div>
            </>
          )}
          <div className={styles.formActions}>
            <button type="button" className={styles.formCancel} onClick={handleCancel}>
              Cancel
            </button>
            <button type="button" className={styles.formSave} onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : isPeopleMode ? 'Save Person' : 'Save Point'}
            </button>
          </div>
          {status && (
            <div className={`${styles.saveStatus} ${status.error ? styles.saveStatusError : styles.saveStatusSuccess}`}>
              {status.icon && <CheckCircle2 size={13} />} {status.text}
            </div>
          )}
        </div>
      )}

      <div className={styles.list}>
        {filtered.length === 0 && (
          <div className={styles.empty}>
            {isPeopleMode ? 'No people found.' : isChannelMode ? 'No channels found.' : 'No waypoints found.'}
          </div>
        )}
        {filtered.map((wp) => {
          const photoCount = wp.imageUrls?.length || 0;
          // Channel rows (supabase/channel_entries.sql) skip
          // resolveWaypointType's name-guessing entirely — unlike a
          // Person (which still gets a guessed color from its `type`),
          // a Channel never has one, so it gets its own fixed badge/icon
          // ('channel' key in adminBadgeColors.js) rather than a
          // meaningless per-name guess.
          const resolvedType = wp.isChannel ? null : resolveWaypointType(wp);
          const wasRemapped = !wp.isPerson && !wp.isChannel && wp.type && wp.type.trim().toLowerCase() !== resolvedType;
          const displayType = wp.isPerson ? 'Person' : wp.isChannel ? 'Channel' : resolvedType.replace(/_/g, ' ');
          const badge = wp.isChannel ? badgeStyleFor('channel') : badgeStyleFor(resolvedType);
          return (
            <div key={wp.id} className={styles.item} onClick={() => onEditWaypoint(wp)}>
              <div className={styles.itemIcon} style={{ background: badge.background, borderColor: badge.borderColor, color: badge.color }}>
                {(() => {
                  const Icon = wp.isPerson ? User : wp.isChannel ? Rss : getTypeIcon(resolvedType);
                  return <Icon size={16} />;
                })()}
              </div>
              <div className={styles.itemBody}>
                <div className={styles.itemTopRow}>
                  <div className={styles.itemNameGroup}>
                    <div className={styles.itemName}>{wp.name || '(unnamed)'}</div>
                    {photoCount > 0 && (
                      <span className={styles.itemPhotoBadge}>
                        <Camera size={10} /> {photoCount}
                      </span>
                    )}
                  </div>
                  <span
                    className={styles.itemBadge}
                    style={badge}
                    title={wasRemapped ? `Stored as "${wp.type}" — will be saved as "${resolvedType}" once you edit & save this point` : undefined}
                  >
                    {displayType}
                    {wasRemapped ? ' •' : ''}
                  </span>
                </div>
                {wp.isChannel ? (
                  <div className={`${styles.itemDesc} ${!wp.channelLink ? styles.itemDescEmpty : ''}`}>
                    {wp.channelLink || 'No link added'}
                  </div>
                ) : (
                  <div className={`${styles.itemDesc} ${!wp.description ? styles.itemDescEmpty : ''}`}>
                    {wp.description || 'No description added'}
                  </div>
                )}
                {!wp.isPerson && !wp.isChannel && (
                  <div className={styles.itemMeta}>
                    <span className={styles.itemMetaLabel}>Coord:</span>
                    <span className={styles.itemMetaValue}>
                      {Number(wp.lat || 0).toFixed(5)}, {Number(wp.lng || 0).toFixed(5)}
                    </span>
                  </div>
                )}
              </div>
              <span className={styles.itemChevron}>
                <ChevronRight size={16} />
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}