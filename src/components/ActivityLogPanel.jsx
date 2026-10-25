import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { fullName, formatDateTime, ROLE_LABEL } from '../lib/format.js';

const ENTITIES = {
  '': 'All activity', medicine_batches: 'Stock-in', prescriptions: 'Dispensed medicine', consultations: 'Consultations',
  patients: 'Patient records', vitals: 'Vitals', vaccinations: 'Vaccinations', medicines: 'Medicines', profiles: 'Accounts',
};
const ICON = { insert: 'bi-plus-circle text-success', update: 'bi-pencil-square text-primary' };

export default function ActivityLogPanel() {
  const [rows, setRows] = useState([]);
  const [entity, setEntity] = useState('');
  const [q, setQ] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    let query = supabase.from('activity_logs')
      .select('id, action, entity, summary, created_at, actor:profiles!actor_id(first_name, last_name, role)')
      .order('created_at', { ascending: false }).limit(300);
    if (entity) query = query.eq('entity', entity);
    query.then(({ data, error: err }) => {
      if (err) setError(err.message); else { setRows(data ?? []); setError(''); }
      setLoading(false);
    });
  }, [entity]);

  const term = q.trim().toLowerCase();
  const shown = useMemo(() => (term
    ? rows.filter((r) => `${r.summary} ${fullName(r.actor)}`.toLowerCase().includes(term))
    : rows), [rows, term]);

  return (
    <div className="panel-card">
      <h5 className="mb-1">Activity Logs</h5>
      <p className="text-secondary small">Who dispensed medicine, stocked in, registered or edited records, and changed accounts. Logs are written automatically and cannot be edited.</p>
      <div className="row g-2 mb-3">
        <div className="col-md-4">
          <select className="form-select" value={entity} onChange={(e) => setEntity(e.target.value)}>
            {Object.entries(ENTITIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div className="col-md-8"><input className="form-control" placeholder="Search staff or description" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      </div>
      {error && <div className="alert alert-danger">{error}</div>}
      {loading ? <div className="text-secondary">Loading...</div> : shown.length === 0 ? <div className="text-secondary">No activity recorded yet.</div> : (
        <div className="table-responsive">
          <table className="table align-middle mb-0">
            <thead><tr><th>When</th><th>Staff</th><th>Activity</th></tr></thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.id}>
                  <td className="small text-nowrap">{formatDateTime(r.created_at)}</td>
                  <td>{fullName(r.actor) || '—'}<div className="small text-secondary">{ROLE_LABEL[r.actor?.role]}</div></td>
                  <td><i className={`bi ${ICON[r.action] ?? 'bi-dot'} me-2`} />{r.summary}
                    <span className="badge bg-light text-secondary border ms-2">{ENTITIES[r.entity] ?? r.entity}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}