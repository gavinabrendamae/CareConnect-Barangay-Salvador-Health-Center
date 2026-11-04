import { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { isConfigured } from './lib/supabase';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import LandingPage from './pages/LandingPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import PublicPortalPage from './pages/PublicPortalPage.jsx';
import SetupPage from './pages/SetupPage.jsx';
import ResidentDashboard from './pages/ResidentDashboard.jsx';
import BHWDashboard from './pages/BHWDashboard.jsx';
import AdminDashboard from './pages/AdminDashboard.jsx';

// Every page opens at the top (a new page used to keep the scroll position of the previous one); #links still jump to their section.
function ScrollToTop() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) {
      const t = setTimeout(() => document.getElementById(hash.slice(1))?.scrollIntoView(), 60);
      return () => clearTimeout(t);
    }
    window.scrollTo(0, 0);
    return undefined;
  }, [pathname, hash]);
  return null;
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      {!isConfigured && (
        <div className="alert alert-warning rounded-0 mb-0 text-center">
          Supabase is not configured yet. Copy <code>.env.example</code> to <code>.env</code> and fill in
          <code> VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code>, then restart <code>npm run dev</code>.
        </div>
      )}
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/stock" element={<PublicPortalPage />} />
        <Route path="/setup" element={<SetupPage />} />

        <Route path="/resident" element={<ProtectedRoute roles={['resident']}><ResidentDashboard /></ProtectedRoute>} />
        <Route path="/bhw" element={<ProtectedRoute roles={['bhw']}><BHWDashboard /></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute roles={['admin', 'midwife', 'doctor']}><AdminDashboard /></ProtectedRoute>} />
        <Route path="/midwife" element={<Navigate to="/admin" replace />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}