import { useImageStatus } from '../../lib/useImageStatus';

/**
 * PlaceImage — an <img> that never leaves a broken-image box behind.
 *
 * If `src` is missing or fails to load (Supabase unreachable, file
 * deleted, offline…), it renders `fallback` instead — callers pass the
 * place's type icon (see lib/typeIcons.js `getTypeIcon`) or a lucide
 * `ImageOff`. Loads lazily by default: place photos are served at their
 * original upload size, so off-screen thumbnails must not download until
 * they're about to be seen. Pass `eager` for above-the-fold images.
 */
export default function PlaceImage({ src, alt = '', fallback = null, eager = false, ...rest }) {
  const { failed, onError } = useImageStatus(src);
  if (failed) return fallback;
  return (
    <img
      {...rest}
      src={src}
      alt={alt}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      onError={onError}
    />
  );
}
