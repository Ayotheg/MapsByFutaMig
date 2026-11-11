import { Route } from 'lucide-react';
import { useSeo } from '../lib/useSeo';
import mapsLogo from '../assets/mapsLogo.png';
import styles from './MaintenancePage.module.css';

function MaintenancePage() {
  useSeo({
    title: 'Downtime – Maps By FUTA',
    robots: 'noindex, nofollow',
  });

  return (
    <main className={styles.screen}>
      <header className={styles.header}>
        <a href="/" className={styles.brand} aria-label="Maps By FUTA home">
          <img src={mapsLogo} alt="Maps By FUTA" />
        </a>
      </header>

      <section className={styles.message} aria-labelledby="downtime-title">
        <div className={styles.illustration} aria-hidden="true">
          <span className={styles.orbit} />
          <span className={styles.routeLine} />
          <span className={styles.routeDot} />
          <span className={styles.iconTile}>
            <Route size={19} strokeWidth={2.2} />
          </span>
          <span className={styles.signalDot} />
        </div>

        <h1 id="downtime-title">We are currently<br />experiencing downtime</h1>
        <p>
          Our team is currently working on updates and upgrades as part of a quick tune-up to keep everything reliable across campus. Please check back shortly.
        </p>
      </section>

      <footer className={styles.footer}>
        MapsByFUTA <span>•</span> Built for FUTA students &amp; campus explorers
      </footer>
    </main>
  );
}

export default MaintenancePage;