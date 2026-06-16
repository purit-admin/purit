import { useEffect, useState, useRef } from 'react';
import ReactDOM from 'react-dom';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { Card, Badge, Btn, ConfirmModal, StatusTabs, SegmentFilter } from '../../components/ui';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { getHonorLevel, HONOR_COLOR_META } from '../../lib/honorLevels';
import { sendNotification } from '../../lib/notify';

const DETAIL_PAGE_SIZE = 5;

const PAGE_SIZE = 10;

const scoreColor = s => s >= 80 ? '#059669' : s >= 60 ? 'var(--accent)' : '#DC2626';

const MISSION_TYPE_LABEL = {
  landing_page: 'LP 검증',
  preference: '소재 비교',
  pricing: '가격 검증',
  email: '이메일 검증',
};

function relativeTime(iso) {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (h < 1) return '방금';
  if (h < 24) return `${h}시간 전`;
  if (d < 7) return `${d}일 전`;
  if (d < 30) return `${Math.floor(d / 7)}주 전`;
  return new Date(iso).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
}

function periodStart(period) {
  const now = new Date();
  if (period === 'today') return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  if (period === 'week')  return new Date(now.getTime() - 7  * 86400000).toISOString();
  if (period === 'month') return new Date(now.getTime() - 30 * 86400000).toISOString();
  return null;
}

function getFlag(panel, stats) {
  const s = stats[panel.id];
  const trust = panel.trust_score || 0;
  if (trust < 40) return 'danger';
  if (s && s.total >= 3 && s.rejected / s.total > 0.5) return 'danger';
  if (trust >= 80 && s && s.total >= 3 && s.passRate >= 80) return 'star';
  return 'none';
}

const PERIOD_LABEL = { all: '전체', today: '오늘', week: '1주일', month: '1개월' };

export default function AdminPanels() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  // 피드백 관리로 이동 후 뒤로가기 시 보던 위치(선택 패널·페이지·필터) 복원용 — 1회성
  const [restored] = useState(() => {
    try {
      const raw = sessionStorage.getItem('purit_panelmgmt_return');
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  });
  const searchInited = useRef(false);
  const selectInited = useRef(false);
  const [panels, setPanels]             = useState([]);
  const [feedbackStats, setFeedbackStats] = useState({});
  const [panelFeedbacks, setPanelFeedbacks] = useState([]);
  const [loading, setLoading]           = useState(true);
  const [statsLoading, setStatsLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selected, setSelected]         = useState(restored?.selected || null);
  const [acting, setActing]             = useState(false);
  const [actionMsg, setActionMsg]       = useState('');
  const [page, setPage]                 = useState(restored?.page || 1);
  const [feedbackDetailPage, setFeedbackDetailPage] = useState(restored?.feedbackDetailPage || 1);
  const [searchInput, setSearchInput]   = useState(restored?.searchInput || '');
  const [searchQuery, setSearchQuery]   = useState(restored?.searchInput || '');
  const [statusFilter, setStatusFilter] = useState(restored?.statusFilter || 'all');
  const [levelFilter, setLevelFilter]   = useState(restored?.levelFilter || 'all');
  const [periodFilter, setPeriodFilter] = useState(restored?.periodFilter || 'all');
  const [riskFilter, setRiskFilter]     = useState(restored?.riskFilter || 'all');
  const [sortBy, setSortBy]             = useState(restored?.sortBy || 'joined_desc');

  useEffect(() => { load(); }, []);
  useEffect(() => { loadStats(periodFilter); }, [periodFilter]);
  useEffect(() => {
    const t = setTimeout(() => {
      setSearchQuery(searchInput);
      // 마운트 첫 실행(복원)에서는 페이지 리셋 생략 — 복원된 page 보존
      if (searchInited.current) setPage(1);
      else searchInited.current = true;
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);
  useEffect(() => {
    if (selected) loadPanelDetail(selected);
    else setPanelFeedbacks([]);
    // 마운트 첫 실행(복원)에서는 상세 페이지 리셋 생략 — 복원된 feedbackDetailPage 보존
    if (selectInited.current) setFeedbackDetailPage(1);
    else selectInited.current = true;
  }, [selected]);

  // 복원값 1회 소비 — 새로고침/사이드바 재진입 시 재적용 방지 (초기화 effect는 순수성 위해 분리)
  useEffect(() => {
    try { sessionStorage.removeItem('purit_panelmgmt_return'); } catch {}
  }, []);

  // 딥링크 — 피드백 관리(PurityFilter)에서 패널 닉네임 클릭 시 해당 패널 자동 선택
  useEffect(() => {
    if (loading) return;
    const targetId = location.state?.panelId;
    if (!targetId) return;
    const target = panels.find(p => p.id === targetId);
    if (!target) return;
    // 필터·정렬 초기화 → 대상 패널이 목록에 보이도록 + 해당 페이지로 이동
    setStatusFilter('all'); setLevelFilter('all'); setRiskFilter('all');
    setSearchInput(''); setSearchQuery(''); setSortBy('joined_desc');
    const sorted = [...panels].sort((a, b) => (b.created_at || '') > (a.created_at || '') ? 1 : -1);
    const idx = sorted.findIndex(p => p.id === targetId);
    if (idx !== -1) setPage(Math.floor(idx / PAGE_SIZE) + 1);
    setSelected(targetId);
    setActionMsg('');
    window.history.replaceState({}, '', location.pathname);
  }, [loading, location.state?.panelId]); // eslint-disable-line react-hooks/exhaustive-deps

  // 알림 클릭 딥링크: ?panelId=xxx 쿼리 파라미터 처리
  // (알림은 문자열 URL로만 이동 → location.state를 못 받으므로 쿼리 경로가 필수)
  useEffect(() => {
    if (loading) return;
    const targetId = searchParams.get('panelId');
    if (!targetId) return;
    const target = panels.find(p => p.id === targetId);
    if (!target) return;
    // 필터·정렬 초기화 → 대상 패널이 목록에 보이도록 + 해당 페이지로 이동
    setStatusFilter('all'); setLevelFilter('all'); setRiskFilter('all');
    setSearchInput(''); setSearchQuery(''); setSortBy('joined_desc');
    const sorted = [...panels].sort((a, b) => (b.created_at || '') > (a.created_at || '') ? 1 : -1);
    const idx = sorted.findIndex(p => p.id === targetId);
    if (idx !== -1) setPage(Math.floor(idx / PAGE_SIZE) + 1);
    setSelected(targetId);
    setActionMsg('');
    navigate(location.pathname, { replace: true });
  }, [loading, searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('panels')
        .select('id, user_id, name, email, industry, experience, experience_years, experience_confirmed_at, is_executive, bio, expertise, trust_score, honor_points, honor_decay_applied_at, selected_badge, badges, streak_count, total_missions, status, suspend_until, rejection_count, rejection_reason, phone, phone_verified, health_insurance_url, linkedin_url, portfolio_url, portfolio_file_url, created_at')
        .order('created_at', { ascending: false });
      if (!error) setPanels(data || []);
      setLoading(false);
    } catch (err) {
      console.error('[PanelManagement load]', err);
      setLoading(false);
    }
  }

  async function loadStats(period) {
    setStatsLoading(true);
    try {
      let query = supabase
        .from('feedbacks')
        .select('panel_id, created_at, status, purity_passed')
        .neq('status', 'draft')
        .limit(2000);
      const from = periodStart(period);
      if (from) query = query.gte('created_at', from);
      const { data } = await query;

      const stats = {};
      (data || []).forEach(f => {
        if (!stats[f.panel_id]) stats[f.panel_id] = { total: 0, passed: 0, rejected: 0, lastAt: null };
        stats[f.panel_id].total++;
        if (f.purity_passed) stats[f.panel_id].passed++;
        if (f.status === 'rejected') stats[f.panel_id].rejected++;
        if (!stats[f.panel_id].lastAt || f.created_at > stats[f.panel_id].lastAt) {
          stats[f.panel_id].lastAt = f.created_at;
        }
      });
      Object.values(stats).forEach(s => {
        s.passRate = s.total > 0 ? Math.round(s.passed / s.total * 100) : 0;
      });
      setFeedbackStats(stats);
    } catch (err) {
      console.error('[PanelManagement loadStats]', err);
    }
    setStatsLoading(false);
  }

  async function loadPanelDetail(panelId) {
    setDetailLoading(true);
    try {
      const { data, error } = await supabase
        .from('feedbacks')
        .select('id, created_at, status, purity_passed, missions(title, type)')
        .eq('panel_id', panelId)
        .neq('status', 'draft')
        .order('created_at', { ascending: false });
      if (error) {
        console.error('[PanelManagement loadPanelDetail] Supabase 오류:', error.message, error.details, error.hint);
      }
      setPanelFeedbacks(data || []);
    } catch (err) {
      console.error('[PanelManagement loadPanelDetail]', err);
    }
    setDetailLoading(false);
  }

  async function updatePanel(id, fields) {
    setActing(true);
    const { error, count } = await supabase.from('panels').update(fields, { count: 'exact' }).eq('id', id);
    if (error) {
      setActionMsg('저장 실패: ' + error.message);
      setActing(false);
      return;
    }
    if (count === 0) {
      setActionMsg('저장 실패: 권한이 없습니다.');
      setActing(false);
      return;
    }
    const targetPanel = panels.find(p => p.id === id);
    if (targetPanel?.user_id) {
      // 첫 심사 승인(pending → active)
      if (fields.status === 'active' && targetPanel.status === 'pending') {
        sendNotification(targetPanel.user_id, {
          type: 'success',
          icon: '🎉',
          title: '전문 마케터로 승인되었습니다!',
          body: 'Purit이 인증한 마케터로 공식 합류하셨습니다. 실제 기업의 랜딩페이지·광고 소재를 전문가 시각으로 진단하고, 더 나은 마케팅을 함께 만들어 나가요.',
          actionUrl: '/panel/missions',
          targetRole: 'panel',
        }).catch(err => console.warn('[updatePanel] 승인 알림 실패:', err));
      }
      // 심사 반려 (pending → rejected) — 사유 안내 + 재제출 가능
      if (fields.status === 'rejected' && targetPanel.status === 'pending') {
        const reasonLine = fields.rejection_reason
          ? `\n\n[거절 사유] ${fields.rejection_reason}`
          : '';
        sendNotification(targetPanel.user_id, {
          type: 'warning',
          icon: '📝',
          title: '검증 서류가 반려되었습니다',
          body: `심사 서류가 반려되었습니다. 아래 사유를 확인하고 서류를 보완하여 재제출해 주세요.${reasonLine}`,
          actionUrl: '/panel',
          targetRole: 'panel',
        }).catch(err => console.warn('[updatePanel] 반려 알림 실패:', err));
      }
      // 영구 차단 (누적 3회 거절 → banned)
      if (fields.status === 'banned') {
        const reasonLine = fields.rejection_reason
          ? `\n\n[거절 사유] ${fields.rejection_reason}`
          : '';
        sendNotification(targetPanel.user_id, {
          type: 'warning',
          icon: '🚫',
          title: '계정이 영구 정지되었습니다',
          body: `누적 거절 횟수가 한도에 도달하여 이 계정으로는 더 이상 심사를 받을 수 없습니다. 이의가 있으시면 버그/불편 신고에서 문의해 주세요.${reasonLine}`,
          actionUrl: '/panel',
          targetRole: 'panel',
        }).catch(err => console.warn('[updatePanel] 영구 차단 알림 실패:', err));
      }
      // 차단 해제 (banned → rejected) — 재심사 기회 부여
      if (fields.status === 'rejected' && targetPanel.status === 'banned') {
        sendNotification(targetPanel.user_id, {
          type: 'info',
          icon: '🔓',
          title: '재심사 기회가 부여되었습니다',
          body: '관리자가 계정 차단을 해제했습니다. 검증 서류를 다시 제출하면 재심사를 받을 수 있습니다.',
          actionUrl: '/panel/verify-docs',
          targetRole: 'panel',
        }).catch(err => console.warn('[updatePanel] 차단 해제 알림 실패:', err));
      }
      // 계정 정지 (활성 계정의 임시 정지 / 영구 정지)
      if (fields.status === 'suspended') {
        const isTimed = !!fields.suspend_until;
        let title, body;
        if (isTimed) {
          const until = new Date(fields.suspend_until);
          const daysLeft = Math.round((until.getTime() - Date.now()) / 86400000);
          const untilStr = until.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });
          title = `${daysLeft}일 임시 정지되었습니다`;
          body  = `계정이 ${daysLeft}일간 임시 정지되었습니다. ${untilStr}에 자동으로 해제됩니다.`;
        } else {
          title = '계정이 영구 정지되었습니다';
          body  = '계정 이용이 영구 정지되었습니다. 사유가 있으시면 버그/불편 신고에서 문의해 주세요.';
        }
        sendNotification(targetPanel.user_id, {
          type: 'warning',
          icon: '🚫',
          title,
          body,
          actionUrl: '/panel',
          targetRole: 'panel',
        }).catch(err => console.warn('[updatePanel] 정지 알림 실패:', err));
      }
      // 계정 재활성화 (suspended → active)
      if (fields.status === 'active' && targetPanel.status === 'suspended') {
        sendNotification(targetPanel.user_id, {
          type: 'success',
          icon: '✅',
          title: '계정 정지가 해제되었습니다',
          body: '계정이 다시 활성화되었습니다. 미션 탐색 페이지에서 새로운 의뢰에 참여할 수 있습니다.',
          actionUrl: '/panel/missions',
          targetRole: 'panel',
        }).catch(err => console.warn('[updatePanel] 재활성화 알림 실패:', err));
      }
    }
    setPanels(ps => ps.map(p => p.id === id ? { ...p, ...fields } : p));
    setActing(false);
    return true;
  }

  async function confirmExperience(id, years) {
    // 헤드(구 C레벨/임원)는 연차 15년차 이상 자동 부여 — 어드민 수동 지정 폐지
    const { data, error } = await supabase.rpc('admin_confirm_panel_experience', {
      p_panel_id: id,
      p_years: years,
    });
    if (error || data === false) {
      console.warn('[confirmExperience]', error?.message || '권한 또는 입력 오류');
      return false;
    }
    const isHead = years >= 15;
    setPanels(ps => ps.map(p => p.id === id
      ? { ...p, experience_years: years, is_executive: isHead, experience: `${years}년`, experience_confirmed_at: new Date().toISOString() }
      : p));
    return true;
  }

  // 필터 + 정렬
  const filtered = panels
    .filter(p => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        if (!(p.name || '').toLowerCase().includes(q)) return false;
      }
      const status = p.status || 'active';
      if (statusFilter !== 'all' && status !== statusFilter) return false;
      if (levelFilter !== 'all') {
        const lv = getHonorLevel(p.honor_points ?? 0).level;
        if (levelFilter === '1-3'  && !(lv >= 1 && lv <= 3)) return false;
        if (levelFilter === '4-6'  && !(lv >= 4 && lv <= 6)) return false;
        if (levelFilter === '7-9'  && !(lv >= 7 && lv <= 9)) return false;
        if (levelFilter === '10'   && lv !== 10) return false;
      }
      if (riskFilter !== 'all') {
        if (getFlag(p, feedbackStats) !== riskFilter) return false;
      }
      return true;
    })
    .sort((a, b) => {
      const sa = feedbackStats[a.id] || { total: 0, passRate: 0, lastAt: null };
      const sb = feedbackStats[b.id] || { total: 0, passRate: 0, lastAt: null };
      if (sortBy === 'joined_desc')  return (b.created_at || '') > (a.created_at || '') ? 1 : -1;
      if (sortBy === 'recent')       return (sb.lastAt || '') > (sa.lastAt || '') ? 1 : -1;
      if (sortBy === 'most')         return sb.total - sa.total;
      if (sortBy === 'least')        return sa.total - sb.total;
      if (sortBy === 'passrate_desc') return sb.passRate - sa.passRate;
      if (sortBy === 'passrate_asc')  return sa.passRate - sb.passRate;
      if (sortBy === 'trust_desc')   return (b.trust_score || 0) - (a.trust_score || 0);
      if (sortBy === 'level_desc')   return (b.honor_points || 0) - (a.honor_points || 0);
      return 0;
    });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const panel = selected ? panels.find(p => p.id === selected) : null;

  const pendingCount = panels.filter(p => (p.status || 'active') === 'pending').length;
  const activeCount  = panels.filter(p => (p.status || 'active') === 'active').length;
  const dangerCount  = panels.filter(p => getFlag(p, feedbackStats) === 'danger').length;
  const starCount    = panels.filter(p => getFlag(p, feedbackStats) === 'star').length;

  const colHeader = `제출(${PERIOD_LABEL[periodFilter]})`;

  if (loading) return (
    <div style={{ padding: '40px 48px', color: 'var(--text-3)', fontSize: 14 }}>불러오는 중...</div>
  );

  return (
    <div className="page-wrap" style={{ padding: '40px 48px', fontFamily: 'var(--font-ui)' }}>
      {/* 헤더 */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
          ADMIN · PANEL MANAGEMENT
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--text)', margin: 0 }}>패널 관리</h1>
        <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 6, marginBottom: 0 }}>
          패널 활동 현황을 기간별로 조회하고 위험·우수 패널을 식별합니다.
        </p>
      </div>

      {/* 통계 카드 */}
      <div className="stat-inline-four" style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 1, background: 'var(--border)',
        borderRadius: 'var(--radius-lg)', overflow: 'hidden', marginBottom: 24,
      }}>
        {[
          { label: '전체 패널',   value: panels.length,  color: 'var(--text)' },
          { label: '활성',        value: activeCount,    color: 'var(--text)' },
          { label: '⚠️ 위험 패널', value: dangerCount,   color: dangerCount > 0 ? '#DC2626' : 'var(--text)' },
          { label: '⭐ 우수 패널', value: starCount,      color: starCount > 0  ? '#059669' : 'var(--text)' },
        ].map(s => (
          <div key={s.label} style={{ background: '#fff', padding: '20px 24px' }}>
            <div style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>{s.label}</div>
            <div style={{ fontSize: 32, fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* 상태 탭 */}
      <StatusTabs
        value={statusFilter}
        onChange={v => { setStatusFilter(v); setPage(1); }}
        tabs={[
          { key: 'all', label: '전체' },
          { key: 'active', label: '활성' },
          {
            key: 'pending', label: '심사대기',
            badge: pendingCount > 0 ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 16, height: 16, padding: '0 4px', borderRadius: 8, background: 'var(--red)', color: '#fff', fontSize: 10, fontWeight: 700 }}>{pendingCount}</span>
            ) : null,
          },
          { key: 'rejected', label: '반려' },
          { key: 'suspended', label: '정지' },
          { key: 'banned', label: '영구정지' },
        ]}
      />

      {/* 검색 + 필터 바 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          type="text"
          placeholder="패널명 검색..."
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          style={{
            padding: '6px 12px', borderRadius: 8, fontSize: 12, width: 180,
            border: '1px solid var(--border)', background: '#fff',
            color: 'var(--text)', outline: 'none',
          }}
        />
        {/* 기간 */}
        <SegmentFilter
          value={periodFilter}
          onChange={v => { setPeriodFilter(v); setPage(1); }}
          tabs={[
            { key: 'all', label: '전체 기간' }, { key: 'today', label: '오늘' },
            { key: 'week', label: '1주일' }, { key: 'month', label: '1개월' },
          ]}
          style={{ marginBottom: 0 }}
        />

        {/* 분류 (위험/우수) */}
        <SegmentFilter
          value={riskFilter}
          onChange={v => { setRiskFilter(v); setPage(1); }}
          tabs={[
            { key: 'all', label: '전체' }, { key: 'danger', label: '⚠️ 위험' }, { key: 'star', label: '⭐ 우수' },
          ]}
          style={{ marginBottom: 0 }}
        />

        {/* 레벨 */}
        <SegmentFilter
          value={levelFilter}
          onChange={v => { setLevelFilter(v); setPage(1); }}
          tabs={[
            { key: 'all', label: '전체 레벨' }, { key: '1-3', label: 'Lv.1-3' }, { key: '4-6', label: 'Lv.4-6' },
            { key: '7-9', label: 'Lv.7-9' }, { key: '10', label: 'Lv.10' },
          ]}
          style={{ marginBottom: 0 }}
        />

        {/* 정렬 */}
        <select
          value={sortBy}
          onChange={e => { setSortBy(e.target.value); setPage(1); }}
          style={{
            marginLeft: 'auto', padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 500,
            border: '1px solid var(--border)', background: '#fff', color: 'var(--text)',
            cursor: 'pointer', outline: 'none',
          }}
        >
          <option value="joined_desc">최근 가입순</option>
          <option value="recent">최근 활동순</option>
          <option value="most">제출 많은 순</option>
          <option value="least">제출 적은 순</option>
          <option value="passrate_desc">통과율 높은 순</option>
          <option value="passrate_asc">통과율 낮은 순</option>
          <option value="trust_desc">Trust 높은 순</option>
          <option value="level_desc">레벨 높은 순</option>
        </select>
      </div>

      {/* 본문 */}
      <div className="panel-mgmt-layout" style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 360px' : '1fr', gap: 20 }}>

        {/* 테이블 */}
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-scroll">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg)' }}>
                  {['', '이름', '직군 / 경력', 'Trust', '레벨', colHeader, '통과율', '최근 활동', '상태'].map(h => (
                    <th key={h} style={{
                      padding: '10px 14px', textAlign: 'left', fontSize: 11,
                      color: 'var(--text-3)', fontWeight: 600,
                      textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paged.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ padding: '48px', textAlign: 'center', fontSize: 13, color: 'var(--text-3)' }}>
                      조건에 맞는 패널이 없습니다.
                    </td>
                  </tr>
                ) : paged.map((p, i) => {
                  const status = p.status || 'active';
                  const hl = getHonorLevel(p.honor_points ?? 0);
                  const cm = HONOR_COLOR_META[hl.colorTier];
                  const s  = feedbackStats[p.id] || { total: 0, passRate: 0, lastAt: null };
                  const flag = getFlag(p, feedbackStats);
                  const isSelected = selected === p.id;
                  return (
                    <tr key={p.id}
                      onClick={() => { setSelected(isSelected ? null : p.id); setActionMsg(''); }}
                      style={{
                        borderBottom: i < paged.length - 1 ? '1px solid var(--border)' : 'none',
                        background: isSelected ? 'var(--accent-dim2)' : 'transparent',
                        cursor: 'pointer', transition: 'background 0.12s',
                      }}
                      onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--bg)'; }}
                      onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                    >
                      {/* 위험/우수 아이콘 */}
                      <td style={{ padding: '12px 6px 12px 14px', width: 24 }}>
                        {flag === 'danger' && <span title="위험 패널">⚠️</span>}
                        {flag === 'star'   && <span title="우수 패널">⭐</span>}
                      </td>

                      <td style={{ padding: '12px 14px', fontWeight: 600, fontSize: 13, color: 'var(--text)', whiteSpace: 'nowrap' }}>
                        {p.name}
                      </td>

                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ fontSize: 12, color: 'var(--text-2)' }}>{p.industry || '—'}</div>
                        {p.experience && <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>{p.experience}</div>}
                      </td>

                      <td style={{ padding: '12px 14px' }}>
                        <span style={{ fontWeight: 800, fontSize: 15, color: scoreColor(p.trust_score || 0) }}>
                          {p.trust_score || 0}
                        </span>
                      </td>

                      <td style={{ padding: '12px 14px' }}>
                        <span style={{
                          fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
                          color: cm.color, background: cm.bg, border: `1px solid ${cm.color}`,
                        }}>
                          Lv.{hl.level}
                        </span>
                      </td>

                      {/* 기간 내 제출 수 */}
                      <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 700, color: s.total > 0 ? 'var(--text)' : 'var(--text-3)' }}>
                        {statsLoading ? '…' : s.total > 0 ? s.total : '—'}
                      </td>

                      {/* 통과율 미니 바 */}
                      <td style={{ padding: '12px 14px' }}>
                        {statsLoading ? '…' : s.total > 0 ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{ width: 44, height: 5, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                              <div style={{
                                width: `${s.passRate}%`, height: '100%', borderRadius: 3,
                                background: s.passRate >= 80 ? '#059669' : s.passRate >= 50 ? 'var(--accent)' : '#DC2626',
                              }} />
                            </div>
                            <span style={{
                              fontSize: 12, fontWeight: 600,
                              color: s.passRate >= 80 ? '#059669' : s.passRate >= 50 ? 'var(--accent)' : '#DC2626',
                            }}>
                              {s.passRate}%
                            </span>
                          </div>
                        ) : <span style={{ fontSize: 12, color: 'var(--text-3)' }}>—</span>}
                      </td>

                      {/* 최근 활동 */}
                      <td style={{ padding: '12px 14px', fontSize: 12, color: 'var(--text-3)', whiteSpace: 'nowrap' }}>
                        {statsLoading ? '…' : relativeTime(s.lastAt)}
                      </td>

                      {/* 상태 */}
                      <td style={{ padding: '12px 14px' }}>
                        <Badge type={status === 'active' ? 'green' : status === 'pending' ? 'gold' : 'red'}>
                          {status === 'active' ? '활성'
                            : status === 'pending' ? '심사중'
                            : status === 'rejected' ? '반려'
                            : status === 'banned' ? '영구정지'
                            : '정지'}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* 페이지네이션 */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
              <button onClick={() => { setPage(p => Math.max(1, p - 1)); setSelected(null); }} disabled={page === 1}
                style={{ padding: '5px 9px', borderRadius: 6, background: 'var(--bg-2)', border: '1px solid var(--border)', cursor: page === 1 ? 'not-allowed' : 'pointer', opacity: page === 1 ? 0.4 : 1, display: 'flex', alignItems: 'center' }}>
                <ChevronLeft size={14} />
              </button>
              <span style={{ fontSize: 12, color: 'var(--text-3)', minWidth: 60, textAlign: 'center' }}>
                {page} / {totalPages}
              </span>
              <button onClick={() => { setPage(p => Math.min(totalPages, p + 1)); setSelected(null); }} disabled={page === totalPages}
                style={{ padding: '5px 9px', borderRadius: 6, background: 'var(--bg-2)', border: '1px solid var(--border)', cursor: page === totalPages ? 'not-allowed' : 'pointer', opacity: page === totalPages ? 0.4 : 1, display: 'flex', alignItems: 'center' }}>
                <ChevronRight size={14} />
              </button>
            </div>
          )}
        </Card>

        {/* 우측 상세 패널 */}
        {panel && <PanelDetail
          key={panel.id}
          panel={panel}
          stats={feedbackStats[panel.id] || { total: 0, passed: 0, rejected: 0, passRate: 0, lastAt: null }}
          periodLabel={PERIOD_LABEL[periodFilter]}
          feedbacks={panelFeedbacks}
          detailLoading={detailLoading}
          acting={acting}
          onUpdate={updatePanel}
          onConfirmExperience={confirmExperience}
          flag={getFlag(panel, feedbackStats)}
          feedbackPage={feedbackDetailPage}
          onFeedbackPage={setFeedbackDetailPage}
          onFeedbackClick={(feedbackId) => {
            // 뒤로가기 복원용 — 현재 보던 위치(선택 패널·페이지·필터·검색·상세 페이지) 저장
            try {
              sessionStorage.setItem('purit_panelmgmt_return', JSON.stringify({
                selected, page, feedbackDetailPage, searchInput,
                statusFilter, levelFilter, periodFilter, riskFilter, sortBy,
              }));
            } catch {}
            navigate('/admin/purity', { state: { feedbackId } });
          }}
          actionMsg={actionMsg}
          onClearActionMsg={() => setActionMsg('')}
        />}
      </div>
    </div>
  );
}

/* ─── 서브 컴포넌트 ─── */

// 심사 거절 모달 — 거절 사유 입력 + 3번째 거절 시 영구 차단 경고 (ConfirmModal은 입력 필드 미지원이라 별도 구현, D-19 portal)
function RejectModal({ willBan, rejectionCount, reason, onReason, errorMsg, acting, onConfirm, onCancel }) {
  return ReactDOM.createPortal(
    <div
      onClick={onCancel}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="confirm-modal-inner"
        style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '24px 28px', width: 420, animation: 'fadeUp 0.18s ease both' }}
      >
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: 'var(--text)' }}>
          {willBan ? '⚠️ 영구 차단 경고' : '심사 거절'}
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 16, lineHeight: 1.6 }}>
          거절 사유는 패널에게 그대로 전달되며, 재제출 시 무엇을 보완할지 안내합니다.
        </div>

        {willBan && (
          <div style={{ fontSize: 12.5, color: '#DC2626', fontWeight: 600, marginBottom: 14, padding: '10px 12px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, lineHeight: 1.6 }}>
            이 거절은 누적 {rejectionCount + 1}번째 거절입니다. 확인 시 이 계정은 <strong>영구적으로 사용 불가</strong>가 되며 재심사를 받을 수 없습니다.
          </div>
        )}

        <textarea
          value={reason}
          onChange={e => onReason(e.target.value)}
          placeholder="예: 건강보험 자격득실 확인서가 흐릿하여 근무 이력 확인이 어렵습니다. 선명한 파일로 다시 제출해 주세요."
          rows={4}
          style={{
            width: '100%', padding: '11px 13px', borderRadius: 9,
            border: '1px solid var(--border)', fontSize: 13.5, fontFamily: 'inherit',
            outline: 'none', boxSizing: 'border-box', resize: 'vertical', lineHeight: 1.6,
          }}
          onFocus={e => { e.target.style.borderColor = 'var(--accent)'; e.target.style.boxShadow = '0 0 0 3px rgba(16,54,125,0.10)'; }}
          onBlur={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none'; }}
        />

        {errorMsg && (
          <div style={{ fontSize: 12, color: '#EF4444', fontWeight: 600, marginTop: 12, padding: '8px 12px', background: 'rgba(239,68,68,0.08)', borderRadius: 6 }}>
            {errorMsg}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 18 }}>
          <Btn variant="secondary" onClick={onCancel} disabled={acting}>취소</Btn>
          <Btn variant="danger" onClick={onConfirm} disabled={acting || !reason.trim()}>
            {acting ? '처리 중...' : (willBan ? '영구 차단하고 거절' : '거절하기')}
          </Btn>
        </div>
      </div>
    </div>,
    document.body
  );
}

function PanelDetail({ panel, stats: s, periodLabel, feedbacks, detailLoading, acting, onUpdate, onConfirmExperience, flag,
                       feedbackPage, onFeedbackPage, onFeedbackClick, actionMsg, onClearActionMsg }) {
  const totalDetailPages = Math.max(1, Math.ceil(feedbacks.length / DETAIL_PAGE_SIZE));
  const pagedFeedbacks = feedbacks.slice(
    (feedbackPage - 1) * DETAIL_PAGE_SIZE,
    feedbackPage * DETAIL_PAGE_SIZE,
  );
  const status = panel.status || 'active';
  const hl = getHonorLevel(panel.honor_points ?? 0);
  const cm = HONOR_COLOR_META[hl.colorTier];
  const [confirmAction, setConfirmAction] = useState(null);
  const [updateError, setUpdateError]     = useState('');
  const [rejectOpen, setRejectOpen]       = useState(false);
  const [rejectReason, setRejectReason]   = useState('');
  const willBan = (panel.rejection_count ?? 0) >= 2; // 누적 2회 → 이번 거절이 3번째 = 영구 차단
  const [expYearsInput, setExpYearsInput] = useState(panel.experience_years != null ? String(panel.experience_years) : '');
  const [expSaving, setExpSaving]         = useState(false);
  const [expMsg, setExpMsg]               = useState('');
  const suspendUntil = panel.suspend_until ? new Date(panel.suspend_until) : null;
  const isTempSuspend = status === 'suspended' && suspendUntil != null;

  function makeSuspendAction(days) {
    const until = new Date(Date.now() + days * 86400000);
    const untilStr = until.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
    return {
      status: 'suspended',
      suspend_until: until.toISOString(),
      label: `${days}일 정지`,
      desc: `이 패널을 ${days}일간 임시 정지합니까?\n${untilStr}에 자동으로 해제됩니다.`,
    };
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* 기본 정보 */}
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              {flag === 'danger' && <span>⚠️</span>}
              {flag === 'star'   && <span>⭐</span>}
              <div style={{ fontWeight: 800, fontSize: 18, color: 'var(--text)' }}>{panel.name}</div>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
              {panel.industry || '직군 미설정'}{panel.experience ? ` · ${panel.experience}` : ''}
            </div>
          </div>
          <span style={{
            fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, whiteSpace: 'nowrap',
            color: cm.color, background: cm.bg, border: `1px solid ${cm.color}`,
          }}>
            Lv.{hl.level} · {(panel.honor_points ?? 0).toLocaleString()}pts
          </span>
        </div>

        {/* Trust 게이지 */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-3)', marginBottom: 5 }}>
            <span>TRUST SCORE</span>
            <span style={{ color: scoreColor(panel.trust_score || 0), fontWeight: 700 }}>{panel.trust_score || 0}</span>
          </div>
          <div style={{ height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ width: `${panel.trust_score || 0}%`, height: '100%', background: scoreColor(panel.trust_score || 0), borderRadius: 3 }} />
          </div>
        </div>

        {/* 메타 그리드 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {[
            { label: '전체 완료 미션', value: `${panel.total_missions || 0}건` },
            { label: '가입일',        value: new Date(panel.created_at).toLocaleDateString('ko-KR') },
            { label: '최근 활동',     value: relativeTime(s.lastAt) },
            { label: '계정 상태',     value: status === 'active' ? '✅ 활성' : status === 'pending' ? '⏳ 심사중' : status === 'rejected' ? `📝 반려 (누적 ${panel.rejection_count || 0}회)` : status === 'banned' ? '🚫 영구 차단' : isTempSuspend ? '🕐 임시 정지' : '🚫 영구 정지' },
          ].map(({ label, value }) => (
            <div key={label} style={{ padding: '10px 12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8 }}>
              <div style={{ fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>{label}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{value}</div>
            </div>
          ))}
        </div>

        {/* 임시 정지 해제 예정일 */}
        {isTempSuspend && (
          <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 8, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: '#92400E', fontWeight: 600 }}>정지 해제 예정</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#92400E' }}>
              {suspendUntil.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}
              {' '}
              {suspendUntil.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        )}
      </Card>

      {/* 기간 활동 통계 */}
      <Card style={{ padding: '16px 18px' }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
          활동 통계 ({periodLabel})
        </div>

        {s.total === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--text-3)', textAlign: 'center', padding: '12px 0' }}>
            해당 기간 제출 내역 없음
          </div>
        ) : (
          <>
            {/* 제출/통과/반려 카드 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 14 }}>
              {[
                { label: '제출',  value: s.total,    color: 'var(--text)' },
                { label: '통과',  value: s.passed,   color: '#059669' },
                { label: '반려',  value: s.rejected, color: '#DC2626' },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ textAlign: 'center', padding: '10px 6px', background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{label}</div>
                </div>
              ))}
            </div>

            {/* 통과율 바 */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-3)', marginBottom: 5 }}>
                <span>PURIT PASS RATE</span>
                <span style={{ fontWeight: 700, color: s.passRate >= 80 ? '#059669' : s.passRate >= 50 ? 'var(--accent)' : '#DC2626' }}>
                  {s.passRate}%
                </span>
              </div>
              <div style={{ height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{
                  width: `${s.passRate}%`, height: '100%', borderRadius: 3,
                  background: s.passRate >= 80 ? '#059669' : s.passRate >= 50 ? 'var(--accent)' : '#DC2626',
                }} />
              </div>
            </div>

            {/* 위험/우수 안내 메시지 */}
            {flag === 'danger' && (
              <div style={{ marginTop: 10, fontSize: 11, color: '#DC2626', background: '#FEF2F2', padding: '8px 12px', borderRadius: 6, border: '1px solid #FECACA', lineHeight: 1.6 }}>
                ⚠️ {(panel.trust_score || 0) < 40
                  ? 'Trust Score가 40점 미만입니다. 피드백 품질을 점검하세요.'
                  : '반려율이 50%를 초과합니다. 반복 악용이 의심됩니다.'}
              </div>
            )}
            {flag === 'star' && (
              <div style={{ marginTop: 10, fontSize: 11, color: '#059669', background: '#F0FDF4', padding: '8px 12px', borderRadius: 6, border: '1px solid #BBF7D0', lineHeight: 1.6 }}>
                ⭐ 높은 통과율과 신뢰도를 보유한 우수 패널입니다.
              </div>
            )}
          </>
        )}
      </Card>

      {/* 제출 내역 (전체, 5개씩 페이지네이션) */}
      <Card style={{ padding: '16px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            제출 내역
          </div>
          {feedbacks.length > 0 && (
            <span style={{ fontSize: 11, color: 'var(--text-3)' }}>총 {feedbacks.length}건</span>
          )}
        </div>
        {detailLoading ? (
          <div style={{ fontSize: 12, color: 'var(--text-3)', textAlign: 'center', padding: '12px 0' }}>불러오는 중…</div>
        ) : feedbacks.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--text-3)', textAlign: 'center', padding: '12px 0' }}>제출 내역 없음</div>
        ) : (
          <>
            {pagedFeedbacks.map((f, i) => {
              const typeLabel = MISSION_TYPE_LABEL[f.missions?.type] || 'LP 검증';
              let statusLabel = '검토 대기';
              let statusColor = '#D97706';
              if (f.purity_passed)              { statusLabel = '통과'; statusColor = '#059669'; }
              else if (f.status === 'rejected') { statusLabel = '반려'; statusColor = '#DC2626'; }
              return (
                <div
                  key={f.id}
                  onClick={() => onFeedbackClick(f.id)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '9px 6px',
                    borderBottom: i < pagedFeedbacks.length - 1 ? '1px solid var(--border)' : 'none',
                    cursor: 'pointer', borderRadius: 6, transition: 'background 0.12s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {f.missions?.title || '(삭제된 의뢰)'}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
                      {typeLabel} · {relativeTime(f.created_at)}
                    </div>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: statusColor, marginLeft: 10, flexShrink: 0 }}>
                    {statusLabel}
                  </span>
                </div>
              );
            })}
            {totalDetailPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 10 }}>
                <button
                  onClick={() => onFeedbackPage(p => Math.max(1, p - 1))}
                  disabled={feedbackPage === 1}
                  style={{ background: 'none', border: 'none', cursor: feedbackPage === 1 ? 'not-allowed' : 'pointer', opacity: feedbackPage === 1 ? 0.3 : 1, padding: 4 }}
                >
                  <ChevronLeft size={14} color="var(--text-2)" />
                </button>
                <span style={{ fontSize: 12, color: 'var(--text-2)', fontWeight: 500 }}>
                  {feedbackPage} / {totalDetailPages}
                </span>
                <button
                  onClick={() => onFeedbackPage(p => Math.min(totalDetailPages, p + 1))}
                  disabled={feedbackPage === totalDetailPages}
                  style={{ background: 'none', border: 'none', cursor: feedbackPage === totalDetailPages ? 'not-allowed' : 'pointer', opacity: feedbackPage === totalDetailPages ? 0.3 : 1, padding: 4 }}
                >
                  <ChevronRight size={14} color="var(--text-2)" />
                </button>
              </div>
            )}
          </>
        )}
      </Card>

      {/* 검증 서류 — 항상 표시 (미제출 시 안내 메시지) */}
      <Card style={{ padding: '16px 18px' }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
          검증 서류
        </div>

        {!panel.health_insurance_url && !panel.linkedin_url && !panel.portfolio_url && !panel.portfolio_file_url ? (
          <div style={{ fontSize: 13, color: 'var(--text-3)', padding: '8px 0' }}>
            제출된 서류 없음
          </div>
        ) : (
          <>
            {panel.health_insurance_url && (
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 4 }}>건강보험 자격득실 확인서</div>
                <a
                  href="#"
                  onClick={async (e) => {
                    e.preventDefault();
                    const { data, error } = await supabase.storage
                      .from('panel-verification-docs')
                      .createSignedUrl(panel.health_insurance_url, 600);
                    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
                    else alert('서류를 불러오는 중 오류가 발생했습니다: ' + (error?.message || '알 수 없는 오류'));
                  }}
                  style={{ fontSize: 13, color: 'var(--accent)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                >
                  📄 서류 열기 →
                </a>
              </div>
            )}

            {panel.linkedin_url && (
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 4 }}>LinkedIn</div>
                <a
                  href={panel.linkedin_url}
                  target="_blank"
                  rel="noreferrer"
                  style={{ fontSize: 13, color: 'var(--accent)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                >
                  🔗 프로필 열기 →
                </a>
              </div>
            )}

            {panel.portfolio_url && (
              <div style={{ marginBottom: panel.portfolio_file_url ? 10 : 0 }}>
                <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 4 }}>포트폴리오 / 이력서 링크</div>
                {panel.portfolio_url.startsWith('http') ? (
                  <a
                    href={panel.portfolio_url}
                    target="_blank"
                    rel="noreferrer"
                    style={{ fontSize: 13, color: 'var(--accent)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                  >
                    🔗 포트폴리오 열기 →
                  </a>
                ) : (
                  /* 레거시 호환: 구 데이터는 portfolio_url에 파일 경로가 들어있을 수 있음 */
                  <a
                    href="#"
                    onClick={async (e) => {
                      e.preventDefault();
                      const { data, error } = await supabase.storage
                        .from('panel-verification-docs')
                        .createSignedUrl(panel.portfolio_url, 600);
                      if (data?.signedUrl) window.open(data.signedUrl, '_blank');
                      else alert('서류를 불러오는 중 오류가 발생했습니다: ' + (error?.message || '알 수 없는 오류'));
                    }}
                    style={{ fontSize: 13, color: 'var(--accent)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                  >
                    📄 파일 열기 →
                  </a>
                )}
              </div>
            )}

            {panel.portfolio_file_url && (
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 4 }}>포트폴리오 / 이력서 파일</div>
                <a
                  href="#"
                  onClick={async (e) => {
                    e.preventDefault();
                    const { data, error } = await supabase.storage
                      .from('panel-verification-docs')
                      .createSignedUrl(panel.portfolio_file_url, 600);
                    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
                    else alert('서류를 불러오는 중 오류가 발생했습니다: ' + (error?.message || '알 수 없는 오류'));
                  }}
                  style={{ fontSize: 13, color: 'var(--accent)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                >
                  📄 파일 열기 →
                </a>
              </div>
            )}
          </>
        )}
      </Card>

      {/* 경력 확정 */}
      <Card style={{ padding: '16px 18px' }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
          경력 확정
        </div>

        {/* 현재 적용 경력 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, padding: '10px 12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8 }}>
          <div>
            <div style={{ fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>현재 적용 경력</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
              {(panel.experience_years ?? 0) >= 15 ? '헤드' : (panel.experience_years != null ? `${panel.experience_years}년차` : (panel.experience || '미입력'))}
            </div>
          </div>
          {panel.experience_confirmed_at ? (
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#059669' }}>✓ 확정됨</div>
              <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{new Date(panel.experience_confirmed_at).toLocaleDateString('ko-KR')}</div>
            </div>
          ) : (
            <span style={{ fontSize: 11, fontWeight: 700, color: '#D97706' }}>미확정</span>
          )}
        </div>

        {/* 연차 입력 (자격득실 확인서 기준) — 15년차 이상은 헤드로 자동 분류 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <input
            type="number" min={0} max={50}
            value={expYearsInput}
            onChange={e => setExpYearsInput(e.target.value)}
            placeholder="연차"
            style={{ width: 90, padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, color: 'var(--text)', background: '#fff', outline: 'none' }}
          />
          <span style={{ fontSize: 13, color: 'var(--text-2)' }}>년차</span>
          {parseInt(expYearsInput, 10) >= 15 && (
            <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 700, color: '#92400E' }}>→ 헤드 (15년차 이상)</span>
          )}
        </div>

        {expMsg && (
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: expMsg.includes('실패') ? 'var(--red)' : '#059669' }}>
            {expMsg}
          </div>
        )}

        <Btn size="sm" disabled={expSaving} style={{ justifyContent: 'center', width: '100%' }}
          onClick={async () => {
            setExpMsg('');
            const parsed = parseInt(expYearsInput, 10);
            if (Number.isNaN(parsed) || parsed < 0 || parsed > 50) {
              setExpMsg('연차를 0~50 사이 숫자로 입력하세요.');
              return;
            }
            const finalYears = Math.max(0, Math.min(50, parsed));
            setExpSaving(true);
            const ok = await onConfirmExperience(panel.id, finalYears);
            setExpSaving(false);
            setExpMsg(ok ? '경력이 확정되었습니다.' : '확정 실패: 권한 또는 입력을 확인하세요.');
          }}>
          {expSaving ? '확정 중...' : (panel.experience_confirmed_at ? '경력 재확정 / 조정' : '경력 확정')}
        </Btn>
        <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 8, lineHeight: 1.5 }}>
          확정 시점 기준 매년 자동으로 +1 증가합니다. 15년차 이상은 헤드로 자동 분류되어 정산 3.0배가 적용됩니다. 필요 시 위 값을 직접 올리거나 내려 재확정할 수 있습니다.
        </div>
      </Card>

      {/* 관리 액션 */}
      <Card style={{ padding: '16px 18px' }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
          관리 액션
        </div>
        {actionMsg && (
          <div style={{ fontSize: 12, padding: '8px 12px', borderRadius: 6, marginBottom: 4,
            background: actionMsg.includes('실패') ? 'rgba(239,68,68,0.08)' : 'rgba(34,197,94,0.08)',
            color: actionMsg.includes('실패') ? 'var(--red, #EF4444)' : '#22C55E', fontWeight: 600,
            cursor: 'pointer' }} onClick={onClearActionMsg}>
            {actionMsg} ✕
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {status === 'pending' && (
            <>
              <Btn size="sm" disabled={acting} style={{ justifyContent: 'center' }}
                onClick={() => setConfirmAction({ status: 'active', label: '심사 승인', desc: '이 패널을 심사 승인합니까?\n활성 패널로 전환되어 미션에 참여할 수 있습니다.' })}>
                ✓ 심사 승인
              </Btn>
              <Btn size="sm" variant="danger" disabled={acting} style={{ justifyContent: 'center' }}
                onClick={() => { setRejectReason(''); setUpdateError(''); setRejectOpen(true); }}>
                ✕ 심사 거절
              </Btn>
            </>
          )}
          {status === 'active' && (
            <>
              {/* 기간제 정지 */}
              <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600, marginBottom: 4 }}>기간제 정지</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {[1, 3, 7, 30].map(days => (
                  <Btn key={days} size="sm" variant="secondary" disabled={acting}
                    style={{ justifyContent: 'center', fontSize: 12 }}
                    onClick={() => setConfirmAction(makeSuspendAction(days))}>
                    {days}일 정지
                  </Btn>
                ))}
              </div>
              {/* 영구 정지 */}
              <Btn size="sm" variant="danger" disabled={acting} style={{ justifyContent: 'center', marginTop: 2 }}
                onClick={() => setConfirmAction({ status: 'suspended', label: '영구 정지', desc: '이 패널을 영구 정지합니까?\n수동으로 해제하기 전까지 계정 이용이 불가합니다.' })}>
                영구 정지
              </Btn>
            </>
          )}
          {status === 'suspended' && (
            <Btn size="sm" disabled={acting} style={{ justifyContent: 'center' }}
              onClick={() => setConfirmAction({ status: 'active', label: '정지 해제', desc: '이 패널의 정지를 해제합니까?\n활성 패널로 전환되어 미션에 다시 참여할 수 있습니다.' })}>
              정지 해제
            </Btn>
          )}
          {status === 'rejected' && (
            <div style={{ fontSize: 12, color: 'var(--text-2)', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 8, padding: '10px 12px', lineHeight: 1.6 }}>
              📝 <strong>반려 처리됨</strong> (누적 거절 {panel.rejection_count || 0}회).
              패널이 서류를 재제출하면 다시 심사대기 목록에 표시됩니다.
              {panel.rejection_reason && (
                <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(245,158,11,0.25)', color: 'var(--text-3)' }}>
                  최근 거절 사유: <span style={{ color: 'var(--text-2)' }}>{panel.rejection_reason}</span>
                </div>
              )}
            </div>
          )}
          {status === 'banned' && (
            <>
              <div style={{ fontSize: 12, color: '#DC2626', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 12px', lineHeight: 1.6 }}>
                🚫 <strong>영구 차단됨</strong> (누적 거절 {panel.rejection_count || 0}회).
                이 계정으로는 재심사가 불가합니다.
                {panel.rejection_reason && (
                  <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #FECACA', color: 'var(--text-3)' }}>
                    최근 거절 사유: <span style={{ color: 'var(--text-2)' }}>{panel.rejection_reason}</span>
                  </div>
                )}
              </div>
              <Btn size="sm" disabled={acting} style={{ justifyContent: 'center' }}
                onClick={() => setConfirmAction({ status: 'rejected', rejection_count: 0, label: '차단 해제', desc: '이 계정의 영구 차단을 해제합니까?\n반려 상태로 전환되고 누적 거절 횟수가 0으로 초기화됩니다. 패널은 서류를 재제출할 수 있습니다.' })}>
                차단 해제
              </Btn>
            </>
          )}
        </div>
      </Card>

      {confirmAction && (
        <ConfirmModal
          title={confirmAction.label}
          desc={confirmAction.desc}
          confirmLabel={confirmAction.label}
          errorMsg={updateError}
          onConfirm={async () => {
            setUpdateError('');
            const fields = { status: confirmAction.status };
            if (confirmAction.suspend_until) fields.suspend_until = confirmAction.suspend_until;
            if (confirmAction.status === 'active') fields.suspend_until = null;
            // 차단 해제: 누적 거절 횟수 초기화 + 거절 사유 클리어
            if (confirmAction.rejection_count != null) {
              fields.rejection_count = confirmAction.rejection_count;
              if (confirmAction.rejection_count === 0) fields.rejection_reason = null;
            }
            const ok = await onUpdate(panel.id, fields);
            if (ok) setConfirmAction(null);
            else setUpdateError('처리 중 오류가 발생했습니다. 다시 시도해 주세요.');
          }}
          onCancel={() => { setUpdateError(''); setConfirmAction(null); }}
          danger
        />
      )}

      {rejectOpen && (
        <RejectModal
          willBan={willBan}
          rejectionCount={panel.rejection_count ?? 0}
          reason={rejectReason}
          onReason={setRejectReason}
          errorMsg={updateError}
          acting={acting}
          onCancel={() => { setUpdateError(''); setRejectOpen(false); }}
          onConfirm={async () => {
            setUpdateError('');
            if (!rejectReason.trim()) { setUpdateError('거절 사유를 입력해 주세요.'); return; }
            const nextCount = (panel.rejection_count ?? 0) + 1;
            const fields = {
              status: nextCount >= 3 ? 'banned' : 'rejected',
              rejection_count: nextCount,
              rejection_reason: rejectReason.trim(),
            };
            const ok = await onUpdate(panel.id, fields);
            if (ok) { setRejectReason(''); setRejectOpen(false); }
            else setUpdateError('처리 중 오류가 발생했습니다. 다시 시도해 주세요.');
          }}
        />
      )}
    </div>
  );
}
