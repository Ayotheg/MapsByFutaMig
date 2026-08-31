import { useEffect } from 'react';
import { CheckCircle2 } from 'lucide-react';
import styles from './SubmissionToast.module.css';

/**
 * Slice 13's "Submitted — an admin will review it soon." confirmation.
 * No shared toast component exists anywhere else in this codebase
 * (grep-confirmed) — per CLAUDE.md's "no premature shared components"
 * rule, this stays feature-local under `waypoint-submissions/` rather
 * than starting a `components/ui/Toast.jsx` off a single usage.
 */
export default function SubmissionToast({ message, onDismiss }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 15000);
    return () => clearTimeout(t);
  }, [message, onDismiss]);

  if (!message) return null;

  return (
    <div className={styles.toast} role="status">
      <CheckCircle2 size={16} />
      {message}
    </div>
  );
}