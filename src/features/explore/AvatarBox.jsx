import { useImageStatus } from '../../lib/useImageStatus';

/**
 * Round/square avatar used by the Explore cards (mobile + desktop).
 * Shows the place photo when there is one and it loads; otherwise the
 * type/platform icon on its coloured tile — the same look a photo-less
 * place always had, now also used when the photo can't be fetched.
 * `children` render inside the box (e.g. the desktop verified badge).
 */
export default function AvatarBox({ className, image, Icon, iconSize, color, children }) {
  const img = useImageStatus(image);
  const showImage = Boolean(image) && !img.failed;
  return (
    <div className={className} style={showImage ? undefined : { background: color }}>
      {showImage ? (
        <img src={image} alt="" loading="lazy" decoding="async" onLoad={img.onLoad} onError={img.onError} />
      ) : (
        <Icon size={iconSize} color="#fff" strokeWidth={2} />
      )}
      {children}
    </div>
  );
}
