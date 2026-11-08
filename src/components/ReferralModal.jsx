import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext.jsx';
import { calcAge, formatDate, fullName, ROLE_LABEL } from '../lib/format.js';
import { CLINIC_NAME, fullAddress } from '../lib/formPdf.js';

function savePdf(b64, name) {
  const bin = atob(b64);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) u8[i] = bin.charCodeAt(i);
  const url = URL.createObjectURL(new Blob([u8], { type: 'application/pdf' }));
  const a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export default function ReferralModal({ lab, patient: patientProp, onClose, onSaved }) {
  const { user, profile } = useAuth();
  const [patient, setPatient] = useState(null);
  const [vitals, setVitals] = useState(null);
  const [existing, setExisting] = useState(null);
  const [f, setF] = useState({ hospital: '', diagnosis: '', reason: 'Positive laboratory result — needs further evaluation and management at a hospital.', clinical_summary: '', treatment_given: '' });
  const [d, setD] = useState({ symptoms: '', hospital_address: '' });
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
      setVitals(v.data?.[0] ?? null);
      if (r.data?.[0]) { setExisting(r.data[0]); setF((x) => ({ ...x, ...r.data[0] })); setD((x) => ({ ...x, ...(r.data[0].details ?? {}) })); return; }
      const complaint = v.data?.[0]?.chief_complaint || c.data?.[0]?.complaint || '';
      setD((x) => ({ ...x, symptoms: complaint }));
      setF((x) => ({
        ...x,
        diagnosis: c.data?.[0]?.diagnosis ?? '',
        clinical_summary: [
          `${lab.tests}${lab.result_flag ? ` — ${lab.result_flag === 'abnormal' ? 'POSITIVE' : 'NEGATIVE'} result` : ''}.`,
          lab.result_notes && `Findings: ${lab.result_notes}`,
        ].filter(Boolean).join(' '),
      }));
    })();
  }, [lab, patientProp]);

  async function issue(sendEmail) {
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
    const notes = [];
    let type = 'success';
    const { data, error } = await supabase.functions.invoke('referral-send', { body: { referral_id: row.id, send: sendEmail } });
    const problem = error?.message || data?.error;
    if (problem) { type = 'warning'; notes.push(`Could not prepare the e-Slip: ${problem}`); }
    else {
      if (sendEmail) { notes.push(`e-Referral ${row.tracking_no ?? ''} was emailed to ${data.sent_to}.`); setExisting({ ...row, emailed_to: data.sent_to, emailed_at: new Date().toISOString() }); }
      if (data.pdf_base64) { savePdf(data.pdf_base64, data.filename); notes.push('The e-Slip PDF was downloaded.'); }
    }
    setMsg({ type, text: notes.join(' ') });
    setBusy(false);
  }
  const save = (e) => { e.preventDefault(); issue(Boolean(patient?.email)); };

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
                  {existing?.tracking_no && <div className="alert alert-light border py-2 small mb-2"><strong>Tracking No.:</strong> {existing.tracking_no}{existing.emailed_at && <> · emailed to <strong>{existing.emailed_to}</strong> on {formatDate(existing.emailed_at)}</>}</div>}
                  {locked && <div className="alert alert-info py-2">This referral was already issued. You can resend the email or download the e-Slip PDF again.</div>}
                  {!patient.email && <div className="alert alert-warning py-2">This patient has no email on file, so the e-Slip cannot be emailed. Add the email in the Master Patient List, or download the PDF instead.</div>}
                  <fieldset disabled={locked}>
                    <div className="mb-3"><label className="form-label required">Referred to (hospital / clinic)</label>
                      <input className="form-control" placeholder="e.g. Southern Isabela Medical Center" value={f.hospital} onChange={set('hospital')} required /></div>
                    <div className="mb-3"><label className="form-label required">Hospital address</label>
                      <input className="form-control" placeholder="e.g. Cabatuan Road, Santiago City, Isabela" value={d.hospital_address ?? ''} onChange={(e) => setD({ ...d, hospital_address: e.target.value })} required /></div>
                    <div className="mb-3"><label className="form-label">Impression / diagnosis</label>
                      <input className="form-control" placeholder="e.g. Suspected dengue" value={f.diagnosis ?? ''} onChange={set('diagnosis')} /></div>
                    <div className="mb-3"><label className="form-label">Symptoms seen</label>
                      <textarea rows="2" className="form-control" value={d.symptoms ?? ''} onChange={(e) => setD({ ...d, symptoms: e.target.value })} /></div>
                    <div className="mb-3"><label className="form-label">Laboratory findings</label>
                      <textarea rows="3" className="form-control" value={f.clinical_summary ?? ''} onChange={set('clinical_summary')} /></div>
                    <div className="mb-3"><label className="form-label">Treatment given</label>
                      <textarea rows="2" className="form-control" value={f.treatment_given ?? ''} onChange={set('treatment_given')} /></div>
                    <div className="mb-1"><label className="form-label required">Reason for referral</label>
                      <textarea rows="2" className="form-control" value={f.reason} onChange={set('reason')} required /></div>
                  </fieldset>
                </>
              )}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-outline-secondary" onClick={onClose}>Close</button>
              <button type="button" className="btn btn-outline-danger" disabled={!patient || busy || !f.hospital.trim() || !f.reason.trim() || !(d.hospital_address ?? '').trim()} onClick={() => issue(false)}>
                <i className="bi bi-file-earmark-pdf me-1" />{locked ? 'Download e-Slip PDF' : 'Save & download e-Slip PDF'}
              </button>
              <button className="btn btn-danger" disabled={!patient || busy || !patient?.email}>
                <i className="bi bi-send-check me-1" />{busy ? 'Sending...' : locked ? 'Resend e-Referral' : 'Approve & Send e-Referral'}
              </button>
            </div>
          </form>
        </div>
      </div>
      <div className="modal-backdrop fade show" />
    </>,
    document.body,
  );
}