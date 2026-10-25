import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { staffOr, noStaff } from '../lib/staffFilter.js';
import { fullName } from '../lib/format.js';

export default function PatientPicker({ value, onChange, label = 'Patient', accountOnly = false }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const term = q.replace(/[,()%*]/g, ' ').trim();
    if (term.length < 2) { setResults([]); return; }
    const t = setTimeout(async () => {
      let query = supabase
        .from('patients')
        .select('id, first_name, middle_name, last_name, suffix, birth_date, purok, contact_number, gender')
        .or(`first_name.ilike.%${term}%,last_name.ilike.%${term}%`);
      if (accountOnly) query = query.not('profile_id', 'is', null);   
      query = noStaff(query, await staffOr());
      const { data } = await query.order('last_name').limit(8);
      setResults(data ?? []);
      setOpen(true);
    }, 300);
    return () => clearTimeout(t);
  }, [q, accountOnly]);

  if (value) {
    return (
      <div className="mb-3">
        <label className="form-label">{label}</label>
        <div className="d-flex align-items-center justify-content-between border rounded px-3 py-2 bg-white">
          <span><i className="bi bi-person-check-fill text-success me-2" /><strong>{fullName(value)}</strong>
            {value.purok && <span className="text-secondary ms-2">{value.purok}</span>}</span>
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => { onChange(null); setQ(''); }}>Change</button>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-3 position-relative">
      <label className="form-label">{label}</label>
      <input className="form-control" placeholder="Type at least 2 letters of the first or last name"
        value={q} onChange={(e) => setQ(e.target.value)} onFocus={() => results.length && setOpen(true)} />
      {open && q.trim().length >= 2 && (
        <div className="picker-list">
          {results.length === 0
            ? <div className="px-3 py-2 text-secondary">{accountOnly ? 'No resident with an account found.' : 'No patients found.'}</div>
            : results.map((p) => (
              <button key={p.id} type="button" onClick={() => { onChange(p); setOpen(false); }}>
                <strong>{fullName(p)}</strong>
                <small className="text-secondary ms-2">{p.purok}</small>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}