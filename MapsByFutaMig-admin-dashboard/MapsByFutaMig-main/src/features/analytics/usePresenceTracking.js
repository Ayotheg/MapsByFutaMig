import { useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { getAnonId } from '../../lib/analytics';

// ── Slice 14: live "who's online right now" (Supabase Realtime Presence)
//
// New file, no legacy equivalent. Mounted once near the root (MapPage.jsx,
// wherever useAuth() is already called) — `user` is threaded in as a
// prop, same convention every other hook in this codebase uses (no
// Context, grep-confirmed by Slice 10's useAuth.js header comment).
//
// No new websocket/polling solution — Supabase Realtime Presence
// (already included in @supabase/supabase-js, already a project
// dependency) powers this. `anon_id` is the stable presence key so a
// signed-out visitor's single tab shows as one entry even as `path`
// changes; presence auto-removes entries on disconnect (tab close,
// network drop) — no manual "last seen > N minutes ago" heartbeat-
// timeout system is built on top of it, that would be redundant and
// less accurate than what Presence already does.
//
// LiveTab.jsx (the admin-side viewer) subscribes to this same channel —
// the admin's own browser is just another client on 'site-presence'.
export function usePresenceTracking(user) {
  const channelRef = useRef(null);
  const lastActionRef = useRef({ action: null, at: 0 });
  const location = useLocation();

  useEffect(() => {
    const anonId = getAnonId();
    const channel = supabase.channel('site-presence', {
      config: { presence: { key: anonId } },
    });
    channelRef.current = channel;

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({
          anon_id: anonId,
          user_id: user?.id ?? null,
          // Never fabricate a name for anonymous users — LiveTab.jsx
          // falls back to "Anonymous · {anon_id.slice(0,8)}" itself.
          display_name: user?.user_metadata?.display_name ?? null,
          path: location.pathname,
          current_action: null,
          online_since: Date.now(),
        });
      }
    });

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
    // Re-subscribe only when identity actually changes (sign-in/out) —
    // route changes update the existing track() payload below instead of
    // tearing the channel down, since presence updates are cheap local
    // broadcasts, not DB writes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Route changes re-track() the presence payload — cheap, local
  // broadcast, not a DB write.
  useEffect(() => {
    const channel = channelRef.current;
    if (!channel) return;
    channel.track({
      anon_id: getAnonId(),
      user_id: user?.id ?? null,
      display_name: user?.user_metadata?.display_name ?? null,
      path: location.pathname,
      current_action: lastActionRef.current.action,
      online_since: Date.now(),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  // Exposed to call sites that want to say what someone's doing right
  // now (search-open, nav-start, admin-panel-open, review-modal-open).
  // Throttled to ~1 call/2s, not on every keystroke — this is a label
  // the admin reads, not a high-frequency signal.
  const updatePresence = useCallback(
    (action) => {
      const channel = channelRef.current;
      if (!channel) return;
      const now = Date.now();
      if (now - lastActionRef.current.at < 2000 && action === lastActionRef.current.action) return;
      lastActionRef.current = { action, at: now };
      channel.track({
        anon_id: getAnonId(),
        user_id: user?.id ?? null,
        display_name: user?.user_metadata?.display_name ?? null,
        path: location.pathname,
        current_action: action,
        online_since: Date.now(),
      });
    },
    [user, location.pathname]
  );

  return { updatePresence };
}