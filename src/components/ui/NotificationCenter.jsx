import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Btn } from '../ui';
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

const PAGE_SIZE = 10;

export default function NotificationCenter({ role = 'company' }) {
  const navigate = useNavigate();
  const [notifs, setNotifs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('general'); // 'general' | 'bugs' (admin only)
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(new Set());
  const [deleting, setDeleting] = useState(false);

  const isBug = n => n.action_url === '/admin/reports';
  const displayed = role === 'admin'
    ? notifs.filter(n => tab === 'bugs' ? isBug(n) : !isBug(n))
    : notifs;
  const totalPages = Math.ceil(displayed.length / PAGE_SIZE);
  const paged = displayed.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const unread = displayed.filter(n => !n.read).length;
  const bugUnread = notifs.filter(n => isBug(n) && !n.read).length;
  const generalUnread = notifs.filter(n => !isBug(n) && !n.read).length;

  const pagedIds = paged.map(n => n.id);
  const allPageSelected = pagedIds.length > 0 && pagedIds.every(id => selected.has(id));
  const someSelected = selected.size > 0;

  useEffect(() => {
    let subscription;

    async function load() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setLoading(false); return; }

        const { data } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', user.id)
          .or(`target_role.eq.${role},target_role.is.null`)
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
      } catch (err) {
        console.error('[NotificationCenter load]', err);
        setLoading(false);
      }
    }

    load();
    return () => { if (subscription) supabase.removeChannel(subscription); };
  }, []);

  // 탭/페이지 전환 시 선택 초기화
  useEffect(() => { setSelected(new Set()); }, [tab, page]);

  async function markAll() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const ids = displayed.filter(n => !n.read).map(n => n.id);
    if (ids.length === 0) return;
    await supabase.from('notifications').update({ read: true }).in('id', ids);
    setNotifs(ns => ns.map(n => ids.includes(n.id) ? { ...n, read: true } : n));
  }

  async function markOne(id, actionUrl) {
    await supabase.from('notifications').update({ read: true }).eq('id', id);
    setNotifs(ns => ns.map(n => n.id === id ? { ...n, read: true } : n));
    if (actionUrl) navigate(actionUrl);
  }

  function toggleOne(e, id) {
    e.stopPropagation();
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll(e) {
    e.stopPropagation();
    if (allPageSelected) {
      setSelected(prev => {
        const next = new Set(prev);
        pagedIds.forEach(id => next.delete(id));
        return next;
      });
    } else {
      setSelected(prev => new Set([...prev, ...pagedIds]));
    }
  }

  async function deleteSelected() {
    if (selected.size === 0) return;
    setDeleting(true);
    const ids = [...selected];
    const { error } = await supabase
      .from('notifications')
      .delete()
      .in('id', ids);
    if (!error) {
      setNotifs(ns => ns.filter(n => !ids.includes(n.id)));
      setSelected(new Set());
    } else {
      console.error('[deleteSelected]', error);
    }
    setDeleting(false);
  }

  const roleColor = role === 'company' ? 'var(--blue)' : role === 'panel' ? 'var(--green)' : 'var(--accent)';

  return (
    <div style={{ padding: '32px 36px', maxWidth: 560, animation: 'fadeUp 0.5s ease both' }}>
      {/* 헤더 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 12, fontFamily: 'var(--font-sans)', color: roleColor, marginBottom: 8, letterSpacing: '0.1em' }}>
            NOTIFICATIONS
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 800 }}>
            알림 센터
            {unread > 0 && (
              <span style={{ marginLeft: 10, fontSize: 14, fontFamily: 'var(--font-sans)', background: 'var(--red)', color: '#fff', padding: '2px 9px', borderRadius: 20, verticalAlign: 'middle' }}>
                {unread}
              </span>
            )}
          </h1>
        </div>
        {unread > 0 && (
          <Btn size="sm" variant="ghost" onClick={markAll}>모두 읽음</Btn>
        )}
      </div>

      {/* 어드민 탭 */}
      {role === 'admin' && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, borderBottom: '1px solid var(--border)' }}>
          {[
            { key: 'general', label: '일반 알림', count: generalUnread },
            { key: 'bugs', label: '버그 리포트', count: bugUnread },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); setPage(1); }}
              style={{
                padding: '8px 14px', border: 'none', background: 'none', cursor: 'pointer',
                fontSize: 13, fontWeight: tab === t.key ? 700 : 500,
                color: tab === t.key ? 'var(--text)' : 'var(--text-3)',
                borderBottom: tab === t.key ? '2px solid var(--text)' : '2px solid transparent',
                marginBottom: -1, transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              {t.label}
              {t.count > 0 && (
                <span style={{ background: 'var(--red)', color: '#fff', fontSize: 11, fontFamily: 'var(--font-sans)', padding: '1px 7px', borderRadius: 20 }}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-3)', fontFamily: 'var(--font-sans)', fontSize: 13 }}>
          로딩 중…
        </div>
      ) : displayed.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-3)' }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>🔔</div>
          <div style={{ fontWeight: 600, color: 'var(--text-2)' }}>알림이 없습니다</div>
        </div>
      ) : (
        <>
          {/* 목록 헤더 툴바 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, minHeight: 32 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', userSelect: 'none' }}>
              <input
                type="checkbox"
                checked={allPageSelected}
                onChange={toggleAll}
                style={{ width: 15, height: 15, accentColor: 'var(--accent)', cursor: 'pointer' }}
              />
              <span style={{ fontSize: 12, color: 'var(--text-3)' }}>전체 선택</span>
            </label>

            {someSelected ? (
              <>
                <span style={{ fontSize: 12, color: 'var(--text-2)', marginLeft: 4 }}>
                  {selected.size}개 선택됨
                </span>
                <button
                  onClick={deleteSelected}
                  disabled={deleting}
                  style={{ marginLeft: 'auto', padding: '4px 12px', borderRadius: 6, border: '1px solid #FCA5A5', background: '#FEF2F2', color: '#DC2626', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}
                >
                  {deleting ? '삭제 중…' : '삭제'}
                </button>
                <button
                  onClick={() => setSelected(new Set())}
                  style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-3)', fontSize: 12, cursor: 'pointer' }}
                >
                  선택 해제
                </button>
              </>
            ) : (
              <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-3)' }}>
                총 {displayed.length}개
              </span>
            )}
          </div>

          {/* 알림 목록 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {paged.map(n => (
              <div
                key={n.id}
                onClick={() => !selected.has(n.id) && markOne(n.id, n.action_url)}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10, padding: '11px 14px',
                  background: selected.has(n.id) ? 'var(--accent-dim2)' : n.read ? 'var(--surface)' : 'var(--surface-2)',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid ' + (selected.has(n.id) ? 'var(--accent-dim)' : n.read ? 'var(--border)' : 'var(--border-light)'),
                  cursor: selected.has(n.id) ? 'default' : 'pointer',
                  transition: 'all 0.15s', position: 'relative',
                }}
                onMouseEnter={e => { if (!selected.has(n.id)) e.currentTarget.style.borderColor = 'var(--border-light)'; }}
                onMouseLeave={e => { if (!selected.has(n.id)) e.currentTarget.style.borderColor = n.read ? 'var(--border)' : 'var(--border-light)'; }}
              >
                {/* 체크박스 */}
                <input
                  type="checkbox"
                  checked={selected.has(n.id)}
                  onChange={e => toggleOne(e, n.id)}
                  onClick={e => e.stopPropagation()}
                  style={{ marginTop: 2, width: 14, height: 14, accentColor: 'var(--accent)', cursor: 'pointer', flexShrink: 0 }}
                />

                {/* 아이콘 */}
                <div style={{
                  width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                  background: TYPE_BG[n.type] || 'var(--surface)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, color: TYPE_COLORS[n.type] || 'var(--text)',
                }}>
                  {n.icon}
                </div>

                {/* 내용 */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 2 }}>
                    <span style={{ fontWeight: n.read ? 500 : 700, fontSize: 13 }}>{n.title}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-sans)', flexShrink: 0, marginLeft: 10 }}>
                      {new Date(n.created_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.5, marginBottom: 0 }}>{n.body}</p>
                </div>

                {/* 읽지 않음 점 */}
                {!n.read && !selected.has(n.id) && (
                  <div style={{ position: 'absolute', top: 14, right: 14, width: 7, height: 7, borderRadius: '50%', background: 'var(--red)' }} />
                )}
              </div>
            ))}
          </div>

          {/* 페이지네이션 */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 4, marginTop: 20 }}>
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', cursor: page === 1 ? 'default' : 'pointer', color: page === 1 ? 'var(--text-3)' : 'var(--text)', fontSize: 13 }}
              >
                ‹
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid ' + (p === page ? 'var(--accent)' : 'var(--border)'), background: p === page ? 'var(--accent)' : 'var(--surface)', color: p === page ? '#fff' : 'var(--text)', cursor: 'pointer', fontSize: 13, fontWeight: p === page ? 700 : 400 }}
                >
                  {p}
                </button>
              ))}
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', cursor: page === totalPages ? 'default' : 'pointer', color: page === totalPages ? 'var(--text-3)' : 'var(--text)', fontSize: 13 }}
              >
                ›
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
