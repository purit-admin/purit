import { useState, useEffect } from 'react';
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
  { key: 'clarity_score',         label: '명확성',   sublabel: 'Clarity',        icon: '◎', color: 'var(--blue)',   desc: '메시지를 처음 본 사람이 3초 안에 무엇을 파는지 이해하는가?', benchmark: 3.2 },
  { key: 'relevance_score',       label: '관련성',   sublabel: 'Relevance',      icon: '◆', color: 'var(--green)',  desc: '타겟 고객의 현실적인 고통과 욕구에 메시지가 정렬되어 있는가?', benchmark: 2.8 },
  { key: 'value_score',           label: '가치',     sublabel: 'Value',          icon: '▲', color: 'var(--accent)', desc: '제품이 제공하는 가치가 가격 대비 충분히 설득력 있는가?', benchmark: 3.5 },
  { key: 'differentiation_score', label: '차별화',   sublabel: 'Differentiation',icon: '◈', color: '#C084FC',      desc: '경쟁사 대비 왜 이 제품을 선택해야 하는지 명확히 전달되는가?', benchmark: 2.4 },
  { key: 'trust_score',           label: '신뢰',     sublabel: 'Trust',          icon: '●', color: 'var(--green)',  desc: '처음 방문자가 브랜드와 제품을 신뢰할 수 있는 근거가 충분한가?', benchmark: 3.0 },
];

const avg = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

export default function Diagnosis() {
  const [activeTab, setActiveTab] = useState('overview');
  const [scores, setScores] = useState({});
  const [comments, setComments] = useState({});
  const [benchmarks, setBenchmarks] = useState({});
  const [missions, setMissions] = useState([]);
  const [selectedMission, setSelectedMission] = useState('all');
  const [loading, setLoading] = useState(true);
  const [hasData, setHasData] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => { load(); }, []);
  useEffect(() => { if (missions.length) loadFeedbacks(selectedMission); }, [selectedMission]);

  async function load() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data: co } = await supabase.from('companies').select('id').eq('user_id', user.id).single();
    if (!co) { setLoading(false); return; }

    const { data: ms } = await supabase.from('missions').select('id, title').eq('company_id', co.id);
    setMissions(ms || []);

    await loadFeedbacks('all', ms?.map(m => m.id) || []);
    setLoading(false);
  }

  async function loadFeedbacks(missionFilter, missionIds) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: co } = await supabase.from('companies').select('id').eq('user_id', user.id).single();
    if (!co) return;

    const ids = missionIds || missions.map(m => m.id);
    if (!ids.length) return;

    const filter = missionFilter === 'all' ? ids : [missionFilter];

    const [myRes, allRes] = await Promise.all([
      supabase.from('feedbacks').select('clarity_score,relevance_score,value_score,differentiation_score,trust_score,strengths,weaknesses').in('mission_id', filter).eq('purity_passed', true),
      supabase.from('feedbacks').select('clarity_score,relevance_score,value_score,differentiation_score,trust_score').eq('purity_passed', true),
    ]);

    const myFeedbacks = myRes.data || [];
    const allFeedbacks = allRes.data || [];
    setHasData(myFeedbacks.length > 0);

    const newScores = {};
    const newComments = {};
    const newBenchmarks = {};

    DIMENSIONS.forEach(d => {
      const myVals = myFeedbacks.map(f => f[d.key]).filter(Boolean);
      newScores[d.key] = myVals.length ? avg(myVals) : 0;

      const strengths = myFeedbacks.map(f => f.strengths).filter(Boolean).slice(0, 2);
      const weaknesses = myFeedbacks.map(f => f.weaknesses).filter(Boolean).slice(0, 2);
      newComments[d.key] = [...strengths, ...weaknesses].slice(0, 2);

      const allVals = allFeedbacks.map(f => f[d.key]).filter(Boolean);
      newBenchmarks[d.key] = allVals.length ? avg(allVals) : d.benchmark;
    });

    setScores(newScores);
    setComments(newComments);
    setBenchmarks(newBenchmarks);
  }

  if (loading) return (
    <div style={{ padding: '40px 48px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', fontSize: 13 }}>데이터 로딩 중…</div>
  );

  const scoreValues = DIMENSIONS.map(d => scores[d.key] || 0);
  const overallAvg = avg(scoreValues);
  const worstDim = DIMENSIONS.reduce((worst, d) =>
    (scores[d.key] || 0) < (scores[worst.key] || 0) ? d : worst
  );

  return (
    <div style={{ padding: '40px 48px', maxWidth: 1060, animation: 'fadeUp 0.5s ease both' }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--accent)', marginBottom: 8, letterSpacing: '0.1em' }}>5-DIMENSION DIAGNOSIS</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 6 }}>전환 5차원 진단</h1>
            <p style={{ color: 'var(--text-2)', fontSize: 14 }}>메시지 전환 실패의 5가지 근본 원인을 정량적으로 분석합니다.</p>
          </div>
          {missions.length > 1 && (
            <select value={selectedMission} onChange={e => setSelectedMission(e.target.value)} style={{ fontSize: 13 }}>
              <option value="all">전체 미션</option>
              {missions.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
            </select>
          )}
        </div>
      </div>

      {!hasData ? (
        <Card style={{ padding: '60px', textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>📊</div>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>아직 피드백 데이터가 없습니다</div>
          <div style={{ color: 'var(--text-2)', fontSize: 13 }}>미션을 등록하고 패널 피드백이 수집되면 5차원 진단 결과가 표시됩니다.</div>
        </Card>
      ) : (
        <>
          <Card style={{ marginBottom: 28, display: 'flex', alignItems: 'center', gap: 40, background: 'linear-gradient(135deg, var(--surface), var(--bg-3))' }}>
            <div style={{ textAlign: 'center', flexShrink: 0 }}>
              <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', marginBottom: 6, letterSpacing: '0.08em', textTransform: 'uppercase' }}>종합 전환 점수</div>
              <div style={{ fontSize: 64, fontWeight: 800, fontFamily: 'var(--font-mono)', lineHeight: 1, color: overallAvg >= 4 ? 'var(--green)' : overallAvg >= 3 ? 'var(--accent)' : 'var(--red)' }}>
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

          <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: 'var(--surface)', borderRadius: 'var(--radius)', padding: 4, width: 'fit-content' }}>
            {[['overview', '차원별 점수'], ['comments', '패널 코멘트'], ['benchmark', '업계 벤치마크']].map(([v, l]) => (
              <button key={v} onClick={() => setActiveTab(v)} style={{
                padding: '7px 18px', borderRadius: 4, fontSize: 13, fontWeight: 500,
                background: activeTab === v ? 'var(--bg)' : 'transparent',
                color: activeTab === v ? 'var(--text)' : 'var(--text-3)',
                border: 'none', cursor: 'pointer', transition: 'all 0.15s',
              }}>{l}</button>
            ))}
          </div>

          {activeTab === 'overview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {DIMENSIONS.map(d => {
                const score = scores[d.key] || 0;
                return (
                  <Card key={d.key} style={{ padding: '20px 24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                      <div style={{ width: 48, height: 48, borderRadius: '50%', background: `${d.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, color: d.color, flexShrink: 0 }}>{d.icon}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                          <div>
                            <span style={{ fontWeight: 700, fontSize: 15 }}>{d.label}</span>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-3)', marginLeft: 8 }}>{d.sublabel}</span>
                          </div>
                          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: 22, color: d.color }}>{score.toFixed(1)}</span>
                        </div>
                        <div style={{ height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ width: `${(score / 5) * 100}%`, height: '100%', background: d.color, borderRadius: 3, transition: 'width 0.8s ease' }} />
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 6 }}>{d.desc}</div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}

          {activeTab === 'comments' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {DIMENSIONS.map(d => (
                <div key={d.key}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <span style={{ fontSize: 16, color: d.color }}>{d.icon}</span>
                    <span style={{ fontWeight: 700 }}>{d.label}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: d.color }}>{(scores[d.key] || 0).toFixed(1)}/5</span>
                  </div>
                  {(comments[d.key] || []).length === 0 ? (
                    <div style={{ fontSize: 13, color: 'var(--text-3)', padding: '12px 0' }}>코멘트 없음</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {(comments[d.key] || []).map((c, i) => (
                        <div key={i} style={{ padding: '14px 16px', background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', fontSize: 13, color: 'var(--text-2)', lineHeight: 1.7, borderLeft: `3px solid ${d.color}` }}>
                          "{c}"
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {activeTab === 'benchmark' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 8, lineHeight: 1.7 }}>플랫폼 전체 평균값과 비교한 결과입니다.</p>
              {DIMENSIONS.map(d => {
                const myScore = scores[d.key] || 0;
                const bench = benchmarks[d.key] || d.benchmark;
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
                        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 14 }}>{myScore.toFixed(1)}</span>
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
                  <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: worstDim.color, marginBottom: 6, letterSpacing: '0.08em', textTransform: 'uppercase' }}>개선 가이드 — {worstDim.label} ({(scores[worstDim.key] || 0).toFixed(1)}/5)</div>
                  <div style={{ fontSize: 20, fontWeight: 800 }}>{guide.title}</div>
                </div>
                <button onClick={() => setShowGuide(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', fontSize: 20, lineHeight: 1 }}>✕</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {guide.tips.map((tip, i) => (
                  <div key={i} style={{ display: 'flex', gap: 12, padding: '12px 16px', background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', borderLeft: `3px solid ${worstDim.color}` }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: worstDim.color, fontWeight: 700, flexShrink: 0, marginTop: 2 }}>0{i + 1}</span>
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
