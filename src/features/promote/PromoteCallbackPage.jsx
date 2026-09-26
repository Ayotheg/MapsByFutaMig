import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Clock, XCircle } from 'lucide-react';
import { useSeo } from '../../lib/useSeo';
import { fetchPromotionStatus } from './submitPromotion';
import styles from './PromoteCallbackPage.module.css';

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

export default function PromoteCallbackPage() {
  useSeo({ title: 'Confirming Payment – Maps By FUTA', robots: 'noindex, nofollow' });

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const promotionId = searchParams.get('promotion');

  const [promotion, setPromotion] = useState(null);
  const [timedOut, setTimedOut] = useState(false);
  const [error, setError] = useState(null);
  const startedAtRef = useRef(Date.now());

  useEffect(() => {
    if (!promotionId) {
      setError('Missing promotion reference — nothing to confirm.');
      return;
    }

    let cancelled = false;
    let timer;

    async function poll() {
      try {
        const row = await fetchPromotionStatus(promotionId);
        if (cancelled) return;
        setPromotion(row);
        if (row?.payment_status === 'paid' || row?.payment_status === 'failed') {
          return; // terminal state — stop polling
        }
      } catch (e) {
        if (!cancelled) setError(e.message || 'Could not check payment status.');
        return;
      }
      if (Date.now() - startedAtRef.current > POLL_TIMEOUT_MS) {
        if (!cancelled) setTimedOut(true);
        return;
      }
      timer = setTimeout(poll, POLL_INTERVAL_MS);
    }

    poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [promotionId]);

  let body;
  if (error) {
    body = (
      <>
        <XCircle size={40} strokeWidth={2} className={styles.iconError} />
        <h1 className={styles.title}>Something went wrong</h1>
        <p className={styles.subtitle}>{error}</p>
      </>
    );
  } else if (promotion?.payment_status === 'paid') {
    body = (
      <>
        <CheckCircle2 size={40} strokeWidth={2} className={styles.iconSuccess} />
        <h1 className={styles.title}>Payment received</h1>
        <p className={styles.subtitle}>
          Thanks — <strong>{promotion.business_name}</strong> is now waiting on a quick review by
          our team before it goes live. We'll show it on the map/Explore page once it's approved.
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
        <Clock size={40} strokeWidth={2} className={styles.iconPending} />
        <h1 className={styles.title}>Still confirming…</h1>
        <p className={styles.subtitle}>
          This is taking longer than usual. If BACHS took your payment, it'll still go through —
          check back in a few minutes, or contact support if it doesn't update.
        </p>
      </>
    );
  } else {
    body = (
      <>
        <Clock size={40} strokeWidth={2} className={styles.iconPending} />
        <h1 className={styles.title}>Confirming your payment…</h1>
        <p className={styles.subtitle}>Hang tight, this only takes a moment.</p>
      </>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        {body}
        <button type="button" className={styles.homeBtn} onClick={() => navigate('/map')}>
          Back to the map
        </button>
      </div>
    </div>
  );
}
