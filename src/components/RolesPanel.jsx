import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext.jsx';
import { fullName, ROLE_LABEL } from '../lib/format.js';

export default function RolesPanel() {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState('');
  const [msg, setMsg] = useState(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('profiles')
      .select('id, first_name, middle_name, last_name, suffix, email, role, purok, is_active, approval_status').order('last_name');
    if (error) setMsg({ type: 'danger', text: error.message }); else setRows(data ?? []);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function changeRole(row, role) {
    setMsg(null);
    const { error } = await supabase.from('profiles').update({ role }).eq('id', row.id);
    if (error) return setMsg({ type: 'danger', text: error.message });
    setMsg({ type: 'success', text: `${fullName(row)} is now ${ROLE_LABEL[role]}.` });
    load();
  }

  async function toggleActive(row) {
    setMsg(null);
    const { error } = await supabase.from('profiles').update({ is_active: !row.is_active }).eq('id', row.id);
    if (error) return setMsg({ type: 'danger', text: error.message });
    setMsg({ type: 'success', text: `${fullName(row)}'s account was ${row.is_active ? 'deactivated' : 'activated'}.` });
    load();
  }

  async function setApproval(row, status) {
    setMsg(null);
    const patch = status === 'approved' ? { approval_status: 'approved', is_active: true } : { approval_status: 'declined', is_active: false };
    const { error } = await supabase.from('profiles').update(patch).eq('id', row.id);
    if (error) return setMsg({ type: 'danger', text: error.message });
    setMsg({ type: 'success', text: `${fullName(row)} was ${status === 'approved' ? 'approved. They can now log in.' : 'declined.'}` });
    load();
  }

  const pending = rows.filter((r) => r.approval_status === 'pending');
  const term = q.trim().toLowerCase();
  const shown = term
    ? rows.filter((r) => `${fullName(r)} ${r.email ?? ''}`.toLowerCase().includes(term))
    : rows;

  return (
    <div className="panel-card">
      <h5 className="mb-1">Accounts &amp; Roles</h5>
      <p className="text-secondary small">Approve a registered resident as BHW / Midwife / Doctor by changing their role. Deactivated accounts can no longer log in or access any data.</p>
      {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}
      {pending.length > 0 && (
        <div className="alert alert-warning">
          <strong>{pending.length} registration{pending.length > 1 ? 's' : ''} waiting for approval</strong>
          <div className="table-responsive mt-2 bg-white rounded">
            <table className="table table-sm mb-0 align-middle">
              <tbody>
                {pending.map((r) => (
                  <tr key={r.id}>
                    <td><strong>{fullName(r)}</strong><div className="small text-secondary">{r.email} · {r.purok || 'no purok'}</div></td>
                    <td className="text-end text-nowrap">
                      <button className="btn btn-sm btn-success me-2" onClick={() => setApproval(r, 'approved')}>Approve</button>
                      <button className="btn btn-sm btn-outline-danger" onClick={() => setApproval(r, 'declined')}>Decline</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <input className="form-control mb-3" placeholder="Search by name or email" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="table-responsive">
        <table className="table mb-0">
          <thead><tr><th>Name</th><th>Email</th><th>Purok</th><th style={{ width: 220 }}>Role</th><th>Status</th></tr></thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.id}>
                <td><strong>{fullName(r)}</strong></td>
                <td className="small">{r.email}</td>
                <td>{r.purok || '—'}</td>
                <td>
                  <select className="form-select form-select-sm" value={r.role} disabled={r.id === user.id}
                    title={r.id === user.id ? 'You cannot change your own role' : ''}
                    onChange={(e) => changeRole(r, e.target.value)}>
                    {Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </td>
                <td className="text-nowrap">
                  <span className={`badge bg-${r.approval_status === 'pending' ? 'warning text-dark' : r.is_active ? 'success' : 'secondary'} me-2`}>
                    {r.approval_status === 'pending' ? 'Pending approval' : r.approval_status === 'declined' ? 'Declined' : r.is_active ? 'Active' : 'Deactivated'}
                  </span>
                  <button className="btn btn-sm btn-outline-secondary" disabled={r.id === user.id || r.approval_status !== 'approved'} onClick={() => toggleActive(r)}>
                    {r.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}