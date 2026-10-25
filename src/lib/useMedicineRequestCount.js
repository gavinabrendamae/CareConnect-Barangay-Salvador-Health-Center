import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';

// Live number of medicine requests still waiting (shown as a badge for admin / BHW).
export function useMedicineRequestCount() {
  const [count, setCount] = useState(0);
  const load = useCallback(async () => {
    const { count: c } = await supabase.from('medicine_requests').select('id', { count: 'exact', head: true }).eq('status', 'waiting');
    setCount(c ?? 0);
  }, []);
  useEffect(() => {
    load();
    const channel = supabase
      .channel(`medreq-count-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'medicine_requests' }, load)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load]);
  return count;
}