// Where a notification tap lands: /map?open=<target>.
//   review:<waypointId>  → the review form for that place
//   place:<waypointId>   → that place's card
//   explore | profile | admin
// Plain module (no React) so scripts/deepLink.test.mjs can run it in Node.

export function parseOpenTarget(value) {
  if (!value || typeof value !== 'string') return null;
  const [kind, ...rest] = value.split(':');
  const id = rest.join(':');
  if ((kind === 'review' || kind === 'place') && id) return { kind, id };
  if (kind === 'explore' || kind === 'profile' || kind === 'admin') return { kind };
  return null;
}

/** The target in a URL or search string, or null. */
export function openTargetFromUrl(urlOrSearch, base = 'https://mapsbyfuta.xyz') {
  try {
    const url = new URL(urlOrSearch, base);
    return parseOpenTarget(url.searchParams.get('open'));
  } catch {
    return null;
  }
}

/** The same URL without `open`, for history.replaceState. */
export function withoutOpenParam(href) {
  const url = new URL(href);
  url.searchParams.delete('open');
  return `${url.pathname}${url.search}${url.hash}`;
}
