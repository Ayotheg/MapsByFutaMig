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

const finalHtml = template.replace(
  '<div id="root"></div>',
  `<div id="root">${appHtml}</div>`
);

fs.writeFileSync(indexPath, finalHtml, "utf-8");
console.log(`[prerender] Injected prerendered landing-page markup into ${path.relative(root, indexPath)} (${(appHtml.length / 1024).toFixed(1)} KB of HTML).`);
