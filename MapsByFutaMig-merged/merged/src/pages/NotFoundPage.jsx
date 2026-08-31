import { Link } from "react-router-dom";
import { Compass, Map, ArrowLeft } from "lucide-react";
import { useSeo } from "../lib/useSeo";
import styles from "./NotFoundPage.module.css";

function NotFoundPage() {
  // Error routes are never real, indexable content — keep crawlers out
  // and skip the SPA's normal title, same reasoning as /map's noindex.
  useSeo({
    title: "Page Not Found – Maps By FUTA",
    robots: "noindex, nofollow",
  });

  return (
    <div className={styles.screen}>
      <div className={styles.content}>
        <div className={styles.iconWrap}>
          <span className={styles.ring} aria-hidden="true" />
          <span className={`${styles.ring} ${styles.ringInner}`} aria-hidden="true" />
          <Compass className={styles.pinIcon} strokeWidth={1.75} />
        </div>

        <p className={styles.code}>Error 404</p>
        <h1 className={styles.title}>You've wandered off the map</h1>
        <p className={styles.subtitle}>
          The page you're looking for doesn't exist or may have moved.
          Let's get you back to familiar ground.
        </p>

        <div className={styles.actions}>
          <Link to="/" className={styles.btnPrimary}>
            <ArrowLeft size={18} strokeWidth={2} />
            Back to home
          </Link>
          <Link to="/map" className={styles.btnSecondary}>
            <Map size={18} strokeWidth={2} />
            Open the map
          </Link>
        </div>
      </div>
    </div>
  );
}

export default NotFoundPage;