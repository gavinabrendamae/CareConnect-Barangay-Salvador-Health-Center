import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext.jsx';
import { CARDS, cardKindFor, isYoungKind, DEPO } from '../lib/immunizationCards.js';
import { addDaysISO, formatDate, fullName, todayISO } from '../lib/format.js';

/**
 * DOH-style immunization record card.
 * editable = true  -> staff / admin (date pickers + remarks)
 * editable = false -> resident view (only doses already given are shown)
 */
export default function ImmunizationCard({ patientId, editable = false, forceKind = null, hideIfEmpty = false }) {
  const { user } = useAuth();
  const [patient, setPatient] = useState(null);
  const [parent, setParent] = useState(null);
  const [recs, setRecs] = useState({});
  const [extras, setExtras] = useState([]);
  const [newName, setNewName] = useState('');
  const [newDoses, setNewDoses] = useState(1);
  const [extraDoses, setExtraDoses] = useState({});
  const [msg, setMsg] = useState(null);
  const [dl, setDl] = useState(false);
  const cardRef = useRef(null);

  const load = useCallback(async () => {
    const { data: p } = await supabase.from('patients').select('*').eq('id', patientId).maybeSingle();
    setPatient(p);
    if (p?.household_head_id) {
      const { data: h } = await supabase.from('patients').select('first_name, middle_name, last_name, suffix').eq('id', p.household_head_id).maybeSingle();
      setParent(h);
    } else setParent(null);
    const { data: r } = await supabase.from('immunization_records').select('*').eq('patient_id', patientId);
    const map = {};
    (r ?? []).forEach((x) => { map[`${x.vaccine}|${x.dose_no}`] = x; });
    setRecs(map);
  }, [patientId]);

  useEffect(() => { load(); }, [load]);

  if (!patient) return null;
  const kind = forceKind ?? cardKindFor(patient);
  if (hideIfEmpty && !editable && !Object.values(recs).some((x) => x.dose_no > 0)) return null;
  if (!kind) return <div className="text-secondary">No immunization card for this patient type ({patient.patient_type || 'not set'}).</div>;
  const card = CARDS[kind];

  const today = todayISO();
  const dose = (vaccine, n) => recs[`${vaccine}|${n}`] ?? null;
  const hasAnyDose = (vaccine) => Object.values(recs).some((x) => x.vaccine === vaccine && x.dose_no > 0 && x.given_date);

  const configured = card.rows.map((r) => r.name);
  const customNames = [...new Set([
    ...Object.values(recs).map((x) => x.vaccine).filter((v) => !configured.includes(v) && v !== DEPO), 
    ...extras,
  ])];
  const maxDose = (name) => Math.max(0, ...Object.values(recs).filter((x) => x.vaccine === name).map((x) => x.dose_no));
  const rows = [...card.rows, ...customNames.map((name) => ({
    name, doses: Math.max(1, extraDoses[name] || 0, maxDose(name)), hint: 'iba pang bakuna', custom: true,
  }))];

  async function setDate(vaccine, n, value) {
    setMsg(null);
    const { error } = value
      ? await supabase.from('immunization_records').upsert(
        { patient_id: patientId, vaccine, dose_no: n, given_date: value, given_by: user.id,
          confirmed_at: null, confirmed_by: null, given_notified_at: null, reminded_at: null, notified_at: null },
        { onConflict: 'patient_id,vaccine,dose_no' })
      : await supabase.from('immunization_records').delete().eq('patient_id', patientId).eq('vaccine', vaccine).eq('dose_no', n);
    if (error) return setMsg({ type: 'danger', text: error.message });
    if (value) {
      if (value > addDaysISO(1)) {
        setMsg({ type: 'success', text: `${vaccine} dose ${n} scheduled for ${formatDate(value)}. The parent/child get a Gmail + in-app reminder the day before and on that day.` });
      } else {
        await sendNotice(vaccine, n, undefined, `${vaccine} dose ${n} scheduled for ${formatDate(value)}.`);
      }
    }
    load();
  }

  async function sendNotice(vaccine, n, kind, okText) {
    const { data, error: mailErr } = await supabase.functions.invoke('vaccine-given-notify', { body: { patient_id: patientId, vaccine, dose_no: n, kind } });
    let reason = mailErr?.message;
    if (mailErr?.context?.json) { try { reason = (await mailErr.context.json())?.error ?? reason; } catch { /* keep generic */ } }
    if (!mailErr && data?.failed?.length) reason = data.failed.join('; ');
    setMsg(reason
      ? { type: 'warning', text: `${okText} But the Gmail notice failed: ${reason}` }
      : { type: 'success', text: `${okText} ${data?.emailSent ? `Gmail notice sent to ${data.emailSent} address(es).` : 'In-app notice sent (no email on file).'}` });
  }

  async function confirm(vaccine, n) {
    setMsg(null);
    const { error } = await supabase.from('immunization_records')
      .update({ confirmed_at: new Date().toISOString(), confirmed_by: user.id })
      .eq('patient_id', patientId).eq('vaccine', vaccine).eq('dose_no', n);
    if (error) return setMsg({ type: 'danger', text: error.message });
    await sendNotice(vaccine, n, 'given', `${vaccine} dose ${n} confirmed as vaccinated.`);
    load();
  }

  async function undoConfirm(vaccine, n) {
    const { error } = await supabase.from('immunization_records')
      .update({ confirmed_at: null, confirmed_by: null, given_notified_at: null })
      .eq('patient_id', patientId).eq('vaccine', vaccine).eq('dose_no', n);
    if (error) setMsg({ type: 'danger', text: error.message }); else load();
  }

  async function saveRemarks(vaccine, text) {
    const t = text.trim();
    const old = recs[`${vaccine}|0`]?.remarks ?? '';
    if (t === old) return;
    const { error } = t
      ? await supabase.from('immunization_records').upsert(
        { patient_id: patientId, vaccine, dose_no: 0, remarks: t, given_by: user.id },
        { onConflict: 'patient_id,vaccine,dose_no' })
      : await supabase.from('immunization_records').delete().eq('patient_id', patientId).eq('vaccine', vaccine).eq('dose_no', 0);
    if (error) setMsg({ type: 'danger', text: error.message }); else load();
  }

  async function saveBirth(field, value) {
    const v = value === '' ? null : value;
    if ((patient[field] ?? null) === v) return;
    const { error } = await supabase.from('patients').update({ [field]: v }).eq('id', patientId);
    if (error) setMsg({ type: 'danger', text: error.message }); else load();
  }

  function printCard() {
    const el = cardRef.current;
    el.classList.add('imm-print-target');
    document.body.classList.add('imm-printing');
    const done = () => { el.classList.remove('imm-print-target'); document.body.classList.remove('imm-printing'); window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    window.print();
  }

  async function downloadPdf() {
    setDl(true);
    const el = cardRef.current;
    el.classList.add('imm-exporting');
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')]);
      const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'in', format: [8.27, 5.83] });
      const margin = 0.2;
      const maxW = 8.27 - margin * 2;
      const maxH = 5.83 - margin * 2;
      const ratio = canvas.width / canvas.height;
      let w = maxW; let h = w / ratio;
      if (h > maxH) { h = maxH; w = h * ratio; }
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', (8.27 - w) / 2, (5.83 - h) / 2, w, h);
      pdf.save(`Immunization-Record-${(patient.last_name || 'patient').replace(/\s+/g, '-')}.pdf`);
    } catch (e) {
      setMsg({ type: 'danger', text: `Could not create the PDF: ${e.message}` });
    } finally {
      el.classList.remove('imm-exporting');
      setDl(false);
    }
  }

  const Info = ({ label, children, wide }) => (
    <div className={`imm-field ${wide ? 'wide' : ''}`}><span className="imm-label">{label}</span><span className="imm-value">{children || ' '}</span></div>
  );
  const birthInput = (field, placeholder) => editable
    ? <input className="imm-input" defaultValue={patient[field] ?? ''} placeholder={placeholder} onBlur={(e) => saveBirth(field, e.target.value.trim())} />
    : (patient[field] ?? '');

  return (
    <div className={`imm-card ${editable ? '' : 'readonly'}`} ref={cardRef}>
      <div className="imm-title">{card.title}</div>
      <div className="text-end mb-2 imm-noprint"><button type="button" className="btn btn-sm btn-light me-2" onClick={downloadPdf} disabled={dl}><i className="bi bi-download me-1" />{dl ? 'Preparing...' : 'Download PDF'}</button><button type="button" className="btn btn-sm btn-light" onClick={printCard}><i className="bi bi-printer me-1" />Print</button></div>
      <div className="imm-head">
        <Info label="NAME" wide>{fullName(patient)}</Info>
        <Info label="DATE OF BIRTH">{formatDate(patient.birth_date)}</Info>
        <Info label="SEX">{patient.gender}</Info>
        {isYoungKind(kind) && (
          <>
            <Info label="PARENT / GUARDIAN">{fullName(parent)}</Info>
            <Info label="PLACE OF BIRTH">{birthInput('place_of_birth', 'Place of birth')}</Info>
            <Info label="BIRTH HEIGHT (cm)">{birthInput('birth_height_cm', 'cm')}</Info>
            <Info label="BIRTH WEIGHT (kg)">{birthInput('birth_weight_kg', 'kg')}</Info>
          </>
        )}
        <Info label="ADDRESS" wide>{[patient.purok, patient.address].filter(Boolean).join(', ')}</Info>
        <Info label="HEALTH CENTER">Barangay Salvador Health Center</Info>
        <Info label="MEDICAL ID">{patient.medical_id}</Info>
      </div>

      {msg && <div className={`alert alert-${msg.type} py-2 my-2 imm-noprint`}>{msg.text}</div>}

      <table className="imm-table">
        <thead>
          <tr><th>BAKUNA</th><th className="c">DOSES</th><th>PETSA NG BAKUNA</th><th>REMARKS</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const remarks = recs[`${r.name}|0`]?.remarks ?? '';
            const showRemarks = editable || hasAnyDose(r.name);
            return (
              <tr key={r.name}>
                <td className="imm-vax">{r.name} {r.sub && <small>{r.sub}</small>}
                  {editable && r.custom && r.doses < 6 && <button type="button" className="imm-undo imm-noprint" onClick={() => setExtraDoses({ ...extraDoses, [r.name]: r.doses + 1 })}>+ dose</button>}</td>
                <td className="c imm-doses"><b>{r.dosesText ?? r.doses}</b><small>({r.hint})</small></td>
                <td>
                  <div className="imm-dates">
                    {Array.from({ length: r.doses }, (_, i) => i + 1).map((n) => {
                      const d = dose(r.name, n);
                      const done = Boolean(d?.confirmed_at);
                      return (
                        <div key={n} className={`imm-dose ${done ? 'done' : ''} ${d?.given_date && !done ? 'imm-sched' : ''}`}>
                          {editable ? (
                            <>
                              <input type="date" className={`imm-input ${d?.given_date ? '' : 'imm-empty'}`} min={d?.given_date && d.given_date < today ? undefined : today}
                                value={d?.given_date ?? ''} disabled={done} onChange={(e) => setDate(r.name, n, e.target.value)} title={`Dose ${n}`} />
                              {d?.given_date && !done && (
                                d.given_date <= today
                                  ? <button type="button" className="imm-btn imm-noprint" onClick={() => confirm(r.name, n)}>✓ Vaccinated</button>
                                  : <div className="imm-tag imm-noprint">Scheduled</div>
                              )}
                              {done && <div className="imm-tag ok imm-noprint">✓ Vaccinated <button type="button" className="imm-undo" onClick={() => undoConfirm(r.name, n)}>undo</button></div>}
                            </>
                          ) : d?.given_date ? (
                            <>
                              <div className={done ? 'imm-ok' : 'imm-soon'}>{formatDate(d.given_date)}</div>
                            </>
                          ) : <span className="imm-n">{n}</span>}
                        </div>
                      );
                    })}
                  </div>
                </td>
                <td>
                  {editable
                    ? <input className="imm-input" defaultValue={remarks} key={remarks} placeholder="Remarks" onBlur={(e) => saveRemarks(r.name, e.target.value)} />
                    : (showRemarks ? remarks : '')}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {editable && (
        <form className="d-flex gap-2 mt-3 imm-noprint" onSubmit={(e) => {
          e.preventDefault();
          const n = newName.trim();
          if (n && !rows.some((r) => r.name.toLowerCase() === n.toLowerCase())) {
            setExtras([...extras, n]);
            setExtraDoses({ ...extraDoses, [n]: newDoses });
          }
          setNewName(''); setNewDoses(1);
        }}>
          <input className="form-control form-control-sm" placeholder="Add vaccine (e.g. Rabies, Other)" value={newName} onChange={(e) => setNewName(e.target.value)} />
          <select className="form-select form-select-sm w-auto" value={newDoses} onChange={(e) => setNewDoses(Number(e.target.value))} title="Number of doses">
            {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} dose{n > 1 ? 's' : ''}</option>)}
          </select>
          <button className="btn btn-sm btn-light text-nowrap">+ Add vaccine</button>
        </form>
      )}
      <div className="imm-foot imm-noprint">
        {editable
          ? 'Set the scheduled date of each dose. The parent/child are reminded the day before and on the day. When the child is vaccinated, press \u201c✓ Vaccinated\u201d to confirm (this also sends the \u201cvaccine given\u201d notice). Clear a date to remove it.'
          : 'Scheduled dates and confirmed vaccinations are shown here. Only the health center can change them.'}
      </div>
    </div>
  );
}