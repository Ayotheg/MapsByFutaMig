/**
 * Custom SVG for `bi-football` — no confirmed Lucide equivalent (flagged
 * in `legacyIconMap.js`'s `FLAGGED_ICONS` since Slice 2/6). Drawn by hand
 * (classic pentagon-paneled soccer ball) to match Lucide's own visual
 * spec: 24×24 viewBox, 2px stroke, round caps/joins, `currentColor`, no
 * fill — so it drops into any spot expecting a Lucide-shaped icon
 * component (`<Icon size={18} />`) without looking out of place.
 *
 * Resolved in Slice 7 at the person's request ("make a custom SVG").
 */
export default function FootballIcon({ size = 24, strokeWidth = 2, ...props }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8 15.8 10.76 14.35 15.24 9.65 15.24 8.2 10.76Z" />
      <path d="M12 8V4" />
      <path d="M15.8 10.76 19.61 9.53" />
      <path d="M14.35 15.24 16.7 18.47" />
      <path d="M9.65 15.24 7.3 18.47" />
      <path d="M8.2 10.76 4.39 9.53" />
    </svg>
  );
}
