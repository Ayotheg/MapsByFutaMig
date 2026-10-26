import { useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useOnlineStatus } from '../../lib/useOnlineStatus';
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
 * `autoRetryMs`: also call `onRetry({ auto: true })` on this interval while shown (skipped
 * while the browser is offline), with the icon spinning throughout —
 * people otherwise sit waiting for an alert that only retries on a tap.
 */
export default function StatusAlert({
  icon: Icon,
  tone,
  title,
  message,
  onRetry,
  retrySpinMs = 2000,
  autoRetryMs,
  role = 'status',
}) {
  const [retrying, setRetrying] = useState(false);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);

  const onRetryRef = useRef(onRetry);
  onRetryRef.current = onRetry;
  const online = useOnlineStatus();
  const autoRetrying = Boolean(onRetry && autoRetryMs && online);
  useEffect(() => {
    if (!autoRetrying) return undefined;
    const id = setInterval(() => onRetryRef.current?.({ auto: true }), autoRetryMs);
    return () => clearInterval(id);
  }, [autoRetrying, autoRetryMs]);

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
          <RefreshCw
            size={16}
            strokeWidth={2.25}
            className={retrying || autoRetrying ? styles.spinning : undefined}
            aria-hidden="true"
          />
          Retry
        </button>
      )}
    </div>
  );
}
