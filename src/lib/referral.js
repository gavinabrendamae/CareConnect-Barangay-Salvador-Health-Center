import { fullName } from './format.js';
import { bday, calcAge, fullAddress, newForm, signRole } from './formPdf.js';

export const FAMILY_ILLNESSES = ['High blood pressure', 'Diabetes', 'Heart disease', 'Stroke', 'Asthma', 'Tuberculosis', 'Kidney disease', 'Cancer', 'Others'];

export async function exportReferralPDF({ patient, vitals, referral, referredBy, referredRole }) {
  const f = await newForm('REFERRAL FORM');
  const { doc, W, M, st } = f;
  const d = referral.details ?? {};
  const inner = W - 2 * M;

  f.line([
    { label: 'Date', value: bday(referral.created_at ?? new Date().toISOString()), x: M, w: 118 },
    { label: 'Referred to (Hospital / Clinic)', value: referral.hospital, x: M + 130, w: inner - 130 },
  ]);

  f.section('PATIENT');
  f.line([
    { label: 'Name', value: fullName(patient), x: M, w: 250 },
    { label: 'Birthday', value: bday(patient.birth_date), x: M + 265, w: 150 },
    { label: 'Age', value: calcAge(patient.birth_date), x: M + 430, w: inner - 430 },
  ]);
  f.line([
    { label: 'Medical ID', value: patient.medical_id, x: M, w: 165 },
    { label: 'Sex', value: patient.gender, x: M + 180, w: 95 },
    { label: 'Contact number', value: patient.contact_number, x: M + 290, w: inner - 290 },
  ]);
  f.full('Address', fullAddress(patient));
  f.line([
    { label: 'Name of Spouse / Guardian', value: d.spouse_name, x: M, w: 320 },
    { label: 'Birthday', value: bday(d.spouse_birth), x: M + 335, w: inner - 335 },
  ]);

  f.section('CLINICAL SUMMARY');
  f.full('Diagnosis', referral.diagnosis);
  f.full('Laboratory findings', referral.clinical_summary);
  f.full('Reason for referral', referral.reason);
  f.full('Symptoms seen', d.symptoms);
  if (referral.treatment_given) f.full('Treatment given', referral.treatment_given);

  f.section('VITALS');
  const v = vitals || {};
  const bp = v.bp_systolic ? `${v.bp_systolic}/${v.bp_diastolic}` : '';
  f.line([
    { label: 'BP', value: bp, x: M, w: 95 },
    { label: 'Temp', value: v.temperature_c ? `${v.temperature_c} °C` : '', x: M + 100, w: 90 },
    { label: 'Pulse', value: v.pulse_rate ?? '', x: M + 200, w: 80 },
    { label: 'Weight', value: v.weight_kg ? `${v.weight_kg} kg` : '', x: M + 290, w: 105 },
    { label: 'Height', value: v.height_cm ? `${v.height_cm} cm` : '', x: M + 405, w: inner - 405 },
  ]);

  doc.addPage(); st.y = 50; 
  doc.setFont('helvetica', 'bold'); doc.setFontSize(13);
  doc.text('Are you a member of PhilHealth?', M, st.y);
  f.checkbox(M + 250, st.y, d.philhealth === 'yes'); doc.setFont('helvetica', 'normal'); doc.text('Yes', M + 267, st.y);
  f.checkbox(M + 312, st.y, d.philhealth === 'no'); doc.text('No', M + 329, st.y);
  st.y += 26;

  f.ensure(60);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(13);
  doc.text('History of the family to the following illness:', M, st.y); st.y += 10;
  const c1 = inner * 0.5; const c2 = inner * 0.25;
  const rowH = 22;
  const drawRow = (a, b, c, bold) => {
    f.ensure(rowH + 4);
    doc.setLineWidth(0.7); doc.rect(M, st.y, c1, rowH); doc.rect(M + c1, st.y, c2, rowH); doc.rect(M + c1 + c2, st.y, c2, rowH);
    doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(12);
    doc.text(a, M + 6, st.y + 15);
    if (bold) { doc.text(b, M + c1 + c2 / 2, st.y + 15, { align: 'center' }); doc.text(c, M + c1 + c2 + c2 / 2, st.y + 15, { align: 'center' }); }
    st.y += rowH;
  };
  drawRow('Illness', 'Yes', 'No', true);
  FAMILY_ILLNESSES.forEach((ill) => {
    const val = d.family?.[ill];
    const y0 = st.y;
    drawRow(ill, '', '', false);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(13);
    if (val === 'yes') doc.text('X', M + c1 + c2 / 2, y0 + 16, { align: 'center' });
    if (val === 'no') doc.text('X', M + c1 + c2 + c2 / 2, y0 + 16, { align: 'center' });
  });

  st.y += 24;
  f.signatures(referredBy, `Attending ${signRole(referredRole)}`, fullName(patient), 'Patient Name');
  f.footer();
  doc.save(`referral_${fullName(patient).replace(/\s+/g, '_')}_${(referral.created_at ?? new Date().toISOString()).slice(0, 10)}.pdf`);
}