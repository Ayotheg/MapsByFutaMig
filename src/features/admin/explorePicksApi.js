import { supabase } from '../../lib/supabase';

// ── Explore Picks — Supabase CRUD ───────────────────────────────────────
//
// Backs the admin "Explore" tab (ExploreTab.jsx). Same anon-key/RLS
// caveat as quickChipsApi.js — see supabase/explore_picks.sql's own note.
//
// Deliberately tolerant of the table not existing yet: fetchExplorePicks
// catches and returns `[]` rather than throwing, so useExplorePicks()
// (src/features/explore/) can fall back to its own auto-generated list
// before the person runs supabase/explore_picks.sql. Writes do throw on
// failure — those only happen from inside the admin tab, which should
// surface the error rather than silently no-op.

let warnedMissingTable = false;
function warnOnce(err) {
  if (warnedMissingTable) return;
  warnedMissingTable = true;
  console.info(
    '[explore_picks] Falling back to auto-generated Explore picks — run supabase/explore_picks.sql to make the Explore panel admin-editable.',
    err?.message || err
  );
}

function rowToPick(row) {
  return {
    id: row.id,
    waypointId: row.waypoint_id,
    tags: row.tags || [],
    isPromoted: !!row.is_promoted,
    sponsorName: row.sponsor_name || '',
    promoLabel: row.promo_label || 'Promoted',
    priority: row.priority ?? 0,
    sortOrder: row.sort_order ?? 0,
    active: row.active !== false,
    activeFrom: row.active_from,
    activeUntil: row.active_until,
  };
}

/** All picks, in display order. Returns [] (not a throw) if the table
 * doesn't exist yet — callers should fall back accordingly, same
 * contract as fetchChips() falling back to DEFAULT_CHIPS. */
export async function fetchExplorePicks() {
  const { data, error } = await supabase
    .from('explore_picks')
    .select('*')
    .order('sort_order', { ascending: true });
  if (error) {
    warnOnce(error);
    return [];
  }
  return (data || []).map(rowToPick);
}

/** Adds a waypoint to the Explore rotation. `waypointId` comes from the
 * admin tab's name search against the already-loaded `waypoints` list —
 * no new place data is created here, only a reference + curation fields. */
export async function createExplorePick({ waypointId, tags, isPromoted, sponsorName, promoLabel, priority, sortOrder }) {
  const row = {
    waypoint_id: waypointId,
    tags: tags || [],
    is_promoted: !!isPromoted,
    sponsor_name: isPromoted ? (sponsorName || '').trim() || null : null,
    promo_label: (promoLabel || 'Promoted').trim() || 'Promoted',
    priority: priority ?? 0,
    sort_order: sortOrder ?? 999,
  };
  const { data, error } = await supabase.from('explore_picks').insert(row).select().single();
  if (error) throw error;
  return rowToPick(data);
}

/** Updates an existing pick. Pass only the fields that changed —
 * undefined fields are left alone (same convention as updateChip). */
export async function updateExplorePick(id, patch) {
  const update = {};
  if (patch.tags !== undefined) update.tags = patch.tags;
  if (patch.isPromoted !== undefined) update.is_promoted = !!patch.isPromoted;
  if (patch.sponsorName !== undefined) update.sponsor_name = patch.sponsorName || null;
  if (patch.promoLabel !== undefined) update.promo_label = patch.promoLabel || 'Promoted';
  if (patch.priority !== undefined) update.priority = patch.priority;
  if (patch.sortOrder !== undefined) update.sort_order = patch.sortOrder;
  if (patch.active !== undefined) update.active = !!patch.active;

  const { error } = await supabase.from('explore_picks').update(update).eq('id', id);
  if (error) throw error;
  return { id, ...update };
}

/** Removes a place from the Explore rotation entirely (does not touch
 * the underlying waypoint — this only deletes the curation row). */
export async function deleteExplorePick(id) {
  const { error } = await supabase.from('explore_picks').delete().eq('id', id);
  if (error) throw error;
}

/** Same error-shaping convention as quickChipsApi.js's describeError —
 * duplicated rather than imported since the table name in the message
 * differs and these two features should stay independently editable. */
export function describeError(e) {
  const raw = e?.message || String(e || 'Something went wrong.');
  if (/networkerror|failed to fetch|cors/i.test(raw)) {
    return `Couldn't reach the database (${raw}). Check that supabase/explore_picks.sql has been run, and that no browser extension or privacy setting is blocking requests to Supabase.`;
  }
  if (/violates row-level security policy/i.test(raw)) {
    return `Permission denied. Make sure you're signed in as an admin and supabase/explore_picks.sql has been run.`;
  }
  if (/duplicate key value violates unique constraint/i.test(raw)) {
    return `That place is already in Explore — edit its existing entry instead of adding it twice.`;
  }
  return raw;
}
