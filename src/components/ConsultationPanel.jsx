import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext.jsx';
import { formatDateTime } from '../lib/format.js';
import PatientPicker from './PatientPicker.jsx';
import LabRequestBox from './LabRequestBox.jsx';
import PatientLabResults from './PatientLabResults.jsx';
import { guessCategory } from '../lib/symptoms.js';

const emptyLine = { medicine_id: '', quantity: '', instructions: '' };

export default function ConsultationPanel({ queueItem, onFinished, onLabRequested }) {
  const { user } = useAuth();
  const [patient, setPatient] = useState(queueItem?.patient ?? null);
  const [f, setF] = useState({ complaint: queueItem?.reason ?? '', diagnosis: '', notes: '' });
  const [lines, setLines] = useState([]);
  const [stock, setStock] = useState([]);
  const [vitals, setVitals] = useState(null);
  const [history, setHistory] = useState([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    supabase.from('public_medicine_stock').select('*').order('name').then(({ data }) => setStock(data ?? []));
  }, []);

  const loadPatientData = useCallback(async () => {
    if (!patient) { setVitals(null); setHistory([]); return; }
    const [v, h] = await Promise.all([
      supabase.from('vitals').select('*').eq('patient_id', patient.id).order('recorded_at', { ascending: false }).limit(1),
      supabase.from('consultations').select('id, complaint, diagnosis, consulted_at').eq('patient_id', patient.id)
        .order('consulted_at', { ascending: false }).limit(5),
    ]);
    setVitals(v.data?.[0] ?? null);
    setHistory(h.data ?? []);
  }, [patient]);

  useEffect(() => { loadPatientData(); }, [loadPatientData]);

  const setLine = (i, k, v) => setLines(lines.map((l, idx) => (idx === i ? { ...l, [k]: v } : l)));

  async function submit(e) {
    e.preventDefault();
    setMsg(null);
    const filled = lines.filter((l) => l.medicine_id || l.quantity);
    for (const l of filled) {
      if (!l.medicine_id || !(Number(l.quantity) > 0)) return setMsg({ type: 'danger', text: 'Each medicine line needs a medicine and a quantity above zero.' });
    }
    setBusy(true);

    const { data: consult, error } = await supabase.from('consultations').insert({
      patient_id: patient.id,
      complaint: f.complaint.trim() || null,
      symptom_category: queueItem?.vitals?.symptom_category || guessCategory(f.complaint) || null,
      diagnosis: f.diagnosis.trim() || null,
      notes: f.notes.trim() || null,
      consulted_by: user.id,
    }).select('id').single();
    if (error) { setBusy(false); return setMsg({ type: 'danger', text: error.message }); }

    const failures = [];
    for (const l of filled) {
      const { error: rxErr } = await supabase.rpc('dispense_medicine', {
        p_patient_id: patient.id,
        p_medicine_id: l.medicine_id,
        p_quantity: Number(l.quantity),
        p_consultation_id: consult.id,
        p_instructions: l.instructions.trim() || null,
      });
      if (rxErr) failures.push(`${stock.find((s) => s.id === l.medicine_id)?.name ?? 'Medicine'}: ${rxErr.message}`);
    }

    if (queueItem) await supabase.from('queue').update({ status: 'done' }).eq('id', queueItem.id);
    setBusy(false);

    if (failures.length) {
      setMsg({ type: 'warning', text: `Consultation saved, but these medicines were NOT dispensed — ${failures.join('; ')}` });
    } else {
      setMsg({ type: 'success', text: 'Consultation saved and medicines dispensed (earliest-expiring stock used first).' });
    }
    setF({ complaint: '', diagnosis: '', notes: '' });
    setLines([]);
    loadPatientData();
    supabase.from('public_medicine_stock').select('*').order('name').then(({ data }) => setStock(data ?? []));
    if (!failures.length) onFinished?.();
  }

  return (
    <div className="row g-4">
      <div className="col-lg-8">
        <form className="panel-card" onSubmit={submit}>
          <h5 className="mb-3">Clinical Note / EMR Entry</h5>
          <PatientPicker value={patient} onChange={setPatient} />
          {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}
          <fieldset disabled={!patient}>
            <div className="mb-3"><label className="form-label">Chief complaint</label>
              <input className="form-control" value={f.complaint} onChange={(e) => setF({ ...f, complaint: e.target.value })} /></div>
            <div className="mb-3"><label className="form-label required">Official diagnosis</label>
              <input className="form-control" value={f.diagnosis} onChange={(e) => setF({ ...f, diagnosis: e.target.value })} required /></div>
            <div className="mb-3"><label className="form-label">Notes / treatment plan</label>
              <textarea rows="3" className="form-control" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></div>

            <LabRequestBox embedded patient={patient} queueItem={queueItem} defaultNote={f.complaint} onRequested={onLabRequested} />

            <div className="d-flex justify-content-between align-items-center mb-2">
              <h6 className="fw-bold mb-0">E-Prescription (FEFO auto-dispense)</h6>
              <button type="button" className="btn btn-sm btn-outline-primary-custom" onClick={() => setLines([...lines, { ...emptyLine }])}>
                <i className="bi bi-plus-lg me-1" />Add medicine
              </button>
            </div>
            {lines.length === 0 && <div className="text-secondary small mb-3">No medicines prescribed.</div>}
            {lines.map((l, i) => {
              const s = stock.find((x) => x.id === l.medicine_id);
              return (
                <div className="row g-2 mb-2 align-items-end" key={i}>
                  <div className="col-md-5">
                    <select className="form-select" value={l.medicine_id} onChange={(e) => setLine(i, 'medicine_id', e.target.value)}>
                      <option value="">Select medicine</option>
                      {stock.map((m) => <option key={m.id} value={m.id} disabled={m.available_quantity === 0}>{m.name} ({m.available_quantity} {m.unit})</option>)}
                    </select>
                  </div>
                  <div className="col-md-2">
                    <input type="number" min="1" max={s?.available_quantity} className="form-control" placeholder="Qty" value={l.quantity} onChange={(e) => setLine(i, 'quantity', e.target.value)} />
                  </div>
                  <div className="col-md-4">
                    <input className="form-control" placeholder="Instructions (e.g. 1 tab every 6 hrs)" value={l.instructions} onChange={(e) => setLine(i, 'instructions', e.target.value)} />
                  </div>
                  <div className="col-md-1 text-end">
                    <button type="button" className="btn btn-outline-danger" onClick={() => setLines(lines.filter((_, idx) => idx !== i))} aria-label="Remove"><i className="bi bi-x-lg" /></button>
                  </div>
                </div>
              );
            })}
            <button className="btn btn-primary-custom mt-3" disabled={busy}>{busy ? 'Saving...' : 'Save consultation'}</button>
          </fieldset>
        </form>
      </div>

      <div className="col-lg-4">
        <PatientLabResults patient={patient} />
        <div className="panel-card mb-4">
          <h5 className="mb-3">Latest Vitals</h5>
          {!patient ? <div className="text-secondary">Select a patient.</div>
            : !vitals ? <div className="text-secondary">No vitals recorded.</div> : (
              <ul className="list-unstyled mb-0">
                <li><strong>BP:</strong> {vitals.bp_systolic ? `${vitals.bp_systolic}/${vitals.bp_diastolic}` : '—'}</li>
                <li><strong>Weight:</strong> {vitals.weight_kg ? `${vitals.weight_kg} kg` : '—'}{vitals.height_cm ? ` · ${vitals.height_cm} cm` : ''}</li>
                <li><strong>Temp:</strong> {vitals.temperature_c ? `${vitals.temperature_c} °C` : '—'}</li>
                <li><strong>Pulse:</strong> {vitals.pulse_rate ?? '—'}</li>
                {vitals.chief_complaint && <li><strong>Complaint (BHW):</strong> {vitals.chief_complaint}</li>}
                <li className="small text-secondary mt-1">{formatDateTime(vitals.recorded_at)}</li>
              </ul>
            )}
        </div>
        <div className="panel-card">
          <h5 className="mb-3">Previous Visits</h5>
          {history.length === 0 ? <div className="text-secondary">None yet.</div> : (
            <ul className="list-unstyled mb-0">
              {history.map((h) => (
                <li key={h.id} className="mb-2">
                  <strong>{h.diagnosis || h.complaint || 'Visit'}</strong>
                  <div className="small text-secondary">{formatDateTime(h.consulted_at)}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}