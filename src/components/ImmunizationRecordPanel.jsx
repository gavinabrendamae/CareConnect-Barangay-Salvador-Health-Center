import { useEffect, useState } from 'react';
import PatientPicker from './PatientPicker.jsx';
import ImmunizationCard from './ImmunizationCard.jsx';
import FamilyPlanningCard from './FamilyPlanningCard.jsx';
import { calcAge } from '../lib/format.js';

// Staff / admin: pick a patient, then edit the DOH-style immunization card.
// Women aged 15–49 also get a Family Planning (Depo-Provera) card.
export default function ImmunizationRecordPanel() {
  const [patient, setPatient] = useState(null);
  const [which, setWhich] = useState('main');
  useEffect(() => setWhich('main'), [patient?.id]);
  const age = patient ? calcAge(patient.birth_date) : null;
  const female = patient?.gender === 'Female' && age >= 15 && age <= 49; // Family Planning applies to women 15–49 only
  return (
    <div className="panel-card">
      <h5 className="mb-3">Immunization Record Card</h5>
      <PatientPicker value={patient} onChange={setPatient} />
      {patient && female && (
        <div className="btn-group mb-3">
          <button type="button" className={`btn btn-sm ${which === 'main' ? 'btn-primary-custom' : 'btn-outline-secondary'}`} onClick={() => setWhich('main')}>Immunization card</button>
          <button type="button" className={`btn btn-sm ${which === 'fp' ? 'btn-primary-custom' : 'btn-outline-secondary'}`} onClick={() => setWhich('fp')}>Family planning card</button>
        </div>
      )}
      {patient
        ? (which === 'fp'
          ? <FamilyPlanningCard key={`${patient.id}-fp`} patientId={patient.id} editable />
          : <ImmunizationCard key={`${patient.id}-main`} patientId={patient.id} editable />)
        : <div className="text-secondary">Search a patient to open their immunization card (Infant, Child, Adult or Maternal). Women aged 15–49 also have a Family Planning card.</div>}
    </div>
  );
}