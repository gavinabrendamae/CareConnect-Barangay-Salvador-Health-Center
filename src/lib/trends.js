import { supabase } from './supabase';
import { splitCategories } from './symptoms.js';

const pad = (n) => String(n).padStart(2, '0');
export const monthKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;

export function monthRange(fromISO, toISO) {
  const a = new Date(`${fromISO.slice(0, 7)}-01T00:00:00`);
  const b = new Date(`${toISO.slice(0, 7)}-01T00:00:00`);
  const out = [];
  for (let d = new Date(a); d <= b && out.length < 24; d.setMonth(d.getMonth() + 1)) {
    out.push({
      key: monthKey(d),
      label: d.toLocaleDateString('en-PH', { month: 'short' }),
      full: d.toLocaleDateString('en-PH', { month: 'short', year: 'numeric' }),
    });
  }
  return out;
}

export function firstOfMonthsAgo(n) {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - n);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`;
}

export async function fetchSymptomTrends(fromISO, toISO, top = 6) {
  const months = monthRange(fromISO, toISO);
  let rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('consultations').select('consulted_at, complaint, symptom_category')
      .gte('consulted_at', new Date(`${fromISO}T00:00:00`).toISOString())
      .lte('consulted_at', new Date(`${toISO}T23:59:59.999`).toISOString())
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    rows = rows.concat(data ?? []);
    if (!data || data.length < 1000) break;
  }
  const idx = Object.fromEntries(months.map((m, i) => [m.key, i]));
  const map = {};
  rows.forEach((r) => {
    const i = idx[monthKey(new Date(r.consulted_at))];
    if (i === undefined) return;
    const names = r.symptom_category ? splitCategories(r.symptom_category) : [(r.complaint ?? '').trim().toLowerCase()];
    names.filter(Boolean).forEach((n) => {
      (map[n] ??= Array(months.length).fill(0))[i] += 1;
    });
  });
  const series = Object.entries(map)
    .map(([name, values]) => ({ name, values, total: values.reduce((a, b) => a + b, 0) }))
    .sort((a, b) => b.total - a.total)
    .slice(0, top);
  return { months, series };
}