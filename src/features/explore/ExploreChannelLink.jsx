import { ArrowUpRight } from 'lucide-react';
import WhatsAppIcon from '../../lib/WhatsAppIcon';
import { WHATSAPP_CHANNEL_URL } from '../../lib/whatsappChannel';
import { track } from '../../lib/analytics';
import styles from './ExploreChannelLink.module.css';

/**
 * Link to the Maps By FUTA WhatsApp channel, shown on the Explore tab.
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
 * Insights tab (`whatsapp_channel_click`, props.source).
 */
export default function ExploreChannelLink({ variant = 'text', source }) {
  const handleClick = () => track('whatsapp_channel_click', { source });
  const linkProps = {
    href: WHATSAPP_CHANNEL_URL,
    target: '_blank',
    rel: 'noopener noreferrer',
    onClick: handleClick,
  };

  if (variant === 'row') {
    return (
      <a className={styles.row} {...linkProps}>
        <WhatsAppIcon size={14} className={styles.rowIcon} />
        <span className={styles.rowText}>
          <span className={styles.rowTitle}>New places &amp; feature updates</span>
          <strong className={styles.rowCta}>Join our WhatsApp channel</strong>
        </span>
        <ArrowUpRight size={12} className={styles.rowArrow} aria-hidden="true" />
      </a>
    );
  }

  return (
    <a className={styles.text} {...linkProps}>
      New places &amp; feature updates on{' '}
      <span className={styles.textLink}>
        <WhatsAppIcon size={12} className={styles.icon} />
        WhatsApp
        <ArrowUpRight size={11} className={styles.arrow} aria-hidden="true" />
      </span>
    </a>
  );
}
