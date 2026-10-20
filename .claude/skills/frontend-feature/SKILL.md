---
name: frontend-feature
description: Build, import or redesign a screen or UI component (from a Figma link, screenshot, HTML export or description). Use for any frontend UI work in this repo.
---

# Frontend feature

## 1. Before writing code
1. Read `DESIGN_SYSTEM.md`.
2. If there's a design (Figma, screenshot, HTML), list every **font** and **colour** it uses.
3. Map each colour to one of the 17 brand variables in `src/styles/tokens-v2.css`.
4. Map each font: Inter → `var(--font-ui)`, Bricolage Grotesque → `var(--font-display)`, DM Mono → `var(--font-mono)`.
5. **If a font isn't one of those three: stop.** Tell the user the font name and the options:
   - use an existing font variable instead, or
   - install it (approved alternates only: Satoshi, Plus Jakarta Sans, Geist, Manrope; steps in DESIGN_SYSTEM.md > Adding a font).
   Don't build until the user picks.
6. Find a similar existing component in `src/features/` and copy its patterns.

## 2. Build
- Component + `Component.module.css` in `src/features/<area>/` (flat, no subfolders).
- Build desktop and mobile together.
- Not needed on first paint → `React.lazy` + `<Suspense fallback={null}>`.
- Shows on the map → wait while MapPage's `blocked` is true (see `src/features/whatsapp/ChannelPrompt.jsx`).
- Icons from `lucide-react`.

## 3. Check
- `npm run build` passes.
- Tell the user what to look at on desktop and on mobile.
