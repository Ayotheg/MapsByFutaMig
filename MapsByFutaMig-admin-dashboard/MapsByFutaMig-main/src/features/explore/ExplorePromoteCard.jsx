import { Link } from 'react-router-dom';
import { Megaphone, MoveUpRight } from 'lucide-react';
import { track } from '../../lib/analytics';
import { MIN_DAYS, NAIRA_PER_DAY, formatNaira } from '../promote/pricing';
import styles from './ExploreSections.module.css';

/**
 * "Get your spot featured" card — the last card in the Places Featured
 * rail, replacing the old "Want to be featured? Start here." text link.
 * Same destination (/promote, an in-app route, so a router <Link>) and the
 * same `promote_link_click` event, with `source` telling the placements
 * apart in the Insights tab. The price is the real minimum campaign
 * (pricing.js), not a hard-coded figure.
 */
export default function ExplorePromoteCard({ source, size }) {
  return (
    <Link
      to="/promote"
      className={`${styles.promoteCard} ${size === 'sm' ? styles.promoteCardSm : ''}`}
      onClick={() => track('promote_link_click', { source })}
    >
      <span className={styles.promoteIcon}>
        <Megaphone size={size === 'sm' ? 16 : 20} strokeWidth={2} aria-hidden="true" />
      </span>
      <span className={styles.promoteText}>
        <span className={styles.promoteTitle}>Get your spot featured</span>
        <span className={styles.promotePrice}>
          Promote from {formatNaira(MIN_DAYS * NAIRA_PER_DAY)}
          <MoveUpRight size={13} aria-hidden="true" />
        </span>
      </span>
    </Link>
  );
}
