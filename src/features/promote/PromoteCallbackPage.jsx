import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Clock, XCircle } from 'lucide-react';
import { useSeo } from '../../lib/useSeo';
import { fetchPromotionStatus } from './submitPromotion';
import { fetchEventStatus } from '../events/submitEvent';
import styles from './PromoteCallbackPage.module.css';

// Also serves /event/callback (kind="event"): same polling, the `events`
// row instead of `promotions`. A free event lands here straight after
// submitting, with payment_status 'not_required' — nothing to wait for.
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

  const [promotion, setPromotion] = useState(null);
  const [timedOut, setTimedOut] = useState(false);
  const [offline, setOffline] = useState(false);
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
        setPromotion(row);
        if (['paid', 'failed', 'not_required'].includes(row?.payment_status)) {
          return; // terminal state — stop polling
        }
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
  }, [promotionId, attempt, cfg]);

  function checkAgain() {
    setTimedOut(false);
    setAttempt((n) => n + 1);
  }

  const settled = ['paid', 'failed', 'not_required'].includes(promotion?.payment_status);
  const isEvent = kind === 'event';

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
  } else if (promotion?.payment_status === 'failed') {
    body = (
      <>
        <XCircle size={40} strokeWidth={2} className={styles.iconError} />
        <h1 className={styles.title}>Payment didn't go through</h1>
        <p className={styles.subtitle}>
          BACHS reported this payment as failed. No charge should have been made — head back and
          try again.
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
        {timedOut && !settled && (
          <button type="button" className={styles.secondaryBtn} onClick={checkAgain}>
            Check again
          </button>
        )}
        <button type="button" className={styles.homeBtn} onClick={() => navigate('/map')}>
          Back to the map
        </button>
      </div>
    </div>
  );
}
