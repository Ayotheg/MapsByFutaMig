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
 *
 * `gate-barrier` (`GateIcon.jsx`, same folder) is the same fallback, but
 * isn't from the legacy `bi-*` inventory — it's the Quick Chips "Gates /
 * Entrance" chip, which had no `iconKey` at all (fell back to the 🚧
 * emoji). Lucide's `Fence`/`DoorOpen` exist but read as residential
 * fencing / a building door, not a campus vehicle barrier, so this is a
 * hand-drawn boom-gate matching what the chip actually represents.
 *
 * Grown well past the original 26-icon `bi-*` inventory: also backs
 * `lib/typeIcons.js` (per-waypoint-type icons for markers/badges/search)
 * and the app-wide emoji-removal pass — status glyphs (`check-circle`,
 * `circle-x`, `triangle-alert`), the star rating, etc. all resolve
 * through this same lookup now, so there's one place icons live rather
 * than a scattered `Icon` import per file that happens to need one.
 */

import {
  ArrowLeft,
  ArrowUp,       // straight/continue
  ArrowUpLeft,   // slight left
  ArrowUpRight,  // slight right
  Ambulance,
  Banknote,       // bursary
  Briefcase,      // admin
  BookOpen,       // library (type-level)
  Landmark,       // bank2
  Building2,      // building-fill
  BusFront,       // bus-front-fill
  Camera,
  CarFront,       // car-front
  CheckCircle2,   // status: success
  Church,
  Circle,         // circle-fill — pass fill="currentColor" to solid it
  CircleX,        // status: error
  Coffee,         // cafe
  Compass,
  CornerUpLeft,   // turn/fork left
  CornerUpRight,  // turn/fork right
  DoorOpen,       // entrance
  Flag,
  FlaskConical,   // laboratory
  Folder,
  Fuel,
  Globe,
  GraduationCap,  // lecture_hall
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
  Pill,           // pharmacy
  Presentation,   // auditorium
  Route,          // KML lines/segments
  Rocket,         // depart
  RotateCw,       // roundabout/rotary
  RotateCcw,      // uturn
  PartyPopper,    // arrival celebration
  Scissors,       // barber
  Shield,         // security_post
  Shirt,          // laundry
  Signpost,       // junction
  Star,
  Theater,        // hall
  TriangleAlert,  // status: warning / hazard
  User,           // person-fill
  Volume2,        // voice on
  VolumeX,        // voice off
  PersonStanding, // person-walking — verify visually against Footprints
                   // as an alternative when you get to Slice 2/9
  Play,           // play-fill
  Printer,        // printer-fill
  Wrench,         // workshop
  Zap,            // utility
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
import GateIcon from './GateIcon';

export const LEGACY_ICON_MAP = {
  'arrow-left': ArrowLeft,
  'arrow-up': ArrowUp,
  'arrow-up-left': ArrowUpLeft,
  'arrow-up-right': ArrowUpRight,
  'ambulance': Ambulance,
  'bank2': Landmark,
  'banknote': Banknote,
  'book-open': BookOpen,
  'briefcase': Briefcase,
  'building-fill': Building2,
  'bus-front-fill': BusFront,
  'camera': Camera,
  'car-front': CarFront,
  'check-circle': CheckCircle2,
  'church': Church,
  'circle-fill': Circle,
  'circle-x': CircleX,
  'coffee': Coffee,
  'compass': Compass,
  'corner-up-left': CornerUpLeft,
  'corner-up-right': CornerUpRight,
  'door-open': DoorOpen,
  'flag': Flag,
  'flask-conical': FlaskConical,
  'folder': Folder,
  'fuel': Fuel,
  'globe': Globe,
  'graduation-cap': GraduationCap,
  'geo-alt-fill': MapPin,
  'geo-fill': Locate,
  'hospital-fill': Hospital,
  'house-door-fill': House,
  'info-circle-fill': Info,
  'layers-fill': Layers,
  'party-popper': PartyPopper,
  'pill': Pill,
  'presentation': Presentation,
  'person-fill': User,
  'person-walking': PersonStanding,
  'play-fill': Play,
  'printer-fill': Printer,
  'reception-4': SignalHigh,
  'restaurant-fill': UtensilsCrossed,
  'rocket': Rocket,
  'rotate-cw': RotateCw,
  'rotate-ccw': RotateCcw,
  'route': Route,
  'scissors': Scissors,
  'scooter': Scooter,
  'search': Search,
  'send-fill': Send,
  'shield': Shield,
  'shirt': Shirt,
  'shop': Store,
  'signpost': Signpost,
  'star': Star,
  'theater': Theater,
  'toilet': Toilet,
  'triangle-alert': TriangleAlert,
  'volume-2': Volume2,
  'volume-x': VolumeX,
  'wrench': Wrench,
  'x-lg': X,
  'zap': Zap,
  'football': FootballIcon,
  'mosque': MosqueIcon,
  'gate-barrier': GateIcon,
};

/**
 * Historical note: this used to list 'football'/'mosque' as unresolved —
 * both now have custom SVGs (see header comment) and are in
 * LEGACY_ICON_MAP above like everything else. Kept as an empty export
 * rather than deleted in case a future slice needs the same
 * flag-before-guessing pattern for a different icon.
 */
export const FLAGGED_ICONS = [];