import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const itemsOf = (r) => (r.items?.length ? r.items : [{ name: r.medicine_name, result: null }]);

/** Staff view of resident medicine requests. Pick Available / Not available for each medicine, then send ONE email. */
export default function MedicineRequestsPanel() {
  const [rows, setRows] = useState([]);
  const [choice, setChoice] = useState({}); 
  const [msg, setMsg] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('medicine_requests').select('*').neq('status', 'cancelled').order('created_at', { ascending: false }).limit(200);
    if (error) return setMsg({ type: 'danger', text: error.message });
    setRows(data ?? []);
  }, []);

  useEffect(() => {
    load();
    const channel = supabase.channel(`medreq-panel-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'medicine_requests' }, load).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load]);

  const pick = (id, i, value) => setChoice((c) => ({ ...c, [id]: { ...(c[id] ?? {}), [i]: value } }));

  async function send(r) {
    const items = itemsOf(r);
    const results = items.map((it, i) => ({ name: it.name, result: choice[r.id]?.[i] }));
    if (results.some((x) => !x.result)) return setMsg({ type: 'warning', text: 'Choose Available or Not available for every medicine first.' });
    setBusyId(r.id); setMsg(null);
    const { data, error } = await supabase.functions.invoke('medicine-notify', { body: { request_id: r.id, results } });
    setBusyId(null);
    if (error) {
      let text = error.message;
      try { const j = await error.context.json(); if (j?.error) text = j.error; } catch { /* keep message */ }
      return setMsg({ type: 'danger', text: `Could not send: ${text}` });
    }
    setMsg({ type: 'success', text: `Email sent to ${r.requester_name} (${data?.available ?? 0} available, ${data?.unavailable ?? 0} not available).` });
    load();
  }

  async function dismiss(id) {
    await supabase.from('medicine_requests').update({ status: 'cancelled' }).eq('id', id);
    load();
  }

  const waiting = rows.filter((r) => r.status === 'waiting');
  const done = rows.filter((r) => r.status === 'notified' || r.status === 'unavailable').slice(0, 10);

  return (
    <div className="panel-card">
      <h5 className="mb-1">Medicine Requests</h5>
      <p className="text-secondary small">Requests from residents for medicines they need. Check your inventory, mark each medicine as available or not, then send one email to the resident.</p>
      {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

      {waiting.length === 0 ? <div className="text-secondary">No requests waiting.</div> : (
        <div className="table-responsive">
          <table className="table align-middle">
            <thead><tr><th>Resident</th><th>Medicines</th><th>Date</th><th /></tr></thead>
            <tbody>
              {waiting.map((r) => (
                <tr key={r.id}>
                  <td>{r.requester_name}<div className="small text-secondary">{r.requester_purok || '—'}</div>
                    {r.note && <div className="small text-secondary">“{r.note}”</div>}</td>
                  <td>
                    {itemsOf(r).map((it, i) => (
                      <div key={i} className="d-flex flex-wrap align-items-center gap-2 mb-1">
                        <strong className="me-1">{it.name}</strong>
                        <div className="btn-group btn-group-sm" role="group">
                          <button type="button" className={`btn ${choice[r.id]?.[i] === 'available' ? 'btn-success' : 'btn-outline-success'}`}
                            onClick={() => pick(r.id, i, 'available')}>Available</button>
                          <button type="button" className={`btn ${choice[r.id]?.[i] === 'unavailable' ? 'btn-danger' : 'btn-outline-danger'}`}
                            onClick={() => pick(r.id, i, 'unavailable')}>Not available</button>
                        </div>
                      </div>
                    ))}
                  </td>
                  <td className="small">{new Date(r.created_at).toLocaleDateString('en-PH')}</td>
                  <td className="text-end text-nowrap">
                    <button className="btn btn-sm btn-primary-custom me-1" disabled={busyId === r.id} onClick={() => send(r)}>
                      <i className="bi bi-envelope-paper me-1" />{busyId === r.id ? 'Sending...' : 'Send email'}
                    </button>
                    <button className="btn btn-sm btn-outline-secondary" onClick={() => dismiss(r.id)}>Dismiss</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {done.length > 0 && (
        <>
          <h6 className="mt-3">Recently emailed</h6>
          <ul className="list-group">
            {done.map((r) => (
              <li key={r.id} className="list-group-item small">
                <strong>{r.requester_name}</strong> <span className="text-secondary">· {new Date(r.notified_at).toLocaleString('en-PH')}</span>
                <div>{itemsOf(r).map((it) => (
                  <span key={it.name} className={`me-3 text-${it.result === 'available' ? 'success' : 'danger'}`}>
                    <i className={`bi ${it.result === 'available' ? 'bi-check-circle-fill' : 'bi-x-circle-fill'} me-1`} />{it.name}
                  </span>
                ))}</div>
                <div className="mt-1">
                  {(r.given ?? []).length > 0
                    ? <span className="text-success"><i className="bi bi-box-seam me-1" />Given: {r.given.map((g) => `${g.name} × ${g.quantity} ${g.unit ?? ''}`.trim()).join(', ')}</span>
                    : <span className="text-secondary">Not given yet (record it in Dispense Logs &amp; Audit)</span>}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}