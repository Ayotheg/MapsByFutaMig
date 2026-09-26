import { Send, Link2, AtSign } from 'lucide-react';
import WhatsAppIcon from './WhatsAppIcon';

// ── Platform picker (supabase/channel_entries.sql, supabase/business_entries.sql) ──
// One shared "platform -> icon/color/link-prefill" lookup, same
// "single source of truth" precedent typeIcons.js already established
// for waypoint types. Used by:
//   - AdminEditModal.jsx: the platform-picker pills on BOTH the Channel
//     edit form (channelLink/channelPlatform) and the Business edit form
//     (businessLink/businessPlatform) — picking one prefills the Link
//     field with that platform's prefix so the admin only has to paste
//     the rest. Same list, two independent field pairs — a row is only
//     ever one or the other (never both).
//   - PointsTab.jsx: the small platform icon in the admin points list.
//   - ExploreCard.jsx / ExplorePanelDesktop.jsx: the channel card's
//     avatar icon + brand color when no photo has been uploaded.
//
// 'instagram' was added for the Business picker (Figma's "PROMOTE" form
// already had it as a contact option — see PromotePage.jsx's own
// CONTACT_PLATFORMS, which this list intentionally now matches) — safe
// to also offer on the Channel form, an Instagram-hosted channel isn't
// unreasonable either, just not the case this was originally built for.
export const CHANNEL_PLATFORMS = [
  {
    key: 'whatsapp',
    label: 'WhatsApp',
    icon: WhatsAppIcon,
    color: '#25d366',
    prefill: 'https://whatsapp.com/channel/',
  },
  {
    key: 'telegram',
    label: 'Telegram',
    icon: Send,
    color: '#229ed9',
    prefill: 'https://t.me/',
  },
  {
    key: 'instagram',
    label: 'Instagram',
    icon: AtSign,
    color: '#e1306c',
    prefill: 'https://instagram.com/',
  },
  {
    key: 'other',
    label: 'Other link',
    icon: Link2,
    color: '#7c3aed',
    prefill: 'https://',
  },
];

const DEFAULT_PLATFORM = CHANNEL_PLATFORMS.find((p) => p.key === 'other');

export function channelPlatformMeta(platform) {
  return CHANNEL_PLATFORMS.find((p) => p.key === platform) || DEFAULT_PLATFORM;
}
