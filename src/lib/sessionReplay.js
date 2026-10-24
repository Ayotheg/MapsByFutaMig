// PostHog session replay. Off when VITE_POSTHOG_KEY is unset and in
// `vite dev`, so only real visits are recorded.
//
// inlineStylesheet copies the CSS into each recording. Without it a replay
// links to the hashed /assets/*.css of the build it was recorded on, and
// every deploy to main deletes that file, so old sessions play unstyled.
// maskAllInputs hides typed text (emails, passwords, promo codes).

const KEY = import.meta.env.VITE_POSTHOG_KEY
const HOST = import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com'

export function initSessionReplay() {
  if (!KEY || !import.meta.env.PROD) return
  // Own chunk, loaded after `load`, so it never delays the first paint.
  import('posthog-js')
    .then(({ default: posthog }) => {
      posthog.init(KEY, {
        api_host: HOST,
        person_profiles: 'identified_only',
        capture_pageview: 'history_change',
        session_recording: {
          maskAllInputs: true,
          inlineStylesheet: true,
        },
      })
    })
    .catch(() => {})
}
