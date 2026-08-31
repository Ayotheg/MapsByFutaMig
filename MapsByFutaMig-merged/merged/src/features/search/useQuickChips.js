import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_CHIPS } from './chipConfig';
import { fetchChips } from '../admin/quickChipsApi';

/**
 * Single source of truth for "what chips does the Quick Chips bar show
 * right now" — owned once by MapPage, threaded down to `QuickChips.jsx`
 * (the bar) and `ChipResultsPanel.jsx` (the results list), and refetched
 * by the admin "Chips" tab after any add/edit/delete so every open tab of
 * the app reflects admin changes without a full reload.
 *
 * Starts from `DEFAULT_CHIPS` (zero-latency first paint, matches what
 * ships before any admin edit) and swaps in the live Supabase-backed list
 * once it resolves — `quickChipsApi.fetchChips()` itself falls back to
 * `DEFAULT_CHIPS` if the `quick_chips` table doesn't exist yet, so this
 * hook never needs its own try/catch.
 */
export function useQuickChips() {
  const [chips, setChips] = useState(DEFAULT_CHIPS);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    setLoading(true);
    const list = await fetchChips();
    setChips(list.length ? list : DEFAULT_CHIPS);
    setLoading(false);
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { chips, loading, refetch };
}
