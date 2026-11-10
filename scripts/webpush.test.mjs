// Round-trip tests for supabase/functions/_shared/webpush.js: encrypt as the
// server does, decrypt as a browser would (RFC 8291), and check the VAPID
// signature against the public key.
// Run: node scripts/webpush.test.mjs
import assert from 'node:assert/strict';
import { b64urlDecode, b64urlEncode, encryptPayload, vapidAuthorization } from '../supabase/functions/_shared/webpush.js';

const enc = new TextEncoder();
const subtle = crypto.subtle;

async function hkdf(salt, ikm, info, len) {
  const k = await subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, k, len * 8));
}
const cat = (...p) => {
  const o = new Uint8Array(p.reduce((n, x) => n + x.length, 0));
  let i = 0;
  for (const x of p) { o.set(x, i); i += x.length; }
  return o;
};

// A "browser" subscription.
const ua = await subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
const uaPublic = new Uint8Array(await subtle.exportKey('raw', ua.publicKey));
const authSecret = crypto.getRandomValues(new Uint8Array(16));

async function decrypt(body) {
  const salt = body.slice(0, 16);
  const rs = new DataView(body.buffer, body.byteOffset + 16, 4).getUint32(0);
  const idlen = body[20];
  const asPublic = body.slice(21, 21 + idlen);
  const cipher = body.slice(21 + idlen);
  assert.equal(rs, 4096);
  assert.equal(idlen, 65);
  const asKey = await subtle.importKey('raw', asPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const secret = new Uint8Array(await subtle.deriveBits({ name: 'ECDH', public: asKey }, ua.privateKey, 256));
  const ikm = await hkdf(authSecret, secret, cat(enc.encode('WebPush: info\0'), uaPublic, asPublic), 32);
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);
  const key = await subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt']);
  const plain = new Uint8Array(await subtle.decrypt({ name: 'AES-GCM', iv: nonce }, key, cipher));
  assert.equal(plain[plain.length - 1], 2, 'last-record delimiter');
  return new TextDecoder().decode(plain.slice(0, -1));
}

// Encrypt → decrypt gives the same text back.
{
  const msg = JSON.stringify({ title: 'How was Campus Cuts?', body: 'You were there an hour ago · takes 10 seconds', url: '/map?open=review:abc' });
  const body = await encryptPayload(msg, b64urlEncode(uaPublic), b64urlEncode(authSecret));
  assert.equal(await decrypt(body), msg);
}

// Every message uses a fresh salt and sender key.
{
  const a = await encryptPayload('x', b64urlEncode(uaPublic), b64urlEncode(authSecret));
  const b = await encryptPayload('x', b64urlEncode(uaPublic), b64urlEncode(authSecret));
  assert.notDeepEqual(a.slice(0, 16), b.slice(0, 16));
}

// VAPID: header names the push service origin and verifies with the public key.
{
  const vk = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const publicKey = b64urlEncode(new Uint8Array(await subtle.exportKey('raw', vk.publicKey)));
  const privateKey = (await subtle.exportKey('jwk', vk.privateKey)).d;
  const now = Date.UTC(2026, 10, 10);
  const value = await vapidAuthorization('https://fcm.googleapis.com/fcm/send/abc123', { publicKey, privateKey, subject: 'mailto:hello@mapsbyfuta.xyz' }, now);
  const m = /^vapid t=([^.]+)\.([^.]+)\.([^,]+), k=(.+)$/.exec(value);
  assert.ok(m, value);
  assert.equal(m[4], publicKey);
  const claims = JSON.parse(new TextDecoder().decode(b64urlDecode(m[2])));
  assert.equal(claims.aud, 'https://fcm.googleapis.com');
  assert.equal(claims.sub, 'mailto:hello@mapsbyfuta.xyz');
  assert.equal(claims.exp, now / 1000 + 12 * 3600);
  const ok = await subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, vk.publicKey, b64urlDecode(m[3]), enc.encode(`${m[1]}.${m[2]}`));
  assert.ok(ok, 'signature verifies');
}

console.log('webpush tests passed');
