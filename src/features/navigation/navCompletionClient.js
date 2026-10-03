import { supabase } from '../../lib/supabase';
import { readPersistentState, removePersistentState, writePersistentState } from '../../lib/persistentState';
import { track } from '../../lib/analytics';
import { createNavCompletionRecorder } from './navCompletion';

// Real wiring for navCompletion.js: Supabase RPC + the app's localStorage
// helper. Kept separate so navCompletion.js stays testable without a
// Supabase client.
const recorder = createNavCompletionRecorder({
  rpc: (fn, args) => supabase.rpc(fn, args),
  storage: { read: readPersistentState, write: writePersistentState, remove: removePersistentState },
  onError: (err) => {
    console.warn('Could not record navigation completion (will retry):', err?.message || err);
    track('error_occurred', { context: 'nav_completion_record', message: err?.message || String(err) });
  },
});

export const reportNavigationCompletion = recorder.report;
export const flushPendingNavCompletions = recorder.flush;
