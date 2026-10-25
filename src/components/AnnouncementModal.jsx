import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { formatDate } from '../lib/format.js';

const SEEN_KEY = 'cc_announce_seen';
const isNew = (d) => Date.now() - new Date(d).getTime() < 3 * 86400000;

export default function AnnouncementModal({ open, onClose, onLoaded }) {
  const [rows, setRows] = useState(null);
  const [auto, setAuto] = useState(false);

  useEffect(() => {
    supabase.from('announcements').select('*')
      .order('is_pinned', { ascending: false }).order('created_at', { ascending: false }).limit(10)
      .then(({ data }) => {
        const list = data ?? [];
        setRows(list);
        onLoaded?.(list.length);
        let seen = false;
        try { seen = sessionStorage.getItem(SEEN_KEY) === '1'; } catch { /* storage unavailable */ }
        if (list.length && !seen) setAuto(true);
      });
  }, [onLoaded]);

  const show = open || auto;
  function close() {
    setAuto(false);
    try { sessionStorage.setItem(SEEN_KEY, '1'); } catch { /* ignore */ }
    onClose?.();
  }

  if (!show) return null;
  return (
    <>
      <div className="modal fade show d-block" tabIndex="-1" onClick={close}>
        <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable" onClick={(e) => e.stopPropagation()}>
          <div className="modal-content ann-modal">
            <div className="ann-head">
              <div className="ann-head-icon"><i className="bi bi-megaphone-fill" /></div>
              <div>
                <h5 className="mb-0 fw-bold">Announcements</h5>
                <small>Latest updates from the Barangay Health Center</small>
              </div>
              <button type="button" className="btn-close btn-close-white ms-auto" onClick={close} aria-label="Close" />
            </div>
            <div className="modal-body ann-body">
              {rows === null ? <div className="text-secondary">Loading...</div> : rows.length === 0 ? (
                <div className="text-center text-secondary py-4">
                  <i className="bi bi-bell-slash fs-2 d-block mb-2" />No announcements right now.
                </div>
              ) : rows.map((a) => (
                <div key={a.id} className={`ann-item${a.is_pinned ? ' pinned' : ''}`}>
                  <div className="d-flex align-items-start justify-content-between gap-2">
                    <strong className="ann-title">{a.title}</strong>
                    <div className="d-flex gap-1 flex-shrink-0">
                      {a.is_pinned && <span className="badge bg-warning text-dark"><i className="bi bi-pin-angle-fill me-1" />Pinned</span>}
                      {isNew(a.created_at) && <span className="badge bg-success">New</span>}
                    </div>
                  </div>
                  <div className="ann-date"><i className="bi bi-calendar3 me-1" />{formatDate(a.created_at)}</div>
                  <div className="ann-text">{a.body}</div>
                </div>
              ))}
            </div>
            <div className="modal-footer border-0 pt-0">
              <button className="btn btn-primary-custom px-4" onClick={close}>Got it</button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show" />
    </>
  );
}