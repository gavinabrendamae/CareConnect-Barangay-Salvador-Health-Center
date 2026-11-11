import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext.jsx';
import { fullName, ROLE_LABEL } from '../lib/format.js';
import Modal from './Modal.jsx';

const COLS = 'id, first_name, middle_name, last_name, suffix, email, role, purok, is_active, approval_status';
const STAFF_CHOICES = ['bhw', 'midwife', 'doctor'];
const notify = () => window.dispatchEvent(new Event('pending-changed'));

function useProfiles(ver) {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState(null);
  const load = useCallback(async () => {
    const { data, error: err } = await supabase.from('profiles').select(COLS).order('last_name');
    if (err) setError(err.message); else { setRows(data ?? []); setError(null); }
  }, []);
  useEffect(() => { load(); }, [load, ver]);
  return { rows, error, load };
}

// Registrations waiting for approval (residents who signed up on the website).
export function PendingApprovals({ ver = 0, onChanged }) {
  const { rows, error, load } = useProfiles(ver);
  const [msg, setMsg] = useState(null);
  const [declining, setDeclining] = useState(null);
  const [reason, setReason] = useState('');
  const [declErr, setDeclErr] = useState('');
  const [approving, setApproving] = useState(null);
  const REASONS = ['Incorrect or incomplete information', 'Not a resident of Barangay Salvador', 'Duplicate account', 'Other reasons'];
  const OTHER = 'Other reasons';
  const [choice, setChoice] = useState('');
  const [busy, setBusy] = useState(false);
  const pending = rows.filter((r) => r.approval_status === 'pending');

  async function approveNow() {
    const row = approving;
    setMsg(null); setBusy(true);
    const { error: err } = await supabase.from('profiles').update({ approval_status: 'approved', is_active: true }).eq('id', row.id);
    if (err) { setBusy(false); setApproving(null); return setMsg({ type: 'danger', text: err.message }); }
    const { error: mailErr } = await supabase.functions.invoke('registration-approve', { body: { profile_id: row.id } });
    setBusy(false); setApproving(null);
    notify(); onChanged?.(); load();
    let why = '';
    if (mailErr) {
      why = mailErr.message;
      try { const j = await mailErr.context.json(); if (j?.error) why = j.error; } catch { /* keep message */ }
    }
    setMsg(mailErr
      ? { type: 'warning', text: `${fullName(row)} was approved, but the email could not be sent: ${why}` }
      : { type: 'success', text: `${fullName(row)} was approved.` });
  }

  async function sendDecline() {
    setDeclErr(''); setMsg(null); setBusy(true);
    const { error: mailErr } = await supabase.functions.invoke('registration-decline', { body: { profile_id: declining.id, reason: reason.trim() } });
    if (mailErr) {
      let text = mailErr.message;
      try { const j = await mailErr.context.json(); if (j?.error) text = j.error; } catch { /* keep message */ }
      setBusy(false);
      return setDeclErr(`The email could not be sent, so nothing was declined: ${text}`);
    }
    await setApproval(declining, 'declined');
    setReason('');
  }

  async function setApproval(row, status) {
    setMsg(null);
    setBusy(true);
    // Approve keeps the account; decline removes it completely so the email can be used to register again.
    const { error: err } = status === 'approved'
      ? await supabase.from('profiles').update({ approval_status: 'approved', is_active: true }).eq('id', row.id)
      : await supabase.rpc('decline_registration', { p_profile_id: row.id });
    setBusy(false); setDeclining(null);
    if (err) return setMsg({ type: 'danger', text: err.message });
    setMsg({ type: 'success', text: `${fullName(row)} was ${status === 'approved' ? 'approved.' : 'declined.'}` });
    load(); notify(); onChanged?.();
  }

  if (!pending.length && !msg && !error) return null;
  return (
    <div className="panel-card">
      {error && <div className="alert alert-danger">{error}</div>}
      {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}
      {pending.length > 0 && (
        <div className="alert alert-warning mb-0">
          <strong>{pending.length} registration{pending.length > 1 ? 's' : ''} waiting for approval</strong>
          <div className="table-responsive mt-2 bg-white rounded">
            <table className="table table-sm mb-0 align-middle">
              <tbody>
                {pending.map((r) => (
                  <tr key={r.id}>
                    <td><strong>{fullName(r)}</strong><div className="small text-secondary">{r.email} · {r.purok || 'no purok'}</div></td>
                    <td className="text-end text-nowrap">
                      <button className="btn btn-sm btn-success me-2" onClick={() => { setMsg(null); setApproving(r); }}>Approve</button>
                      <button className="btn btn-sm btn-outline-danger" onClick={() => { setReason(''); setChoice(''); setDeclErr(''); setMsg(null); setDeclining(r); }}>Decline</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <Modal show={!!approving} title="Accept registration" icon="bi-person-check" onClose={() => !busy && setApproving(null)}
        footer={<><button type="button" className="btn btn-outline-secondary" disabled={busy} onClick={() => setApproving(null)}>Cancel</button>
          <button type="button" className="btn btn-success px-4" disabled={busy} onClick={approveNow}><i className="bi bi-envelope-check me-1" />{busy ? 'Approving...' : 'Yes, accept and send email'}</button></>}>
        {approving && (
          <div className="text-center py-2">
            <span className="d-inline-flex align-items-center justify-content-center rounded-circle bg-success-subtle text-success mb-3" style={{ width: 72, height: 72, fontSize: '2rem' }}><i className="bi bi-person-check-fill" /></span>
            <h5 className="mb-1">You are about to accept this account</h5>
            <div className="border rounded p-3 my-3 text-start bg-light">
              <div className="fw-bold">{fullName(approving)}</div>
              <div className="small text-secondary">{approving.email}</div>
              <div className="small text-secondary">{approving.purok || 'No purok'}</div>
            </div>
            <div className="small text-secondary">They will be able to log in, and a confirmation email will be sent to {approving.email}.</div>
          </div>
        )}
      </Modal>
      <Modal show={!!declining} title="Decline registration" icon="bi-person-x" onClose={() => !busy && setDeclining(null)}
        footer={<><button type="button" className="btn btn-outline-secondary" disabled={busy} onClick={() => setDeclining(null)}>Cancel</button>
          <button type="button" className="btn btn-danger px-4" disabled={busy || reason.trim().length < 5} onClick={sendDecline}><i className="bi bi-envelope-x me-1" />{busy ? 'Sending...' : 'Decline and send email'}</button></>}>
        {declining && (
          <div className="text-center py-2">
            <span className="d-inline-flex align-items-center justify-content-center rounded-circle bg-danger-subtle text-danger mb-3" style={{ width: 72, height: 72, fontSize: '2rem' }}><i className="bi bi-person-x-fill" /></span>
            <h5 className="mb-1">Are you sure you want to decline this registration?</h5>
            <div className="border rounded p-3 my-3 text-start bg-light">
              <div className="fw-bold">{fullName(declining)}</div>
              <div className="small text-secondary">{declining.email}</div>
              <div className="small text-secondary">{declining.purok || 'No purok'}</div>
            </div>
            <div className="text-start">
              {declErr && <div className="alert alert-danger py-2 small">{declErr}</div>}
              <label className="form-label fw-semibold">Reason <span className="text-danger">*</span></label>
              <div className="d-flex flex-wrap gap-2 mb-2">
                {REASONS.map((x) => <button key={x} type="button" className={`btn btn-sm ${choice === x ? 'btn-primary-custom' : 'btn-outline-secondary'}`} onClick={() => { setChoice(x); setReason(x === OTHER ? '' : x); }}>{x}</button>)}
              </div>
              <textarea rows="3" className="form-control" placeholder={choice === OTHER ? 'Type your own reason here' : 'Tell the resident what to correct'} value={reason} onChange={(e) => setReason(e.target.value)} />
              <div className="form-text">This reason is emailed to {declining.email}. They can register again with the same email.</div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

// group="residents": resident accounts only.  group="staff": staff accounts only (BHW, Midwife, Doctor, Super Admin).
export default function RolesPanel({ group = 'staff', ver = 0, onChanged }) {
  const { user } = useAuth();
  const { rows, error, load } = useProfiles(ver);
  const [q, setQ] = useState('');
  const [pq, setPq] = useState('');
  const [msg, setMsg] = useState(null);
  const isStaff = group === 'staff';

  async function changeRole(row, role) {
    setMsg(null);
    const { error: err } = await supabase.from('profiles').update({ role }).eq('id', row.id);
    if (err) return setMsg({ type: 'danger', text: err.message });
    setMsg({ type: 'success', text: `${fullName(row)} is now ${ROLE_LABEL[role]}.` });
    load(); onChanged?.();
  }

  async function toggleActive(row) {
    setMsg(null);
    const { error: err } = await supabase.from('profiles').update({ is_active: !row.is_active }).eq('id', row.id);
    if (err) return setMsg({ type: 'danger', text: err.message });
    setMsg({ type: 'success', text: `${fullName(row)}'s account was ${row.is_active ? 'deactivated' : 'activated'}.` });
    load();
  }

  const inGroup = rows.filter((r) => (isStaff ? r.role !== 'resident' : r.role === 'resident') && r.approval_status !== 'pending');
  const term = q.trim().toLowerCase();
  const shown = term ? inGroup.filter((r) => `${fullName(r)} ${r.email ?? ''}`.toLowerCase().includes(term)) : inGroup;

  // staff view: find a registered resident and promote them to staff
  const pterm = pq.trim().toLowerCase();
  const candidates = isStaff && pterm.length >= 2
    ? rows.filter((r) => r.role === 'resident' && r.approval_status === 'approved' && `${fullName(r)} ${r.email ?? ''}`.toLowerCase().includes(pterm)).slice(0, 6)
    : [];

  return (
    <div className="panel-card">
      <h5 className="mb-1">{isStaff ? 'Staff Accounts' : 'Resident Accounts'} <span className="badge bg-success ms-1">{inGroup.length}</span></h5>
      <p className="text-secondary small">
        {isStaff
          ? 'Health center staff only. Deactivated accounts can no longer log in or access any data.'
          : 'Residents who registered on the website. Deactivated accounts can no longer log in.'}
      </p>
      {error && <div className="alert alert-danger">{error}</div>}
      {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

      {isStaff && (
        <div className="border rounded p-3 mb-3">
          <div className="fw-bold mb-2">Promote a registered resident to staff</div>
          <input className="form-control" placeholder="Search a resident by name or email" value={pq} onChange={(e) => setPq(e.target.value)} />
          {pterm.length >= 2 && candidates.length === 0 && <div className="small text-secondary mt-2">No matching resident account.</div>}
          {candidates.map((r) => (
            <div key={r.id} className="d-flex flex-wrap justify-content-between align-items-center gap-2 mt-2">
              <div><strong>{fullName(r)}</strong> <span className="small text-secondary">{r.email}</span></div>
              <div className="btn-group btn-group-sm">
                {STAFF_CHOICES.map((c) => (
                  <button key={c} type="button" className="btn btn-outline-primary-custom" onClick={() => { changeRole(r, c); setPq(''); }}>Make {ROLE_LABEL[c].replace('Barangay Health Worker', 'BHW')}</button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <input className="form-control mb-3" placeholder="Search by name or email" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="table-responsive">
        <table className="table mb-0">
          <thead><tr><th>Name</th><th>Email</th><th>Purok</th>{isStaff && <th style={{ width: 220 }}>Role</th>}<th>Status</th></tr></thead>
          <tbody>
            {shown.length === 0 && <tr><td colSpan={isStaff ? 5 : 4} className="text-secondary">{isStaff ? 'No staff accounts found.' : 'No resident accounts found.'}</td></tr>}
            {shown.map((r) => (
              <tr key={r.id}>
                <td><strong>{fullName(r)}</strong></td>
                <td className="small">{r.email}</td>
                <td>{r.purok || '—'}</td>
                {isStaff && (
                  <td>
                    <select className="form-select form-select-sm" value={r.role} disabled={r.id === user.id}
                      title={r.id === user.id ? 'You cannot change your own role' : ''}
                      onChange={(e) => changeRole(r, e.target.value)}>
                      {Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </td>
                )}
                <td className="text-nowrap">
                  <span className={`badge bg-${r.approval_status === 'declined' ? 'secondary' : r.is_active ? 'success' : 'secondary'} me-2`}>
                    {r.approval_status === 'declined' ? 'Declined' : r.is_active ? 'Active' : 'Deactivated'}
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