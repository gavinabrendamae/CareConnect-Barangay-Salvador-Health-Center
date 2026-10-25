import { fullName } from './format.js';
import { bday, fullAddress, newForm, signRole } from './formPdf.js';

export async function exportLabRequestPDF({ patient, clinic, clinicAddress, symptoms, tests, notes, midwife, midwifeRole, mode = 'save', win = null }) {
  const f = await newForm('LABORATORY REQUEST FORM');
  const { doc, W, M, st } = f;
  const inner = W - 2 * M;

  f.line([
    { label: 'Date', value: bday(new Date().toISOString()), x: M, w: 170 },
    { label: 'Referred to (Hospital / Clinic)', value: clinic, x: M + 190, w: inner - 190 },
  ]);
  f.line([{ label: 'Address of the hospital / clinic', value: clinicAddress, x: M + 190, w: inner - 190 }]);

  f.section('PATIENT');
  f.full('Name', fullName(patient));
  f.line([
    { label: 'Birthday', value: bday(patient.birth_date), x: M, w: 200 },
    { label: 'Sex', value: patient.gender, x: M + 215, w: 110 },
    { label: 'Medical ID', value: patient.medical_id, x: M + 340, w: inner - 340 },
  ]);
  f.full('Address', fullAddress(patient));
  f.full('Contact number', patient.contact_number);

  f.section('CLINICAL SUMMARY');
  f.full('Symptoms of patient', symptoms);

  f.section('LABORATORY TEST REQUEST');
  doc.setFont('helvetica', 'normal'); doc.setFontSize(14);
  tests.forEach((t) => { f.ensure(26); doc.text(`•  ${t}`, M + 10, st.y); st.y += 26; });

  if (notes) {
    f.section('NOTES');
    doc.setFont('helvetica', 'normal'); doc.setFontSize(13);
    const lines = doc.splitTextToSize(notes, inner);
    f.ensure(lines.length * 18 + 10);
    doc.text(lines, M, st.y); st.y += lines.length * 18;
  }

  st.y += 24;
  f.signatures(midwife, `Attending ${signRole(midwifeRole)}`, fullName(patient), 'Patient signature over printed name');
  f.footer();
  if (mode === 'print') {
    doc.autoPrint();
    const url = doc.output('bloburl');
    if (win && !win.closed) win.location.href = url; else window.open(url, '_blank');
    return;
  }
  doc.save(`lab_request_${fullName(patient).replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`);
}