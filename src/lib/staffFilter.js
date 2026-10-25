import { supabase } from './supabase';

const STAFF_ROLES = ['bhw', 'midwife', 'doctor', 'admin'];
let cache = { at: 0, ids: [] };

async function staffProfileIds() {
  if (Date.now() - cache.at < 30000) return cache.ids;
  const { data } = await supabase.from('profiles').select('id').in('role', STAFF_ROLES);
  cache = { at: Date.now(), ids: (data ?? []).map((r) => r.id) };
  return cache.ids;
}

export async function staffOr() {
  const ids = await staffProfileIds();
  return ids.length ? `profile_id.is.null,profile_id.not.in.(${ids.join(',')})` : '';
}
export const noStaff = (query, so) => (so ? query.or(so) : query);