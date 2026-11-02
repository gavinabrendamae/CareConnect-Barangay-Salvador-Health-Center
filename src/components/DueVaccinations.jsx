import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { addDaysISO, formatDate, fullName, todayISO } from '../lib/format.js';

// Doses on the immunization cards that are due today (or overdue) or tomorrow and not yet confirmed as vaccinated.
export default function DueVaccinations({ onReschedule }) {
  const [rows, setRows] = useState(null);

  useEffect(() => {
    supabase.from('immunization_records')
      .select('id, vaccine, dose_no, given_date, patient:patients(id, first_name, middle_name, last_name, suffix, birth_date, gender, purok)')
      .gt('dose_no', 0).is('confirmed_at', null).lte('given_date', addDaysISO(1)).order('given_date')
      .then(({ data }) => setRows(data ?? []));
  }, []);

  const today = todayISO();
  return (
    <div className="panel-card">
      <h5 className="mb-3">Vaccinations Due (today, overdue &amp; tomorrow)</h5>
      {rows === null ? <div className="text-secondary">Loading...</div> : rows.length === 0 ? (
        <div className="text-secondary">No vaccinations due. Open the Immunization Record tab to set dates.</div>
      ) : (
        <div className="table-responsive">
          <table className="table align-middle mb-0">
            <thead><tr><th>Date</th><th>Patient</th><th>Vaccine</th>{onReschedule && <th />}</tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="small">{formatDate(r.given_date)} {r.given_date < today ? <span className="badge bg-danger">Overdue</span> : r.given_date === today ? <span className="badge bg-success">Today</span> : <span className="badge bg-secondary">Tomorrow</span>}</td>
                  <td><strong>{fullName(r.patient)}</strong><div className="small text-secondary">{r.patient?.purok}</div></td>
                  <td>{r.vaccine} <span className="text-secondary">(dose {r.dose_no})</span></td>
                  {onReschedule && (
                    <td className="text-end text-nowrap">
                      <button className="btn btn-sm btn-primary-custom" onClick={() => onReschedule(r.patient, `${r.vaccine} (dose ${r.dose_no})`)}>
                        <i className="bi bi-calendar-event me-1" />Reschedule
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}