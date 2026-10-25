import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../context/AuthContext.jsx';
import { formatDate } from '../lib/format.js';

export default function AnnouncementsPanel() {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [f, setF] = useState({ title: '', body: '', is_pinned: false });
  const [msg, setMsg] = useState(null);

  const load = useCallback(async () => {
    const { data } = await supabase.from('announcements').select('*').order('created_at', { ascending: false });
    setRows(data ?? []);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function post(e) {
    e.preventDefault();
    setMsg(null);
    const { error } = await supabase.from('announcements').insert({ title: f.title.trim(), body: f.body.trim(), is_pinned: f.is_pinned, created_by: user.id });
    if (error) return setMsg({ type: 'danger', text: error.message });
    setF({ title: '', body: '', is_pinned: false });
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