import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Badge, Btn } from '../../components/ui';
import { supabase } from '../../lib/supabase';

const IMPROVEMENT_GUIDES = {
  clarity_score: {
    title: '명확성 개선 가이드',
    tips: [
      '첫 문장에서 "누구를 위한 무엇"인지 명시하세요. (예: "B2B 마케터를 위한 전환율 분석 툴")',
      '헤드라인을 3초 안에 읽히도록 10단어 이내로 줄이세요.',
      '전문 용어·약어를 일반 언어로 바꾸세요. 업계 용어는 패널이 이해 못할 수 있습니다.',
      'CTA 버튼 문구를 "시작하기" 대신 "무료로 전환율 진단받기"처럼 구체적으로 바꾸세요.',
      '히어로 섹션에 제품 사용 화면 또는 결과물 이미지를 넣으세요.',
    ],
  },
  relevance_score: {
    title: '관련성 개선 가이드',
    tips: [
      '타겟 고객의 고통점을 첫 문단에서 직접 언급하세요. (예: "광고비는 쓰는데 전환이 안 되시나요?")',
      'ICP(이상적 고객 프로필)의 언어를 그대로 사용하세요. 인터뷰·리뷰에서 실제 표현을 가져오세요.',
      '특정 직군·산업군을 명시하면 관련성이 높아집니다. 범용 메시지는 아무에게도 와닿지 않습니다.',
      '사용 사례(Use Case)를 3가지 이상 구체적 시나리오로 제시하세요.',
      '헤드라인에 숫자·기간을 넣으세요. (예: "2주 안에 전환율 23% 개선")',
    ],
  },
  value_score: {
    title: '가치 개선 가이드',
    tips: [
      'ROI를 계산해서 보여주세요. (예: "월 100만 원 절감" vs "효율적인 마케팅")',
      '경쟁사 대비 가격 이점 또는 품질 이점을 수치로 제시하세요.',
      '무료 체험·환불 보장·성과 기반 요금제로 초기 진입 장벽을 낮추세요.',
      '고객 사례(Before/After)를 숫자로 표현하세요. (예: "A사: 전환율 1.2% → 3.8%")',
      '가격 페이지에서 각 플랜이 어떤 문제를 해결하는지 명확히 연결하세요.',
    ],
  },
  differentiation_score: {
    title: '차별화 개선 가이드',
    tips: [
      '"왜 우리인가" 섹션을 별도로 만들고 경쟁사와 기능 비교표를 추가하세요.',
      '독보적인 데이터·특허·방법론이 있다면 수치로 강조하세요.',
      '창업자 스토리나 팀의 독특한 배경을 짧게 소개하세요. 사람이 차별점이 될 수 있습니다.',
      '고객 리뷰에서 "타 서비스와 달리..." 언급이 있으면 이를 문구로 활용하세요.',
      '틈새 시장에 집중한다면 "유일한 [특정 대상]을 위한 솔루션"으로 포지셔닝하세요.',
    ],
  },
  trust_score: {
    title: '신뢰 개선 가이드',
    tips: [
      '고객사 로고를 히어로 섹션 바로 아래에 배치하세요. 브랜드 인지도가 신뢰를 전달합니다.',
      '리뷰·후기를 직함·회사명과 함께 실명으로 표시하세요. 익명 후기는 효과가 낮습니다.',
      '미디어 노출(언론 기사, 수상 이력)을 "~에 소개된"으로 표현하세요.',
      '보안 인증·개인정보 처리방침 링크를 결제 CTA 근처에 배치하세요.',
      '창업자·팀 소개 페이지에 LinkedIn 링크를 넣어 실존 인물임을 증명하세요.',
    ],
  },
};

const DIMENSIONS = [
  { key: 'clarity_score',         label: '명확성', sublabel: 'Clarity',         icon: '◎', color: '#159143', desc: '메시지를 처음 본 사람이 3초 안에 무엇을 파는지 이해하는가?', benchmark: 3.2 },
  { key: 'relevance_score',       label: '관련성', sublabel: 'Relevance',       icon: '◆', color: '#c66507', desc: '타겟 고객의 현실적인 고통과 욕구에 메시지가 정렬되어 있는가?', benchmark: 2.8 },
  { key: 'value_score',           label: '가치',   sublabel: 'Value',           icon: '▲', color: '#4940d8', desc: '제품이 제공하는 가치가 가격 대비 충분히 설득력 있는가?', benchmark: 3.5 },
  { key: 'differentiation_score', label: '차별화', sublabel: 'Differentiation', icon: '◈', color: '#ca2121', desc: '경쟁사 대비 왜 이 제품을 선택해야 하는지 명확히 전달되는가?', benchmark: 2.4 },
  { key: 'trust_score',           label: '신뢰',   sublabel: 'Trust',           icon: '●', color: '#94a3b8', desc: '처음 방문자가 브랜드와 제품을 신뢰할 수 있는 근거가 충분한가?', benchmark: 3.0 },
];

const COMPARE_A = 'var(--accent)';
const COMPARE_B = '#c66507';

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

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!allMissionIds.length) return;
    if (compareMode && selectedIds.size === 2) {
      loadCompare([...selectedIds]);
    } else {
      const ids = selectedIds.size === 0 ? allMissionIds : [...selectedIds];
      loadFeedbacks(ids);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIds, compareMode]);

  function computeForFbs(myFeedbacks, allFeedbacks) {
    const newScores = {}, newDistributions = {}, newBenchmarks = {};
    DIMENSIONS.forEach(d => {
      const myVals = myFeedbacks.map(f => f[d.key]).filter(Boolean);
      newScores[d.key] = myVals.length ? avg(myVals) : 0;
      const dist = [0, 0, 0, 0, 0];
      myVals.forEach(v => { const i = Math.round(v) - 1; if (i >= 0 && i <= 4) dist[i]++; });
      newDistributions[d.key] = dist;
      const allVals = (allFeedbacks || []).map(f => f[d.key]).filter(Boolean);
      newBenchmarks[d.key] = allVals.length ? avg(allVals) : d.benchmark;
    });
    return { newScores, newDistributions, newBenchmarks };
  }

  async function load() {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data: co } = await supabase.from('companies').select('id').eq('user_id', user.id).single();
      if (!co) { setLoading(false); return; }

      const { data: ms } = await supabase.from('missions').select('id, title').eq('company_id', co.id).eq('status', 'completed');
      const msList = ms || [];
      const ids = msList.map(m => m.id);
      setMissions(msList);
      setAllMissionIds(ids);

      await loadFeedbacks(ids);
      setLoading(false);
    } catch (err) {
      console.error('[Diagnosis load]', err);
      setLoading(false);
    }
  }

  async function loadFeedbacks(ids) {
    if (!ids.length) { setHasData(false); return; }

    const [myRes, allRes] = await Promise.all([
      supabase.from('feedbacks').select('clarity_score,relevance_score,value_score,differentiation_score,trust_score,suggestions,strengths,weaknesses').in('mission_id', ids).eq('purity_passed', true),
      supabase.from('feedbacks').select('clarity_score,relevance_score,value_score,differentiation_score,trust_score').eq('purity_passed', true),
    ]);

    const myFeedbacks = myRes.data || [];
    const allFeedbacks = allRes.data || [];
    setHasData(myFeedbacks.length > 0);
    setCompareData(null);

    const { newScores, newDistributions, newBenchmarks } = computeForFbs(myFeedbacks, allFeedbacks);
    setScores(newScores);
    setDistributions(newDistributions);
    setBenchmarks(newBenchmarks);
    setKeywords(extractKeywords(myFeedbacks));
  }

  async function loadCompare([idA, idB]) {
    const mA = missions.find(m => m.id === idA);
    const mB = missions.find(m => m.id === idB);

    const [resA, resB, allRes] = await Promise.all([
      supabase.from('feedbacks').select('clarity_score,relevance_score,value_score,differentiation_score,trust_score,suggestions,strengths,weaknesses').eq('mission_id', idA).eq('purity_passed', true),
      supabase.from('feedbacks').select('clarity_score,relevance_score,value_score,differentiation_score,trust_score,suggestions,strengths,weaknesses').eq('mission_id', idB).eq('purity_passed', true),
      supabase.from('feedbacks').select('clarity_score,relevance_score,value_score,differentiation_score,trust_score').eq('purity_passed', true),
    ]);

    const fbsA = resA.data || [];
    const fbsB = resB.data || [];
    const allFbs = allRes.data || [];

    const comA = computeForFbs(fbsA, allFbs);
    const comB = computeForFbs(fbsB, allFbs);

    setCompareData({
      a: { id: idA, title: mA?.title || 'A', scores: comA.newScores, distributions: comA.newDistributions, keywords: extractKeywords(fbsA) },
      b: { id: idB, title: mB?.title || 'B', scores: comB.newScores, distributions: comB.newDistributions, keywords: extractKeywords(fbsB) },
    });
    setBenchmarks(comA.newBenchmarks);
    setHasData(fbsA.length > 0 || fbsB.length > 0);
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

  if (loading) return (
    <div style={{ padding: '40px 48px', color: 'var(--text-3)', fontFamily: 'var(--font-sans)', fontSize: 13 }}>데이터 로딩 중…</div>
  );

  const isComparing = compareMode && compareData;

  // Derived scores for header (use compare average in compare mode)
  const activeScores = isComparing
    ? Object.fromEntries(DIMENSIONS.map(d => [d.key, ((compareData.a.scores[d.key] || 0) + (compareData.b.scores[d.key] || 0)) / 2]))
    : scores;

  const scoreValues = DIMENSIONS.map(d => activeScores[d.key] || 0);
  const overallAvg = avg(scoreValues);
  const worstDim = DIMENSIONS.reduce((worst, d) =>
    (activeScores[d.key] || 0) < (activeScores[worst.key] || 0) ? d : worst
  );

  const selLabel = selectedIds.size === 0
    ? `전체 ${missions.length}개 평균`
    : selectedIds.size === 1
      ? (missions.find(m => selectedIds.has(m.id))?.title?.slice(0, 20) || '1개 선택')
      : `${selectedIds.size}개 선택${isComparing ? ' · 비교 중' : ''}`;

  return (
    <div className="page-wrap" style={{ padding: '40px 48px', maxWidth: 1060, animation: 'fadeUp 0.5s ease both' }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 12, fontFamily: 'var(--font-sans)', color: 'var(--text-2)', marginBottom: 8, letterSpacing: '0.1em' }}>5-DIMENSION DIAGNOSIS</div>
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 6 }}>전환 5차원 진단</h1>
        <p style={{ color: 'var(--text-2)', fontSize: 14 }}>메시지 전환 실패의 5가지 근본 원인을 정량적으로 분석합니다.</p>

        {missions.length > 0 && (
          <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--font-sans)', flexShrink: 0 }}>의뢰</span>
            {/* 스크롤 영역: 오른쪽 페이드 마스크 */}
            <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                overflowX: 'auto', flexWrap: 'nowrap',
                paddingBottom: 2,
                scrollbarWidth: 'none', msOverflowStyle: 'none',
              }}
                className="chip-scroll-row"
              >
                <MissionChip
                  label={`전체 (${missions.length})`}
                  active={selectedIds.size === 0}
                  onClick={() => { setCompareMode(false); setCompareData(null); setSelectedIds(new Set()); }}
                />
                {missions.map(m => (
                  <MissionChip
                    key={m.id}
                    label={m.title?.length > 16 ? m.title.slice(0, 15) + '…' : (m.title || '무제')}
                    active={selectedIds.has(m.id)}
                    onClick={() => toggleMission(m.id)}
                    title={m.title}
                  />
                ))}
                {selectedIds.size === 2 && (
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
              </div>
              {/* 오른쪽 페이드 힌트 */}
              <div style={{
                position: 'absolute', right: 0, top: 0, bottom: 2,
                width: 32, pointerEvents: 'none',
                background: 'linear-gradient(to right, transparent, var(--bg))',
              }} />
            </div>
            {selectedIds.size > 0 && (
              <span style={{ fontSize: 11, color: 'var(--text-3)', flexShrink: 0 }}>· {selLabel}</span>
            )}
          </div>
        )}
      </div>

      {!hasData ? (
        <Card style={{ padding: '60px', textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>📊</div>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>아직 피드백 데이터가 없습니다</div>
          <div style={{ color: 'var(--text-2)', fontSize: 13 }}>의뢰를 등록하고 패널 피드백이 수집되면 5차원 진단 결과가 표시됩니다.</div>
        </Card>
      ) : (
        <>
          {/* 헤더 요약 카드 */}
          {isComparing ? (
            <Card style={{ marginBottom: 28, padding: '20px 24px', display: 'flex', gap: 16, flexWrap: 'wrap', background: 'linear-gradient(135deg, var(--surface), var(--bg-3))' }}>
              {[{ data: compareData.a, color: COMPARE_A }, { data: compareData.b, color: COMPARE_B }].map(({ data, color }) => {
                const vals = DIMENSIONS.map(d => data.scores[d.key] || 0);
                const avg5 = avg(vals);
                return (
                  <div key={data.id} style={{ display: 'flex', alignItems: 'center', gap: 20, flex: 1, minWidth: 220 }}>
                    <div style={{ textAlign: 'center', flexShrink: 0 }}>
                      <div style={{ fontSize: 9, fontFamily: 'var(--font-sans)', color, marginBottom: 4, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 700 }}>●</div>
                      <div style={{ fontSize: 48, fontWeight: 800, fontFamily: 'var(--font-sans)', lineHeight: 1, color }}>
                        {avg5.toFixed(1)}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>/ 5.0</div>
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
                <div style={{ fontSize: 11, fontFamily: 'var(--font-sans)', color: 'var(--text-3)', marginBottom: 6, letterSpacing: '0.08em', textTransform: 'uppercase' }}>종합 전환 점수</div>
                <div style={{ fontSize: 64, fontWeight: 800, fontFamily: 'var(--font-sans)', lineHeight: 1, color: overallAvg >= 4 ? 'var(--green)' : overallAvg >= 3 ? 'var(--accent)' : 'var(--red)' }}>
                  {overallAvg.toFixed(1)}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 4 }}>/ 5.0</div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>
                  가장 취약한 차원: <span style={{ color: worstDim.color }}>{worstDim.label} ({(scores[worstDim.key] || 0).toFixed(1)})</span>
                </div>
                <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.7, marginBottom: 14 }}>{worstDim.desc}</p>
                <Btn size="sm" variant="outline" onClick={() => setShowGuide(true)}>개선 가이드 보기 →</Btn>
              </div>
            </Card>
          )}

          <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: 'var(--surface)', borderRadius: 'var(--radius)', padding: 4, width: 'fit-content' }}>
            {[['overview', '차원별 점수'], ['benchmark', '업계 벤치마크'], ['keywords', '키워드 분석'], ['timeline', '시계열 추적']].map(([v, l]) => (
              <button key={v} onClick={() => v === 'timeline' ? navigate('/company/timeline') : setActiveTab(v)} style={{
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
                  const sA = compareData.a.scores[d.key] || 0;
                  const sB = compareData.b.scores[d.key] || 0;
                  const verdict = sA > sB ? `▲ ${compareData.a.title?.slice(0, 10) || 'A'} 우세` : sB > sA ? `▲ ${compareData.b.title?.slice(0, 10) || 'B'} 우세` : '— 동점';
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
                        {[{ data: compareData.a, color: COMPARE_A }, { data: compareData.b, color: COMPARE_B }].map(({ data, color }) => {
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
                  {[{ data: compareData.a, color: COMPARE_A }, { data: compareData.b, color: COMPARE_B }].map(({ data, color }) => {
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
                                  color: `rgba(${color === COMPARE_B ? '198,101,7' : '16,54,125'},${opacity})`,
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

          {activeTab === 'benchmark' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 8, lineHeight: 1.7 }}>
                플랫폼 전체 평균값과 비교한 결과입니다.
                {isComparing && <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--text-3)' }}>두 의뢰를 나란히 비교합니다.</span>}
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
                      {[{ data: compareData.a, color: COMPARE_A }, { data: compareData.b, color: COMPARE_B }].map(({ data, color }) => {
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

      {/* 개선 가이드 모달 */}
      {showGuide && (() => {
        const guide = IMPROVEMENT_GUIDES[worstDim.key];
        return (
          <div onClick={() => setShowGuide(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg)', borderRadius: 'var(--radius-lg)', padding: 36, maxWidth: 540, width: '100%', border: '1px solid var(--border)', boxShadow: '0 24px 64px rgba(0,0,0,0.4)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                <div>
                  <div style={{ fontSize: 11, fontFamily: 'var(--font-sans)', color: worstDim.color, marginBottom: 6, letterSpacing: '0.08em', textTransform: 'uppercase' }}>개선 가이드 — {worstDim.label} ({(activeScores[worstDim.key] || 0).toFixed(1)}/5)</div>
                  <div style={{ fontSize: 20, fontWeight: 800 }}>{guide.title}</div>
                </div>
                <button onClick={() => setShowGuide(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', fontSize: 20, lineHeight: 1 }}>✕</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {guide.tips.map((tip, i) => (
                  <div key={i} style={{ display: 'flex', gap: 12, padding: '12px 16px', background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', borderLeft: `3px solid ${worstDim.color}` }}>
                    <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: worstDim.color, fontWeight: 700, flexShrink: 0, marginTop: 2 }}>0{i + 1}</span>
                    <span style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.7 }}>{tip}</span>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 20, fontSize: 12, color: 'var(--text-3)', textAlign: 'center' }}>
                이 가이드는 "{worstDim.label}" 차원 점수를 기반으로 자동 생성됩니다.
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
