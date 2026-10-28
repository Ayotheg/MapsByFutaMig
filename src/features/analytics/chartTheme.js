// SVG presentation attributes (recharts' stroke/fill props) can't read CSS
// variables, so chart colours are resolved from the brand tokens at render.
// Fallbacks are the same brand values (tokens-v2.css), for prerender/tests.
const FALLBACK = {
  '--v2-primary': '#7c3aed',
  '--v2-primary-tint': '#ede9fe',
  '--v2-secondary': '#0d9488',
  '--v2-divider': '#e2e8f0',
  '--v2-text-muted': '#6b6478',
  '--v2-on-primary': '#ffffff',
};

export function token(name) {
  if (typeof document === 'undefined') return FALLBACK[name];
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || FALLBACK[name];
}

export const axisTick = () => ({ fontSize: 11, fill: token('--v2-text-muted') });
