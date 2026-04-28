import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Card, Badge, Btn } from '../../components/ui';
import { supabase } from '../../lib/supabase';

const AXES = [
  { key: 'clarity',     label: '가격 명확성',   icon: '◎', color: 'var(--blue)',   desc: '플랜 간 차이가 즉시 이해되는가?' },
  { key: 'value',       label: '지각 가치',     icon: '◆', color: 'var(--accent)', desc: '가격 대비 가치가 납득되는가?' },
  { key: 'barrier',     label: '행동 장벽',     icon: '▲', color: 'var(--red)',    desc: '전환을 막는 의심·불안 요소는?' },
  { key: 'competition', label: '경쟁 포지셔닝', icon: '◈', color: '#C084FC',      desc: '경쟁 대비 가격 포지션이 납득되는가?' },
];

const PANEL_COUNTS = [10, 15, 20, 30];
const PRICE_PER = { 10: 90, 15: 130, 20: 170, 30: 250 };

export default function PricingTest() {
  const location = useLocation();
  const initTemplateId = location.state?.templateId || null;

  const [step, setStep] = useState('list');
  const [pricingDesc, setPricingDesc] = useState('');
  const [panelSize, setPanelSize] = useState(10);
  const [tests, setTests] = useState([]);
  const [selectedTest, setSelectedTest] = useState(null);
  const [axes, setAxes] = useState([]);
  const [responses, setResponses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [companyId, setCompanyId] = useState(null);

  // 질문 템플릿
  const [templates, setTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState(initTemplateId);
  const [selectedTemplate, setSelectedTemplate] = useState(null);

  useEffect(() => {
    load();
    if (initTemplateId) setStep('create');
  }, []);

  useEffect(() => {
    if (selectedTemplateId) {
      setSelectedTemplate(templates.find(x => x.id === selectedTemplateId) || null);
    } else {
      setSelectedTemplate(null);
    }
  }, [selectedTemplateId, templates]);

  async function load() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const { data: co } = await supabase.from('companies').select('id').eq('user_id', user.id).single();
    setCompanyId(co?.id);

    if (co) {
      const [{ data: testsData }, { data: tmplData }] = await Promise.all([
        supabase.from('pricing_tests').select('*').eq('company_id', co.id).order('created_at', { ascending: false }),
        supabase.from('question_templates')
          .select('*, template_questions(id, question_text, question_order)')
          .eq('category', '가격')
          .eq('is_default', true),
      ]);
      setTests(testsData || []);
      const sorted = (tmplData || []).map(t => ({
        ...t,
        template_questions: [...(t.template_questions || [])].sort((a, b) => a.question_order - b.question_order),
      }));
      setTemplates(sorted);
      if (initTemplateId) setSelectedTemplate(sorted.find(t => t.id === initTemplateId) || null);
    }
    setLoading(false);
  }

  async function handleCreate() {
    if (!companyId) return;
    setSubmitting(true);
    try {
      // 1. missions INSERT
      const missionId = crypto.randomUUID();
      const { error: mErr } = await supabase.from('missions').insert({
        id: missionId,
        company_id: companyId,
        title: '가격 페이지 검증',
        type: 'pricing',
        description: pricingDesc.trim() || '가격 페이지 4축 진단',
        panel_count: panelSize,
        reward_amount: (PRICE_PER[panelSize] || 90) * 1000,
        status: 'active',
        assets: selectedTemplate ? [selectedTemplate.name] : [],
      });
      if (mErr) throw mErr;

      // 2. pricing_tests INSERT
      const { data: test, error } = await supabase.from('pricing_tests').insert({
        company_id: companyId,
        status: 'active',
        mission_id: missionId,
        template_id: selectedTemplateId || null,
      }).select().single();
      if (error) throw error;

      // 3. pricing_axes INSERT
      const axisRows = AXES.map(a => ({ test_id: test.id, axis_key: a.key, label: a.label, score: 0 }));
      await supabase.from('pricing_axes').insert(axisRows);

      setTests(ts => [test, ...ts]);
      setStep('list');
      setPricingDesc('');
      setSelectedTemplateId(initTemplateId);
    } catch (err) {
      console.error('[PricingTest] 등록 실패:', err.message);
    } finally {
      setSubmitting(false);
    }
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

  if (loading) return <div style={{ padding: '40px 48px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', fontSize: 13 }}>로딩 중…</div>;

  const buyCount = responses.filter(r => r.would_buy).length;
  const buyRate = responses.length ? Math.round((buyCount / responses.length) * 100) : 0;
  const avgFairness = responses.filter(r => r.price_fairness).reduce((s, r) => s + r.price_fairness, 0) / (responses.filter(r => r.price_fairness).length || 1);
  const avgValue = responses.filter(r => r.value_perception).reduce((s, r) => s + r.value_perception, 0) / (responses.filter(r => r.value_perception).length || 1);

  return (
    <div style={{ padding: '40px 48px', maxWidth: 900, animation: 'fadeUp 0.5s ease both' }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--accent)', marginBottom: 8, letterSpacing: '0.1em' }}>PRICING TEST</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 6 }}>가격 페이지 검증</h1>
            <p style={{ color: 'var(--text-2)', fontSize: 14 }}>가격 구조의 명확성·지각 가치·행동 장벽·경쟁 포지셔닝을 4축으로 진단합니다.</p>
          </div>
          {step === 'list' && <Btn onClick={() => setStep('create')}>+ 새 테스트</Btn>}
          {(step === 'create' || step === 'result') && <Btn variant="ghost" onClick={() => { setStep('list'); setSelectedTest(null); }}>← 목록</Btn>}
        </div>
      </div>

      {/* ── 생성 폼 ── */}
      {step === 'create' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <Card>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>1. 가격 페이지 설명</div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 10 }}>
              패널에게 보여줄 가격 구성, 플랜 내용, 검증 목적을 입력하세요.
            </div>
            <textarea
              value={pricingDesc}
              onChange={e => setPricingDesc(e.target.value)}
              rows={6}
              placeholder={`예시:\n- 스타터 플랜: ₩9,900/월 (기능 제한)\n- 프로 플랜: ₩29,900/월 (전체 기능)\n- 엔터프라이즈: 문의\n\n검증 목표: 프로 플랜의 가격 저항 요인 파악`}
              style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit', fontSize: 13 }}
            />
          </Card>

          <Card>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>2. 패널 설정 & 질문 템플릿</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
              {PANEL_COUNTS.map(n => (
                <button key={n} onClick={() => setPanelSize(n)} style={{
                  flex: 1, padding: '10px 0', borderRadius: 'var(--radius)',
                  background: panelSize === n ? 'var(--accent)' : 'var(--surface-2)',
                  color: panelSize === n ? '#FFF' : 'var(--text-2)',
                  border: `1px solid ${panelSize === n ? 'var(--accent)' : 'var(--border)'}`,
                  fontWeight: 600, fontSize: 14, cursor: 'pointer', transition: 'all 0.15s',
                }}>{n}명</button>
              ))}
            </div>
            <div style={{ background: 'var(--accent-dim)', borderRadius: 'var(--radius)', padding: '12px 16px', marginBottom: 20, display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-2)', fontSize: 13 }}>예상 비용</span>
              <span style={{ fontWeight: 800, fontSize: 18, color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>
                ₩ {((PRICE_PER[panelSize] || 90) * 1000).toLocaleString()}
              </span>
            </div>

            {templates.length > 0 && (
              <div>
                <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>질문 템플릿 (선택)</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div
                    onClick={() => setSelectedTemplateId(null)}
                    style={{ padding: '10px 14px', borderRadius: 'var(--radius)', border: `1px solid ${!selectedTemplateId ? 'var(--accent)' : 'var(--border)'}`, background: !selectedTemplateId ? 'var(--accent-dim)' : 'var(--surface)', cursor: 'pointer', fontSize: 13, color: 'var(--text-2)', transition: 'all 0.15s' }}
                  >기본 가격 평가 질문만 사용</div>
                  {templates.map(t => (
                    <div key={t.id} onClick={() => setSelectedTemplateId(t.id)} style={{ padding: '10px 14px', borderRadius: 'var(--radius)', border: `1px solid ${selectedTemplateId === t.id ? 'var(--accent)' : 'var(--border)'}`, background: selectedTemplateId === t.id ? 'var(--accent-dim)' : 'var(--surface)', cursor: 'pointer', transition: 'all 0.15s' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <span style={{ fontWeight: 600, fontSize: 13 }}>{t.icon} {t.name}</span>
                        <span style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>{t.template_questions?.length}개 문항</span>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{t.description}</div>
                    </div>
                  ))}
                </div>
                {selectedTemplate && (
                  <div style={{ marginTop: 12, padding: '12px 14px', background: 'var(--bg-3)', borderRadius: 'var(--radius)' }}>
                    <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: 'var(--accent)' }}>포함될 추가 질문</div>
                    {selectedTemplate.template_questions.map((q, i) => (
                      <div key={q.id} style={{ fontSize: 12, color: 'var(--text-2)', padding: '4px 0', borderBottom: '1px solid var(--border)', display: 'flex', gap: 8 }}>
                        <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)', flexShrink: 0 }}>Q{i + 1}</span>
                        {q.question_text}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </Card>

          <Btn onClick={handleCreate} disabled={submitting}>
            {submitting ? '등록 중…' : '가격 검증 의뢰 시작 →'}
          </Btn>
        </div>
      )}

      {/* ── 목록 ── */}
      {step === 'list' && (
        tests.length === 0 ? (
          <Card style={{ padding: '60px', textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>₩</div>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>등록된 테스트가 없습니다</div>
            <div style={{ color: 'var(--text-2)', fontSize: 13, marginBottom: 20 }}>가격 페이지의 전환 장벽을 패널로 진단해보세요.</div>
            <Btn onClick={() => setStep('create')}>+ 첫 테스트 시작</Btn>
          </Card>
        ) : (
          <div style={{ display: 'grid', gap: 14 }}>
            {tests.map(test => (
              <Card key={test.id} style={{ cursor: 'pointer' }} onClick={() => loadResults(test)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <Badge type={test.status === 'completed' ? 'green' : 'gold'} style={{ marginBottom: 8 }}>
                      {test.status === 'completed' ? '완료' : '진행중'}
                    </Badge>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>가격 페이지 4축 진단</div>
                    <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>
                      {new Date(test.created_at).toLocaleDateString('ko-KR')}
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--accent)' }}>결과 보기 →</div>
                </div>
              </Card>
            ))}
          </div>
        )
      )}

      {/* ── 결과 ── */}
      {step === 'result' && selectedTest && (
        <div style={{ display: 'grid', gap: 16 }}>
          {axes.length === 0 && responses.length === 0 ? (
            <Card style={{ padding: '40px', textAlign: 'center' }}>
              <div style={{ color: 'var(--text-3)', fontSize: 13 }}>아직 패널 응답이 없습니다. 수집 후 다시 확인하세요.</div>
            </Card>
          ) : (
            <>
              {/* 핵심 지표 */}
              {responses.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                  {[
                    { label: '구매 의향', value: `${buyRate}%`, color: buyRate >= 60 ? 'var(--green)' : buyRate >= 40 ? 'var(--accent)' : 'var(--red)' },
                    { label: '가격 적절성', value: responses.some(r => r.price_fairness) ? `${avgFairness.toFixed(1)}/5` : '—', color: 'var(--blue)' },
                    { label: '가치 인식', value: responses.some(r => r.value_perception) ? `${avgValue.toFixed(1)}/5` : '—', color: 'var(--accent)' },
                  ].map(s => (
                    <div key={s.label} style={{ padding: '16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', textAlign: 'center' }}>
                      <div style={{ fontSize: 24, fontWeight: 800, color: s.color, fontFamily: 'var(--font-mono)' }}>{s.value}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 6 }}>{s.label}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* 4축 점수 */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
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

              {/* 패널 응답 목록 */}
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
