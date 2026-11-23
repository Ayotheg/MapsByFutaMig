import { supabase } from '../../lib/supabase';

// Marketing-email consent (profiles.marketing_opt_in — see
// supabase/marketing_optin.sql). Changing it fires a DB trigger that syncs
// the Resend contact; the browser never talks to Resend.

// { optIn, decidedAt } or null when it couldn't be checked (offline, SQL
// not run yet). `decidedAt` is null until the person has answered once.
export async function fetchMarketingConsent(userId) {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('marketing_opt_in, marketing_opt_in_at')
      .eq('id', userId)
      .maybeSingle();
    if (error || !data) return null;
    return { optIn: data.marketing_opt_in === true, decidedAt: data.marketing_opt_in_at };
  } catch {
    return null;
  }
}

// Resolves true once saved, false if it couldn't be.
export async function saveMarketingConsent(optIn) {
  try {
    const { error } = await supabase.rpc('set_marketing_consent', { opt_in: optIn === true });
    if (error) console.error('set_marketing_consent failed:', error);
    return !error;
  } catch (err) {
    console.error('set_marketing_consent failed:', err);
    return false;
  }
}
