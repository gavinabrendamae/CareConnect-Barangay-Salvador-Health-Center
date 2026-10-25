import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { fullName, formatDateTime, startOfTodayISO } from '../lib/format.js';

export const QUEUE_BADGE = { for_vitals: 'secondary', waiting: 'warning', in_consultation: 'primary', done: 'success', cancelled: 'dark' };
export const QUEUE_LABEL = { for_vitals: 'For vitals', waiting: 'Waiting for midwife/doctor', in_consultation: 'In consultation', done: 'Done', cancelled: 'Cancelled' };

export default function QueueStatus() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const { data, error: err } = await supabase.from('queue')
      .select('id, status, reason, created_at, patient:patients(first_name, middle_name, last_name, suffix, purok, medical_id)')
      .gte('created_at', startOfTodayISO()).order('created_at');
    if (err) setError(err.message); else setRows(data ?? []);
  }, []);

  useEffect(() => {
    load();
    const channel = supabase.channel(`qstatus-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'queue' }, load).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load]);

  const count = (s) => rows.filter((r) => r.status === s).length;
  const cards = [
    { num: rows.filter((r) => r.status !== 'cancelled').length, lbl: 'Checked in today', icon: 'bi-people-fill' },
    { num: count('for_vitals'), lbl: 'Waiting for vitals', icon: 'bi-heart-pulse' },
    { num: count('waiting') + count('in_consultation'), lbl: 'With midwife / doctor', icon: 'bi-clipboard2-pulse' },
    { num: count('done'), lbl: 'Done today', icon: 'bi-check2-circle' },
  ];

  return (
    <>
      {error && <div className="alert alert-danger">{error}</div>}
      <div className="row g-3 mb-4">
        {cards.map((c) => (
          <div className="col-6 col-xl-3" key={c.lbl}>
            <div className="stat-card"><i className={`bi ${c.icon} text-success`} /><div className="num">{c.num}</div><div className="lbl">{c.lbl}</div></div>
          </div>
        ))}
      </div>
      <div className="panel-card">
        <h5 className="mb-3">Today's Attendance &amp; Queue</h5>
        {rows.length === 0 ? <div className="text-secondary">Nobody has checked in yet today.</div> : (
          <div className="table-responsive">
            <table className="table align-middle mb-0">
              <thead><tr><th>#</th><th>Patient</th><th>Complaint</th><th>Checked in</th><th>Status</th></tr></thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.id}>
                    <td>{i + 1}</td>
                    <td><strong>{fullName(r.patient)}</strong><div className="small text-secondary">{r.patient?.medical_id} · {r.patient?.purok}</div></td>
                    <td>{r.reason || '—'}</td>
                    <td className="small">{formatDateTime(r.created_at)}</td>
                    <td><span className={`badge bg-${QUEUE_BADGE[r.status]}${r.status === 'waiting' ? ' text-dark' : ''}`}>{QUEUE_LABEL[r.status]}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}