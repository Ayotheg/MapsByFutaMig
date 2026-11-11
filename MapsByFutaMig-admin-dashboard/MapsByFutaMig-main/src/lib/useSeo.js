import { useEffect } from "react";

/**
 * Lightweight per-route <head> updater for client-side navigation.
 *
 * The real, crawlable SEO tags (title, description, OG, JSON-LD) live
 * statically in index.html and are what search engines / LLM crawlers
 * see on first load — this hook only keeps the tab title and robots
 * directive correct once the SPA has booted and the person navigates
 * client-side between routes (e.g. "/" -> "/map"), so the browser tab
 * and any in-app share/print actions stay accurate.
 *
 * @param {Object} opts
 * @param {string} [opts.title] - document title for this route
 * @param {string} [opts.robots] - e.g. "noindex, follow" for app-only
 *   routes like /map that are a live interactive tool, not indexable
 *   content (the canonical, indexable summary of /map lives on "/").
 */
export function useSeo({ title, robots } = {}) {
  useEffect(() => {
    const prevTitle = document.title;
    if (title) document.title = title;

    let metaRobots;
    let prevRobotsContent;
    let createdMetaRobots = false;
    if (robots) {
      metaRobots = document.querySelector('meta[name="robots"]');
      if (metaRobots) {
        prevRobotsContent = metaRobots.getAttribute("content");
      } else {
        metaRobots = document.createElement("meta");
        metaRobots.setAttribute("name", "robots");
        document.head.appendChild(metaRobots);
        createdMetaRobots = true;
      }
      metaRobots.setAttribute("content", robots);
    }

    return () => {
      document.title = prevTitle;
      if (metaRobots) {
        if (createdMetaRobots) {
          metaRobots.remove();
        } else if (prevRobotsContent !== undefined) {
          metaRobots.setAttribute("content", prevRobotsContent);
        }
      }
    };
  }, [title, robots]);
}
