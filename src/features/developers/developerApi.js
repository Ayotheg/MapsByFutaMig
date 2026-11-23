import { supabase } from '../../lib/supabase';
import { apiErrorMessage } from './developerData';

// Every call /developers and the admin API tab make. Each one is a
// security-definer function in supabase/public_api_dashboard.sql that checks
// who is asking; the api_* tables themselves stay closed to the browser.

async function call(fn, args) {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) {
    const err = new Error(apiErrorMessage(error));
    err.cause = error;
    throw err;
  }
  return data;
}

export const fetchPricing = () => call('api_pricing');

// ── The signed-in developer's own keys ───────────────────────────────────
export const fetchOverview = () => call('api_dev_overview');
export const createKey = (name) => call('api_dev_create_key', { p_name: name });
export const rollKey = (keyId) => call('api_dev_roll_key', { p_key_id: keyId });
export const revokeKey = (keyId) => call('api_dev_revoke_key', { p_key_id: keyId });
export const fetchKeyUsage = (keyId) => call('api_dev_key_usage', { p_key_id: keyId });
export const cancelRequest = (id) => call('api_dev_cancel_request', { p_id: id });
export const requestCredits = ({ keyId, kind, planId = null, credits = null, note = null }) =>
  call('api_dev_request', { p_key_id: keyId, p_kind: kind, p_plan_id: planId, p_credits: credits, p_note: note });

// ── Admin (each function checks is_admin) ────────────────────────────────
export const fetchAdminOverview = () => call('api_admin_overview');
export const adminGrant = (keyId, amount, kind, note) =>
  call('api_admin_grant', { p_key_id: keyId, p_amount: amount, p_kind: kind, p_note: note || null });
export const adminSetPlan = (keyId, planId, refill = true) =>
  call('api_admin_set_plan', { p_key_id: keyId, p_plan_id: planId, p_refill: refill });
export const adminRevoke = (keyId) => call('api_admin_revoke', { p_key_id: keyId });
export const adminResolveRequest = (id, status) => call('api_admin_resolve_request', { p_id: id, p_status: status });
