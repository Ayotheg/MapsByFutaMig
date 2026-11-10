import { useEffect, useRef, useState } from 'react';
import { Bell, ClipboardCheck, MapPinPlus, Star, X } from 'lucide-react';
import styles from './PushBanner.module.css';
import { track } from '../../lib/analytics';

// Our own banner for a notification that arrives while the app is open and
// on screen (public/sw.js posts 'push-show' instead of showing a system
// notification). Also passes on 'push-open' — a system notification tapped
// while the app was already open — so MapPage can go to the right place.

const LOOK = {
  weekly: { Icon: MapPinPlus, tone: 'violet' },
  review: { Icon: Star, tone: 'ink' },
  admin: { Icon: ClipboardCheck, tone: 'teal' },
  test: { Icon: Bell, tone: 'violet' },
};
const SHOW_MS = 12000;

export default function PushBanner({ onOpen }) {
  const [note, setNote] = useState(null);
  const [paused, setPaused] = useState(false);
  const onOpenRef = useRef(onOpen);
  onOpenRef.current = onOpen;

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return undefined;
    const onMessage = (e) => {
      const msg = e.data || {};
      if (msg.type === 'push-show' && msg.notification?.title) {
        setNote(msg.notification);
        track('push_shown_in_app', { kind: msg.notification.kind || null });
      } else if (msg.type === 'push-open' && msg.url) {
        onOpenRef.current?.(msg.url);
      }
    };
    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
  }, []);

  useEffect(() => {
    if (!note || paused) return undefined;
    const t = setTimeout(() => setNote(null), SHOW_MS);
    return () => clearTimeout(t);
  }, [note, paused]);

  if (!note) return null;
  const look = LOOK[note.kind] || LOOK.test;
  const actions = (note.actions || []).slice(0, 2);
  const go = (url) => {
    setNote(null);
    if (url) onOpenRef.current?.(url);
  };

  return (
    <div
      className={styles.banner}
      role="status"
      aria-live="polite"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
    >
      <button type="button" className={styles.main} onClick={() => go(note.url)}>
        <span className={`${styles.disc} ${styles[look.tone]}`} aria-hidden="true">
          <look.Icon size={20} strokeWidth={2.2} fill={note.kind === 'review' ? 'currentColor' : 'none'} />
        </span>
        <span className={styles.text}>
          <span className={styles.title}>{note.title}</span>
          {note.body && <span className={styles.body}>{note.body}</span>}
        </span>
      </button>
      <button type="button" className={styles.close} onClick={() => setNote(null)} aria-label="Dismiss">
        <X size={14} />
      </button>
      {note.image && <img className={styles.image} src={note.image} alt="" />}
      {actions.length > 0 && (
        <div className={styles.actions}>
          {actions.map((a, i) => (
            <button key={a.action || i} type="button" className={i === 0 ? styles.primary : styles.secondary} onClick={() => go(a.url)}>
              {a.title}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
