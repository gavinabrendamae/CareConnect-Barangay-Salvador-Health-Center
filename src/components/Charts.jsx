import { useLayoutEffect, useRef, useState } from 'react';
import { TREND_COLORS } from '../lib/trends.js';

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

export const CHART_COLORS = { blue: '#2b78b8', orange: '#5b6fd6', aqua: '#2b78b8', violet: '#7a5cc4' };

const LINE_THEMES = [
  { line: '#2b78b8', edge: '#0C4C8A', bg: 'linear-gradient(180deg,#f4f9fe 0%,#c4dcf1 100%)' },
  { line: '#0C4C8A', edge: '#1F375D', bg: 'linear-gradient(180deg,#f2f7fc 0%,#b3cde9 100%)' },
  { line: '#3aa5c0', edge: '#1f7f99', bg: 'linear-gradient(180deg,#f2fbfd 0%,#bfe6ef 100%)' },
  { line: '#5b9bd5', edge: '#2e75b6', bg: 'linear-gradient(180deg,#f6faff 0%,#cfe2f4 100%)' },
];

export const BAR_COLORS = ['#0C4C8A', '#2b78b8', '#5b9bd5', '#3aa5c0', '#97D5E0', '#1F375D'];
const INK = '#1F375D';
const MUTED = '#3d5675';
const GRID = '#d3e3f2';
const BOX = { width: '100%', padding: '12px 14px 4px', borderRadius: 10, border: '1px solid #bcd6ee', background: 'linear-gradient(135deg,#e8f2fb 0%,#ffffff 55%,#dcecf8 100%)' };
const cap = (s) => String(s).replace(/\b\w/g, (c) => c.toUpperCase());

export function HBarChart({ rows, color = CHART_COLORS.blue, unit = '', empty = 'No data yet.', multi = false, onSelect }) {
  const [hover, setHover] = useState(null);
  const [ref, W] = useWidth();
  if (!rows || rows.length === 0) return <div className="text-secondary">{empty}</div>;
  const LABEL = Math.min(260, Math.round(W * 0.42)); const ROW = 44; const RIGHT = unit ? 110 : 60;
  const max = Math.max(...rows.map((r) => r[1]), 1);
  const H = rows.length * ROW + 24;
  const plot = W - 28 - LABEL - RIGHT;
  const x = (v) => LABEL + (v / max) * plot;
  return (
    <div ref={ref} style={BOX}>
    <svg width={W - 28} height={H} role="img" aria-label="Bar chart" style={{ display: 'block' }}>
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
            <rect x="0" y={y - 4} width={W} height={ROW - 2} fill={on ? '#e3eef9' : 'transparent'} rx="4" />
            <text x="0" y={y + 21} fontSize="15" fill="#1F375D" fontWeight="700">{text.length > Math.floor(LABEL / 8.5) ? `${text.slice(0, Math.floor(LABEL / 8.5) - 1)}…` : text}<title>{`${text}: ${value}${unit ? ` ${unit}` : ''}`}</title></text>
            <rect x={LABEL} y={y + 3} width={Math.max(4, x(value) - LABEL)} height="26" rx="5" fill={multi ? BAR_COLORS[i % BAR_COLORS.length] : color} stroke="none" opacity={on || hover === null ? 1 : 0.55} />
            <text x={x(value) + 8} y={y + 21} fontSize="15" fontWeight="700" fill={INK}>{value}{unit && ` ${unit}`}</text>
          </g>
        );
      })}
    </svg>
    </div>
  );
}

export function DonutChart({ rows, empty = 'No data yet.' }) {
  const [hover, setHover] = useState(null);
  const list = (rows ?? []).filter((r) => r[1] > 0);
  const total = (rows ?? []).reduce((a, r) => a + r[1], 0);
  if (!total) return <div className="text-secondary">{empty}</div>;
  const R = 62; const C = 2 * Math.PI * R;
  let acc = 0;
  return (
    <div style={BOX} className="d-flex flex-wrap align-items-center justify-content-center gap-4 pb-3">
      <svg width="170" height="170" viewBox="0 0 170 170" role="img" aria-label="Donut chart">
        <g transform="rotate(-90 85 85)">
          {list.map(([label, value]) => {
            const i = rows.findIndex((r) => r[0] === label);
            const len = (value / total) * C;
            const el = (
              <circle key={label} cx="85" cy="85" r={R} fill="none" stroke={BAR_COLORS[i % BAR_COLORS.length]}
                strokeWidth={hover === label ? 30 : 24} strokeDasharray={`${Math.max(len - 2, 0.5)} ${C}`} strokeDashoffset={-acc}
                onMouseEnter={() => setHover(label)} onMouseLeave={() => setHover(null)} style={{ transition: 'stroke-width .15s' }} />
            );
            acc += len;
            return el;
          })}
        </g>
        <text x="85" y="84" textAnchor="middle" fontSize="26" fontWeight="800" fill="#1F375D">{total}</text>
        <text x="85" y="103" textAnchor="middle" fontSize="12" fontWeight="700" fill="#3d5675">residents</text>
      </svg>
      <div style={{ minWidth: 190 }}>
        {rows.map(([label, value], i) => (
          <div key={label} className="d-flex align-items-center gap-2 py-1" onMouseEnter={() => setHover(label)} onMouseLeave={() => setHover(null)}
            style={{ fontWeight: hover === label ? 800 : 600, color: '#1F375D' }}>
            <span style={{ width: 14, height: 14, borderRadius: 4, background: BAR_COLORS[i % BAR_COLORS.length], flexShrink: 0 }} />
            <span className="flex-grow-1">{label}</span>
            <span>{value} <span className="small" style={{ color: '#3d5675' }}>({Math.round((value / total) * 100)}%)</span></span>
          </div>
        ))}
      </div>
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
            <line x1={L} x2={W - R} y1={py(t)} y2={py(t)} stroke="#6f93b8" strokeOpacity=".35" strokeWidth="1" />
            <text x={L - 6} y={py(t) + 3} fontSize="12.5" fontWeight="700" fill={MUTED} textAnchor="end">{t}</text>
          </g>
        ))}
        {labels.map((lb, i) => (i % step === 0 || i === n - 1) && (
          <text key={i} x={px(i)} y={H - 7} fontSize="12.5" fontWeight="700" fill={MUTED} textAnchor="middle">{lb}</text>
        ))}
        <line x1={L} x2={W - R} y1={py(0)} y2={py(0)} stroke="#1F375D" strokeWidth="2" />
        {hover !== null && <line x1={px(hover)} x2={px(hover)} y1={T} y2={H - B} stroke={MUTED} strokeWidth="1" strokeDasharray="3 3" />}
        {n > 1 && <path d={`${path(pts)} L${pts[n - 1][0].toFixed(1)},${py(0)} L${pts[0][0].toFixed(1)},${py(0)} Z`} fill={color} opacity=".14" />}
        <path d={path(solid)} fill="none" stroke={color} strokeWidth="4" strokeLinejoin="round" strokeLinecap="round" />
        {partialLast && n > 1 && <path d={path(pts.slice(-2))} fill="none" stroke={color} strokeWidth="4" strokeDasharray="7 6" strokeLinecap="round" />}
        {pts.map(([x, y], i) => (
          <g key={i}>
            <circle cx={x} cy={y} r="6.5" fill="#fff" stroke={edge || color} strokeWidth="3" opacity={partialLast && i === n - 1 ? 0.8 : 1} />
            <text x={x} y={y - 15} fontSize="13" fontWeight="800" fill="#1F375D" textAnchor="middle">{values[i]}</text>
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

export function MultiLineChart({ months, series, height = 300, empty = 'No records.' }) {
  const [hover, setHover] = useState(null);
  const [ref, W] = useWidth(320);
  if (!series || series.length === 0) return <div className="text-secondary">{empty}</div>;
  const H = height; const L = 38; const R = 22; const T = 24; const B = 32;
  const n = months.length;
  const max = Math.max(2, ...series.flatMap((s) => s.values));
  const yMax = max <= 4 ? max : Math.ceil(max / 2) * 2;
  const ticks = yMax <= 4 ? Array.from({ length: yMax + 1 }, (_, i) => i) : [0, yMax / 2, yMax];
  const px = (i) => (n === 1 ? (L + W - R) / 2 : L + (i / (n - 1)) * (W - L - R));
  const py = (v) => T + (1 - v / yMax) * (H - T - B);
  const color = (i) => TREND_COLORS[i % TREND_COLORS.length];
  const cap = (s) => String(s).replace(/\b\w/g, (c) => c.toUpperCase());
  function move(e) {
    const r = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - r.left;
    let best = 0;
    for (let i = 0; i < n; i += 1) if (Math.abs(px(i) - x) < Math.abs(px(best) - x)) best = i;
    setHover(best);
  }
  return (
    <div ref={ref} style={{ position: 'relative', width: '100%', background: 'linear-gradient(135deg,#e8f2fb 0%,#ffffff 55%,#dcecf8 100%)', border: '1px solid #bcd6ee', borderRadius: 10, padding: '8px 0 10px' }}>
      <svg width={W} height={H} role="img" aria-label="Symptom trends line chart" style={{ display: 'block', touchAction: 'none' }} onMouseMove={move} onMouseLeave={() => setHover(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={py(t)} y2={py(t)} stroke="#6f93b8" strokeOpacity=".35" strokeWidth="1" />
            <text x={L - 7} y={py(t) + 4} fontSize="12.5" fontWeight="700" fill="#3d5675" textAnchor="end">{t}</text>
          </g>
        ))}
        {months.map((m, i) => <text key={m.key} x={px(i)} y={H - 10} fontSize="12.5" fontWeight="700" fill="#3d5675" textAnchor="middle">{m.label}</text>)}
        <line x1={L} x2={W - R} y1={py(0)} y2={py(0)} stroke="#1F375D" strokeWidth="2" />
        {hover !== null && <line x1={px(hover)} x2={px(hover)} y1={T} y2={H - B} stroke="#3d5675" strokeWidth="1" strokeDasharray="3 3" />}
        {series.map((s, si) => (
          <g key={s.name}>
            <path d={s.values.map((v, i) => `${i ? 'L' : 'M'}${px(i).toFixed(1)},${py(v).toFixed(1)}`).join(' ')} fill="none" stroke={color(si)} strokeWidth="3.5" strokeLinejoin="round" strokeLinecap="round" />
            {s.values.map((v, i) => <circle key={i} cx={px(i)} cy={py(v)} r={hover === i ? 6 : 4.5} fill="#fff" stroke={color(si)} strokeWidth="2.5" />)}
          </g>
        ))}
      </svg>
      {hover !== null && (
        <div className="chart-tip" style={{ left: Math.min(Math.max(px(hover), 90), W - 90), top: T + 6, transform: 'translate(-50%, 0)' }}>
          <div className="fw-bold mb-1">{months[hover].full}</div>
          {series.map((s, si) => <div key={s.name}><span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 2, background: color(si), marginRight: 6 }} />{cap(s.name)}: {s.values[hover]}</div>)}
        </div>
      )}
      <div className="d-flex flex-wrap gap-3 justify-content-center px-3 pt-1">
        {series.map((s, si) => (
          <span key={s.name} className="small fw-bold" style={{ color: '#1F375D' }}>
            <span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: 3, background: color(si), marginRight: 6, verticalAlign: '-1px' }} />{cap(s.name)} <span style={{ color: '#3d5675' }}>({s.total})</span>
          </span>
        ))}
      </div>
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
              <strong style={{ color: '#fff', fontSize: '1.1rem', background: '#0C4C8A', borderRadius: 999, padding: '3px 18px', display: 'inline-block' }}>{cap(s.name)}</strong>
              <div className="small fw-bold text-secondary mt-1">{s.total} total</div>
            </div>
            <LineChart labels={labels} fullLabels={full} values={s.values} color={LINE_THEMES[idx % LINE_THEMES.length].line} edge={LINE_THEMES[idx % LINE_THEMES.length].edge} bg={LINE_THEMES[idx % LINE_THEMES.length].bg} partialLast={partialLast} />
          </div>
        </div>
      ))}
    </div>
  );
}