import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import LabCard from './LabCard.jsx';

export default function PatientLabResults({ patient, refreshKey }) {
  const [rows, setRows] = useState([]);
  const load = useCallback(async () => {
    if (!patient) { setRows([]); return; }
    const { data } = await supabase.from('lab_requests').select('*, referrals(id)').eq('patient_id', patient.id)
      .order('requested_at', { ascending: false }).limit(4);
    setRows((data ?? []).map((r) => ({ ...r, patient })));
  }, [patient]);
  useEffect(() => { load(); }, [load, refreshKey]);

  return (
    <div className="panel-card mb-4">
      <h5 className="mb-3">Laboratory</h5>
      {!patient ? <div className="text-secondary">Select a patient.</div>
        : rows.length === 0 ? <div className="text-secondary">No lab requests.</div>
          : <div className="d-grid gap-3">{rows.map((lab) => <LabCard key={lab.id} lab={lab} onChanged={load} />)}</div>}
    </div>
  );
}