import { Send, Link2, AtSign } from 'lucide-react';
import WhatsAppIcon from './WhatsAppIcon';

// ── Platform picker (supabase/channel_entries.sql, supabase/business_entries.sql) ──
// One shared "platform -> icon/color/link-prefill" lookup, same
// "single source of truth" precedent typeIcons.js already established
// for waypoint types. Used by:
//   - AdminEditModal.jsx: the platform-picker pills on BOTH the Channel
//     edit form (channelLink/channelPlatform, uses CHANNEL_PLATFORMS) and
//     the Business edit form (businessLink/businessPlatform, uses
//     BUSINESS_PLATFORMS below) — picking one prefills the Link field
//     with that platform's prefix so the admin only has to paste the
//     rest. Two separate lists, not one shared array, because WhatsApp
//     means something different in each context (see below) — everything
//     else about the two lists is identical.
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
    // A Channel's whole point is "join this broadcast" (channel_entries.sql:
    // ExploreCard's CTA literally reads "Join the Channel") — a
    // whatsapp.com/channel/... invite link is the correct default here,
    // unlike BUSINESS_PLATFORMS below.
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

// Business's WhatsApp default is a direct DM (wa.me/<number>), not a
// broadcast Channel invite — a business wants a customer messaging them
// personally, not joining a channel. Explicit request: if a business
// genuinely wants to share a WhatsApp *Channel* link instead of a DM
// number, "Other link" is where that goes — this list deliberately
// doesn't try to guess which one a whatsapp.com/... paste means.
// Same label/icon/color as CHANNEL_PLATFORMS' entries; only the
// WhatsApp prefill differs, so this is built from that list rather than
// duplicated by hand (one edit to color/icon/label still updates both).
export const BUSINESS_PLATFORMS = CHANNEL_PLATFORMS.map((p) =>
  p.key === 'whatsapp' ? { ...p, prefill: 'https://wa.me/' } : p
);

function findPlatform(list, platform) {
  return list.find((p) => p.key === platform) || list.find((p) => p.key === 'other');
}

export function channelPlatformMeta(platform) {
  return findPlatform(CHANNEL_PLATFORMS, platform);
}

export function businessPlatformMeta(platform) {
  return findPlatform(BUSINESS_PLATFORMS, platform);
}

