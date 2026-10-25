export const SYMPTOM_CATEGORIES = [
  'Lagnat', 'Ubo', 'Sipon / Barado ang ilong', 'Sakit ng lalamunan', 'Sakit ng ulo', 'Pagkahilo',
  'Pananakit ng katawan', 'Hirap huminga / Hika', 'Pagtatae', 'Pagsusuka / Nausea', 'Sakit ng tiyan',
  'Pantal / Allergy', 'Sugat / Injury', 'Mataas na BP', 'Sakit ng ngipin', 'Sakit ng mata',
  'Buntis / Prenatal', 'Regular check-up', 'Iba pa',
];

const KEYWORDS = [
  ['Lagnat', ['lagnat', 'fever', 'mainit ang katawan', 'nilalagnat']],
  ['Ubo', ['ubo', 'cough']],
  ['Sipon / Barado ang ilong', ['sipon', 'barado', 'runny', 'colds']],
  ['Sakit ng lalamunan', ['lalamunan', 'sore throat']],
  ['Sakit ng ulo', ['sakit ng ulo', 'masakit ang ulo', 'headache', 'migraine']],
  ['Pagkahilo', ['hilo', 'dizzy', 'nahihilo']],
  ['Hirap huminga / Hika', ['hirap huminga', 'hika', 'asthma', 'hingal', 'shortness of breath']],
  ['Pagtatae', ['pagtatae', 'tumatae', 'diarrhea', 'lbm', 'loose bowel']],
  ['Pagsusuka / Nausea', ['suka', 'vomit', 'nausea', 'nasusuka']],
  ['Sakit ng tiyan', ['tiyan', 'sikmura', 'stomach', 'abdominal']],
  ['Pantal / Allergy', ['pantal', 'allergy', 'allergic', 'rash', 'makati', 'kati']],
  ['Sugat / Injury', ['sugat', 'hiwa', 'injury', 'kagat', 'napaso', 'natusok']],
  ['Mataas na BP', ['mataas ang bp', 'high blood', 'hypertension', 'highblood']],
  ['Sakit ng ngipin', ['ngipin', 'toothache']],
  ['Sakit ng mata', ['mata', 'eye']],
  ['Pananakit ng katawan', ['masakit ang katawan', 'body pain', 'pananakit', 'muscle', 'likod', 'back pain', 'ngalay', 'manhid']],
  ['Buntis / Prenatal', ['buntis', 'prenatal', 'pregnan']],
  ['Regular check-up', ['check-up', 'checkup', 'check up', 'follow up', 'follow-up']],
];

export function guessCategories(text) {
  const t = (text ?? '').toLowerCase();
  if (!t.trim()) return [];
  const hits = KEYWORDS.filter(([, words]) => words.some((w) => t.includes(w))).map(([c]) => c);
  return SYMPTOM_CATEGORIES.filter((c) => hits.includes(c));
}

export const joinCategories = (arr) => arr.join(', ');
export const splitCategories = (s) => (s ? s.split(',').map((x) => x.trim()).filter(Boolean) : []);

export const guessCategory = (text) => joinCategories(guessCategories(text));