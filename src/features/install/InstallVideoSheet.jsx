import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { INSTALL_VIDEO_SRC, closeInstallVideo } from './installVideo';
import styles from './InstallVideoSheet.module.css';

// Vertical "how to install" video over a scrim. Always opened by a tap, so
// playing with sound right away is allowed.
export default function InstallVideoSheet() {
  const videoRef = useRef(null);

  useEffect(() => {
    videoRef.current?.play().catch(() => {});
    function onKey(e) {
      if (e.key === 'Escape') closeInstallVideo();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
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
        <button type="button" className={styles.close} onClick={closeInstallVideo} aria-label="Close video">
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
