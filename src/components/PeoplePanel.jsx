import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import PatientList from './PatientList.jsx';
import PatientForm from './PatientForm.jsx';
import StaffPanel from './StaffPanel.jsx';
import { PendingApprovals } from './RolesPanel.jsx';

export default function PeoplePanel({ pending = 0 }) {
  const { role } = useAuth();
  const isAdmin = role === 'admin';
  const [which, setWhich] = useState('residents');
  const [ver, setVer] = useState(0);

  return (
    <div className="row g-4">
      {isAdmin && (
        <div className="col-12">
          <div className="btn-group">
            <button type="button" className={`btn ${which === 'residents' ? 'btn-primary-custom' : 'btn-outline-secondary'}`} onClick={() => setWhich('residents')}>
              <i className="bi bi-people me-2" />Residents{pending > 0 && <span className="badge rounded-pill bg-danger ms-2">{pending}</span>}
            </button>
            <button type="button" className={`btn ${which === 'staff' ? 'btn-primary-custom' : 'btn-outline-secondary'}`} onClick={() => setWhich('staff')}>
              <i className="bi bi-person-badge me-2" />Staff
            </button>
          </div>
        </div>
      )}
      {which === 'staff' && isAdmin ? (
        <div className="col-12"><StaffPanel /></div>
      ) : (
        <>
          {isAdmin && pending > 0 && <div className="col-12"><PendingApprovals ver={ver} onChanged={() => setVer((n) => n + 1)} /></div>}
          <div className="col-12"><PatientForm /></div>
          <div className="col-12"><PatientList /></div>
        </>
      )}
    </div>
  );
}