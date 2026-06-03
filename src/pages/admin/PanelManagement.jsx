import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Badge, Btn, ConfirmModal } from '../../components/ui';
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
  const [panels, setPanels]             = useState([]);
  const [feedbackStats, setFeedbackStats] = useState({});
  const [panelFeedbacks, setPanelFeedbacks] = useState([]);
  const [loading, setLoading]           = useState(true);
  const [statsLoading, setStatsLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selected, setSelected]         = useState(null);
  const [acting, setActing]             = useState(false);
  const [actionMsg, setActionMsg]       = useState('');
  const [page, setPage]                 = useState(1);
  const [feedbackDetailPage, setFeedbackDetailPage] = useState(1);
  const [searchInput, setSearchInput]   = useState('');
  const [searchQuery, setSearchQuery]   = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [levelFilter, setLevelFilter]   = useState('all');
  const [periodFilter, setPeriodFilter] = useState('all');
  const [riskFilter, setRiskFilter]     = useState('all');
  const [sortBy, setSortBy]             = useState('recent');

  useEffect(() => { load(); }, []);
  useEffect(() => { loadStats(periodFilter); }, [periodFilter]);
  useEffect(() => {
    const t = setTimeout(() => { setSearchQuery(searchInput); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);
  useEffect(() => {
    if (selected) loadPanelDetail(selected);
    else setPanelFeedbacks([]);
    setFeedbackDetailPage(1);
  }, [selected]);

  async function load() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('panels')
        .select('id, user_id, name, email, industry, experience, bio, expertise, trust_score, honor_points, honor_decay_applied_at, selected_badge, badges, streak_count, total_missions, status, phone, phone_verified, health_insurance_url, linkedin_url, portfolio_url, created_at')
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
    // 첫 심사 승인(pending → active) 시 환영 알림 발송
    if (fields.status === 'active') {
      const targetPanel = panels.find(p => p.id === id);
      if (targetPanel?.user_id && targetPanel?.status === 'pending') {
        sendNotification(targetPanel.user_id, {
          type: 'success',
          icon: '🎉',
          title: '전문 마케터로 승인되었습니다!',
          body: 'Purit이 인증한 마케터로 공식 합류하셨습니다. 실제 기업의 랜딩페이지·광고 소재를 전문가 시각으로 진단하고, 더 나은 마케팅을 함께 만들어 나가요.',
          actionUrl: '/panel/missions',
          targetRole: 'panel',
        }).catch(err => console.warn('[updatePanel] 환영 알림 발송 실패:', err));
      }
    }
    setPanels(ps => ps.map(p => p.id === id ? { ...p, ...fields } : p));
    setActing(false);
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
        {/* 상태 */}
        <FilterGroup
          options={[['all', '전체'], ['active', '활성'], ['pending', '심사대기'], ['suspended', '정지']]}
          value={statusFilter}
          onChange={v => { setStatusFilter(v); setPage(1); }}
        />

        {/* 기간 */}
        <FilterGroup
          options={[['all', '전체 기간'], ['today', '오늘'], ['week', '1주일'], ['month', '1개월']]}
          value={periodFilter}
          onChange={v => { setPeriodFilter(v); setPage(1); }}
        />

        {/* 분류 (위험/우수) */}
        <div style={{ display: 'flex', gap: 4 }}>
          {[
            ['all',    '전체',      'var(--bg-2)',  'var(--text-3)',  'var(--border)'],
            ['danger', '⚠️ 위험',   '#FEF2F2',     '#DC2626',        '#DC2626'],
            ['star',   '⭐ 우수',   '#F0FDF4',     '#059669',        '#059669'],
          ].map(([v, l, bg, color, border]) => (
            <button key={v}
              onClick={() => { setRiskFilter(v); setPage(1); }}
              style={{
                padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: 500,
                background: riskFilter === v ? bg : 'var(--bg-2)',
                color: riskFilter === v ? color : 'var(--text-3)',
                border: `1px solid ${riskFilter === v ? border : 'var(--border)'}`,
                cursor: 'pointer', transition: 'all 0.12s',
              }}
            >{l}</button>
          ))}
        </div>

        {/* 레벨 */}
        <div style={{ display: 'flex', gap: 4 }}>
          {[['all', '전체 레벨'], ['1-3', 'Lv.1-3'], ['4-6', 'Lv.4-6'], ['7-9', 'Lv.7-9'], ['10', 'Lv.10']].map(([v, l]) => (
            <button key={v}
              onClick={() => { setLevelFilter(v); setPage(1); }}
              style={{
                padding: '5px 11px', borderRadius: 8, fontSize: 12, fontWeight: 500,
                background: levelFilter === v ? 'var(--accent)' : 'var(--bg-2)',
                color: levelFilter === v ? '#fff' : 'var(--text-3)',
                border: `1px solid ${levelFilter === v ? 'var(--accent)' : 'var(--border)'}`,
                cursor: 'pointer', transition: 'all 0.12s',
              }}
            >{l}</button>
          ))}
        </div>

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
                          {status === 'active' ? '활성' : status === 'pending' ? '심사중' : '정지'}
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
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                style={{ padding: '5px 9px', borderRadius: 6, background: 'var(--bg-2)', border: '1px solid var(--border)', cursor: page === 1 ? 'not-allowed' : 'pointer', opacity: page === 1 ? 0.4 : 1, display: 'flex', alignItems: 'center' }}>
                <ChevronLeft size={14} />
              </button>
              <span style={{ fontSize: 12, color: 'var(--text-3)', minWidth: 60, textAlign: 'center' }}>
                {page} / {totalPages}
              </span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                style={{ padding: '5px 9px', borderRadius: 6, background: 'var(--bg-2)', border: '1px solid var(--border)', cursor: page === totalPages ? 'not-allowed' : 'pointer', opacity: page === totalPages ? 0.4 : 1, display: 'flex', alignItems: 'center' }}>
                <ChevronRight size={14} />
              </button>
            </div>
          )}
        </Card>

        {/* 우측 상세 패널 */}
        {panel && <PanelDetail
          panel={panel}
          stats={feedbackStats[panel.id] || { total: 0, passed: 0, rejected: 0, passRate: 0, lastAt: null }}
          periodLabel={PERIOD_LABEL[periodFilter]}
          feedbacks={panelFeedbacks}
          detailLoading={detailLoading}
          acting={acting}
          onUpdate={updatePanel}
          flag={getFlag(panel, feedbackStats)}
          feedbackPage={feedbackDetailPage}
          onFeedbackPage={setFeedbackDetailPage}
          onFeedbackClick={(feedbackId) => navigate('/admin/purity', { state: { feedbackId } })}
          actionMsg={actionMsg}
          onClearActionMsg={() => setActionMsg('')}
        />}
      </div>
    </div>
  );
}

/* ─── 서브 컴포넌트 ─── */

function FilterGroup({ options, value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 2, background: 'var(--bg-2)', borderRadius: 8, padding: 3, border: '1px solid var(--border)' }}>
      {options.map(([v, l]) => (
        <button key={v} onClick={() => onChange(v)} style={{
          padding: '5px 11px', borderRadius: 5, fontSize: 12, fontWeight: 500,
          background: value === v ? '#fff' : 'transparent',
          color: value === v ? 'var(--text)' : 'var(--text-3)',
          border: 'none', cursor: 'pointer',
          boxShadow: value === v ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
          transition: 'all 0.12s',
        }}>{l}</button>
      ))}
    </div>
  );
}

function PanelDetail({ panel, stats: s, periodLabel, feedbacks, detailLoading, acting, onUpdate, flag,
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
            { label: '계정 상태',     value: status === 'active' ? '✅ 활성' : status === 'pending' ? '⏳ 심사중' : '🚫 정지' },
          ].map(({ label, value }) => (
            <div key={label} style={{ padding: '10px 12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8 }}>
              <div style={{ fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>{label}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{value}</div>
            </div>
          ))}
        </div>
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
                <span>PURITY PASS RATE</span>
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

        {!panel.health_insurance_url && !panel.linkedin_url && !panel.portfolio_url ? (
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
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 4 }}>포트폴리오 / 이력서</div>
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
          </>
        )}
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
                onClick={() => setConfirmAction({ status: 'suspended', label: '심사 거절', desc: '이 패널을 심사 거절 처리합니까?\n계정이 정지 상태로 전환됩니다.' })}>
                ✕ 심사 거절
              </Btn>
            </>
          )}
          {status === 'active' && (
            <Btn size="sm" variant="danger" disabled={acting} style={{ justifyContent: 'center' }}
              onClick={() => setConfirmAction({ status: 'suspended', label: '활동 정지', desc: '이 패널의 활동을 정지합니까?\n정지 시 진행 중인 미션에서도 배제됩니다.' })}>
              활동 정지
            </Btn>
          )}
          {status === 'suspended' && (
            <Btn size="sm" disabled={acting} style={{ justifyContent: 'center' }}
              onClick={() => setConfirmAction({ status: 'active', label: '활동 재개', desc: '이 패널의 활동을 재개합니까?\n활성 패널로 전환되어 미션에 다시 참여할 수 있습니다.' })}>
              활동 재개
            </Btn>
          )}
        </div>
      </Card>

      {confirmAction && (
        <ConfirmModal
          title={confirmAction.label}
          desc={confirmAction.desc}
          confirmLabel={confirmAction.label}
          errorMsg={updateError}
          onConfirm={async () => { setUpdateError(''); const ok = await onUpdate(panel.id, { status: confirmAction.status }); if (ok) setConfirmAction(null); else setUpdateError('처리 중 오류가 발생했습니다. 다시 시도해 주세요.'); }}
          onCancel={() => { setUpdateError(''); setConfirmAction(null); }}
          danger
        />
      )}
    </div>
  );
}
