import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext.jsx';
import { formatDate, daysUntil, todayISO } from '../lib/format.js';

const EXPIRING_DAYS = 30;
const CATEGORIES = ['Fever & Pain', 'Cough & Colds', 'Hypertension', 'Diabetes', 'Infection (Antibiotic)', 'Vitamins & Supplements', 'Maternal & Child Health', 'First Aid', 'Stomach & Digestion', 'Allergy', 'Asthma & Breathing', 'Deworming'];

export function expiryBadge(dateStr) {
  const d = daysUntil(dateStr);
  if (d < 0) return <span className="badge bg-danger">Expired</span>;
  if (d <= EXPIRING_DAYS) return <span className="badge bg-warning text-dark">Expires in {d}d</span>;
  return <span className="badge bg-success">OK</span>;
}

export default function InventoryPanel() {
  const { user } = useAuth();
  const [medicines, setMedicines] = useState([]);
  const [batches, setBatches] = useState([]);
  const [stock, setStock] = useState([]);
  const [med, setMed] = useState({ name: '', unit: 'pcs', reorder_level: 20, category: '' });
  const [batch, setBatch] = useState({ medicine_id: '', batch_no: '', quantity: '', expiration_date: '' });
  const [msg, setMsg] = useState(null);

  const load = useCallback(async () => {
    const [m, b, s] = await Promise.all([
      supabase.from('medicines').select('*').order('name'),
      supabase.from('medicine_batches').select('*, medicine:medicines(name, unit)').gt('quantity', 0).order('expiration_date'),
      supabase.from('public_medicine_stock').select('*').order('name'),
    ]);
    setMedicines(m.data ?? []);
    setBatches(b.data ?? []);
    setStock(s.data ?? []);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function addMedicine(e) {
    e.preventDefault();
    setMsg(null);
    const { error } = await supabase.from('medicines').insert({
      name: med.name.trim(), unit: med.unit.trim() || 'pcs', reorder_level: Number(med.reorder_level) || 0,
      category: med.category.trim() || null,
    });
    if (error) return setMsg({ type: 'danger', text: error.code === '23505' ? 'That medicine already exists.' : error.message });
    setMed({ name: '', unit: 'pcs', reorder_level: 20, category: '' });
    setMsg({ type: 'success', text: 'Medicine added. You can now stock-in a batch for it.' });
    load();
  }

  async function addBatch(e) {
    e.preventDefault();
    setMsg(null);
    const { error } = await supabase.from('medicine_batches').insert({
      medicine_id: batch.medicine_id,
      batch_no: batch.batch_no.trim() || null,
      quantity: Number(batch.quantity),
      expiration_date: batch.expiration_date,
      received_by: user.id,
    });
    if (error) return setMsg({ type: 'danger', text: error.message });
    setBatch({ medicine_id: '', batch_no: '', quantity: '', expiration_date: '' });
    setMsg({ type: 'success', text: 'Batch added to stock.' });
    load();
  }

  const STATUS_BADGE = { Available: 'success', 'Low stock': 'warning', 'Out of stock': 'danger' };

  return (
    <div className="row g-4">
      <div className="col-lg-4">
        {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}
        <form className="panel-card mb-4" onSubmit={addBatch}>
          <h5 className="mb-3">Stock-In Form (New Batch)</h5>
          <div className="mb-3"><label className="form-label required">Medicine</label>
            <select className="form-select" value={batch.medicine_id} onChange={(e) => setBatch({ ...batch, medicine_id: e.target.value })} required>
              <option value="" disabled>Select medicine</option>
              {medicines.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
            {batch.medicine_id && <div className="form-text">Used for: {medicines.find((m) => m.id === batch.medicine_id)?.category || 'not set'}</div>}</div>
          <div className="mb-3"><label className="form-label">Batch / lot no.</label>
            <input className="form-control" value={batch.batch_no} onChange={(e) => setBatch({ ...batch, batch_no: e.target.value })} /></div>
          <div className="row g-3 mb-3">
            <div className="col-6"><label className="form-label required">Quantity</label>
              <input type="number" min="1" className="form-control" value={batch.quantity} onChange={(e) => setBatch({ ...batch, quantity: e.target.value })} required /></div>
            <div className="col-6"><label className="form-label required">Expiration date</label>
              <input type="date" className="form-control" min={todayISO()} value={batch.expiration_date} onChange={(e) => setBatch({ ...batch, expiration_date: e.target.value })} required /></div>
          </div>
          <button className="btn btn-primary-custom w-100">Add batch</button>
        </form>

        <form className="panel-card" onSubmit={addMedicine}>
          <h5 className="mb-3">Add New Medicine</h5>
          <div className="mb-3"><label className="form-label required">Name</label>
            <input className="form-control" placeholder="e.g. Paracetamol 500mg" value={med.name} onChange={(e) => setMed({ ...med, name: e.target.value })} required /></div>
          <div className="mb-3"><label className="form-label">Used for</label>
            <input className="form-control" list="medCategories" placeholder="e.g. Fever & Pain" value={med.category} onChange={(e) => setMed({ ...med, category: e.target.value })} />
            <datalist id="medCategories">{CATEGORIES.map((c) => <option key={c} value={c} />)}</datalist></div>
          <div className="row g-3 mb-3">
            <div className="col-6"><label className="form-label">Unit</label>
              <input className="form-control" value={med.unit} onChange={(e) => setMed({ ...med, unit: e.target.value })} /></div>
            <div className="col-6"><label className="form-label">Low-stock level</label>
              <input type="number" min="0" className="form-control" value={med.reorder_level} onChange={(e) => setMed({ ...med, reorder_level: e.target.value })} /></div>
          </div>
          <button className="btn btn-outline-primary-custom w-100">Add medicine</button>
        </form>
      </div>

      <div className="col-lg-8">
        <div className="panel-card mb-4">
          <h5 className="mb-3">Stock Summary</h5>
          {stock.length === 0 ? <div className="text-secondary">No medicines yet. Add one to get started.</div> : (
            <div className="table-responsive">
              <table className="table mb-0">
                <thead><tr><th>Medicine</th><th>Category</th><th>Unexpired qty</th><th>Status</th></tr></thead>
                <tbody>
                  {stock.map((s) => (
                    <tr key={s.id}>
                      <td><strong>{s.name}</strong></td>
                      <td className="small">{s.category || '—'}</td>
                      <td>{s.available_quantity} {s.unit}</td>
                      <td><span className={`badge bg-${STATUS_BADGE[s.status]}${s.status === 'Low stock' ? ' text-dark' : ''}`}>{s.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="panel-card">
          <h5 className="mb-1">FEFO Batch Order</h5>
          <p className="text-secondary small">Earliest expiration first — this is the order stock is dispensed in. Expired batches are never dispensed.</p>
          {batches.length === 0 ? <div className="text-secondary">No batches in stock.</div> : (
            <div className="table-responsive">
              <table className="table mb-0">
                <thead><tr><th>Medicine</th><th>Batch</th><th>Qty left</th><th>Expires</th><th /></tr></thead>
                <tbody>
                  {batches.map((b) => (
                    <tr key={b.id}>
                      <td>{b.medicine?.name}</td>
                      <td>{b.batch_no || '—'}</td>
                      <td>{b.quantity} {b.medicine?.unit}</td>
                      <td>{formatDate(b.expiration_date)}</td>
                      <td>{expiryBadge(b.expiration_date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}