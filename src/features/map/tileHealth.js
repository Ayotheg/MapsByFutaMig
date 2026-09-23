// ── Tile health watcher ──────────────────────────────────────────────────
// Leaflet never retries a failed tile and has no request timeout, so a
// stalled or flaky tile server leaves grey squares (or a fully grey map)
// with no signal to the person. This watches one tile layer and:
//   1. Retries each failed tile up to TILE_MAX_RETRIES times with backoff
//      (re-assigning the same `src` makes the browser refetch it; Leaflet's
//      own load/error listeners stay attached, so a successful retry still
//      flips the tile to loaded).
//   2. Raises ONE alert via `onProblem` when the map is clearly not
//      loading properly:
//        - "dead": nothing has loaded within TILE_STALL_MS, or
//          TILE_FAIL_THRESHOLD tiles errored with none loaded. If a tile
//          then loads (a merely slow network), `onRecovered` is called so
//          the alert can withdraw itself.
//        - "patchy": TILE_GIVEUP_THRESHOLD tiles failed even after all
//          their retries (grey holes). No auto-withdraw — other tiles
//          loading says nothing about those holes.
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
export const TILE_STALL_MS = 10000;
export const TILE_FAIL_THRESHOLD = 4;
export const TILE_GIVEUP_THRESHOLD = 4;

/**
 * @param layer  object with on/off/once — a Leaflet tile layer
 * @param opts   { onProblem(), onRecovered(), isOnline?() }
 * @returns dispose() — also runs automatically when the layer is removed
 */
export function watchTileLayer(layer, { onProblem, onRecovered, isOnline } = {}) {
  const online = isOnline || (() => typeof navigator === 'undefined' || navigator.onLine !== false);

  let loaded = 0;
  let failed = 0;
  let gaveUp = 0;
  let alerted = false;
  let autoWithdraw = false;
  let disposed = false;
  const timers = new Set();

  const later = (fn, ms) => {
    const t = setTimeout(() => {
      timers.delete(t);
      if (!disposed) fn();
    }, ms);
    timers.add(t);
  };

  const raise = (recoverable) => {
    if (alerted || disposed || !online()) return;
    alerted = true;
    autoWithdraw = recoverable;
    onProblem?.();
  };

  const onTileLoad = () => {
    loaded += 1;
    if (alerted && autoWithdraw) {
      // It was just slow, not dead. Withdraw, and allow a later re-alert.
      alerted = false;
      autoWithdraw = false;
      onRecovered?.();
    }
  };

  const onTileError = (e) => {
    failed += 1;
    const tile = e?.tile;
    const tries = tile?.__retries || 0;
    if (tile && tries < TILE_MAX_RETRIES) {
      tile.__retries = tries + 1;
      const src = tile.src;
      later(() => {
        if (tile.isConnected !== false && tile.src === src) tile.src = src;
      }, 800 * 2 ** tries);
    } else {
      gaveUp += 1;
    }
    if (loaded === 0 && failed >= TILE_FAIL_THRESHOLD) raise(true);
    if (gaveUp >= TILE_GIVEUP_THRESHOLD) raise(false);
  };

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
    timers.forEach(clearTimeout);
    timers.clear();
  };
  layer.once('remove', dispose);
  return dispose;
}
