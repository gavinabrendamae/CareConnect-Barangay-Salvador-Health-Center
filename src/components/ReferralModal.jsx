import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext.jsx';
import { calcAge, formatDate, fullName, ROLE_LABEL } from '../lib/format.js';
import { exportReferralPDF, FAMILY_ILLNESSES } from '../lib/referral.js';
import { CLINIC_NAME, fullAddress } from '../lib/formPdf.js';

export default function ReferralModal({ lab, patient: patientProp, onClose, onSaved }) {
  const { user, profile } = useAuth();
  const [patient, setPatient] = useState(null);
  const [vitals, setVitals] = useState(null);
  const [existing, setExisting] = useState(null);
  const [f, setF] = useState({ hospital: '', diagnosis: '', reason: 'Abnormal laboratory result — needs further evaluation and management at a hospital.', clinical_summary: '', treatment_given: '' });
  const [d, setD] = useState({ spouse_name: '', spouse_birth: '', symptoms: '', philhealth: '', family: {} });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    (async () => {
      const pid = patientProp?.id ?? lab.patient_id;
      const [p, v, r, c] = await Promise.all([
        supabase.from('patients').select('*').eq('id', pid).single(),
        supabase.from('vitals').select('*').eq('patient_id', pid).order('recorded_at', { ascending: false }).limit(1),
        supabase.from('referrals').select('*').eq('lab_request_id', lab.id).order('created_at', { ascending: false }).limit(1),
        supabase.from('consultations').select('diagnosis, complaint').eq('patient_id', pid).order('consulted_at', { ascending: false }).limit(1),
      ]);
      setPatient(p.data);
      let guardian = null;
      if (p.data?.household_head_id) {
        const g = await supabase.from('patients').select('first_name, middle_name, last_name, suffix, birth_date').eq('id', p.data.household_head_id).single();
        guardian = g.data ?? null;
      }
      setVitals(v.data?.[0] ?? null);
      if (r.data?.[0]) { setExisting(r.data[0]); setF((x) => ({ ...x, ...r.data[0] })); setD((x) => ({ ...x, ...(r.data[0].details ?? {}) })); return; }
      const complaint = v.data?.[0]?.chief_complaint || c.data?.[0]?.complaint || '';
      setD((x) => ({ ...x, symptoms: complaint, spouse_name: guardian ? fullName(guardian) : x.spouse_name, spouse_birth: guardian?.birth_date ?? x.spouse_birth }));
      setF((x) => ({
        ...x,
        diagnosis: c.data?.[0]?.diagnosis ?? '',
        clinical_summary: [
          `${lab.tests}${lab.result_flag ? ` — ${lab.result_flag.toUpperCase()} result` : ''}.`,
          lab.result_notes && `Findings: ${lab.result_notes}`,
        ].filter(Boolean).join(' '),
      }));
    })();
  }, [lab, patientProp]);

  async function save(e) {
    e.preventDefault();
    setMsg(null);
    setBusy(true);
    let row = existing;
    if (!row) {
      const { data, error } = await supabase.from('referrals').insert({
        patient_id: patient.id, lab_request_id: lab.id, hospital: f.hospital.trim(), diagnosis: f.diagnosis.trim() || null,
        reason: f.reason.trim(), clinical_summary: f.clinical_summary.trim() || null, treatment_given: f.treatment_given.trim() || null, referred_by: user.id, details: d,
      }).select().single();
      if (error) { setBusy(false); return setMsg({ type: 'danger', text: error.message }); }
      row = data;
      setExisting(row);
      onSaved?.();
    }
    try {
      await exportReferralPDF({ patient, vitals, referral: row, referredBy: fullName(profile), referredRole: ROLE_LABEL[profile?.role] });
      setMsg({ type: 'success', text: 'Referral saved and the PDF was downloaded. Print it and hand it to the patient.' });
    } catch (err) { setMsg({ type: 'danger', text: err.message }); }
    setBusy(false);
  }

  const locked = Boolean(existing);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  return createPortal(
    <>
      <div className="modal fade show d-block" tabIndex="-1" onClick={onClose}>
        <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable modal-xl" onClick={(e) => e.stopPropagation()}>
          <form className="modal-content" onSubmit={save}>
            <div className="modal-header">
              <h5 className="modal-title fw-bold"><i className="bi bi-hospital text-danger me-2" />Referral Form</h5>
              <button type="button" className="btn-close" onClick={onClose} aria-label="Close" />
            </div>
            <div className="modal-body">
              {!patient ? <div className="text-secondary">Loading...</div> : (
                <>
                  <div className="text-center mb-3">
                    <div className="fw-bold">{CLINIC_NAME}</div>
                    <div className="small text-secondary">Salvador, Santiago City 3311 · {formatDate(existing?.created_at ?? new Date().toISOString())}</div>
                  </div>
                  <div className="ref-box mb-3">
                    <div className="row g-2 small">
                      <div className="col-md-6"><strong>Patient:</strong> {fullName(patient)}</div>
                      <div className="col-md-3"><strong>Age/Sex:</strong> {calcAge(patient.birth_date)} / {patient.gender ?? '—'}</div>
                      <div className="col-md-3"><strong>ID:</strong> {patient.medical_id ?? '—'}</div>
                      <div className="col-md-9"><strong>Address:</strong> {fullAddress(patient)}</div>
                      <div className="col-md-3"><strong>Contact:</strong> {patient.contact_number ?? '—'}</div>
                      {vitals && <div className="col-12"><strong>Vitals:</strong> BP {vitals.bp_systolic ? `${vitals.bp_systolic}/${vitals.bp_diastolic}` : '—'} · Temp {vitals.temperature_c ?? '—'} °C · Pulse {vitals.pulse_rate ?? '—'} · Wt {vitals.weight_kg ?? '—'} kg</div>}
                    </div>
                  </div>
                  {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}
                  {locked && <div className="alert alert-info py-2">This referral was already issued. You can download the PDF again.</div>}
                  <fieldset disabled={locked}>
                    <div className="mb-3"><label className="form-label required">Referred to (hospital / clinic)</label>
                      <input className="form-control" placeholder="e.g. Southern Isabela Medical Center" value={f.hospital} onChange={set('hospital')} required /></div>
                    <div className="mb-3"><label className="form-label">Impression / diagnosis</label>
                      <input className="form-control" placeholder="e.g. Suspected dengue" value={f.diagnosis ?? ''} onChange={set('diagnosis')} /></div>
                    <div className="row g-2 mb-3">
                      <div className="col-md-7"><label className="form-label">Name of Spouse / Guardian</label>
                        <input className="form-control" value={d.spouse_name ?? ''} onChange={(e) => setD({ ...d, spouse_name: e.target.value })} /></div>
                      <div className="col-md-5"><label className="form-label">Birthday</label>
                        <input type="date" className="form-control" value={d.spouse_birth ?? ''} onChange={(e) => setD({ ...d, spouse_birth: e.target.value })} /></div>
                    </div>
                    <div className="mb-3"><label className="form-label">Symptoms seen</label>
                      <textarea rows="2" className="form-control" value={d.symptoms ?? ''} onChange={(e) => setD({ ...d, symptoms: e.target.value })} /></div>
                    <div className="mb-3"><label className="form-label">Laboratory findings</label>
                      <textarea rows="3" className="form-control" value={f.clinical_summary ?? ''} onChange={set('clinical_summary')} /></div>
                    <div className="mb-3"><label className="form-label">Treatment given</label>
                      <textarea rows="2" className="form-control" value={f.treatment_given ?? ''} onChange={set('treatment_given')} /></div>
                    <div className="mb-1"><label className="form-label required">Reason for referral</label>
                      <textarea rows="2" className="form-control" value={f.reason} onChange={set('reason')} required /></div>
                    <div className="mt-3 mb-2 fw-bold">Are you a member of PhilHealth?
                      {['yes', 'no'].map((o) => (
                        <label key={o} className="ms-3 fw-normal"><input type="radio" className="form-check-input me-1" name="ph" checked={d.philhealth === o} onChange={() => setD({ ...d, philhealth: o })} />{o === 'yes' ? 'Yes' : 'No'}</label>
                      ))}
                    </div>
                    <div className="fw-bold mb-1">History of the family to the following illness:</div>
                    <table className="table table-sm table-bordered mb-0 align-middle">
                      <thead><tr><th>Illness</th><th className="text-center" style={{ width: 80 }}>Yes</th><th className="text-center" style={{ width: 80 }}>No</th></tr></thead>
                      <tbody>
                        {FAMILY_ILLNESSES.map((ill) => (
                          <tr key={ill}><td>{ill}</td>
                            {['yes', 'no'].map((o) => (
                              <td className="text-center" key={o}><input type="radio" className="form-check-input" name={`fam-${ill}`} checked={d.family?.[ill] === o} onChange={() => setD({ ...d, family: { ...d.family, [ill]: o } })} /></td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </fieldset>
                </>
              )}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-outline-secondary" onClick={onClose}>Close</button>
              <button className="btn btn-danger" disabled={!patient || busy}><i className="bi bi-file-earmark-pdf me-1" />{busy ? 'Saving...' : locked ? 'Download PDF again' : 'Save & download PDF'}</button>
            </div>
          </form>
        </div>
      </div>
      <div className="modal-backdrop fade show" />
    </>,
    document.body,
  );
}