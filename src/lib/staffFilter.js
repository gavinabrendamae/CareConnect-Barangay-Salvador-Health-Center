import { supabase } from './supabase';

const STAFF_ROLES = ['bhw', 'midwife', 'doctor', 'admin'];
let cache = { at: 0, ids: [], emails: [] };

async function staffInfo() {
  if (Date.now() - cache.at < 30000) return cache;
  const { data } = await supabase.from('profiles').select('id, email').in('role', STAFF_ROLES);
  cache = {
    at: Date.now(),
    ids: (data ?? []).map((r) => r.id),
    emails: (data ?? []).map((r) => (r.email ?? '').trim()).filter((e) => e && !/["(),]/.test(e)),
  };
  return cache;
}

export async function staffOr() {
  const { ids, emails } = await staffInfo();
  return { ids, emails };
}
export function noStaff(query, so) {
  if (!so) return query;
  let q = query;
  if (so.ids?.length) q = q.or(`profile_id.is.null,profile_id.not.in.(${so.ids.join(',')})`);
  if (so.emails?.length) q = q.or(`email.is.null,email.not.in.(${so.emails.map((e) => `"${e}"`).join(',')})`);
  return q;
}