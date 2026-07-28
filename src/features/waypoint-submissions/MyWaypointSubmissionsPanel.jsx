import { useEffect, useState } from 'react';
import Modal from '../../components/ui/Modal';
import styles from './MyWaypointSubmissionsPanel.module.css';
import { fetchMySubmissions, withdrawSubmission } from '../waypoints/submitWaypoint';
import { WP_TYPE_LABELS } from '../waypoints/wpTypeMeta';

const STATUS_LABEL = {
  pending: 'Pending review',
  approved: 'Approved',
  rejected: 'Rejected',
};

/**
 * Slice 13 — lets a signed-in student see their own submissions and
 * current status (pending / approved / rejected + rejection_reason).
 * Reuses the shared Modal shell, same choice SuggestWaypointModal made.
 *
 * Query is scoped by RLS itself (`public_read_approved`'s `or
 * submitted_by = auth.uid()` clause) — `fetchMySubmissions` still passes
 * `.eq('submitted_by', user.id)` client-side too, purely so this doesn't
 * pull down every other approved waypoint on campus just to discard them,
 * not because RLS needs the help.
 */
export default function MyWaypointSubmissionsPanel({ user, onClose }) {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchMySubmissions(user.id);
      setSubmissions(data);
    } catch (e) {
      setError(e.message || 'Could not load your submissions.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  async function handleWithdraw(id) {
    setBusyId(id);
    try {
      await withdrawSubmission(id);
      setSubmissions((prev) => prev.filter((s) => s.id !== id));
    } catch (e) {
      setError(e.message || 'Could not withdraw that submission.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Modal title="My Submissions" onClose={onClose}>
      {loading && <div className={styles.empty}>Loading…</div>}
      {!loading && error && <div className={styles.errorNote}>{error}</div>}
      {!loading && !error && submissions.length === 0 && (
        <div className={styles.empty}>You haven't suggested any places yet.</div>
      )}
      {!loading &&
        submissions.map((s) => (
          <div key={s.id} className={styles.item}>
            <div className={styles.itemHeader}>
              <div className={styles.itemName}>{s.name}</div>
              <span className={`${styles.badge} ${styles['badge_' + s.status]}`}>
                {STATUS_LABEL[s.status] || s.status}
              </span>
            </div>
            <div className={styles.itemMeta}>
              {WP_TYPE_LABELS[s.type] || s.type} · {Number(s.lat).toFixed(5)}, {Number(s.lng).toFixed(5)}
            </div>
            {s.description && <div className={styles.itemDesc}>{s.description}</div>}
            {s.status === 'rejected' && s.rejection_reason && (
              <div className={styles.rejectionReason}>Reason: {s.rejection_reason}</div>
            )}
            {s.status === 'pending' && (
              <button
                type="button"
                className={styles.withdrawBtn}
                onClick={() => handleWithdraw(s.id)}
                disabled={busyId === s.id}
              >
                {busyId === s.id ? 'Withdrawing…' : 'Withdraw'}
              </button>
            )}
          </div>
        ))}
    </Modal>
  );
}