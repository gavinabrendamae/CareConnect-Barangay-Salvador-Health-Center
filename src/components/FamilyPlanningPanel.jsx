import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { DEPO } from '../lib/immunizationCards.js';
import { addDaysISO, calcAge, formatDate, fullName, todayISO } from '../lib/format.js';

const addMonthsISO = (iso, n) => {
  const d = new Date(`${iso}T00:00:00`); d.setMonth(d.getMonth() + n);
  const pad = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/**
 * Admin / midwife: female residents (15-49) and their Depo-Provera schedule.
 * "Summon" sends a Gmail + in-app notice: a reminder when the next injection is due, or an invitation to get a Family Planning card.
 */
export default function FamilyPlanningPanel() {
  const [people, setPeople] = useState(null);
  const [filter, setFilter] = useState('due');
  const [search, setSearch] = useState('');
  const [sel, setSel] = useState({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const load = useCallback(async () => {
    const [{ data: pts }, { data: recs }] = await Promise.all([
      supabase.from('patients').select('id, first_name, middle_name, last_name, suffix, birth_date, purok, profile_id, email, contact_number').eq('gender', 'Female').limit(2000),
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
      let status = 'none';
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

  const dueCount = (people ?? []).filter((p) => p.status === 'overdue' || p.status === 'soon').length;

  async function summon(list) {
    if (!list.length) return;
    setBusy(true); setMsg(null);
    const { data, error } = await supabase.functions.invoke('family-planning-summon', {
      body: { items: list.map((p) => ({ patient_id: p.id, mode: p.status === 'none' ? 'invite' : 'due', due_date: p.nextDue })) },
    });
    setBusy(false);
    let reason = error?.message;
    if (error?.context?.json) { try { reason = (await error.context.json())?.error ?? reason; } catch { /* keep */ } }
    if (error) return setMsg({ type: 'danger', text: `Could not summon: ${reason}. Is the family-planning-summon function deployed?` });
    setSel({});
    setMsg({ type: data?.failed?.length ? 'warning' : 'success',
      text: `Summoned ${data?.notified ?? 0} resident(s) — ${data?.emailSent ?? 0} Gmail sent${data?.failed?.length ? `; ${data.failed.length} failed (${data.failed[0]})` : ''}.` });
  }

  const badge = (s) => ({
    overdue: <span className="badge bg-danger">Overdue</span>,
    soon: <span className="badge bg-warning text-dark">Due soon</span>,
    ok: <span className="badge bg-success">Up to date</span>,
    none: <span className="badge bg-secondary">Not enrolled</span>,
  }[s]);

  const picked = rows.filter((p) => sel[p.id]);

  return (
    <div className="panel-card">
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
        <h5 className="mb-0"><i className="bi bi-gender-female me-2" />Family Planning (Depo-Provera, every 3 months)</h5>
        <div className="d-flex gap-2 flex-wrap">
          <button className="btn btn-sm btn-primary-custom" disabled={busy || !dueCount}
            onClick={() => summon((people ?? []).filter((p) => p.status === 'overdue' || p.status === 'soon'))}>
            <i className="bi bi-megaphone me-1" />Summon all due ({dueCount})
          </button>
          <button className="btn btn-sm btn-outline-primary-custom" disabled={busy || !picked.length} onClick={() => summon(picked)}>
            Summon selected ({picked.length})
          </button>
        </div>
      </div>
      <p className="small text-secondary">Female residents aged 15–49. Set the first injection date in <strong>Immunization Record → Family planning card</strong>; after each injection is confirmed, the next one is scheduled 3 months later. Summoning sends a Gmail and an in-app notice.</p>
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
            <thead><tr><th /><th>Resident</th><th>Last injection</th><th>Next due</th><th>Status</th><th /></tr></thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id}>
                  <td><input type="checkbox" className="form-check-input" checked={Boolean(sel[p.id])} onChange={(e) => setSel({ ...sel, [p.id]: e.target.checked })} /></td>
                  <td><strong>{fullName(p)}</strong><div className="small text-secondary">{calcAge(p.birth_date)} yrs · {p.purok}{p.profile_id ? '' : ' · no account'}</div></td>
                  <td className="small">{formatDate(p.last)}</td>
                  <td className="small">{formatDate(p.nextDue)}</td>
                  <td>{badge(p.status)}</td>
                  <td className="text-end"><button className="btn btn-sm btn-outline-primary-custom" disabled={busy} onClick={() => summon([p])}>{p.status === 'none' ? 'Invite' : 'Summon'}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}