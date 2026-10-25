import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { staffOr, noStaff } from '../lib/staffFilter.js';
import { daysUntil } from '../lib/format.js';

function monthStartISO() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
}

export default function AnalyticsPanel() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      const since = new Date(Date.now() - 90 * 86400000).toISOString();
      const so = await staffOr();
      const [patients, monthConsults, recent, stock, batches, queueNow] = await Promise.all([
        noStaff(supabase.from('patients').select('id', { count: 'exact', head: true }), so),
        supabase.from('consultations').select('id', { count: 'exact', head: true }).gte('consulted_at', monthStartISO()),
        supabase.from('consultations').select('diagnosis').gte('consulted_at', since).not('diagnosis', 'is', null),
        supabase.from('public_medicine_stock').select('status'),
        supabase.from('medicine_batches').select('expiration_date').gt('quantity', 0),
        supabase.from('queue').select('id', { count: 'exact', head: true }).in('status', ['waiting', 'in_consultation']),
      ]);
      const failed = [patients, monthConsults, recent, stock, batches, queueNow].find((r) => r.error);
      if (failed) return setError(failed.error.message);

      const counts = {};
      (recent.data ?? []).forEach((c) => {
        const k = c.diagnosis.trim().toLowerCase();
        if (k) counts[k] = (counts[k] || 0) + 1;
      });
      const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);

      setData({
        patients: patients.count ?? 0,
        monthConsults: monthConsults.count ?? 0,
        inQueue: queueNow.count ?? 0,
        low: (stock.data ?? []).filter((s) => s.status === 'Low stock').length,
        out: (stock.data ?? []).filter((s) => s.status === 'Out of stock').length,
        expiring: (batches.data ?? []).filter((b) => { const d = daysUntil(b.expiration_date); return d >= 0 && d <= 30; }).length,
        expired: (batches.data ?? []).filter((b) => daysUntil(b.expiration_date) < 0).length,
        top,
      });
    })();
  }, []);

  if (error) return <div className="alert alert-danger">{error}</div>;
  if (!data) return <div className="text-secondary">Loading analytics...</div>;

  const stats = [
    { num: data.patients, lbl: 'Registered patients', icon: 'bi-people-fill' },
    { num: data.monthConsults, lbl: 'Consultations this month', icon: 'bi-clipboard2-pulse' },
    { num: data.inQueue, lbl: 'In queue now', icon: 'bi-hourglass-split' },
    { num: data.low + data.out, lbl: `Low / out of stock (${data.out} out)`, icon: 'bi-capsule' },
    { num: data.expiring, lbl: 'Batches expiring in 30 days', icon: 'bi-calendar-x' },
    { num: data.expired, lbl: 'Expired batches still on shelf', icon: 'bi-exclamation-triangle' },
  ];
  const max = data.top[0]?.[1] || 1;

  return (
    <>
      <div className="row g-3 mb-4">
        {stats.map((s) => (
          <div className="col-6 col-lg-4" key={s.lbl}>
            <div className="stat-card">
              <i className={`bi ${s.icon} text-success`} />
              <div className="num">{s.num}</div>
              <div className="lbl">{s.lbl}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="panel-card">
        <h5 className="mb-3">Top Diagnoses (last 90 days)</h5>
        {data.top.length === 0 ? <div className="text-secondary">No consultations recorded yet.</div> : data.top.map(([name, n]) => (
          <div className="mb-3" key={name}>
            <div className="d-flex justify-content-between"><span className="text-capitalize">{name}</span><strong>{n}</strong></div>
            <div className="progress" style={{ height: 8 }}>
              <div className="progress-bar bg-success" style={{ width: `${(n / max) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}