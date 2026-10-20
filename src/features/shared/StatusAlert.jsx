import { useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import styles from './StatusAlert.module.css';

/**
 * Top-of-map status card (design: "Auth Redesign" export, "Alert · all four
 * states"): round icon, bold title, optional one-line message, optional
 * Retry pill. Used by MapShell (map not loading) and OfflineBanner
 * (offline / back online).
 *
 * `tone`: 'warn' (amber map icon) | 'offline' (grey on violet tint) |
 * 'ok' (teal). `retrySpinMs`: how long the Retry icon spins after a tap,
 * since the callers don't report when their retry finishes.
 */
export default function StatusAlert({ icon: Icon, tone, title, message, onRetry, retrySpinMs = 2000, role = 'status' }) {
  const [retrying, setRetrying] = useState(false);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <div className={`${styles.alert} ${styles[tone] || ''}`} role={role}>
      <span className={styles.icon} aria-hidden="true">
        <Icon size={17} strokeWidth={2} />
      </span>
      <div className={styles.text}>
        <p className={styles.title}>{title}</p>
        {message && <p className={styles.message}>{message}</p>}
      </div>
      {onRetry && (
        <button
          type="button"
          className={styles.retry}
          disabled={retrying}
          onClick={() => {
            setRetrying(true);
            onRetry();
            clearTimeout(timer.current);
            timer.current = setTimeout(() => setRetrying(false), retrySpinMs);
          }}
        >
          <RefreshCw size={16} strokeWidth={2.25} className={retrying ? styles.spinning : undefined} aria-hidden="true" />
          Retry
        </button>
      )}
    </div>
  );
}
