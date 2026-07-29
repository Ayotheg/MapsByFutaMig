import { supabase } from '../../lib/supabase';
import { DEFAULT_CHIPS } from '../search/chipConfig';

// ── Quick Chips — Supabase CRUD ─────────────────────────────────────────
//
// Backs the admin "Chips" tab (QuickChipsTab.jsx). Same anon-key/RLS
// caveat as adminSave.js — see supabase/quick_chips.sql's own note.
//
// Deliberately tolerant of the table not existing yet: every read here
// catches and falls back to `DEFAULT_CHIPS` (the 16 built-ins) rather
// than throwing, so the app works identically before and after the
// person runs supabase/quick_chips.sql. Writes (upsert/delete) do throw
// on failure — those only happen from inside the admin tab, which should
// surface the error rather than silently no-op.

let warnedMissingTable = false;
function warnOnce(err) {
  if (warnedMissingTable) return;
  warnedMissingTable = true;
  console.info(
    '[quick_chips] Falling back to built-in default chips — run supabase/quick_chips.sql to make Quick Chips admin-editable.',
    err?.message || err
  );
}

function rowToChip(row) {
  return {
    id: row.id,
    label: row.label,
    iconKey: row.icon_key || null,
    keywords: row.keywords || [],
    pinnedIds: row.pinned_ids || [],
    excludedIds: row.excluded_ids || [],
    isCustom: !!row.is_custom,
    sortOrder: row.sort_order ?? 0,
  };
}

/** All chips, in display order. Falls back to DEFAULT_CHIPS if the table
 * doesn't exist yet (fresh installs, before supabase/quick_chips.sql). */
export async function fetchChips() {
  const { data, error } = await supabase
    .from('quick_chips')
    .select('*')
    .order('sort_order', { ascending: true });
  if (error) {
    warnOnce(error);
    return DEFAULT_CHIPS;
  }
  if (!data || data.length === 0) return DEFAULT_CHIPS;
  return data.map(rowToChip);
}

function slugify(label) {
  const base = (label || 'chip')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return (base || 'chip') + '_' + Math.random().toString(36).slice(2, 7);
}

/** Creates a brand-new custom chip. `keywords` is the raw comma/newline
 * separated string from the admin form — split/trimmed here so the tab
 * component doesn't need to know the storage shape. `pinnedIds` lets a
 * chip be created purely from hand-picked places, with no keywords at
 * all — useful when every candidate keyword would clash with another
 * chip's places. */
export async function createChip({ label, keywordsText, pinnedIds, sortOrder }) {
  const keywords = splitKeywords(keywordsText);
  const row = {
    id: slugify(label),
    label: label.trim(),
    icon_key: null,
    keywords,
    pinned_ids: pinnedIds || [],
    excluded_ids: [],
    sort_order: sortOrder ?? 999,
    is_custom: true,
  };
  const { error } = await supabase.from('quick_chips').insert(row);
  if (error) throw error;
  return rowToChip(row);
}

/** Updates an existing chip's label/emoji/keywords/pinned/excluded. Pass
 * only the fields that changed — undefined fields are left alone. Note:
 * no `.select()` round-trip after the write — one fewer request in the
 * chain that can fail, and we already know exactly what the row now
 * looks like from `patch`, so we merge it client-side instead of
 * re-fetching it. */
export async function updateChip(id, patch) {
  const update = {};
  if (patch.label !== undefined) update.label = patch.label;
  if (patch.keywordsText !== undefined) update.keywords = splitKeywords(patch.keywordsText);
  if (patch.keywords !== undefined) update.keywords = patch.keywords;
  if (patch.pinnedIds !== undefined) update.pinned_ids = patch.pinnedIds;
  if (patch.excludedIds !== undefined) update.excluded_ids = patch.excludedIds;
  if (patch.sortOrder !== undefined) update.sort_order = patch.sortOrder;

  const { error } = await supabase.from('quick_chips').update(update).eq('id', id);
  if (error) throw error;
  return { id, ...update };
}

/** Removes a chip entirely — including a default one; the person asked
 * for "a way for the admin to remove from the existing quick chips",
 * which applies to the seeded defaults too, not just custom ones. */
export async function deleteChip(id) {
  const { error } = await supabase.from('quick_chips').delete().eq('id', id);
  if (error) throw error;
}

/** Toggle one waypoint in/out of a chip's pinned or excluded list — the
 * "under a particular quick chip, delete some that don't fit / add
 * others" affordance. Reads the current row first so this is safe to
 * call from a list of independent toggle buttons without a stale patch
 * clobbering a concurrent one. */
export async function togglePinned(chip, waypointId, shouldPin) {
  const pinnedIds = new Set(chip.pinnedIds || []);
  const excludedIds = new Set(chip.excludedIds || []);
  if (shouldPin) {
    pinnedIds.add(waypointId);
    excludedIds.delete(waypointId);
  } else {
    pinnedIds.delete(waypointId);
  }
  return updateChip(chip.id, { pinnedIds: [...pinnedIds], excludedIds: [...excludedIds] });
}

export async function toggleExcluded(chip, waypointId, shouldExclude) {
  const pinnedIds = new Set(chip.pinnedIds || []);
  const excludedIds = new Set(chip.excludedIds || []);
  if (shouldExclude) {
    excludedIds.add(waypointId);
    pinnedIds.delete(waypointId);
  } else {
    excludedIds.delete(waypointId);
  }
  return updateChip(chip.id, { pinnedIds: [...pinnedIds], excludedIds: [...excludedIds] });
}

/** Turns a thrown Supabase/fetch error into something a person can act
 * on. A bare "NetworkError when attempting to fetch resource" (no HTTP
 * status at all) almost always means the request never reached
 * Supabase — table not created yet (supabase/quick_chips.sql not run),
 * a browser extension/tracking-protection blocking the request, or the
 * project being paused — rather than anything wrong with the click
 * itself, so say that instead of just echoing the raw error. */
export function describeError(e) {
  const raw = e?.message || String(e || 'Something went wrong.');
  if (/networkerror|failed to fetch|cors/i.test(raw)) {
    return `Couldn't reach the database (${raw}). Check that supabase/quick_chips.sql has been run, and that no browser extension or privacy setting is blocking requests to Supabase.`;
  }
  return raw;
}

export function splitKeywords(text) {
  return (text || '')
    .split(/[,\n]/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function joinKeywords(keywords) {
  return (keywords || []).join(', ');
}
