import { useEffect, useRef, useState } from 'react';
import { Star, TriangleAlert, X } from 'lucide-react';
import styles from './ReviewModal.module.css';
import { submitReview } from './submitReview';
import { track } from '../../lib/analytics';

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
 * (Slice 8 "ties into Slice 9's arrival detection").
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
 *
 * v2 (this session): redesigned against Figma node 59:2 ("Rating
 * Screen"), pulled via the Figma MCP connection. Same props
 * (`dest`, `onClose`, `onSubmitted`, `user`), same state, same
 * `handleSubmit`/`submitReview` flow, same reset-on-`dest`-change
 * effect — no functionality changes.
 *
 * **Structural decision, flagged:** the frame is a bottom sheet
 * (rounded top corners only, anchored to the viewport bottom, grabber
 * handle, max-width 672px staying bottom-anchored even at that width)
 * — not the shared `Modal` component's centered card. Rather than add
 * a new prop to the shared `Modal.jsx`/`Modal.module.css` (out of
 * scope per Rule 1 — that file is still used unmodified by
 * `AuthModal`/`SaveModal`/`DetailModal`/`AdminEditModal`, all still
 * "Not started," and a new variant prop there is exactly the kind of
 * shared-component change this pass avoids), this component now
 * builds its own self-contained overlay + sheet markup, matching
 * `Modal.jsx`'s existing externally-visible behavior exactly: X-button
 * close, backdrop-click-to-close (this modal already had
 * `closeOnBackdrop` on, see the removed comment above), and the same
 * optional footer-button pattern — just no longer sharing the actual
 * `Modal` component or its CSS module. No other modal is affected.
 * The frame's grabber handle was left out entirely (not just left
 * decorative) — a static handle with no drag-to-dismiss behind it
 * reads as broken affordance, and adding that gesture would be new
 * interaction behavior, out of scope per Rule 1/7. Top of the sheet is
 * plain instead.
 */
// `user` (Slice 10, optional): when signed in, attributes the review via
// `submitReview`'s `userId` so it counts toward the signer's profile
// stats — see `submitReview.js`'s header comment. Anonymous submission
// (no `user` passed) still works exactly as it did before this slice.
export default function ReviewModal({ dest, onClose, onSubmitted, user }) {
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

  // Escape closes, like the backdrop and the X; focus moves into the sheet
  // so keyboard users land on the form, not the card underneath.
  // Ref, not a dependency: the caller passes a new onClose each render, and
  // re-running this would pull focus out of the comment box mid-typing.
  const sheetRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    sheetRef.current?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') onCloseRef.current?.();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  async function handleSubmit() {
    if (!dest || rating < 1) return;

    setSubmitting(true);
    setStatus(null);

    try {
      await submitReview({ waypointId: dest.id, rating, comment, userId: user?.id });
      // Shows the "Thanks for your review" screen; Done closes it.
      setStatus({ kind: 'success' });
      setSubmitting(false);
      await onSubmitted?.();
    } catch (err) {
      setStatus({ kind: 'error', text: 'Failed to save review. Try again.' });
      setSubmitting(false);
      // Match legacy's console.error('Review submit failed:', err) for
      // whoever's debugging a failed submit live.
      console.error('Review submit failed:', err);
      // Slice 14 instrumentation (ANALYTICS_BUILD_PLAN.md §9).
      track('error_occurred', { context: 'review_submit', message: err?.message || String(err) });
    }
  }

  const footer = (
    <>
      <button
        type="button"
        className={styles.btnSkip}
        onClick={onClose}
        disabled={submitting}
      >
        Skip
      </button>
      <button
        type="button"
        className={styles.btnSubmit}
        onClick={handleSubmit}
        disabled={rating < 1 || submitting}
      >
        {submitting ? 'Saving…' : 'Submit Review'}
      </button>
    </>
  );

  if (status?.kind === 'success') {
    return (
      <div
        className={styles.overlay}
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div
          className={`${styles.sheet} ${styles.thanks}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="review-thanks-title"
        >
          <span className={styles.checkRing} aria-hidden="true">
            <svg className={styles.check} viewBox="0 0 64 64" width="64" height="64">
              <circle className={styles.checkCircle} cx="32" cy="32" r="29" />
              <path className={styles.checkMark} d="M21 33l7.5 7.5L44 25" />
            </svg>
          </span>
          <h2 id="review-thanks-title" className={styles.thanksTitle}>Thanks for your review</h2>
          <p className={styles.thanksSub}>You&apos;re helping other FUTARIANs find great places.</p>
          <button type="button" className={styles.doneBtn} onClick={onClose} autoFocus>
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={styles.overlay}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={sheetRef}
        className={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-labelledby="review-question"
        tabIndex={-1}
      >
        <div className={styles.header}>
          <div className={styles.eyebrow}>RATE THIS PLACE</div>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close">
            <X size={17} />
          </button>
        </div>

        <div id="review-question" className={styles.question}>
          How was your visit to <span className={styles.destName}>{dest?.name}</span>?
        </div>

        <div
          className={styles.stars}
          role="radiogroup"
          aria-label="Rating"
          onMouseLeave={() => setHoverRating(0)}
        >
          {[1, 2, 3, 4, 5].map((val) => (
            <button
              type="button"
              key={val}
              role="radio"
              aria-checked={rating === val}
              aria-label={`${val} star${val === 1 ? '' : 's'}`}
              className={`${styles.star} ${val <= displayRating ? styles.active : ''}`}
              onClick={() => setRating(val)}
              onMouseEnter={() => setHoverRating(val)}
            >
              <Star size={26} fill={val <= displayRating ? 'currentColor' : 'none'} aria-hidden="true" />
            </button>
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
          {/* Reviews are public on the place card (supabase/reviews_read.sql). */}
          <p className={styles.note}>
            {user ? 'Your first name will be shown with your review.' : 'Your review will be posted as Anonymous.'}
          </p>
        </div>

        {status && (
          <div className={`${styles.status} ${styles[status.kind]}`}>
            <TriangleAlert size={13} /> {status.text}
          </div>
        )}

        <div className={styles.actions}>{footer}</div>
      </div>
    </div>
  );
}