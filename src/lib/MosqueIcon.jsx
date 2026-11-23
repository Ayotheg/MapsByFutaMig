/**
 * Custom SVG for `bi-mosque` — no confirmed Lucide equivalent (flagged in
 * `legacyIconMap.js`'s `FLAGGED_ICONS` since Slice 2/6). Drawn by hand
 * (dome + two minarets + doorway) to match Lucide's own visual spec: 24×24
 * viewBox, 2px stroke, round caps/joins, `currentColor`, no fill — so it
 * drops into any spot that expects a Lucide-shaped icon component
 * (`<Icon size={18} />`) without looking out of place next to the rest.
 *
 * Resolved in Slice 7 at the person's request ("make a custom SVG").
 */
export default function MosqueIcon({ size = 24, strokeWidth = 2, ...props }) {
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
      <path d="M2 21h20" />
      <path d="M8 21v-8" />
      <path d="M16 21v-8" />
      <path d="M8 13a4 4 0 0 1 8 0" />
      <path d="M12 13V9" />
      <circle cx="12" cy="7.5" r="1" />
      <path d="M10.5 21v-4a1.5 1.5 0 0 1 3 0v4" />
      <path d="M4 21v-11" />
      <path d="M2.5 10 4 7 5.5 10" />
      <path d="M20 21v-11" />
      <path d="M18.5 10 20 7 21.5 10" />
    </svg>
  );
}
