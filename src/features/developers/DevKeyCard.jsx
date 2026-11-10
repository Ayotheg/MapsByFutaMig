import { useState } from 'react';
import { AlertCircle, ChartColumn, Coins, KeyRound, Loader2, RotateCw, Trash2, X } from 'lucide-react';
import {
  NOTE_MAX,
  TOPUP_OPTIONS,
  creditSummary,
  dayInitial,
  formatNaira,
  formatNumber,
  maskedPrefix,
  requestLabel,
  shortDay,
  timeAgo,
  usageBars,
} from './developerData';
import { cancelRequest, fetchKeyUsage, requestCredits, revokeKey, rollKey } from './developerApi';
import styles from './DevelopersPage.module.css';

/**
 * One API key on /developers: credits left this month, recent use, and the
 * things a developer can do with it. Usage, More credits, Roll and Revoke
 * each open a small panel under the card; only one is open at a time.
 *
 * Rolling or creating returns the full key once; the page shows it
 * (onNewSecret) because the card it belongs to is a new one.
 */
export default function DevKeyCard({ apiKey: k, plans, requests, email, onChanged, onNewSecret }) {
  const [panel, setPanel] = useState(null); // null | 'usage' | 'credits' | 'roll' | 'revoke'
  const [usage, setUsage] = useState({ status: 'idle' });
  const [working, setWorking] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  const active = k.status === 'active';
  const c = creditSummary(k);
  const openRequests = requests.filter((r) => r.status === 'open');

  async function toggle(next) {
    setError(null);
    setNotice(null);
    const opening = panel !== next;
    setPanel(opening ? next : null);
    if (opening && next === 'usage') {
      setUsage({ status: 'loading' });
      try {
        setUsage({ status: 'ready', ...(await fetchKeyUsage(k.id)) });
      } catch (e) {
        setUsage({ status: 'error', message: e.message });
      }
    }
  }

  async function run(action, after) {
    setWorking(true);
    setError(null);
    try {
      const result = await action();
      after?.(result);
    } catch (e) {
      setError(e.message);
    } finally {
      setWorking(false);
    }
  }

  const handleRoll = () =>
    run(
      () => rollKey(k.id),
      (result) => {
        setPanel(null);
        onNewSecret(result, 'rolled');
        onChanged();
      }
    );

  const handleRevoke = () =>
    run(
      () => revokeKey(k.id),
      () => {
        setPanel(null);
        onChanged();
      }
    );

  if (!active) {
    return (
      <article className={`${styles.keyCard} ${styles.keyCardRevoked}`}>
        <div className={styles.keyHead}>
          <span className={`${styles.keyIcon} ${styles.keyIconMuted}`} aria-hidden="true">
            <KeyRound size={18} />
          </span>
          <div className={styles.keyTitleBlock}>
            <h3 className={styles.keyName}>{k.name}</h3>
            <code className={styles.keyPrefix}>{maskedPrefix(k.prefix)}</code>
          </div>
          <span className={`${styles.pill} ${styles.pillMuted}`}>Revoked</span>
        </div>
        <p className={styles.keyFootnote}>
          Made {shortDay(k.created_at)} · last used {timeAgo(k.last_used_at)}. It no longer works.
        </p>
      </article>
    );
  }

  return (
    <article className={styles.keyCard}>
      <div className={styles.keyHead}>
        <span className={styles.keyIcon} aria-hidden="true">
          <KeyRound size={18} />
        </span>
        <div className={styles.keyTitleBlock}>
          <h3 className={styles.keyName}>{k.name}</h3>
          <code className={styles.keyPrefix}>{maskedPrefix(k.prefix)}</code>
        </div>
        <span className={`${styles.pill} ${k.plan_id === 'free' ? styles.pillTeal : styles.pillViolet}`}>{k.plan_name}</span>
      </div>

      <div className={styles.credits}>
        <div className={styles.creditsTop}>
          <span className={`${styles.creditsValue} ${c.tone !== 'ok' ? styles.creditsValueWarn : ''}`}>{formatNumber(c.total)}</span>
          <span className={styles.creditsLabel}>credits left</span>
        </div>
        <div
          className={styles.meter}
          role="meter"
          aria-label="Plan credits left this month"
          aria-valuemin={0}
          aria-valuemax={c.monthly}
          aria-valuenow={c.plan}
        >
          <span className={`${styles.meterFill} ${c.tone !== 'ok' ? styles.meterFillWarn : ''}`} style={{ width: `${c.planShare * 100}%` }} />
        </div>
        <div className={styles.creditsRows}>
          <span>
            Plan <b>{formatNumber(c.plan)}</b> of {formatNumber(c.monthly)}
          </span>
          {c.topup > 0 && (
            <span>
              Top-up <b>{formatNumber(c.topup)}</b>
            </span>
          )}
          <span>Resets {shortDay(k.resets_at)}</span>
        </div>
      </div>

      <dl className={styles.keyStats}>
        <div>
          <dt>Last used</dt>
          <dd>{timeAgo(k.last_used_at)}</dd>
        </div>
        <div>
          <dt>Calls · 30d</dt>
          <dd className={styles.num}>{formatNumber(k.calls_30d)}</dd>
        </div>
        <div>
          <dt>Limit</dt>
          <dd>
            <span className={styles.num}>{k.rate_limit}</span>/min
          </dd>
        </div>
      </dl>

      {openRequests.length > 0 && (
        <ul className={styles.requestList}>
          {openRequests.map((r) => (
            <li key={r.id} className={styles.requestItem}>
              <span className={styles.requestDot} aria-hidden="true" />
              <span className={styles.requestText}>
                {requestLabel(r, plans)} · asked {shortDay(r.created_at)}
              </span>
              <button
                type="button"
                className={styles.textBtn}
                disabled={working}
                onClick={() => run(() => cancelRequest(r.id), onChanged)}
              >
                Cancel
              </button>
            </li>
          ))}
        </ul>
      )}

      {notice && <p className={styles.notice}>{notice}</p>}
      {error && !panel && <ErrorLine message={error} />}

      <div className={styles.keyActions}>
        <ActionBtn icon={<ChartColumn size={16} />} label="Usage" open={panel === 'usage'} onClick={() => toggle('usage')} />
        <ActionBtn icon={<Coins size={16} />} label="More credits" open={panel === 'credits'} onClick={() => toggle('credits')} />
        <ActionBtn icon={<RotateCw size={16} />} label="Roll" open={panel === 'roll'} onClick={() => toggle('roll')} />
        <ActionBtn icon={<Trash2 size={16} />} label="Revoke" danger open={panel === 'revoke'} onClick={() => toggle('revoke')} />
      </div>

      {panel === 'usage' && <UsagePanel usage={usage} onClose={() => setPanel(null)} />}

      {panel === 'credits' && (
        <CreditsPanel
          k={k}
          plans={plans}
          email={email}
          working={working}
          error={error}
          onClose={() => setPanel(null)}
          onSubmit={(payload) =>
            run(
              () => requestCredits({ keyId: k.id, ...payload }),
              () => {
                setPanel(null);
                setNotice(`Request sent. We'll email ${email || 'you'} to arrange payment, then the credits show up here.`);
                onChanged();
              }
            )
          }
        />
      )}

      {panel === 'roll' && (
        <ConfirmPanel
          title="Roll this key?"
          body="You get a new key with the same plan and credits. This one stops working at once, so update your app straight after. Use this if the key leaked."
          confirmLabel="Roll key"
          working={working}
          error={error}
          onCancel={() => setPanel(null)}
          onConfirm={handleRoll}
        />
      )}

      {panel === 'revoke' && (
        <ConfirmPanel
          danger
          title="Revoke this key?"
          body={`It stops working at once and can't be turned back on. Its ${formatNumber(c.total)} credits are lost. To replace a leaked key and keep the credits, roll it instead.`}
          confirmLabel="Revoke key"
          working={working}
          error={error}
          onCancel={() => setPanel(null)}
          onConfirm={handleRevoke}
        />
      )}
    </article>
  );
}

function ActionBtn({ icon, label, open, danger, onClick }) {
  return (
    <button
      type="button"
      className={`${styles.actionBtn} ${open ? styles.actionBtnOpen : ''} ${danger ? styles.actionBtnDanger : ''}`}
      aria-expanded={open}
      onClick={onClick}
    >
      {icon}
      {label}
    </button>
  );
}

function ErrorLine({ message }) {
  return (
    <p className={styles.formError} role="alert">
      <AlertCircle size={15} aria-hidden="true" />
      <span>{message}</span>
    </p>
  );
}

function PanelHead({ title, onClose }) {
  return (
    <div className={styles.panelHead}>
      <h4 className={styles.panelTitle}>{title}</h4>
      <button type="button" className={styles.panelClose} onClick={onClose} aria-label="Close">
        <X size={16} />
      </button>
    </div>
  );
}

function UsagePanel({ usage, onClose }) {
  const bars = usage.status === 'ready' ? usageBars(usage.daily) : [];
  const total = bars.reduce((s, b) => s + b.calls, 0);
  return (
    <div className={styles.panel}>
      <PanelHead title="Last 14 days" onClose={onClose} />
      {usage.status === 'loading' && (
        <p className={styles.muted}>
          <Loader2 size={15} className={styles.spinner} aria-hidden="true" /> Loading…
        </p>
      )}
      {usage.status === 'error' && <ErrorLine message={usage.message} />}
      {usage.status === 'ready' && (
        <>
          <div className={styles.chart} role="img" aria-label={`${total} calls in the last 14 days`}>
            {bars.map((b) => (
              <div key={b.day} className={styles.chartCol} title={`${shortDay(b.day)}: ${b.calls} calls, ${b.credits} credits`}>
                <span className={styles.chartBar} style={{ height: `${Math.max(b.height * 100, b.calls ? 6 : 2)}%` }} />
                <span className={styles.chartDay}>{dayInitial(b.day)}</span>
              </div>
            ))}
          </div>
          {usage.recent.length === 0 ? (
            <p className={styles.muted}>No calls yet. Try the quick start below.</p>
          ) : (
            <ul className={styles.callList}>
              {usage.recent.map((r, i) => (
                <li key={`${r.at}-${i}`} className={styles.callRow}>
                  <span className={`${styles.status} ${r.status < 300 ? styles.statusOk : styles.statusErr}`}>{r.status}</span>
                  <code className={styles.callPath}>{r.endpoint.replace(/^GET /, '')}</code>
                  <span className={styles.callCredits}>{r.credits ? `−${r.credits}` : '0'}</span>
                  <span className={styles.callTime}>{timeAgo(r.at)}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

function CreditsPanel({ k, plans, email, working, error, onClose, onSubmit }) {
  const upgrades = plans.filter((p) => p.id !== k.plan_id && Number(p.price_ngn) > 0);
  const [kind, setKind] = useState(upgrades.length ? 'upgrade' : 'topup');
  const [planId, setPlanId] = useState(upgrades[0]?.id ?? null);
  const [credits, setCredits] = useState(TOPUP_OPTIONS[1]);
  const [note, setNote] = useState('');

  return (
    <div className={styles.panel}>
      <PanelHead title="Get more credits" onClose={onClose} />
      <div className={styles.segmented} role="tablist" aria-label="What do you need?">
        <button
          type="button"
          role="tab"
          aria-selected={kind === 'upgrade'}
          className={`${styles.segment} ${kind === 'upgrade' ? styles.segmentActive : ''}`}
          disabled={!upgrades.length}
          onClick={() => setKind('upgrade')}
        >
          Change plan
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={kind === 'topup'}
          className={`${styles.segment} ${kind === 'topup' ? styles.segmentActive : ''}`}
          onClick={() => setKind('topup')}
        >
          One-off credits
        </button>
      </div>

      {kind === 'upgrade' ? (
        <div className={styles.choiceList} role="radiogroup" aria-label="Plan">
          {upgrades.map((p) => (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={planId === p.id}
              className={`${styles.choice} ${planId === p.id ? styles.choiceActive : ''}`}
              onClick={() => setPlanId(p.id)}
            >
              <span className={styles.choiceName}>{p.name}</span>
              <span className={styles.choiceMeta}>
                {formatNumber(p.monthly_credits)} credits/month · {p.rate_limit}/min
              </span>
              <span className={styles.choicePrice}>{formatNaira(p.price_ngn)}/mo</span>
            </button>
          ))}
        </div>
      ) : (
        <>
          <div className={styles.chips} role="radiogroup" aria-label="Credits">
            {TOPUP_OPTIONS.map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={credits === n}
                className={`${styles.chip} ${credits === n ? styles.chipActive : ''}`}
                onClick={() => setCredits(n)}
              >
                {formatNumber(n)}
              </button>
            ))}
          </div>
          <p className={styles.helper}>One-off credits never expire and are used after your monthly credits run out.</p>
        </>
      )}

      <label className={styles.field}>
        <span className={styles.labelRow}>
          <span className={styles.label}>Anything we should know?</span>
          <span className={styles.optional}>Optional</span>
        </span>
        <textarea
          className={`${styles.input} ${styles.textarea}`}
          rows={2}
          maxLength={NOTE_MAX}
          placeholder="e.g. Launching our delivery app next week"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </label>

      <p className={styles.helper}>
        Payments aren&apos;t online yet. We&apos;ll email {email ? <b>{email}</b> : 'you'} with how to pay; credits are added
        as soon as it&apos;s done.
      </p>
      {error && <ErrorLine message={error} />}
      <div className={styles.panelActions}>
        <button type="button" className={styles.ghostBtn} onClick={onClose} disabled={working}>
          Cancel
        </button>
        <button
          type="button"
          className={styles.primaryBtn}
          disabled={working || (kind === 'upgrade' && !planId)}
          onClick={() =>
            onSubmit(kind === 'upgrade' ? { kind, planId, note: note.trim() || null } : { kind, credits, note: note.trim() || null })
          }
        >
          {working ? <Loader2 size={16} className={styles.spinner} aria-hidden="true" /> : null}
          Send request
        </button>
      </div>
    </div>
  );
}

function ConfirmPanel({ title, body, confirmLabel, danger, working, error, onCancel, onConfirm }) {
  return (
    <div className={`${styles.panel} ${danger ? styles.panelDanger : ''}`}>
      <PanelHead title={title} onClose={onCancel} />
      <p className={styles.panelBody}>{body}</p>
      {error && <ErrorLine message={error} />}
      <div className={styles.panelActions}>
        <button type="button" className={styles.ghostBtn} onClick={onCancel} disabled={working}>
          Cancel
        </button>
        <button type="button" className={danger ? styles.dangerBtn : styles.primaryBtn} onClick={onConfirm} disabled={working}>
          {working ? <Loader2 size={16} className={styles.spinner} aria-hidden="true" /> : null}
          {confirmLabel}
        </button>
      </div>
    </div>
  );
}
