import { useState } from 'react';
import PatientPicker from './PatientPicker.jsx';
import ImmunizationCard from './ImmunizationCard.jsx';

export default function ImmunizationRecordPanel({ initialPatient = null, hint = '' }) {
  const [patient, setPatient] = useState(initialPatient);
  return (
    <div className="panel-card">
      <h5 className="mb-3">Immunization Record Card</h5>
      <PatientPicker value={patient} onChange={setPatient} />
      {hint && patient && patient.id === initialPatient?.id && (
        <div className="alert alert-warning py-2"><i className="bi bi-calendar-event me-2" />Reschedule: <strong>{hint}</strong> — change its date in the card below, then save.</div>
      )}
      {patient
        ? <ImmunizationCard key={`${patient.id}-main`} patientId={patient.id} editable reschedule={patient.id === initialPatient?.id ? hint : ''} />
        : <div className="text-secondary">Search a patient to open their immunization card (Infant, Child, Adult or Maternal).</div>}
    </div>
  );
}