/**
 * Thin wrapper around the browser's own SpeechSynthesis ("Web Speech
 * API") — the same built-in speaker every modern browser already ships
 * with, no external TTS service and no API key. First consumer is the
 * "Find my location" announcement (`features/navigation/announceLocation.js`),
 * so a student who taps the locate button hears where they are instead
 * of having to read the screen.
 *
 * Cancels any in-flight utterance before speaking a new one, so rapidly
 * re-tapping the locate button replaces the old announcement instead of
 * queueing it up behind a growing backlog of speech.
 */
export function unlockSpeech() {
  if (typeof window === 'undefined' || !window.speechSynthesis || typeof window.SpeechSynthesisUtterance !== 'function') return;
  try {
    const primer = new window.SpeechSynthesisUtterance(' ');
    primer.volume = 0;
    window.speechSynthesis.speak(primer);
  } catch {
    // Speech is optional when the browser blocks or lacks the API.
  }
}

export function speak(text) {
  if (!text || typeof window === 'undefined' || !window.speechSynthesis || typeof window.SpeechSynthesisUtterance !== 'function') return;
  try {
    window.speechSynthesis.cancel();
    const utterance = new window.SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    window.speechSynthesis.speak(utterance);
  } catch {
    /* SpeechSynthesis unsupported/blocked (e.g. some in-app webviews) —
       fail silently rather than surface an error for a nice-to-have
       voice feature, same posture as this app's other geolocation
       fallbacks (useOneShotLocation.js, chipConfig.js). */
  }
}
