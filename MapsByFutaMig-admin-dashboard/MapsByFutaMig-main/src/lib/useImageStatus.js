import { useCallback, useState } from 'react';

/**
 * useImageStatus(src) — tracks whether an <img> for `src` is still
 * loading, loaded, or failed (404, blocked, offline, Supabase down…).
 *
 * The status is keyed to the `src` it was recorded for, so when a card is
 * re-used for a different photo/place the state resets on its own — no
 * effect or manual reset needed. A missing `src` counts as "failed" so
 * callers can use one `failed` check for both "no photo" and "photo
 * couldn't be fetched" and show the type icon in either case.
 */
export function useImageStatus(src) {
  const [state, setState] = useState({ src: null, status: 'loading' });
  const status = !src ? 'failed' : state.src === src ? state.status : 'loading';

  const onLoad = useCallback(() => setState({ src, status: 'loaded' }), [src]);
  const onError = useCallback(() => setState({ src, status: 'failed' }), [src]);

  return { status, loaded: status === 'loaded', failed: status === 'failed', onLoad, onError };
}
