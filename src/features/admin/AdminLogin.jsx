import { useState } from 'react';
import { friendlyError } from '../auth/useAuth';
import styles from './AdminLogin.module.css';

/** Email + password sign-in for the admin dashboard. */
export default function AdminLogin({ onSignIn, notice }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await onSignIn(email, password);
    } catch (err) {
      setError(friendlyError(err));
      setBusy(false);
    }
  }

  return (
    <main className={styles.page}>
      <form className={styles.card} onSubmit={submit} noValidate>
        <div className={styles.brand}>
          <img className={styles.logo} src="/android-chrome-512x512.png" alt="" width="44" height="44" />
          <span className={styles.brandName}>Maps By FUTA admin</span>
        </div>

        <h1 className={styles.title}>Sign in</h1>

        {(notice || error) && (
          <p className={styles.error} role="alert">
            {error || notice}
          </p>
        )}

        <label className={styles.field}>
          <span>Email</span>
          <input
            type="email"
            name="email"
            autoComplete="username"
            inputMode="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>

        <label className={styles.field}>
          <span>Password</span>
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>

        <button type="submit" className={styles.submit} disabled={busy || !email || !password}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </main>
  );
}
