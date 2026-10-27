import { lazy, Suspense, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { closeInstallVideo, useInstallVideoOpen } from './installVideo';

const InstallVideoSheet = lazy(() => import('./InstallVideoSheet'));

export default function InstallVideoHost() {
  const open = useInstallVideoOpen();
  const onMap = useLocation().pathname === '/map';

  // The open flag is module-level: close it when the map is hidden behind
  // /promote or /event (else the video plays on unseen) and on unmount
  // (else it reopens on the next /map visit).
  useEffect(() => {
    if (!onMap) closeInstallVideo();
  }, [onMap]);
  useEffect(() => closeInstallVideo, []);

  if (!open || !onMap) return null;
  return (
    <Suspense fallback={null}>
      <InstallVideoSheet />
    </Suspense>
  );
}
