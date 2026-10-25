import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext.jsx';
import { fullName, formatDateTime, bmi, startOfTodayISO, calcAge } from '../lib/format.js';
import PatientPicker from './PatientPicker.jsx';
import { SYMPTOM_CATEGORIES, guessCategory, splitCategories, joinCategories } from '../lib/symptoms.js';

const blank = { bp_systolic: '', bp_diastolic: '', weight_kg: '', height_cm: '', temperature_c: '', pulse_rate: '', chief_complaint: '', symptom_category: '' };
const num = (v) => (v === '' ? null : Number(v));

export default function IntakePanel() {
  const { user } = useAuth();
  const [patient, setPatient] = useState(null);
  const [queueItem, setQueueItem] = useState(null);
  const [pending, setPending] = useState([]);
  const [f, setF] = useState(blank);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [catManual, setCatManual] = useState(false); 

  const loadPending = useCallback(async () => {
    const { data } = await supabase.from('queue')
      .select('id, created_at, reason, patient:patients(id, first_name, middle_name, last_name, suffix, birth_date, purok)')
      .eq('status', 'for_vitals').gte('created_at', startOfTodayISO()).order('created_at');
    setPending(data ?? []);
  }, []);

  useEffect(() => {
    loadPending();
    const channel = supabase.channel(`intake-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'queue' }, loadPending).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadPending]);

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  function setComplaint(e) {
    const text = e.target.value;
    setF({ ...f, chief_complaint: text, symptom_category: catManual ? f.symptom_category : guessCategory(text) });
  }

  function pick(p) {
    setPatient(p);
    setQueueItem(null);
    setMsg(null);
  }

  function takeVitals(item) {
    setPatient(item.patient);
    setQueueItem(item);
    const text = item.reason && item.reason !== 'New patient' ? item.reason : '';
    setCatManual(false);
    setF({ ...blank, chief_complaint: text, symptom_category: guessCategory(text) });
    setMsg(null);
  }

  async function checkIn() {
    setMsg(null);
    const { data: existing } = await supabase.from('queue').select('id')
      .eq('patient_id', patient.id).in('status', ['for_vitals', 'waiting', 'in_consultation']).gte('created_at', startOfTodayISO());
    if (existing?.length) return setMsg({ type: 'warning', text: 'This patient is already in today\'s queue.' });
    const { data, error } = await supabase.from('queue')
      .insert({ patient_id: patient.id, queued_by: user.id, status: 'for_vitals' }).select('id, created_at, reason').single();
    if (error) return setMsg({ type: 'danger', text: error.message });
    setQueueItem({ ...data, patient });
    setMsg({ type: 'success', text: 'Checked in. You can take the vital signs now.' });
  }

  async function submit(e) {
    e.preventDefault();
    setMsg(null);
    if (!f.chief_complaint.trim()) return setMsg({ type: 'danger', text: 'Chief complaint (sintomas) is required.' });
    if (!f.symptom_category) return setMsg({ type: 'danger', text: 'Please choose at least one symptom category.' });
    if ((f.bp_systolic === '') !== (f.bp_diastolic === '')) return setMsg({ type: 'danger', text: 'Enter both systolic and diastolic blood pressure.' });
    if (f.bp_systolic === '' && f.weight_kg === '' && f.height_cm === '' && f.temperature_c === '' && f.pulse_rate === '') {
      return setMsg({ type: 'danger', text: 'Enter at least one vital sign.' });
    }
    const range = (label, v, min, max, unit = '') => {
      if (v === '') return null;
      const n = Number(v);
      return n >= min && n <= max ? null : `${label} should be between ${min} and ${max}${unit}.`;
    };
    const problem =
      range('BP systolic', f.bp_systolic, 40, 300) || range('BP diastolic', f.bp_diastolic, 20, 200) ||
      (f.bp_systolic !== '' && Number(f.bp_systolic) <= Number(f.bp_diastolic) ? 'Systolic must be higher than diastolic.' : null) ||
      range('Temperature', f.temperature_c, 30, 45, ' °C') || range('Pulse', f.pulse_rate, 20, 250, ' bpm') ||
      range('Weight', f.weight_kg, 0.5, 500, ' kg') || range('Height', f.height_cm, 20, 250, ' cm');
    if (problem) return setMsg({ type: 'danger', text: problem });
    setBusy(true);
    const { data: vit, error } = await supabase.from('vitals').insert({
      patient_id: patient.id,
      bp_systolic: num(f.bp_systolic), bp_diastolic: num(f.bp_diastolic),
      weight_kg: num(f.weight_kg), height_cm: num(f.height_cm),
      temperature_c: num(f.temperature_c), pulse_rate: num(f.pulse_rate),
      chief_complaint: f.chief_complaint.trim(), symptom_category: f.symptom_category, recorded_by: user.id,
    }).select('id').single();
    if (error) { setBusy(false); return setMsg({ type: 'danger', text: error.message }); }

    let qid = queueItem?.id;
    if (!qid) {
      const { data: open } = await supabase.from('queue').select('id').eq('patient_id', patient.id)
        .eq('status', 'for_vitals').gte('created_at', startOfTodayISO()).limit(1);
      qid = open?.[0]?.id;
    }
    const handoff = { status: 'waiting', vitals_id: vit.id, reason: f.chief_complaint.trim() };
    const { error: qErr } = qid
      ? await supabase.from('queue').update(handoff).eq('id', qid)
      : await supabase.from('queue').insert({ patient_id: patient.id, queued_by: user.id, ...handoff });
    setBusy(false);
    if (qErr) return setMsg({ type: 'warning', text: `Vitals saved, but the patient could not be passed to the queue: ${qErr.message}` });

    setMsg({ type: 'success', text: `${fullName(patient)} was passed to the Midwife/Doctor queue.` });
    setPatient(null); setQueueItem(null); setF(blank); setCatManual(false);
    loadPending();
  }

  const b = bmi(f.weight_kg, f.height_cm);

  return (
    <div className="row g-4">
      <div className="col-lg-5">
        <div className="panel-card mb-4">
          <h5 className="mb-3">Waiting for Vitals <span className="badge bg-success ms-1">{pending.length}</span></h5>
          {pending.length === 0 ? <div className="text-secondary">No patients are waiting for vitals.</div> : (
            <ul className="list-unstyled mb-0">
              {pending.map((it) => (
                <li key={it.id} className="d-flex justify-content-between align-items-center border-bottom py-2">
                  <span><strong>{fullName(it.patient)}</strong>
                    <span className="small text-secondary d-block">{calcAge(it.patient?.birth_date)} yrs · {it.patient?.purok} · {formatDateTime(it.created_at)}</span></span>
                  <button className="btn btn-sm btn-primary-custom" onClick={() => takeVitals(it)}>Take vitals</button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="panel-card">
          <h5 className="mb-3">Find Resident</h5>
          <PatientPicker value={patient} onChange={pick} />
          {patient && !queueItem && (
            <button className="btn btn-outline-primary-custom" onClick={checkIn}>Check in for vitals</button>
          )}
        </div>
      </div>

      <div className="col-lg-7">
        <form className="panel-card" onSubmit={submit}>
          <h5 className="mb-3">Patient Intake — Vitals &amp; Triage</h5>
          {patient
            ? <div className="note-box mb-3"><strong>{fullName(patient)}</strong> · {calcAge(patient.birth_date)} yrs · {patient.purok}</div>
            : <div className="text-secondary mb-3">Pick someone from "Waiting for Vitals" or search a resident.</div>}
          {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}
          <fieldset disabled={!patient}>
            <div className="row g-3">
              <div className="col-6 col-md-3"><label className="form-label">BP systolic</label>
                <input type="number" className="form-control" placeholder="120" value={f.bp_systolic} onChange={set('bp_systolic')} /></div>
              <div className="col-6 col-md-3"><label className="form-label">BP diastolic</label>
                <input type="number" className="form-control" placeholder="80" value={f.bp_diastolic} onChange={set('bp_diastolic')} /></div>
              <div className="col-6 col-md-3"><label className="form-label">Temp (°C)</label>
                <input type="number" step="0.1" className="form-control" value={f.temperature_c} onChange={set('temperature_c')} /></div>
              <div className="col-6 col-md-3"><label className="form-label">Pulse (bpm)</label>
                <input type="number" className="form-control" value={f.pulse_rate} onChange={set('pulse_rate')} /></div>
              <div className="col-6 col-md-4"><label className="form-label">Weight (kg)</label>
                <input type="number" step="0.1" min="0" className="form-control" value={f.weight_kg} onChange={set('weight_kg')} /></div>
              <div className="col-6 col-md-4"><label className="form-label">Height (cm)</label>
                <input type="number" step="0.1" min="0" className="form-control" value={f.height_cm} onChange={set('height_cm')} /></div>
              <div className="col-12 col-md-4"><label className="form-label">BMI</label>
                <input className="form-control" value={b ?? '—'} readOnly /></div>
              <div className="col-12"><label className="form-label required">Chief complaint (sintomas)</label>
                <textarea rows="2" className="form-control" placeholder="e.g. Lagnat for three days" value={f.chief_complaint} onChange={setComplaint} /></div>
              <div className="col-12"><label className="form-label required">Symptom category (pwedeng more than one)</label>
                <div className="d-flex flex-wrap gap-2">
                  {SYMPTOM_CATEGORIES.map((c) => {
                    const sel = splitCategories(f.symptom_category);
                    const on = sel.includes(c);
                    return (
                      <button type="button" key={c}
                        className={`btn btn-sm ${on ? 'btn-primary-custom' : 'btn-outline-secondary'}`}
                        onClick={() => {
                          setCatManual(true);
                          const next = on ? sel.filter((x) => x !== c) : SYMPTOM_CATEGORIES.filter((x) => x === c || sel.includes(x));
                          setF({ ...f, symptom_category: joinCategories(next) });
                        }}>{on ? '✓ ' : ''}{c}</button>
                    );
                  })}
                  <button type="button" className="btn btn-sm btn-link" onClick={() => { setCatManual(true); setF({ ...f, symptom_category: joinCategories(SYMPTOM_CATEGORIES) }); }}>Select all</button>
                  <button type="button" className="btn btn-sm btn-link text-danger" onClick={() => { setCatManual(true); setF({ ...f, symptom_category: '' }); }}>Clear</button>
                </div>
                </div>
            </div>
            <button className="btn btn-primary-custom mt-3" disabled={busy}>{busy ? 'Saving...' : 'Save & pass to Midwife/Doctor'}</button>
          </fieldset>
        </form>
      </div>
    </div>
  );
}