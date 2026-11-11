import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { staffOr, noStaff } from '../lib/staffFilter.js';
import { useAuth } from '../context/AuthContext.jsx';
import { calcAge, fullName } from '../lib/format.js';
import Modal from './Modal.jsx';
import PatientForm from './PatientForm.jsx';

const PAGE = 15;

const byName = (a, b) => (a.last_name ?? '').localeCompare(b.last_name ?? '') || (a.first_name ?? '').localeCompare(b.first_name ?? '');

/** Master Patient List: patients + their website accounts in one list.
 *  Patients with no type yet come first, then A-Z by surname. Deactivated accounts move to their own list below. */
export default function PatientList() {
  const { role } = useAuth();
  const isAdmin = role === 'admin';
  const [q, setQ] = useState('');
  const [all, setAll] = useState([]);
  const [accts, setAccts] = useState({});
  const [msg, setMsg] = useState(null);
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState(null);
  const [household, setHousehold] = useState(null);
  const [members, setMembers] = useState([]);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    let query = supabase.from('patients').select('*').order('last_name').order('first_name').range(0, 999);
    query = noStaff(query, await staffOr());
    const [pt, pr] = await Promise.all([
      query,
      supabase.from('profiles').select('id, is_active, approval_status').eq('role', 'resident'),
    ]);
    if (pt.error) { setError(pt.error.message); return; }
    setError('');
    setAll(pt.data ?? []);
    setAccts(Object.fromEntries((pr.data ?? []).map((r) => [r.id, r])));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function toggleAccount(p, acct) {
    setMsg(null);
    const turnOff = acct.is_active;
    if (turnOff && !window.confirm(`Deactivate ${fullName(p)}'s account?\n\nThey will no longer be able to log in to the resident portal. Their patient record and history are kept, and you can activate the account again anytime.`)) return;
    const { error: err } = await supabase.from('profiles').update({ is_active: !turnOff }).eq('id', p.profile_id);
    if (err) return setMsg({ type: 'danger', text: err.message });
    setMsg({ type: 'success', text: `${fullName(p)}'s account was ${turnOff ? 'deactivated' : 'activated'}.` });
    load();
  }

  const term = q.replace(/[,()%*]/g, ' ').trim().toLowerCase();
  const matches = (p) => !term || `${p.first_name} ${p.last_name} ${p.medical_id ?? ''} ${p.purok ?? ''}`.toLowerCase().includes(term);
  const acctOf = (p) => (p.profile_id ? accts[p.profile_id] : null);
  const visible = all.filter((p) => acctOf(p)?.approval_status !== 'pending' && matches(p));
  const isOff = (p) => { const a = acctOf(p); return a && a.approval_status === 'approved' && a.is_active === false; };
  const deactivated = visible.filter(isOff).sort(byName);
  const active = visible.filter((p) => !isOff(p));
  const rows = [...active.filter((p) => !p.patient_type).sort(byName), ...active.filter((p) => p.patient_type).sort(byName)];
  const total = rows.length;
  const pageRows = rows.slice(page * PAGE, page * PAGE + PAGE);

  async function openHousehold(p) {
    setHousehold(p);
    const headId = p.household_head_id ?? p.id;
    const { data } = await supabase.from('patients').select('id, first_name, middle_name, last_name, suffix, birth_date, gender, medical_id')
      .or(`id.eq.${headId},household_head_id.eq.${headId}`).order('birth_date');
    setMembers(data ?? []);
  }

  const pages = Math.max(1, Math.ceil(total / PAGE));

  return (
    <>
    <div className="panel-card">
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
        <h5 className="mb-0">Master Patient List <span className="badge bg-success ms-1">{total}</span></h5>
        <input className="form-control" style={{ maxWidth: 340 }} placeholder="Search name, medical ID (CC-…) or purok"
          value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} />
      </div>
      {error && <div className="alert alert-danger">{error}</div>}
      {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}
      {rows.length === 0 ? <div className="text-secondary">No residents found.</div> : (
        <div className="table-responsive">
          <table className="table align-middle mb-0">
            <thead><tr><th>Medical ID</th><th>Name</th><th>Age</th><th>Purok</th><th>Type</th><th /></tr></thead>
            <tbody>
              {pageRows.map((p) => (
                <tr key={p.id}>
                  <td className="text-nowrap"><code>{p.medical_id}</code></td>
                  <td><strong>{fullName(p)}</strong>{!p.patient_type && <span className="badge bg-warning text-dark ms-2" title="Open Edit and choose the type of patient">Type not set</span>}
                    <div className="small text-secondary">{p.contact_number || ''}</div></td>
                  <td>{calcAge(p.birth_date)}</td>
                  <td>{p.purok}</td>
                  <td className="small">{p.patient_type || '—'}</td>
                  <td className="text-end text-nowrap">
                    <button className="btn btn-sm btn-outline-secondary me-1" onClick={() => openHousehold(p)}>Family</button>
                    <button className="btn btn-sm btn-primary-custom" onClick={() => setEditing(p)}>Edit</button>
                    {isAdmin && acctOf(p)?.approval_status === 'approved' && (
                      <button className="btn btn-sm btn-outline-danger ms-1" onClick={() => toggleAccount(p, acctOf(p))}>Deactivate</button>
                    )}
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
        {household && (members.length <= 1 ? (
          <div className="text-secondary">No linked family members yet. Open a family member's profile and choose their Parent / Guardian to link them.</div>
        ) : (
          <ul className="list-unstyled mb-0">
            {members.map((m) => (
              <li key={m.id} className="border-bottom py-2">
                <strong>{fullName(m)}</strong> {m.id === (household?.household_head_id ?? household?.id) && <span className="badge bg-primary">Parent / Guardian</span>}
                <div className="small text-secondary">{m.medical_id} · {calcAge(m.birth_date)} yrs · {m.gender}</div>
              </li>
            ))}
          </ul>
        ))}
      </Modal>
    </div>

    {deactivated.length > 0 && (
      <div className="panel-card mt-4">
        <h5 className="mb-1">Deactivated Accounts <span className="badge bg-secondary ms-1">{deactivated.length}</span></h5>
        <p className="text-secondary small">These residents can no longer log in. Their records are kept. Sorted A-Z by surname.</p>
        <div className="table-responsive">
          <table className="table align-middle mb-0">
            <thead><tr><th>Medical ID</th><th>Name</th><th>Purok</th><th /></tr></thead>
            <tbody>
              {deactivated.map((p) => (
                <tr key={p.id}>
                  <td className="text-nowrap"><code>{p.medical_id}</code></td>
                  <td><strong>{fullName(p)}</strong><div className="small text-secondary">{p.email || p.contact_number || ''}</div></td>
                  <td>{p.purok}</td>
                  <td className="text-end text-nowrap">
                    <button className="btn btn-sm btn-outline-secondary me-1" onClick={() => setEditing(p)}>Edit</button>
                    {isAdmin && <button className="btn btn-sm btn-success" onClick={() => toggleAccount(p, acctOf(p))}>Activate</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )}
    </>
  );
}