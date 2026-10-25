import { calcAge, formatDate } from './format.js';

export const CLINIC_NAME = 'BARANGAY SALVADOR HEALTH CENTER';
export const CLINIC_PLACE = 'Salvador, Santiago City 3311';

export function fullAddress(p) {
  const parts = [p?.address, p?.purok].filter(Boolean).map((x) => String(x).trim());
  const joined = parts.join(', ');
  return /salvador/i.test(joined) ? joined : [...parts, 'Salvador', 'Santiago City'].join(', ');
}

export const signRole = (r) => (!r || r === 'Super Admin' ? 'Midwife' : r);
export const bday = (d) => (d ? formatDate(d) : '');
export { calcAge };

export async function newForm(title) {
  const pdfMod = await import('jspdf');
  const JsPDF = pdfMod.jsPDF ?? pdfMod.default?.jsPDF ?? pdfMod.default;
  const doc = new JsPDF({ unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 46;
  const st = { y: 38 };
  const ink = () => { doc.setTextColor(20, 25, 30); doc.setDrawColor(40, 45, 50); };

  ink();
  doc.setFont('helvetica', 'bold'); doc.setFontSize(18);
  doc.text(CLINIC_NAME, W / 2, st.y, { align: 'center' }); st.y += 19;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(13);
  doc.text(CLINIC_PLACE, W / 2, st.y, { align: 'center' }); st.y += 26;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(19);
  doc.text(title, W / 2, st.y, { align: 'center' }); st.y += 12;
  doc.setLineWidth(1.2); doc.line(M, st.y, W - M, st.y); st.y += 22;

  const ensure = (h) => { if (st.y + h > H - 34) { doc.addPage(); st.y = 50; } };

  const line = (items, gap = 12) => {
    ensure(52);
    let used = 0;
    items.forEach(({ label, value, x, w }) => {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(95, 105, 115);
      doc.text(label, x, st.y);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(13.5); ink();
      const lines = doc.splitTextToSize(String(value ?? '') || '—', w - 6);
      doc.text(lines, x, st.y + 17);
      used = Math.max(used, 17 + lines.length * 17);
    });
    st.y += used + gap;
  };
  const full = (label, value) => line([{ label, value, x: M, w: W - 2 * M }]);
  const section = (text) => {
    ensure(50);
    st.y += 8;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.setTextColor(31, 122, 77); doc.setDrawColor(31, 122, 77);
    doc.text(text, M, st.y);
    doc.setLineWidth(1.2); doc.line(M, st.y + 6, W - M, st.y + 6);
    ink(); st.y += 27;
  };
  const checkbox = (x, y, on) => {
    doc.setLineWidth(0.8); doc.rect(x, y - 9, 11, 11);
    if (on) { doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.text('X', x + 2.4, y); }
  };
  const signatures = (leftName, leftRole, rightName, rightRole) => {
    ensure(56);
    st.y += 26;
    doc.setLineWidth(0.7);
    doc.line(M, st.y, M + 200, st.y); doc.line(W - M - 210, st.y, W - M, st.y);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(13);
    doc.text(leftName || '', M + 100, st.y - 4, { align: 'center' });
    doc.text(rightName || '', W - M - 105, st.y - 4, { align: 'center' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(12);
    doc.text(leftRole, M + 100, st.y + 14, { align: 'center' });
    doc.text(rightRole, W - M - 105, st.y + 14, { align: 'center' });
    st.y += 30;
  };
  const footer = () => {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(120, 125, 130);
    doc.text(`Generated ${new Date().toLocaleString('en-PH')} via CareConnect`, W - M, H - 24, { align: 'right' });
  };
  return { doc, W, H, M, st, line, full, section, checkbox, signatures, ensure, footer };
}