import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext.jsx';
import { compressImage } from '../lib/image.js';
import { formatDateTime, fullName } from '../lib/format.js';
import { LAB_TESTS } from '../lib/labTests.js';
import ReferralModal from './ReferralModal.jsx';
import OtherClinicModal from './OtherClinicModal.jsx';

// ALL laboratory code in one file:
//   LabCard            one lab request (upload result / view / review / refer)
//   LabRequestBox      "Request laboratory" in the Clinical Note
//   PatientLabResults  lab requests of one patient
//   usePendingLabs     badge count for the Laboratory Queue tab
//   LabQueuePanel      Laboratory Queue tab (default export, Admin + BHW)

// ───────────── LabCard ─────────────
function useSignedUrl(path) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    let live = true;
    if (!path) { setUrl(null); return undefined; }
    supabase.storage.from('lab-results').createSignedUrl(path, 3600).then(({ data }) => { if (live) setUrl(data?.signedUrl ?? null); });
    return () => { live = false; };
  }, [path]);
  return url;
}

// One laboratory request: pending → upload the result photo; resulted → view + refer to hospital.
export function LabCard({ lab, showPatient = false, onChanged }) {
  const { user } = useAuth();
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [flag, setFlag] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [referring, setReferring] = useState(false);
  const [zoom, setZoom] = useState(false);
  const imgUrl = useSignedUrl(lab.result_path);
  const referred = (lab.referrals ?? []).length > 0;
  const needsReview = lab.patient_uploaded && !lab.reviewed_at;

  useEffect(() => {
    if (!file) { setPreview(null); return undefined; }
    const u = URL.createObjectURL(file);
    setPreview(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);

  async function submitResult(e) {
    e.preventDefault();
    setMsg(null);
    if (!file) return setMsg({ type: 'danger', text: 'Please attach a photo of the result.' });
    if (!flag) return setMsg({ type: 'danger', text: 'Mark the result as Positive or Negative.' });
    setBusy(true);
    try {
      const blob = await compressImage(file);
      const path = `${lab.patient_id}/${lab.id}-${Date.now()}.jpg`;
      const up = await supabase.storage.from('lab-results').upload(path, blob, { contentType: 'image/jpeg' });
      if (up.error) throw new Error(up.error.message);
      const { error } = await supabase.from('lab_requests').update({
        status: 'resulted', result_path: path, result_flag: flag, result_notes: notes.trim() || null,
        resulted_by: user.id, resulted_at: new Date().toISOString(),
      }).eq('id', lab.id);
      if (error) throw new Error(error.message);
      setFile(null); setFlag(''); setNotes('');
      onChanged?.();
    } catch (err) {
      setMsg({ type: 'danger', text: err.message });
    }
    setBusy(false);
  }

  async function review(e) {
    e.preventDefault();
    setMsg(null);
    if (!flag) return setMsg({ type: 'danger', text: 'Mark the result as Positive or Negative.' });
    setBusy(true);
    const { error } = await supabase.from('lab_requests').update({
      result_flag: flag, reviewed_at: new Date().toISOString(), resulted_by: user.id,
      result_notes: [lab.result_notes, notes.trim()].filter(Boolean).join(' · ') || null,
    }).eq('id', lab.id);
    if (error) { setBusy(false); return setMsg({ type: 'danger', text: error.message }); }
    setBusy(false); setFlag(''); setNotes('');
    onChanged?.();
  }

  const pending = lab.status === 'pending';

  return (
    <div className={`lab-card${lab.result_flag === 'abnormal' ? ' abnormal' : ''}`}>
      <div className="d-flex flex-wrap justify-content-between gap-2">
        <div>
          {showPatient && <div className="fw-bold">{fullName(lab.patient)}</div>}
          <div className={showPatient ? 'small' : 'fw-bold'}><i className="bi bi-eyedropper me-1 text-success" />{lab.tests}</div>
          <div className="small text-secondary">Requested {formatDateTime(lab.requested_at)}</div>
          {lab.notes && <div className="small mt-1"><strong>Suspected impression:</strong> <em>{lab.notes}</em></div>}
          {lab.outside_clinic && <div className="small"><span className="badge bg-secondary"><i className="bi bi-building me-1" />Other clinic: {lab.outside_clinic}</span>{lab.patient_uploaded && <span className="badge bg-success ms-1">Uploaded by patient</span>}</div>}
        </div>
        <div className="text-end">
          {pending ? <span className="badge bg-warning text-dark">Waiting for result</span>
            : needsReview ? <span className="badge bg-info text-dark">For review</span>
            : <span className={`badge ${lab.result_flag === 'abnormal' ? 'bg-danger' : 'bg-success'}`}>{lab.result_flag === 'abnormal' ? 'Positive' : 'Negative'}</span>}
          {referred && <div><span className="badge bg-dark mt-1"><i className="bi bi-hospital me-1" />Referred</span></div>}
        </div>
      </div>

      {pending ? (
        <form className="mt-3" onSubmit={submitResult}>
          {msg && <div className={`alert alert-${msg.type} py-2`}>{msg.text}</div>}
          <label className="form-label small fw-bold">Result photo</label>
          <input type="file" accept="image/*" capture="environment" className="form-control mb-2" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          {preview && <img src={preview} alt="Result preview" className="lab-img mb-2" />}
          <div className="small text-secondary mb-1">Compare with the suspected impression above: Positive if it matches, Negative if it does not.</div>
          <div className="d-flex flex-column gap-1 mb-2">
            <div className="form-check"><input className="form-check-input" type="radio" name={`flag-${lab.id}`} id={`n-${lab.id}`} checked={flag === 'normal'} onChange={() => setFlag('normal')} /><label className="form-check-label" htmlFor={`n-${lab.id}`}>Negative <span className="text-secondary">(does not match the suspected impression)</span></label></div>
            <div className="form-check"><input className="form-check-input" type="radio" name={`flag-${lab.id}`} id={`a-${lab.id}`} checked={flag === 'abnormal'} onChange={() => setFlag('abnormal')} /><label className="form-check-label text-danger fw-bold" htmlFor={`a-${lab.id}`}>Positive <span className="fw-normal">(matches the suspected impression)</span></label></div>
          </div>
          <input className="form-control form-control-sm mb-2" placeholder="Findings (e.g. Dengue NS1 positive, platelets 90k)" value={notes} onChange={(e) => setNotes(e.target.value)} />
          <button className="btn btn-sm btn-primary-custom" disabled={busy}>{busy ? 'Uploading...' : 'Save result'}</button>
        </form>
      ) : (
        <div className="mt-3">
          {lab.result_notes && <div className="mb-2"><strong>Findings:</strong> {lab.result_notes}</div>}
          {imgUrl ? <img src={imgUrl} alt="Lab result" className="lab-img" onClick={() => setZoom(true)} style={{ cursor: 'zoom-in' }} /> : lab.result_path && <div className="text-secondary small">Loading photo...</div>}
          <div className="small text-secondary mt-1">Result added {formatDateTime(lab.resulted_at)}</div>
          {needsReview && (
            <form className="mt-3 border-top pt-3" onSubmit={review}>
              <div className="small fw-bold mb-1">Midwife review</div>
              {msg && <div className={`alert alert-${msg.type} py-2`}>{msg.text}</div>}
              <div className="d-flex gap-3 mb-2">
                <div className="form-check"><input className="form-check-input" type="radio" name={`rf-${lab.id}`} id={`rn-${lab.id}`} checked={flag === 'normal'} onChange={() => setFlag('normal')} /><label className="form-check-label" htmlFor={`rn-${lab.id}`}>Negative <span className="text-secondary">(does not match the suspected impression)</span></label></div>
                <div className="form-check"><input className="form-check-input" type="radio" name={`rf-${lab.id}`} id={`ra-${lab.id}`} checked={flag === 'abnormal'} onChange={() => setFlag('abnormal')} /><label className="form-check-label text-danger fw-bold" htmlFor={`ra-${lab.id}`}>Positive <span className="fw-normal">(matches the suspected impression)</span></label></div>
              </div>
              <input className="form-control form-control-sm mb-2" placeholder="Midwife notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
              <button className="btn btn-sm btn-primary-custom" disabled={busy}><i className="bi bi-check2-circle me-1" />{busy ? 'Saving...' : 'Save review'}</button>
            </form>
          )}
          {lab.result_flag === 'normal' && !needsReview && <div className="alert alert-success py-2 small mt-2 mb-0">Negative: resume the consultation, add your notes and a prescription if needed.</div>}
          {(lab.result_flag === 'abnormal' || referred) && (
            <button className="btn btn-danger btn-sm mt-2" onClick={() => setReferring(true)}>
              <i className="bi bi-hospital me-1" />{referred ? 'View referral e-Slip' : 'Refer to the hospital (e-Slip)'}
            </button>
          )}
        </div>
      )}

      {referring && <ReferralModal lab={lab} patient={lab.patient} onClose={() => setReferring(false)} onSaved={onChanged} />}
      {zoom && imgUrl && createPortal(
        <div className="lab-zoom" onClick={() => setZoom(false)}><img src={imgUrl} alt="Lab result enlarged" /></div>,
        document.body,
      )}
    </div>
  );
}

// ───────────── LabRequestBox ─────────────
// "Request laboratory" — sends the patient for lab and frees the doctor for the next patient.
export function LabRequestBox({ patient, queueItem, defaultNote = '', onRequested, embedded = false }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState([]);
  const [other, setOther] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [outside, setOutside] = useState(false);

  const toggle = (t) => setPicked(picked.includes(t) ? picked.filter((x) => x !== t) : [...picked, t]);

  const pickedTests = () => {
    const t = picked.filter((x) => x !== 'Others');
    if (picked.includes('Others') && other.trim()) t.push(other.trim());
    return t;
  };
  function openOutside() {
    setMsg(null);
    if (pickedTests().length === 0) return setMsg({ type: 'danger', text: 'Choose at least one laboratory test.' });
    setOutside(true);
  }

  async function send(outsideClinic) {
    setMsg(null);
    const tests = picked.filter((t) => t !== 'Others');
    if (picked.includes('Others') && other.trim()) tests.push(other.trim());
    if (tests.length === 0) return setMsg({ type: 'danger', text: 'Choose at least one laboratory test.' });
    if (!(note || defaultNote).trim()) return setMsg({ type: 'danger', text: 'Enter the suspected impression (e.g. Pregnancy, Dengue). The result will be marked Positive or Negative against it.' });
    setBusy(true);
    let queueId = queueItem?.id ?? null;
    if (!queueId) { // walk-in without a queue entry: create one so the patient isn't forgotten
      const { data, error } = await supabase.from('queue').insert({ patient_id: patient.id, queued_by: user.id, status: 'awaiting_lab', reason: 'Laboratory' }).select('id').single();
      if (error) { setBusy(false); setMsg({ type: 'danger', text: error.message }); return error.message; }
      queueId = data.id;
    } else {
      const { error } = await supabase.from('queue').update({ status: 'awaiting_lab' }).eq('id', queueId);
      if (error) { setBusy(false); setMsg({ type: 'danger', text: error.message }); return error.message; }
    }
    const { error } = await supabase.from('lab_requests').insert({
      patient_id: patient.id, queue_id: queueId, tests: tests.join(', '), notes: [outsideClinic && `Sent to other clinic: ${outsideClinic}.`, (note || defaultNote).trim()].filter(Boolean).join(' ') || null, requested_by: user.id, outside_clinic: outsideClinic || null,
    });
    setBusy(false);
    if (error) { setMsg({ type: 'danger', text: error.message }); return error.message; }
    setPicked([]); setOther(''); setNote(''); setOpen(false);
    onRequested?.(patient);
  }

  return (
    <div className={embedded ? 'lab-embedded border rounded p-3 mb-3' : 'panel-card mt-4'}>
      <div className="d-flex justify-content-between align-items-center">
        <h6 className="fw-bold mb-0"><i className="bi bi-eyedropper me-2 text-success" />Laboratory Request</h6>
        <button type="button" className="btn btn-sm btn-outline-primary-custom" disabled={!patient} onClick={() => setOpen(!open)}>
          {open ? 'Cancel' : 'Request laboratory'}
        </button>
      </div>
      {!open && <div className="small text-secondary mt-2">Choose the tests: they go to the Laboratory Queue of the health center (BHW / staff), or to another clinic. The patient waits under "Waiting for Lab Results" and you can proceed to the next patient.</div>}
      {open && (
        <div className="mt-3">
          {msg && <div className={`alert alert-${msg.type} py-2`}>{msg.text}</div>}
          <div className="d-flex flex-wrap gap-2 mb-2">
            {LAB_TESTS.map((t) => (
              <button type="button" key={t} className={`btn btn-sm ${picked.includes(t) ? 'btn-primary-custom' : 'btn-outline-secondary'}`} onClick={() => toggle(t)}>
                {picked.includes(t) && '✓ '}{t}
              </button>
            ))}
          </div>
          {picked.includes('Others') && <input className="form-control form-control-sm mb-2" placeholder="Specify the test" value={other} onChange={(e) => setOther(e.target.value)} />}
          <input className="form-control form-control-sm mb-3" placeholder="Suspected impression (e.g. Pregnancy, Dengue)" value={note || defaultNote} onChange={(e) => setNote(e.target.value)} />
          <button type="button" className="btn btn-primary-custom" disabled={busy} onClick={() => send()}>
            <i className="bi bi-send me-1" />{busy ? 'Sending...' : 'Send to Health Center Laboratory'}
          </button>
          <button type="button" className="btn btn-outline-primary-custom ms-2" onClick={openOutside}>
            <i className="bi bi-building me-1" />Request to other clinic instead
          </button>
        </div>
      )}
      {outside && <OtherClinicModal patient={patient} tests={pickedTests()} symptoms={note || defaultNote} onClose={() => setOutside(false)} onProceed={(clinic) => send(clinic)} />}
    </div>
  );
}

// ───────────── PatientLabResults ─────────────
// Latest lab requests of one patient (shown beside the EMR form).
export function PatientLabResults({ patient, refreshKey, queueId = null, onChanged, title = 'Laboratory' }) {
  const [rows, setRows] = useState([]);
  const load = useCallback(async () => {
    if (!patient) { setRows([]); return; }
    let q = supabase.from('lab_requests').select('*, referrals(id)').eq('patient_id', patient.id);
    if (queueId) q = q.eq('queue_id', queueId);
    const { data } = await q.order('requested_at', { ascending: false }).limit(4);
    setRows((data ?? []).map((r) => ({ ...r, patient })));
  }, [patient, queueId]);
  useEffect(() => { load(); }, [load, refreshKey]);

  return (
    <div className="panel-card mb-4">
      <h5 className="mb-3">{title}</h5>
      {!patient ? <div className="text-secondary">Select a patient.</div>
        : rows.length === 0 ? <div className="text-secondary">No lab requests.</div>
          : <div className="d-grid gap-3">{rows.map((lab) => <LabCard key={lab.id} lab={lab} onChanged={() => { load(); onChanged?.(); }} />)}</div>}
    </div>
  );
}

// ───────────── usePendingLabs ─────────────
// Number of in-house laboratory requests waiting to be taken / uploaded (badge for the Laboratory Queue tab).
export function usePendingLabs() {
  const [n, setN] = useState(0);
  const load = useCallback(async () => {
    const { count } = await supabase.from('lab_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending').is('outside_clinic', null);
    setN(count ?? 0);
  }, []);
  useEffect(() => {
    load();
    const t = setInterval(load, 20000);
    const ch = supabase.channel(`labs-count-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lab_requests' }, load).subscribe();
    return () => { clearInterval(t); supabase.removeChannel(ch); };
  }, [load]);
  return n;
}

// ───────────── LabQueuePanel ─────────────
// Laboratory Queue (BHW / Midwife / Admin): tests requested by the midwife to be done at the health center.
// Take the test, upload the result photo -> the patient shows up as "Result ready" under Waiting for Lab Results.
export default function LabQueuePanel() {
  const [pending, setPending] = useState([]);
  const [done, setDone] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const sel = '*, patient:patients(id, first_name, middle_name, last_name, suffix, birth_date, purok), referrals(id)';
    const since = new Date(Date.now() - 2 * 86400000).toISOString();
    const [p, d] = await Promise.all([
      supabase.from('lab_requests').select(sel).eq('status', 'pending').is('outside_clinic', null).order('requested_at'),
      supabase.from('lab_requests').select(sel).eq('status', 'resulted').is('outside_clinic', null).gte('resulted_at', since).order('resulted_at', { ascending: false }).limit(15),
    ]);
    if (p.error) setError(p.error.message); else { setError(''); setPending(p.data ?? []); }
    setDone(d.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 20000);
    const ch = supabase.channel(`labq-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lab_requests' }, load).subscribe();
    return () => { clearInterval(t); supabase.removeChannel(ch); };
  }, [load]);

  return (
    <>
      <div className="panel-card">
        <h5 className="mb-1"><i className="bi bi-eyedropper me-2 text-success" />Laboratory Queue <span className="badge bg-warning text-dark ms-1">{pending.length}</span></h5>
        <p className="text-secondary small mb-3">Tests requested by the midwife for the health center laboratory. Take the test, then upload the result photo and mark it Positive (matches the midwife's suspected impression) or Negative (does not match). The result goes back to the midwife automatically.</p>
        {error && <div className="alert alert-danger">{error}</div>}
        {loading ? <div className="text-secondary">Loading...</div> : pending.length === 0
          ? <div className="text-secondary">No pending laboratory requests.</div>
          : <div className="d-grid gap-3">{pending.map((lab) => <LabCard key={lab.id} lab={lab} showPatient onChanged={load} />)}</div>}
      </div>

      <div className="panel-card mt-4">
        <h5 className="mb-3">Recently completed <span className="badge bg-secondary ms-1">{done.length}</span></h5>
        {done.length === 0 ? <div className="text-secondary">Nothing yet.</div> : (
          <div className="table-responsive">
            <table className="table align-middle mb-0">
              <thead><tr><th>Patient</th><th>Test</th><th>Result</th><th>Uploaded</th></tr></thead>
              <tbody>
                {done.map((l) => (
                  <tr key={l.id}>
                    <td><strong>{fullName(l.patient)}</strong></td>
                    <td>{l.tests}</td>
                    <td><span className={`badge ${l.result_flag === 'abnormal' ? 'bg-danger' : 'bg-success'}`}>{l.result_flag === 'abnormal' ? 'Positive' : 'Negative'}</span></td>
                    <td className="small">{formatDateTime(l.resulted_at)}</td>
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