import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Bell, Plus, BarChart2, Layers, Columns2,
  Tag, Mail, FileText, Users, Activity, TrendingUp, Sparkles,
  Settings, CreditCard, Search, PlayCircle, Wallet, UserCog,
  Monitor, ClipboardList, ShieldCheck, PieChart, ChevronLeft, ChevronRight,
  LogOut, Menu, X as CloseIcon, Flag, Building2,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { navigationGuard } from '../../lib/navigationGuard';
import BugReportModal from '../ui/BugReportModal';
import { Card, Btn } from '../ui';

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
        { path: '/company/results', label: '피드백 결과', icon: BarChart2 },
        { path: '/company/templates', label: '질문 템플릿', icon: FileText },
        { path: '/company/diagnosis', label: '5대 지표 진단', icon: Layers },
        { path: '/company/report', label: 'AI 리포트', icon: Sparkles },
      ],
    },
    {
      group: '계정',
      items: [
        { path: '/company/account', label: '내 계정', icon: UserCog },
        { path: '/company/settings', label: '팀 & 설정', icon: Settings },
        { path: '/company/plans', label: '플랜 & 가격', icon: CreditCard },
        { path: '/company/bug-reports', label: '버그/건의 현황', icon: Flag },
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
        { path: '/panel/bug-reports', label: '버그/건의 현황', icon: Flag },
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
        { path: '/admin/trials', label: '체험 의뢰 관리', icon: Sparkles },
        { path: '/admin/companies', label: '기업 관리', icon: Building2 },
        { path: '/admin/panels', label: '패널 관리', icon: Users },
        { path: '/admin/missions', label: '미션 관리', icon: ClipboardList },
        { path: '/admin/purity', label: '피드백 관리', icon: ShieldCheck },
        { path: '/admin/revenue', label: '수익 & 정산', icon: PieChart },
        { path: '/admin/reports', label: '버그 리포트', icon: Flag },
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
  const [rejectedCount, setRejectedCount] = useState(0);
  const [pendingPanelCount, setPendingPanelCount] = useState(0);
  const [panelId, setPanelId] = useState(null);
  const [panelStatus, setPanelStatus] = useState(null);
  const [panelStatusLoaded, setPanelStatusLoaded] = useState(false);
  const [panelHasDocs, setPanelHasDocs] = useState(false);
  const [panelRejectionReason, setPanelRejectionReason] = useState('');
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 768px)').matches);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showBugReport, setShowBugReport] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    let sub;

    async function loadCount() {
      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('read', false)
        .or(`target_role.eq.${role},target_role.is.null`);
      setUnreadCount(count || 0);
    }

    loadCount();

    sub = supabase
      .channel(`sidebar-notif-badge-${user.id}-${Date.now()}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'notifications',
        filter: `user_id=eq.${user.id}`,
      }, loadCount)
      .subscribe();

    window.addEventListener('purit:notif-read', loadCount);

    return () => {
      if (sub) supabase.removeChannel(sub);
      window.removeEventListener('purit:notif-read', loadCount);
    };
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id || role !== 'panel') return;
    setPanelStatusLoaded(false);
    supabase.from('panels').select('id, status, rejection_reason, health_insurance_url, linkedin_url, portfolio_url, portfolio_file_url').eq('user_id', user.id).single()
      .then(({ data: p }) => {
        if (p) {
          setPanelId(p.id);
          setPanelStatus(p.status);
          setPanelRejectionReason(p.rejection_reason || '');
          setPanelHasDocs(!!(p.health_insurance_url || p.linkedin_url || p.portfolio_url || p.portfolio_file_url));
        }
        setPanelStatusLoaded(true);
      });
  }, [user?.id, role, location.pathname]);

  useEffect(() => {
    if (!panelId) return;
    let sub;

    async function loadRejected() {
      const now = new Date().toISOString();
      const { count } = await supabase
        .from('feedbacks')
        .select('*', { count: 'exact', head: true })
        .eq('panel_id', panelId)
        .eq('status', 'rejected')
        .eq('dismissed', false)
        .or(`rejection_deadline.is.null,rejection_deadline.gte.${now}`);
      setRejectedCount(count || 0);
    }

    loadRejected();
    sub = supabase
      .channel(`sidebar-rejected-badge-${panelId}-${Date.now()}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'feedbacks',
        filter: `panel_id=eq.${panelId}`,
      }, loadRejected)
      .subscribe();

    return () => { if (sub) supabase.removeChannel(sub); };
  }, [panelId]);

  // 어드민: 새로 가입한(아직 안 본) 심사대기 패널 수 뱃지
  useEffect(() => {
    if (!user?.id || role !== 'admin') return;
    let sub;
    const seenKey = `purit_admin_panels_seen_${user.id}`;

    async function loadPending() {
      // 패널 관리 페이지를 보고 있는 동안은 '본 것'으로 간주 → 뱃지 0
      if (window.location.pathname === '/admin/panels') { setPendingPanelCount(0); return; }
      let q = supabase
        .from('panels')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');
      const seenAt = localStorage.getItem(seenKey);
      if (seenAt) q = q.gt('created_at', seenAt);
      const { count } = await q;
      setPendingPanelCount(count || 0);
    }

    loadPending();
    // pending 패널 이벤트만 구독 — 무필터 시 패널 전원의 honor_points 등 모든 변경마다 재쿼리 발생
    sub = supabase
      .channel(`sidebar-pending-panels-${user.id}-${Date.now()}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'panels',
        filter: 'status=eq.pending',
      }, loadPending)
      .subscribe();

    return () => { if (sub) supabase.removeChannel(sub); };
  }, [user?.id, role]);

  // 패널 관리 페이지 방문 시 현재까지의 심사대기 패널을 '본 것'으로 표시 → 뱃지 초기화
  useEffect(() => {
    if (!user?.id || role !== 'admin') return;
    if (location.pathname === '/admin/panels') {
      localStorage.setItem(`purit_admin_panels_seen_${user.id}`, new Date().toISOString());
      setPendingPanelCount(0);
    }
  }, [location.pathname, role, user?.id]);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const handler = (e) => {
      setIsMobile(e.matches);
      if (!e.matches) setMobileOpen(false);
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const isExpanded = isMobile ? true : !collapsed;
  const sidebarWidth = isMobile ? 220 : (isExpanded ? 220 : 60);

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

      <aside
        className={`sidebar-drawer${mobileOpen ? ' is-open' : ''}`}
        style={{
          width: sidebarWidth, flexShrink: 0,
          background: '#FFFFFF',
          borderRight: '1px solid #E9ECF0',
          display: 'flex', flexDirection: 'column',
          transition: 'width 0.3s cubic-bezier(0.4,0,0.2,1)',
          position: 'sticky', top: 0, height: '100vh', zIndex: 10, overflow: 'hidden',
        }}
      >
        {/* Logo — 항상 렌더, maxWidth로 페이드 (조건부 마운트 제거로 레이아웃 점프 방지) */}
        <div style={{
          height: 68, padding: '0 14px',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', flexShrink: 0,
        }}>
          <div style={{
            overflow: 'hidden', flexShrink: 0,
            maxWidth: isExpanded ? 140 : 0,
            opacity: isExpanded ? 1 : 0,
            transition: 'max-width 0.3s cubic-bezier(0.4,0,0.2,1), opacity 0.22s ease',
          }}>
            <div style={{ whiteSpace: 'nowrap', fontSize: 19, fontWeight: 600, letterSpacing: '-0.01em', fontFamily: "'Lora', Georgia, serif", fontStyle: 'italic', color: 'var(--text)', lineHeight: 1 }}>Purit</div>
            <div style={{ whiteSpace: 'nowrap', fontSize: 11, color: 'var(--text-3)', marginTop: 3 }}>{ROLE_LABEL[role]} 포털</div>
          </div>
          {!isMobile && (
            <button className="sidebar-collapse-btn" onClick={() => setCollapsed(c => !c)}
              title={collapsed ? '사이드바 펼치기' : '사이드바 접기'}
              style={{
                marginLeft: 'auto', flexShrink: 0,
                background: 'var(--surface)',
                color: 'var(--text-3)',
                width: 28, height: 28, borderRadius: 8, border: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', transition: 'background 0.15s, color 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-3)'; e.currentTarget.style.color = 'var(--text)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface)'; e.currentTarget.style.color = 'var(--text-3)'; }}
            >
              {collapsed ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
            </button>
          )}
          {isMobile && (
            <button onClick={() => setMobileOpen(false)} style={{
              marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-3)', padding: 4,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <CloseIcon size={18} />
            </button>
          )}
        </div>

        {/* Admin portal switcher — 두 레이아웃 겹쳐서 cross-fade (조건부 렌더 제거) */}
        {authRole === 'admin' && (
          <div style={{ borderBottom: '1px solid var(--border)', flexShrink: 0, overflow: 'hidden' }}>
            {/* 접힘: 세로 아이콘 버튼 */}
            <div style={{
              display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center',
              padding: '8px 6px',
              maxHeight: isExpanded ? 0 : 100, opacity: isExpanded ? 0 : 1,
              overflow: 'hidden', pointerEvents: isExpanded ? 'none' : 'auto',
              transition: 'max-height 0.3s cubic-bezier(0.4,0,0.2,1), opacity 0.2s ease',
            }}>
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
            {/* 펼침: 가로 pill */}
            <div style={{
              padding: '8px 10px',
              maxHeight: isExpanded ? 80 : 0, opacity: isExpanded ? 1 : 0,
              overflow: 'hidden', pointerEvents: isExpanded ? 'auto' : 'none',
              transition: 'max-height 0.3s cubic-bezier(0.4,0,0.2,1), opacity 0.2s ease',
            }}>
              <div style={{ fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6, paddingLeft: 4 }}>포털 전환</div>
              <div style={{ display: 'flex', gap: 3, background: 'var(--bg)', borderRadius: 8, padding: 3, border: '1px solid var(--border)' }}>
                {[['admin', '어드민', '/admin'], ['company', '기업', '/company'], ['panel', '패널', '/panel']].map(([p, label, path]) => (
                  <button key={p} onClick={() => handleNav(path)}
                    style={{
                      flex: 1, padding: '5px 4px', borderRadius: 5, fontSize: 11, fontWeight: 600,
                      background: role === p ? 'var(--accent)' : 'transparent',
                      color: role === p ? '#FFFFFF' : 'var(--text-3)',
                      border: 'none', cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap',
                    }}
                    onMouseEnter={e => { if (role !== p) { e.currentTarget.style.background = 'var(--surface)'; e.currentTarget.style.color = 'var(--text)'; } }}
                    onMouseLeave={e => { if (role !== p) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-3)'; } }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Nav */}
        <nav style={{ flex: 1, padding: '10px 0', overflowY: 'auto', overflowX: 'hidden' }}>
          {navGroups.map((group, gi) => (
            <div key={group.group} style={{ marginBottom: 2 }}>
              {/* 그룹 레이블 — 항상 렌더, maxHeight로 애니메이션 (즉시 마운트로 인한 세로 텍스트 방지) */}
              <div style={{
                fontSize: 11, fontWeight: 600, color: 'var(--text-3)',
                textTransform: 'uppercase', letterSpacing: '0.06em',
                padding: isExpanded ? '12px 18px 4px' : '0 18px',
                maxHeight: isExpanded ? 40 : 0,
                opacity: isExpanded ? 1 : 0,
                overflow: 'hidden', whiteSpace: 'nowrap',
                transition: 'max-height 0.3s cubic-bezier(0.4,0,0.2,1), opacity 0.2s ease, padding 0.3s cubic-bezier(0.4,0,0.2,1)',
              }}>
                {group.group}
              </div>
              {/* 그룹 구분선 — 접혔을 때만 표시 */}
              {gi > 0 && (
                <div style={{
                  height: 1, background: 'var(--border)',
                  margin: isExpanded ? '0 10px' : '8px 10px',
                  maxHeight: isExpanded ? 0 : 1,
                  opacity: isExpanded ? 0 : 1,
                  overflow: 'hidden',
                  transition: 'max-height 0.3s cubic-bezier(0.4,0,0.2,1), opacity 0.2s ease, margin 0.3s',
                }} />
              )}
              {group.items.map(item => {
                const active = isActive(item.path);
                const Icon = item.icon;
                const badgeCount = item.path === `/${role}/notifications` ? unreadCount
                  : item.path === '/panel/missions' ? rejectedCount
                  : item.path === '/admin/panels' ? pendingPanelCount : 0;
                return (
                  <button key={item.path} onClick={() => handleNav(item.path)}
                    title={!isExpanded ? item.label : undefined}
                    style={{
                      width: 'calc(100% - 12px)',
                      display: 'flex', alignItems: 'center',
                      gap: isExpanded ? 9 : 0,
                      paddingTop: 8, paddingBottom: 8,
                      paddingLeft: isExpanded ? 12 : 16,
                      paddingRight: isExpanded ? 12 : 0,
                      margin: '1px 6px',
                      justifyContent: 'flex-start',
                      background: active ? 'var(--surface)' : 'none',
                      color: active ? 'var(--text)' : 'var(--text-3)',
                      fontSize: 14, fontWeight: active ? 600 : 400,
                      borderRadius: 10,
                      boxShadow: active ? 'var(--shadow)' : 'none',
                      transition: 'background 0.15s, padding-left 0.3s cubic-bezier(0.4,0,0.2,1), padding-right 0.3s cubic-bezier(0.4,0,0.2,1), gap 0.3s cubic-bezier(0.4,0,0.2,1)',
                      position: 'relative', border: 'none', cursor: 'pointer', overflow: 'hidden',
                    }}
                    onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(0,0,0,0.04)'; }}
                    onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'none'; }}
                  >
                    <Icon size={16} strokeWidth={active ? 2 : 1.75} style={{ flexShrink: 0 }} />
                    {/* maxWidth:0으로 공간 제거 → 아이콘 중앙 정렬 보장 */}
                    <span style={{
                      maxWidth: isExpanded ? 160 : 0,
                      opacity: isExpanded ? 1 : 0,
                      overflow: 'hidden', whiteSpace: 'nowrap',
                      transition: 'max-width 0.3s cubic-bezier(0.4,0,0.2,1), opacity 0.22s ease',
                    }}>{item.label}</span>
                    {/* 뱃지: pill(확장) ↔ dot(접힘) 전환 */}
                    {badgeCount > 0 && (
                      <span style={{
                        position: 'absolute',
                        right: isExpanded ? 12 : 8,
                        top: '50%', transform: 'translateY(-50%)',
                        minWidth: isExpanded ? 18 : 6,
                        height: isExpanded ? 18 : 6,
                        borderRadius: isExpanded ? 9 : '50%',
                        background: 'var(--red)', color: '#fff',
                        fontSize: 11, fontWeight: 700,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        padding: isExpanded ? '0 5px' : 0,
                        overflow: 'hidden',
                        transition: 'all 0.3s cubic-bezier(0.4,0,0.2,1)',
                      }}>
                        {isExpanded ? badgeCount : ''}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* 유저 정보 & 로그아웃 */}
        <div style={{ padding: '10px 6px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{
            maxHeight: isExpanded ? 28 : 0, opacity: isExpanded ? 1 : 0,
            overflow: 'hidden', whiteSpace: 'nowrap',
            fontSize: 12, color: 'var(--text-3)', paddingLeft: 6, marginBottom: isExpanded ? 4 : 0,
            transition: 'max-height 0.3s cubic-bezier(0.4,0,0.2,1), opacity 0.2s ease, margin 0.3s',
          }}>
            {user?.user_metadata?.name || user?.email}
          </div>
          <button
            onClick={() => setShowBugReport(true)}
            title={!isExpanded ? '버그 / 불편 신고' : undefined}
            style={{
              width: '100%', display: 'flex', alignItems: 'center',
              gap: isExpanded ? 8 : 0,
              paddingTop: 8, paddingBottom: 8,
              paddingLeft: isExpanded ? 10 : 15,
              paddingRight: isExpanded ? 10 : 0,
              justifyContent: 'flex-start',
              background: 'none', color: 'var(--text-3)',
              borderRadius: 8, fontSize: 13, fontWeight: 500,
              border: 'none', cursor: 'pointer', marginBottom: 2,
              transition: 'background 0.15s, padding-left 0.3s cubic-bezier(0.4,0,0.2,1), padding-right 0.3s cubic-bezier(0.4,0,0.2,1), gap 0.3s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.04)'}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}
          >
            <Flag size={14} strokeWidth={2} style={{ flexShrink: 0 }} />
            <span style={{ maxWidth: isExpanded ? 200 : 0, opacity: isExpanded ? 1 : 0, overflow: 'hidden', whiteSpace: 'nowrap', transition: 'max-width 0.3s cubic-bezier(0.4,0,0.2,1), opacity 0.22s ease' }}>버그 / 불편 신고</span>
          </button>
          <button
            onClick={handleSignOut}
            title={!isExpanded ? '로그아웃' : undefined}
            style={{
              width: '100%', display: 'flex', alignItems: 'center',
              gap: isExpanded ? 8 : 0,
              paddingTop: 8, paddingBottom: 8,
              paddingLeft: isExpanded ? 10 : 15,
              paddingRight: isExpanded ? 10 : 0,
              justifyContent: 'flex-start',
              background: 'none', color: 'var(--red)',
              borderRadius: 8, fontSize: 13, fontWeight: 500,
              border: 'none', cursor: 'pointer',
              transition: 'background 0.15s, padding-left 0.3s cubic-bezier(0.4,0,0.2,1), padding-right 0.3s cubic-bezier(0.4,0,0.2,1), gap 0.3s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--red-dim)'}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}
          >
            <LogOut size={15} strokeWidth={2} style={{ flexShrink: 0 }} />
            <span style={{ maxWidth: isExpanded ? 200 : 0, opacity: isExpanded ? 1 : 0, overflow: 'hidden', whiteSpace: 'nowrap', transition: 'max-width 0.3s cubic-bezier(0.4,0,0.2,1), opacity 0.22s ease' }}>로그아웃</span>
          </button>
        </div>

      </aside>

      {showBugReport && (
        <BugReportModal
          pageUrl={location.pathname}
          onClose={() => setShowBugReport(false)}
        />
      )}

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
          <span style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.01em', fontFamily: "'Lora', Georgia, serif", fontStyle: 'italic', color: 'var(--text)' }}>Purit</span>
          <div style={{ width: 34 }} />
        </div>
        <main style={{ flex: 1, background: '#F8FAFC' }}>
          {role === 'panel' && !panelStatusLoaded && !['/panel', '/panel/verify-docs', '/panel/notifications', '/panel/bug-reports'].includes(location.pathname)
            ? null
            : role === 'panel' && panelStatus === 'rejected' && !['/panel', '/panel/verify-docs', '/panel/notifications', '/panel/bug-reports'].includes(location.pathname)
            ? (
              <div className="page-wrap" style={{ padding: '40px 48px', maxWidth: 900 }}>
                <Card style={{ textAlign: 'center', padding: '48px 24px' }}>
                  <div style={{ fontSize: 36, marginBottom: 16 }}>📝</div>
                  <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>검증 서류가 반려되었습니다</h2>
                  {panelRejectionReason && (
                    <div style={{
                      fontSize: 13.5, color: '#78350F', background: '#FFFBEB', border: '1px solid #FCD34D',
                      borderRadius: 8, padding: '12px 16px', margin: '0 auto 20px', maxWidth: 480,
                      textAlign: 'left', lineHeight: 1.6, whiteSpace: 'pre-wrap',
                    }}>
                      <strong style={{ color: '#92400E' }}>거절 사유</strong><br />{panelRejectionReason}
                    </div>
                  )}
                  <p style={{ color: 'var(--text-2)', fontSize: 14, lineHeight: 1.7, marginBottom: 20 }}>
                    사유를 확인하고 서류를 보완하여 재제출해 주세요.
                  </p>
                  <Btn onClick={() => navigate('/panel/verify-docs')}>서류 재제출하기 →</Btn>
                </Card>
              </div>
            )
            : role === 'panel' && panelStatus === 'banned' && !['/panel', '/panel/notifications', '/panel/bug-reports'].includes(location.pathname)
            ? (
              <div className="page-wrap" style={{ padding: '40px 48px', maxWidth: 900 }}>
                <Card style={{ textAlign: 'center', padding: '48px 24px' }}>
                  <div style={{ fontSize: 36, marginBottom: 16 }}>🚫</div>
                  <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>계정이 영구 정지되었습니다</h2>
                  <p style={{ color: 'var(--text-2)', fontSize: 14, lineHeight: 1.7 }}>
                    누적 거절 횟수가 한도에 도달하여 이 계정으로는 더 이상 심사를 받을 수 없습니다.<br />
                    이의가 있으시면 운영팀에 문의해 주세요.
                  </p>
                </Card>
              </div>
            )
            : role === 'panel' && panelStatus === 'pending' && !['/panel', '/panel/verify-docs', '/panel/notifications', '/panel/bug-reports'].includes(location.pathname)
            ? (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: '60px 24px' }}>
                {panelHasDocs ? (
                  <div style={{
                    background: 'rgba(245,158,11,0.1)', border: '1px solid #F59E0B',
                    borderRadius: 10, padding: '12px 16px',
                    width: '100%', maxWidth: 560,
                    display: 'flex', alignItems: 'center', gap: 10,
                  }}>
                    <span style={{ fontSize: 20 }}>⏳</span>
                    <span style={{ fontSize: 14, color: 'var(--text-2)' }}>
                      <strong>심사 대기 중입니다.</strong> 검증 서류 검토 후 미션 참여가 활성화됩니다. (1–2 영업일 소요)
                    </span>
                  </div>
                ) : (
                  <Card style={{ padding: '28px 32px', width: '100%', maxWidth: 560, textAlign: 'center' }}>
                    <div style={{ fontSize: 30, marginBottom: 12 }}>📋</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
                      서비스 이용을 위한 경력 인증을 해주세요.
                    </div>
                    <div style={{ fontSize: 14, color: 'var(--text-2)', marginBottom: 20, lineHeight: 1.6 }}>
                      서류 검토 후 승인이 완료되면 미션 참여가 가능합니다.
                    </div>
                    <Btn onClick={() => navigate('/panel/verify-docs')}>서류 제출하기 →</Btn>
                  </Card>
                )}
              </div>
            )
            : role === 'panel' && panelStatus === 'suspended' && !['/panel', '/panel/notifications', '/panel/bug-reports', '/panel/history'].includes(location.pathname)
            ? (
              <div className="page-wrap" style={{ padding: '40px 48px', maxWidth: 900 }}>
                <Card style={{ textAlign: 'center', padding: '48px 24px' }}>
                  <div style={{ fontSize: 36, marginBottom: 16 }}>🚫</div>
                  <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>계정이 정지되었습니다</h2>
                  <p style={{ color: 'var(--text-2)', fontSize: 14, lineHeight: 1.7, marginBottom: 20 }}>
                    관리자에 의해 계정 활동이 정지되었습니다.<br />
                    정산 내역은 계속 확인하실 수 있습니다.
                  </p>
                  <Btn onClick={() => navigate('/panel/history')}>정산 내역 보기 →</Btn>
                </Card>
              </div>
            )
            : children
          }
        </main>
      </div>
    </div>
  );
}
