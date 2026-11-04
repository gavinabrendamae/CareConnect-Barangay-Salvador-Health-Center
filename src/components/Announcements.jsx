import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext.jsx';
import { formatDate } from '../lib/format.js';
import { manilaToday } from '../lib/loginCode.js';
import DatePicker from './DatePicker.jsx';

// ---- Landing page popup (public) ----
const SEEN_KEY = 'cc_announce_seen';
const isNew = (d) => Date.now() - new Date(d).getTime() < 3 * 86400000;

// Public announcements popup for the landing page.
// Opens once per browser session automatically; `open`/`onClose` let the hero button reopen it.
export function AnnouncementModal({ open, onClose, onLoaded }) {
  const [rows, setRows] = useState(null);
  const [auto, setAuto] = useState(false);

  useEffect(() => {
    supabase.from('announcements').select('*')
      .or(`expires_on.is.null,expires_on.gte.${manilaToday()}`)
      .order('is_pinned', { ascending: false }).order('created_at', { ascending: false }).limit(10)
      .then(({ data }) => {
        const list = data ?? [];
        setRows(list);
        onLoaded?.(list.length);
        let seen = false;
        try { seen = sessionStorage.getItem(SEEN_KEY) === '1'; } catch { /* storage unavailable */ }
        if (list.length && !seen) setAuto(true);
      });
  }, [onLoaded]);

  const show = open || auto;
  function close() {
    setAuto(false);
    try { sessionStorage.setItem(SEEN_KEY, '1'); } catch { /* ignore */ }
    onClose?.();
  }

  if (!show) return null;
  return (
    <>
      <div className="modal fade show d-block" tabIndex="-1" onClick={close}>
        <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable" onClick={(e) => e.stopPropagation()}>
          <div className="modal-content ann-modal">
            <div className="ann-head">
              <div className="ann-head-icon"><i className="bi bi-megaphone-fill" /></div>
              <div>
                <h5 className="mb-0 fw-bold">Announcements</h5>
                <small>Latest updates from the Barangay Health Center</small>
              </div>
              <button type="button" className="btn-close btn-close-white ms-auto" onClick={close} aria-label="Close" />
            </div>
            <div className="modal-body ann-body">
              {rows === null ? <div className="text-secondary">Loading...</div> : rows.length === 0 ? (
                <div className="text-center text-secondary py-4">
                  <i className="bi bi-bell-slash fs-2 d-block mb-2" />No announcements right now.
                </div>
              ) : rows.map((a) => (
                <div key={a.id} className={`ann-item${a.is_pinned ? ' pinned' : ''}`}>
                  <div className="d-flex align-items-start justify-content-between gap-2">
                    <strong className="ann-title">{a.title}</strong>
                    <div className="d-flex gap-1 flex-shrink-0">
                      {a.is_pinned && <span className="badge bg-warning text-dark"><i className="bi bi-pin-angle-fill me-1" />Pinned</span>}
                      {isNew(a.created_at) && <span className="badge bg-success">New</span>}
                    </div>
                  </div>
                  <div className="ann-date"><i className="bi bi-calendar3 me-1" />{formatDate(a.created_at)}</div>
                  <div className="ann-text">{a.body}</div>
                </div>
              ))}
            </div>
            <div className="modal-footer border-0 pt-0">
              <button className="btn btn-primary-custom px-4" onClick={close}>Got it</button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show" />
    </>
  );
}

// ---- Resident dashboard list ----
export function AnnouncementList({ limit = 5 }) {
  const [rows, setRows] = useState(null);

  useEffect(() => {
    supabase.from('announcements').select('*').or(`expires_on.is.null,expires_on.gte.${manilaToday()}`).order('is_pinned', { ascending: false }).order('created_at', { ascending: false }).limit(limit)
      .then(({ data }) => setRows(data ?? []));
  }, [limit]);

  if (rows === null) return <div className="text-secondary">Loading...</div>;
  if (rows.length === 0) return <div className="text-secondary">No announcements from the health center right now.</div>;
  return rows.map((a) => (
    <div key={a.id} className={`announce mb-2${a.is_pinned ? ' pinned' : ''}`}>
      <div className="d-flex justify-content-between">
        <strong>{a.is_pinned && <i className="bi bi-pin-angle-fill text-warning me-1" />}{a.title}</strong>
        <span className="small text-secondary">{formatDate(a.created_at)}</span>
      </div>
      <div className="small" style={{ whiteSpace: 'pre-line' }}>{a.body}</div>
    </div>
  ));
}

// ---- Admin / staff panel (default export) ----
export default function AnnouncementsPanel() {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [f, setF] = useState({ title: '', body: '', is_pinned: false, expires_on: '' });
  const [pickerKey, setPickerKey] = useState(0);
  const [msg, setMsg] = useState(null);

  const load = useCallback(async () => {
    const { data } = await supabase.from('announcements').select('*').order('created_at', { ascending: false });
    setRows(data ?? []);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function post(e) {
    e.preventDefault();
    setMsg(null);
    const { error } = await supabase.from('announcements').insert({ title: f.title.trim(), body: f.body.trim(), is_pinned: f.is_pinned, expires_on: f.expires_on || null, created_by: user.id });
    if (error) return setMsg({ type: 'danger', text: error.message });
    setF({ title: '', body: '', is_pinned: false, expires_on: '' });
    setPickerKey((k) => k + 1);
    setMsg({ type: 'success', text: 'Announcement posted to the resident dashboards.' });
    load();
  }

  async function togglePin(a) {
    const { error } = await supabase.from('announcements').update({ is_pinned: !a.is_pinned }).eq('id', a.id);
    if (error) setMsg({ type: 'danger', text: error.message }); else load();
  }

  async function remove(a) {
    if (!window.confirm(`Delete "${a.title}"?`)) return;
    const { error } = await supabase.from('announcements').delete().eq('id', a.id);
    if (error) setMsg({ type: 'danger', text: error.message }); else load();
  }

  return (
    <div className="row g-4">
      <div className="col-lg-5">
        <form className="panel-card" onSubmit={post}>
          <h5 className="mb-3">New Announcement</h5>
          {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}
          <div className="mb-3"><label className="form-label required">Title</label>
            <input className="form-control" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} required /></div>
          <div className="mb-3"><label className="form-label required">Message</label>
            <textarea rows="4" className="form-control" value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} required /></div>
          <div className="mb-3"><label className="form-label">Show until</label>
            <DatePicker key={pickerKey} id="annUntil" minDate="today" maxDate={null} placeholder="dd/mm/yyyy (optional)" onChange={(v) => setF((x) => ({ ...x, expires_on: v }))} />
            <div className="form-text">The announcement and the landing page badge disappear after this date. Leave blank to keep it until you delete it.</div></div>
          <div className="form-check mb-3">
            <input className="form-check-input" type="checkbox" id="annPin" checked={f.is_pinned} onChange={(e) => setF({ ...f, is_pinned: e.target.checked })} />
            <label className="form-check-label" htmlFor="annPin">Pin to top</label>
          </div>
          <button className="btn btn-primary-custom">Post announcement</button>
        </form>
      </div>
      <div className="col-lg-7">
        <div className="panel-card">
          <h5 className="mb-3">Posted Announcements</h5>
          {rows.length === 0 ? <div className="text-secondary">Nothing posted yet.</div> : rows.map((a) => (
            <div key={a.id} className={`announce mb-2${a.is_pinned ? ' pinned' : ''}`}>
              <div className="d-flex justify-content-between gap-2">
                <strong>{a.title}</strong>
                <span className="small text-secondary text-nowrap">{formatDate(a.created_at)}</span>
              </div>
              {a.expires_on && (a.expires_on < manilaToday()
                ? <div className="small text-danger mb-1">Expired on {formatDate(a.expires_on)} (hidden from residents)</div>
                : <div className="small text-secondary mb-1">Shown until {formatDate(a.expires_on)}</div>)}
              <div className="small mb-2" style={{ whiteSpace: 'pre-line' }}>{a.body}</div>
              <button className="btn btn-sm btn-outline-secondary me-1" onClick={() => togglePin(a)}>{a.is_pinned ? 'Unpin' : 'Pin'}</button>
              <button className="btn btn-sm btn-outline-danger" onClick={() => remove(a)}>Delete</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}