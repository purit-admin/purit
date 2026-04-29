import { supabase } from './supabase';

export async function sendNotification(userId, { type, icon, title, body, actionUrl = null }) {
  if (!userId) return;
  const { error } = await supabase.from('notifications').insert({
    user_id: userId,
    type,
    icon,
    title,
    body,
    action_url: actionUrl,
    read: false,
  });
  if (error) console.error('[notify]', error.message);
}
