import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import SiteNavbar from '../components/SiteNavbar.jsx';
import SiteFooter from '../components/SiteFooter.jsx';

export default function PublicPortalPage() {
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updated, setUpdated] = useState(null);

  const load = useCallback(async () => {
    const { data, error: err } = await supabase.from('public_medicine_stock').select('*').gt('available_quantity', 0).order('name');
    if (err) setError(err.message); else { setRows(data ?? []); setError(''); setUpdated(new Date()); }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [load]);

  const term = q.trim().toLowerCase();
  const shown = term ? rows.filter((r) => r.name.toLowerCase().includes(term)) : rows;

  return (
    <>
      <SiteNavbar />
      <div className="container py-5" style={{ maxWidth: 900 }}>
        <h2 className="section-title mb-1">Medicines Offered</h2>
        <p className="text-secondary mb-4">
          Free medicines offered at the Barangay Health Center and what each one is used for.
        </p>
        <input className="form-control form-control-lg mb-4" placeholder="Search medicine..." value={q} onChange={(e) => setQ(e.target.value)} />
        {error && <div className="alert alert-danger">{error}</div>}
        <div className="panel-card">
          {loading ? <div className="text-secondary">Loading...</div> : shown.length === 0 ? (
            <div className="text-secondary">{rows.length === 0 ? 'No medicines to show right now.' : 'No medicine matches your search.'}</div>
          ) : (
            <div className="table-responsive">
              <table className="table mb-0">
                <thead><tr><th>Medicine</th><th>Used for</th></tr></thead>
                <tbody>
                  {shown.map((r) => (
                    <tr key={r.id}>
                      <td><strong>{r.name}</strong></td>
                      <td>{r.category ? <span className="badge bg-success-subtle text-success-emphasis border border-success-subtle fw-semibold">{r.category}</span> : <span className="text-secondary">—</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      <SiteFooter />
    </>
  );
}