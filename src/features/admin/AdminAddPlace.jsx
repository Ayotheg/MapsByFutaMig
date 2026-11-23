import { useEffect, useState } from 'react';
import { CheckCircle2, Target, X } from 'lucide-react';
import styles from './AdminAddPlace.module.css';
import { WP_ALL_TYPES } from './adminTypeOptions';
import { insertWaypoint } from './adminSave';
import { CAMPUS_BOUNDS } from '../../lib/campusBounds';
import { formatLatLng, parseLatLng } from './coordInput';
import { track } from '../../lib/analytics';

/**
 * "Add place": name, type, area and a spot (typed "lat, lng" or picked on
 * the map). Stays mounted but hidden while the map is up, so nothing typed
 * is lost.
 */
export default function AdminAddPlace({ pickedCoord, onCoordConsumed, onPickOnMap, hidden, onClose, onSaved }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [area, setArea] = useState('');
  const [type, setType] = useState('lecture_hall');
  const [coords, setCoords] = useState('');
  const [status, setStatus] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!pickedCoord) return;
    setCoords(formatLatLng(pickedCoord.lat, pickedCoord.lng));
    onCoordConsumed();
  }, [pickedCoord, onCoordConsumed]);

  const parsed = parseLatLng(coords);
  const outside = parsed && !CAMPUS_BOUNDS.contains([parsed.lat, parsed.lng]);

  async function save(e) {
    e.preventDefault();
    if (!name.trim()) return setStatus({ error: true, text: 'Give the place a name.' });
    if (!parsed) return setStatus({ error: true, text: 'Enter coordinates as latitude, longitude — or pick the spot on the map.' });
    setSaving(true);
    setStatus(null);
    try {
      let warning = null;
      await insertWaypoint(
        { name: name.trim(), description: description.trim(), type, lat: parsed.lat, lng: parsed.lng, area },
        { onWarning: (w) => (warning = w) }
      );
      onSaved?.();
      if (warning) {
        setStatus({ error: true, text: warning });
        setSaving(false);
        return;
      }
      onClose();
    } catch (err) {
      setStatus({ error: true, text: err.message || 'Could not save the place.' });
      track('error_occurred', { context: 'admin_insert_waypoint', message: err?.message || String(err) });
      setSaving(false);
    }
  }

  return (
    <div className={styles.overlay} hidden={hidden} role="dialog" aria-modal="true" aria-labelledby="add-place-title">
      <form className={styles.modal} onSubmit={save} noValidate>
        <header className={styles.header}>
          <h2 id="add-place-title" className={styles.title}>
            Add a place
          </h2>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </header>

        <div className={styles.body}>
          <label className={styles.field}>
            <span>Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Engineering Block A" autoFocus />
          </label>
          <label className={styles.field}>
            <span>Description</span>
            <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="A short note (optional)" />
          </label>
          <div className={styles.row}>
            <label className={styles.field}>
              <span>Type</span>
              <select value={type} onChange={(e) => setType(e.target.value)}>
                {WP_ALL_TYPES.map(([t, label]) => (
                  <option key={t} value={t}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              <span>Area</span>
              <input value={area} maxLength={60} onChange={(e) => setArea(e.target.value)} placeholder="e.g. South Gate (optional)" />
            </label>
          </div>
          <label className={styles.field}>
            <span>Coordinates</span>
            <input
              value={coords}
              onChange={(e) => setCoords(e.target.value)}
              placeholder="7.301230, 5.134560"
              inputMode="decimal"
              autoCapitalize="none"
              spellCheck={false}
            />
          </label>
          <button type="button" className={styles.pickBtn} onClick={onPickOnMap}>
            <Target size={16} /> Pick on map
          </button>
          {outside && <p className={styles.warn}>That spot is outside the campus boundary. You can still save it.</p>}
          {status && (
            <p className={status.error ? styles.error : styles.ok} role="alert">
              {!status.error && <CheckCircle2 size={14} />} {status.text}
            </p>
          )}
        </div>

        <footer className={styles.footer}>
          <button type="button" className={styles.ghost} onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" className={styles.primary} disabled={saving}>
            {saving ? 'Saving…' : 'Save place'}
          </button>
        </footer>
      </form>
    </div>
  );
}
