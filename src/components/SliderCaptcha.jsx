import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const W = 320; const H = 170; const BOX = 52; const HANDLE = 48; const TOL = 6;
const PIECE = 'M0,8 H14 C14,0 30,0 30,8 H44 V22 C52,22 52,38 44,38 V52 H0 Z';
const PY = 62;

function Scene() {
  return (
    <g>
      <rect width={W} height={H} fill="url(#sc-sky)" />
      <circle cx="268" cy="38" r="20" fill="#ffe28a" opacity=".95" />
      <ellipse cx="70" cy="34" rx="30" ry="9" fill="#fff" opacity=".85" /><ellipse cx="92" cy="28" rx="20" ry="8" fill="#fff" opacity=".85" />
      <path d={`M0,128 C60,96 110,118 170,104 C230,90 280,112 ${W},100 V${H} H0 Z`} fill="#7fc79a" />
      <path d={`M0,146 C70,124 130,150 200,132 C250,120 290,138 ${W},130 V${H} H0 Z`} fill="#3f9b6e" />
      <rect x="112" y="76" width="96" height="62" rx="4" fill="#f4f8fc" stroke="#0C4C8A" strokeWidth="3" />
      <rect x="150" y="104" width="20" height="34" fill="#2b78b8" />
      <rect x="124" y="88" width="16" height="14" fill="#bcd7ee" /><rect x="180" y="88" width="16" height="14" fill="#bcd7ee" />
      <rect x="153" y="52" width="14" height="30" rx="2" fill="#d94b4b" /><rect x="145" y="60" width="30" height="14" rx="2" fill="#d94b4b" />
      <circle cx="40" cy="120" r="14" fill="#2f8a5e" /><rect x="38" y="128" width="4" height="14" fill="#6b4f34" />
      <circle cx="290" cy="124" r="12" fill="#2f8a5e" /><rect x="288" y="130" width="4" height="12" fill="#6b4f34" />
    </g>
  );
}

export default function SliderCaptcha({ onPass, onCancel }) {
  const drag = useRef(null);
  const [tx, setTx] = useState(() => 130 + Math.round(Math.random() * 120));
  const [x, setX] = useState(0);
  const [state, setState] = useState('idle'); 
  const maxX = W - BOX;
  const slideMax = W - HANDLE;
  const pieceX = (x / slideMax) * maxX;

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  function retry() { setTx(130 + Math.round(Math.random() * 120)); setX(0); setState('idle'); }

  function down(e) {
    if (state === 'ok') return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { start: e.clientX - x, t0: Date.now(), moves: 0 };
    setState('drag');
  }
  function move(e) {
    if (!drag.current) return;
    drag.current.moves += 1;
    setX(Math.max(0, Math.min(slideMax, e.clientX - drag.current.start)));
  }
  function up() {
    if (!drag.current) return;
    const { t0, moves } = drag.current;
    drag.current = null;
    const human = Date.now() - t0 > 350 && moves >= 5;
    if (human && Math.abs(pieceX - tx) <= TOL) {
      setState('ok');
      setTimeout(() => onPass?.(), 700);
    } else {
      setState('fail');
      setTimeout(retry, 600);
    }
  }

  const ok = state === 'ok'; const fail = state === 'fail';
  const accent = ok ? '#1f9d5b' : fail ? '#d64545' : '#0C4C8A';

  return createPortal(
    <>
      <div className="modal fade show d-block" tabIndex="-1" role="dialog" aria-modal="true">
        <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: 400 }}>
          <div className="modal-content" style={{ borderRadius: 18, overflow: 'hidden', border: 0, boxShadow: '0 24px 60px rgba(12,40,80,.35)' }}>
            <div style={{ background: 'linear-gradient(135deg,#0C4C8A,#2b78b8)', color: '#fff', padding: '18px 22px' }}>
              <div className="d-flex align-items-center gap-2">
                <i className="bi bi-shield-check fs-3" />
                <div>
                  <div className="fw-bold" style={{ fontSize: '1.1rem' }}>Security check</div>
                  <div style={{ fontSize: '.85rem', opacity: .9 }}>Drag the slider to fit the puzzle piece</div>
                </div>
              </div>
            </div>
            <div style={{ padding: '20px 22px 8px', background: '#f6f9fd' }}>
              <div style={{ width: W, maxWidth: '100%', margin: '0 auto' }}>
                <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', borderRadius: 12, boxShadow: `0 0 0 3px ${accent}33`, maxWidth: '100%', height: 'auto' }}>
                  <defs>
                    <linearGradient id="sc-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#7cc0f0" /><stop offset="1" stopColor="#e2f3ff" /></linearGradient>
                    <clipPath id="sc-piece"><path d={PIECE} /></clipPath>
                    <filter id="sc-shadow" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="2" stdDeviation="2.5" floodOpacity=".45" /></filter>
                  </defs>
                  <Scene />
                  {/* the gap */}
                  {!ok && <path d={PIECE} transform={`translate(${tx},${PY})`} fill="rgba(10,25,45,.55)" stroke="#fff" strokeWidth="1.5" strokeDasharray="4 3" />}
                  {/* the piece: a cut-out of the picture where the gap is, moved by the slider */}
                  <g transform={`translate(${ok ? tx : pieceX},${PY})`} filter={ok ? undefined : 'url(#sc-shadow)'}>
                    <g clipPath="url(#sc-piece)"><g transform={`translate(${-tx},${-PY})`}><Scene /></g></g>
                    <path d={PIECE} fill="none" stroke={accent} strokeWidth="2" />
                  </g>
                </svg>
                <div className="position-relative mt-3" style={{ height: HANDLE, width: W, maxWidth: '100%', margin: '12px auto 0', borderRadius: HANDLE / 2, background: '#e3ebf5', border: `1px solid ${accent}55`, touchAction: 'none', userSelect: 'none' }}>
                  <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: x + HANDLE / 2, borderRadius: HANDLE / 2, background: `${accent}22` }} />
                  <div className="d-flex align-items-center justify-content-center fw-bold" style={{ position: 'absolute', inset: 0, fontSize: '.85rem', color: ok ? '#17653c' : '#44525e', pointerEvents: 'none' }}>
                    {ok ? 'Verified' : fail ? 'Not quite — try again' : 'Slide to complete the puzzle'}
                  </div>
                  <div onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
                    style={{ position: 'absolute', top: 0, left: x, width: HANDLE, height: HANDLE, borderRadius: '50%', background: accent, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'grab', boxShadow: '0 2px 8px rgba(0,0,0,.3)', touchAction: 'none', transition: state === 'drag' ? 'none' : 'left .3s' }}>
                    <i className={`bi ${ok ? 'bi-check-lg' : 'bi-puzzle-fill'} fs-5`} />
                  </div>
                </div>
              </div>
            </div>
            <div className="d-flex justify-content-between align-items-center" style={{ padding: '10px 22px 16px', background: '#f6f9fd' }}>
              <button type="button" className="btn btn-link btn-sm text-decoration-none p-0" onClick={retry} disabled={ok}><i className="bi bi-arrow-repeat me-1" />New puzzle</button>
              <button type="button" className="btn btn-link btn-sm text-secondary text-decoration-none p-0" onClick={onCancel} disabled={ok}>Cancel</button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show" />
    </>,
    document.body,
  );
}