export default function BarList({ rows, unit = '', warn = false, empty = 'No data yet.' }) {
  if (!rows || rows.length === 0) return <div className="text-secondary">{empty}</div>;
  const max = Math.max(...rows.map((r) => r[1]), 1);
  return rows.map(([label, value]) => (
    <div className="mb-3" key={label}>
      <div className="d-flex justify-content-between small">
        <span className="text-capitalize">{label}</span>
        <strong>{value}{unit && ` ${unit}`}</strong>
      </div>
      <div className="bar-track"><div className={`bar-fill${warn ? ' warn' : ''}`} style={{ width: `${(value / max) * 100}%` }} /></div>
    </div>
  ));
}

export function topCounts(values, n = 5) {
  const counts = {};
  values.forEach((v) => {
    const k = (v ?? '').trim().toLowerCase();
    if (k) counts[k] = (counts[k] || 0) + 1;
  });
  return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, n);
}