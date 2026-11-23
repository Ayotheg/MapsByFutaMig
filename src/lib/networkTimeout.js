// ── Network timeout helper ──────────────────────────────────────────────────
//
// Plain `fetch` (and supabase-js queries, which use `fetch` under the hood)
// never time out on their own — a degraded connection (packets going out
// but nothing coming back) can leave a request pending far longer than a
// user will wait. `StaticKmlLayer.jsx` already solved this for the bundled
// KML loader; this generalizes the same AbortController pattern for
// Supabase calls, which support `.abortSignal(signal)` on every query
// builder.
//
// Usage:
//   const { signal, done } = withTimeoutSignal(8000);
//   const res = await supabase.from('waypoints').select('*').abortSignal(signal);
//   done(); // always clear the timer once the request settles, win or lose
export const DEFAULT_TIMEOUT_MS = 8000;

export function withTimeoutSignal(ms = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return {
    signal: controller.signal,
    done: () => clearTimeout(timer),
  };
}

// Supabase surfaces an aborted request as a thrown error with `name ===
// 'AbortError'` (from the underlying fetch), same as StaticKmlLayer's own
// check — kept as a shared helper so every call site describes it the
// same way to the user instead of a raw "signal is aborted".
export function isTimeoutError(err) {
  return err?.name === 'AbortError';
}
