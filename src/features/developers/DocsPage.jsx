import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, BookOpen, ChevronDown, Info, KeyRound, ShieldAlert, TriangleAlert } from 'lucide-react';
import { useSeo } from '../../lib/useSeo';
import { CONTACT_EMAIL, WHATSAPP_CHAT_URL } from '../../lib/contactInfo';
import { CodeBlock, CodeTabs } from './DevCode';
import { fetchPricing } from './developerApi';
import { API_BASE_URL, FALLBACK_PRICING, costFor, formatNaira, formatNumber } from './developerData';
import { ENDPOINT_SAMPLES, ERROR_GUIDE, EXAMPLE_ERROR, RECIPES, json } from './docsSamples';
import dev from './DevelopersPage.module.css';
import styles from './DocsPage.module.css';

/**
 * /developers/docs — the Public API's full reference for developers using
 * it: getting started, auth, credits, limits, errors, every endpoint with
 * curl / JavaScript / Python examples, the objects, recipes and FAQ.
 *
 * Examples live in docsSamples.js and are checked against the API's real
 * output by scripts/developerData.test.mjs. Prices come from the live price
 * list (api_pricing), so they never go stale.
 */

const TOC = [
  { id: 'overview', label: 'Overview' },
  { id: 'get-started', label: 'Get started' },
  { id: 'authentication', label: 'Authentication' },
  { id: 'requests', label: 'Requests and responses' },
  { id: 'credits', label: 'Credits and plans' },
  { id: 'rate-limits', label: 'Rate limits' },
  { id: 'errors', label: 'Errors' },
  {
    id: 'endpoints',
    label: 'Endpoints',
    children: [
      { id: 'list-places', label: 'List places' },
      { id: 'get-place', label: 'Get a place' },
      { id: 'nearby-places', label: 'Places nearby' },
      { id: 'categories', label: 'Categories' },
      { id: 'place-photos', label: 'Place photos' },
      { id: 'usage', label: 'Your usage' },
    ],
  },
  { id: 'objects', label: 'Objects' },
  { id: 'recipes', label: 'Recipes' },
  { id: 'best-practices', label: 'Best practices' },
  { id: 'keys', label: 'Managing keys' },
  { id: 'faq', label: 'FAQ and troubleshooting' },
  { id: 'changelog', label: 'Changelog and support' },
];
const ALL_IDS = TOC.flatMap((t) => [t.id, ...(t.children || []).map((c) => c.id)]);

const LANGS = [
  { id: 'curl', label: 'curl', blockLabel: 'Terminal' },
  { id: 'js', label: 'JavaScript', blockLabel: 'Node.js 18+' },
  { id: 'python', label: 'Python', blockLabel: 'Python 3 · requests' },
];

export default function DocsPage() {
  useSeo({ title: 'API documentation – Maps By FUTA' });
  const navigate = useNavigate();
  const { hash } = useLocation();
  const [pricing, setPricing] = useState(FALLBACK_PRICING);
  const [lang, setLang] = useState('curl');
  const [active, setActive] = useState('overview');
  const [tocOpen, setTocOpen] = useState(false);

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

  // Deep links (/developers/docs#errors) land on their section.
  useEffect(() => {
    if (!hash) return;
    const el = document.getElementById(decodeURIComponent(hash.slice(1)));
    if (el) requestAnimationFrame(() => el.scrollIntoView());
  }, [hash]);

  // Highlight the section being read in the contents list.
  useEffect(() => {
    const sections = ALL_IDS.map((id) => document.getElementById(id)).filter(Boolean);
    if (!('IntersectionObserver' in window) || !sections.length) return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: '-15% 0px -70% 0px' }
    );
    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, []);

  const cost = (pattern) => costFor(pricing.costs, pattern);
  const free = pricing.plans.find((p) => p.id === 'free');

  const samples = (pattern) => {
    const s = ENDPOINT_SAMPLES[pattern];
    return LANGS.map((l) => ({ ...l, code: s[l.id] }));
  };

  const toc = (
    <nav aria-label="On this page">
      <ul className={styles.tocList}>
        {TOC.map((t) => (
          <li key={t.id}>
            <a
              href={`#${t.id}`}
              className={`${styles.tocLink} ${active === t.id ? styles.tocLinkActive : ''}`}
              onClick={() => setTocOpen(false)}
            >
              {t.label}
            </a>
            {t.children && (
              <ul className={styles.tocChildren}>
                {t.children.map((c) => (
                  <li key={c.id}>
                    <a
                      href={`#${c.id}`}
                      className={`${styles.tocLink} ${styles.tocChild} ${active === c.id ? styles.tocLinkActive : ''}`}
                      onClick={() => setTocOpen(false)}
                    >
                      {c.label}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <span className={styles.heroCircle} aria-hidden="true" />
        <div className={styles.heroInner}>
          <div className={styles.topBar}>
            <button type="button" className={dev.backBtn} onClick={() => navigate('/developers')} aria-label="Back to the developer page">
              <ArrowLeft size={20} />
            </button>
            <span className={dev.heroTag}>Maps By FUTA API · v1</span>
          </div>
          <h1 className={styles.title}>API documentation</h1>
          <p className={styles.lead}>
            Everything you need to use FUTA&apos;s campus places, categories and photos in your app, from your first call to
            running it in production.
          </p>
          <div className={styles.heroActions}>
            <Link to="/developers" className={styles.heroBtn}>
              <KeyRound size={16} aria-hidden="true" />
              Get an API key
            </Link>
            <a href="#endpoints" className={`${styles.heroBtn} ${styles.heroBtnGhost}`}>
              <BookOpen size={16} aria-hidden="true" />
              Jump to endpoints
            </a>
          </div>
        </div>
      </header>

      <div className={styles.mobileToc}>
        <button type="button" className={styles.mobileTocBtn} aria-expanded={tocOpen} onClick={() => setTocOpen((v) => !v)}>
          On this page
          <ChevronDown size={16} className={tocOpen ? dev.chevronOpen : ''} aria-hidden="true" />
        </button>
        {tocOpen && <div className={styles.mobileTocPanel}>{toc}</div>}
      </div>

      <div className={styles.layout}>
        <aside className={styles.sidebar}>{toc}</aside>

        <main className={styles.content}>
          {/* ── Overview ─────────────────────────────────────────────── */}
          <Section id="overview" title="Overview">
            <P>
              The Maps By FUTA API gives your app read-only access to the places on our campus map of the Federal University
              of Technology, Akure: lecture halls, faculties, hostels and off-campus lodges, food spots, banks, clinics, gates,
              bus stops and more, each with coordinates, a category and, where we have them, photos and student ratings.
            </P>
            <P>It&apos;s built for apps like delivery and errand services, lodging finders, campus guides and student tools.</P>
            <dl className={styles.facts}>
              <Fact term="Base URL" value={<C>{API_BASE_URL}</C>} />
              <Fact term="Format" value="JSON over HTTPS. Read-only: every endpoint is GET." />
              <Fact term="Auth" value={<>An API key in the <C>x-api-key</C> header.</>} />
              <Fact term="Pricing" value={`Credits. 1 credit = 1 call, photos cost ${cost('GET /v1/places/:id/images') ?? 5}. ${free ? `${formatNumber(free.monthly_credits)} free credits every month.` : ''}`} />
              <Fact term="Charged" value="Only for calls that succeed and return data. Errors are always free." />
              <Fact term="Data" value="Live from the map. A place appears in the API as soon as it's approved on the map." />
            </dl>
          </Section>

          {/* ── Get started ──────────────────────────────────────────── */}
          <Section id="get-started" title="Get started">
            <Steps>
              <Step n="1" title="Get a key">
                Go to the <Link to="/developers">developer page</Link>, sign in, name your key after your app and press
                <b> Create key</b>. Every account starts on the Free plan. The key looks like{' '}
                <C>fk_live_</C> followed by 48 letters and numbers.
              </Step>
              <Step n="2" title="Copy it straight away">
                The full key is shown <b>once</b>. We only store a fingerprint of it, so nobody (including us) can show it
                again. Lost it? Roll the key to get a new one with the same credits.
              </Step>
              <Step n="3" title="Keep it on your server">
                Put it in an environment variable, never in website or mobile-app code, where anyone can read it and spend
                your credits.
                <CodeBlock code={RECIPES.envFile} label=".env" />
              </Step>
              <Step n="4" title="Make your first call">
                <C>/v1/usage</C> is free, so it&apos;s the best way to check your key works. You should get your plan and
                credits back.
                <CodeBlock code={RECIPES.firstCall} label="Terminal" />
              </Step>
              <Step n="5" title="Fetch some places">
                Then try a real call. Pick your language here; every example on this page follows the choice.
                <CodeTabs samples={samples('GET /v1/places')} lang={lang} onLang={setLang} />
              </Step>
            </Steps>
          </Section>

          {/* ── Authentication ───────────────────────────────────────── */}
          <Section id="authentication" title="Authentication">
            <P>
              Send your key in the <C>x-api-key</C> header on every request. Not in the URL, and not as{' '}
              <C>Authorization: Bearer</C>.
            </P>
            <CodeBlock code={`GET /v1/places HTTP/1.1\nHost: mapsbyfuta.xyz\nx-api-key: fk_live_your_key_here`} label="HTTP" />
            <ul className={styles.list}>
              <li>
                A missing header gives <C>401 missing_api_key</C>; a wrong, mistyped or rolled key gives{' '}
                <C>401 invalid_api_key</C>; a revoked key gives <C>403 key_revoked</C>.
              </li>
              <li>Header names are case-insensitive, but the key itself must be exact: watch for spaces or a line break copied with it.</li>
              <li>
                Too many requests without a working key from one IP address (10 a minute) are blocked with{' '}
                <C>429</C> for the rest of that minute. This stops key guessing; it won&apos;t affect you once your key is right.
              </li>
            </ul>
            <Callout tone="warn" icon={<ShieldAlert size={18} />} title="Never put your key in front-end code">
              The API allows calls from browsers (CORS is open), but a key in a web page or app bundle can be copied by anyone
              and used to spend your credits. Call the API from your server and pass the results on. See{' '}
              <a href="#recipe-proxy">Keep your key on a server</a>.
            </Callout>
          </Section>

          {/* ── Requests and responses ───────────────────────────────── */}
          <Section id="requests" title="Requests and responses">
            <H3>Successful responses</H3>
            <P>
              Every success is HTTP <C>200</C> with the same shape: your results in <C>data</C> (an array or an object,
              depending on the endpoint) and the cost of the call in <C>meta</C>.
            </P>
            <CodeBlock
              code={json({ data: ['…'], meta: { credits_charged: 1, credits_remaining: 4999, rate_limit_remaining: 59 } })}
              label="200 OK"
            />
            <FieldTable
              rows={[
                ['meta.credits_charged', 'integer', 'Credits this call cost. 0 for free calls.'],
                ['meta.credits_remaining', 'integer', 'Credits left on the key after this call (monthly plus top-up).'],
                ['meta.rate_limit_remaining', 'integer', 'Calls left in the current minute.'],
                ['meta.pagination', 'object', <>Only on <C>/v1/places</C>. See <a href="#list-places">List places</a>.</>],
              ]}
            />
            <H3>Error responses</H3>
            <P>
              Errors use a 4xx or 5xx status and an <C>error</C> object. <C>code</C> is stable, so check that in your code.{' '}
              <C>message</C> is a plain-English explanation for logs and may be reworded.
            </P>
            <CodeBlock code={json(EXAMPLE_ERROR)} label="400 Bad Request" />
            <H3>Good to know</H3>
            <ul className={styles.list}>
              <li>
                <b>Numbers are numbers.</b> <C>lat</C>, <C>lng</C>, <C>rating</C> and counts are JSON numbers, not strings.
              </li>
              <li>
                <b>Ids are strings.</b> Some look like UUIDs, some like <C>HBf6msn2xjZS24Qyrbwu</C>. Store them as text and
                don&apos;t parse them.
              </li>
              <li>
                <b>Empty values.</b> Optional text can be <C>null</C> or an empty string <C>&quot;&quot;</C>. Treat both as
                &ldquo;not set&rdquo;.
              </li>
              <li>
                <b>Unknown fields.</b> We may add fields to v1 objects. Ignore any you don&apos;t recognise; we won&apos;t remove
                or rename fields within v1.
              </li>
              <li>
                <b>Parameters</b> go in the query string, URL-encoded. Unknown parameters are ignored.
              </li>
              <li>
                <b>Caching.</b> Responses carry <C>Cache-Control: no-store</C> (each one reports your live balance). Cache the
                data on your own side; see <a href="#best-practices">Best practices</a>.
              </li>
              <li>
                <b>Rate-limit headers</b> are on responses too; see <a href="#rate-limits">Rate limits</a>.
              </li>
            </ul>
          </Section>

          {/* ── Credits and plans ────────────────────────────────────── */}
          <Section id="credits" title="Credits and plans">
            <P>Each call costs credits. The price list is live; it&apos;s the same one the API charges from.</P>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Endpoint</th>
                    <th>Credits</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['GET /v1/places', 'list-places'],
                    ['GET /v1/places/:id', 'get-place'],
                    ['GET /v1/places/nearby', 'nearby-places'],
                    ['GET /v1/categories', 'categories'],
                    ['GET /v1/places/:id/images', 'place-photos'],
                    ['GET /v1/usage', 'usage'],
                  ].map(([pattern, anchor]) => (
                    <tr key={pattern}>
                      <td>
                        <a href={`#${anchor}`}>
                          <C>{pattern.replace('GET ', '')}</C>
                        </a>
                      </td>
                      <td className={styles.num}>{cost(pattern) === 0 ? 'Free' : cost(pattern)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <H3>Plans</H3>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Plan</th>
                    <th>Price</th>
                    <th>Credits a month</th>
                    <th>Calls a minute</th>
                  </tr>
                </thead>
                <tbody>
                  {pricing.plans.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <b>{p.name}</b>
                      </td>
                      <td className={styles.num}>
                        {formatNaira(p.price_ngn)}
                        {Number(p.price_ngn) > 0 ? ' /month' : ''}
                      </td>
                      <td className={styles.num}>{formatNumber(p.monthly_credits)}</td>
                      <td className={styles.num}>{p.rate_limit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <H3>When you&apos;re charged</H3>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>What happened</th>
                    <th>Charged?</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>200 with results</td>
                    <td>
                      <b>Yes</b>
                    </td>
                  </tr>
                  <tr>
                    <td>200 with an empty list (the search ran but matched nothing; a place with no photos)</td>
                    <td>
                      <b>Yes</b>
                    </td>
                  </tr>
                  <tr>
                    <td>400 bad parameter, 404 not found, 405</td>
                    <td>No</td>
                  </tr>
                  <tr>
                    <td>401, 402, 403, 429</td>
                    <td>No</td>
                  </tr>
                  <tr>
                    <td>500, our error</td>
                    <td>No</td>
                  </tr>
                  <tr>
                    <td>
                      <C>/v1/usage</C>
                    </td>
                    <td>Never</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <ul className={styles.list}>
              <li>
                <b>Charged after, not before.</b> Credits are taken only once the data has been fetched. If the key runs out in
                that moment (say, another of your servers spent the last credit), you get <C>402</C> and no data, and nothing
                is taken.
              </li>
              <li>
                <b>All or nothing.</b> A photo call needs 5 credits. With 4 left you get <C>402</C>; the 4 aren&apos;t touched.
              </li>
              <li>
                <b>Monthly credits</b> refill to your plan&apos;s allowance on your reset date (shown by <C>/v1/usage</C> and
                on the developer page). Unused monthly credits don&apos;t carry over. A reset day of the 29th to 31st falls on
                the last day of shorter months.
              </li>
              <li>
                <b>One-off (top-up) credits</b> never expire and are only used after the month&apos;s credits run out.
              </li>
              <li>
                <b>Getting more.</b> On the developer page, open <b>More credits</b> on your key and ask for a plan change or
                one-off credits. Payments aren&apos;t online yet: we email you how to pay, and the credits appear on your key
                once it&apos;s done.
              </li>
            </ul>
          </Section>

          {/* ── Rate limits ──────────────────────────────────────────── */}
          <Section id="rate-limits" title="Rate limits">
            <P>
              Each key can make a set number of calls per clock minute (for example 12:04:00 to 12:04:59), set by its plan.
              Every response tells you where you stand:
            </P>
            <FieldTable
              head={['Header', 'Example', 'Meaning']}
              rows={[
                ['X-RateLimit-Limit', '60', 'Calls allowed per minute for this key.'],
                ['X-RateLimit-Remaining', '57', 'Calls left this minute.'],
                ['Retry-After', '23', <>Only on <C>429</C>: seconds until the next minute starts.</>],
              ]}
            />
            <ul className={styles.list}>
              <li>
                Going over returns <C>429 rate_limited</C>, free of charge. Wait <C>Retry-After</C> seconds, then try again.
              </li>
              <li>Every call counts toward the limit, including free calls and calls that fail.</li>
              <li>
                Because the window resets on the minute, a burst at the end of one minute and the start of the next can briefly
                reach twice the limit. Don&apos;t design around that; spread steady traffic out instead.
              </li>
              <li>
                Need more per minute? A bigger plan raises it. See <a href="#credits">plans</a>.
              </li>
            </ul>
            <P>
              A ready-made fetch helper that retries correctly is in <a href="#recipe-retry">Recipes</a>.
            </P>
          </Section>

          {/* ── Errors ───────────────────────────────────────────────── */}
          <Section id="errors" title="Errors">
            <P>
              Errors are never charged. Retry only <C>429</C> and <C>5xx</C>; any other error will fail the same way again
              until you change the request.
            </P>
            <div className={styles.errorList}>
              {ERROR_GUIDE.map((e) => (
                <div key={e.code} className={styles.errorItem}>
                  <div className={styles.errorHead}>
                    <span className={`${styles.statusPill} ${e.status >= 500 ? styles.status5 : e.status === 429 ? styles.status429 : ''}`}>
                      {e.status}
                    </span>
                    <C>{e.code}</C>
                  </div>
                  <p className={styles.errorText}>
                    <b>When:</b> {e.when}
                  </p>
                  <p className={styles.errorText}>
                    <b>What to do:</b> {e.fix}
                  </p>
                </div>
              ))}
            </div>
          </Section>

          {/* ── Endpoints ────────────────────────────────────────────── */}
          <Section id="endpoints" title="Endpoints">
            <P>
              All paths are relative to <C>{API_BASE_URL}</C>. The language you pick applies to every example.
            </P>
            <div className={dev.segmented} role="tablist" aria-label="Example language">
              {LANGS.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  role="tab"
                  aria-selected={lang === l.id}
                  className={`${dev.segment} ${lang === l.id ? dev.segmentActive : ''}`}
                  onClick={() => setLang(l.id)}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </Section>

          <Endpoint
            id="list-places"
            title="List places"
            path="/places"
            cost={cost('GET /v1/places')}
            intro={
              <>
                Approved places, sorted A to Z by name (then by id, so pages never overlap). Use it for a directory, a search
                box, or to copy the map into your own database.
              </>
            }
            params={[
              ['type', 'string', 'No', '—', <>A category id from <a href="#categories">/v1/categories</a>, e.g. <C>hostel</C>. Lower-case letters, digits and <C>_</C>, up to 40 characters; capitals are lowered for you.</>],
              ['q', 'string', 'No', '—', <>Text to find in the name, area or type, ignoring case. Matches parts of words (<C>lib</C> finds <i>Library</i>). Up to 80 characters. <C>%</C> and <C>_</C> match literally; <C>*</C> is treated as a space.</>],
              ['limit', 'integer', 'No', '20', 'How many places to return, 1 to 50.'],
              ['offset', 'integer', 'No', '0', <>How many to skip, 0 to 10,000. Use <C>meta.pagination.next_offset</C> to get the next page.</>],
            ]}
            samples={samples('GET /v1/places')}
            response={ENDPOINT_SAMPLES['GET /v1/places'].response}
            lang={lang}
            onLang={setLang}
            extraFields={[
              ['meta.pagination.limit', 'integer', 'The limit used.'],
              ['meta.pagination.offset', 'integer', 'The offset used.'],
              ['meta.pagination.total', 'integer', 'How many places match your filters in total.'],
              ['meta.pagination.next_offset', 'integer | null', <>Pass this as <C>offset</C> for the next page; <C>null</C> on the last page.</>],
            ]}
            notes={[
              <><C>type</C> and <C>q</C> combine: both must match.</>,
              'An empty data list is a successful search and costs 1 credit. So does asking for a page past the end.',
              <>To fetch everything, follow <C>next_offset</C> until it&apos;s <C>null</C>; at 50 a page that&apos;s one credit per 50 places. See <a href="#recipe-paginate">Fetch every place</a>.</>,
              'Places can be added while you page through. When syncing, de-duplicate by id.',
            ]}
            errors="400 if limit, offset, type or q is out of range (the message says which)."
          />

          <Endpoint
            id="get-place"
            title="Get a place"
            path="/places/:id"
            cost={cost('GET /v1/places/:id')}
            intro={<>One place by its id. Use it to refresh a place you saved earlier.</>}
            params={[
              ['id', 'string (path)', 'Yes', '—', 'The place id from another response. Letters, digits, - and _, up to 64 characters.'],
            ]}
            samples={samples('GET /v1/places/:id')}
            response={ENDPOINT_SAMPLES['GET /v1/places/:id'].response}
            lang={lang}
            onLang={setLang}
            notes={[
              <><C>data</C> is a single <a href="#object-place">Place</a> object, not a list.</>,
              'Places can be merged or removed. If a stored id returns 404, drop it from your copy. 404s are free.',
            ]}
            errors="400 if the id has characters ids never use · 404 if there's no such place."
          />

          <Endpoint
            id="nearby-places"
            title="Places nearby"
            path="/places/nearby"
            cost={cost('GET /v1/places/nearby')}
            intro={
              <>
                Places within a radius of a point, nearest first. Each comes with <C>distance_m</C>: the straight-line
                distance in metres, rounded (not the walking distance). Good for &ldquo;what&apos;s around me&rdquo; and
                delivery or pickup points.
              </>
            }
            params={[
              ['lat', 'number', 'Yes', '—', <>Latitude, −90 to 90, as a plain decimal like <C>7.3003</C> (no <C>1e-3</C> style, no <C>+</C> sign).</>],
              ['lng', 'number', 'Yes', '—', <>Longitude, −180 to 180, same format.</>],
              ['radius_m', 'integer', 'No', '500', 'Search radius in metres, 1 to 5,000.'],
              ['type', 'string', 'No', '—', 'Only this category, e.g. food.'],
              ['limit', 'integer', 'No', '20', 'How many places to return, 1 to 50.'],
            ]}
            samples={samples('GET /v1/places/nearby')}
            response={ENDPOINT_SAMPLES['GET /v1/places/nearby'].response}
            lang={lang}
            onLang={setLang}
            notes={[
              <>No paging: you get the nearest <C>limit</C> places. To see more, raise <C>limit</C> (up to 50) or narrow with <C>type</C>.</>,
              <>The middle of the main campus is around <C>7.3003, 5.1350</C>; the off-campus lodges are mostly within 3 km of it.</>,
              'Nothing in range gives an empty list, which still costs 1 credit.',
              <>In Python, pass coordinates as strings or round them: very small floats can be printed as <C>1e-05</C>, which is rejected.</>,
            ]}
            errors="400 if lat or lng is missing or out of range, or radius_m, type or limit is invalid."
          />

          <Endpoint
            id="categories"
            title="Categories"
            path="/categories"
            cost={cost('GET /v1/categories')}
            intro={<>Every place type that at least one approved place uses, with how many places have it, sorted by id.</>}
            params={[]}
            samples={samples('GET /v1/categories')}
            response={ENDPOINT_SAMPLES['GET /v1/categories'].response}
            lang={lang}
            onLang={setLang}
            notes={[
              <>Use <C>id</C> as the <C>type</C> filter on other endpoints; <C>label</C> is for showing to people.</>,
              <>A few ids come straight from OpenStreetMap tags (for example <C>yes</C> or <C>roof</C>) and are less tidy. We&apos;re cleaning them up, so read the list rather than hard-coding it.</>,
              'It changes rarely. Fetch it once a day and cache it.',
            ]}
            errors="None specific to this endpoint."
          />

          <Endpoint
            id="place-photos"
            title="Place photos"
            path="/places/:id/images"
            cost={cost('GET /v1/places/:id/images')}
            intro={
              <>
                Photos of one place, in the order the map shows them. Each has a <C>url</C> sized for cards and lists (up to
                900 px wide, compressed) and a <C>full_url</C> for full-screen viewing (up to 1,600 px).
              </>
            }
            params={[['id', 'string (path)', 'Yes', '—', 'The place id.']]}
            samples={samples('GET /v1/places/:id/images')}
            response={ENDPOINT_SAMPLES['GET /v1/places/:id/images'].response}
            lang={lang}
            onLang={setLang}
            notes={[
              <><b>Check <C>image_count</C> first.</b> A place with no photos returns an empty list and still costs {cost('GET /v1/places/:id/images') ?? 5} credits.</>,
              <>The URLs are public; put them straight in an <C>&lt;img&gt;</C> tag. Treat them as opaque and always take them from this endpoint, because their format can change.</>,
              'Photos rarely change, so cache the list of URLs with the place.',
            ]}
            errors="400 for a malformed id · 404 if there's no such place (free)."
          />

          <Endpoint
            id="usage"
            title="Your usage"
            path="/usage"
            cost={cost('GET /v1/usage')}
            intro={
              <>
                Your key&apos;s plan, credits, next reset and its last 20 calls (any status). Free, and it works even with 0
                credits, so use it to check a key, power a dashboard or warn yourself when credits run low.
              </>
            }
            params={[]}
            samples={samples('GET /v1/usage')}
            response={ENDPOINT_SAMPLES['GET /v1/usage'].response}
            lang={lang}
            onLang={setLang}
            notes={[
              'It counts toward your per-minute limit like any call.',
              <>See <a href="#object-usage">Usage</a> for every field.</>,
            ]}
            errors="Only the authentication and rate-limit errors."
          />

          {/* ── Objects ──────────────────────────────────────────────── */}
          <Section id="objects" title="Objects">
            <H3 id="object-place">Place</H3>
            <P>
              Returned by <C>/places</C>, <C>/places/:id</C> and <C>/places/nearby</C>.
            </P>
            <FieldTable
              rows={[
                ['id', 'string', 'Stable id. Store it as text.'],
                ['name', 'string', 'Display name, e.g. "Albert Ilemobade Library".'],
                ['description', 'string | null', 'Free text from the map. Often empty: treat "" and null the same.'],
                ['type', 'string | null', <>Category id, e.g. <C>hostel</C>. See <a href="#categories">Categories</a>.</>],
                ['area', 'string | null', 'Part of campus or town, e.g. "South Gate", "Obanla". Not set for every place.'],
                ['lat', 'number', 'Latitude in decimal degrees (WGS 84, the same as GPS and Google Maps).'],
                ['lng', 'number', 'Longitude in decimal degrees.'],
                ['rating', 'number | null', 'Average student rating from 1 to 5; null until someone reviews it.'],
                ['review_count', 'integer', 'How many reviews the rating is based on.'],
                ['image_count', 'integer', <>How many photos <a href="#place-photos">Place photos</a> would return.</>],
                ['distance_m', 'integer', <>Only from <C>/places/nearby</C>: metres from the point you sent.</>],
              ]}
            />
            <H3 id="object-category">Category</H3>
            <FieldTable
              rows={[
                ['id', 'string', <>Use as the <C>type</C> filter.</>],
                ['label', 'string', 'Readable name, e.g. "Bus stop".'],
                ['place_count', 'integer', 'Approved places with this type.'],
              ]}
            />
            <H3 id="object-image">Image</H3>
            <FieldTable
              rows={[
                ['position', 'integer', 'Display order, starting at 0.'],
                ['url', 'string', 'Up to 900 px wide. For cards, lists and thumbnails.'],
                ['full_url', 'string', 'Up to 1,600 px wide. For full-screen viewing.'],
              ]}
            />
            <H3 id="object-usage">Usage</H3>
            <FieldTable
              rows={[
                ['key', 'string', 'The first 12 characters of your key, to tell keys apart. Never the whole key.'],
                ['plan.id, plan.name', 'string', 'Your plan, e.g. starter / Starter.'],
                ['plan.monthly_credits', 'integer', 'Credits the plan gives each month.'],
                ['plan.rate_limit_per_minute', 'integer', 'Calls allowed per minute.'],
                ['credits.plan', 'integer', 'This month’s credits left.'],
                ['credits.topup', 'integer', 'One-off credits left (never expire).'],
                ['credits.total', 'integer', 'Both together: what you can spend now.'],
                ['resets_at', 'string', 'When monthly credits next refill (ISO 8601, UTC).'],
                ['recent_calls[]', 'array', 'Your last 20 calls, newest first.'],
                ['recent_calls[].endpoint', 'string', 'e.g. "GET /v1/places/:id/images".'],
                ['recent_calls[].status', 'integer', 'HTTP status returned.'],
                ['recent_calls[].credits_charged', 'integer', 'Credits it cost.'],
                ['recent_calls[].response_ms', 'integer', 'How long it took on our side.'],
                ['recent_calls[].at', 'string', 'When (ISO 8601, UTC).'],
              ]}
            />
          </Section>

          {/* ── Recipes ──────────────────────────────────────────────── */}
          <Section id="recipes" title="Recipes">
            <P>Copy-paste starting points for the jobs most apps need.</P>

            <H3 id="recipe-paginate">Fetch every place</H3>
            <P>
              Follows <C>next_offset</C> until the last page. With 50 per page this costs about one credit per 50 places. Run
              it once a day, not on every page view.
            </P>
            <CodeTabs
              samples={[
                { id: 'js', label: 'JavaScript', blockLabel: 'Node.js 18+', code: RECIPES.paginate },
                { id: 'python', label: 'Python', blockLabel: 'Python 3 · requests', code: RECIPES.paginatePython },
              ]}
              lang={lang === 'python' ? 'python' : 'js'}
              onLang={setLang}
            />

            <H3 id="recipe-retry">Retry the right way</H3>
            <P>
              A small wrapper used by the other recipes: waits out <C>429</C> using <C>Retry-After</C>, backs off on{' '}
              <C>5xx</C>, and throws on everything else with the error code attached.
            </P>
            <CodeBlock code={RECIPES.retry} label="Node.js 18+" />

            <H3 id="recipe-proxy">Keep your key on a server</H3>
            <P>
              Your web or mobile app calls your own small endpoint; your server adds the key, calls us and caches the answer.
              The cache saves credits too: one stored answer can serve many users.
            </P>
            <CodeTabs
              samples={[
                { id: 'express', label: 'Express', blockLabel: 'server.js', code: RECIPES.proxyExpress },
                { id: 'next', label: 'Next.js', blockLabel: 'route.js', code: RECIPES.proxyNext },
              ]}
            />

            <H3 id="recipe-credits">Check credits before a big job</H3>
            <CodeBlock code={RECIPES.creditsCheck} label="Node.js 18+" />

            <H3 id="recipe-directions">Send people to a place</H3>
            <P>The API has no routing, but every place has coordinates any maps app can use:</P>
            <CodeBlock code={RECIPES.directions} label="JavaScript" />
          </Section>

          {/* ── Best practices ───────────────────────────────────────── */}
          <Section id="best-practices" title="Best practices">
            <ul className={styles.list}>
              <li>
                <b>Cache.</b> Places change slowly. Keep lists and places for 10 to 60 minutes, categories for a day, photo URLs
                with their place. Re-fetch a place when you get a <C>404</C> for it.
              </li>
              <li>
                <b>Sync, don&apos;t hammer.</b> If you show the whole map, copy it once a day with{' '}
                <a href="#recipe-paginate">Fetch every place</a> and serve it from your own database.
              </li>
              <li>
                <b>Look before you pay for photos.</b> Only call <C>/images</C> when <C>image_count</C> is above 0.
              </li>
              <li>
                <b>Watch your balance.</b> <C>meta.credits_remaining</C> comes with every answer, and <C>/v1/usage</C> is free.
                Alert yourself below about 10% of your monthly credits.
              </li>
              <li>
                <b>Retry only what can succeed.</b> <C>429</C> and <C>5xx</C>, with a wait. Fix <C>4xx</C> instead of retrying.
              </li>
              <li>
                <b>Set a timeout</b> (10 seconds is plenty) so a slow network doesn&apos;t hang your app.
              </li>
              <li>
                <b>Handle empty values.</b> <C>description</C>, <C>area</C>, <C>type</C> and <C>rating</C> can be empty or
                null.
              </li>
              <li>
                <b>Encode parameters</b> with your language&apos;s URL tools (<C>URLSearchParams</C>, <C>params=</C>) rather
                than gluing strings.
              </li>
              <li>
                <b>Keep the key secret.</b> Environment variables, server-side only, never committed to git. If it leaks, roll
                it.
              </li>
            </ul>
          </Section>

          {/* ── Managing keys ────────────────────────────────────────── */}
          <Section id="keys" title="Managing keys">
            <P>
              Everything here is on the <Link to="/developers">developer page</Link> once you&apos;re signed in.
            </P>
            <ul className={styles.list}>
              <li>
                <b>Create.</b> Each account can have one active Free key and up to five active keys in all. After a key is
                upgraded to a paid plan, you can add another Free one.
              </li>
              <li>
                <b>Roll</b> (if a key leaked or was lost): you get a new key with the same plan, credits and reset date. The
                old key stops working at once, so update your server straight after.
              </li>
              <li>
                <b>Revoke</b>: the key stops working for good and its credits are lost. To keep the credits, roll instead.
              </li>
              <li>
                <b>Usage</b>: each key shows credits left, the last 14 days of calls and its recent requests.
              </li>
              <li>
                <b>One key per app</b> lets you see each app&apos;s usage and roll one without breaking the others.
              </li>
            </ul>
          </Section>

          {/* ── FAQ ──────────────────────────────────────────────────── */}
          <Section id="faq" title="FAQ and troubleshooting">
            <Faq q="I get 401 but my key looks right.">
              Check the header is called <C>x-api-key</C> (not <C>Authorization</C>), has no <C>Bearer</C> in front, and has
              no space or line break copied with the key. If you rolled the key, the old one no longer works.
            </Faq>
            <Faq q="Is there a test or sandbox key?">
              The Free plan is the sandbox: {free ? formatNumber(free.monthly_credits) : 'free'} credits a month, and calls that
              fail are never charged. Use <C>/v1/usage</C> (free) to check your setup.
            </Faq>
            <Faq q="Can I call the API from the browser or a mobile app?">
              It works (CORS is open), but anyone can pull the key out of your app and spend your credits. Put a small server
              in between; see <a href="#recipe-proxy">Keep your key on a server</a>.
            </Faq>
            <Faq q="Why was I charged for an empty result?">
              The search ran, so it counts, the same as an empty page of results anywhere. For photos, check{' '}
              <C>image_count</C> before calling.
            </Faq>
            <Faq q="I got 402 but I still have credits.">
              The call costs more than you have left (photos cost {cost('GET /v1/places/:id/images') ?? 5}). Check{' '}
              <C>/v1/usage</C>.
            </Faq>
            <Faq q="How fresh is the data?">
              It&apos;s read live from the map. New and edited places show up as soon as they&apos;re approved.
            </Faq>
            <Faq q="A place is wrong or missing.">
              Tell us at <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> with the place id. Anyone can also suggest a
              place on the map at <a href="https://mapsbyfuta.xyz/map">mapsbyfuta.xyz/map</a>.
            </Faq>
            <Faq q="Can I get reviews, users or walking routes?">
              Not in v1. The API shares place data only; it never exposes anything about our users. For routes, send the
              place&apos;s coordinates to a maps app (see <a href="#recipe-directions">recipe</a>).
            </Faq>
            <Faq q="How do I upgrade or buy more credits?">
              On the developer page, open <b>More credits</b> on your key. We&apos;ll email you how to pay; the credits appear
              as soon as payment is confirmed.
            </Faq>
            <Faq q="Will v1 change under me?">
              Within v1 we only add things (new fields, new endpoints). Anything that would break existing code will come as{' '}
              <C>/v2</C>, with notice.
            </Faq>
          </Section>

          {/* ── Changelog and support ────────────────────────────────── */}
          <Section id="changelog" title="Changelog and support">
            <ul className={styles.changelog}>
              <li>
                <span className={styles.changeDate}>10 Nov 2026</span>
                <span>
                  <b>v1 released.</b> Places, place details, nearby search, categories, photos and usage; credits and per-key
                  rate limits.
                </span>
              </li>
            </ul>
            <Callout tone="info" icon={<Info size={18} />} title="Need help?">
              Email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> or{' '}
              <a href={WHATSAPP_CHAT_URL} target="_blank" rel="noreferrer">
                message us on WhatsApp
              </a>
              . Include your key&apos;s first 12 characters (from <C>/v1/usage</C>) and the time of the call, never the full
              key.
            </Callout>
            <Link to="/developers" className={`${dev.primaryBtn} ${styles.endCta}`}>
              Get your API key
              <ArrowRight size={17} aria-hidden="true" />
            </Link>
          </Section>
        </main>
      </div>
    </div>
  );
}

// ── Building blocks ──────────────────────────────────────────────────────

function Section({ id, title, children }) {
  return (
    <section id={id} className={styles.section} aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className={styles.h2}>
        <a href={`#${id}`} className={styles.anchor}>
          {title}
        </a>
      </h2>
      {children}
    </section>
  );
}

function H3({ id, children }) {
  return (
    <h3 id={id} className={styles.h3}>
      {children}
    </h3>
  );
}

function P({ children }) {
  return <p className={styles.p}>{children}</p>;
}

/** Inline code. */
function C({ children }) {
  return <code className={dev.inlineCode}>{children}</code>;
}

function Fact({ term, value }) {
  return (
    <div className={styles.fact}>
      <dt>{term}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function Steps({ children }) {
  return <ol className={styles.steps}>{children}</ol>;
}

function Step({ n, title, children }) {
  return (
    <li className={styles.step}>
      <span className={styles.stepNum} aria-hidden="true">
        {n}
      </span>
      <div className={styles.stepBody}>
        <h3 className={styles.stepTitle}>{title}</h3>
        <div className={styles.stepText}>{children}</div>
      </div>
    </li>
  );
}

function Callout({ tone, icon, title, children }) {
  return (
    <div className={`${styles.callout} ${tone === 'warn' ? styles.calloutWarn : ''}`} role="note">
      <span className={styles.calloutIcon}>{icon}</span>
      <div>
        <p className={styles.calloutTitle}>{title}</p>
        <p className={styles.calloutText}>{children}</p>
      </div>
    </div>
  );
}

function FieldTable({ rows, head = ['Field', 'Type', 'Description'] }) {
  return (
    <div className={styles.tableWrap}>
      <table className={`${styles.table} ${styles.fieldTable}`}>
        <thead>
          <tr>
            {head.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(([a, b, c]) => (
            <tr key={a}>
              <td>
                <C>{a}</C>
              </td>
              <td className={styles.typeCell}>{b}</td>
              <td>{c}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Endpoint({ id, title, path, cost, intro, params, samples, response, lang, onLang, notes, errors, extraFields }) {
  const responseCode = useMemo(() => json(response), [response]);
  return (
    <section id={id} className={`${styles.section} ${styles.endpoint}`} aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className={styles.h2}>
        <a href={`#${id}`} className={styles.anchor}>
          {title}
        </a>
      </h2>
      <div className={styles.endpointLine}>
        <span className={dev.method}>GET</span>
        <code className={styles.endpointPath}>/v1{path}</code>
        <span className={`${dev.costPill} ${cost === 0 ? dev.costFree : ''}`}>
          {cost == null ? '–' : cost === 0 ? 'Free' : `${cost} credit${cost === 1 ? '' : 's'}`}
        </span>
      </div>
      <P>{intro}</P>

      <H3>Parameters</H3>
      {params.length === 0 ? (
        <P>None.</P>
      ) : (
        <>
          {/* Phones: one card per parameter; the 5-column table needs width. */}
          <ul className={styles.paramCards}>
            {params.map(([name, type, req, def, rules]) => (
              <li key={name} className={styles.paramCard}>
                <div className={styles.paramTop}>
                  <C>{name}</C>
                  <span className={styles.typeCell}>{type}</span>
                  <span className={`${styles.paramTag} ${req === 'Yes' ? styles.paramTagReq : ''}`}>
                    {req === 'Yes' ? 'Required' : 'Optional'}
                  </span>
                  {def !== '—' && <span className={styles.paramTag}>Default {def}</span>}
                </div>
                <div className={styles.paramRules}>{rules}</div>
              </li>
            ))}
          </ul>
          <div className={`${styles.tableWrap} ${styles.paramTable}`}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Required</th>
                  <th>Default</th>
                  <th>Rules</th>
                </tr>
              </thead>
              <tbody>
                {params.map(([name, type, req, def, rules]) => (
                  <tr key={name}>
                    <td>
                      <C>{name}</C>
                    </td>
                    <td className={styles.typeCell}>{type}</td>
                    <td>{req}</td>
                    <td className={styles.num}>{def}</td>
                    <td>{rules}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <H3>Example request</H3>
      <CodeTabs samples={samples} lang={lang} onLang={onLang} />

      <H3>Example response</H3>
      <CodeBlock code={responseCode} label="200 OK" />
      {extraFields && <FieldTable rows={extraFields} />}

      <H3>Notes</H3>
      <ul className={styles.list}>
        {notes.map((n, i) => (
          <li key={i}>{n}</li>
        ))}
      </ul>
      <p className={styles.errorsLine}>
        <TriangleAlert size={15} aria-hidden="true" />
        <span>
          <b>Errors:</b> {errors} Plus the <a href="#errors">common errors</a>.
        </span>
      </p>
    </section>
  );
}

function Faq({ q, children }) {
  return (
    <details className={styles.faq}>
      <summary className={styles.faqQ}>
        {q}
        <ChevronDown size={16} className={styles.faqChevron} aria-hidden="true" />
      </summary>
      <p className={styles.faqA}>{children}</p>
    </details>
  );
}
