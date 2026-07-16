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
 * Save buttons). Only the ✕ button dismisses it, matching legacy: no
 * modal in the legacy app wires a backdrop-click handler (checked: no
 * `.modal-overlay` listener anywhere in app.js).
 */
export default function Modal({ title, onClose, children, footer }) {
  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <div className={styles.title}>{title}</div>
          <button type="button" className={styles.close} onClick={onClose}>
            ✕
          </button>
        </div>

        <div className={styles.body}>{children}</div>

        {footer && <div className={styles.footer}>{footer}</div>}
      </div>
    </div>
  );
}
