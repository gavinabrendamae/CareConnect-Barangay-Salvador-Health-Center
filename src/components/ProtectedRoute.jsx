import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { roleHome } from '../lib/format.js';
import { manilaToday } from '../lib/loginCode.js';

export function Spinner() {
  return (
    <div className="d-flex justify-content-center align-items-center py-5">
      <div className="spinner-border text-success" role="status" />
    </div>
  );
}

export default function ProtectedRoute({ roles, children }) {
  const { session, profile, loading, signOut } = useAuth();

  if (loading) return <Spinner />;
  if (!session) return <Navigate to="/login" replace />;
  if (profile === undefined) return <Spinner />;

  if (profile === null) {
    return (
      <div className="container py-5 text-center">
        <h4>Profile not found</h4>
        <p className="text-secondary">Your account has no profile record yet. Please contact the health center.</p>
        <button className="btn btn-primary-custom" onClick={() => window.confirm('Are you sure you want to log out?') && signOut()}>Log out</button>
      </div>
    );
  }

  if (profile.is_active === false) {
    return (
      <div className="container py-5 text-center">
        <h4>Account deactivated</h4>
        <p className="text-secondary">This account has been deactivated by the health center. Please contact the administrator.</p>
        <button className="btn btn-primary-custom" onClick={() => window.confirm('Are you sure you want to log out?') && signOut()}>Log out</button>
      </div>
    );
  }

  if (profile.email_verified_on !== manilaToday()) return <Navigate to="/login" replace />;

  if (!roles.includes(profile.role)) return <Navigate to={roleHome(profile.role)} replace />;
  return children;
}