import { useEffect, useMemo, useState } from 'react';
import { X, ChevronDown, LocateFixed, Map, Plus, Check } from 'lucide-react';
import styles from './SuggestWaypointModal.module.css';
import { WP_ALL_TYPES } from '../admin/adminTypeOptions';
import { submitWaypoint, findNearbyApprovedWaypoint, isWithinCampusBounds, fetchIsAdmin } from '../waypoints/submitWaypoint';
import { track } from '../../lib/analytics';

const MAX_IMAGES = 5;

/**
 * Slice 13 — "Suggest a place" form.
 *
 * Rebuilt (Oct 2026) from the "Suggest a place" artboards on the Maps By
 * FUTA design canvas (SuggestMobile / SuggestDesktop): a bottom sheet with
 * a grab handle on mobile, a centered 560px dialog on desktop. Its header
 * (title + subtitle + round close) and footer ("My submissions" link +
 * pill submit) don't fit `components/ui/Modal.jsx`'s header/body/footer
 * contract, so this has its own shell, same call AuthModal made.
 *
 * Location: GPS one-shot (`getCurrentPosition`, NOT `useGpsTracking.js` —
 * see CLAUDE.md's GPS notes) or tap-to-place via `onRequestMapPick`, which
 * MapPage resolves back through `pickedCoord`/`onCoordConsumed`. MapPage
 * keeps this component mounted but `hidden` while picking, so the draft
 * survives the round-trip to the map.
 *
 * Duplicate check (`findNearbyApprovedWaypoint`) is a nudge, not a wall.
 * A successful submit shows the in-sheet "Thanks" state; closing it then
 * fires `onSubmitted` for MapPage's SubmissionToast.
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
  hidden = false,
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('landmark');
  const [area, setArea] = useState('');
  const [coord, setCoord] = useState(null); // { lat, lng }
  const [locating, setLocating] = useState(false);
  const [files, setFiles] = useState([]);
  const [duplicateMatch, setDuplicateMatch] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!pickedCoord) return;
    setCoord({ lat: pickedCoord.lat, lng: pickedCoord.lng });
    setDuplicateMatch(null);
    setError(null);
    onCoordConsumed?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickedCoord]);

  // Object URLs for the photo thumbnails, revoked whenever the set changes.
  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);

  // Leaving the "Thanks" screen hands off to MapPage's toast, so the
  // confirmation is still on screen for a moment once the sheet is gone.
  function handleClose() {
    if (done) onSubmitted?.('Submitted — an admin will review it soon.');
    onClose();
  }

  useEffect(() => {
    if (hidden) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  function handleUseGps() {
    if (!navigator.geolocation) {
      setError('GPS is not available on this device.');
      return;
    }
    setLocating(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoord({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setDuplicateMatch(null);
        setLocating(false);
      },
      (err) => {
        setError(`Couldn't get your location: ${err.message}`);
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }

  function handleAddFiles(e) {
    const chosen = Array.from(e.target.files || []);
    e.target.value = '';
    if (!chosen.length) return;
    const room = MAX_IMAGES - files.length;
    if (chosen.length > room) {
      setError(`You can add up to ${MAX_IMAGES} photos.`);
    } else {
      setError(null);
    }
    setFiles((prev) => [...prev, ...chosen.slice(0, Math.max(0, room))]);
  }

  function removeFile(index) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit() {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Add the place name.');
      return;
    }
    if (!coord) {
      setError('Set a location — use your location or pick it on the map.');
      return;
    }
    // Admins can add places off campus; only ask the database when needed.
    if (!isWithinCampusBounds(coord.lat, coord.lng)) {
      const isAdmin = await fetchIsAdmin(user.id).catch(() => false);
      if (!isAdmin) {
        setError('That location looks like it’s outside the FUTA campus area.');
        return;
      }
    }

    // Nudge once per location; "Continue as new place" retries with
    // duplicateMatch still set, which skips this check.
    if (!duplicateMatch) {
      const match = await findNearbyApprovedWaypoint(coord.lat, coord.lng, waypoints);
      if (match) {
        setDuplicateMatch(match);
        return;
      }
    }

    setBusy(true);
    setError(null);
    try {
      await submitWaypoint({
        userId: user.id,
        name: trimmedName,
        description: description.trim(),
        type,
        area,
        lat: coord.lat,
        lng: coord.lng,
        files,
      });
      setDone(true);
    } catch (e) {
      setError(e.message || 'Something went wrong. Try again.');
      track('error_occurred', { context: 'waypoint_suggest', message: e?.message || String(e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className={styles.overlay}
      style={hidden ? { display: 'none' } : undefined}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div className={styles.sheet} role="dialog" aria-modal="true" aria-labelledby="suggest-title">
        <div className={styles.handle} aria-hidden="true" />

        <div className={styles.header}>
          <div className={styles.headerText}>
            <h2 id="suggest-title" className={styles.title}>Suggest a place</h2>
            <p className={styles.subtitle}>Missing from the map? Add it and we&rsquo;ll review it.</p>
          </div>
          <button type="button" className={styles.close} aria-label="Close" onClick={handleClose}>
            <X size={18} />
          </button>
        </div>

        {done ? (
          <div className={`${styles.done} ${styles.fade}`}>
            <div className={styles.doneIcon}>
              <Check size={26} strokeWidth={2.5} />
            </div>
            <h3 className={styles.doneTitle}>Thanks for the suggestion</h3>
            <p className={styles.doneText}>
              We&rsquo;ll review it and add it to the map. You can check its status anytime.
            </p>
            <div className={styles.doneActions}>
              <button type="button" className={styles.primary} onClick={handleClose}>
                Done
              </button>
              {onViewSubmissions && (
                <button type="button" className={styles.linkBtn} onClick={onViewSubmissions}>
                  View my submissions
                </button>
              )}
            </div>
          </div>
        ) : (
          <>
            <div className={styles.body}>
              <div className={styles.nameTypeRow}>
                <div className={styles.field}>
                  <label htmlFor="suggest-name" className={styles.label}>Place name</label>
                  <div className={styles.inputBox}>
                    <input
                      id="suggest-name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. New Engineering Block"
                    />
                  </div>
                </div>

                <div className={styles.field}>
                  <label htmlFor="suggest-type" className={styles.label}>Type</label>
                  <div className={`${styles.inputBox} ${styles.selectBox}`}>
                    <select id="suggest-type" value={type} onChange={(e) => setType(e.target.value)}>
                      {WP_ALL_TYPES.map(([t, label]) => (
                        <option key={t} value={t}>
                          {label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={18} className={styles.chevron} aria-hidden="true" />
                  </div>
                </div>
              </div>

              {/* Same `area` column the admin edit form sets (supabase/waypoint_area.sql). */}
              <div className={styles.field}>
                <div className={styles.labelRow}>
                  <label htmlFor="suggest-area" className={styles.label}>Area</label>
                  <span className={styles.hint}>Optional</span>
                </div>
                <div className={styles.inputBox}>
                  <input
                    id="suggest-area"
                    type="text"
                    value={area}
                    maxLength={60}
                    onChange={(e) => setArea(e.target.value)}
                    placeholder="e.g. South Gate, West Gate, SUB"
                  />
                </div>
              </div>

              <div className={styles.field}>
                <span className={styles.label}>Location</span>
                {coord ? (
                  <div className={`${styles.locCard} ${styles.fade}`}>
                    <div className={styles.locThumb} aria-hidden="true">
                      <svg width="48" height="48" viewBox="0 0 48 48">
                        <path d="M-4 16 C 12 12, 30 22, 52 14" fill="none" stroke="#ffffff" strokeWidth="5" />
                        <path d="M30 -4 C 28 18, 34 32, 30 52" fill="none" stroke="#ffffff" strokeWidth="5" />
                        <path d="M24 34 c-5-6-8-9.5-8-13a8 8 0 0 1 16 0c0 3.5-3 7-8 13z" fill="var(--v2-primary)" />
                        <circle cx="24" cy="21" r="3" fill="#ffffff" />
                      </svg>
                    </div>
                    <div className={styles.locText}>
                      <span className={styles.locTitle}>Location set</span>
                      <span className={styles.locCoords}>
                        {coord.lat.toFixed(4)}, {coord.lng.toFixed(4)}
                      </span>
                    </div>
                    <button
                      type="button"
                      className={styles.chip}
                      onClick={() => {
                        setCoord(null);
                        setDuplicateMatch(null);
                      }}
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <div className={styles.locButtons}>
                    <button type="button" className={styles.ghost} onClick={handleUseGps} disabled={locating}>
                      <LocateFixed size={18} />
                      {locating ? 'Locating…' : 'Use my location'}
                    </button>
                    <button type="button" className={styles.ghost} onClick={() => onRequestMapPick?.()}>
                      <Map size={18} />
                      Pick on map
                    </button>
                  </div>
                )}
              </div>

              <div className={styles.field}>
                <div className={styles.labelRow}>
                  <span className={styles.label}>Photos</span>
                  <span className={styles.hint}>Optional · up to {MAX_IMAGES}</span>
                </div>
                <div className={styles.photos}>
                  {previews.map((src, i) => (
                    <div key={src} className={`${styles.photo} ${styles.fade}`}>
                      <img src={src} alt={`Photo ${i + 1}`} />
                      <button
                        type="button"
                        className={styles.photoRemove}
                        aria-label={`Remove photo ${i + 1}`}
                        onClick={() => removeFile(i)}
                      >
                        <X size={10} strokeWidth={3} />
                      </button>
                    </div>
                  ))}
                  {files.length < MAX_IMAGES && (
                    <label className={styles.addPhoto}>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleAddFiles}
                        className={styles.hiddenInput}
                        aria-label="Add photo"
                      />
                      <Plus size={22} aria-hidden="true" />
                    </label>
                  )}
                </div>
              </div>

              <div className={styles.field}>
                <div className={styles.labelRow}>
                  <label htmlFor="suggest-desc" className={styles.label}>Description</label>
                  <span className={styles.hint}>Optional</span>
                </div>
                <div className={`${styles.inputBox} ${styles.textareaBox}`}>
                  <textarea
                    id="suggest-desc"
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Anything that helps people find it"
                  />
                </div>
              </div>

              {duplicateMatch && (
                <div className={styles.duplicateNudge}>
                  <div>
                    This might already be &ldquo;{duplicateMatch.name}&rdquo; — add your photo there instead, or continue
                    as a new place?
                  </div>
                  <div className={styles.duplicateActions}>
                    <button type="button" className={styles.ghost} onClick={onClose}>
                      I&rsquo;ll add to the existing one
                    </button>
                    <button type="button" className={styles.primary} onClick={handleSubmit} disabled={busy}>
                      Continue as new place
                    </button>
                  </div>
                </div>
              )}

              {error && (
                <div className={styles.error} role="alert">
                  {error}
                </div>
              )}
            </div>

            <div className={styles.footer}>
              {onViewSubmissions && (
                <button type="button" className={styles.linkBtn} onClick={onViewSubmissions}>
                  My submissions
                </button>
              )}
              {!duplicateMatch && (
                <button type="button" className={`${styles.primary} ${styles.submit}`} onClick={handleSubmit} disabled={busy}>
                  {busy ? 'Submitting…' : 'Submit for review'}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
