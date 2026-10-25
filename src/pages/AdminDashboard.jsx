import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQueueCounts } from '../lib/useQueueCounts.js';
import { useAuth } from '../context/AuthContext.jsx';
import DashboardShell from '../components/DashboardShell.jsx';
import AdminOverview from '../components/AdminOverview.jsx';
import QueuePanel from '../components/QueuePanel.jsx';
import ConsultationPanel from '../components/ConsultationPanel.jsx';
import InventoryPanel from '../components/InventoryPanel.jsx';
import StockAlerts from '../components/StockAlerts.jsx';
import DispenseLogPanel from '../components/DispenseLogPanel.jsx';
import PatientList from '../components/PatientList.jsx';
import PatientForm from '../components/PatientForm.jsx';
import AnnouncementsPanel from '../components/AnnouncementsPanel.jsx';
import StaffPanel from '../components/StaffPanel.jsx';
import ActivityLogPanel from '../components/ActivityLogPanel.jsx';
import LabPanel from '../components/LabPanel.jsx';
import EventsPanel from '../components/EventsPanel.jsx';
import EventReminder from '../components/EventReminder.jsx';
import ReportsPanel from '../components/ReportsPanel.jsx';
import MedicineRequestsPanel from '../components/MedicineRequestsPanel.jsx';
import IntakePanel from '../components/IntakePanel.jsx';
import ImmunizationRecordPanel from '../components/ImmunizationRecordPanel.jsx';
import FamilyPlanningPanel from '../components/FamilyPlanningPanel.jsx';
import ProfilePanel from '../components/ProfilePanel.jsx';
import { useMedicineRequestCount } from '../lib/useMedicineRequestCount.js';

export default function AdminDashboard() {
  const { role } = useAuth();
  const [tab, setTab] = useState('overview');
  const [active, setActive] = useState(null);
  const [toast, setToast] = useState(null);

  const onNew = useCallback((n) => {
    setToast(`${n} new patient${n > 1 ? 's' : ''} ready for consultation`);
    try { // short beep
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const o = ctx.createOscillator(); o.frequency.value = 880; o.connect(ctx.destination);
      o.start(); setTimeout(() => { o.stop(); ctx.close(); }, 180);
    } catch { /* sound is optional */ }
  }, []);
  const q = useQueueCounts(onNew);
  const medReq = useMedicineRequestCount();
  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 7000);
    return () => clearTimeout(t);
  }, [toast]);

  const tabs = useMemo(() => {
    const t = [
      { key: 'overview', label: 'Dashboard', icon: 'bi-speedometer2' },
      { key: 'triage', label: 'Vitals and Triage', icon: 'bi-heart-pulse' },
      { key: 'queue', label: 'Patient Queue', icon: 'bi-list-ol', badge: q.waiting + q.inConsult + q.awaitingLab },
      { key: 'consult', label: 'Clinical Note', icon: 'bi-clipboard2-pulse' },
      { key: 'lab', label: 'Laboratory', icon: 'bi-eyedropper', badge: q.awaitingLab },
      { key: 'inventory', label: 'Inventory', icon: 'bi-capsule' },
      { key: 'medreq', label: 'Medicine Requests', icon: 'bi-bag-plus', badge: medReq },
      { key: 'dispense', label: 'Dispense Logs and Audit', icon: 'bi-receipt' },
      { key: 'immrecord', label: 'Immunization Records', icon: 'bi-card-checklist' },
      { key: 'fp', label: 'Family Planning', icon: 'bi-gender-female' },
      { key: 'announcements', label: 'Announcements', icon: 'bi-megaphone' },
      { key: 'events', label: 'Events Calendar', icon: 'bi-calendar-event' },
    ];
    if (role === 'admin') t.push({ key: 'logs', label: 'Activity Logs', icon: 'bi-shield-check' });
    t.push({ key: 'residents', label: 'Residents', icon: 'bi-people' });
    if (role === 'admin') t.push({ key: 'staff', label: 'Staff', icon: 'bi-person-badge' });
    t.push({ key: 'reports', label: 'Reports', icon: 'bi-file-earmark-bar-graph' });
    t.push({ key: 'profile', label: 'My Profile', icon: 'bi-person-circle' });
    return t;
  }, [role, q.waiting, q.inConsult, q.awaitingLab, medReq]);

  return (
    <DashboardShell title="Admin Panel" tabs={tabs} active={tab} onTab={setTab}>
      <EventReminder onOpenCalendar={() => setTab('events')} />
      {toast && (
        <div className="position-fixed bottom-0 end-0 p-3" style={{ zIndex: 2000 }}>
          <div className="toast show align-items-center text-bg-success border-0" role="alert" style={{ cursor: 'pointer' }}
            onClick={() => { setTab('queue'); setToast(null); }}>
            <div className="d-flex">
              <div className="toast-body"><i className="bi bi-bell-fill me-2" /><strong>{toast}</strong>
                <div className="small">{q.waiting + q.inConsult + q.awaitingLab} unfinished in queue · click to view</div></div>
              <button type="button" className="btn-close btn-close-white me-2 m-auto" onClick={(e) => { e.stopPropagation(); setToast(null); }} />
            </div>
          </div>
        </div>
      )}
      {tab === 'overview' && <AdminOverview />}
      {tab === 'queue' && <QueuePanel onStartConsult={(item) => { setActive(item); setTab('consult'); }} onOpenLab={() => setTab('lab')} />}
      {tab === 'consult' && (
        <ConsultationPanel key={active?.id ?? 'walk-in'} queueItem={active} onFinished={() => setActive(null)} onLabRequested={() => { setActive(null); setTab('queue'); }} />
      )}
      {tab === 'inventory' && (
        <div className="row g-4">
          <div className="col-12"><div className="panel-card"><h5 className="mb-3">Low / Expiring Stock Alerts</h5><StockAlerts /></div></div>
          <div className="col-12"><InventoryPanel /></div>
        </div>
      )}
      {tab === 'lab' && <LabPanel />}
      {tab === 'medreq' && <MedicineRequestsPanel />}
      {tab === 'triage' && <IntakePanel />}
      {tab === 'fp' && <FamilyPlanningPanel />}
      {tab === 'immrecord' && <ImmunizationRecordPanel />}
      {tab === 'profile' && <ProfilePanel />}
      {tab === 'dispense' && <DispenseLogPanel />}
      {tab === 'residents' && (
        <div className="row g-4">
          <div className="col-12"><PatientList /></div>
          <div className="col-12"><PatientForm /></div>
        </div>
      )}
      {tab === 'announcements' && <AnnouncementsPanel />}
      {tab === 'events' && <EventsPanel />}
      {tab === 'staff' && role === 'admin' && <StaffPanel />}
      {tab === 'logs' && role === 'admin' && <ActivityLogPanel />}
      {tab === 'reports' && <ReportsPanel />}
    </DashboardShell>
  );
}