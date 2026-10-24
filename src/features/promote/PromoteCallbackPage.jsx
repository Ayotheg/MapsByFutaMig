import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Clock, SearchX, XCircle } from 'lucide-react';
import { useSeo } from '../../lib/useSeo';
import { fetchPromotionStatus } from './submitPromotion';
import { fetchEventStatus, startEventCheckout } from '../events/submitEvent';
import styles from './PromoteCallbackPage.module.css';

// Also serves /event/callback (kind="event"): same polling, the `events`
// row instead of `promotions`. A free event lands here straight after
// submitting, with payment_status 'not_required' — nothing to wait for.
// Every way out of an event's BACHS checkout lands here too: success_url,
// and cancel_url with ?cancelled=1 (create-event-checkout). Cancelled,
// failed and expired payments get "Try payment again" for the same saved
// event, so nobody has to fill the form in twice.
const KINDS = {
  promotion: { param: 'promotion', fetch: fetchPromotionStatus, name: (r) => r.business_name },
  event: { param: 'event', fetch: fetchEventStatus, name: (r) => r.title },
};

// ── /promote/callback ────────────────────────────────────────────────────
//
// This is BACHS's `success_url` (see create-promotion-checkout Edge
// Function). Landing here means the person completed BACHS's hosted
// checkout flow in their browser — it does NOT mean the payment is
// confirmed. BACHS's webhook (a separate, server-to-server call the
// browser never sees) is the only thing allowed to flip
// `promotions.payment_status` to 'paid'; that webhook can genuinely lag a
// few seconds behind the browser redirect, or in rarer cases never fire
// if the person closed the tab before BACHS finished processing. So this
// page polls the row instead of trusting `?success=1`-style query params,
// same "redirect proves nothing, the DB row is truth" note
// submitPromotion.js's fetchPromotionStatus leaves for itself.
//
// A `?cancelled=1` landing (BACHS's `cancel_url`, wired straight back to
// `/promote` with that flag rather than this page — see PromotePage.jsx)
// never reaches here at all; this page only ever handles the "the person
// finished BACHS's flow one way or another" case.

const POLL_INTERVAL_MS = 2500;
const POLL_TIMEOUT_MS = 60000;

export default function PromoteCallbackPage({ kind = 'promotion' }) {
  useSeo({ title: 'Confirming Payment – Maps By FUTA', robots: 'noindex, nofollow' });

  const cfg = KINDS[kind] || KINDS.promotion;
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const promotionId = searchParams.get(cfg.param);

  const isEvent = kind === 'event';
  // BACHS's cancel_url for events. Checked against the row, not trusted:
  // a cancelled page that the webhook has since marked paid shows success.
  const wasCancelled = isEvent && searchParams.get('cancelled') === '1';

  const [promotion, setPromotion] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [offline, setOffline] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState(null);
  // Bumped by "Check again" to restart the poll loop from scratch.
  const [attempt, setAttempt] = useState(0);
  const error = promotionId ? null : 'Missing promotion reference — nothing to confirm.';

  useEffect(() => {
    if (!promotionId) return;

    let cancelled = false;
    let timer;
    const startedAt = Date.now();

    // A failed request is treated as "network blip, try again", not a
    // dead end: this page is exactly where someone on a bad connection
    // lands right after paying, and a single dropped request used to leave
    // them on "Something went wrong" with no way to re-check.
    async function poll() {
      try {
        const row = await cfg.fetch(promotionId);
        if (cancelled) return;
        setOffline(false);
        // An event that doesn't come back (wrong account, or deleted) won't
        // appear by waiting — say so instead of spinning for a minute.
        if (isEvent && !row) {
          setNotFound(true);
          return;
        }
        setPromotion(row);
        const terminal = isEvent ? ['paid', 'failed', 'expired', 'not_required'] : ['paid', 'failed', 'not_required'];
        if (terminal.includes(row?.payment_status)) {
          return; // terminal state — stop polling
        }
        // Back from cancelling: nothing is in flight, so there's nothing to wait for.
        if (wasCancelled && row?.payment_status === 'unpaid') return;
      } catch {
        if (cancelled) return;
        setOffline(true);
      }
      if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
        setTimedOut(true);
        return;
      }
      timer = setTimeout(poll, POLL_INTERVAL_MS);
    }

    poll();
    // Coming back online re-checks right away instead of waiting out the timer.
    function onOnline() {
      clearTimeout(timer);
      poll();
    }
    window.addEventListener('online', onOnline);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      window.removeEventListener('online', onOnline);
    };
  }, [promotionId, attempt, cfg, isEvent, wasCancelled]);

  function checkAgain() {
    setTimedOut(false);
    setAttempt((n) => n + 1);
  }

  async function retryPayment() {
    if (retrying) return;
    setRetrying(true);
    setRetryError(null);
    try {
      // Left spinning on purpose: the browser is about to leave for BACHS.
      window.location.href = await startEventCheckout(promotionId);
    } catch (e) {
      setRetryError(e.message || 'Could not start payment. Try again in a moment.');
      setRetrying(false);
    }
  }

  const status = promotion?.payment_status;
  const settled = ['paid', 'failed', 'not_required'].includes(status);
  const eventCancelled = wasCancelled && status === 'unpaid';
  // Ticketed events that still need paying, and can be paid without re-listing.
  const canRetry = isEvent && (eventCancelled || status === 'failed' || status === 'expired');

  let body;
  if (error) {
    body = (
      <>
        <XCircle size={40} strokeWidth={2} className={styles.iconError} />
        <h1 className={styles.title}>Something went wrong</h1>
        <p className={styles.subtitle}>{error}</p>
      </>
    );
  } else if (promotion?.payment_status === 'paid' || promotion?.payment_status === 'not_required') {
    body = (
      <>
        <CheckCircle2 size={40} strokeWidth={2} className={styles.iconSuccess} />
        <h1 className={styles.title}>
          {promotion.payment_status === 'not_required' ? 'Event sent for review' : 'Payment received'}
        </h1>
        <p className={styles.subtitle}>
          Thanks — <strong>{cfg.name(promotion)}</strong> is now waiting on a quick review by our team
          before it goes live.{' '}
          {isEvent
            ? "Once it's approved it shows in Explore → Events until the day of the event."
            : "We'll show it on the map/Explore page once it's approved."}
        </p>
      </>
    );
  } else if (notFound) {
    body = (
      <>
        <SearchX size={40} strokeWidth={2} className={styles.iconStill} />
        <h1 className={styles.title}>We couldn't find this event</h1>
        <p className={styles.subtitle}>
          Sign in with the account you used to list it. If you paid, the payment is still recorded
          against your event.
        </p>
      </>
    );
  } else if (eventCancelled) {
    body = (
      <>
        <XCircle size={40} strokeWidth={2} className={styles.iconStill} />
        <h1 className={styles.title}>Payment cancelled</h1>
        <p className={styles.subtitle}>
          Nothing was charged. <strong>{cfg.name(promotion)}</strong> is saved — pay the listing fee
          whenever you're ready and it goes straight to review.
        </p>
      </>
    );
  } else if (isEvent && status === 'expired') {
    body = (
      <>
        <Clock size={40} strokeWidth={2} className={styles.iconStill} />
        <h1 className={styles.title}>Checkout timed out</h1>
        <p className={styles.subtitle}>
          The payment page expired before payment finished. Nothing was charged, and{' '}
          <strong>{cfg.name(promotion)}</strong> is still saved.
        </p>
      </>
    );
  } else if (status === 'failed') {
    body = (
      <>
        <XCircle size={40} strokeWidth={2} className={styles.iconError} />
        <h1 className={styles.title}>Payment didn't go through</h1>
        <p className={styles.subtitle}>
          {isEvent ? (
            <>
              BACHS reported this payment as failed. No charge should have been made, and{' '}
              <strong>{cfg.name(promotion)}</strong> is still saved.
            </>
          ) : (
            'BACHS reported this payment as failed. No charge should have been made — head back and try again.'
          )}
        </p>
      </>
    );
  } else if (timedOut) {
    body = (
      <>
        <Clock size={40} strokeWidth={2} className={styles.iconStill} />
        <h1 className={styles.title}>Still confirming…</h1>
        <p className={styles.subtitle}>
          {offline
            ? "We couldn't reach our servers — your connection may be down. If BACHS took your payment, it'll still go through. Tap Check again once you're back online."
            : "This is taking longer than usual. If BACHS took your payment, it'll still go through — check again in a few minutes, or contact support if it doesn't update."}
        </p>
      </>
    );
  } else {
    body = (
      <>
        <Clock size={40} strokeWidth={2} className={styles.iconPending} />
        <h1 className={styles.title}>{isEvent ? 'Checking your event…' : 'Confirming your payment…'}</h1>
        <p className={styles.subtitle}>
          {offline
            ? 'Your connection looks weak — still trying. You can safely refresh this page.'
            : 'Hang tight, this only takes a moment.'}
        </p>
      </>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        {body}
        {retryError && (
          <p className={styles.retryError} role="alert">
            {retryError}
          </p>
        )}
        {canRetry && (
          <button type="button" className={styles.homeBtn} onClick={retryPayment} disabled={retrying} aria-busy={retrying}>
            {retrying ? 'Opening payment…' : 'Try payment again'}
          </button>
        )}
        {timedOut && !settled && !canRetry && !notFound && (
          <button type="button" className={styles.secondaryBtn} onClick={checkAgain}>
            Check again
          </button>
        )}
        {notFound && (
          <button type="button" className={styles.secondaryBtn} onClick={() => navigate('/event')}>
            List an event
          </button>
        )}
        <button
          type="button"
          className={canRetry ? styles.secondaryBtn : styles.homeBtn}
          onClick={() => navigate('/map')}
        >
          Back to the map
        </button>
      </div>
    </div>
  );
}
