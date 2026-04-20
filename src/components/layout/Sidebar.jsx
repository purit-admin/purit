import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Bell, Plus, BarChart2, Layers, Columns2,
  Tag, Mail, FileText, Users, Activity, TrendingUp, Sparkles,
  Settings, CreditCard, Search, PlayCircle, Wallet, UserCog,
  Monitor, ClipboardList, ShieldCheck, PieChart, ChevronLeft, ChevronRight,
} from 'lucide-react';

const NAV = {
  company: [
    {
      group: '개요',
      items: [
        { path: '/company', label: '대시보드', icon: LayoutDashboard },
        { path: '/company/notifications', label: '알림', icon: Bell, badge: 2 },
      ],
    },
    {
      group: '검증 도구',
      items: [
        { path: '/company/new', label: '의뢰 등록', icon: Plus },
        { path: '/company/results', label: '피드백 결과', icon: BarChart2 },
        { path: '/company/diagnosis', label: '5차원 진단', icon: Layers },
        { path: '/company/preference', label: '소재 비교 A/B', icon: Columns2 },
        { path: '/company/pricing-test', label: '가격 페이지', icon: Tag },
        { path: '/company/email-test', label: '이메일 검증', icon: Mail },
        { path: '/company/templates', label: '질문 템플릿', icon: FileText },
      ],
    },
    {
      group: '인텔리전스',
      items: [
        { path: '/company/icp', label: 'ICP 리서치', icon: Users },
        { path: '/company/icp-pulse', label: 'ICP Pulse', icon: Activity },
        { path: '/company/brand', label: '브랜드 추적', icon: TrendingUp },
        { path: '/company/report', label: 'AI 리포트', icon: Sparkles },
      ],
    },
    {
      group: '계정',
      items: [
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
        { path: '/panel/notifications', label: '알림', icon: Bell, badge: 2 },
      ],
    },
    {
      group: '미션',
      items: [
        { path: '/panel/missions', label: '미션 탐색', icon: Search },
        { path: '/panel/active', label: '진행 중', icon: PlayCircle },
      ],
    },
    {
      group: '내 계정',
      items: [
        { path: '/panel/history', label: '수익 이력', icon: Wallet },
        { path: '/panel/profile', label: '프로필 설정', icon: UserCog },
      ],
    },
  ],
  admin: [
    {
      group: '개요',
      items: [
        { path: '/admin', label: '플랫폼 개요', icon: Monitor },
        { path: '/admin/notifications', label: '알림', icon: Bell, badge: 2 },
      ],
    },
    {
      group: '운영',
      items: [
        { path: '/admin/panels', label: '패널 관리', icon: Users },
        { path: '/admin/missions', label: '미션 관리', icon: ClipboardList },
        { path: '/admin/purity', label: 'Purity Filter', icon: ShieldCheck },
        { path: '/admin/revenue', label: '수익 & 정산', icon: PieChart },
      ],
    },
  ],
};

const ROLE_LABEL = { company: '기업', panel: '패널', admin: '어드민' };

export default function Layout({ role, children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const navGroups = NAV[role] || [];
  const [collapsed, setCollapsed] = useState(false);

  const isActive = (path) =>
    location.pathname === path ||
    (path !== `/${role}` && path !== `/${role}/notifications` && location.pathname.startsWith(path));

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      <aside style={{
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
              <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--text)', lineHeight: 1 }}>PURITY</div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 3 }}>{ROLE_LABEL[role]} 포털</div>
            </div>
          )}
          <button onClick={() => setCollapsed(c => !c)} style={{
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
        </div>

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
                  <button key={item.path} onClick={() => navigate(item.path)}
                    title={collapsed ? item.label : undefined}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center',
                      gap: 9, padding: collapsed ? '9px 0' : '8px 12px',
                      margin: '1px 0',
                      justifyContent: collapsed ? 'center' : 'flex-start',
                      background: active ? 'var(--surface)' : 'none',
                      color: active ? 'var(--text)' : 'var(--text-3)',
                      fontSize: 14, fontWeight: active ? 600 : 400,
                      borderRadius: collapsed ? 0 : 10,
                      marginLeft: collapsed ? 0 : 6,
                      marginRight: collapsed ? 0 : 6,
                      width: collapsed ? '100%' : 'calc(100% - 12px)',
                      boxShadow: active ? 'var(--shadow)' : 'none',
                      transition: 'all 0.12s ease', position: 'relative',
                      whiteSpace: 'nowrap', overflow: 'hidden',
                    }}
                    onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(0,0,0,0.04)'; }}
                    onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'none'; }}
                  >
                    <Icon size={16} strokeWidth={active ? 2 : 1.75} style={{ flexShrink: 0 }} />
                    {!collapsed && <span style={{ flex: 1, textAlign: 'left' }}>{item.label}</span>}
                    {!collapsed && item.badge && (
                      <span style={{
                        minWidth: 18, height: 18, borderRadius: 9,
                        background: 'var(--red)', color: '#fff',
                        fontSize: 11, fontWeight: 700,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        padding: '0 5px', flexShrink: 0,
                      }}>{item.badge}</span>
                    )}
                    {collapsed && item.badge && (
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

        {/* Role switcher */}
        <div style={{ padding: collapsed ? '10px 0' : '10px 8px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
          {!collapsed && (
            <div style={{ fontSize: 10, color: 'var(--text-3)', marginBottom: 6, paddingLeft: 6, letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600 }}>
              포털 전환
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: collapsed ? 'column' : 'row', gap: 4 }}>
            {['company', 'panel', 'admin'].map(r => (
              <button key={r} onClick={() => navigate(`/${r}`)}
                title={collapsed ? ROLE_LABEL[r] : undefined}
                style={{
                  flex: collapsed ? 'none' : 1,
                  padding: collapsed ? '8px 0' : '6px 0',
                  display: 'flex', alignItems: 'center', gap: 6,
                  justifyContent: 'center',
                  background: role === r ? 'var(--surface)' : 'none',
                  color: role === r ? 'var(--text)' : 'var(--text-3)',
                  borderRadius: 8, fontSize: 12,
                  fontWeight: role === r ? 600 : 400,
                  border: role === r ? '1px solid var(--border)' : '1px solid transparent',
                  transition: 'all 0.15s', cursor: 'pointer',
                }}>
                <span style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: role === r ? 'var(--text)' : 'var(--border)',
                  flexShrink: 0,
                }} />
                {!collapsed && ROLE_LABEL[r]}
              </button>
            ))}
          </div>
        </div>
      </aside>

      <main style={{ flex: 1, minHeight: '100vh', overflow: 'auto' }}>{children}</main>
    </div>
  );
}
