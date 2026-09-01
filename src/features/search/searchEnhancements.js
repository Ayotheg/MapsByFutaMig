import Fuse from 'fuse.js';
import { haversine } from '../../lib/geoUtils';

/**
 * INTELLIGENT SEARCH ENGINE - Google-like natural language search
 * 
 * NO SPECIAL SYMBOLS REQUIRED. Just type naturally:
 * - "top rated cafes" → finds highly-rated cafés
 * - "cafes near me" → shows nearby cafés
 * - "closest laundry" → shows nearest laundromats
 * - "laundry" → finds both "laundry" AND "laundromat"
 * 
 * Special syntax (@type, #rating:4+) still works but is OPTIONAL.
 * System automatically detects intent from natural language.
 * 
 * Features:
 * - Fuzzy matching (typos: "libary" → "library")
 * - Partial word matching (substrings, not just whole words)
 * - Synonym mapping (laundry ↔ laundromat)
 * - Natural language intent detection (no @ or # needed)
 * - Distance + rating ranking
 * - Recent search history
 */

// ─── Recent Searches Management ───────────────────────────────────────────

const RECENT_SEARCHES_KEY = 'futa-recent-searches';
const MAX_RECENT_SEARCHES = 10;

export function saveRecentSearch(query) {
  if (!query || query.trim().length < 2) return;
  
  try {
    const recent = JSON.parse(localStorage.getItem(RECENT_SEARCHES_KEY) || '[]');
    const filtered = recent.filter(q => q.toLowerCase() !== query.toLowerCase());
    filtered.unshift(query);
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(filtered.slice(0, MAX_RECENT_SEARCHES)));
  } catch (e) {
    console.warn('Failed to save recent search:', e);
  }
}

export function getRecentSearches() {
  try {
    return JSON.parse(localStorage.getItem(RECENT_SEARCHES_KEY) || '[]');
  } catch (e) {
    console.warn('Failed to get recent searches:', e);
    return [];
  }
}

export function clearRecentSearches() {
  try {
    localStorage.removeItem(RECENT_SEARCHES_KEY);
  } catch (e) {
    console.warn('Failed to clear recent searches:', e);
  }
}

// ─── Synonym Mapping (for better word matching) ──────────────────────────

const SYNONYMS = {
  'laundry': ['laundromat', 'laundry', 'wash'],
  'library': ['library', 'libraries', 'book'],
  'cafe': ['cafe', 'cafeteria', 'coffee', 'restaurant'],
  'clinic': ['clinic', 'hospital', 'health', 'medical'],
  'lab': ['lab', 'laboratory', 'science'],
  'chapel': ['chapel', 'church', 'mosque', 'prayer'],
  'pharmacy': ['pharmacy', 'drug', 'medicine'],
  'gym': ['gym', 'fitness', 'sports', 'exercise'],
  'parking': ['parking', 'car', 'park'],
  'bathroom': ['bathroom', 'toilet', 'restroom', 'wc'],
  'water': ['water', 'fountain', 'hydration'],
};

/**
 * Get all synonyms for a word (including the word itself)
 */
export function getSynonyms(word) {
  const normalized = (word || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!normalized) return [word];
  
  // Check if word or any synonym matches
  for (const [key, synonymList] of Object.entries(SYNONYMS)) {
    const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (normalizedKey === normalized) {
      return synonymList;
    }
    for (const syn of synonymList) {
      const normalizedSyn = syn.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (normalizedSyn === normalized) {
        return synonymList;
      }
    }
  }
  
  return [word];
}

// ─── Natural Language Parsing ─────────────────────────────────────────────

/**
 * IMPROVED: Parse query for IMPLICIT intent without requiring special syntax.
 * 
 * Natural language understanding:
 * - "top rated cafes" → automatically detects: type=cafe, rating=4+
 * - "closest laundry" → automatically detects: type=laundry, sort=distance
 * - "cafes near me" → automatically detects: type=cafe, nearMe=true
 * - "show me laundromats" → automatically detects: type=laundry
 * 
 * Special syntax (@cafe, #rating:4+) still works for power users.
 */
export function parseSearchQuery(q) {
  const result = {
    query: q,
    filters: {},
    intent: 'search',
    typeFilter: null,
    ratingFilter: null,
    distanceFilter: null,
    nearMe: false,
    sortBy: null, // 'distance', 'rating'
  };

  if (!q) return result;

  const lowerQ = q.toLowerCase();
  let workingQuery = q;

  // ── EXPLICIT SYNTAX (still supported for power users) ──────────────────
  
  // Detect "near me" / proximity intent
  if (/\b(near\s+me|close\s+to\s+me|around\s+me|nearby)\b/i.test(lowerQ)) {
    result.nearMe = true;
    result.sortBy = 'distance';
    result.intent = 'nearby';
    workingQuery = workingQuery.replace(/\b(near\s+me|close\s+to\s+me|around\s+me|nearby)\b/i, '').trim();
  }

  // Parse @type explicit filters
  const typeMatch = workingQuery.match(/@(\w+)/);
  if (typeMatch) {
    result.typeFilter = typeMatch[1].toLowerCase();
    workingQuery = workingQuery.replace(/@\w+/i, '').trim();
    result.intent = 'filter';
  }

  // Parse #rating explicit filters
  const ratingMatch = workingQuery.match(/#rating:(\d)(\+?)/);
  if (ratingMatch) {
    const minRating = parseFloat(ratingMatch[1]);
    result.ratingFilter = ratingMatch[2] ? { min: minRating, inclusive: true } : { exact: minRating };
    workingQuery = workingQuery.replace(/#rating:\d\+?/i, '').trim();
    result.intent = 'filter';
  }

  // Parse #nearby explicit distance filters
  const distMatch = workingQuery.match(/#nearby:(\d+)(m|km)?/);
  if (distMatch) {
    let meters = parseInt(distMatch[1], 10);
    if (distMatch[2] === 'km') meters *= 1000;
    result.distanceFilter = meters;
    workingQuery = workingQuery.replace(/#nearby:\d+(m|km)?/i, '').trim();
    result.intent = 'filter';
  }

  // ── IMPLICIT NATURAL LANGUAGE DETECTION (NEW - no syntax needed) ────────

  // Detect rating intent from keywords ("top", "best", "highly rated", etc.)
  if (/\b(top|best|highest|highly\s+rated|excellent|premium|popular)\b/i.test(lowerQ)) {
    result.ratingFilter = { min: 4, inclusive: true };
    result.sortBy = 'rating';
  }

  // Detect distance intent from keywords ("closest", "nearest", "nearby", etc.)
  if (/\b(closest|nearest|close|around|local)\b/i.test(lowerQ)) {
    result.nearMe = true;
    result.sortBy = 'distance';
  }

  // Detect type from keywords (implicit, no @ needed)
  // Remove common words and look for place-type words
  const typeWords = workingQuery
    .replace(/\b(show|find|get|give|me|a|an|the|in|on|at|is|are)\b/gi, '')
    .trim()
    .split(/\s+/);

  for (const word of typeWords) {
    // Check if this word matches any place type
    const normalized = word.toLowerCase().replace(/[^a-z0-9]/g, '');
    for (const [key] of Object.entries(SYNONYMS)) {
      if (key === normalized || SYNONYMS[key]?.some(syn => syn.replace(/[^a-z0-9]/g, '') === normalized)) {
        if (!result.typeFilter) {
          result.typeFilter = key;
        }
      }
    }
  }

  result.query = workingQuery;
  return result;
}

// ─── Distance-Based Ranking ────────────────────────────────────────────────

/**
 * Calculate distance boost factor based on user location.
 * Closer results get higher scores.
 * Max boost: 50 points for results within 100m
 */
export function getDistanceBoost(entry, userLat, userLng) {
  if (!userLat || !userLng || !entry.lat || !entry.lng) return 0;
  
  const distMeters = haversine(userLat, userLng, entry.lat, entry.lng);
  
  // Inverse distance: closer = higher boost
  // Max 50 points at 0m, decays to near-0 at 5km+
  if (distMeters < 100) return 50;
  if (distMeters < 500) return 40 - (distMeters / 500) * 25;
  if (distMeters < 2000) return 15 - (distMeters / 2000) * 15;
  return Math.max(0, 2 - (distMeters / 5000) * 2);
}

// ─── Rating-Based Ranking ────────────────────────────────────────────────

/**
 * Calculate rating boost factor.
 * Highly rated results get a bonus.
 * Max boost: 30 points for 5-star ratings
 */
export function getRatingBoost(entry) {
  const rating = entry.avgRating;
  const reviewCount = entry.reviewCount || 0;
  
  if (!rating || reviewCount === 0) return 0;
  
  // Only boost highly-rated items (4+ stars) with sufficient reviews (3+)
  if (reviewCount < 3) return 0;
  
  // Scale: 4.0 stars = +10, 4.5 = +20, 5.0 = +30
  const normalizedRating = Math.min(5, Math.max(4, rating));
  return ((normalizedRating - 4) / 1) * 30;
}

// ─── Fuzzy Matching Setup ────────────────────────────────────────────────

/**
 * Create a Fuse instance for fuzzy searching against an index.
 * Used for typo tolerance without changing existing exact/prefix scoring.
 */
export function createFuzzySearcher(entries) {
  return new Fuse(entries, {
    keys: ['name', 'desc'],
    threshold: 0.4, // 40% mismatch allowed (typos, small variations)
    minMatchCharLength: 2,
    useExtendedSearch: false,
    ignoreLocation: true,
  });
}

// ─── IMPROVED Scoring Functions (with fuzzy + word matching) ──────────────

/**
 * Calculate text relevance score.
 * NOW includes:
 * - Exact match scoring
 * - Prefix/substring matching
 * - Partial word matching (key improvement!)
 * - Fuzzy matching for typos
 * - Synonym awareness (laundry matches laundromat)
 */
export function scoreText(entry, q) {
  if (!q) return 0;
  
  const queryNorm = q.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
  const nameNorm = (entry.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const descNorm = (entry.desc || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  
  let score = 0;
  const queryWords = queryNorm.split(/\s+/).filter(w => w.length > 0);

  // ── EXACT MATCHES (highest priority) ──────────────────────────────────
  if (nameNorm === queryNorm) {
    score += 150; // Perfect match
  } else if (nameNorm.startsWith(queryNorm)) {
    score += 100; // Prefix match
  } else if (nameNorm.includes(queryNorm)) {
    score += 80; // Contains exact query
  }

  // ── WORD-LEVEL MATCHING (improved for substrings) ───────────────────
  queryWords.forEach((queryWord) => {
    if (queryWord.length < 2) return; // Skip very short words
    
    // Check name for this word
    if (nameNorm.includes(queryWord)) {
      score += 40; // Strong match: word appears in name
    } else if (nameNorm.split(/\W+/).some(w => w.startsWith(queryWord))) {
      score += 30; // Prefix match: word starts with query term
    }
    
    // Check if word is a PARTIAL MATCH (substring matching - KEY IMPROVEMENT)
    // e.g., "laund" matches "laundromat"
    const nameWords = nameNorm.split(/\W+/);
    for (const nameWord of nameWords) {
      if (nameWord.includes(queryWord) && queryWord.length >= 3) {
        score += 25; // Partial word match
      }
    }
    
    // Check description
    if (descNorm.includes(queryWord)) {
      score += 15;
    }
  });

  // ── SYNONYM MATCHING (NEW: check if query matches place via synonyms) ───
  // If we searched "laundry", boost matches that say "laundromat"
  for (const queryWord of queryWords) {
    const syns = getSynonyms(queryWord);
    for (const syn of syns) {
      const synNorm = syn.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (nameNorm.includes(synNorm)) {
        score += 35; // Synonym found in name
      }
      if (descNorm.includes(synNorm)) {
        score += 10; // Synonym found in description
      }
    }
  }

  // ── FUZZY MATCHING FOR TYPOS (NEW - now active in scoring) ─────────────
  // Use levenshtein-like distance for typo tolerance
  const fuzzyScore = calculateFuzzyScore(queryNorm, nameNorm, descNorm);
  score += fuzzyScore;

  // Source type bonus (keep legacy behavior)
  if (entry.source === 'waypoint') score += 15;
  if (entry.source === 'segment') score += 10;

  return Math.max(0, score);
}

/**
 * Calculate fuzzy matching score for typo tolerance.
 * Uses a simple Levenshtein-like distance algorithm.
 */
function calculateFuzzyScore(query, name, desc) {
  const maxScore = 50; // Max fuzzy points
  
  // Simple: if similarity is high, give points
  // For query "libary" vs name "library": should match
  const nameSimilarity = stringSimilarity(query, name);
  const descSimilarity = stringSimilarity(query, desc);
  
  // Only reward if similarity is decent (avoid random matches)
  if (nameSimilarity > 0.7) return maxScore * nameSimilarity;
  if (descSimilarity > 0.7) return maxScore * descSimilarity * 0.5;
  
  return 0;
}

/**
 * Simple string similarity 0-1 based on character overlap.
 * "libary" vs "library" = 0.85 (good match despite typo)
 */
function stringSimilarity(s1, s2) {
  const shorter = s1.length < s2.length ? s1 : s2;
  const longer = s1.length >= s2.length ? s1 : s2;
  
  if (longer.length === 0) return 1;
  
  // Count matching characters in order
  let matches = 0;
  let s1Idx = 0;
  for (let s2Idx = 0; s2Idx < longer.length && s1Idx < shorter.length; s2Idx++) {
    if (shorter[s1Idx] === longer[s2Idx]) {
      matches++;
      s1Idx++;
    }
  }
  
  return matches / longer.length;
}

/**
 * Enhanced score with distance, rating, and sorting.
 */
export function scoreEnhanced(entry, q, userLocation = null, options = {}) {
  const { includeDistance = true, includeRating = true } = options;
  
  // Use improved text scoring
  let score = scoreText(entry, q);
  
  // Add distance boost if user location available
  if (includeDistance && userLocation?.lat && userLocation?.lng) {
    score += getDistanceBoost(entry, userLocation.lat, userLocation.lng);
  }
  
  // Add rating boost for highly-reviewed items
  if (includeRating) {
    score += getRatingBoost(entry);
  }
  
  return score;
}

// ─── Type-Based Filtering ────────────────────────────────────────────────

/**
 * Filter entries by place type or category.
 * Supports flexible matching: "cafe", "Cafe", "CAFE" all work.
 */
export function filterByType(entries, typeFilter) {
  if (!typeFilter) return entries;
  
  const typeNorm = typeFilter.toLowerCase().replace(/[^a-z0-9]/g, '');
  return entries.filter(e => {
    const subtype = (e.subtype || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const type = (e.type || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    return subtype.includes(typeNorm) || type.includes(typeNorm);
  });
}

/**
 * Filter entries by distance radius (in meters).
 */
export function filterByDistance(entries, distanceMeters, userLat, userLng) {
  if (!distanceMeters || !userLat || !userLng) return entries;
  
  return entries.filter(e => {
    if (!e.lat || !e.lng) return false;
    const dist = haversine(userLat, userLng, e.lat, e.lng);
    return dist <= distanceMeters;
  });
}

/**
 * Filter entries by minimum rating.
 */
export function filterByRating(entries, ratingFilter) {
  if (!ratingFilter) return entries;
  
  return entries.filter(e => {
    if (!e.avgRating) return false;
    
    if (ratingFilter.min) {
      return e.avgRating >= ratingFilter.min;
    } else if (ratingFilter.exact) {
      return Math.round(e.avgRating * 2) / 2 === ratingFilter.exact;
    }
    return true;
  });
}

// ─── Suggestion/Auto-Complete ────────────────────────────────────────────

/**
 * Generate quick suggestions based on partial query.
 * Used for real-time "as you type" suggestions.
 */
export function generateSuggestions(entries, partialQuery, limit = 5) {
  if (!partialQuery || partialQuery.length < 2) return [];
  
  const q = partialQuery.toLowerCase();
  const scored = entries
    .map(e => ({
      ...e,
      _suggestionScore: (
        (e.name || '').toLowerCase().startsWith(q) ? 100 :
        (e.name || '').toLowerCase().includes(q) ? 50 :
        0
      ),
    }))
    .filter(e => e._suggestionScore > 0)
    .sort((a, b) => b._suggestionScore - a._suggestionScore)
    .slice(0, limit);
  
  return scored;
}

// ─── Search Shortcuts ────────────────────────────────────────────────────

/**
 * Popular search shortcuts for quick access.
 * Can be expanded as needed.
 */
export const SEARCH_SHORTCUTS = [
  { shortcut: '@cafe', display: 'Cafés', description: 'Find cafés on campus' },
  { shortcut: '@library', display: 'Libraries', description: 'Find libraries' },
  { shortcut: '@lab', display: 'Labs', description: 'Find labs' },
  { shortcut: '@clinic', display: 'Health Centers', description: 'Find clinics' },
  { shortcut: '#rating:4+', display: 'Top Rated', description: 'Highly rated places' },
  { shortcut: 'near me', display: 'Nearby', description: 'Places near your location' },
];

/**
 * Get shortcuts that match the current query.
 */
export function getMatchingShortcuts(query) {
  if (!query || query.length < 1) return SEARCH_SHORTCUTS.slice(0, 3);
  
  const q = query.toLowerCase();
  return SEARCH_SHORTCUTS.filter(s => 
    s.shortcut.includes(q) || 
    s.display.toLowerCase().includes(q) ||
    s.description.toLowerCase().includes(q)
  ).slice(0, 3);
}
