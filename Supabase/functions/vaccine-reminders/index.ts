// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const defaultDaysAhead = Number(Deno.env.get('REMINDER_DAYS_AHEAD') ?? '3');

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function manilaDate(offsetDays = 0): string {
  const d = new Date(Date.now() + offsetDays * 86400000);
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
}

// 09171234567 -> +639171234567
function toE164(num: string | null): string | null {
  if (!num) return null;
  const n = num.replace(/[\s-]/g, '');
  if (/^09\d{9}$/.test(n)) return `+63${n.slice(1)}`;
  if (/^\+639\d{9}$/.test(n)) return n;
  return null;
}

async function isAllowed(req: Request): Promise<boolean> {
  const auth = req.headers.get('Authorization') ?? '';
  const token = auth.replace(/^Bearer\s+/i, '');
  if (!token) return false;
  if (token === Deno.env.get('CRON_SECRET')) return true;

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return false;
  const { data: prof } = await supabase
    .from('profiles').select('role, is_active').eq('id', data.user.id).maybeSingle();
  return Boolean(prof?.is_active && ['midwife', 'doctor', 'admin'].includes(prof.role));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (!(await isAllowed(req))) return new Response('Unauthorized', { status: 401, headers: cors });

  let daysAhead = defaultDaysAhead;
  try {
    const body = await req.json();
    if (Number.isFinite(Number(body?.days))) daysAhead = Math.min(Math.max(Number(body.days), 0), 30);
  } catch { /* no body (cron) */ }

  const { data: due, error } = await supabase
    .from('vaccinations')
    .select('id, vaccine_name, dose_label, scheduled_date, reminder_sent_at, sms_sent_at, patient:patients(first_name, last_name, email, contact_number)')
    .eq('status', 'scheduled')
    .gte('scheduled_date', manilaDate(0))
    .lte('scheduled_date', manilaDate(daysAhead))
    .or('reminder_sent_at.is.null,sms_sent_at.is.null');

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });
  }

  const smsUser = Deno.env.get('SMSGATE_USER');
  const smsPass = Deno.env.get('SMSGATE_PASSWORD');
  const smsUrl = Deno.env.get('SMSGATE_URL') ?? 'https://api.sms-gate.app/3rdparty/v1/messages';

  let emailSent = 0;
  let smsSent = 0;
  const failed: string[] = [];

  for (const v of due ?? []) {
    const patient = v.patient as { first_name: string; last_name: string; email: string | null; contact_number: string | null } | null;
    if (!patient) continue;
    const dose = v.dose_label ? ` (${v.dose_label})` : '';

    // ── Email ──
    if (!v.reminder_sent_at && patient.email) {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${Deno.env.get('RESEND_API_KEY')}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: Deno.env.get('RESEND_FROM'),
          to: [patient.email],
          subject: `Vaccine reminder: ${v.vaccine_name} on ${v.scheduled_date}`,
          html: `<p>Hello ${patient.first_name},</p>
                 <p>This is a reminder from the Barangay Health Center that your
                 <strong>${v.vaccine_name}${dose}</strong> vaccination is scheduled on
                 <strong>${v.scheduled_date}</strong>.</p>
                 <p>Please bring this reminder and visit the health center on or before that date.</p>
                 <p>— CareConnect</p>`,
        }),
      });
      if (res.ok) {
        await supabase.from('vaccinations').update({ reminder_sent_at: new Date().toISOString() }).eq('id', v.id);
        emailSent++;
      } else {
        failed.push(`email ${v.id}: ${res.status}`);
      }
    }

    // ── SMS ──
    const phone = toE164(patient.contact_number);
    if (!v.sms_sent_at && phone && smsUser && smsPass) {
      const res = await fetch(smsUrl, {
        method: 'POST',
        headers: { Authorization: `Basic ${btoa(`${smsUser}:${smsPass}`)}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          textMessage: {
            text: `CareConnect: Hi ${patient.first_name}, paalala po — ${v.vaccine_name}${dose} ang bakuna ninyo sa ${v.scheduled_date}. Pumunta po sa health center.`,
          },
          phoneNumbers: [phone],
        }),
      });
      if (res.ok) {
        await supabase.from('vaccinations').update({ sms_sent_at: new Date().toISOString() }).eq('id', v.id);
        smsSent++;
      } else {
        failed.push(`sms ${v.id}: ${res.status}`);
      }
    }
  }

  return new Response(JSON.stringify({ checked: due?.length ?? 0, emailSent, smsSent, failed }), {
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
});