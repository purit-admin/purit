import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Card, Badge, Btn } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { QUESTION_TEMPLATES, TYPE_LABEL, TYPE_COLOR } from '../../lib/templates';

const METRIC_META = {
  hook:      { label: '훅 강도',    color: 'var(--accent)', desc: '첫 문장이 계속 읽게 만드는가?' },
  clarity:   { label: '제안 명확성', color: 'var(--blue)',   desc: '무엇을 원하는지 즉시 이해되는가?' },
  curiosity: { label: '호기심 유발', color: '#C084FC',       desc: '답장하고 싶은 욕구를 만드는가?' },
  relevance: { label: '관련성',     color: 'var(--green)',  desc: '나와 관련있는 내용이라고 느끼는가?' },
};

const PANEL_COUNTS = [10, 15, 20, 30];
const PRICE_PER = { 10: 90, 15: 130, 20: 170, 30: 250 };
const STEPS = ['이메일 원문', '제품 설명', '질문 설정'];

export default function ColdEmailTest() {
  const location = useLocation();
  const navigate = useNavigate();
  const initTemplateId = location.state?.templateId || null;
  const submittingRef = useRef(false);

  const [view, setView] = useState('list');
  const [createStep, setCreateStep] = useState(0);
  const [missionUuid, setMissionUuid] = useState(() => crypto.randomUUID());

  // Step 0
  const [emailText, setEmailText] = useState('');
  // Step 1
  const [productDescription, setProductDescription] = useState('');
  // Step 2
  const [panelSize, setPanelSize] = useState(10);
  const [selectedQuestions, setSelectedQuestions] = useState([]);
  const [expandedTmpl, setExpandedTmpl] = useState({});
  const [customQTexts, setCustomQTexts] = useState([]);

  const [tests, setTests] = useState([]);
  const [selectedTest, setSelectedTest] = useState(null);
  const [metrics, setMetrics] = useState([]);
  const [responses, setResponses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [companyId, setCompanyId] = useState(null);

  const initTemplateName = location.state?.templateName || null;

  useEffect(() => {
    load();
    if (initTemplateId) {
      setView('create');
      setCreateStep(2);
      if (initTemplateName) {
        const target = QUESTION_TEMPLATES.email.find(t => t.name === initTemplateName);
        if (target) {
          setSelectedQuestions(target.questions.slice(0, 5));
          setExpandedTmpl({ [target.id]: true });
        }
      }
    }
  }, []);

  async function load() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const { data: co } = await supabase.from('companies').select('id').eq('user_id', user.id).single();
    setCompanyId(co?.id);
    if (co) {
      const { data: testsData } = await supabase
        .from('cold_email_tests').select('*').eq('company_id', co.id).order('created_at', { ascending: false });
      setTests(testsData || []);
    }
    setLoading(false);
  }

  const validCustomCount = customQTexts.filter(t => t.trim()).length;
  const totalSelected = selectedQuestions.length + validCustomCount;

  const toggleQuestion = (q) => {
    const isSelected = selectedQuestions.some(s => s.id === q.id);
    if (isSelected) {
      setSelectedQuestions(prev => prev.filter(s => s.id !== q.id));
    } else if (selectedQuestions.length + customQTexts.filter(t => t.trim()).length < 5) {
      setSelectedQuestions(prev => [...prev, q]);
    }
  };

  const addCustomQ = () => setCustomQTexts(prev => [...prev, '']);
  const updateCustomQ = (i, text) => setCustomQTexts(prev => prev.map((t, j) => j === i ? text : t));
  const removeCustomQ = (i) => setCustomQTexts(prev => prev.filter((_, j) => j !== i));

  async function handleSubmit() {
    if (!emailText.trim() || !companyId) return;
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    try {
      const { error: mErr } = await supabase.from('missions').insert({
        id: missionUuid,
        company_id: companyId,
        title: '이메일 검증',
        type: 'email',
        description: JSON.stringify({
          content: emailText.trim(),
          productDescription: productDescription.trim(),
          selectedQuestions: [
            ...selectedQuestions,
            ...customQTexts.filter(t => t.trim()).map((text, i) => ({
              id: `custom-${i}`,
              text: text.trim(),
              type: 'text',
              options: [],
            })),
          ],
        }),
        panel_count: panelSize,
        reward_amount: (PRICE_PER[panelSize] || 90) * 1000,
        status: 'active',
        assets: [],
      });
      if (mErr) throw mErr;

      const { error: tErr } = await supabase.from('cold_email_tests').insert({
        company_id: companyId,
        email_text: emailText.trim(),
        status: 'active',
        mission_id: missionUuid,
        template_id: selectedTemplateId || null,
      });
      if (tErr) console.warn('[ColdEmailTest] 서브테이블 등록 실패:', tErr.message);

      setMissionUuid(crypto.randomUUID());
      navigate('/company');
    } catch (err) {
      console.error('[ColdEmailTest] 등록 실패:', err.message);
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  async function loadResults(test) {
    setSelectedTest(test);
    const [mRes, rRes] = await Promise.all([
      supabase.from('email_metrics').select('*').eq('test_id', test.id),
      supabase.from('email_responses').select('*').eq('test_id', test.id),
    ]);
    setMetrics(mRes.data || []);
    setResponses(rRes.data || []);
    setView('result');
  }

  if (loading) return <div style={{ padding: '40px 48px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', fontSize: 13 }}>로딩 중…</div>;

  const replyCount = responses.filter(r => r.would_reply).length;
  const replyRate = responses.length ? Math.round((replyCount / responses.length) * 100) : 0;
  const openVals = responses.filter(r => r.open_intent);
  const curiosityVals = responses.filter(r => r.curiosity_score);
  const avgOpenIntent = openVals.length ? openVals.reduce((s, r) => s + r.open_intent, 0) / openVals.length : 0;
  const avgCuriosity = curiosityVals.length ? curiosityVals.reduce((s, r) => s + r.curiosity_score, 0) / curiosityVals.length : 0;

  return (
    <div style={{ padding: '40px 48px', maxWidth: 900, animation: 'fadeUp 0.5s ease both' }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--accent)', marginBottom: 8, letterSpacing: '0.1em' }}>COLD EMAIL TEST</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 6 }}>이메일 검증</h1>
            <p style={{ color: 'var(--text-2)', fontSize: 14 }}>대량 발송 전 타겟 패널에게 먼저 검증받아 개봉률과 답장율을 높이세요.</p>
          </div>
          {view !== 'list' && <Btn variant="ghost" onClick={() => { setView('list'); setSelectedTest(null); }}>← 목록</Btn>}
        </div>
      </div>

      {/* ── 생성 폼 (스텝 기반) ── */}
      {view === 'create' && (
        <div>
          {/* 스텝 인디케이터 */}
          <div style={{ display: 'flex', gap: 0, marginBottom: 32 }}>
            {STEPS.map((s, i) => (
              <div key={s} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: i === 0 ? 'flex-start' : i === STEPS.length - 1 ? 'flex-end' : 'center', gap: 6 }}>
                <div style={{
                  width: 26, height: 26, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: i < createStep ? 'var(--green)' : i === createStep ? 'var(--accent)' : 'var(--surface)',
                  color: i <= createStep ? '#fff' : 'var(--text-3)',
                  fontSize: 11, fontWeight: 700, border: '1px solid',
                  borderColor: i < createStep ? 'var(--green)' : i === createStep ? 'var(--accent)' : 'var(--border)',
                  transition: 'all 0.2s',
                }}>
                  {i < createStep ? '✓' : i + 1}
                </div>
                <span style={{ fontSize: 11, color: i === createStep ? 'var(--text)' : 'var(--text-3)', fontWeight: i === createStep ? 600 : 400, whiteSpace: 'nowrap' }}>{s}</span>
              </div>
            ))}
          </div>

          <Card>
            {/* Step 0: 이메일 원문 설명 */}
            {createStep === 0 && (
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>이메일 원문 설명</div>
                <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 12 }}>
                  제목줄부터 서명까지 전체 이메일 내용을 입력하세요. 패널이 실제로 받는 것처럼 검토합니다.
                </div>
                <textarea
                  value={emailText}
                  onChange={e => setEmailText(e.target.value)}
                  rows={12}
                  placeholder={'제목: [이메일 제목줄]\n\n안녕하세요, [이름]님.\n\n[이메일 본문 내용 전체]\n\n[CTA 문구]\n\n감사합니다.\n[발신자 이름]'}
                  style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit', fontSize: 13, lineHeight: 1.7 }}
                />
              </div>
            )}

            {/* Step 1: 제품/타겟 설명 */}
            {createStep === 1 && (
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>제품 / 타겟 설명</div>
                <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 16 }}>패널에게 표시됩니다. 어떤 제품인지, 어떤 타겟을 대상으로 하는지 간단히 적어주세요.</p>
                <textarea
                  value={productDescription}
                  onChange={e => setProductDescription(e.target.value)}
                  rows={4}
                  placeholder={"예) 제품명: B2B 영업 자동화 툴 / 타겟: 스타트업 영업 담당자, SDR"}
                  style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit', fontSize: 13 }}
                />
              </div>
            )}

            {/* Step 2: 패널 수 & 질문 설정 */}
            {createStep === 2 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>패널 수</div>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                    {PANEL_COUNTS.map(n => (
                      <button key={n} onClick={() => setPanelSize(n)} style={{
                        flex: 1, padding: '10px 0', borderRadius: 'var(--radius)',
                        background: panelSize === n ? 'var(--accent)' : 'var(--surface)',
                        color: panelSize === n ? '#FFF' : 'var(--text-2)',
                        border: `1px solid ${panelSize === n ? 'var(--accent)' : 'var(--border)'}`,
                        fontWeight: 600, fontSize: 14, cursor: 'pointer', transition: 'all 0.15s',
                      }}>{n}명</button>
                    ))}
                  </div>
                  <div style={{ background: 'var(--accent-dim)', borderRadius: 'var(--radius)', padding: '12px 16px', display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-2)', fontSize: 13 }}>예상 비용</span>
                    <span style={{ fontWeight: 800, fontSize: 18, color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>
                      ₩ {((PRICE_PER[panelSize] || 90) * 1000).toLocaleString()}
                    </span>
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <div style={{ fontSize: 15, fontWeight: 700 }}>질문 설정</div>
                    <div style={{
                      fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 700,
                      padding: '3px 10px', borderRadius: 20,
                      background: totalSelected >= 5 ? 'var(--accent)' : 'var(--surface)',
                      color: totalSelected >= 5 ? '#fff' : 'var(--text-2)',
                      border: '1px solid var(--border)',
                    }}>{totalSelected}/5 선택됨</div>
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 12 }}>
                    아래 15개 질문 중 최대 5개를 골라 패널에게 발송하세요. 그룹 헤더를 클릭하면 질문 목록이 펼쳐집니다.
                  </p>

                  {QUESTION_TEMPLATES.email.map(tmpl => {
                    const isOpen = expandedTmpl[tmpl.id];
                    const groupCount = selectedQuestions.filter(q => tmpl.questions.some(tq => tq.id === q.id)).length;
                    return (
                      <div key={tmpl.id} style={{ marginBottom: 8, border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
                        <div
                          onClick={() => setExpandedTmpl(prev => ({ ...prev, [tmpl.id]: !isOpen }))}
                          style={{
                            display: 'flex', alignItems: 'center', padding: '11px 14px',
                            background: groupCount > 0 ? 'var(--accent-dim)' : 'var(--surface)',
                            cursor: 'pointer', userSelect: 'none', gap: 10,
                          }}
                        >
                          <span style={{ fontSize: 15 }}>{tmpl.icon}</span>
                          <span style={{ flex: 1, fontWeight: 600, fontSize: 13 }}>{tmpl.name}</span>
                          {groupCount > 0 && (
                            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)' }}>{groupCount}개 선택</span>
                          )}
                          <span style={{ color: 'var(--text-3)', fontSize: 12, transition: 'transform 0.2s', transform: isOpen ? 'rotate(90deg)' : 'none', display: 'inline-block' }}>▶</span>
                        </div>
                        {isOpen && (
                          <div style={{ borderTop: '1px solid var(--border)' }}>
                            {tmpl.questions.map((q, qi) => {
                              const isChecked = selectedQuestions.some(s => s.id === q.id);
                              const disabled = !isChecked && totalSelected >= 5;
                              return (
                                <div
                                  key={q.id}
                                  onClick={() => !disabled && toggleQuestion(q)}
                                  style={{
                                    display: 'flex', gap: 10, alignItems: 'flex-start',
                                    padding: '10px 14px',
                                    background: isChecked ? 'rgba(232,213,163,0.07)' : 'var(--bg)',
                                    cursor: disabled ? 'not-allowed' : 'pointer',
                                    opacity: disabled ? 0.4 : 1,
                                    borderBottom: qi < tmpl.questions.length - 1 ? '1px solid var(--border)' : 'none',
                                    transition: 'background 0.1s',
                                  }}
                                >
                                  <div style={{
                                    width: 17, height: 17, borderRadius: 4, flexShrink: 0, marginTop: 2,
                                    border: `2px solid ${isChecked ? 'var(--accent)' : 'var(--border)'}`,
                                    background: isChecked ? 'var(--accent)' : 'transparent',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    transition: 'all 0.12s',
                                  }}>
                                    {isChecked && <span style={{ color: '#fff', fontSize: 10, fontWeight: 800, lineHeight: 1 }}>✓</span>}
                                  </div>
                                  <div style={{ flex: 1 }}>
                                    <span style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5 }}>{q.text}</span>
                                    <div style={{ marginTop: 4, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                                      <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, fontWeight: 600, background: TYPE_COLOR[q.type] + '22', color: TYPE_COLOR[q.type] }}>
                                        {TYPE_LABEL[q.type]}
                                      </span>
                                      {q.type === 'radio' && q.options.length > 0 && (
                                        <span style={{ fontSize: 11, color: 'var(--text-3)' }}>[{q.options.join(' / ')}]</span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  <div style={{ marginTop: 14 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)', marginBottom: 8 }}>커스텀 질문 추가 (서술형)</div>
                    {customQTexts.map((q, i) => (
                      <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 8 }}>
                        <textarea
                          value={q}
                          onChange={e => updateCustomQ(i, e.target.value)}
                          rows={2}
                          placeholder={`커스텀 질문 ${i + 1}`}
                          style={{ flex: 1, resize: 'vertical', fontFamily: 'inherit', fontSize: 13 }}
                        />
                        <button onClick={() => removeCustomQ(i)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', fontSize: 18, padding: '4px', flexShrink: 0, marginTop: 4 }}>×</button>
                      </div>
                    ))}
                    {customQTexts.length < 3 && totalSelected < 5 && (
                      <button onClick={addCustomQ}
                        style={{ background: 'none', border: '1px dashed var(--border)', borderRadius: 'var(--radius)', padding: '8px 14px', fontSize: 13, color: 'var(--text-3)', cursor: 'pointer', width: '100%' }}>
                        + 커스텀 질문 추가
                      </button>
                    )}
                    {totalSelected >= 5 && (
                      <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 6, textAlign: 'center' }}>최대 5개 선택 완료</div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </Card>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20 }}>
            <Btn variant="secondary" onClick={() => createStep > 0 ? setCreateStep(s => s - 1) : setView('list')}>
              {createStep === 0 ? '취소' : '이전'}
            </Btn>
            {createStep < STEPS.length - 1 ? (
              <Btn onClick={() => setCreateStep(s => s + 1)} disabled={createStep === 0 && !emailText.trim()}>
                다음 →
              </Btn>
            ) : (
              <Btn onClick={handleSubmit} disabled={submitting || !emailText.trim()}>
                {submitting ? '등록 중…' : '의뢰 제출 →'}
              </Btn>
            )}
          </div>
        </div>
      )}

      {/* ── 목록 ── */}
      {view === 'list' && (
        tests.length === 0 ? (
          <Card style={{ padding: '60px', textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>✉</div>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>등록된 이메일 테스트가 없습니다</div>
            <div style={{ color: 'var(--text-2)', fontSize: 13, marginBottom: 20 }}>발송 전 패널 검증으로 개봉률과 답장율을 높여보세요.</div>
            <Btn onClick={() => { setView('create'); setCreateStep(0); }}>+ 새 테스트</Btn>
          </Card>
        ) : (
          <div style={{ display: 'grid', gap: 14 }}>
            {tests.map(test => (
              <Card key={test.id} style={{ cursor: 'pointer' }} onClick={() => loadResults(test)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <Badge type={test.status === 'completed' ? 'green' : 'gold'} style={{ marginBottom: 8 }}>
                      {test.status === 'completed' ? '완료' : '진행중'}
                    </Badge>
                    <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5, maxWidth: 600 }}>
                      {test.email_text.slice(0, 100)}{test.email_text.length > 100 ? '…' : ''}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 8, fontFamily: 'var(--font-mono)' }}>
                      {new Date(test.created_at).toLocaleDateString('ko-KR')}
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--accent)', flexShrink: 0, marginLeft: 16 }}>결과 보기 →</div>
                </div>
              </Card>
            ))}
          </div>
        )
      )}

      {/* ── 결과 ── */}
      {view === 'result' && selectedTest && (
        <div style={{ display: 'grid', gap: 16 }}>
          {metrics.length === 0 && responses.length === 0 ? (
            <Card style={{ padding: '40px', textAlign: 'center' }}>
              <div style={{ color: 'var(--text-3)', fontSize: 13 }}>아직 패널 응답이 없습니다. 수집 후 다시 확인하세요.</div>
            </Card>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                {[
                  { label: '예상 답장율', value: `${replyRate}%`, color: replyRate >= 20 ? 'var(--green)' : replyRate >= 10 ? 'var(--accent)' : 'var(--red)' },
                  { label: '개봉 의향', value: openVals.length ? `${avgOpenIntent.toFixed(1)}/5` : '—', color: 'var(--blue)' },
                  { label: '호기심 유발', value: curiosityVals.length ? `${avgCuriosity.toFixed(1)}/5` : '—', color: '#C084FC' },
                ].map(s => (
                  <div key={s.label} style={{ padding: '16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', textAlign: 'center' }}>
                    <div style={{ fontSize: 24, fontWeight: 800, color: s.color, fontFamily: 'var(--font-mono)' }}>{s.value}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 6 }}>{s.label}</div>
                  </div>
                ))}
              </div>
              {metrics.length > 0 && (
                <Card>
                  <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>4축 진단 점수</div>
                  {Object.entries(METRIC_META).map(([key, meta]) => {
                    const m = metrics.find(x => x.metric_key === key);
                    const score = m ? Number(m.score) : 0;
                    return (
                      <div key={key} style={{ marginBottom: 14 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
                          <div>
                            <span style={{ fontWeight: 600 }}>{meta.label}</span>
                            <span style={{ fontSize: 11, color: 'var(--text-3)', marginLeft: 8 }}>{meta.desc}</span>
                          </div>
                          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, color: meta.color }}>{score.toFixed(1)}/5</span>
                        </div>
                        <div style={{ height: 8, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                          <div style={{ width: `${(score / 5) * 100}%`, height: '100%', background: meta.color, borderRadius: 4, transition: 'width 0.8s ease' }} />
                        </div>
                      </div>
                    );
                  })}
                </Card>
              )}
              <Card>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>검증된 이메일 원문</div>
                <pre style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-word', background: 'var(--bg-3)', padding: '14px', borderRadius: 'var(--radius)', margin: 0 }}>
                  {selectedTest.email_text}
                </pre>
              </Card>
              {responses.length > 0 && (
                <Card>
                  <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>패널 피드백 ({responses.length}명)</div>
                  {responses.map((r, i) => (
                    <div key={r.id} style={{ padding: '14px 0', borderBottom: i < responses.length - 1 ? '1px solid var(--border)' : 'none' }}>
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: r.comment ? 8 : 0 }}>
                        <Badge type={r.would_reply ? 'green' : 'red'}>{r.would_reply ? '답장하겠음' : '답장 안 함'}</Badge>
                        {r.hook_score && <span style={{ fontSize: 12, color: 'var(--text-3)' }}>훅 {r.hook_score}/5</span>}
                        {r.clarity_score && <span style={{ fontSize: 12, color: 'var(--text-3)' }}>명확성 {r.clarity_score}/5</span>}
                      </div>
                      {r.comment && <div style={{ fontSize: 13, color: 'var(--text-2)', paddingLeft: 10, borderLeft: '2px solid var(--border)' }}>"{r.comment}"</div>}
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
