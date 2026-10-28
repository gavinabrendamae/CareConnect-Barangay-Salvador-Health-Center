import BrandMark from './BrandMark.jsx';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { roleHome } from '../lib/format.js';

export default function SiteNavbar() {
  const [open, setOpen] = useState(false);
  const { session, role } = useAuth();

  return (
    <nav className="navbar navbar-expand-lg sticky-top py-3 site-nav">
      <div className="container">
        <a className="navbar-brand" href={`${import.meta.env.BASE_URL}#home`}>
          <BrandMark />
          CareConnect Barangay Salvador Health Center
        </a>
        <button className="navbar-toggler" type="button" onClick={() => setOpen(!open)} aria-label="Toggle navigation">
          <span className="navbar-toggler-icon" />
        </button>
        <div className={`collapse navbar-collapse justify-content-end ${open ? 'show' : ''}`}>
          <ul className="navbar-nav gap-lg-2 align-items-lg-center">
            <li className="nav-item"><a className="nav-link" href={`${import.meta.env.BASE_URL}#home`}>Home</a></li>
            <li className="nav-item"><a className="nav-link" href={`${import.meta.env.BASE_URL}#about`}>About</a></li>
            <li className="nav-item"><a className="nav-link" href={`${import.meta.env.BASE_URL}#services`}>Services</a></li>
            <li className="nav-item"><a className="nav-link" href={`${import.meta.env.BASE_URL}#specialist`}>Specialist</a></li>
            <li className="nav-item"><a className="nav-link" href={`${import.meta.env.BASE_URL}#faq`}>FAQs</a></li>
            <li className="nav-item"><Link className="nav-link" to="/stock">Medicines</Link></li>
            <li className="nav-item ms-lg-2 mt-2 mt-lg-0">
              {session && role
                ? <Link className="btn btn-primary-custom" to={roleHome(role)}>Dashboard</Link>
                : <Link className="btn btn-primary-custom" to="/login">Login</Link>}
            </li>
          </ul>
        </div>
      </div>
    </nav>
  );
}