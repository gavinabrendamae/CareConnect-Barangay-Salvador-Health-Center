import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';

export function usePendingApprovals(enabled = true) {
  const [count, setCount] = useState(0);
  const load = useCallback(async () => {
    if (!enabled) return;
    const { count: c } = await supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('approval_status', 'pending');
    setCount(c ?? 0);
  }, [enabled]);
  useEffect(() => {
    if (!enabled) { setCount(0); return undefined; }
    load();
    const timer = setInterval(load, 15000); 
    window.addEventListener('pending-changed', load);
    const channel = supabase
      .channel(`pending-approvals-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, load)
      .subscribe();
    return () => { clearInterval(timer); window.removeEventListener('pending-changed', load); supabase.removeChannel(channel); };
  }, [enabled, load]);
  return count;
}