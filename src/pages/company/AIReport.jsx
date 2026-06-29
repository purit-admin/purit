import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactDOM from 'react-dom';
import { Card, Badge, Btn } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { resolveCompany } from '../../lib/resolveCompany';

const MONTHLY_LIMIT = 10;

const DIMS = [
  { key: 'clarity_score',         label: '헤드라인·명확성' },
  { key: 'relevance_score',       label: '관련성·페르소나' },
  { key: 'value_score',           label: '가치·가격' },
  { key: 'differentiation_score', label: '차별화' },
  { key: 'trust_score',           label: '신뢰·사회적 증거' },
];

const IMPACT_MAP = {
  clarity_score:         ['전환율 +15~25% 예상', '헤드라인이 카테고리 정체성 없이 타겟이 즉시 이탈합니다.', '구체적 성과 수치를 포함한 헤드라인으로 교체하세요.'],
  relevance_score:       ['전환율 +10~15% 예상', '타겟 고객의 상황·고통에 공감하는 메시지가 부족합니다.', '페르소나 언어로 재작성하고 "당신의 문제" 중심으로 구성하세요.'],
  value_score:           ['전환율 +8~12% 예상', '가격 대비 가치 전달이 불명확합니다.', '구체적 수치·비교·사용 후기로 가치를 수치화하세요.'],
  differentiation_score: ['전환율 +8~12% 예상', '"왜 이 제품이어야 하는가"에 대한 답이 없습니다.', '경쟁 대비 고유 강점 섹션 또는 비교표를 추가하세요.'],
  trust_score:           ['전환율 +6~10% 예상', '신뢰 근거가 부족하거나 구매 흐름에서 보이지 않습니다.', '리뷰·수치·미디어 노출 근거를 구매 버튼 주변에 배치하세요.'],
};

function getVerdict(score) {
  if (score >= 4.0) return { text: '우수', color: 'var(--green)' };
  if (score >= 3.0) return { text: '보통', color: '#F59E0B' };
  return { text: '개선 필요', color: 'var(--red)' };
}

// 진단 페이지(Diagnosis.jsx)와 동일한 미션 선택 칩 — 디자인 통일
function MissionChip({ label, active, onClick, title }) {
  return (
    <button onClick={onClick} title={title} style={{
      padding: '4px 12px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
      maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      fontWeight: active ? 600 : 400, transition: 'all 0.15s',
      background: active ? 'var(--accent-dim)' : 'var(--bg-2)',
      color: active ? 'var(--accent)' : 'var(--text-2)',
      border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
    }}>{label}</button>
  );
}

export default function AIReport() {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(null);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reportLoading, setReportLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [aiGenerated, setAiGenerated] = useState(false);
  const [company, setCompany] = useState(null);
  const [missions, setMissions] = useState([]);
  const [selectedMissionId, setSelectedMissionId] = useState(null);
  const [generateError, setGenerateError] = useState(null);
  const [isMock, setIsMock] = useState(false);
  const [monthlyUsage, setMonthlyUsage] = useState(0);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [chargeMsg, setChargeMsg] = useState('');
  const generatingRef = useRef(false);
  const currentMissionRef = useRef(null);   // 현재 선택 의뢰(동기) — 비동기 결과 반영 전 일치 확인용 (R1·R2)

  useEffect(() => { loadMissions(); }, []);
  useEffect(() => {
    currentMissionRef.current = selectedMissionId;
    setGenerateError(null);                  // 의뢰 전환 시 이전 에러 배너 초기화 (R3)
    if (selectedMissionId) loadReport(selectedMissionId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMissionId]);

  async function fetchMonthlyUsage(companyId) {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const { count } = await supabase
      .from('ai_reports')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .gte('created_at', monthStart.toISOString());
    setMonthlyUsage(count ?? 0);
  }

  async function loadMissions() {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { company: co } = await resolveCompany(user.id);
      if (!co) { setLoading(false); return; }
      setCompany(co);

      // 무료 체험 미션 제외 — 부분 공개(페이월) 대상이라 AI 리포트 분석에 섞이면 안 됨 (니체-TRIAL-페이월 수평전개)
      // 메인 의뢰(landing_page)만 — AI 리포트는 5축 점수 기반이라 서브 의뢰(preference/pricing/email) 제외 (레거시 메인은 type=NULL)
      const { data: ms } = await supabase.from('missions')
        .select('id, title, created_at')
        .eq('company_id', co.id).eq('status', 'completed')
        .neq('is_free_trial', true).eq('dismissed', false)
        .or('type.is.null,type.eq.landing_page')
        .order('created_at', { ascending: false });

      await fetchMonthlyUsage(co.id);

      const list = ms || [];
      setMissions(list);
      if (list.length) {
        setSelectedMissionId(list[0].id);   // 최신 완료 의뢰 기본 선택 → loadReport 트리거
      } else {
        setLoading(false);                  // 완료 의뢰 없음 → 빈 상태
      }
    } catch (err) {
      console.error('[AIReport loadMissions error]', err);
      setLoading(false);
    }
  }

  async function loadReport(missionId) {
    const co = company;
    if (!co) return;
    setReportLoading(true);
    setExpanded(null);
    try {
      const selMission = missions.find(m => m.id === missionId);

      // 선택한 단일 의뢰의 승인 피드백만 집계 (제목과 점수·패널수 일치)
      const { data: feedbacks } = await supabase.from('feedbacks')
        .select('clarity_score,relevance_score,value_score,differentiation_score,trust_score,strengths,weaknesses,created_at')
        .eq('mission_id', missionId)
        .eq('purity_passed', true);

      if (!feedbacks?.length) {
        if (currentMissionRef.current !== missionId) return;   // 전환됨 → 새 의뢰 화면 건드리지 않음 (R1)
        setReport(null);
        setAiGenerated(false);
        setIsMock(false);
        return;
      }

      // 로컬 계산 (5대 지표 평균 — 실제 패널 데이터) · 선택한 의뢰 단일 집계
      const dimAvgs = {};
      DIMS.forEach(d => {
        const vals = feedbacks.map(f => f[d.key]).filter(Boolean);
        dimAvgs[d.key] = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
      });
      const overallAvg = Object.values(dimAvgs).reduce((a, b) => a + b, 0) / DIMS.length;
      const verdict = getVerdict(overallAvg);
      const sortedDims = [...DIMS].sort((a, b) => dimAvgs[a.key] - dimAvgs[b.key]);
      const localPriorityFixes = sortedDims.slice(0, 3).map((d, i) => ({
        priority: i + 1,
        area: d.label,
        impact: IMPACT_MAP[d.key][0],
        issue: IMPACT_MAP[d.key][1],
        action: IMPACT_MAP[d.key][2],
      }));
      const topStrengths = [...DIMS].sort((a, b) => dimAvgs[b.key] - dimAvgs[a.key]).slice(0, 2);
      const localStrengths = [
        ...feedbacks.slice(0, 2).map(f => f.strengths).filter(Boolean),
        ...topStrengths.map(d => `${d.label} 영역 점수 ${dimAvgs[d.key].toFixed(1)}/5 — 유지 권장`),
      ].filter(Boolean).slice(0, 3);
      const localRiskFlags = feedbacks.map(f => f.weaknesses).filter(Boolean).slice(0, 2).map((text, i) => ({
        level: i === 0 ? 'high' : 'mid',
        text,
      }));

      const baseReport = {
        mission: selMission?.title || '완료 의뢰',
        company: co.name,
        generatedAt: new Date().toLocaleString('ko-KR'),
        panelCount: feedbacks.length,
        dimScores: dimAvgs,                 // 5대 지표 점수 노출용 (신규)
        weakestKey: sortedDims[0].key,      // 가장 약한 축 강조용
        overallScore: overallAvg,
        overallVerdict: verdict.text,
        verdictColor: verdict.color,
        tldr: `${co.name}의 LP는 종합 전환 점수 ${overallAvg.toFixed(1)}/5입니다. ${sortedDims[0].label} 개선이 가장 시급하며, ${topStrengths[0].label}은 강점으로 유지하세요.`,
        priorityFixes: localPriorityFixes,
        strengths: localStrengths,
        riskFlags: localRiskFlags,
      };

      // 기존 AI 리포트 확인 (선택한 의뢰)
      const { data: aiRow } = await supabase
        .from('ai_reports')
        .select('*')
        .eq('mission_id', missionId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      // 두 번의 await(피드백·AI행) 사이 의뢰가 전환됐으면 stale 응답 반영 금지 (R1)
      if (currentMissionRef.current !== missionId) return;

      if (aiRow) {
        const aiVerdict = getVerdict(aiRow.overall_score ?? overallAvg);
        const rowIsMock = aiRow.tldr?.startsWith('[Mock]') ?? false;
        setReport({
          ...baseReport,
          panelCount: aiRow.panel_count ?? feedbacks.length,
          generatedAt: new Date(aiRow.created_at).toLocaleString('ko-KR'),
          overallScore: aiRow.overall_score ?? overallAvg,
          overallVerdict: aiVerdict.text,
          verdictColor: aiVerdict.color,
          tldr: aiRow.tldr ?? baseReport.tldr,
          priorityFixes: (aiRow.priority_fixes ?? []).map((f, i) => ({ ...f, priority: i + 1 })),
          strengths: aiRow.strengths ?? baseReport.strengths,
          riskFlags: aiRow.risk_flags ?? baseReport.riskFlags,
        });
        setAiGenerated(true);
        setIsMock(rowIsMock);
      } else {
        setReport(baseReport);
        setAiGenerated(false);
        setIsMock(false);
      }
    } catch (err) {
      console.error('[AIReport loadReport error]', err);
      setReport(null);
    } finally {
      setLoading(false);
      setReportLoading(false);
    }
  }

  function handleGenerateClick() {
    if (monthlyUsage >= MONTHLY_LIMIT) {
      setShowLimitModal(true);
      return;
    }
    if (generatingRef.current) return;
    generatingRef.current = true;
    generateReport();
  }

  async function generateReport() {
    if (!selectedMissionId) return;
    const mid = selectedMissionId;   // 생성 대상 의뢰 고정 — 생성 중 전환 시 교차 오염 방지 (R2)
    setGenerating(true);
    setGenerateError(null);
    try {
      const { data, error } = await supabase.functions.invoke('generate-ai-report', {
        body: { mission_id: mid },
      });
      if (error) throw error;
      if (data?.report) {
        const r = data.report;
        const genIsMock = data.isMock ?? false;
        // 재생성은 행 삭제+재삽입(행 수 불변)이라 낙관적 +1은 과대계상 → 실제 행 수 재조회 (D-35/정합)
        if (company?.id) await fetchMonthlyUsage(company.id);
        // 생성 중 다른 의뢰로 전환됐으면 화면 미반영 (DB엔 저장됨 → 그 의뢰 재진입 시 loadReport가 로드) (R2)
        if (currentMissionRef.current !== mid) return;
        const aiVerdict = getVerdict(r.overall_score ?? 0);
        setReport(prev => ({
          ...prev,
          panelCount: r.panel_count ?? prev.panelCount,
          generatedAt: new Date(r.created_at).toLocaleString('ko-KR'),
          overallScore: r.overall_score ?? prev.overallScore,
          overallVerdict: aiVerdict.text,
          verdictColor: aiVerdict.color,
          tldr: r.tldr ?? prev.tldr,
          priorityFixes: (r.priority_fixes ?? []).map((f, i) => ({ ...f, priority: i + 1 })),
          strengths: r.strengths ?? prev.strengths,
          riskFlags: r.risk_flags ?? prev.riskFlags,
        }));
        setAiGenerated(true);
        setIsMock(genIsMock);
      }
    } catch (e) {
      // 다른 의뢰로 전환된 뒤 도착한 에러는 현재 화면에 표시하지 않음 (R3)
      if (currentMissionRef.current === mid) setGenerateError(e?.message ?? 'AI 리포트 생성 중 오류가 발생했습니다.');
    } finally {
      setGenerating(false);
      generatingRef.current = false;
    }
  }

  function getNextResetDate() {
    const now = new Date();
    const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return `${next.getFullYear()}년 ${next.getMonth() + 1}월 1일`;
  }

  if (loading) return (
    <div style={{ padding: '40px 48px', color: 'var(--text-3)', fontFamily: 'var(--font-sans)', fontSize: 13 }}>리포트 로드 중…</div>
  );

  if (!missions.length) return (
    <div className="page-wrap" style={{ padding: '40px 48px', maxWidth: 960 }}>
      <div style={{ fontSize: 12, fontFamily: 'var(--font-sans)', color: 'var(--text-2)', marginBottom: 8, letterSpacing: '0.05em' }}>AI 인사이트 리포트</div>
      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 6 }}>AI 전환 인사이트</h1>
      <p style={{ color: 'var(--text-3)', fontSize: 13, marginBottom: 24 }}>완료된 메인 의뢰의 패널 피드백을 AI가 종합 분석합니다.</p>
      <Card style={{ padding: '60px', textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>🤖</div>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>완료된 의뢰가 없습니다</div>
        <div style={{ color: 'var(--text-2)', fontSize: 13 }}>의뢰가 완료되면 패널 피드백을 바탕으로 AI 리포트를 생성할 수 있습니다.</div>
      </Card>
    </div>
  );

  const limitModal = showLimitModal && ReactDOM.createPortal(
    <div
      onClick={() => { setShowLimitModal(false); setChargeMsg(''); }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: '#fff', borderRadius: 16, padding: '32px 28px', width: 400, maxWidth: '90vw', boxShadow: '0 24px 64px rgba(0,0,0,0.18)' }}
      >
        <div style={{ textAlign: 'center', marginBottom: 22 }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🤖</div>
          <div style={{ fontWeight: 800, fontSize: 17, color: 'var(--text)', marginBottom: 8 }}>
            이번 달 AI 리포트 한도 초과
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.7 }}>
            월 {MONTHLY_LIMIT}회 무료 생성 한도를 모두 사용했습니다.<br />
            {getNextResetDate()}에 자동으로 초기화됩니다.
          </div>
        </div>

        <div style={{ border: '1.5px solid var(--border)', borderRadius: 12, padding: '16px 18px', marginBottom: 20, background: 'var(--bg-2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <span style={{ fontSize: 20 }}>🔋</span>
            <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>추가 10회 충전</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.6, paddingLeft: 30 }}>
            크레딧 1개 차감 &middot; 당월 말 소멸
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Btn
            variant="primary"
            style={{ width: '100%', justifyContent: 'center' }}
            onClick={() => setChargeMsg('결제 기능이 곧 출시됩니다. 조금만 기다려 주세요!')}
          >
            충전하기
          </Btn>
          <Btn
            variant="ghost"
            style={{ width: '100%', justifyContent: 'center' }}
            onClick={() => { setShowLimitModal(false); setChargeMsg(''); }}
          >
            다음 달까지 기다리기
          </Btn>
        </div>

        {chargeMsg && (
          <div style={{ marginTop: 14, padding: '10px 14px', borderRadius: 8, background: 'var(--accent-dim)', fontSize: 12, color: 'var(--accent)', textAlign: 'center', lineHeight: 1.5 }}>
            {chargeMsg}
          </div>
        )}
      </div>
    </div>,
    document.body
  );

  return (
    <>
    <div className="page-wrap" style={{ padding: '40px 48px', maxWidth: 960, animation: 'fadeUp 0.5s ease both' }}>
      {/* ===== 헤더 (진단·결과 페이지와 동일 3단 구조) ===== */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 12, fontFamily: 'var(--font-sans)', color: 'var(--text-2)', marginBottom: 8, letterSpacing: '0.05em' }}>AI 인사이트 리포트</div>
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 6 }}>AI 전환 인사이트</h1>
        <p style={{ color: 'var(--text-3)', fontSize: 13 }}>완료된 메인 의뢰의 패널 피드백을 AI가 종합 분석합니다.</p>

        {/* 의뢰 선택 — 진단 페이지와 동일 칩 UI */}
        <div style={{ marginTop: 20, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--font-sans)', flexShrink: 0, paddingTop: 5 }}>의뢰</span>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {missions.map(m => (
              <MissionChip
                key={m.id}
                label={m.title || '무제'}
                active={selectedMissionId === m.id}
                onClick={() => setSelectedMissionId(m.id)}
                title={m.title}
              />
            ))}
          </div>
        </div>
      </div>

      {generateError && (
        <div style={{ marginBottom: 16, padding: '10px 14px', background: 'var(--surface)', borderRadius: 'var(--radius)', fontSize: 13, color: 'var(--red)', border: '1px solid var(--border)' }}>
          {generateError}
        </div>
      )}

      {reportLoading ? (
        <Card style={{ padding: '48px', textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>리포트 불러오는 중…</Card>
      ) : !report ? (
        <Card style={{ padding: '48px', textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🗒️</div>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>이 의뢰에는 분석할 피드백이 없습니다</div>
          <div style={{ color: 'var(--text-2)', fontSize: 13 }}>승인된 패널 피드백이 있는 의뢰를 선택해 주세요.</div>
        </Card>
      ) : (
        <>
        {/* ===== Hero 요약 카드 ===== */}
        <Card style={{ marginBottom: 24, padding: '24px 28px', background: 'linear-gradient(135deg, var(--surface), var(--bg-3))', borderLeft: '3px solid var(--accent)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ fontSize: 11, fontFamily: 'var(--font-sans)', color: 'var(--text-3)', letterSpacing: '0.06em', marginBottom: 6 }}>종합 평가</div>
              <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8, lineHeight: 1.3 }}>{report.mission}</h2>
              <div style={{ fontSize: 13, color: 'var(--text-3)', lineHeight: 1.6 }}>
                현직 마케팅 전문가 {report.panelCount}명 진단
                <span style={{ margin: '0 6px', color: 'var(--border)' }}>·</span>
                {aiGenerated ? (isMock ? '로컬 종합 분석' : 'AI 종합 분석') : '집계 점수'}
                <span style={{ margin: '0 6px', color: 'var(--border)' }}>·</span>
                {report.generatedAt}
              </div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontSize: 11, fontFamily: 'var(--font-sans)', color: 'var(--text-3)', marginBottom: 4 }}>종합 전환 점수</div>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'flex-end', gap: 2, marginBottom: 6 }}>
                <span style={{ fontSize: 40, fontWeight: 800, letterSpacing: '-0.03em', color: report.verdictColor, lineHeight: 1 }}>{report.overallScore.toFixed(1)}</span>
                <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-3)' }}>/5</span>
              </div>
              <span style={{ display: 'inline-block', padding: '3px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700, color: '#fff', background: report.verdictColor }}>{report.overallVerdict}</span>
            </div>
          </div>

          <div style={{ height: 1, background: 'var(--border)', margin: '20px 0 16px' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
              {aiGenerated
                ? (isMock
                  ? 'ℹ️ 로컬 분석 기반 — AI 분석을 생성하면 더 정교한 인사이트를 받을 수 있습니다.'
                  : '✦ AI 종합 분석 완료')
                : '아직 AI 분석을 생성하지 않았습니다 — 집계 점수만 표시 중입니다.'}
            </span>
            <Btn variant="primary" size="sm" onClick={handleGenerateClick} disabled={generating}>
              {generating ? '분석 중…' : aiGenerated ? 'AI 리포트 재생성' : 'AI 리포트 생성'}
            </Btn>
          </div>
        </Card>

        {/* ===== 5대 지표 점수 (신규) ===== */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>5대 지표 점수</div>
          <Card style={{ padding: '20px 24px' }}>
            {DIMS.map((d, i) => {
              const sc = report.dimScores[d.key] ?? 0;
              const v = getVerdict(sc);
              const isWeakest = report.weakestKey === d.key;
              return (
                <div key={d.key} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 0', borderTop: i === 0 ? 'none' : '1px solid var(--border-light)' }}>
                  <div style={{ width: 150, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{d.label}</span>
                    {isWeakest && <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--red)', background: 'var(--red-dim)', padding: '1px 6px', borderRadius: 10 }}>약점</span>}
                  </div>
                  <div style={{ flex: 1, minWidth: 0, height: 8, borderRadius: 4, background: 'var(--border-light)', overflow: 'hidden' }}>
                    <div style={{ width: `${(sc / 5) * 100}%`, height: '100%', borderRadius: 4, background: v.color, transition: 'width 0.4s ease' }} />
                  </div>
                  <div style={{ width: 64, flexShrink: 0, textAlign: 'right', display: 'flex', alignItems: 'baseline', justifyContent: 'flex-end', gap: 3 }}>
                    <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>{sc.toFixed(1)}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-3)' }}>/5</span>
                  </div>
                </div>
              );
            })}
          </Card>
        </div>

        {/* ===== TL;DR ===== */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>핵심 요약</div>
          <Card style={{ background: 'linear-gradient(135deg, var(--surface), var(--bg-3))', borderLeft: '3px solid var(--accent)' }}>
            <div style={{ fontSize: 11, fontFamily: 'var(--font-sans)', color: 'var(--text-2)', marginBottom: 8, letterSpacing: '0.08em' }}>TL;DR</div>
            <p style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--text)', marginBottom: 0 }}>{report.tldr}</p>
          </Card>
        </div>

        {/* ===== Priority Fixes ===== */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>우선 개선 과제</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {report.priorityFixes.map(fix => (
              <Card
                key={fix.priority}
                style={{ cursor: 'pointer', transition: 'all 0.15s' }}
                onClick={() => setExpanded(expanded === fix.priority ? null : fix.priority)}
              >
                <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: fix.priority === 1 ? 'var(--red)' : fix.priority === 2 ? 'var(--accent)' : 'var(--blue)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14, flexShrink: 0 }}>
                    {fix.priority}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontWeight: 700, fontSize: 14 }}>{fix.area}</span>
                      <Badge type="green">{fix.impact}</Badge>
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: expanded === fix.priority ? 10 : 0 }}>{fix.issue}</div>
                    {expanded === fix.priority && (
                      <div style={{ padding: '12px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 13, color: 'var(--text)', lineHeight: 1.7 }}>
                        <strong>권장 액션:</strong> {fix.action}
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* ===== Strengths ===== */}
        {report.strengths.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>유지할 강점</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {report.strengths.map((s, i) => (
                <div key={i} style={{ display: 'flex', gap: 12, padding: '12px 16px', background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', borderLeft: '3px solid var(--green)' }}>
                  <span style={{ color: 'var(--green)', flexShrink: 0 }}>✓</span>
                  <span style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6 }}>{s}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ===== Risk Flags ===== */}
        {report.riskFlags.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>리스크 플래그</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {report.riskFlags.map((f, i) => (
                <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '12px 16px', background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', borderLeft: `3px solid ${f.level === 'high' ? 'var(--red)' : 'var(--accent)'}` }}>
                  <Badge type={f.level === 'high' ? 'red' : 'gold'}>{f.level === 'high' ? 'HIGH' : 'MID'}</Badge>
                  <span style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6 }}>{f.text}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ===== 하단 CTA — 패널 원문 피드백으로 연결 ===== */}
        <Card style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', background: 'var(--bg-2)' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>패널 원문 피드백이 궁금하신가요?</div>
            <div style={{ fontSize: 12, color: 'var(--text-3)' }}>전문가별 코멘트·이미지 코멘트·추가 질문 응답을 결과 화면에서 확인하세요.</div>
          </div>
          <Btn variant="outline" size="sm" onClick={() => navigate(`/company/results?id=${selectedMissionId}`)}>
            결과 원문 보기 →
          </Btn>
        </Card>
        </>
      )}
    </div>
    {limitModal}
    </>
  );
}
