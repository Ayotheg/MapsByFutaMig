import { lazy, Suspense } from 'react';
import { useSeo } from '../../lib/useSeo';
import { useAdminAccess } from './useAdminAccess';
import AdminLogin from './AdminLogin';
import styles from './AdminLogin.module.css';
import { useAdminTheme } from './useAdminTheme';

const AdminDashboard = lazy(() => import('./AdminDashboard'));

/** /admin — sign in with the admin email + password, then the full-page dashboard. */
export default function AdminPage() {
  useSeo({ title: 'Admin · Maps By FUTA', robots: 'noindex, nofollow' });
  const access = useAdminAccess();
  const { dark, toggle } = useAdminTheme();
  const wrap = (node) => node;

  if (access.status === 'loading' || access.status === 'checking') {
    return wrap(
      <main className={styles.page} aria-busy="true">
        <p className={styles.status}>Loading…</p>
      </main>
    );
  }

  if (access.status === 'signed-out') {
    return wrap(<AdminLogin onSignIn={access.signIn} />);
  }

  if (access.status === 'denied') {
    return wrap(
      <main className={styles.page}>
        <div className={styles.card}>
          <h1 className={styles.title}>No admin access</h1>
          <p className={styles.help}>
            {access.checkError || `${access.user?.email || 'This account'} isn’t an admin. Sign in with the admin email instead.`}
          </p>
          <button type="button" className={styles.submit} onClick={() => access.signOut().catch(() => {})}>
            Use a different account
          </button>
        </div>
      </main>
    );
  }

  return wrap(
    <Suspense
      fallback={
        <main className={styles.page} aria-busy="true">
          <p className={styles.status}>Loading dashboard…</p>
        </main>
      }
    >
      <AdminDashboard user={access.user} onSignOut={() => access.signOut().catch(() => {})} dark={dark} onToggleTheme={toggle} />
    </Suspense>
  );
}
