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
 * Two entries are NOT resolved yet — see FLAGGED_ICONS below. Don't
 * guess a substitute when you hit them in a slice; drop in a custom
 * SVG (24x24 viewBox, 2px stroke, round caps/joins, no fill — matches
 * Lucide's spec) or ask before picking a stand-in.
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
  X,              // x-lg
} from 'lucide-react';

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
  'x-lg': X,
  // 'football': FLAGGED — see below
  // 'mosque':   FLAGGED — see below
};

/**
 * No confirmed direct Lucide equivalent for these two — don't pick a
 * stand-in silently when a slice needs them. Either commission/draw a
 * custom SVG (24x24, 2px stroke, round caps, no fill, matching
 * Lucide's visual spec) or flag it to the person before deciding:
 *
 * - 'football'  (bi-football — soccer ball, used for sports facility
 *   category marker)
 * - 'mosque'    (bi-mosque — used for the mosque place-type marker,
 *   alongside 'church' for the church marker)
 */
export const FLAGGED_ICONS = ['football', 'mosque'];