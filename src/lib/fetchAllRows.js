import { withTimeoutSignal } from './networkTimeout';

// ── Fetch every row of a query, not just the first 1000 ─────────────────
// Supabase's REST layer (PostgREST) caps every response at `max_rows`
// (1000 by default) and does so SILENTLY — no error, no "truncated" flag,
// just the first 1000 rows of an unordered result. This is a safeguard for
// tables that can exceed 1000 rows (e.g. `waypoints` if the bulk OSM import
// is ever loaded — it once did, and anything past the cut-off never reached
// the map, search or admin list). NOTE: as of Sept 2026 `waypoints` holds
// only ~600+ rows, so today this normally returns in a single request.
// Because Postgres
// stores an UPDATEd row as a new copy at the end of the table, an admin edit
// or approval could push a waypoint *past* the cut-off — so it vanished from
// the map right after being saved, and brand-new points never appeared.
//
// `makeQuery` must return a fresh query builder with a STABLE, unique
// ordering already applied (e.g. `.order('id')`) — paging over an unordered
// or ties-only ordering can skip or repeat rows between pages.
//
// After a first single request, further pages are requested `concurrency`
// at a time (default 4) instead of one after another — on a slow mobile connection the wait is dominated by
// round-trip latency, so 6 pages in 2 waves is far quicker than 6 in a
// row. Reading stops at the first short page; at most `concurrency - 1`
// extra (empty) requests are wasted at the end.
//
// Each page gets its own timeout window so a big table isn't punished for
// being big; a failed/aborted page returns `{ data: null, error }` exactly
// like a single supabase-js call would, so callers' existing offline/cache
// fallbacks keep working unchanged.
export async function fetchAllRows(makeQuery, { pageSize = 1000, timeoutMs, concurrency = 4 } = {}) {
  async function fetchPage(index) {
    const from = index * pageSize;
    const { signal, done } = withTimeoutSignal(timeoutMs);
    try {
      const res = await makeQuery()
        .range(from, from + pageSize - 1)
        .abortSignal(signal);
      // PGRST103 = "range not satisfiable": we asked for a page past the end
      // of the table (possible on the speculative pages of a wave). That just
      // means "no more rows", not a failure.
      if (res.error?.code === 'PGRST103') return { rows: [] };
      return res.error ? { error: res.error } : { rows: res.data || [] };
    } catch (e) {
      // supabase-js normally returns aborts as `error`, but be safe.
      return { error: e };
    } finally {
      done();
    }
  }

  // First wave is a single page: most tables are small, and that one request
  // is the whole job. Only if it comes back full do we know there's more and
  // fan out `concurrency` pages at a time.
  const all = [];
  let next = 0;
  for (let waveSize = 1; ; waveSize = concurrency) {
    const pages = await Promise.all(
      Array.from({ length: waveSize }, (_, i) => fetchPage(next + i))
    );
    next += waveSize;
    for (const page of pages) {
      if (page.error) return { data: null, error: page.error };
    }
    let finished = false;
    for (const page of pages) {
      all.push(...page.rows);
      if (page.rows.length < pageSize) {
        finished = true;
        break; // rows after a short page (if any) are empty by definition
      }
    }
    if (finished) break;
  }
  return { data: all, error: null };
}