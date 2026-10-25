import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from './supabase';

// Live counts of the patient queue. `onNew(n)` fires when n new patients
// become "waiting" for the Midwife/Doctor (i.e. BHW finished their vitals).
export function useQueueCounts(onNew) {
  const [counts, setCounts] = useState({ forVitals: 0, waiting: 0, inConsult: 0, awaitingLab: 0 });
  const seen = useRef(null);
  const cb = useRef(onNew);
  cb.current = onNew;

  const load = useCallback(async () => {
    const { data } = await supabase.from('queue').select('id, status').in('status', ['for_vitals', 'waiting', 'in_consultation', 'awaiting_lab']);
    const rows = data ?? [];
    const waitingIds = rows.filter((r) => r.status === 'waiting').map((r) => r.id);
    setCounts({
      forVitals: rows.filter((r) => r.status === 'for_vitals').length,
      waiting: waitingIds.length,
      inConsult: rows.filter((r) => r.status === 'in_consultation').length,
      awaitingLab: rows.filter((r) => r.status === 'awaiting_lab').length,
    });
    if (seen.current) {
      const fresh = waitingIds.filter((id) => !seen.current.has(id));
      if (fresh.length) cb.current?.(fresh.length);
    }
    seen.current = new Set(waitingIds);
  }, []);

  useEffect(() => {
    load();
    const channel = supabase
      .channel(`queue-counts-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'queue' }, load)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load]);

  return counts;
}