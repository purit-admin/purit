import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Badge, Btn, ConfirmModal } from '../../components/ui';
import { ChevronLeft, ChevronRight, AlertTriangle, Star, Building2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

const PAGE_SIZE = 10;

const PLAN_LABEL   = { starter: 'STARTER', pro: 'PRO', enterprise: 'ENTERPRISE' };
const PLAN_CREDITS = { starter: 50, pro: 165, enterprise: 400 };
const PLAN_COLOR   = { starter: '#64748B', pro: 'var(--accent)', enterprise: '#92400E' };

const MISSION_TYPE_LABEL = {
  landing_page: 'LP 검증',
  preference:   '소재 비교',
  pricing:      '가격 검증',
  email:        '이메일 검증',
};

const MISSION_STATUS_LABEL = {
  active:    '진행 중',
  completed: '완료',
  cancelled: '취소',
  draft:     '임시 저장',
};

function creditColor(n) {
  if (n <= 0)  return '#DC2626';
  if (n < 10)  return '#F59E0B';
  if (n < 30)  return 'var(--text-2)';
  return '#059669';
}

function getCompanyFlag(co) {
  if ((co.credit_balance ?? 0) <= 0) return 'danger';
  if ((co.credit_balance ?? 0) < 10) return 'warn';
  if (co.plan === 'pro' || co.plan === 'enterprise') return 'star';
  return 'none';
}

function relativeTime(iso) {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (h < 1)  return '방금';
  if (h < 24) return `${h}시간 전`;
  if (d < 7)  return `${d}일 전`;
  if (d < 30) return `${Math.floor(d / 7)}주 전`;
  return new Date(iso).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
}

function FilterGroup({ options, value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 2, background: 'var(--bg-2)', borderRadius: 8, padding: 3, border: '1px solid var(--border)' }}>
      {options.map(([v, l]) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          style={{
            padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 500,
            border: 'none', cursor: 'pointer', transition: 'all 0.15s',
            background: value === v ? '#fff' : 'transparent',
            color: value === v ? 'var(--text)' : 'var(--text-3)',
            boxShadow: value === v ? '0 1px 3px rgba(0,0,0,0.10)' : 'none',
          }}
        >{l}</button>
      ))}
    </div>
  );
}

const DETAIL_PAGE_SIZE = 5;

function CompanyDetail({ co, stats, recent, onPlanChange, onAddCredits, onMissionClick }) {
  const st    = stats[co.id] || { total: 0, active: 0, completed: 0, cancelled: 0, totalReserved: 0 };
  const flag  = getCompanyFlag(co);
  const bal   = co.credit_balance ?? 0;
  const monthly = PLAN_CREDITS[co.plan] || 50;
  const gaugePct = Math.min(100, Math.round(bal / monthly * 100));

  const [actionPlan, setActionPlan]     = useState(co.plan || 'starter');
  const [addAmount, setAddAmount]       = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMsg, setActionMsg]       = useState(null);
  const [missionPage, setMissionPage]   = useState(1);
  const [confirmPlan, setConfirmPlan]   = useState(false);

  // co가 바뀌면 선택 플랜·페이지 리셋
  useEffect(() => {
    setActionPlan(co.plan || 'starter');
    setAddAmount('');
    setActionMsg(null);
    setMissionPage(1);
  }, [co.id]);

  const allMissions = recent[co.id] || [];
  const totalMissionPages = Math.max(1, Math.ceil(allMissions.length / DETAIL_PAGE_SIZE));
  const pagedMissions = allMissions.slice(
    (missionPage - 1) * DETAIL_PAGE_SIZE,
    missionPage * DETAIL_PAGE_SIZE,
  );

  async function handlePlanChange() {
    if (actionPlan === co.plan) return;
    setActionLoading(true);
    setActionMsg(null);
    const { error } = await supabase.rpc('admin_change_plan', {
      p_company_id: co.id,
      p_plan: actionPlan,
    });
    if (error) {
      setActionMsg({ type: 'err', text: '플랜 변경 실패: ' + error.message });
    } else {
      setActionMsg({ type: 'ok', text: `플랜이 ${PLAN_LABEL[actionPlan]}으로 변경되었습니다.` });
      onPlanChange(co.id, actionPlan);
    }
    setActionLoading(false);
  }

  async function handleAddCredits() {
    const amount = Number(addAmount);
    if (!amount || amount <= 0) return;
    setActionLoading(true);
    setActionMsg(null);
    const { data, error } = await supabase.rpc('admin_add_credits', {
      p_company_id: co.id,
      p_amount: amount,
    });
    if (error) {
      setActionMsg({ type: 'err', text: '지급 실패: ' + error.message });
    } else {
      setActionMsg({ type: 'ok', text: `${amount} 크레딧이 지급되었습니다. (잔액: ${data})` });
      setAddAmount('');
      onAddCredits(co.id, data);
    }
    setActionLoading(false);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Card 1 — 기본 정보 */}
      <Card style={{ padding: '16px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          {flag === 'danger' && <AlertTriangle size={16} color="#DC2626" />}
          {flag === 'warn'   && <AlertTriangle size={16} color="#F59E0B" />}
          {flag === 'star'   && <Star size={16} color="#059669" fill="#059669" />}
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{co.name || '이름 없음'}</span>
          <span style={{
            fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4,
            background: PLAN_COLOR[co.plan] || '#64748B', color: '#fff', letterSpacing: '0.05em',
          }}>{PLAN_LABEL[co.plan] || 'STARTER'}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {co.industry && (
            <div style={{ fontSize: 12, color: 'var(--text-2)' }}>
              <span style={{ color: 'var(--text-3)', marginRight: 6 }}>업종</span>{co.industry}
            </div>
          )}
          {co.website && (
            <div style={{ fontSize: 12, color: 'var(--text-2)' }}>
              <span style={{ color: 'var(--text-3)', marginRight: 6 }}>웹사이트</span>
              <a href={co.website.startsWith('http') ? co.website : `https://${co.website}`}
                target="_blank" rel="noreferrer"
                style={{ color: 'var(--accent)', textDecoration: 'none' }}>
                {co.website}
              </a>
            </div>
          )}
          <div style={{ fontSize: 12, color: 'var(--text-2)' }}>
            <span style={{ color: 'var(--text-3)', marginRight: 6 }}>가입일</span>
            {co.created_at ? new Date(co.created_at).toLocaleDateString('ko-KR') : '—'}
          </div>
        </div>
      </Card>

      {/* Card 2 — 크레딧 현황 */}
      <Card style={{ padding: '16px 18px' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>
          크레딧 현황
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 4 }}>
          <span style={{ fontSize: 32, fontWeight: 800, color: creditColor(bal) }}>{bal.toFixed(1)}</span>
          <span style={{ fontSize: 13, color: 'var(--text-3)' }}>크레딧 잔여</span>
        </div>
        {/* 게이지 바 */}
        <div style={{ height: 6, background: 'var(--bg-3)', borderRadius: 99, margin: '8px 0 12px', overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 99, transition: 'width 0.4s',
            background: creditColor(bal),
            width: `${gaugePct}%`,
          }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          <div style={{ background: 'var(--bg-2)', borderRadius: 8, padding: '8px 10px' }}>
            <div style={{ fontSize: 10, color: 'var(--text-3)', marginBottom: 3 }}>예약 크레딧</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{st.totalReserved.toFixed(1)}</div>
          </div>
          <div style={{ background: 'var(--bg-2)', borderRadius: 8, padding: '8px 10px' }}>
            <div style={{ fontSize: 10, color: 'var(--text-3)', marginBottom: 3 }}>플랜 월 지급</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{monthly}</div>
          </div>
        </div>
      </Card>

      {/* Card 3 — 의뢰 현황 */}
      <Card style={{ padding: '16px 18px' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>
          의뢰 현황
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
          {[
            { label: '전체',    val: st.total },
            { label: '진행 중', val: st.active },
            { label: '완료',    val: st.completed },
            { label: '취소',    val: st.cancelled },
          ].map(({ label, val }) => (
            <div key={label} style={{ background: 'var(--bg-2)', borderRadius: 8, padding: '8px 0', textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>{val}</div>
              <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 2 }}>{label}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* Card 4 — 의뢰 내역 (전체, 5개씩 페이지네이션) */}
      {allMissions.length > 0 && (
        <Card style={{ padding: '16px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              의뢰 내역
            </div>
            <span style={{ fontSize: 11, color: 'var(--text-3)' }}>총 {allMissions.length}건</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {pagedMissions.map((m, i) => (
              <div
                key={m.id}
                onClick={() => onMissionClick(m.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 6px',
                  borderBottom: i < pagedMissions.length - 1 ? '1px solid var(--border-light)' : 'none',
                  cursor: 'pointer', borderRadius: 6, transition: 'background 0.12s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-2)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
              >
                <span style={{
                  fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 4,
                  background: 'var(--bg-2)', color: 'var(--text-2)', whiteSpace: 'nowrap', flexShrink: 0,
                }}>
                  {MISSION_TYPE_LABEL[m.type] || 'LP 검증'}
                </span>
                <span style={{ fontSize: 12, color: 'var(--text)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {m.title || '제목 없음'}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  <span style={{ fontSize: 10, color: 'var(--text-3)' }}>
                    {m.credits_reserved ? `${Number(m.credits_reserved).toFixed(0)}cr` : '—'}
                  </span>
                  <span style={{
                    fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 99,
                    background: m.status === 'active' ? 'rgba(5,150,105,0.1)' : m.status === 'completed' ? 'rgba(16,54,125,0.08)' : 'var(--bg-3)',
                    color: m.status === 'active' ? '#059669' : m.status === 'completed' ? 'var(--accent)' : 'var(--text-3)',
                  }}>
                    {MISSION_STATUS_LABEL[m.status] || m.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
          {totalMissionPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 10 }}>
              <button
                onClick={() => setMissionPage(p => Math.max(1, p - 1))}
                disabled={missionPage === 1}
                style={{ background: 'none', border: 'none', cursor: missionPage === 1 ? 'not-allowed' : 'pointer', opacity: missionPage === 1 ? 0.3 : 1, padding: 4 }}
              >
                <ChevronLeft size={14} color="var(--text-2)" />
              </button>
              <span style={{ fontSize: 12, color: 'var(--text-2)', fontWeight: 500 }}>{missionPage} / {totalMissionPages}</span>
              <button
                onClick={() => setMissionPage(p => Math.min(totalMissionPages, p + 1))}
                disabled={missionPage === totalMissionPages}
                style={{ background: 'none', border: 'none', cursor: missionPage === totalMissionPages ? 'not-allowed' : 'pointer', opacity: missionPage === totalMissionPages ? 0.3 : 1, padding: 4 }}
              >
                <ChevronRight size={14} color="var(--text-2)" />
              </button>
            </div>
          )}
        </Card>
      )}

      {/* Card 5 — 관리 액션 */}
      <Card style={{ padding: '16px 18px' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 14 }}>
          관리 액션
        </div>

        {/* 플랜 변경 */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)', marginBottom: 8 }}>플랜 변경</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <select
              value={actionPlan}
              onChange={e => setActionPlan(e.target.value)}
              style={{
                flex: 1, padding: '7px 10px', borderRadius: 8,
                border: '1px solid var(--border)', background: '#fff',
                fontSize: 13, color: 'var(--text)', outline: 'none',
              }}
            >
              <option value="starter">STARTER (월 50cr)</option>
              <option value="pro">PRO (월 165cr)</option>
              <option value="enterprise">ENTERPRISE (월 400cr)</option>
            </select>
            <Btn
              variant="danger"
              disabled={actionLoading || actionPlan === co.plan}
              onClick={() => setConfirmPlan(true)}
              style={{ whiteSpace: 'nowrap', fontSize: 12 }}
            >
              변경
            </Btn>
          </div>
          {co.plan === actionPlan && (
            <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>현재 플랜입니다 (변경 시 크레딧 초기화)</div>
          )}
        </div>

        {/* 크레딧 직접 지급 */}
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)', marginBottom: 8 }}>크레딧 추가 지급</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="number"
              min="1"
              placeholder="추가할 크레딧 수"
              value={addAmount}
              onChange={e => setAddAmount(e.target.value)}
              style={{
                flex: 1, padding: '7px 10px', borderRadius: 8,
                border: '1px solid var(--border)', background: '#fff',
                fontSize: 13, color: 'var(--text)', outline: 'none',
              }}
            />
            <Btn
              variant="primary"
              disabled={actionLoading || !addAmount || Number(addAmount) <= 0}
              onClick={handleAddCredits}
              style={{ whiteSpace: 'nowrap', fontSize: 12 }}
            >
              지급
            </Btn>
          </div>
        </div>

        {/* 결과 메시지 */}
        {actionMsg && (
          <div style={{
            marginTop: 10, padding: '8px 12px', borderRadius: 8, fontSize: 12,
            background: actionMsg.type === 'ok' ? 'rgba(5,150,105,0.09)' : 'rgba(220,38,38,0.09)',
            color: actionMsg.type === 'ok' ? '#059669' : '#DC2626',
            fontWeight: 500,
          }}>
            {actionMsg.text}
          </div>
        )}
      </Card>

      {confirmPlan && (
        <ConfirmModal
          title="플랜 변경"
          desc={`플랜을 ${PLAN_LABEL[actionPlan]}으로 변경합니다.\n크레딧이 ${PLAN_CREDITS[actionPlan]}cr으로 재설정됩니다. 현재 잔여 크레딧은 초기화됩니다.`}
          confirmLabel="플랜 변경"
          onConfirm={() => { setConfirmPlan(false); handlePlanChange(); }}
          onCancel={() => setConfirmPlan(false)}
          danger
        />
      )}
    </div>
  );
}

export default function CompanyManagement() {
  const navigate = useNavigate();
  const [companies, setCompanies]         = useState([]);
  const [missionStats, setMissionStats]   = useState({});
  const [recentMissions, setRecentMissions] = useState({});
  const [loading, setLoading]             = useState(true);
  const [selected, setSelected]           = useState(null);
  const [page, setPage]                   = useState(1);

  // 필터
  const [searchInput, setSearchInput]     = useState('');
  const [searchQuery, setSearchQuery]     = useState('');
  const [planFilter, setPlanFilter]       = useState('all');
  const [creditFilter, setCreditFilter]   = useState('all');
  const [sortBy, setSortBy]               = useState('recent');

  useEffect(() => { load(); }, []);
  useEffect(() => {
    const t = setTimeout(() => { setSearchQuery(searchInput); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  async function load() {
    try {
      setLoading(true);
      const [coRes, msRes] = await Promise.all([
        supabase.from('companies').select('*').order('created_at', { ascending: false }),
        supabase.from('missions')
          .select('id, company_id, status, credits_reserved, type, title, created_at')
          .neq('status', 'draft')
          .order('created_at', { ascending: false }),
      ]);

      const cos = coRes.data || [];
      const ms  = msRes.data || [];

      const stats  = {};
      const recent = {};
      for (const m of ms) {
        const cid = m.company_id;
        if (!stats[cid]) stats[cid] = { total: 0, active: 0, completed: 0, cancelled: 0, totalReserved: 0 };
        stats[cid].total++;
        if (m.status === 'active')    { stats[cid].active++;    stats[cid].totalReserved += Number(m.credits_reserved || 0); }
        if (m.status === 'completed') stats[cid].completed++;
        if (m.status === 'cancelled') stats[cid].cancelled++;
        if (!recent[cid]) recent[cid] = [];
        recent[cid].push(m);
      }

      setCompanies(cos);
      setMissionStats(stats);
      setRecentMissions(recent);
    } catch (err) {
      console.error('[CompanyManagement load]', err);
    } finally {
      setLoading(false);
    }
  }

  // 플랜 변경 후 로컬 상태 반영
  function handlePlanChange(companyId, newPlan) {
    setCompanies(cs => cs.map(c => {
      if (c.id !== companyId) return c;
      return { ...c, plan: newPlan, credit_balance: PLAN_CREDITS[newPlan] ?? c.credit_balance };
    }));
  }

  // 크레딧 지급 후 로컬 상태 반영
  function handleAddCredits(companyId, newBalance) {
    setCompanies(cs => cs.map(c => c.id === companyId ? { ...c, credit_balance: newBalance } : c));
  }

  // 필터 + 정렬
  const filtered = useMemo(() => {
    let list = [...companies];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(c => (c.name || '').toLowerCase().includes(q));
    }
    if (planFilter !== 'all')       list = list.filter(c => c.plan === planFilter);
    if (creditFilter === 'ok')      list = list.filter(c => (c.credit_balance ?? 0) >= 20);
    if (creditFilter === 'warn')    list = list.filter(c => (c.credit_balance ?? 0) >= 10 && (c.credit_balance ?? 0) < 20);
    if (creditFilter === 'danger')  list = list.filter(c => (c.credit_balance ?? 0) < 10);

    list.sort((a, b) => {
      const sa = missionStats[a.id] || {};
      const sb = missionStats[b.id] || {};
      if (sortBy === 'credit_desc')   return (b.credit_balance ?? 0) - (a.credit_balance ?? 0);
      if (sortBy === 'credit_asc')    return (a.credit_balance ?? 0) - (b.credit_balance ?? 0);
      if (sortBy === 'plan')          return ['enterprise', 'pro', 'starter'].indexOf(a.plan) - ['enterprise', 'pro', 'starter'].indexOf(b.plan);
      if (sortBy === 'missions_desc') return (sb.total || 0) - (sa.total || 0);
      return new Date(b.created_at) - new Date(a.created_at);
    });
    return list;
  }, [companies, missionStats, searchQuery, planFilter, creditFilter, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const co = selected ? companies.find(c => c.id === selected) : null;

  // 통계 카드용
  const proCount     = companies.filter(c => c.plan === 'pro' || c.plan === 'enterprise').length;
  const dangerCount  = companies.filter(c => (c.credit_balance ?? 0) < 10).length;
  const activeCoCount = companies.filter(c => (missionStats[c.id]?.active || 0) > 0).length;

  if (loading) return (
    <div style={{ padding: '40px 48px', color: 'var(--text-3)', fontSize: 14 }}>불러오는 중...</div>
  );

  return (
    <div className="page-wrap" style={{ padding: '40px 48px', fontFamily: 'var(--font-ui)' }}>
      {/* 헤더 */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
          ADMIN · COMPANY MANAGEMENT
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', margin: 0 }}>기업 관리</h1>
      </div>

      {/* 통계 카드 */}
      <div className="stat-inline-four" style={{ marginBottom: 24 }}>
        {[
          { label: '전체 기업',       val: companies.length, color: 'var(--text)' },
          { label: 'Pro+ 기업',       val: proCount,         color: proCount > 0 ? '#059669' : 'var(--text)' },
          { label: '크레딧 위험',     val: dangerCount,      color: dangerCount > 0 ? '#DC2626' : 'var(--text)' },
          { label: '활성 의뢰 기업',  val: activeCoCount,    color: 'var(--text)' },
        ].map(({ label, val, color }) => (
          <div key={label} style={{ padding: '16px 20px' }}>
            <div style={{ fontSize: 24, fontWeight: 800, color }}>{val}</div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* 검색 + 필터 바 */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16, alignItems: 'center' }}>
        <input
          type="text"
          placeholder="기업명 검색..."
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          style={{
            padding: '6px 12px', borderRadius: 8, fontSize: 12, width: 180,
            border: '1px solid var(--border)', background: '#fff',
            color: 'var(--text)', outline: 'none',
          }}
        />
        <FilterGroup
          options={[['all', '전체'], ['starter', 'Starter'], ['pro', 'Pro'], ['enterprise', 'Enterprise']]}
          value={planFilter}
          onChange={v => { setPlanFilter(v); setPage(1); }}
        />
        <FilterGroup
          options={[['all', '전체'], ['ok', '충분(≥20)'], ['warn', '주의(10~19)'], ['danger', '위험(<10)']]}
          value={creditFilter}
          onChange={v => { setCreditFilter(v); setPage(1); }}
        />
        <select
          value={sortBy}
          onChange={e => { setSortBy(e.target.value); setPage(1); }}
          style={{
            marginLeft: 'auto', padding: '6px 10px', borderRadius: 8, fontSize: 12,
            border: '1px solid var(--border)', background: '#fff', color: 'var(--text)', outline: 'none',
          }}
        >
          <option value="recent">최근 가입순</option>
          <option value="credit_desc">크레딧 많은순</option>
          <option value="credit_asc">크레딧 적은순</option>
          <option value="plan">Pro+ 먼저</option>
          <option value="missions_desc">의뢰 많은순</option>
        </select>
      </div>

      {/* 본문 — 테이블 + 상세 패널 */}
      <div className="panel-mgmt-layout" style={{ display: 'grid', gridTemplateColumns: co ? '1fr 360px' : '1fr', gap: 20 }}>
        {/* 테이블 */}
        <div>
          <div className="table-scroll">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--bg-2)', borderBottom: '1px solid var(--border)' }}>
                  {['', '기업명', '플랜', '크레딧 잔액', '예약 크레딧', '의뢰 현황', '가입일'].map(h => (
                    <th key={h} style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--text-3)', textAlign: 'left', fontSize: 11, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paged.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-3)' }}>조건에 맞는 기업이 없습니다.</td>
                  </tr>
                )}
                {paged.map(c => {
                  const st   = missionStats[c.id] || { total: 0, active: 0, totalReserved: 0 };
                  const flag = getCompanyFlag(c);
                  const bal  = c.credit_balance ?? 0;
                  const isSel = selected === c.id;

                  return (
                    <tr
                      key={c.id}
                      onClick={() => setSelected(isSel ? null : c.id)}
                      style={{
                        borderBottom: '1px solid var(--border-light)',
                        cursor: 'pointer',
                        background: isSel ? 'rgba(16,54,125,0.05)' : 'transparent',
                        transition: 'background 0.12s',
                      }}
                      onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = 'var(--bg-2)'; }}
                      onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = 'transparent'; }}
                    >
                      {/* flag */}
                      <td style={{ padding: '10px 12px', width: 28 }}>
                        {flag === 'danger' && <AlertTriangle size={14} color="#DC2626" />}
                        {flag === 'warn'   && <AlertTriangle size={14} color="#F59E0B" />}
                        {flag === 'star'   && <Star size={14} color="#059669" fill="#059669" />}
                      </td>
                      {/* 기업명 */}
                      <td style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--text)' }}>
                        {c.name || '—'}
                      </td>
                      {/* 플랜 */}
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4,
                          background: PLAN_COLOR[c.plan] || '#64748B', color: '#fff', letterSpacing: '0.05em',
                        }}>{PLAN_LABEL[c.plan] || 'STARTER'}</span>
                      </td>
                      {/* 크레딧 잔액 */}
                      <td style={{ padding: '10px 12px', fontWeight: 700, color: creditColor(bal) }}>
                        {bal.toFixed(1)}
                      </td>
                      {/* 예약 크레딧 */}
                      <td style={{ padding: '10px 12px', color: 'var(--text-2)' }}>
                        {st.totalReserved > 0 ? st.totalReserved.toFixed(1) : '—'}
                      </td>
                      {/* 의뢰 현황 */}
                      <td style={{ padding: '10px 12px', color: 'var(--text-2)' }}>
                        <span style={{ color: st.active > 0 ? '#059669' : 'var(--text-3)', fontWeight: st.active > 0 ? 600 : 400 }}>
                          {st.active}
                        </span>
                        <span style={{ color: 'var(--text-3)' }}> / {st.total}</span>
                      </td>
                      {/* 가입일 */}
                      <td style={{ padding: '10px 12px', color: 'var(--text-3)', fontSize: 12 }}>
                        {relativeTime(c.created_at)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* 페이지네이션 */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, marginTop: 16 }}>
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                style={{ background: 'none', border: 'none', cursor: page === 1 ? 'not-allowed' : 'pointer', opacity: page === 1 ? 0.3 : 1, padding: 4 }}
              >
                <ChevronLeft size={16} color="var(--text-2)" />
              </button>
              <span style={{ fontSize: 13, color: 'var(--text-2)', fontWeight: 500 }}>{page} / {totalPages}</span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                style={{ background: 'none', border: 'none', cursor: page === totalPages ? 'not-allowed' : 'pointer', opacity: page === totalPages ? 0.3 : 1, padding: 4 }}
              >
                <ChevronRight size={16} color="var(--text-2)" />
              </button>
            </div>
          )}
        </div>

        {/* 우측 상세 패널 */}
        {co && (
          <CompanyDetail
            co={co}
            stats={missionStats}
            recent={recentMissions}
            onPlanChange={handlePlanChange}
            onAddCredits={handleAddCredits}
            onMissionClick={(missionId) => navigate('/admin/missions', { state: { missionId } })}
          />
        )}
      </div>
    </div>
  );
}
