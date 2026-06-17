import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Badge, Btn, StatusTabs, SegmentFilter } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { resolveCompany } from '../../lib/resolveCompany';

const DIM_LABEL_MAP = {
  clarity_score: '명확성',
  relevance_score: '관련성',
  value_score: '가치',
  differentiation_score: '차별화',
  trust_score: '신뢰',
};

const _SPEC_KWS = ['구체적','명확','직접','예시','경우','상황','개선','수정','변경','추가','제거','대신','때문에','이유','근거','수치','비율','효과','결과','실제','경험','인상','처음','바로','즉시','어렵'];
const _ACT_KWS  = ['해주세요','바꿔','수정해','추가해','제거해','줄이','늘려','강조','배치','이동','개선','보완','필요','권장','추천','고려','검토'];
const _AI_PATS  = ['안녕하세요','감사합니다','수고하셨습니다','전반적으로 좋','잘 만들어','훌륭한','완성도가 높','전체적으로 만족'];

function calcPurityScoreLocal(f) {
  const text = [f.suggestions, f.strengths, f.weaknesses].filter(Boolean).join(' ');
  if (!text.trim()) return 0;
  let score = 20;
  score += Math.min(20, Math.floor(text.length / 50));
  const secs = (f.suggestions || '').split('\n\n').filter(s => s.replace(/^\[[^\]]+\]\s*/, '').length >= 10);
  score += secs.length >= 4 ? 10 : secs.length >= 2 ? 4 : 0;
  score += Math.min(25, _SPEC_KWS.filter(k => text.includes(k)).length * 4);
  score += Math.min(25, _ACT_KWS.filter(k => text.includes(k)).length * 5);
  score  = Math.max(0, score - Math.min(30, _AI_PATS.filter(p => text.includes(p)).length * 12));
  return Math.min(100, Math.max(0, score));
}

// 차원별 코멘트 추출: [명확성] 또는 [명확성 / X점] 헤더 매칭된 코멘트만 반환.
// 헤더 없는(차원 미상) 글은 전체를 오귀속하지 않도록 null 반환 → 호출측 filter에서 제외 (진단-D)
function extractDimComment(f, dimKey) {
  const label = DIM_LABEL_MAP[dimKey];
  if (!label) return null;
  const text = (f.suggestions || '').trim();
  if (!text) return null;
  const re = new RegExp(`\\[${label}[^\\]]*\\][^\\S\\n]*\\n?([^\\[]+)`);
  const m = text.match(re);
  if (m) {
    const c = m[1].trim();
    if (c.length >= 10) return c.slice(0, 500);
  }
  return null;
}

const DIMENSIONS = [
  { key: 'clarity_score',         label: '명확성', sublabel: 'Clarity',         icon: '◎', color: '#159143', desc: '메시지를 처음 본 사람이 3초 안에 무엇을 파는지 이해하는가?', benchmark: 3.2 },
  { key: 'relevance_score',       label: '관련성', sublabel: 'Relevance',       icon: '◆', color: '#c66507', desc: '타겟 고객의 현실적인 고통과 욕구에 메시지가 정렬되어 있는가?', benchmark: 2.8 },
  { key: 'value_score',           label: '가치',   sublabel: 'Value',           icon: '▲', color: '#4940d8', desc: '제품이 제공하는 가치가 가격 대비 충분히 설득력 있는가?', benchmark: 3.5 },
  { key: 'differentiation_score', label: '차별화', sublabel: 'Differentiation', icon: '◈', color: '#ca2121', desc: '경쟁사 대비 왜 이 제품을 선택해야 하는지 명확히 전달되는가?', benchmark: 2.4 },
  { key: 'trust_score',           label: '신뢰',   sublabel: 'Trust',           icon: '●', color: '#94a3b8', desc: '처음 방문자가 브랜드와 제품을 신뢰할 수 있는 근거가 충분한가?', benchmark: 3.0 },
];

const COMPARE_A = 'var(--accent)';
const COMPARE_B = '#c66507';
const COMPARE_C = '#159143';

// 전환 가이드 상수
const GUIDE_WEIGHTS = { value_score: 0.30, trust_score: 0.25, clarity_score: 0.20, relevance_score: 0.15, differentiation_score: 0.10 };
const GUIDE_LEVELS = [
  { min: 90, label: '최적화',    color: '#159143' },
  { min: 75, label: '우수',      color: '#10367D' },
  { min: 60, label: '양호',      color: '#c66507' },
  { min: 40, label: '성장 가능', color: '#f59e0b' },
  { min: 0,  label: '개선 필요', color: '#ca2121' },
];
const GUIDE_DESCS = {
  '최적화':    '5개 지표 모두 벤치마크를 상회합니다. 최적의 전환 소재에 가깝습니다.',
  '우수':      '대부분의 지표가 양호합니다. 취약 차원 하나를 보완하면 큰 도약이 가능합니다.',
  '양호':      '핵심 지표는 안정적이지만 전환율을 더 끌어올릴 여지가 있습니다.',
  '성장 가능': '취약한 차원이 전환율을 낮추고 있습니다. 집중 개선이 필요합니다.',
  '개선 필요': '여러 차원에서 즉각적인 개선이 필요합니다. 우선순위부터 잡아보세요.',
};
const NEXT_ACTIONS = {
  clarity_score:         { text: '소재 A/B 테스트로 메시지 명확성을 높여보세요', path: '/company/preference', cta: '소재 비교 등록 →' },
  relevance_score:       { text: '소재 A/B 테스트로 타겟 공감도를 검증해보세요', path: '/company/preference', cta: '소재 비교 등록 →' },
  value_score:           { text: '가격 검증 테스트로 가치 전달력을 점검해보세요', path: '/company/pricing-test', cta: '가격 검증 등록 →' },
  differentiation_score: { text: '소재 A/B 테스트로 차별화 메시지를 발굴해보세요', path: '/company/preference', cta: '소재 비교 등록 →' },
  trust_score:           { text: '신뢰 요소를 집중 검증하는 메인 의뢰를 진행해보세요', path: '/company/new', cta: '의뢰 등록 →' },
};

const avg = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

// 차원 라벨 → 점수 컬럼 (라벨에 인라인 점수가 없을 때 폴백용)
const DIM_LABEL_TO_COL = { '명확성': 'clarity_score', '관련성': 'relevance_score', '가치': 'value_score', '차별화': 'differentiation_score', '신뢰': 'trust_score' };

// 메인 의뢰 피드백(suggestions)을 "[차원] 헤더 + 코멘트" 블록으로 파싱 →
// 차원별로 칭찬(4~5점)/지적(1~2점) 코멘트를 모아 "왜 강·약점인지"를 실제 문장으로 보여줌.
// 동일 문장은 묶어 count(언급 패널 수)로 집계. 두 저장 형식 모두 지원:
//   ① 실제 패널 제출: "[명확성 / 4점] 코멘트"  (점수가 줄 안에 인라인)
//   ② 시드/레거시:     "[명확성]\n코멘트"        (점수 없음 → 피드백 행의 차원 점수 컬럼에서 폴백)
// (3점 중립·[총평]·[해당 없음]·차원 미매칭 줄은 점수 신호가 없어 제외)
const KW_HEAD_RE = /^\[([^\]]+)\]\s*(.*)$/;
function extractDimInsights(feedbacks) {
  // dimKey -> { praise: Map<text,{score,count}>, critique: Map<...> }
  const acc = {};
  DIMENSIONS.forEach(d => { acc[d.key] = { praise: new Map(), critique: new Map() }; });
  feedbacks.forEach(f => {
    let curKey = null, curScore = null;   // 현재 블록의 차원 컬럼·점수
    const addComment = (text) => {
      const comment = text.trim();
      if (!curKey || curScore == null || !comment) return;
      const bag = curScore >= 4 ? acc[curKey].praise : curScore <= 2 ? acc[curKey].critique : null;
      if (!bag) return;   // 3점 중립 제외
      const ex = bag.get(comment);
      if (ex) { ex.count += 1; ex.score = Math.max(ex.score, curScore); }
      else bag.set(comment, { text: comment, score: curScore, count: 1 });
    };
    (f.suggestions || '').split('\n').forEach(raw => {
      const line = raw.trim();
      if (!line) return;
      const head = line.match(KW_HEAD_RE);
      if (head) {
        const inside = head[1].trim();                       // "명확성 / 4점" | "명확성" | "총평" | "차별화 - 해당 없음"
        const dim = inside.replace(/\s*[\/\-].*$/, '').trim(); // 점수·해당없음 접미 제거
        const col = DIM_LABEL_TO_COL[dim];
        if (!col) { curKey = null; curScore = null; return; }  // 총평·미매칭 헤더 → 블록 종료
        const scoreM = inside.match(/(\d)\s*점/);
        const cv = Number(f[col]);
        curKey = col;
        curScore = scoreM ? parseInt(scoreM[1], 10) : (Number.isFinite(cv) ? cv : null);
        if (head[2]) addComment(head[2]);                    // 인라인 코멘트(형식 ①)
      } else {
        addComment(line);                                    // 연속 코멘트 줄(형식 ②)
      }
    });
  });
  const out = {};
  DIMENSIONS.forEach(d => {
    const sortByCount = m => [...m.values()].sort((a, b) => b.count - a.count);
    out[d.key] = { praise: sortByCount(acc[d.key].praise), critique: sortByCount(acc[d.key].critique) };
  });
  return out;
}

function MissionChip({ label, active, color, onClick, title }) {
  return (
    <button onClick={onClick} title={title} style={{
      padding: '4px 12px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
      maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      fontWeight: active ? 600 : 400, transition: 'all 0.15s',
      background: active ? (color || 'var(--accent-dim)') : 'var(--bg-2)',
      color: active ? (color ? '#fff' : 'var(--accent)') : 'var(--text-2)',
      border: `1px solid ${active ? (color || 'var(--accent)') : 'var(--border)'}`,
    }}>{label}</button>
  );
}

export default function Diagnosis() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [scores, setScores] = useState({});
  const [distributions, setDistributions] = useState({});
  const [benchmarks, setBenchmarks] = useState({});
  const [dimInsights, setDimInsights] = useState({}); // 차원별 칭찬/지적 코멘트
  const [expandedDims, setExpandedDims] = useState(new Set()); // 더보기 펼친 차원 키
  const [missions, setMissions] = useState([]);
  const [allMissionIds, setAllMissionIds] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [compareMode, setCompareMode] = useState(false);
  const [compareData, setCompareData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [hasData, setHasData] = useState(false);
  const [rawFeedbacks, setRawFeedbacks] = useState([]);
  const [period, setPeriod] = useState('all');
  const [guideSelectedId, setGuideSelectedId] = useState(null);
  const [guideFeedbacks, setGuideFeedbacks] = useState([]);
  const [guideLoading, setGuideLoading] = useState(false);
  // allBenchmarkFbs 제거 — 벤치마크는 DIMENSIONS 정적 상수 사용

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if ((compareMode && compareData) || !rawFeedbacks.length) return;
    const cutoff = period === 'all' ? null : new Date(Date.now() - (period === '3m' ? 90 : 30) * 86400000);
    const periodMissionIds = cutoff ? new Set(missions.filter(m => new Date(m.created_at) >= cutoff).map(m => m.id)) : null;
    const filtered = periodMissionIds ? rawFeedbacks.filter(f => periodMissionIds.has(f.mission_id)) : rawFeedbacks;
    const { newScores, newDistributions, newBenchmarks } = computeForFbs(filtered);
    setScores(newScores);
    setDistributions(newDistributions);
    setBenchmarks(newBenchmarks);
    setDimInsights(extractDimInsights(filtered));
    setExpandedDims(new Set());
    setHasData(filtered.length > 0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  useEffect(() => {
    if (!allMissionIds.length) return;
    if (compareMode && selectedIds.size >= 2 && selectedIds.size <= 3) {
      loadCompare([...selectedIds].slice(0, 3));
    } else {
      const ids = selectedIds.size === 0 ? allMissionIds : [...selectedIds];
      loadFeedbacks(ids, missions);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIds, compareMode]);

  function computeForFbs(myFeedbacks) {
    const newScores = {}, newDistributions = {}, newBenchmarks = {};
    DIMENSIONS.forEach(d => {
      const myVals = myFeedbacks.map(f => f[d.key]).filter(Boolean);
      newScores[d.key] = myVals.length ? avg(myVals) : 0;
      const dist = [0, 0, 0, 0, 0];
      myVals.forEach(v => { const i = Math.round(v) - 1; if (i >= 0 && i <= 4) dist[i]++; });
      newDistributions[d.key] = dist;
      newBenchmarks[d.key] = d.benchmark;
    });
    return { newScores, newDistributions, newBenchmarks };
  }

  async function load() {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { company: co } = await resolveCompany(user.id);
      if (!co) { setLoading(false); return; }

      // 무료 체험 미션 제외 — 부분 공개(페이월) 대상이라 코멘트가 키워드/진단 분석에 노출되면 안 됨 (니체-TRIAL-페이월 수평전개)
      // 메인 의뢰(landing_page)만 — 5대 지표 진단은 5축 점수(clarity/relevance/value/differentiation/trust) 전용이라 서브 의뢰(preference/pricing/email) 제외 (레거시 메인은 type=NULL)
      const { data: ms } = await supabase.from('missions').select('id, title, created_at').eq('company_id', co.id).eq('status', 'completed').neq('is_free_trial', true).or('type.is.null,type.eq.landing_page').order('created_at', { ascending: false });
      const msList = ms || [];
      const ids = msList.map(m => m.id);
      setMissions(msList);
      setAllMissionIds(ids);

      await loadFeedbacks(ids, msList);
      setLoading(false);
    } catch (err) {
      console.error('[Diagnosis load]', err);
      setLoading(false);
    }
  }

  async function loadFeedbacks(ids, msList) {
    if (!ids.length) { setHasData(false); return; }

    try {
      const { data: myFbs } = await supabase
        .from('feedbacks')
        .select('clarity_score,relevance_score,value_score,differentiation_score,trust_score,suggestions,strengths,weaknesses,created_at,mission_id')
        .in('mission_id', ids)
        .eq('purity_passed', true);

      const myFeedbacks = myFbs || [];
      setCompareData(null);
      setRawFeedbacks(myFeedbacks);

      const cutoff = period === 'all' ? null : new Date(Date.now() - (period === '3m' ? 90 : 30) * 86400000);
      const periodMissionIds = cutoff ? new Set(msList.filter(m => new Date(m.created_at) >= cutoff).map(m => m.id)) : null;
      const periodFiltered = periodMissionIds ? myFeedbacks.filter(f => periodMissionIds.has(f.mission_id)) : myFeedbacks;
      const { newScores, newDistributions, newBenchmarks } = computeForFbs(periodFiltered);
      setScores(newScores);
      setDistributions(newDistributions);
      setBenchmarks(newBenchmarks);
      setDimInsights(extractDimInsights(periodFiltered));
      setExpandedDims(new Set());
      setHasData(periodFiltered.length > 0);
    } catch (err) {
      console.error('[loadFeedbacks]', err);
      setHasData(false);
    }
  }

  async function loadCompare([idA, idB, idC]) {
    try {
      const mA = missions.find(m => m.id === idA);
      const mB = missions.find(m => m.id === idB);
      const mC = idC ? missions.find(m => m.id === idC) : null;

      const requests = [
        supabase.from('feedbacks').select('clarity_score,relevance_score,value_score,differentiation_score,trust_score,suggestions,strengths,weaknesses').eq('mission_id', idA).eq('purity_passed', true),
        supabase.from('feedbacks').select('clarity_score,relevance_score,value_score,differentiation_score,trust_score,suggestions,strengths,weaknesses').eq('mission_id', idB).eq('purity_passed', true),
      ];
      if (idC) requests.push(supabase.from('feedbacks').select('clarity_score,relevance_score,value_score,differentiation_score,trust_score,suggestions,strengths,weaknesses').eq('mission_id', idC).eq('purity_passed', true));

      const results = await Promise.all(requests);
      const fbsA = results[0].data || [];
      const fbsB = results[1].data || [];
      const fbsC = idC ? (results[2].data || []) : [];

      const comA = computeForFbs(fbsA);
      const comB = computeForFbs(fbsB);

      const data = {
        a: { id: idA, title: mA?.title || 'A', scores: comA.newScores, distributions: comA.newDistributions, dimInsights: extractDimInsights(fbsA) },
        b: { id: idB, title: mB?.title || 'B', scores: comB.newScores, distributions: comB.newDistributions, dimInsights: extractDimInsights(fbsB) },
      };
      if (idC) {
        const comC = computeForFbs(fbsC);
        data.c = { id: idC, title: mC?.title || 'C', scores: comC.newScores, distributions: comC.newDistributions, dimInsights: extractDimInsights(fbsC) };
      }

      setCompareData(data);
      setBenchmarks(comA.newBenchmarks);
      setHasData(fbsA.length > 0 || fbsB.length > 0 || fbsC.length > 0);
      setRawFeedbacks([...fbsA, ...fbsB, ...fbsC]);
    } catch (err) {
      console.error('[loadCompare]', err);
      setCompareData(null);
      setHasData(false);
    }
  }

  function toggleMission(id) {
    setCompareMode(false);
    setCompareData(null);
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function loadGuideFeedbacks(id) {
    setGuideLoading(true);
    try {
      const { data } = await supabase
        .from('feedbacks')
        .select('clarity_score,relevance_score,value_score,differentiation_score,trust_score,suggestions,strengths,weaknesses,created_at,mission_id')
        .eq('mission_id', id)
        .eq('purity_passed', true);
      setGuideFeedbacks(data || []);
    } catch (err) {
      console.error('[loadGuideFeedbacks]', err);
      setGuideFeedbacks([]);
    } finally {
      setGuideLoading(false);
    }
  }

  function handleTabChange(tab) {
    setActiveTab(tab);
    if (tab === 'guide' && missions.length > 0) {
      // selectedIds / compareMode / compareData를 건드리지 않음 — 다른 탭 상태 보존
      const autoId = selectedIds.size === 1 ? [...selectedIds][0] : missions[0]?.id;
      if (autoId && autoId !== guideSelectedId) {
        setGuideSelectedId(autoId);
        loadGuideFeedbacks(autoId);
      } else if (autoId && guideFeedbacks.length === 0) {
        setGuideSelectedId(autoId);
        loadGuideFeedbacks(autoId);
      }
    }
  }

  function handleGuideChipClick(id) {
    if (id === guideSelectedId) return;
    setGuideSelectedId(id);
    loadGuideFeedbacks(id);
    // selectedIds / compareMode / compareData를 건드리지 않음
  }

  if (loading) return (
    <div style={{ padding: '40px 48px', color: 'var(--text-3)', fontFamily: 'var(--font-sans)', fontSize: 13 }}>데이터 로딩 중…</div>
  );

  const isComparing = compareMode && compareData;

  // Derived scores for header (use compare average in compare mode)
  const compareItems = isComparing
    ? [{ data: compareData.a, color: COMPARE_A }, { data: compareData.b, color: COMPARE_B }, ...(compareData.c ? [{ data: compareData.c, color: COMPARE_C }] : [])]
    : [];
  const activeScores = isComparing
    ? Object.fromEntries(DIMENSIONS.map(d => [d.key, avg(compareItems.map(({ data }) => data.scores[d.key] || 0))]))
    : scores;

  const scoreValues = DIMENSIONS.map(d => activeScores[d.key] || 0);
  const overallAvg = avg(scoreValues);
  const worstDim = DIMENSIONS.reduce((worst, d) =>
    (activeScores[d.key] || 0) < (activeScores[worst.key] || 0) ? d : worst
  );

  return (
    <div className="page-wrap" style={{ padding: '40px 48px', maxWidth: 1060, animation: 'fadeUp 0.5s ease both' }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 12, fontFamily: 'var(--font-sans)', color: 'var(--text-2)', marginBottom: 8, letterSpacing: '0.05em' }}>전환 진단 리포트</div>
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 6 }}>전환 5대 지표 진단</h1>
        <p style={{ color: 'var(--text-3)', fontSize: 13 }}>완료된 메인 의뢰의 피드백만 집계됩니다. 서브 의뢰 및 조기 종료된 의뢰는 제외됩니다.</p>

        {missions.length > 0 && (
          <>
          <div style={{ marginTop: 20, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <span style={{ fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--font-sans)', flexShrink: 0, paddingTop: 5 }}>의뢰</span>
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
                {activeTab === 'guide' ? (
                  missions.map(m => (
                    <MissionChip
                      key={m.id}
                      label={m.title || '무제'}
                      active={guideSelectedId === m.id}
                      onClick={() => handleGuideChipClick(m.id)}
                      title={m.title}
                    />
                  ))
                ) : (
                  <>
                    <MissionChip
                      label={`전체 (${missions.length})`}
                      active={selectedIds.size === 0}
                      onClick={() => { setCompareMode(false); setCompareData(null); setSelectedIds(new Set()); }}
                    />
                    {missions.map(m => (
                      <MissionChip
                        key={m.id}
                        label={m.title || '무제'}
                        active={selectedIds.has(m.id)}
                        onClick={() => toggleMission(m.id)}
                        title={m.title}
                      />
                    ))}
                    {selectedIds.size >= 2 && selectedIds.size <= 3 && (
                      <button
                        onClick={() => setCompareMode(v => !v)}
                        style={{
                          flexShrink: 0, marginLeft: 4, padding: '4px 14px', borderRadius: 20, fontSize: 12,
                          fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
                          background: compareMode ? COMPARE_B : 'var(--bg-2)',
                          color: compareMode ? '#fff' : 'var(--text-2)',
                          border: `1px solid ${compareMode ? COMPARE_B : 'var(--border)'}`,
                        }}
                      >⇄ 비교 모드</button>
                    )}
                  </>
                )}
            </div>
          </div>
          {/* 비교 모드에선 기간 필터 미적용(loadCompare가 기간 무시) → 무효 필터 노출 방지 (진단-B) */}
          {!compareMode && (
          <div style={{ marginTop: 10 }}>
            <SegmentFilter
              label="기간"
              value={period}
              onChange={setPeriod}
              tabs={[{ key: 'all', label: '전체' }, { key: '3m', label: '최근 3개월' }, { key: '1m', label: '최근 1개월' }]}
              style={{ marginBottom: 0 }}
            />
          </div>
          )}
          </>
        )}
      </div>

      {!hasData ? (
        <Card style={{ padding: '60px', textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>📊</div>
          {(period !== 'all' && rawFeedbacks.length > 0) ? (
            // 데이터는 있으나 선택 기간에만 없음 (진단-A) — "의뢰 등록" 오안내 방지
            <>
              <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>이 기간에는 결과가 없습니다</div>
              <div style={{ color: 'var(--text-2)', fontSize: 13 }}>선택한 기간에 완료된 의뢰가 없습니다. 기간을 넓혀보세요.</div>
            </>
          ) : (
            <>
              <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>아직 피드백 데이터가 없습니다</div>
              <div style={{ color: 'var(--text-2)', fontSize: 13 }}>의뢰를 등록하고 패널 피드백이 수집되면 5대 지표 진단 결과가 표시됩니다.</div>
            </>
          )}
        </Card>
      ) : (
        <>
          {/* 헤더 요약 카드 — 전환 가이드 탭에선 숨김(가이드 /100 점수와 종합 /5.0 중복 방지) */}
          {activeTab !== 'guide' && (isComparing ? (
            <Card style={{ marginBottom: 28, padding: '20px 24px', display: 'flex', gap: 16, flexWrap: 'wrap', background: 'linear-gradient(135deg, var(--surface), var(--bg-3))' }}>
              {compareItems.map(({ data, color }) => {
                const vals = DIMENSIONS.map(d => data.scores[d.key] || 0);
                const avg5 = avg(vals);
                const noData = vals.every(v => v === 0);
                return (
                  <div key={data.id} style={{ display: 'flex', alignItems: 'center', gap: 20, flex: 1, minWidth: 220 }}>
                    <div style={{ textAlign: 'center', flexShrink: 0 }}>
                      <div style={{ fontSize: 9, fontFamily: 'var(--font-sans)', color, marginBottom: 4, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 700 }}>●</div>
                      <div style={{ fontSize: 48, fontWeight: 800, fontFamily: 'var(--font-sans)', lineHeight: 1, color: noData ? 'var(--text-3)' : color }}>
                        {noData ? '—' : avg5.toFixed(1)}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>{noData ? '피드백 없음' : '/ 5.0'}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4, color, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{data.title}</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        {DIMENSIONS.map(d => (
                          <div key={d.key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 9, color: d.color }}>{d.icon}</span>
                            <div style={{ width: 60, height: 3, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                              <div style={{ width: `${((data.scores[d.key] || 0) / 5) * 100}%`, height: '100%', background: color, borderRadius: 2 }} />
                            </div>
                            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 10, color, fontWeight: 600 }}>{(data.scores[d.key] || 0).toFixed(1)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </Card>
          ) : (
            <Card style={{ marginBottom: 28, display: 'flex', alignItems: 'center', gap: 40, background: 'linear-gradient(135deg, var(--surface), var(--bg-3))' }}>
              <div style={{ textAlign: 'center', flexShrink: 0 }}>
                <div style={{ fontSize: 11, fontFamily: 'var(--font-sans)', color: 'var(--text-3)', marginBottom: 8, letterSpacing: '0.08em', textTransform: 'uppercase' }}>종합 전환 점수</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, justifyContent: 'center' }}>
                  <span style={{ fontSize: 36, fontWeight: 800, fontFamily: 'var(--font-sans)', lineHeight: 1, color: overallAvg >= 4 ? 'var(--green)' : overallAvg >= 3 ? 'var(--accent)' : 'var(--red)' }}>
                    {overallAvg.toFixed(1)}
                  </span>
                  <span style={{ fontSize: 13, color: 'var(--text-3)', fontFamily: 'var(--font-sans)' }}>/ 5.0</span>
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>
                  가장 취약한 차원: <span style={{ color: worstDim.color }}>{worstDim.label} ({(scores[worstDim.key] || 0).toFixed(1)})</span>
                </div>
                <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.7, marginBottom: 14 }}>{worstDim.desc}</p>
                {selectedIds.size === 1 && activeTab !== 'guide' && <Btn size="sm" variant="outline" onClick={() => handleTabChange('guide')}>전환 가이드 보기 →</Btn>}
              </div>
            </Card>
          ))}

          <StatusTabs
            value={activeTab}
            onChange={handleTabChange}
            tabs={[
              { key: 'overview', label: '차원별 점수' },
              { key: 'benchmark', label: '업계 벤치마크' },
              { key: 'keywords', label: '코멘트 인사이트' },
              { key: 'guide', label: '전환 가이드' },
            ]}
            style={{ marginBottom: 24 }}
          />

          {activeTab === 'overview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {DIMENSIONS.map(d => {
                if (isComparing) {
                  const scores3 = compareItems.map(({ data, color }) => ({ s: data.scores[d.key] || 0, title: data.title, color }));
                  const maxS = Math.max(...scores3.map(x => x.s));
                  const winner = scores3.filter(x => x.s === maxS);
                  const verdict = winner.length === scores3.length
                    ? '— 동점'
                    : winner.length > 1
                      ? `▲ ${winner.map(x => x.title?.slice(0, 6) || '?').join('·')} 공동 우세`
                      : `▲ ${winner[0].title?.slice(0, 10) || '?'} 우세`;
                  return (
                    <Card key={d.key} style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 0, minHeight: 96 }}>
                      <div style={{ width: 200, flexShrink: 0, paddingRight: 20 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                          <span style={{ fontSize: 12, color: d.color }}>{d.icon}</span>
                          <span style={{ fontWeight: 700, fontSize: 14 }}>{d.label}</span>
                          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 10, color: 'var(--text-3)' }}>{d.sublabel}</span>
                        </div>
                        <span style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-sans)' }}>{verdict}</span>
                      </div>
                      <div style={{ width: 1, alignSelf: 'stretch', background: 'var(--border)', flexShrink: 0 }} />
                      <div style={{ flex: 1, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {compareItems.map(({ data, color }) => {
                          const s = data.scores[d.key] || 0;
                          return (
                            <div key={data.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontSize: 8, color, flexShrink: 0 }}>●</span>
                              <span style={{ width: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 11, color: 'var(--text-3)', flexShrink: 0 }}>{data.title}</span>
                              <div style={{ flex: 1, height: 10, background: 'var(--border)', borderRadius: 5, overflow: 'hidden' }}>
                                <div style={{ width: `${(s / 5) * 100}%`, height: '100%', background: color, borderRadius: 5, transition: 'width 0.6s ease' }} />
                              </div>
                              <span style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 14, color, width: 32, textAlign: 'right', flexShrink: 0 }}>{s.toFixed(1)}</span>
                            </div>
                          );
                        })}
                      </div>
                    </Card>
                  );
                }

                const score = scores[d.key] || 0;
                const dist = distributions[d.key] || [0, 0, 0, 0, 0];
                const maxCount = Math.max(...dist, 1);
                return (
                  <Card key={d.key} style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 0, minHeight: 110 }}>
                    <div style={{ width: 200, flexShrink: 0, paddingRight: 20 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                        <span style={{ fontSize: 12, color: d.color }}>{d.icon}</span>
                        <span style={{ fontWeight: 700, fontSize: 14 }}>{d.label}</span>
                        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 10, color: 'var(--text-3)' }}>{d.sublabel}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 8 }}>
                        <span style={{ fontFamily: 'var(--font-sans)', fontWeight: 800, fontSize: 26, color: d.color, lineHeight: 1 }}>{score.toFixed(1)}</span>
                        <span style={{ fontSize: 11, color: 'var(--text-3)' }}>/ 5.0</span>
                      </div>
                      <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ width: `${(score / 5) * 100}%`, height: '100%', background: d.color, borderRadius: 2, transition: 'width 0.8s ease' }} />
                      </div>
                    </div>
                    <div style={{ width: 1, alignSelf: 'stretch', background: 'var(--border)', flexShrink: 0 }} />
                    <div style={{ flex: 1, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 5 }}>
                      {dist.map((count, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 10, color: 'var(--text-3)', width: 20, textAlign: 'right', flexShrink: 0 }}>{i + 1}점</span>
                          <div style={{ flex: 1, height: 8, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                            <div style={{
                              width: `${(count / maxCount) * 100}%`,
                              height: '100%',
                              background: d.color,
                              borderRadius: 4,
                              transition: 'width 0.6s ease',
                              minWidth: count > 0 ? 4 : 0,
                            }} />
                          </div>
                          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 10, color: 'var(--text-3)', width: 20, flexShrink: 0 }}>{count > 0 ? `${count}건` : ''}</span>
                        </div>
                      ))}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}

          {activeTab === 'keywords' && (() => {
            const toggleDim = (key) => setExpandedDims(prev => {
              const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n;
            });

            // 코멘트 한 줄 (칭찬/지적)
            const commentRow = (sentiment, c, k) => {
              const isNeg = sentiment === 'neg';
              const col = isNeg ? '#ca2121' : '#159143';
              return (
                <div key={k} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '8px 11px', background: 'var(--bg-2)', borderRadius: 8, borderLeft: `3px solid ${col}` }}>
                  <span style={{ flexShrink: 0, fontSize: 11, fontWeight: 700, color: col, whiteSpace: 'nowrap' }}>{isNeg ? '👎' : '👍'} {c.score}점</span>
                  <span style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.55, flex: 1 }}>{c.text}</span>
                  {c.count > 1 && <span style={{ flexShrink: 0, fontSize: 11, color: 'var(--text-3)' }}>{c.count}명</span>}
                </div>
              );
            };

            // 차원 1개 카드 (worst=취약 강조, expandable=더보기)
            const renderDimCard = (key, ins, dimAvg, { worst = false, compact = false, expandable = false } = {}) => {
              const dim = DIMENSIONS.find(d => d.key === key);
              const { praise, critique } = ins;
              const isExp = expandable && expandedDims.has(key);
              const CAP = 3;
              const critShown = isExp ? critique : critique.slice(0, CAP);
              const praiseShown = isExp ? praise : praise.slice(0, CAP);
              const more = (critique.length - critShown.length) + (praise.length - praiseShown.length);
              const empty = praise.length === 0 && critique.length === 0;
              return (
                <Card key={key} style={{ padding: compact ? '14px 16px' : '18px 22px', borderLeft: worst ? '3px solid #ca2121' : undefined }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: empty ? 0 : 12, flexWrap: 'wrap' }}>
                    <span style={{ color: dim.color, fontSize: 14 }}>{dim.icon}</span>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>{dim.label}</span>
                    {dimAvg != null && dimAvg > 0 && <span style={{ fontSize: 12, color: 'var(--text-2)' }}>평균 {dimAvg.toFixed(1)}</span>}
                    <span style={{ fontSize: 12, color: '#159143' }}>👍 {praise.length}</span>
                    <span style={{ fontSize: 12, color: '#ca2121' }}>👎 {critique.length}</span>
                    {worst && <Badge type="red">취약</Badge>}
                  </div>
                  {empty ? null : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {critShown.map((c, i) => commentRow('neg', c, 'c' + i))}
                      {praiseShown.map((c, i) => commentRow('pos', c, 'p' + i))}
                      {expandable && more > 0 && (
                        <button onClick={() => toggleDim(key)} style={{ alignSelf: 'flex-start', marginTop: 2, padding: '4px 6px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--accent)', fontWeight: 600 }}>
                          {isExp ? '접기' : `+${more}건 더보기`}
                        </button>
                      )}
                    </div>
                  )}
                </Card>
              );
            };

            if (isComparing) {
              // 비교 모드: 의뢰별 차원 요약 (차원별 칭찬/지적 수 + 대표 지적 1건)
              return (
                <div style={{ display: 'flex', gap: 16 }}>
                  {compareItems.map(({ data, color }) => {
                    const ins = data.dimInsights || {};
                    const anyData = DIMENSIONS.some(d => ins[d.key] && (ins[d.key].praise.length || ins[d.key].critique.length));
                    return (
                      <Card key={data.id} style={{ flex: 1, padding: '18px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                          <span style={{ fontSize: 10, color }}>●</span>
                          <span style={{ fontWeight: 700, fontSize: 13, color }}>{data.title}</span>
                        </div>
                        {!anyData ? (
                          <div style={{ fontSize: 13, color: 'var(--text-3)', textAlign: 'center', padding: '20px 0' }}>코멘트 없음</div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {DIMENSIONS.map(d => {
                              const di = ins[d.key] || { praise: [], critique: [] };
                              return (
                                <div key={d.key}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                    <span style={{ color: d.color, fontSize: 12 }}>{d.icon}</span>
                                    <span style={{ fontWeight: 600, fontSize: 12.5 }}>{d.label}</span>
                                    <span style={{ fontSize: 11, color: '#159143' }}>👍{di.praise.length}</span>
                                    <span style={{ fontSize: 11, color: '#ca2121' }}>👎{di.critique.length}</span>
                                  </div>
                                  {di.critique[0] && commentRow('neg', di.critique[0], 'cc')}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </Card>
                    );
                  })}
                </div>
              );
            }

            const anyData = DIMENSIONS.some(d => dimInsights[d.key] && (dimInsights[d.key].praise.length || dimInsights[d.key].critique.length));
            if (!anyData) return (
              <Card style={{ padding: '40px', textAlign: 'center' }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>💬</div>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>분석할 코멘트가 없습니다</div>
                <div style={{ fontSize: 13, color: 'var(--text-3)' }}>패널이 점수와 함께 남긴 코멘트가 쌓이면 차원별 강·약점이 여기에 표시됩니다.</div>
              </Card>
            );

            // 점수 낮은 차원(취약)부터 정렬 — "무엇을 고칠지"가 위로
            const ordered = [...DIMENSIONS].sort((a, b) => (scores[a.key] || 99) - (scores[b.key] || 99));
            const worstKey = ordered.find(d => (scores[d.key] || 0) > 0)?.key;

            return (
              <div>
                <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 20, lineHeight: 1.7 }}>
                  각 차원에서 패널이 실제로 <b style={{ color: '#159143' }}>칭찬한 점(4~5점)</b>과 <b style={{ color: '#ca2121' }}>지적한 점(1~2점)</b>을 모았습니다.
                  점수가 낮은 차원부터 정렬했으니, 위쪽 차원의 지적부터 개선해 보세요.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {ordered.map(d => renderDimCard(
                    d.key,
                    dimInsights[d.key] || { praise: [], critique: [] },
                    scores[d.key] ?? null,
                    { worst: d.key === worstKey && (scores[d.key] || 0) > 0, expandable: true }
                  ))}
                </div>
              </div>
            );
          })()}

          {activeTab === 'guide' && (() => {
            if (!guideSelectedId || missions.length === 0) return (
              <Card style={{ padding: '60px', textAlign: 'center' }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>📋</div>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>분석할 의뢰를 선택해 주세요</div>
                <div style={{ color: 'var(--text-2)', fontSize: 13 }}>위 의뢰 칩에서 하나를 선택하면 전환 가이드가 표시됩니다.</div>
              </Card>
            );

            if (guideLoading) return (
              <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>데이터 로딩 중…</div>
            );

            // guideFeedbacks는 독립 로드 — rawFeedbacks/selectedIds 무관
            const cutoff = period === 'all' ? null : new Date(Date.now() - (period === '3m' ? 90 : 30) * 86400000);
            const periodMissionIds = cutoff ? new Set(missions.filter(m => new Date(m.created_at) >= cutoff).map(m => m.id)) : null;
            const guideFbs = (periodMissionIds && !periodMissionIds.has(guideSelectedId))
              ? []
              : guideFeedbacks;

            if (guideFbs.length === 0) return (
              <Card style={{ padding: '60px', textAlign: 'center' }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>💬</div>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>선택한 의뢰에 피드백이 없습니다</div>
                <div style={{ color: 'var(--text-2)', fontSize: 13 }}>다른 의뢰를 선택하거나 기간 필터를 조정해 보세요.</div>
              </Card>
            );

            // 선택 의뢰 단독 점수 계산 (데이터 없는 차원은 0)
            const guideScores = {};
            DIMENSIONS.forEach(d => {
              const vals = guideFbs.map(f => f[d.key]).filter(Boolean);
              guideScores[d.key] = vals.length ? avg(vals) : 0;
            });

            // 점수가 있는 차원만 대상 — 무데이터 차원이 음수로 점수를 끌어내리거나(가중치 재정규화)
            // 취약차원으로 오선정되는 것 방지. 전 차원 무데이터면 폴백.
            const scoredDims = DIMENSIONS.filter(d => (guideScores[d.key] || 0) > 0);
            const totalW = scoredDims.reduce((s, d) => s + (GUIDE_WEIGHTS[d.key] || 0), 0);
            const cpScore = totalW > 0 ? Math.max(0, Math.min(100, Math.round(
              scoredDims.reduce((sum, d) => sum + ((guideScores[d.key] - 1) / 4 * 100) * (GUIDE_WEIGHTS[d.key] || 0), 0) / totalW
            ))) : 0;
            const level = GUIDE_LEVELS.find(l => cpScore >= l.min) || GUIDE_LEVELS[GUIDE_LEVELS.length - 1];
            const guideWorst = (scoredDims.length ? scoredDims : DIMENSIONS).reduce((w, d) => (guideScores[d.key] || 0) < (guideScores[w.key] || 0) ? d : w);

            // 취약 차원에 점수를 낮게 준 코멘트부터(가장 날카로운 지적 우선), 동점이면 코멘트 품질 높은 순
            const dimComments = guideFbs
              .map(f => ({ comment: extractDimComment(f, guideWorst.key), dimScore: f[guideWorst.key], quality: calcPurityScoreLocal(f) }))
              .filter(x => x.comment)
              .sort((a, b) => {
                const sa = a.dimScore == null ? Infinity : a.dimScore;
                const sb = b.dimScore == null ? Infinity : b.dimScore;
                if (sa !== sb) return sa - sb;
                return b.quality - a.quality;
              });
            const topComments = dimComments.slice(0, 3);

            const action = NEXT_ACTIONS[guideWorst.key];

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                {/* 전환 잠재력 점수 카드 */}
                <Card style={{ padding: '28px 32px' }}>
                  <div style={{ fontSize: 11, fontFamily: 'var(--font-sans)', color: 'var(--text-3)', letterSpacing: '0.05em', marginBottom: 20 }}>전환 잠재력 점수</div>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 40 }}>
                    <div style={{ flexShrink: 0, textAlign: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, justifyContent: 'center' }}>
                        <span style={{ fontSize: 72, fontWeight: 900, fontFamily: 'var(--font-sans)', lineHeight: 1, color: level.color }}>{cpScore}</span>
                        <span style={{ fontSize: 20, color: 'var(--text-3)', fontFamily: 'var(--font-sans)' }}>/100</span>
                      </div>
                      <div style={{ marginTop: 10 }}>
                        <span style={{ display: 'inline-block', padding: '4px 14px', borderRadius: 20, background: level.color + '18', color: level.color, fontSize: 13, fontWeight: 700 }}>{level.label}</span>
                      </div>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ height: 6, background: 'var(--border)', borderRadius: 4, overflow: 'hidden', marginBottom: 14 }}>
                        <div style={{ width: `${cpScore}%`, height: '100%', background: level.color, borderRadius: 4, transition: 'width 1s ease' }} />
                      </div>
                      <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.75, margin: '0 0 20px' }}>{GUIDE_DESCS[level.label]}</p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                        {DIMENSIONS.map(d => {
                          const s = guideScores[d.key] || 0;
                          const isWorst = d.key === guideWorst.key;
                          return (
                            <div key={d.key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontSize: 11, width: 52, fontWeight: isWorst ? 700 : 400, color: isWorst ? d.color : 'var(--text-3)', flexShrink: 0 }}>{d.label}</span>
                              <div style={{ flex: 1, height: 5, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                                <div style={{ width: `${(s / 5) * 100}%`, height: '100%', background: d.color, borderRadius: 3, transition: 'width 0.8s ease' }} />
                              </div>
                              <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, width: 26, textAlign: 'right', fontWeight: isWorst ? 700 : 400, color: isWorst ? d.color : 'var(--text-3)', flexShrink: 0 }}>{s > 0 ? s.toFixed(1) : '—'}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </Card>

                {/* 취약 차원 인사이트 */}
                <Card style={{ padding: '24px 28px', borderLeft: `4px solid ${guideWorst.color}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 15, fontWeight: 700 }}>⚡ 지금 집중할 한 가지</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 14px', borderRadius: 14, background: guideWorst.color, color: '#fff', fontSize: 13, fontWeight: 800, boxShadow: `0 2px 8px ${guideWorst.color}40` }}>
                      <span style={{ fontSize: 13 }}>{guideWorst.icon}</span>
                      {guideWorst.label} {(guideScores[guideWorst.key] || 0).toFixed(1)}점
                    </span>
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.7, marginBottom: 20 }}>{guideWorst.desc}</p>

                  {dimComments.length === 0 ? (
                    <div style={{ fontSize: 13, color: 'var(--text-3)', textAlign: 'center', padding: '20px 0' }}>
                      이 차원에 해당하는 코멘트가 아직 없습니다.
                    </div>
                  ) : (
                    <>
                      <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 12, fontFamily: 'var(--font-sans)' }}>
                        패널 {dimComments.length}건 코멘트 중 점수 낮은 순
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {topComments.map((item, i) => (
                          <div key={i} style={{ padding: '14px 16px', background: 'var(--surface)', borderRadius: 'var(--radius)', borderLeft: `3px solid ${guideWorst.color}` }}>
                            <p style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.75, margin: '0 0 8px', fontWeight: 500 }}>
                              "{item.comment.slice(0, 220)}{item.comment.length > 220 ? '…' : ''}"
                            </p>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                              {item.dimScore != null && (
                                <span style={{ fontSize: 10, fontFamily: 'var(--font-sans)', padding: '2px 7px', borderRadius: 4, background: guideWorst.color + '12', color: guideWorst.color, fontWeight: 700 }}>
                                  {guideWorst.label} {item.dimScore.toFixed(1)}점
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                      {dimComments.length > 3 && (
                        <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-3)', textAlign: 'right' }}>
                          외 {dimComments.length - 3}건 더 있음
                        </div>
                      )}
                    </>
                  )}
                </Card>

                {/* 다음 추천 액션 */}
                {action && (
                  <Card style={{ padding: '22px 28px', background: 'linear-gradient(135deg, var(--accent-dim2), var(--bg))' }}>
                    <div style={{ fontSize: 11, fontFamily: 'var(--font-sans)', color: 'var(--text-3)', letterSpacing: '0.05em', marginBottom: 14 }}>다음 추천 액션</div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20 }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                        <span style={{ fontSize: 20, color: 'var(--accent)', flexShrink: 0, marginTop: 1 }}>→</span>
                        <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', lineHeight: 1.65, margin: 0 }}>{action.text}</p>
                      </div>
                      <Btn size="sm" onClick={() => navigate(action.path)} style={{ flexShrink: 0 }}>{action.cta}</Btn>
                    </div>
                  </Card>
                )}
              </div>
            );
          })()}

          {activeTab === 'benchmark' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 8, lineHeight: 1.7 }}>
                업계 기준치와 비교한 결과입니다.
                {isComparing && <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--text-3)' }}>{compareItems.length}개 의뢰를 나란히 비교합니다.</span>}
              </p>
              {DIMENSIONS.map(d => {
                const bench = benchmarks[d.key] || d.benchmark;

                if (isComparing) {
                  return (
                    <Card key={d.key} style={{ padding: '16px 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 10 }}>
                        <span style={{ width: 80, fontSize: 13, fontWeight: 600 }}>{d.label}</span>
                        <div style={{ flex: 1, position: 'relative', height: 4, background: 'var(--border)', borderRadius: 2 }}>
                          <div style={{ position: 'absolute', left: `${(bench / 5) * 100}%`, top: -5, width: 2, height: 14, background: 'var(--text-3)', borderRadius: 1 }} />
                        </div>
                        <span style={{ fontSize: 11, color: 'var(--text-3)', width: 80, textAlign: 'right', fontFamily: 'var(--font-sans)' }}>벤치 {bench.toFixed(1)}</span>
                      </div>
                      {compareItems.map(({ data, color }) => {
                        const s = data.scores[d.key] || 0;
                        const diff = s - bench;
                        return (
                          <div key={data.id} style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 6 }}>
                            <span style={{ width: 80, fontSize: 11, color, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}>{data.title?.slice(0, 10)}</span>
                            <div style={{ flex: 1, position: 'relative', height: 7, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                              <div style={{ width: `${(s / 5) * 100}%`, height: '100%', background: color, borderRadius: 4, transition: 'width 0.8s ease' }} />
                            </div>
                            <div style={{ width: 80, textAlign: 'right', display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'flex-end' }}>
                              <span style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 14, color }}>{s.toFixed(1)}</span>
                              <Badge type={diff >= 0 ? 'green' : 'red'}>{diff >= 0 ? `+${diff.toFixed(1)}` : diff.toFixed(1)}</Badge>
                            </div>
                          </div>
                        );
                      })}
                    </Card>
                  );
                }

                const myScore = scores[d.key] || 0;
                const diff = myScore - bench;
                return (
                  <Card key={d.key} style={{ padding: '16px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      <span style={{ width: 80, fontSize: 13, fontWeight: 600 }}>{d.label}</span>
                      <div style={{ flex: 1, position: 'relative', height: 8, background: 'var(--border)', borderRadius: 4, overflow: 'visible' }}>
                        <div style={{ position: 'absolute', left: `${(bench / 5) * 100}%`, top: -4, width: 2, height: 16, background: 'var(--text-3)', borderRadius: 1 }} />
                        <div style={{ width: `${(myScore / 5) * 100}%`, height: '100%', background: diff >= 0 ? 'var(--green)' : 'var(--red)', borderRadius: 4, transition: 'width 0.8s ease' }} />
                      </div>
                      <div style={{ width: 80, textAlign: 'right', display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'flex-end' }}>
                        <span style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 14 }}>{myScore.toFixed(1)}</span>
                        <Badge type={diff >= 0 ? 'green' : 'red'}>{diff >= 0 ? `+${diff.toFixed(1)}` : diff.toFixed(1)}</Badge>
                      </div>
                    </div>
                  </Card>
                );
              })}
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 8 }}>
                세로선 = 업계 기준치
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
