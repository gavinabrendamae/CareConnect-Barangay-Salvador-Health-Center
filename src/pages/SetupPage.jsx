import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { sendCode, registerWithCode } from '../lib/emailCode.js';
import SiteNavbar from '../components/SiteNavbar.jsx';
import SiteFooter from '../components/SiteFooter.jsx';
import PasswordInput from '../components/PasswordInput.jsx';
import EmailCodeStep from '../components/EmailCodeStep.jsx';

export default function SetupPage() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(null); 
  const [step, setStep] = useState('form'); 
  const [f, setF] = useState({ first_name: '', last_name: '', email: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    supabase.rpc('setup_available').then(({ data, error }) => {
      if (error) { setMsg({ type: 'danger', text: `${error.message}. Did you run migration_setup.sql?` }); setOpen(false); }
      else setOpen(Boolean(data));
    });
  }, []);

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setMsg(null);
    if (f.password.length < 8) return setMsg({ type: 'danger', text: 'Password must be at least 8 characters.' });
    setBusy(true);
    try { await sendCode(f.email.trim()); setStep('code'); }
    catch (err) { setMsg({ type: 'danger', text: err.message }); }
    setBusy(false);
  }

  async function verify(code) {
    await registerWithCode({
      email: f.email.trim(), code, password: f.password, setup: true,
      meta: { first_name: f.first_name.trim(), last_name: f.last_name.trim() },
    });
    navigate('/login', { replace: true, state: { notice: 'Super Admin account created. You can now log in.' } });
  }

  return (
    <>
      <SiteNavbar />
      <div className="auth-wrap">
        <div className="auth-card register-card">
          <div className="auth-form">
            {open === null && <div className="text-secondary">Checking...</div>}

            {open === false && (
              <>
                <h2 className="mb-1">First-time Setup</h2>
                {msg ? <div className={`alert alert-${msg.type}`}>{msg.text}</div>
                  : <div className="alert alert-info"><i className="bi bi-lock-fill me-2" />Setup is already completed. This page is now disabled.</div>}
                <Link to="/login" className="btn btn-primary-custom">Go to login</Link>
              </>
            )}

            {open && step === 'code' && (
              <EmailCodeStep email={f.email.trim()} onVerify={verify}
                onResend={() => sendCode(f.email.trim())} onBack={() => setStep('form')} />
            )}

            {open && step === 'form' && (
              <form onSubmit={submit}>
                <h2 className="mb-1">First-time Setup</h2>
                <p className="text-secondary">Create the Super Admin (Midwife) account for CareConnect. We will email you a 6-digit code to verify your email.</p>
                {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}
                <div className="row g-3 mb-3">
                  <div className="col-6"><label className="form-label required">First name</label><input className="form-control" value={f.first_name} onChange={set('first_name')} required /></div>
                  <div className="col-6"><label className="form-label required">Last name</label><input className="form-control" value={f.last_name} onChange={set('last_name')} required /></div>
                </div>
                <div className="mb-3"><label className="form-label required">Email</label>
                  <input type="email" className="form-control" value={f.email} onChange={set('email')} required autoComplete="email" /></div>
                <div className="mb-4"><label className="form-label required">Password</label>
                  <PasswordInput id="setupPw" value={f.password} onChange={(v) => setF({ ...f, password: v })}
                    placeholder="At least 8 characters" autoComplete="new-password" /></div>
                <button className="btn btn-primary-custom w-100" disabled={busy}>{busy ? 'Sending code...' : 'Send verification code'}</button>
              </form>
            )}
          </div>
        </div>
      </div>
      <SiteFooter />
    </>
  );
}