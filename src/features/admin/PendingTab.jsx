import { useEffect, useState } from 'react';
import styles from './AdminPanel.module.css';
import ownStyles from './PendingTab.module.css';
import { supabase, getPlaceImageUrl } from '../../lib/supabase';
import { WP_TYPE_LABELS } from '../waypoints/wpTypeMeta';
import { approveWaypoint, rejectWaypoint } from './adminSave';

/**
 * Slice 13 — new "Pending" tab in AdminPanel, alongside the existing
 * points/routes/kml/chips tabs. Reuses AdminPanel.module.css's existing
 * tab-content/toolbar/list/item classes rather than inventing a second
 * tab UI.
 *
 * Loads its own `pending`-status rows + their images directly (rather
 * than filtering the `waypoints` prop AdminPanel already holds) since
 * that prop is fed by `useWaypoints()`, which — as of this slice — only
 * ever selects `status='approved'` rows; pending ones are never in it by
 * design. Submitter display name comes from a `security definer` RPC
 * (see `supabase/waypoint_submissions.sql`'s "Admin identity" section)
 * rather than a direct `auth.users` join, since RLS won't allow this
 * client to read `auth.users` broadly.
 *
 * **Scope note, flagged rather than silently built partial:** "Edit then
 * approve" (reusing AdminEditModal.jsx) is NOT wired here — that modal's
 * `updateWaypoint` doesn't touch `status`, and threading "edit, then also
 * flip status to approved" through it cleanly needs its own small design
 * decision (does Cancel-after-edit leave it pending? does a validation
 * failure on the edit block the approve?) that's worth its own pass
 * rather than guessing. Approve/Reject are fully wired; a typo in a
 * submitted name currently needs an outright reject-and-resubmit rather
 * than a quick inline fix.
 */
export default function PendingTab({ onRefreshWaypoints }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [rejectingId, setRejectingId] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [{ data: wpRows, error: wpErr }, { data: imgRows, error: imgErr }] = await Promise.all([
        supabase
          .from('waypoints')
          .select('id, name, description, type, lat, lng, submitted_by, saved_at')
          .eq('status', 'pending')
          .order('saved_at', { ascending: true }),
        supabase.from('waypoint_images').select('waypoint_id, storage_path, position').order('position', { ascending: true }),
      ]);
      if (wpErr) throw wpErr;
      if (imgErr) throw imgErr;

      const imagesByWaypoint = {};
      for (const row of imgRows || []) {
        const url = getPlaceImageUrl(row.storage_path);
        if (!url) continue;
        (imagesByWaypoint[row.waypoint_id] ??= []).push(url);
      }

      // Submitter display name — best-effort. Falls back to a short,
      // truncated user id if the `submitter_display_names_admin_check`
      // RPC isn't set up yet in this Supabase project (flagged, not
      // silently swallowed — see `supabase/waypoint_submissions.sql`'s
      // "Admin identity" section for why this needs a security-definer
      // function rather than a direct auth.users read).
      let names = {};
      const submitterIds = [...new Set((wpRows || []).map((w) => w.submitted_by).filter(Boolean))];
      if (submitterIds.length) {
        const { data: nameRows, error: nameErr } = await supabase.rpc('submitter_display_names_admin_check', {
          user_ids: submitterIds,
        });
        if (!nameErr && nameRows) {
          names = Object.fromEntries(nameRows.map((r) => [r.id, r.display_name]));
        }
      }

      setRows(
        (wpRows || []).map((w) => ({
          ...w,
          imageUrls: imagesByWaypoint[w.id] || [],
          submitterName: names[w.submitted_by] || (w.submitted_by ? `Student (${w.submitted_by.slice(0, 8)}…)` : 'Unknown'),
        }))
      );
    } catch (e) {
      setError(e.message || 'Could not load pending submissions.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function afterMutation() {
    load();
    onRefreshWaypoints?.();
  }

  async function handleApprove(id) {
    setBusyId(id);
    try {
      await approveWaypoint(id);
      afterMutation();
    } catch (e) {
      setError(e.message || 'Could not approve that submission.');
    } finally {
      setBusyId(null);
    }
  }

  function openReject(id) {
    setRejectingId(id);
    setRejectReason('');
  }

  async function submitReject(id) {
    setBusyId(id);
    try {
      await rejectWaypoint(id, rejectReason.trim() || null);
      setRejectingId(null);
      afterMutation();
    } catch (e) {
      setError(e.message || 'Could not reject that submission.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className={styles.tabContent}>
      <div className={styles.toolbar}>
        <div className={styles.countBadge}>{rows.length} pending</div>
      </div>

      {loading && <div className={styles.empty}>Loading…</div>}
      {!loading && error && <div className={ownStyles.errorNote}>{error}</div>}
      {!loading && rows.length === 0 && !error && <div className={styles.empty}>Nothing waiting on review.</div>}

      <div className={styles.list}>
        {rows.map((wp) => (
          <div key={wp.id} className={ownStyles.card}>
            <div className={ownStyles.cardHeader}>
              <div className={styles.itemName}>{wp.name || '(unnamed)'}</div>
              <span className={styles.itemBadge}>{WP_TYPE_LABELS[wp.type] || wp.type}</span>
            </div>
            <div className={styles.itemMeta}>
              {wp.description || 'No description'} · {Number(wp.lat).toFixed(5)}, {Number(wp.lng).toFixed(5)}
            </div>
            <div className={ownStyles.submitter}>Submitted by {wp.submitterName}</div>

            {wp.imageUrls.length > 0 && (
              <div className={ownStyles.photoStrip}>
                {wp.imageUrls.map((url) => (
                  <img key={url} src={url} alt="" className={ownStyles.photoThumb} onClick={() => window.open(url, '_blank')} />
                ))}
              </div>
            )}
            {wp.imageUrls.length === 0 && <div className={ownStyles.noPhoto}>No photo attached</div>}

            {rejectingId === wp.id ? (
              <div className={ownStyles.rejectForm}>
                <textarea
                  className={ownStyles.rejectTextarea}
                  placeholder="Reason (shown to the student, optional)"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                />
                <div className={ownStyles.cardActions}>
                  <button type="button" className={styles.formCancel} onClick={() => setRejectingId(null)}>
                    Cancel
                  </button>
                  <button type="button" className={ownStyles.rejectBtn} onClick={() => submitReject(wp.id)} disabled={busyId === wp.id}>
                    {busyId === wp.id ? 'Rejecting…' : 'Confirm reject'}
                  </button>
                </div>
              </div>
            ) : (
              <div className={ownStyles.cardActions}>
                <button type="button" className={ownStyles.rejectBtn} onClick={() => openReject(wp.id)} disabled={busyId === wp.id}>
                  Reject
                </button>
                <button type="button" className={styles.formSave} onClick={() => handleApprove(wp.id)} disabled={busyId === wp.id}>
                  {busyId === wp.id ? 'Approving…' : 'Approve'}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}