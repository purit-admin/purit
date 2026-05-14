import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Stat, Btn, Badge, ConfirmModal } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { motion } from 'framer-motion';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  RadialBarChart, RadialBar,
  Legend,
  ResponsiveContainer,
} from 'recharts';

const C = {
  pageBg:  '#F8FAFC',
  cardBg:  '#FFFFFF',
  primary: '#10367D',
  text:    '#0F172A',
  text2:   '#475569',
  text3:   '#94A3B8',
  blue50:  '#E8EEF8',
  shadow:  '0 1px 3px rgba(0,0,0,0.06)',
};

const STATUS_LABEL = { draft: '임시 저장', active: '진행 중', in_review: '검토 중', completed: '완료', cancelled: '취소' };
const STATUS_COLOR = { draft: 'gold', active: 'green', in_review: 'blue', completed: 'gold', cancelled: 'red' };

const DRAFT_ROUTE = { landing_page: '/company/new', preference: '/company/preference', pricing: '/company/pricing-test', email: '/company/email-test' };

const BENCHMARK = { 명확성: 3.2, 관련성: 3.5, 가치: 3.0, 차별성: 2.8, 신뢰도: 3.3 };
const SCORE_KEYS = ['clarity_score', 'relevance_score', 'value_score', 'differentiation_score', 'trust_score'];
const DIM_LABELS = ['명확성', '관련성', '가치', '차별성', '신뢰도'];

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, ease: 'easeOut', delay },
});
const stagger = { initial: {}, animate: { transition: { staggerChildren: 0.07 } } };
const staggerItem = { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0, transition: { duration: 0.4 } } };

function computeRadar(fbs) {
  const avg = key => {
    const vals = fbs.map(f => f[key]).filter(v => v != null && v > 0);
    return vals.length ? +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : 0;
  };
  return DIM_LABELS.map((label, i) => ({
    dimension: label,
    score: avg(SCORE_KEYS[i]),
    benchmark: BENCHMARK[label],
    fullMark: 5,
  }));
}

function computeSentiment(missions, fbs) {
  const mainMissions = missions.filter(m => !m.type || m.type === 'landing_page');
  return mainMissions.map(m => {
    const mFbs = fbs.filter(f => f.mission_id === m.id);
    if (!mFbs.length) return { name: m.title?.slice(0, 8), positive: 0, hasData: false };
    const posCount = mFbs.filter(f => {
      const scores = SCORE_KEYS.map(k => f[k]).filter(v => v != null && v > 0);
      const a = scores.length ? scores.reduce((s, v) => s + v, 0) / scores.length : 0;
      return a >= 3.5;
    }).length;
    const positive = Math.round((posCount / mFbs.length) * 100);
    return { name: m.title?.slice(0, 8), positive, hasData: true };
  });
}

function computeSubSentiment(missions, prefResps, priceResps, emailResps) {
  const subMissions = missions.filter(m => ['preference', 'pricing', 'email'].includes(m.type));
  return subMissions.map(m => {
    let perPanelAvgs = [];
    if (m.type === 'preference') {
      const resps = prefResps.filter(r => r.mission_id === m.id);
      perPanelAvgs = resps.map(r => {
        const vals = [r.message_clarity, r.purchase_intent].filter(v => v != null);
        return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
      }).filter(v => v != null);
    } else if (m.type === 'pricing') {
      const resps = priceResps.filter(r => r.mission_id === m.id);
      perPanelAvgs = resps.map(r => {
        const vals = [r.price_fairness, r.value_perception].filter(v => v != null);
        return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
      }).filter(v => v != null);
    } else if (m.type === 'email') {
      const resps = emailResps.filter(r => r.mission_id === m.id);
      perPanelAvgs = resps.map(r => {
        const vals = [r.open_intent, r.hook_score, r.clarity_score, r.curiosity_score].filter(v => v != null);
        return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
      }).filter(v => v != null);
    }
    if (!perPanelAvgs.length) return { name: m.title?.slice(0, 8), positive: 0, hasData: false };
    const posCount = perPanelAvgs.filter(s => s >= 3.5).length;
    const positive = Math.round((posCount / perPanelAvgs.length) * 100);
    return { name: m.title?.slice(0, 8), positive, hasData: true };
  });
}

const NDA_KEY = 'purit_nda_banner_dismissed';
function isBannerDismissed() {
  try {
    const ts = localStorage.getItem(NDA_KEY);
    if (!ts) return false;
    return Date.now() - Number(ts) < 24 * 60 * 60 * 1000;
  } catch { return false; }
}

const PAGE_SIZE = 5;

function Pagination({ page, total, onPage }) {
  const totalPages = Math.ceil(total / PAGE_SIZE);
  if (totalPages <= 1) return null;
  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginTop: 12, justifyContent: 'center' }}>
      <button onClick={() => onPage(page - 1)} disabled={page === 1}
        style={{ padding: '5px 10px', borderRadius: 6, background: C.cardBg, color: C.text2, border: 'none', cursor: page === 1 ? 'not-allowed' : 'pointer', opacity: page === 1 ? 0.4 : 1, fontSize: 13 }}>
        이전
      </button>
      {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
        <button key={n} onClick={() => onPage(n)}
          style={{ padding: '5px 10px', borderRadius: 6, background: page === n ? C.primary : C.cardBg, color: page === n ? '#fff' : C.text2, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: page === n ? 700 : 400 }}>
          {n}
        </button>
      ))}
      <button onClick={() => onPage(page + 1)} disabled={page === totalPages}
        style={{ padding: '5px 10px', borderRadius: 6, background: C.cardBg, color: C.text2, border: 'none', cursor: page === totalPages ? 'not-allowed' : 'pointer', opacity: page === totalPages ? 0.4 : 1, fontSize: 13 }}>
        다음
      </button>
    </div>
  );
}

function CompanyMissionCard({ m, navigate, onTerminate, onDelete }) {
  const filled = m.filled_count ?? 0;
  const isLive = m.status === 'active' && filled >= 1;
  const isDraft = m.status === 'draft';
  const pct = m.panel_count ? Math.min((filled / m.panel_count) * 100, 100) : 0;

  const statusBadgeType = isDraft ? 'gold'
    : m.status === 'active' ? (filled === 0 ? 'gray' : 'green')
    : m.status === 'completed' ? 'blue'
    : (STATUS_COLOR[m.status] || 'gray');
  const statusBadgeLabel = isDraft ? '임시 저장'
    : m.status === 'active' ? (filled === 0 ? '매칭 대기' : '진행 중')
    : (STATUS_LABEL[m.status] || m.status);

  const handleClick = () => {
    if (isDraft) {
      const route = DRAFT_ROUTE[m.type || 'landing_page'] || '/company/new';
      navigate(route, { state: { editMode: true, missionId: m.id } });
    } else {
      navigate(`/company/results?id=${m.id}`);
    }
  };

  return (
    <div
      onClick={handleClick}
      style={{ background: C.cardBg, borderRadius: 16, padding: '20px', boxShadow: C.shadow, cursor: 'pointer', transition: 'box-shadow 0.2s', border: isDraft ? '1px dashed #f59e0b' : 'none' }}
      onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.10)'}
      onMouseLeave={e => e.currentTarget.style.boxShadow = C.shadow}
    >
      <div className="mc-row">
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 7, flexWrap: 'wrap' }}>
            <Badge type={statusBadgeType}>{statusBadgeLabel}</Badge>
            {isLive && (
              <span style={{ fontSize: 10, color: '#ef4444', background: 'rgba(239,68,68,0.08)', borderRadius: 4, padding: '1px 6px', fontWeight: 700 }}>
                🔒 수정 잠금
              </span>
            )}
            {m.type === 'preference' && <Badge type="blue">소재 비교</Badge>}
            {m.type === 'pricing'    && <Badge type="gold">가격 검증</Badge>}
            {m.type === 'email'      && <Badge type="blue">이메일 검증</Badge>}
            <span style={{ fontSize: 11, color: C.text3 }}>
              {m.id.slice(0, 8).toUpperCase()}
            </span>
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 3 }}>{m.title}</div>
          {m.target_url && <div style={{ fontSize: 12, color: C.text3 }}>{m.target_url}</div>}
        </div>
        <div className="mc-right">
          {isDraft ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
              <button
                onClick={e => { e.stopPropagation(); handleClick(); }}
                style={{
                  padding: '6px 14px', fontSize: 11, fontWeight: 700,
                  borderRadius: 8, border: 'none',
                  background: 'rgba(16,54,125,0.07)', color: 'var(--text-2)', cursor: 'pointer',
                }}
              >
                이어 작성하기 →
              </button>
              <button
                onClick={e => { e.stopPropagation(); onDelete(m.id); }}
                style={{
                  padding: '5px 12px', fontSize: 11, fontWeight: 600,
                  borderRadius: 8, border: 'none',
                  background: 'rgba(239,68,68,0.08)', color: '#ef4444', cursor: 'pointer',
                }}
              >
                삭제
              </button>
            </div>
          ) : (
            <>
              <div style={{ fontSize: 11, color: C.text3 }}>피드백 수집</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: C.primary }}>
                {filled}<span style={{ fontSize: 13, color: C.text3, fontWeight: 400 }}> / {m.panel_count}</span>
              </div>
              <div style={{ width: 80, height: 4, background: '#E2E8F0', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ width: `${pct}%`, height: '100%', background: isLive ? '#ef4444' : C.primary, borderRadius: 2, transition: 'width 0.4s' }} />
              </div>
              <div style={{ fontSize: 11, color: C.text3 }}>
                {new Date(m.created_at).toLocaleDateString('ko-KR')} 등록
              </div>
              {m.status === 'active' && filled === 0 && (
                <button
                  onClick={e => { e.stopPropagation(); navigate(DRAFT_ROUTE[m.type || 'landing_page'] || '/company/new', { state: { editMode: true, missionId: m.id } }); }}
                  style={{
                    padding: '5px 12px', fontSize: 11, fontWeight: 600,
                    borderRadius: 8, border: 'none',
                    background: '#F1F5F9', color: C.text2, cursor: 'pointer',
                    transition: 'background 0.12s',
                  }}
                >
                  수정
                </button>
              )}
              {m.status === 'active' && filled >= 1 && (
                <button
                  onClick={e => { e.stopPropagation(); onTerminate(m); }}
                  style={{
                    padding: '5px 12px', fontSize: 11, fontWeight: 600,
                    borderRadius: 8, border: 'none',
                    background: 'rgba(239,68,68,0.08)', color: '#ef4444', cursor: 'pointer',
                    transition: 'background 0.12s',
                  }}
                >
                  의뢰 조기 종료
                </button>
              )}
              {m.status === 'completed' && (
                <button
                  onClick={e => { e.stopPropagation(); onDelete(m.id); }}
                  style={{
                    padding: '5px 12px', fontSize: 11, fontWeight: 600,
                    borderRadius: 8, border: 'none',
                    background: 'rgba(239,68,68,0.08)', color: '#ef4444', cursor: 'pointer',
                  }}
                >
                  삭제
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CompanyDashboard() {
  const navigate = useNavigate();
  const [company, setCompany]         = useState(null);
  const [missions, setMissions]       = useState([]);
  const [feedbacks, setFeedbacks]     = useState([]);
  const [loading, setLoading]         = useState(true);
  const [missionFilter, setMissionFilter] = useState('active');
  const [mainMissionPage, setMainMissionPage] = useState(1);
  const [subMissionPage, setSubMissionPage]   = useState(1);
  const [showBanner, setShowBanner] = useState(() => !isBannerDismissed());
  const [terminateTarget, setTerminateTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [prefResps, setPrefResps]   = useState([]);
  const [priceResps, setPriceResps] = useState([]);
  const [emailResps, setEmailResps] = useState([]);
  const [mainSentPage, setMainSentPage] = useState(1);
  const [subSentPage, setSubSentPage]   = useState(1);

  const dismissBanner = () => {
    localStorage.setItem(NDA_KEY, String(Date.now()));
    setShowBanner(false);
  };

  const handleTerminate = async () => {
    if (!terminateTarget) return;
    const { error } = await supabase
      .from('missions')
      .update({ status: 'cancelled' })
      .eq('id', terminateTarget.id);
    if (!error) {
      setMissions(prev => prev.map(m => m.id === terminateTarget.id ? { ...m, status: 'cancelled' } : m));
      const { data: co } = await supabase.from('companies').select('*').eq('id', company.id).single();
      if (co) setCompany(co);
      supabase.rpc('recalc_mission_consumed', { p_mission_id: terminateTarget.id })
        .then(({ error: re }) => { if (re) console.warn('[recalc]', re.message); });
    }
    setTerminateTarget(null);
  };

  const handleDeleteMission = async () => {
    if (!deleteTarget) return;
    await supabase.from('missions').delete().eq('id', deleteTarget);
    setMissions(prev => prev.filter(m => m.id !== deleteTarget));
    setDeleteTarget(null);
  };

  useEffect(() => {
    let sub = null;

    async function load() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setLoading(false); return; }

        const { data: co } = await supabase
          .from('companies')
          .select('*')
          .eq('user_id', user.id)
          .single();
        setCompany(co);

        if (co) {
          const { data: ms } = await supabase
            .from('missions')
            .select('*')
            .eq('company_id', co.id)
            .order('created_at', { ascending: false });
          setMissions(ms || []);

          if (ms?.length) {
            const { data: fb } = await supabase
              .from('feedbacks')
              .select('clarity_score,relevance_score,value_score,differentiation_score,trust_score,mission_id')
              .in('status', ['submitted', 'approved'])
              .in('mission_id', ms.map(m => m.id));
            setFeedbacks(fb || []);

          const prefIds  = ms.filter(m => m.type === 'preference').map(m => m.id);
          const priceIds = ms.filter(m => m.type === 'pricing').map(m => m.id);
          const emailIds = ms.filter(m => m.type === 'email').map(m => m.id);
          if (prefIds.length) {
            const { data: pr } = await supabase.from('preference_responses')
              .select('mission_id, message_clarity, purchase_intent')
              .in('mission_id', prefIds);
            setPrefResps(pr || []);
          }
          if (priceIds.length) {
            const { data: pr } = await supabase.from('pricing_responses')
              .select('mission_id, price_fairness, value_perception')
              .in('mission_id', priceIds);
            setPriceResps(pr || []);
          }
          if (emailIds.length) {
            const { data: er } = await supabase.from('email_responses')
              .select('mission_id, open_intent, hook_score, clarity_score, curiosity_score')
              .in('mission_id', emailIds);
            setEmailResps(er || []);
          }
        }

        sub = supabase
          .channel(`company-dashboard-missions-${co.id}`)
          .on('postgres_changes', {
            event: 'UPDATE', schema: 'public', table: 'missions',
            filter: `company_id=eq.${co.id}`,
          }, (payload) => {
            setMissions(prev => prev.map(m => m.id === payload.new.id ? { ...m, ...payload.new } : m));
          })
          .subscribe();
        }
        setLoading(false);
      } catch (err) {
        console.error('[Dashboard] load error:', err);
        setLoading(false);
      }
    }

    load();
    return () => { if (sub) supabase.removeChannel(sub); };
  }, []);

  const missionFiltered = missionFilter === 'all'
    ? missions
    : missions.filter(m => m.status === missionFilter);
  const mainMissions = missionFiltered.filter(m => !m.type || m.type === 'landing_page');
  const subMissions  = missionFiltered.filter(m => ['preference', 'pricing', 'email'].includes(m.type));
  const mainPaged    = mainMissions.slice((mainMissionPage - 1) * PAGE_SIZE, mainMissionPage * PAGE_SIZE);
  const subPaged     = subMissions.slice((subMissionPage - 1) * PAGE_SIZE, subMissionPage * PAGE_SIZE);

  const radarData     = computeRadar(feedbacks);
  const overallScore  = radarData.reduce((acc, d) => acc + d.score, 0) / radarData.length;
  const gaugeValue    = feedbacks.length > 0 ? Math.round((overallScore / 5) * 100) : 0;
  const gaugeData     = [{ name: '전환 지수', value: gaugeValue, fill: '#6366f1' }];
  const mainSentiment = computeSentiment(missions, feedbacks);
  const subSentiment  = computeSubSentiment(missions, prefResps, priceResps, emailResps);
  const SENT_SIZE = 4;
  const mainSentSlice = mainSentiment.slice((mainSentPage - 1) * SENT_SIZE, mainSentPage * SENT_SIZE);
  const subSentSlice  = subSentiment.slice((subSentPage - 1) * SENT_SIZE, subSentPage * SENT_SIZE);

  if (loading) return (
    <div style={{ background: C.pageBg, minHeight: '100vh', padding: '40px 48px', color: C.text3, fontSize: 14 }}>불러오는 중...</div>
  );

  return (
    <>
    <div className="page-wrap" style={{ background: C.pageBg, minHeight: '100vh', padding: '40px 48px', maxWidth: 1100 }}>

      {/* NDA 배너 */}
      {showBanner && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: '#fff', borderLeft: `3px solid ${C.primary}`,
          borderRadius: 12, padding: '12px 18px', marginBottom: 24,
          fontSize: 13, color: C.text2,
        }}>
          <span>🔒 <strong style={{ color: C.text }}>Purit의 피드백 패널(참가자)는 기업의 정보를 발설할 수 없습니다.</strong></span>
          <button onClick={dismissBanner} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: C.text3, fontSize: 18, lineHeight: 1, padding: '0 4px', flexShrink: 0,
          }}>×</button>
        </div>
      )}

      {/* Header */}
      <motion.div {...fadeUp(0)} className="dash-header-row">
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: C.text, marginBottom: 6 }}>
            {company?.name || '대시보드'}
          </h1>
          <p style={{ color: C.text2, fontSize: 14 }}>광고비 집행 전 전환 결함을 미리 잡으세요.</p>
        </div>
        <button
          onClick={() => navigate('/company/new')}
          style={{ padding: '12px 24px', borderRadius: 12, background: C.primary, color: '#fff', fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer', height: 48, transition: 'opacity 0.15s' }}
          onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
          onMouseLeave={e => e.currentTarget.style.opacity = '1'}
        >+ 새 의뢰 등록</button>
      </motion.div>

      {/* Stats */}
      <motion.div
        variants={stagger}
        initial="initial"
        animate="animate"
        className="dash-stat-grid-5"
      >
        {[
          { label: '잔여 크레딧', value: String(company?.credit_balance ?? 0), sub: (company?.plan || '플랜 미선택').toUpperCase(), accent: (company?.credit_balance ?? 0) > 0 },
          { label: '전체 의뢰',  value: String(missions.length),                                        sub: '누적' },
          { label: '진행 중',    value: String(missions.filter(m => m.status === 'active').length),    sub: '현재 활성' },
          { label: '완료',       value: String(missions.filter(m => m.status === 'completed').length), sub: '검증 완료' },
          { label: '수집 피드백', value: String(feedbacks.length),         sub: '제출 완료', accent: feedbacks.length > 0 },
        ].map(s => (
          <motion.div key={s.label} variants={staggerItem} style={{ background: C.cardBg, borderRadius: 16, padding: '20px 20px', boxShadow: C.shadow }}>
            <Stat {...s} />
          </motion.div>
        ))}
      </motion.div>

      {/* Chart Row: 레이더 + KPI + 긍부정 3열 */}
      <motion.div {...fadeUp(0.1)} className="chart-three-col" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, marginBottom: 24 }}>

        {/* 5차원 레이더 차트 */}
        <div style={{ background: C.cardBg, borderRadius: 16, padding: '24px', boxShadow: C.shadow }}>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>전환 메시지 5차원 진단</div>
            <div style={{ fontSize: 12, color: C.text3, marginTop: 4 }}>
              {feedbacks.length > 0 ? `패널 ${feedbacks.length}명 제출 기준 · 플랫폼 벤치마크 비교` : '피드백 수집 시 실데이터로 업데이트됩니다'}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <RadarChart data={radarData} margin={{ top: 10, right: 28, bottom: 10, left: 28 }}>
              <PolarGrid stroke="#E2E8F0" />
              <PolarAngleAxis dataKey="dimension" tick={{ fill: C.text2, fontSize: 11, fontWeight: 600 }} />
              <PolarRadiusAxis angle={90} domain={[0, 5]} tick={false} axisLine={false} />
              <Radar name="내 점수" dataKey="score" stroke="#10367D" fill="#10367D" fillOpacity={0.2} strokeWidth={2} isAnimationActive animationDuration={1000} />
              <Radar name="벤치마크" dataKey="benchmark" stroke="#94a3b8" fill="#94a3b8" fillOpacity={0.1} strokeWidth={1.5} strokeDasharray="4 3" isAnimationActive animationDuration={1000} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: C.text2, paddingTop: 8 }} />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        {/* KPI 게이지 */}
        <div style={{ background: C.cardBg, borderRadius: 16, padding: '24px', boxShadow: C.shadow, display: 'flex', flexDirection: 'column' }}>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>전환 지수 달성률</div>
            <div style={{ fontSize: 12, color: C.text3, marginTop: 4 }}>5개 축 종합 퍼포먼스</div>
          </div>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ResponsiveContainer width="100%" height={160}>
              <RadialBarChart
                data={[{ name: '전환 지수', value: gaugeValue, fill: '#10367D' }]}
                innerRadius="55%"
                outerRadius="85%"
                startAngle={180}
                endAngle={0}
                barSize={14}
              >
                <RadialBar background={{ fill: '#E2E8F0' }} dataKey="value" cornerRadius={10} isAnimationActive animationDuration={1200} />
              </RadialBarChart>
            </ResponsiveContainer>
            <div style={{ position: 'absolute', bottom: 10, textAlign: 'center' }}>
              <div style={{ fontSize: 34, fontWeight: 900, color: feedbacks.length > 0 ? C.primary : C.text3, lineHeight: 1 }}>
                {feedbacks.length > 0 ? gaugeValue : '—'}
              </div>
              <div style={{ fontSize: 12, color: C.text3, marginTop: 3 }}>
                {feedbacks.length > 0 ? '/ 100점' : '데이터 없음'}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 4 }}>
            {radarData.map(d => (
              <div key={d.dimension} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ fontSize: 11, color: C.text2, width: 40, flexShrink: 0 }}>{d.dimension}</div>
                <div style={{ flex: 1, height: 4, background: '#E2E8F0', borderRadius: 3, overflow: 'hidden' }}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(d.score / 5) * 100}%` }}
                    transition={{ duration: 0.9, ease: 'easeOut', delay: 0.3 }}
                    style={{ height: '100%', background: '#10367D', borderRadius: 3 }}
                  />
                </div>
                <div style={{ fontSize: 11, color: C.text2, width: 24, textAlign: 'right' }}>
                  {d.score > 0 ? d.score : '—'}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 긍/부정 반응 분포 */}
        <div style={{ background: C.cardBg, borderRadius: 16, padding: '24px', boxShadow: C.shadow }}>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>패널별 긍/부정 반응 분포</div>
            <div style={{ fontSize: 12, color: C.text3, marginTop: 4 }}>평균 점수 3.5 이상 = 긍정 반응 기준</div>
          </div>

          {/* 메인 의뢰 섹션 */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.text2, marginBottom: 8, letterSpacing: '0.04em', textTransform: 'uppercase' }}>메인 의뢰</div>
            {mainSentSlice.length > 0 ? (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {mainSentSlice.map((d, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ fontSize: 10, color: C.text2, width: 62, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</div>
                      <div style={{ flex: 1, height: 5, background: '#E8EEF8', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ width: `${d.positive}%`, height: '100%', background: '#10367D', borderRadius: 3, transition: 'width 0.7s ease' }} />
                      </div>
                      <div style={{ fontSize: 10, color: d.hasData ? C.text2 : C.text3, width: 28, textAlign: 'right', fontWeight: 600 }}>{d.hasData ? `${d.positive}%` : '—'}</div>
                    </div>
                  ))}
                </div>
                {mainSentiment.length > SENT_SIZE && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 6, marginTop: 6 }}>
                    <button onClick={() => setMainSentPage(p => Math.max(1, p - 1))} disabled={mainSentPage === 1}
                      style={{ padding: '2px 8px', borderRadius: 4, background: mainSentPage === 1 ? '#F1F5F9' : C.blue50, color: mainSentPage === 1 ? C.text3 : C.primary, border: 'none', cursor: mainSentPage === 1 ? 'not-allowed' : 'pointer', fontSize: 14, fontWeight: 700, opacity: mainSentPage === 1 ? 0.45 : 1 }}>‹</button>
                    <span style={{ fontSize: 10, color: C.text3 }}>{mainSentPage} / {Math.ceil(mainSentiment.length / SENT_SIZE)}</span>
                    <button onClick={() => setMainSentPage(p => Math.min(Math.ceil(mainSentiment.length / SENT_SIZE), p + 1))} disabled={mainSentPage * SENT_SIZE >= mainSentiment.length}
                      style={{ padding: '2px 8px', borderRadius: 4, background: mainSentPage * SENT_SIZE >= mainSentiment.length ? '#F1F5F9' : C.blue50, color: mainSentPage * SENT_SIZE >= mainSentiment.length ? C.text3 : C.primary, border: 'none', cursor: mainSentPage * SENT_SIZE >= mainSentiment.length ? 'not-allowed' : 'pointer', fontSize: 14, fontWeight: 700, opacity: mainSentPage * SENT_SIZE >= mainSentiment.length ? 0.45 : 1 }}>›</button>
                  </div>
                )}
              </>
            ) : (
              <div style={{ fontSize: 12, color: C.text3, padding: '6px 0' }}>피드백 수집 시 표시됩니다.</div>
            )}
          </div>

          <div style={{ borderTop: '1px solid #F1F5F9', marginBottom: 14 }} />

          {/* 서브 의뢰 섹션 */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.text2, marginBottom: 8, letterSpacing: '0.04em', textTransform: 'uppercase' }}>서브 의뢰</div>
            {subSentSlice.length > 0 ? (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {subSentSlice.map((d, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ fontSize: 10, color: C.text2, width: 62, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</div>
                      <div style={{ flex: 1, height: 5, background: '#E8EEF8', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ width: `${d.positive}%`, height: '100%', background: '#10367D', borderRadius: 3, transition: 'width 0.7s ease' }} />
                      </div>
                      <div style={{ fontSize: 10, color: d.hasData ? C.text2 : C.text3, width: 28, textAlign: 'right', fontWeight: 600 }}>{d.hasData ? `${d.positive}%` : '—'}</div>
                    </div>
                  ))}
                </div>
                {subSentiment.length > SENT_SIZE && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 6, marginTop: 6 }}>
                    <button onClick={() => setSubSentPage(p => Math.max(1, p - 1))} disabled={subSentPage === 1}
                      style={{ padding: '2px 8px', borderRadius: 4, background: subSentPage === 1 ? '#F1F5F9' : C.blue50, color: subSentPage === 1 ? C.text3 : C.primary, border: 'none', cursor: subSentPage === 1 ? 'not-allowed' : 'pointer', fontSize: 14, fontWeight: 700, opacity: subSentPage === 1 ? 0.45 : 1 }}>‹</button>
                    <span style={{ fontSize: 10, color: C.text3 }}>{subSentPage} / {Math.ceil(subSentiment.length / SENT_SIZE)}</span>
                    <button onClick={() => setSubSentPage(p => Math.min(Math.ceil(subSentiment.length / SENT_SIZE), p + 1))} disabled={subSentPage * SENT_SIZE >= subSentiment.length}
                      style={{ padding: '2px 8px', borderRadius: 4, background: subSentPage * SENT_SIZE >= subSentiment.length ? '#F1F5F9' : C.blue50, color: subSentPage * SENT_SIZE >= subSentiment.length ? C.text3 : C.primary, border: 'none', cursor: subSentPage * SENT_SIZE >= subSentiment.length ? 'not-allowed' : 'pointer', fontSize: 14, fontWeight: 700, opacity: subSentPage * SENT_SIZE >= subSentiment.length ? 0.45 : 1 }}>›</button>
                  </div>
                )}
              </>
            ) : (
              <div style={{ fontSize: 12, color: C.text3, padding: '6px 0' }}>피드백 수집 시 표시됩니다.</div>
            )}
          </div>
        </div>
      </motion.div>

      {/* 전체 미션 현황 (통합) */}
      <motion.div {...fadeUp(0.3)}>
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: C.text2 }}>전체 의뢰 현황</h2>

        {/* 탭 — underline 스타일 */}
        <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: `1px solid #E2E8F0` }}>
          {[['all', '전체'], ['active', '진행'], ['completed', '완료'], ['draft', '임시 저장'], ['cancelled', '취소']].map(([v, l]) => (
            <button key={v} onClick={() => { setMissionFilter(v); setMainMissionPage(1); setSubMissionPage(1); }} style={{
              padding: '8px 16px', marginBottom: -1, fontSize: 14, fontWeight: missionFilter === v ? 700 : 500,
              background: 'transparent',
              color: missionFilter === v ? C.text : C.text3,
              borderBottom: missionFilter === v ? `2px solid ${C.text}` : '2px solid transparent',
              border: 'none', borderRadius: 0,
              transition: 'all 0.15s', cursor: 'pointer',
            }}>{l}</button>
          ))}
        </div>

        {missions.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', background: C.cardBg, borderRadius: 16, boxShadow: C.shadow, color: C.text3, fontSize: 14 }}>
            등록된 의뢰가 없습니다.{' '}
            <span style={{ color: C.primary, cursor: 'pointer', fontWeight: 600 }} onClick={() => navigate('/company/new')}>첫 의뢰를 등록해보세요 →</span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
            {/* 메인 의뢰 섹션 */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: C.text2 }}>메인 의뢰</h3>
                <Badge type="gray">{mainMissions.length}개</Badge>
              </div>
              {mainMissions.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', color: C.text3, fontSize: 14, background: C.cardBg, borderRadius: 12, boxShadow: C.shadow }}>
                  해당 조건의 의뢰가 없습니다.
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {mainPaged.map(m => <CompanyMissionCard key={m.id} m={m} navigate={navigate} onTerminate={setTerminateTarget} onDelete={setDeleteTarget} />)}
                  </div>
                  <Pagination page={mainMissionPage} total={mainMissions.length} onPage={setMainMissionPage} />
                </>
              )}
            </div>

            {/* 서브 의뢰 섹션 */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: C.text2 }}>서브 의뢰</h3>
                <Badge type="blue">{subMissions.length}개</Badge>
              </div>
              {subMissions.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', color: C.text3, fontSize: 14, background: C.cardBg, borderRadius: 12, boxShadow: C.shadow }}>
                  해당 조건의 의뢰가 없습니다.
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {subPaged.map(m => <CompanyMissionCard key={m.id} m={m} navigate={navigate} onTerminate={setTerminateTarget} onDelete={setDeleteTarget} />)}
                  </div>
                  <Pagination page={subMissionPage} total={subMissions.length} onPage={setSubMissionPage} />
                </>
              )}
            </div>
          </div>
        )}
      </motion.div>

    </div>

    {terminateTarget && (
      <ConfirmModal
        title="의뢰를 조기 종료할까요?"
        desc={`"${terminateTarget.title}" 의뢰를 지금 종료하면 패널 매칭이 즉시 중단됩니다.\n\n⚠️ 조기 종료 시 잔여 크레딧은 환불되지 않습니다. 이미 수집된 피드백 결과는 피드백 결과 페이지에서 계속 확인하실 수 있습니다.\n\n이 작업은 되돌릴 수 없습니다.`}
        confirmLabel="조기 종료 (크레딧 환불 불가)"
        cancelLabel="유지"
        danger
        onConfirm={handleTerminate}
        onCancel={() => setTerminateTarget(null)}
      />
    )}
    {deleteTarget && (
      <ConfirmModal
        title="의뢰를 영구 삭제할까요?"
        desc={"이 의뢰를 영구적으로 삭제합니다.\n삭제된 데이터는 복구할 수 없습니다."}
        confirmLabel="영구 삭제"
        cancelLabel="취소"
        danger
        onConfirm={handleDeleteMission}
        onCancel={() => setDeleteTarget(null)}
      />
    )}
    </>
  );
}
