import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import { useFriendsSession } from './useFriendsSession';
import { Countdown, Ended, Finished, Invite, JoinCode, Lobby, MeetBoard, MeetSetup, RaceBoard, RaceSetup, Results } from './FriendsScreens';
import FriendsChat from './FriendsChat';
import { CAPACITY, PAUSED_AFTER_MS, countUnreadMessages, distanceM, firstName } from './friendsSession';
import { getLastFix } from '../navigation/gpsWatch';

function useNow(active, everyMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return undefined;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(t);
  }, [active, everyMs]);
  return now;
}

// Only real places (with coordinates) can be a finish line.
function asPlace(p) {
  if (!p || p.lat == null || p.lng == null || !p.name) return null;
  return { lat: Number(p.lat), lng: Number(p.lng), name: p.name, id: p.id, type: p.type };
}

const ENDED_COPY = {
  cancelled: (host, race) => [race ? 'Race cancelled' : 'Meetup cancelled', `${host} cancelled it before it started.`],
  expired: (_host, race) => ['This invite expired', `${race ? 'The race' : 'The meetup'} didn’t start within 30 minutes.`],
  'host-left': (host, race) => [race ? 'Race ended' : 'Meetup ended', `${host} ended it.`],
  met: () => ['You found each other', 'The meetup has ended.'],
  left: (_host, _race, by) => ['Meetup ended', by ? `${firstName(by)} ended the meetup.` : 'Everyone else left the meetup.'],
};

const FOLLOW_MOVE_M = 30;
const FOLLOW_EVERY_MS = 15 * 1000;

function initialOf(name) {
  const c = (name || '?').trim().charAt(0).toUpperCase();
  return /[A-Z0-9]/.test(c) ? c : '?';
}

/**
 * Meet me / Race to a place. Owns the session and decides which screen
 * shows; MapPage owns the trip itself (`onNavigateTo` seeds the normal
 * "Where to?" panel so the person's own tap starts voice and GPS).
 *
 * `onLayout({ board, quietArrival })`: `board` while the live card sits in
 * the nav distance card's slot (NavHud moves the distance up),
 * `quietArrival` while a race or meetup shows its own arrival screen
 * instead of the trip's banner. `onRetarget(dest, announcement)` moves a
 * running trip's destination (Meet me: the friend walked on).
 */
export default function FriendsHub({
  map,
  user,
  isMobile,
  searchIndex,
  selectedPlace,
  startMode,
  onStartModeChange,
  invite,
  onInviteHandled,
  navOpen,
  navActive,
  covered,
  onNavigateTo,
  onRetarget,
  onLayout,
  onModeChange,
  onEndTrip,
  onIdle,
}) {
  const f = useFriendsSession(user);
  const { session, members, progress, peek, myId } = f;
  const [place, setPlace] = useState(() => asPlace(selectedPlace));

  // An invite link is opened once, then MapPage forgets it.
  // Opening one while in another race or meetup asks first: leaving as the
  // host would otherwise strand the others.
  useEffect(() => {
    if (!invite) return;
    onInviteHandled();
    const s = session;
    const busy = s?.joined && s.phase !== 'ended' && s.code !== invite.code;
    if (busy) {
      const what = s.mode === 'race' ? 'race' : 'meetup';
      // eslint-disable-next-line no-alert
      if (!confirm(`Leave your current ${what} to open this invite?`)) return;
      f.leave();
    }
    f.openInvite(invite);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invite?.code]);

  // Nothing left to show: MapPage unmounts this.
  useEffect(() => {
    if (!session && !startMode && !invite) onIdle();
  }, [session, startMode, invite, onIdle]);

  // The Nav menu asked for a mode while one is already running: show that.
  useEffect(() => {
    if (session && startMode) onStartModeChange(null);
  }, [session, startMode, onStartModeChange]);

  const mode = session?.mode || null;
  const phase = session?.phase || null;
  const isHost = f.isHost;
  const joined = !!session?.joined;
  const race = mode === 'race';
  useEffect(() => onModeChange(joined && phase !== 'ended' ? mode : null), [joined, phase, mode, onModeChange]);

  const now = useNow(!!session && phase !== 'invite');

  // ── Race ranking ───────────────────────────────────────────────────
  const [startDist, setStartDist] = useState({});
  useEffect(() => setStartDist({}), [session?.code]);
  useEffect(() => {
    if (!race || (phase !== 'live' && phase !== 'countdown')) return;
    setStartDist((prev) => {
      let next = prev;
      Object.entries(progress).forEach(([id, p]) => {
        if (prev[id] == null && p.dist != null) next = { ...next, [id]: Math.max(p.dist, 1) };
      });
      return next;
    });
  }, [race, phase, progress]);

  const rows = useMemo(() => {
    if (!race || !session) return [];
    const ids = session.roster || members.map((m) => m.id);
    const order = new Map((session.finishers || []).map((fin, i) => [fin.id, { ...fin, place: i + 1 }]));
    const list = ids.map((id, color) => {
      const p = progress[id];
      return {
        id,
        color,
        name: session.names?.[id] || members.find((m) => m.id === id)?.name || 'Player',
        me: id === myId,
        finish: order.get(id) || null,
        dist: p?.dist ?? null,
        at: p?.at ?? null,
        start: startDist[id] ?? null,
        paused: !p?.at || now - p.at > PAUSED_AFTER_MS,
        // Left, or gone long enough to be counted out (Did not finish).
        dropped: !order.has(id) && (session.dropped || []).includes(id),
      };
    });
    list.sort((a, b) => {
      if (a.finish || b.finish) return (a.finish?.place ?? 99) - (b.finish?.place ?? 99);
      if (a.dropped !== b.dropped) return a.dropped ? 1 : -1;
      return (a.dist ?? Infinity) - (b.dist ?? Infinity);
    });
    return list.map((r, i) => ({ ...r, rank: r.finish ? r.finish.place : i + 1 }));
  }, [race, session, members, progress, myId, startDist, now]);

  const meFinished = race && (session?.finishers || []).some((fin) => fin.id === myId);
  const [watchingCode, setWatchingCode] = useState(null);
  // The live card, minimised like the Signal card; kept while it's briefly
  // hidden (place card, sheet), reset for a new race or meetup.
  const [boardMin, setBoardMin] = useState(true);
  useEffect(() => setBoardMin(true), [session?.code]);

  // ── Ephemeral in-session chat (Meet & Race) ────────────────────────
  const { messages, typingUsers } = f;
  const [chatOpen, setChatOpen] = useState(false);
  const [lastReadId, setLastReadId] = useState(null);
  const [toastMsg, setToastMsg] = useState(null);
  const lastSeenIdRef = useRef(null);
  const toastTimerRef = useRef(null);

  useEffect(() => {
    setChatOpen(false);
    setLastReadId(null);
    setToastMsg(null);
    lastSeenIdRef.current = null;
    clearTimeout(toastTimerRef.current);
  }, [session?.code]);

  useEffect(() => {
    if (!joined || phase === 'ended') {
      setChatOpen(false);
      setLastReadId(null);
      setToastMsg(null);
      lastSeenIdRef.current = null;
      clearTimeout(toastTimerRef.current);
    } else if (phase === 'countdown') {
      setChatOpen(false);
    }
  }, [joined, phase]);

  // Let the "You finished" celebration take focus instead of hiding behind chat.
  const prevFinishedRef = useRef(meFinished);
  useEffect(() => {
    if (meFinished && !prevFinishedRef.current) setChatOpen(false);
    prevFinishedRef.current = meFinished;
  }, [meFinished]);

  // Mark messages read while chat is open, or pop a brief toast on new incoming ones.
  useEffect(() => {
    const latest = messages.length ? messages[messages.length - 1] : null;
    if (!latest) {
      lastSeenIdRef.current = null;
      setToastMsg(null);
      return;
    }
    if (chatOpen) {
      setLastReadId(latest.id);
      lastSeenIdRef.current = latest.id;
      setToastMsg(null);
      clearTimeout(toastTimerRef.current);
      return;
    }
    if (latest.id !== lastSeenIdRef.current) {
      lastSeenIdRef.current = latest.id;
      if (latest.senderId !== myId) {
        setToastMsg(latest);
        clearTimeout(toastTimerRef.current);
        toastTimerRef.current = setTimeout(() => setToastMsg(null), 8000);
      }
    }
  }, [messages, chatOpen, myId]);

  useEffect(() => () => clearTimeout(toastTimerRef.current), []);

  const unreadCount = useMemo(
    () => (chatOpen ? 0 : countUnreadMessages(messages, lastReadId, myId)),
    [chatOpen, messages, lastReadId, myId]
  );

  const lastMessage = messages.length ? messages[messages.length - 1] : null;
  function openChat() {
    setChatOpen(true);
    setToastMsg(null);
    clearTimeout(toastTimerRef.current);
    if (messages.length) setLastReadId(messages[messages.length - 1].id);
  }

  // ── Trip: the racer heads to the finish once the countdown ends ────
  const launchedRef = useRef(null);
  useEffect(() => {
    if (!race || phase !== 'live' || !joined || meFinished || !session?.place) return;
    if (launchedRef.current === session.code) return;
    launchedRef.current = session.code;
    if (!navOpen) onNavigateTo(session.place);
  }, [race, phase, joined, meFinished, session?.place, session?.code, navOpen, onNavigateTo]);

  // ── Meetup pins (2+ people) ────────────────────────────────────────
  const meetLive = mode === 'meet' && phase === 'live' && joined;
  const meetPeers = useMemo(() => {
    if (mode !== 'meet' || !session) return [];
    return f.meetPeerIds.map((id, i) => {
      const p = progress[id] || null;
      const name = session.names?.[id] || members.find((m) => m.id === id)?.name || 'Friend';
      const at = p?.at || null;
      const paused = !at || now - at > PAUSED_AFTER_MS;
      return {
        id,
        color: i + 1,
        name,
        lat: p?.lat ?? null,
        lng: p?.lng ?? null,
        at,
        paused,
        distance: f.myFix && p?.lat != null ? distanceM(f.myFix, p) : null,
      };
    });
  }, [mode, session, f.meetPeerIds, f.myFix, progress, members, now]);
  const primaryPeer = meetPeers[0] || null;
  const other = primaryPeer ? progress[primaryPeer.id] : null;
  const otherName = primaryPeer?.name || null;
  const otherPaused = primaryPeer ? primaryPeer.paused : true;

  const pinsRef = useRef({ peers: new Map(), me: null });
  useEffect(() => {
    if (!map || !meetLive) return undefined;
    const pins = pinsRef.current;
    return () => {
      pins.peers.forEach((entry) => map.removeLayer(entry.marker));
      pins.peers.clear();
      if (pins.me) map.removeLayer(pins.me);
      pins.me = null;
    };
  }, [map, meetLive]);
  useEffect(() => {
    if (!map || !meetLive) return;
    const pins = pinsRef.current;
    const activeIds = new Set();
    meetPeers.forEach((peer) => {
      if (peer.lat == null) return;
      activeIds.add(peer.id);
      const initial = initialOf(peer.name);
      const colorCls = meetPeers.length > 1 ? ` friends-pin-c${peer.color % 4}` : '';
      const sig = `${initial}|${colorCls}|${peer.paused ? 1 : 0}`;
      const existing = pins.peers.get(peer.id);
      if (!existing) {
        const html = `<div class="friends-pin-avatar${colorCls}">${initial}</div>`;
        const icon = L.divIcon({
          className: `friends-pin${peer.paused ? ' friends-pin-paused' : ''}`,
          html,
          iconSize: [44, 44],
          iconAnchor: [22, 22],
        });
        const marker = L.marker([peer.lat, peer.lng], { icon, interactive: false, zIndexOffset: 900 }).addTo(map);
        pins.peers.set(peer.id, { marker, lat: peer.lat, lng: peer.lng, sig });
      } else {
        if (existing.lat !== peer.lat || existing.lng !== peer.lng) {
          existing.marker.setLatLng([peer.lat, peer.lng]);
          existing.lat = peer.lat;
          existing.lng = peer.lng;
        }
        if (existing.sig !== sig) {
          const html = `<div class="friends-pin-avatar${colorCls}">${initial}</div>`;
          const icon = L.divIcon({
            className: `friends-pin${peer.paused ? ' friends-pin-paused' : ''}`,
            html,
            iconSize: [44, 44],
            iconAnchor: [22, 22],
          });
          existing.marker.setIcon(icon);
          existing.sig = sig;
        }
      }
    });
    pins.peers.forEach((entry, id) => {
      if (!activeIds.has(id)) {
        map.removeLayer(entry.marker);
        pins.peers.delete(id);
      }
    });
    // During a trip the nav dot already shows where you are.
    if (f.myFix && !navActive) {
      if (!pins.me) {
        const icon = L.divIcon({ className: 'friends-me', iconSize: [20, 20], iconAnchor: [10, 10] });
        pins.me = L.marker([f.myFix.lat, f.myFix.lng], { icon, interactive: false, zIndexOffset: 800 }).addTo(map);
      } else pins.me.setLatLng([f.myFix.lat, f.myFix.lng]);
    } else if (pins.me) {
      map.removeLayer(pins.me);
      pins.me = null;
    }
  }, [map, meetLive, meetPeers, f.myFix, navActive]);

  // ── Meetup trip: the route follows the friend ──────────────────────
  // Walking to a person (not a place): when they've moved 30 m from where
  // the route ends, move the destination to them and plan again — at most
  // every 15 s so the route doesn't jump while they shuffle about.
  // `session.follow` ({ id, lat, lng, at }) is where the route ends; it's
  // saved with the session so a reload keeps following.
  const follow = session?.follow || null;
  const { setFollow } = f;
  useEffect(() => {
    if (!navOpen && follow) setFollow(null);
  }, [navOpen, follow, setFollow]);
  const followTarget = follow?.id ? meetPeers.find((p) => p.id === follow.id) || null : primaryPeer;
  useEffect(() => {
    if (meetLive && follow?.id && !followTarget) setFollow(null);
  }, [meetLive, follow?.id, followTarget, setFollow]);
  const targetLat = followTarget?.lat ?? null;
  const targetLng = followTarget?.lng ?? null;
  const targetName = followTarget?.name || null;
  const targetId = followTarget?.id || null;
  useEffect(() => {
    if (!meetLive || !navActive || !follow || session?.place || targetLat == null) return;
    const here = { lat: targetLat, lng: targetLng };
    if (distanceM(follow, here) < FOLLOW_MOVE_M || now - follow.at < FOLLOW_EVERY_MS) return;
    const name = firstName(targetName);
    // False when the trip now goes somewhere they chose themselves.
    const moved = onRetarget({ ...here, name: `${name}’s location`, type: 'friend' }, `${name} moved. Route updated.`);
    setFollow(moved ? { id: targetId, ...here, at: now } : null);
  }, [meetLive, navActive, follow, session?.place, targetLat, targetLng, targetName, targetId, onRetarget, setFollow, now]);

  function meetDirectionsTo(peer) {
    if (!peer || peer.lat == null) return;
    setFollow({ id: peer.id, lat: peer.lat, lng: peer.lng, at: Date.now() });
    onNavigateTo({ lat: peer.lat, lng: peer.lng, name: `${firstName(peer.name)}’s location`, type: 'friend' });
  }

  function meetDirections() {
    if (session.place) {
      onNavigateTo(session.place);
      return;
    }
    const located = meetPeers.filter((p) => p.lat != null);
    if (!located.length) return;
    const nearest = located.reduce((best, p) => ((p.distance ?? Infinity) < (best.distance ?? Infinity) ? p : best), located[0]);
    meetDirectionsTo(nearest);
  }

  // "Tolu left. Dami is now the host." for a few seconds after a handover.
  const handover = session?.handover;
  const notice =
    handover && now - handover.at < 10 * 1000
      ? isHost
        ? `${firstName(handover.from)} left. You’re now the host.`
        : `${firstName(handover.from)} left. ${firstName(handover.to)} is now the host.`
      : null;

  function showAll() {
    if (!map) return;
    const pts = [];
    meetPeers.forEach((p) => {
      if (p.lat != null) pts.push([p.lat, p.lng]);
    });
    if (f.myFix) pts.push([f.myFix.lat, f.myFix.lng]);
    if (session?.place) pts.push([session.place.lat, session.place.lng]);
    if (!pts.length) return;
    if (pts.length === 1) map.setView(pts[0], 18);
    else map.fitBounds(pts, { padding: [90, 90], maxZoom: 18 });
  }

  // ── Layout hints for MapPage ───────────────────────────────────────
  const tripShowing = navOpen && !navActive;
  // A place card, the mobile sheet or search covering the bottom takes over.
  const boardVisible = (phase === 'live' && joined && !tripShowing && !covered && (meetLive || race)) || false;
  useEffect(() => {
    if (phase === 'live' && (covered || tripShowing)) setChatOpen(false);
  }, [phase, covered, tripShowing]);
  // The race's finish screen / the meetup's "You've met" replace the trip's
  // own arrival banner.
  const quietArrival = joined && (race ? phase === 'live' || phase === 'countdown' : phase === 'live');
  useEffect(() => {
    onLayout({ board: boardVisible, quietArrival });
  }, [boardVisible, quietArrival, onLayout]);
  useEffect(() => () => onLayout({ board: false, quietArrival: false }), [onLayout]);

  // "Meet a friend": if we already have a username, open the lobby straight away;
  // otherwise MeetSetup below lets the user enter or pick one first.
  useEffect(() => {
    if (session || startMode !== 'meet' || !f.myName) return;
    f.create('meet', null);
    onStartModeChange(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, startMode, f.myName]);

  // The trip ends with the race or meetup (finished, ended by someone, or
  // left). Starts set from a reload that lands on an already-ended session.
  const tripRef = useRef(phase === 'ended' ? { place: session?.place || null } : null);
  useEffect(() => {
    if (joined && (phase === 'live' || phase === 'countdown')) {
      tripRef.current = { place: session?.place || null };
      return;
    }
    if (!tripRef.current) return;
    const { place: finish } = tripRef.current;
    tripRef.current = null;
    onEndTrip(finish);
  }, [joined, phase, session?.place, onEndTrip]);

  // ── Screens ────────────────────────────────────────────────────────
  if (!session) {
    if (startMode === 'code') {
      return (
        <JoinCode
          isMobile={isMobile}
          onClose={() => onStartModeChange(null)}
          onJoin={(code) => {
            // The host's reply says whether it's a race or a meetup.
            f.openInvite({ mode: null, code }, { fromCode: true });
            onStartModeChange(null);
          }}
        />
      );
    }
    if (startMode === 'meet') {
      if (f.myName) return null;
      return (
        <MeetSetup
          isMobile={isMobile}
          initialName={f.myName}
          onHaveCode={() => onStartModeChange('code')}
          onClose={() => onStartModeChange(null)}
          onCreate={(chosenName) => {
            f.create('meet', null, chosenName);
            onStartModeChange(null);
          }}
        />
      );
    }
    if (startMode !== 'race') return null;
    return (
      <RaceSetup
        isMobile={isMobile}
        place={place}
        initialName={f.myName}
        onPlaceChange={setPlace}
        searchIndex={searchIndex}
        onHaveCode={() => onStartModeChange('code')}
        onClose={() => onStartModeChange(null)}
        onCreate={(chosenName) => {
          f.create('race', place, chosenName);
          onStartModeChange(null);
        }}
      />
    );
  }

  const hostFirst = firstName(session.hostName);

  if (phase === 'invite') {
    const fix = getLastFix(5 * 60 * 1000);
    const here = fix ? { lat: fix.coords.latitude, lng: fix.coords.longitude } : null;
    const myDistance = race ? distanceM(here, session.place) : null;
    return (
      <Invite
        isMobile={isMobile}
        session={session}
        peek={peek}
        initialName={f.myName}
        members={members}
        myDistance={myDistance}
        onJoin={(chosenName) => f.join(chosenName)}
        onDecline={f.leave}
      />
    );
  }

  const resolvedOtherName = otherName || (isHost ? 'Your friend' : session.hostName);
  const placeDistance = session.place ? distanceM(f.myFix, session.place) : null;
  const activeMeetCount =
    mode === 'meet'
      ? phase === 'live'
        ? Math.max(meetPeers.length + 1, 2)
        : Math.min(Math.max(members.length, 2), CAPACITY.meet)
      : session.roster?.length || members.length || 2;
  const chatDrawer = chatOpen && (
    <FriendsChat
      isMobile={isMobile}
      mode={session.mode}
      myId={myId}
      otherName={resolvedOtherName}
      distance={f.meetDistance}
      maxDistance={f.meetMaxDistance}
      place={session.place}
      placeDistance={placeDistance}
      arrived={f.meetArrived}
      paused={phase === 'live' && meetPeers.length <= 1 && !f.meetArrived && Boolean(other?.at) && otherPaused}
      playerCount={activeMeetCount}
      connected={f.connected}
      messages={messages}
      typingUsers={typingUsers}
      onSend={f.sendMessage}
      onTyping={f.notifyTyping}
      onClose={() => setChatOpen(false)}
    />
  );

  if (phase === 'lobby') {
    if (chatOpen) return chatDrawer;
    return (
      <Lobby
        isMobile={isMobile}
        session={session}
        members={members}
        progress={progress}
        myId={myId}
        isHost={isHost}
        now={now}
        searchIndex={searchIndex}
        notice={notice}
        connected={f.connected}
        everConnected={f.everConnected}
        unreadCount={unreadCount}
        hasMessages={messages.length > 0}
        onOpenChat={openChat}
        onMeetPlaceChange={f.setMeetPlace}
        onHaveCode={() => {
          f.leave();
          onStartModeChange('code');
        }}
        onStart={f.start}
        onLeave={() => {
          if (isHost) {
            // eslint-disable-next-line no-alert
            if (!confirm(race ? 'Cancel this race and invalidate the invite code?' : 'Cancel this meetup and invalidate the invite code?')) return;
          }
          f.leave();
        }}
      />
    );
  }

  if (phase === 'countdown') return <Countdown session={session} now={now} />;

  if (phase === 'ended') {
    const reason = session.endReason;
    if (race && (reason === 'done' || reason === 'timeout' || (reason === 'host-left' && session.goAt))) {
      return (
        <Results
          isMobile={isMobile}
          session={session}
          rows={rows}
          isHost={isHost}
          onDone={f.leave}
          onRaceAgain={() => {
            const finish = session.place;
            f.leave();
            f.create('race', finish);
          }}
        />
      );
    }
    const [title, message] = (ENDED_COPY[reason] || ENDED_COPY['host-left'])(hostFirst, race, session.endedBy);
    return <Ended isMobile={isMobile} title={title} message={isHost && reason === 'expired' ? 'Nobody started it within 30 minutes.' : message} onDone={f.leave} />;
  }

  // phase === 'live'
  if (race) {
    if (meFinished && watchingCode !== session.code) {
      if (chatOpen) return chatDrawer;
      return (
        <Finished
          isMobile={isMobile}
          session={session}
          rows={rows}
          unreadCount={unreadCount}
          onOpenChat={openChat}
          onWatch={() => setWatchingCode(session.code)}
          onLeave={f.leave}
        />
      );
    }
    if (!boardVisible) return null;
    if (chatOpen) return chatDrawer;
    return (
      <RaceBoard
        session={session}
        rows={rows}
        now={now}
        navOpen={navOpen}
        isHost={isHost}
        notice={notice}
        minimized={boardMin}
        unreadCount={unreadCount}
        lastMessage={lastMessage}
        toastMessage={toastMsg}
        onOpenChat={openChat}
        onMinimizedChange={setBoardMin}
        onDirections={() => onNavigateTo(session.place)}
        onLeave={() => {
          // eslint-disable-next-line no-alert
          if (confirm(isHost ? 'Leave the race? The next player takes over as host.' : 'Leave the race?')) f.leave();
        }}
      />
    );
  }

  if (!boardVisible) return null;
  if (chatOpen) return chatDrawer;
  const isGroupMeet = meetPeers.length > 1;
  return (
    <MeetBoard
      otherName={resolvedOtherName}
      peers={meetPeers}
      distance={f.meetDistance}
      maxDistance={f.meetMaxDistance}
      updatedAt={other?.at || null}
      now={now}
      arrived={f.meetArrived}
      navOpen={navOpen}
      notice={notice}
      place={session.place}
      placeDistance={placeDistance}
      minimized={boardMin}
      unreadCount={unreadCount}
      lastMessage={lastMessage}
      toastMessage={toastMsg}
      onOpenChat={openChat}
      onMinimizedChange={setBoardMin}
      onShowBoth={showAll}
      onDirections={meetDirections}
      onDirectionsToPeer={meetDirectionsTo}
      onEnd={() => {
        // eslint-disable-next-line no-alert
        const msg = isGroupMeet
          ? isHost
            ? 'Leave the meetup? The next person takes over as host.'
            : 'Leave the meetup? The others stay connected.'
          : 'End the meetup for both of you?';
        if (confirm(msg)) f.leave();
      }}
    />
  );
}
