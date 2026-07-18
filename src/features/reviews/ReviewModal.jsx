import { useEffect, useState } from 'react';
import Modal from '../../components/ui/Modal';
import modalStyles from '../../components/ui/Modal.module.css';
import styles from './ReviewModal.module.css';
import { submitReview } from './submitReview';

/**
 * Ported from legacy `initPoiReview()` (app.js ~6944–7066) + its markup
 * (`#reviewModal`, index.html ~1339–1365) + styles (style.css ~2610–2637).
 *
 * NOT YET REACHABLE FROM ANYWHERE IN THIS APP — flagged, not an oversight.
 * The only place legacy ever opens this modal is `arrivedAtDestination()`'s
 * `finishArrival()` (app.js ~4966–4969):
 *   if (arrivedDest?.id && isRateablePOI(arrivedDest.type) && window.POI_REVIEW) {
 *     window.POI_REVIEW.open(arrivedDest);
 *   }
 * — i.e. Slice 9's arrival detection, which doesn't exist yet
 * (MIGRATION_PLAN.md: Slice 8 "ties into Slice 9's arrival detection").
 * Unlike Slice 5's KML import (which had a real-but-not-yet-built trigger
 * point — the admin panel — to stand in front of), there is no legacy
 * trigger for this modal other than nav arrival, so there's nothing to
 * provisionally hang a button off of without inventing UI legacy doesn't
 * have. This component is built and ready; `MapPage.jsx` does NOT render
 * it yet. When Slice 9 builds arrival detection, it should:
 *   1. `const ReviewModal = lazy(() => import('../features/reviews/ReviewModal'))`
 *      in MapPage.jsx (bundle-size policy — see CLAUDE.md — this is a
 *      modal that isn't needed for first paint, same tier as
 *      DetailModal/SaveModal).
 *   2. Hold a `reviewTarget` state (`{ id, name, type } | null`) in
 *      MapPage, set it from the same `isRateablePOI(dest.type)` check
 *      legacy does at arrival, right where `finishArrival()` would live.
 *   3. Render `{reviewTarget && <Suspense fallback={null}><ReviewModal
 *      dest={reviewTarget} onClose={...} onSubmitted={refetchWaypoints}
 *      /></Suspense>}`.
 *
 * `dest` is `{ id, name, type }` — same shape as legacy's `arrivedDest`.
 * Internally ungated: legacy's own `open(dest)` doesn't re-check
 * `isRateablePOI` either — the gate happens once, at the call site above,
 * before `open()` is ever invoked. Matched here on purpose rather than
 * adding a redundant internal check.
 */
export default function ReviewModal({ dest, onClose, onSubmitted }) {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');
  const [status, setStatus] = useState(null); // { kind: 'success'|'error', text }
  const [submitting, setSubmitting] = useState(false);

  const displayRating = hoverRating || rating;

  // Matches legacy's `reset()`, called every time `open(dest)` runs (app.js
  // ~6964–6979) — without this, reopening the modal for a *different*
  // destination (in principle possible if Slice 9 ever queues multiple
  // arrivals) would carry over the previous rating/comment/status.
  useEffect(() => {
    setRating(0);
    setHoverRating(0);
    setComment('');
    setStatus(null);
    setSubmitting(false);
  }, [dest]);

  async function handleSubmit() {
    if (!dest || rating < 1) return;

    setSubmitting(true);
    setStatus(null);

    try {
      await submitReview({ waypointId: dest.id, rating, comment });
      setStatus({ kind: 'success', text: '✅ Thanks for helping fellow students!' });
      await onSubmitted?.();
      setTimeout(onClose, 1200);
    } catch (err) {
      setStatus({ kind: 'error', text: '⚠️ Failed to save review. Try again.' });
      setSubmitting(false);
      // Match legacy's console.error('Review submit failed:', err) for
      // whoever's debugging a failed submit live.
      console.error('Review submit failed:', err);
    }
  }

  const footer = (
    <>
      <button
        type="button"
        className={`${modalStyles.btn} ${modalStyles.btnSecondary}`}
        onClick={onClose}
        disabled={submitting}
      >
        Skip
      </button>
      <button
        type="button"
        className={`${modalStyles.btn} ${modalStyles.btnPrimary}`}
        onClick={handleSubmit}
        disabled={rating < 1 || submitting}
      >
        {submitting ? 'Saving…' : status?.kind === 'success' ? 'Submitted' : 'Submit Review'}
      </button>
    </>
  );

  return (
    <Modal title="RATE THIS PLACE" onClose={onClose} footer={footer} closeOnBackdrop>
      <div className={styles.placeName}>How was your visit to {dest?.name}?</div>

      <div
        className={styles.stars}
        onMouseLeave={() => setHoverRating(0)}
      >
        {[1, 2, 3, 4, 5].map((val) => (
          <span
            key={val}
            className={`${styles.star} ${val <= displayRating ? styles.active : ''}`}
            onClick={() => setRating(val)}
            onMouseEnter={() => setHoverRating(val)}
          >
            ★
          </span>
        ))}
      </div>

      <div className={styles.field}>
        <label>Comment (optional)</label>
        <textarea
          rows={3}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="How was the service, quality, price...?"
        />
      </div>

      {status && (
        <div className={`${styles.status} ${styles[status.kind]}`}>{status.text}</div>
      )}
    </Modal>
  );
}
