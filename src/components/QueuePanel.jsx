import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext.jsx';
import { fullName, formatDateTime, calcAge } from '../lib/format.js';
import { useQueueCounts } from '../lib/useQueueCounts.js';
import PatientPicker from './PatientPicker.jsx';

const BADGE = { waiting: 'warning', in_consultation: 'primary' };
const LABEL = { waiting: 'Waiting', in_consultation: 'In consultation' };

export default function QueuePanel({ onStartConsult, onOpenLab }) {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [patient, setPatient] = useState(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const q = useQueueCounts();

  const load = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('queue')
      .select('id, status, reason, created_at, patient:patients(id, first_name, middle_name, last_name, suffix, birth_date, purok), vitals:vitals(bp_systolic, bp_diastolic, temperature_c, weight_kg, height_cm, pulse_rate, chief_complaint, symptom_category), lab_requests(id, tests, status, result_flag, outside_clinic, patient_uploaded, reviewed_at)')
      .in('status', ['waiting', 'in_consultation', 'awaiting_lab'])
      .order('created_at');
    if (err) setError(err.message); else setItems(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const channel = supabase
      .channel(`queue-live-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'queue' }, load)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load]);

  async function addToQueue(e) {
    e.preventDefault();
    if (!patient) return;
    setError('');
    const { error: err } = await supabase.from('queue').insert({ patient_id: patient.id, queued_by: user.id, reason: reason || null });
    if (err) return setError(err.message);
    setPatient(null); setReason('');
    load();
  }

  const active = items.filter((i) => i.status !== 'awaiting_lab');
  const labWait = items.filter((i) => i.status === 'awaiting_lab');

  async function setStatus(id, status) {
    const { error: err } = await supabase.from('queue').update({ status }).eq('id', id);
    if (err) setError(err.message); else load();
  }

  async function start(item) {
    await setStatus(item.id, 'in_consultation');
    onStartConsult({ ...item, status: 'in_consultation' });
  }

  return (
    <>
    <div className="row g-3 mb-3">
      {[
        ['Waiting for consultation', q.waiting, 'warning', 'bi-hourglass-split'],
        ['In consultation', q.inConsult, 'primary', 'bi-person-check'],
        ['With BHW (vitals pending)', q.forVitals, 'secondary', 'bi-heart-pulse'],
      ].map(([label, n, color, icon]) => (
        <div className="col-12 col-md-4" key={label}>
          <div className="panel-card d-flex align-items-center gap-3 py-3">
            <i className={`bi ${icon} fs-2 text-${color}`} />
            <div><div className="fs-3 fw-bold lh-1">{n}</div><div className="small text-secondary">{label}</div></div>
          </div>
        </div>
      ))}
    </div>
    <div>
        <div className="panel-card">
          <h5 className="mb-3">Patient Queue <span className="badge bg-success ms-1">{active.length}</span></h5>
          {error && <div className="alert alert-danger">{error}</div>}
          {loading ? <div className="text-secondary">Loading...</div> : active.length === 0 ? (
            <div className="text-secondary">No patients in the queue.</div>
          ) : (
            <div className="table-responsive">
              <table className="table align-middle mb-0">
                <thead><tr><th>#</th><th>Patient</th><th>Complaint</th><th>Vitals (BHW)</th><th>Since</th><th>Status</th><th /></tr></thead>
                <tbody>
                  {active.map((it, i) => (
                    <tr key={it.id}>
                      <td>{i + 1}</td>
                      <td><strong>{fullName(it.patient)}</strong><div className="small text-secondary">{calcAge(it.patient?.birth_date)} yrs · {it.patient?.purok}</div></td>
                      <td>{it.reason || '—'}{it.lab_requests?.some((l) => l.status === 'resulted') && <div><span className={`badge ${it.lab_requests.some((l) => l.result_flag === 'abnormal') ? 'bg-danger' : 'bg-success'}`}><i className="bi bi-eyedropper me-1" />Lab result ready{it.lab_requests.some((l) => l.result_flag === 'abnormal') ? ' · ABNORMAL' : ''}</span></div>}{it.vitals?.symptom_category && <div><span className="badge bg-light text-dark border">{it.vitals.symptom_category}</span></div>}</td>
                      <td className="small">
                        {it.vitals ? (
                          <>
                            <div>BP {it.vitals.bp_systolic ? `${it.vitals.bp_systolic}/${it.vitals.bp_diastolic}` : '—'} · {it.vitals.temperature_c ? `${it.vitals.temperature_c} °C` : '— °C'}</div>
                            <div className="text-secondary">{it.vitals.weight_kg ? `${it.vitals.weight_kg} kg` : '— kg'} · {it.vitals.height_cm ? `${it.vitals.height_cm} cm` : '— cm'}</div>
                          </>
                        ) : <span className="text-secondary">No vitals</span>}
                      </td>
                      <td className="small">{formatDateTime(it.created_at)}</td>
                      <td><span className={`badge bg-${BADGE[it.status]}`}>{LABEL[it.status]}</span></td>
                      <td className="text-end text-nowrap">
                        {onStartConsult && (
                          <button className="btn btn-sm btn-primary-custom me-1" onClick={() => start(it)}>
                            {it.status === 'in_consultation' ? 'Resume' : 'Start consultation'}
                          </button>
                        )}
                        <button className="btn btn-sm btn-outline-secondary me-1" onClick={() => setStatus(it.id, 'done')}>Done</button>
                        <button className="btn btn-sm btn-outline-danger" onClick={() => setStatus(it.id, 'cancelled')}>Cancel</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="panel-card mt-4">
          <h5 className="mb-3"><i className="bi bi-hourglass-split me-2 text-warning" />Waiting for Lab Results <span className="badge bg-warning text-dark ms-1">{labWait.length}</span></h5>
          {labWait.length === 0 ? <div className="text-secondary">No patients waiting for lab results.</div> : labWait.map((it) => (
            <div key={it.id} className="d-flex flex-wrap justify-content-between align-items-center gap-2 border-bottom py-2">
              <div>
                <strong>{fullName(it.patient)}</strong>
                <div className="small text-secondary">{(it.lab_requests ?? []).filter((l) => l.status === 'pending' || (l.patient_uploaded && !l.reviewed_at)).map((l) => l.tests).join('; ') || 'Laboratory'} · since {formatDateTime(it.created_at)}</div>
                {(it.lab_requests ?? []).some((l) => l.outside_clinic && l.status === 'pending') && <span className="badge bg-secondary me-1"><i className="bi bi-building me-1" />At other clinic — waiting for upload</span>}
                {(it.lab_requests ?? []).some((l) => l.patient_uploaded && !l.reviewed_at) && <span className="badge bg-success"><i className="bi bi-cloud-check me-1" />Uploaded by patient — needs review</span>}
              </div>
              <div className="text-nowrap">
                {onOpenLab && <button className="btn btn-sm btn-primary-custom me-1" onClick={onOpenLab}>{(it.lab_requests ?? []).some((l) => l.patient_uploaded && !l.reviewed_at) ? 'Review result' : 'Add result'}</button>}
                <button className="btn btn-sm btn-outline-danger" onClick={() => setStatus(it.id, 'cancelled')}>Cancel</button>
              </div>
            </div>
          ))}
        </div>
        <form className="panel-card mt-4" onSubmit={addToQueue}>
          <h5 className="mb-1">Add Walk-in to Queue</h5>
          <p className="text-secondary small mb-3">Patients normally arrive here automatically once the BHW has taken their vitals. Use this only to skip the vitals step.</p>
          <div className="row g-3 align-items-start">
            <div className="col-md-5"><PatientPicker value={patient} onChange={setPatient} /></div>
            <div className="col-md-5">
              <label className="form-label">Reason / chief complaint</label>
              <input className="form-control" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Fever, check-up" />
            </div>
            <div className="col-md-2 d-grid" style={{ paddingTop: 32 }}>
              <button className="btn btn-primary-custom" disabled={!patient}>Add to queue</button>
            </div>
          </div>
        </form>
    </div>
    </>
  );
}