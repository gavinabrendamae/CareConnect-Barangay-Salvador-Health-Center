import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import Modal from './Modal.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { dueDaysUntil, dueToday, formatDate, todayISO } from '../lib/format.js';

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const pad = (n) => String(n).padStart(2, '0');
const iso = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;
export const fmtTime = (t) => {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  return `${((h + 11) % 12) + 1}:${pad(m)} ${h >= 12 ? 'PM' : 'AM'}`;
};
// Typed 12-hour time: hour 1-12, minute 00-59, AM/PM dropdown. Emits "HH:MM" (24h) or ''.
function TimeInput({ value, onChange }) {
  const split = (v) => {
    if (!v) return { h: '', m: '', ap: 'AM' };
    const [H, M] = v.split(':').map(Number);
    return { h: String(((H + 11) % 12) + 1), m: pad(M), ap: H >= 12 ? 'PM' : 'AM' };
  };
  const [t, setT] = useState(() => split(value));
  const emit = (n) => {
    const h = parseInt(n.h, 10), m = parseInt(n.m, 10);
    if (!(h >= 1 && h <= 12) || !(m >= 0 && m <= 59) || n.m === '') return onChange('');
    onChange(`${pad((h % 12) + (n.ap === 'PM' ? 12 : 0))}:${pad(m)}`);
  };
  useEffect(() => { // follow outside changes (edit / reset)
    const cur = (() => { const h = parseInt(t.h, 10), m = parseInt(t.m, 10); return h >= 1 && h <= 12 && m >= 0 && m <= 59 && t.m !== '' ? `${pad((h % 12) + (t.ap === 'PM' ? 12 : 0))}:${pad(m)}` : ''; })();
    if ((value || '') !== cur) setT(split(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  const set = (patch) => { const n = { ...t, ...patch }; setT(n); emit(n); };
  const digits = (v, max) => v.replace(/\D/g, '').slice(0, max);
  return (
    <div className="time-field form-control d-flex align-items-center">
      <style>{`.time-field{padding:0 .5rem}.time-field:focus-within{border-color:#86b7fe;box-shadow:0 0 0 .25rem rgba(13,110,253,.25)}
.time-field input,.time-field select{border:0;outline:0;background:transparent;padding:.375rem 0;font:inherit;color:inherit}
.time-field input{width:2ch;text-align:center}.time-field select{width:auto;cursor:pointer;margin-left:.35rem;padding-right:.1rem}`}</style>
      <input inputMode="numeric" placeholder="hh" maxLength={2} value={t.h} aria-label="Hour"
        onChange={(e) => set({ h: digits(e.target.value, 2) })}
        onBlur={() => { const h = parseInt(t.h, 10); if (t.h && !(h >= 1 && h <= 12)) set({ h: '' }); }} />
      <span>:</span>
      <input inputMode="numeric" placeholder="mm" maxLength={2} value={t.m} aria-label="Minute"
        onChange={(e) => set({ m: digits(e.target.value, 2) })}
        onBlur={() => { const m = parseInt(t.m, 10); if (t.m !== '' && !(m >= 0 && m <= 59)) set({ m: '' }); else if (t.m.length === 1) set({ m: pad(m) }); }} />
      <select value={t.ap} onChange={(e) => set({ ap: e.target.value })} aria-label="AM or PM">
        <option>AM</option><option>PM</option>
      </select>
    </div>
  );
}

const blank = { title: '', event_date: '', start_time: '', location: '', notes: '' };

export default function EventsPanel() {
  const { user } = useAuth();
  const now = new Date();
  const [cursor, setCursor] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [rows, setRows] = useState([]);
  const [f, setF] = useState({ ...blank, event_date: todayISO() });
  const [editId, setEditId] = useState(null);
  const [msg, setMsg] = useState(null);
  const [announce, setAnnounce] = useState(null);
  const [compose, setCompose] = useState(null); // { title, extra } — announcement modal

  const load = useCallback(async () => {
    const { data } = await supabase.from('events').select('*').order('event_date').order('start_time');
    setRows(data ?? []);
  }, []);
  useEffect(() => { load(); }, [load]);

  const byDay = useMemo(() => {
    const map = {};
    rows.forEach((r) => { (map[r.event_date] ??= []).push(r); });
    return map;
  }, [rows]);

  const first = new Date(cursor.y, cursor.m, 1).getDay();
  const dim = new Date(cursor.y, cursor.m + 1, 0).getDate();
  const cells = [...Array(first).fill(null), ...Array.from({ length: dim }, (_, i) => i + 1)];
  const today = dueToday();
  const upcoming = rows.filter((r) => r.event_date >= today);

  function shift(n) {
    const d = new Date(cursor.y, cursor.m + n, 1);
    setCursor({ y: d.getFullYear(), m: d.getMonth() });
  }

  const evLines = (ev) => [
    `When: ${formatDate(ev.event_date)}${ev.start_time ? ` at ${fmtTime(ev.start_time)}` : ''}`,
    ev.location ? `Where: ${ev.location}` : null,
    ev.notes ? `Details: ${ev.notes}` : null,
  ].filter(Boolean);

  async function postAnnouncement() {
    const ev = announce;
    const body = [...evLines(ev), compose.extra.trim() || null].filter(Boolean).join('\n');
    const { error } = await supabase.from('announcements').insert({ title: compose.title.trim() || ev.title, body, is_pinned: false, expires_on: ev.event_date, created_by: user.id });
    setAnnounce(null); setCompose(null);
    setMsg(error ? { type: 'danger', text: error.message } : { type: 'success', text: 'Posted as an announcement.' });
  }

  async function save(e) {
    e.preventDefault();
    setMsg(null);
    const row = {
      title: f.title.trim(), event_date: f.event_date, start_time: f.start_time || null,
      location: f.location.trim() || null, notes: f.notes.trim() || null,
    };
    const { error } = editId
      ? await supabase.from('events').update(row).eq('id', editId)
      : await supabase.from('events').insert({ ...row, created_by: user.id });
    if (error) return setMsg({ type: 'danger', text: error.message });
    setMsg({ type: 'success', text: editId ? 'Event updated.' : 'Event added to the calendar.' });
    if (!editId) setAnnounce({ ...row });
    setEditId(null);
    setF({ ...blank, event_date: f.event_date });
    load();
  }

  function edit(ev) {
    setEditId(ev.id);
    setF({ title: ev.title, event_date: ev.event_date, start_time: ev.start_time?.slice(0, 5) ?? '', location: ev.location ?? '', notes: ev.notes ?? '' });
    setMsg(null);
  }

  async function remove(ev) {
    if (!window.confirm(`Delete "${ev.title}"?`)) return;
    const { error } = await supabase.from('events').delete().eq('id', ev.id);
    if (error) setMsg({ type: 'danger', text: error.message }); else { if (editId === ev.id) { setEditId(null); setF({ ...blank, event_date: todayISO() }); } load(); }
  }

  const monthName = new Date(cursor.y, cursor.m, 1).toLocaleDateString('en-PH', { month: 'long', year: 'numeric' });
  const when = (d) => { const n = dueDaysUntil(d); return n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : `in ${n} days`; };

  return (
    <div className="row g-4">
      <div className="col-xl-8">
        <div className="panel-card">
          <div className="d-flex align-items-center justify-content-between mb-3">
            <h5 className="mb-0"><i className="bi bi-calendar-event me-2 text-success" />{monthName}</h5>
            <div className="btn-group">
              <button className="btn btn-sm btn-outline-secondary" onClick={() => shift(-1)}><i className="bi bi-chevron-left" /></button>
              <button className="btn btn-sm btn-outline-secondary" onClick={() => setCursor({ y: now.getFullYear(), m: now.getMonth() })}>Today</button>
              <button className="btn btn-sm btn-outline-secondary" onClick={() => shift(1)}><i className="bi bi-chevron-right" /></button>
            </div>
          </div>
          <div className="cal-grid">
            {DOW.map((d) => <div key={d} className="cal-dow">{d}</div>)}
            {cells.map((d, i) => {
              if (!d) return <div key={`b${i}`} className="cal-cell blank" />;
              const key = iso(cursor.y, cursor.m, d);
              const evs = byDay[key] ?? [];
              return (
                <div key={key} className={`cal-cell${key === today ? ' today' : ''}${f.event_date === key ? ' picked' : ''}`}
                  onClick={() => { setEditId(null); setMsg(null); setF({ ...blank, event_date: key }); }}>
                  <div className="cal-num">{d}</div>
                  {evs.slice(0, 2).map((ev) => (
                    <button type="button" key={ev.id} className="cal-ev" title={ev.title} onClick={(e) => { e.stopPropagation(); edit(ev); }}>{ev.title}</button>
                  ))}
                  {evs.length > 2 && <div className="cal-more">+{evs.length - 2} more</div>}
                </div>
              );
            })}
          </div>
          <div className="form-text mt-2">Click a day to pick its date for a new event, or click an event to edit it.</div>
        </div>
      </div>

      <div className="col-xl-4">
        <form className="panel-card mb-4" onSubmit={save}>
          <h5 className="mb-3">{editId ? 'Edit Event' : 'Add Event'}</h5>
          {msg && <div className={`alert alert-${msg.type} py-2`}>{msg.text}</div>}
          {announce && (
            <div className="alert alert-info py-2">
              <div className="mb-2"><i className="bi bi-megaphone me-1" />Post "<strong>{announce.title}</strong>" as an announcement too?</div>
              <button type="button" className="btn btn-sm btn-primary-custom me-2" onClick={() => setCompose({ title: announce.title, extra: '' })}>Post as announcement</button>
              <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setAnnounce(null)}>No thanks</button>
            </div>
          )}
          <div className="mb-2"><label className="form-label required">Event / memo</label>
            <input className="form-control" placeholder="e.g. Seminar, Feeding Program" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} required /></div>
          <div className="row g-2 mb-2">
            <div className="col-7"><label className="form-label required">Date</label>
              <input type="date" className="form-control" min={editId ? undefined : today} value={f.event_date} onChange={(e) => setF({ ...f, event_date: e.target.value })} required /></div>
            <div className="col-5"><label className="form-label">Time</label>
              <TimeInput value={f.start_time} onChange={(v) => setF((x) => ({ ...x, start_time: v }))} /></div>
          </div>
          <div className="mb-2"><label className="form-label">Location</label>
            <input className="form-control" value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} /></div>
          <div className="mb-3"><label className="form-label">Comment</label>
            <textarea rows="2" className="form-control" placeholder="e.g. 9:00–10:00, bring ID" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></div>
          <button className="btn btn-primary-custom">{editId ? 'Save changes' : 'Add event'}</button>
          {editId && <button type="button" className="btn btn-link" onClick={() => { setEditId(null); setF({ ...blank, event_date: todayISO() }); }}>Cancel</button>}
        </form>

        <div className="panel-card">
          <h5 className="mb-3">Upcoming Events <span className="badge bg-success ms-1">{upcoming.length}</span></h5>
          {upcoming.length === 0 ? <div className="text-secondary">No upcoming events.</div> : upcoming.slice(0, 8).map((ev) => (
            <div key={ev.id} className="ev-item">
              <div className="d-flex justify-content-between gap-2">
                <strong>{ev.title}</strong>
                <span className={`badge ${dueDaysUntil(ev.event_date) <= 1 ? 'bg-danger' : 'bg-light text-dark border'}`}>{when(ev.event_date)}</span>
              </div>
              <div className="small text-secondary">
                <i className="bi bi-calendar3 me-1" />{formatDate(ev.event_date)}{ev.start_time && <> · {fmtTime(ev.start_time)}</>}
                {ev.location && <> · <i className="bi bi-geo-alt me-1" />{ev.location}</>}
              </div>
              {ev.notes && <div className="small">{ev.notes}</div>}
              <div className="mt-1">
                <button className="btn btn-sm btn-outline-secondary me-1" onClick={() => edit(ev)}>Edit</button>
                <button className="btn btn-sm btn-outline-danger" onClick={() => remove(ev)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      </div>
      <Modal show={!!compose && !!announce} title="Post as announcement" icon="bi-megaphone" onClose={() => setCompose(null)}
        footer={<><button type="button" className="btn btn-outline-secondary" onClick={() => setCompose(null)}>Cancel</button>
          <button type="button" className="btn btn-primary-custom px-4" onClick={postAnnouncement}>Post announcement</button></>}>
        {compose && announce && (
          <>
            <div className="mb-3"><label className="form-label">Title</label>
              <input className="form-control" value={compose.title} onChange={(e) => setCompose({ ...compose, title: e.target.value })} /></div>
            <div className="mb-3"><label className="form-label">From the event</label>
              <div className="border rounded p-2 bg-light small" style={{ whiteSpace: 'pre-line' }}>{evLines(announce).join('\n')}</div></div>
            <div className="mb-1"><label className="form-label">Add more details <span className="text-secondary">(optional)</span></label>
              <textarea rows="3" className="form-control" placeholder="e.g. Who can join, what to bring…" value={compose.extra} onChange={(e) => setCompose({ ...compose, extra: e.target.value })} /></div>
            <div className="form-text">Shown until {formatDate(announce.event_date)}.</div>
          </>
        )}
      </Modal>
    </div>
  );
}