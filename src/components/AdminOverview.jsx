import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { staffOr, noStaff } from '../lib/staffFilter.js';
import { daysUntil, monthStartISO, startOfTodayISO, todayISO } from '../lib/format.js';
import { splitCategories } from '../lib/symptoms.js';
import { topCounts } from './BarList.jsx';
import { CHART_COLORS, HBarChart, SymptomTrendGrid } from './Charts.jsx';
import { fetchSymptomTrends, firstOfMonthsAgo } from '../lib/trends.js';
import StockAlerts from './StockAlerts.jsx';

export default function AdminOverview() {
  const [d, setD] = useState(null);
  const [error, setError] = useState('');
  const [span, setSpan] = useState(6);
  const [trend, setTrend] = useState(null);
  const [pick, setPick] = useState(null); 
  useEffect(() => {
    (async () => {
      const month = monthStartISO();
      const so = await staffOr();
      const res = await Promise.all([
        noStaff(supabase.from('patients').select('id', { count: 'exact', head: true }), so),
        supabase.from('queue').select('status').gte('created_at', startOfTodayISO()).in('status', ['waiting', 'in_consultation']),
        supabase.from('immunization_records').select('id', { count: 'exact', head: true }).gt('dose_no', 0).is('confirmed_at', null).lte('given_date', todayISO()),
        supabase.from('public_medicine_stock').select('status'),
        supabase.from('medicine_batches').select('expiration_date').gt('quantity', 0),
        supabase.from('consultations').select('diagnosis, complaint, symptom_category').gte('consulted_at', month),
        supabase.from('prescriptions').select('quantity, medicine:medicines(name, unit)').gte('created_at', month),
      ]);
      const failed = res.find((r) => r.error);
      if (failed) return setError(failed.error.message);
      const [pat, queue, vac, stock, batches, consults, rx] = res;

      const used = {};
      (rx.data ?? []).forEach((r) => {
        const k = r.medicine?.name ?? 'Unknown';
        used[k] = (used[k] || 0) + r.quantity;
      });

      setD({
        residents: pat.count ?? 0,
        inConsult: (queue.data ?? []).filter((q) => q.status === 'in_consultation').length,
        waiting: (queue.data ?? []).filter((q) => q.status === 'waiting').length,
        pendingVac: vac.count ?? 0,
        lowOut: (stock.data ?? []).filter((s) => s.status !== 'Available').length,
        expiring: (batches.data ?? []).filter((b) => { const x = daysUntil(b.expiration_date); return x <= 30; }).length,
        symptoms: topCounts((consults.data ?? []).flatMap((c) => c.symptom_category ? splitCategories(c.symptom_category) : [c.complaint])),
        consumption: Object.entries(used).sort((a, b) => b[1] - a[1]).slice(0, 6),
      });
    })();
  }, []);

  useEffect(() => {
    if (!pick) return undefined;
    setTrend(null);
    fetchSymptomTrends(firstOfMonthsAgo(span - 1), todayISO(), 200).then(setTrend).catch((e) => setError(e.message));
    return undefined;
  }, [span, pick]);

  useEffect(() => {
    if (!pick) return undefined;
    const esc = (e) => e.key === 'Escape' && setPick(null);
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [pick]);

  if (error) return <div className="alert alert-danger">{error}</div>;
  if (!d) return <div className="text-secondary">Loading overview...</div>;

  const cards = [
    { num: d.residents, lbl: 'Total registered residents', icon: 'bi-people-fill' },
    { num: d.inConsult + d.waiting, lbl: `Active consultations today (${d.inConsult} ongoing · ${d.waiting} waiting)`, icon: 'bi-clipboard2-pulse' },
    { num: d.pendingVac, lbl: 'Immunizations due / overdue', icon: 'bi-syringe' },
    { num: d.lowOut + d.expiring, lbl: `Low stock alerts (FEFO) — ${d.lowOut} low/out · ${d.expiring} expiring/expired`, icon: 'bi-exclamation-triangle' },
  ];

  return (
    <>
      <div className="row g-3 mb-4">
        {cards.map((c) => (
          <div className="col-6 col-xl-3" key={c.icon}>
            <div className="stat-card">
              <i className={`bi ${c.icon} text-success`} />
              <div className="num">{c.num}</div>
              <div className="lbl">{c.lbl}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="panel-card mb-4">
        <h5 className="mb-3">Top Symptoms (this month)</h5>
        <p className="small text-secondary mb-2">Click a symptom bar to see its monthly trend.</p>
        <HBarChart rows={d.symptoms} multi onSelect={setPick} color={CHART_COLORS.blue} empty="No complaints recorded this month." />
      </div>

      {pick && (
        <div className="modal d-block" style={{ background: 'rgba(15,30,50,.55)' }} onClick={() => setPick(null)} role="dialog" aria-modal="true">
          <div className="modal-dialog modal-dialog-centered modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Symptom Trend — cases per month</h5>
                <button type="button" className="btn-close" aria-label="Close" onClick={() => setPick(null)} />
              </div>
              <div className="modal-body">
                <div className="btn-group btn-group-sm mb-3">
                  {[6, 12].map((n) => <button key={n} className={`btn ${span === n ? 'btn-primary-custom' : 'btn-outline-secondary'}`} onClick={() => setSpan(n)}>{n} months</button>)}
                </div>
                {!trend ? <div className="text-secondary">Loading trend...</div> : (() => {
                  const mine = trend.series.filter((s) => s.name.trim().toLowerCase() === String(pick).trim().toLowerCase());
                  return <SymptomTrendGrid months={trend.months} series={mine} single empty="No cases recorded for this symptom." />;
                })()}
                <p className="small text-secondary mt-3 mb-0">The dashed end is the current month, which is not finished yet.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="row g-4 mb-4">
        <div className="col-lg-6"><div className="panel-card h-100">
          <h5 className="mb-3">FEFO Inventory — Medicine Consumption (this month)</h5>
          <HBarChart rows={d.consumption} unit="units" color={CHART_COLORS.aqua} empty="Nothing dispensed this month." />
        </div></div>
        <div className="col-lg-6"><div className="panel-card h-100">
          <h5 className="mb-3">FEFO Inventory — Stock Alerts</h5>
          <StockAlerts />
        </div></div>
      </div>
    </>
  );
}