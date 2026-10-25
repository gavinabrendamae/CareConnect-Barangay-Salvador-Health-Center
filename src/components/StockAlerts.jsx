import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { daysUntil, formatDate } from '../lib/format.js';

export const EXPIRING_DAYS = 30;

export default function StockAlerts() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      const [s, b] = await Promise.all([
        supabase.from('public_medicine_stock').select('*').neq('status', 'Available').order('name'),
        supabase.from('medicine_batches').select('id, batch_no, quantity, expiration_date, medicine:medicines(name, unit)')
          .gt('quantity', 0).order('expiration_date'),
      ]);
      const failed = [s, b].find((r) => r.error);
      if (failed) return setError(failed.error.message);
      const batches = b.data ?? [];
      setData({
        low: s.data ?? [],
        expiring: batches.filter((x) => { const d = daysUntil(x.expiration_date); return d >= 0 && d <= EXPIRING_DAYS; }),
        expired: batches.filter((x) => daysUntil(x.expiration_date) < 0),
      });
    })();
  }, []);

  if (error) return <div className="alert alert-danger">{error}</div>;
  if (!data) return <div className="text-secondary">Checking stock...</div>;

  const { low, expiring, expired } = data;
  if (!low.length && !expiring.length && !expired.length) {
    return <div className="alert alert-success mb-0"><i className="bi bi-check-circle-fill me-2" />No low-stock or expiring-soon alerts.</div>;
  }

  const batchLine = (x) => (
    <li key={x.id} className="d-flex justify-content-between">
      <span>{x.medicine?.name} <span className="text-secondary small">batch {x.batch_no || '—'} · {x.quantity} {x.medicine?.unit}</span></span>
      <span className="small">{formatDate(x.expiration_date)}</span>
    </li>
  );

  return (
    <div className="row g-3">
      {expired.length > 0 && (
        <div className="col-12">
          <div className="alert alert-danger mb-0">
            <strong><i className="bi bi-x-octagon-fill me-2" />Expired — remove from shelf ({expired.length})</strong>
            <ul className="list-unstyled mb-0 mt-2">{expired.map(batchLine)}</ul>
          </div>
        </div>
      )}
      <div className="col-lg-6">
        <div className="alert alert-warning mb-0 h-100">
          <strong><i className="bi bi-hourglass-split me-2" />Expiring within {EXPIRING_DAYS} days ({expiring.length})</strong>
          {expiring.length === 0 ? <div className="small mt-2">None.</div> : <ul className="list-unstyled mb-0 mt-2">{expiring.map(batchLine)}</ul>}
        </div>
      </div>
      <div className="col-lg-6">
        <div className="alert alert-warning mb-0 h-100">
          <strong><i className="bi bi-capsule me-2" />Low / out of stock ({low.length})</strong>
          {low.length === 0 ? <div className="small mt-2">None.</div> : (
            <ul className="list-unstyled mb-0 mt-2">
              {low.map((m) => (
                <li key={m.id} className="d-flex justify-content-between">
                  <span>{m.name}</span>
                  <span className="small">{m.available_quantity} {m.unit} · {m.status}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}