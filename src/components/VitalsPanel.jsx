import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext.jsx';
import { formatDateTime } from '../lib/format.js';
import PatientPicker from './PatientPicker.jsx';

const blank = { bp_systolic: '', bp_diastolic: '', weight_kg: '', temperature_c: '', pulse_rate: '' };
const num = (v) => (v === '' ? null : Number(v));

export default function VitalsPanel({ initialPatient = null }) {
  const { user } = useAuth();
  const [patient, setPatient] = useState(initialPatient);
  const [f, setF] = useState(blank);
  const [history, setHistory] = useState([]);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  const loadHistory = useCallback(async () => {
    if (!patient) { setHistory([]); return; }
    const { data } = await supabase.from('vitals').select('*').eq('patient_id', patient.id)
      .order('recorded_at', { ascending: false }).limit(10);
    setHistory(data ?? []);
  }, [patient]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setMsg(null);
    if (Object.values(f).every((v) => v === '')) return setMsg({ type: 'danger', text: 'Enter at least one vital sign.' });
    if ((f.bp_systolic === '') !== (f.bp_diastolic === '')) return setMsg({ type: 'danger', text: 'Enter both systolic and diastolic blood pressure.' });
    setBusy(true);
    const { error } = await supabase.from('vitals').insert({
      patient_id: patient.id,
      bp_systolic: num(f.bp_systolic), bp_diastolic: num(f.bp_diastolic),
      weight_kg: num(f.weight_kg), temperature_c: num(f.temperature_c), pulse_rate: num(f.pulse_rate),
      recorded_by: user.id,
    });
    setBusy(false);
    if (error) return setMsg({ type: 'danger', text: error.message });
    setMsg({ type: 'success', text: 'Vital signs saved.' });
    setF(blank);
    loadHistory();
  }

  return (
    <div className="row g-4">
      <div className="col-lg-5">
        <form className="panel-card" onSubmit={submit}>
          <h5 className="mb-3">Log Vital Signs</h5>
          <PatientPicker value={patient} onChange={setPatient} />
          {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}
          <fieldset disabled={!patient}>
            <div className="row g-3">
              <div className="col-6"><label className="form-label">BP systolic</label>
                <input type="number" className="form-control" placeholder="120" value={f.bp_systolic} onChange={set('bp_systolic')} /></div>
              <div className="col-6"><label className="form-label">BP diastolic</label>
                <input type="number" className="form-control" placeholder="80" value={f.bp_diastolic} onChange={set('bp_diastolic')} /></div>
              <div className="col-6"><label className="form-label">Weight (kg)</label>
                <input type="number" step="0.1" min="0" className="form-control" value={f.weight_kg} onChange={set('weight_kg')} /></div>
              <div className="col-6"><label className="form-label">Temperature (°C)</label>
                <input type="number" step="0.1" className="form-control" value={f.temperature_c} onChange={set('temperature_c')} /></div>
              <div className="col-6"><label className="form-label">Pulse (bpm)</label>
                <input type="number" className="form-control" value={f.pulse_rate} onChange={set('pulse_rate')} /></div>
            </div>
            <button className="btn btn-primary-custom mt-3" disabled={busy}>{busy ? 'Saving...' : 'Save vitals'}</button>
          </fieldset>
        </form>
      </div>
      <div className="col-lg-7">
        <div className="panel-card">
          <h5 className="mb-3">Recent Vitals</h5>
          {!patient ? <div className="text-secondary">Select a patient to see their history.</div>
            : history.length === 0 ? <div className="text-secondary">No vitals recorded yet.</div> : (
              <div className="table-responsive">
                <table className="table mb-0">
                  <thead><tr><th>When</th><th>BP</th><th>Weight</th><th>Temp</th><th>Pulse</th></tr></thead>
                  <tbody>
                    {history.map((v) => (
                      <tr key={v.id}>
                        <td className="small">{formatDateTime(v.recorded_at)}</td>
                        <td>{v.bp_systolic ? `${v.bp_systolic}/${v.bp_diastolic}` : '—'}</td>
                        <td>{v.weight_kg ? `${v.weight_kg} kg` : '—'}</td>
                        <td>{v.temperature_c ? `${v.temperature_c} °C` : '—'}</td>
                        <td>{v.pulse_rate ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
        </div>
      </div>
    </div>
  );
}
