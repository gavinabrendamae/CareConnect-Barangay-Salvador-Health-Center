import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext.jsx';
import { fullName, ROLE_LABEL, formatDate } from '../lib/format.js';
import { fullAddress, signRole } from '../lib/formPdf.js';
import { exportLabRequestPDF } from '../lib/labRequestForm.js';

const DEFAULT_NOTES = 'If the result is ABNORMAL, the patient may be admitted / managed by your hospital directly; a referral from the midwife is not required. If the result is NORMAL, the patient will upload a copy of the result to his/her CareConnect account and does not need to return to the health center.';

export default function OtherClinicModal({ patient: p, tests, symptoms, onClose, onProceed }) {
  const { profile } = useAuth();
  const [patient, setPatient] = useState(null);
  const [f, setF] = useState({ clinic: '', clinicAddress: '', symptoms: symptoms ?? '', notes: DEFAULT_NOTES });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    supabase.from('patients').select('*').eq('id', p.id).single().then(({ data }) => setPatient(data));
  }, [p.id]);

  async function act(mode) {
    if (!f.clinic.trim()) return setMsg({ type: 'danger', text: 'Please enter the hospital / clinic.' });
    setBusy(true); setMsg(null);
    const win = mode === 'print' ? window.open('', '_blank') : null; 
    try {
      await exportLabRequestPDF({ patient, clinic: f.clinic.trim(), clinicAddress: f.clinicAddress.trim(), symptoms: f.symptoms.trim(), notes: f.notes.trim(), tests, midwife: fullName(profile), midwifeRole: ROLE_LABEL[profile?.role], mode, win });
    } catch (err) { win?.close(); setBusy(false); return setMsg({ type: 'danger', text: err.message }); }
    const err = await onProceed?.(f.clinic.trim());
    setBusy(false);
    if (err) setMsg({ type: 'danger', text: `The form was created but the queue could not be updated: ${err}` });
  }
  const submit = (e) => { e.preventDefault(); e.stopPropagation(); act('save'); };
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  return createPortal(
    <>
      <div className="modal fade show d-block" tabIndex="-1" onClick={onClose}>
        <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable modal-lg" onClick={(e) => e.stopPropagation()}>
          <form className="modal-content" onSubmit={submit}>
            <div className="modal-header">
              <h5 className="modal-title fw-bold"><i className="bi bi-building me-2" />Request to other clinic — Laboratory Request Form</h5>
              <button type="button" className="btn-close" onClick={onClose} aria-label="Close" />
            </div>
            <div className="modal-body">
              {!patient ? <div className="text-secondary">Loading...</div> : (
                <>
                  <div className="text-center mb-3">
                    <div className="fw-bold">BARANGAY SALVADOR HEALTH CENTER</div>
                    <div className="small text-secondary">Salvador, Santiago City 3311 · {formatDate(new Date().toISOString())}</div>
                  </div>
                  {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}
                  <div className="row g-3">
                    <div className="col-md-6"><label className="form-label required">Referred to (hospital / clinic)</label>
                      <input className="form-control" value={f.clinic} onChange={set('clinic')} required /></div>
                    <div className="col-md-6"><label className="form-label">Address of the clinic</label>
                      <input className="form-control" value={f.clinicAddress} onChange={set('clinicAddress')} /></div>
                  </div>
                  <div className="ref-box my-3 small">
                    <div><strong>Patient:</strong> {fullName(patient)} · {patient.gender ?? '—'} · {patient.medical_id ?? '—'}</div>
                    <div><strong>Birthday:</strong> {patient.birth_date ? formatDate(patient.birth_date) : '—'} · <strong>Contact:</strong> {patient.contact_number ?? '—'}</div>
                    <div><strong>Address:</strong> {fullAddress(patient)}</div>
                  </div>
                  <div className="mb-3"><label className="form-label">Symptoms of patient</label>
                    <textarea rows="2" className="form-control" value={f.symptoms} onChange={set('symptoms')} /></div>
                  <div className="mb-3"><label className="form-label fw-bold">Laboratory test request</label>
                    <ul className="mb-0">{tests.map((t) => <li key={t}>{t}</li>)}</ul></div>
                  <div><label className="form-label fw-bold">Notes (printed on the form)</label>
                    <textarea rows="4" className="form-control" value={f.notes} onChange={set('notes')} /></div>
                  <div className="small text-secondary mt-3">After Print or Download, the patient moves to <strong>Laboratory — waiting</strong> and you can call the next patient.</div>
                  <div className="small text-secondary mt-1">Attending {signRole(ROLE_LABEL[profile?.role])}: {fullName(profile)}</div>
                </>
              )}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-outline-secondary" onClick={onClose}>Close</button>
              <button type="button" className="btn btn-outline-primary-custom" disabled={!patient || busy} onClick={() => act('print')}><i className="bi bi-printer me-1" />Print</button>
              <button className="btn btn-primary-custom" disabled={!patient || busy}><i className="bi bi-file-earmark-pdf me-1" />{busy ? 'Preparing...' : 'Download PDF'}</button>
            </div>
          </form>
        </div>
      </div>
      <div className="modal-backdrop fade show" />
    </>,
    document.body,
  );
}