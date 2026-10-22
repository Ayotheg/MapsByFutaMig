import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { fetchAllRows } from '../../lib/fetchAllRows';
import { cacheGet, cacheSet } from '../../lib/localCache';

const CACHE_KEY = 'learned-shortcuts';

// Active learned shortcuts (supabase/learned_shortcuts.sql), shaped like
// useSegments' segments so shortcutRoute.js `walkablePaths` takes both.
// Loaded once per navigation session; failures (offline, SQL not applied
// yet) fall back to the last cached list, or none — routing still works.
function toSegments(rows) {
  return (rows || [])
    .filter((r) => Array.isArray(r.path))
    .map((r) => ({
      id: `learned:${r.id}`,
      name: '',
      category: 'shortcut',
      points: r.path.map(([lat, lng]) => ({ lat: Number(lat), lng: Number(lng) })),
    }));
}

export function useLearnedShortcuts() {
  const [shortcuts, setShortcuts] = useState(() => cacheGet(CACHE_KEY)?.value || []);

  useEffect(() => {
    let cancelled = false;
    fetchAllRows(() => supabase.from('learned_shortcuts').select('id, path').eq('status', 'active').order('id', { ascending: true }))
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.warn('[learned shortcuts] load failed, using cached list:', error.message);
          return;
        }
        const shaped = toSegments(data);
        setShortcuts(shaped);
        cacheSet(CACHE_KEY, shaped);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return shortcuts;
}
