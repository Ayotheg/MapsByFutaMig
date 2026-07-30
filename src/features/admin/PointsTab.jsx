import { useEffect, useState } from 'react';
import { Target, CheckCircle2, Camera, ChevronRight } from 'lucide-react';
import styles from './AdminPanel.module.css';
import { resolveWaypointType } from '../waypoints/wpTypeMeta';
import { WP_ALL_TYPES } from './adminTypeOptions';
import { badgeStyleFor } from './adminBadgeColors';
import { insertWaypoint } from './adminSave';
import { getTypeIcon } from '../../lib/typeIcons';

/**
 * Legacy: `renderWaypointList` (app.js ~3743–3771) + the "Add Point" inline
 * form + `_startPickingCoord`/`_stopPickingCoord`/`adminAddPointSave`
 * (app.js ~3368–3459). The map-click coordinate picker itself lives one
 * level up in `AdminPanel.jsx` (it needs to hide the whole overlay and
 * touch the Leaflet `map` instance directly, not just this tab).
 */
export default function PointsTab({ waypoints, onEditWaypoint, pickingCoord, onStartPicking, pickedCoord, onCoordConsumed, onWaypointsChanged }) {
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [type, setType] = useState('lecture_hall');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [status, setStatus] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (pickedCoord) {
      setLat(pickedCoord.lat.toFixed(6));
      setLng(pickedCoord.lng.toFixed(6));
      setFormOpen(true);
      onCoordConsumed();
    }
  }, [pickedCoord, onCoordConsumed]);

  const filter = search.toLowerCase();
  const filtered = waypoints.filter(
    (wp) => !filter || wp.name?.toLowerCase().includes(filter) || wp.description?.toLowerCase().includes(filter)
  );

  async function handleSave() {
    const trimmedName = name.trim();
    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);
    if (!trimmedName) {
      setStatus({ text: 'Name is required.', error: true });
      return;
    }
    if (Number.isNaN(latNum) || Number.isNaN(lngNum)) {
      setStatus({ text: 'Valid coordinates required.', error: true });
      return;
    }
    setSaving(true);
    setStatus(null);
    try {
      await insertWaypoint({ name: trimmedName, description: desc.trim(), type, lat: latNum, lng: lngNum });
      setStatus({ text: 'Point added successfully!', error: false, icon: true });
      setName('');
      setDesc('');
      setLat('');
      setLng('');
      onWaypointsChanged?.();
      setTimeout(() => setFormOpen(false), 1500);
    } catch (e) {
      setStatus({ text: `Error: ${e.message}`, error: true });
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
      <div className={styles.toolbar}>
        <div className={styles.countBadge}>
          {filtered.length} of {waypoints.length} waypoints
        </div>
        <input
          type="text"
          className={styles.searchInput}
          placeholder="Search points…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button
          type="button"
          className={styles.addBtn}
          onClick={() => {
            setFormOpen((v) => !v);
          }}
        >
          + Add Point
        </button>
      </div>

      {formOpen && (
        <div className={styles.inlineForm}>
          <div className={styles.formTitle}>New Annotated Point</div>
          <div className={styles.fieldGroup}>
            <label>Name *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Engineering Block A" />
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
          <div className={styles.formActions}>
            <button type="button" className={styles.formCancel} onClick={handleCancel}>
              Cancel
            </button>
            <button type="button" className={styles.formSave} onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save Point'}
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
        {filtered.length === 0 && <div className={styles.empty}>No waypoints found.</div>}
        {filtered.map((wp) => {
          const photoCount = wp.imageUrls?.length || 0;
          // Resolved type — same value AdminEditModal will pre-select on
          // "Edit", so the badge shown here and the Type shown there
          // always agree (see wpTypeMeta.js's resolveWaypointType comment).
          const resolvedType = resolveWaypointType(wp);
          const wasRemapped = wp.type && wp.type.trim().toLowerCase() !== resolvedType;
          return (
            <div key={wp.id} className={styles.item} onClick={() => onEditWaypoint(wp)}>
              <div className={styles.itemIcon}>
                {(() => { const Icon = getTypeIcon(resolvedType); return <Icon size={16} />; })()}
              </div>
              <div className={styles.itemBody}>
                <div className={styles.itemName}>{wp.name || '(unnamed)'}</div>
                <div className={styles.itemMeta}>
                  {wp.description || 'No description'} · {Number(wp.lat || 0).toFixed(5)}, {Number(wp.lng || 0).toFixed(5)}
                </div>
              </div>
              {photoCount > 0 && (
                <span className={styles.itemPhotoBadge}>
                  <Camera size={11} /> {photoCount}
                </span>
              )}
              <span
                className={styles.itemBadge}
                style={badgeStyleFor(resolvedType)}
                title={wasRemapped ? `Stored as "${wp.type}" — will be saved as "${resolvedType}" once you edit & save this point` : undefined}
              >
                {resolvedType.replace(/_/g, ' ')}
                {wasRemapped ? ' •' : ''}
              </span>
              <span className={styles.itemChevron}>
                <ChevronRight size={14} />
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
