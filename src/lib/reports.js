import { supabase } from './supabase';
import { staffOr, noStaff } from './staffFilter.js';
import { calcAge, formatDate, fullName } from './format.js';
import { splitCategories } from './symptoms.js';
import { fetchSymptomTrends } from './trends.js';

export const BARANGAY_NAME = 'Barangay Salvador Health Center';

export const REPORT_TYPES = [
  { key: 'morbidity', label: 'Morbidity & Consultation Report', note: 'Top diagnoses, complaints and consultation log (for Barangay / LGU / DOH).' },
  { key: 'medicines', label: 'Medicine Inventory & Dispensing Report', note: 'Current stock, FEFO batches, expiring items and quantities dispensed in the period.' },
  { key: 'immunization', label: 'Immunization Report', note: 'Vaccines scheduled, given and missed in the period, per vaccine and per patient.' },
  { key: 'trends', label: 'Monthly Symptom Trends', note: 'Cases per symptom for every month in the period, with a line graph for each symptom.' },
  { key: 'residents', label: 'Resident Masterlist', note: 'Registered residents with totals per purok and per patient type.' },
];

async function fetchAll(build) {
  const size = 1000;
  let out = [];
  for (let from = 0; ; from += size) {
    const { data, error } = await build().range(from, from + size - 1);
    if (error) throw new Error(error.message);
    out = out.concat(data ?? []);
    if (!data || data.length < size) break;
  }
  return out;
}

const tally = (values) => {
  const m = {};
  values.forEach((v) => { const k = (v ?? '').toString().trim() || '(none)'; m[k] = (m[k] || 0) + 1; });
  return Object.entries(m).sort((a, b) => b[1] - a[1]);
};

const dayStart = (d) => new Date(`${d}T00:00:00`).toISOString();
const dayEnd = (d) => new Date(`${d}T23:59:59.999`).toISOString();

export async function buildReport(type, from, to) {
  const period = `${formatDate(from)} – ${formatDate(to)}`;

  if (type === 'morbidity') {
    const rows = await fetchAll(() => supabase.from('consultations')
      .select('consulted_at, complaint, symptom_category, diagnosis, patient:patients(first_name, middle_name, last_name, suffix, birth_date, gender, purok)')
      .gte('consulted_at', dayStart(from)).lte('consulted_at', dayEnd(to)).order('consulted_at'));
    return {
      title: 'Morbidity & Consultation Report', subtitle: period, filename: `morbidity_${from}_${to}`,
      sections: [
        { heading: 'Summary', columns: ['Item', 'Count'], rows: [['Total consultations', rows.length], ['Unique patients', new Set(rows.map((r) => fullName(r.patient))).size]] },
        { heading: 'Top diagnoses', columns: ['Diagnosis', 'Cases'], rows: tally(rows.map((r) => r.diagnosis?.toLowerCase())) },
        { heading: 'Top complaints / symptoms', columns: ['Complaint', 'Cases'], rows: tally(rows.flatMap((r) => (r.symptom_category ? splitCategories(r.symptom_category) : [r.complaint]).map((x) => x?.toLowerCase()))).slice(0, 15) },
        { heading: 'Cases per purok', columns: ['Purok', 'Cases'], rows: tally(rows.map((r) => r.patient?.purok)) },
        {
          heading: 'Consultation log', columns: ['Date', 'Patient', 'Age', 'Sex', 'Purok', 'Complaint', 'Diagnosis'],
          rows: rows.map((r) => [formatDate(r.consulted_at), fullName(r.patient), calcAge(r.patient?.birth_date), r.patient?.gender ?? '', r.patient?.purok ?? '', r.complaint ?? '', r.diagnosis ?? '']),
        },
      ],
    };
  }

  if (type === 'trends') {
    const { months, series } = await fetchSymptomTrends(from, to, 12);
    return {
      title: 'Monthly Symptom Trends', subtitle: period, filename: `symptom_trends_${from}_${to}`,
      sections: [
        {
          heading: 'Cases per symptom per month', columns: ['Symptom', ...months.map((m) => m.full), 'Total'],
          rows: series.map((s) => [s.name.replace(/\b\w/g, (c) => c.toUpperCase()), ...s.values, s.total]),
        },
        { heading: 'Line graph per symptom', columns: ['Symptom', 'Total'], rows: [], chart: { months, series } },
      ],
    };
  }

  if (type === 'medicines') {
    const [stock, batches, rx] = await Promise.all([
      fetchAll(() => supabase.from('public_medicine_stock').select('*').order('name')),
      fetchAll(() => supabase.from('medicine_batches').select('batch_no, quantity, expiration_date, medicine:medicines(name, unit)').gt('quantity', 0).order('expiration_date')),
      fetchAll(() => supabase.from('prescriptions').select('quantity, created_at, medicine:medicines(name, unit)')
        .gte('created_at', dayStart(from)).lte('created_at', dayEnd(to))),
    ]);
    const used = {};
    rx.forEach((r) => { const k = r.medicine?.name ?? 'Unknown'; used[k] = { qty: (used[k]?.qty || 0) + r.quantity, unit: r.medicine?.unit ?? '' }; });
    return {
      title: 'Medicine Inventory & Dispensing Report', subtitle: `Dispensing period: ${period}`, filename: `medicines_${from}_${to}`,
      sections: [
        { heading: 'Current stock (unexpired)', columns: ['Medicine', 'Category', 'Available', 'Status'], rows: stock.map((s) => [s.name, s.category ?? '', `${s.available_quantity} ${s.unit}`, s.status]) },
        { heading: 'Batches on hand (FEFO order)', columns: ['Medicine', 'Batch no.', 'Qty left', 'Expiration'], rows: batches.map((b) => [b.medicine?.name ?? '', b.batch_no ?? '—', `${b.quantity} ${b.medicine?.unit ?? ''}`, formatDate(b.expiration_date)]) },
        { heading: 'Dispensed in period', columns: ['Medicine', 'Total dispensed'], rows: Object.entries(used).sort((a, b) => b[1].qty - a[1].qty).map(([n, u]) => [n, `${u.qty} ${u.unit}`]) },
      ],
    };
  }

  if (type === 'immunization') {
    const rows = await fetchAll(() => supabase.from('vaccinations')
      .select('vaccine_name, dose_label, scheduled_date, administered_date, status, patient:patients(first_name, middle_name, last_name, suffix, birth_date, purok, patient_type)')
      .gte('scheduled_date', from).lte('scheduled_date', to).order('scheduled_date'));
    const per = {};
    rows.forEach((r) => {
      per[r.vaccine_name] = per[r.vaccine_name] || { scheduled: 0, administered: 0, missed: 0 };
      per[r.vaccine_name][r.status]++;
    });
    return {
      title: 'Immunization Report', subtitle: period, filename: `immunization_${from}_${to}`,
      sections: [
        { heading: 'Per vaccine', columns: ['Vaccine', 'Pending', 'Given', 'Missed'], rows: Object.entries(per).map(([n, c]) => [n, c.scheduled, c.administered, c.missed]) },
        {
          heading: 'Details', columns: ['Scheduled', 'Patient', 'Age', 'Purok', 'Type', 'Vaccine', 'Status', 'Given on'],
          rows: rows.map((r) => [formatDate(r.scheduled_date), fullName(r.patient), calcAge(r.patient?.birth_date), r.patient?.purok ?? '', r.patient?.patient_type ?? '',
            `${r.vaccine_name}${r.dose_label ? ` (${r.dose_label})` : ''}`, r.status, formatDate(r.administered_date)]),
        },
      ],
    };
  }

  const so = await staffOr();
  const rows = await fetchAll(() => noStaff(supabase.from('patients')
    .select('medical_id, first_name, middle_name, last_name, suffix, birth_date, gender, purok, patient_type, contact_number').order('last_name'), so));
  return {
    title: 'Resident Masterlist', subtitle: `As of ${formatDate(new Date().toISOString())}`, filename: `residents_${to}`,
    sections: [
      {
        heading: 'Masterlist', columns: ['Medical ID', 'Name', 'Age', 'Sex', 'Purok', 'Type', 'Contact'],
        rows: rows.map((r) => [r.medical_id ?? '', fullName(r), calcAge(r.birth_date), r.gender ?? '', r.purok ?? '', r.patient_type ?? '', r.contact_number ?? '']),
      },
      { heading: 'Totals', columns: ['Item', 'Count'], rows: [['Registered residents', rows.length]] },
      { heading: 'Per purok', columns: ['Purok', 'Residents'], rows: tally(rows.map((r) => r.purok)) },
      { heading: 'Per patient type', columns: ['Type', 'Residents'], rows: tally(rows.map((r) => r.patient_type)) },
    ],
  };
}

function drawTrendCharts(doc, { months, series }, startY) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const cols = 2; const gap = 20; const cw = (pageW - 80 - gap * (cols - 1)) / cols; const ch = 200;
  let y = startY;
  if (series.length === 0) { doc.setFont('helvetica', 'normal'); doc.setFontSize(12); doc.text('No records.', 40, y + 10); return y + 24; }
  series.forEach((s, i) => {
    const col = i % cols;
    if (col === 0 && i > 0) y += ch + 14;
    if (col === 0 && y + ch > pageH - 50) { doc.addPage(); y = 40; }
    const x0 = 40 + col * (cw + gap);
    const L = x0 + 28; const R = x0 + cw - 8; const T = y + 30; const B = y + ch - 26;
    const yMax = Math.max(2, ...s.values);
    const yMaxN = yMax <= 4 ? yMax : Math.ceil(yMax / 2) * 2;
    doc.setDrawColor(225, 233, 228); doc.setLineWidth(0.5);
    doc.roundedRect(x0, y, cw, ch, 4, 4);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(40, 55, 48);
    doc.text(s.name.replace(/\b\w/g, (c) => c.toUpperCase()), x0 + 10, y + 16);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.setTextColor(100, 115, 108);
    doc.text(`${s.total} total`, x0 + cw - 10, y + 17, { align: 'right' });
    const ticks = yMaxN <= 4 ? Array.from({ length: yMaxN + 1 }, (_, k) => k) : [0, yMaxN / 2, yMaxN];
    const py = (v) => T + (1 - v / yMaxN) * (B - T);
    ticks.forEach((t) => {
      doc.setDrawColor(227, 234, 230); doc.line(L, py(t), R, py(t));
      doc.setFontSize(10); doc.text(String(t), L - 4, py(t) + 2, { align: 'right' });
    });
    const n = months.length;
    const px = (k) => (n === 1 ? (L + R) / 2 : L + (k / (n - 1)) * (R - L));
    const step = n > 8 ? 2 : 1;
    months.forEach((m, k) => { if (k % step === 0 || k === n - 1) doc.text(m.label, px(k), B + 15, { align: 'center' }); });
    doc.setDrawColor(42, 120, 214); doc.setLineWidth(1.8);
    for (let k = 1; k < n; k++) doc.line(px(k - 1), py(s.values[k - 1]), px(k), py(s.values[k]));
    doc.setFillColor(42, 120, 214);
    s.values.forEach((v, k) => doc.circle(px(k), py(v), 2.6, 'F'));
    doc.setTextColor(40, 55, 48); doc.setFontSize(10);
    s.values.forEach((v, k) => { if (v > 0) doc.text(String(v), px(k), py(v) - 5, { align: 'center' }); });
    doc.setTextColor(0, 0, 0); doc.setLineWidth(0.5);
  });
  return y + ch + 24;
}

export async function exportPDF(report, preparedBy) {
  const [pdfMod, tableMod] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const JsPDF = pdfMod.jsPDF ?? pdfMod.default?.jsPDF ?? pdfMod.default;
  const autoTable = tableMod.default?.default ?? tableMod.default ?? tableMod.autoTable;
  const doc = new JsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const w = doc.internal.pageSize.getWidth();

  doc.setFont('helvetica', 'bold'); doc.setFontSize(19);
  doc.text(BARANGAY_NAME.toUpperCase(), w / 2, 44, { align: 'center' });
  doc.setFontSize(16); doc.text(report.title, w / 2, 66, { align: 'center' });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(13);
  doc.text(report.subtitle, w / 2, 85, { align: 'center' });

  let y = 108;
  report.sections.forEach((s) => {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(15);
    if (y > doc.internal.pageSize.getHeight() - 110) { doc.addPage(); y = 40; }
    doc.text(s.heading, 40, y);
    if (s.chart) { y = drawTrendCharts(doc, s.chart, y + 10); return; }
    autoTable(doc, {
      startY: y + 6, head: [s.columns], body: s.rows.length ? s.rows.map((r) => r.map(String)) : [[{ content: 'No records.', colSpan: s.columns.length }]],
      styles: { fontSize: 10.5, cellPadding: 4 }, headStyles: { fillColor: [12, 76, 138], fontSize: 11 }, margin: { left: 40, right: 40 },
    });
    y = doc.lastAutoTable.finalY + 28;
  });

  if (y > doc.internal.pageSize.getHeight() - 110) { doc.addPage(); y = 40; }
  doc.setFont('helvetica', 'normal'); doc.setFontSize(12);
  doc.text(`Prepared by: ${preparedBy}`, 40, y + 20);
  doc.text('______________________________', 40, y + 52);
  doc.text('Noted by: Punong Barangay', 40, y + 68);
  doc.setFontSize(10);
  doc.text(`Generated ${new Date().toLocaleString('en-PH')} via CareConnect`, 40, y + 90);

  const pages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i); doc.setFontSize(10);
    doc.text(`Page ${i} of ${pages}`, w - 40, doc.internal.pageSize.getHeight() - 20, { align: 'right' });
  }
  doc.save(`${report.filename}.pdf`);
}

export async function exportExcel(report) {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();
  const used = new Set();
  report.sections.filter((s) => !s.chart).forEach((s, i) => {
    const aoa = [[BARANGAY_NAME], [report.title], [report.subtitle], [], s.columns, ...s.rows];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = s.columns.map((c, ci) => ({ wch: Math.min(40, Math.max(String(c).length, ...s.rows.slice(0, 200).map((r) => String(r[ci] ?? '').length)) + 2) }));
    let name = s.heading.replace(/[\\/?*[\]:]/g, ' ').slice(0, 28) || `Sheet${i + 1}`;
    while (used.has(name.toLowerCase())) name = `${name.slice(0, 25)}_${i + 1}`;
    used.add(name.toLowerCase());
    XLSX.utils.book_append_sheet(wb, ws, name);
  });
  XLSX.writeFile(wb, `${report.filename}.xlsx`);
}