import { useState, useEffect } from 'react';
import { Card, Badge, Btn } from '../../components/ui';
import { supabase } from '../../lib/supabase';

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
              <Btn size="sm" variant="outline">개선 가이드 보기 →</Btn>
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
    </div>
  );
}
