export const DEPO = 'Depo-Provera (DMPA) injection';

export const CARDS = {
  infant: {
    title: 'CHILD IMMUNIZATION RECORD',
    rows: [
      { name: 'BCG', doses: 1, hint: 'pagkapanganak' },
      { name: 'Hepatitis B', doses: 1, hint: 'pagkapanganak' },
      { name: 'Pentavalent Vaccine', sub: '(DPT-HepB-Hib)', doses: 3, hint: '1½, 2½ & 3½ buwan' },
      { name: 'Oral Polio Vaccine', sub: '(OPV)', doses: 3, hint: '1½, 2½ & 3½ buwan' },
      { name: 'Inactivated Polio Vaccine', sub: '(IPV)', doses: 1, hint: '3½ buwan' },
      { name: 'Pneumococcal Conjugate Vaccine', sub: '(PCV)', doses: 3, hint: '1½, 2½ & 3½ buwan' },
      { name: 'Measles, Mumps, Rubella', sub: '(MMR)', doses: 2, hint: '9 buwan & 1 taon' },
    ],
  },
  child: {
    title: 'CHILD IMMUNIZATION RECORD',
    rows: [],
  },
  adult: {
    title: 'ADULT IMMUNIZATION RECORD',
    rows: [
      { name: 'Human papillomavirus', sub: '(HPV)', doses: 2, hint: '2 doses, 19–26 yrs' },
      { name: 'COVID-19', doses: 2, dosesText: '1+', hint: '1 or more doses of the current formula' },
      { name: 'Influenza', doses: 3, dosesText: '1 / yr', hint: '1 dose annually' },
      { name: 'Tetanus, diphtheria, pertussis', sub: '(Tdap)', doses: 2, hint: 'booster every 10 yrs; 1 dose each pregnancy' },
      { name: 'Measles, mumps, rubella', sub: '(MMR)', doses: 2, hint: '1–2 doses if born after 1957' },
      { name: 'Varicella', sub: '(VAR, chicken pox)', doses: 2, hint: '2 doses if born after 1980' },
      { name: 'Zoster', sub: '(RZV, shingles)', doses: 2, hint: '2 doses, 50+ yrs' },
      { name: 'Respiratory Syncytial Virus', sub: '(RSV)', doses: 1, hint: 'seasonal during pregnancy; 60+ yrs' },
      { name: 'Pneumococcal', doses: 1, hint: '65+ yrs' },
      { name: 'Hepatitis A', doses: 4, dosesText: '2–4', hint: '2, 3 or 4 doses depending on vaccine' },
      { name: 'Hepatitis B', doses: 4, dosesText: '2–4', hint: '2, 3 or 4 doses depending on vaccine' },
    ],
  },
  maternal: {
    title: 'MATERNAL IMMUNIZATION RECORD (PREGNANCY)',
    rows: [
      { name: 'Tetanus, diphtheria, pertussis', sub: '(Tdap)', doses: 1, hint: '1 dose, preferably at 27–36 weeks' },
      { name: 'Influenza (Flu)', doses: 1, hint: 'annual dose, any point in pregnancy' },
      { name: 'COVID-19', doses: 1, hint: 'when recommended' },
      { name: 'Respiratory Syncytial Virus', sub: '(RSV)', doses: 1, hint: '1 dose at 32–36 weeks (RSV season)' },
    ],
  },
};

export function cardKindFor(patient) {
  switch (patient?.patient_type) {
    case 'Infant':
    case 'Infant / Child': return 'infant';
    case 'Child': return 'child';
    case 'Pregnant': return 'maternal';
    case 'Adult':
    case 'Senior Citizen':
    case 'Person with Disability': return 'adult';
    default: return null;
  }
}

export const isYoungKind = (kind) => kind === 'infant' || kind === 'child';