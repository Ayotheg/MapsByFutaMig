import { useEffect, useState } from 'react';
import { ImageOff } from 'lucide-react';
import PlaceImage from '../../components/ui/PlaceImage';
import styles from './AdminPanel.module.css';
import ownStyles from './PendingTab.module.css';
import { supabase, getPlaceImageUrl } from '../../lib/supabase';
import { approveEvent, rejectEvent, removeEvent, setEventFeatured } from './adminSave';
import { track } from '../../lib/analytics';
import { formatNaira } from '../promote/pricing';
import { lagosEndOfDay, shortDate, shortWhen } from '../explore/eventsData';

/**
 * Admin review queue for listed events (`events`, supabase/events.sql).
 * "Needs review" holds free events as soon as they're sent, and ticketed
 * ones once bachs-webhook has marked the listing fee paid. "Unpaid" shows
 * ticketed events stuck before payment (checkout abandoned, or the webhook
 * never fired — check the bachs-webhook logs).
 *
 * Approve puts the event in Explore → Events until the end of its day
 * (public_events()); "Approve + feature" also puts it in the Featured rail.
 */
const FILTERS = [
  {
    key: 'review',
    label: 'Needs review',
    match: (q) => q.eq('status', 'pending_review').in('payment_status', ['not_required', 'paid']),
  },
  { key: 'approved', label: 'Approved', match: (q) => q.eq('status', 'approved') },
  { key: 'rejected', label: 'Rejected', match: (q) => q.eq('status', 'rejected') },
  { key: 'removed', label: 'Removed', match: (q) => q.eq('status', 'removed') },
  { key: 'unpaid', label: 'Unpaid', match: (q) => q.in('payment_status', ['unpaid', 'failed', 'expired']) },
];

const PAY_BADGE = {
  not_required: { label: 'FREE', bg: '#e0f2fe', fg: '#075985' },
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

// Event times are FUTA (Lagos) time, same as Explore and public_events().
function eventDay(iso) {
  return `${shortDate(iso)}, ${shortWhen(iso).split(' · ')[1]}`;
}

function hasEnded(iso) {
  return lagosEndOfDay(iso) < new Date();
}

export default function EventsTab({ onCountChange }) {
  const [filter, setFilter] = useState('review');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [rejectingId, setRejectingId] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [removing, setRemoving] = useState(null); // { id, erase }

  async function load(activeFilter = filter) {
    setLoading(true);
    setError(null);
    try {
      const def = FILTERS.find((f) => f.key === activeFilter) || FILTERS[0];
      const { data, error: err } = await def
        .match(supabase.from('events').select('*'))
        .order(activeFilter === 'review' ? 'created_at' : 'starts_at', { ascending: activeFilter === 'review' })
        .limit(200);
      if (err) throw err;
      const list = data || [];

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
          posterUrl: r.poster_path ? getPlaceImageUrl(r.poster_path) : null,
          submitterName: names[r.submitted_by] || (r.submitted_by ? `Student (${r.submitted_by.slice(0, 8)}…)` : 'Unknown'),
        }))
      );
      if (activeFilter === 'review') onCountChange?.(list.length);
    } catch (e) {
      setRows([]);
      setError(
        /relation .*events.* does not exist/i.test(e.message || '')
          ? 'The events table is missing. Run supabase/events.sql in the Supabase SQL editor.'
          : e.message || 'Could not load events.'
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(filter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  async function run(id, action, context) {
    setBusyId(id);
    setError(null);
    try {
      await action();
      await load();
    } catch (e) {
      setError(e.message || 'Something went wrong.');
      track('error_occurred', { context, message: e?.message || String(e) });
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
      const { photoError } = await removeEvent(id, { erase });
      setRemoving(null);
      await load();
      if (photoError) {
        setError(
          `Done, but the poster file couldn't be deleted from storage (${photoError}). ` +
            'Delete it from the place-images bucket in Supabase (event/ folder).'
        );
      }
    } catch (e) {
      setError(e.message || 'Could not remove that event.');
      track('error_occurred', { context: 'admin_remove_event', message: e?.message || String(e) });
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
        <div className={styles.empty}>{canReview ? 'No events waiting on review.' : 'Nothing here.'}</div>
      )}

      <div className={styles.list}>
        {rows.map((ev) => {
          const pay = PAY_BADGE[ev.payment_status] || { label: String(ev.payment_status).toUpperCase(), bg: '#f1f5f9', fg: '#475569' };
          const ended = hasEnded(ev.starts_at);
          return (
            <div key={ev.id} className={ownStyles.card}>
              <div className={ownStyles.cardHeader}>
                <div className={styles.itemName}>{ev.title}</div>
                <span className={styles.itemBadge}>
                  {ev.entry_type === 'ticketed' ? `Ticket ${formatNaira(Number(ev.ticket_price))}` : 'Free entry'}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <Pill bg={pay.bg} fg={pay.fg}>{pay.label}</Pill>
                <Pill bg="#ede9fe" fg="#5b21b6">{REVIEW_LABEL[ev.status] || ev.status}</Pill>
                {ev.is_featured && <Pill bg="#fef3c7" fg="#92400e">FEATURED</Pill>}
                {ended && <Pill bg="#f1f5f9" fg="#475569">ENDED</Pill>}
              </div>

              <div className={styles.itemMeta}>By {ev.organiser}</div>
              <div className={styles.itemMeta}>{eventDay(ev.starts_at)}</div>
              <div className={styles.itemMeta}>
                {ev.location_type === 'online' ? (
                  ev.online_link ? (
                    <a href={ev.online_link} target="_blank" rel="noreferrer">
                      Online ({ev.online_platform}): {ev.online_link}
                    </a>
                  ) : (
                    'Online (no link)'
                  )
                ) : (
                  <a
                    href={`https://www.google.com/maps?q=${ev.venue_lat},${ev.venue_lng}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {ev.venue_name} · {Number(ev.venue_lat).toFixed(5)}, {Number(ev.venue_lng).toFixed(5)}
                  </a>
                )}
              </div>
              {ev.ticket_note && <div className={styles.itemMeta}>Tickets: {ev.ticket_note}</div>}
              {ev.entry_type === 'ticketed' && (
                <div className={styles.itemMeta}>
                  Listing fee {formatNaira(Number(ev.listing_fee))}
                  {ev.paid_at ? ` · paid ${when(ev.paid_at)}` : ''}
                </div>
              )}
              <div className={ownStyles.submitter}>
                Submitted by {ev.submitterName} · {when(ev.created_at)}
              </div>
              {ev.status === 'rejected' && ev.rejection_reason && (
                <div className={ownStyles.submitter}>Rejected: {ev.rejection_reason}</div>
              )}
              {/* e.g. "Removed by the organiser before paying" (remove_my_unpaid_event) */}
              {ev.status === 'removed' && ev.rejection_reason && (
                <div className={ownStyles.submitter}>{ev.rejection_reason}</div>
              )}

              {ev.posterUrl ? (
                <div className={ownStyles.photoStrip}>
                  <PlaceImage
                    src={ev.posterUrl}
                    alt=""
                    className={ownStyles.photoThumb}
                    onClick={() => window.open(ev.posterUrl, '_blank')}
                    fallback={
                      <span className={ownStyles.photoThumbFallback} title="Poster unavailable">
                        <ImageOff size={18} />
                      </span>
                    }
                  />
                </div>
              ) : (
                <div className={ownStyles.noPhoto}>No poster</div>
              )}

              {canReview &&
                (rejectingId === ev.id ? (
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
                      <button
                        type="button"
                        className={ownStyles.rejectBtn}
                        disabled={busyId === ev.id}
                        onClick={() =>
                          run(
                            ev.id,
                            async () => {
                              await rejectEvent(ev.id, rejectReason.trim() || null);
                              setRejectingId(null);
                            },
                            'admin_reject_event'
                          )
                        }
                      >
                        {busyId === ev.id ? 'Rejecting…' : 'Confirm reject'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className={ownStyles.cardActions}>
                    <button
                      type="button"
                      className={ownStyles.rejectBtn}
                      disabled={busyId === ev.id}
                      onClick={() => {
                        setRejectingId(ev.id);
                        setRejectReason('');
                      }}
                    >
                      Reject
                    </button>
                    <button
                      type="button"
                      className={styles.formCancel}
                      disabled={busyId === ev.id}
                      onClick={() => run(ev.id, () => approveEvent(ev.id, { featured: true }), 'admin_approve_event')}
                    >
                      Approve + feature
                    </button>
                    <button
                      type="button"
                      className={styles.formSave}
                      disabled={busyId === ev.id}
                      onClick={() => run(ev.id, () => approveEvent(ev.id), 'admin_approve_event')}
                    >
                      {busyId === ev.id ? 'Working…' : 'Approve'}
                    </button>
                  </div>
                ))}

              {/* Unpaid listings can be deleted too (spam that never paid). */}
              {!canReview &&
                (removing?.id === ev.id ? (
                  <div className={ownStyles.rejectForm}>
                    <div className={styles.itemMeta}>
                      {removing.erase
                        ? 'Delete this event permanently? The record and its poster are erased. This cannot be undone.'
                        : 'Take this event down now? It leaves Explore immediately and its poster is deleted. The record is kept under Removed.'}
                    </div>
                    <div className={ownStyles.cardActions}>
                      <button type="button" className={styles.formCancel} onClick={() => setRemoving(null)}>
                        Cancel
                      </button>
                      <button type="button" className={ownStyles.rejectBtn} onClick={submitRemove} disabled={busyId === ev.id}>
                        {busyId === ev.id ? 'Working…' : removing.erase ? 'Yes, delete permanently' : 'Yes, take it down'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className={ownStyles.cardActions}>
                    <button
                      type="button"
                      className={ownStyles.rejectBtn}
                      disabled={busyId === ev.id}
                      onClick={() => setRemoving({ id: ev.id, erase: true })}
                    >
                      Delete
                    </button>
                    {ev.status === 'approved' && (
                      <>
                        <button
                          type="button"
                          className={styles.formCancel}
                          disabled={busyId === ev.id || ended}
                          onClick={() => run(ev.id, () => setEventFeatured(ev.id, !ev.is_featured), 'admin_feature_event')}
                        >
                          {ev.is_featured ? 'Unfeature' : 'Feature'}
                        </button>
                        <button
                          type="button"
                          className={styles.formSave}
                          disabled={busyId === ev.id || ended}
                          onClick={() => setRemoving({ id: ev.id, erase: false })}
                        >
                          Take down
                        </button>
                      </>
                    )}
                  </div>
                ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
