import { CATEGORY_KEYWORDS, nameOrTypeMatches } from '../shared/placeCategories.js';
import { WP_TYPE_LABELS } from '../waypoints/wpTypeMeta.js';
import { haversine } from '../../lib/geoUtils.js';

/**
 * Pure, dependency-free campus search engine (Node-ESM safe: no Leaflet/DOM).
 *
 * Pre-indexes waypoint/segment/OSM/business metadata once per data load,
 * then scores queries across:
 *   - normalized name, area, description, type labels, explore tags, and
 *     Quick-Chip category synonyms
 *   - generated campus acronyms/initialisms (e.g. "AIL" -> Albert Ilemobade Library)
 *   - curated FUTA abbreviations & student-intent aliases (SEET, SOC, SUB,
 *     "eat", "cash", "haircut", "wc", etc.)
 *   - bounded Damerau-Levenshtein typo tolerance (transpositions + edits)
 *   - multi-word all-token coverage boosts + GPS proximity & rating tie-breakers
 */

export const CAMPUS_BBOX = {
  south: 7.2820,
  west: 5.1080,
  north: 7.3120,
  east: 5.1680,
};

export function isInCampusBounds(lat, lng) {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= CAMPUS_BBOX.south &&
    lat <= CAMPUS_BBOX.north &&
    lng >= CAMPUS_BBOX.west &&
    lng <= CAMPUS_BBOX.east
  );
}

export function normalizeText(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function compactText(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

export function stemWord(w) {
  if (!w || w.length < 4) return w;
  if (w.length >= 5 && w.endsWith('ies')) return `${w.slice(0, -3)}y`;
  if (/(ches|shes|xes|zes)$/.test(w)) return w.slice(0, -2);
  if (w.endsWith('s') && !/(ss|us|is)$/.test(w)) return w.slice(0, -1);
  return w;
}

export const STOPWORDS = new Set([
  'the',
  'of',
  'in',
  'at',
  'to',
  'for',
  'and',
  'on',
  'by',
  'a',
  'an',
  'near',
  'around',
  'futa',
]);

const INITIAL_CONNECTORS = new Set(['of', 'and', 'the', 'in', 'at', 'for', 'to', 'on', 'by']);
const GENERIC_FACILITY_WORDS = new Set([
  'building',
  'auditorium',
  'hall',
  'complex',
  'center',
  'centre',
  'hostel',
  'lodge',
  'gate',
  'road',
  'street',
]);

export const FUTA_ALIASES = {
  // FUTA Schools & Faculties
  seet: ['school of engineering', 'engineering'],
  soc: ['school of computing', 'computing'],
  set: ['school of environmental technology', 'environmental technology'],
  saat: ['school of agriculture', 'agriculture'],
  sps: ['school of physical sciences', 'physical sciences'],
  sos: ['school of sciences', 'sciences'],
  sls: ['school of life sciences', 'life sciences'],
  sems: ['school of earth and mineral sciences', 'earth and mineral sciences'],
  smat: ['school of management technology', 'management technology'],
  slit: ['school of logistics and innovation technology', 'logistics', 'management technology'],
  sbms: ['school of basic medical sciences', 'basic medical sciences'],
  shht: ['school of health and health technology', 'health technology'],
  pg: ['postgraduate', 'post graduate'],

  // FUTA Landmarks, Areas & Hostels
  sub: ['students union', 'student union'],
  ail: ['albert ilemobade library', 'main library', 'library'],
  tif: ['ti francis', 't i francis', 'francis auditorium'],
  etf: ['education trust fund'],
  crc: ['central research'],
  ict: ['information and communication technology', 'computer centre', 'computer center'],
  lt: ['lecture theatre', 'lecture theater', 'lecture hall'],
  sg: ['south gate', 'southgate'],
  ng: ['north gate', 'northgate'],
  wg: ['west gate', 'westgate'],
  obk: ['obakekere', 'oba kekere'],
  obakekere: ['oba kekere'],
  obl: ['obanla', 'oba nla'],
  obanla: ['oba nla'],
  jib: ['jibowu'],
  ab: ['abiola'],
  ak: ['akindeko'],
  ad: ['adeniyi'],
  abk: ['abike'],

  // Student Intent & Category Synonyms
  eat: ['food', 'restaurant', 'canteen', 'eatery', 'cafeteria', 'cafe', 'kiosk', 'shawarma'],
  chop: ['food', 'restaurant', 'canteen', 'eatery', 'cafeteria', 'kiosk', 'shawarma'],
  hungry: ['food', 'restaurant', 'canteen', 'eatery', 'cafeteria', 'kiosk', 'shawarma'],
  buka: ['food', 'restaurant', 'canteen', 'eatery'],
  cafeteria: ['food', 'restaurant', 'canteen', 'eatery'],
  cafe: ['food', 'restaurant', 'canteen', 'cafe'],
  food: ['restaurant', 'canteen', 'eatery', 'kiosk', 'shawarma'],
  snacks: ['food', 'kiosk', 'shawarma', 'restaurant'],
  amala: ['food', 'restaurant', 'canteen', 'eatery'],
  rice: ['food', 'restaurant', 'canteen', 'eatery'],
  shawarma: ['food', 'restaurant', 'kiosk'],

  cash: ['bank', 'atm', 'pos'],
  withdraw: ['bank', 'atm', 'pos'],
  money: ['bank', 'atm', 'pos'],
  transfer: ['bank', 'atm', 'pos'],
  pos: ['bank', 'atm'],
  atm: ['bank', 'pos'],
  bank: ['atm', 'pos'],

  haircut: ['barber', 'salon', 'barbing', 'hairdresser'],
  shave: ['barber', 'salon', 'barbing'],
  hair: ['barber', 'salon', 'hairdresser', 'barbing'],
  barber: ['salon', 'barbing', 'hairdresser'],
  salon: ['barber', 'barbing', 'hairdresser'],
  barbing: ['barber', 'salon'],

  wash: ['laundry', 'dry clean', 'dry cleaning', 'car wash'],
  dryclean: ['laundry', 'dry clean', 'dry cleaning'],
  iron: ['laundry', 'dry clean', 'dry cleaning'],
  laundry: ['dry clean', 'dry cleaning'],

  sick: ['clinic', 'hospital', 'health centre', 'health center', 'pharmacy'],
  doctor: ['clinic', 'hospital', 'health centre', 'health center'],
  medicine: ['clinic', 'pharmacy', 'hospital'],
  drugs: ['clinic', 'pharmacy', 'hospital'],
  medical: ['clinic', 'hospital', 'health centre', 'health center'],
  hospital: ['clinic', 'health centre', 'health center'],
  clinic: ['hospital', 'health centre', 'health center'],
  pharmacy: ['clinic', 'hospital'],
  chemist: ['pharmacy', 'clinic'],

  pee: ['toilet', 'restroom'],
  wc: ['toilet', 'restroom'],
  restroom: ['toilet'],
  washroom: ['toilet', 'restroom'],
  convenience: ['toilet', 'restroom'],
  toilet: ['restroom'],

  photocopy: ['printing', 'printing shop', 'printing press', 'print shop', 'business centre'],
  print: ['printing', 'printing shop', 'printing press', 'print shop'],
  printing: ['printing shop', 'printing press', 'print shop'],
  bind: ['printing', 'printing shop', 'printing press'],
  binding: ['printing', 'printing shop', 'printing press'],
  cybercafe: ['printing', 'printing shop', 'ict'],
  typeset: ['printing', 'printing shop', 'printing press'],
  'business centre': ['printing', 'printing shop', 'printing press'],
  'business center': ['printing', 'printing shop', 'printing press'],

  shuttle: ['bus stop', 'bus station', 'shuttle bus', 'garage'],
  bus: ['bus stop', 'bus station', 'bus park', 'shuttle bus'],
  cab: ['garage', 'bus stop', 'bus park'],
  bike: ['garage', 'bus stop'],
  okada: ['garage', 'bus stop'],
  park: ['garage', 'bus park', 'bus stop'],
  garage: ['bus park', 'bus stop'],

  pray: ['chapel', 'church', 'mosque', 'fellowship'],
  worship: ['chapel', 'church', 'mosque', 'fellowship'],
  chapel: ['church', 'fellowship'],
  church: ['chapel', 'fellowship'],
  fellowship: ['chapel', 'church'],
  mosque: ['masjid'],
  masjid: ['mosque'],

  sleep: ['hostel', 'lodge', 'hall of residence'],
  accommodation: ['hostel', 'lodge', 'hall of residence'],
  room: ['hostel', 'lodge'],
  hostel: ['lodge', 'hall of residence'],
  lodge: ['hostel', 'hall of residence'],

  books: ['library', 'bookshop'],
  read: ['library'],
  study: ['library', 'lecture hall', 'lecture theatre'],
  library: ['bookshop'],
  bookshop: ['library'],
  lab: ['laboratory'],
  laboratory: ['lab'],

  football: ['sports', 'pitch', 'stadium', 'sports complex'],
  gym: ['sports', 'gym center', 'gym centre'],
  fitness: ['sports', 'gym'],
  workout: ['sports', 'gym'],
  pitch: ['sports', 'stadium'],
  stadium: ['sports', 'pitch'],
  sports: ['gym', 'pitch', 'stadium'],

  petrol: ['fuel', 'filling station'],
  fuel: ['petrol', 'diesel', 'filling station'],
  diesel: ['fuel', 'filling station'],
  gas: ['gas shop', 'cooking gas', 'gas refill'],

  admin: ['bursary', 'registry', 'senate', 'student affairs'],
  bursary: ['admin', 'senate'],
  registry: ['admin', 'senate'],
  senate: ['admin', 'bursary', 'registry'],
  vc: ['senate', 'admin'],
  registrar: ['senate', 'admin', 'registry'],
  'student affairs': ['dsa', 'admin'],
  dsa: ['student affairs', 'admin'],
};

/**
 * Bounded optimal string alignment (restricted Damerau-Levenshtein).
 * Returns `maxDist + 1` early whenever edit distance exceeds `maxDist`.
 */
export function damerauLevenshtein(a, b, maxDist = 2) {
  if (a === b) return 0;
  const lenA = a.length;
  const lenB = b.length;
  if (Math.abs(lenA - lenB) > maxDist) return maxDist + 1;
  if (lenA === 0) return lenB;
  if (lenB === 0) return lenA;

  let prevPrev = new Array(lenB + 1);
  let prev = new Array(lenB + 1);
  let curr = new Array(lenB + 1);

  for (let j = 0; j <= lenB; j++) prev[j] = j;

  for (let i = 1; i <= lenA; i++) {
    curr[0] = i;
    let rowMin = curr[0];
    const ca = a.charCodeAt(i - 1);

    for (let j = 1; j <= lenB; j++) {
      const cb = b.charCodeAt(j - 1);
      const cost = ca === cb ? 0 : 1;
      let val = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + cost
      );

      if (i > 1 && j > 1 && ca === b.charCodeAt(j - 2) && a.charCodeAt(i - 2) === cb) {
        val = Math.min(val, prevPrev[j - 2] + 1);
      }
      curr[j] = val;
      if (val < rowMin) rowMin = val;
    }

    if (rowMin > maxDist) return maxDist + 1;

    const tmp = prevPrev;
    prevPrev = prev;
    prev = curr;
    curr = tmp;
  }

  return prev[lenB];
}

/**
 * Strict coordinate parser so normal place queries like "Block 2 1000" are
 * never misread as lat/lng coordinates.
 */
export function parseSearchCoord(input) {
  if (typeof input !== 'string') return null;
  let trimmed = input.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('(') && trimmed.endsWith(')')) {
    trimmed = trimmed.slice(1, -1).trim();
  }

  const commaMatch = trimmed.match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
  const spaceDecimalMatch = commaMatch ? null : trimmed.match(/^(-?\d+\.\d+)\s+(-?\d+\.\d+)$/);
  const match = commaMatch || spaceDecimalMatch;
  if (!match) return null;

  const lat = Number(match[1]);
  const lng = Number(match[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;

  const label = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  return {
    id: `coord-${lat.toFixed(6)}-${lng.toFixed(6)}`,
    lat,
    lng,
    name: label,
    desc: 'Coordinates',
    area: '',
    type: 'coord',
    subtype: 'coord',
    source: 'coord',
  };
}

function addWordsAndStems(targetSet, text) {
  const norm = normalizeText(text);
  if (!norm) return;
  for (const w of norm.split(' ')) {
    if (!w) continue;
    targetSet.add(w);
    const stem = stemWord(w);
    if (stem !== w) targetSet.add(stem);
  }
}

function buildInitials(nameNorm) {
  if (!nameNorm) return [];
  const words = nameNorm.split(' ').filter(Boolean);
  if (words.length < 2) return [];

  const set = new Set();
  const allInitials = words.map((w) => w[0]).join('');
  if (allInitials.length >= 2) set.add(allInitials);

  const nonConn = words.filter((w) => !INITIAL_CONNECTORS.has(w)).map((w) => w[0]).join('');
  if (nonConn.length >= 2) set.add(nonConn);

  const trimmedTail = [...words];
  while (trimmedTail.length > 2 && GENERIC_FACILITY_WORDS.has(trimmedTail[trimmedTail.length - 1])) {
    trimmedTail.pop();
  }
  const coreAll = trimmedTail.map((w) => w[0]).join('');
  if (coreAll.length >= 3) set.add(coreAll);
  const coreNonConn = trimmedTail.filter((w) => !INITIAL_CONNECTORS.has(w)).map((w) => w[0]).join('');
  if (coreNonConn.length >= 3) set.add(coreNonConn);

  return [...set];
}

export function prepareEntry(entry) {
  const nameNorm = normalizeText(entry.name);
  const nameCompact = compactText(entry.name);
  const nameWordSet = new Set();
  addWordsAndStems(nameWordSet, entry.name);

  const areaNorm = normalizeText(entry.area);
  const areaCompact = compactText(entry.area);
  const areaWordSet = new Set();
  addWordsAndStems(areaWordSet, entry.area);

  const descNorm = normalizeText(entry.desc || entry.description);
  const descWordSet = new Set();
  addWordsAndStems(descWordSet, entry.desc || entry.description);

  const typeLabel = WP_TYPE_LABELS[entry.type] || WP_TYPE_LABELS[entry.subtype] || '';
  const catWordSet = new Set();
  addWordsAndStems(catWordSet, entry.type);
  addWordsAndStems(catWordSet, entry.subtype);
  addWordsAndStems(catWordSet, typeLabel);

  if (Array.isArray(entry.exploreTags)) {
    for (const tag of entry.exploreTags) addWordsAndStems(catWordSet, tag);
  }
  if (entry.isBusiness || entry.source === 'business') {
    addWordsAndStems(catWordSet, 'online store business shop');
  }

  for (const [key, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (nameOrTypeMatches(entry.name, entry.type || entry.subtype, keywords)) {
      addWordsAndStems(catWordSet, key);
      for (const kw of keywords) addWordsAndStems(catWordSet, kw);
    }
  }

  const lat = entry.lat != null ? Number(entry.lat) : null;
  const lng = entry.lng != null ? Number(entry.lng) : null;
  const hasCoords = Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0);

  const _search = {
    nameNorm,
    nameCompact,
    namePadded: nameNorm ? ` ${nameNorm} ` : '',
    nameWords: [...nameWordSet],
    nameWordSet,
    initials: buildInitials(nameNorm),
    areaNorm,
    areaCompact,
    areaWords: [...areaWordSet],
    areaWordSet,
    descNorm,
    descWords: [...descWordSet],
    descWordSet,
    catWords: [...catWordSet],
    catWordSet,
    inCampus: hasCoords ? isInCampusBounds(lat, lng) : true,
    isBulkOsmImport: entry.sourceType === 'osm_import',
  };

  return { ...entry, _search };
}

function getAliasExpansions(token, fullNorm) {
  const expansions = [];
  const seen = new Set();
  const pushTerms = (terms) => {
    if (!terms) return;
    for (const term of terms) {
      const nt = normalizeText(term);
      if (nt && !seen.has(nt)) {
        seen.add(nt);
        expansions.push(nt);
      }
    }
  };

  if (token) {
    pushTerms(FUTA_ALIASES[token]);
    const stem = stemWord(token);
    if (stem !== token) pushTerms(FUTA_ALIASES[stem]);
    const ltMatch = token.match(/^(\d+)lt$/);
    if (ltMatch) {
      pushTerms([
        `${ltMatch[1]} lecture theatre`,
        `${ltMatch[1]} lecture theater`,
        `${ltMatch[1]} lecture hall`,
      ]);
    }
  }
  if (fullNorm && FUTA_ALIASES[fullNorm]) {
    pushTerms(FUTA_ALIASES[fullNorm]);
  }
  return expansions;
}

export function buildQueryContext(rawQuery) {
  const norm = normalizeText(rawQuery);
  const compact = compactText(rawQuery);
  if (!norm) {
    return { raw: rawQuery || '', norm: '', compact: '', tokens: [], phraseAliases: [] };
  }

  const rawTokens = norm.split(' ').filter(Boolean);
  const nonStop = rawTokens.filter((t) => !STOPWORDS.has(t));
  const tokens = nonStop.length ? nonStop : rawTokens;
  const uniqueTokens = [...new Set(tokens)];

  const phraseAliases = [];
  if (FUTA_ALIASES[norm]) {
    for (const phrase of FUTA_ALIASES[norm]) {
      const np = normalizeText(phrase);
      if (np) phraseAliases.push(np);
    }
  }

  return {
    raw: rawQuery,
    norm,
    compact,
    tokens: uniqueTokens,
    tokenStems: uniqueTokens.map(stemWord),
    tokenAliases: uniqueTokens.map((t) => getAliasExpansions(t, null)),
    phraseAliases,
  };
}

function bestWordPrefixMatch(words, tok) {
  for (const w of words) {
    if (w.startsWith(tok)) return true;
  }
  return false;
}

function matchAliasExpansion(s, expansion) {
  if (s.namePadded.includes(` ${expansion} `)) return 28;
  const expWords = expansion.split(' ').filter(Boolean);
  if (expWords.length > 1 && expWords.every((ew) => s.nameWordSet.has(ew) || s.nameWordSet.has(stemWord(ew)))) {
    return 28;
  }
  if (expWords.every((ew) => s.areaWordSet.has(ew) || s.areaWordSet.has(stemWord(ew)))) {
    return 24;
  }
  if (expWords.every((ew) => s.catWordSet.has(ew) || s.catWordSet.has(stemWord(ew)))) {
    return 20;
  }
  if (expWords.every((ew) => s.descWordSet.has(ew) || s.descWordSet.has(stemWord(ew)))) {
    return 12;
  }
  return 0;
}

function fuzzyMatchWordList(words, tok, maxDist) {
  let bestDist = maxDist + 1;
  for (const w of words) {
    if (w.length < 3) continue;
    const d = damerauLevenshtein(tok, w, maxDist);
    if (d < bestDist) {
      bestDist = d;
      if (bestDist === 1) break;
    }
  }
  return bestDist <= maxDist ? bestDist : 0;
}

function sourceBoostFor(entry, s) {
  if (entry.source === 'business' || entry.isBusiness) return 10;
  if (entry.source === 'waypoint') return s.isBulkOsmImport || !s.inCampus ? 2 : 12;
  if (entry.source === 'osm_annotation') return 8;
  if (entry.source === 'segment') return 6;
  if (entry.source === 'osm') return 3;
  return 0;
}

export function scoreEntry(entry, queryCtx, options = {}) {
  if (!queryCtx || !queryCtx.norm) return { score: 0, dist: null };
  const s = entry._search || prepareEntry(entry)._search;
  const { norm, compact, tokens, tokenStems, tokenAliases, phraseAliases } = queryCtx;

  let phraseScore = 0;
  if (s.nameNorm === norm || (compact.length >= 2 && s.nameCompact === compact)) {
    phraseScore += 180;
  } else if (s.nameNorm.startsWith(norm) || (compact.length >= 3 && s.nameCompact.startsWith(compact))) {
    phraseScore += 110;
  }

  if (compact.length >= 2 && s.initials.includes(compact)) {
    phraseScore += 105;
  }

  if (s.nameNorm !== norm) {
    if (s.namePadded.includes(` ${norm} `)) phraseScore += 80;
    else if (s.nameNorm.includes(norm) || (compact.length >= 4 && s.nameCompact.includes(compact))) {
      phraseScore += 55;
    }
  }

  if (s.areaNorm && (s.areaNorm === norm || s.areaNorm.includes(norm))) {
    phraseScore += 30;
  }

  for (const pa of phraseAliases) {
    const bonus = matchAliasExpansion(s, pa);
    if (bonus > 0) phraseScore = Math.max(phraseScore, bonus + 25);
  }

  let tokenScoreSum = 0;
  let matchedCount = 0;

  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    const stem = tokenStems[i];
    const aliases = tokenAliases[i];
    let bestTok = 0;

    if (s.nameWordSet.has(tok) || s.nameWordSet.has(stem)) {
      bestTok = Math.max(bestTok, 45);
    } else if (bestWordPrefixMatch(s.nameWords, tok)) {
      bestTok = Math.max(bestTok, 34);
    }
    if (tok.length >= 2 && s.initials.includes(tok)) {
      bestTok = Math.max(bestTok, 38);
    }
    if (tok.length >= 3 && (s.nameNorm.includes(tok) || (tok.length >= 4 && s.nameCompact.includes(tok)))) {
      bestTok = Math.max(bestTok, 22);
    }

    if (s.areaWordSet.has(tok) || s.areaWordSet.has(stem)) {
      bestTok = Math.max(bestTok, 30);
    } else if (tok.length >= 2 && bestWordPrefixMatch(s.areaWords, tok)) {
      bestTok = Math.max(bestTok, 22);
    }

    if (s.catWordSet.has(tok) || s.catWordSet.has(stem)) {
      bestTok = Math.max(bestTok, 26);
    } else if (tok.length >= 3 && bestWordPrefixMatch(s.catWords, tok)) {
      bestTok = Math.max(bestTok, 18);
    }

    if (s.descWordSet.has(tok) || s.descWordSet.has(stem)) {
      bestTok = Math.max(bestTok, 16);
    } else if (tok.length >= 3 && bestWordPrefixMatch(s.descWords, tok)) {
      bestTok = Math.max(bestTok, 11);
    }

    for (const exp of aliases) {
      bestTok = Math.max(bestTok, matchAliasExpansion(s, exp));
    }

    if (bestTok === 0 && tok.length >= 4) {
      const maxDist = tok.length >= 7 ? 2 : 1;
      const nameDist = fuzzyMatchWordList(s.nameWords, tok, maxDist);
      if (nameDist === 1) bestTok = 28;
      else if (nameDist === 2) bestTok = 16;

      if (bestTok === 0 && tok.length >= 5 && s.nameCompact) {
        const compDist = damerauLevenshtein(tok, s.nameCompact, maxDist);
        if (compDist <= maxDist) {
          if (compDist === 1) bestTok = 28;
          else if (compDist === 2) bestTok = 16;
        }
      }

      if (bestTok === 0) {
        const areaDist = fuzzyMatchWordList(s.areaWords, tok, 1);
        if (areaDist === 1) bestTok = 18;
      }

      if (bestTok === 0) {
        const catDist = fuzzyMatchWordList(s.catWords, tok, 1);
        if (catDist === 1) bestTok = 15;
      }
    }

    if (bestTok > 0) {
      matchedCount++;
      tokenScoreSum += bestTok;
    }
  }

  let textScore = phraseScore + tokenScoreSum;
  // Critical gate: never let source, proximity, or rating boosts surface an
  // unrelated entry with zero text relevance.
  if (textScore === 0) return { score: 0, dist: null };

  if (tokens.length >= 2) {
    if (matchedCount === tokens.length) {
      textScore = textScore * 1.35 + 40;
    } else if (matchedCount < tokens.length / 2 && phraseScore === 0) {
      textScore *= 0.4;
      if (textScore < 12) return { score: 0, dist: null };
    }
  }

  let finalScore = textScore + sourceBoostFor(entry, s);

  let dist = null;
  const user = options.user;
  const lat = entry.lat != null ? Number(entry.lat) : null;
  const lng = entry.lng != null ? Number(entry.lng) : null;
  if (
    user &&
    Number.isFinite(user.lat) &&
    Number.isFinite(user.lng) &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    (lat !== 0 || lng !== 0)
  ) {
    dist = haversine(user.lat, user.lng, lat, lng);
    finalScore += Math.max(0, 12 * (1 - Math.min(dist, 3000) / 3000));
  }

  if (entry.reviewCount > 0 && entry.avgRating > 0) {
    finalScore += Math.min(5, (Number(entry.avgRating) / 5) * 3 + Math.min(Number(entry.reviewCount), 10) * 0.2);
  }

  return { score: Math.round(finalScore * 100) / 100, dist };
}

function stripInternal(entry, score, dist) {
  const { _search: _, ...publicFields } = entry;
  return { ...publicFields, _score: score, _dist: dist };
}

export function searchEntries(entries, rawQuery, { limit = 8, user = null } = {}) {
  const coordResult = parseSearchCoord(rawQuery);
  const queryCtx = buildQueryContext(rawQuery);

  const scored = [];
  if (queryCtx.norm) {
    for (const entry of entries || []) {
      const { score, dist } = scoreEntry(entry, queryCtx, { user });
      if (score > 0) scored.push(stripInternal(entry, score, dist));
    }
    scored.sort((a, b) => {
      if (b._score !== a._score) return b._score - a._score;
      if (a._dist != null && b._dist != null && a._dist !== b._dist) return a._dist - b._dist;
      return (a.name || '').localeCompare(b.name || '');
    });
  }

  if (coordResult) {
    let coordDist = null;
    if (user && Number.isFinite(user.lat) && Number.isFinite(user.lng)) {
      coordDist = haversine(user.lat, user.lng, coordResult.lat, coordResult.lng);
    }
    const coordHit = { ...coordResult, _score: 999, _dist: coordDist };
    return [coordHit, ...scored].slice(0, limit);
  }

  return scored.slice(0, limit);
}

const CHIP_GENERIC_TAILS = new Set([
  'shop',
  'shops',
  'center',
  'centre',
  'station',
  'press',
  'complex',
  'hall',
  'of',
  'residence',
  'building',
]);

function chipSearchProfile(chip) {
  const labelNorm = normalizeText(chip.label);
  const shortNorm = normalizeText(chip.shortLabel);
  const idNorm = normalizeText(chip.id);
  const rawKeywords = (chip.keywords || []).map(normalizeText).filter(Boolean);
  const phrases = [labelNorm, shortNorm, idNorm, ...rawKeywords].filter(Boolean);

  const primaryWords = new Set();
  addWordsAndStems(primaryWords, labelNorm);
  addWordsAndStems(primaryWords, shortNorm);
  for (const kw of rawKeywords) {
    if (!kw.includes(' ')) addWordsAndStems(primaryWords, kw);
  }

  const allWords = new Set(primaryWords);
  for (const p of rawKeywords) {
    if (p.includes(' ')) addWordsAndStems(allWords, p);
  }

  return { labelNorm, shortNorm, phrases, primaryWords, allWords };
}

function tokenMatchesChip(tok, stem, aliases, profile, singleToken) {
  if (profile.primaryWords.has(tok) || profile.primaryWords.has(stem)) return 4;
  if (!singleToken || !CHIP_GENERIC_TAILS.has(tok)) {
    if (profile.allWords.has(tok) || profile.allWords.has(stem)) return 3;
  }
  for (const w of profile.primaryWords) {
    if (tok.length >= 3 && w.startsWith(tok)) return 2;
  }
  for (const w of profile.allWords) {
    if (tok.length >= 4 && w.startsWith(tok)) return 2;
  }
  for (const exp of aliases) {
    const expWords = exp.split(' ').filter(Boolean);
    if (expWords.some((ew) => profile.primaryWords.has(ew) || profile.primaryWords.has(stemWord(ew)))) {
      return 2;
    }
  }
  if (tok.length >= 4) {
    for (const w of profile.primaryWords) {
      if (w.length >= 3 && damerauLevenshtein(tok, w, 1) <= 1) return 1;
    }
  }
  return 0;
}

/**
 * Returns the single best matching Quick Chip if the query is a category-level
 * search (e.g. "hostel", "hostle", "atm", "eat", "printing press"), or null
 * for specific named places like "First Bank South Gate".
 */
export function matchCategoryChip(rawQuery, chips) {
  if (!chips || !chips.length || !rawQuery) return null;
  const norm = normalizeText(rawQuery);
  if (norm.length < 2) return null;

  const rawTokens = norm.split(' ').filter(Boolean);
  const nonStop = rawTokens.filter((t) => !STOPWORDS.has(t));
  if (!nonStop.length || nonStop.length > 3) return null;
  const tokens = nonStop;

  let bestChip = null;
  let bestScore = 0;

  for (const chip of chips) {
    const profile = chipSearchProfile(chip);
    let score = 0;

    if (profile.labelNorm === norm || profile.shortNorm === norm) {
      score = 100;
    } else if (profile.phrases.some((p) => p === norm || stemWord(p) === stemWord(norm))) {
      score = 90;
    } else {
      let total = 0;
      let allMatched = true;
      for (const tok of tokens) {
        const stem = stemWord(tok);
        const aliases = getAliasExpansions(tok, null);
        const m = tokenMatchesChip(tok, stem, aliases, profile, tokens.length === 1);
        if (m === 0) {
          allMatched = false;
          break;
        }
        total += m;
      }
      if (allMatched) {
        score = total * 20 + (profile.phrases.some((p) => p.startsWith(norm)) ? 10 : 0);
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestChip = chip;
    }
  }

  return bestChip;
}

export function shouldQueryNominatim(localResults, rawQuery) {
  if (!rawQuery || rawQuery.trim().length < 3) return false;
  if (parseSearchCoord(rawQuery)) return false;
  if (!localResults || localResults.length === 0) return true;
  if (localResults[0]._score >= 165) return false;
  if (localResults.length >= 4 && localResults[0]._score >= 95) return false;
  return true;
}
