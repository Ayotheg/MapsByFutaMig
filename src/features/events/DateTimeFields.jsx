import { useEffect, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import styles from './DateTimeFields.module.css';

/**
 * Day and start-time pickers for /event. Native date/time inputs render
 * differently on every browser and overflow the half-width columns on
 * phones, so these are buttons that open a popover (desktop) or a bottom
 * sheet (phones, see the CSS). Values keep the native formats:
 * day 'YYYY-MM-DD', time 'HH:MM' (24h).
 */

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const HOURS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const MINUTES = [0, 15, 30, 45];

const pad = (n) => String(n).padStart(2, '0');
const toKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
function fromKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function Picker({ open, title, onClose, align, children }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <>
      <div className={styles.scrim} onClick={onClose} />
      <div className={`${styles.popover} ${align === 'end' ? styles.popoverEnd : ''}`} role="dialog" aria-label={title}>
        <span className={styles.sheetHandle} aria-hidden="true" />
        <span className={styles.sheetTitle}>{title}</span>
        {children}
        <button type="button" className={styles.doneBtn} onClick={onClose}>
          Done
        </button>
      </div>
    </>
  );
}

export function DayField({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const today = startOfToday();
  const selected = value ? fromKey(value) : null;
  const [month, setMonth] = useState(() => {
    const base = selected || today;
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });

  const leading = (month.getDay() + 6) % 7; // Monday first
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const isCurrentMonth = month.getFullYear() === today.getFullYear() && month.getMonth() === today.getMonth();
  const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

  function pick(date) {
    onChange(toKey(date));
    setMonth(new Date(date.getFullYear(), date.getMonth(), 1));
    setOpen(false);
  }

  const label = selected
    ? selected.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
    : 'Pick a day';

  return (
    <div className={styles.field}>
      <span className={styles.label}>Day</span>
      <button
        type="button"
        className={`${styles.trigger} ${open ? styles.triggerOpen : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <CalendarDays size={17} aria-hidden="true" />
        <span className={selected ? styles.value : styles.placeholder}>{label}</span>
      </button>
      <Picker open={open} title="Pick a day" onClose={() => setOpen(false)}>
        <div className={styles.quick}>
          <button type="button" className={styles.quickChip} onClick={() => pick(today)}>
            Today
          </button>
          <button type="button" className={styles.quickChip} onClick={() => pick(tomorrow)}>
            Tomorrow
          </button>
        </div>
        <div className={styles.monthHead}>
          <button
            type="button"
            className={styles.monthNav}
            onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
            disabled={isCurrentMonth}
            aria-label="Previous month"
          >
            <ChevronLeft size={18} />
          </button>
          <span className={styles.monthName}>
            {month.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
          </span>
          <button
            type="button"
            className={styles.monthNav}
            onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
            aria-label="Next month"
          >
            <ChevronRight size={18} />
          </button>
        </div>
        <div className={styles.grid}>
          {WEEKDAYS.map((w, i) => (
            <span key={i} className={styles.weekday}>
              {w}
            </span>
          ))}
          {Array.from({ length: leading }, (_, i) => (
            <span key={`b${i}`} />
          ))}
          {Array.from({ length: daysInMonth }, (_, i) => {
            const date = new Date(month.getFullYear(), month.getMonth(), i + 1);
            const key = toKey(date);
            // Events are listed ahead of time, so past days can't be picked.
            const past = date < today;
            return (
              <button
                key={key}
                type="button"
                className={`${styles.day} ${key === toKey(today) ? styles.dayToday : ''} ${
                  key === value ? styles.daySelected : ''
                }`}
                disabled={past}
                aria-pressed={key === value}
                aria-label={date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
                onClick={() => pick(date)}
              >
                {i + 1}
              </button>
            );
          })}
        </div>
      </Picker>
    </div>
  );
}

export function TimeField({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [h24, m] = value ? value.split(':').map(Number) : [null, null];
  const hour12 = h24 == null ? null : h24 % 12 || 12;
  const [period, setPeriod] = useState(() => (h24 != null && h24 >= 12 ? 'PM' : 'AM'));

  function set(nextHour12, nextMinute, nextPeriod) {
    if (nextHour12 == null) return;
    const h = (nextHour12 % 12) + (nextPeriod === 'PM' ? 12 : 0);
    onChange(`${pad(h)}:${pad(nextMinute ?? 0)}`);
  }

  const label =
    hour12 == null ? 'Pick a time' : `${hour12}:${pad(m)} ${h24 < 12 ? 'AM' : 'PM'}`;

  return (
    <div className={styles.field}>
      <span className={styles.label}>Starts</span>
      <button
        type="button"
        className={`${styles.trigger} ${open ? styles.triggerOpen : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <Clock size={17} aria-hidden="true" />
        <span className={hour12 == null ? styles.placeholder : styles.value}>{label}</span>
      </button>
      <Picker open={open} title="Pick a start time" align="end" onClose={() => setOpen(false)}>
        <div className={styles.periods} role="radiogroup" aria-label="AM or PM">
          {['AM', 'PM'].map((p) => (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={period === p}
              className={`${styles.period} ${period === p ? styles.periodActive : ''}`}
              onClick={() => {
                setPeriod(p);
                set(hour12, m, p);
              }}
            >
              {p}
            </button>
          ))}
        </div>
        <span className={styles.subLabel}>Hour</span>
        <div className={styles.hours}>
          {HOURS.map((h) => (
            <button
              key={h}
              type="button"
              className={`${styles.timeChip} ${hour12 === h ? styles.timeChipActive : ''}`}
              aria-pressed={hour12 === h}
              onClick={() => set(h, m, period)}
            >
              {h}
            </button>
          ))}
        </div>
        <span className={styles.subLabel}>Minutes</span>
        <div className={styles.minutes}>
          {MINUTES.map((min) => (
            <button
              key={min}
              type="button"
              className={`${styles.timeChip} ${hour12 != null && m === min ? styles.timeChipActive : ''}`}
              aria-pressed={hour12 != null && m === min}
              disabled={hour12 == null}
              onClick={() => set(hour12, min, period)}
            >
              :{pad(min)}
            </button>
          ))}
        </div>
      </Picker>
    </div>
  );
}
