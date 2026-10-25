import { supabase } from './supabase';

async function call(body) {
  const { data, error } = await supabase.functions.invoke('email-code', { body });
  if (error) {
    let msg = error.message;
    try { const j = await error.context.json(); if (j?.error) msg = j.error; } catch { /* keep default message */ }
    throw new Error(msg);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

export const sendCode = (email) => call({ action: 'send', email });
export const registerWithCode = (payload) => call({ action: 'register', ...payload });