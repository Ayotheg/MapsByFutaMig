import { lazy, Suspense } from 'react';
import { useInstallVideoOpen } from './installVideo';

const InstallVideoSheet = lazy(() => import('./InstallVideoSheet'));

export default function InstallVideoHost() {
  const open = useInstallVideoOpen();
  if (!open) return null;
  return (
    <Suspense fallback={null}>
      <InstallVideoSheet />
    </Suspense>
  );
}
