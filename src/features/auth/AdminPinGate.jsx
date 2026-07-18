import { useEffect, useRef, useState } from 'react';
import styles from './AdminPinGate.module.css';
import { ADMIN_PIN_HASH, PIN_LENGTH, hashPin } from './adminPin';

/**
 * PIN pad modal — ported from legacy `#adminPinOverlay` (index.html
 * ~964–995) + `_initPinModal()` (app.js ~3577–3690, the digit-buffer/
 * dots/error-shake half of the module; the "require sign-in first" half
 * lives in `useAdminPin.js`, this component doesn't know about auth).
 *
 * NOT YET WIRED TO ANYTHING — flagged, not an oversight, same as
 * `ReviewModal` was in Slice 8. MIGRATION_PLAN.md lists "Separate PIN-gate
 * for admin panel entry" under Slice 10's own scope (distinct from the
 * admin panel itself, Slice 11), so this component + `useAdminPin.js` are
 * built and ready here. `Sidebar.jsx`'s Admin toggle stays inert — wiring
 * it to actually call `requestAdminAccess()` and open the admin panel on
 * success is explicitly Slice 11's job per its own tracker row ("the
 * sidebar footer's Admin toggle already exists as inert chrome — this
 * slice wires up its actual behavior"). Building the gate now without a
 * caller mirrors the same "machinery built, next slice wires it" call
 * this port already made for `ReviewModal`.
 *
 * Legacy shares the generic `.modal-overlay`/`.modal` shell class names
 * with DetailModal/SaveModal/ReviewModal, but structurally never uses
 * `.modal-header`/`.modal-close`/`.modal-body` — it has its own custom
 * header (icon + label, no ✕) and no footer. Doesn't fit
 * `components/ui/Modal.jsx`'s enforced header+body(+footer) shape, so
 * this is bespoke, matching legacy's actual (different) DOM structure
 * rather than forcing it through the shared shell.
 */
export default function AdminPinGate({ open, onSuccess, onClose }) {
  const [buf, setBuf] = useState('');
  const [error, setError] = useState(false);
  const overlayRef = useRef(null);

  // Legacy: `_showPinOverlay` resets the buffer every time the gate opens
  // (app.js ~3653–3659), and focuses the overlay so keyboard digits work
  // immediately (desktop convenience, ~3657).
  useEffect(() => {
    if (!open) return;
    setBuf('');
    setError(false);
    const t = setTimeout(() => overlayRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [open]);

  async function checkPin(candidate) {
    const hash = await hashPin(candidate);
    if (hash === ADMIN_PIN_HASH) {
      setBuf('');
      onSuccess?.();
    } else {
      // Legacy's `_showError`: dots flash red for 1.2s, buffer clears
      // (app.js ~3594–3602).
      setError(true);
      setBuf('');
      setTimeout(() => setError(false), 1200);
    }
  }

  function pressDigit(d) {
    if (buf.length >= PIN_LENGTH) return;
    const next = buf + d;
    setBuf(next);
    setError(false);
    if (next.length === PIN_LENGTH) checkPin(next);
  }

  function backspace() {
    setBuf((b) => b.slice(0, -1));
    setError(false);
  }

  function handleKeyDown(e) {
    if (e.key >= '0' && e.key <= '9') pressDigit(e.key);
    else if (e.key === 'Backspace') backspace();
    else if (e.key === 'Escape') onClose?.();
  }

  if (!open) return null;

  const dots = Array.from({ length: PIN_LENGTH }, (_, i) => i < buf.length);

  return (
    <div
      className={styles.overlay}
      ref={overlayRef}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
    >
      <div className={`${styles.modal} ${styles.pinModal}`}>
        <div className={styles.header}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <span>ADMIN ACCESS</span>
        </div>
        <div className={styles.subtitle}>Enter your PIN to continue</div>
        <div className={styles.dots}>
          {dots.map((filled, i) => (
            <span key={i} className={`${styles.dot} ${filled ? styles.filled : ''} ${error ? styles.error : ''}`} />
          ))}
        </div>
        <div className={`${styles.errorMsg} ${!error ? styles.hidden : ''}`}>Incorrect PIN. Try again.</div>
        <div className={styles.pad}>
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
            <button key={d} type="button" className={styles.key} onClick={() => pressDigit(d)}>
              {d}
            </button>
          ))}
          <button type="button" className={`${styles.key} ${styles.cancel}`} onClick={onClose}>✕</button>
          <button type="button" className={styles.key} onClick={() => pressDigit('0')}>0</button>
          <button type="button" className={`${styles.key} ${styles.back}`} onClick={backspace}>⌫</button>
        </div>
      </div>
    </div>
  );
}
