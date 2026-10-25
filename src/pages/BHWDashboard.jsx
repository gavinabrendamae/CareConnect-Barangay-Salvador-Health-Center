import { useState } from 'react';
import EventReminder from '../components/EventReminder.jsx';
import DashboardShell from '../components/DashboardShell.jsx';
import QueueStatus from '../components/QueueStatus.jsx';
import PatientForm from '../components/PatientForm.jsx';
import PatientList from '../components/PatientList.jsx';
import IntakePanel from '../components/IntakePanel.jsx';
import DueVaccinations from '../components/DueVaccinations.jsx';
import DispenseLogPanel from '../components/DispenseLogPanel.jsx';
import MedicineRequestsPanel from '../components/MedicineRequestsPanel.jsx';
import ImmunizationRecordPanel from '../components/ImmunizationRecordPanel.jsx';
import ProfilePanel from '../components/ProfilePanel.jsx';
import { useMedicineRequestCount } from '../lib/useMedicineRequestCount.js';

const TABS = [
  { key: 'dashboard', label: 'Dashboard', icon: 'bi-speedometer2' },
  { key: 'triage', label: 'Vitals & Triage', icon: 'bi-heart-pulse' },
  { key: 'register', label: 'Add Resident', icon: 'bi-person-plus' },
  { key: 'masterlist', label: 'Master Patient List', icon: 'bi-journal-medical' },
  { key: 'immrecord', label: 'Immunization Record', icon: 'bi-card-checklist' },
  { key: 'medreq', label: 'Medicine Requests', icon: 'bi-bag-plus' },
  { key: 'dispense', label: 'Dispense Logs & Audit', icon: 'bi-journal-text' },
  { key: 'profile', label: 'My Profile', icon: 'bi-person-circle' },
];

export default function BHWDashboard() {
  const [tab, setTab] = useState('dashboard');
  const medReq = useMedicineRequestCount();
  const tabs = TABS.map((t) => (t.key === 'medreq' ? { ...t, badge: medReq } : t));
  return (
    <DashboardShell title="BHW Panel" tabs={tabs} active={tab} onTab={setTab}>
      <EventReminder />
      {tab === 'dashboard' && (
        <div className="row g-4">
          <div className="col-12"><DueVaccinations /></div>
          <div className="col-12"><QueueStatus /></div>
        </div>
      )}
      {tab === 'register' && (
        <div className="row"><div className="col-xl-10"><PatientForm /></div></div>
      )}
      {tab === 'immrecord' && <ImmunizationRecordPanel />}
      {tab === 'medreq' && <MedicineRequestsPanel />}
      {tab === 'dispense' && <DispenseLogPanel />}
      {tab === 'profile' && <ProfilePanel />}
      {tab === 'masterlist' && <PatientList />}
      {tab === 'triage' && <IntakePanel />}
    </DashboardShell>
  );
}