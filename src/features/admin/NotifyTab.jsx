import { useEffect, useState } from 'react';
import styles from './AdminPanel.module.css';
import ownStyles from './PendingTab.module.css';
import { supabase } from '../../lib/supabase';
import { track } from '../../lib/analytics';
import { nextDigestDate, previewDigest } from '../notifications/weekly';

/**
 * Notify — this week's push round-up (supabase/push_notifications.sql).
 * General news never goes out on its own: one announcement per week rides
 * along in the Sunday 6 pm round-up with the week's new places and events.
 * "Lead with this" (or a lead place) puts it first in the title.
 * "Send a test to me" checks notifications on the admin's own device.
 */
export default function NotifyTab() {
  const sendWeek = nextDigestDate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);
  const [newPlaces, setNewPlaces] = useState([]);
  const [eventCount, setEventCount] = useState(0);
  const [saved, setSaved] = useState(null); // the row for sendWeek, if any
  const [form, setForm] = useState({ title: '', body: '', url: '', lead: false, leadPlaceId: '' });

  async function load() {
    setLoading(true);
    setError(null);
    try {
      // Counted as at the real send, Sunday 18:00 Lagos (17:00 UTC), the
      // same window compose_weekly_digest() uses.
      const sendAt = new Date(`${sendWeek}T17:00:00Z`);
      const weekOut = new Date(sendAt.getTime() + 7 * 24 * 3600 * 1000);
      const [places, events, ann] = await Promise.all([
        supabase.rpc('weekly_new_places', { p_until: sendAt.toISOString() }),
        supabase
          .from('events')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'approved')
          .gte('starts_at', sendAt.toISOString())
          .lt('starts_at', weekOut.toISOString()),
        supabase.from('push_announcements').select('*').eq('send_week', sendWeek).maybeSingle(),
      ]);
      const firstError = places.error || events.error || ann.error;
      if (firstError) throw firstError;
      setNewPlaces(places.data || []);
      setEventCount(events.count || 0);
      setSaved(ann.data || null);
      setForm(
        ann.data
          ? { title: ann.data.title || '', body: ann.data.body || '', url: ann.data.url || '', lead: ann.data.lead, leadPlaceId: ann.data.lead_waypoint_id || '' }
          : { title: '', body: '', url: '', lead: false, leadPlaceId: '' }
      );
    } catch (e) {
      setError(
        /push_announcements|weekly_new_places/i.test(e.message || '')
          ? 'Notifications aren’t set up yet. Run supabase/push_notifications.sql in the Supabase SQL editor.'
          : e.message || 'Could not load this week’s round-up.'
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  async function save() {
    if (!form.title.trim() && !form.leadPlaceId) {
      setError('Write an announcement title, or pick a new place to lead with.');
      return;
    }
    if (form.lead && !form.title.trim()) {
      setError('Leading with the announcement needs a title.');
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const row = {
        send_week: sendWeek,
        title: form.title.trim() || null,
        body: form.body.trim() || null,
        url: form.url.trim() || null,
        lead: form.lead,
        lead_waypoint_id: form.leadPlaceId || null,
        created_by: auth?.user?.id || null,
      };
      const { error: e } = await supabase.from('push_announcements').upsert(row, { onConflict: 'send_week' });
      if (e) throw e;
      track('push_announcement_saved', { lead: form.lead });
      setNotice('Saved. It goes out with Sunday’s round-up.');
      await load();
    } catch (e) {
      setError(e.message || 'Could not save.');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!saved) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const { error: e } = await supabase.from('push_announcements').delete().eq('id', saved.id);
      if (e) throw e;
      setNotice('Announcement removed.');
      await load();
    } catch (e) {
      setError(e.message || 'Could not remove it.');
    } finally {
      setBusy(false);
    }
  }

  // This Sunday's round-up, now, to every admin's devices (phones included),
  // exactly as everyone will get it. Save changes first so they're in it.
  async function sendPreview() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const { data: admins, error: e } = await supabase.rpc('send_digest_preview');
      if (e) throw e;
      track('push_preview_sent', { admins });
      setNotice(
        `Preview sent to ${admins} admin${admins === 1 ? '' : 's'}. It arrives within a minute on every device where they turned notifications on.`
      );
    } catch (e) {
      setError(e.message || 'Could not send the preview.');
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const { error: e } = await supabase.rpc('send_test_push');
      if (e) throw e;
      setNotice('Test sent. It should arrive on your devices within a minute.');
    } catch (e) {
      setError(e.message || 'Could not send a test.');
    } finally {
      setBusy(false);
    }
  }

  const leadName = newPlaces.find((p) => p.id === form.leadPlaceId)?.name || null;
  const draft = form.title.trim() ? { title: form.title.trim(), body: form.body, lead: form.lead } : null;
  const preview = previewDigest({ places: newPlaces.length, events: eventCount, ann: draft, leadName: form.lead ? null : leadName });
  const sundayLabel = new Date(`${sendWeek}T12:00:00Z`).toLocaleDateString('en-NG', { weekday: 'long', day: 'numeric', month: 'short' });

  return (
    <div className={styles.tabContent}>
      <div className={styles.toolbar} style={{ flexWrap: 'wrap', gap: 6 }}>
        <div className={styles.itemMeta}>Round-up goes out {sundayLabel}, 6 pm</div>
        <button type="button" className={styles.formCancel} style={{ marginLeft: 'auto' }} onClick={sendTest} disabled={busy}>
          Send a test to me
        </button>
      </div>

      {error && <div className={ownStyles.errorNote}>{error}</div>}
      {notice && <div className={`${styles.saveStatus} ${styles.saveStatusSuccess}`} style={{ margin: '0 16px 10px' }}>{notice}</div>}

      {loading ? (
        <div className={styles.empty}>Loading…</div>
      ) : (
        <div className={styles.list}>
          <div className={ownStyles.card}>
            <div className={styles.formTitle}>Preview</div>
            {preview ? (
              <>
                <div className={styles.itemName}>{preview.title}</div>
                <div className={styles.itemMeta}>{preview.body || ' '}</div>
              </>
            ) : (
              <div className={styles.itemMeta}>Nothing new this week yet, so no round-up will be sent unless you add an announcement.</div>
            )}
            <div className={styles.itemMeta}>
              {newPlaces.length} new place{newPlaces.length === 1 ? '' : 's'} · {eventCount} event{eventCount === 1 ? '' : 's'} in the week from Sunday
            </div>
            {preview && (
              <div className={styles.formActions} style={{ justifyContent: 'flex-start' }}>
                <button type="button" className={styles.formSave} onClick={sendPreview} disabled={busy}>
                  Send preview to admins
                </button>
              </div>
            )}
          </div>

          <div className={styles.inlineForm} style={{ margin: 0 }}>
            <div className={styles.formTitle}>{saved ? 'This week’s announcement' : 'Add an announcement (optional)'}</div>
            <div className={styles.fieldGroup}>
              <label htmlFor="notify-title">Title</label>
              <input id="notify-title" maxLength={80} value={form.title} onChange={set('title')} placeholder="Freshers: find your lecture halls" />
            </div>
            <div className={styles.fieldGroup}>
              <label htmlFor="notify-body">Message (used when it leads)</label>
              <input id="notify-body" maxLength={160} value={form.body} onChange={set('body')} placeholder="Every lecture theatre is now on the map with photos" />
            </div>
            <div className={styles.fieldGroup}>
              <label htmlFor="notify-url">Opens (optional)</label>
              <select id="notify-url" value={form.url} onChange={set('url')}>
                <option value="">Explore</option>
                <option value="/map">The map</option>
              </select>
            </div>
            <label className={styles.itemMeta} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="checkbox"
                checked={form.lead}
                onChange={(e) => setForm((f) => ({ ...f, lead: e.target.checked, leadPlaceId: e.target.checked ? '' : f.leadPlaceId }))}
              />
              Lead with this announcement
            </label>
            {!form.lead && newPlaces.length > 0 && (
              <div className={styles.fieldGroup}>
                <label htmlFor="notify-lead-place">Or lead with a new place</label>
                <select id="notify-lead-place" value={form.leadPlaceId} onChange={set('leadPlaceId')}>
                  <option value="">None</option>
                  {newPlaces.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            )}
            <div className={styles.formActions}>
              {saved && (
                <button type="button" className={styles.formCancel} onClick={remove} disabled={busy}>
                  Remove
                </button>
              )}
              <button type="button" className={styles.formSave} onClick={save} disabled={busy}>
                {saved ? 'Save changes' : 'Save'}
              </button>
            </div>
          </div>

          <div className={styles.itemMeta} style={{ padding: '0 4px' }}>
            Sent only to signed-in people who turned on notifications and kept “Weekly round-up” on. Nothing between 10 pm and 7 am.
          </div>
        </div>
      )}
    </div>
  );
}
