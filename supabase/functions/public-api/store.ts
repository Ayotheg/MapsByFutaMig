// ── supabase/functions/public-api/store.ts ───────────────────────────────
//
// Every database call the Public API makes, in one place. It reads place
// data ONLY from the api_public_* views and names every column it selects
// (see _shared/publicApi.ts). Do not add a query on any other table here:
// users, reviews, analytics, events and promotions are off limits to this API.

import {
  CATEGORY_COLUMNS,
  IMAGE_COLUMNS,
  PLACE_COLUMNS,
  USAGE_COLUMNS,
  likePattern,
} from '../_shared/publicApi.ts';

function check(error, what) {
  if (error) throw new Error(`${what}: ${error.message || error.code || 'unknown error'}`);
}

export function createStore(client) {
  return {
    async authorize(keyHash, ipHash) {
      const { data, error } = await client.rpc('api_authorize', { p_key_hash: keyHash, p_ip_hash: ipHash });
      check(error, 'api_authorize');
      return data;
    },

    async listPlaces({ type, q, limit, offset }) {
      const filtered = (query) => {
        if (type) query = query.eq('type', type);
        if (q) query = query.ilike('search_text', likePattern(q));
        return query;
      };
      const { data, error, count } = await filtered(
        client.from('api_public_places').select(PLACE_COLUMNS, { count: 'exact' })
      )
        .order('name', { ascending: true })
        .order('id', { ascending: true })
        .range(offset, offset + limit - 1);
      // Asking for a page past the end is an empty page, not a failure.
      // PostgREST gives no total with that error, so count separately.
      if (error && error.code === 'PGRST103') {
        const counted = await filtered(client.from('api_public_places').select('id', { count: 'exact', head: true }));
        check(counted.error, 'count places');
        return { rows: [], total: counted.count ?? 0 };
      }
      check(error, 'list places');
      return { rows: data || [], total: count ?? (data || []).length };
    },

    async getPlace(id) {
      const { data, error } = await client.from('api_public_places').select(PLACE_COLUMNS).eq('id', id).maybeSingle();
      check(error, 'get place');
      return data;
    },

    async nearbyPlaces({ lat, lng, radius_m, type, limit }) {
      const { data, error } = await client.rpc('api_places_nearby', {
        p_lat: lat,
        p_lng: lng,
        p_radius_m: radius_m,
        p_type: type,
        p_limit: limit,
      });
      check(error, 'nearby places');
      return data || [];
    },

    async categories() {
      const { data, error } = await client
        .from('api_public_categories')
        .select(CATEGORY_COLUMNS)
        .order('type', { ascending: true });
      check(error, 'categories');
      return data || [];
    },

    async placeImages(placeId) {
      const { data, error } = await client
        .from('api_public_place_images')
        .select(IMAGE_COLUMNS)
        .eq('place_id', placeId)
        .order('position', { ascending: true })
        .order('id', { ascending: true });
      check(error, 'place images');
      return data || [];
    },

    async consumeCredits(keyId, cost) {
      const { data, error } = await client.rpc('consume_credits', { p_key_id: keyId, p_cost: cost });
      if (error && /insufficient_credits/.test(error.message || '')) return { insufficient: true };
      if (error && /key_revoked/.test(error.message || '')) return { revoked: true };
      check(error, 'consume_credits');
      return data;
    },

    async logUsage(row) {
      const { error } = await client.from('api_usage').insert(row);
      check(error, 'log usage');
    },

    async recentUsage(keyId) {
      const { data, error } = await client
        .from('api_usage')
        .select(USAGE_COLUMNS)
        .eq('key_id', keyId)
        .order('created_at', { ascending: false })
        .limit(20);
      check(error, 'recent usage');
      return data || [];
    },
  };
}
