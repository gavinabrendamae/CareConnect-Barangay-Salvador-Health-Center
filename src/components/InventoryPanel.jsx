import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext.jsx';
import Modal from './Modal.jsx';
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
  const [disposals, setDisposals] = useState([]);
  const [confirmList, setConfirmList] = useState(null); // batches waiting for pull-out confirmation
  const [busyPull, setBusyPull] = useState(false);

  async function pullOut() {
    const list = confirmList;
    setBusyPull(true); setMsg(null);
    for (const b of list) {
      const { error } = await supabase.rpc('pull_out_batch', { p_batch_id: b.id });
      if (error) { setMsg({ type: 'danger', text: error.message }); setBusyPull(false); setConfirmList(null); load(); return; }
    }
    setBusyPull(false); setConfirmList(null);
    setMsg({ type: 'success', text: 'Pulled out from stock.' });
    load();
  }

  const load = useCallback(async () => {
    const [m, b, s, dp] = await Promise.all([
      supabase.from('medicines').select('*').order('name'),
      supabase.from('medicine_batches').select('*, medicine:medicines(name, unit)').gt('quantity', 0).order('expiration_date'),
      supabase.from('public_medicine_stock').select('*').order('name'),
      supabase.from('batch_disposals').select('*, medicine:medicines(name, unit)').order('disposed_at', { ascending: false }).limit(30),
    ]);
    setDisposals(dp.data ?? []);
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
    setMsg({ type: 'success', text: 'Medicine added.' });
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
    setMsg({ type: 'success', text: 'Batch added.' });
    load();
  }

  const [open, setOpen] = useState({});
  const toggle = (k) => setOpen((o) => ({ ...o, [k]: !o[k] }));
  const FoldHead = ({ id, icon, title }) => (
    <button type="button" onClick={() => toggle(id)} aria-expanded={!!open[id]}
      style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between', gap: '.75rem', background: 'none', border: 0, padding: 0, textAlign: 'left', color: 'var(--primary-dark)', fontWeight: 700, fontSize: '1.25rem' }}>
      <span><i className={`bi ${icon} me-2 text-primary`} />{title}</span>
      <i className={`bi bi-chevron-${open[id] ? 'up' : 'down'}`} style={{ fontSize: '1rem' }} />
    </button>
  );

  const STATUS_BADGE = { Available: 'success', 'Low stock': 'warning', 'Out of stock': 'danger' };

  return (
    <div>
      {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}
      <div className="row g-4 mb-4 align-items-start">
      <div className="col-lg-6">
        <form className="panel-card" onSubmit={addBatch}>
          <FoldHead id="stockin" icon="bi-box-arrow-in-down" title="Stock-In Form (New Batch)" />
          {open.stockin && <div className="mt-3">
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
          </div>}
        </form>
      </div>
      <div className="col-lg-6">
        <form className="panel-card" onSubmit={addMedicine}>
          <FoldHead id="newmed" icon="bi-plus-square" title="Add New Medicine" />
          {open.newmed && <div className="mt-3">
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
          </div>}
        </form>
      </div>
      </div>

      <div>
        <div className="panel-card mb-4">
          <FoldHead id="summary" icon="bi-list-check" title="Stock Summary" />
          {open.summary && <div className="mt-3">
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
          </div>}
        </div>

        <div className="panel-card">
          <FoldHead id="fefo" icon="bi-sort-numeric-down" title="FEFO Batch Order" />
          {open.fefo && <div className="mt-2">
          <p className="text-secondary small">Earliest expiration first — this is the order stock is dispensed in. Expired batches are never dispensed.</p>
          {batches.some((b) => daysUntil(b.expiration_date) < 0) && (
            <div className="alert alert-danger d-flex flex-wrap justify-content-between align-items-center gap-2 py-2">
              <span><i className="bi bi-exclamation-triangle me-1" /><strong>{batches.filter((b) => daysUntil(b.expiration_date) < 0).length}</strong> expired batch(es) still in stock — take them out of the health center and pull them out here.</span>
              <button type="button" className="btn btn-sm btn-danger" onClick={() => setConfirmList(batches.filter((b) => daysUntil(b.expiration_date) < 0))}>Pull out all expired</button>
            </div>
          )}
          {batches.length === 0 ? <div className="text-secondary">No batches in stock.</div> : (
            <div className="table-responsive">
              <table className="table mb-0">
                <thead><tr><th>Medicine</th><th>Batch</th><th>Qty left</th><th>Expires</th><th>Status</th></tr></thead>
                <tbody>
                  {batches.map((b) => (
                    <tr key={b.id}>
                      <td>{b.medicine?.name}</td>
                      <td>{b.batch_no || '—'}</td>
                      <td>{b.quantity} {b.medicine?.unit}</td>
                      <td>{formatDate(b.expiration_date)}</td>
                      <td className="text-nowrap">
                        {daysUntil(b.expiration_date) < 0 && <span className="badge bg-danger me-1">Expired</span>}
                        {daysUntil(b.expiration_date) <= EXPIRING_DAYS
                          ? <button type="button" className={`btn btn-sm ${daysUntil(b.expiration_date) < 0 ? 'btn-danger' : 'btn-warning'}`} onClick={() => setConfirmList([b])}><i className="bi bi-box-arrow-up me-1" />Pull out</button>
                          : expiryBadge(b.expiration_date)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          </div>}
        </div>

        <div className="panel-card mt-4">
          <FoldHead id="pullout" icon="bi-box-arrow-up" title="Pull-out History" />
          {open.pullout && <div className="mt-2">
          <p className="text-secondary small">Medicine pulled out of the health center because it expired or is about to.</p>
          {disposals.length === 0 ? <div className="text-secondary">Nothing removed yet.</div> : (
            <div className="table-responsive">
              <table className="table mb-0">
                <thead><tr><th>Removed on</th><th>Medicine</th><th>Batch</th><th>Qty</th><th>Expires</th><th>Reason</th></tr></thead>
                <tbody>
                  {disposals.map((d) => (
                    <tr key={d.id}>
                      <td>{formatDate(d.disposed_at.slice(0, 10))}</td>
                      <td>{d.medicine?.name}</td>
                      <td>{d.batch_no || '—'}</td>
                      <td>{d.quantity} {d.medicine?.unit}</td>
                      <td>{formatDate(d.expiration_date)}</td>
                      <td>{d.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          </div>}
        </div>
      </div>
      <Modal show={!!confirmList} title="Pull out from stock" icon="bi-box-arrow-up" onClose={() => !busyPull && setConfirmList(null)}
        footer={<><button type="button" className="btn btn-outline-secondary" disabled={busyPull} onClick={() => setConfirmList(null)}>Cancel</button>
          <button type="button" className="btn btn-danger px-4" disabled={busyPull} onClick={pullOut}><i className="bi bi-box-arrow-up me-1" />{busyPull ? 'Pulling out...' : 'Yes, pull out'}</button></>}>
        {confirmList && (
          <>
            <div className="d-flex align-items-start gap-3 mb-3">
              <span className="d-inline-flex align-items-center justify-content-center rounded-circle bg-warning-subtle text-warning" style={{ width: 48, height: 48, fontSize: '1.5rem', flex: '0 0 auto' }}><i className="bi bi-exclamation-triangle-fill" /></span>
              <div>
                <div className="fw-bold">Take the whole batch out of the health center?</div>
                <div className="small text-secondary">All remaining medicine in {confirmList.length > 1 ? 'these batches' : 'this batch'} will be removed from stock. This is recorded in the pull-out history and cannot be undone.</div>
              </div>
            </div>
            <div className="border rounded overflow-hidden" style={{ maxHeight: 240, overflowY: 'auto' }}>
              <table className="table table-sm align-middle mb-0">
                <thead className="table-light"><tr><th>Medicine</th><th>Batch</th><th>Qty</th><th>Expires</th></tr></thead>
                <tbody>
                  {confirmList.map((b) => (
                    <tr key={b.id}><td className="fw-semibold">{b.medicine?.name}</td><td>{b.batch_no || '—'}</td><td>{b.quantity} {b.medicine?.unit}</td><td>{formatDate(b.expiration_date)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}