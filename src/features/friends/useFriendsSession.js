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
  DROP_AFTER_MS,
  HOST_GONE_MS,
  LOBBY_TTL_MS,
  MEET_ARRIVED_M,
  RACE_FINISH_M,
  RACE_LIMIT_MS,
  SEND_EVERY_MS,
  createCode,
  distanceM,
  nextHost,
  raceDone,
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

// supabase.channel() hands back an existing channel with the same topic,
// and removeChannel() only finishes once the server confirms. Opening the
// same topic again before then would get the dying channel, which never
// subscribes. So a reopen waits for the previous close.
const closing = new Map();
function openChannel(topic, config, setup) {
  let cancelled = false;
  let channel = null;
  (closing.get(topic) || Promise.resolve()).then(() => {
    if (cancelled) return;
    channel = supabase.channel(topic, { config });
    setup(channel);
  });
  return () => {
    cancelled = true;
    if (!channel) return;
    const done = supabase.removeChannel(channel).catch(() => {});
    closing.set(topic, done);
    done.finally(() => {
      if (closing.get(topic) === done) closing.delete(topic);
    });
  };
}

const union = (list, ids) => Array.from(new Set([...(list || []), ...ids]));

/**
 * One "Meet me" or "Race to a place" session over a Supabase Realtime
 * channel (`friends:<code>`). Nothing is written to the database: presence
 * says who's in, broadcasts carry positions and the race events.
 *
 * One phone referees (`session.hostId`): it times every finish on its own
 * clock and sends the order out, so a phone with a wrong clock can't win.
 * In a race the role passes on: a leaving host hands it to the next player,
 * and if the host just vanishes the next player takes it after
 * HOST_GONE_MS. `hostTerm` counts handovers, so a returning old host's
 * stale messages are ignored and it steps down. A race shares only each
 * player's distance to the finish; a meetup shares coordinates.
 *
 * `session.phase`: 'invite' (looking at a link, not joined yet), 'lobby',
 * 'countdown', 'live', 'ended'. `peek`: what the invite screen knows
 * ('loading' | 'ready' | 'closed' | 'notfound' | 'full' | 'started').
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
  const myIdRef = useRef(myId);
  myIdRef.current = myId;
  const myNameRef = useRef(myName);
  myNameRef.current = myName;

  const code = session?.code || null;
  const joined = !!session?.joined;
  const isHost = !!myId && session?.hostId === myId;
  const phase = session?.phase;
  const mode = session?.mode;

  const amHost = useCallback(() => {
    const s = sessionRef.current;
    return !!s && !!myIdRef.current && s.hostId === myIdRef.current;
  }, []);
  const send = useCallback((event, payload) => {
    channelRef.current?.send({ type: 'broadcast', event, payload });
  }, []);
  const presentIds = useCallback(() => new Set(membersRef.current.map((m) => m.id)), []);

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
      hostTerm: s.hostTerm || 0,
      createdAt: s.createdAt,
      roster: s.roster || null,
      names: s.names || {},
      finishers: s.finishers || [],
      dropped: s.dropped || [],
      handover: s.handover || null,
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
      send('end', { reason, finishers: s.finishers || [], dropped: s.dropped || [], names: s.names || {}, hostTerm: s.hostTerm || 0 });
      track('friends_ended', { mode: s.mode, reason, finishers: (s.finishers || []).length });
    },
    [patch, send]
  );

  // Host: publish the standings, and end the race once nobody is left racing.
  const publishStandings = useCallback(
    (finishers, dropped) => {
      const s = sessionRef.current;
      patch({ finishers, dropped });
      send('standings', { finishers, dropped, hostTerm: s.hostTerm || 0 });
      if (s.phase === 'live' && raceDone(s.roster, finishers, dropped)) endSession('done');
    },
    [patch, send, endSession]
  );

  const recordFinish = useCallback(
    (id) => {
      const s = sessionRef.current;
      if (!s || s.phase !== 'live' || !s.goAt) return;
      if ((s.finishers || []).some((f) => f.id === id)) return;
      if (s.roster && !s.roster.includes(id)) return;
      // Someone dropped for being offline who comes back and finishes counts.
      const finishers = [...(s.finishers || []), { id, ms: Date.now() - s.goAt }];
      publishStandings(finishers, (s.dropped || []).filter((x) => x !== id));
    },
    [publishStandings]
  );

  const dropPlayers = useCallback(
    (ids) => {
      const s = sessionRef.current;
      if (!s || s.mode !== 'race' || (s.phase !== 'live' && s.phase !== 'countdown')) return;
      const fresh = ids.filter((id) => !(s.finishers || []).some((f) => f.id === id));
      if (!fresh.length) return;
      publishStandings(s.finishers || [], union(s.dropped, fresh));
    },
    [publishStandings]
  );

  // A racer who reached the finish while the host was away tells it again.
  const resendArrival = useCallback(() => {
    const s = sessionRef.current;
    const me = myIdRef.current;
    if (!s?.arrivedAt || s.mode !== 'race' || s.phase !== 'live' || amHost()) return;
    if ((s.finishers || []).some((f) => f.id === me)) return;
    send('arrived', { id: me });
  }, [amHost, send]);

  // A guest takes in the host's state: the invite's details, or (rejoining
  // after a reload, or a new host taking over) wherever the session is now.
  const applyState = useCallback(
    (payload) => {
      const s = sessionRef.current;
      if (!s) return;
      const me = myIdRef.current;
      const term = payload.hostTerm || 0;
      const mine = s.hostTerm || 0;
      if (term < mine || (term === mine && amHost() && payload.hostId !== me && payload.hostId > me)) {
        // A stale host (or a tie we win): remind it who referees now.
        if (amHost()) send('state', stateFor());
        return;
      }
      const fields = {
        mode: payload.mode,
        place: payload.place,
        hostId: payload.hostId,
        hostName: payload.hostName,
        hostStats: payload.hostStats,
        hostTerm: term,
        createdAt: payload.createdAt,
        roster: payload.roster,
        names: { ...(s.names || {}), ...(payload.names || {}) },
        finishers: payload.finishers,
        dropped: payload.dropped || [],
        handover: payload.handover || s.handover || null,
        endReason: payload.endReason,
        playerCount: payload.count ?? null,
      };
      if (payload.elapsedMs != null) fields.goAt = Date.now() - payload.elapsedMs;
      const inRoster = !payload.roster || payload.roster.includes(me);
      if (s.joined) {
        if (payload.phase === 'ended') fields.phase = 'ended';
        else if (payload.phase === 'live' || payload.phase === 'countdown') {
          if (inRoster) fields.phase = payload.elapsedMs >= 0 ? 'live' : 'countdown';
          else {
            // Joined a moment too late: the host started without us.
            fields.joined = false;
            fields.phase = 'invite';
            setPeek('started');
          }
        } else fields.phase = payload.phase;
      } else if (payload.phase === 'ended') setPeek('closed');
      else if (payload.phase !== 'lobby' && !inRoster) setPeek('started');
      else setPeek('ready');
      patch(fields);
      resendArrival();
    },
    [amHost, patch, send, stateFor, resendArrival]
  );

  // Take over refereeing (the host left or vanished). Everyone is told,
  // and the old host, if it was racing, counts as out unless it comes back.
  const becomeHost = useCallback(
    (fromId) => {
      const s = sessionRef.current;
      const me = myIdRef.current;
      const term = (s.hostTerm || 0) + 1;
      const racing = s.phase === 'live' || s.phase === 'countdown';
      const finished = (s.finishers || []).some((f) => f.id === fromId);
      const dropped = racing && fromId && !finished ? union(s.dropped, [fromId]) : s.dropped || [];
      const handover = { from: s.names?.[fromId] || s.hostName, to: myNameRef.current, at: Date.now() };
      patch({ hostId: me, hostName: myNameRef.current, hostTerm: term, dropped, handover });
      send('handover', { hostId: me, hostName: myNameRef.current, hostTerm: term, from: handover.from, dropped });
      send('state', stateFor());
      track('friends_handover', { reason: 'host_gone' });
      if (s.phase === 'live' && raceDone(s.roster, s.finishers, dropped)) endSession('done');
    },
    [patch, send, stateFor, endSession]
  );

  // ── The channel ─────────────────────────────────────────────────────
  // One per code (and per signed-in user, the presence key). Joining or
  // leaving the lobby only tracks/untracks presence on it — see below.
  useEffect(() => {
    if (!code) return undefined;
    // Private channels turn away signed-out visitors; they read the invite
    // from the public one below instead.
    if (PRIVATE && !myId) return undefined;
    // Without private channels a signed-out visitor reads the invite here,
    // but isn't in presence and can't join.
    const key = myId || `peek-${Math.random().toString(36).slice(2)}`;
    const close = openChannel(
      `friends:${code}`,
      { private: PRIVATE, broadcast: { self: false }, presence: { key } },
      (channel) => {
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
          if (amHost()) send('state', stateFor());
        });

        channel.on('broadcast', { event: 'hello' }, () => {
          if (amHost()) send('state', stateFor());
        });

        channel.on('broadcast', { event: 'state' }, ({ payload }) => applyState(payload));

        channel.on('broadcast', { event: 'start' }, ({ payload }) => {
          const s = sessionRef.current;
          if (!s) return;
          const me = myIdRef.current;
          if (!s.joined || (payload.roster && !payload.roster.includes(me))) {
            // Not in it (yet): the invite is closed to us now.
            patch({ mode: payload.mode, joined: false, phase: 'invite' });
            setPeek('started');
            return;
          }
          const now = Date.now();
          const common = { mode: payload.mode, roster: payload.roster, names: payload.names, finishers: [], dropped: [], handover: null };
          if (payload.mode === 'race') patch({ ...common, phase: 'countdown', goAt: now + payload.countdownMs });
          else patch({ ...common, phase: 'live', goAt: now });
        });

        channel.on('broadcast', { event: 'pos' }, ({ payload }) => {
          if (!payload?.id) return;
          setProgress((p) => ({ ...p, [payload.id]: { ...payload, at: Date.now() } }));
        });

        channel.on('broadcast', { event: 'arrived' }, ({ payload }) => {
          if (amHost() && payload?.id) recordFinish(payload.id);
        });

        // A racer tapped Leave.
        channel.on('broadcast', { event: 'left' }, ({ payload }) => {
          if (amHost() && payload?.id) dropPlayers([payload.id]);
        });

        channel.on('broadcast', { event: 'standings' }, ({ payload }) => {
          const s = sessionRef.current;
          if (!s || amHost() || (payload.hostTerm || 0) < (s.hostTerm || 0)) return;
          patch({ finishers: payload.finishers || [], dropped: payload.dropped || [] });
          resendArrival();
        });

        channel.on('broadcast', { event: 'handover' }, ({ payload }) => {
          const s = sessionRef.current;
          if (!s || (payload.hostTerm || 0) <= (s.hostTerm || 0)) return;
          patch({
            hostId: payload.hostId,
            hostName: payload.hostName,
            hostTerm: payload.hostTerm,
            dropped: payload.dropped ?? s.dropped ?? [],
            handover: { from: payload.from, to: payload.hostName, at: Date.now() },
          });
          if (!amHost()) {
            resendArrival();
            return;
          }
          // It's us now: bring everyone up to date and pick up the timers.
          send('state', stateFor());
          const now = sessionRef.current;
          if (now.phase === 'live' && raceDone(now.roster, now.finishers, now.dropped)) endSession('done');
        });

        channel.on('broadcast', { event: 'end' }, ({ payload }) => {
          const s = sessionRef.current;
          if (!s || s.phase === 'ended') return;
          if ((payload.hostTerm || 0) < (s.hostTerm || 0)) return;
          // The host ends everything else itself; a meetup either side can end.
          if (amHost() && payload.reason !== 'left') return;
          if (!s.joined) {
            setPeek('closed');
            return;
          }
          patch({
            phase: 'ended',
            endReason: payload.reason,
            endedBy: payload.by || null,
            finishers: payload.finishers || s.finishers,
            dropped: payload.dropped || s.dropped,
            names: { ...(s.names || {}), ...(payload.names || {}) },
            endedAt: Date.now(),
          });
        });

        channel.subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            setConnected(true);
            send('hello', {});
            if (amHost()) send('state', stateFor());
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            setConnected(false);
          }
        });
      }
    );
    return () => {
      close();
      channelRef.current = null;
      setConnected(false);
      setMembers([]);
    };
  }, [code, myId, patch, send, amHost, stateFor, applyState, recordFinish, dropPlayers, resendArrival, endSession]);

  // In the lobby (or racing) = in presence. Done on the open channel, so
  // joining never reconnects.
  useEffect(() => {
    const channel = channelRef.current;
    if (!connected || !channel || !myId) return;
    if (joined) {
      channel.track({ id: myId, name: myNameRef.current, joinedAt: sessionRef.current?.joinedAt || Date.now() });
    } else channel.untrack();
  }, [connected, joined, myId]);

  // Private channels only: the invite card a signed-out visitor sees, from
  // a public channel that carries nothing but who's inviting and where.
  const peeking = !!session && !joined && !myId;
  const inviteReplyRef = useRef(null);
  useEffect(() => {
    if (!PRIVATE || !code || (!isHost && !peeking)) return undefined;
    const close = openChannel(`friends-invite:${code}`, { broadcast: { self: false } }, (channel) => {
      const reply = () => {
        const st = stateFor();
        channel.send({
          type: 'broadcast',
          event: 'state',
          payload: {
            mode: st.mode,
            phase: st.phase,
            place: st.place,
            hostId: st.hostId,
            hostName: st.hostName,
            hostStats: st.hostStats,
            hostTerm: st.hostTerm,
            createdAt: st.createdAt,
            count: st.count,
            // Past the lobby the invite is closed to newcomers.
            roster: st.phase === 'lobby' ? null : [],
          },
        });
      };
      if (isHost) inviteReplyRef.current = reply;
      channel.on('broadcast', { event: 'hello' }, () => isHost && reply());
      channel.on('broadcast', { event: 'state' }, ({ payload }) => peeking && applyState(payload));
      channel.subscribe((status) => {
        if (status !== 'SUBSCRIBED') return;
        if (isHost) reply();
        else channel.send({ type: 'broadcast', event: 'hello', payload: {} });
      });
    });
    return () => {
      close();
      inviteReplyRef.current = null;
    };
  }, [code, isHost, peeking, stateFor, applyState]);
  // Signed-out viewers learn when the lobby starts, ends or fills.
  useEffect(() => {
    inviteReplyRef.current?.();
  }, [phase, members.length]);

  // A link (or typed code) with no host behind it never gets a reply.
  useEffect(() => {
    if (!code || joined || isHost || peek !== 'loading') return undefined;
    const t = setTimeout(() => setPeek(sessionRef.current?.fromCode ? 'notfound' : 'closed'), PEEK_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [code, joined, isHost, peek]);

  // Over capacity: the last to join is turned away.
  useEffect(() => {
    const s = sessionRef.current;
    if (!s?.joined || s.hostId === myId || s.phase !== 'lobby' || !myId) return;
    const index = members.findIndex((m) => m.id === myId);
    if (index >= CAPACITY[s.mode]) {
      setPeek('full');
      setSession({ ...s, joined: false, phase: 'invite' });
    }
  }, [members, myId, setSession]);

  // Host timers: the invite expires, a race has a time limit. A new host
  // picks these up from the same createdAt / goAt.
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

  // ── Race: a host who vanished is replaced ───────────────────────────
  const hostPresent = members.some((m) => m.id === session?.hostId);
  const meInPresence = members.some((m) => m.id === myId);
  const raceOpen = mode === 'race' && joined && (phase === 'lobby' || phase === 'countdown' || phase === 'live');
  useEffect(() => {
    // Our own presence entry means the list is in sync, so a missing host
    // really is missing (not just "not loaded yet").
    if (!raceOpen || isHost || !connected || !meInPresence || hostPresent) return undefined;
    const t = setTimeout(() => {
      const s = sessionRef.current;
      const present = presentIds();
      if (!s || present.has(s.hostId)) return;
      const order = s.roster || membersRef.current.map((m) => m.id);
      if (nextHost(order, present, s.hostId) === myIdRef.current) becomeHost(s.hostId);
    }, HOST_GONE_MS);
    return () => clearTimeout(t);
  }, [raceOpen, isHost, connected, meInPresence, hostPresent, becomeHost, presentIds]);

  // ── Race: the host drops racers who have been gone a while ──────────
  const absentSinceRef = useRef({});
  useEffect(() => {
    if (!isHost || mode !== 'race' || phase !== 'live') return undefined;
    const t = setInterval(() => {
      const s = sessionRef.current;
      const present = presentIds();
      const now = Date.now();
      const gone = [];
      (s.roster || []).forEach((id) => {
        const out = (s.finishers || []).some((f) => f.id === id) || (s.dropped || []).includes(id);
        if (id === myIdRef.current || present.has(id) || out) {
          delete absentSinceRef.current[id];
          return;
        }
        absentSinceRef.current[id] ??= now;
        if (now - absentSinceRef.current[id] >= DROP_AFTER_MS) gone.push(id);
      });
      if (gone.length) dropPlayers(gone);
    }, 10 * 1000);
    return () => clearInterval(t);
  }, [isHost, mode, phase, dropPlayers, presentIds]);

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
        if (amHost()) recordFinish(myId);
        else {
          // Remembered, so it's sent again if the host was away just now.
          if (!s.arrivedAt) patch({ arrivedAt: Date.now() });
          send('arrived', { id: myId });
        }
      }
      const now = Date.now();
      if (now - lastSentRef.current < SEND_EVERY_MS && !arrived) return;
      lastSentRef.current = now;
      send('pos', payload);
    };
    const last = getLastFix();
    if (last) onFix(last);
    return subscribeGps(onFix, () => {});
  }, [sharing, myId, send, amHost, recordFinish, patch]);

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
    async (newMode, place) => {
      if (!myId) return;
      const now = Date.now();
      setProgress({});
      setSession({
        mode: newMode,
        code: createCode(),
        joined: true,
        joinedAt: now,
        phase: 'lobby',
        place: place || null,
        hostId: myId,
        hostName: myName,
        hostTerm: 0,
        createdAt: now,
        names: { [myId]: myName },
        finishers: [],
        dropped: [],
      });
      track('friends_created', { mode: newMode, place: place?.name || null });
      const stats = await fetchProfileStats(supabase, myId).catch(() => null);
      if (stats?.status === 'ready' && sessionRef.current?.hostId === myId) {
        patch({ hostStats: { navs: stats.navs, reviews: stats.reviews } });
      }
    },
    [myId, myName, setSession, patch]
  );

  // `fromCode`: typed into the code box, so a dead one reads "no such code".
  const openInvite = useCallback(
    (invite, { fromCode = false } = {}) => {
      const s = sessionRef.current;
      if (s?.code === invite.code) return;
      setPeek('loading');
      setProgress({});
      setSession({ mode: invite.mode, code: invite.code, joined: false, phase: 'invite', names: {}, fromCode });
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
    if (!s || !amHost() || s.phase !== 'lobby') return;
    const roster = members.map((m) => m.id).slice(0, CAPACITY[s.mode]);
    if (!roster.includes(myId)) roster.unshift(myId);
    const names = { ...(s.names || {}) };
    const common = { roster, names, finishers: [], dropped: [], handover: null };
    if (s.mode === 'race') {
      patch({ ...common, phase: 'countdown', goAt: Date.now() + COUNTDOWN_MS });
      send('start', { mode: 'race', roster, names, countdownMs: COUNTDOWN_MS });
    } else {
      patch({ ...common, phase: 'live', goAt: Date.now() });
      send('start', { mode: 'meet', roster, names });
    }
    track('friends_started', { mode: s.mode, players: roster.length });
  }, [members, myId, amHost, patch, send]);

  // A meetup's lobby: meet at a place, or (null) just find each other.
  const setMeetPlace = useCallback(
    (place) => {
      const s = sessionRef.current;
      if (!s || !amHost() || s.mode !== 'meet' || s.phase !== 'lobby') return;
      patch({ place });
      send('state', stateFor());
    },
    [amHost, patch, send, stateFor]
  );

  // Meet me: where the route to the friend currently ends (kept across a
  // reload so the route keeps following them).
  const setFollow = useCallback((follow) => patch({ follow }), [patch]);

  // Leaving:
  //  - a meetup: either side ends it once going; the host cancels a lobby.
  //  - a race host hands refereeing to the next player still here; with
  //    nobody left it ends.
  //  - a racer drops out (counts as not finished).
  const leave = useCallback(() => {
    const s = sessionRef.current;
    const me = myIdRef.current;
    if (s?.joined && s.phase !== 'ended') {
      const racing = s.phase === 'live' || s.phase === 'countdown';
      if (s.mode === 'meet') {
        if (s.phase === 'live') {
          send('end', { reason: 'left', by: myNameRef.current, hostTerm: s.hostTerm || 0 });
          track('friends_ended', { mode: 'meet', reason: 'left', finishers: 0 });
        } else if (amHost()) endSession('cancelled');
      } else if (amHost()) {
        const next = nextHost(s.roster || membersRef.current.map((m) => m.id), presentIds(), me);
        if (next) {
          const finished = (s.finishers || []).some((f) => f.id === me);
          const dropped = racing && !finished ? union(s.dropped, [me]) : s.dropped || [];
          send('handover', {
            hostId: next,
            hostName: s.names?.[next] || 'Player',
            hostTerm: (s.hostTerm || 0) + 1,
            from: myNameRef.current,
            dropped,
          });
          track('friends_handover', { reason: 'host_left' });
        } else endSession(s.phase === 'lobby' ? 'cancelled' : 'host-left');
      } else if (racing) send('left', { id: me });
    }
    setSession(null);
    setProgress({});
    setMyFix(null);
  }, [amHost, endSession, setSession, send, presentIds]);

  return {
    session,
    members,
    progress,
    peek,
    connected,
    myId,
    myFix,
    isHost,
    otherId,
    meetDistance,
    meetArrived,
    create,
    openInvite,
    join,
    start,
    leave,
    setMeetPlace,
    setFollow,
  };
}
