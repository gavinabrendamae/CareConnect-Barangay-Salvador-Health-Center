import BrandMark from './BrandMark.jsx';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { ROLE_LABEL, fullName } from '../lib/format.js';

export default function DashboardShell({ tabs, active, onTab, title, children }) {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [confirmOut, setConfirmOut] = useState(false);

  useEffect(() => {
    document.body.classList.add('dash-body');
    return () => document.body.classList.remove('dash-body');
  }, []);

  async function handleLogout() {
    setConfirmOut(false);
    await signOut();
    navigate('/login', { replace: true });
  }

  return (
    <>
      <nav className="navbar dash-nav sticky-top py-2">
        <div className="container-fluid px-3 px-lg-4">
          <Link className="navbar-brand" to="/">
            <BrandMark />
            <span>CareConnect<span className="d-none d-md-inline">: Barangay Salvador Health Center</span></span>
          </Link>
          <div className="d-flex align-items-center gap-3">
            <div className="text-end d-none d-sm-block">
              <div className="fw-semibold lh-1">{fullName(profile)}</div>
              <small className="dash-nav-role">{profile?.role === 'admin' ? 'Midwife' : ROLE_LABEL[profile?.role]}</small>
            </div>
            <button className="btn btn-outline-primary-custom dash-nav-btn" onClick={() => setConfirmOut(true)}>
              <i className="bi bi-box-arrow-right me-1" />Log out
            </button>
          </div>
        </div>
      </nav>

      {confirmOut && createPortal(
        <>
          <div className="modal fade show d-block" tabIndex="-1" onClick={() => setConfirmOut(false)}>
            <div className="modal-dialog modal-dialog-centered modal-sm" onClick={(e) => e.stopPropagation()}>
              <div className="modal-content">
                <div className="modal-body text-center py-4">
                  <i className="bi bi-box-arrow-right fs-1 text-primary-emphasis" />
                  <h5 className="mt-2 mb-1">Are you sure you want to log out?</h5>
                  <p className="text-secondary small mb-0">You will need to sign in again to continue.</p>
                </div>
                <div className="modal-footer justify-content-center border-0 pt-0 pb-4">
                  <button type="button" className="btn btn-outline-secondary px-4" onClick={() => setConfirmOut(false)}>Cancel</button>
                  <button type="button" className="btn btn-primary-custom px-4" autoFocus onClick={handleLogout}>Yes, log out</button>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show" />
        </>,
        document.body,
      )}

      <div className="dash-layout">
        <aside className="dash-sidebar">
          {title && <div className="dash-sidebar-title">{title}</div>}
          <ul className="nav flex-lg-column gap-1">
            {tabs.map((t) => (
              <li className="nav-item" key={t.key}>
                <button className={`nav-link ${active === t.key ? 'active' : ''}`} onClick={() => onTab(t.key)}>
                  <i className={`bi ${t.icon} me-2`} />{t.label}
                  {t.badge > 0 && <span className="badge rounded-pill bg-danger ms-2">{t.badge}</span>}
                </button>
              </li>
            ))}
          </ul>
        </aside>
        <main className="dash-main">{children}</main>
      </div>
    </>
  );
}