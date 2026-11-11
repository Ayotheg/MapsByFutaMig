// The Maps By FUTA WhatsApp Channel — where announcements and new features
// are posted. One constant so every placement (landing footer, Explore tab
// on mobile and desktop) links to the same place; change it here if the
// channel is ever recreated.
//
// Click tracking: in-app placements call `track('whatsapp_channel_click',
// { source })` from lib/analytics directly. The landing page can't import
// analytics at module level (it pulls in the Supabase client, and the
// landing page is prerendered at build time — see entry-server.jsx), so
// Footer.jsx loads it lazily on click instead.
export const WHATSAPP_CHANNEL_URL = 'https://whatsapp.com/channel/0029Vb8alnH2ZjCiSkrVn03A';

// The map's "join our channel" prompt (features/whatsapp/ChannelPrompt.jsx)
// remembers per device whether it's been shown / the channel was joined.
// Any channel link that's clicked should call markChannelJoined() so the
// prompt never asks someone who already joined. Plain localStorage, safe to
// import from the prerendered landing page (only touched on call).
const PROMPT_KEY = 'maps-by-futa:whatsapp-channel-prompt';

export function readChannelPrompt() {
  try {
    return JSON.parse(localStorage.getItem(PROMPT_KEY)) || {};
  } catch {
    return {};
  }
}

export function writeChannelPrompt(value) {
  try {
    localStorage.setItem(PROMPT_KEY, JSON.stringify(value));
  } catch {
    // storage blocked (private mode etc.) — the prompt just may show again
  }
}

export function markChannelJoined() {
  writeChannelPrompt({ ...readChannelPrompt(), joined: true });
}
