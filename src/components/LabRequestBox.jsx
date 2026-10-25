import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext.jsx';
import { LAB_TESTS } from '../lib/labTests.js';
import OtherClinicModal from './OtherClinicModal.jsx';

export default function LabRequestBox({ patient, queueItem, defaultNote = '', onRequested, embedded = false }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState([]);
  const [other, setOther] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [outside, setOutside] = useState(false);

  const toggle = (t) => setPicked(picked.includes(t) ? picked.filter((x) => x !== t) : [...picked, t]);

  const pickedTests = () => {
    const t = picked.filter((x) => x !== 'Others');
    if (picked.includes('Others') && other.trim()) t.push(other.trim());
    return t;
  };
  function openOutside() {
    setMsg(null);
    if (pickedTests().length === 0) return setMsg({ type: 'danger', text: 'Choose at least one laboratory test.' });
    setOutside(true);
  }

  async function send(outsideClinic) {
    setMsg(null);
    const tests = picked.filter((t) => t !== 'Others');
    if (picked.includes('Others') && other.trim()) tests.push(other.trim());
    if (tests.length === 0) return setMsg({ type: 'danger', text: 'Choose at least one laboratory test.' });
    setBusy(true);
    let queueId = queueItem?.id ?? null;
    if (!queueId) { 
      const { data, error } = await supabase.from('queue').insert({ patient_id: patient.id, queued_by: user.id, status: 'awaiting_lab', reason: 'Laboratory' }).select('id').single();
      if (error) { setBusy(false); setMsg({ type: 'danger', text: error.message }); return error.message; }
      queueId = data.id;
    } else {
      const { error } = await supabase.from('queue').update({ status: 'awaiting_lab' }).eq('id', queueId);
      if (error) { setBusy(false); setMsg({ type: 'danger', text: error.message }); return error.message; }
    }
    const { error } = await supabase.from('lab_requests').insert({
      patient_id: patient.id, queue_id: queueId, tests: tests.join(', '), notes: [outsideClinic && `Sent to other clinic: ${outsideClinic}.`, (note || defaultNote).trim()].filter(Boolean).join(' ') || null, requested_by: user.id, outside_clinic: outsideClinic || null,
    });
    setBusy(false);
    if (error) { setMsg({ type: 'danger', text: error.message }); return error.message; }
    setPicked([]); setOther(''); setNote(''); setOpen(false);
    onRequested?.(patient);
  }

  return (
    <div className={embedded ? 'lab-embedded border rounded p-3 mb-3' : 'panel-card mt-4'}>
      <div className="d-flex justify-content-between align-items-center">
        <h6 className="fw-bold mb-0"><i className="bi bi-eyedropper me-2 text-success" />Laboratory Request</h6>
        <button type="button" className="btn btn-sm btn-outline-primary-custom" disabled={!patient} onClick={() => setOpen(!open)}>
          {open ? 'Cancel' : 'Request laboratory'}
        </button>
      </div>
      {!open && <div className="small text-secondary mt-2">Send the patient for laboratory tests, mark them as "waiting for lab results", and proceed to the next patient in the queue.</div>}
      {open && (
        <div className="mt-3">
          {msg && <div className={`alert alert-${msg.type} py-2`}>{msg.text}</div>}
          <div className="d-flex flex-wrap gap-2 mb-2">
            {LAB_TESTS.map((t) => (
              <button type="button" key={t} className={`btn btn-sm ${picked.includes(t) ? 'btn-primary-custom' : 'btn-outline-secondary'}`} onClick={() => toggle(t)}>
                {picked.includes(t) && '✓ '}{t}
              </button>
            ))}
          </div>
          {picked.includes('Others') && <input className="form-control form-control-sm mb-2" placeholder="Specify the test" value={other} onChange={(e) => setOther(e.target.value)} />}
          <input className="form-control form-control-sm mb-3" placeholder="Reason / suspected (e.g. rule out dengue)" value={note || defaultNote} onChange={(e) => setNote(e.target.value)} />
          <button type="button" className="btn btn-primary-custom" disabled={busy} onClick={() => send()}>
            <i className="bi bi-hourglass-split me-1" />{busy ? 'Sending...' : 'Send for lab & wait for results'}
          </button>
          <button type="button" className="btn btn-outline-primary-custom ms-2" onClick={openOutside}>
            <i className="bi bi-building me-1" />Request to other clinic
          </button>
        </div>
      )}
      {outside && <OtherClinicModal patient={patient} tests={pickedTests()} symptoms={note || defaultNote} onClose={() => setOutside(false)} onProceed={(clinic) => send(clinic)} />}
    </div>
  );
}