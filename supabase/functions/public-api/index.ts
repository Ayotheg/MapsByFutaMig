// ── supabase/functions/public-api/index.ts ───────────────────────────────
//
// The paid, read-only Public API (docs/public-api.md). Other developers'
// servers call this with an `x-api-key` header; it is the only thing they
// ever talk to. They never get the Supabase URL's data API or the anon key.
//
// Deploy: `supabase functions deploy public-api --no-verify-jwt`
// `--no-verify-jwt` is required: callers have an API key, not a Supabase
// JWT. The function does its own auth (handler.ts), like bachs-webhook.
//
// Database: run supabase/public_api.sql first.
// Secrets:  IMAGE_PROXY_URL (optional; the same ImageKit address the app
//           uses, so photo URLs don't point at Supabase Storage).
//           SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by
//           Supabase. The service role key stays inside this function.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { createHandler } from './handler.ts';
import { createStore } from './store.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL');

const client = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'), {
  auth: { persistSession: false, autoRefreshToken: false },
});

const handle = createHandler({
  store: createStore(client),
  config: { imageProxyUrl: Deno.env.get('IMAGE_PROXY_URL') ?? '', supabaseUrl },
});

Deno.serve(handle);
