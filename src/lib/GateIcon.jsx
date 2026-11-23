/**
 * Custom SVG for the "Gates / Entrance" quick chip — no Lucide icon
 * actually depicts a campus boom barrier (`Fence` reads as residential
 * fencing, `DoorOpen`/`LogIn` read as a building door, not a vehicle
 * gate), so per the person's fallback instruction this is hand-drawn
 * instead: a raised, striped barrier arm between two posts, matching
 * Lucide's own visual spec (24x24 viewBox, 2px stroke, round caps/joins,
 * `currentColor`, no fill) — same approach already used for
 * `MosqueIcon`/`FootballIcon` in this file's folder.
 *
 * Wired in via `legacyIconMap.js`'s `LEGACY_ICON_MAP['gate-barrier']`,
 * referenced by `placeCategories.js`'s `CATEGORY_ICON_KEYS.gate`.
 */
export default function GateIcon({ size = 24, strokeWidth = 2, ...props }) {
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
      <path d="M3 21h18" />
      <path d="M5 21V6" />
      <path d="M19 21v-4" />
      <path d="M5 8 20 3" />
      <path d="M9.6 5.2 10.4 7.4" />
      <path d="M14.6 3.5 15.4 5.8" />
    </svg>
  );
}
