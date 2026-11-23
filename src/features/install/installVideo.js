import { useSyncExternalStore } from 'react';
import { track } from '../../lib/analytics';

// Filename is uppercase on disk; Vercel paths are case-sensitive.
export const INSTALL_VIDEO_SRC = '/tutorial.MP4';

// Opened from the profile card and the arrived banner, which live in
// unrelated trees — a tiny store saves threading props through
// NavigationController and AuthModal.
let open = false;
const listeners = new Set();

function emit() {
  listeners.forEach((fn) => fn());
}

export function openInstallVideo(source) {
  open = true;
  emit();
  // After opening: analytics can throw on old iOS and must never block it.
  try {
    track('install_video_open', { source });
  } catch {
    /* analytics unavailable */
  }
}

export function closeInstallVideo() {
  open = false;
  emit();
}

function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function useInstallVideoOpen() {
  return useSyncExternalStore(subscribe, () => open, () => false);
}

// Already on the home screen (or the native app build): nothing to install.
export function isInstalled() {
  if (typeof window === 'undefined') return false;
  if (import.meta.env.MODE === 'app') return true;
  return window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
}
