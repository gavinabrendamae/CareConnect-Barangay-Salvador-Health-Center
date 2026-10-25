import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { sendCode, registerWithCode } from '../lib/emailCode.js';
import EmailCodeStep from '../components/EmailCodeStep.jsx';
import { PH_PHONE, PATIENT_TYPES, patientTypeError } from '../lib/format.js';
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

const initial = {
  firstName: '', middleName: '', lastName: '', suffix: '', email: '', dob: '', gender: '',
  contact: '', password: '', password2: '', patientType: '', blkStreet: '', purok: '',
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
    const typeErr = patientTypeError(f.dob, f.patientType);
    if (typeErr) return setError(typeErr);
    if (!PH_PHONE.test(f.contact.trim())) return setError('Enter a valid mobile number (e.g. 09123456789 or +639123456789).');
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
        contact_number: f.contact.trim(),
        purok: f.purok,
        address: f.blkStreet.trim(),
        patient_type: f.patientType,
      },
    });
    navigate('/login', {
      state: { notice: 'Email verified! Your registration was sent to the Super Admin for approval. You can log in once it is approved.' },
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
                <input type="email" className="form-control" id="regEmail" placeholder="Enter your email (used for login and vaccine alerts)" value={f.email} onChange={set('email')} required autoComplete="email" />
              </div>

              <div className="mb-3">
                <label className="form-label required" htmlFor="contactNumber">Contact Number</label>
                <input type="tel" className="form-control" id="contactNumber" placeholder="09XXXXXXXXX" value={f.contact} onChange={set('contact')} required />
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

              <div className="mb-3">
                <label className="form-label required" htmlFor="patientType">Type of Patient</label>
                <select className="form-select" id="patientType" value={f.patientType} onChange={set('patientType')} required>
                  <option value="" disabled>Select the type of patient</option>
                  {PATIENT_TYPES.map((t) => <option key={t}>{t}</option>)}
                </select>
                {patientTypeError(f.dob, f.patientType) && <div className="form-text text-danger">{patientTypeError(f.dob, f.patientType)}</div>}
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
                </label>
              </div>

              <button type="submit" className="btn btn-primary-custom w-100 mb-3" disabled={busy}>
                {busy ? 'Sending code...' : 'Register'}
              </button>
              <p className="text-center mb-0">Already have an account? <Link to="/login" className="link-primary-custom">Sign-in</Link></p>
              <p className="text-center mt-2 mb-0 small text-secondary">
                BHW, Midwife, and Admin accounts are assigned by the health center administrator after you register as a resident.
              </p>
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