import { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import styles from './AdminPanel.module.css';
import ownStyles from './PendingTab.module.css';
import { track } from '../../lib/analytics';
import {
  adminGrant,
  adminResolveRequest,
  adminRevoke,
  adminSetPlan,
  fetchAdminOverview,
} from '../developers/developerApi';
import { formatNumber, maskedPrefix, requestLabel, shortDay, timeAgo } from '../developers/developerData';

/**
 * Public API keys and credit requests (supabase/public_api_dashboard.sql).
 * Payments aren't online yet: a developer asks on /developers for an
 * upgrade or more credits, gets paid by transfer, and an admin applies it
 * here. "Apply" does the upgrade or grant and closes the request in one go.
 * Every action is checked server-side by is_admin().
 */
const FILTERS = [
  { key: 'requests', label: 'Requests' },
  { key: 'keys', label: 'Keys' },
];

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

// Brand tokens (DESIGN_SYSTEM.md), not the older tabs' one-off hexes.
const VIOLET = { bg: 'var(--v2-primary-tint)', fg: 'var(--v2-primary-hover)' };
const TEAL = { bg: 'var(--v2-secondary-tint)', fg: 'var(--v2-neutral)' };
const GREY = { bg: 'var(--v2-divider)', fg: 'var(--v2-text)' };
const STATUS_PILL = {
  open: { ...VIOLET, label: 'OPEN' },
  done: { ...TEAL, label: 'DONE' },
  dismissed: { ...GREY, label: 'DISMISSED' },
  cancelled: { ...GREY, label: 'CANCELLED' },
};

export default function ApiTab({ onCountChange }) {
  const [filter, setFilter] = useState('requests');
  const [data, setData] = useState({ keys: [], requests: [], plans: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [query, setQuery] = useState('');
  const [managing, setManaging] = useState(null); // key id

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const next = await fetchAdminOverview();
      setData({ keys: next.keys || [], requests: next.requests || [], plans: next.plans || [] });
      onCountChange?.((next.requests || []).filter((r) => r.status === 'open').length);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const openRequests = data.requests.filter((r) => r.status === 'open');
  const closedRequests = data.requests.filter((r) => r.status !== 'open');
  const keys = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return data.keys;
    return data.keys.filter((k) => [k.name, k.owner_email, k.prefix].some((v) => String(v || '').toLowerCase().includes(q)));
  }, [data.keys, query]);

  const shown = filter === 'requests' ? openRequests.length : keys.length;

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
        <div className={styles.countBadge}>{shown}</div>
      </div>

      {filter === 'keys' && (
        <div className={styles.toolbar}>
          <div className={styles.searchWrap} style={{ flexBasis: '100%' }}>
            <span className={styles.searchIcon}>
              <Search size={16} />
            </span>
            <input
              className={styles.searchInput}
              type="search"
              placeholder="Search name, email or key prefix"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>
      )}

      {loading && <div className={styles.empty}>Loading…</div>}
      {error && <div className={ownStyles.errorNote}>{error}</div>}

      {!loading && filter === 'requests' && (
        <div className={styles.list}>
          {openRequests.length === 0 && <div className={styles.empty}>No open requests.</div>}
          {openRequests.map((r) => (
            <RequestCard
              key={r.id}
              r={r}
              plans={data.plans}
              busy={busyId === `r${r.id}`}
              onApply={() =>
                run(
                  `r${r.id}`,
                  async () => {
                    if (r.kind === 'upgrade') await adminSetPlan(r.key_id, r.plan_id, true);
                    else await adminGrant(r.key_id, r.credits, 'topup', `request #${r.id}`);
                    await adminResolveRequest(r.id, 'done');
                  },
                  'admin_api_apply_request'
                )
              }
              onResolve={(status) => run(`r${r.id}`, () => adminResolveRequest(r.id, status), 'admin_api_resolve_request')}
            />
          ))}

          {closedRequests.length > 0 && (
            <>
              <div className={styles.itemMeta} style={{ padding: '10px 2px 0', fontWeight: 700 }}>
                Closed in the last 30 days
              </div>
              {closedRequests.map((r) => (
                <div key={r.id} className={ownStyles.card} style={{ opacity: 0.75 }}>
                  <div className={ownStyles.cardHeader}>
                    <div className={styles.itemName}>{requestLabel(r, data.plans)}</div>
                    <Pill {...STATUS_PILL[r.status]}>{STATUS_PILL[r.status]?.label || r.status}</Pill>
                  </div>
                  <div className={styles.itemMeta}>
                    {r.key_name} · {maskedPrefix(r.key_prefix)} · {r.owner_email}
                  </div>
                  <div className={ownStyles.submitter}>
                    Asked {shortDay(r.created_at)} · closed {r.resolved_at ? shortDay(r.resolved_at) : '—'}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {!loading && filter === 'keys' && (
        <div className={styles.list}>
          {keys.length === 0 && <div className={styles.empty}>{query ? 'No keys match.' : 'No keys yet.'}</div>}
          {keys.map((k) => (
            <KeyCard
              key={k.id}
              k={k}
              plans={data.plans}
              open={managing === k.id}
              busy={busyId === k.id}
              onToggle={() => setManaging(managing === k.id ? null : k.id)}
              onGrant={(amount, kind, note) => run(k.id, () => adminGrant(k.id, amount, kind, note), 'admin_api_grant')}
              onSetPlan={(planId) => run(k.id, () => adminSetPlan(k.id, planId, true), 'admin_api_set_plan')}
              onRevoke={() => run(k.id, () => adminRevoke(k.id), 'admin_api_revoke')}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function RequestCard({ r, plans, busy, onApply, onResolve }) {
  const current = plans.find((p) => p.id === r.current_plan);
  return (
    <div className={ownStyles.card}>
      <div className={ownStyles.cardHeader}>
        <div className={styles.itemName}>{requestLabel(r, plans)}</div>
        <Pill {...STATUS_PILL.open}>OPEN</Pill>
      </div>
      <div className={styles.itemMeta}>
        {r.key_name} · {maskedPrefix(r.key_prefix)} · now on {current ? current.name : r.current_plan}
      </div>
      <div className={styles.itemMeta}>
        <a href={`mailto:${r.owner_email}?subject=${encodeURIComponent('Your Maps By FUTA API request')}`}>{r.owner_email}</a>
      </div>
      {r.note && <div className={styles.itemMeta}>“{r.note}”</div>}
      <div className={ownStyles.submitter}>Asked {timeAgo(r.created_at)}</div>
      <div className={styles.itemMeta}>Apply only after payment has arrived.</div>
      <div className={ownStyles.cardActions}>
        <button type="button" className={ownStyles.rejectBtn} disabled={busy} onClick={() => onResolve('dismissed')}>
          Dismiss
        </button>
        <button type="button" className={styles.formCancel} disabled={busy} onClick={() => onResolve('done')} title="Close it without changing the key">
          Mark done
        </button>
        <button type="button" className={styles.formSave} disabled={busy} onClick={onApply}>
          {busy ? 'Working…' : r.kind === 'upgrade' ? 'Upgrade + close' : `Grant ${formatNumber(r.credits)} + close`}
        </button>
      </div>
    </div>
  );
}

function KeyCard({ k, plans, open, busy, onToggle, onGrant, onSetPlan, onRevoke }) {
  const [amount, setAmount] = useState('');
  const [kind, setKind] = useState('topup');
  const [note, setNote] = useState('');
  const [planId, setPlanId] = useState(k.plan_id);
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const active = k.status === 'active';
  const total = (Number(k.plan_credits) || 0) + (Number(k.topup_credits) || 0);
  const n = Number(amount);

  return (
    <div className={ownStyles.card} style={active ? undefined : { opacity: 0.7 }}>
      <div className={ownStyles.cardHeader}>
        <div className={styles.itemName}>{k.name}</div>
        <span className={styles.itemBadge}>{k.plan_name}</span>
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <Pill {...(active ? TEAL : GREY)}>{active ? 'ACTIVE' : 'REVOKED'}</Pill>
        {!k.self_serve && <Pill {...VIOLET}>MADE IN SQL</Pill>}
      </div>
      <div className={styles.itemMeta}>
        {maskedPrefix(k.prefix)} · {k.owner_email}
      </div>
      <div className={styles.itemMeta}>
        {formatNumber(total)} credits left · resets {shortDay(k.resets_at)}
      </div>
      <div className={styles.itemMeta}>
        Plan {formatNumber(k.plan_credits)}/{formatNumber(k.monthly_credits)} · top-up {formatNumber(k.topup_credits)}
      </div>
      <div className={ownStyles.submitter}>
        Last used {timeAgo(k.last_used_at)} · {formatNumber(k.calls_30d)} calls and {formatNumber(k.credits_used_30d)} credits
        in 30 days · made {shortDay(k.created_at)}
      </div>

      {active && (
        <div className={ownStyles.cardActions}>
          <button type="button" className={open ? styles.formSave : styles.formCancel} onClick={onToggle}>
            {open ? 'Close' : 'Manage'}
          </button>
        </div>
      )}

      {active && open && (
        <div className={ownStyles.rejectForm}>
          <div className={styles.fieldRow}>
            <div className={styles.fieldGroup} style={{ minWidth: 0 }}>
              <label htmlFor={`amt-${k.id}`}>Credits</label>
              <input
                style={{ width: '100%', minWidth: 0 }}
                id={`amt-${k.id}`}
                type="number"
                min="1"
                step="1"
                placeholder="e.g. 2000"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className={styles.fieldGroup} style={{ minWidth: 0 }}>
              <label htmlFor={`kind-${k.id}`}>Kind</label>
              <select id={`kind-${k.id}`} value={kind} onChange={(e) => setKind(e.target.value)} style={{ width: '100%' }}>
                <option value="topup">Top-up, never expires</option>
                <option value="plan">This month only</option>
              </select>
            </div>
          </div>
          <div className={styles.fieldGroup}>
            <label htmlFor={`note-${k.id}`}>Note (payment reference)</label>
            <input id={`note-${k.id}`} type="text" maxLength={120} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <div className={ownStyles.cardActions}>
            <button
              type="button"
              className={styles.formSave}
              disabled={busy || !Number.isInteger(n) || n <= 0}
              onClick={() => {
                onGrant(n, kind, note.trim());
                setAmount('');
                setNote('');
              }}
            >
              {busy ? 'Working…' : `Grant ${Number.isInteger(n) && n > 0 ? formatNumber(n) : ''} credits`}
            </button>
          </div>

          <div className={styles.fieldGroup}>
            <label htmlFor={`plan-${k.id}`}>Plan</label>
            <select id={`plan-${k.id}`} value={planId} onChange={(e) => setPlanId(e.target.value)}>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {formatNumber(p.monthly_credits)}/month · {p.rate_limit}/min
                </option>
              ))}
            </select>
          </div>
          <div className={ownStyles.cardActions}>
            <button type="button" className={styles.formSave} disabled={busy || planId === k.plan_id} onClick={() => onSetPlan(planId)}>
              Change plan (refills now)
            </button>
          </div>

          {confirmRevoke ? (
            <>
              <div className={styles.itemMeta}>Revoke this key? It stops working at once and can&apos;t be turned back on.</div>
              <div className={ownStyles.cardActions}>
                <button type="button" className={styles.formCancel} onClick={() => setConfirmRevoke(false)}>
                  Cancel
                </button>
                <button type="button" className={ownStyles.rejectBtn} disabled={busy} onClick={onRevoke}>
                  Yes, revoke
                </button>
              </div>
            </>
          ) : (
            <div className={ownStyles.cardActions}>
              <button type="button" className={ownStyles.rejectBtn} onClick={() => setConfirmRevoke(true)}>
                Revoke key
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
