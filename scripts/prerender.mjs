// Runs after `vite build` (client) and `vite build --ssr` (server
// entry). Loads the built server-render function, renders the landing
// page to an HTML string, and inlines it into dist/index.html's
// #root div — turning the shipped file from an empty SPA shell into a
// real, crawlable static page that then hydrates on the client.
//
// Only "/" gets this treatment (see src/entry-server.jsx for why).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const distDir = path.join(root, "dist");
const ssrEntry = path.join(root, "dist-ssr", "entry-server.js");
const indexPath = path.join(distDir, "index.html");

if (!fs.existsSync(ssrEntry)) {
  console.error(`[prerender] SSR bundle not found at ${ssrEntry}. Did "vite build --ssr src/entry-server.jsx --outDir dist-ssr" run first?`);
  process.exit(1);
}
if (!fs.existsSync(indexPath)) {
  console.error(`[prerender] Client bundle not found at ${indexPath}. Did "vite build" run first?`);
  process.exit(1);
}

const { render } = await import(`file://${ssrEntry}`);
const appHtml = render("/");

const template = fs.readFileSync(indexPath, "utf-8");
if (!template.includes('<div id="root"></div>')) {
  console.error('[prerender] Could not find an empty <div id="root"></div> in dist/index.html — skipping injection so the build isn\'t silently broken.');
  process.exit(1);
}

// Every route except "/" is served this un-prerendered shell instead (see
// vercel.json's rewrites). Serving them index.html meant the landing page's
// static markup showed on /map, /promote/callback etc. until the JS bundle
// arrived — on a slow network a person refreshing the payment callback saw
// the home page and thought they'd been sent back there. The shell shows a
// plain loading line instead; main.jsx clears it on mount.
const shellHtml = template.replace(
  '<div id="root"></div>',
  '<div id="root"><p style="margin:40vh 16px 0;text-align:center;font-family:system-ui,sans-serif;color:#6b7280">Loading…</p></div>'
);
fs.writeFileSync(path.join(distDir, "app.html"), shellHtml, "utf-8");

const finalHtml = template.replace(
  '<div id="root"></div>',
  `<div id="root">${appHtml}</div>`
);

fs.writeFileSync(indexPath, finalHtml, "utf-8");
console.log(`[prerender] Injected prerendered landing-page markup into ${path.relative(root, indexPath)} (${(appHtml.length / 1024).toFixed(1)} KB of HTML).`);
