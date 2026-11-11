import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { sendCode, registerWithCode } from '../lib/emailCode.js';
import EmailCodeStep from '../components/EmailCodeStep.jsx';
import SiteNavbar from '../components/SiteNavbar.jsx';
import SiteFooter from '../components/SiteFooter.jsx';
import PasswordInput from '../components/PasswordInput.jsx';
import DatePicker from '../components/DatePicker.jsx';
import Modal from '../components/Modal.jsx';

const PUROKS = ['Purok 1', 'Purok 2', 'Purok 3', 'Purok 4', 'Purok 5', 'Purok 6', 'Purok 7'];

const PW_RULES = [
  { id: 'len', label: 'At least 8 characters', test: (v) => v.length >= 8 },
  { id: 'lower', label: 'At least one lowercase letter (a-z)', test: (v) => /[a-z]/.test(v) },
  { id: 'upper', label: 'At least one uppercase letter (A-Z)', test: (v) => /[A-Z]/.test(v) },
  { id: 'num', label: 'At least one number (0-9)', test: (v) => /[0-9]/.test(v) },
  { id: 'special', label: 'At least one special character (!@#$...)', test: (v) => /[!@#$%^&*(),.?":{}|<>]/.test(v) },
];

const PH_LOCAL = /^9\d{9}$/;

function PhFlag() {
  return (
    <svg width="24" height="16" viewBox="0 0 24 16" aria-hidden="true" style={{ borderRadius: 2, boxShadow: '0 0 0 1px rgba(0,0,0,.15)' }}>
      <rect width="24" height="8" fill="#0038a8" />
      <rect y="8" width="24" height="8" fill="#ce1126" />
      <path d="M0 0 L13 8 L0 16 Z" fill="#fff" />
      <circle cx="4" cy="8" r="1.6" fill="#fcd116" />
    </svg>
  );
}

function PhoneInput({ id, value, onChange }) {
  function handle(e) {
    let v = e.target.value.replace(/\D/g, '');
    if (v.startsWith('63')) v = v.slice(2);  
    if (v.startsWith('0')) v = v.slice(1);   
    onChange(v.slice(0, 10));
  }
  return (
    <div className="input-group">
      <span className="input-group-text gap-2 bg-light fw-semibold"><PhFlag />+63</span>
      <input id={id} type="tel" inputMode="numeric" className="form-control" placeholder="9XXXXXXXXX (optional)"
        value={value} onChange={handle} maxLength={10} autoComplete="tel-national" />
    </div>
  );
}

const initial = {
  firstName: '', middleName: '', lastName: '', suffix: '', email: '', dob: '', gender: '',
  contact: '', password: '', password2: '', blkStreet: '', purok: '',
  terms: false,
};

export default function RegisterPage() {
  const navigate = useNavigate();
  const [f, setF] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showTerms, setShowTerms] = useState(false);
  const [step, setStep] = useState('form'); 

  const set = (key) => (e) => setF({ ...f, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const setVal = (key) => (val) => setF((prev) => ({ ...prev, [key]: val }));

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!f.dob) return setError('Please select your date of birth.');
    if (f.contact && !PH_LOCAL.test(f.contact)) return setError('Enter the 10-digit mobile number after +63 (example: 9123456789).');
    if (!PW_RULES.every((r) => r.test(f.password))) return setError('Password does not meet all the requirements.');
    if (f.password !== f.password2) return setError('Passwords do not match.');

    setBusy(true);
    try {
      await sendCode(f.email.trim());
      setStep('code');
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  }

  async function verifyAndRegister(code) {
    await registerWithCode({
      email: f.email.trim(),
      code,
      password: f.password,
      meta: {
        first_name: f.firstName.trim(),
        middle_name: f.middleName.trim(),
        last_name: f.lastName.trim(),
        suffix: f.suffix,
        birth_date: f.dob,
        gender: f.gender,
        contact_number: f.contact ? `+63${f.contact}` : '',
        purok: f.purok,
        address: f.blkStreet.trim(),
      },
    });
    navigate('/login', {
      state: { notice: 'Email verified! Your registration was sent to the admins for approval. You can log in once it is approved.' },
    });
  }

  if (step === 'code') {
    return (
      <>
        <SiteNavbar />
        <div className="auth-wrap auth-wrap-photo">
          <div className="auth-card register-card row g-0">
            <div className="col-12 auth-form">
              <EmailCodeStep email={f.email.trim()} onVerify={verifyAndRegister}
                onResend={() => sendCode(f.email.trim())} onBack={() => setStep('form')} />
            </div>
          </div>
        </div>
        <SiteFooter />
      </>
    );
  }

  return (
    <>
      <SiteNavbar />
      <div className="auth-wrap auth-wrap-photo">
        <div className="auth-card register-card row g-0">
          <div className="col-12 auth-form">
            <h2 className="mb-3">Register</h2>
            <p className="note-box mb-4"><strong>Note:</strong> * indicates a required field.</p>
            {error && <div className="alert alert-danger">{error}</div>}

            <form onSubmit={handleSubmit}>
              <div className="row g-3 mb-3">
                <div className="col-md-6">
                  <label className="form-label required" htmlFor="firstName">First Name</label>
                  <input type="text" className="form-control" id="firstName" placeholder="Enter First Name" value={f.firstName} onChange={set('firstName')} required />
                </div>
                <div className="col-md-6">
                  <label className="form-label" htmlFor="middleName">Middle Name</label>
                  <input type="text" className="form-control" id="middleName" placeholder="Enter Middle Name" value={f.middleName} onChange={set('middleName')} />
                </div>
              </div>

              <div className="row g-3 mb-3">
                <div className="col-md-6">
                  <label className="form-label required" htmlFor="lastName">Last Name</label>
                  <input type="text" className="form-control" id="lastName" placeholder="Enter Last Name" value={f.lastName} onChange={set('lastName')} required />
                </div>
                <div className="col-md-6">
                  <label className="form-label" htmlFor="suffix">Suffix</label>
                  <select className="form-select" id="suffix" value={f.suffix} onChange={set('suffix')}>
                    <option value="">Select Suffix</option>
                    <option>Jr.</option><option>Sr.</option><option>II</option><option>III</option>
                  </select>
                </div>
              </div>

              <div className="row g-3 mb-3">
                <div className="col-md-6">
                  <label className="form-label required" htmlFor="dob">Date of Birth</label>
                  <DatePicker id="dob" onChange={setVal('dob')} />
                </div>
                <div className="col-md-6">
                  <label className="form-label required" htmlFor="gender">Gender</label>
                  <select className="form-select" id="gender" value={f.gender} onChange={set('gender')} required>
                    <option value="" disabled>Select gender</option>
                    <option>Female</option><option>Male</option>
                  </select>
                </div>
              </div>
 
              <div className="mb-3">
                <label className="form-label required" htmlFor="regEmail">Email</label>
                <input type="email" className="form-control" id="regEmail" placeholder="Enter your email" value={f.email} onChange={set('email')} required autoComplete="email" />
              </div>

              <div className="mb-3">
                <label className="form-label" htmlFor="contactNumber">Contact Number</label>
                <PhoneInput id="contactNumber" value={f.contact} onChange={setVal('contact')} />
              </div>

              <div className="mb-2">
                <label className="form-label required" htmlFor="regPassword">Password</label>
                <PasswordInput id="regPassword" value={f.password} onChange={setVal('password')} placeholder="Enter your password" autoComplete="new-password" />
                <ul className="list-unstyled pw-checklist">
                  {PW_RULES.map((r) => {
                    const ok = r.test(f.password);
                    return (
                      <li key={r.id} className={ok ? 'valid' : ''}>
                        <i className={`bi ${ok ? 'bi-check-circle-fill' : 'bi-x-circle'}`} />{r.label}
                      </li>
                    );
                  })}
                </ul>
              </div>

              <div className="mb-3">
                <label className="form-label required" htmlFor="regPassword2">Retype password</label>
                <PasswordInput id="regPassword2" value={f.password2} onChange={setVal('password2')} placeholder="Confirm Password" autoComplete="new-password" />
              </div>

              <label className="form-label mb-2">Patient Address</label>
              <div className="row g-3 mb-3">
                <div className="col-md-7">
                  <label className="form-label required small" htmlFor="blkStreet">Blk &amp; lot, Street</label>
                  <input type="text" className="form-control" id="blkStreet" placeholder="Enter the blk & lot" value={f.blkStreet} onChange={set('blkStreet')} required />
                </div>
                <div className="col-md-5">
                  <label className="form-label required small" htmlFor="purok">Purok</label>
                  <select className="form-select" id="purok" value={f.purok} onChange={set('purok')} required>
                    <option value="" disabled>Select a purok</option>
                    {PUROKS.map((p) => <option key={p}>{p}</option>)}
                  </select>
                </div>
              </div>

              <div className="form-check mb-4">
                <input className="form-check-input" type="checkbox" id="terms" checked={f.terms} onChange={set('terms')} required />
                <label className="form-check-label" htmlFor="terms">
                  I agree to the{' '}
                  <a href="#terms" className="link-primary-custom" onClick={(e) => { e.preventDefault(); setShowTerms(true); }}>Terms and Conditions</a>
                  {' '}of the Health Center IMS Patient Portal
                </label>
              </div>

              <button type="submit" className="btn btn-primary-custom w-100 mb-3" disabled={busy}>
                {busy ? 'Sending code...' : 'Register'}
              </button>
              <div className="alert alert-info small py-2 mb-3" role="note">
                <i className="bi bi-info-circle me-2" />
                Your account will stay <strong>pending</strong> for a while until the health center approves it. You can also visit the
                Barangay Salvador Health Center and the staff can create your account for you.
              </div>
              <p className="text-center mb-0">Already have an account? <Link to="/login" className="link-primary-custom">Sign-in</Link></p>
            </form>
          </div>
        </div>
      </div>
      <SiteFooter />

      <Modal
        show={showTerms}
        large
        title="Terms and Conditions"
        onClose={() => setShowTerms(false)}
        footer={
          <>
            <button type="button" className="btn btn-outline-secondary" onClick={() => setShowTerms(false)}>Close</button>
            <button type="button" className="btn btn-primary-custom" onClick={() => { setF((p) => ({ ...p, terms: true })); setShowTerms(false); }}>I Agree</button>
          </>
        }
      >
        <div style={{ fontSize: '.92rem' }}>
          <p className="text-secondary">By creating an account and using the Health Center IMS Patient Portal, you agree to the following terms:</p>
          <h6 className="fw-bold mt-3">1. Accuracy of Information</h6>
          <p className="text-secondary">You agree to provide true, complete, and up-to-date personal and health information during registration and while using the system. Providing false information may result in the suspension or removal of your account.</p>
          <h6 className="fw-bold mt-3">2. Data Privacy</h6>
          <p className="text-secondary">Your personal and health records are collected and processed in accordance with the Data Privacy Act of 2012 (RA 10173). Information you provide will be used solely for barangay health service delivery, record-keeping, and health program monitoring, and will not be shared with third parties without your consent, except when required by law.</p>
          <h6 className="fw-bold mt-3">3. Account Responsibility</h6>
          <p className="text-secondary">You are responsible for keeping your password confidential and for all activity that occurs under your account. Notify the Health Center staff immediately if you suspect unauthorized access to your account.</p>
          <h6 className="fw-bold mt-3">4. Account Approval</h6>
          <p className="text-secondary">New accounts are subject to review and approval by Barangay Health Center staff before becoming active, in order to verify residency and prevent fraudulent registrations.</p>
          <h6 className="fw-bold mt-3">5. Proper Use of the System</h6>
          <p className="text-secondary">The portal is intended for legitimate healthcare purposes only, such as viewing your own records, booking appointments, and receiving health reminders. Any attempt to access another patient's records or misuse the system is strictly prohibited.</p>
          <h6 className="fw-bold mt-3">6. Changes to These Terms</h6>
          <p className="text-secondary">The Health Center may update these Terms and Conditions from time to time. Continued use of the portal after changes are posted constitutes acceptance of the updated terms.</p>
        </div>
      </Modal>
    </>
  );
}