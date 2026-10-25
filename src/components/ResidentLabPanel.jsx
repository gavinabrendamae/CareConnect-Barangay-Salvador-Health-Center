import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { compressImage } from '../lib/image.js';
import { formatDateTime, fullName } from '../lib/format.js';

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

function LabItem({ lab, onChanged }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const img = useSignedUrl(lab.result_path);

  useEffect(() => {
    if (!file) { setPreview(null); return undefined; }
    const u = URL.createObjectURL(file);
    setPreview(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);

  async function upload(e) {
    e.preventDefault();
    setMsg(null);
    if (!file) return setMsg({ type: 'danger', text: 'Please choose a photo of the result.' });
    setBusy(true);
    try {
      const blob = await compressImage(file);
      const path = `${lab.patient_id}/${lab.id}-${Date.now()}.jpg`;
      const up = await supabase.storage.from('lab-results').upload(path, blob, { contentType: 'image/jpeg' });
      if (up.error) throw new Error(up.error.message);
      const { error } = await supabase.rpc('patient_upload_lab_result', { p_lab_id: lab.id, p_path: path, p_notes: notes });
      if (error) throw new Error(error.message);
      setFile(null); setNotes('');
      onChanged?.();
    } catch (err) { setMsg({ type: 'danger', text: err.message }); }
    setBusy(false);
  }

  const pending = lab.status === 'pending';
  const reviewed = Boolean(lab.reviewed_at);
  return (
    <div className="lab-card">
      <div className="d-flex flex-wrap justify-content-between gap-2">
        <div>
          <div className="fw-bold"><i className="bi bi-eyedropper me-1 text-success" />{lab.tests}</div>
          <div className="small text-secondary">{lab.patient ? `${fullName(lab.patient)} · ` : ''}Requested {formatDateTime(lab.requested_at)}</div>
          {lab.outside_clinic && <div className="small">Sent to: <strong>{lab.outside_clinic}</strong></div>}
        </div>
        <div>
          {pending ? <span className="badge bg-warning text-dark">Waiting for your result</span>
            : reviewed ? <span className="badge bg-success">Received and reviewed by the health center</span>
              : <span className="badge bg-info text-dark">Uploaded · waiting for review</span>}
        </div>
      </div>

      {pending && lab.outside_clinic ? (
        <form className="mt-3" onSubmit={upload}>
          <p className="small text-secondary mb-2">Once your result is out from the laboratory, upload a photo of it here. The midwife will see it right away, and if it is normal you do not need to come back to the health center. If it is abnormal, the hospital will take over your care.</p>
          {msg && <div className={`alert alert-${msg.type} py-2`}>{msg.text}</div>}
          <input type="file" accept="image/*" className="form-control mb-2" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          {preview && <img src={preview} alt="Preview" className="lab-img mb-2" />}
          <input className="form-control form-control-sm mb-2" placeholder="Note to the midwife (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
          <button className="btn btn-primary-custom" disabled={busy}><i className="bi bi-cloud-upload me-1" />{busy ? 'Uploading...' : 'Upload result'}</button>
        </form>
      ) : !pending && (
        <div className="mt-3">
          {img ? <img src={img} alt="Lab result" className="lab-img" /> : lab.result_path && <div className="small text-secondary">Loading photo...</div>}
          {lab.result_notes && <div className="small mt-1"><strong>Note:</strong> {lab.result_notes}</div>}
          <div className="small text-secondary mt-1">Uploaded {formatDateTime(lab.resulted_at)}</div>
        </div>
      )}
    </div>
  );
}

export default function ResidentLabPanel() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    const { data, error: err } = await supabase.from('lab_requests')
      .select('id, patient_id, tests, status, outside_clinic, result_path, result_notes, resulted_at, reviewed_at, requested_at, patient:patients(first_name, middle_name, last_name, suffix)')
      .order('requested_at', { ascending: false }).limit(50);
    if (err) setError(err.message); else { setRows(data ?? []); setError(''); }
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="panel-card">
      <h5 className="mb-3"><i className="bi bi-eyedropper me-2 text-success" />My Laboratory</h5>
      {error && <div className="alert alert-danger">{error}</div>}
      {rows === null ? <div className="text-secondary">Loading...</div> : rows.length === 0 ? (
        <div className="text-secondary">No laboratory requests yet.</div>
      ) : <div className="d-grid gap-3">{rows.map((l) => <LabItem key={l.id} lab={l} onChanged={load} />)}</div>}
    </div>
  );
}