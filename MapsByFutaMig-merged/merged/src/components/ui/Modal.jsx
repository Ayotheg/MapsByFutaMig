import { X } from 'lucide-react';
import styles from './Modal.module.css';

/**
 * Modal — shared overlay/header/close/body(/footer) shell.
 *
 * Extracted from `features/segments/DetailModal.jsx` now that Slice 5's
 * save modal is the *second* real usage of the "Modal shell" pattern
 * BRAND_GUIDELINES.md documents (`.modal-overlay > .modal > .modal-header
 * (.modal-title + .modal-close) > .modal-body > .modal-footer`). Per
 * CLAUDE.md's "no premature shared components" rule, this was deliberately
 * NOT pre-extracted from DetailModal alone — see that file's own comment,
 * written back in Slice 4, flagging this exact moment.
 *
 * `footer` is optional — legacy's `#detailModal` has no `.modal-footer` at
 * all (DetailModal doesn't pass one), while `#saveModal` does (Download /
 * Save buttons). Only the ✕ button dismisses it by default, matching
 * DetailModal/SaveModal: no `.modal-overlay` listener for either of those
 * in app.js.
 *
 * `closeOnBackdrop` (Slice 8): opt-in, defaults to `false` so the
 * DetailModal/SaveModal behavior above doesn't change. `#reviewModal` is
 * the one legacy modal that actually does wire a backdrop click
 * (`modal.addEventListener('click', e => { if (e.target === modal) close();
 * })`, app.js ~6998) — `ReviewModal.jsx` passes `closeOnBackdrop` to match.
 */
export default function Modal({ title, onClose, children, footer, closeOnBackdrop = false }) {
  return (
    <div
      className={styles.overlay}
      onClick={closeOnBackdrop ? (e) => { if (e.target === e.currentTarget) onClose(); } : undefined}
    >
      <div className={styles.modal}>
        <div className={styles.header}>
          <div className={styles.title}>{title}</div>
          <button type="button" className={styles.close} onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className={styles.body}>{children}</div>

        {footer && <div className={styles.footer}>{footer}</div>}
      </div>
    </div>
  );
}
