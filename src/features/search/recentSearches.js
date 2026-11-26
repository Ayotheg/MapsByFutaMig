import { readPersistentState, removePersistentState, writePersistentState } from '../../lib/persistentState';
import { compactText } from './searchEngine';

const RECENT_KEY = 'recent-searches';
const MAX_RECENT = 5;

function samePlace(a, b) {
  if (a.id != null && b.id != null && a.id !== '' && b.id !== '') {
    return String(a.id) === String(b.id);
  }
  return compactText(a.name) !== '' && compactText(a.name) === compactText(b.name);
}

function toCompactEntry(entry) {
  return {
    id: entry.id ?? null,
    name: entry.name,
    desc: entry.desc || '',
    area: entry.area || '',
    lat: entry.lat ?? null,
    lng: entry.lng ?? null,
    type: entry.type || 'poi',
    subtype: entry.subtype || entry.type || 'poi',
    source: entry.source || 'waypoint',
    isBusiness: Boolean(entry.isBusiness),
    businessLink: entry.businessLink || '',
    businessPlatform: entry.businessPlatform || '',
    imageUrls: Array.isArray(entry.imageUrls) ? entry.imageUrls.slice(0, 3) : [],
  };
}

export function getRecentSearches() {
  const stored = readPersistentState(RECENT_KEY, []);
  return Array.isArray(stored) ? stored.filter((item) => item && item.name) : [];
}

export function addRecentSearch(entry) {
  if (!entry || !entry.name) return getRecentSearches();
  if (entry.source === 'coord' || entry.type === 'coord') return getRecentSearches();

  const compact = toCompactEntry(entry);
  const existing = getRecentSearches();
  const next = [compact, ...existing.filter((item) => !samePlace(item, compact))].slice(0, MAX_RECENT);
  writePersistentState(RECENT_KEY, next);
  return next;
}

export function removeRecentSearch(entry) {
  if (!entry) return getRecentSearches();
  const next = getRecentSearches().filter((item) => !samePlace(item, entry));
  if (next.length) writePersistentState(RECENT_KEY, next);
  else removePersistentState(RECENT_KEY);
  return next;
}

export function clearRecentSearches() {
  removePersistentState(RECENT_KEY);
  return [];
}
