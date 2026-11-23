import { useEffect, useRef, useState } from 'react';
import {
  Check,
  Clock,
  Flag,
  Lock,
  Map as MapIcon,
  MapPin,
  MessageCircle,
  Send,
  WifiOff,
} from 'lucide-react';
import styles from './Friends.module.css';
import {
  CHAT_MAX_LENGTH,
  CHAT_QUICK_REPLIES,
  firstName,
  formatDistance,
  formatMessageTime,
  walkMinutes,
} from './friendsSession';

const cx = (...c) => c.filter(Boolean).join(' ');

function ChatAvatar({ name, size }) {
  return (
    <span className={cx(styles.avatar, styles.avatar1, size && styles[size])} aria-hidden="true">
      {(name || '?').trim().charAt(0)}
    </span>
  );
}

export function UnreadBadge({ count }) {
  if (!count || count <= 0) return null;
  return (
    <span className={styles.unreadBadge} aria-label={`${count} unread`}>
      {count > 9 ? '9+' : count}
    </span>
  );
}

// Tappable incoming message preview that peeks above a minimised live board.
export function ChatToast({ message, onOpen }) {
  if (!message) return null;
  const sender = firstName(message.senderName);
  return (
    <button type="button" className={styles.chatToast} onClick={onOpen}>
      <ChatAvatar name={message.senderName} size="avatarSm" />
      <span className={styles.chatToastBody}>
        <span className={styles.chatToastTop}>
          <span className={styles.chatToastName}>{sender}</span>
          <span className={styles.chatToastReply}>Reply</span>
        </span>
        <span className={styles.chatToastText}>{message.text}</span>
      </span>
    </button>
  );
}

// Compact chat entry strip inside an expanded MeetBoard or RaceBoard.
export function ChatStrip({ title, lastMessage, unread, onOpen }) {
  const preview = lastMessage
    ? `${firstName(lastMessage.senderName)}: ${lastMessage.text}`
    : 'Send a quick message without leaving the map';
  return (
    <button type="button" className={styles.chatStrip} onClick={onOpen}>
      <span className={styles.chatStripIcon} aria-hidden="true">
        <MessageCircle size={16} />
      </span>
      <span className={styles.chatStripText}>
        <span className={styles.chatStripTitleRow}>
          <span className={styles.chatStripTitle}>{title}</span>
          <UnreadBadge count={unread} />
        </span>
        <span className={styles.chatStripSub}>{preview}</span>
      </span>
      <span className={styles.chatStripAction}>Open</span>
    </button>
  );
}

/**
 * Ephemeral in-session chat for Meet me and Race to a place.
 * Mobile: bottom sheet with the live map visible above.
 * Desktop: floating bottom-left panel matching MeetBoard / RaceBoard.
 */
export default function FriendsChat({
  isMobile,
  mode,
  myId,
  otherName,
  distance,
  place,
  placeDistance,
  arrived,
  paused,
  playerCount,
  connected,
  messages,
  typingUsers,
  onSend,
  onTyping,
  onClose,
}) {
  const [draft, setDraft] = useState('');
  const [kbInset, setKbInset] = useState({ bottom: 0, tight: false });
  const dialogRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const nearBottomRef = useRef(true);
  const typingTimerRef = useRef(null);

  const race = mode === 'race';
  const friendFirst = firstName(otherName);
  const quickReplies = CHAT_QUICK_REPLIES[race ? 'race' : 'meet'];
  const canSend = connected && draft.trim().length > 0;
  const lastMsg = messages.length ? messages[messages.length - 1] : null;
  const lastMsgId = lastMsg?.id || null;

  // Move focus into the dialog on mount and restore it when closed.
  useEffect(() => {
    const prev = document.activeElement;
    if (isMobile) dialogRef.current?.focus({ preventScroll: true });
    else inputRef.current?.focus({ preventScroll: true });
    return () => {
      if (prev && typeof prev.focus === 'function' && document.contains(prev)) {
        prev.focus({ preventScroll: true });
      }
    };
  }, [isMobile]);

  // Adapt mobile sheet height/bottom offset when the virtual keyboard opens.
  useEffect(() => {
    if (!isMobile || typeof window === 'undefined' || !window.visualViewport) return undefined;
    const vv = window.visualViewport;
    const update = () => {
      const bottom = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
      setKbInset({ bottom, tight: vv.height < 420 });
    };
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, [isMobile]);

  // Auto-scroll to newest message (works past CHAT_MAX_MESSAGES cap) when near bottom or sending.
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    if (nearBottomRef.current || lastMsg?.senderId === myId) {
      el.scrollTop = el.scrollHeight;
    }
  }, [lastMsgId, lastMsg?.senderId, myId, typingUsers.length]);

  // Escape closes chat back to the map without dismissing anything underneath.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Clear outgoing typing status on unmount.
  useEffect(
    () => () => {
      clearTimeout(typingTimerRef.current);
      onTyping(false);
    },
    [onTyping]
  );

  function handleListScroll() {
    const el = listRef.current;
    if (!el) return;
    nearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 64;
  }

  function handleInputChange(value) {
    setDraft(value);
    clearTimeout(typingTimerRef.current);
    if (value.trim()) {
      onTyping(true);
      typingTimerRef.current = setTimeout(() => onTyping(false), 2500);
    } else {
      onTyping(false);
    }
  }

  function handleInputBlur() {
    clearTimeout(typingTimerRef.current);
    onTyping(false);
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!canSend) return;
    nearBottomRef.current = true;
    if (onSend(draft, { quick: false })) {
      setDraft('');
      clearTimeout(typingTimerRef.current);
    }
  }

  function handleQuick(text) {
    if (!connected) return;
    nearBottomRef.current = true;
    onSend(text, { quick: true });
  }

  // Header status pill & subtitle
  const statusPill = race ? (
    <span className={styles.pill}>
      <span className={styles.liveDot} />
      <span>
        <span className={styles.num} style={{ fontSize: 12 }}>
          {playerCount}
        </span>{' '}
        players
      </span>
    </span>
  ) : (
    <span className={cx(styles.pill, paused && styles.pillMuted)}>
      <span className={cx(styles.liveDot, paused && styles.liveDotMuted)} />
      {arrived ? (
        'Met'
      ) : paused ? (
        'Paused'
      ) : distance != null ? (
        <span>
          Live ·{' '}
          <span className={styles.num} style={{ fontSize: 12 }}>
            {formatDistance(distance)}
          </span>
        </span>
      ) : (
        'Live'
      )}
    </span>
  );

  const subText = race
    ? place?.name
      ? `Race to ${place.name}`
      : 'Group race chat'
    : place?.name
      ? `${place.name} · ${walkMinutes(placeDistance ?? distance)} walk`
      : distance != null
        ? `${walkMinutes(distance)} walk apart`
        : 'Find each other, live';

  const typingText =
    typingUsers.length === 1
      ? `${firstName(typingUsers[0].name)} is typing`
      : typingUsers.length > 1
        ? `${typingUsers.length} people typing`
        : '';

  const emptySub = race
    ? 'Coordinate with your group right here so everyone’s live race tracking stays active. Messages clear when the race ends.'
    : 'Coordinate right here so your live GPS pin stays active. Messages disappear automatically when the meetup ends.';

  const mobileSheetStyle =
    isMobile && (kbInset.bottom > 0 || kbInset.tight)
      ? {
          bottom: kbInset.bottom,
          height: kbInset.tight ? '100dvh' : `min(74dvh, calc(100dvh - ${kbInset.bottom}px - 48px))`,
          maxHeight: `calc(100dvh - ${kbInset.bottom}px)`,
        }
      : undefined;

  const content = (
    <section
      ref={dialogRef}
      tabIndex={-1}
      role="dialog"
      aria-modal={isMobile ? 'true' : undefined}
      aria-label={race ? 'Race chat' : `Chat with ${friendFirst}`}
      className={isMobile ? styles.chatSheet : styles.chatPanel}
      style={mobileSheetStyle}
    >
      {isMobile && (
        <div className={styles.chatHandleWrap}>
          <div className={styles.handle} />
        </div>
      )}

      <div className={styles.chatHead}>
        {race ? (
          <span className={cx(styles.dotIcon, styles.dotIconTeal)} aria-hidden="true">
            <Flag size={18} />
          </span>
        ) : (
          <ChatAvatar name={otherName} />
        )}
        <div className={styles.chatHeadMain}>
          <div className={styles.chatHeadTop}>
            <span className={styles.chatHeadTitle}>{race ? 'Race chat' : friendFirst}</span>
            {statusPill}
          </div>
          <span className={styles.chatHeadSub}>
            <MapPin size={13} />
            {subText}
          </span>
        </div>
        <button type="button" className={styles.chatMapBtn} onClick={onClose} aria-label="Back to map">
          <MapIcon size={15} />
          Map
        </button>
      </div>

      {!connected ? (
        <div className={styles.chatBanner} role="status">
          <WifiOff size={15} />
          <span>Reconnecting… you can send messages once you’re back online.</span>
        </div>
      ) : (
        !race &&
        paused && (
          <div className={styles.chatBanner} role="status">
            <Clock size={15} />
            <span>{friendFirst}’s app is paused — they may miss messages sent until they return.</span>
          </div>
        )
      )}

      <div ref={listRef} className={styles.chatBody} onScroll={handleListScroll}>
        {messages.length === 0 ? (
          <div className={styles.chatEmpty}>
            <span className={styles.chatEmptyIcon} aria-hidden="true">
              <MessageCircle size={22} />
            </span>
            <h3 className={styles.chatEmptyTitle}>{race ? 'Race group chat' : `Chat with ${friendFirst}`}</h3>
            <p className={styles.chatEmptySub}>{emptySub}</p>
          </div>
        ) : (
          <>
            <div className={styles.chatEphemeral}>
              <Lock size={12} />
              <span>Temporary chat · clears when {race ? 'race' : 'meetup'} ends</span>
            </div>

            <div className={styles.chatList} role="log" aria-live="polite" aria-relevant="additions">
              {messages.map((m, i) => {
                const isMe = m.senderId === myId;
                const prev = i > 0 ? messages[i - 1] : null;
                const showSender = race && !isMe && prev?.senderId !== m.senderId;
                return (
                  <div key={m.id} className={cx(styles.chatMsg, isMe && styles.chatMsgMe)}>
                    {showSender && <span className={styles.chatSender}>{firstName(m.senderName)}</span>}
                    <div className={cx(styles.chatBubble, isMe && styles.chatBubbleMe)}>{m.text}</div>
                    <span className={styles.chatMeta}>
                      {formatMessageTime(m.at)}
                      {isMe && <Check size={12} strokeWidth={2.5} />}
                    </span>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {typingUsers.length > 0 && (
          <div className={styles.chatTyping} role="status" aria-label={typingText}>
            <span className={styles.chatTypingDots} aria-hidden="true">
              <span className={styles.chatTypingDot} />
              <span className={styles.chatTypingDot} />
              <span className={styles.chatTypingDot} />
            </span>
            <span className={styles.chatTypingLabel}>{typingText}</span>
          </div>
        )}
      </div>

      {!kbInset.tight && (
        <div className={styles.chatQuick} aria-label="Quick replies">
          {quickReplies.map((q) => (
            <button key={q} type="button" className={styles.chatChip} disabled={!connected} onClick={() => handleQuick(q)}>
              {q}
            </button>
          ))}
        </div>
      )}

      <form className={styles.chatComposer} onSubmit={handleSubmit}>
        <input
          ref={inputRef}
          type="text"
          className={styles.chatInput}
          value={draft}
          maxLength={CHAT_MAX_LENGTH}
          placeholder={race ? 'Message group…' : `Message ${friendFirst}…`}
          aria-label={race ? 'Message group' : `Message ${friendFirst}`}
          autoComplete="off"
          onChange={(e) => handleInputChange(e.target.value)}
          onBlur={handleInputBlur}
        />
        <button
          type="submit"
          className={cx(styles.chatSend, canSend && styles.chatSendActive)}
          disabled={!canSend}
          aria-label="Send message"
        >
          <Send size={17} />
        </button>
      </form>
    </section>
  );

  return (
    <>
      {isMobile && <div className={styles.chatScrim} onClick={onClose} aria-hidden="true" />}
      {content}
    </>
  );
}
