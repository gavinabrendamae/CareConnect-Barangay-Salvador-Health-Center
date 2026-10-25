export const STAFF_ROLES = ['bhw', 'midwife', 'doctor', 'admin'];
export const CLINICAL_ROLES = ['midwife', 'doctor', 'admin'];

export const ROLE_LABEL = {
  resident: 'Resident',
  bhw: 'Barangay Health Worker',
  midwife: 'Midwife',
  doctor: 'Doctor',
  admin: 'Super Admin',
};

export function roleHome(role) {
  switch (role) {
    case 'resident': return '/resident';
    case 'bhw': return '/bhw';
    case 'midwife':
    case 'doctor':
    case 'admin': return '/admin';
    default: return '/login';
  }
}

export function fullName(p) {
  if (!p) return '';
  return [p.first_name, p.middle_name, p.last_name, p.suffix].filter(Boolean).join(' ');
}

export function formatDate(d) {
  if (!d) return '—';
  const date = d.length === 10 ? new Date(`${d}T00:00:00`) : new Date(d);
  return date.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatDateTime(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-PH', {
    year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

export function calcAge(birthDate) {
  if (!birthDate) return '—';
  const b = new Date(`${birthDate}T00:00:00`);
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
  return age;
}

export function todayISO() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function daysUntil(dateStr) {
  const target = new Date(`${dateStr}T00:00:00`);
  const today = new Date(`${todayISO()}T00:00:00`);
  return Math.round((target - today) / 86400000);
}

export const PH_PHONE = /^(09|\+639)\d{9}$/;

export function startOfTodayISO() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString();
}

export function monthStartISO() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
}

export function addDaysISO(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  const pad = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function bmi(weightKg, heightCm) {
  if (!weightKg || !heightCm) return null;
  const m = Number(heightCm) / 100;
  return Math.round((Number(weightKg) / (m * m)) * 10) / 10;
}

export const PATIENT_TYPES = ['Infant', 'Child', 'Adult', 'Senior Citizen', 'Pregnant', 'Person with Disability'];

export function ageInMonths(birthDate) {
  if (!birthDate) return null;
  const b = new Date(`${birthDate}T00:00:00`);
  const now = new Date();
  let m = (now.getFullYear() - b.getFullYear()) * 12 + (now.getMonth() - b.getMonth());
  if (now.getDate() < b.getDate()) m--;
  return m;
}

export function patientTypeError(birthDate, type) {
  const months = ageInMonths(birthDate);
  if (months === null || !type) return '';
  if (months < 0) return 'Birth date cannot be in the future.';
  const years = Math.floor(months / 12);
  switch (type) {
    case 'Infant': return months > 12 ? 'Infant must be 12 months old or younger.' : '';
    case 'Infant / Child': return years >= 18 ? 'A person aged 18 or older is an Adult, not an Infant / Child.' : '';
    case 'Child': return months <= 12 || years >= 18 ? (years >= 18 ? 'A person aged 18 or older is an Adult, not a Child.' : 'Child must be older than 12 months. Choose Infant instead.') : '';
    case 'Adult': return years < 18 ? 'Adult must be 18 years old or above.' : (years >= 60 ? 'A person aged 60 or older is a Senior Citizen.' : '');
    case 'Senior Citizen': return years < 60 ? 'Senior Citizen must be 60 years old or above.' : '';
    default: return '';
  }
}