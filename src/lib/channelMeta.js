import { Send, Link2 } from 'lucide-react';
import WhatsAppIcon from './WhatsAppIcon';

// ── Channel entries (supabase/channel_entries.sql) ─────────────────────
// One shared "platform -> icon/color/link-prefill" lookup, same
// "single source of truth" precedent typeIcons.js already established
// for waypoint types. Used by:
//   - AdminEditModal.jsx: the platform-picker pills on the Channel edit
//     form — picking one prefills the Link field with that platform's
//     invite-link prefix so the admin only has to paste the rest.
//   - PointsTab.jsx: the small platform icon in the admin points list.
//   - ExploreCard.jsx / ExplorePanelDesktop.jsx: the card's avatar icon
//     + brand color when no photo has been uploaded.
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
    key: 'other',
    label: 'Other link',
    icon: Link2,
    color: '#7c3aed',
    prefill: 'https://',
  },
];

const DEFAULT_PLATFORM = CHANNEL_PLATFORMS[2];

export function channelPlatformMeta(platform) {
  return CHANNEL_PLATFORMS.find((p) => p.key === platform) || DEFAULT_PLATFORM;
}
