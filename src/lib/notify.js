import { supabase } from './supabase';

export async function sendNotification(userId, { type, icon, title, body, actionUrl = null, targetRole = null, prefKey = null }) {
  if (!userId) return;

  // prefKey가 있으면 수신자의 DB 설정 확인 (false일 때만 차단, 미설정=true로 취급)
  if (prefKey && (targetRole === 'panel' || targetRole === 'company')) {
    const table = targetRole === 'panel' ? 'panels' : 'companies';
    const { data } = await supabase
      .from(table)
      .select('notif_prefs')
      .eq('user_id', userId)
      .single();
    if (data?.notif_prefs?.[prefKey] === false) return;
  }

  const { error } = await supabase.from('notifications').insert({
    user_id: userId,
    type,
    icon,
    title,
    body,
    action_url: actionUrl,
    target_role: targetRole,
    read: false,
  });
  if (error) console.error('[notify]', error.message);
}
