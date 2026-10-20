import { useEffect, useRef, useState } from 'react';
import { Star } from 'lucide-react';
import { fetchPlaceReviews, REVIEWS_PAGE_SIZE } from './fetchPlaceReviews';
import styles from './PlaceReviews.module.css';

// "Reviews" section of PlaceCard for rateable places (design: "Auth
// Redesign" place card). Newest first, REVIEWS_PAGE_SIZE at a time.
// Signed-in reviewers show their first name, guests "Anonymous".
// PlaceCard keys this by place id, so switching places starts fresh.
// `version` changes when a review is submitted, so the new one shows.
// If the read RPC (supabase/reviews_read.sql) fails, the section hides —
// the card's rating line still shows.

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

export default function PlaceReviews({ waypointId, reviewCount, version, onWriteReview }) {
  const [reviews, setReviews] = useState([]);
  const [status, setStatus] = useState('loading'); // loading | ready | unavailable
  const [loadingMore, setLoadingMore] = useState(false);
  // Ignores a "Show more" answer that arrives after the list was reloaded.
  const requestRef = useRef(0);

  useEffect(() => {
    const request = ++requestRef.current;
    setLoadingMore(false);
    fetchPlaceReviews(waypointId, 0)
      .then((rows) => {
        if (request !== requestRef.current) return;
        setReviews(rows);
        setStatus('ready');
      })
      .catch(() => {
        if (request === requestRef.current) setStatus('unavailable');
      });
  }, [waypointId, version]);

  async function showMore() {
    const request = requestRef.current;
    setLoadingMore(true);
    try {
      const rows = await fetchPlaceReviews(waypointId, reviews.length);
      if (request !== requestRef.current) return;
      setReviews((prev) => [...prev, ...rows.filter((r) => !prev.some((p) => p.id === r.id))]);
    } catch {
      /* keep what's shown */
    } finally {
      if (request === requestRef.current) setLoadingMore(false);
    }
  }

  if (status === 'unavailable') return null;

  const total = Math.max(reviewCount || 0, reviews.length);
  const hasMore = status === 'ready' && reviews.length < total && reviews.length >= REVIEWS_PAGE_SIZE;
  const empty = status === 'ready' && reviews.length === 0;

  return (
    <section className={styles.section} aria-label="Reviews">
      <div className={styles.head}>
        <h3 className={styles.title}>Reviews</h3>
        {!empty && onWriteReview && (
          <button type="button" className={styles.writeLink} onClick={onWriteReview}>
            Write a review
          </button>
        )}
      </div>

      {status === 'loading' && <p className={styles.loading}>Loading reviews…</p>}

      {empty && (
        <div className={styles.empty}>
          <span className={styles.emptyIcon} aria-hidden="true">
            <Star size={20} />
          </span>
          <p className={styles.emptyTitle}>No reviews yet</p>
          <p className={styles.emptySub}>Been here? Help other students know what to expect.</p>
          {onWriteReview && (
            <button type="button" className={styles.emptyBtn} onClick={onWriteReview}>
              Write the first review
            </button>
          )}
        </div>
      )}

      {reviews.length > 0 && (
        <ul className={styles.list}>
          {reviews.map((r) => {
            const name = r.reviewer_name || 'Anonymous';
            return (
              <li key={r.id} className={styles.item}>
                <div className={styles.itemHead}>
                  <span className={styles.avatar} aria-hidden="true">
                    {name.charAt(0).toUpperCase()}
                  </span>
                  <span className={styles.who}>
                    <span className={styles.name}>{name}</span>
                    <span className={styles.when}>{timeAgo(r.created_at)}</span>
                  </span>
                  <span className={styles.score} role="img" aria-label={`${r.rating} out of 5 stars`}>
                    <Star size={15} className={styles.star} fill="currentColor" aria-hidden="true" />
                    <span aria-hidden="true">{r.rating}</span>
                  </span>
                </div>
                {r.comment && <p className={styles.comment}>{r.comment}</p>}
              </li>
            );
          })}
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
