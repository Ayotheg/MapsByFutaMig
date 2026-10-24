import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Clock,
  Gift,
  ImagePlus,
  Info,
  Loader2,
  LocateFixed,
  MapPin,
  Search,
  Ticket,
  Video,
  X,
} from 'lucide-react';
import { useSeo } from '../../lib/useSeo';
import { useAuth, friendlyError } from '../auth/useAuth';
import WaypointSearchPanel from '../promote/WaypointSearchPanel';
import { submitEvent, validateEventForm } from './submitEvent';
import { DayField, TimeField } from './DateTimeFields';
import { DateBadge } from '../explore/ExploreEvents';
import { EVENT_LISTING_FEE, priceLabel, shortWhen } from '../explore/eventsData';
import styles from './EventListingPage.module.css';

// Only mounts when a signed-out person tries to submit.
const AuthModal = lazy(() => import('../auth/AuthModal'));

const naira = (n) => `₦${Number(n).toLocaleString('en-NG')}`;

// Online platforms: the prefix means people only paste the invite code.
const PLATFORMS = [
  { id: 'whatsapp', label: 'WhatsApp', prefix: 'chat.whatsapp.com/', placeholder: 'invite code', dot: styles.dotWhatsapp },
  { id: 'meet', label: 'Google Meet', prefix: 'meet.google.com/', placeholder: 'meeting code', dot: styles.dotMeet },
  { id: 'telegram', label: 'Telegram', prefix: 't.me/', placeholder: 'group or channel', dot: styles.dotTelegram },
  { id: 'other', label: 'Other', prefix: null, placeholder: 'Paste the link', dot: styles.dotOther },
];

/**
 * /event — "List your event" (public/Maps By FUTA — eventRedesign-png.zip,
 * "Add an event · V2 desktop / mobile"). Same flow as /promote, which the
 * Business tab links to: entry type sets the fee (free ₦0, ticketed flat
 * EVENT_LISTING_FEE), then details and where, with a live preview of the
 * Explore card. Submitting goes through submitEvent.js: free events go
 * straight to admin review, ticketed ones pay the fee through BACHS first.
 */
export default function EventListingPage() {
  useSeo({ title: 'List your event – Maps By FUTA', robots: 'noindex, nofollow' });
  const navigate = useNavigate();
  const posterInputRef = useRef(null);
  const auth = useAuth();
  // BACHS's cancel_url (create-event-checkout) comes back with ?cancelled=1.
  const [searchParams] = useSearchParams();
  const showCancelledNotice = searchParams.get('cancelled') === '1';
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);

  const [entry, setEntry] = useState(null); // null | 'free' | 'ticketed'
  const [ticketPrice, setTicketPrice] = useState(''); // digits only, naira
  const [ticketNote, setTicketNote] = useState('');
  const [name, setName] = useState('');
  const [organiser, setOrganiser] = useState('');
  const [poster, setPoster] = useState(null); // { file, url }
  const [day, setDay] = useState('');
  const [starts, setStarts] = useState('');
  const [where, setWhere] = useState(null); // null | 'venue' | 'online'
  const [venue, setVenue] = useState(null); // { name, lat, lng, waypointId }
  // A picked place fills this; a GPS pin needs the person to name it.
  const [venueName, setVenueName] = useState('');
  const [mapSearchOpen, setMapSearchOpen] = useState(false);
  const [locStatus, setLocStatus] = useState(null); // { text, error }
  const [platform, setPlatform] = useState('whatsapp');
  const [link, setLink] = useState('');

  const activePlatform = PLATFORMS.find((p) => p.id === platform);

  function handlePoster(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (poster) URL.revokeObjectURL(poster.url);
    setPoster({ file, url: URL.createObjectURL(file) });
  }

  function removePoster() {
    if (poster) URL.revokeObjectURL(poster.url);
    setPoster(null);
  }

  // One-shot read, same as /promote's "Use current GPS".
  function handleCurrentLocation() {
    setMapSearchOpen(false);
    if (!navigator.geolocation) {
      setLocStatus({ text: 'GPS is not available on this device.', error: true });
      return;
    }
    setLocStatus({ text: 'Getting your location…', error: false });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setVenue({ name: 'Your current location', lat: pos.coords.latitude, lng: pos.coords.longitude, waypointId: null });
        setVenueName('');
        setLocStatus(null);
      },
      (err) => setLocStatus({ text: `Couldn't get your location: ${err.message}`, error: true }),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  function handleVenuePicked(wp) {
    setVenue({ name: wp.name, lat: wp.lat, lng: wp.lng, waypointId: wp.id });
    setVenueName(wp.name);
    setLocStatus(null);
    setMapSearchOpen(false);
  }

  // Back from BACHS with the browser's Back button: the page is restored from
  // the back/forward cache with `submitting` still true (same fix as /promote).
  useEffect(() => {
    function handlePageShow(e) {
      if (e.persisted) {
        setSubmitting(false);
        setSubmitError(null);
      }
    }
    window.addEventListener('pageshow', handlePageShow);
    return () => window.removeEventListener('pageshow', handlePageShow);
  }, []);

  async function handleSubmit() {
    if (submitting) return;
    const problem = validateEventForm({
      entry,
      ticketPrice,
      title: name,
      organiser,
      day,
      starts,
      where,
      venue,
      venueName,
      link,
    });
    if (problem) {
      setSubmitError(problem);
      return;
    }
    if (!auth.user) {
      setAuthModalOpen(true);
      return;
    }

    setSubmitError(null);
    setSubmitting(true);
    try {
      const { eventId, checkoutUrl } = await submitEvent({
        userId: auth.user.id,
        entry,
        ticketPrice,
        ticketNote,
        title: name,
        organiser,
        poster,
        day,
        starts,
        where,
        venue,
        venueName,
        platform,
        link,
      });
      if (checkoutUrl) {
        // Left spinning on purpose: the browser is about to leave for BACHS.
        window.location.href = checkoutUrl;
        return;
      }
      navigate(`/event/callback?event=${eventId}`, { replace: true });
    } catch (e) {
      setSubmitError(e.message || 'Could not send your event. Try again.');
      setSubmitting(false);
    }
  }

  // Preview falls back to the design's sample date and time until filled in.
  const previewIso = (() => {
    const d = day ? new Date(`${day}T00:00`) : new Date();
    const [h, m] = (starts || '10:00').split(':').map(Number);
    d.setHours(h, m, 0, 0);
    return d.toISOString();
  })();
  const previewPlace =
    where === 'online' ? `Online · ${activePlatform.label}` : where === 'venue' && venueName.trim() ? venueName.trim() : 'Venue';

  // The event as Explore will show it — same shape as eventsData.js, so the
  // preview's price reads exactly like the Explore cards and EventCard.
  const ticketed = entry === 'ticketed';
  const listing = {
    price: ticketed ? Number(ticketPrice) || 0 : 0,
    priceNote: ticketed ? ticketNote.trim() : 'No ticket needed',
  };
  const needsPrice = ticketed && !listing.price;

  const fee = entry === 'free' ? 0 : ticketed ? EVENT_LISTING_FEE : null;
  const submitLabel = !entry
    ? 'Choose free or ticketed'
    : needsPrice
    ? 'Add the ticket price'
    : ticketed
    ? `Pay ${naira(fee)} and submit`
    : 'Submit for review';

  const summary = (
    <div className={styles.summaryCard}>
      <div className={styles.payBand}>
        <span className={styles.payRing} aria-hidden="true" />
        <span className={styles.payRingSmall} aria-hidden="true" />
        <span className={styles.overline}>You pay</span>
        <span className={styles.payValue}>{fee == null ? '₦—' : naira(fee)}</span>
        <span className={styles.payHint}>
          {entry === 'free'
            ? 'Free events are listed free.'
            : entry === 'ticketed'
            ? 'One flat fee, whatever the ticket price.'
            : 'Pick free or ticketed in step 1.'}
        </span>
      </div>
      <dl className={styles.summaryRows}>
        <div className={styles.summaryRow}>
          <dt>Entry</dt>
          <dd>
            {entry === 'free'
              ? 'Free'
              : ticketed
              ? listing.price
                ? `Ticket · ${priceLabel(listing)}`
                : 'Ticketed or paid'
              : 'Choose above'}
          </dd>
        </div>
        <div className={styles.summaryRow}>
          <dt>On the map until</dt>
          <dd>Event day</dd>
        </div>
        <div className={styles.summaryRow}>
          <dt>Goes live</dt>
          <dd>
            <span className={styles.liveDot} aria-hidden="true" />
            After admin review
          </dd>
        </div>
      </dl>
      {(submitError || showCancelledNotice) && (
        <p className={styles.formError} role="alert">
          <AlertCircle size={15} aria-hidden="true" />
          <span>{submitError || 'Payment was cancelled, nothing was charged. Your event is saved as unpaid; submit again to pay.'}</span>
        </p>
      )}
      <button
        type="button"
        className={styles.submitBtn}
        disabled={!entry || needsPrice || submitting}
        aria-busy={submitting}
        onClick={handleSubmit}
      >
        {submitting ? (
          <>
            <Loader2 size={17} className={styles.spinner} aria-hidden="true" />
            {ticketed ? 'Starting payment…' : 'Sending…'}
          </>
        ) : (
          submitLabel
        )}
      </button>
      <button type="button" className={styles.cancelLink} onClick={() => navigate(-1)} disabled={submitting}>
        Cancel and go back
      </button>
    </div>
  );

  const preview = (
    <div className={styles.previewBlock}>
      <span className={styles.previewLabel}>Live preview</span>
      <div className={styles.previewCard}>
        <div className={styles.previewPoster}>
          {poster ? <img src={poster.url} alt="" /> : <span className={styles.previewPosterText}>[Your poster]</span>}
          <DateBadge iso={previewIso} className={styles.previewDate} />
          {/* Explore's price tag: white with the price once one is set, mint "Free" otherwise. */}
          <span className={`${styles.previewPrice} ${ticketed ? styles.previewPricePaid : ''}`}>
            {ticketed && !listing.price ? 'Paid' : priceLabel(listing)}
          </span>
        </div>
        <div className={styles.previewBody}>
          <span className={styles.previewName}>{name.trim() || 'Your event name'}</span>
          <span className={styles.previewLine}>
            <Clock size={15} aria-hidden="true" />
            {shortWhen(previewIso)}
          </span>
          <span className={styles.previewLine}>
            {where === 'online' ? <Video size={15} aria-hidden="true" /> : <MapPin size={15} aria-hidden="true" />}
            <span className={styles.ellipsis}>{previewPlace}</span>
          </span>
        </div>
      </div>
    </div>
  );

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <span className={styles.heroCircle} aria-hidden="true" />
        <span className={styles.heroCircleLow} aria-hidden="true" />
        <svg className={styles.heroPath} viewBox="0 0 200 420" fill="none" aria-hidden="true">
          <path d="M150 40 C 175 120, 170 230, 120 300 S 40 400, 10 415" />
        </svg>
        {/* Phones: the route drops from the pin down the right-hand gutter,
            so the title can use the full width. */}
        <svg className={styles.heroPathMobile} viewBox="0 0 60 220" fill="none" aria-hidden="true">
          <path d="M40 2 C 52 70, 54 130, 42 170 S 12 212, 2 218" />
        </svg>
        <MapPin className={styles.heroPin} size={40} strokeWidth={2} aria-hidden="true" />

        <div className={styles.heroInner}>
          <div className={styles.topBar}>
            <button type="button" className={styles.backBtn} onClick={() => navigate(-1)} aria-label="Go back">
              <ArrowLeft size={20} />
            </button>
            <nav className={styles.toggle} aria-label="What are you listing?">
              <Link to="/promote" replace className={styles.toggleBtn}>
                Business
              </Link>
              <span className={`${styles.toggleBtn} ${styles.toggleBtnActive}`} aria-current="page">
                Event
              </span>
            </nav>
          </div>
          <h1 className={styles.title}>List your event</h1>
          <div className={styles.pills}>
            <span className={`${styles.pill} ${styles.pillFree}`}>Free events · ₦0</span>
            <span className={styles.pill}>Ticketed · {naira(EVENT_LISTING_FEE)} flat</span>
          </div>
        </div>
      </header>

      <div className={styles.layout}>
        <form className={styles.formCol} onSubmit={(e) => e.preventDefault()}>
          {/* 01 Entry */}
          <section className={styles.step}>
            <StepHead n="01" title="Entry" subtitle="This decides if there is a fee." />
            <div className={styles.options}>
              <OptionCard
                selected={entry === 'free'}
                onClick={() => setEntry('free')}
                icon={<Gift size={20} />}
                iconClass={styles.iconMint}
                title="Free entry"
                sub="₦0 · straight to review"
              />
              <OptionCard
                selected={entry === 'ticketed'}
                onClick={() => setEntry('ticketed')}
                icon={<Ticket size={20} />}
                iconClass={styles.iconViolet}
                title="Ticketed or paid"
                sub={`${naira(EVENT_LISTING_FEE)} flat to list`}
              />
            </div>

            {ticketed && (
              <div className={styles.reveal}>
                <label className={styles.field}>
                  <span className={styles.label}>Ticket price</span>
                  <span className={styles.prefixInput}>
                    <span className={styles.prefix}>₦</span>
                    <input
                      className={`${styles.input} ${styles.priceInput}`}
                      type="text"
                      inputMode="numeric"
                      autoComplete="off"
                      placeholder="e.g. 2,000"
                      value={ticketPrice ? Number(ticketPrice).toLocaleString('en-NG') : ''}
                      onChange={(e) => setTicketPrice(e.target.value.replace(/\D/g, '').replace(/^0+/, '').slice(0, 7))}
                    />
                  </span>
                  <span className={styles.helper}>Shown on your event card. If prices vary, enter the lowest.</span>
                </label>
                <label className={styles.field}>
                  <span className={styles.labelRow}>
                    <span className={styles.label}>How to get a ticket</span>
                    <span className={styles.optional}>Optional</span>
                  </span>
                  <input
                    className={styles.input}
                    type="text"
                    placeholder="e.g. Pay at the gate, or from your class rep"
                    maxLength={80}
                    value={ticketNote}
                    onChange={(e) => setTicketNote(e.target.value)}
                  />
                </label>
              </div>
            )}
          </section>

          {/* 02 The details */}
          <section className={styles.step}>
            <StepHead n="02" title="The details" subtitle="What people see on the event card." />
            <label className={styles.field}>
              <span className={styles.label}>Event name</span>
              <input
                className={styles.input}
                type="text"
                placeholder="e.g. Tech Week Kick-off"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Organiser</span>
              <input
                className={styles.input}
                type="text"
                placeholder="Club, department or your name"
                value={organiser}
                onChange={(e) => setOrganiser(e.target.value)}
              />
            </label>
            <div className={styles.field}>
              <span className={styles.labelRow}>
                <span className={styles.label}>Poster</span>
                <span className={styles.optional}>Optional</span>
              </span>
              {poster ? (
                <div className={styles.posterPreview}>
                  <img src={poster.url} alt="" />
                  <button type="button" className={styles.posterRemove} onClick={removePoster} aria-label="Remove poster">
                    <X size={14} strokeWidth={2.5} />
                  </button>
                </div>
              ) : (
                <button type="button" className={styles.dropzone} onClick={() => posterInputRef.current?.click()}>
                  <span className={styles.dropzoneIcon}>
                    <ImagePlus size={16} />
                  </span>
                  Add a poster
                </button>
              )}
              <input
                ref={posterInputRef}
                type="file"
                accept="image/png,image/jpeg"
                className={styles.hiddenInput}
                onChange={handlePoster}
              />
            </div>
            <div className={styles.twoCol}>
              <DayField value={day} onChange={setDay} />
              <TimeField value={starts} onChange={setStarts} />
            </div>
          </section>

          {/* 03 Where */}
          <section className={styles.step}>
            <StepHead n="03" title="Where" subtitle="On the map or online." />
            <div className={styles.options}>
              <OptionCard
                selected={where === 'venue'}
                onClick={() => setWhere('venue')}
                icon={<MapPin size={20} />}
                iconClass={styles.iconViolet}
                title="Physical venue"
                sub="On campus, at a spot"
              />
              <OptionCard
                selected={where === 'online'}
                tone="teal"
                onClick={() => {
                  setWhere('online');
                  setMapSearchOpen(false);
                }}
                icon={<Video size={20} />}
                iconClass={styles.iconMint}
                title="Online"
                sub="WhatsApp, Meet, Telegram"
              />
            </div>

            {where === 'venue' && (
              <div className={styles.reveal}>
                <span className={styles.label}>Venue</span>
                <div className={styles.twoCol}>
                  <button
                    type="button"
                    className={styles.outlineBtn}
                    onClick={() => setMapSearchOpen((v) => !v)}
                    aria-expanded={mapSearchOpen}
                  >
                    <Search size={16} />
                    Search on map
                  </button>
                  <button type="button" className={styles.outlineBtn} onClick={handleCurrentLocation}>
                    <LocateFixed size={16} />
                    Current location
                  </button>
                </div>
                {mapSearchOpen && <WaypointSearchPanel onSelect={handleVenuePicked} onClose={() => setMapSearchOpen(false)} />}
                {venue && (
                  <div className={styles.venuePicked}>
                    <CheckCircle2 size={16} />
                    <span className={styles.ellipsis}>{venue.name}</span>
                  </div>
                )}
                {/* A GPS pin has no name; the card needs one. */}
                {venue && !venue.waypointId && (
                  <label className={styles.field}>
                    <span className={styles.label}>Venue name</span>
                    <input
                      className={styles.input}
                      type="text"
                      placeholder="e.g. 1000 Seater Auditorium"
                      maxLength={80}
                      value={venueName}
                      onChange={(e) => setVenueName(e.target.value)}
                    />
                  </label>
                )}
                {locStatus && (
                  <p className={`${styles.status} ${locStatus.error ? styles.statusError : ''}`}>{locStatus.text}</p>
                )}
                <p className={styles.warning}>
                  <Info size={16} aria-hidden="true" />
                  <span>
                    <strong>Must be physically present there at the venue</strong> to use current location. Not there? Search
                    on the map instead.
                  </span>
                </p>
              </div>
            )}

            {where === 'online' && (
              <div className={styles.reveal}>
                <span className={styles.label}>Platform</span>
                <div className={styles.platforms} role="radiogroup" aria-label="Platform">
                  {PLATFORMS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      role="radio"
                      aria-checked={platform === p.id}
                      className={`${styles.platformChip} ${platform === p.id ? styles.platformChipActive : ''}`}
                      onClick={() => setPlatform(p.id)}
                    >
                      <span className={`${styles.dot} ${p.dot}`} aria-hidden="true" />
                      {p.label}
                    </button>
                  ))}
                </div>
                <label className={styles.field}>
                  <span className={styles.label}>Event link</span>
                  <span className={styles.prefixInput}>
                    {activePlatform.prefix && <span className={styles.prefix}>{activePlatform.prefix}</span>}
                    <input
                      className={styles.input}
                      type="text"
                      placeholder={activePlatform.placeholder}
                      value={link}
                      onChange={(e) => setLink(e.target.value)}
                    />
                  </span>
                  <span className={styles.helper}>
                    {platform === 'other' ? 'Tapping Join opens this link.' : `Tapping Join opens your ${activePlatform.label} ${platform === 'meet' ? 'call' : 'group'}.`}
                  </span>
                </label>
              </div>
            )}
          </section>
        </form>

        <aside className={styles.sideCol}>
          {summary}
          {preview}
        </aside>
      </div>

      {authModalOpen && (
        <Suspense fallback={null}>
          <AuthModal
            initialTab="signin"
            user={auth.user}
            onClose={() => setAuthModalOpen(false)}
            signInWithGoogle={auth.signInWithGoogle}
            signInWithEmail={auth.signInWithEmail}
            signUpWithEmail={auth.signUpWithEmail}
            checkEmailStatus={auth.checkEmailStatus}
            resetPassword={auth.resetPassword}
            verifyRecoveryCode={auth.verifyRecoveryCode}
            setNewPassword={auth.setNewPassword}
            signOut={auth.signOut}
            friendlyError={friendlyError}
            message="Sign in to list your event. It ties the listing to your account so you can see when it's approved."
          />
        </Suspense>
      )}
    </div>
  );
}

function StepHead({ n, title, subtitle }) {
  return (
    <div className={styles.stepHead}>
      <span className={styles.stepNum}>{n}</span>
      <div>
        <h2 className={styles.stepTitle}>{title}</h2>
        <p className={styles.stepSub}>{subtitle}</p>
      </div>
    </div>
  );
}

function OptionCard({ selected, tone, onClick, icon, iconClass, title, sub }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      className={`${styles.option} ${selected ? (tone === 'teal' ? styles.optionTeal : styles.optionViolet) : ''}`}
      onClick={onClick}
    >
      <span className={`${styles.optionIcon} ${iconClass}`}>{icon}</span>
      {selected && (
        <span className={styles.optionCheck} aria-hidden="true">
          <Check size={13} strokeWidth={3} />
        </span>
      )}
      <span className={styles.optionTitle}>{title}</span>
      <span className={styles.optionSub}>{sub}</span>
    </button>
  );
}
