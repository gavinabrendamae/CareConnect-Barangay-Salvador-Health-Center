import { useLayoutEffect, useRef, useState } from 'react';

function useWidth(fallback = 480) {
  const ref = useRef(null);
  const [w, setW] = useState(fallback);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const set = () => setW(Math.max(220, Math.round(el.getBoundingClientRect().width)));
    set();
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

export const CHART_COLORS = { blue: '#2b78b8', orange: '#5b6fd6', aqua: '#2a9d8f', violet: '#7a5cc4' };

const LINE_THEMES = [
  { line: '#5b9bd5', edge: '#2e75b6', bg: 'linear-gradient(180deg,#f4f9fe 0%,#b4d1ec 100%)' },
  { line: '#548235', edge: '#548235', bg: 'radial-gradient(circle at 30% 0%,#ffffff 0%,#cfe3c2 50%,#8dbb62 100%)' },
  { line: '#ff3b00', edge: '#e02f00', bg: 'linear-gradient(180deg,#fff4ee 0%,#f6bf9b 100%)' },
  { line: '#1fb5b0', edge: '#128f8b', bg: 'linear-gradient(180deg,#f2fffd 0%,#a6e6e1 100%)' },
  { line: '#e8a317', edge: '#c98300', bg: 'linear-gradient(180deg,#fffaf0 0%,#f6dca0 100%)' },
  { line: '#7a7fd6', edge: '#5b5fb8', bg: 'linear-gradient(180deg,#f6f6ff 0%,#c5c8f0 100%)' },
];

const BAR_COLORS = ['#0099ff', '#33cccc', '#2e75b6', '#00e0b8', '#d9d9d9', '#5b9bd5'];
const INK = '#33433a';
const MUTED = '#44525e';
const GRID = '#e3eae6';
const cap = (s) => String(s).replace(/\b\w/g, (c) => c.toUpperCase());

export function HBarChart({ rows, color = CHART_COLORS.blue, unit = '', empty = 'No data yet.', multi = false, onSelect }) {
  const [hover, setHover] = useState(null);
  const [ref, W] = useWidth();
  if (!rows || rows.length === 0) return <div className="text-secondary">{empty}</div>;
  const LABEL = Math.min(260, Math.round(W * 0.42)); const ROW = 44; const RIGHT = 70;
  const max = Math.max(...rows.map((r) => r[1]), 1);
  const H = rows.length * ROW + 24;
  const plot = W - (multi ? 28 : 0) - LABEL - RIGHT;
  const x = (v) => LABEL + (v / max) * plot;
  return (
    <div ref={ref} style={multi ? { width: '100%', padding: '12px 14px 4px', borderRadius: 8, border: '1px solid #8fd8d2', background: 'linear-gradient(135deg,#43cfcf 0%,#ffffff 45%,#e9fffb 70%,#2effd0 100%)' } : { width: '100%' }}>
    <svg width={W - (multi ? 28 : 0)} height={H} role="img" aria-label="Bar chart" style={{ display: 'block' }}>
      {(max <= 2 ? Array.from({ length: max + 1 }, (_, i) => i) : [0, Math.round(max / 2), max]).map((t) => (
        <g key={t}>
          <line x1={x(t)} x2={x(t)} y1="0" y2={H - 18} stroke={GRID} strokeWidth="1" />
          <text x={x(t)} y={H - 4} fontSize="12" fontWeight="700" fill={MUTED} textAnchor="middle">{t}</text>
        </g>
      ))}
      {rows.map(([label, value], i) => {
        const y = i * ROW + 6;
        const on = hover === i;
        const text = cap(label);
        return (
          <g key={label} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onClick={onSelect ? () => onSelect(label) : undefined} style={{ cursor: onSelect ? 'pointer' : 'default' }}>
            <rect x="0" y={y - 4} width={W} height={ROW - 2} fill={on ? '#f1f6f3' : 'transparent'} rx="4" />
            <text x="0" y={y + 21} fontSize="15" fill="#111" fontWeight="700">{text.length > Math.floor(LABEL / 8.5) ? `${text.slice(0, Math.floor(LABEL / 8.5) - 1)}…` : text}<title>{`${text}: ${value}${unit ? ` ${unit}` : ''}`}</title></text>
            <rect x={LABEL} y={y + 3} width={Math.max(4, x(value) - LABEL)} height="26" rx={multi ? 2 : 5} fill={multi ? BAR_COLORS[i % BAR_COLORS.length] : color} stroke={multi ? '#111' : 'none'} strokeWidth="1.5" opacity={on || hover === null ? 1 : 0.55} />
            <text x={x(value) + 8} y={y + 21} fontSize="15" fontWeight="700" fill={INK}>{value}{unit && ` ${unit}`}</text>
          </g>
        );
      })}
    </svg>
    </div>
  );
}

export function LineChart({ labels, fullLabels, values, color = CHART_COLORS.blue, edge, bg, partialLast = false, height = 260 }) {
  const [hover, setHover] = useState(null);
  const [ref, W] = useWidth(320);
  const H = height; const L = 34; const R = 22; const T = 34; const B = 30;
  const max = Math.max(...values, 0);
  const yMax = max <= 4 ? Math.max(max, 2) : Math.ceil(max / 2) * 2;
  const ticks = yMax <= 4 ? Array.from({ length: yMax + 1 }, (_, i) => i) : [0, yMax / 2, yMax];
  const n = values.length;
  const px = (i) => (n === 1 ? (L + W - R) / 2 : L + (i / (n - 1)) * (W - L - R));
  const py = (v) => T + (1 - v / yMax) * (H - T - B);
  const pts = values.map((v, i) => [px(i), py(v)]);
  const solid = partialLast && n > 1 ? pts.slice(0, -1) : pts;
  const path = (p) => p.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const step = n > 8 ? 2 : 1;

  function move(e) {
    const r = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - r.left;
    let best = 0;
    pts.forEach(([px0], i) => { if (Math.abs(px0 - x) < Math.abs(pts[best][0] - x)) best = i; });
    setHover(best);
  }

  return (
    <div ref={ref} style={{ position: 'relative', width: '100%', ...(bg ? { background: bg, borderRadius: 6 } : {}) }}>
      <svg width={W} height={H} role="img" aria-label="Monthly cases line chart" style={{ display: 'block', touchAction: 'none' }}
        onMouseMove={move} onMouseLeave={() => setHover(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={py(t)} y2={py(t)} stroke="#8a97a3" strokeOpacity=".55" strokeWidth="1" />
            <text x={L - 6} y={py(t) + 3} fontSize="12.5" fontWeight="700" fill={MUTED} textAnchor="end">{t}</text>
          </g>
        ))}
        {labels.map((lb, i) => (i % step === 0 || i === n - 1) && (
          <text key={i} x={px(i)} y={H - 7} fontSize="12.5" fontWeight="700" fill={MUTED} textAnchor="middle">{lb}</text>
        ))}
        <line x1={L} x2={W - R} y1={py(0)} y2={py(0)} stroke="#2b2f33" strokeWidth="2.5" />
        {hover !== null && <line x1={px(hover)} x2={px(hover)} y1={T} y2={H - B} stroke={MUTED} strokeWidth="1" strokeDasharray="3 3" />}
        <path d={path(solid)} fill="none" stroke={color} strokeWidth="6" strokeLinejoin="round" strokeLinecap="round" />
        {partialLast && n > 1 && <path d={path(pts.slice(-2))} fill="none" stroke={color} strokeWidth="6" strokeDasharray="8 7" strokeLinecap="round" />}
        {pts.map(([x, y], i) => (
          <g key={i}>
            <rect x={x - 8} y={y - 8} width="16" height="16" fill="#fff" stroke={edge || color} strokeWidth="2" opacity={partialLast && i === n - 1 ? 0.8 : 1} />
            <text x={x} y={y - 15} fontSize="13" fontWeight="800" fill="#111" textAnchor="middle">{values[i]}</text>
          </g>
        ))}
      </svg>
      {hover !== null && (
        <div className="chart-tip" style={{ left: pts[hover][0], top: pts[hover][1] }}>
          <div className="fw-bold">{values[hover]} case{values[hover] === 1 ? '' : 's'}</div>
          <div>{fullLabels?.[hover] ?? labels[hover]}{partialLast && hover === n - 1 ? ' (so far)' : ''}</div>
        </div>
      )}
    </div>
  );
}

export function SymptomTrendGrid({ months, series, single = false, partialLast = true, empty = 'No consultations recorded in this period.' }) {
  if (!series || series.length === 0) return <div className="text-secondary">{empty}</div>;
  const labels = months.map((m) => m.label);
  const full = months.map((m) => m.full);
  return (
    <div className="row g-3">
      {series.map((s, idx) => (
        <div className={single ? 'col-12' : 'col-12 col-lg-6'} key={s.name}>
          <div className="trend-card">
            <div className="text-center mb-2 position-relative">
              <strong style={{ color: '#111', fontSize: '1.2rem', background: '#fff', border: '1.5px solid #111', padding: '2px 14px', display: 'inline-block' }}>{cap(s.name)}</strong>
              <div className="small fw-bold text-secondary mt-1">{s.total} total</div>
            </div>
            <LineChart labels={labels} fullLabels={full} values={s.values} color={LINE_THEMES[idx % LINE_THEMES.length].line} edge={LINE_THEMES[idx % LINE_THEMES.length].edge} bg={LINE_THEMES[idx % LINE_THEMES.length].bg} partialLast={partialLast} />
          </div>
        </div>
      ))}
    </div>
  );
}