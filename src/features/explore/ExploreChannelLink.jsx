import { Link } from 'react-router-dom';
import { MoveUpRight } from 'lucide-react';
import { track } from '../../lib/analytics';
import styles from './ExploreChannelLink.module.css';

/**
 * Feature submission link shown on the Explore tab.
 *
 * Deliberately NOT an Explore card: the list it sits beside also carries
 * promoted "Featured Partner" picks and (on desktop) a "Showing N verified
 * vendors" count, so a card-shaped channel promo inside it would read as a
 * paid placement and muddy that count. Both variants render outside the
 * pick list instead.
 *
 *  - `variant="text"` (mobile sheet, compact + full): a single centered
 *    line of muted text with the link portion in the accent color. Kept
 *    short enough to stay on one line down to ~360px-wide phones. Low
 *    height on purpose — the half-height sheet is already tight — and
 *    the whole line is the tap target.
 *  - `variant="row"` (desktop sidebar panel): a slim pinned row between
 *    the scrolling list and the panel footer.
 *
 * `source` tags the click event so placements can be compared in the
 * Insights tab.
 *
 * A router <Link>, not a plain <a href>: /promote is an in-app route, and a
 * plain anchor made the browser reload the whole app to get there.
 */
export default function ExploreChannelLink({ variant = 'text', source }) {
  const linkProps = {
    to: '/promote',
    onClick: () => track('promote_link_click', { source }),
  };

  if (variant === 'row') {
    return (
      <Link className={styles.row} {...linkProps}>
        <span>Want to be featured?</span>{' '}
        <strong>Start here.</strong>
        <MoveUpRight size={14} className={styles.rowArrow} aria-hidden="true" />
      </Link>
    );
  }

  return (
    <Link className={styles.text} {...linkProps}>
      Want to be featured? <strong>Start here.</strong>
      <MoveUpRight size={13} className={styles.arrow} aria-hidden="true" />
    </Link>
  );
}

