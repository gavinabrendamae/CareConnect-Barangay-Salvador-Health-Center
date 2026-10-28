import { daysUntil, formatDate, formatDateTime } from '../lib/format.js';

export default function NotificationsPanel({ items, unread, markRead, markAllRead, upcoming = [] }) {
  return (
    <>
    {upcoming.length > 0 && (
      <div className="panel-card mb-4" style={{ borderLeft: '5px solid #1d6fb8' }}>
        <h5 className="mb-3"><i className="bi bi-shield-plus me-2" />Upcoming vaccines</h5>
        {upcoming.map((v) => {
          const d = daysUntil(v.scheduled_date);
          return (
            <div key={v.id} className="border-bottom py-2 d-flex justify-content-between flex-wrap gap-2">
              <div>
                <strong>{v.who}</strong> — {v.vaccine_name} <span className="text-secondary">({v.dose_label})</span>
                <div className="small text-secondary">{formatDate(v.scheduled_date)} at the Barangay Health Center</div>
              </div>
              <span className={`badge align-self-start ${d === 0 ? 'bg-success' : d === 1 ? 'bg-primary' : 'bg-secondary'}`}>
                {d === 0 ? 'Today' : d === 1 ? 'Tomorrow' : `in ${d} days`}
              </span>
            </div>
          );
        })}
      </div>
    )}
    <div className="panel-card">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h5 className="mb-0"><i className="bi bi-bell me-2" />Notifications</h5>
        {unread > 0 && <button className="btn btn-sm btn-outline-secondary" onClick={markAllRead}>Mark all as read</button>}
      </div>
      {items.length === 0 ? <div className="text-secondary">No notifications yet.</div> : items.map((n) => (
        <div key={n.id} className={`border-bottom py-2 d-flex gap-2 ${n.read_at ? 'text-secondary' : ''}`}>
          <i className={`bi ${n.read_at ? 'bi-bell' : 'bi-bell-fill text-success'} mt-1`} />
          <div className="flex-grow-1">
            <div className={n.read_at ? 'fw-semibold' : 'fw-bold'}>{n.title}</div>
            <div className={`small ${n.read_at ? '' : 'fw-bold'}`}>{n.body}</div>
            <div className="small text-secondary">{formatDateTime(n.created_at)}</div>
          </div>
          {!n.read_at && <button className="btn btn-sm btn-link align-self-start" onClick={() => markRead(n.id)}>Mark read</button>}
        </div>
      ))}
    </div>
    </>
  );
}