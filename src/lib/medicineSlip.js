import { supabase } from './supabase';

export async function downloadMedicineSlip(requestId) {
  const { data, error } = await supabase.functions.invoke('medicine-notify', { body: { request_id: requestId, download: true } });
  if (error) {
    let text = error.message;
    try { const j = await error.context.json(); if (j?.error) text = j.error; } catch { /* keep message */ }
    throw new Error(text);
  }
  const bin = atob(data.pdf_base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
  const a = document.createElement('a');
  a.href = url; a.download = data.filename || 'medicine_request.pdf';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}