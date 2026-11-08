import { useState } from 'react';
import QueuePanel from './QueuePanel.jsx';
import ConsultationPanel from './ConsultationPanel.jsx';

export default function ConsultDesk() {
  const [active, setActive] = useState(null);   
  const [blank, setBlank] = useState(false);    
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