import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext.jsx';
import { fullName, formatDate, formatDateTime, calcAge, daysUntil } from '../lib/format.js';
import DashboardShell from '../components/DashboardShell.jsx';
import { Spinner } from '../components/ProtectedRoute.jsx';
import AnnouncementList from '../components/AnnouncementList.jsx';
import MedicineAvailability from '../components/MedicineAvailability.jsx';
import ImmunizationCard from '../components/ImmunizationCard.jsx';
import FamilyPlanningCard from '../components/FamilyPlanningCard.jsx';
import ResidentLabPanel from '../components/ResidentLabPanel.jsx';
import NotificationsPanel from '../components/NotificationsPanel.jsx';
import { useNotifications } from '../lib/useNotifications.js';
import { cardKindFor, DEPO } from '../lib/immunizationCards.js';

const TABS = [
  { key: 'home', label: 'My Dashboard', icon: 'bi-house-heart' },
  { key: 'notifications', label: 'Notifications', icon: 'bi-bell' },
  { key: 'history', label: 'Medical History', icon: 'bi-clipboard2-pulse' },
  { key: 'lab', label: 'My Laboratory', icon: 'bi-eyedropper' },
  { key: 'household', label: 'My Family', icon: 'bi-people' },
  { key: 'immunization', label: 'Immunization Record', icon: 'bi-calendar-check' },
  { key: 'medicines', label: 'Request Medicine', icon: 'bi-capsule' },
  { key: 'profile', label: 'My Profile', icon: 'bi-person-vcard' },
];

// An immunization-card dose as a simple "vaccine" row: confirmed by staff = administered, otherwise scheduled.
const asVax = (r) => ({ id: r.id, patient_id: r.patient_id, vaccine_name: r.vaccine, dose_label: `dose ${r.dose_no}`,
  scheduled_date: r.given_date, status: r.confirmed_at ? 'administered' : 'scheduled' });

function Row({ label, value }) {
  return (
    <div className="col-md-6 mb-3">
      <div className="small text-secondary">{label}</div>
      <div className="fw-semibold">{value || '—'}</div>
    </div>
  );
}

export default function ResidentDashboard() {
  const { profile } = useAuth();
  const [tab, setTab] = useState('home');
  const [patient, setPatient] = useState(undefined);
  const [vaccines, setVaccines] = useState([]);
  const [consults, setConsults] = useState([]);
  const [rx, setRx] = useState([]);
  const [members, setMembers] = useState([]);
  const [famVax, setFamVax] = useState([]);
  const [myCard, setMyCard] = useState('main');
  const [error, setError] = useState('');
  const notif = useNotifications();

  // lighter theme for residents only (see body.theme-light in styles.css)
  useEffect(() => {
    document.body.classList.add('theme-light');
    return () => document.body.classList.remove('theme-light');
  }, []);

  useEffect(() => {
    (async () => {
      const { data: p, error: pErr } = await supabase.from('patients').select('*').eq('profile_id', profile.id).maybeSingle();
      if (pErr) { setError(pErr.message); setPatient(null); return; }
      setPatient(p);
      if (!p) return;
      const [v, c, r] = await Promise.all([
        supabase.from('immunization_records').select('*').eq('patient_id', p.id).gt('dose_no', 0).order('given_date'),
        supabase.from('consultations').select('*').eq('patient_id', p.id).order('consulted_at', { ascending: false }),
        supabase.from('prescriptions').select('*, medicine:medicines(name, unit)').eq('patient_id', p.id).order('created_at', { ascending: false }),
      ]);
      setVaccines((v.data ?? []).map(asVax)); setConsults(c.data ?? []); setRx(r.data ?? []);

      // Family members linked to this resident as household head (visible to the head via RLS).
      const { data: m } = await supabase.from('patients')
        .select('id, first_name, middle_name, last_name, suffix, birth_date, gender, medical_id, patient_type')
        .eq('household_head_id', p.id).order('birth_date');
      setMembers(m ?? []);
      if (m?.length) {
        const { data: fv } = await supabase.from('immunization_records').select('*').in('patient_id', m.map((x) => x.id)).gt('dose_no', 0).order('given_date');
        setFamVax((fv ?? []).map(asVax));
      }
    })();
  }, [profile.id]);

  if (patient === undefined) return <Spinner />;

  const hasFp = vaccines.some((v) => v.vaccine_name === DEPO);
  const nameOf = (id) => (id === patient?.id ? 'Me' : fullName(members.find((m) => m.id === id)) || 'Family member');
  const allVax = [...vaccines, ...famVax].sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date));
  const next = allVax.find((v) => v.status === 'scheduled' && daysUntil(v.scheduled_date) >= 0);
  const lastVisit = consults[0]?.consulted_at;

  return (
    <DashboardShell title="My Health" tabs={TABS.map((t) => (t.key === 'notifications' ? { ...t, badge: notif.unread } : t))} active={tab} onTab={setTab}>
      {error && <div className="alert alert-danger">{error}</div>}

      {tab === 'home' && (
        <>
          <div className="panel-card mb-4" style={{ background: 'var(--primary)', color: '#fff', border: 0 }}>
            <h4 className="fw-bold mb-1">Hello, {profile.first_name}!</h4>
            <div style={{ opacity: .9 }}>Medical ID: <strong>{patient?.medical_id ?? '—'}</strong> · {(patient ?? profile).purok || 'Barangay resident'}</div>
          </div>
          <div className="row g-3 mb-4">
            <div className="col-md-6"><div className="stat-card">
              <i className="bi bi-clipboard2-check text-success" />
              <div className="num" style={{ fontSize: '1.4rem' }}>{lastVisit ? formatDate(lastVisit) : 'No visit yet'}</div>
              <div className="lbl">Last check-up</div></div></div>
            <div className="col-md-6"><div className="stat-card">
              <i className="bi bi-shield-plus text-success" />
              <div className="num" style={{ fontSize: '1.4rem' }}>{next ? formatDate(next.scheduled_date) : 'None scheduled'}</div>
              <div className="lbl">{next ? `Next vaccine: ${next.vaccine_name}${next.dose_label ? ` (${next.dose_label})` : ''} — ${nameOf(next.patient_id)}` : 'Next vaccine'}</div></div></div>
          </div>
          <div className="panel-card">
            <h5 className="mb-3"><i className="bi bi-megaphone me-2" />Health Center Announcements</h5>
            <AnnouncementList />
          </div>
        </>
      )}

      {tab === 'household' && (
        <div className="panel-card">
          <h5 className="mb-1">My Family</h5>
          <p className="text-secondary small">Family members (such as your children) linked to you by the health center. To add or correct a member, please visit the health center.</p>
          {members.length === 0 ? <div className="text-secondary">No family members are linked to you yet.</div> : (
            <div className="table-responsive">
              <table className="table mb-0">
                <thead><tr><th>Name</th><th>Medical ID</th><th>Age</th><th>Sex</th><th>Type</th><th>Next vaccine</th></tr></thead>
                <tbody>
                  {members.map((m) => {
                    const nv = famVax.find((v) => v.patient_id === m.id && v.status === 'scheduled' && daysUntil(v.scheduled_date) >= 0);
                    return (
                      <tr key={m.id}>
                        <td><strong>{fullName(m)}</strong></td><td><code>{m.medical_id}</code></td><td>{calcAge(m.birth_date)}</td>
                        <td>{m.gender || '—'}</td><td className="small">{m.patient_type || '—'}</td>
                        <td className="small">{nv ? `${nv.vaccine_name} · ${formatDate(nv.scheduled_date)}` : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'notifications' && <NotificationsPanel {...notif} upcoming={allVax.filter((v) => v.status === 'scheduled' && daysUntil(v.scheduled_date) >= 0).map((v) => ({ ...v, who: nameOf(v.patient_id) }))} />}

      {tab === 'medicines' && <MedicineAvailability />}

      {tab === 'profile' && (
        <>
          <div className="panel-card">
            <h5 className="mb-3">Personal Information</h5>
            <div className="row">
              <Row label="Full name" value={fullName(patient ?? profile)} />
              <Row label="Medical ID" value={patient?.medical_id} />
              <Row label="Email" value={profile.email} />
              <Row label="Birth date" value={`${formatDate((patient ?? profile).birth_date)} (${calcAge((patient ?? profile).birth_date)} yrs)`} />
              <Row label="Gender" value={(patient ?? profile).gender} />
              <Row label="Contact number" value={(patient ?? profile).contact_number} />
              <Row label="Type of patient" value={(patient ?? profile).patient_type} />
            </div>
            <hr />
            <h5 className="mb-3">Address</h5>
            <div className="row">
              <Row label="Address" value={(patient ?? profile).address} />
              <Row label="Purok" value={(patient ?? profile).purok} />
            </div>
            <p className="small text-secondary mb-0">To correct any of this information, please visit the health center.</p>
          </div>
        </>
      )}

      {tab === 'immunization' && (
        <>
          {patient && (cardKindFor(patient) || hasFp) && (
            <div className="mb-4">
              <h6 className="mb-2">My record</h6>
              {hasFp && cardKindFor(patient) && (
                <div className="btn-group mb-3">
                  <button type="button" className={`btn btn-sm ${myCard === 'main' ? 'btn-primary-custom' : 'btn-outline-secondary'}`} onClick={() => setMyCard('main')}>Immunization card</button>
                  <button type="button" className={`btn btn-sm ${myCard === 'fp' ? 'btn-primary-custom' : 'btn-outline-secondary'}`} onClick={() => setMyCard('fp')}>Family planning card</button>
                </div>
              )}
              {(myCard === 'fp' && hasFp) || !cardKindFor(patient)
                ? <FamilyPlanningCard key="fp" patientId={patient.id} />
                : <ImmunizationCard key="main" patientId={patient.id} />}
            </div>
          )}
          {members.filter((x) => cardKindFor(x)).map((x) => (
            <div key={x.id} className="mb-4">
              <h6 className="mb-2">{`${fullName(x)}'s record`}</h6>
              <ImmunizationCard patientId={x.id} />
            </div>
          ))}
          <div className="panel-card">
            <h5 className="mb-3">Reminder Notifications</h5>
            <div className="row">
              <Row label="Email reminders go to" value={profile.email} />
            </div>
            <p className="small text-secondary mb-0">You get a Gmail and in-app reminder the day before and on the day of each vaccine. To change your email, please visit the health center.</p>
          </div>
        </>
      )}

      {tab === 'lab' && <ResidentLabPanel />}

      {tab === 'history' && (
        <>
        <div className="panel-card mb-4">
          <h5 className="mb-3">Consultation History</h5>
          {consults.length === 0 ? <div className="text-secondary">No consultations recorded yet.</div> : consults.map((c) => (
            <div key={c.id} className="border-bottom pb-3 mb-3">
              <div className="d-flex justify-content-between flex-wrap">
                <strong>{c.diagnosis || 'Consultation'}</strong>
                <span className="small text-secondary">{formatDateTime(c.consulted_at)}</span>
              </div>
              {c.complaint && <div><span className="text-secondary">Complaint:</span> {c.complaint}</div>}
              {c.notes && <div><span className="text-secondary">Notes:</span> {c.notes}</div>}
            </div>
          ))}
        </div>

        <div className="panel-card">
          <h5 className="mb-3">Digital Prescriptions</h5>
          {rx.length === 0 ? <div className="text-secondary">No prescriptions yet.</div> : (
            <div className="table-responsive">
              <table className="table mb-0">
                <thead><tr><th>Date</th><th>Medicine</th><th>Qty</th><th>Instructions</th></tr></thead>
                <tbody>
                  {rx.map((r) => (
                    <tr key={r.id}>
                      <td className="small">{formatDateTime(r.created_at)}</td>
                      <td><strong>{r.medicine?.name}</strong></td>
                      <td>{r.quantity} {r.medicine?.unit}</td>
                      <td>{r.instructions || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </>
      )}
    </DashboardShell>
  );
}