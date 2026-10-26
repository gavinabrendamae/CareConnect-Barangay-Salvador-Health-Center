import BrandMark from './BrandMark.jsx';
export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="row g-4">
          <div className="col-md-4">
            <h6 className="fw-bold text-white mb-2 d-flex align-items-center gap-2"><BrandMark />CareConnect</h6>
            <p className="mb-0">Empowering health centers with secure, digital record-keeping and smart tools.</p>
          </div>
          <div className="col-md-4">
            <h6 className="fw-bold text-white text-uppercase small mb-3">Navigation Links</h6>
            <ul className="list-unstyled d-flex flex-column gap-2 mb-0">
              <li><a href={`${import.meta.env.BASE_URL}#home`}>Home</a></li>
              <li><a href={`${import.meta.env.BASE_URL}#about`}>About</a></li>
              <li><a href={`${import.meta.env.BASE_URL}#services`}>Services</a></li>
              <li><a href={`${import.meta.env.BASE_URL}#specialist`}>Specialist</a></li>
              <li><a href={`${import.meta.env.BASE_URL}#faq`}>FAQ</a></li>
            </ul>
          </div>
          <div className="col-md-4">
            <h6 className="fw-bold text-white text-uppercase small mb-3">Contact Information</h6>
            <p className="mb-1">Barangay Salvador Health Center</p>
            <p className="mb-1">Santiago City Isabela</p>
            <p className="mb-0">Phone: 0997-567-7889</p>
          </div>
        </div>
        <hr className="border-secondary my-4" />
        <p className="text-center small mb-0">&copy; 2026 CareConnect Health Center IMS. All rights reserved.</p>
      </div>
    </footer>
  );
}