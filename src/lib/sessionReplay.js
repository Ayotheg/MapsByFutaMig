// Session replay: PostHog, Smartlook and Clarity, all off in `vite dev` so only
// real visits are recorded. PostHog is also off when POSTHOG_PROJECT_TOKEN is unset.
// Clarity re-fetches CSS at playback, which is why CSS files keep fixed names
// (vite.config.js).
//
// inlineStylesheet copies the CSS into each PostHog recording. Without it a
// replay links to the hashed /assets/*.css of the build it was recorded on,
// and every deploy to main deletes that file, so old sessions play unstyled.
// maskAllInputs hides typed text (emails, passwords, promo codes); Smartlook
// masks inputs by default.

const KEY = import.meta.env.POSTHOG_PROJECT_TOKEN
const HOST = import.meta.env.POSTHOG_HOST || 'https://us.i.posthog.com'
// Public: these IDs ship in the page either way.
const SMARTLOOK_KEY = '225c8892c116fe0b8b7c7542c3ce5a7a0bf0b87f'
const CLARITY_ID = 'ylb1798w0x'

export function initSessionReplay() {
  if (!import.meta.env.PROD) return
  initSmartlook()
  initClarity()
  if (!KEY) return
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

function initSmartlook() {
  if (window.smartlook) return
  // Queues calls until recorder.js arrives.
  const smartlook = (window.smartlook = (...args) => smartlook.api.push(args))
  smartlook.api = []
  const script = document.createElement('script')
  script.async = true
  script.src = 'https://web-sdk.smartlook.com/recorder.js'
  document.head.appendChild(script)
  smartlook('init', SMARTLOOK_KEY, { region: 'eu' })
}

function initClarity() {
  if (window.clarity) return
  const clarity = (window.clarity = (...args) => (clarity.q = clarity.q || []).push(args))
  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.clarity.ms/tag/${CLARITY_ID}`
  document.head.appendChild(script)
}
