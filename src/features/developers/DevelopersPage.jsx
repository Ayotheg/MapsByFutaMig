import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  Braces,
  Check,
  ChevronDown,
  Copy,
  KeyRound,
  Loader2,
  LogIn,
  Plus,
  ShieldCheck,
  Terminal,
  TriangleAlert,
} from 'lucide-react';
import { useSeo } from '../../lib/useSeo';
import { useAuth, friendlyError } from '../auth/useAuth';
import DevKeyCard from './DevKeyCard';
import { createKey, fetchOverview, fetchPricing } from './developerApi';
import {
  API_BASE_URL,
  ENDPOINTS,
  ERROR_CODES,
  FALLBACK_PRICING,
  NAME_MAX,
  costFor,
  formatNaira,
  formatNumber,
  newKeyState,
  sampleCurl,
  sampleJs,
  validateKeyName,
} from './developerData';
import styles from './DevelopersPage.module.css';

// Only mounts when a signed-out person asks for a key.
const AuthModal = lazy(() => import('../auth/AuthModal'));

/**
 * /developers — the Public API's home: what it offers and costs, a quick
 * start and reference, and, once signed in, the developer's own keys.
 * Same look as /event (violet hero, white step cards, Satoshi titles,
 * Manrope numbers). Data comes from supabase/public_api_dashboard.sql;
 * the API itself is supabase/functions/public-api (docs/public-api.md).
 */
export default function DevelopersPage() {
  useSeo({ title: 'Developers – Maps By FUTA API' });
  const navigate = useNavigate();
  const auth = useAuth();
  const [pricing, setPricing] = useState(FALLBACK_PRICING);
  const [authModalOpen, setAuthModalOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchPricing()
      .then((p) => {
        if (!cancelled && p?.plans?.length) setPricing(p);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const free = pricing.plans.find((p) => p.id === 'free');

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <span className={styles.heroCircle} aria-hidden="true" />
        <span className={styles.heroCircleLow} aria-hidden="true" />
        <svg className={styles.heroPath} viewBox="0 0 200 420" fill="none" aria-hidden="true">
          <path d="M150 40 C 175 120, 170 230, 120 300 S 40 400, 10 415" />
        </svg>
        <Braces className={styles.heroMark} size={40} strokeWidth={2.25} aria-hidden="true" />

        <div className={styles.heroInner}>
          <div className={styles.topBar}>
            <button type="button" className={styles.backBtn} onClick={() => navigate(-1)} aria-label="Go back">
              <ArrowLeft size={20} />
            </button>
            <span className={styles.heroTag}>Maps By FUTA API</span>
          </div>
          <h1 className={styles.title}>Build on the campus map</h1>
          <p className={styles.heroLead}>
            Places, categories and photos of FUTA, mapped by students. One key, simple JSON, pay only for calls that
            return data.
          </p>
          <div className={styles.pills}>
            <span className={`${styles.heroPill} ${styles.heroPillMint}`}>
              {free ? `${formatNumber(free.monthly_credits)} free credits a month` : 'Free plan'}
            </span>
            <span className={styles.heroPill}>REST · JSON</span>
            <span className={styles.heroPill}>Read-only</span>
          </div>
        </div>
      </header>

      <div className={styles.layout}>
        <main className={styles.mainCol}>
          {auth.loading ? (
            <section className={styles.card}>
              <p className={styles.muted}>
                <Loader2 size={15} className={styles.spinner} aria-hidden="true" /> Checking your account…
              </p>
            </section>
          ) : auth.user ? (
            <KeysSection user={auth.user} pricing={pricing} />
          ) : (
            <SignInCard free={free} onSignIn={() => setAuthModalOpen(true)} />
          )}

          <QuickStart />
          <Reference costs={pricing.costs} />
        </main>

        <aside className={styles.sideCol}>
          <PlansCard plans={pricing.plans} />
        </aside>
      </div>

      {authModalOpen && (
        <Suspense fallback={null}>
          <AuthModal
            initialTab="signin"
            user={auth.user}
            onClose={() => setAuthModalOpen(false)}
            signInWithGoogle={() => auth.signInWithGoogle('/developers')}
            signInWithEmail={auth.signInWithEmail}
            signUpWithEmail={auth.signUpWithEmail}
            checkEmailStatus={auth.checkEmailStatus}
            resetPassword={auth.resetPassword}
            verifyRecoveryCode={auth.verifyRecoveryCode}
            setNewPassword={auth.setNewPassword}
            signOut={auth.signOut}
            friendlyError={friendlyError}
            message="Sign in to get your API key. It ties the key and its credits to your account."
          />
        </Suspense>
      )}
    </div>
  );
}

function SectionHead({ icon, title, subtitle, action }) {
  return (
    <div className={styles.sectionHead}>
      <span className={styles.sectionIcon} aria-hidden="true">
        {icon}
      </span>
      <div className={styles.sectionText}>
        <h2 className={styles.sectionTitle}>{title}</h2>
        {subtitle && <p className={styles.sectionSub}>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

function SignInCard({ free, onSignIn }) {
  return (
    <section className={styles.card}>
      <SectionHead icon={<KeyRound size={18} />} title="Get your API key" subtitle="Free to start. No card needed." />
      <ul className={styles.ticks}>
        <li>
          <Check size={16} aria-hidden="true" />
          {free ? `${formatNumber(free.monthly_credits)} credits every month on the Free plan` : 'Monthly credits on the Free plan'}
        </li>
        <li>
          <Check size={16} aria-hidden="true" />
          Failed calls, errors and empty 404s are never charged
        </li>
        <li>
          <Check size={16} aria-hidden="true" />
          See your credits and every call here
        </li>
      </ul>
      <button type="button" className={`${styles.primaryBtn} ${styles.primaryBtnWide}`} onClick={onSignIn}>
        <LogIn size={17} aria-hidden="true" />
        Sign in to get a key
      </button>
    </section>
  );
}

function KeysSection({ user, pricing }) {
  const [overview, setOverview] = useState({ status: 'loading' });
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [working, setWorking] = useState(false);
  const [error, setError] = useState(null);
  const [secret, setSecret] = useState(null); // { api_key, key, how }
  const [showRevoked, setShowRevoked] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await fetchOverview();
      setOverview({ status: 'ready', ...data });
    } catch (e) {
      setOverview((prev) => (prev.status === 'ready' ? prev : { status: 'error', message: e.message }));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, user.id]);

  const keys = overview.status === 'ready' ? overview.keys : [];
  const activeKeys = keys.filter((k) => k.status === 'active');
  const revokedKeys = keys.filter((k) => k.status !== 'active');
  const gate = newKeyState(keys, overview.limits);

  async function handleCreate(e) {
    e.preventDefault();
    const problem = validateKeyName(name);
    if (problem) {
      setError(problem);
      return;
    }
    setWorking(true);
    setError(null);
    try {
      const result = await createKey(name.trim());
      setSecret({ ...result, how: 'created' });
      setCreating(false);
      setName('');
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setWorking(false);
    }
  }

  const newKeyButton = overview.status === 'ready' && !creating && (keys.length > 0 || secret) && (
    <button
      type="button"
      className={styles.smallBtn}
      onClick={() => {
        setError(null);
        setCreating(true);
      }}
      disabled={!gate.allowed}
      title={gate.reason || undefined}
    >
      <Plus size={16} aria-hidden="true" />
      New key
    </button>
  );

  return (
    <section className={styles.card}>
      <SectionHead
        icon={<KeyRound size={18} />}
        title="Your keys"
        subtitle={`Signed in as ${user.email || 'you'}`}
        action={newKeyButton}
      />

      {overview.status === 'ready' && keys.length > 0 && !creating && !gate.allowed && (
        <p className={styles.helper}>{gate.reason}</p>
      )}

      {secret && <SecretReveal secret={secret} onDone={() => setSecret(null)} />}

      {overview.status === 'loading' && (
        <p className={styles.muted}>
          <Loader2 size={15} className={styles.spinner} aria-hidden="true" /> Loading your keys…
        </p>
      )}
      {overview.status === 'error' && (
        <div className={styles.errorBox} role="alert">
          <AlertCircle size={16} aria-hidden="true" />
          <span>{overview.message}</span>
          <button type="button" className={styles.textBtn} onClick={load}>
            Retry
          </button>
        </div>
      )}

      {overview.status === 'ready' && (creating || (keys.length === 0 && !secret)) && (
        <form className={styles.newKeyForm} onSubmit={handleCreate}>
          {keys.length === 0 && (
            <p className={styles.sectionLead}>Name your first key after the app it&apos;s for. You can make more later.</p>
          )}
          <label className={styles.field}>
            <span className={styles.label}>App or project name</span>
            <input
              className={styles.input}
              type="text"
              placeholder="e.g. Campus Eats"
              maxLength={NAME_MAX}
              autoFocus={creating}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          {!gate.allowed && <p className={styles.helper}>{gate.reason}</p>}
          {error && (
            <p className={styles.formError} role="alert">
              <AlertCircle size={15} aria-hidden="true" />
              <span>{error}</span>
            </p>
          )}
          <div className={styles.panelActions}>
            {keys.length > 0 && (
              <button type="button" className={styles.ghostBtn} onClick={() => setCreating(false)} disabled={working}>
                Cancel
              </button>
            )}
            <button type="submit" className={styles.primaryBtn} disabled={working || !gate.allowed}>
              {working ? <Loader2 size={16} className={styles.spinner} aria-hidden="true" /> : <KeyRound size={16} aria-hidden="true" />}
              Create key
            </button>
          </div>
        </form>
      )}

      {activeKeys.length > 0 && (
        <div className={styles.keyList}>
          {activeKeys.map((k) => (
            <DevKeyCard
              key={k.id}
              apiKey={k}
              plans={pricing.plans}
              requests={overview.requests.filter((r) => r.key_id === k.id)}
              email={user.email}
              onChanged={load}
              onNewSecret={(result, how) => setSecret({ ...result, how })}
            />
          ))}
        </div>
      )}

      {revokedKeys.length > 0 && (
        <div className={styles.revokedBlock}>
          <button
            type="button"
            className={styles.revokedToggle}
            aria-expanded={showRevoked}
            onClick={() => setShowRevoked((v) => !v)}
          >
            Revoked keys ({revokedKeys.length})
            <ChevronDown size={16} className={showRevoked ? styles.chevronOpen : ''} aria-hidden="true" />
          </button>
          {showRevoked && (
            <div className={styles.keyList}>
              {revokedKeys.map((k) => (
                <DevKeyCard key={k.id} apiKey={k} plans={pricing.plans} requests={[]} email={user.email} onChanged={load} onNewSecret={() => {}} />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

/** The full key, shown once right after it's made. */
function SecretReveal({ secret, onDone }) {
  const [copied, setCopied] = useState(false);
  const copy = useCopy();

  return (
    <div className={styles.secret} role="status">
      <div className={styles.secretHead}>
        <TriangleAlert size={18} aria-hidden="true" />
        <div>
          <p className={styles.secretTitle}>
            {secret.how === 'rolled' ? 'Your new key is ready.' : 'Your key is ready.'} Copy it now.
          </p>
          <p className={styles.secretSub}>
            We only keep a fingerprint of it, so it can&apos;t be shown again.
            {secret.how === 'rolled' ? ' The old key has stopped working.' : ''}
          </p>
        </div>
      </div>
      <div className={styles.secretRow}>
        <code className={styles.secretKey}>{secret.api_key}</code>
        <button
          type="button"
          className={styles.copyBtn}
          onClick={async () => {
            setCopied(await copy(secret.api_key));
          }}
        >
          {copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <p className={styles.secretTip}>
        <ShieldCheck size={15} aria-hidden="true" />
        Keep it on your server (an environment variable), not in app or website code where anyone can read it.
      </p>
      <button type="button" className={`${styles.primaryBtn} ${styles.secretDone}`} onClick={onDone}>
        I&apos;ve saved it
      </button>
    </div>
  );
}

function useCopy() {
  return useCallback(async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }, []);
}

function CodeBlock({ code, label }) {
  const [copied, setCopied] = useState(false);
  const copy = useCopy();
  return (
    <div className={styles.codeWrap}>
      <div className={styles.codeBar}>
        <span className={styles.codeLabel}>{label}</span>
        <button
          type="button"
          className={styles.codeCopy}
          onClick={async () => {
            const ok = await copy(code);
            setCopied(ok);
            if (ok) setTimeout(() => setCopied(false), 1600);
          }}
        >
          {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className={styles.code}>
        <code>{code}</code>
      </pre>
    </div>
  );
}

function QuickStart() {
  const [lang, setLang] = useState('curl');
  return (
    <section className={styles.card}>
      <SectionHead
        icon={<Terminal size={18} />}
        title="Quick start"
        subtitle="Send your key in the x-api-key header. Every answer is JSON."
      />
      <div className={styles.segmented} role="tablist" aria-label="Language">
        {[
          ['curl', 'curl'],
          ['js', 'JavaScript'],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={lang === id}
            className={`${styles.segment} ${lang === id ? styles.segmentActive : ''}`}
            onClick={() => setLang(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {lang === 'curl' ? <CodeBlock code={sampleCurl()} label="Terminal" /> : <CodeBlock code={sampleJs()} label="Node.js 18+" />}
      <p className={styles.helper}>
        Success looks like <code className={styles.inlineCode}>{'{ data, meta: { credits_charged, credits_remaining, rate_limit_remaining } }'}</code>
        . Errors look like <code className={styles.inlineCode}>{'{ error: { code, message } }'}</code>.
      </p>
    </section>
  );
}

function Reference({ costs }) {
  const [open, setOpen] = useState(null);
  return (
    <section className={styles.card} id="reference">
      <SectionHead icon={<BookOpen size={18} />} title="Endpoints" subtitle={`Base URL ${API_BASE_URL}`} />
      <ul className={styles.endpointList}>
        {ENDPOINTS.map((ep) => {
          const cost = costFor(costs, ep.pattern);
          const expandable = ep.params.length > 0;
          const isOpen = open === ep.pattern;
          return (
            <li key={ep.pattern} className={styles.endpoint}>
              <button
                type="button"
                className={styles.endpointRow}
                aria-expanded={expandable ? isOpen : undefined}
                disabled={!expandable}
                onClick={() => setOpen(isOpen ? null : ep.pattern)}
              >
                <span className={styles.method}>GET</span>
                <code className={styles.endpointPath}>{ep.path}</code>
                <span className={`${styles.costPill} ${cost === 0 ? styles.costFree : ''}`}>
                  {cost == null ? '–' : cost === 0 ? 'Free' : `${cost} credit${cost === 1 ? '' : 's'}`}
                </span>
                {expandable && <ChevronDown size={16} className={`${styles.endpointChevron} ${isOpen ? styles.chevronOpen : ''}`} aria-hidden="true" />}
              </button>
              <p className={styles.endpointSummary}>{ep.summary}</p>
              {isOpen && (
                <dl className={styles.params}>
                  {ep.params.map(([name, text]) => (
                    <div key={name} className={styles.param}>
                      <dt>
                        <code>{name}</code>
                      </dt>
                      <dd>{text}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </li>
          );
        })}
      </ul>

      <h3 className={styles.subTitle}>When you&apos;re charged</h3>
      <p className={styles.bodyText}>
        Only for calls that succeed and return data. An empty list from a valid search counts; a 404, a bad parameter, a
        rate-limited call or our own error never does.
      </p>

      <h3 className={styles.subTitle}>Errors</h3>
      <dl className={styles.errorTable}>
        {ERROR_CODES.map(([http, code, meaning]) => (
          <div key={http} className={styles.errorRow}>
            <dt className={styles.errorHttp}>{http}</dt>
            <dd>
              <code className={styles.inlineCode}>{code}</code>
              <span className={styles.errorMeaning}>{meaning}</span>
            </dd>
          </div>
        ))}
      </dl>

      <h3 className={styles.subTitle}>Rate limits</h3>
      <p className={styles.bodyText}>
        Per key, per clock minute, set by your plan. Responses carry <code className={styles.inlineCode}>X-RateLimit-Limit</code>{' '}
        and <code className={styles.inlineCode}>X-RateLimit-Remaining</code>; a 429 adds{' '}
        <code className={styles.inlineCode}>Retry-After</code> in seconds.
      </p>
    </section>
  );
}

function PlansCard({ plans }) {
  return (
    <section className={styles.plansCard}>
      <div className={styles.plansBand}>
        <span className={styles.bandRing} aria-hidden="true" />
        <span className={styles.bandRingSmall} aria-hidden="true" />
        <span className={styles.overline}>Plans</span>
        <span className={styles.plansLead}>1 credit = 1 call. Photos cost 5.</span>
      </div>
      <ul className={styles.planList}>
        {plans.map((p) => (
          <li key={p.id} className={styles.plan}>
            <div className={styles.planTop}>
              <span className={styles.planName}>{p.name}</span>
              <span className={styles.planPrice}>
                {formatNaira(p.price_ngn)}
                {Number(p.price_ngn) > 0 && <span className={styles.planPer}>/mo</span>}
              </span>
            </div>
            <div className={styles.planMeta}>
              <span>
                <b className={styles.num}>{formatNumber(p.monthly_credits)}</b> credits a month
              </span>
              <span>
                <b className={styles.num}>{p.rate_limit}</b> calls a minute
              </span>
            </div>
          </li>
        ))}
      </ul>
      <p className={styles.plansFoot}>
        Every key starts on Free. Need more? Open <b>More credits</b> on a key. One-off credits never expire.
      </p>
    </section>
  );
}
