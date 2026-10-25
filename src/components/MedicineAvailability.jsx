import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext.jsx';
import { fullName } from '../lib/format.js';
import Modal from './Modal.jsx';

/** Resident view: only the medicines that are OUT of stock, with a "Request" button. */
export default function MedicineAvailability() {
  const { profile } = useAuth();
  const [rows, setRows] = useState([]);
  const [mine, setMine] = useState([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(null);
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ names: [''], note: '' });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [s, r] = await Promise.all([
      supabase.from('public_medicine_stock').select('id, name, category, status').eq('status', 'Out of stock').order('name'),
      supabase.from('medicine_requests').select('id, medicine_id, medicine_name, items, status, created_at, notified_at').eq('profile_id', profile.id).order('created_at', { ascending: false }),
    ]);
    if (s.error) setMsg({ type: 'danger', text: s.error.message }); else setRows(s.data ?? []);
    setMine(r.data ?? []);
    setLoading(false);
  }, [profile.id]);

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [load]);

    const term = q.trim().toLowerCase();
  const shown = rows.filter((r) => !term || r.name.toLowerCase().includes(term));

  async function submitModal(e) {
    e.preventDefault();
    const names = form.names.map((n) => n.trim()).filter(Boolean);
    if (names.length === 0) return setMsg({ type: 'danger', text: 'Type the name of the medicine you need.' });
    const listed = names.find((n) => rows.some((r) => r.name.toLowerCase() === n.toLowerCase()));
    if (listed) return setMsg({ type: 'warning', text: `${listed} is already listed as out of stock above. Remove it from your request.` });

    setMsg(null);
    setBusy(true);
    const { error } = await supabase.from('medicine_requests').insert({
      profile_id: profile.id,
      medicine_id: null,
      medicine_name: names.join(', '),
      items: names.map((name) => ({ name, result: null })),
      requester_name: fullName(profile),
      requester_purok: profile.purok || null,
      note: form.note.trim() || null,
    });
    setBusy(false);
    if (error) return setMsg({ type: 'danger', text: error.message });
    setMsg({ type: 'success', text: `Request sent for ${names.join(', ')}. We will email you at ${profile.email} with the result.` });
    setShow(false);
    setForm({ names: [''], note: '' });
    load();
  }

  const setName = (i, v) => setForm({ ...form, names: form.names.map((n, k) => (k === i ? v : n)) });
  const addName = () => form.names.length < 5 && setForm({ ...form, names: [...form.names, ''] });
  const removeName = (i) => setForm({ ...form, names: form.names.filter((_, k) => k !== i) });

  async function cancel(id) {
    await supabase.from('medicine_requests').update({ status: 'cancelled' }).eq('id', id);
    load();
  }

  return (
    <div className="panel-card">
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-1">
        <div>
          <h5 className="mb-1">Medicines Not Available</h5>
          <p className="text-secondary small mb-0">These medicines are out of stock right now. Need a medicine that is not on this list? Send a request and we will email you if the health center has it.</p>
        </div>
        <button className="btn btn-primary-custom" onClick={() => { setMsg(null); setShow(true); }}>
          <i className="bi bi-plus-circle me-1" />Request a medicine
        </button>
      </div>

      {msg && !show && <div className={`alert alert-${msg.type} mt-3`}>{msg.text}</div>}
      <input className="form-control my-3" placeholder="Search medicine..." value={q} onChange={(e) => setQ(e.target.value)} />

      {loading ? <div className="text-secondary">Loading...</div> : shown.length === 0 ? (
        <div className="text-secondary">{rows.length === 0 ? 'No medicines are out of stock right now.' : 'No medicine matches your search.'}</div>
      ) : (
        <div className="table-responsive">
          <table className="table align-middle mb-0">
            <thead><tr><th>Medicine</th><th>Used for</th></tr></thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.id}>
                  <td><strong>{r.name}</strong></td>
                  <td className="small">{r.category || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {mine.length > 0 && (
        <>
          <h6 className="mt-4">My requests</h6>
          <ul className="list-group">
            {mine.slice(0, 8).map((m) => (
              <li key={m.id} className="list-group-item d-flex justify-content-between align-items-center">
                <span>
                  <strong>{m.medicine_name}</strong> <span className="small text-secondary">· {new Date(m.created_at).toLocaleDateString('en-PH')}</span>
                  {(m.status === 'notified' || m.status === 'unavailable') && (m.items ?? []).length > 0 && (
                    <div className="small">{m.items.map((it) => (
                      <span key={it.name} className={`me-3 text-${it.result === 'available' ? 'success' : 'danger'}`}>
                        <i className={`bi ${it.result === 'available' ? 'bi-check-circle-fill' : 'bi-x-circle-fill'} me-1`} />{it.name}
                      </span>
                    ))}</div>
                  )}
                </span>
                {m.status === 'waiting' && <span><span className="badge bg-warning text-dark me-2">Waiting</span><button className="btn btn-link btn-sm p-0" onClick={() => cancel(m.id)}>Cancel</button></span>}
                {m.status === 'notified' && <span className="badge bg-success">Replied — email sent</span>}
                {m.status === 'unavailable' && <span className="badge bg-danger">Replied — email sent</span>}
                {m.status === 'cancelled' && <span className="badge bg-secondary">Cancelled</span>}
              </li>
            ))}
          </ul>
        </>
      )}

      <Modal show={show} title="Request a medicine" icon="bi-capsule" onClose={() => setShow(false)}>
        <form onSubmit={submitModal}>
          {show && msg && msg.type !== 'success' && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}
          <label className="form-label">Medicine name(s)</label>
          {form.names.map((n, i) => (
            <div className="input-group mb-2" key={i}>
              <input className="form-control" value={n} onChange={(e) => setName(i, e.target.value)} placeholder="e.g. Paracetamol 500mg" />
              {form.names.length > 1 && <button type="button" className="btn btn-outline-secondary" onClick={() => removeName(i)} title="Remove"><i className="bi bi-x-lg" /></button>}
            </div>
          ))}
          {form.names.length < 5 && (
            <button type="button" className="btn btn-link btn-sm p-0 mb-3" onClick={addName}><i className="bi bi-plus-circle me-1" />Add another medicine</button>
          )}
          <div className="mb-3">
            <label className="form-label">Note (optional)</label>
            <textarea className="form-control" rows={2} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </div>
          <p className="small text-secondary">We will check if the health center has it and email <strong>{profile.email}</strong>.</p>
          <button className="btn btn-primary-custom w-100" disabled={busy}>{busy ? 'Sending...' : 'Send request'}</button>
        </form>
      </Modal>
    </div>
  );
}