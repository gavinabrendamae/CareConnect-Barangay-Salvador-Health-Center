import { useState } from 'react';
import { createIsolatedClient, supabase } from '../lib/supabase';
import { PH_PHONE, ROLE_LABEL } from '../lib/format.js';
import PasswordInput from './PasswordInput.jsx';
import RolesPanel from './RolesPanel.jsx';

const STAFF_CHOICES = ['bhw', 'midwife', 'doctor'];
const blank = { first_name: '', last_name: '', email: '', contact_number: '', role: 'bhw', password: '' };

export default function StaffPanel() {
  const [f, setF] = useState(blank);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [refresh, setRefresh] = useState(0);

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function create(e) {
    e.preventDefault();
    setMsg(null);
    if (f.password.length < 8) return setMsg({ type: 'danger', text: 'Temporary password must be at least 8 characters.' });
    if (f.contact_number && !PH_PHONE.test(f.contact_number.trim())) return setMsg({ type: 'danger', text: 'Enter a valid mobile number (09XXXXXXXXX).' });
    setBusy(true);

    const { data, error } = await createIsolatedClient().auth.signUp({
      email: f.email.trim(), password: f.password,
      options: { data: { first_name: f.first_name.trim(), last_name: f.last_name.trim(), contact_number: f.contact_number.trim() } },
    });
    if (error) { setBusy(false); return setMsg({ type: 'danger', text: error.message }); }
    if (!data.user || data.user.identities?.length === 0) {
      setBusy(false);
      return setMsg({ type: 'danger', text: 'That email address is already registered. Use "Promote to staff" in the table below instead.' });
    }

    const { error: roleErr } = await supabase.from('profiles').update({ role: f.role }).eq('id', data.user.id);
    setBusy(false);
    if (roleErr) return setMsg({ type: 'warning', text: `Account created, but the role could not be set: ${roleErr.message}. Set it in the table below.` });

    setMsg({ type: 'success', text: `${ROLE_LABEL[f.role]} account created for ${f.email.trim()}. Give them the temporary password; if email confirmation is enabled in Supabase they must confirm their email first.` });
    setF(blank);
    setRefresh((n) => n + 1);
  }

  return (
    <div className="row g-4">
      <div className="col-12">
        <form className="panel-card" onSubmit={create}>
          <h5 className="mb-3">Create Staff Account</h5>
          {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}
          <div className="row g-3">
            <div className="col-md-3"><label className="form-label required">First name</label><input className="form-control" value={f.first_name} onChange={set('first_name')} required /></div>
            <div className="col-md-3"><label className="form-label required">Last name</label><input className="form-control" value={f.last_name} onChange={set('last_name')} required /></div>
            <div className="col-md-3"><label className="form-label required">Email</label><input type="email" className="form-control" value={f.email} onChange={set('email')} required /></div>
            <div className="col-md-3"><label className="form-label">Mobile</label><input className="form-control" placeholder="09XXXXXXXXX" value={f.contact_number} onChange={set('contact_number')} /></div>
            <div className="col-md-4"><label className="form-label required">Role</label>
              <select className="form-select" value={f.role} onChange={set('role')}>
                {STAFF_CHOICES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
              </select></div>
            <div className="col-md-5"><label className="form-label required">Temporary password</label>
              <PasswordInput id="staffPw" value={f.password} onChange={(v) => setF({ ...f, password: v })} placeholder="At least 8 characters" autoComplete="new-password" /></div>
            <div className="col-md-3 d-flex align-items-end"><button className="btn btn-primary-custom w-100" disabled={busy}>{busy ? 'Creating...' : 'Create account'}</button></div>
          </div>
        </form>
      </div>
      <div className="col-12"><RolesPanel key={refresh} /></div>
    </div>
  );
} 