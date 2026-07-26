/**
 * legacyIconMap.js
 *
 * Every `bi-*` class used across the legacy app (app.js + index.html,
 * feature/login2), mapped to its lucide-react equivalent. This is the
 * full inventory — 26 icons, confirmed by grepping the legacy source,
 * not guessed.
 *
 * Usage in a later slice:
 *   import { Church } from 'lucide-react';
 *   <Church size={18} strokeWidth={2} />
 *
 * Or via the lookup below when the icon name is data-driven (e.g. a
 * place-type -> icon mapping loaded from Supabase):
 *   import { LEGACY_ICON_MAP } from '../../lib/legacyIconMap';
 *   const Icon = LEGACY_ICON_MAP['church'];
 *   <Icon size={18} />
 *
 * `football` and `mosque` had no confirmed direct Lucide equivalent —
 * resolved in Slice 7 (at the person's request) with hand-drawn custom
 * SVGs (`MosqueIcon.jsx`/`FootballIcon.jsx`, same folder) matching
 * Lucide's own spec (24x24 viewBox, 2px stroke, round caps/joins, no
 * fill), so they drop into `LEGACY_ICON_MAP` exactly like the rest.
 */

import {
  ArrowLeft,
  Landmark,       // bank2
  Building2,      // building-fill
  BusFront,       // bus-front-fill
  Camera,
  CarFront,       // car-front
  Church,
  Circle,         // circle-fill — pass fill="currentColor" to solid it
  MapPin,         // geo-alt-fill
  Locate,         // geo-fill — verify against legacy usage before shipping,
                   // bootstrap distinguishes geo-alt-fill (teardrop pin)
                   // from geo-fill (dot/crosshair marker); Locate is the
                   // closer match to the latter but check the actual
                   // rendered context in Slice 2/6/9 before locking it in
  Hospital,       // hospital-fill
  House,          // house-door-fill
  Info,           // info-circle-fill — Lucide's Info glyph is already
                   // circled, no separate "-fill" needed
  Layers,         // layers-fill
  User,           // person-fill
  PersonStanding, // person-walking — verify visually against Footprints
                   // as an alternative when you get to Slice 2/9
  Play,           // play-fill
  Printer,        // printer-fill
  SignalHigh,     // reception-4
  UtensilsCrossed,// restaurant-fill
  Scooter,
  Search,
  Send,           // send-fill
  Store,          // shop
  Toilet,         // toilet — person-requested addition, not from legacy (no bi-* toilet class existed)
  X,              // x-lg
} from 'lucide-react';
import MosqueIcon from './MosqueIcon';
import FootballIcon from './FootballIcon';

export const LEGACY_ICON_MAP = {
  'arrow-left': ArrowLeft,
  'bank2': Landmark,
  'building-fill': Building2,
  'bus-front-fill': BusFront,
  'camera': Camera,
  'car-front': CarFront,
  'church': Church,
  'circle-fill': Circle,
  'geo-alt-fill': MapPin,
  'geo-fill': Locate,
  'hospital-fill': Hospital,
  'house-door-fill': House,
  'info-circle-fill': Info,
  'layers-fill': Layers,
  'person-fill': User,
  'person-walking': PersonStanding,
  'play-fill': Play,
  'printer-fill': Printer,
  'reception-4': SignalHigh,
  'restaurant-fill': UtensilsCrossed,
  'scooter': Scooter,
  'search': Search,
  'send-fill': Send,
  'shop': Store,
  'toilet': Toilet,
  'x-lg': X,
  'football': FootballIcon,
  'mosque': MosqueIcon,
};

/**
 * Historical note: this used to list 'football'/'mosque' as unresolved —
 * both now have custom SVGs (see header comment) and are in
 * LEGACY_ICON_MAP above like everything else. Kept as an empty export
 * rather than deleted in case a future slice needs the same
 * flag-before-guessing pattern for a different icon.
 */
export const FLAGGED_ICONS = [];