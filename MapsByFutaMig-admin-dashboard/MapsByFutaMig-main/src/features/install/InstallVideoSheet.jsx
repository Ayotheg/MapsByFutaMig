import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { INSTALL_VIDEO_SRC, closeInstallVideo } from './installVideo';
import styles from './InstallVideoSheet.module.css';

// Vertical "how to install" video over a scrim. Opened by a tap, but play()
// runs after the lazy chunk loads, so iOS may refuse sound — fall back to
// muted playback (the controls can unmute).
export default function InstallVideoSheet() {
  const videoRef = useRef(null);
  const closeRef = useRef(null);

  useEffect(() => {
    const v = videoRef.current;
    v?.play().catch(() => {
      v.muted = true;
      v.play().catch(() => {});
    });

    // Take focus so keys don't reach the card underneath (e.g. AuthModal),
    // and hand it back on close.
    const returnTo = document.activeElement;
    closeRef.current?.focus();

    function onKey(e) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        closeInstallVideo();
        return;
      }
      if (e.key !== 'Tab') return;
      // Keep Tab between the close button and the video.
      const items = [closeRef.current, videoRef.current].filter(Boolean);
      const i = items.indexOf(document.activeElement);
      e.preventDefault();
      e.stopPropagation();
      items[(i + (e.shiftKey ? items.length - 1 : 1)) % items.length]?.focus();
    }
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      returnTo?.focus?.();
    };
  }, []);

  return (
    <div
      className={styles.overlay}
      onClick={(e) => { if (e.target === e.currentTarget) closeInstallVideo(); }}
      role="dialog"
      aria-modal="true"
      aria-label="How to install Maps By FUTA"
    >
      <div className={styles.frame}>
        <button ref={closeRef} type="button" className={styles.close} onClick={closeInstallVideo} aria-label="Close video">
          <X size={18} strokeWidth={2} />
        </button>
        <video
          ref={videoRef}
          className={styles.video}
          src={INSTALL_VIDEO_SRC}
          controls
          playsInline
          // iOS moves the video into a PiP window on fullscreen exit,
          // leaving an empty frame behind.
          disablePictureInPicture
        />
      </div>
    </div>
  );
}
