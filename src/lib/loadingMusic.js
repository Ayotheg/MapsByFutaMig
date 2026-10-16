// ── Loading-screen music ────────────────────────────────────────────────
//
// One shared <audio> for the FUTA anthem that plays while the loading
// screen (pages/LoadingScreen.jsx) is up. Nothing is stored anywhere — no
// localStorage, no "already heard it" flag; it starts from the top every
// time the loading screen appears.
//
// Why a shared module instead of an Audio owned by the loading screen:
// browsers only allow sound inside (or shortly after) a tap. Desktop and
// Android remember a tap for the rest of the visit, but iPhones only honour
// it for a few seconds — often gone by the time the /map route has mounted
// the loading screen. So `installLoadingMusicPrimer()` starts the song
// *inside* the tap on any link to /map (e.g. the landing page buttons), and
// the loading screen then just carries on with the same element.
//
// If the loading screen never claims a primed song (the link click was
// cancelled, say), it's stopped again after PRIME_TIMEOUT_MS.
//
// The loading screen's mute button sets `muted`, which lasts for the rest
// of the visit (in memory only — a fresh page load plays again). While
// muted, startLoadingMusic() does nothing, so the link primer and the
// tap-to-unlock listeners can't bring the song back.

const SRC = "/futa-new-anthem.mp3";
const VOLUME = 0.6;
const FADE_IN_MS = 800;
const FADE_OUT_MS = 700;
const PRIME_TIMEOUT_MS = 4000;

let audio = null;
let pending = null; // in-flight play() promise
let wanted = false; // false once stopped, so a late play() result is undone
let cancelFade = null;
let primeTimer = null;
let muted = false;

function getAudio() {
  if (!audio) {
    audio = new Audio(SRC);
    audio.loop = true;
    audio.preload = "auto";
  }
  return audio;
}

function fadeTo(to, ms, done) {
  cancelFade?.();
  const a = audio;
  const from = a.volume;
  const startAt = performance.now();
  let frame = requestAnimationFrame(function tick(now) {
    const t = Math.min(1, (now - startAt) / ms);
    // iOS ignores volume (always full) — harmless there.
    a.volume = Math.max(0, Math.min(1, from + (to - from) * t));
    if (t < 1) {
      frame = requestAnimationFrame(tick);
    } else {
      cancelFade = null;
      done?.();
    }
  });
  cancelFade = () => cancelAnimationFrame(frame);
}

export function isLoadingMusicPlaying() {
  return !!audio && !audio.paused;
}

/**
 * Starts the song from the top (or keeps it going if it's already
 * playing). Calls audio.play() synchronously, so calling this from a tap
 * handler counts as that tap. Resolves true once sound is playing, false if
 * the browser refused (no tap yet).
 */
export function startLoadingMusic() {
  if (muted || typeof Audio === "undefined") return Promise.resolve(false);
  const a = getAudio();
  wanted = true;

  if (!a.paused) {
    // Already playing (primed by the link tap, or a fade-out in progress) —
    // bring the volume back up rather than restarting.
    fadeTo(VOLUME, FADE_IN_MS);
    return Promise.resolve(true);
  }
  if (pending) return pending;

  cancelFade?.();
  a.currentTime = 0;
  a.volume = 0;
  pending = a
    .play()
    .then(() => {
      if (!wanted) {
        // Stopped while play() was still loading.
        a.pause();
        return false;
      }
      fadeTo(VOLUME, FADE_IN_MS);
      return true;
    })
    .catch(() => false)
    .finally(() => {
      pending = null;
    });
  return pending;
}

/** Fades the song out and pauses it. */
export function stopLoadingMusic() {
  clearTimeout(primeTimer);
  wanted = false;
  if (!audio) return;
  if (audio.paused) {
    cancelFade?.();
    return;
  }
  fadeTo(0, FADE_OUT_MS, () => audio.pause());
}

export function isLoadingMusicMuted() {
  return muted;
}

/** Mutes (fades out) or unmutes the song for the rest of the visit. */
export function setLoadingMusicMuted(value) {
  muted = value;
  if (muted) stopLoadingMusic();
}

/** Called by the loading screen on mount: it now owns the song. */
export function claimLoadingMusic() {
  clearTimeout(primeTimer);
}

/**
 * Starts the song inside the tap on any same-site link to /map. Installed
 * once from main.jsx. Capture phase so it runs before React Router handles
 * the click.
 */
export function installLoadingMusicPrimer() {
  if (typeof document === "undefined") return;
  document.addEventListener(
    "click",
    (e) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const link = e.target.closest?.("a[href]");
      if (!link || link.target === "_blank") return;
      let url;
      try {
        url = new URL(link.href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin || url.pathname !== "/map") return;
      if (window.location.pathname === "/map") return; // already there, no loading screen coming
      startLoadingMusic();
      clearTimeout(primeTimer);
      primeTimer = setTimeout(stopLoadingMusic, PRIME_TIMEOUT_MS);
    },
    true,
  );
}
