import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Btn } from '../ui';
import { supabase } from '../../lib/supabase';

const TYPE_COLORS = {
  success: 'var(--green)',
  warning: 'var(--accent)',
  info: 'var(--blue)',
};

const TYPE_BG = {
  success: 'var(--green-dim)',
  warning: 'var(--accent-dim)',
  info: 'var(--blue-dim)',
};

export default function NotificationCenter({ role = 'company' }) {
  const navigate = useNavigate();
  const [notifs, setNotifs] = useState([]);
  const [loading, setLoading] = useState(true);
  const unread = notifs.filter(n => !n.read).length;

  useEffect(() => {
    let subscription;

    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (data) setNotifs(data);
      setLoading(false);

      subscription = supabase
        .channel('notifications')
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        }, (payload) => {
          setNotifs(prev => [payload.new, ...prev]);
        })
        .subscribe();
    }

    load();
    return () => { if (subscription) supabase.removeChannel(subscription); };
  }, []);

  async function markAll() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('notifications').update({ read: true }).eq('user_id', user.id).eq('read', false);
    setNotifs(ns => ns.map(n => ({ ...n, read: true })));
  }

  async function markOne(id, actionUrl) {
    await supabase.from('notifications').update({ read: true }).eq('id', id);
    setNotifs(ns => ns.map(n => n.id === id ? { ...n, read: true } : n));
    if (actionUrl) navigate(actionUrl);
  }

  const roleColor = role === 'company' ? 'var(--blue)' : role === 'panel' ? 'var(--green)' : 'var(--accent)';

  return (
    <div style={{ padding: '40px 48px', maxWidth: 700, animation: 'fadeUp 0.5s ease both' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 }}>
        <div>
          <div style={{ fontSize: 12, fontFamily: 'var(--font-sans)', color: roleColor, marginBottom: 8, letterSpacing: '0.1em' }}>
            NOTIFICATIONS
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 800 }}>
            알림 센터
            {unread > 0 && (
              <span style={{ marginLeft: 12, fontSize: 16, fontFamily: 'var(--font-sans)', background: 'var(--red)', color: '#fff', padding: '2px 10px', borderRadius: 20, verticalAlign: 'middle' }}>
                {unread}
              </span>
            )}
          </h1>
        </div>
        {unread > 0 && (
          <Btn size="sm" variant="ghost" onClick={markAll}>모두 읽음 처리</Btn>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-3)', fontFamily: 'var(--font-sans)', fontSize: 13 }}>
          로딩 중…
        </div>
      ) : notifs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-3)' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🔔</div>
          <div style={{ fontWeight: 600, color: 'var(--text-2)' }}>알림이 없습니다</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {notifs.map(n => (
            <div
              key={n.id}
              onClick={() => markOne(n.id, n.action_url)}
              style={{
                display: 'flex', gap: 16, padding: '18px 20px',
                background: n.read ? 'var(--surface)' : 'var(--surface-2)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid ' + (n.read ? 'var(--border)' : 'var(--border-light)'),
                cursor: 'pointer', transition: 'all 0.15s', position: 'relative',
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-light)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = n.read ? 'var(--border)' : 'var(--border-light)'}
            >
              {!n.read && (
                <div style={{ position: 'absolute', top: 18, right: 18, width: 8, height: 8, borderRadius: '50%', background: 'var(--red)' }} />
              )}
              <div style={{
                width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                background: TYPE_BG[n.type] || 'var(--surface)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 16, color: TYPE_COLORS[n.type] || 'var(--text)',
              }}>
                {n.icon}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                  <span style={{ fontWeight: n.read ? 500 : 700, fontSize: 14 }}>{n.title}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-sans)', flexShrink: 0, marginLeft: 12 }}>
                    {new Date(n.created_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6, marginBottom: 0 }}>{n.body}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
