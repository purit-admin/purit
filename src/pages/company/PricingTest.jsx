import { useState, useEffect } from 'react';
import { Card, Badge, Btn } from '../../components/ui';
import { supabase } from '../../lib/supabase';

const AXES = [
  { key: 'clarity',     label: '가격 명확성', icon: '◎', color: 'var(--blue)',   desc: '플랜 간 차이가 즉시 이해되는가?' },
  { key: 'value',       label: '지각 가치',   icon: '◆', color: 'var(--accent)', desc: '가격 대비 가치가 납득되는가?' },
  { key: 'barrier',     label: '행동 장벽',   icon: '▲', color: 'var(--red)',    desc: '전환을 막는 의심·불안 요소는?' },
  { key: 'competition', label: '경쟁 포지셔닝',icon: '◈', color: '#C084FC',      desc: '경쟁 대비 가격 포지션이 납득되는가?' },
];

export default function PricingTest() {
  const [step, setStep] = useState('list');
  const [tests, setTests] = useState([]);
  const [selectedTest, setSelectedTest] = useState(null);
  const [axes, setAxes] = useState([]);
  const [responses, setResponses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [companyId, setCompanyId] = useState(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const { data: co } = await supabase.from('companies').select('id').eq('user_id', user.id).single();
    setCompanyId(co?.id);
    if (co) {
      const { data } = await supabase.from('pricing_tests').select('*').eq('company_id', co.id).order('created_at', { ascending: false });
      setTests(data || []);
    }
    setLoading(false);
  }

  async function handleCreate() {
    if (!companyId) return;
    setSubmitting(true);
    const { data: test, error } = await supabase.from('pricing_tests').insert({ company_id: companyId, status: 'active' }).select().single();
    if (!error) {
      const axisRows = AXES.map(a => ({ test_id: test.id, axis_key: a.key, label: a.label, score: 0 }));
      await supabase.from('pricing_axes').insert(axisRows);
      setTests(ts => [test, ...ts]);
      setStep('list');
    }
    setSubmitting(false);
  }

  async function loadResults(test) {
    setSelectedTest(test);
    const [axesRes, respRes] = await Promise.all([
      supabase.from('pricing_axes').select('*').eq('test_id', test.id),
      supabase.from('pricing_responses').select('*').eq('test_id', test.id),
    ]);
    setAxes(axesRes.data || []);
    setResponses(respRes.data || []);
    setStep('result');
  }

  if (loading) return <div style={{ padding: '40px 48px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', fontSize: 13 }}>데이터 로딩 중…</div>;

  return (
    <div style={{ padding: '40px 48px', maxWidth: 900, animation: 'fadeUp 0.5s ease both' }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--accent)', marginBottom: 8, letterSpacing: '0.1em' }}>PRICING TEST</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 6 }}>가격 페이지 테스트</h1>
            <p style={{ color: 'var(--text-2)', fontSize: 14 }}>가격 구조의 명확성·지각 가치·행동 장벽·경쟁 포지셔닝을 4축으로 진단합니다.</p>
          </div>
          {step === 'list' && <Btn onClick={handleCreate} disabled={submitting}>{submitting ? '생성 중…' : '+ 새 테스트'}</Btn>}
          {step === 'result' && <Btn variant="ghost" onClick={() => setStep('list')}>← 목록</Btn>}
        </div>
      </div>

      {step === 'list' && (
        tests.length === 0 ? (
          <Card style={{ padding: '60px', textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>₩</div>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>등록된 가격 테스트가 없습니다</div>
            <div style={{ color: 'var(--text-2)', fontSize: 13, marginBottom: 20 }}>가격 페이지의 전환 장벽을 패널을 통해 진단해보세요.</div>
            <Btn onClick={handleCreate} disabled={submitting}>{submitting ? '생성 중…' : '+ 첫 테스트 시작'}</Btn>
          </Card>
        ) : (
          <div style={{ display: 'grid', gap: 14 }}>
            {tests.map(test => (
              <Card key={test.id} style={{ cursor: 'pointer' }} onClick={() => loadResults(test)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <Badge type={test.status === 'completed' ? 'green' : 'gold'} style={{ marginBottom: 8 }}>{test.status === 'completed' ? '완료' : '진행중'}</Badge>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>가격 페이지 4축 진단</div>
                    <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>{new Date(test.created_at).toLocaleDateString('ko-KR')}</div>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--accent)' }}>결과 보기 →</div>
                </div>
              </Card>
            ))}
          </div>
        )
      )}

      {step === 'result' && selectedTest && (
        <div>
          {axes.length === 0 && responses.length === 0 ? (
            <Card style={{ padding: '40px', textAlign: 'center' }}>
              <div style={{ color: 'var(--text-3)', fontSize: 13 }}>아직 패널 응답이 없습니다. 수집 후 다시 확인하세요.</div>
            </Card>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14, marginBottom: 24 }}>
                {AXES.map(a => {
                  const axisData = axes.find(x => x.axis_key === a.key);
                  const score = axisData ? Number(axisData.score) : 0;
                  return (
                    <Card key={a.key} style={{ padding: '18px 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                        <span style={{ fontSize: 20, color: a.color }}>{a.icon}</span>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 14 }}>{a.label}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{a.desc}</div>
                        </div>
                        <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: 22, color: a.color }}>{score.toFixed(1)}</span>
                      </div>
                      <div style={{ height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ width: `${(score / 5) * 100}%`, height: '100%', background: a.color, borderRadius: 3, transition: 'width 0.8s ease' }} />
                      </div>
                    </Card>
                  );
                })}
              </div>
              {responses.length > 0 && (
                <Card>
                  <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>패널 응답 ({responses.length}명)</div>
                  {responses.map((r, i) => (
                    <div key={r.id} style={{ padding: '14px 0', borderBottom: i < responses.length - 1 ? '1px solid var(--border)' : 'none', display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                      <Badge type={r.would_buy ? 'green' : 'red'}>{r.would_buy ? '구매 의향 있음' : '구매 의향 없음'}</Badge>
                      <div style={{ flex: 1 }}>
                        {r.key_comment && <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 6 }}>"{r.key_comment}"</div>}
                        {r.barriers?.length > 0 && (
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {r.barriers.map((b, j) => <Badge key={j} type="gray">{b}</Badge>)}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </Card>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
