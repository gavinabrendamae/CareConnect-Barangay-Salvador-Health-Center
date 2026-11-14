import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { DEPO } from '../lib/immunizationCards.js';
import FamilyPlanningCard from './FamilyPlanningCard.jsx';
import Modal from './Modal.jsx';
import { addDaysISO, calcAge, formatDate, fullName, todayISO } from '../lib/format.js';

const addMonthsISO = (iso, n) => {
  const d = new Date(`${iso}T00:00:00`); d.setMonth(d.getMonth() + n);
  const pad = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};


export default function FamilyPlanningPanel() {
  const [people, setPeople] = useState(null);
  const [filter, setFilter] = useState('due');
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(null);
  const [inviting, setInviting] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const load = useCallback(async () => {
    const [{ data: pts }, { data: recs }] = await Promise.all([
      supabase.from('patients').select('id, first_name, middle_name, last_name, suffix, birth_date, purok, profile_id, email, contact_number, fp_enrolled_at').eq('gender', 'Female').limit(2000),
      supabase.from('immunization_records').select('patient_id, dose_no, given_date, confirmed_at').eq('vaccine', DEPO).gt('dose_no', 0),
    ]);
    const byPatient = {};
    (recs ?? []).forEach((r) => { (byPatient[r.patient_id] ??= []).push(r); });
    const today = todayISO();
    const soon = addDaysISO(7);
    const list = (pts ?? []).filter((p) => { const a = calcAge(p.birth_date); return a >= 15 && a <= 49; }).map((p) => {
      const r = byPatient[p.id] ?? [];
      const done = r.filter((x) => x.confirmed_at).sort((a, b) => b.given_date.localeCompare(a.given_date));
      const pending = r.filter((x) => !x.confirmed_at).sort((a, b) => a.given_date.localeCompare(b.given_date));
      const last = done[0]?.given_date ?? null;
      const nextDue = pending[0]?.given_date ?? (last ? addMonthsISO(last, 3) : null);
      let status = p.fp_enrolled_at ? 'new' : 'none';
      if (nextDue) status = nextDue < today ? 'overdue' : nextDue <= soon ? 'soon' : 'ok';
      return { ...p, last, nextDue, status };
    });
    setPeople(list);
  }, []);

  useEffect(() => { load(); }, [load]);

  const rows = useMemo(() => (people ?? []).filter((p) => {
    if (search.trim() && !fullName(p).toLowerCase().includes(search.trim().toLowerCase())) return false;
    if (filter === 'due') return p.status === 'overdue' || p.status === 'soon';
    if (filter === 'enrolled') return p.status !== 'none';
    if (filter === 'none') return p.status === 'none';
    return true;
  }), [people, filter, search]);

  async function invite(p) {
    setBusy(true); setMsg(null);
    const { data, error } = await supabase.functions.invoke('family-planning-enroll', { body: { patient_id: p.id } });
    setBusy(false);
    let reason = error?.message;
    if (error?.context?.json) { try { reason = (await error.context.json())?.error ?? reason; } catch { /* keep */ } }
    setInviting(null);
    if (error || data?.error) return setMsg({ type: 'danger', text: `Could not enroll: ${reason ?? data?.error}` });
    setMsg({ type: data?.emailSent ? 'success' : 'warning',
      text: data?.emailSent ? `${fullName(p)} is now enrolled in Family Planning and was notified by Gmail.` : `${fullName(p)} is now enrolled in Family Planning. No Gmail was sent${data?.emailError ? ` (${data.emailError})` : ' (no email on file)'}.` });
    load();
  }

  const badge = (s) => ({
    overdue: <span className="badge bg-danger">Overdue</span>,
    soon: <span className="badge bg-warning text-dark">Due soon</span>,
    ok: <span className="badge bg-success">Up to date</span>,
    new: <span className="badge bg-info text-dark">Enrolled — first injection pending</span>,
    none: <span className="badge bg-secondary">Not enrolled</span>,
  }[s]);

  if (open) {
    return (
      <div className="panel-card">
        <button type="button" className="btn btn-sm btn-outline-secondary mb-3" onClick={() => { setOpen(null); load(); }}><i className="bi bi-arrow-left me-1" />Back to list</button>
        <FamilyPlanningCard key={open.id} patientId={open.id} editable />
      </div>
    );
  }

  return (
    <div className="panel-card">
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
        <h5 className="mb-0"><i className="bi bi-gender-female me-2" />Family Planning (Depo-Provera, every 3 months)</h5>
      </div>
      <p className="small text-secondary">Female residents aged 15–49. Open a resident's card to record the injection. The next return date is set 3 months later, and the resident is notified automatically by Gmail and in the app.</p>
      {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}
      <div className="d-flex gap-2 flex-wrap mb-3">
        <select className="form-select form-select-sm w-auto" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="due">Due / overdue</option>
          <option value="enrolled">Enrolled</option>
          <option value="none">Not enrolled (invite)</option>
          <option value="all">All</option>
        </select>
        <input className="form-control form-control-sm w-auto" placeholder="Search name" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      {people === null ? <div className="text-secondary">Loading...</div> : rows.length === 0 ? <div className="text-secondary">No residents in this list.</div> : (
        <div className="table-responsive">
          <table className="table align-middle mb-0">
            <thead><tr><th>Resident</th><th>Last injection</th><th>Next due</th><th>Status</th><th /></tr></thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id}>
                  <td><strong role="button" style={{ cursor: 'pointer' }} onClick={() => setOpen(p)}>{fullName(p)}</strong><div className="small text-secondary">{calcAge(p.birth_date)} yrs · {p.purok}{p.profile_id ? '' : ' · no account'}</div></td>
                  <td className="small">{formatDate(p.last)}</td>
                  <td className="small">{formatDate(p.nextDue)}</td>
                  <td>{badge(p.status)}</td>
                  <td className="text-end">
                    {p.status === 'none'
                      ? <button className="btn btn-sm btn-outline-primary-custom" disabled={busy} onClick={() => setInviting(p)}>Invite</button>
                      : <button className="btn btn-sm btn-primary-custom" onClick={() => setOpen(p)}>Open card</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Modal show={!!inviting} title="Invite to Family Planning" icon="bi-gender-female" onClose={() => !busy && setInviting(null)}
        footer={<><button type="button" className="btn btn-outline-secondary" disabled={busy} onClick={() => setInviting(null)}>Cancel</button>
          <button type="button" className="btn btn-primary-custom px-4" disabled={busy} onClick={() => invite(inviting)}><i className="bi bi-envelope-check me-1" />{busy ? 'Sending...' : 'Yes, enroll and send Gmail'}</button></>}>
        {inviting && (
          <div className="text-center py-2">
            <span className="d-inline-flex align-items-center justify-content-center rounded-circle mb-3" style={{ width: 72, height: 72, fontSize: '2rem', background: '#e3eef9', color: 'var(--primary)' }}><i className="bi bi-gender-female" /></span>
            <h5 className="mb-1">This resident will become a Family Planning patient</h5>
            <div className="border rounded p-3 my-3 text-start bg-light">
              <div className="fw-bold">{fullName(inviting)}</div>
              <div className="small text-secondary">{calcAge(inviting.birth_date)} yrs · {inviting.purok}</div>
            </div>
            <p className="small text-secondary mb-0">Her Family Planning card will appear in her account, and a Gmail will tell her to open her account to see her upcoming schedules.</p>
          </div>
        )}
      </Modal>
    </div>
  );
}