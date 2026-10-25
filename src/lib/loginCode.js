import { supabase } from './supabase';

export const manilaToday = () => new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10);

async function call(body) {
  const { data, error } = await supabase.functions.invoke('login-verify', { body });
  if (error) {
    let msg = error.message;
    try { const j = await error.context.json(); if (j?.error) msg = j.error; } catch { /* keep default */ }
    throw new Error(msg);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}
export const sendLoginCode = () => call({ action: 'send' });
export const verifyLoginCode = (code) => call({ action: 'verify', code });