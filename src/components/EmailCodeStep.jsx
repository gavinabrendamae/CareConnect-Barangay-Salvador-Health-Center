import { useEffect, useState } from 'react';

/** Asks for the 6-digit code that was emailed. onVerify(code) must throw an Error on failure. */
export default function EmailCodeStep({ email, onVerify, onResend, onBack, title = 'Verify your email', submitLabel = 'Verify & create account', backLabel = '← Change email', lead = null }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [wait, setWait] = useState(60);

  useEffect(() => {
    if (wait <= 0) return undefined;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  async function submit(e) {
    e.preventDefault();
    setError(''); setInfo('');
    if (!/^\d{6}$/.test(code)) return setError('Enter the 6-digit code.');
    setBusy(true);
    try { await onVerify(code); }
    catch (err) { setError(err.message); setBusy(false); }
  }

  async function resend() {
    setError(''); setInfo('');
    try { await onResend(); setInfo('A new code was sent.'); setWait(60); setCode(''); }
    catch (err) { setError(err.message); }
  }

  return (
    <form onSubmit={submit}>
      <h2 className="mb-2">{title}</h2>
      <p className="text-secondary">{lead ?? 'We sent a 6-digit code to'} <strong>{email}</strong>. It expires in 10 minutes.</p>
      {error && <div className="alert alert-danger">{error}</div>}
      {info && <div className="alert alert-success">{info}</div>}
      <input className="form-control form-control-lg text-center mb-3" style={{ letterSpacing: 10, fontWeight: 700 }}
        inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="------" autoFocus
        value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
      <button className="btn btn-primary-custom w-100 mb-3" disabled={busy}>{busy ? 'Verifying...' : submitLabel}</button>
      <div className="d-flex justify-content-between small">
        <button type="button" className="btn btn-link btn-sm p-0" onClick={onBack}>{backLabel}</button>
        <button type="button" className="btn btn-link btn-sm p-0" disabled={wait > 0} onClick={resend}>
          {wait > 0 ? `Resend code in ${wait}s` : 'Resend code'}
        </button>
      </div>
    </form>
  );
}