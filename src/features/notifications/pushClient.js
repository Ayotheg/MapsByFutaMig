import { supabase } from '../../lib/supabase';
import { isNativeApp } from '../../lib/platform';
import { isInstalled } from '../install/installVideo';

// ── Web push on this device (supabase/push_notifications.sql) ──────────────
// Accounts only: a subscription is always saved against the signed-in
// person, and removed from this device when they sign out.

const VAPID_PUBLIC_KEY = (import.meta.env.VITE_VAPID_PUBLIC_KEY || '').trim();

// The switches people see in their profile (missing = on).
export const PUSH_PREFS = [
  { key: 'weekly', title: 'Weekly round-up', sub: 'New places, events and news · Sundays 6 pm' },
  { key: 'reviews', title: 'Review reminders', sub: 'An hour after you visit a place' },
];

function isIOS() {
  const ua = navigator.userAgent || '';
  return /iPad|iPhone|iPod/.test(ua) || (ua.includes('Mac') && navigator.maxTouchPoints > 1);
}

/**
 * 'ok' — can turn on here; 'ios-install' — iPhone/iPad needs the site
 * added to the home screen first; 'unsupported' — this browser (or a
 * local dev build, where the service worker isn't registered) can't.
 */
export async function pushSupport() {
  if (typeof window === 'undefined' || isNativeApp()) return 'unsupported';
  if (isIOS() && !isInstalled()) return 'ios-install';
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'unsupported';
  if (!VAPID_PUBLIC_KEY) return 'unsupported';
  const reg = await navigator.serviceWorker.getRegistration();
  return reg ? 'ok' : 'unsupported';
}

export function pushPermission() {
  return typeof Notification === 'undefined' ? 'default' : Notification.permission;
}

async function currentSubscription() {
  const reg = await navigator.serviceWorker.getRegistration();
  return reg ? reg.pushManager.getSubscription() : null;
}

function keyBytes(b64url) {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function saveSubscription(sub) {
  const json = sub.toJSON();
  const { error } = await supabase.rpc('save_push_subscription', {
    p_endpoint: json.endpoint,
    p_p256dh: json.keys?.p256dh,
    p_auth: json.keys?.auth,
    p_user_agent: navigator.userAgent,
  });
  if (error) throw error;
}

/** Is this device set up to receive this account's notifications? */
export async function isThisDeviceOn() {
  if (pushPermission() !== 'granted') return false;
  try {
    return !!(await currentSubscription());
  } catch {
    return false;
  }
}

/**
 * Asks the browser, subscribes, saves. Resolves to { ok: true } or
 * { ok: false, message } with a sentence to show.
 */
export async function turnOnPush() {
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return {
        ok: false,
        message:
          permission === 'denied'
            ? 'Notifications are blocked for this site. Allow them in your browser settings, then try again.'
            : 'Notifications weren’t turned on.',
      };
    }
    const reg = await navigator.serviceWorker.ready;
    const sub =
      (await reg.pushManager.getSubscription()) ||
      (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC_KEY) }));
    await saveSubscription(sub);
    return { ok: true };
  } catch (err) {
    console.error('turnOnPush failed:', err);
    return { ok: false, message: 'Couldn’t turn on notifications. Check your connection and try again.' };
  }
}

/** Turns this device off for this account (and in the browser). */
export async function turnOffPush() {
  try {
    const sub = await currentSubscription();
    if (!sub) return true;
    await supabase.rpc('delete_push_subscription', { p_endpoint: sub.endpoint });
    await sub.unsubscribe();
    return true;
  } catch (err) {
    console.error('turnOffPush failed:', err);
    return false;
  }
}

/**
 * After signing in: if this browser already has a subscription, attach it
 * to the account now signed in (a shared device follows its last user).
 */
export async function syncThisDevice() {
  try {
    if (pushPermission() !== 'granted' || (await pushSupport()) !== 'ok') return;
    const sub = await currentSubscription();
    if (sub) await saveSubscription(sub);
  } catch {
    // Next sign-in or profile visit tries again.
  }
}

/** Before signing out: stop this device getting the account's notifications. */
export async function forgetThisDevice() {
  try {
    const sub = await currentSubscription();
    if (sub) await supabase.rpc('delete_push_subscription', { p_endpoint: sub.endpoint });
  } catch {
    // Signing out still goes ahead.
  }
}

/** { weekly: bool, reviews: bool } or null when it couldn't be read. */
export async function fetchPushPrefs(userId) {
  try {
    const { data, error } = await supabase.from('profiles').select('push_prefs').eq('id', userId).maybeSingle();
    if (error || !data) return null;
    const prefs = data.push_prefs || {};
    return Object.fromEntries(PUSH_PREFS.map(({ key }) => [key, prefs[key] !== false]));
  } catch {
    return null;
  }
}

export async function savePushPref(key, on) {
  try {
    const { error } = await supabase.rpc('set_push_pref', { p_key: key, p_on: on });
    if (error) console.error('set_push_pref failed:', error);
    return !error;
  } catch (err) {
    console.error('set_push_pref failed:', err);
    return false;
  }
}

/** "How was …?" an hour after arriving. Fire-and-forget. */
export function queueReviewReminder(waypointId) {
  if (!waypointId) return;
  supabase.rpc('queue_review_reminder', { p_waypoint_id: String(waypointId) }).then(
    ({ error }) => error && console.warn('queue_review_reminder failed:', error.message),
    () => {}
  );
}
