import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Badge, Btn } from '../../components/ui';
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

// 차원별 코멘트 추출: [명확성] 또는 [명확성 / X점] 패턴 매칭 → 없으면 전체 suggestions 폴백
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
  if (text.length >= 10) return text.slice(0, 500);
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
  trust_score:           { text: '신뢰 요소를 집중 검증하는 LP 의뢰를 진행해보세요', path: '/company/new', cta: '의뢰 등록 →' },
};

const avg = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

const KO_STOP = new Set(['이','가','은','는','을','를','의','에','서','와','과','으로','로','에서','까지','부터','도','만','이다','있다','하다','되다','이고','그','그리고','또','하지만','그러나','하여','해서','것','수','더','또한','등','및','위해','대해','관해','있는','없는','하는','되는','많이','어서','입니다','습니다','합니다','했습니다','됩니다','같은','같이','때문에','통해','위한','않은','않고','않아','않습니다','없어','있어','있고','없고','없어서','이런','이렇게','저렇게','그렇게','좋은','좋아','나쁜','너무','매우','정말','조금','좀','잘','못','안','더욱','가장','좋습니다','입니다','있습니다','없습니다','하겠습니다','됩니다','됩니다만','입니다만']);

function extractKeywords(feedbacks) {
  const freq = {};
  feedbacks.forEach(f => {
    const text = [f.suggestions, f.strengths, f.weaknesses].filter(Boolean).join(' ');
    text.split(/[\s,.\[\]「」『』【】〔〕《》\(\)\!\?\;\:\"\'\n\r]+/)
      .map(w => w.replace(/[^가-힣a-zA-Z0-9]/g, '').trim())
      .filter(w => w.length >= 2 && !KO_STOP.has(w))
      .forEach(w => { freq[w] = (freq[w] || 0) + 1; });
  });
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 60)
    .map(([word, count]) => ({ word, count }));
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
  const [keywords, setKeywords] = useState([]);
  const [missions, setMissions] = useState([]);
  const [allMissionIds, setAllMissionIds] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [compareMode, setCompareMode] = useState(false);
  const [compareData, setCompareData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [hasData, setHasData] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
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
    setKeywords(extractKeywords(filtered));
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

      const { data: ms } = await supabase.from('missions').select('id, title, created_at').eq('company_id', co.id).eq('status', 'completed').order('created_at', { ascending: false });
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
      setKeywords(extractKeywords(periodFiltered));
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
        a: { id: idA, title: mA?.title || 'A', scores: comA.newScores, distributions: comA.newDistributions, keywords: extractKeywords(fbsA) },
        b: { id: idB, title: mB?.title || 'B', scores: comB.newScores, distributions: comB.newDistributions, keywords: extractKeywords(fbsB) },
      };
      if (idC) {
        const comC = computeForFbs(fbsC);
        data.c = { id: idC, title: mC?.title || 'C', scores: comC.newScores, distributions: comC.newDistributions, keywords: extractKeywords(fbsC) };
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
        <div style={{ fontSize: 12, fontFamily: 'var(--font-sans)', color: 'var(--text-2)', marginBottom: 8, letterSpacing: '0.1em' }}>5-DIMENSION DIAGNOSIS</div>
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
          <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: 'var(--text-3)', flexShrink: 0 }}>기간</span>
            <div style={{ display: 'flex', gap: 4, background: '#F1F5F9', borderRadius: 8, padding: 3 }}>
              {[['all', '전체'], ['3m', '최근 3개월'], ['1m', '최근 1개월']].map(([val, label]) => (
                <button key={val} onClick={() => setPeriod(val)} style={{
                  padding: '4px 12px', borderRadius: 6, fontSize: 12, fontWeight: period === val ? 700 : 500,
                  background: period === val ? '#fff' : 'transparent',
                  color: period === val ? 'var(--text)' : 'var(--text-3)',
                  border: 'none', cursor: 'pointer',
                  boxShadow: period === val ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  transition: 'all 0.15s',
                }}>{label}</button>
              ))}
            </div>
          </div>
          </>
        )}
      </div>

      {!hasData ? (
        <Card style={{ padding: '60px', textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>📊</div>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>아직 피드백 데이터가 없습니다</div>
          <div style={{ color: 'var(--text-2)', fontSize: 13 }}>의뢰를 등록하고 패널 피드백이 수집되면 5대 지표 진단 결과가 표시됩니다.</div>
        </Card>
      ) : (
        <>
          {/* 헤더 요약 카드 */}
          {isComparing ? (
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
                {selectedIds.size === 1 && activeTab !== 'guide' && <Btn size="sm" variant="outline" onClick={() => setShowGuide(true)}>개선 가이드 보기 →</Btn>}
              </div>
            </Card>
          )}

          <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: 'var(--surface)', borderRadius: 'var(--radius)', padding: 4, width: 'fit-content' }}>
            {[['overview', '차원별 점수'], ['benchmark', '업계 벤치마크'], ['keywords', '키워드 분석'], ['guide', '전환 가이드']].map(([v, l]) => (
              <button key={v} onClick={() => handleTabChange(v)} style={{
                padding: '7px 18px', borderRadius: 4, fontSize: 13, fontWeight: 500,
                background: activeTab === v ? 'var(--bg)' : 'transparent',
                color: activeTab === v ? 'var(--text)' : 'var(--text-3)',
                border: 'none', cursor: 'pointer', transition: 'all 0.15s',
              }}>{l}</button>
            ))}
          </div>

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
            if (isComparing) {
              // Compare mode: show A and B keywords side by side
              return (
                <div style={{ display: 'flex', gap: 16 }}>
                  {compareItems.map(({ data, color }) => {
                    const kws = data.keywords || [];
                    const maxC = kws[0]?.count || 1;
                    const minSize = 11, maxSize = 26;
                    return (
                      <Card key={data.id} style={{ flex: 1, padding: '20px 24px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                          <span style={{ fontSize: 10, color }}>●</span>
                          <span style={{ fontWeight: 700, fontSize: 13, color }}>{data.title}</span>
                        </div>
                        {kws.length === 0 ? (
                          <div style={{ fontSize: 13, color: 'var(--text-3)', textAlign: 'center', padding: '20px 0' }}>코멘트 없음</div>
                        ) : (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 12px', alignItems: 'center', lineHeight: 1.8 }}>
                            {kws.slice(0, 30).map(({ word, count }) => {
                              const ratio = (count - 1) / Math.max(maxC - 1, 1);
                              const size = Math.round(minSize + ratio * (maxSize - minSize));
                              const opacity = 0.5 + ratio * 0.5;
                              return (
                                <span key={word} title={`${count}회`} style={{
                                  fontSize: size,
                                  fontWeight: ratio > 0.6 ? 800 : ratio > 0.3 ? 600 : 400,
                                  color: `rgba(${color === COMPARE_B ? '198,101,7' : color === COMPARE_C ? '21,145,67' : '16,54,125'},${opacity})`,
                                  cursor: 'default',
                                }}>{word}</span>
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

            if (keywords.length === 0) return (
              <Card style={{ padding: '40px', textAlign: 'center' }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>💬</div>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>분석할 코멘트가 없습니다</div>
                <div style={{ fontSize: 13, color: 'var(--text-3)' }}>패널 코멘트가 쌓이면 자주 언급된 키워드가 여기에 표시됩니다.</div>
              </Card>
            );
            const maxCount = keywords[0].count;
            const minSize = 11, maxSize = 32;
            return (
              <div>
                <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 20, lineHeight: 1.7 }}>
                  패널 코멘트에서 자주 등장한 키워드입니다. 글자 크기는 언급 빈도에 비례합니다.
                </p>
                <Card style={{ padding: '32px' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 16px', alignItems: 'center', lineHeight: 1.8 }}>
                    {keywords.map(({ word, count }) => {
                      const ratio = (count - 1) / Math.max(maxCount - 1, 1);
                      const size = Math.round(minSize + ratio * (maxSize - minSize));
                      const opacity = 0.5 + ratio * 0.5;
                      const hue = 210 + ratio * 40;
                      return (
                        <span key={word} title={`${count}회 언급`} style={{
                          fontSize: size,
                          fontWeight: ratio > 0.6 ? 800 : ratio > 0.3 ? 600 : 400,
                          color: `hsla(${hue}, 80%, 65%, ${opacity})`,
                          cursor: 'default',
                          transition: 'color 0.2s',
                          letterSpacing: size > 20 ? '-0.02em' : 'normal',
                        }}>
                          {word}
                        </span>
                      );
                    })}
                  </div>
                </Card>
                <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ fontSize: 12, fontFamily: 'var(--font-sans)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>상위 10개 키워드</div>
                  {keywords.slice(0, 10).map(({ word, count }, i) => (
                    <div key={word} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--text-3)', width: 20 }}>0{i + 1}</span>
                      <span style={{ fontSize: 13, fontWeight: 600, width: 100 }}>{word}</span>
                      <div style={{ flex: 1, height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ width: `${(count / maxCount) * 100}%`, height: '100%', background: 'var(--accent)', borderRadius: 2 }} />
                      </div>
                      <span style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--text-2)', width: 40, textAlign: 'right' }}>{count}회</span>
                    </div>
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

            // 선택 의뢰 단독 점수 계산
            const guideScores = {};
            DIMENSIONS.forEach(d => {
              const vals = guideFbs.map(f => f[d.key]).filter(Boolean);
              guideScores[d.key] = vals.length ? avg(vals) : 0;
            });

            const cpScore = Math.max(0, Math.min(100, Math.round(
              DIMENSIONS.reduce((sum, d) => sum + ((guideScores[d.key] || 0) - 1) / 4 * 100 * (GUIDE_WEIGHTS[d.key] || 0), 0)
            )));
            const level = GUIDE_LEVELS.find(l => cpScore >= l.min) || GUIDE_LEVELS[GUIDE_LEVELS.length - 1];
            const guideWorst = DIMENSIONS.reduce((w, d) => (guideScores[d.key] || 0) < (guideScores[w.key] || 0) ? d : w);

            const sortedFbs = [...guideFbs].sort((a, b) => calcPurityScoreLocal(b) - calcPurityScoreLocal(a));
            const dimComments = sortedFbs
              .map(f => ({ comment: extractDimComment(f, guideWorst.key), dimScore: f[guideWorst.key] }))
              .filter(x => x.comment);
            const topComments = dimComments.slice(0, 3);

            const action = NEXT_ACTIONS[guideWorst.key];

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                {/* 전환 잠재력 점수 카드 */}
                <Card style={{ padding: '28px 32px' }}>
                  <div style={{ fontSize: 11, fontFamily: 'var(--font-sans)', color: 'var(--text-3)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 20 }}>CONVERSION POTENTIAL</div>
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
                                <div style={{ width: `${(s / 5) * 100}%`, height: '100%', background: isWorst ? d.color : 'var(--bg-3)', borderRadius: 3, transition: 'width 0.8s ease' }} />
                              </div>
                              <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, width: 26, textAlign: 'right', fontWeight: isWorst ? 700 : 400, color: isWorst ? d.color : 'var(--text-3)', flexShrink: 0 }}>{s.toFixed(1)}</span>
                              <span style={{ fontSize: 10, color: 'var(--text-3)', width: 30, textAlign: 'right', flexShrink: 0 }}>×{GUIDE_WEIGHTS[d.key]}</span>
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
                    <span style={{ padding: '3px 12px', borderRadius: 12, background: guideWorst.color + '18', color: guideWorst.color, fontSize: 12, fontWeight: 700 }}>
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
                        패널 {dimComments.length}건 코멘트 중 신뢰도 높은 순
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
                    <div style={{ fontSize: 11, fontFamily: 'var(--font-sans)', color: 'var(--text-3)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 14 }}>NEXT ACTION</div>
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
                플랫폼 전체 평균값과 비교한 결과입니다.
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
                <span style={{ display: 'inline-block', width: 12, height: 2, background: 'var(--text-3)', verticalAlign: 'middle', marginRight: 6 }} />
                세로선 = 플랫폼 전체 평균
              </div>
            </div>
          )}
        </>
      )}

      {/* 개선 가이드 모달 — 퓨릿 점수 높은 순 실제 코멘트 */}
      {showGuide && (() => {
        const sorted = [...rawFeedbacks].sort((a, b) => calcPurityScoreLocal(b) - calcPurityScoreLocal(a));
        const items = sorted
          .map(f => ({ f, comment: extractDimComment(f, worstDim.key), score: calcPurityScoreLocal(f) }))
          .filter(x => x.comment)
          .slice(0, 5);
        return (
          <div onClick={() => setShowGuide(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg)', borderRadius: 'var(--radius-lg)', padding: 32, maxWidth: 560, width: '100%', border: '1px solid var(--border)', boxShadow: '0 24px 64px rgba(0,0,0,0.4)', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexShrink: 0 }}>
                <div>
                  <div style={{ fontSize: 11, fontFamily: 'var(--font-sans)', color: worstDim.color, marginBottom: 6, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    실제 패널 코멘트 — {worstDim.label} ({(activeScores[worstDim.key] || 0).toFixed(1)}/5)
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 800 }}>퓨릿 점수 높은 코멘트</div>
                  <div style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 4 }}>구체적이고 신뢰도 높은 패널 피드백입니다.</div>
                </div>
                <button onClick={() => setShowGuide(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', fontSize: 20, lineHeight: 1, flexShrink: 0 }}>✕</button>
              </div>
              {items.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-3)', fontSize: 13 }}>
                  이 차원에 해당하는 코멘트가 없습니다.
                </div>
              ) : (
                <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {items.map(({ f, comment, score }, i) => {
                    const dimScore = f[worstDim.key];
                    return (
                      <div key={i} style={{ padding: '14px 16px', background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', borderLeft: `3px solid ${worstDim.color}` }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--text-3)', fontWeight: 700 }}>#{i + 1}</span>
                          {dimScore != null && (
                            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: `${worstDim.color}18`, color: worstDim.color }}>
                              {worstDim.label} {dimScore.toFixed(1)}점
                            </span>
                          )}
                        </div>
                        <p style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.75, margin: 0, fontWeight: 500 }}>{comment}</p>
                      </div>
                    );
                  })}
                </div>
              )}
              <div style={{ marginTop: 16, fontSize: 12, color: 'var(--text-3)', textAlign: 'center', flexShrink: 0 }}>
                신뢰도 높은 패널 순 · 5개
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
