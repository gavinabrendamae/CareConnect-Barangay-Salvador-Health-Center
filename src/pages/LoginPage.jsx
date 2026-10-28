import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext.jsx';
import { roleHome } from '../lib/format.js';
import SiteNavbar from '../components/SiteNavbar.jsx';
import SiteFooter from '../components/SiteFooter.jsx';
import PasswordInput from '../components/PasswordInput.jsx';
import SliderCaptcha from '../components/SliderCaptcha.jsx';
import EmailCodeStep from '../components/EmailCodeStep.jsx';
import { manilaToday, sendLoginCode, verifyLoginCode } from '../lib/loginCode.js';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { session, profile, refreshProfile } = useAuth();
  const [captchaDone, setCaptchaDone] = useState(false);
  const [sendErr, setSendErr] = useState('');
  const sent = useRef(false);
  const resetCaptcha = () => setCaptchaDone(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [setupOpen, setSetupOpen] = useState(false);
  const notice = location.state?.notice;

  useEffect(() => {
    supabase.rpc('setup_available').then(({ data }) => setSetupOpen(Boolean(data)));
  }, []);

  // Signed in with the password but not confirmed by email today -> show the code step.
  const verifiedToday = profile?.email_verified_on === manilaToday();
  const waiting = profile && (profile.approval_status === 'pending' || profile.approval_status === 'declined');
  const blocked = profile && !waiting && (profile.is_active === false); // the dashboard shows its own "deactivated" page
  const needsCode = Boolean(session && profile && !blocked && !verifiedToday
    && profile.approval_status !== 'pending' && profile.approval_status !== 'declined');

  // After the password (and the daily email code, if due) comes the puzzle captcha, then the dashboard.
  const needsCaptcha = Boolean(session && profile && !blocked && verifiedToday && !captchaDone);

  useEffect(() => {
    if (session && profile && (blocked || (verifiedToday && captchaDone))) navigate(roleHome(profile.role), { replace: true });
  }, [session, profile, verifiedToday, blocked, captchaDone, navigate]);

  useEffect(() => {
    if (!needsCode || sent.current) return;
    sent.current = true;
    sendLoginCode().then(() => setSendErr('')).catch((e) => setSendErr(e.message));
  }, [needsCode]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);

    const { data, error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (authError) {
      setError(authError.message === 'Invalid login credentials' ? 'Incorrect email or password.' : authError.message);
      setBusy(false);
      return;
    }

    const { data: prof, error: profError } = await supabase
      .from('profiles').select('role, is_active, approval_status').eq('id', data.user.id).maybeSingle();
    if (profError || !prof) {
      await supabase.auth.signOut();
      setError('Your account has no profile yet. Please contact the health center.');
      setBusy(false);
      return;
    }
    if (prof.approval_status === 'pending' || prof.approval_status === 'declined') {
      await supabase.auth.signOut();
      setError(prof.approval_status === 'pending'
        ? 'Your account is under review by the admins. You will receive an email once it is verified.'
        : 'Your registration was declined by the admins. Please contact the health center.');
      setBusy(false);
      return;
    }
    // the effects above send the code (or open the dashboard if already confirmed today)
    setBusy(false);
  }

  async function cancelCode() {
    sent.current = false; setSendErr(''); resetCaptcha();
    await supabase.auth.signOut();
  }

  return (
    <>
      <SiteNavbar />
      {needsCaptcha && <SliderCaptcha onPass={() => setCaptchaDone(true)} onCancel={cancelCode} />}
      <div className="auth-wrap">
        <div className="auth-card row g-0">
          <div className="col-lg-5 auth-visual photo" />
          <div className="col-lg-7 auth-form">
            {needsCode ? (
              <>
                {sendErr && (
                  <div className="alert alert-danger">{sendErr}
                    <button type="button" className="btn btn-link btn-sm p-0 ms-2" onClick={() => { setSendErr(''); sendLoginCode().catch((e) => setSendErr(e.message)); }}>Try again</button>
                  </div>
                )}
                <EmailCodeStep email={session.user.email} title="Confirm your email"
                  lead="For your security, confirm your login once a day. We sent a 6-digit code to"
                  submitLabel="Confirm & continue" backLabel="← Use another account"
                  onVerify={async (code) => { await verifyLoginCode(code); await refreshProfile(); }}
                  onResend={sendLoginCode} onBack={cancelCode} />
              </>
            ) : (
            <>
            <h2 className="mb-4">Login</h2>
            {setupOpen && (
              <div className="alert alert-warning">
                <strong>First-time setup:</strong> no Super Admin exists yet.{' '}
                <Link to="/setup" className="link-primary-custom">Create the Super Admin (Midwife) account</Link>
              </div>
            )}
            {notice && <div className="alert alert-success">{notice}</div>}
            {error && (
              <div className={`alert ${error.startsWith('Your account is under review') ? 'alert-warning' : 'alert-danger'}`} role="alert">
                <i className={`bi ${error.startsWith('Your account is under review') ? 'bi-hourglass-split' : 'bi-exclamation-triangle-fill'} me-2`} />{error}
              </div>
            )}
            <form onSubmit={handleSubmit}>
              <div className="mb-3">
                <label className="form-label" htmlFor="loginEmail">Email:</label>
                <input type="email" className="form-control" id="loginEmail" placeholder="Enter your email"
                  value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
              </div>
              <div className="mb-4">
                <label className="form-label" htmlFor="loginPassword">Password:</label>
                <PasswordInput id="loginPassword" value={password} onChange={setPassword}
                  placeholder="Enter your password" autoComplete="current-password" />
              </div>
              <button type="submit" className="btn btn-primary-custom w-100 mb-3" disabled={busy}>
                {busy ? 'Signing in...' : 'Sign-in'}
              </button>
              <p className="text-center mb-2">Don't have an account? <Link to="/register" className="link-primary-custom">Sign-up</Link></p>
              <p className="text-center mb-0 small">Want to see the medicines we offer? <Link to="/stock" className="link-primary-custom">View medicines</Link></p>
            </form>
            </>
            )}
          </div>
        </div>
      </div>
      <SiteFooter />
    </>
  );
}