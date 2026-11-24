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
  MapPin,
  MessageCircle,
  Navigation,
  RotateCcw,
  Share2,
  Smartphone,
  Trophy,
  UserPlus,
  Users,
  WifiOff,
  X,
} from 'lucide-react';
import styles from './Friends.module.css';
import { ChatStrip, ChatToast, UnreadBadge } from './FriendsChat';
import {
  CAPACITY,
  LOBBY_TTL_MS,
  MEET_MAX_DISTANCE_M,
  PAUSED_AFTER_MS,
  RACE_LIMIT_MS,
  SUGGESTED_USERNAMES,
  USERNAME_MAX_LENGTH,
  ago,
  firstName,
  formatClock,
  formatDistance,
  formatCodeInput,
  formatDuration,
  inviteUrl,
  normalizeCode,
  ordinal,
  sanitizeUsername,
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

// Track mobile visualViewport inset so bottom sheets and modals lift above the
// on-screen keyboard instead of hiding inputs beneath it.
function useKeyboardInset(active) {
  const [vp, setVp] = useState({ inset: 0, height: null, top: 0 });
  useEffect(() => {
    if (!active || typeof window === 'undefined' || !window.visualViewport) {
      setVp({ inset: 0, height: null, top: 0 });
      return undefined;
    }
    const vv = window.visualViewport;
    const update = () => {
      const inset = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
      setVp({ inset, height: Math.round(vv.height), top: Math.round(vv.offsetTop) });
    };
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [active]);
  return vp;
}

// Mobile: bottom sheet. Desktop, or `centered`: a modal card.
function Panel({ isMobile, centered, wide, label, onScrim, children }) {
  const asSheet = isMobile && !centered;
  const kb = useKeyboardInset(isMobile);
  const kbOpen = isMobile && kb.inset > 0;
  const scrollTimerRef = useRef(null);

  useEffect(() => () => clearTimeout(scrollTimerRef.current), []);

  useEffect(() => {
    if (!onScrim) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onScrim();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onScrim]);

  function handleFocusCapture(e) {
    if (!isMobile) return;
    const target = e.target;
    if (!target || (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA')) return;
    clearTimeout(scrollTimerRef.current);
    scrollTimerRef.current = setTimeout(() => {
      target.scrollIntoView?.({ block: 'nearest' });
    }, 120);
  }

  return (
    <>
      <div className={styles.scrim} onClick={onScrim} aria-hidden="true" />
      <section
        role="dialog"
        aria-modal="true"
        aria-label={label}
        data-kb={kbOpen ? 'open' : undefined}
        style={
          isMobile
            ? {
                '--kb-inset': `${kb.inset}px`,
                '--vv-top': `${kb.top}px`,
                ...(kb.height ? { '--vv-h': `${kb.height}px` } : {}),
              }
            : undefined
        }
        onFocusCapture={handleFocusCapture}
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

// Lightweight username picker (no sign-in required).
function UsernameField({ id, value, onChange, autoFocus = false }) {
  const inputRef = useRef(null);
  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);
  return (
    <div className={styles.col} style={{ gap: 8 }}>
      <label className={styles.overline} htmlFor={id}>
        Your username
      </label>
      <input
        id={id}
        ref={inputRef}
        className={styles.search}
        placeholder="e.g. Tolu, Ayo, Chidi"
        value={value}
        maxLength={USERNAME_MAX_LENGTH}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="nickname"
      />
      {!value.trim() && (
        <div className={styles.nameChips} aria-label="Suggested usernames">
          {SUGGESTED_USERNAMES.map((preset) => (
            <button key={preset} type="button" className={styles.nameChip} onClick={() => onChange(preset)}>
              {preset}
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
    </Panel>
  );
}

// ── 0 · Meet a friend: pick a username first (only when none saved) ──
export function MeetSetup({ isMobile, initialName = '', onCreate, onHaveCode, onClose }) {
  const [name, setName] = useState(initialName);
  const cleanName = sanitizeUsername(name);
  const maxKm = Math.round(MEET_MAX_DISTANCE_M / 1000);

  return (
    <Panel isMobile={isMobile} label="Meet a friend" onScrim={onClose}>
      <div className={styles.headRow}>
        <div className={styles.headText}>
          <span className={cx(styles.overline, styles.overlineViolet)}>Short distance · Within {maxKm} km</span>
          <h2 className={styles.title}>Meet a friend</h2>
          <p className={styles.sub}>Choose a username so your friend knows who’s on the map.</p>
        </div>
        <CloseBtn onClick={onClose} />
      </div>
      <form
        className={styles.col}
        onSubmit={(e) => {
          e.preventDefault();
          if (cleanName) onCreate(cleanName);
        }}
      >
        <UsernameField id="friends-meet-name" value={name} onChange={setName} autoFocus />
        <button type="submit" className={cx(styles.btn, styles.btnPrimary)} disabled={!cleanName}>
          <Link2 size={18} />
          Create meetup
        </button>
      </form>
      <button type="button" className={cx(styles.btn, styles.btnGhost)} onClick={onHaveCode}>
        <KeyRound size={16} />
        <span className={styles.btnLabel}>Have a code? Join a friend</span>
      </button>
    </Panel>
  );
}

// ── 1 · Race to a place: pick the finish line + username ─────────────
export function RaceSetup({ isMobile, place, initialName = '', onPlaceChange, searchIndex, onCreate, onHaveCode, onClose }) {
  const [editing, setEditing] = useState(!place);
  const [name, setName] = useState(initialName);
  const cleanName = sanitizeUsername(name);

  return (
    <Panel isMobile={isMobile} label="Race to a place" onScrim={onClose}>
      <div className={styles.headRow}>
        <div className={styles.headText}>
          <span className={cx(styles.overline, styles.overlineViolet)}>2–4 people</span>
          <h2 className={styles.title}>Race to a place</h2>
          <p className={styles.sub}>Pick a finish line and a username. First to arrive wins.</p>
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
      <form
        className={styles.col}
        onSubmit={(e) => {
          e.preventDefault();
          if (place && cleanName) onCreate(cleanName);
        }}
      >
        <UsernameField id="friends-race-name" value={name} onChange={setName} />
        <button type="submit" className={cx(styles.btn, styles.btnPrimary)} disabled={!place || !cleanName}>
          <Link2 size={18} />
          Create invite link
        </button>
      </form>
      <button type="button" className={cx(styles.btn, styles.btnGhost)} onClick={onHaveCode}>
        <KeyRound size={16} />
        <span className={styles.btnLabel}>Have a code? Join a friend’s race</span>
      </button>
    </Panel>
  );
}

// ── 2 · Lobby (host shares the link, guests wait) ────────────────────
function shareText(session) {
  const url = inviteUrl(session.mode, session.code);
  const intro = session.mode === 'race' ? `Race me to ${session.place?.name} on Maps By FUTA` : 'Meet me on Maps By FUTA';
  return `${intro}: ${url}\nOr open Nav › Join with a code: ${session.code}`;
}

export function Lobby({
  isMobile,
  session,
  members,
  progress,
  myId,
  isHost,
  now,
  notice,
  connected,
  everConnected,
  searchIndex,
  unreadCount = 0,
  hasMessages = false,
  onOpenChat,
  onMeetPlaceChange,
  onHaveCode,
  onStart,
  onLeave,
}) {
  const [copied, setCopied] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [pickingPlace, setPickingPlace] = useState(false);
  const copyTimerRef = useRef(null);
  const codeTimerRef = useRef(null);
  useEffect(
    () => () => {
      clearTimeout(copyTimerRef.current);
      clearTimeout(codeTimerRef.current);
    },
    []
  );
  const race = session.mode === 'race';
  const cap = CAPACITY[session.mode];
  const url = inviteUrl(session.mode, session.code);
  const hostFirst = firstName(session.hostName);
  const list = members.slice(0, cap);
  const canStart = list.length >= 2;
  const minsLeft = Math.max(1, Math.ceil((session.createdAt + LOBBY_TTL_MS - now) / 60000));
  const maxKm = Math.round(MEET_MAX_DISTANCE_M / 1000);
  const showShareCard = isHost && list.length < cap;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked: the code stays on screen to read out.
    }
  }
  function share() {
    if (navigator.share) navigator.share({ title: 'Maps By FUTA', text: shareText(session) }).catch(() => {});
    else copyLink();
  }
  async function copyCode() {
    try {
      await navigator.clipboard.writeText(session.code);
      setCodeCopied(true);
      clearTimeout(codeTimerRef.current);
      codeTimerRef.current = setTimeout(() => setCodeCopied(false), 2000);
    } catch {
      // The code is on screen to read out instead.
    }
  }

  // Single unified share card — hides automatically once the room is full.
  const shareCard = showShareCard && (
    <div className={styles.shareCard}>
      <div className={styles.shareCodeRow}>
        <div className={styles.headText} style={{ gap: 2 }}>
          <span className={styles.overline}>Invite code</span>
          <span className={styles.shareCode}>{session.code}</span>
        </div>
        <button type="button" className={cx(styles.btn, styles.btnOutline, styles.btnSmall)} onClick={copyCode}>
          {codeCopied ? <Check size={15} /> : <Copy size={15} />}
          {codeCopied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <div className={styles.col} style={{ gap: 8 }}>
        <button type="button" className={cx(styles.btn, styles.btnPrimary, styles.btnSmall)} onClick={share}>
          <Share2 size={16} />
          Share invite
        </button>
        <div className={styles.row} style={{ gap: 8 }}>
          <a
            className={cx(styles.btn, styles.btnSecondary, styles.btnSmall, styles.grow)}
            style={{ textDecoration: 'none' }}
            href={`https://wa.me/?text=${encodeURIComponent(shareText(session))}`}
            target="_blank"
            rel="noreferrer"
          >
            <MessageCircle size={16} />
            <span className={styles.btnLabel}>WhatsApp</span>
          </a>
          <button
            type="button"
            className={cx(styles.btn, styles.btnOutline, styles.btnSmall, styles.grow)}
            onClick={copyLink}
          >
            {copied ? <Check size={16} /> : <Link2 size={16} />}
            <span className={styles.btnLabel}>{copied ? 'Link copied' : 'Copy link'}</span>
          </button>
        </div>
      </div>
      <span className={styles.shareHint}>
        <Smartphone size={13} />
        Keep this open until everyone joins.
      </span>
    </div>
  );

  // The code is on screen either way, so say when nobody can reach it.
  const offline = !connected && (
    <div className={styles.notice} role="status">
      <WifiOff size={18} />
      {everConnected ? 'Reconnecting…' : 'Connecting…'}
      {isHost && everConnected ? ' Friends can’t join until this is back.' : ''}
    </div>
  );

  const detailsCard = (
    <div className={styles.lobbyCard}>
      {race && session.place && (
        <>
          <div className={styles.lobbyRow}>
            <span className={cx(styles.dotIcon, styles.dotIconTeal)} style={{ width: 32, height: 32 }}>
              <Flag size={15} />
            </span>
            <span className={styles.stripText}>
              <span className={styles.overline}>Finish line</span>
              <span className={styles.personName}>{session.place.name}</span>
            </span>
          </div>
          <div className={styles.divider} />
        </>
      )}

      <div className={styles.col} style={{ gap: 10 }}>
        <div className={styles.listHead}>
          <span className={styles.overline}>{race ? 'Players' : 'People'}</span>
          <span className={styles.num} style={{ fontSize: 12 }}>
            {list.length} / {cap}
          </span>
        </div>
        {list.map((m, i) => (
          <div key={m.id} className={styles.person}>
            <Avatar name={m.name} index={i} size="avatarSm" />
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
            <span className={styles.emptySlot} style={{ width: 34, height: 34 }}>
              <UserPlus size={15} />
            </span>
            <span className={styles.waiting}>
              {list.length >= 2
                ? `Waiting for up to ${cap - list.length} more (optional)`
                : `Waiting for friends to join (2–${cap} people)…`}
            </span>
          </div>
        )}
      </div>

      {!race && (
        <>
          <div className={styles.divider} />
          {pickingPlace ? (
            <PlacePicker
              id="friends-meet-place"
              label="Meeting point (optional)"
              searchIndex={searchIndex}
              onPick={(p) => {
                onMeetPlaceChange(p);
                setPickingPlace(false);
              }}
            />
          ) : (
            <div className={styles.lobbyRow}>
              <MapPin size={16} className={styles.lobbyRowIcon} />
              <span className={styles.stripText}>
                <span className={styles.overline}>Meeting point</span>
                <span className={styles.personName}>{session.place?.name || 'Anywhere · find each other'}</span>
              </span>
              {isHost &&
                (session.place ? (
                  <button type="button" className={styles.linkBtn} onClick={() => onMeetPlaceChange(null)}>
                    Clear
                  </button>
                ) : (
                  <button type="button" className={styles.linkBtn} onClick={() => setPickingPlace(true)}>
                    Set place
                  </button>
                ))}
            </div>
          )}
        </>
      )}
    </div>
  );

  const footer = isHost ? (
    canStart ? (
      <div className={styles.col} style={{ gap: 8 }}>
        <button type="button" className={cx(styles.btn, styles.btnPrimary)} onClick={onStart}>
          {race ? 'Start race' : 'Start sharing'}
        </button>
        <span className={styles.note}>
          {race
            ? 'Everyone gets a 3-second countdown.'
            : list.length === 2
              ? `You and ${firstName(list.find((m) => m.id !== myId)?.name)} will see each other live.`
              : `All ${list.length} of you will see each other live on the map.`}
        </span>
      </div>
    ) : !race ? (
      <button type="button" className={cx(styles.btn, styles.btnGhost)} onClick={onHaveCode}>
        <KeyRound size={16} />
        <span className={styles.btnLabel}>Have a friend’s code? Join theirs</span>
      </button>
    ) : null
  ) : (
    <div className={styles.col} style={{ gap: 8 }}>
      <span className={styles.note}>
        <Clock size={14} />
        Waiting for {hostFirst} to start.
      </span>
      <button type="button" className={cx(styles.btn, styles.btnOutline, styles.btnSmall)} onClick={onLeave}>
        Leave
      </button>
    </div>
  );

  const title = race ? 'Race lobby' : 'Meet me';
  const head = (
    <div className={styles.headRow}>
      <div className={styles.headText} style={{ gap: 3 }}>
        <h2 className={styles.title}>{title}</h2>
        <span className={styles.sub}>
          {race ? `2–${cap} players · ${minsLeft} min left` : `2–${cap} people · Within ${maxKm} km · ${minsLeft} min left`}
        </span>
      </div>
      <div className={styles.row} style={{ gap: 8, alignItems: 'center' }}>
        {(canStart || hasMessages || unreadCount > 0) && onOpenChat && (
          <button type="button" className={cx(styles.btn, styles.btnSecondary, styles.btnSmall)} onClick={onOpenChat}>
            <MessageCircle size={16} />
            Chat
            <UnreadBadge count={unreadCount} />
          </button>
        )}
        {isHost && <CloseBtn onClick={onLeave} label="Cancel" />}
      </div>
    </div>
  );

  if (!isMobile && showShareCard) {
    return (
      <Panel isMobile={false} wide label={title}>
        {head}
        {notice && <div className={styles.notice} role="status"><Users size={18} />{notice}</div>}
        {offline}
        <div className={styles.split}>
          <div className={styles.splitMain}>{shareCard}</div>
          <div className={styles.splitMain}>{detailsCard}</div>
        </div>
        {footer}
      </Panel>
    );
  }
  return (
    <Panel isMobile={isMobile} label={title}>
      {head}
      {notice && <div className={styles.notice} role="status"><Users size={18} />{notice}</div>}
      {offline}
      {shareCard}
      {detailsCard}
      {footer}
    </Panel>
  );
}

// ── 3/4 · Friend opens the link (no sign-in required) ────────────────
export function Invite({
  isMobile,
  session,
  peek,
  joining = false,
  joinError = null,
  connected = true,
  myId = null,
  initialName = '',
  members,
  myDistance,
  onJoin,
  onDecline,
}) {
  const [name, setName] = useState(initialName);
  const editedRef = useRef(false);
  const cleanName = sanitizeUsername(name);
  const race = session.mode === 'race';
  const hostFirst = firstName(session.hostName);
  const maxKm = Math.round(MEET_MAX_DISTANCE_M / 1000);
  const inProgress = session.hostPhase === 'live' || session.hostPhase === 'countdown';
  const cap = CAPACITY[session.mode];

  // Sync initialName only before the user has typed or cleared the field.
  useEffect(() => {
    if (!editedRef.current && initialName) setName(initialName);
  }, [initialName]);

  if (peek !== 'ready') {
    // `mode` is unknown until the host answers (a typed code).
    const what = session.mode === 'race' ? 'race' : session.mode === 'meet' ? 'meetup' : null;
    const copy = {
      loading: ['Looking for your friend…', 'Ask them to open Maps By FUTA. You can only join while the app is open on their phone.'],
      closed: ['This invite has ended', 'Ask your friend to send a new link or code.'],
      unreachable: [
        'Couldn’t reach the host',
        `${session.fromCode ? 'Check the code, and ask' : 'Ask'} your friend to open Maps By FUTA. We’ll keep trying while this screen is open.`,
      ],
      full: [what ? `This ${what} is full` : 'This is full', race ? `A race takes up to ${CAPACITY.race} people.` : `Meet me takes up to ${CAPACITY.meet} people.`],
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

  const dropped = new Set(session.dropped || []);
  const activeIds =
    inProgress && session.roster?.length
      ? race
        ? session.roster
        : session.roster.filter((id) => !dropped.has(id))
      : null;
  const alreadyInRoom = Boolean(myId && (activeIds ? activeIds.includes(myId) : members.some((m) => m.id === myId)));
  const peerNames = activeIds
    ? activeIds
        .filter((id) => id !== myId)
        .map((id) => firstName(session.names?.[id] || members.find((m) => m.id === id)?.name || 'Friend'))
    : members.filter((m) => m.id !== myId).map((m) => firstName(m.name));
  const activeCount = (activeIds ? activeIds.length : members.length) || session.playerCount || 1;
  const players = peerNames.join(', ');

  return (
    <Panel isMobile={isMobile} centered label={race ? `Join ${hostFirst}'s race` : `Meet ${hostFirst}`}>
      <div className={styles.person} style={{ gap: 14 }}>
        <Avatar name={session.hostName} />
        <div className={styles.headText}>
          <h2 className={styles.title} style={{ fontSize: 20 }}>
            {race ? `Join ${hostFirst}’s race` : `Meet ${hostFirst}`}
          </h2>
          <p className={styles.sub}>
            {inProgress
              ? race
                ? 'Race in progress · Join now'
                : `Short distance (within ${maxKm} km) · Live now`
              : race
                ? `Starts when ${hostFirst} taps Start`
                : `Short distance (within ${maxKm} km) · ${hostFirst} is waiting`}
          </p>
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
          <span className={styles.tableMeta} style={{ flex: 1 }}>
            {race ? 'Players' : 'People'}
            {cap ? ` (${activeCount}/${cap})` : ''}
          </span>
          <span className={styles.personName}>
            {alreadyInRoom
              ? `${players || hostFirst}${players ? ' + you' : ''}`
              : `${players || hostFirst} + you`}
          </span>
        </div>
      </div>
      <form
        className={styles.col}
        onSubmit={(e) => {
          e.preventDefault();
          if (cleanName && !joining) onJoin(cleanName);
        }}
      >
        <UsernameField
          id="friends-invite-name"
          value={name}
          onChange={(v) => {
            editedRef.current = true;
            setName(v);
          }}
          autoFocus={!initialName}
        />
        <div className={styles.notice}>
          <MapPin size={18} />
          {race
            ? 'The group sees how far you are from the finish, not where you are. We will ask for your location next.'
            : activeCount > 1
              ? `Everyone in this meetup sees each other’s live location until it ends. Works best within ${maxKm} km.`
              : `You and ${hostFirst} see each other’s live location until the meetup ends. Works best within ${maxKm} km.`}
        </div>
        {!connected && (
          <div className={styles.notice} role="status">
            <WifiOff size={18} />
            Reconnecting… you can join as soon as you’re back online.
          </div>
        )}
        {joinError && (
          <div className={styles.notice} role="status">
            <WifiOff size={18} />
            {joinError}
          </div>
        )}
        <div className={styles.row}>
          <button type="button" className={cx(styles.btn, styles.btnOutline, styles.grow)} onClick={onDecline}>
            Decline
          </button>
          <button type="submit" className={cx(styles.btn, styles.btnPrimary, styles.grow2)} disabled={!cleanName || joining}>
            {joining
              ? 'Joining…'
              : alreadyInRoom
                ? race
                  ? 'Rejoin race'
                  : 'Rejoin meetup'
                : race
                  ? 'Join race'
                  : 'Share my location'}
          </button>
        </div>
      </form>
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

// Minimise / expand, same as the Signal card: a chevron when full, a
// "Details" button when small.
function MinimiseBtn({ onClick }) {
  return (
    <button type="button" className={styles.iconBtn} aria-label="Minimise" onClick={onClick}>
      <ChevronDown size={18} />
    </button>
  );
}
function DetailsBtn({ onClick }) {
  return (
    <button type="button" className={styles.detailsBtn} aria-label="Show details" onClick={onClick}>
      Details
      <ChevronUp size={16} />
    </button>
  );
}

function LiveInviteStrip({ session, count }) {
  const [copiedKind, setCopiedKind] = useState(null);
  const timerRef = useRef(null);
  useEffect(() => () => clearTimeout(timerRef.current), []);

  const cap = session?.mode ? CAPACITY[session.mode] : null;
  if (!session?.code || !cap || count >= cap) return null;
  const spotsLeft = cap - count;

  function markCopied(kind) {
    setCopiedKind(kind);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setCopiedKind(null), 2000);
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(session.code);
      markCopied('code');
    } catch {
      // Clipboard blocked; the code stays visible in the strip.
    }
  }

  async function share() {
    const url = inviteUrl(session.mode, session.code);
    if (navigator.share) {
      navigator.share({ title: 'Maps By FUTA', text: shareText(session) }).catch(() => {});
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      markCopied('link');
    } catch {
      // Clipboard blocked; the code stays visible in the strip.
    }
  }

  return (
    <div className={styles.liveInvite}>
      <span className={styles.liveInviteIcon} aria-hidden="true">
        <UserPlus size={15} />
      </span>
      <span className={styles.liveInviteText}>
        <span className={styles.liveInviteLabel}>
          Invite · <span className={styles.liveInviteCount}>{count}/{cap}</span> · {spotsLeft} left
        </span>
        <span className={styles.liveInviteCode}>{session.code}</span>
      </span>
      <span className={styles.liveInviteActions}>
        <button type="button" className={styles.liveInviteBtn} onClick={copyCode} aria-label="Copy invite code">
          {copiedKind === 'code' ? <Check size={13} /> : <Copy size={13} />}
          {copiedKind === 'code' ? 'Copied' : 'Copy'}
        </button>
        <button type="button" className={styles.liveInviteBtn} onClick={share} aria-label="Share invite">
          {copiedKind === 'link' ? <Check size={13} /> : <Share2 size={13} />}
          {copiedKind === 'link' ? 'Link copied' : 'Share'}
        </button>
      </span>
      <span className="sr-only" aria-live="polite">
        {copiedKind === 'code' ? 'Invite code copied' : copiedKind === 'link' ? 'Invite link copied' : ''}
      </span>
    </div>
  );
}

export function RaceBoard({
  session,
  rows,
  now,
  navOpen,
  notice,
  minimized,
  unreadCount = 0,
  lastMessage = null,
  toastMessage = null,
  onOpenChat,
  onMinimizedChange,
  onDirections,
  onLeave,
}) {
  const me = rows.find((r) => r.me);
  const elapsed = session.goAt ? now - session.goAt : 0;
  const directions = !navOpen && !me?.finish && (
    <button type="button" className={cx(styles.btn, styles.btnPrimary, styles.btnSmall, minimized ? styles.grow : styles.grow2)} onClick={onDirections}>
      <Navigation size={16} />
      Directions
    </button>
  );
  const chatBtn = onOpenChat && (
    <button
      type="button"
      className={cx(styles.btn, styles.btnSecondary, styles.btnSmall, !directions && styles.grow)}
      style={{ flexShrink: 0 }}
      onClick={onOpenChat}
    >
      <MessageCircle size={16} />
      Chat
      <UnreadBadge count={unreadCount} />
    </button>
  );
  const noticeEl = notice && (
    <div className={styles.notice} role="status">
      <Users size={18} />
      {notice}
    </div>
  );

  if (minimized) {
    const summary = me?.finish
      ? `You finished ${ordinal(me.rank)} · ${formatClock(elapsed)}`
      : `You’re ${me ? ordinal(me.rank) : '—'} · ${formatDistance(me?.dist)} left · ${formatClock(elapsed)}`;
    return (
      <div className={styles.boardStack}>
        {onOpenChat && <ChatToast message={toastMessage} onOpen={onOpenChat} />}
        <section className={cx(styles.board, styles.boardMin)} aria-label="Live ranking">
          <div className={styles.boardHead}>
            <div className={styles.headText} style={{ gap: 2, minWidth: 0 }}>
              <span className={styles.boardTitle}>Race to {session.place?.name}</span>
              <span className={styles.rankVal} style={{ color: 'var(--v2-text)' }}>{summary}</span>
            </div>
            <DetailsBtn onClick={() => onMinimizedChange(false)} />
          </div>
          {noticeEl}
          {(directions || chatBtn) && (
            <div className={styles.row}>
              {directions}
              {chatBtn}
            </div>
          )}
        </section>
      </div>
    );
  }

  return (
    <div className={styles.boardStack}>
      <section className={styles.board} aria-label="Live ranking">
        <div className={styles.boardHead}>
          <div className={styles.headText} style={{ gap: 2 }}>
            <span className={styles.overline}>Live ranking</span>
            <span className={styles.boardTitle}>Race to {session.place?.name}</span>
          </div>
          <MinimiseBtn onClick={() => onMinimizedChange(true)} />
        </div>
        {noticeEl}
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
        <div className={styles.col} style={{ gap: 4 }}>
          {rows.map((row) => (
            <RankRow key={row.id} row={row} now={now} />
          ))}
        </div>
        {onOpenChat && <ChatStrip title="Race chat" lastMessage={lastMessage} unread={unreadCount} onOpen={onOpenChat} />}
        <LiveInviteStrip session={session} count={rows.length} />
        <div className={styles.row}>
          <button type="button" className={cx(styles.btn, styles.btnDanger, styles.btnSmall, styles.grow)} onClick={onLeave}>
            Leave
          </button>
          {directions}
        </div>
        <span className={styles.note} style={{ justifyContent: 'flex-start', textAlign: 'left' }}>
          <Smartphone size={14} />
          Keep the app open so the others see you moving.
        </span>
      </section>
    </div>
  );
}

// ── 7 · You arrived, others still racing ─────────────────────────────
export function Finished({ isMobile, session, rows, unreadCount = 0, onOpenChat, onWatch, onLeave }) {
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
      <div className={styles.col}>
        {onOpenChat && (
          <button type="button" className={cx(styles.btn, styles.btnSecondary, styles.btnSmall)} onClick={onOpenChat}>
            <MessageCircle size={16} />
            Race chat
            <UnreadBadge count={unreadCount} />
          </button>
        )}
        <div className={styles.row}>
          <button type="button" className={cx(styles.btn, styles.btnOutline, styles.grow)} onClick={onLeave}>
            Leave
          </button>
          <button type="button" className={cx(styles.btn, styles.btnPrimary, styles.grow2)} onClick={onWatch}>
            Watch the rest
          </button>
        </div>
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
export function MeetBoard({
  session,
  otherName,
  peers = [],
  distance,
  maxDistance = null,
  updatedAt,
  now,
  arrived,
  navOpen,
  notice,
  place,
  placeDistance,
  minimized,
  unreadCount = 0,
  lastMessage = null,
  toastMessage = null,
  onOpenChat,
  onMinimizedChange,
  onEnd,
  onShowBoth,
  onDirections,
  onDirectionsToPeer,
}) {
  const isGroup = peers.length > 1;
  const name = firstName(otherName);
  const locatedPeers = peers.filter((p) => p.at != null);
  const hasAnyFix = isGroup ? locatedPeers.length > 0 : Boolean(updatedAt);
  const paused = !arrived && (isGroup ? peers.every((p) => p.paused) : !updatedAt || now - updatedAt > PAUSED_AFTER_MS);
  const farDistance = maxDistance ?? distance;
  const tooFar = !arrived && farDistance != null && farDistance > MEET_MAX_DISTANCE_M;
  const maxKm = Math.round(MEET_MAX_DISTANCE_M / 1000);
  const totalPeople = peers.length + 1;

  const headline = isGroup
    ? arrived
      ? 'You’ve all met'
      : !hasAnyFix
        ? 'Waiting for locations'
        : distance != null
          ? `${totalPeople} people · ${formatDistance(distance)} nearest`
          : `${totalPeople} people meeting`
    : arrived
      ? `You’ve met ${name}`
      : !updatedAt
        ? `Waiting for ${name}’s location`
        : paused
          ? `${name}’s location paused`
          : `${name} is ${formatDistance(distance)} away`;

  const subline = arrived
    ? 'Everyone is within 30 m. The meetup ends in a minute.'
    : place
      ? `Meeting at ${place.name}${placeDistance != null ? ` · you’re ${formatDistance(placeDistance)} from it` : ''}`
      : !isGroup && paused && updatedAt
        ? `Last seen ${ago(now - updatedAt)} ago`
        : isGroup
          ? 'Tap any friend below for walking directions.'
          : 'Walk towards each other, or wait where you are.';

  const canDirect = !navOpen && !arrived;
  const pill = (
    <span className={cx(styles.pill, paused && styles.pillMuted)}>
      <span className={cx(styles.liveDot, paused && styles.liveDotMuted)} />
      {arrived ? 'Met' : paused ? 'Paused' : 'Live'}
    </span>
  );
  const directionsBtn = (grow) => (
    <button
      type="button"
      className={cx(styles.btn, styles.btnPrimary, styles.btnSmall, grow && styles.grow)}
      disabled={!place && !hasAnyFix}
      onClick={onDirections}
    >
      <Navigation size={16} />
      <span className={styles.btnLabel}>
        {place ? `Directions to ${place.name}` : isGroup ? 'Directions to nearest' : `Directions to ${name}`}
      </span>
    </button>
  );
  const showAllBtn = (grow) => (
    <button type="button" className={cx(styles.btn, styles.btnOutline, styles.btnSmall, grow && styles.grow)} disabled={!hasAnyFix} onClick={onShowBoth}>
      <LocateFixed size={16} />
      {isGroup ? 'Show all' : 'Show both'}
    </button>
  );
  const chatBtn = onOpenChat && (
    <button type="button" className={cx(styles.btn, styles.btnSecondary, styles.btnSmall)} style={{ flexShrink: 0 }} onClick={onOpenChat}>
      <MessageCircle size={16} />
      Chat
      <UnreadBadge count={unreadCount} />
    </button>
  );
  const noticeEl = notice && (
    <div className={styles.notice} role="status">
      <Users size={18} />
      {notice}
    </div>
  );

  if (minimized) {
    return (
      <div className={styles.boardStack}>
        {onOpenChat && <ChatToast message={toastMessage} onOpen={onOpenChat} />}
        <section className={cx(styles.board, styles.boardMin)} aria-label="Meetup">
          <div className={styles.person}>
            {isGroup ? (
              <span className={styles.dotIcon} style={{ width: 34, height: 34 }}>
                <Users size={16} />
              </span>
            ) : (
              <Avatar name={otherName} index={1} size="avatarSm" />
            )}
            <div className={styles.headText} style={{ gap: 2, flex: 1, minWidth: 0 }}>
              <span className={styles.boardTitle}>{headline}</span>
              {tooFar && <span className={styles.sub}>Best within {maxKm} km</span>}
            </div>
            {pill}
            <DetailsBtn onClick={() => onMinimizedChange(false)} />
          </div>
          {noticeEl}
          <div className={styles.row}>
            {canDirect ? directionsBtn(true) : showAllBtn(true)}
            {chatBtn}
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className={styles.boardStack}>
      <section className={styles.board} aria-label="Meetup">
        <div className={styles.person}>
          {isGroup ? (
            <span className={styles.dotIcon}>
              <Users size={18} />
            </span>
          ) : (
            <Avatar name={otherName} index={1} />
          )}
          <div className={styles.headText} style={{ gap: 2, flex: 1 }}>
            <span className={styles.boardTitle}>{headline}</span>
            <span className={styles.sub}>{subline}</span>
          </div>
          {pill}
          <MinimiseBtn onClick={() => onMinimizedChange(true)} />
        </div>
        {noticeEl}
        {isGroup ? (
          <div className={styles.meetPeerList}>
            {peers.map((peer) => (
              <div key={peer.id} className={styles.meetPeerRow}>
                <Avatar name={peer.name} index={peer.color} size="avatarSm" />
                <span className={styles.personText}>
                  <span className={styles.personName}>{firstName(peer.name)}</span>
                  <span className={styles.personMeta}>
                    {peer.at == null ? (
                      'Waiting for location'
                    ) : peer.paused ? (
                      <>
                        Paused · <span className={styles.meetPeerDist}>{ago(now - peer.at)}</span> ago
                      </>
                    ) : peer.distance == null ? (
                      'Live · waiting for your GPS'
                    ) : (
                      <>
                        <span className={styles.meetPeerDist}>{formatDistance(peer.distance)}</span> away ·{' '}
                        <span className={styles.meetPeerDist}>{walkMinutes(peer.distance)}</span>
                      </>
                    )}
                  </span>
                </span>
                {!place && !arrived && peer.lat != null && onDirectionsToPeer && (
                  <button
                    type="button"
                    className={styles.meetPeerBtn}
                    aria-label={`Directions to ${firstName(peer.name)}`}
                    onClick={() => onDirectionsToPeer(peer)}
                  >
                    <Navigation size={15} />
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
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
        )}
        {tooFar && (
          <div className={styles.notice} role="status">
            <MapPin size={18} />
            {isGroup
              ? `Someone is ${formatDistance(farDistance)} away. Meet me is designed for short distances (within ${maxKm} km around campus).`
              : `You’re ${formatDistance(farDistance)} apart. Meet me is designed for short distances (within ${maxKm} km around campus).`}
          </div>
        )}
        {onOpenChat && (
          <ChatStrip title={isGroup ? 'Group chat' : `Message ${name}`} lastMessage={lastMessage} unread={unreadCount} onOpen={onOpenChat} />
        )}
        {!arrived && <LiveInviteStrip session={session} count={totalPeople} />}
        {!isGroup && paused && updatedAt && (
          <div className={styles.notice}>
            <Clock size={18} />
            {name}’s app may be closed or their screen locked. Their pin updates again when they open Maps By FUTA.
          </div>
        )}
        <div className={styles.row}>
          <button type="button" className={cx(styles.btn, styles.btnDanger, styles.btnSmall, styles.grow)} onClick={onEnd}>
            {isGroup ? 'Leave meetup' : 'End meetup'}
          </button>
          {showAllBtn(true)}
        </div>
        {canDirect && directionsBtn(false)}
        <span className={styles.note} style={{ justifyContent: 'flex-start', textAlign: 'left' }}>
          <Smartphone size={14} />
          Keep this screen open so {isGroup ? 'everyone' : name} can see you.
        </span>
      </section>
    </div>
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
