import { useEffect, useState } from 'react';
import { Star } from 'lucide-react';
import { fetchPlaceReviews, REVIEWS_PAGE_SIZE } from './fetchPlaceReviews';
import styles from './PlaceReviews.module.css';

// "Reviews" section at the bottom of PlaceCard for rateable places.
// Newest first, REVIEWS_PAGE_SIZE at a time with "Show more". Signed-in
// reviewers show their first name, guests show "Anonymous".
// `version` changes when a review is submitted, so the list reloads and
// the new review shows straight away.
// If the read RPC isn't available (supabase/reviews_read.sql not run yet,
// or offline) the section just doesn't render — the card's rating badge
// still shows.

const RTF = typeof Intl !== 'undefined' && Intl.RelativeTimeFormat ? new Intl.RelativeTimeFormat('en', { numeric: 'auto' }) : null;
const UNITS = [
  ['year', 365 * 24 * 3600],
  ['month', 30 * 24 * 3600],
  ['week', 7 * 24 * 3600],
  ['day', 24 * 3600],
  ['hour', 3600],
  ['minute', 60],
];

function timeAgo(iso) {
  const secs = (new Date(iso).getTime() - Date.now()) / 1000;
  if (!Number.isFinite(secs)) return '';
  for (const [unit, size] of UNITS) {
    if (Math.abs(secs) >= size) return RTF ? RTF.format(Math.round(secs / size), unit) : '';
  }
  return 'just now';
}

function Stars({ rating }) {
  return (
    <span className={styles.stars} aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} size={13} className={n <= rating ? styles.starOn : styles.starOff} fill={n <= rating ? 'currentColor' : 'none'} />
      ))}
    </span>
  );
}

export default function PlaceReviews({ waypointId, reviewCount, avgRating, version }) {
  const [reviews, setReviews] = useState([]);
  const [status, setStatus] = useState('loading'); // loading | ready | unavailable
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    setReviews([]);
    fetchPlaceReviews(waypointId, 0)
      .then((rows) => {
        if (cancelled) return;
        setReviews(rows);
        setHasMore(rows.length === REVIEWS_PAGE_SIZE);
        setStatus('ready');
      })
      .catch(() => {
        if (!cancelled) setStatus('unavailable');
      });
    return () => {
      cancelled = true;
    };
  }, [waypointId, version]);

  async function showMore() {
    setLoadingMore(true);
    try {
      const rows = await fetchPlaceReviews(waypointId, reviews.length);
      setReviews((prev) => [...prev, ...rows.filter((r) => !prev.some((p) => p.id === r.id))]);
      setHasMore(rows.length === REVIEWS_PAGE_SIZE);
    } catch {
      setHasMore(false);
    } finally {
      setLoadingMore(false);
    }
  }

  if (status === 'unavailable') return null;

  const count = Math.max(reviewCount || 0, reviews.length);

  return (
    <section className={styles.section} aria-label="Reviews">
      <div className={styles.head}>
        <h3 className={styles.title}>Reviews</h3>
        {count > 0 && (
          <span className={styles.summary}>
            {avgRating != null && (
              <>
                <Star size={13} className={styles.starOn} fill="currentColor" />
                <span className={styles.mono}>{avgRating.toFixed(1)}</span>
                <span>·</span>
              </>
            )}
            <span>
              <span className={styles.mono}>{count}</span> review{count === 1 ? '' : 's'}
            </span>
          </span>
        )}
      </div>

      {status === 'loading' && <p className={styles.muted}>Loading reviews…</p>}

      {status === 'ready' && reviews.length === 0 && (
        <p className={styles.muted}>No reviews yet — be the first after your visit.</p>
      )}

      {reviews.length > 0 && (
        <ul className={styles.list}>
          {reviews.map((r) => (
            <li key={r.id} className={styles.item}>
              <div className={styles.itemHead}>
                <Stars rating={r.rating} />
                <span className={styles.meta}>
                  {r.reviewer_name || 'Anonymous'} · {timeAgo(r.created_at)}
                </span>
              </div>
              {r.comment && <p className={styles.comment}>{r.comment}</p>}
            </li>
          ))}
        </ul>
      )}

      {hasMore && (
        <button type="button" className={styles.more} onClick={showMore} disabled={loadingMore}>
          {loadingMore ? 'Loading…' : 'Show more reviews'}
        </button>
      )}
    </section>
  );
}
