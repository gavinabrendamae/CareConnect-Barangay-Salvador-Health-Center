import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { staffOr, noStaff } from '../lib/staffFilter.js';
import { calcAge, fullName } from '../lib/format.js';
import Modal from './Modal.jsx';
import PatientForm from './PatientForm.jsx';

const PAGE = 15;

/** Master Patient List: search by name / medical ID / purok, edit profile, see family members. */
export default function PatientList() {
  const [q, setQ] = useState('');
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [editing, setEditing] = useState(null);
  const [household, setHousehold] = useState(null);
  const [members, setMembers] = useState([]);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const term = q.replace(/[,()%*]/g, ' ').trim();
    let query = supabase.from('patients').select('*', { count: 'exact' }).order('last_name').order('first_name')
      .range(page * PAGE, page * PAGE + PAGE - 1);
    if (term) query = query.or(`first_name.ilike.%${term}%,last_name.ilike.%${term}%,medical_id.ilike.%${term}%,purok.ilike.%${term}%`);
    query = noStaff(query, await staffOr());
    const { data, count, error: err } = await query;
    if (err) setError(err.message); else { setRows(data ?? []); setTotal(count ?? 0); setError(''); }
  }, [q, page]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  async function openHousehold(p) {
    setHousehold(p);
    const headId = p.household_head_id ?? p.id;
    const { data } = await supabase.from('patients').select('id, first_name, middle_name, last_name, suffix, birth_date, gender, medical_id')
      .or(`id.eq.${headId},household_head_id.eq.${headId}`).order('birth_date');
    setMembers(data ?? []);
  }

  const pages = Math.max(1, Math.ceil(total / PAGE));

  return (
    <div className="panel-card">
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
        <h5 className="mb-0">Master Patient List <span className="badge bg-success ms-1">{total}</span></h5>
        <input className="form-control" style={{ maxWidth: 340 }} placeholder="Search name, medical ID (CC-…) or purok"
          value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} />
      </div>
      {error && <div className="alert alert-danger">{error}</div>}
      {rows.length === 0 ? <div className="text-secondary">No residents found.</div> : (
        <div className="table-responsive">
          <table className="table align-middle mb-0">
            <thead><tr><th>Medical ID</th><th>Name</th><th>Age</th><th>Purok</th><th>Type</th><th /></tr></thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id}>
                  <td className="text-nowrap"><code>{p.medical_id}</code></td>
                  <td><strong>{fullName(p)}</strong>
                    <div className="small text-secondary">{p.contact_number || ''}</div></td>
                  <td>{calcAge(p.birth_date)}</td>
                  <td>{p.purok}</td>
                  <td className="small">{p.patient_type}</td>
                  <td className="text-end text-nowrap">
                    <button className="btn btn-sm btn-outline-secondary me-1" onClick={() => openHousehold(p)}>Family</button>
                    <button className="btn btn-sm btn-primary-custom" onClick={() => setEditing(p)}>Edit</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {total > PAGE && (
        <div className="d-flex justify-content-between align-items-center mt-3">
          <button className="btn btn-sm btn-outline-secondary" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</button>
          <span className="small text-secondary">Page {page + 1} of {pages}</span>
          <button className="btn btn-sm btn-outline-secondary" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>Next</button>
        </div>
      )}

      <Modal show={Boolean(editing)} large title="Edit Resident" icon="bi-person-gear" onClose={() => setEditing(null)}>
        {editing && <PatientForm key={editing.id} patient={editing} onSaved={() => { load(); setEditing(null); }} onCancel={() => setEditing(null)} />}
      </Modal>

      <Modal show={Boolean(household)} title="Family Members" icon="bi-house-heart" onClose={() => setHousehold(null)}>
        {members.length <= 1 ? (
          <div className="text-secondary">No linked family members yet. Open a family member's profile and choose their Parent / Guardian to link them.</div>
        ) : (
          <ul className="list-unstyled mb-0">
            {members.map((m) => (
              <li key={m.id} className="border-bottom py-2">
                <strong>{fullName(m)}</strong> {m.id === (household.household_head_id ?? household.id) && <span className="badge bg-primary">Parent / Guardian</span>}
                <div className="small text-secondary">{m.medical_id} · {calcAge(m.birth_date)} yrs · {m.gender}</div>
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </div>
  );
}