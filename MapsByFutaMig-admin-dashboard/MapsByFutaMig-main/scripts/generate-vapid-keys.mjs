// Prints a new VAPID key pair for web push (supabase/push_notifications.sql).
// Run once: node scripts/generate-vapid-keys.mjs
//   Public key  → VITE_VAPID_PUBLIC_KEY (Vercel + .env.local) and VAPID_PUBLIC_KEY (Supabase secret)
//   Private key → VAPID_PRIVATE_KEY (Supabase secret only). Never commit it.
// A new pair invalidates every existing subscription, so generate it once.
import { b64urlEncode } from '../supabase/functions/_shared/webpush.js';

const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const publicKey = b64urlEncode(new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey)));
const privateKey = (await crypto.subtle.exportKey('jwk', pair.privateKey)).d;

console.log(`VAPID public key:  ${publicKey}`);
console.log(`VAPID private key: ${privateKey}`);
