// Run: node scripts/searchEngine.test.mjs (Node 18+).
import assert from 'node:assert/strict';
import {
  damerauLevenshtein,
  matchCategoryChip,
  parseSearchCoord,
  prepareEntry,
  searchEntries,
  shouldQueryNominatim,
} from '../src/features/search/searchEngine.js';
import {
  CATEGORY_KEYWORDS,
  CATEGORY_LABELS,
  CATEGORY_SHORT_LABELS,
  CHIP_DISPLAY_ORDER,
} from '../src/features/shared/placeCategories.js';

const SAMPLE_ENTRIES = [
  {
    id: 'wp-senate',
    name: 'Senate Building',
    desc: 'Main university administration office',
    area: 'Obanla',
    lat: 7.3015,
    lng: 5.1375,
    type: 'admin',
    subtype: 'admin',
    source: 'waypoint',
    avgRating: 4.7,
    reviewCount: 12,
  },
  {
    id: 'wp-lib',
    name: 'Albert Ilemobade Library',
    desc: 'Main campus library and study complex',
    area: 'Obanla',
    lat: 7.3005,
    lng: 5.1385,
    type: 'library',
    subtype: 'library',
    source: 'waypoint',
    avgRating: 4.8,
    reviewCount: 20,
  },
  {
    id: 'wp-seet',
    name: 'School of Engineering and Engineering Technology',
    desc: 'Engineering classrooms and labs',
    area: 'Obanla',
    lat: 7.2995,
    lng: 5.1395,
    type: 'faculty',
    subtype: 'faculty',
    source: 'waypoint',
  },
  {
    id: 'wp-soc',
    name: 'School of Computing',
    desc: 'Computer science and software engineering',
    area: 'Obanla',
    lat: 7.2988,
    lng: 5.1402,
    type: 'faculty',
    subtype: 'faculty',
    source: 'waypoint',
  },
  {
    id: 'wp-sub',
    name: 'Students Union Building',
    desc: 'Student activities and hall',
    area: 'Obanla',
    lat: 7.2975,
    lng: 5.1368,
    type: 'hall',
    subtype: 'hall',
    source: 'waypoint',
  },
  {
    id: 'wp-tif',
    name: 'T.I. Francis Auditorium',
    desc: 'Large lecture theatre and events hall',
    area: 'Obanla',
    lat: 7.2981,
    lng: 5.1381,
    type: 'lecture_hall',
    subtype: 'lecture_hall',
    source: 'waypoint',
  },
  {
    id: 'wp-250lt',
    name: '250 Lecture Theatre',
    desc: 'Main lecture hall',
    area: 'Obanla',
    lat: 7.299,
    lng: 5.1372,
    type: 'lecture_hall',
    subtype: 'lecture_hall',
    source: 'waypoint',
  },
  {
    id: 'wp-obk',
    name: 'Oba Kekere',
    desc: 'Academic campus zone',
    area: 'Obakekere',
    lat: 7.2925,
    lng: 5.1412,
    type: 'landmark',
    subtype: 'landmark',
    source: 'waypoint',
  },
  {
    id: 'wp-pos-sg',
    name: 'Chidi POS',
    desc: 'Quick cash withdrawal',
    area: 'South Gate',
    lat: 7.289,
    lng: 5.148,
    type: 'bank',
    subtype: 'bank',
    source: 'waypoint',
  },
  {
    id: 'wp-pos-ng',
    name: 'Chidi POS',
    desc: 'Cash point',
    area: 'North Gate',
    lat: 7.309,
    lng: 5.125,
    type: 'bank',
    subtype: 'bank',
    source: 'waypoint',
  },
  {
    id: 'wp-gate-sg',
    name: 'South-Gate',
    desc: 'Campus entrance',
    area: 'South Gate',
    lat: 7.2885,
    lng: 5.149,
    type: 'gate',
    subtype: 'gate',
    source: 'waypoint',
  },
  {
    id: 'wp-buka',
    name: 'Mama Put',
    desc: 'Rice and swallows',
    area: 'South Gate',
    lat: 7.2895,
    lng: 5.1475,
    type: 'food',
    subtype: 'food',
    exploreTags: ['buka', 'canteen'],
    source: 'waypoint',
  },
  {
    id: 'wp-hostel',
    name: 'Paradise Lodge',
    desc: 'Student accommodation',
    area: 'South Gate',
    lat: 7.2878,
    lng: 5.1485,
    type: 'hostel',
    subtype: 'hostel',
    source: 'waypoint',
  },
  {
    id: 'wp-shawarma',
    name: 'Ace Shawarma Spot',
    desc: 'Grills and snacks',
    area: 'North Gate',
    lat: 7.3085,
    lng: 5.126,
    type: 'food',
    subtype: 'food',
    source: 'waypoint',
  },
  {
    id: 'wp-barber',
    name: 'Fresh Cuts',
    desc: 'Grooming studio',
    area: 'South Gate',
    lat: 7.2892,
    lng: 5.1482,
    type: 'shop',
    subtype: 'barber',
    exploreTags: ['barber', 'salon'],
    source: 'waypoint',
  },
  {
    id: 'wp-pos-atm-title',
    name: 'POS/ATM Stand',
    desc: '24/7 cash terminal',
    area: 'Obanla',
    lat: 7.298,
    lng: 5.137,
    type: 'bank',
    subtype: 'bank',
    source: 'waypoint',
  },
  {
    id: 'biz-debby',
    name: "Debby's Fragrances",
    desc: 'Perfumes and body sprays',
    area: '',
    lat: null,
    lng: null,
    type: 'shop',
    subtype: 'shop',
    source: 'business',
    isBusiness: true,
  },
  {
    id: 'wp-in-campus-clinic',
    name: 'Unity Clinic',
    desc: 'Campus medical post',
    area: 'Obanla',
    lat: 7.299,
    lng: 5.138,
    type: 'clinic',
    subtype: 'clinic',
    source: 'waypoint',
  },
  {
    id: 'wp-off-campus-clinic',
    name: 'Unity Clinic',
    desc: 'Regional clinic',
    area: 'Lagos',
    lat: 6.5244,
    lng: 3.3792,
    type: 'clinic',
    subtype: 'clinic',
    sourceType: 'osm_import',
    source: 'waypoint',
  },
].map(prepareEntry);

const SAMPLE_CHIPS = [
  { id: 'hostel', label: 'Hostels & lodges', shortLabel: 'Hostels', keywords: ['hostel', 'lodges', 'lodge', 'hall of residence'] },
  { id: 'restaurant', label: 'Canteens', shortLabel: 'Food', keywords: ['restaurant', 'eatery', 'canteen'] },
  { id: 'bank', label: 'POS / ATM', shortLabel: null, keywords: ['bank', 'pos', 'atm', 'cooperative'] },
  { id: 'printing_shop', label: 'Printing', shortLabel: null, keywords: ['printing', 'printing press', 'printing shop', 'print shop'] },
  { id: 'library', label: 'Library', shortLabel: null, keywords: ['library', 'bookshop', 'book shop'] },
  { id: 'kiosk', label: 'Kiosks', shortLabel: null, keywords: ['kiosk', 'shopping', 'spot', 'futa bread'] },
  { id: 'gas', label: 'Gas shops', shortLabel: null, keywords: ['gas shop', 'cooking gas', 'gas refill'] },
];

// 1. Unmatched / gibberish queries must return empty, never unrelated waypoints
assert.deepEqual(searchEntries(SAMPLE_ENTRIES, 'zzzzz'), [], 'gibberish returns no results');
assert.deepEqual(searchEntries(SAMPLE_ENTRIES, 'nonexistentplace'), [], 'unmatched place returns empty');
console.log('ok: unmatched/gibberish queries return []');

// 2. Punctuation-only & blank queries return empty
assert.deepEqual(searchEntries(SAMPLE_ENTRIES, '!!!'), [], 'punctuation-only returns empty');
assert.deepEqual(searchEntries(SAMPLE_ENTRIES, '...'), [], 'dots-only returns empty');
assert.deepEqual(searchEntries(SAMPLE_ENTRIES, '   '), [], 'whitespace-only returns empty');
console.log('ok: punctuation-only and blank queries return []');

// 3. Normalization: hyphens, slashes, apostrophes, dots
assert.equal(searchEntries(SAMPLE_ENTRIES, 'south gate')[0].id, 'wp-gate-sg', 'hyphen normalized to space');
assert.equal(searchEntries(SAMPLE_ENTRIES, 'pos atm')[0].id, 'wp-pos-atm-title', 'slash normalized to space');
assert.equal(searchEntries(SAMPLE_ENTRIES, 'ti francis')[0].id, 'wp-tif', 'dots stripped cleanly');
assert.equal(searchEntries(SAMPLE_ENTRIES, 'debbys')[0].id, 'biz-debby', 'apostrophe stripped cleanly');
console.log('ok: hyphen/slash/dot/apostrophe normalization');

// 4. Campus acronyms & initialisms
assert.equal(searchEntries(SAMPLE_ENTRIES, 'AIL')[0].id, 'wp-lib', 'AIL -> Albert Ilemobade Library');
assert.equal(searchEntries(SAMPLE_ENTRIES, 'SEET')[0].id, 'wp-seet', 'SEET -> School of Engineering...');
assert.equal(searchEntries(SAMPLE_ENTRIES, 'SOC')[0].id, 'wp-soc', 'SOC -> School of Computing');
assert.equal(searchEntries(SAMPLE_ENTRIES, 'SUB')[0].id, 'wp-sub', 'SUB -> Students Union Building');
assert.equal(searchEntries(SAMPLE_ENTRIES, 'TIF')[0].id, 'wp-tif', 'TIF -> T.I. Francis Auditorium');
assert.equal(searchEntries(SAMPLE_ENTRIES, '250lt')[0].id, 'wp-250lt', '250lt -> 250 Lecture Theatre');
console.log('ok: FUTA acronyms and initialisms resolve');

// 5. Fuzzy typo tolerance & short non-match rejection
assert.equal(searchEntries(SAMPLE_ENTRIES, 'libary')[0].id, 'wp-lib', 'libary -> library');
assert.equal(searchEntries(SAMPLE_ENTRIES, 'hostle')[0].id, 'wp-hostel', 'hostle -> hostel');
assert.equal(searchEntries(SAMPLE_ENTRIES, 'shwarma')[0].id, 'wp-shawarma', 'shwarma -> shawarma');
assert.equal(searchEntries(SAMPLE_ENTRIES, 'obakeker')[0].id, 'wp-obk', 'obakeker -> Oba Kekere');
assert.deepEqual(searchEntries(SAMPLE_ENTRIES, 'xz'), [], '2-char non-match returns empty');
assert.deepEqual(searchEntries(SAMPLE_ENTRIES, 'qzx'), [], '3-char non-match returns empty');
console.log('ok: fuzzy typo tolerance without short false positives');

// 6. Metadata & student intent matching (area, type, exploreTags, aliases)
assert.ok(searchEntries(SAMPLE_ENTRIES, 'eat').some((r) => r.id === 'wp-buka'), '"eat" finds food spot');
assert.ok(searchEntries(SAMPLE_ENTRIES, 'cash').some((r) => r.id === 'wp-pos-sg'), '"cash" finds POS');
assert.ok(searchEntries(SAMPLE_ENTRIES, 'haircut').some((r) => r.id === 'wp-barber'), '"haircut" finds barber');
assert.ok(searchEntries(SAMPLE_ENTRIES, 'buka').some((r) => r.id === 'wp-buka'), 'exploreTag matches');
console.log('ok: metadata and student synonym matching');

// 7. Multi-word AND coverage (name + area)
const posSg = searchEntries(SAMPLE_ENTRIES, 'pos south gate');
assert.equal(posSg[0].id, 'wp-pos-sg', 'AND coverage places South Gate POS at #1');
console.log('ok: multi-word coverage ranks area+name combo first');

// 8. Proximity boost & _dist calculation
const nearNorthGate = { lat: 7.309, lng: 5.125 };
const chidiNearNg = searchEntries(SAMPLE_ENTRIES, 'Chidi POS', { user: nearNorthGate });
assert.equal(chidiNearNg[0].id, 'wp-pos-ng', 'closer Chidi POS beats farther one');
assert.ok(typeof chidiNearNg[0]._dist === 'number' && chidiNearNg[0]._dist < 50, '_dist computed in metres');

const nearSouthGate = { lat: 7.289, lng: 5.148 };
const chidiNearSg = searchEntries(SAMPLE_ENTRIES, 'Chidi POS', { user: nearSouthGate });
assert.equal(chidiNearSg[0].id, 'wp-pos-sg', 'proximity flips winner when user is at South Gate');
console.log('ok: GPS proximity boost and _dist calculation');

// 9. In-campus waypoint beats off-campus osm_import on equal match
const clinicHits = searchEntries(SAMPLE_ENTRIES, 'Unity Clinic');
assert.equal(clinicHits[0].id, 'wp-in-campus-clinic', 'in-campus waypoint outranks off-campus osm_import');
console.log('ok: in-campus waypoint outranks off-campus osm_import');

// 10. Strict coordinate parsing & searchEntries coord injection
assert.deepEqual(parseSearchCoord('7.2981, 5.1382')?.lat, 7.2981);
assert.deepEqual(parseSearchCoord('(7.2981, 5.1382)')?.lng, 5.1382);
assert.deepEqual(parseSearchCoord('7.2981 5.1382')?.lat, 7.2981);
assert.equal(parseSearchCoord('Block 2 1000'), null, 'rejects building + room number');
assert.equal(parseSearchCoord('2 1000'), null, 'rejects space-separated integers');
assert.equal(parseSearchCoord('95, 5.1'), null, 'rejects out-of-range latitude');
assert.equal(parseSearchCoord('7.3, 190'), null, 'rejects out-of-range longitude');
assert.equal(searchEntries(SAMPLE_ENTRIES, '7.2981, 5.1382')[0].source, 'coord', 'coord result surfaces first');
console.log('ok: strict parseSearchCoord and coord search entry');

// 11. matchCategoryChip
assert.equal(matchCategoryChip('hostel', SAMPLE_CHIPS)?.id, 'hostel');
assert.equal(matchCategoryChip('hostle', SAMPLE_CHIPS)?.id, 'hostel');
assert.equal(matchCategoryChip('eat', SAMPLE_CHIPS)?.id, 'restaurant');
assert.equal(matchCategoryChip('atm', SAMPLE_CHIPS)?.id, 'bank');
assert.equal(matchCategoryChip('printing press', SAMPLE_CHIPS)?.id, 'printing_shop');
assert.equal(matchCategoryChip('First Bank South Gate', SAMPLE_CHIPS), null, 'named place does not match chip');
assert.equal(matchCategoryChip('Albert Ilemobade Library', SAMPLE_CHIPS), null);
assert.equal(matchCategoryChip('futa', SAMPLE_CHIPS), null, 'stopword-only does not match chip');
console.log('ok: matchCategoryChip');

// 12. shouldQueryNominatim
assert.equal(shouldQueryNominatim([], 'Shoprite'), true);
assert.equal(shouldQueryNominatim([], 'ab'), false, 'too short');
assert.equal(shouldQueryNominatim([], '7.2981, 5.1382'), false, 'coord skips Nominatim');
assert.equal(
  shouldQueryNominatim(searchEntries(SAMPLE_ENTRIES, 'Senate Building'), 'Senate Building'),
  false,
  'exact local hit skips Nominatim'
);
const singlePrefixHit = searchEntries(
  [prepareEntry({ id: 'wp-uni', name: 'Unity Clinic', desc: '', area: '', lat: 7.299, lng: 5.138, type: 'clinic', source: 'waypoint' })],
  'uni'
);
assert.equal(
  shouldQueryNominatim(singlePrefixHit, 'uni'),
  true,
  '3-char prefix match does not suppress Nominatim'
);
const fourStrong = [
  { _score: 120 },
  { _score: 110 },
  { _score: 100 },
  { _score: 95 },
];
assert.equal(shouldQueryNominatim(fourStrong, 'cafe'), false, '4+ strong matches skip Nominatim');
console.log('ok: shouldQueryNominatim');

// 13. Exact vs prefix ranking (no double-counting inversion)
const rankFixture = [
  { id: 'senate-exact', name: 'Senate', desc: '', area: '', lat: 7.3, lng: 5.138, type: 'admin', source: 'waypoint' },
  { id: 'senate-bldg', name: 'Senate Building', desc: '', area: '', lat: 7.301, lng: 5.138, type: 'admin', source: 'waypoint' },
  { id: 'bank-exact', name: 'Bank', desc: '', area: '', lat: 7.299, lng: 5.139, type: 'bank', source: 'waypoint' },
  { id: 'bank-road', name: 'Bank Road', desc: '', area: '', lat: 7.299, lng: 5.14, type: 'segment', source: 'segment' },
].map(prepareEntry);
assert.equal(searchEntries(rankFixture, 'senate')[0].id, 'senate-exact', 'exact "Senate" beats "Senate Building"');
assert.equal(searchEntries(rankFixture, 'bank')[0].id, 'bank-exact', 'exact "Bank" beats segment "Bank Road"');
console.log('ok: exact match outranks prefix match');

// 14. Word-boundary category matching prevents false substring leaks
const leakFixture = [
  ...SAMPLE_ENTRIES,
  prepareEntry({ id: 'wp-pg', name: 'Postgraduate School', desc: 'PG admin', area: 'Obanla', lat: 7.302, lng: 5.136, type: 'admin', source: 'waypoint' }),
  prepareEntry({ id: 'wp-sec', name: 'Security Post', desc: 'Campus security', area: 'North Gate', lat: 7.308, lng: 5.126, type: 'infrastructure', source: 'waypoint' }),
  prepareEntry({ id: 'wp-po', name: 'Post Office', desc: 'Mail service', area: 'Obanla', lat: 7.297, lng: 5.136, type: 'admin', source: 'waypoint' }),
];
for (const q of ['atm', 'bank']) {
  const hits = searchEntries(leakFixture, q, { limit: 15 });
  assert.ok(!hits.some((r) => ['wp-pg', 'wp-sec', 'wp-po'].includes(r.id)), `"${q}" must not match Postgraduate/Post`);
}
assert.equal(searchEntries(leakFixture, 'bread').some((r) => r.id === 'wp-shawarma'), false, '"bread" must not match Ace Shawarma Spot');
console.log('ok: word-boundary category enrichment prevents pos/spot leaks');

// 15. CHIP_GENERIC_TAILS rejected on all 25 real chips
const ALL_REAL_CHIPS = CHIP_DISPLAY_ORDER.map((key) => ({
  id: key,
  label: CATEGORY_LABELS[key],
  shortLabel: CATEGORY_SHORT_LABELS[key] || null,
  keywords: CATEGORY_KEYWORDS[key],
}));
for (const tail of ['shop', 'shops', 'hall', 'station', 'center', 'centre', 'complex', 'press', 'residence', 'building']) {
  assert.equal(matchCategoryChip(tail, ALL_REAL_CHIPS), null, `generic word "${tail}" must not trigger a chip`);
}
assert.equal(matchCategoryChip('lecture hall', ALL_REAL_CHIPS)?.id, 'lecture_hall');
assert.equal(matchCategoryChip('printing press', ALL_REAL_CHIPS)?.id, 'printing_shop');
console.log('ok: CHIP_GENERIC_TAILS rejected across real 25 chips');

// 16. Plural aliases, pluralized names & diacritic folding
const pluralAccentFixture = [
  prepareEntry({ id: 'wp-hostels', name: 'Student Hostels', desc: '', area: '', lat: 7.29, lng: 5.14, type: 'hostel', source: 'waypoint' }),
  prepareEntry({ id: 'wp-cafe', name: 'Café', desc: 'Coffee and snacks', area: 'South Gate', lat: 7.289, lng: 5.148, type: 'food', source: 'waypoint' }),
  prepareEntry({ id: 'wp-cafe-royale', name: 'Café Royale', desc: 'Coffee and snacks', area: 'South Gate', lat: 7.2891, lng: 5.1481, type: 'food', source: 'waypoint' }),
  prepareEntry({ id: 'wp-wc', name: 'Main Toilet', desc: '', area: 'Obanla', lat: 7.3, lng: 5.138, type: 'toilet', source: 'waypoint' }),
];
assert.equal(searchEntries(pluralAccentFixture, 'sleep')[0].id, 'wp-hostels', 'single-word alias matches plural name');
assert.equal(searchEntries(pluralAccentFixture, 'toilets')[0].id, 'wp-wc', 'plural query matches toilet');
const cafeHits = searchEntries(pluralAccentFixture, 'cafe');
assert.equal(cafeHits[0].id, 'wp-cafe', 'diacritic NFD folds Café to exact match');
assert.ok(cafeHits[0]._score >= 220, 'exact folded match scores >= 220');
assert.ok(cafeHits[1]._score >= 165, 'prefix word match on Café Royale scores >= 165 (not fuzzy 40)');
console.log('ok: plural aliases, pluralized names, and diacritic folding');

// 17. Coordinate short-circuit + negative/no-space coords
const coordFixture = [
  ...SAMPLE_ENTRIES,
  prepareEntry({ id: 'wp-b7', name: 'Block 7', desc: 'Lecture block', area: 'Obanla', lat: 7.299, lng: 5.138, type: 'lecture_hall', source: 'waypoint' }),
];
const coordOnly = searchEntries(coordFixture, '7.2981, 5.1382');
assert.equal(coordOnly.length, 1, 'coord query returns only coordinate hit, no digit noise');
assert.equal(coordOnly[0].source, 'coord');
assert.equal(parseSearchCoord('-7.2981,5.1382')?.lat, -7.2981, 'supports negative no-space coords');
console.log('ok: coordinate short-circuit and negative/no-space coords');

// 18. Online Store (null lat/lng) queried with user GPS coords
const bizWithUser = searchEntries(SAMPLE_ENTRIES, 'Debby', { user: nearSouthGate });
assert.equal(bizWithUser[0].id, 'biz-debby');
assert.equal(bizWithUser[0]._dist, null, 'coordinate-less business keeps _dist: null safely');
console.log('ok: Online Store handles user GPS query safely');

// 19. damerauLevenshtein boundaries
assert.equal(damerauLevenshtein('hostel', 'hostel', 2), 0);
assert.equal(damerauLevenshtein('hostle', 'hostel', 1), 1, 'transposition');
assert.equal(damerauLevenshtein('libary', 'library', 1), 1, 'insertion');
assert.equal(damerauLevenshtein('abc', 'abcdef', 1), 2, 'length diff > maxDist returns maxDist + 1');
console.log('ok: damerauLevenshtein boundaries');
