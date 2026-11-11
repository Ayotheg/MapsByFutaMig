import { Capacitor } from '@capacitor/core'

// True inside the Android app (Capacitor WebView), false on the website.
// Runtime check, so it's correct even if the web bundle is ever loaded in
// the app. For "is this the app build?" at build time, use
// import.meta.env.MODE === 'app' instead (see App.jsx).
export function isNativeApp() {
  return Capacitor.isNativePlatform()
}
