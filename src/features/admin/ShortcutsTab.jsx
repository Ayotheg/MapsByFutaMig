import { useEffect, useState } from 'react';
import { Footprints, MapPin } from 'lucide-react';
import styles from './AdminPanel.module.css';
import { supabase } from '../../lib/supabase';
import { track } from '../../lib/analytics';

/**
 * Shortcuts the app learned from people's walks
 * (supabase/learned_shortcuts.sql). An admin can see each one on the map,
 * how often people routed through it actually walked it, and switch it
 * on or off. Shortcuts people keep avoiding are switched off
 * automatically ("Off · auto"); switching one back on resets its counts.
 */
const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'On' },
  { key: 'learning', label: 'Learning' },
  { key: 'hidden', label: 'Off' },
];

function statusLabel(s) {
  if (s.status === 'active') return 'On';
  if (s.status === 'learning') return 'Learning';
  return s.hidden_by === 'auto' ? 'Off · auto' : 'Off';
}

function statusBadge(s) {
  if (s.status === 'active') return { background: 'var(--v2-secondary-tint)', borderColor: 'var(--v2-secondary)', color: 'var(--v2-neutral)' };
  if (s.status === 'learning') return { background: 'var(--v2-primary-tint)', borderColor: 'var(--v2-primary-border-soft)', color: 'var(--v2-primary-hover)' };
  return { background: 'var(--v2-error-tint)', borderColor: 'var(--v2-error-text)', color: 'var(--v2-error-text)' };
}

const fmtDate = (iso) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
const people = (n) => `${n} ${n === 1 ? 'person' : 'people'}`;

export default function ShortcutsTab({ onShowOnMap }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');
  const [busyId, setBusyId] = useState(null);

  async function load() {
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from('learned_shortcuts')
      .select('id, path, length_m, walker_count, status, hidden_by, used_count, avoided_count, created_at, updated_at')
      .order('updated_at', { ascending: false })
      .limit(500);
    if (err) setError(err.message);
    else setRows(data || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function setStatus(row, status) {
    setBusyId(row.id);
    // `.select()` so an RLS-filtered update (not an admin in the database)
    // shows as an error instead of silently doing nothing.
    const { data, error: err } = await supabase.from('learned_shortcuts').update({ status }).eq('id', row.id).select('id');
    setBusyId(null);
    if (err || !data?.length) {
      setError(err?.message || 'Not saved: your account is not an admin in the database (profiles.is_admin).');
      return;
    }
    track('admin_shortcut_status', { id: row.id, status });
    load();
  }

  const shown = rows.filter((r) => filter === 'all' || r.status === filter);
  const autoOff = rows.filter((r) => r.status === 'hidden' && r.hidden_by === 'auto').length;

  return (
    <div className={styles.tabContent}>
      <div className={styles.toolbar}>
        <div className={styles.countBadge}>
          <span className={styles.countBadgeDot} />
          {rows.filter((r) => r.status === 'active').length} <span className={styles.countBadgeMuted}>on · {rows.length} learned</span>
        </div>
        <div className={styles.categoryPillRow}>
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              className={`${styles.categoryPill} ${filter === f.key ? styles.categoryPillActive : ''}`}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>
      {autoOff > 0 && (
        <div className={styles.shortcutNote}>
          {autoOff} switched off automatically because people routed through {autoOff === 1 ? 'it' : 'them'} kept going
          around. Check on the map before switching back on.
        </div>
      )}
      <div className={styles.list}>
        {loading && <div className={styles.loading}>Loading shortcuts…</div>}
        {error && <div className={`${styles.saveStatus} ${styles.saveStatusError}`}>{error}</div>}
        {!loading && !error && shown.length === 0 && (
          <div className={styles.empty}>
            {rows.length === 0 ? 'No shortcuts learned yet. They appear here once someone shares a shorter way.' : 'None in this filter.'}
          </div>
        )}
        {!loading &&
          shown.map((s) => (
            <div key={s.id} className={styles.item} style={{ cursor: 'default' }}>
              <div className={styles.itemIcon}>
                <Footprints size={16} />
              </div>
              <div className={styles.itemBody}>
                <div className={styles.itemTopRow}>
                  <div className={styles.itemNameGroup}>
                    <div className={styles.itemName}>Shortcut #{s.id}</div>
                  </div>
                  <span className={styles.itemBadge} style={statusBadge(s)}>
                    {statusLabel(s)}
                  </span>
                </div>
                <div className={styles.itemDesc}>
                  {Math.round(Number(s.length_m))} m · shared by {people(s.walker_count)} · added {fmtDate(s.created_at)}
                </div>
                {s.status !== 'learning' && (
                  <div className={styles.itemMeta}>
                    <span className={styles.itemMetaLabel}>Routed through since switched on:</span>
                    <span className={styles.itemMetaValue}>
                      {s.used_count} walked it · {s.avoided_count} went around
                    </span>
                  </div>
                )}
                <div className={styles.formActions} style={{ justifyContent: 'flex-start', marginTop: 8 }}>
                  <button type="button" className={styles.formCancel} onClick={() => onShowOnMap(s.path)}>
                    <MapPin size={11} style={{ verticalAlign: -1, marginRight: 4 }} />
                    Show on map
                  </button>
                  {s.status === 'active' ? (
                    <button type="button" className={styles.formCancel} disabled={busyId === s.id} onClick={() => setStatus(s, 'hidden')}>
                      Turn off
                    </button>
                  ) : (
                    <button type="button" className={styles.formSave} disabled={busyId === s.id} onClick={() => setStatus(s, 'active')}>
                      Turn on
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
