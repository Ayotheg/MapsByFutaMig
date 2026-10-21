# Android app (Capacitor)

The Android app wraps the map app in a native shell. App ID `xyz.mapsbyfuta.app` (permanent once on Play).

## Web vs app builds

| | Web (mapsbyfuta.xyz) | Android app |
| --- | --- | --- |
| Command | `npm run build` | `npm run build:app` |
| Output | `dist/` (+ `dist-ssr/`) | `dist-app/` |
| `/` | Prerendered landing page | Opens straight on `/map` |
| Service worker | Yes (`public/sw.js`) | No |

The app build is `vite build --mode app`. In code: `import.meta.env.MODE === 'app'` (build time) or
`isNativeApp()` from `src/lib/platform.js` (runtime). The app ships its files inside the APK; it
does not load the live site.

## Setup (once)

- Android Studio, with an SDK and JDK 21 (Android Studio's bundled JDK is fine).
- `.env.local` with the Supabase values (same as the web build); they are baked into the app.

## Build, sync, open

```
npm run cap:sync   # build:app, then copy dist-app/ into android/
npm run cap:open   # open android/ in Android Studio
```

Run `cap:sync` after every web change, before running the app again.

## Run on a phone (USB)

1. On the phone: Settings → About phone → tap **Build number** 7 times. Then Settings → System →
   Developer options → turn on **USB debugging**.
2. Connect by USB and accept the "Allow USB debugging?" prompt on the phone.
3. In Android Studio, wait for Gradle sync to finish, pick the phone in the device dropdown at the
   top, and press **Run** (green ▶).

Debugging the WebView: open `chrome://inspect` in desktop Chrome while the app runs.

## Files

- `capacitor.config.json`: app ID, name, `webDir`, start path, system bar style.
- `android/`: the native project (committed). Build output, `local.properties` and keystores are
  ignored.
- `assets/logo.png`: icon/splash source. Regenerate with
  `npx capacitor-assets generate --android --iconBackgroundColor "#ffffff" --iconBackgroundColorDark "#ffffff" --splashBackgroundColor "#ffffff" --splashBackgroundColorDark "#ffffff"`.
