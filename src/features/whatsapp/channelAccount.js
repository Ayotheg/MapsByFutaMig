import { supabase } from '../../lib/supabase';

// Account-level "joined the WhatsApp channel" flag
// (profiles.whatsapp_channel_joined_at — see supabase/whatsapp_channel.sql).
// Kept out of lib/whatsappChannel.js on purpose: that file is imported by
// the prerendered landing page, which must not pull in the Supabase client.

// true / false, or null when it couldn't be checked (offline, SQL not run
// yet) — callers then fall back to the device-only flag.
export async function fetchChannelJoined(userId) {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('whatsapp_channel_joined_at')
      .eq('id', userId)
      .maybeSingle();
    if (error) return null;
    return !!data?.whatsapp_channel_joined_at;
  } catch {
    return null;
  }
}

// Resolves true once the account is marked, false if it couldn't be (the
// caller retries on a later visit).
export async function recordChannelJoined() {
  try {
    const { error } = await supabase.rpc('mark_whatsapp_channel_joined');
    return !error;
  } catch {
    return false;
  }
}
