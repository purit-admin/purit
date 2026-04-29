import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
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
const STEPS = ['가격 페이지', '제품 설명', '질문 설정'];

export default function PricingTest() {
  const location = useLocation();
  const navigate = useNavigate();
  const initTemplateId = location.state?.templateId || null;
  const submittingRef = useRef(false);

  const [view, setView] = useState('list');
  const [createStep, setCreateStep] = useState(0);
  const [missionUuid, setMissionUuid] = useState(() => crypto.randomUUID());

  // Step 0
  const [pricingDesc, setPricingDesc] = useState('');
  const [pricingImage, setPricingImage] = useState(null);
  const [uploadingImg, setUploadingImg] = useState(false);
  // Step 1
  const [productDescription, setProductDescription] = useState('');
  // Step 2
  const [panelSize, setPanelSize] = useState(10);
  const [selectedTemplateId, setSelectedTemplateId] = useState(initTemplateId);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [customQuestions, setCustomQuestions] = useState([]);

  const [tests, setTests] = useState([]);
  const [selectedTest, setSelectedTest] = useState(null);
  const [axes, setAxes] = useState([]);
  const [responses, setResponses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [companyId, setCompanyId] = useState(null);
  const [templates, setTemplates] = useState([]);

  const fileInputRef = useRef(null);

  useEffect(() => {
    load();
    if (initTemplateId) { setView('create'); setCreateStep(2); }
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
          .eq('category', '가격').eq('is_default', true),
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

  async function handleImageUpload(file) {
    if (!file || !companyId) return;
    setUploadingImg(true);
    try {
      const ext = file.name.split('.').pop().toLowerCase();
      const path = `${companyId}/${missionUuid}/pricing.${ext}`;
      const { error } = await supabase.storage.from('mission-assets').upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('mission-assets').getPublicUrl(path);
      setPricingImage(publicUrl);
    } catch (err) {
      console.error('[PricingTest] 이미지 업로드 실패:', err.message);
    } finally {
      setUploadingImg(false);
    }
  }

  async function handleSubmit() {
    if (!companyId) return;
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    try {
      const { error: mErr } = await supabase.from('missions').insert({
        id: missionUuid,
        company_id: companyId,
        title: '가격 페이지 검증',
        type: 'pricing',
        description: JSON.stringify({
          content: pricingDesc.trim() || '가격 페이지 4축 진단',
          image: pricingImage || null,
          productDescription: productDescription.trim(),
          customQuestions: customQuestions.filter(q => q.trim()),
        }),
        panel_count: panelSize,
        reward_amount: (PRICE_PER[panelSize] || 90) * 1000,
        status: 'active',
        assets: selectedTemplate ? [selectedTemplate.name] : [],
      });
      if (mErr) throw mErr;

      const { data: test, error } = await supabase.from('pricing_tests').insert({
        company_id: companyId,
        status: 'active',
        mission_id: missionUuid,
        template_id: selectedTemplateId || null,
      }).select().single();
      if (error) throw error;

      const axisRows = AXES.map(a => ({ test_id: test.id, axis_key: a.key, label: a.label, score: 0 }));
      await supabase.from('pricing_axes').insert(axisRows);

      setMissionUuid(crypto.randomUUID());
      navigate('/company');
    } catch (err) {
      console.error('[PricingTest] 등록 실패:', err.message);
    } finally {
      submittingRef.current = false;
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
    setView('result');
  }

  if (loading) return <div style={{ padding: '40px 48px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', fontSize: 13 }}>로딩 중…</div>;

  const buyCount = responses.filter(r => r.would_buy).length;
  const buyRate = responses.length ? Math.round((buyCount / responses.length) * 100) : 0;
  const fairnessVals = responses.filter(r => r.price_fairness);
  const valueVals = responses.filter(r => r.value_perception);
  const avgFairness = fairnessVals.length ? fairnessVals.reduce((s, r) => s + r.price_fairness, 0) / fairnessVals.length : 0;
  const avgValue = valueVals.length ? valueVals.reduce((s, r) => s + r.value_perception, 0) / valueVals.length : 0;

  return (
    <div style={{ padding: '40px 48px', maxWidth: 900, animation: 'fadeUp 0.5s ease both' }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--accent)', marginBottom: 8, letterSpacing: '0.1em' }}>PRICING TEST</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 6 }}>가격 페이지 검증</h1>
            <p style={{ color: 'var(--text-2)', fontSize: 14 }}>가격 구조의 명확성·지각 가치·행동 장벽·경쟁 포지셔닝을 4축으로 진단합니다.</p>
          </div>
          {view === 'list' && <Btn onClick={() => { setView('create'); setCreateStep(0); }}>+ 새 테스트</Btn>}
          {(view === 'create' || view === 'result') && <Btn variant="ghost" onClick={() => { setView('list'); setSelectedTest(null); }}>← 목록</Btn>}
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
            {/* Step 0: 가격 페이지 설명 + 이미지 */}
            {createStep === 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>가격 페이지</div>
                <div style={{ fontSize: 12, color: 'var(--text-3)' }}>패널에게 보여줄 가격 구성, 플랜 내용, 검증 목적을 입력하세요.</div>
                <textarea
                  value={pricingDesc}
                  onChange={e => setPricingDesc(e.target.value)}
                  rows={6}
                  placeholder={`예시:\n- 스타터 플랜: ₩9,900/월 (기능 제한)\n- 프로 플랜: ₩29,900/월 (전체 기능)\n- 엔터프라이즈: 문의\n\n검증 목표: 프로 플랜의 가격 저항 요인 파악`}
                  style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit', fontSize: 13 }}
                />
                <div>
                  <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>이미지 업로드 (선택)</div>
                  <input type="file" accept="image/*" ref={fileInputRef} style={{ display: 'none' }}
                    onChange={e => { if (e.target.files[0]) handleImageUpload(e.target.files[0]); e.target.value = ''; }} />
                  {pricingImage ? (
                    <div style={{ position: 'relative', display: 'inline-block' }}>
                      <img src={pricingImage} alt="가격 페이지" style={{ maxWidth: '100%', maxHeight: 200, objectFit: 'contain', borderRadius: 8, border: '1px solid var(--border)' }} />
                      <button onClick={() => setPricingImage(null)} style={{
                        position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: '50%',
                        background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>×</button>
                    </div>
                  ) : (
                    <Btn variant="secondary" size="sm" disabled={uploadingImg} onClick={() => fileInputRef.current?.click()}>
                      {uploadingImg ? '업로드 중...' : '이미지 선택'}
                    </Btn>
                  )}
                </div>
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
                  placeholder={"예) 제품명: B2B SaaS 전환율 분석 툴 / 타겟: 마케터, 스타트업 성장팀"}
                  style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit', fontSize: 13 }}
                />
              </div>
            )}

            {/* Step 2: 패널 수 & 질문 설정 */}
            {createStep === 2 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
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
                  <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>질문 설정</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div onClick={() => setSelectedTemplateId(null)} style={{
                      padding: '12px 14px', borderRadius: 'var(--radius)',
                      border: `1px solid ${!selectedTemplateId ? 'var(--accent)' : 'var(--border)'}`,
                      background: !selectedTemplateId ? 'var(--accent-dim)' : 'var(--surface)',
                      cursor: 'pointer', fontSize: 13, color: 'var(--text-2)', transition: 'all 0.15s',
                    }}>기본 가격 평가 질문만 사용</div>
                    {templates.map(t => (
                      <div key={t.id} onClick={() => setSelectedTemplateId(t.id)} style={{
                        padding: '12px 14px', borderRadius: 'var(--radius)',
                        border: `1px solid ${selectedTemplateId === t.id ? 'var(--accent)' : 'var(--border)'}`,
                        background: selectedTemplateId === t.id ? 'var(--accent-dim)' : 'var(--surface)',
                        cursor: 'pointer', transition: 'all 0.15s',
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <span style={{ fontWeight: 600, fontSize: 13 }}>{t.icon} {t.name}</span>
                          <span style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>{t.template_questions?.length}개 문항</span>
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{t.description}</div>
                      </div>
                    ))}
                  </div>

                  {selectedTemplate && (
                    <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {selectedTemplate.template_questions.map((q, i) => (
                        <div key={q.id} style={{
                          padding: '10px 14px', background: 'var(--surface)', borderRadius: 'var(--radius)',
                          border: '1px solid var(--border)', borderLeft: '3px solid var(--accent)',
                          display: 'flex', gap: 10, alignItems: 'flex-start',
                        }}>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent)', fontWeight: 700, flexShrink: 0, marginTop: 2 }}>Q{i + 1}</span>
                          <span style={{ fontSize: 13, color: 'var(--text-2)' }}>{q.question_text}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {customQuestions.length > 0 && (
                    <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {customQuestions.map((q, i) => (
                        <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                          <textarea
                            value={q}
                            onChange={e => setCustomQuestions(qs => qs.map((v, j) => j === i ? e.target.value : v))}
                            rows={2}
                            placeholder={`커스텀 질문 ${i + 1}`}
                            style={{ flex: 1, resize: 'vertical', fontFamily: 'inherit', fontSize: 13 }}
                          />
                          <button onClick={() => setCustomQuestions(qs => qs.filter((_, j) => j !== i))}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', fontSize: 18, padding: '4px', flexShrink: 0 }}>×</button>
                        </div>
                      ))}
                    </div>
                  )}
                  {customQuestions.length < 3 && (
                    <button onClick={() => setCustomQuestions(qs => [...qs, ''])}
                      style={{ marginTop: 10, background: 'none', border: '1px dashed var(--border)', borderRadius: 'var(--radius)', padding: '8px 14px', fontSize: 13, color: 'var(--text-3)', cursor: 'pointer', width: '100%' }}>
                      + 커스텀 질문 추가
                    </button>
                  )}
                </div>
              </div>
            )}
          </Card>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20 }}>
            <Btn variant="secondary" onClick={() => createStep > 0 ? setCreateStep(s => s - 1) : setView('list')}>
              {createStep === 0 ? '취소' : '이전'}
            </Btn>
            {createStep < STEPS.length - 1 ? (
              <Btn onClick={() => setCreateStep(s => s + 1)}>다음 →</Btn>
            ) : (
              <Btn onClick={handleSubmit} disabled={submitting}>
                {submitting ? '등록 중…' : '미션 제출 →'}
              </Btn>
            )}
          </div>
        </div>
      )}

      {/* ── 목록 ── */}
      {view === 'list' && (
        tests.length === 0 ? (
          <Card style={{ padding: '60px', textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>₩</div>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>등록된 테스트가 없습니다</div>
            <div style={{ color: 'var(--text-2)', fontSize: 13, marginBottom: 20 }}>가격 페이지의 전환 장벽을 패널로 진단해보세요.</div>
            <Btn onClick={() => { setView('create'); setCreateStep(0); }}>+ 첫 테스트 시작</Btn>
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
      {view === 'result' && selectedTest && (
        <div style={{ display: 'grid', gap: 16 }}>
          {axes.length === 0 && responses.length === 0 ? (
            <Card style={{ padding: '40px', textAlign: 'center' }}>
              <div style={{ color: 'var(--text-3)', fontSize: 13 }}>아직 패널 응답이 없습니다. 수집 후 다시 확인하세요.</div>
            </Card>
          ) : (
            <>
              {responses.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                  {[
                    { label: '구매 의향', value: `${buyRate}%`, color: buyRate >= 60 ? 'var(--green)' : buyRate >= 40 ? 'var(--accent)' : 'var(--red)' },
                    { label: '가격 적절성', value: fairnessVals.length ? `${avgFairness.toFixed(1)}/5` : '—', color: 'var(--blue)' },
                    { label: '가치 인식', value: valueVals.length ? `${avgValue.toFixed(1)}/5` : '—', color: 'var(--accent)' },
                  ].map(s => (
                    <div key={s.label} style={{ padding: '16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', textAlign: 'center' }}>
                      <div style={{ fontSize: 24, fontWeight: 800, color: s.color, fontFamily: 'var(--font-mono)' }}>{s.value}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 6 }}>{s.label}</div>
                    </div>
                  ))}
                </div>
              )}
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
