import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Bell, Plus, BarChart2, Layers, Columns2,
  Tag, Mail, FileText, Users, Activity, TrendingUp, Sparkles,
  Settings, CreditCard, Search, PlayCircle, Wallet, UserCog,
  Monitor, ClipboardList, ShieldCheck, PieChart, ChevronLeft, ChevronRight,
  LogOut, Menu, X as CloseIcon,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { navigationGuard } from '../../lib/navigationGuard';

const NAV = {
  company: [
    {
      group: '개요',
      items: [
        { path: '/company', label: '대시보드', icon: LayoutDashboard },
        { path: '/company/notifications', label: '알림', icon: Bell },
      ],
    },
    {
      group: '메인 의뢰',
      items: [
        { path: '/company/new', label: '의뢰 등록', icon: Plus },
      ],
    },
    {
      group: '서브 의뢰',
      items: [
        { path: '/company/preference', label: '소재 비교 A/B', icon: Columns2 },
        { path: '/company/pricing-test', label: '가격 페이지', icon: Tag },
        { path: '/company/email-test', label: '이메일 검증', icon: Mail },
      ],
    },
    {
      group: '자산',
      items: [
        { path: '/company/templates', label: '질문 템플릿', icon: FileText },
        { path: '/company/results', label: '피드백 결과', icon: BarChart2 },
        { path: '/company/diagnosis', label: '5차원 진단', icon: Layers },
        { path: '/company/report', label: 'AI 리포트', icon: Sparkles },
      ],
    },
    {
      group: '리서치',
      items: [
        { path: '/company/icp', label: 'ICP 리서치', icon: Users },
        { path: '/company/icp-pulse', label: 'ICP Pulse', icon: Activity },
        { path: '/company/brand', label: '브랜드 트래킹', icon: TrendingUp },
      ],
    },
    {
      group: '계정',
      items: [
        { path: '/company/account', label: '내 계정', icon: UserCog },
        { path: '/company/settings', label: '팀 & 설정', icon: Settings },
        { path: '/company/plans', label: '플랜 & 가격', icon: CreditCard },
      ],
    },
  ],
  panel: [
    {
      group: '개요',
      items: [
        { path: '/panel', label: '대시보드', icon: LayoutDashboard },
        { path: '/panel/notifications', label: '알림', icon: Bell },
      ],
    },
    {
      group: '미션',
      items: [
        { path: '/panel/missions', label: '미션 관리', icon: ClipboardList },
      ],
    },
    {
      group: '내 계정',
      items: [
        { path: '/panel/history', label: '정산 내역', icon: Wallet },
        { path: '/panel/profile', label: '프로필 설정', icon: UserCog },
      ],
    },
  ],
  admin: [
    {
      group: '개요',
      items: [
        { path: '/admin', label: '플랫폼 개요', icon: Monitor },
        { path: '/admin/notifications', label: '알림', icon: Bell },
      ],
    },
    {
      group: '운영',
      items: [
        { path: '/admin/panels', label: '패널 관리', icon: Users },
        { path: '/admin/missions', label: '미션 관리', icon: ClipboardList },
        { path: '/admin/purity', label: 'Purit Filter', icon: ShieldCheck },
        { path: '/admin/revenue', label: '수익 & 정산', icon: PieChart },
      ],
    },
    {
      group: '계정',
      items: [
        { path: '/admin/account', label: '내 계정', icon: UserCog },
      ],
    },
  ],
};

const ROLE_LABEL = { company: '기업', panel: '패널', admin: '어드민' };

export default function Layout({ role, children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, role: authRole, signOut } = useAuth();
  const navGroups = NAV[role] || [];
  const [collapsed, setCollapsed] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 768px)').matches);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    let sub;

    async function loadCount() {
      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('read', false);
      setUnreadCount(count || 0);
    }

    loadCount();

    sub = supabase
      .channel('sidebar-notif-badge')
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'notifications',
        filter: `user_id=eq.${user.id}`,
      }, loadCount)
      .subscribe();

    return () => { if (sub) supabase.removeChannel(sub); };
  }, [user?.id]);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const handler = (e) => {
      setIsMobile(e.matches);
      if (!e.matches) setMobileOpen(false);
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const handleSignOut = async () => {
    await signOut();
    setMobileOpen(false);
    navigate('/login', { replace: true });
  };

  const handleNav = (path) => {
    if (!navigationGuard.intercept(path)) {
      navigate(path);
      if (isMobile) setMobileOpen(false);
    }
  };

  const isActive = (path) =>
    location.pathname === path ||
    (path !== `/${role}` && path !== `/${role}/notifications` && location.pathname.startsWith(path));

  return (
    <div className="sidebar-layout-root" style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      {/* 모바일 백드롭 */}
      <div
        className={`sidebar-backdrop${mobileOpen ? ' is-open' : ''}`}
        onClick={() => setMobileOpen(false)}
      />

      <aside className={`sidebar-drawer${mobileOpen ? ' is-open' : ''}`} style={{
        width: collapsed ? 60 : 220, flexShrink: 0,
        background: 'var(--bg-2)',
        borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column',
        transition: 'width 0.22s cubic-bezier(0.22,1,0.36,1)',
        position: 'sticky', top: 0, height: '100vh', zIndex: 10, overflow: 'hidden',
      }}>
        {/* Logo */}
        <div style={{
          padding: collapsed ? '18px 0' : '20px 18px',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'space-between', flexShrink: 0,
        }}>
          {!collapsed && (
            <div>
              <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--text)', lineHeight: 1 }}>PURIT</div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 3 }}>{ROLE_LABEL[role]} 포털</div>
            </div>
          )}
          <button className="sidebar-collapse-btn" onClick={() => setCollapsed(c => !c)} style={{
            background: 'var(--surface)', color: 'var(--text-3)',
            width: 28, height: 28, borderRadius: 8,
            border: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', flexShrink: 0, transition: 'background 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-3)'}
          onMouseLeave={e => e.currentTarget.style.background = 'var(--surface)'}
          >
            {collapsed
              ? <ChevronRight size={14} />
              : <ChevronLeft size={14} />
            }
          </button>
          {isMobile && (
            <button onClick={() => setMobileOpen(false)} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-3)', padding: 4,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <CloseIcon size={18} />
            </button>
          )}
        </div>

        {/* Admin portal switcher */}
        {authRole === 'admin' && (
          <div style={{ padding: collapsed ? '8px 6px' : '8px 10px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
            {collapsed ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
                {[['admin', 'AD', '/admin'], ['company', 'CO', '/company'], ['panel', 'PN', '/panel']].map(([p, abbr, path]) => (
                  <button key={p} onClick={() => handleNav(path)} title={ROLE_LABEL[p] + ' 포털'}
                    style={{
                      width: 36, height: 22, borderRadius: 5, fontSize: 10, fontWeight: 700,
                      background: role === p ? 'var(--accent)' : 'var(--surface)',
                      color: role === p ? '#FFFFFF' : 'var(--text-3)',
                      border: '1px solid ' + (role === p ? 'transparent' : 'var(--border)'),
                      cursor: 'pointer', transition: 'all 0.15s',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                    {abbr}
                  </button>
                ))}
              </div>
            ) : (
              <>
                <div style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6, paddingLeft: 4 }}>
                  포털 전환
                </div>
                <div style={{ display: 'flex', gap: 3, background: 'var(--bg)', borderRadius: 8, padding: 3, border: '1px solid var(--border)' }}>
                  {[['admin', '어드민', '/admin'], ['company', '기업', '/company'], ['panel', '패널', '/panel']].map(([p, label, path]) => (
                    <button key={p} onClick={() => handleNav(path)}
                      style={{
                        flex: 1, padding: '5px 4px', borderRadius: 5, fontSize: 11, fontWeight: 600,
                        background: role === p ? 'var(--accent)' : 'transparent',
                        color: role === p ? '#FFFFFF' : 'var(--text-3)',
                        border: 'none', cursor: 'pointer', transition: 'all 0.15s',
                      }}
                      onMouseEnter={e => { if (role !== p) { e.currentTarget.style.background = 'var(--surface)'; e.currentTarget.style.color = 'var(--text)'; } }}
                      onMouseLeave={e => { if (role !== p) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-3)'; } }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Nav */}
        <nav style={{ flex: 1, padding: '10px 0', overflowY: 'auto', overflowX: 'hidden' }}>
          {navGroups.map((group, gi) => (
            <div key={group.group} style={{ marginBottom: 2 }}>
              {!collapsed && (
                <div style={{
                  fontSize: 11, fontWeight: 600, color: 'var(--text-3)',
                  textTransform: 'uppercase', letterSpacing: '0.06em',
                  padding: '12px 18px 4px',
                }}>
                  {group.group}
                </div>
              )}
              {collapsed && gi > 0 && (
                <div style={{ height: 1, background: 'var(--border)', margin: '8px 10px' }} />
              )}
              {group.items.map(item => {
                const active = isActive(item.path);
                const Icon = item.icon;
                return (
                  <button key={item.path} onClick={() => handleNav(item.path)}
                    title={collapsed ? item.label : undefined}
                    style={{
                      width: collapsed ? '100%' : 'calc(100% - 12px)', display: 'flex', alignItems: 'center',
                      gap: 9, padding: collapsed ? '9px 0' : '8px 12px',
                      margin: '1px 0',
                      justifyContent: collapsed ? 'center' : 'flex-start',
                      background: active ? 'var(--surface)' : 'none',
                      color: active ? 'var(--text)' : 'var(--text-3)',
                      fontSize: 14, fontWeight: active ? 600 : 400,
                      borderRadius: collapsed ? 0 : 10,
                      marginLeft: collapsed ? 0 : 6,
                      marginRight: collapsed ? 0 : 6,
                      boxShadow: active ? 'var(--shadow)' : 'none',
                      transition: 'all 0.12s ease', position: 'relative',
                      whiteSpace: 'nowrap', overflow: 'hidden',
                    }}
                    onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(0,0,0,0.04)'; }}
                    onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'none'; }}
                  >
                    <Icon size={16} strokeWidth={active ? 2 : 1.75} style={{ flexShrink: 0 }} />
                    {!collapsed && <span style={{ flex: 1, textAlign: 'left' }}>{item.label}</span>}
                    {!collapsed && item.path === `/${role}/notifications` && unreadCount > 0 && (
                      <span style={{
                        minWidth: 18, height: 18, borderRadius: 9,
                        background: 'var(--red)', color: '#fff',
                        fontSize: 11, fontWeight: 700,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        padding: '0 5px', flexShrink: 0,
                      }}>{unreadCount}</span>
                    )}
                    {collapsed && item.path === `/${role}/notifications` && unreadCount > 0 && (
                      <div style={{
                        position: 'absolute', top: 7, right: 10,
                        width: 6, height: 6, borderRadius: '50%', background: 'var(--red)',
                      }} />
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* 유저 정보 & 로그아웃 */}
        <div style={{ padding: collapsed ? '10px 0' : '10px 10px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
          {!collapsed && user && (
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 8, paddingLeft: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user.user_metadata?.name || user.email}
            </div>
          )}
          <button
            onClick={handleSignOut}
            title={collapsed ? '로그아웃' : undefined}
            style={{
              width: '100%', display: 'flex', alignItems: 'center',
              gap: 8, padding: collapsed ? '9px 0' : '8px 10px',
              justifyContent: collapsed ? 'center' : 'flex-start',
              background: 'none', color: 'var(--red)',
              borderRadius: 8, fontSize: 13, fontWeight: 500,
              border: 'none', cursor: 'pointer', transition: 'background 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--red-dim)'}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}
          >
            <LogOut size={15} strokeWidth={2} style={{ flexShrink: 0 }} />
            {!collapsed && '로그아웃'}
          </button>
        </div>

      </aside>

      <div style={{ flex: 1, minHeight: '100vh', overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
        {/* 모바일 탑바 — 데스크탑에서는 CSS로 숨김 */}
        <div className="mobile-topbar">
          <button
            onClick={() => setMobileOpen(true)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text)', padding: 6,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            aria-label="메뉴 열기"
          >
            <Menu size={22} />
          </button>
          <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--text)' }}>PURIT</span>
          <div style={{ width: 34 }} />
        </div>
        <main style={{ flex: 1 }}>{children}</main>
      </div>
    </div>
  );
}
