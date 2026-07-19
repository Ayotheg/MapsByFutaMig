import { useEffect, useState } from 'react';
import Modal from '../../components/ui/Modal';
import modalStyles from '../../components/ui/Modal.module.css';
import styles from './AdminEditModal.module.css';
import { WP_ALL_TYPES } from './adminTypeOptions';
import { getPlaceImageUrl } from '../../lib/supabase';
import {
  fetchImageRows,
  uploadImage,
  insertImageRows,
  removeStorageFiles,
  deleteImageRows,
  updateWaypoint,
  deleteWaypoint,
  updateSegment,
  deleteSegment,
} from './adminSave';

const SEGMENT_CATEGORIES = ['footpath', 'road', 'shortcut', 'indoor', 'other'];

// `URL.createObjectURL(file)` was being called fresh inside `.map()` on
// every render — a new blob URL (and a small permanent memory leak) each
// time. Cached per File object instead; nothing here ever needs a File
// twice removed-and-re-added, so a plain WeakMap is enough (no manual
// eviction needed — entries die with their File).
const previewUrlCache = new WeakMap();
function previewUrlFor(file) {
  let url = previewUrlCache.get(file);
  if (!url) {
    url = URL.createObjectURL(file);
    previewUrlCache.set(file, url);
  }
  return url;
}

/**
 * Shared edit/delete form for a waypoint, segment, or session-only admin
 * KML feature — ported from legacy's `openEditWaypoint`/`openEditSegment`/
 * `openEditKml` (app.js ~3921–4016) + `adminSaveBtn`/`adminDeleteBtn`
 * (~4099–4320) + `buildImageField`/image-upload handlers (~3852–3919).
 *
 * Reuses the shared `components/ui/Modal.jsx` shell — unlike
 * `AdminPinGate` (bespoke, no header/body/footer structure in legacy),
 * `#adminEditModal` genuinely has `.modal-header`/`.modal-body`/
 * `.modal-footer` in legacy's own markup (index.html ~945–959), the same
 * shape DetailModal/SaveModal/ReviewModal already share. No backdrop-click
 * dismiss (legacy never wires one for this modal, matching Modal's
 * `closeOnBackdrop=false` default).
 *
 * Image handling deviates from legacy — see adminSave.js's header comment
 * for why (normalized image tables here vs. a single resaved array in
 * legacy). `type: 'kml'` images are the one exception: since a
 * not-yet-imported KML feature has no DB row to attach an image row to,
 * those photos stay as `File`s in `useAdminKml`'s own registry state
 * (`adminKml.addImageFile`/`removeImageFile`) and only actually upload
 * once "Import to Supabase" runs (`useAdminKml.importFeature`).
 */
export default function AdminEditModal({ editContext, onClose, onWaypointChanged, onSegmentChanged, adminKml }) {
  const { type } = editContext;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [wpType, setWpType] = useState('landmark');
  const [category, setCategory] = useState('other');

  const [existingImages, setExistingImages] = useState([]); // {id, storagePath, url}
  const [newFiles, setNewFiles] = useState([]); // File[]
  const [removedImages, setRemovedImages] = useState([]); // {id, storagePath}[]
  const [imagesLoading, setImagesLoading] = useState(false);

  const [status, setStatus] = useState(null); // { text, error }
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setStatus(null);
    setNewFiles([]);
    setRemovedImages([]);

    if (type === 'waypoint') {
      const wp = editContext.data;
      setName(wp.name || '');
      setDescription(wp.description || '');
      setWpType(wp.type || 'landmark');
      setImagesLoading(true);
      fetchImageRows('waypoint_images', 'waypoint_id', editContext.id)
        .then((rows) => {
          setExistingImages(rows.map((r) => ({ id: r.id, storagePath: r.storage_path, url: resolveUrl(r.storage_path) })));
        })
        .finally(() => setImagesLoading(false));
    } else if (type === 'segment') {
      const seg = editContext.data;
      setName(seg.name || '');
      setDescription(seg.description || '');
      setCategory(seg.category || 'other');
      setImagesLoading(true);
      fetchImageRows('segment_images', 'segment_id', editContext.id)
        .then((rows) => {
          setExistingImages(rows.map((r) => ({ id: r.id, storagePath: r.storage_path, url: resolveUrl(r.storage_path) })));
        })
        .finally(() => setImagesLoading(false));
    } else if (type === 'kml') {
      const f = editContext.data;
      setName(f.name || '');
      setDescription(f.description || '');
      setExistingImages([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editContext]);

  function resolveUrl(storagePath) {
    return getPlaceImageUrl(storagePath);
  }

  function handleFilesChosen(e) {
    const files = Array.from(e.target.files || []);
    if (type === 'kml') {
      files.forEach((f) => adminKml.addImageFile(editContext.path, editContext.idx, f));
    } else {
      setNewFiles((prev) => [...prev, ...files]);
    }
    e.target.value = '';
  }

  function removeExisting(id) {
    setExistingImages((imgs) => {
      const removed = imgs.find((i) => i.id === id);
      if (removed) setRemovedImages((r) => [...r, removed]);
      return imgs.filter((i) => i.id !== id);
    });
  }

  function removeNew(idx) {
    setNewFiles((files) => files.filter((_, i) => i !== idx));
  }

  async function handleSave() {
    if (!name.trim()) {
      setStatus({ text: 'Name is required.', error: true });
      return;
    }
    setBusy(true);
    setStatus(null);
    try {
      if (type === 'waypoint') {
        await updateWaypoint(editContext.id, { name: name.trim(), description: description.trim(), type: wpType });
        await reconcileImages('waypoint_images', 'waypoint_id', editContext.id, 'waypoints');
        setStatus({ text: '✅ Waypoint updated!', error: false });
        onWaypointChanged?.();
      } else if (type === 'segment') {
        await updateSegment(editContext.id, { name: name.trim(), description: description.trim(), category });
        await reconcileImages('segment_images', 'segment_id', editContext.id, 'segments');
        setStatus({ text: '✅ Segment updated!', error: false });
        onSegmentChanged?.();
      } else if (type === 'kml') {
        // Legacy: kml edits never write to Firebase directly on Save —
        // only the separate "Import to Supabase" button does (app.js
        // ~4270–4271, "Updated in memory. (KML file not modified)").
        adminKml.renameFeature(editContext.path, editContext.idx, name.trim(), description.trim());
        setStatus({ text: '✅ Updated in memory. (KML file not modified)', error: false });
      }
    } catch (e) {
      setStatus({ text: `❌ ${e.message}`, error: true });
    } finally {
      setBusy(false);
    }
  }

  async function reconcileImages(table, idColumn, entityId, kind) {
    if (removedImages.length > 0) {
      await deleteImageRows(table, removedImages.map((i) => i.id));
      // Best-effort Storage cleanup — DB cascade doesn't reach Storage.
      await removeStorageFiles(removedImages.map((i) => i.storagePath)).catch(() => {});
    }
    if (newFiles.length > 0) {
      const startPos = existingImages.length;
      const paths = [];
      for (let i = 0; i < newFiles.length; i++) {
        paths.push(await uploadImage(kind, entityId, newFiles[i], startPos + i));
      }
      await insertImageRows(table, idColumn, entityId, paths, startPos);
    }
  }

  async function handleDelete() {
    if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return;
    setBusy(true);
    setStatus(null);
    try {
      if (type === 'waypoint') {
        await deleteWaypoint(editContext.id);
        if (existingImages.length) {
          await removeStorageFiles(existingImages.map((i) => i.storagePath)).catch(() => {});
        }
        onWaypointChanged?.();
        onClose();
      } else if (type === 'segment') {
        await deleteSegment(editContext.id);
        if (existingImages.length) {
          await removeStorageFiles(existingImages.map((i) => i.storagePath)).catch(() => {});
        }
        onSegmentChanged?.();
        onClose();
      }
      // Legacy: no delete affordance for `kml` type (`adminDeleteBtn.style
      // .display = 'none'` when opening a kml feature, app.js ~4014) —
      // matched by AdminPanel not rendering a footer delete button for it.
    } catch (e) {
      setStatus({ text: `❌ ${e.message}`, error: true });
    } finally {
      setBusy(false);
    }
  }

  const title = type === 'waypoint' ? 'EDIT WAYPOINT' : type === 'segment' ? 'EDIT SEGMENT' : 'EDIT KML FEATURE';
  const showDelete = type === 'waypoint' || type === 'segment';

  const kmlImageFiles = type === 'kml' ? adminKml.registry[editContext.path]?.features?.[editContext.idx]?.imageFiles || [] : [];

  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={
        <>
          {showDelete && (
            <button
              type="button"
              className={`${modalStyles.btn} ${modalStyles.btnDanger}`}
              onClick={handleDelete}
              disabled={busy}
            >
              DELETE
            </button>
          )}
          <button type="button" className={`${modalStyles.btn} ${modalStyles.btnSecondary}`} onClick={onClose}>
            CANCEL
          </button>
          <button
            type="button"
            className={`${modalStyles.btn} ${modalStyles.btnPrimary}`}
            onClick={handleSave}
            disabled={busy}
          >
            SAVE CHANGES
          </button>
        </>
      }
    >
      {type === 'waypoint' && (
        <>
          <Field label="Name *">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Waypoint name" />
          </Field>
          <Field label="Note / Description">
            <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional note" />
          </Field>
          <Field label="Type">
            <select value={wpType} onChange={(e) => setWpType(e.target.value)}>
              {WP_ALL_TYPES.map(([t, label]) => (
                <option key={t} value={t}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Coordinates (read-only)">
            <div className={styles.coordDisplay}>
              {Number(editContext.data.lat).toFixed(6)}, {Number(editContext.data.lng).toFixed(6)}
            </div>
          </Field>
        </>
      )}

      {type === 'segment' && (
        <>
          <Field label="Segment Name *">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Segment name" />
          </Field>
          <Field label="Description">
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
          <Field label="Category">
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              {SEGMENT_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Stats">
            <div className={styles.coordDisplay}>
              {((editContext.data.distance || 0) / 1000).toFixed(2)} km · {(editContext.data.points || []).length} GPS
              points · {(editContext.data.waypoints || []).length} waypoints
            </div>
          </Field>
        </>
      )}

      {type === 'kml' && (
        <>
          <Field label="Feature Name">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Feature name" />
          </Field>
          <Field label="Description / Note">
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
          <Field label="Source File">
            <div className={styles.coordDisplay}>
              {editContext.path} <span className={styles.sourceTag}>{editContext.data.type || 'feature'}</span>
            </div>
          </Field>
          <Field label="Coordinates">
            <div className={styles.coordDisplay}>
              {Number(editContext.data.lat).toFixed(6)}, {Number(editContext.data.lng).toFixed(6)}
            </div>
          </Field>
        </>
      )}

      {/* ── Photos ─────────────────────────────────────────────────── */}
      <div className={styles.fieldGroup}>
        <label>{type === 'segment' ? 'Photos (shown in route popup)' : type === 'kml' ? 'Photos for this KML feature' : 'Photos'}</label>
        <div className={styles.imgZone} onClick={() => document.getElementById('adminImgInput')?.click()}>
          <div className={styles.imgZoneLabel}>📷 Click to add photos (JPEG/PNG)</div>
          <div className={styles.imgThumbs}>
            {imagesLoading && <span className={styles.loadingNote}>Loading…</span>}
            {type !== 'kml' &&
              existingImages.map((img) => (
                <Thumb key={img.id} url={img.url} onRemove={() => removeExisting(img.id)} />
              ))}
            {type !== 'kml' &&
              newFiles.map((f, i) => (
                <Thumb key={`new-${i}`} url={previewUrlFor(f)} onRemove={() => removeNew(i)} />
              ))}
            {type === 'kml' &&
              kmlImageFiles.map((f, i) => (
                <Thumb
                  key={`kml-${i}`}
                  url={previewUrlFor(f)}
                  onRemove={() => adminKml.removeImageFile(editContext.path, editContext.idx, i)}
                />
              ))}
          </div>
        </div>
        <input id="adminImgInput" type="file" accept="image/*" multiple hidden onChange={handleFilesChosen} />
      </div>

      {type === 'kml' && (
        <button
          type="button"
          className={styles.importBtn}
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setStatus(null);
            try {
              await adminKml.importFeature(editContext.path, editContext.idx, {
                onImported: () => {
                  onWaypointChanged?.();
                  onSegmentChanged?.();
                },
              });
              setStatus({ text: '✅ Imported to Supabase successfully!', error: false });
              onClose();
            } catch (e) {
              setStatus({ text: `❌ Import failed: ${e.message}`, error: true });
            } finally {
              setBusy(false);
            }
          }}
        >
          ☁ IMPORT TO SUPABASE
        </button>
      )}

      {status && (
        <div className={`${styles.saveStatus} ${status.error ? styles.saveStatusError : styles.saveStatusSuccess}`}>
          {status.text}
        </div>
      )}
    </Modal>
  );
}

function Field({ label, children }) {
  return (
    <div className={styles.fieldGroup}>
      <label>{label}</label>
      {children}
    </div>
  );
}

function Thumb({ url, onRemove }) {
  return (
    <div className={styles.imgThumbWrap}>
      <img
        className={styles.imgThumb}
        src={url}
        onClick={(e) => {
          e.stopPropagation();
          window.open(url, '_blank');
        }}
        alt=""
      />
      <button
        type="button"
        className={styles.imgRemove}
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        title="Remove"
      >
        ✕
      </button>
    </div>
  );
}
