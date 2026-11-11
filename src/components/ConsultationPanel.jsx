import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext.jsx';
import { formatDateTime } from '../lib/format.js';
import PatientPicker from './PatientPicker.jsx';
import { LabRequestBox, PatientLabResults } from './Laboratory.jsx';
import Modal from './Modal.jsx';
import { guessCategory } from '../lib/symptoms.js';

// Searchable medicine dropdown: type part of the name, pick from the list.
function MedicinePicker({ stock, value, onChange }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const chosen = stock.find((m) => m.id === value);
  if (chosen) {
    return (
      <div className="d-flex align-items-center justify-content-between border rounded px-3 py-2 bg-white">
        <span className="text-truncate"><strong>{chosen.name}</strong> <small className="text-secondary">({chosen.available_quantity} {chosen.unit})</small></span>
        <button type="button" className="btn btn-sm btn-outline-secondary ms-2" onClick={() => { onChange(''); setQ(''); }}>Change</button>
      </div>
    );
  }
  const term = q.trim().toLowerCase();
  const list = stock.filter((m) => !term || m.name.toLowerCase().includes(term));
  return (
    <div className="position-relative">
      <input className="form-control" placeholder="Search medicine..." value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)} />
      {open && (
        <div className="picker-list" style={{ maxHeight: 260, overflowY: 'auto' }}>
          {list.length === 0
            ? <div className="px-3 py-2 text-secondary">No medicine found.</div>
            : list.map((m) => (
              <button key={m.id} type="button" disabled={m.available_quantity === 0} onMouseDown={(e) => e.preventDefault()}
                onClick={() => { onChange(m.id); setOpen(false); }}>
                <strong>{m.name}</strong>
                <small className={`ms-2 ${m.available_quantity === 0 ? 'text-danger' : 'text-secondary'}`}>{m.available_quantity === 0 ? 'out of stock' : `${m.available_quantity} ${m.unit}`}</small>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}

const emptyLine = { medicine_id: '', quantity: '', instructions: '' };

export default function ConsultationPanel({ queueItem, onBack, onFinished, onLabRequested }) {
  const { user } = useAuth();
  const [patient, setPatient] = useState(queueItem?.patient ?? null);
  const [f, setF] = useState({ complaint: queueItem?.reason ?? '', diagnosis: '', notes: '' });
  const [lines, setLines] = useState([]);
  const [stock, setStock] = useState([]);
  const [vitals, setVitals] = useState(null);
  const [history, setHistory] = useState([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [records, setRecords] = useState(false);
  const [referral, setReferral] = useState(null);
  const labIds = (queueItem?.lab_requests ?? []).map((l) => l.id);
  const hasLab = labIds.length > 0;   // lab already requested for this visit -> no second request

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

  // Referred to a hospital -> the note says so automatically.
  const loadReferral = useCallback(async () => {
    if (!labIds.length) return;
    const { data } = await supabase.from('referrals').select('hospital').in('lab_request_id', labIds).order('created_at', { ascending: false }).limit(1);
    setReferral(data?.[0] ?? null);
  }, [queueItem?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { loadReferral(); }, [loadReferral]);
  useEffect(() => {
    if (!referral?.hospital) return;
    const line = `Referred to ${referral.hospital}.`;
    setF((x) => {
      if (x.notes.includes(line)) return x;
      const rest = x.notes.replace(/Referred to [^\n]*\.\s*/g, '').trim();
      return { ...x, notes: rest ? `${rest}\n${line}` : line };
    });
  }, [referral]);

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
      setMsg({ type: 'success', text: 'Consultation saved.' });
    }
    setF({ complaint: '', diagnosis: '', notes: '' });
    setLines([]);
    loadPatientData();
    supabase.from('public_medicine_stock').select('*').order('name').then(({ data }) => setStock(data ?? []));
    if (!failures.length) onFinished?.();
  }

  return (
    <>
      <div className="d-flex flex-wrap gap-2 mb-3">
        {onBack && <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onBack}><i className="bi bi-arrow-left me-1" />Back to queue</button>}
        <button type="button" className="btn btn-sm btn-outline-primary-custom" disabled={!patient} onClick={() => setRecords(true)}>
          <i className="bi bi-folder2-open me-1" />Previous records
        </button>
      </div>

      <form className="panel-card" onSubmit={submit}>
        <h5 className="mb-3">Clinical Note / EMR Entry</h5>
        <PatientPicker value={patient} onChange={setPatient} />
        {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}
        <fieldset disabled={!patient}>
          <div className="mb-3"><label className="form-label">Chief complaint</label>
            <input className="form-control" value={f.complaint} onChange={(e) => setF({ ...f, complaint: e.target.value })} /></div>
          <div className="mb-3"><label className="form-label required">Clinical impression</label>
            <input className="form-control" value={f.diagnosis} onChange={(e) => setF({ ...f, diagnosis: e.target.value })} required /></div>
          <div className="mb-3"><label className="form-label">Notes / treatment plan</label>
            <textarea rows="3" className="form-control" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></div>

          {hasLab && <PatientLabResults patient={patient} queueId={queueItem.id} title="Laboratory (this visit)" onChanged={loadReferral} />}
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
                  <MedicinePicker stock={stock} value={l.medicine_id} onChange={(v) => setLine(i, 'medicine_id', v)} />
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

      <Modal show={records} large title="Previous records" icon="bi-folder2-open" onClose={() => setRecords(false)}>
        {patient && (
          <>
            <h6 className="fw-bold">Latest vitals</h6>
            {!vitals ? <div className="text-secondary mb-3">No vitals recorded.</div> : (
              <ul className="list-unstyled mb-3">
                <li><strong>BP:</strong> {vitals.bp_systolic ? `${vitals.bp_systolic}/${vitals.bp_diastolic}` : '—'} · <strong>Temp:</strong> {vitals.temperature_c ? `${vitals.temperature_c} °C` : '—'} · <strong>Pulse:</strong> {vitals.pulse_rate ?? '—'}</li>
                <li><strong>Weight:</strong> {vitals.weight_kg ? `${vitals.weight_kg} kg` : '—'}{vitals.height_cm ? ` · ${vitals.height_cm} cm` : ''}</li>
                {vitals.chief_complaint && <li><strong>Complaint (BHW):</strong> {vitals.chief_complaint}</li>}
                <li className="small text-secondary">{formatDateTime(vitals.recorded_at)}</li>
              </ul>
            )}
            <PatientLabResults patient={patient} title="Latest laboratory" onChanged={loadReferral} />
            <h6 className="fw-bold">Previous visits</h6>
            {history.length === 0 ? <div className="text-secondary">None yet.</div> : (
              <ul className="list-unstyled mb-0">
                {history.map((h) => (
                  <li key={h.id} className="mb-2"><strong>{h.diagnosis || h.complaint || 'Visit'}</strong>
                    <div className="small text-secondary">{formatDateTime(h.consulted_at)}</div></li>
                ))}
              </ul>
            )}
          </>
        )}
      </Modal>
    </>
  );
}