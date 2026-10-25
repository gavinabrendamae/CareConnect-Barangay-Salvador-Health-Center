import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { addDaysISO, daysUntil, formatDate, todayISO } from '../lib/format.js';
import { fmtTime } from './EventsPanel.jsx';

const keyOf = (ev) => `cc_ev_remind_${ev.id}_${daysUntil(ev.event_date) === 0 ? 'today' : 'eve'}`;
const seen = (k) => { try { return localStorage.getItem(k) === '1'; } catch { return false; } };
const mark = (k) => { try { localStorage.setItem(k, '1'); } catch { /* ignore */ } };

export default function EventReminder({ onOpenCalendar }) {
  const [list, setList] = useState([]);

  useEffect(() => {
    supabase.from('events').select('*').gte('event_date', todayISO()).lte('event_date', addDaysISO(1))
      .order('event_date').order('start_time')
      .then(({ data }) => setList((data ?? []).filter((ev) => !seen(keyOf(ev)))));
  }, []);

  if (list.length === 0) return null;

  function close(goCalendar) {
    list.forEach((ev) => mark(keyOf(ev)));
    setList([]);
    if (goCalendar) onOpenCalendar?.();
  }

  const today = list.filter((e) => daysUntil(e.event_date) === 0);
  const tomorrow = list.filter((e) => daysUntil(e.event_date) === 1);
  const Group = ({ title, color, items }) => items.length === 0 ? null : (
    <div className="mb-3">
      <div className={`fw-bold text-${color} mb-2`}>{title}</div>
      {items.map((ev) => (
        <div key={ev.id} className="ann-item mb-2">
          <strong className="ann-title">{ev.title}</strong>
          <div className="ann-date">
            <i className="bi bi-calendar3 me-1" />{formatDate(ev.event_date)}{ev.start_time && <> · {fmtTime(ev.start_time)}</>}
            {ev.location && <> · <i className="bi bi-geo-alt me-1" />{ev.location}</>}
          </div>
          {ev.notes && <div className="ann-text">{ev.notes}</div>}
        </div>
      ))}
    </div>
  );

  return (
    <>
      <div className="modal fade show d-block" tabIndex="-1" onClick={() => close(false)}>
        <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable" onClick={(e) => e.stopPropagation()}>
          <div className="modal-content ann-modal">
            <div className="ann-head">
              <div className="ann-head-icon"><i className="bi bi-bell-fill" /></div>
              <div><h5 className="mb-0 fw-bold">Event Reminder</h5><small>Don't forget — upcoming at the health center</small></div>
              <button type="button" className="btn-close btn-close-white ms-auto" onClick={() => close(false)} aria-label="Close" />
            </div>
            <div className="modal-body ann-body">
              <Group title="📅 Today" color="danger" items={today} />
              <Group title="⏰ Tomorrow" color="warning" items={tomorrow} />
            </div>
            <div className="modal-footer border-0 pt-0">
              {onOpenCalendar && <button className="btn btn-outline-secondary" onClick={() => close(true)}>Open calendar</button>}
              <button className="btn btn-primary-custom px-4" onClick={() => close(false)}>Got it</button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show" />
    </>
  );
}