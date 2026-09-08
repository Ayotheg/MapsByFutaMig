import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Map,
  Search,
  Navigation,
  MapPin,
  Flag,
} from "lucide-react";
import { useSeo } from "../lib/useSeo";
import mapsLogo from "../assets/mapsLogo.png";
import styles from "./NotFoundPage.module.css";

const CONTACT_EMAIL = "gearlifycorporation@gmail.com";

// Static per Figma (node 117:68, "Popular Destination Chips") — these
// four are the same campus landmarks used as placeholder/seed data
// elsewhere in the app, not pulled from a live source. Clicking one
// (or submitting the search) just gets someone into the map tool —
// there's no query-string search API to hand a term to from outside
// the map itself, so this intentionally doesn't try to invent one.
const POPULAR_DESTINATIONS = [
  "Senate Building",
  "ETF Hall",
  "Albert Ilemobade Library",
  "Hostels",
];

function NotFoundPage() {
  // Error routes are never real, indexable content — keep crawlers out
  // and skip the SPA's normal title, same reasoning as /map's noindex.
  useSeo({
    title: "Page Not Found – Maps By FUTA",
    robots: "noindex, nofollow",
  });

  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  function handleSearchSubmit(e) {
    e.preventDefault();
    navigate("/map");
  }

  return (
    <div className={styles.screen}>
      {/* Ambient glow blobs — violet up top, teal low in the frame,
          same construction as before, recolored for the light theme
          per the Figma reference. */}
      <div className={styles.atmosphere} aria-hidden="true">
        <div className={styles.blobPrimary} />
        <div className={styles.blobSecondary} />
        <div className={styles.blobTertiary} />
      </div>

      <header className={styles.header}>
        <div className={styles.headerRow}>
          <Link to="/" className={styles.brand}>
            <span className={styles.brandMark}>
              <img src={mapsLogo} alt="" className={styles.brandLogo} />
            </span>
            <span className={styles.brandText}>
              <span className={styles.brandName}>
                Maps <span className={styles.brandAccent}>by FUTA</span>
              </span>
              <span className={styles.brandTagline}>Campus Navigation</span>
            </span>
          </Link>

          <div className={styles.headerBadges}>
            <span className={styles.statusBadge}>
              <span className={styles.statusDot} aria-hidden="true" />
              Live Campus Map
            </span>
            <span className={styles.coordBadge}>
              <MapPin size={14} strokeWidth={2} />
              7.3042° N, 5.1378° E
            </span>
          </div>
        </div>
      </header>

      <main className={styles.content}>
        <div className={styles.container}>
          <div className={styles.emblemWrap}>
            <span className={styles.pulseRing} aria-hidden="true" />
            <span className={styles.midRing} aria-hidden="true">
              <span className={`${styles.tick} ${styles.tickN}`}>N</span>
              <span className={`${styles.tick} ${styles.tickS}`}>S</span>
              <span className={`${styles.tick} ${styles.tickW}`}>W</span>
              <span className={`${styles.tick} ${styles.tickE}`}>E</span>
              <span className={styles.needleDisc}>
                <Navigation
                  className={styles.needleIcon}
                  size={22}
                  strokeWidth={2}
                  fill="currentColor"
                />
              </span>
            </span>
            <span className={styles.sectorBadge}>SECTOR UNMAPPED</span>
          </div>

          <span className={styles.errorPill}>
            <span className={styles.errorDot} aria-hidden="true" />
            Error 404 • Lost waypoint
          </span>

          <h1 className={styles.title}>
            You&rsquo;ve wandered
            <br />
            <span className={styles.titleAccent}>off the map</span>
          </h1>

          <p className={styles.subtitle}>
            The page or coordinate you&rsquo;re looking for doesn&rsquo;t
            exist or may have been relocated. Let&rsquo;s get you back to
            familiar ground.
          </p>

          <div className={styles.actions}>
            <Link to="/" className={styles.btnPrimary}>
              <ArrowLeft size={16} strokeWidth={2} />
              Back to home
            </Link>
            <Link to="/map" className={styles.btnSecondary}>
              <Map size={16} strokeWidth={2} />
              Open the map
            </Link>
          </div>

          <div className={styles.searchCard}>
            <p className={styles.searchLabel}>
              Looking for a campus building or lecture theatre?
            </p>
            <form className={styles.searchBar} onSubmit={handleSearchSubmit}>
              <Search className={styles.searchIcon} size={16} strokeWidth={2} />
              <input
                type="text"
                className={styles.searchInput}
                placeholder="Search e.g. Senate Building, SEET, ETF..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Search for a campus building or lecture theatre"
              />
              <button type="submit" className={styles.searchButton}>
                Find
              </button>
            </form>
            <div className={styles.chipsRow}>
              <span className={styles.chipsLabel}>Popular:</span>
              {POPULAR_DESTINATIONS.map((name) => (
                <button
                  key={name}
                  type="button"
                  className={styles.chip}
                  onClick={() => navigate("/map")}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </main>

      <footer className={styles.footer}>
        <div className={styles.footerRow}>
          <p className={styles.footerCopy}>
            © {new Date().getFullYear()} MapsByFUTA
            <span className={styles.footerDot} aria-hidden="true">•</span>
            Never Get Lost on Campus Again
          </p>
          <nav className={styles.footerNav} aria-label="Footer">
            <a href={`mailto:${CONTACT_EMAIL}`} className={styles.footerLink}>
              <Flag size={14} strokeWidth={2} />
              Report an issue
            </a>
            <Link to="/terms" className={styles.footerLink}>
              Terms of Service
            </Link>
            <Link to="/privacy" className={styles.footerLink}>
              Privacy Policy
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

export default NotFoundPage;
