import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import styles from './DevelopersPage.module.css';

/**
 * The bar across the top of /developers and /developers/docs: the brand,
 * the two developer pages, and a way back to the map.
 */
export default function DevTopBar({ current }) {
  const link = (id) => `${styles.topNavLink} ${current === id ? styles.topNavLinkActive : ''}`;
  return (
    <header className={styles.topBar}>
      <div className={styles.topBarInner}>
        <Link to="/developers" className={styles.brand} aria-label="Maps By FUTA Developers">
          <img src="/android-chrome-512x512.png" width="28" height="28" alt="" className={styles.brandLogo} />
          <span className={styles.brandName}>Maps By FUTA</span>
          <span className={styles.brandTag}>Developers</span>
        </Link>
        <nav className={styles.topNav} aria-label="Developer pages">
          <Link to="/developers" className={link('overview')} aria-current={current === 'overview' ? 'page' : undefined}>
            Overview
          </Link>
          <Link to="/developers/docs" className={link('docs')} aria-current={current === 'docs' ? 'page' : undefined}>
            Docs
          </Link>
          <Link to="/map" className={styles.topMapLink}>
            <span>Open the map</span>
            <ArrowUpRight size={15} aria-hidden="true" />
          </Link>
        </nav>
      </div>
    </header>
  );
}
