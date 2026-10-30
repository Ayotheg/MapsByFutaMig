import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { subscribeGps, getLastFix } from '../navigation/gpsWatch';
import { readPersistentState, writePersistentState, removePersistentState } from '../../lib/persistentState';
import { displayName } from '../auth/useAuth';
import { fetchProfileStats } from '../auth/profileStats';
import { track } from '../../lib/analytics';
import {
  CAPACITY,
  COUNTDOWN_MS,
  LOBBY_TTL_MS,
  MEET_ARRIVED_M,
  RACE_FINISH_M,
  RACE_LIMIT_MS,
  SEND_EVERY_MS,
  createCode,
  distanceM,
} from './friendsSession';

const STORE_KEY = 'friends-session';
// Turn on only once supabase/friends_realtime.sql is applied: `friends:*`
// channels then need a signed-in user, checked by the database rather than
// just this app's screens. A signed-out visitor reads the invite (who,
// where) from a separate public `friends-invite:*` channel that never
// carries positions.
const PRIVATE = import.meta.env.VITE_FRIENDS_PRIVATE_CHANNELS === 'true';
// No reply from a host this long after peeking: the link is dead.
const PEEK_TIMEOUT_MS = 9000;
// A finished meetup closes on its own after this.
const MEET_CLOSE_AFTER_MS = 60 * 1000;

/**
 * One "Meet me" or "Race to a place" session over a Supabase Realtime
 * channel (`friends:<code>`). Nothing is written to the database: presence
 * says who's in, broadcasts carry positions and the race events.
 *
 * The host's phone referees. It times every finish on its own clock and
 * sends the order out, so a phone with a wrong clock can't win. A race
 * shares only each player's distance to the finish; a meetup shares
 * coordinates, because seeing each other is the point.
 *
 * `session.phase`: 'invite' (a guest looking at a link, not joined yet),
 * 'lobby', 'countdown', 'live', 'ended'. `peek`: what the invite screen
 * knows about the link ('loading' | 'ready' | 'closed' | 'full' | 'started').
 */
export function useFriendsSession(user) {
  const [session, setSessionState] = useState(() => readPersistentState(STORE_KEY, null));
  const sessionRef = useRef(session);
  const setSession = useCallback((next) => {
    const value = typeof next === 'function' ? next(sessionRef.current) : next;
    sessionRef.current = value;
    setSessionState(value);
    if (value) writePersistentState(STORE_KEY, value);
    else removePersistentState(STORE_KEY);
  }, []);
  const patch = useCallback((fields) => setSession((s) => (s ? { ...s, ...fields } : s)), [setSession]);

  const [members, setMembers] = useState([]);
  const membersRef = useRef(members);
  membersRef.current = members;
  const [progress, setProgress] = useState({});
  const [peek, setPeek] = useState('loading');
  const [connected, setConnected] = useState(false);
  const channelRef = useRef(null);
  const myId = user?.id || null;
  const myName = user ? displayName(user) : null;

  const code = session?.code || null;
  const joined = !!session?.joined;
  const isHost = session?.role === 'host';

  const send = useCallback((event, payload) => {
    channelRef.current?.send({ type: 'broadcast', event, payload });
  }, []);

  // ── Host: the state a newcomer or a reconnecting phone needs ──────────
  const stateFor = useCallback(() => {
    const s = sessionRef.current;
    return {
      mode: s.mode,
      phase: s.phase,
      place: s.place || null,
      hostId: s.hostId,
      hostName: s.hostName,
      hostStats: s.hostStats || null,
      createdAt: s.createdAt,
      roster: s.roster || null,
      names: s.names || {},
      finishers: s.finishers || [],
      endReason: s.endReason || null,
      elapsedMs: s.goAt ? Date.now() - s.goAt : null,
      count: membersRef.current.length,
    };
  }, []);

  const endSession = useCallback(
    (reason) => {
      const s = sessionRef.current;
      if (!s || s.phase === 'ended') return;
      patch({ phase: 'ended', endReason: reason, endedAt: Date.now() });
      send('end', { reason, finishers: s.finishers || [], names: s.names || {} });
      track('friends_ended', { mode: s.mode, reason, finishers: (s.finishers || []).length });
    },
    [patch, send]
  );

  const recordFinish = useCallback(
    (id) => {
      const s = sessionRef.current;
      if (!s || s.phase !== 'live' || !s.goAt) return;
      if ((s.finishers || []).some((f) => f.id === id)) return;
      if (s.roster && !s.roster.includes(id)) return;
      const finishers = [...(s.finishers || []), { id, ms: Date.now() - s.goAt }];
      patch({ finishers });
      send('standings', { finishers });
      if (s.roster && finishers.length >= s.roster.length) endSession('done');
    },
    [patch, send, endSession]
  );

  // A guest takes in the host's state: the invite's details, or (rejoining
  // after a reload) wherever the session is now.
  const applyState = useCallback(
    (payload) => {
      const s = sessionRef.current;
      if (!s || s.role === 'host') return;
      setPeek('ready');
      const fields = {
        mode: payload.mode,
        place: payload.place,
        hostId: payload.hostId,
        hostName: payload.hostName,
        hostStats: payload.hostStats,
        createdAt: payload.createdAt,
        roster: payload.roster,
        names: { ...(s.names || {}), ...(payload.names || {}) },
        finishers: payload.finishers,
        endReason: payload.endReason,
        playerCount: payload.count ?? null,
      };
      if (payload.elapsedMs != null) fields.goAt = Date.now() - payload.elapsedMs;
      if (s.joined) {
        const inRoster = !payload.roster || payload.roster.includes(myId);
        if (payload.phase === 'ended') fields.phase = 'ended';
        else if (payload.phase === 'live' || payload.phase === 'countdown') {
          if (inRoster) fields.phase = payload.elapsedMs >= 0 ? 'live' : 'countdown';
        } else fields.phase = payload.phase;
      } else if (payload.phase === 'ended') {
        setPeek('closed');
      } else if (payload.phase !== 'lobby' && !(payload.roster || []).includes(myId)) {
        setPeek('started');
      }
      patch(fields);
    },
    [myId, patch]
  );

  // ── The channel ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!code) return undefined;
    // Private channels turn away signed-out visitors; they read the invite
    // from the public one below instead.
    if (PRIVATE && !myId) return undefined;
    // Without private channels a signed-out visitor reads the invite here,
    // but isn't in presence and can't join.
    const key = myId || `peek-${Math.random().toString(36).slice(2)}`;
    const channel = supabase.channel(`friends:${code}`, {
      config: { private: PRIVATE, broadcast: { self: false }, presence: { key } },
    });
    channelRef.current = channel;

    channel.on('presence', { event: 'sync' }, () => {
      const list = Object.values(channel.presenceState())
        .map((entries) => entries[0])
        .filter((m) => m?.id)
        .sort((a, b) => a.joinedAt - b.joinedAt);
      setMembers(list);
      const s = sessionRef.current;
      if (s && list.length) {
        const names = { ...(s.names || {}) };
        let changed = false;
        list.forEach((m) => {
          if (names[m.id] !== m.name) {
            names[m.id] = m.name;
            changed = true;
          }
        });
        if (changed) patch({ names });
      }
    });
    channel.on('presence', { event: 'join' }, () => {
      if (sessionRef.current?.role === 'host') send('state', stateFor());
    });

    channel.on('broadcast', { event: 'hello' }, () => {
      if (sessionRef.current?.role === 'host') send('state', stateFor());
    });

    channel.on('broadcast', { event: 'state' }, ({ payload }) => applyState(payload));

    channel.on('broadcast', { event: 'start' }, ({ payload }) => {
      const s = sessionRef.current;
      if (!s?.joined) {
        if (s) setPeek('started');
        return;
      }
      if (payload.roster && !payload.roster.includes(myId)) return;
      const now = Date.now();
      if (payload.mode === 'race') {
        patch({ phase: 'countdown', roster: payload.roster, names: payload.names, goAt: now + payload.countdownMs, finishers: [] });
      } else {
        patch({ phase: 'live', roster: payload.roster, names: payload.names, goAt: now });
      }
    });

    channel.on('broadcast', { event: 'pos' }, ({ payload }) => {
      if (!payload?.id) return;
      setProgress((p) => ({ ...p, [payload.id]: { ...payload, at: Date.now() } }));
    });

    channel.on('broadcast', { event: 'arrived' }, ({ payload }) => {
      if (sessionRef.current?.role === 'host' && payload?.id) recordFinish(payload.id);
    });

    channel.on('broadcast', { event: 'standings' }, ({ payload }) => {
      if (sessionRef.current?.role !== 'host') patch({ finishers: payload.finishers || [] });
    });

    channel.on('broadcast', { event: 'end' }, ({ payload }) => {
      const s = sessionRef.current;
      if (!s || s.phase === 'ended') return;
      // The host ends everything else itself; a meetup either side can end.
      if (s.role === 'host' && payload.reason !== 'left') return;
      if (!s.joined) {
        setPeek('closed');
        return;
      }
      patch({
        phase: 'ended',
        endReason: payload.reason,
        endedBy: payload.by || null,
        finishers: payload.finishers || s.finishers,
        names: { ...(s.names || {}), ...(payload.names || {}) },
        endedAt: Date.now(),
      });
    });

    channel.subscribe(async (status) => {
      if (status !== 'SUBSCRIBED') {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') setConnected(false);
        return;
      }
      setConnected(true);
      const s = sessionRef.current;
      if (s?.joined && myId) {
        await channel.track({ id: myId, name: myName, role: s.role, joinedAt: s.joinedAt || Date.now() });
      }
      if (s?.role === 'host') send('state', stateFor());
      else send('hello', {});
    });

    return () => {
      setConnected(false);
      supabase.removeChannel(channel);
      if (channelRef.current === channel) channelRef.current = null;
    };
  }, [code, joined, myId, myName, patch, send, stateFor, recordFinish, applyState]);

  // Private channels only: the invite card a signed-out visitor sees, from
  // a public channel that carries nothing but who's inviting and where.
  const role = session?.role;
  const phaseNow = session?.phase;
  useEffect(() => {
    if (!PRIVATE || !code) return undefined;
    const hosting = role === 'host';
    const peeking = role === 'guest' && !myId;
    if (!hosting && !peeking) return undefined;
    const channel = supabase.channel(`friends-invite:${code}`, { config: { broadcast: { self: false } } });
    const summary = () => {
      const st = stateFor();
      return {
        mode: st.mode,
        phase: st.phase,
        place: st.place,
        hostId: st.hostId,
        hostName: st.hostName,
        hostStats: st.hostStats,
        createdAt: st.createdAt,
        count: st.count,
        // Past the lobby the invite is closed to newcomers.
        roster: st.phase === 'lobby' ? null : [],
      };
    };
    const reply = () => channel.send({ type: 'broadcast', event: 'state', payload: summary() });
    channel.on('broadcast', { event: 'hello' }, () => hosting && reply());
    channel.on('broadcast', { event: 'state' }, ({ payload }) => peeking && applyState(payload));
    channel.subscribe((status) => {
      if (status !== 'SUBSCRIBED') return;
      if (hosting) reply();
      else channel.send({ type: 'broadcast', event: 'hello', payload: {} });
    });
    return () => supabase.removeChannel(channel);
  }, [code, role, myId, phaseNow, stateFor, applyState]);

  // A link with no host behind it never gets a reply.
  useEffect(() => {
    if (!code || session?.role !== 'guest' || session?.joined || peek !== 'loading') return undefined;
    const t = setTimeout(() => setPeek('closed'), PEEK_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [code, session?.role, session?.joined, peek]);

  // Over capacity: the last to join is turned away.
  useEffect(() => {
    const s = sessionRef.current;
    if (!s?.joined || s.role !== 'guest' || s.phase !== 'lobby' || !myId) return;
    const index = members.findIndex((m) => m.id === myId);
    if (index >= CAPACITY[s.mode]) {
      setPeek('full');
      setSession({ ...s, joined: false, phase: 'invite' });
    }
  }, [members, myId, setSession]);

  // Host timers: the invite expires, a race has a time limit.
  const phase = session?.phase;
  useEffect(() => {
    if (!isHost) return undefined;
    const s = sessionRef.current;
    let at = null;
    let reason = null;
    if (phase === 'lobby') {
      at = s.createdAt + LOBBY_TTL_MS;
      reason = 'expired';
    } else if (phase === 'live' && s.mode === 'race' && s.goAt) {
      at = s.goAt + RACE_LIMIT_MS;
      reason = 'timeout';
    }
    if (!at) return undefined;
    const t = setTimeout(() => endSession(reason), Math.max(0, at - Date.now()));
    return () => clearTimeout(t);
  }, [isHost, phase, endSession]);

  // Countdown ends on every phone at the same moment it was told to.
  useEffect(() => {
    if (phase !== 'countdown') return undefined;
    const wait = Math.max(0, (sessionRef.current.goAt || 0) - Date.now());
    const t = setTimeout(() => patch({ phase: 'live' }), wait);
    return () => clearTimeout(t);
  }, [phase, patch]);

  // ── My own position ─────────────────────────────────────────────────
  const [myFix, setMyFix] = useState(null);
  const lastSentRef = useRef(0);
  const sharing = joined && (phase === 'lobby' || phase === 'countdown' || phase === 'live');
  useEffect(() => {
    if (!sharing || !myId) return undefined;
    const onFix = (pos) => {
      const s = sessionRef.current;
      if (!s) return;
      const here = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      setMyFix(here);
      const payload = { id: myId };
      if (s.mode === 'race') payload.dist = distanceM(here, s.place);
      else Object.assign(payload, here);
      setProgress((p) => ({ ...p, [myId]: { ...payload, at: Date.now() } }));

      const finished = (s.finishers || []).some((f) => f.id === myId);
      const arrived = s.mode === 'race' && s.phase === 'live' && !finished && payload.dist != null && payload.dist <= RACE_FINISH_M;
      if (arrived) {
        if (s.role === 'host') recordFinish(myId);
        // Resent with every fix until the host's standings include it.
        else send('arrived', { id: myId });
      }
      const now = Date.now();
      if (now - lastSentRef.current < SEND_EVERY_MS && !arrived) return;
      lastSentRef.current = now;
      send('pos', payload);
    };
    const last = getLastFix();
    if (last) onFix(last);
    return subscribeGps(onFix, () => {});
  }, [sharing, myId, send, recordFinish]);

  // ── Meetup: who's here ──────────────────────────────────────────────
  const otherId = useMemo(() => {
    if (session?.mode !== 'meet') return null;
    return members.find((m) => m.id !== myId)?.id || (session.roster || []).find((id) => id !== myId) || null;
  }, [session?.mode, session?.roster, members, myId]);
  const meetDistance = session?.mode === 'meet' && otherId ? distanceM(myFix, progress[otherId]) : null;
  const meetArrived = phase === 'live' && meetDistance != null && meetDistance <= MEET_ARRIVED_M;
  useEffect(() => {
    if (!isHost || !meetArrived) return undefined;
    const t = setTimeout(() => endSession('met'), MEET_CLOSE_AFTER_MS);
    return () => clearTimeout(t);
  }, [isHost, meetArrived, endSession]);

  // ── Actions ─────────────────────────────────────────────────────────
  const create = useCallback(
    async (mode, place) => {
      if (!myId) return;
      const now = Date.now();
      setMembers([]);
      setProgress({});
      setSession({
        mode,
        code: createCode(),
        role: 'host',
        joined: true,
        joinedAt: now,
        phase: 'lobby',
        place: place || null,
        hostId: myId,
        hostName: myName,
        createdAt: now,
        names: { [myId]: myName },
        finishers: [],
      });
      track('friends_created', { mode, place: place?.name || null });
      const stats = await fetchProfileStats(supabase, myId).catch(() => null);
      if (stats?.status === 'ready' && sessionRef.current?.hostId === myId) {
        patch({ hostStats: { navs: stats.navs, reviews: stats.reviews } });
      }
    },
    [myId, myName, setSession, patch]
  );

  const openInvite = useCallback(
    (invite) => {
      const s = sessionRef.current;
      if (s?.code === invite.code) return;
      setPeek('loading');
      setMembers([]);
      setProgress({});
      setSession({ mode: invite.mode, code: invite.code, role: 'guest', joined: false, phase: 'invite', names: {} });
    },
    [setSession]
  );

  const join = useCallback(() => {
    if (!myId) return;
    const s = sessionRef.current;
    const phaseNow = s.roster?.includes(myId) ? 'live' : 'lobby';
    patch({ joined: true, joinedAt: Date.now(), phase: phaseNow });
    track('friends_joined', { mode: s.mode });
  }, [myId, patch]);

  const start = useCallback(() => {
    const s = sessionRef.current;
    if (!s || s.role !== 'host' || s.phase !== 'lobby') return;
    const roster = members.map((m) => m.id).slice(0, CAPACITY[s.mode]);
    if (!roster.includes(myId)) roster.unshift(myId);
    const names = { ...(s.names || {}) };
    if (s.mode === 'race') {
      patch({ phase: 'countdown', roster, names, goAt: Date.now() + COUNTDOWN_MS, finishers: [] });
      send('start', { mode: 'race', roster, names, countdownMs: COUNTDOWN_MS });
    } else {
      patch({ phase: 'live', roster, names, goAt: Date.now() });
      send('start', { mode: 'meet', roster, names });
    }
    track('friends_started', { mode: s.mode, players: roster.length });
  }, [members, myId, patch, send]);

  // A meetup's lobby: meet at a place, or (null) just find each other.
  const setMeetPlace = useCallback(
    (place) => {
      const s = sessionRef.current;
      if (!s || s.role !== 'host' || s.mode !== 'meet' || s.phase !== 'lobby') return;
      patch({ place });
      send('state', stateFor());
    },
    [patch, send, stateFor]
  );

  // Leaving as host ends it for everyone. Once a meetup is going, either
  // of the two leaving ends it; a racer just drops out.
  const leave = useCallback(() => {
    const s = sessionRef.current;
    const meetGoing = s?.mode === 'meet' && s.joined && s.phase === 'live';
    if (meetGoing) {
      send('end', { reason: 'left', by: myName });
      track('friends_ended', { mode: 'meet', reason: 'left', finishers: 0 });
    } else if (s?.role === 'host' && s.phase !== 'ended') {
      endSession(s.phase === 'lobby' ? 'cancelled' : 'host-left');
    }
    setSession(null);
    setMembers([]);
    setProgress({});
    setMyFix(null);
  }, [endSession, setSession, send, myName]);

  return {
    session,
    members,
    progress,
    peek,
    connected,
    myId,
    myFix,
    otherId,
    meetDistance,
    meetArrived,
    create,
    openInvite,
    join,
    start,
    leave,
    setMeetPlace,
  };
}
