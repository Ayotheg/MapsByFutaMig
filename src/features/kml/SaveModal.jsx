import { useState } from 'react';
import Modal from '../../components/ui/Modal';
import modalStyles from '../../components/ui/Modal.module.css';
import styles from './SaveModal.module.css';
import { buildGPX, buildKML, buildGeoJSON, downloadFile } from './exportBuilders';
import { saveSegment } from './segmentSave';

const CATEGORIES = [
  { value: 'footpath', label: 'Footpath' },
  { value: 'road', label: 'Campus Road' },
  { value: 'shortcut', label: 'Shortcut' },
  { value: 'indoor', label: 'Indoor Route' },
  { value: 'other', label: 'Other' },
];

const FORMATS = ['gpx', 'kml', 'geojson'];

/**
 * Ported from legacy `#saveModal` (index.html ~699–755) + its wiring
 * (app.js ~2016–2302: `openSaveModal`, image-preview handling, `doExport`,
 * `exportOnlyBtn`, `saveToFbBtn`).
 *
 * ── Deliberate deviations from legacy ─────────────────────────────────
 * - Photo previews use `URL.createObjectURL(file)` and upload the raw
 *   `File` to Supabase Storage on save, instead of legacy's FileReader ->
 *   base64 dataURL (+ a canvas-based downscale step for anything over
 *   900KB). That downscale step existed specifically to fit under
 *   Firestore's 1MB-per-document limit — Supabase Storage has no such
 *   constraint on an uploaded file, so there's nothing to work around.
 * - "SAVE TO FIREBASE" -> "SAVE SEGMENT" / a Supabase insert
 *   (`segmentSave.js`). Still triggers a file download right after a
 *   successful save, matching legacy's `doExport(name)` call inside the
 *   save handler (not just the separate "Download Only" button).
 * - No `_adminData.segments.push(...)` / `renderSegmentList(...)` — that
 *   was updating the not-yet-built admin panel's own list (Slice 11).
 *   `onSaved` (passed by the caller) triggers `useSegments()`/
 *   `useWaypoints()` refetches instead, so the map picks up the new
 *   segment the same way loading the page fresh would.
 * - No `window._invalidateFirestoreCache()` — Slice 4/2 already dropped
 *   the sessionStorage read-cache this existed to bust.
 */
export default function SaveModal({ draft, onClose, onSaved }) {
  const [name, setName] = useState(draft.defaultName || '');
  const [description, setDescription] = useState(draft.defaultDesc || '');
  const [category, setCategory] = useState('footpath');
  const [waypoints, setWaypoints] = useState(draft.recordedWaypoints || []);
  const [images, setImages] = useState([]); // { file, previewUrl }
  const [format, setFormat] = useState('gpx');
  const [status, setStatus] = useState(null); // { kind: 'info'|'success'|'error', text }
  const [saving, setSaving] = useState(false);

  function updateWaypointField(idx, field, value) {
    setWaypoints((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  }

  function handleImagePick(e) {
    const files = Array.from(e.target.files || []).slice(0, 5);
    setImages(files.map((file) => ({ file, previewUrl: URL.createObjectURL(file) })));
  }

  function removeImage(idx) {
    setImages((prev) => {
      const next = [...prev];
      URL.revokeObjectURL(next[idx].previewUrl);
      next.splice(idx, 1);
      return next;
    });
  }

  function doExport(exportName) {
    const safeN = (exportName || 'segment').replace(/\s+/g, '-');
    if (format === 'gpx') {
      downloadFile(
        buildGPX(exportName, description, draft.recordedPoints, waypoints),
        `${safeN}.gpx`,
        'application/gpx+xml'
      );
    } else if (format === 'kml') {
      downloadFile(
        buildKML(exportName, description, draft.recordedPoints, waypoints),
        `${safeN}.kml`,
        'application/vnd.google-earth.kml+xml'
      );
    } else {
      downloadFile(
        buildGeoJSON(exportName, description, category, draft.recordedPoints, waypoints),
        `${safeN}.geojson`,
        'application/geo+json'
      );
    }
  }

  function handleDownloadOnly() {
    doExport(name.trim() || 'FUTA-Segment');
  }

  async function handleSave() {
    const trimmedName = name.trim();
    if (!trimmedName) return;

    setSaving(true);
    setStatus({ kind: 'info', text: '⏳ Saving segment…' });

    try {
      await saveSegment(
        {
          name: trimmedName,
          description: description.trim(),
          category,
          points: draft.recordedPoints,
          waypoints,
          distance: draft.totalDistance,
          recStartTime: draft.recStartTime,
        },
        images.map((img) => img.file)
      );

      doExport(trimmedName);
      setStatus({ kind: 'success', text: '✅ Saved + file downloaded!' });
      await onSaved?.();
      setTimeout(onClose, 2200);
    } catch (err) {
      setStatus({ kind: 'error', text: `❌ Save failed: ${err.message}` });
      setSaving(false);
    }
  }

  const footer = (
    <>
      <button
        type="button"
        className={`${modalStyles.btn} ${modalStyles.btnSecondary}`}
        onClick={handleDownloadOnly}
      >
        Download
      </button>
      <button
        type="button"
        className={`${modalStyles.btn} ${modalStyles.btnPrimary}`}
        onClick={handleSave}
        disabled={saving || !name.trim()}
      >
        {saving ? 'Saving…' : 'Save Segment'}
      </button>
    </>
  );

  return (
    <Modal title="SAVE SEGMENT" onClose={onClose} footer={footer}>
      <div className={styles.field}>
        <label>Segment Name *</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Gate 1 → SUB"
        />
      </div>

      <div className={styles.field}>
        <label>Description</label>
        <textarea
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe this route, landmarks, shortcuts..."
        />
      </div>

      <div className={styles.field}>
        <label>Category</label>
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.field}>
        <label>Waypoints ({waypoints.length})</label>
        <div className={styles.waypointSummary}>
          {waypoints.map((wp, i) => (
            <div key={i} className={styles.waypointItem}>
              <div className={styles.waypointIcon}>📍</div>
              <div className={styles.waypointFields}>
                <input
                  type="text"
                  placeholder="Name"
                  value={wp.name}
                  onChange={(e) => updateWaypointField(i, 'name', e.target.value)}
                />
                <input
                  type="text"
                  placeholder="Description (optional)"
                  value={wp.desc || ''}
                  onChange={(e) => updateWaypointField(i, 'desc', e.target.value)}
                />
                <div className={styles.waypointCoords}>
                  {wp.lat.toFixed(6)}, {wp.lng.toFixed(6)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.field}>
        <label>Photos (up to 5)</label>
        <div className={styles.imageZone}>
          <label className={styles.uploadPlaceholder} style={{ display: images.length ? 'none' : 'flex' }}>
            <input type="file" accept="image/*" multiple hidden onChange={handleImagePick} />
            📷 Tap to add photos
          </label>
          {images.length > 0 && (
            <div className={styles.imagePreviews}>
              {images.map((img, i) => (
                <div key={img.previewUrl} className={styles.previewWrap}>
                  <img src={img.previewUrl} alt="" />
                  <button
                    type="button"
                    className={styles.previewRemove}
                    onClick={() => removeImage(i)}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className={styles.field}>
        <label>Export Format</label>
        <div className={styles.exportToggle}>
          {FORMATS.map((f) => (
            <button
              key={f}
              type="button"
              className={`${styles.exportOpt} ${format === f ? styles.active : ''}`}
              onClick={() => setFormat(f)}
            >
              {f.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {status && (
        <div className={`${styles.saveStatus} ${styles[status.kind]}`}>{status.text}</div>
      )}
    </Modal>
  );
}
