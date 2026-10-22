import { supabase } from '../../lib/supabase';
import { readPersistentState, removePersistentState, writePersistentState } from '../../lib/persistentState';
import { getAnonId, track } from '../../lib/analytics';
import { createShortcutSharer } from './learnedShortcuts';

// Real wiring for learnedShortcuts.js: Supabase RPC, localStorage and the
// same anonymous browser id analytics uses.
const sharer = createShortcutSharer({
  rpc: (fn, args) => supabase.rpc(fn, args),
  storage: { read: readPersistentState, write: writePersistentState, remove: removePersistentState },
  anonId: getAnonId,
  onError: (err) => {
    console.warn('Could not share shortcut (will retry):', err?.message || err);
    track('error_occurred', { context: 'shortcut_share', message: err?.message || String(err) });
  },
});

export const shareShortcuts = sharer.share;
export const reportShortcutOutcomes = sharer.reportOutcomes;
export const flushPendingShortcuts = sharer.flush;
export const shortcutConsent = sharer.consent;
export const setShortcutConsent = sharer.setConsent;
