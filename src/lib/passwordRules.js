export const PW_RULES = [
  { id: 'len', label: 'At least 8 characters', test: (v) => v.length >= 8 },
  { id: 'lower', label: 'At least one lowercase letter (a-z)', test: (v) => /[a-z]/.test(v) },
  { id: 'upper', label: 'At least one uppercase letter (A-Z)', test: (v) => /[A-Z]/.test(v) },
  { id: 'num', label: 'At least one number (0-9)', test: (v) => /[0-9]/.test(v) },
  { id: 'special', label: 'At least one special character (!@#$...)', test: (v) => /[!@#$%^&*(),.?":{}|<>]/.test(v) },
];