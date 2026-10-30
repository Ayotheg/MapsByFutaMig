import { useEffect, useRef, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  Flag,
  KeyRound,
  Link2,
  LocateFixed,
  Lock,
  LogIn,
  MapPin,
  MessageCircle,
  Navigation,
  RotateCcw,
  Share2,
  Smartphone,
  Trophy,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import styles from './Friends.module.css';
import {
  CAPACITY,
  LOBBY_TTL_MS,
  PAUSED_AFTER_MS,
  RACE_LIMIT_MS,
  ago,
  firstName,
  formatClock,
  formatDistance,
  formatCodeInput,
  formatDuration,
  inviteUrl,
  normalizeCode,
  ordinal,
  walkMinutes,
} from './friendsSession';

const cx = (...c) => c.filter(Boolean).join(' ');

export function Avatar({ name, index = 0, size }) {
  return (
    <span className={cx(styles.avatar, styles[`avatar${index % 4}`], size && styles[size])} aria-hidden="true">
      {(name || '?').trim().charAt(0)}
    </span>
  );
}

// Mobile: bottom sheet. Desktop, or `centered`: a modal card.
function Panel({ isMobile, centered, wide, label, onScrim, children }) {
  const asSheet = isMobile && !centered;
  return (
    <>
      <div className={styles.scrim} onClick={onScrim} aria-hidden="true" />
      <section
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className={asSheet ? styles.sheet : cx(styles.modal, wide && !isMobile && styles.modalWide)}
      >
        {asSheet && <div className={styles.handle} />}
        {children}
      </section>
    </>
  );
}

function CloseBtn({ onClick, label = 'Close' }) {
  return (
    <button type="button" className={styles.iconBtn} aria-label={label} onClick={onClick}>
      <X size={18} />
    </button>
  );
}

function PlaceStrip({ mode, name, action }) {
  const race = mode === 'race';
  return (
    <div className={cx(styles.strip, race ? styles.stripTeal : styles.stripViolet)}>
      <span className={cx(styles.dotIcon, race && styles.dotIconTeal)}>
        {race ? <Flag size={18} /> : <Navigation size={18} />}
      </span>
      <span className={styles.stripText}>
        <span className={cx(styles.overline, !race && styles.overlineViolet)}>{race ? 'Finish line' : 'Meeting point'}</span>
        <span className={styles.stripName}>{name}</span>
      </span>
      {action}
    </div>
  );
}

// Search a campus place (race finish line, meetup spot).
function PlacePicker({ id, label, searchIndex, onPick }) {
  const [query, setQuery] = useState('');
  const inputRef = useRef(null);
  const results = query.trim() ? searchIndex.query(query, 5).filter((r) => r.lat != null && r.lng != null) : [];
  useEffect(() => {
    inputRef.current?.focus();
  }, []);
  return (
    <div className={styles.col}>
      <label className={styles.overline} htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        ref={inputRef}
        className={styles.search}
        placeholder="Search a place, e.g. Senate Building"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoComplete="off"
      />
      {results.length > 0 && (
        <div className={styles.results}>
          {results.map((r) => (
            <button
              key={`${r.source || ''}-${r.id}`}
              type="button"
              className={styles.result}
              onClick={() => onPick({ lat: r.lat, lng: r.lng, name: r.name, id: r.id, type: r.type })}
            >
              <MapPin size={16} />
              {r.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Join with a code (instead of tapping the link) ──────────────────
export function JoinCode({ isMobile, onJoin, onClose }) {
  const [value, setValue] = useState('');
  const inputRef = useRef(null);
  const code = normalizeCode(value);
  useEffect(() => {
    inputRef.current?.focus();
  }, []);
  return (
    <Panel isMobile={isMobile} label="Join with a code" onScrim={onClose}>
      <div className={styles.headRow}>
        <div className={styles.headText}>
          <span className={cx(styles.overline, styles.overlineViolet)}>Meet me or race</span>
          <h2 className={styles.title}>Join with a code</h2>
          <p className={styles.sub}>Type the 6-character code your friend shared.</p>
        </div>
        <CloseBtn onClick={onClose} />
      </div>
      <form
        className={styles.col}
        onSubmit={(e) => {
          e.preventDefault();
          if (code) onJoin(code);
        }}
      >
        <label className={styles.overline} htmlFor="friends-code">
          Code
        </label>
        <input
          id="friends-code"
          ref={inputRef}
          className={cx(styles.search, styles.codeInput)}
          value={value}
          onChange={(e) => setValue(formatCodeInput(e.target.value))}
          placeholder="K7Q-29F"
          autoCapitalize="characters"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
        />
        <button type="submit" className={cx(styles.btn, styles.btnPrimary)} disabled={!code}>
          <KeyRound size={18} />
          Join
        </button>
      </form>
      <span className={styles.note}>
        <Lock size={14} />
        Everyone needs to be signed in to join.
      </span>
    </Panel>
  );
}

// ── 1 · Race to a place: pick the finish line ────────────────────────
export function RaceSetup({ isMobile, place, onPlaceChange, searchIndex, onCreate, onHaveCode, onClose }) {
  const [editing, setEditing] = useState(!place);

  return (
    <Panel isMobile={isMobile} label="Race to a place" onScrim={onClose}>
      <div className={styles.headRow}>
        <div className={styles.headText}>
          <span className={cx(styles.overline, styles.overlineViolet)}>2–4 people</span>
          <h2 className={styles.title}>Race to a place</h2>
          <p className={styles.sub}>Pick a place. Everyone heads there, and the first to arrive wins.</p>
        </div>
        <CloseBtn onClick={onClose} />
      </div>

      {!editing && place && (
        <PlaceStrip
          mode="race"
          name={place.name}
          action={
            <button type="button" className={styles.linkBtn} onClick={() => setEditing(true)}>
              Change
            </button>
          }
        />
      )}
      {editing && (
        <PlacePicker
          id="friends-finish"
          label="Finish line"
          searchIndex={searchIndex}
          onPick={(p) => {
            onPlaceChange(p);
            setEditing(false);
          }}
        />
      )}
      <div className={styles.col}>
        <button type="button" className={cx(styles.btn, styles.btnPrimary)} disabled={!place} onClick={onCreate}>
          <Link2 size={18} />
          Create invite link
        </button>
        <button type="button" className={cx(styles.btn, styles.btnGhost)} onClick={onHaveCode}>
          <KeyRound size={16} />
          Have a code? Join a friend’s race
        </button>
        <span className={styles.note}>
          <Lock size={14} />
          Everyone needs to be signed in to join.
        </span>
      </div>
    </Panel>
  );
}

// ── 2 · Lobby (host shares the link, guests wait) ────────────────────
function shareText(session) {
  const url = inviteUrl(session.mode, session.code);
  const intro = session.mode === 'race' ? `Race me to ${session.place?.name} on Maps By FUTA` : 'Meet me on Maps By FUTA';
  return `${intro}: ${url}\nOr open Nav › Join with a code: ${session.code}`;
}

export function Lobby({ isMobile, session, members, progress, myId, isHost, now, notice, searchIndex, onMeetPlaceChange, onHaveCode, onStart, onLeave }) {
  const [copied, setCopied] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [pickingPlace, setPickingPlace] = useState(false);
  const race = session.mode === 'race';
  const cap = CAPACITY[session.mode];
  const url = inviteUrl(session.mode, session.code);
  const hostFirst = firstName(session.hostName);
  const list = members.slice(0, cap);
  const canStart = list.length >= 2;
  const minsLeft = Math.max(1, Math.ceil((session.createdAt + LOBBY_TTL_MS - now) / 60000));

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked: the link stays on screen to copy by hand.
    }
  }
  function share() {
    if (navigator.share) navigator.share({ title: 'Maps By FUTA', text: shareText(session) }).catch(() => {});
    else copy();
  }
  async function copyCode() {
    try {
      await navigator.clipboard.writeText(session.code);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    } catch {
      // The code is on screen to read out instead.
    }
  }

  const linkBlock = isHost && (
    <div className={styles.col}>
      <span className={styles.overline}>Invite link</span>
      <div className={styles.linkBox}>
        <span className={styles.linkText}>{url.replace(/^https?:\/\//, '')}</span>
        <button type="button" className={cx(styles.btn, styles.btnOutline, styles.btnSmall)} onClick={copy}>
          {copied ? <Check size={16} /> : <Copy size={16} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <div className={styles.row}>
        <a
          className={cx(styles.btn, styles.btnSecondary, styles.grow)}
          style={{ height: 46, fontSize: 14, textDecoration: 'none' }}
          href={`https://wa.me/?text=${encodeURIComponent(shareText(session))}`}
          target="_blank"
          rel="noreferrer"
        >
          <MessageCircle size={18} />
          Share on WhatsApp
        </a>
        <button type="button" className={cx(styles.iconBtn, styles.btnOutline)} style={{ width: 46, height: 46 }} aria-label="More ways to share" onClick={share}>
          <Share2 size={18} />
        </button>
      </div>
      <button type="button" className={styles.codeBox} onClick={copyCode} aria-label={`Copy code ${session.code}`}>
        <span className={styles.overline}>{codeCopied ? 'Code copied' : 'Or share the code'}</span>
        <span className={styles.codeText}>{session.code}</span>
      </button>
      <span className={styles.sub}>The link and code stop working in {minsLeft} min, or once you start.</span>
    </div>
  );

  const players = (
    <div className={styles.col}>
      <div className={styles.listHead}>
        <span className={styles.overline}>{race ? 'Players' : 'People'}</span>
        <span className={styles.num} style={{ fontSize: 13 }}>
          {list.length} / {cap}
        </span>
      </div>
      {list.map((m, i) => (
        <div key={m.id} className={styles.person}>
          <Avatar name={m.name} index={i} />
          <span className={styles.personText}>
            <span className={styles.personName}>
              {firstName(m.name)}
              {m.id === myId ? ' (you)' : ''}
            </span>
            <span className={styles.personMeta}>
              {m.id === session.hostId ? (
                'Host'
              ) : (
                <>
                  <Check size={12} strokeWidth={2.5} /> Joined
                </>
              )}
            </span>
          </span>
          {race && <span className={styles.rankVal}>{formatDistance(progress[m.id]?.dist)}</span>}
        </div>
      ))}
      {list.length < cap && (
        <div className={styles.person}>
          <span className={styles.emptySlot}>
            <UserPlus size={18} />
          </span>
          <span className={styles.waiting}>
            {race
              ? `Waiting for up to ${cap - list.length} more${list.length >= 2 ? ' (optional)' : ''}`
              : 'Waiting for your friend to open the link'}
          </span>
        </div>
      )}
    </div>
  );

  // A meetup is "find each other" until the host picks a place.
  const meetAction =
    isHost &&
    !race &&
    (session.place ? (
      <button type="button" className={styles.linkBtn} onClick={() => onMeetPlaceChange(null)}>
        Remove
      </button>
    ) : (
      <button type="button" className={styles.linkBtn} onClick={() => setPickingPlace(true)}>
        Pick a place
      </button>
    ));
  const placeStrip =
    !race && pickingPlace ? (
      <PlacePicker
        id="friends-meet-place"
        label="Meet at"
        searchIndex={searchIndex}
        onPick={(p) => {
          onMeetPlaceChange(p);
          setPickingPlace(false);
        }}
      />
    ) : (
      <PlaceStrip
        mode={session.mode}
        name={session.place?.name || 'Find each other, live'}
        action={meetAction}
      />
    );

  const footer = isHost ? (
    <div className={styles.col}>
      <div className={styles.row}>
        <button type="button" className={cx(styles.btn, styles.btnDanger, styles.grow)} onClick={onLeave}>
          Cancel
        </button>
        <button type="button" className={cx(styles.btn, styles.btnPrimary, styles.grow2)} disabled={!canStart} onClick={onStart}>
          {race ? 'Start race' : 'Start sharing'}
        </button>
      </div>
      <span className={styles.note}>
        {!canStart
          ? 'You can start once someone joins.'
          : race
            ? 'Everyone gets a 3-second countdown.'
            : `You and ${firstName(list[1]?.name)} will see each other live until one of you ends it.`}
      </span>
      {/* "Meet a friend" opens this lobby straight away, so someone who
          was sent a code needs a way to the code box from here. */}
      {!race && list.length < 2 && (
        <button type="button" className={cx(styles.btn, styles.btnGhost)} onClick={onHaveCode}>
          <KeyRound size={16} />
          Have a friend’s code? Join theirs
        </button>
      )}
    </div>
  ) : (
    <div className={styles.col}>
      <span className={styles.note}>
        <Clock size={14} />
        Waiting for {hostFirst} to start.
      </span>
      <button type="button" className={cx(styles.btn, styles.btnOutline)} onClick={onLeave}>
        Leave
      </button>
    </div>
  );

  const title = race ? 'Race lobby' : 'Meet me';
  const head = (
    <div className={styles.headRow}>
      <div className={styles.headText}>
        <span className={cx(styles.overline, styles.overlineViolet)}>{race ? 'Race to a place' : 'Meet a friend'}</span>
        <h2 className={styles.title}>{title}</h2>
      </div>
    </div>
  );

  if (!isMobile) {
    return (
      <Panel isMobile={false} wide label={title}>
        {head}
        {notice && <div className={styles.notice} role="status"><Users size={18} />{notice}</div>}
        <div className={styles.split}>
          <div className={styles.splitMain}>
            {placeStrip}
            {linkBlock}
          </div>
          <div className={styles.splitSide}>{players}</div>
        </div>
        {footer}
      </Panel>
    );
  }
  return (
    <Panel isMobile label={title}>
      {head}
      {notice && <div className={styles.notice} role="status"><Users size={18} />{notice}</div>}
      {placeStrip}
      {linkBlock}
      {isHost && <div className={styles.divider} />}
      {players}
      {footer}
    </Panel>
  );
}

// ── 3/4 · Friend opens the link ──────────────────────────────────────
export function Invite({ isMobile, session, peek, user, members, myDistance, onSignIn, onCreateAccount, onJoin, onDecline }) {
  const race = session.mode === 'race';
  const hostFirst = firstName(session.hostName);

  if (peek !== 'ready') {
    // `mode` is unknown until the host answers (a typed code).
    const what = session.mode === 'race' ? 'race' : session.mode === 'meet' ? 'meetup' : null;
    const copy = {
      loading: ['Opening invite…', 'Connecting to your friend.'],
      closed: ['This invite has ended', 'Ask your friend to send a new link or code.'],
      notfound: ['No race or meetup with that code', 'Check the code with your friend. Codes stop working after 30 minutes.'],
      full: [what ? `This ${what} is full` : 'This is full', race ? 'A race takes up to 4 people.' : 'Meet me is for 2 people.'],
      started: [what ? `This ${what} already started` : 'This already started', 'Ask your friend to send a new link or code next time.'],
    }[peek] || ['Opening invite…', ''];
    return (
      <Panel isMobile={isMobile} centered label={copy[0]} onScrim={peek === 'loading' ? undefined : onDecline}>
        <div className={cx(styles.headText, styles.center)}>
          <h2 className={styles.title}>{copy[0]}</h2>
          <p className={styles.sub}>{copy[1]}</p>
        </div>
        <button type="button" className={cx(styles.btn, styles.btnOutline)} onClick={onDecline}>
          {peek === 'loading' ? 'Cancel' : 'Close'}
        </button>
      </Panel>
    );
  }

  const placeName = session.place?.name || `Find ${hostFirst}, live`;
  const count = session.playerCount ?? members.length;

  if (!user) {
    const stats = session.hostStats;
    return (
      <Panel isMobile={isMobile} centered label={`${hostFirst}'s invite`}>
        <div className={cx(styles.headText, styles.center)} style={{ gap: 10 }}>
          <Avatar name={session.hostName} size="avatarLg" />
          <div className={cx(styles.headText, styles.center)} style={{ gap: 2 }}>
            <h2 className={styles.title}>{session.hostName}</h2>
            {stats && (
              <span className={styles.modeCount}>
                {stats.navs} navigation{stats.navs === 1 ? '' : 's'} · {stats.reviews} review{stats.reviews === 1 ? '' : 's'}
              </span>
            )}
          </div>
          <p className={styles.body}>
            {race ? 'invited you to a race. First to arrive wins.' : 'wants to meet up. You’ll see each other live on the map.'}
          </p>
        </div>
        <PlaceStrip
          mode={session.mode}
          name={placeName}
          action={race && <span className={styles.rankVal}>{count}/{CAPACITY.race}</span>}
        />
        <div className={styles.notice}>
          <Lock size={18} />
          Sign in to join. Races and meetups are only for people with a Maps By FUTA account.
        </div>
        <div className={styles.col}>
          <button type="button" className={cx(styles.btn, styles.btnPrimary)} onClick={onSignIn}>
            <LogIn size={18} />
            Sign in to join
          </button>
          <button type="button" className={cx(styles.btn, styles.btnOutline)} onClick={onCreateAccount}>
            Create an account
          </button>
          <button type="button" className={cx(styles.btn, styles.btnGhost)} onClick={onDecline}>
            Not now
          </button>
        </div>
      </Panel>
    );
  }

  const players = members.map((m) => firstName(m.name)).join(', ');
  return (
    <Panel isMobile={isMobile} centered label={race ? `Join ${hostFirst}'s race` : `Meet ${hostFirst}`}>
      <span className={cx(styles.pill)} style={{ alignSelf: 'center' }}>
        <Check size={14} />
        Signed in as {firstName(user.user_metadata?.display_name || user.email)}
      </span>
      <div className={styles.person} style={{ gap: 14 }}>
        <Avatar name={session.hostName} />
        <div className={styles.headText}>
          <h2 className={styles.title} style={{ fontSize: 20 }}>
            {race ? `Join ${hostFirst}’s race` : `Meet ${hostFirst}`}
          </h2>
          <p className={styles.sub}>{race ? `Starts when ${hostFirst} taps Start` : `${hostFirst} is waiting for you`}</p>
        </div>
      </div>
      <div className={styles.table}>
        <div className={styles.tableRow}>
          <span className={styles.tableMeta} style={{ flex: 1 }}>{race ? 'Finish line' : 'Meeting point'}</span>
          <span className={styles.personName}>{session.place?.name || 'Find each other, live'}</span>
        </div>
        {myDistance != null && (
          <div className={styles.tableRow}>
            <span className={styles.tableMeta} style={{ flex: 1 }}>{race ? 'You are' : `${hostFirst} is`}</span>
            <span className={styles.rankVal}>{formatDistance(myDistance)} away</span>
          </div>
        )}
        <div className={styles.tableRow}>
          <span className={styles.tableMeta} style={{ flex: 1 }}>{race ? 'Players' : 'Sharing'}</span>
          <span className={styles.personName}>{race ? `${players || hostFirst} + you` : 'Both of you, live'}</span>
        </div>
      </div>
      <div className={styles.notice}>
        <MapPin size={18} />
        {race
          ? 'The group sees how far you are from the finish, not where you are. We will ask for your location next.'
          : `You and ${hostFirst} see each other’s live location until the meetup ends. We will ask for your location next.`}
      </div>
      <div className={styles.row}>
        <button type="button" className={cx(styles.btn, styles.btnOutline, styles.grow)} onClick={onDecline}>
          Decline
        </button>
        <button type="button" className={cx(styles.btn, styles.btnPrimary, styles.grow2)} onClick={onJoin}>
          {race ? 'Join race' : 'Share my location'}
        </button>
      </div>
    </Panel>
  );
}

// ── 5 · Countdown ────────────────────────────────────────────────────
export function Countdown({ session, now }) {
  const left = Math.ceil(((session.goAt || 0) - now) / 1000);
  const ids = session.roster || [];
  return (
    <>
      <div className={styles.scrim} aria-hidden="true" />
      <div className={styles.countWrap} role="status" aria-live="assertive">
        <div className={cx(styles.headText, styles.center)} style={{ gap: 6 }}>
          <span className={cx(styles.overline, styles.countLabel)}>Race to</span>
          <span className={styles.countTitle}>{session.place?.name}</span>
        </div>
        <div className={styles.count} key={left}>
          {left > 0 ? left : 'Go'}
        </div>
        <div className={cx(styles.headText, styles.center)} style={{ gap: 10 }}>
          <span className={styles.stack}>
            {ids.map((id, i) => (
              <Avatar key={id} name={session.names?.[id]} index={i} />
            ))}
          </span>
          <span className={styles.countMeta}>{ids.length} players · Get ready</span>
        </div>
      </div>
    </>
  );
}

// ── 6 · Racing: live ranking ─────────────────────────────────────────
function RankRow({ row, now }) {
  const pct = row.finish ? 100 : row.start && row.dist != null ? Math.round(Math.min(1, Math.max(0, 1 - row.dist / row.start)) * 100) : 0;
  const paused = !row.finish && (row.paused || row.dropped);
  return (
    <div className={cx(styles.rank, row.me && styles.rankMe)}>
      <span className={cx(styles.rankBadge, row.rank <= 2 && styles.rankBadgeTop)}>{row.rank}</span>
      <Avatar name={row.name} index={row.color} size="avatarSm" />
      <div className={styles.rankMain}>
        <div className={styles.rankTop}>
          <span className={styles.rankName}>{row.me ? 'You' : firstName(row.name)}</span>
          <span className={styles.rankVal}>{row.finish ? `Arrived · ${formatDuration(row.finish.ms)}` : `${formatDistance(row.dist)} left`}</span>
        </div>
        <div className={styles.bar}>
          <div className={cx(styles.barFill, paused && styles.barFillMuted)} style={{ width: `${pct}%` }} />
        </div>
        {row.dropped && !row.finish && <span className={styles.rankNote}>Left the race · finishes still count if they come back</span>}
        {paused && !row.dropped && row.at && <span className={styles.rankNote}>Paused · last update {ago(now - row.at)} ago</span>}
        {paused && !row.dropped && !row.at && <span className={styles.rankNote}>Waiting for their location</span>}
      </div>
    </div>
  );
}

export function RaceBoard({ session, rows, now, navOpen, notice, onDirections, onLeave }) {
  const [collapsed, setCollapsed] = useState(false);
  const me = rows.find((r) => r.me);
  const elapsed = session.goAt ? now - session.goAt : 0;
  return (
    <section className={cx(styles.board, collapsed && styles.boardCollapsed)} aria-label="Live ranking">
      <div className={styles.boardHead}>
        <div className={styles.headText} style={{ gap: 2 }}>
          <span className={styles.overline}>Live ranking</span>
          <span className={styles.boardTitle}>Race to {session.place?.name}</span>
        </div>
        <button type="button" className={styles.iconBtn} aria-label={collapsed ? 'Show everyone' : 'Show only me'} onClick={() => setCollapsed((v) => !v)}>
          {collapsed ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>
      </div>
      {notice && (
        <div className={styles.notice} role="status">
          <Users size={18} />
          {notice}
        </div>
      )}
      {!collapsed && (
        <div className={styles.boardStats}>
          <div className={styles.stat}>
            <span className={styles.overline}>Time</span>
            <span className={styles.statVal}>{formatClock(elapsed)}</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.overline}>You</span>
            <span className={styles.statVal}>{me ? ordinal(me.rank) : '—'}</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.overline}>Left</span>
            <span className={styles.statVal}>{me?.finish ? 'Done' : formatDistance(me?.dist)}</span>
          </div>
        </div>
      )}
      <div className={styles.col} style={{ gap: 4 }}>
        {rows.map((row) => (
          <RankRow key={row.id} row={row} now={now} />
        ))}
      </div>
      {!collapsed && (
        <div className={styles.row}>
          <button type="button" className={cx(styles.btn, styles.btnDanger, styles.btnSmall, styles.grow)} onClick={onLeave}>
            Leave
          </button>
          {!navOpen && !me?.finish && (
            <button type="button" className={cx(styles.btn, styles.btnPrimary, styles.btnSmall, styles.grow2)} onClick={onDirections}>
              <Navigation size={16} />
              Directions
            </button>
          )}
        </div>
      )}
      {!collapsed && (
        <span className={styles.note} style={{ justifyContent: 'flex-start', textAlign: 'left' }}>
          <Smartphone size={14} />
          Keep the app open so the others see you moving.
        </span>
      )}
    </section>
  );
}

// ── 7 · You arrived, others still racing ─────────────────────────────
export function Finished({ isMobile, session, rows, onWatch, onLeave }) {
  const me = rows.find((r) => r.me);
  return (
    <Panel isMobile={isMobile} centered label="You finished" onScrim={onWatch}>
      <div className={cx(styles.headText, styles.center)} style={{ gap: 12 }}>
        <span className={styles.ring}>
          <span className={styles.ringInner}>
            <Trophy size={24} />
          </span>
        </span>
        <div className={cx(styles.headText, styles.center)}>
          <span className={cx(styles.overline, styles.overlineViolet)}>You reached {session.place?.name}</span>
          <h2 className={cx(styles.title, styles.titleLg)}>You finished {me ? ordinal(me.rank) : ''}</h2>
          {me?.finish && <span className={styles.num} style={{ fontSize: 15, color: 'var(--v2-text)' }}>{formatDuration(me.finish.ms)}</span>}
        </div>
      </div>
      <div className={styles.table}>
        {rows.map((r) => (
          <div key={r.id} className={cx(styles.tableRow, r.me && styles.tableRowMe)}>
            <span className={cx(styles.rankBadge, r.finish && styles.rankBadgeTop, !r.finish && styles.rankBadgeOpen)}>{r.finish ? r.rank : ''}</span>
            <span className={styles.tableName}>{r.me ? 'You' : firstName(r.name)}</span>
            {r.finish ? (
              <span className={styles.rankVal}>{formatDuration(r.finish.ms)}</span>
            ) : (
              <span className={styles.tableMeta}>
                Racing · <span className={styles.rankVal}>{formatDistance(r.dist)}</span> left
              </span>
            )}
          </div>
        ))}
      </div>
      <p className={cx(styles.sub)} style={{ textAlign: 'center' }}>
        Final results show when everyone arrives, or after {Math.round(RACE_LIMIT_MS / 60000)} minutes.
      </p>
      <div className={styles.row}>
        <button type="button" className={cx(styles.btn, styles.btnOutline, styles.grow)} onClick={onLeave}>
          Leave
        </button>
        <button type="button" className={cx(styles.btn, styles.btnPrimary, styles.grow2)} onClick={onWatch}>
          Watch the rest
        </button>
      </div>
    </Panel>
  );
}

// ── 8 · Final ranking ────────────────────────────────────────────────
export function Results({ isMobile, session, rows, isHost, onDone, onRaceAgain }) {
  const finished = rows.filter((r) => r.finish);
  const rest = rows.filter((r) => !r.finish || r.rank > 3);
  const podium = [finished[1], finished[0], finished[2]];
  const minutes = session.goAt && session.endedAt ? Math.max(1, Math.round((session.endedAt - session.goAt) / 60000)) : null;
  return (
    <Panel isMobile={isMobile} label="Race results" onScrim={onDone}>
      <div className={styles.headRow}>
        <div className={styles.headText}>
          <span className={cx(styles.pill)} style={{ alignSelf: 'flex-start' }}>
            <Check size={14} />
            Race over
          </span>
          <h2 className={cx(styles.title, styles.titleLg)}>Race results</h2>
          <p className={styles.sub}>
            {session.place?.name} · <span className={styles.rankVal} style={{ color: 'inherit' }}>{rows.length} players{minutes ? ` · ${minutes} min` : ''}</span>
          </p>
        </div>
        <CloseBtn onClick={onDone} />
      </div>

      {finished.length > 0 && (
        <div className={styles.podium}>
          {podium.map((r, i) => {
            const place = [2, 1, 3][i];
            if (!r) return <div key={place} />;
            return (
              <div key={r.id} className={styles.podiumCol}>
                {place === 1 && <Trophy size={26} className={styles.trophy} />}
                <Avatar name={r.name} index={r.color} />
                <span className={styles.podiumName}>{r.me ? 'You' : firstName(r.name)}</span>
                <div className={cx(styles.step, styles[`step${place}`])}>
                  <span className={styles.stepPlace}>{place}</span>
                  <span className={styles.stepTime}>{formatDuration(r.finish.ms)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {rest.length > 0 && (
        <div className={styles.table}>
          {rest.map((r) => (
            <div key={r.id} className={cx(styles.tableRow, r.me && styles.tableRowMe)}>
              <span className={styles.rankVal} style={{ width: 22, textAlign: 'center', color: 'var(--v2-primary-hover)' }}>
                {r.finish ? r.rank : '—'}
              </span>
              <Avatar name={r.name} index={r.color} size="avatarSm" />
              <span className={styles.tableName}>{r.me ? 'You' : firstName(r.name)}</span>
              {r.finish ? <span className={styles.rankVal}>{formatDuration(r.finish.ms)}</span> : <span className={styles.tableMeta}>Did not finish</span>}
            </div>
          ))}
        </div>
      )}

      <div className={styles.col}>
        <span className={styles.note}>Results aren’t saved. Take a screenshot to keep them.</span>
        <div className={styles.row}>
          <button type="button" className={cx(styles.btn, styles.btnOutline, styles.grow)} onClick={onDone}>
            Done
          </button>
          {isHost && (
            <button type="button" className={cx(styles.btn, styles.btnPrimary, styles.grow2)} onClick={onRaceAgain}>
              <RotateCcw size={18} />
              Race again
            </button>
          )}
        </div>
      </div>
    </Panel>
  );
}

// ── 9/10 · Meet me, live (the same card on both phones) ──────────────
export function MeetBoard({ otherName, distance, updatedAt, now, arrived, navOpen, place, placeDistance, onEnd, onShowBoth, onDirections }) {
  const name = firstName(otherName);
  const paused = !arrived && (!updatedAt || now - updatedAt > PAUSED_AFTER_MS);
  const headline = arrived
    ? `You’ve met ${name}`
    : !updatedAt
      ? `Waiting for ${name}’s location`
      : paused
        ? `${name}’s location paused`
        : `${name} is ${formatDistance(distance)} away`;
  const subline = arrived
    ? 'You’re within 30 m of each other. The meetup ends in a minute.'
    : place
      ? `Meeting at ${place.name}${placeDistance != null ? ` · you’re ${formatDistance(placeDistance)} from it` : ''}`
      : paused && updatedAt
        ? `Last seen ${ago(now - updatedAt)} ago`
        : 'Walk towards each other, or wait where you are.';
  return (
    <section className={styles.board} aria-label="Meetup">
      <div className={styles.person}>
        <Avatar name={otherName} index={1} />
        <div className={styles.headText} style={{ gap: 2, flex: 1 }}>
          <span className={styles.boardTitle}>{headline}</span>
          <span className={styles.sub}>{subline}</span>
        </div>
        <span className={cx(styles.pill, paused && styles.pillMuted)}>
          <span className={cx(styles.liveDot, paused && styles.liveDotMuted)} />
          {arrived ? 'Met' : paused ? 'Paused' : 'Live'}
        </span>
      </div>
      <div className={styles.boardStats}>
        <div className={styles.stat}>
          <span className={styles.overline}>Apart</span>
          <span className={styles.statVal}>{formatDistance(distance)}</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.overline}>Walk</span>
          <span className={styles.statVal}>{arrived ? 'Now' : walkMinutes(place ? placeDistance : distance)}</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.overline}>Updated</span>
          <span className={styles.statVal}>{updatedAt ? ago(now - updatedAt) : '—'}</span>
        </div>
      </div>
      {paused && updatedAt && (
        <div className={styles.notice}>
          <Clock size={18} />
          {name}’s app may be closed or their screen locked. Their pin updates again when they open Maps By FUTA.
        </div>
      )}
      <div className={styles.row}>
        <button type="button" className={cx(styles.btn, styles.btnDanger, styles.btnSmall, styles.grow)} onClick={onEnd}>
          End meetup
        </button>
        <button type="button" className={cx(styles.btn, styles.btnSecondary, styles.btnSmall, styles.grow)} disabled={!updatedAt} onClick={onShowBoth}>
          <LocateFixed size={16} />
          Show both
        </button>
      </div>
      {!navOpen && !arrived && (
        <button type="button" className={cx(styles.btn, styles.btnPrimary, styles.btnSmall)} disabled={!place && !updatedAt} onClick={onDirections}>
          <Navigation size={16} />
          {place ? `Directions to ${place.name}` : `Directions to ${name}`}
        </button>
      )}
      <span className={styles.note} style={{ justifyContent: 'flex-start', textAlign: 'left' }}>
        <Smartphone size={14} />
        Keep this screen open so {name} can see you.
      </span>
    </section>
  );
}

// A meetup ended, or a race that never started.
export function Ended({ isMobile, title, message, onDone }) {
  return (
    <Panel isMobile={isMobile} centered label={title} onScrim={onDone}>
      <div className={cx(styles.headText, styles.center)}>
        <h2 className={styles.title}>{title}</h2>
        {message && <p className={styles.sub}>{message}</p>}
      </div>
      <button type="button" className={cx(styles.btn, styles.btnPrimary)} onClick={onDone}>
        Done
      </button>
    </Panel>
  );
}
