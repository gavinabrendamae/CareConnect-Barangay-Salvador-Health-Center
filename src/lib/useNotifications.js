import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';
import { useAuth } from '../context/AuthContext.jsx';

// The signed-in user's in-app notifications, live.
export function useNotifications() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);

  const load = useCallback(async () => {
    const { data } = await supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(50);
    setItems(data ?? []);
  }, []);

  useEffect(() => {
    load();
    const ch = supabase.channel(`notif-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `profile_id=eq.${user.id}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load, user.id]);

  const markAllRead = async () => {
    await supabase.from('notifications').update({ read_at: new Date().toISOString() }).is('read_at', null);
    load();
  };
  const markRead = async (id) => {
    await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id);
    load();
  };

  return { items, unread: items.filter((n) => !n.read_at).length, markRead, markAllRead };
}