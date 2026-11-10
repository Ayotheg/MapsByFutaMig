import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, ArrowRight, Check, ChevronDown, Copy, KeyRound, Loader2, LogIn, Plus, ShieldCheck, TriangleAlert } from 'lucide-react';
import { useSeo } from '../../lib/useSeo';
import { CONTACT_EMAIL } from '../../lib/contactInfo';
import { useAuth, friendlyError } from '../auth/useAuth';
import DevKeyCard from './DevKeyCard';
import DevTopBar from './DevTopBar';
import { CodeBlock, CodeTabs } from './DevCode';
import { useCopy } from './useCopy';
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

// What a successful call sends back, trimmed to fit beside the hero.
const SAMPLE_RESPONSE = JSON.stringify(
  {
    data: [{ id: '00a4f5d3-6e65…', name: 'Tosmof Villa', type: 'hostel', area: 'South Gate', lat: 7.288927, lng: 5.147786 }],
    meta: { credits_charged: 1, credits_remaining: 999 },
  },
  null,
  2
);

/**
 * /developers — the Public API's home: what it offers and costs, the
 * developer's own keys once signed in, the endpoints, plans and errors.
 * A white, quiet page: Satoshi titles, Inter text, Manrope numbers, with
 * each section's title in a left column at 960px+. Data comes from
 * supabase/public_api_dashboard.sql; the API itself is
 * supabase/functions/public-api (docs/public-api.md).
 */
export default function DevelopersPage() {
  useSeo({ title: 'Developers – Maps By FUTA API' });
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
  const photoCost = costFor(pricing.costs, 'GET /v1/places/:id/images') ?? 5;

  return (
    <div className={styles.page}>
      <DevTopBar current="overview" />

      <header className={styles.hero}>
        <div className={styles.heroCopy}>
          <span className={styles.eyebrow}>
            <span className={styles.eyebrowDot} aria-hidden="true" />
            Public API · v1
          </span>
          <h1 className={styles.title}>Build on the campus map.</h1>
          <p className={styles.heroLead}>
            Places, categories and photos of FUTA, mapped by students. One key, simple JSON, and you only pay for calls that
            return data.
          </p>
          <div className={styles.heroActions}>
            <a href="#keys" className={styles.primaryBtn}>
              <KeyRound size={16} aria-hidden="true" />
              {auth.user ? 'Manage your keys' : 'Get your API key'}
            </a>
            <Link to="/developers/docs" className={styles.outlineBtn}>
              Read the docs
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
          <p className={styles.heroNote}>
            {free ? `${formatNumber(free.monthly_credits)} free credits every month.` : 'Free to start.'} No card needed.
          </p>
        </div>

        <div className={styles.heroCode}>
          <CodeTabs
            samples={[
              { id: 'curl', label: 'curl', code: sampleCurl() },
              { id: 'js', label: 'JavaScript', code: sampleJs() },
            ]}
          />
          <CodeBlock code={SAMPLE_RESPONSE} label="200 OK" />
        </div>
      </header>

      <dl className={styles.facts}>
        <Fact value={free ? formatNumber(free.monthly_credits) : 'Free'} label="free credits a month" />
        <Fact value={String(ENDPOINTS.length)} label="read-only endpoints" />
        <Fact value="1" label={`credit a call, ${photoCost} for photos`} />
        <Fact value="0" label="charged for errors" />
      </dl>

      <main className={styles.main}>
        <Section
          id="keys"
          title={auth.user ? 'Your keys' : 'Get your API key'}
          lead={
            auth.user
              ? 'Credits, usage and the things you can do with each key.'
              : 'Sign in, name a key after your app and start calling the API.'
          }
        >
          {auth.loading ? (
            <p className={styles.muted}>
              <Loader2 size={15} className={styles.spinner} aria-hidden="true" /> Checking your account…
            </p>
          ) : auth.user ? (
            <KeysSection user={auth.user} pricing={pricing} />
          ) : (
            <SignInCard free={free} onSignIn={() => setAuthModalOpen(true)} />
          )}
        </Section>

        <Reference costs={pricing.costs} />
        <Plans plans={pricing.plans} photoCost={photoCost} />
        <Errors />

        <section className={styles.closing}>
          <div>
            <h2 className={styles.closingTitle}>Everything else is in the docs.</h2>
            <p className={styles.closingText}>
              Every endpoint with examples in curl, JavaScript and Python, the objects, recipes and best practices. Stuck?{' '}
              <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
            </p>
          </div>
          <Link to="/developers/docs" className={styles.inkBtn}>
            Read the docs
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </section>
      </main>

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

function Fact({ value, label }) {
  return (
    <div className={styles.fact}>
      <dt className={styles.factLabel}>{label}</dt>
      <dd className={styles.factValue}>{value}</dd>
    </div>
  );
}

/** A page section: title and lead on the left at 960px+, content beside it. */
function Section({ id, title, lead, action, children }) {
  return (
    <section id={id} className={styles.section} aria-labelledby={`${id}-title`}>
      <div className={styles.sectionHead}>
        <h2 id={`${id}-title`} className={styles.sectionTitle}>
          {title}
        </h2>
        {lead && <p className={styles.sectionLead}>{lead}</p>}
        {action}
      </div>
      <div className={styles.sectionBody}>{children}</div>
    </section>
  );
}

function SignInCard({ free, onSignIn }) {
  return (
    <div className={styles.signIn}>
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
      <button type="button" className={styles.primaryBtn} onClick={onSignIn}>
        <LogIn size={16} aria-hidden="true" />
        Sign in to get a key
      </button>
    </div>
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
    <div className={styles.keysBlock}>
      <div className={styles.keysBar}>
        <p className={styles.keysAccount}>
          Signed in as <b>{user.email || 'you'}</b>
        </p>
        {newKeyButton}
      </div>

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
            <p className={styles.formLead}>Name your first key after the app it&apos;s for. You can make more later.</p>
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
    </div>
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

function Reference({ costs }) {
  const [open, setOpen] = useState(null);
  return (
    <Section
      id="reference"
      title="Endpoints"
      lead={
        <>
          Six GET endpoints. Send your key in the <code className={styles.inlineCode}>x-api-key</code> header; every answer
          is JSON.
        </>
      }
      action={
        <Link to="/developers/docs#endpoints" className={styles.textLink}>
          Full reference
          <ArrowRight size={15} aria-hidden="true" />
        </Link>
      }
    >
      <p className={styles.baseUrl}>
        <span className={styles.baseUrlLabel}>Base URL</span>
        <code>{API_BASE_URL}</code>
      </p>
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
                <span className={styles.endpointSummary}>{ep.summary}</span>
                <span className={`${styles.costPill} ${cost === 0 ? styles.costFree : ''}`}>
                  {cost == null ? '–' : cost === 0 ? 'Free' : `${cost} credit${cost === 1 ? '' : 's'}`}
                </span>
                <ChevronDown
                  size={16}
                  className={`${styles.endpointChevron} ${isOpen ? styles.chevronOpen : ''} ${expandable ? '' : styles.endpointChevronOff}`}
                  aria-hidden="true"
                />
              </button>
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
      <p className={styles.helper}>
        Success looks like{' '}
        <code className={styles.inlineCode}>{'{ data, meta: { credits_charged, credits_remaining, rate_limit_remaining } }'}</code>.
        Errors look like <code className={styles.inlineCode}>{'{ error: { code, message } }'}</code>.
      </p>
    </Section>
  );
}

function Plans({ plans, photoCost }) {
  return (
    <Section
      id="pricing"
      title="Plans"
      lead={`1 credit is 1 call. Photos cost ${photoCost}. You are only charged for calls that succeed and return data.`}
    >
      <ul className={styles.planList}>
        {plans.map((p) => (
          <li key={p.id} className={styles.plan}>
            <span className={styles.planName}>{p.name}</span>
            <span className={styles.planPrice}>
              {formatNaira(p.price_ngn)}
              {Number(p.price_ngn) > 0 && <span className={styles.planPer}>/month</span>}
            </span>
            <dl className={styles.planMeta}>
              <div>
                <dt>Credits a month</dt>
                <dd>{formatNumber(p.monthly_credits)}</dd>
              </div>
              <div>
                <dt>Calls a minute</dt>
                <dd>{p.rate_limit}</dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>
      <p className={styles.helper}>
        Every key starts on Free. Need more? Open <b>More credits</b> on a key. One-off credits never expire.
      </p>
    </Section>
  );
}

function Errors() {
  return (
    <Section id="errors" title="Errors and limits" lead="Errors are never charged. An empty list from a valid search is a success, so it counts.">
      <dl className={styles.errorTable}>
        {ERROR_CODES.map(([http, code, meaning]) => (
          <div key={http} className={styles.errorRow}>
            <dt className={styles.errorHttp}>{http}</dt>
            <dd>
              <code className={styles.errorCode}>{code}</code>
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
    </Section>
  );
}
