import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext.jsx';
import { PH_PHONE, PATIENT_TYPES, patientTypeError, ageInMonths } from '../lib/format.js';
import DatePicker from './DatePicker.jsx';
import PatientPicker from './PatientPicker.jsx';
import PasswordInput from './PasswordInput.jsx';
import { PW_RULES } from '../lib/passwordRules.js';

const PUROKS = ['Purok 1', 'Purok 2', 'Purok 3', 'Purok 4', 'Purok 5'];

const blank = {
  first_name: '', middle_name: '', last_name: '', suffix: '', birth_date: '', gender: '',
  contact_number: '', email: '', purok: '', address: '', patient_type: '',
  household_head_id: null, addToQueue: true,
};

function fromPatient(p) {
  if (!p) return blank;
  return {
    ...blank,
    first_name: p.first_name ?? '', middle_name: p.middle_name ?? '', last_name: p.last_name ?? '', suffix: p.suffix ?? '',
    birth_date: p.birth_date ?? '', gender: p.gender ?? '', contact_number: p.contact_number ?? '', email: p.email ?? '',
    purok: p.purok ?? '', address: p.address ?? '', patient_type: p.patient_type ?? '',
    household_head_id: p.household_head_id ?? null, addToQueue: false,
  };
}

const needsAccount = (birth) => { const m = ageInMonths(birth); return m !== null && m >= 15 * 12; };
const isYoung = (birth) => { const m = ageInMonths(birth); return m !== null && m >= 0 && m < 11 * 12; };

async function createLogin(body) {
  const { data, error } = await supabase.functions.invoke('create-resident', { body });
  if (error) {
    let msg = error.message;
    try { const j = await error.context.json(); if (j?.error) msg = j.error; } catch { /* keep */ }
    return { error: msg };
  }
  return data?.error ? { error: data.error } : data;
}

export default function PatientForm({ patient, onSaved, onCancel }) {
  const { user } = useAuth();
  const editing = Boolean(patient);
  const [f, setF] = useState(() => fromPatient(patient));
  const [head, setHead] = useState(null);
  const [formKey, setFormKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');

  useEffect(() => {
    if (!patient?.household_head_id) return;
    supabase.from('patients').select('id, first_name, middle_name, last_name, suffix, purok')
      .eq('id', patient.household_head_id).maybeSingle().then(({ data }) => setHead(data));
  }, [patient]);

  const canHaveLogin = needsAccount(f.birth_date) && (!editing || !patient?.profile_id);
  const loginRequired = canHaveLogin && !editing;

  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  async function submit(e) {
    e.preventDefault();
    setMsg(null);
    if (!f.birth_date) return setMsg({ type: 'danger', text: 'Please select the birth date.' });
    const typeErr = patientTypeError(f.birth_date, f.patient_type);
    if (typeErr) return setMsg({ type: 'danger', text: typeErr });
    if (isYoung(f.birth_date) && !head) return setMsg({ type: 'danger', text: 'Please link this child to the mother. She must already have an account.' });
    if (!isYoung(f.birth_date) && f.contact_number && !PH_PHONE.test(f.contact_number.trim())) {
      return setMsg({ type: 'danger', text: 'Enter a valid mobile number (09XXXXXXXXX).' });
    }
    const wantsLogin = canHaveLogin && (loginRequired || pw);
    if (wantsLogin) {
      if (!f.email.trim()) return setMsg({ type: 'danger', text: 'Email is required for a login account.' });
      if (!PW_RULES.every((r) => r.test(pw))) return setMsg({ type: 'danger', text: 'The password does not meet all the requirements.' });
      if (pw !== pw2) return setMsg({ type: 'danger', text: 'The passwords do not match.' });
    }
    setBusy(true);
    const { addToQueue, ...rest } = f;
    const row = {
      ...rest,
      household_head_id: head?.id ?? null,
      middle_name: rest.middle_name || null,
      suffix: rest.suffix || null,
      email: isYoung(rest.birth_date) ? null : rest.email || null,
      contact_number: isYoung(rest.birth_date) ? null : rest.contact_number || null,
    };
    if (!editing) row.created_by = user.id;
    let data; let error;
    if (!editing && wantsLogin) {
      const res = await createLogin({
        email: f.email.trim(), password: pw, household_head_id: head?.id ?? null,
        meta: {
          first_name: f.first_name.trim(), middle_name: f.middle_name.trim(), last_name: f.last_name.trim(), suffix: f.suffix,
          birth_date: f.birth_date, gender: f.gender, contact_number: f.contact_number.trim(), purok: f.purok, address: f.address.trim(),
          patient_type: f.patient_type,
        },
      });
      if (res.error) { setBusy(false); return setMsg({ type: 'danger', text: res.error }); }
      ({ data, error } = await supabase.from('patients').select('*').eq('id', res.patient_id).single());
    } else {
      ({ data, error } = editing
        ? await supabase.from('patients').update(row).eq('id', patient.id).select().single()
        : await supabase.from('patients').insert(row).select().single());
    }
    if (error) { setBusy(false); return setMsg({ type: 'danger', text: error.message }); }

    if (editing) {
      let note = '';
      if (wantsLogin) {
        const res = await createLogin({ patient_id: patient.id, email: f.email.trim(), password: pw });
        if (res.error) { setBusy(false); return setMsg({ type: 'warning', text: `Profile updated, but the login was not created: ${res.error}` }); }
        note = ' A login account was created.';
        setPw(''); setPw2('');
      }
      setBusy(false);
      setMsg({ type: 'success', text: `Resident profile updated.${note}` });
      onSaved?.(data);
      return;
    }

    let queueError = null;
    if (addToQueue) {
      const { error: qErr } = await supabase.from('queue').insert({ patient_id: data.id, queued_by: user.id, reason: 'New patient', status: 'for_vitals' });
      queueError = qErr;
    }
    setBusy(false);
    setMsg(queueError
      ? { type: 'warning', text: `Patient saved, but could not be added to the queue: ${queueError.message}` }
      : { type: 'success', text: `${data.first_name} ${data.last_name} was registered${wantsLogin ? ' with a login account' : ''}${addToQueue ? ' and checked in for vitals' : ''}.` });
    setF(blank);
    setPw(''); setPw2('');
    setHead(null);
    setFormKey((k) => k + 1);
    onSaved?.(data);
  }

  return (
    <form onSubmit={submit} className="panel-card">
      <h5 className="mb-3">{editing ? 'Edit Resident Profile' : 'Register New Resident'}</h5>
      {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}
      <div className="row g-3">
        <div className="col-md-4"><label className="form-label required">First name</label>
          <input className="form-control" value={f.first_name} onChange={set('first_name')} required /></div>
        <div className="col-md-3"><label className="form-label">Middle name</label>
          <input className="form-control" value={f.middle_name} onChange={set('middle_name')} /></div>
        <div className="col-md-3"><label className="form-label required">Last name</label>
          <input className="form-control" value={f.last_name} onChange={set('last_name')} required /></div>
        <div className="col-md-2"><label className="form-label">Suffix</label>
          <select className="form-select" value={f.suffix} onChange={set('suffix')}>
            <option value="">—</option><option>Jr.</option><option>Sr.</option><option>II</option><option>III</option>
          </select></div>

        <div className="col-md-4"><label className="form-label required">Birth date</label>
          <DatePicker key={formKey} defaultValue={patient?.birth_date} onChange={(v) => setF((p) => ({ ...p, birth_date: v }))} /></div>
        <div className="col-md-4"><label className="form-label required">Gender</label>
          <select className="form-select" value={f.gender} onChange={set('gender')} required>
            <option value="" disabled>Select</option><option>Female</option><option>Male</option>
          </select></div>
        <div className="col-md-4"><label className="form-label required">Type of patient</label>
          <select className="form-select" value={f.patient_type} onChange={set('patient_type')} required>
            <option value="" disabled>Select</option>
            {f.patient_type === 'Infant / Child' && <option>Infant / Child</option>}
            {PATIENT_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
          {patientTypeError(f.birth_date, f.patient_type) && <div className="form-text text-danger">{patientTypeError(f.birth_date, f.patient_type)}</div>}</div>

        {!isYoung(f.birth_date) && (
          <>
            <div className="col-md-6"><label className="form-label">Contact number</label>
              <input className="form-control" placeholder="09XXXXXXXXX" value={f.contact_number} onChange={set('contact_number')} /></div>
            <div className="col-md-6"><label className={`form-label ${loginRequired ? 'required' : ''}`}>Email (for vaccine reminders{canHaveLogin ? ' and login' : ''})</label>
              <input type="email" className="form-control" value={f.email} onChange={set('email')} required={loginRequired} /></div>
          </>
        )}

        <div className="col-md-7"><label className="form-label required">Blk &amp; lot, Street</label>
          <input className="form-control" value={f.address} onChange={set('address')} required /></div>
        <div className="col-md-5"><label className="form-label required">Purok</label>
          <select className="form-select" value={f.purok} onChange={set('purok')} required>
            <option value="" disabled>Select</option>
            {PUROKS.map((p) => <option key={p}>{p}</option>)}
          </select></div>

        <div className="col-12">
          {isYoung(f.birth_date)
            ? <PatientPicker label="Mother (required — she must already have an account)" value={head} onChange={setHead} accountOnly />
            : <PatientPicker label="Parent / Guardian (optional) — links this person to their family" value={head} onChange={setHead} />}
        </div>

        {canHaveLogin && (
          <div className="col-12">
            <div className="border rounded p-3 bg-light">
              <div className="fw-semibold mb-1"><i className="bi bi-key me-1" />Login account{loginRequired ? '' : ' (optional — this resident has no login yet)'}</div>
              <div className="small text-secondary mb-2">Residents aged 15 and above log in with their email and this password. Tell the resident the password; they can change it later in My Profile. No approval is needed for accounts made here.</div>
              <div className="row g-3">
                <div className="col-md-6">
                  <label className={`form-label ${loginRequired ? 'required' : ''}`}>Password</label>
                  <PasswordInput value={pw} onChange={setPw} required={loginRequired} autoComplete="new-password" />
                </div>
                <div className="col-md-6">
                  <label className={`form-label ${loginRequired ? 'required' : ''}`}>Confirm password</label>
                  <PasswordInput value={pw2} onChange={setPw2} required={loginRequired} autoComplete="new-password" />
                </div>
              </div>
              {(pw || loginRequired) && (
                <ul className="list-unstyled small mb-0 mt-2">
                  {PW_RULES.map((r) => (
                    <li key={r.id} className={r.test(pw) ? 'text-success' : 'text-muted'}>
                      <i className={`bi ${r.test(pw) ? 'bi-check-circle-fill' : 'bi-circle'} me-1`} />{r.label}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {!editing && (
          <div className="col-12">
            <div className="form-check">
              <input className="form-check-input" type="checkbox" id="pfQueue" checked={f.addToQueue} onChange={set('addToQueue')} />
              <label className="form-check-label" htmlFor="pfQueue">Check in for vitals after saving</label>
            </div>
          </div>
        )}
      </div>
      <button className="btn btn-primary-custom mt-3" disabled={busy}>{busy ? 'Saving...' : editing ? 'Save changes' : 'Save resident'}</button>
      {onCancel && <button type="button" className="btn btn-outline-secondary mt-3 ms-2" onClick={onCancel}>Cancel</button>}
    </form>
  );
}