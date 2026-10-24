import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, CalendarPlus, ExternalLink, MapPin, Navigation, Share, Ticket, Video, X } from 'lucide-react';
import { DateBadge } from './ExploreEvents';
import { longDate, priceLabel, timeRange } from './eventsData';
import styles from './EventCard.module.css';

// http(s) links and bare www. links in the organiser's About text.
const URL_RE = /(https?:\/\/[^\s<]+|www\.[^\s<]+)/gi;

/**
 * About text with its links made tappable. Plain text otherwise (React
 * escapes it), and trailing punctuation stays outside the link.
 */
function linkify(text) {
  const parts = String(text).split(URL_RE);
  return parts.map((part, i) => {
    if (i % 2 === 0) return part;
    const [, url, trail] = part.match(/^(.*?)([.,!?;:)\]]*)$/);
    const href = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    return (
      <span key={i}>
        <a className={styles.aboutLink} href={href} target="_blank" rel="noopener noreferrer nofollow ugc">
          {url}
        </a>
        {trail}
      </span>
    );
  });
}

/**
 * Event detail (public/Maps By FUTA — events-Redesign-png.zip, "Event page ·
 * desktop / mobile"). `event={null}` renders closed.
 *
 * Desktop: floating card in PlaceCard's spot. Mobile: bottom sheet that fits
 * its content; drag the handle down to close. Portalled to <body> so the
 * mobile Explore sheet's transform doesn't trap its fixed positioning.
 *
 * Online events swap the venue row for the platform and "Navigate to venue"
 * for "Join online". The action buttons call their props when given.
 */
export default function EventCard({ event, onClose, isMobile, onNavigate, onJoinOnline, onAddToCalendar, onShare }) {
  const [dragY, setDragY] = useState(0);
  const dragStartY = useRef(null);
  const cardRef = useRef(null);

  // Keep the last event while the card slides out.
  const [shown, setShown] = useState(event);
  useEffect(() => {
    if (event) setShown(event);
  }, [event]);
  useEffect(() => {
    if (cardRef.current) cardRef.current.scrollTop = 0;
  }, [event?.id]);

  useEffect(() => {
    if (!event) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [event, onClose]);

  const isOpen = Boolean(event);
  const e = event || shown;

  function handleTouchStart(ev) {
    dragStartY.current = ev.touches[0].clientY;
  }
  function handleTouchMove(ev) {
    if (dragStartY.current == null) return;
    const dy = ev.touches[0].clientY - dragStartY.current;
    setDragY(Math.max(0, dy));
  }
  function handleTouchEnd(ev) {
    if (dragStartY.current == null) return;
    const dy = ev.changedTouches[0].clientY - dragStartY.current;
    dragStartY.current = null;
    setDragY(0);
    if (dy > 80) onClose?.();
  }

  const cardStyle = dragY ? { transform: `translateY(${dragY}px)`, transition: 'none' } : undefined;
  const online = Boolean(e?.online);

  return createPortal(
    <>
      {isMobile && <div className={`${styles.scrim} ${isOpen ? styles.scrimVisible : ''}`} onClick={onClose} />}
      <div
        ref={cardRef}
        className={`${styles.card} ${isMobile ? styles.mobile : styles.desktop} ${isOpen ? styles.visible : ''}`}
        style={cardStyle}
        role="dialog"
        aria-label={e?.title || 'Event'}
        aria-hidden={!isOpen}
      >
        {e && (
          <>
            {isMobile && (
              <div
                className={styles.handle}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                aria-hidden="true"
              >
                <span className={styles.handleBar} />
              </div>
            )}

            <div className={styles.scroll}>
              <div className={styles.poster}>
                <CalendarDays className={styles.posterIcon} size={44} strokeWidth={1.5} aria-hidden="true" />
                {e.poster && <img src={e.poster} alt="" decoding="async" />}
                <DateBadge iso={e.startsAt} className={styles.date} />
              </div>

              <div className={styles.body}>
                <div className={styles.titleRow}>
                  <h2 className={styles.title}>{e.title}</h2>
                  <button type="button" className={styles.close} aria-label="Close" onClick={onClose}>
                    <X size={22} />
                  </button>
                </div>
                {e.organiser && <p className={styles.organiser}>By {e.organiser}</p>}

                <ul className={styles.facts}>
                  <li className={styles.fact}>
                    <span className={styles.factIcon}>
                      <CalendarDays size={20} aria-hidden="true" />
                    </span>
                    <span className={styles.factText}>
                      <span className={styles.factMain}>{longDate(e.startsAt)}</span>
                      <span className={styles.factSub}>{timeRange(e)}</span>
                    </span>
                  </li>
                  <li className={styles.fact}>
                    <span className={styles.factIcon}>
                      {online ? <Video size={20} aria-hidden="true" /> : <MapPin size={20} aria-hidden="true" />}
                    </span>
                    <span className={styles.factText}>
                      <span className={styles.factMain}>{online ? 'Online' : e.venue?.name}</span>
                      {(online ? e.online.platform : e.venue?.hint) && (
                        <span className={styles.factSub}>{online ? e.online.platform : e.venue.hint}</span>
                      )}
                    </span>
                  </li>
                  <li className={styles.fact}>
                    <span className={styles.factIcon}>
                      <Ticket size={20} aria-hidden="true" />
                    </span>
                    <span className={styles.factText}>
                      <span className={styles.factMain}>{priceLabel(e)}</span>
                      {e.priceNote && <span className={styles.factSub}>{e.priceNote}</span>}
                    </span>
                  </li>
                </ul>

                {e.about?.trim() && (
                  <>
                    <h3 className={styles.aboutTitle}>About</h3>
                    <p className={styles.about}>{linkify(e.about)}</p>
                  </>
                )}
              </div>
            </div>

            <div className={styles.footer}>
              {online ? (
                <button type="button" className={styles.primaryBtn} onClick={() => onJoinOnline?.(e)}>
                  <ExternalLink size={18} />
                  Join online
                </button>
              ) : (
                <button type="button" className={styles.primaryBtn} onClick={() => onNavigate?.(e)}>
                  <Navigation size={18} />
                  Navigate to venue
                </button>
              )}
              <button type="button" className={styles.iconBtn} aria-label="Add to calendar" onClick={() => onAddToCalendar?.(e)}>
                <CalendarPlus size={20} />
              </button>
              <button type="button" className={styles.iconBtn} aria-label="Share event" onClick={() => onShare?.(e)}>
                <Share size={20} />
              </button>
            </div>
          </>
        )}
      </div>
    </>,
    document.body
  );
}
