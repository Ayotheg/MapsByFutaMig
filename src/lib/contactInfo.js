// Direct contact points for Maps By FUTA — the two channels that reach a
// person (as opposed to the WhatsApp *broadcast* channel in
// whatsappChannel.js). Used by the Profile card's support footer.
//
// NOTE: pages/landing/Footer.jsx still carries its own copies of these two
// values (landing page is out of scope for the in-app redesign). If either
// changes, update both — or point Footer.jsx at this file.
export const CONTACT_EMAIL = 'gearlifycorporation@gmail.com';

// wa.me click-to-chat API — full international number, no "+" or leading zero.
export const WHATSAPP_NUMBER = '2348101734037';
export const WHATSAPP_CHAT_URL = `https://wa.me/${WHATSAPP_NUMBER}`;
