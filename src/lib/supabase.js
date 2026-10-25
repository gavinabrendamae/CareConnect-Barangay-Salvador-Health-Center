import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isConfigured = Boolean(url && key);

const memory = {};
const sessionStore = {
  getItem: (k) => { try { return window.sessionStorage.getItem(k); } catch { return memory[k] ?? null; } },
  setItem: (k, v) => { try { window.sessionStorage.setItem(k, v); } catch { memory[k] = v; } },
  removeItem: (k) => { try { window.sessionStorage.removeItem(k); } catch { delete memory[k]; } },
};

try {
  Object.keys(window.localStorage).filter((k) => /^sb-.*-auth-token/.test(k)).forEach((k) => window.localStorage.removeItem(k));
} catch { /* storage unavailable */ }

export const supabase = createClient(url || 'http://localhost:54321', key || 'missing-anon-key', {
  auth: { storage: sessionStore, persistSession: true, autoRefreshToken: true },
});

export function createIsolatedClient() {
  return createClient(url || 'http://localhost:54321', key || 'missing-anon-key', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'cc-isolated' },
  });
}