import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { fullName, todayISO } from '../lib/format.js';
import { SymptomTrendGrid } from './Charts.jsx';
import { REPORT_TYPES, buildReport, exportExcel, exportPDF } from '../lib/reports.js';

export default function ReportsPanel() {
  const { profile } = useAuth();
  const [type, setType] = useState(REPORT_TYPES[0].key);
  const [from, setFrom] = useState(`${todayISO().slice(0, 8)}01`);
  const [to, setTo] = useState(todayISO());
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState(null);
  const [preview, setPreview] = useState(null);

  const current = REPORT_TYPES.find((r) => r.key === type);
  const dated = type !== 'residents';

  async function run(kind) {
    setMsg(null);
    if (dated && from > to) return setMsg({ type: 'danger', text: '"From" date must not be after "To" date.' });
    setBusy(kind);
    try {
      const report = await buildReport(type, from, to);
      setPreview(report);
      if (kind === 'pdf') await exportPDF(report, fullName(profile));
      else if (kind === 'excel') await exportExcel(report);
      if (kind !== 'preview') setMsg({ type: 'success', text: `${report.title} downloaded.` });
    } catch (err) {
      setMsg({ type: 'danger', text: err.message });
    }
    setBusy('');
  }

  return (
    <div className="row g-4">
      <div className="col-lg-4">
        <div className="panel-card">
          <h5 className="mb-3">Generate Report</h5>
          <div className="mb-3">
            <label className="form-label">Report</label>
            <select className="form-select" value={type} onChange={(e) => { setType(e.target.value); setPreview(null); }}>
              {REPORT_TYPES.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
            </select>
            <div className="form-text">{current.note}</div>
          </div>
          {dated && (
            <div className="row g-2 mb-3">
              <div className="col-6"><label className="form-label">From</label><input type="date" className="form-control" value={from} max={to} onChange={(e) => setFrom(e.target.value)} /></div>
              <div className="col-6"><label className="form-label">To</label><input type="date" className="form-control" value={to} min={from} onChange={(e) => setTo(e.target.value)} /></div>
            </div>
          )}
          {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}
          <div className="d-grid gap-2">
            <button className="btn btn-primary-custom" disabled={Boolean(busy)} onClick={() => run('pdf')}>
              <i className="bi bi-file-earmark-pdf me-2" />{busy === 'pdf' ? 'Preparing PDF...' : 'Download PDF'}
            </button>
            <button className="btn btn-outline-primary-custom" disabled={Boolean(busy)} onClick={() => run('excel')}>
              <i className="bi bi-file-earmark-excel me-2" />{busy === 'excel' ? 'Preparing Excel...' : 'Download Excel'}
            </button>
            <button className="btn btn-outline-secondary" disabled={Boolean(busy)} onClick={() => run('preview')}>
              {busy === 'preview' ? 'Loading...' : 'Preview on screen'}
            </button>
          </div>
        </div>
      </div>

      <div className="col-lg-8">
        <div className="panel-card">
          <h5 className="mb-1">Preview</h5>
          {!preview ? <div className="text-secondary">Choose a report and press Preview or Download.</div> : (
            <>
              <p className="text-secondary small mb-3">{preview.title} · {preview.subtitle}</p>
              {preview.sections.map((s) => (
                <div key={s.heading} className="mb-4">
                  <h6 className="fw-bold">{s.heading} {!s.chart && <span className="badge bg-secondary">{s.rows.length}</span>}</h6>
                  {s.chart && <SymptomTrendGrid months={s.chart.months} series={s.chart.series} />}
                  {!s.chart && <div className="table-responsive" style={{ maxHeight: 280 }}>
                    <table className="table table-sm mb-0">
                      <thead><tr>{s.columns.map((c) => <th key={c}>{c}</th>)}</tr></thead>
                      <tbody>
                        {s.rows.slice(0, 50).map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{String(c)}</td>)}</tr>)}
                      </tbody>
                    </table>
                  </div>}
                  {s.rows.length > 50 && <div className="small text-secondary mt-1">Showing first 50 of {s.rows.length} rows — the download contains all of them.</div>}
                  {!s.chart && s.rows.length === 0 && <div className="small text-secondary">No records.</div>}
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}