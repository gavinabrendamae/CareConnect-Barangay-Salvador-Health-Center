import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { formatDate } from '../lib/format.js';

export default function AnnouncementList({ limit = 5 }) {
  const [rows, setRows] = useState(null);

  useEffect(() => {
    supabase.from('announcements').select('*').order('is_pinned', { ascending: false }).order('created_at', { ascending: false }).limit(limit)
      .then(({ data }) => setRows(data ?? []));
  }, [limit]);

  if (rows === null) return <div className="text-secondary">Loading...</div>;
  if (rows.length === 0) return <div className="text-secondary">No announcements from the health center right now.</div>;
  return rows.map((a) => (
    <div key={a.id} className={`announce mb-2${a.is_pinned ? ' pinned' : ''}`}>
      <div className="d-flex justify-content-between">
        <strong>{a.is_pinned && <i className="bi bi-pin-angle-fill text-warning me-1" />}{a.title}</strong>
        <span className="small text-secondary">{formatDate(a.created_at)}</span>
      </div>
      <div className="small" style={{ whiteSpace: 'pre-line' }}>{a.body}</div>
    </div>
  ));
}