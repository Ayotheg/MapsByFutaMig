import { renderToString } from "react-dom/server";
import { StaticRouter } from "react-router";
import LandingPage from "./pages/LandingPage";

// Build-time only: renders the marketing landing page ("/") to a real
// HTML string so search engines and non-JS-executing crawlers (many
// LLM/answer-engine bots included) get actual page content on the
// very first response, instead of an empty <div id="root"></div> that
// only fills in after the JS bundle boots. See scripts/prerender.mjs,
// which calls this at build time and inlines the result into
// dist/index.html. The interactive map at "/map" is intentionally NOT
// prerendered — it's a live tool, not indexable content (see the
// noindex robots tag set on that route in MapPage.jsx).
export function render(url = "/") {
  return renderToString(
    <StaticRouter location={url}>
      <LandingPage />
    </StaticRouter>
  );
}
