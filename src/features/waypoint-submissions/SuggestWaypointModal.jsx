import { useEffect, useState } from 'react';
import Modal from '../../components/ui/Modal';
import modalStyles from '../../components/ui/Modal.module.css';
import styles from './SuggestWaypointModal.module.css';
import { WP_ALL_TYPES } from '../admin/adminTypeOptions';
import { submitWaypoint, findNearbyApprovedWaypoint, isWithinCampusBounds } from '../waypoints/submitWaypoint';

const MAX_IMAGES = 5;

/**
 * Slice 13 — "Suggest a place" form. New folder `src/features/
 * waypoint-submissions/`, separate from `src/features/waypoints/`,
 * matching this codebase's one-feature-folder-per-distinct-UI convention
 * (see `admin/`, `auth/`, `reviews/`).
 *
 * Reuses the shared `components/ui/Modal.jsx` shell (same choice
 * `AdminEditModal.jsx`/`DetailModal.jsx` made — this form genuinely has a
 * header/body/footer shape, unlike `AuthModal`/`AdminPinGate`'s bespoke
 * layouts) and `adminTypeOptions.js`'s `WP_ALL_TYPES` rather than
 * duplicating that list.
 *
 * Location picker offers both GPS and tap-to-place: GPS is faster for
 * "I'm standing here right now," tap-to-place is needed for "this bench
 * is over there, not where I'm standing." Tap-to-place reuses
 * `AdminPanel.jsx`'s existing pick-coordinate flow via the
 * `onRequestMapPick` callback `MapPage.jsx` wires through — this
 * component never touches the Leaflet `map` instance directly, same
 * separation `AdminPanel`/`PointsTab` already established.
 *
 * GPS uses a plain one-shot `navigator.geolocation.getCurrentPosition`
 * call here, NOT `useGpsTracking.js` — that hook is a full continuous-
 * tracking system (warm-up watcher, dead reckoning, map markers) bound to
 * the Leaflet `map` ref/`hidden` state, not a reusable single-shot getter.
 *
 * Duplicate check (`findNearbyApprovedWaypoint`) is a nudge, not a wall —
 * both "continue as new" and "cancel to add a photo to the existing one"
 * stay available.
 */
export default function SuggestWaypointModal({
  user,
  waypoints,
  pickedCoord,
  onCoordConsumed,
  onRequestMapPick,
  onClose,
  onSubmitted,
  onViewSubmissions,
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('landmark');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [files, setFiles] = useState([]);
  const [duplicateMatch, setDuplicateMatch] = useState(null);
  const [status, setStatus] = useState(null); // { text, error }
  const [busy, setBusy] = useState(false);

  // A map-pick completed while this modal was open — MapPage.jsx hands the
  // picked coord back through this prop once AdminPanel's reused pick flow
  // resolves it. `onCoordConsumed` clears it in the parent so this only
  // fires once per pick, same "consume, then null it out" contract
  // PointsTab.jsx already uses for the admin add-point form's own
  // `pickedCoord`/`onCoordConsumed` pair.
  useEffect(() => {
    if (!pickedCoord) return;
    setLat(pickedCoord.lat.toFixed(6));
    setLng(pickedCoord.lng.toFixed(6));
    onCoordConsumed?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickedCoord]);

  function handleUseGps() {
    if (!navigator.geolocation) {
      setStatus({ text: 'GPS is not available on this device.', error: true });
      return;
    }
    setStatus({ text: 'Getting your location…', error: false });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(6));
        setLng(pos.coords.longitude.toFixed(6));
        setStatus(null);
      },
      (err) => {
        setStatus({ text: `Couldn't get your location: ${err.message}`, error: true });
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  function handleFilesChange(e) {
    const chosen = Array.from(e.target.files || []);
    if (chosen.length > MAX_IMAGES) {
      setStatus({ text: `Please choose at most ${MAX_IMAGES} photos.`, error: true });
      return;
    }
    setFiles(chosen);
  }

  async function handleSubmit() {
    const trimmedName = name.trim();
    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);

    if (!trimmedName) {
      setStatus({ text: 'Name is required.', error: true });
      return;
    }
    if (Number.isNaN(latNum) || Number.isNaN(lngNum)) {
      setStatus({ text: 'A location is required — use GPS or tap the map.', error: true });
      return;
    }
    if (!isWithinCampusBounds(latNum, lngNum)) {
      setStatus({ text: 'That location looks like it\u2019s outside the FUTA campus area.', error: true });
      return;
    }

    // Nudge for a nearby existing approved waypoint, once, before final
    // submit — not re-checked if the person already chose "continue as
    // new" and nothing about the coordinates changed since (duplicateMatch
    // stays truthy in that case, so this branch is skipped on the retry).
    if (!duplicateMatch) {
      const match = await findNearbyApprovedWaypoint(latNum, lngNum, waypoints);
      if (match) {
        setDuplicateMatch(match);
        return;
      }
    }

    setBusy(true);
    setStatus(null);
    try {
      await submitWaypoint({
        userId: user.id,
        name: trimmedName,
        description: description.trim(),
        type,
        lat: latNum,
        lng: lngNum,
        files,
      });
      // Close + toast, do NOT optimistically render the pin locally —
      // it's pending, nothing else this student's account can see would
      // show it, which would just be confusing.
      onSubmitted?.('Submitted \u2014 an admin will review it soon.');
      onClose();
    } catch (e) {
      setStatus({ text: e.message || 'Something went wrong. Try again.', error: true });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Suggest a Place" onClose={onClose}>
      <div className={styles.fieldGroup}>
        <label>Name *</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Bench near Faculty of Engineering" />
      </div>
      <div className={styles.fieldGroup}>
        <label>Description</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What's here, and anything that'll help an admin verify it (optional)" />
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

      <div className={styles.fieldGroup}>
        <label>Location *</label>
        <div className={styles.locationRow}>
          <button type="button" className={styles.locBtn} onClick={handleUseGps}>
            📍 Use my current GPS
          </button>
          <button type="button" className={styles.locBtn} onClick={() => onRequestMapPick?.()}>
            🎯 Tap a spot on the map
          </button>
        </div>
        {lat !== '' && lng !== '' && (
          <div className={styles.coordDisplay}>
            {Number(lat).toFixed(5)}, {Number(lng).toFixed(5)}
          </div>
        )}
      </div>

      <div className={styles.fieldGroup}>
        <label>Photos (optional, up to {MAX_IMAGES})</label>
        <input type="file" accept="image/*" multiple onChange={handleFilesChange} />
        {files.length > 0 && <div className={styles.fileCount}>{files.length} photo{files.length === 1 ? '' : 's'} selected</div>}
      </div>

      {duplicateMatch && (
        <div className={styles.duplicateNudge}>
          <div>This might already be "{duplicateMatch.name}" — add your photo there instead, or continue as a new place?</div>
          <div className={styles.duplicateActions}>
            <button type="button" className={modalStyles.btn + ' ' + modalStyles.btnSecondary} onClick={onClose}>
              I'll add to the existing one
            </button>
            <button type="button" className={modalStyles.btn + ' ' + modalStyles.btnPrimary} onClick={handleSubmit}>
              Continue as new place
            </button>
          </div>
        </div>
      )}

      {status && (
        <div className={`${styles.saveStatus} ${status.error ? styles.saveStatusError : styles.saveStatusSuccess}`}>
          {status.text}
        </div>
      )}

      {!duplicateMatch && (
        <div className={styles.formActions}>
          <button type="button" className={modalStyles.btn + ' ' + modalStyles.btnSecondary} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={modalStyles.btn + ' ' + modalStyles.btnPrimary} onClick={handleSubmit} disabled={busy}>
            {busy ? 'Submitting…' : 'Submit for review'}
          </button>
        </div>
      )}

      {onViewSubmissions && (
        <button type="button" className={styles.viewSubmissionsLink} onClick={onViewSubmissions}>
          View my submissions →
        </button>
      )}
    </Modal>
  );
}