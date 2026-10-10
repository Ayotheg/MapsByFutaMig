import { useEffect, useState } from 'react';
import { ImageOff } from 'lucide-react';
import PlaceImage from '../../components/ui/PlaceImage';
import styles from './AdminPanel.module.css';
import ownStyles from './PendingTab.module.css';
import { supabase, getPlaceImageUrl } from '../../lib/supabase';
import { approvePromotion, rejectPromotion, removePromotion, expireEndedPromotions } from './adminSave';
import { track } from '../../lib/analytics';
import { formatNaira } from '../promote/pricing';

/**
 * Admin review queue for paid business promotions (`promotions` table,
 * supabase/promotions.sql). A row lands in "Needs review" when BACHS's
 * webhook flips it to payment_status='paid' / status='pending_review'.
 *
 * The filter row also exposes the other states on purpose: if a payment
 * went through but nothing shows up under "Needs review", "Unpaid" shows
 * whether the row is stuck at 'unpaid' — i.e. the webhook never fired or
 * was rejected (check the bachs-webhook function logs / secret).
 *
 * Approve/Reject go through SECURITY DEFINER RPCs (adminSave.js →
 * supabase/promotions_admin.sql). Approving PUBLISHES: a Physical Shop
 * becomes an approved map waypoint, an Online Store becomes a link-out
 * business waypoint; both are featured in Explore as Promoted for the
 * paid number of days, then un-featured (expire_promotions). An admin can
 * also take a live one down early (Remove now) or erase it (Delete) from the
 * Approved tab — admin_remove_promotion deletes the published waypoint too.
 */
const FILTERS = [
  { key: 'review', label: 'Needs review', match: (q) => q.eq('payment_status', 'paid').eq('status', 'pending_review') },
  { key: 'approved', label: 'Approved', match: (q) => q.eq('status', 'approved') },
  { key: 'rejected', label: 'Rejected', match: (q) => q.eq('status', 'rejected') },
  { key: 'removed', label: 'Removed', match: (q) => q.eq('status', 'removed') },
  { key: 'unpaid', label: 'Unpaid', match: (q) => q.in('payment_status', ['unpaid', 'failed', 'expired']) },
];

const PAY_BADGE = {
  paid: { label: 'PAID', bg: '#dcfce7', fg: '#166534' },
  unpaid: { label: 'UNPAID', bg: '#fef3c7', fg: '#92400e' },
  failed: { label: 'FAILED', bg: '#fee2e2', fg: '#991b1b' },
  expired: { label: 'EXPIRED', bg: '#f1f5f9', fg: '#475569' },
};
const REVIEW_LABEL = {
  awaiting_payment: 'Awaiting payment',
  pending_review: 'Pending review',
  approved: 'Approved',
  rejected: 'Rejected',
  removed: 'Removed',
};

function Pill({ bg, fg, children }) {
  return (
    <span
      style={{
        background: bg,
        color: fg,
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: '0.04em',
        padding: '2px 7px',
        borderRadius: 999,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  );
}

function when(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString();
}

export default function PromotionsTab({ onCountChange, onRefreshWaypoints }) {
  const [filter, setFilter] = useState('review');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [rejectingId, setRejectingId] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  // Two-step confirm for taking a live listing down: { id, erase }.
  const [removing, setRemoving] = useState(null);

  async function load(activeFilter = filter) {
    setLoading(true);
    setError(null);
    try {
      // Paid days that have run out get un-featured whenever the admin looks.
      const n = await expireEndedPromotions();
      if (n > 0) onRefreshWaypoints?.();
      const def = FILTERS.find((f) => f.key === activeFilter) || FILTERS[0];
      const base = supabase
        .from('promotions')
        .select(
          'id, submitted_by, business_name, description, listing_type, lat, lng, contact_platform, contact_link, days, amount, currency, status, payment_status, rejection_reason, paid_at, created_at, waypoint_id, promo_ends_at'
        );
      const { data, error: err } = await def
        .match(base)
        .order(activeFilter === 'review' ? 'paid_at' : 'created_at', { ascending: activeFilter === 'review' })
        .limit(200);
      if (err) throw err;
      const list = data || [];

      let imagesById = {};
      if (list.length) {
        const { data: imgs, error: imgErr } = await supabase
          .from('promotion_images')
          .select('promotion_id, storage_path, position')
          .in('promotion_id', list.map((r) => r.id))
          .order('position', { ascending: true });
        if (imgErr) throw imgErr;
        for (const im of imgs || []) {
          const url = getPlaceImageUrl(im.storage_path);
          if (url) (imagesById[im.promotion_id] ??= []).push(url);
        }
      }

      let names = {};
      const ids = [...new Set(list.map((r) => r.submitted_by).filter(Boolean))];
      if (ids.length) {
        const { data: nameRows, error: nameErr } = await supabase.rpc('submitter_display_names_admin_check', {
          user_ids: ids,
        });
        if (!nameErr && nameRows) names = Object.fromEntries(nameRows.map((r) => [r.id, r.display_name]));
      }

      setRows(
        list.map((r) => ({
          ...r,
          imageUrls: imagesById[r.id] || [],
          submitterName: names[r.submitted_by] || (r.submitted_by ? `Student (${r.submitted_by.slice(0, 8)}…)` : 'Unknown'),
        }))
      );
      if (activeFilter === 'review') onCountChange?.(list.length);
    } catch (e) {
      setRows([]);
      setError(e.message || 'Could not load promotions.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(filter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  async function handleApprove(id) {
    setBusyId(id);
    setError(null);
    try {
      await approvePromotion(id);
      // The new waypoint must show up on the map / Explore straight away.
      onRefreshWaypoints?.();
      await load();
    } catch (e) {
      setError(e.message || 'Could not approve that promotion.');
      track('error_occurred', { context: 'admin_approve_promotion', message: e?.message || String(e) });
    } finally {
      setBusyId(null);
    }
  }

  async function submitRemove() {
    if (!removing) return;
    const { id, erase } = removing;
    setBusyId(id);
    setError(null);
    try {
      const { photoError } = await removePromotion(id, { erase });
      setRemoving(null);
      // The listing must disappear from the map / Explore straight away.
      onRefreshWaypoints?.();
      await load();
      // load() clears the error line, so surface this after it. The listing
      // IS gone; only the photo files in Storage are left to clear by hand.
      if (photoError) {
        setError(
          `Removed, but its photo files couldn't be deleted from storage (${photoError}). ` +
            'Delete them from the place-images bucket in Supabase (promotion/ folder).'
        );
      }
    } catch (e) {
      setError(e.message || 'Could not remove that promotion.');
      track('error_occurred', { context: 'admin_remove_promotion', message: e?.message || String(e) });
    } finally {
      setBusyId(null);
    }
  }

  async function submitReject(id) {
    setBusyId(id);
    setError(null);
    try {
      await rejectPromotion(id, rejectReason.trim() || null);
      setRejectingId(null);
      await load();
    } catch (e) {
      setError(e.message || 'Could not reject that promotion.');
      track('error_occurred', { context: 'admin_reject_promotion', message: e?.message || String(e) });
    } finally {
      setBusyId(null);
    }
  }

  const canReview = filter === 'review';

  return (
    <div className={styles.tabContent}>
      <div className={styles.toolbar} style={{ flexWrap: 'wrap', gap: 6 }}>
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            className={filter === f.key ? styles.formSave : styles.formCancel}
            style={{ padding: '4px 10px', fontSize: 11 }}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
        <div className={styles.countBadge}>{rows.length}</div>
      </div>

      {loading && <div className={styles.empty}>Loading…</div>}
      {!loading && error && <div className={ownStyles.errorNote}>{error}</div>}
      {!loading && !error && rows.length === 0 && (
        <div className={styles.empty}>
          {canReview ? 'No paid promotions waiting on review.' : 'Nothing here.'}
        </div>
      )}

      <div className={styles.list}>
        {rows.map((p) => (
          <div key={p.id} className={ownStyles.card}>
            <div className={ownStyles.cardHeader}>
              <div className={styles.itemName}>{p.business_name || '(unnamed)'}</div>
              <span className={styles.itemBadge}>{p.listing_type === 'physical' ? 'Physical Shop' : 'Online Store'}</span>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {(() => {
                const b = PAY_BADGE[p.payment_status] || { label: String(p.payment_status || '?').toUpperCase(), bg: '#f1f5f9', fg: '#475569' };
                return <Pill bg={b.bg} fg={b.fg}>{b.label}</Pill>;
              })()}
              <Pill bg="#ede9fe" fg="#5b21b6">{REVIEW_LABEL[p.status] || p.status}</Pill>
            </div>

            <div className={styles.itemMeta}>{p.description || 'No description'}</div>
            <div className={styles.itemMeta}>
              {p.listing_type === 'physical'
                ? `${Number(p.lat).toFixed(5)}, ${Number(p.lng).toFixed(5)}`
                : p.contact_link
                  ? (
                    <a href={p.contact_link} target="_blank" rel="noreferrer">
                      {p.contact_platform}: {p.contact_link}
                    </a>
                  )
                  : 'No contact link'}
            </div>
            <div className={styles.itemMeta}>
              {p.days} day{p.days === 1 ? '' : 's'} · {formatNaira(Number(p.amount))}
              {p.paid_at ? ` · paid ${when(p.paid_at)}` : ''}
            </div>
            <div className={ownStyles.submitter}>
              Submitted by {p.submitterName} · {when(p.created_at)}
            </div>
            {p.status === 'approved' && !p.waypoint_id && (
              <div className={ownStyles.submitter}>
                Its listing was deleted outside this panel — nothing is live. Use Delete to clear this record.
              </div>
            )}
            {p.status === 'approved' && p.waypoint_id && p.promo_ends_at && (
              <div className={ownStyles.submitter}>
                {new Date(p.promo_ends_at) > new Date()
                  ? `Live on ${p.listing_type === 'physical' ? 'the map + Explore' : 'Explore'} until ${when(p.promo_ends_at)}`
                  : `Promotion ended ${when(p.promo_ends_at)}`}
              </div>
            )}
            {p.status === 'rejected' && p.rejection_reason && (
              <div className={ownStyles.submitter}>Rejected: {p.rejection_reason}</div>
            )}

            {p.imageUrls.length > 0 ? (
              <div className={ownStyles.photoStrip}>
                {p.imageUrls.map((url) => (
                  <PlaceImage
                    key={url}
                    src={url}
                    alt=""
                    className={ownStyles.photoThumb}
                    onClick={() => window.open(url, '_blank')}
                    fallback={
                      <span className={ownStyles.photoThumbFallback} title="Photo unavailable">
                        <ImageOff size={18} />
                      </span>
                    }
                  />
                ))}
              </div>
            ) : (
              <div className={ownStyles.noPhoto}>No photo attached</div>
            )}

            {(filter === 'approved' || filter === 'removed') &&
              (removing?.id === p.id ? (
                <div className={ownStyles.rejectForm}>
                  <div className={styles.itemMeta}>
                    {removing.erase
                      ? 'Delete this promotion permanently? The live listing and its photos are removed and the record (including payment details) is erased. This cannot be undone.'
                      : 'Remove this listing now, before it expires? It leaves the map and Explore immediately. Its photos are deleted too. The record is kept under Removed.'}
                  </div>
                  <div className={ownStyles.cardActions}>
                    <button type="button" className={styles.formCancel} onClick={() => setRemoving(null)}>
                      Cancel
                    </button>
                    <button type="button" className={ownStyles.rejectBtn} onClick={submitRemove} disabled={busyId === p.id}>
                      {busyId === p.id ? 'Working…' : removing.erase ? 'Yes, delete permanently' : 'Yes, remove now'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className={ownStyles.cardActions}>
                  <button
                    type="button"
                    className={ownStyles.rejectBtn}
                    onClick={() => setRemoving({ id: p.id, erase: true })}
                    disabled={busyId === p.id}
                  >
                    Delete
                  </button>
                  {p.status === 'approved' && (
                    <button
                      type="button"
                      className={styles.formSave}
                      onClick={() => setRemoving({ id: p.id, erase: false })}
                      disabled={busyId === p.id || !p.waypoint_id}
                    >
                      Remove now
                    </button>
                  )}
                </div>
              ))}

            {canReview &&
              (rejectingId === p.id ? (
                <div className={ownStyles.rejectForm}>
                  <textarea
                    className={ownStyles.rejectTextarea}
                    placeholder="Reason (optional)"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                  />
                  <div className={ownStyles.cardActions}>
                    <button type="button" className={styles.formCancel} onClick={() => setRejectingId(null)}>
                      Cancel
                    </button>
                    <button type="button" className={ownStyles.rejectBtn} onClick={() => submitReject(p.id)} disabled={busyId === p.id}>
                      {busyId === p.id ? 'Rejecting…' : 'Confirm reject'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className={ownStyles.cardActions}>
                  <button
                    type="button"
                    className={ownStyles.rejectBtn}
                    onClick={() => {
                      setRejectingId(p.id);
                      setRejectReason('');
                    }}
                    disabled={busyId === p.id}
                  >
                    Reject
                  </button>
                  <button type="button" className={styles.formSave} onClick={() => handleApprove(p.id)} disabled={busyId === p.id}>
                    {busyId === p.id ? 'Approving…' : 'Approve'}
                  </button>
                </div>
              ))}
          </div>
        ))}
      </div>
    </div>
  );
}
