import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import LabCard from './LabCard.jsx';

const FILTERS = [['review', 'Uploaded by patient'], ['pending', 'Waiting for results'], ['resulted', 'With results'], ['all', 'All']];

export default function LabPanel() {
  const [rows, setRows] = useState(null);
  const [filter, setFilter] = useState('pending');
  const [error, setError] = useState('');
  const [auto, setAuto] = useState(false);

  const load = useCallback(async () => {
    const { data, error: err } = await supabase.from('lab_requests')
      .select('*, patient:patients(id, first_name, middle_name, last_name, suffix, birth_date, purok), referrals(id)')
      .order('requested_at', { ascending: false }).limit(200);
    if (err) setError(err.message); else { setRows(data ?? []); setError(''); }
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const ch = supabase.channel(`lab-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lab_requests' }, load).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);
  const needsReview = (r) => r.patient_uploaded && !r.reviewed_at;
  useEffect(() => {
    if (rows && !auto) { setAuto(true); if (rows.some(needsReview)) setFilter('review'); }
  }, [rows, auto]);

  const shown = (rows ?? []).filter((r) => filter === 'all' || (filter === 'review' ? needsReview(r) : r.status === filter));
  const reviewCount = (rows ?? []).filter(needsReview).length;
  const pendingCount = (rows ?? []).filter((r) => r.status === 'pending').length;

  return (
    <div className="panel-card">
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <h5 className="mb-0"><i className="bi bi-eyedropper me-2 text-success" />Laboratory</h5>
        <div className="btn-group btn-group-sm">
          {FILTERS.map(([k, l]) => (
            <button key={k} className={`btn ${filter === k ? 'btn-primary-custom' : 'btn-outline-secondary'}`} onClick={() => setFilter(k)}>
              {l}{k === 'pending' && pendingCount > 0 && <span className="badge bg-danger ms-1">{pendingCount}</span>}{k === 'review' && reviewCount > 0 && <span className="badge bg-success ms-1">{reviewCount}</span>}
            </button>
          ))}
        </div>
      </div>
      <p className="small text-secondary">Upload a photo of the result here. Results that patients upload themselves (lab done at another clinic) show under <strong>Uploaded by patient</strong> — review it and mark the consultation done. The patient automatically returns to the Patient Queue. If the result is abnormal, a <strong>Refer to the hospital</strong> button appears.</p>
      {error && <div className="alert alert-danger">{error}</div>}
      {rows === null ? <div className="text-secondary">Loading...</div> : shown.length === 0 ? (
        <div className="text-secondary">{filter === 'pending' ? 'No patients waiting for lab results.' : filter === 'review' ? 'No patient-uploaded results waiting for review.' : 'Nothing here yet.'}</div>
      ) : (
        <div className="row g-3">
          {shown.map((lab) => <div className="col-12 col-xl-6" key={lab.id}><LabCard lab={lab} showPatient onChanged={load} /></div>)}
        </div>
      )}
    </div>
  );
}