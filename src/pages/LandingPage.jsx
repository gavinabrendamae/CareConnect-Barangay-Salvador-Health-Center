import { useState } from 'react';
import { Link } from 'react-router-dom';
import SiteNavbar from '../components/SiteNavbar.jsx';
import SiteFooter from '../components/SiteFooter.jsx';
import Modal from '../components/Modal.jsx';
import AnnouncementModal from '../components/AnnouncementModal.jsx';

const SERVICES = [
  { key: 'vaccination', icon: 'bi-syringe', title: 'Vaccination Services', short: 'Track, schedule, and manage vaccine records digitally.',
    body: 'We track every dose from birth to adulthood - BCG, Hepatitis B, Pentavalent, OPV, and Tetanus Toxoid among others. Parents and patients can view upcoming and overdue doses directly from their patient portal, and residents receive automatic email reminders before their schedule.' },
  { key: 'prenatal', icon: 'bi-person-arms-up', title: 'Prenatal Care', short: 'Monitor maternal health and schedule regular checkups.',
    body: 'Expecting mothers are monitored through every trimester with scheduled checkups, vital sign tracking, and risk alerts for conditions like high blood pressure. Midwives can log consultations and keep a complete prenatal history for each patient.' },
  { key: 'familyplanning', icon: 'bi-people-fill', title: 'Family Planning', short: 'Confidential and well-managed reproductive health support.',
    body: "Confidential family planning counseling and method tracking for residents. Health workers can record consultations and follow-up schedules while keeping each patient's information private and secure." },
  { key: 'senior', icon: 'bi-person-walking', title: 'Senior Citizen', short: 'Dedicated monitoring and care programs for elderly residents.',
    body: 'Dedicated monitoring for elderly residents, including routine wellness checks and management of common conditions such as hypertension and diabetes. Staff can flag seniors who need priority follow-up or home visits.' },
  { key: 'tbdots', icon: 'bi-lungs', title: 'TB DOTS', short: 'Directly observed treatment and monitoring for TB patients.',
    body: 'Directly Observed Treatment, Short-course for TB patients. Daily dose intake is logged by health workers to make sure patients complete their full treatment course, with automatic tracking of missed doses.' },
  { key: 'consultation', icon: 'bi-clipboard2-pulse', title: 'General Consultation', short: 'Walk-in and scheduled consultations for common illnesses.',
    body: 'Walk-in and scheduled consultations for common illnesses such as fever, cough, and colds. Every visit is recorded with vitals, diagnosis, and prescribed treatment, building a complete health record over time.' },
];

const SPECIALISTS = [
  { initials: 'MR', name: 'Maria Reyes', purok: 'Purok 1', role: 'Health Worker' },
  { initials: 'JC', name: 'Jose Cruz', purok: 'Purok 2', role: 'Health Worker' },
  { initials: 'AS', name: 'Ana Santos', purok: 'Purok 3', role: 'Health Worker' },
  { initials: 'RB', name: 'Rico Bautista', purok: 'Purok 4', role: 'Health Worker' },
  { initials: 'LT', name: 'Liza Torres', purok: 'Purok 5', role: 'Midwife' },
  { initials: 'EM', name: 'Edwin Mendoza', purok: 'Purok 6', role: 'Health Worker' },
];

const FAQS = [
  { q: 'Ano ang oras ng bukas ng Health Center?', a: 'Bukas ang Health Center tuwing Lunes hanggang Biyernes, 8:00 AM hanggang 5:00 PM.', img: `${import.meta.env.BASE_URL}Resources/faq1.jpg` },
  { q: 'Saan ang location ng Health Center?', a: 'Matatagpuan ang Health Center sa loob ng barangay hall complex. Makikita ang eksaktong address sa Contact page.', img: `${import.meta.env.BASE_URL}Resources/faq2.jpg` },
  { q: 'Paano ako makakapag-register sa system?', a: 'I-click ang "Join us Now" o "Login" button sa itaas, at sundan ang mga hakbang sa registration form.', img: `${import.meta.env.BASE_URL}Resources/faq3.jpg` },
  { q: 'Sino ang pwede kong tawagan kung may concern ako?', a: 'Maaari kang tumawag o pumunta sa Health Center front desk, o makipag-ugnayan sa numero na nasa Contact page.', img: `${import.meta.env.BASE_URL}Resources/faq4.jpg` },
  { q: 'Anong mga services ang offer ng Health Center?', a: 'Vaccination, prenatal care, family planning, senior citizen program, TB-DOTS, at general consultation.', img: `${import.meta.env.BASE_URL}Resources/faq5.jpg` },
  { q: 'Libre po ba ang mga serbisyo?', a: 'Karamihan sa mga batayang serbisyo ng Health Center ay libre para sa mga rehistradong residente.', img: `${import.meta.env.BASE_URL}Resources/faq6.jpg` },
  { q: 'Anong mga sakit ang pwedeng ipatingin?', a: 'Karamihan sa karaniwang sakit gaya ng lagnat, ubo, sipon, at iba pang minor illnesses ay maaaring ipatingin.', img: `${import.meta.env.BASE_URL}Resources/faq7.jpg` },
  { q: 'May libreng gamot ba sa Health Center?', a: 'May mga available na libreng gamot depende sa uri ng sakit at kasalukuyang supply ng Health Center. I-click ang Medicines sa itaas upang makita ang mga gamot na iniaalok ng Health Center.', img: `${import.meta.env.BASE_URL}Resources/faq8.jpg` },
];

const PAGE_SIZE = 4;
const SPECIALIST_PAGES = Array.from({ length: Math.ceil(SPECIALISTS.length / PAGE_SIZE) }, (_, i) =>
  SPECIALISTS.slice(i * PAGE_SIZE, i * PAGE_SIZE + PAGE_SIZE)
);

export default function LandingPage() {
  const [service, setService] = useState(null);
  const [openFaq, setOpenFaq] = useState(3);
  const [slide, setSlide] = useState(0);
  const [annOpen, setAnnOpen] = useState(false);
  const [annCount, setAnnCount] = useState(0);

  const faqImg = openFaq === null ? FAQS[3].img : FAQS[openFaq].img;

  return (
    <>
      <SiteNavbar />
      <AnnouncementModal open={annOpen} onClose={() => setAnnOpen(false)} onLoaded={setAnnCount} />

      <section id="home" className="hero">
        <div className="container">
          <h1>Bringing Better <span className="accent">Healthcare to the Barangay</span><br />— Digitally</h1>
          <p className="lead">Streamline records, monitor vaccinations, and improve decision-making with our Healthcare Information System for your Barangay Health Center.</p>
          <Link to="/register" className="btn btn-primary-custom btn-lg">Join us Now</Link>
          <div>
            <button type="button" className="hero-ann-btn" onClick={() => setAnnOpen(true)}>
              <i className="bi bi-megaphone-fill me-2" />Announcements
              {annCount > 0 && <span className="badge bg-danger rounded-pill">{annCount}</span>}
            </button>
          </div>
        </div>
      </section>

      <section id="about" className="page-section">
        <div className="container">
          <h2 className="section-title text-center mb-5">About Our Health Center</h2>
          <div className="row align-items-center g-5">
            <div className="col-lg-6">
              <p className="eyebrow mb-1">Empowering Healthcare Workers</p>
              <h3 className="fw-bold mb-3">Enhancing Community Wellness</h3>
              <p className="text-secondary">
                The Barangay Health Center serves as an essential healthcare facility for residents of the community.
                It provides accessible and reliable medical services designed to support the well-being of individuals
                and families within the barangay. Staffed by dedicated health workers, nurses, midwives, and other
                professionals, the center aims to deliver compassionate and efficient care to everyone who seeks assistance.
                The health center offers a wide range of services, including routine consultations, prenatal check-ups,
                child immunizations, family planning services, TB-DOTS, and management of common illnesses. It also plays
                a vital role in health education, disease prevention, and emergency response within the community.
              </p>
              <a href="#services" className="btn btn-primary-custom mt-2">See More</a>
            </div>
            <div className="col-lg-6">
              <div className="about-visual"><i className="bi bi-hospital" /></div>
            </div>
          </div>
        </div>
      </section>

      <section id="services" className="page-section bg-light">
        <div className="container">
          <h2 className="section-title text-center mb-5">Our Services</h2>
          <div className="row g-4">
            {SERVICES.map((s) => (
              <div className="col-md-6 col-lg-4" key={s.key}>
                <div className="service-card">
                  <div className="service-icon"><i className={`bi ${s.icon}`} /></div>
                  <h5>{s.title}</h5>
                  <p className="text-secondary">{s.short}</p>
                  <a href="#services" className="btn-outline-primary-custom" onClick={(e) => { e.preventDefault(); setService(s); }}>
                    Read More
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="specialist" className="page-section specialist-section">
        <div className="container">
          <h2 className="section-title text-center mb-2">Our Specialists</h2>
          <p className="text-center text-secondary mb-5">
            Our dedicated team of <strong>healthcare workers</strong> is here to serve the community.<br />
            Get to know the professionals behind your care.
          </p>
          <div className="position-relative px-5">
            <div className="row g-4 justify-content-center">
              {SPECIALIST_PAGES[slide].map((p) => (
                <div className="col-6 col-md-3" key={p.name}>
                  <div className="specialist-card">
                    <div className="avatar-initials">{p.initials}</div>
                    <h6>{p.name}</h6>
                    <div className="role">{p.purok}</div>
                    <div className="role">{p.role}</div>
                  </div>
                </div>
              ))}
            </div>
            {SPECIALIST_PAGES.length > 1 && (
              <>
                <button className="btn btn-link text-dark position-absolute top-50 start-0 translate-middle-y fs-3" aria-label="Previous"
                  onClick={() => setSlide((slide - 1 + SPECIALIST_PAGES.length) % SPECIALIST_PAGES.length)}>
                  <i className="bi bi-chevron-left" />
                </button>
                <button className="btn btn-link text-dark position-absolute top-50 end-0 translate-middle-y fs-3" aria-label="Next"
                  onClick={() => setSlide((slide + 1) % SPECIALIST_PAGES.length)}>
                  <i className="bi bi-chevron-right" />
                </button>
              </>
            )}
          </div>
        </div>
      </section>

      <section id="faq" className="page-section">
        <div className="container">
          <h2 className="section-title text-center mb-2">Frequent Asked Questions</h2>
          <p className="text-center text-secondary mb-5">Quick answers to common questions about using our health information system.</p>
          <div className="row g-5 align-items-start">
            <div className="col-lg-7">
              <div className="accordion">
                {FAQS.map((f, i) => (
                  <div className="accordion-item" key={f.q}>
                    <h2 className="accordion-header">
                      <button
                        className={`accordion-button ${openFaq === i ? '' : 'collapsed'}`}
                        type="button"
                        onClick={() => setOpenFaq(openFaq === i ? null : i)}
                      >
                        {f.q}
                      </button>
                    </h2>
                    <div className={`accordion-collapse collapse ${openFaq === i ? 'show' : ''}`}>
                      <div className="accordion-body">{f.a}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="col-lg-5">
              <div className="faq-visual" style={{ backgroundImage: `url('${import.meta.env.BASE_URL}${faqImg.replace(/^\//, '')}')` }} />
            </div>
          </div>
        </div>
      </section>

      <SiteFooter />

      <Modal
        show={!!service}
        title={service?.title}
        icon={service?.icon}
        onClose={() => setService(null)}
        footer={
          <>
            <button type="button" className="btn btn-outline-secondary" onClick={() => setService(null)}>Close</button>
            <Link to="/register" className="btn btn-primary-custom">Join us Now</Link>
          </>
        }
      >
        <p className="text-secondary mb-0">{service?.body}</p>
      </Modal>
    </>
  );
}