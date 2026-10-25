import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext.jsx';
import { DEPO } from '../lib/immunizationCards.js';
import { useCardExport } from '../lib/useCardExport.js';
import { formatDate, fullName, todayISO } from '../lib/format.js';

const pad = (x) => String(x).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
// 3 months after a date; if that lands on a weekend it moves to Monday.
function returnDateFor(dateISO) {
  const d = new Date(`${dateISO}T00:00:00`);
  d.setMonth(d.getMonth() + 3);
  if (d.getDay() === 6) d.setDate(d.getDate() + 2);
  if (d.getDay() === 0) d.setDate(d.getDate() + 1);
  return iso(d);
}
const isWeekend = (dateISO) => [0, 6].includes(new Date(`${dateISO}T00:00:00`).getDay());
const nextMonday = (dateISO) => { const d = new Date(`${dateISO}T00:00:00`); d.setDate(d.getDate() + (d.getDay() === 6 ? 2 : 1)); return iso(d); };

/**
 * Family planning card (Depo-Provera, every 3 months).
 *   Date of Vaccine = the day the injection was given. Typing it records the injection and
 *   automatically sets the Date of Return (3 months later, weekdays only). The next row's
 *   Date of Vaccine stays empty until that injection is actually given.
 */
export default function FamilyPlanningCard({ patientId, editable = false, hideIfEmpty = false }) {
  const { user } = useAuth();
  const [patient, setPatient] = useState(null);
  const [recs, setRecs] = useState({});
  const [msg, setMsg] = useState(null);
  const cardRef = useRef(null);
  const { printCard, downloadPdf, dl } = useCardExport(cardRef, `Family-Planning-Card-${(patient?.last_name || 'patient').replace(/\s+/g, '-')}.pdf`);

  const load = useCallback(async () => {
    const { data: p } = await supabase.from('patients').select('*').eq('id', patientId).maybeSingle();
    setPatient(p);
    const { data: r } = await supabase.from('immunization_records').select('*').eq('patient_id', patientId).eq('vaccine', DEPO).gt('dose_no', 0);
    const map = {};
    (r ?? []).forEach((x) => { map[x.dose_no] = x; });
    setRecs(map);
  }, [patientId]);
  useEffect(() => { load(); }, [load]);

  if (!patient) return null;
  if (hideIfEmpty && !editable && Object.keys(recs).length === 0) return null;

  const today = todayISO();
  const maxDose = Math.max(0, ...Object.keys(recs).map(Number));
  const rowCount = Math.max(6, maxDose + 1);
  const rowsN = Array.from({ length: rowCount }, (_, i) => i + 1);

  async function notify(n, kind) {
    const { data, error } = await supabase.functions.invoke('vaccine-given-notify', { body: { patient_id: patientId, vaccine: DEPO, dose_no: n, kind } });
    let reason = error?.message;
    if (error?.context?.json) { try { reason = (await error.context.json())?.error ?? reason; } catch { /* keep */ } }
    return error ? `Gmail notice failed: ${reason}` : (data?.emailSent ? `Gmail notice sent to ${data.emailSent} address(es).` : 'In-app notice sent (no email on file).');
  }

  async function setVaccineDate(n, value) {
    setMsg(null);
    if (!value) {   // cleared: remove this injection and its automatic return date
      await supabase.from('immunization_records').delete().eq('patient_id', patientId).eq('vaccine', DEPO).eq('dose_no', n);
      const nxt = recs[n + 1];
      if (nxt && !nxt.confirmed_at) await supabase.from('immunization_records').delete().eq('patient_id', patientId).eq('vaccine', DEPO).eq('dose_no', n + 1);
      return load();
    }
    const now = new Date().toISOString();
    const { error } = await supabase.from('immunization_records').upsert(
      { patient_id: patientId, vaccine: DEPO, dose_no: n, given_date: value, given_by: user.id, confirmed_at: now, confirmed_by: user.id,
        given_notified_at: null, reminded_at: null, notified_at: null },
      { onConflict: 'patient_id,vaccine,dose_no' });
    if (error) return setMsg({ type: 'danger', text: error.message });
    const ret = returnDateFor(value);
    const nxt = recs[n + 1];
    if (!nxt || !nxt.confirmed_at) {
      await supabase.from('immunization_records').upsert(
        { patient_id: patientId, vaccine: DEPO, dose_no: n + 1, given_date: ret, given_by: user.id,
          confirmed_at: null, confirmed_by: null, given_notified_at: null, reminded_at: null, notified_at: null },
        { onConflict: 'patient_id,vaccine,dose_no' });
    }
    const note = await notify(n, 'given');
    setMsg({ type: note.startsWith('Gmail notice failed') ? 'warning' : 'success', text: `Injection ${n} recorded. Date of return set to ${formatDate(ret)}. ${note}` });
    load();
  }

  async function setReturnDate(n, value) {   // n = the dose this date belongs to (the next injection)
    setMsg(null);
    if (!value) return;
    let v = value;
    if (isWeekend(v)) { v = nextMonday(v); setMsg({ type: 'warning', text: `Weekends are not allowed; moved to Monday ${formatDate(v)}.` }); }
    const { error } = await supabase.from('immunization_records').upsert(
      { patient_id: patientId, vaccine: DEPO, dose_no: n, given_date: v, given_by: user.id, confirmed_at: null, confirmed_by: null,
        given_notified_at: null, reminded_at: null, notified_at: null },
      { onConflict: 'patient_id,vaccine,dose_no' });
    if (error) return setMsg({ type: 'danger', text: error.message });
    load();
  }

  return (
    <div className={`imm-card ${editable ? '' : 'readonly'}`} ref={cardRef}>
      <div className="imm-title">FAMILY PLANNING CARD</div>
      <div className="text-end mb-2 imm-noprint">
        <button type="button" className="btn btn-sm btn-light me-2" onClick={downloadPdf} disabled={dl}><i className="bi bi-download me-1" />{dl ? 'Preparing...' : 'Download PDF'}</button>
        <button type="button" className="btn btn-sm btn-light" onClick={printCard}><i className="bi bi-printer me-1" />Print</button>
      </div>
      <div className="imm-head">
        <div className="imm-field wide"><span className="imm-label">NAME</span><span className="imm-value">{fullName(patient)}</span></div>
        <div className="imm-field"><span className="imm-label">DATE OF BIRTH</span><span className="imm-value">{formatDate(patient.birth_date)}</span></div>
        <div className="imm-field"><span className="imm-label">ADDRESS</span><span className="imm-value">{[patient.purok, patient.address].filter(Boolean).join(', ')}</span></div>
        <div className="imm-field"><span className="imm-label">HEALTH CENTER</span><span className="imm-value">Barangay Salvador Health Center</span></div>
        <div className="imm-field"><span className="imm-label">MEDICAL ID</span><span className="imm-value">{patient.medical_id}</span></div>
        <div className="imm-field wide"><span className="imm-label">METHOD</span><span className="imm-value">Depo-Provera (DMPA) injection — every 3 months</span></div>
      </div>

      {msg && <div className={`alert alert-${msg.type} py-2 my-2 imm-noprint`}>{msg.text}</div>}

      <table className="imm-table">
        <thead>
          <tr><th style={{ width: '8%' }}>#</th><th style={{ width: '46%' }}>DATE OF VACCINE</th><th style={{ width: '46%' }}>DATE OF RETURN</th></tr>
        </thead>
        <tbody>
          {rowsN.map((n) => {
            const cur = recs[n];
            const nxt = recs[n + 1];
            const given = cur?.confirmed_at ? cur : null;
            const prevGiven = n === 1 || Boolean(recs[n - 1]?.confirmed_at);
            return (
              <tr key={n}>
                <td className="c imm-vax">{n}</td>
                <td className="c">
                  {editable
                    ? (given || prevGiven) && (
                      <input type="date" className={`imm-input ${given ? '' : 'imm-empty'}`} max={today} value={given?.given_date ?? ''}
                        onChange={(e) => setVaccineDate(n, e.target.value)} title="Date the injection was given" />
                    )
                    : given ? <span className="imm-ok">{formatDate(given.given_date)}</span> : null}
                </td>
                <td className="c">
                  {nxt && (editable && !nxt.confirmed_at
                    ? <input type="date" className="imm-input" min={today} value={nxt.given_date} onChange={(e) => setReturnDate(n + 1, e.target.value)} title="Date of return (weekdays only)" />
                    : <span className={nxt.confirmed_at ? 'imm-ok' : 'imm-soon'}>{formatDate(nxt.given_date)}</span>)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="imm-foot imm-noprint">
        {editable
          ? 'Type the Date of Vaccine when the injection is given. The Date of Return is set automatically 3 months later (weekdays only) and can be changed. The next row stays blank until that injection is given.'
          : 'Your Date of Return is the day to come back for your next injection.'}
      </div>
    </div>
  );
}