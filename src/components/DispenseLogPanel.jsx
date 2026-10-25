import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { fullName, formatDate, formatDateTime } from '../lib/format.js';
import PatientPicker from './PatientPicker.jsx';

export default function DispenseLogPanel() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');

  const [stock, setStock] = useState([]);
  const [patient, setPatient] = useState(null);
  const [reqs, setReqs] = useState([]);
  const [form, setForm] = useState({ medicine_id: '', quantity: '', instructions: '', request_id: '' });
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [log, st] = await Promise.all([
      supabase.from('prescriptions')
        .select(`id, created_at, quantity, instructions,
          patient:patients(first_name, middle_name, last_name, suffix, medical_id),
          medicine:medicines(name, unit),
          by:profiles!prescribed_by(first_name, last_name),
          allocations:dispense_allocations(quantity, batch:medicine_batches(batch_no, expiration_date))`)
        .order('created_at', { ascending: false })
        .limit(300),
      supabase.from('public_medicine_stock').select('id, name, unit, available_quantity').gt('available_quantity', 0).order('name'),
    ]);
    if (log.error) setError(log.error.message); else setRows(log.data ?? []);
    setStock(st.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    setReqs([]);
    setForm((f) => ({ ...f, request_id: '' }));
    if (!patient) return;
    supabase.from('patients').select('profile_id').eq('id', patient.id).maybeSingle().then(({ data }) => {
      if (!data?.profile_id) return;
      supabase.from('medicine_requests').select('id, medicine_name, items, given, created_at')
        .eq('profile_id', data.profile_id).eq('status', 'notified').order('created_at', { ascending: false })
        .then(({ data: r }) => setReqs(r ?? []));
    });
  }, [patient]);

  async function give(e) {
    e.preventDefault();
    setMsg(null);
    if (!patient) return setMsg({ type: 'danger', text: 'Choose the patient first.' });
    const med = stock.find((m) => m.id === form.medicine_id);
    if (!med) return setMsg({ type: 'danger', text: 'Choose the medicine.' });
    const qty = Number(form.quantity);
    if (!Number.isInteger(qty) || qty <= 0) return setMsg({ type: 'danger', text: 'Enter a quantity of 1 or more.' });
    if (qty > med.available_quantity) return setMsg({ type: 'danger', text: `Only ${med.available_quantity} ${med.unit} of ${med.name} in stock.` });

    setBusy(true);
    const { error: err } = await supabase.rpc('dispense_medicine', {
      p_patient_id: patient.id, p_medicine_id: med.id, p_quantity: qty, p_instructions: form.instructions.trim() || null,
    });
    if (err) { setBusy(false); return setMsg({ type: 'danger', text: err.message }); }

    if (form.request_id) {
      const r = reqs.find((x) => x.id === form.request_id);
      const given = [...(r?.given ?? []), { name: med.name, quantity: qty, unit: med.unit, at: new Date().toISOString() }];
      await supabase.from('medicine_requests').update({ given }).eq('id', form.request_id);
    }
    setBusy(false);
    setMsg({ type: 'success', text: `${qty} ${med.unit} of ${med.name} given to ${fullName(patient)}. Stock was deducted (earliest expiry first).` });
    setPatient(null);
    setForm({ medicine_id: '', quantity: '', instructions: '', request_id: '' });
    load();
  }

  const term = q.trim().toLowerCase();
  const shown = useMemo(() => (term
    ? rows.filter((r) => `${r.medicine?.name} ${fullName(r.patient)} ${fullName(r.by)}`.toLowerCase().includes(term))
    : rows), [rows, term]);

  return (
    <>
    <div className="panel-card mb-4">
      <h5 className="mb-1">Give Medicine</h5>
      <p className="text-secondary small">Record the medicine you hand to a resident. It is taken from the earliest-expiring batch (FEFO) and deducted from the inventory right away.</p>
      {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}
      <form onSubmit={give}>
        <div className="row g-3">
          <div className="col-lg-6"><PatientPicker value={patient} onChange={setPatient} label="Resident / patient" /></div>
          <div className="col-lg-6">
            <label className="form-label">Medicine</label>
            <select className="form-select" value={form.medicine_id} onChange={(e) => setForm({ ...form, medicine_id: e.target.value })}>
              <option value="">— Choose a medicine in stock —</option>
              {stock.map((m) => <option key={m.id} value={m.id}>{m.name} — {m.available_quantity} {m.unit} left</option>)}
            </select>
          </div>
          <div className="col-lg-3">
            <label className="form-label">Quantity</label>
            <input type="number" min="1" className="form-control" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
          </div>
          <div className="col-lg-9">
            <label className="form-label">Instructions / notes (optional)</label>
            <input className="form-control" value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} placeholder="e.g. 1 tablet every 6 hours" />
          </div>
          {reqs.length > 0 && (
            <div className="col-12">
              <label className="form-label">This is for the resident's medicine request (optional)</label>
              <select className="form-select" value={form.request_id} onChange={(e) => setForm({ ...form, request_id: e.target.value })}>
                <option value="">— Not for a request —</option>
                {reqs.map((r) => <option key={r.id} value={r.id}>{r.medicine_name} · {new Date(r.created_at).toLocaleDateString('en-PH')}</option>)}
              </select>
            </div>
          )}
        </div>
        <button className="btn btn-primary-custom mt-3" disabled={busy}>{busy ? 'Saving...' : 'Give medicine'}</button>
      </form>
    </div>

    <div className="panel-card">
      <h5 className="mb-1">Dispense Logs &amp; Audit</h5>
      <p className="text-secondary small">Every dispense is taken automatically from the earliest-expiring batch first (FEFO). The batches used are listed per row.</p>
      <input className="form-control mb-3" placeholder="Search medicine, patient or staff" value={q} onChange={(e) => setQ(e.target.value)} />
      {error && <div className="alert alert-danger">{error}</div>}
      {loading ? <div className="text-secondary">Loading...</div> : shown.length === 0 ? (
        <div className="text-secondary">No dispense records.</div>
      ) : (
        <div className="table-responsive">
          <table className="table align-middle mb-0">
            <thead><tr><th>When</th><th>Medicine</th><th>Qty</th><th>Patient</th><th>Dispensed by</th><th>Batches used (FEFO)</th></tr></thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.id}>
                  <td className="small">{formatDateTime(r.created_at)}</td>
                  <td><strong>{r.medicine?.name}</strong></td>
                  <td>{r.quantity} {r.medicine?.unit}</td>
                  <td>{fullName(r.patient)}<div className="small text-secondary">{r.patient?.medical_id}</div></td>
                  <td>{fullName(r.by) || '—'}</td>
                  <td className="small">
                    {(r.allocations ?? []).map((a, i) => (
                      <div key={i}>{a.quantity} from batch {a.batch?.batch_no || '—'} <span className="text-secondary">(exp {formatDate(a.batch?.expiration_date)})</span></div>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
    </>
  );
}