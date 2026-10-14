// ── Tile health watcher ──────────────────────────────────────────────────
// Leaflet never retries a failed tile and has no request timeout, so a
// stalled or flaky tile server leaves grey squares (or a fully grey map)
// with no signal to the person. This watches one tile layer and:
//   1. Retries each failed tile: TILE_MAX_RETRIES quick retries, then keeps
//      retrying in the background (backoff capped at TILE_BG_MAX_MS) for as
//      long as Leaflet still shows the tile — poor connections often come
//      good after a while, and a page reload costs them far more. Retries
//      pause while offline and all fire at once when the browser is back
//      online, or when `retryNow()` is called (the alert's Retry button).
//      Re-assigning the same `src` makes the browser refetch it; Leaflet's
//      own load/error listeners stay attached, so a successful retry still
//      flips the tile to loaded.
//   2. Raises ONE alert via `onProblem` when the map is clearly not
//      loading properly:
//        - "dead": nothing has loaded within TILE_STALL_MS, or
//          TILE_FAIL_THRESHOLD tiles errored with none loaded. If a tile
//          then loads (a merely slow network), `onRecovered` is called so
//          the alert can withdraw itself.
//        - "patchy": TILE_GIVEUP_THRESHOLD tiles are still failing after
//          their quick retries (grey holes). Withdrawn once every one of
//          those tiles has loaded (or Leaflet has discarded it) — other
//          tiles loading says nothing about those holes.
//   Nothing is raised while the browser reports it's offline; the
//   OfflineBanner already covers that case.
//
// Deliberately framework- and Leaflet-free: it only needs an object with
// on/off/once (any Leaflet layer, or a stub in scripts/tileHealth.test.mjs).
//
// Limit worth knowing: a provider that answers with HTTP 200 placeholder
// tiles (e.g. an "API key required" watermark) counts as healthy — the
// client cannot tell a wrong tile from a right one.

export const TILE_MAX_RETRIES = 2;
export const TILE_BG_FIRST_MS = 5000;
export const TILE_BG_MAX_MS = 30000;
export const TILE_STALL_MS = 10000;
export const TILE_FAIL_THRESHOLD = 4;
export const TILE_GIVEUP_THRESHOLD = 4;

// 0.8s, 1.6s for the quick retries, then 5s, 10s, 20s, 30s, 30s, …
export function retryDelay(tries) {
  if (tries < TILE_MAX_RETRIES) return 800 * 2 ** tries;
  return Math.min(TILE_BG_FIRST_MS * 2 ** (tries - TILE_MAX_RETRIES), TILE_BG_MAX_MS);
}

/**
 * @param layer  object with on/off/once — a Leaflet tile layer
 * @param opts   { onProblem(), onRecovered(), isOnline?() }
 * @returns { dispose(), retryNow() } — dispose also runs automatically when
 *          the layer is removed
 */
export function watchTileLayer(layer, { onProblem, onRecovered, isOnline } = {}) {
  const online = isOnline || (() => typeof navigator === 'undefined' || navigator.onLine !== false);

  let loaded = 0;
  let failed = 0;
  let alerted = false;
  let autoWithdraw = false;
  let disposed = false;
  const timers = new Set();
  // Tiles that errored and haven't loaded yet → their pending retry timer.
  const pending = new Map();
  // The subset still failing after their quick retries — the "grey holes".
  const stuck = new Set();

  const later = (fn, ms) => {
    const t = setTimeout(() => {
      timers.delete(t);
      if (!disposed) fn();
    }, ms);
    timers.add(t);
    return t;
  };

  const raise = (recoverable) => {
    if (alerted || disposed || !online()) return;
    alerted = true;
    autoWithdraw = recoverable;
    onProblem?.();
  };

  const withdraw = () => {
    alerted = false;
    autoWithdraw = false;
    onRecovered?.();
  };

  const forget = (tile) => {
    const t = pending.get(tile);
    if (t !== undefined) {
      clearTimeout(t);
      timers.delete(t);
    }
    pending.delete(tile);
    const wasStuck = stuck.delete(tile);
    if (wasStuck && alerted && !autoWithdraw && stuck.size === 0) withdraw();
  };

  const refetch = (tile) => {
    if (tile.isConnected === false) {
      forget(tile); // Leaflet discarded it (panned/zoomed away)
      return;
    }
    pending.set(tile, undefined);
    // Offline: leave it pending; the `online` listener retries it.
    if (!online()) return;
    const src = tile.src;
    tile.src = src;
  };

  const schedule = (tile) => {
    const tries = tile.__retries || 0;
    tile.__retries = tries + 1;
    const src = tile.src;
    const t = later(() => {
      if (tile.src === src) refetch(tile);
      else forget(tile); // Leaflet reused the element for another tile
    }, retryDelay(tries));
    pending.set(tile, t);
  };

  const onTileLoad = (e) => {
    loaded += 1;
    if (e?.tile) {
      e.tile.__retries = 0;
      forget(e.tile);
    }
    // It was just slow, not dead. Withdraw, and allow a later re-alert.
    if (alerted && autoWithdraw) withdraw();
  };

  const onTileError = (e) => {
    failed += 1;
    const tile = e?.tile;
    if (tile) {
      if ((tile.__retries || 0) >= TILE_MAX_RETRIES) stuck.add(tile);
      schedule(tile);
    }
    if (loaded === 0 && failed >= TILE_FAIL_THRESHOLD) raise(true);
    if (stuck.size >= TILE_GIVEUP_THRESHOLD) raise(false);
  };

  // Every failed tile, right now — for the alert's Retry button and for the
  // moment the browser comes back online.
  const retryNow = () => {
    if (disposed) return;
    [...pending.keys()].forEach((tile) => {
      const t = pending.get(tile);
      if (t !== undefined) {
        clearTimeout(t);
        timers.delete(t);
      }
      refetch(tile);
    });
  };

  const hasWindow = typeof window !== 'undefined' && typeof window.addEventListener === 'function';
  if (hasWindow) window.addEventListener('online', retryNow);

  layer.on('tileload', onTileLoad);
  layer.on('tileerror', onTileError);
  later(() => {
    if (loaded === 0) raise(true);
  }, TILE_STALL_MS);

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    layer.off('tileload', onTileLoad);
    layer.off('tileerror', onTileError);
    if (hasWindow) window.removeEventListener('online', retryNow);
    timers.forEach(clearTimeout);
    timers.clear();
    pending.clear();
    stuck.clear();
  };
  layer.once('remove', dispose);
  return { dispose, retryNow };
}
