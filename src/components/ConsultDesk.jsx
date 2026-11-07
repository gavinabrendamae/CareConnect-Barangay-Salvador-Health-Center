import { useState } from 'react';
import QueuePanel from './QueuePanel.jsx';
import ConsultationPanel from './ConsultationPanel.jsx';

// Unified clinical desk: queue -> clinical note (vitals, lab request/results, prescription) in one tab.
// No jumping between Patient Queue / Clinical Note / Laboratory any more.
export default function ConsultDesk() {
  const [active, setActive] = useState(null);   // queue item being attended to
  const [blank, setBlank] = useState(false);    // clinical note for a patient picked by name (no queue entry)
  const open = Boolean(active) || blank;
  const back = () => { setActive(null); setBlank(false); };

  if (!open) {
    return (
      <>
        <div className="d-flex justify-content-end mb-3">
          <button className="btn btn-outline-primary-custom" onClick={() => setBlank(true)}>
            <i className="bi bi-clipboard2-plus me-2" />New clinical note (search a patient)
          </button>
        </div>
        <QueuePanel onStartConsult={setActive} onOpenLab={setActive} />
      </>
    );
  }
  return (
    <>
      <ConsultationPanel key={active?.id ?? 'walk-in'} queueItem={active} onBack={back} onFinished={back} onLabRequested={back} />
    </>
  );
}