import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../context/AuthContext.jsx';
import { PH_PHONE, ROLE_LABEL } from '../lib/format.js';
import PasswordInput from './PasswordInput.jsx';

const PW_RULES = [
  { id: 'len', label: 'At least 8 characters', test: (v) => v.length >= 8 },
  { id: 'lower', label: 'At least one lowercase letter (a-z)', test: (v) => /[a-z]/.test(v) },
  { id: 'upper', label: 'At least one uppercase letter (A-Z)', test: (v) => /[A-Z]/.test(v) },
  { id: 'num', label: 'At least one number (0-9)', test: (v) => /[0-9]/.test(v) },
  { id: 'special', label: 'At least one special character (!@#$...)', test: (v) => /[!@#$%^&*(),.?":{}|<>]/.test(v) },
];

export default function ProfilePanel() {
  const { profile, refreshProfile } = useAuth();
  const [f, setF] = useState({ first_name: '', middle_name: '', last_name: '', suffix: '', contact_number: '', address: '' });
  const [pMsg, setPMsg] = useState(null);
  const [pBusy, setPBusy] = useState(false);

  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [wMsg, setWMsg] = useState(null);
  const [wBusy, setWBusy] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setF({
      first_name: profile.first_name ?? '', middle_name: profile.middle_name ?? '',
      last_name: profile.last_name ?? '', suffix: profile.suffix ?? '',
      contact_number: profile.contact_number ?? '', address: profile.address ?? '',
    });
  }, [profile]);

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function saveProfile(e) {
    e.preventDefault();
    setPMsg(null);
    if (f.contact_number && !PH_PHONE.test(f.contact_number.trim())) {
      return setPMsg({ type: 'danger', text: 'Contact number must look like 09XXXXXXXXX or +639XXXXXXXXX.' });
    }
    setPBusy(true);
    const { error } = await supabase.from('profiles').update({
      first_name: f.first_name.trim(),
      middle_name: f.middle_name.trim() || null,
      last_name: f.last_name.trim(),
      suffix: f.suffix || null,
      contact_number: f.contact_number.trim() || null,
      address: f.address.trim() || null,
    }).eq('id', profile.id);
    setPBusy(false);
    if (error) return setPMsg({ type: 'danger', text: error.message });
    await refreshProfile();
    setPMsg({ type: 'success', text: 'Profile updated.' });
  }

  async function changePassword(e) {
    e.preventDefault();
    setWMsg(null);
    if (!PW_RULES.every((r) => r.test(pw.next))) return setWMsg({ type: 'danger', text: 'New password does not meet all the requirements.' });
    if (pw.next !== pw.confirm) return setWMsg({ type: 'danger', text: 'New passwords do not match.' });
    if (pw.next === pw.current) return setWMsg({ type: 'danger', text: 'New password must be different from the current one.' });
    setWBusy(true);
    const { error: e1 } = await supabase.auth.signInWithPassword({ email: profile.email, password: pw.current });
    if (e1) {
      setWBusy(false);
      return setWMsg({ type: 'danger', text: 'Current password is incorrect.' });
    }
    const { error: e2 } = await supabase.auth.updateUser({ password: pw.next });
    setWBusy(false);
    if (e2) return setWMsg({ type: 'danger', text: e2.message });
    setPw({ current: '', next: '', confirm: '' });
    setWMsg({ type: 'success', text: 'Password changed.' });
  }

  if (!profile) return null;

  return (
    <div className="row g-4">
      <div className="col-lg-7">
        <form className="panel-card" onSubmit={saveProfile}>
          <h5 className="mb-3"><i className="bi bi-person-circle me-2" />My Profile</h5>
          <div className="row g-3">
            <div className="col-md-6">
              <label className="form-label">Email</label>
              <input className="form-control" value={profile.email ?? ''} disabled />
            </div>
            <div className="col-md-6">
              <label className="form-label">Role</label>
              <input className="form-control" value={ROLE_LABEL?.[profile.role] ?? profile.role} disabled />
            </div>
            <div className="col-md-5">
              <label className="form-label">First name</label>
              <input className="form-control" value={f.first_name} onChange={set('first_name')} required />
            </div>
            <div className="col-md-4">
              <label className="form-label">Middle name</label>
              <input className="form-control" value={f.middle_name} onChange={set('middle_name')} />
            </div>
            <div className="col-md-3">
              <label className="form-label">Suffix</label>
              <select className="form-select" value={f.suffix} onChange={set('suffix')}>
                <option value="">—</option><option>Jr.</option><option>Sr.</option><option>II</option><option>III</option>
              </select>
            </div>
            <div className="col-md-6">
              <label className="form-label">Last name</label>
              <input className="form-control" value={f.last_name} onChange={set('last_name')} required />
            </div>
            <div className="col-md-6">
              <label className="form-label">Contact number</label>
              <input className="form-control" placeholder="09XXXXXXXXX" value={f.contact_number} onChange={set('contact_number')} />
            </div>
            <div className="col-12">
              <label className="form-label">Address</label>
              <input className="form-control" value={f.address} onChange={set('address')} />
            </div>
          </div>
          {pMsg && <div className={`alert alert-${pMsg.type} mt-3 mb-0 py-2`}>{pMsg.text}</div>}
          <button className="btn btn-primary mt-3" disabled={pBusy}>{pBusy ? 'Saving…' : 'Save profile'}</button>
        </form>
      </div>

      <div className="col-lg-5">
        <form className="panel-card" onSubmit={changePassword}>
          <h5 className="mb-3"><i className="bi bi-key me-2" />Change Password</h5>
          <div className="mb-3">
            <label className="form-label">Current password</label>
            <PasswordInput value={pw.current} onChange={(v) => setPw({ ...pw, current: v })} autoComplete="current-password" />
          </div>
          <div className="mb-2">
            <label className="form-label">New password</label>
            <PasswordInput value={pw.next} onChange={(v) => setPw({ ...pw, next: v })} autoComplete="new-password" />
          </div>
          <ul className="list-unstyled small mb-3">
            {PW_RULES.map((r) => (
              <li key={r.id} className={r.test(pw.next) ? 'text-success' : 'text-muted'}>
                <i className={`bi ${r.test(pw.next) ? 'bi-check-circle-fill' : 'bi-circle'} me-1`} />{r.label}
              </li>
            ))}
          </ul>
          <div className="mb-3">
            <label className="form-label">Confirm new password</label>
            <PasswordInput value={pw.confirm} onChange={(v) => setPw({ ...pw, confirm: v })} autoComplete="new-password" />
          </div>
          {wMsg && <div className={`alert alert-${wMsg.type} mb-3 py-2`}>{wMsg.text}</div>}
          <button className="btn btn-primary" disabled={wBusy}>{wBusy ? 'Updating…' : 'Update password'}</button>
        </form>
      </div>
    </div>
  );
}