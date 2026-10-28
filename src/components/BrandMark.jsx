import { useEffect, useState } from 'react';

const SIZE = 54;
let cached = null; // processed logo (data URL) is made once and reused

// Removes the white square around the seal: only white pixels connected to the picture's edge become transparent,
// so white parts inside the seal stay as they are.
function removeWhiteBackground(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const w = img.naturalWidth, h = img.naturalHeight;
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const im = ctx.getImageData(0, 0, w, h);
        const d = im.data;
        const isWhite = (p) => d[p + 3] > 0 && d[p] > 232 && d[p + 1] > 232 && d[p + 2] > 232;
        const seen = new Uint8Array(w * h);
        const stack = [];
        const push = (x, y) => { const i = y * w + x; if (!seen[i] && isWhite(i * 4)) { seen[i] = 1; stack.push(i); } };
        for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
        for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
        while (stack.length) {
          const i = stack.pop(); const x = i % w, y = (i / w) | 0;
          if (x > 0) push(x - 1, y); if (x < w - 1) push(x + 1, y);
          if (y > 0) push(x, y - 1); if (y < h - 1) push(x, y + 1);
        }
        for (let i = 0; i < seen.length; i++) if (seen[i]) d[i * 4 + 3] = 0;
        // soften the edge: light pixels touching the removed area become half-transparent (no white halo)
        for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
          const i = y * w + x;
          if (seen[i] || d[i * 4 + 3] === 0) continue;
          if (seen[i - 1] || seen[i + 1] || seen[i - w] || seen[i + w]) {
            const lum = (d[i * 4] + d[i * 4 + 1] + d[i * 4 + 2]) / 3;
            if (lum > 190) d[i * 4 + 3] = Math.max(0, Math.round(255 * (255 - lum) / 65));
          }
        }
        ctx.putImageData(im, 0, 0);
        resolve(c.toDataURL('image/png'));
      } catch (e) { reject(e); }
    };
    img.onerror = reject;
    img.src = src;
  });
}

// Uses the Barangay Salvador seal (public/Resources/Logo.png); falls back to the old heart icon if the image file is missing.
export default function BrandMark() {
  const url = `${import.meta.env.BASE_URL}Resources/Logo.png`;
  const [src, setSrc] = useState(cached ?? url);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (cached) return undefined;
    let alive = true;
    removeWhiteBackground(url).then((d) => { cached = d; if (alive) setSrc(d); }).catch(() => {});
    return () => { alive = false; };
  }, [url]);

  if (failed) return <span className="brand-mark"><i className="bi bi-heart-pulse-fill" /></span>;
  return (
    <img
      className="brand-logo"
      src={src}
      alt="Barangay Salvador logo"
      style={{ width: SIZE, height: SIZE }}
      onError={() => { if (src !== url) setSrc(url); else setFailed(true); }}
    />
  );
}