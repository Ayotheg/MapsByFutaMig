import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import { useFriendsSession } from './useFriendsSession';
import { Countdown, Ended, Finished, Invite, Lobby, MeetBoard, RaceBoard, RaceSetup, Results } from './FriendsScreens';
import { PAUSED_AFTER_MS, distanceM, firstName } from './friendsSession';
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
  left: (_host, _race, by) => ['Meetup ended', `${firstName(by)} ended the meetup.`],
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
  onSignIn,
  onNavigateTo,
  onRetarget,
  onLayout,
  onModeChange,
  onIdle,
}) {
  const f = useFriendsSession(user);
  const { session, members, progress, peek, myId } = f;
  const [place, setPlace] = useState(() => asPlace(selectedPlace));

  // An invite link is opened once, then MapPage forgets it.
  useEffect(() => {
    if (!invite) return;
    f.openInvite(invite);
    onInviteHandled();
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
  const isHost = session?.role === 'host';
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
      };
    });
    list.sort((a, b) => {
      if (a.finish || b.finish) return (a.finish?.place ?? 99) - (b.finish?.place ?? 99);
      return (a.dist ?? Infinity) - (b.dist ?? Infinity);
    });
    return list.map((r, i) => ({ ...r, rank: r.finish ? r.finish.place : i + 1 }));
  }, [race, session, members, progress, myId, startDist, now]);

  const meFinished = race && (session?.finishers || []).some((fin) => fin.id === myId);
  const [watchingCode, setWatchingCode] = useState(null);

  // ── Trip: the racer heads to the finish once the countdown ends ────
  const launchedRef = useRef(null);
  useEffect(() => {
    if (!race || phase !== 'live' || !joined || meFinished || !session?.place) return;
    if (launchedRef.current === session.code) return;
    launchedRef.current = session.code;
    if (!navOpen) onNavigateTo(session.place);
  }, [race, phase, joined, meFinished, session?.place, session?.code, navOpen, onNavigateTo]);

  // ── Meetup pins ────────────────────────────────────────────────────
  const meetLive = mode === 'meet' && phase === 'live' && joined;
  const other = f.otherId ? progress[f.otherId] : null;
  const otherName = f.otherId ? session?.names?.[f.otherId] : null;
  const otherPaused = !other?.at || now - other.at > PAUSED_AFTER_MS;
  const pinsRef = useRef({ other: null, me: null });
  useEffect(() => {
    if (!map || !meetLive) return undefined;
    const pins = pinsRef.current;
    return () => {
      if (pins.other) map.removeLayer(pins.other);
      if (pins.me) map.removeLayer(pins.me);
      pins.other = null;
      pins.me = null;
    };
  }, [map, meetLive]);
  useEffect(() => {
    if (!map || !meetLive) return;
    const pins = pinsRef.current;
    if (other?.lat != null) {
      const html = `<div class="friends-pin-avatar">${initialOf(otherName)}</div>`;
      const icon = L.divIcon({ className: `friends-pin${otherPaused ? ' friends-pin-paused' : ''}`, html, iconSize: [44, 44], iconAnchor: [22, 22] });
      if (!pins.other) pins.other = L.marker([other.lat, other.lng], { icon, interactive: false, zIndexOffset: 900 }).addTo(map);
      else {
        pins.other.setLatLng([other.lat, other.lng]);
        pins.other.setIcon(icon);
      }
    }
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
  }, [map, meetLive, other?.lat, other?.lng, otherName, otherPaused, f.myFix, navActive]);

  // ── Meetup trip: the route follows the friend ──────────────────────
  // Walking to a person (not a place): when they've moved 30 m from where
  // the route ends, move the destination to them and plan again — at most
  // every 15 s so the route doesn't jump while they shuffle about.
  const followRef = useRef(null); // { lat, lng, at } the route currently ends at
  useEffect(() => {
    if (!navOpen) followRef.current = null;
  }, [navOpen]);
  const otherLat = other?.lat;
  const otherLng = other?.lng;
  useEffect(() => {
    const target = followRef.current;
    if (!meetLive || !navActive || !target || session?.place || otherLat == null) return;
    const here = { lat: otherLat, lng: otherLng };
    if (distanceM(target, here) < FOLLOW_MOVE_M || now - target.at < FOLLOW_EVERY_MS) return;
    followRef.current = { ...here, at: now };
    const name = firstName(otherName);
    onRetarget({ ...here, name: `${name}’s location`, type: 'friend' }, `${name} moved. Route updated.`);
  }, [meetLive, navActive, session?.place, otherLat, otherLng, otherName, onRetarget, now]);

  function meetDirections() {
    if (session.place) {
      onNavigateTo(session.place);
      return;
    }
    if (other?.lat == null) return;
    followRef.current = { lat: other.lat, lng: other.lng, at: Date.now() };
    onNavigateTo({ lat: other.lat, lng: other.lng, name: `${firstName(otherName)}’s location`, type: 'friend' });
  }

  function showBoth() {
    if (!map || other?.lat == null) return;
    const pts = [[other.lat, other.lng]];
    if (f.myFix) pts.push([f.myFix.lat, f.myFix.lng]);
    if (pts.length === 1) map.setView(pts[0], 18);
    else map.fitBounds(pts, { padding: [90, 90], maxZoom: 18 });
  }

  // ── Layout hints for MapPage ───────────────────────────────────────
  const tripShowing = navOpen && !navActive;
  // A place card, the mobile sheet or search covering the bottom takes over.
  const boardVisible = (phase === 'live' && joined && !tripShowing && !covered && (meetLive || race)) || false;
  // The race's finish screen / the meetup's "You've met" replace the trip's
  // own arrival banner.
  const quietArrival = joined && (race ? phase === 'live' || phase === 'countdown' : phase === 'live');
  useEffect(() => {
    onLayout({ board: boardVisible, quietArrival });
  }, [boardVisible, quietArrival, onLayout]);
  useEffect(() => () => onLayout({ board: false, quietArrival: false }), [onLayout]);

  // "Meet a friend" needs nothing picked: straight to its lobby and link.
  useEffect(() => {
    if (session || startMode !== 'meet') return;
    if (user) f.create('meet', null);
    else onSignIn('login', 'Sign in to meet a friend.');
    onStartModeChange(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, startMode, user]);

  // ── Screens ────────────────────────────────────────────────────────
  if (!session) {
    if (startMode !== 'race') return null;
    return (
      <RaceSetup
        isMobile={isMobile}
        place={place}
        onPlaceChange={setPlace}
        searchIndex={searchIndex}
        onClose={() => onStartModeChange(null)}
        onCreate={() => {
          if (!user) {
            onSignIn('login', 'Sign in to start a race.');
            return;
          }
          f.create('race', place);
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
        user={user}
        members={members}
        myDistance={myDistance}
        onSignIn={() => onSignIn('login', race ? `Sign in to join ${hostFirst}’s race.` : `Sign in to meet ${hostFirst}.`)}
        onCreateAccount={() => onSignIn('signup', race ? `Create an account to join ${hostFirst}’s race.` : `Create an account to meet ${hostFirst}.`)}
        onJoin={f.join}
        onDecline={f.leave}
      />
    );
  }

  if (phase === 'lobby') {
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
        onMeetPlaceChange={f.setMeetPlace}
        onStart={f.start}
        onLeave={f.leave}
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
      return (
        <Finished
          isMobile={isMobile}
          session={session}
          rows={rows}
          onWatch={() => setWatchingCode(session.code)}
          onLeave={f.leave}
        />
      );
    }
    if (!boardVisible) return null;
    return (
      <RaceBoard
        session={session}
        rows={rows}
        now={now}
        navOpen={navOpen}
        isHost={isHost}
        onDirections={() => onNavigateTo(session.place)}
        onLeave={() => {
          // eslint-disable-next-line no-alert
          if (confirm(isHost ? 'End the race for everyone?' : 'Leave the race?')) f.leave();
        }}
      />
    );
  }

  if (!boardVisible) return null;
  return (
    <MeetBoard
      otherName={otherName || (isHost ? 'Your friend' : session.hostName)}
      distance={f.meetDistance}
      updatedAt={other?.at || null}
      now={now}
      arrived={f.meetArrived}
      navOpen={navOpen}
      place={session.place}
      placeDistance={session.place ? distanceM(f.myFix, session.place) : null}
      onShowBoth={showBoth}
      onDirections={meetDirections}
      onEnd={() => {
        // eslint-disable-next-line no-alert
        if (confirm('End the meetup for both of you?')) f.leave();
      }}
    />
  );
}
