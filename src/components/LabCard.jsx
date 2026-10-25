import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext.jsx';
import { compressImage } from '../lib/image.js';
import { formatDateTime, fullName } from '../lib/format.js';
import ReferralModal from './ReferralModal.jsx';

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

export default function LabCard({ lab, showPatient = false, onChanged }) {
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
    if (!flag) return setMsg({ type: 'danger', text: 'Mark the result as Normal or Abnormal.' });
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
      if (lab.queue_id) await supabase.from('queue').update({ status: 'waiting' }).eq('id', lab.queue_id).eq('status', 'awaiting_lab');
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
    if (!flag) return setMsg({ type: 'danger', text: 'Mark the result as Normal or Abnormal.' });
    setBusy(true);
    const { error } = await supabase.from('lab_requests').update({
      result_flag: flag, reviewed_at: new Date().toISOString(), resulted_by: user.id,
      result_notes: [lab.result_notes, notes.trim()].filter(Boolean).join(' · ') || null,
    }).eq('id', lab.id);
    if (error) { setBusy(false); return setMsg({ type: 'danger', text: error.message }); }
    if (lab.queue_id) await supabase.from('queue').update({ status: 'done' }).eq('id', lab.queue_id).eq('status', 'awaiting_lab');
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
          {lab.notes && <div className="small mt-1"><em>{lab.notes}</em></div>}
          {lab.outside_clinic && <div className="small"><span className="badge bg-secondary"><i className="bi bi-building me-1" />Other clinic: {lab.outside_clinic}</span>{lab.patient_uploaded && <span className="badge bg-success ms-1">Uploaded by patient</span>}</div>}
        </div>
        <div className="text-end">
          {pending ? <span className="badge bg-warning text-dark">Waiting for result</span>
            : needsReview ? <span className="badge bg-info text-dark">For review</span>
            : <span className={`badge ${lab.result_flag === 'abnormal' ? 'bg-danger' : 'bg-success'}`}>{lab.result_flag === 'abnormal' ? 'Abnormal' : 'Normal'}</span>}
          {referred && <div><span className="badge bg-dark mt-1"><i className="bi bi-hospital me-1" />Referred</span></div>}
        </div>
      </div>

      {pending ? (
        <form className="mt-3" onSubmit={submitResult}>
          {msg && <div className={`alert alert-${msg.type} py-2`}>{msg.text}</div>}
          <label className="form-label small fw-bold">Result photo</label>
          <input type="file" accept="image/*" capture="environment" className="form-control mb-2" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          {preview && <img src={preview} alt="Result preview" className="lab-img mb-2" />}
          <div className="d-flex gap-3 mb-2">
            <div className="form-check"><input className="form-check-input" type="radio" name={`flag-${lab.id}`} id={`n-${lab.id}`} checked={flag === 'normal'} onChange={() => setFlag('normal')} /><label className="form-check-label" htmlFor={`n-${lab.id}`}>Normal</label></div>
            <div className="form-check"><input className="form-check-input" type="radio" name={`flag-${lab.id}`} id={`a-${lab.id}`} checked={flag === 'abnormal'} onChange={() => setFlag('abnormal')} /><label className="form-check-label text-danger fw-bold" htmlFor={`a-${lab.id}`}>Abnormal</label></div>
          </div>
          <input className="form-control form-control-sm mb-2" placeholder="Findings (e.g. Dengue NS1 positive, platelets 90k)" value={notes} onChange={(e) => setNotes(e.target.value)} />
          <button className="btn btn-sm btn-primary-custom" disabled={busy}>{busy ? 'Uploading...' : 'Save result & return patient to queue'}</button>
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
                <div className="form-check"><input className="form-check-input" type="radio" name={`rf-${lab.id}`} id={`rn-${lab.id}`} checked={flag === 'normal'} onChange={() => setFlag('normal')} /><label className="form-check-label" htmlFor={`rn-${lab.id}`}>Normal</label></div>
                <div className="form-check"><input className="form-check-input" type="radio" name={`rf-${lab.id}`} id={`ra-${lab.id}`} checked={flag === 'abnormal'} onChange={() => setFlag('abnormal')} /><label className="form-check-label text-danger fw-bold" htmlFor={`ra-${lab.id}`}>Abnormal</label></div>
              </div>
              <input className="form-control form-control-sm mb-2" placeholder="Midwife notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
              <button className="btn btn-sm btn-primary-custom" disabled={busy}><i className="bi bi-check2-circle me-1" />{busy ? 'Saving...' : 'Mark consultation done'}</button>
            </form>
          )}
          {(lab.result_flag === 'abnormal' || referred) && (
            <button className="btn btn-danger btn-sm mt-2" onClick={() => setReferring(true)}>
              <i className="bi bi-hospital me-1" />{referred ? 'View referral' : 'Refer to the hospital'}
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