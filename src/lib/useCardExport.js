import { useState } from 'react';

// Print / PDF download (A5 landscape, 8.27 x 5.83 in) for a card element. Same CSS as the immunization card.
export function useCardExport(cardRef, fileName) {
  const [dl, setDl] = useState(false);

  function printCard() {
    const el = cardRef.current;
    el.classList.add('imm-print-target');
    document.body.classList.add('imm-printing');
    const done = () => { el.classList.remove('imm-print-target'); document.body.classList.remove('imm-printing'); window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    window.print();
  }

  async function downloadPdf() {
    setDl(true);
    const el = cardRef.current;
    el.classList.add('imm-exporting');
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')]);
      const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'in', format: [8.27, 5.83] });
      const margin = 0.2;
      const maxW = 8.27 - margin * 2;
      const maxH = 5.83 - margin * 2;
      const ratio = canvas.width / canvas.height;
      let w = maxW; let h = w / ratio;
      if (h > maxH) { h = maxH; w = h * ratio; }
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', (8.27 - w) / 2, (5.83 - h) / 2, w, h);
      pdf.save(fileName);
    } finally {
      el.classList.remove('imm-exporting');
      setDl(false);
    }
  }

  return { printCard, downloadPdf, dl };
}