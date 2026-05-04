import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Card, Badge, Btn, ConfirmModal } from '../../components/ui';
import PanelTargetStep, { calcCredits, calcPanelPayout } from '../../components/ui/PanelTargetStep';
import { supabase } from '../../lib/supabase';
import { QUESTION_TEMPLATES, TYPE_LABEL, TYPE_COLOR } from '../../lib/templates';

const AXES = [
  { key: 'clarity',     label: '가격 명확성',   icon: '◎', color: 'var(--blue)',   desc: '플랜 간 차이가 즉시 이해되는가?' },
  { key: 'value',       label: '지각 가치',     icon: '◆', color: 'var(--accent)', desc: '가격 대비 가치가 납득되는가?' },
  { key: 'barrier',     label: '행동 장벽',     icon: '▲', color: 'var(--red)',    desc: '전환을 막는 의심·불안 요소는?' },
  { key: 'competition', label: '경쟁 포지셔닝', icon: '◈', color: '#C084FC',      desc: '경쟁 대비 가격 포지션이 납득되는가?' },
];

const STEPS = ['가격 페이지', '제품 설명', '질문 설정', '패널 설정'];

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
  const [selectedQuestions, setSelectedQuestions] = useState([]);
  const [expandedTmpl, setExpandedTmpl] = useState({});
  const [customTemplateQs, setCustomTemplateQs] = useState([]);
  const [localCustomQs, setLocalCustomQs] = useState([]);
  const [newQText, setNewQText] = useState('');
  const [newQType, setNewQType] = useState('text');
  const [newQOptions, setNewQOptions] = useState(['', '']);
  const [newQScaleMin, setNewQScaleMin] = useState('');
  const [newQScaleMax, setNewQScaleMax] = useState('');
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [savingToTemplate, setSavingToTemplate] = useState(false);

  const [missions, setMissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [companyId, setCompanyId] = useState(null);
  const [companyPlan, setCompanyPlan] = useState(null);
  const [careerLevels, setCareerLevels] = useState(['junior']);
  const [creditBalance, setCreditBalance] = useState(null);

  const fileInputRef = useRef(null);

  const initTemplateName = location.state?.templateName || null;

  useEffect(() => {
    load();
    if (initTemplateId) {
      setView('create');
      setCreateStep(2);
      if (initTemplateName) {
        const target = QUESTION_TEMPLATES.pricing.find(t => t.name === initTemplateName);
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
    const { data: co } = await supabase.from('companies').select('id, plan, credit_balance').eq('user_id', user.id).single();
    setCompanyId(co?.id);
    setCompanyPlan(co?.plan?.toLowerCase() || 'starter');
    if (co != null) setCreditBalance(co.credit_balance ?? 0);
    if (co) {
      const { data: missionsData } = await supabase
        .from('missions').select('id, title, status, panel_count, filled_count, created_at')
        .eq('company_id', co.id).eq('type', 'pricing').neq('status', 'cancelled')
        .order('created_at', { ascending: false });
      setMissions(missionsData || []);
      const { data: ctData } = await supabase
        .from('question_templates')
        .select('template_questions(id, question_text, question_type, options, question_order)')
        .eq('company_id', co.id).eq('category', '가격').eq('is_default', false);
      const flatQs = (ctData || []).flatMap(t =>
        (t.template_questions || []).sort((a, b) => a.question_order - b.question_order)
      );
      setCustomTemplateQs(flatQs.map(q => ({
        id: q.id, text: q.question_text, type: q.question_type || 'text',
        options: Array.isArray(q.options) ? q.options : (() => { try { return JSON.parse(q.options || '[]'); } catch { return []; } })(),
      })));
    }
    setLoading(false);
  }

  function parseOptions(opts) {
    if (Array.isArray(opts)) return opts;
    try { return JSON.parse(opts || '[]'); } catch { return []; }
  }

  const allSelected = [...selectedQuestions, ...localCustomQs];
  const totalSelected = allSelected.length;
  const textSelected = allSelected.filter(q => q.type === 'text').length;
  const canAddQ = (q) => totalSelected < 5 && !(q.type === 'text' && textSelected >= 2);

  const toggleQuestion = (q) => {
    const isSelected = selectedQuestions.some(s => s.id === q.id);
    if (isSelected) {
      setSelectedQuestions(prev => prev.filter(s => s.id !== q.id));
    } else if (canAddQ(q)) {
      setSelectedQuestions(prev => [...prev, q]);
    }
  };

  function handleAddLocalQ() {
    if (!newQText.trim()) return;
    if (!canAddQ({ type: newQType })) return;
    const options =
      newQType === 'radio' ? newQOptions.filter(o => o.trim()) :
      newQType === 'scale' ? [newQScaleMin.trim(), newQScaleMax.trim()] : [];
    setLocalCustomQs(prev => [...prev, { id: `local-${Date.now()}`, text: newQText.trim(), type: newQType, options }]);
    setNewQText(''); setNewQType('text'); setNewQOptions(['', '']); setNewQScaleMin(''); setNewQScaleMax('');
  }

  async function handleSaveTmpl() {
    if (!newQText.trim() || !companyId) return;
    setSavingToTemplate(true);
    const options =
      newQType === 'radio' ? newQOptions.filter(o => o.trim()) :
      newQType === 'scale' ? [newQScaleMin.trim(), newQScaleMax.trim()] : [];
    try {
      let { data: tmpl } = await supabase
        .from('question_templates').select('id')
        .eq('company_id', companyId).eq('category', '가격').eq('is_default', false)
        .maybeSingle();
      if (!tmpl) {
        const { data: newT, error: tErr } = await supabase
          .from('question_templates')
          .insert({ company_id: companyId, name: '내 커스텀 질문', category: '가격', icon: '✏️', description: '직접 만든 질문 모음', is_default: false })
          .select().single();
        if (tErr) throw tErr;
        tmpl = newT;
      }
      const { data: newQ, error: qErr } = await supabase.from('template_questions').insert({
        template_id: tmpl.id, question_text: newQText.trim(), question_type: newQType,
        options, question_order: customTemplateQs.length + 1,
      }).select().single();
      if (qErr) throw qErr;
      const saved = { id: newQ.id, text: newQ.question_text, type: newQ.question_type, options: parseOptions(newQ.options) };
      setCustomTemplateQs(prev => [...prev, saved]);
      setLocalCustomQs(prev => [...prev, { ...saved, id: `local-${Date.now()}` }]);
      setNewQText(''); setNewQType('text'); setNewQOptions(['', '']); setNewQScaleMin(''); setNewQScaleMax('');
      setShowSaveModal(false);
    } catch (e) {
      console.error('[PricingTest] 템플릿 저장 실패:', e.message);
    } finally {
      setSavingToTemplate(false);
    }
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
          selectedQuestions: [...selectedQuestions, ...localCustomQs],
          careerLevels,
        }),
        panel_count: panelSize,
        reward_amount: calcPanelPayout(careerLevels, 'sub'),
        status: 'active',
        assets: [],
      });
      if (mErr) throw mErr;

      // 크레딧 예약
      const requiredCredits = calcCredits(panelSize, careerLevels, 'sub');
      const { data: creditData, error: creditErr } = await supabase.rpc('reserve_mission_credits', {
        p_mission_id: missionUuid,
        p_company_id: companyId,
        p_credits:    requiredCredits,
      });
      if (creditErr) throw creditErr;
      if (!creditData?.success) {
        await supabase.from('missions').delete().eq('id', missionUuid);
        throw new Error(
          creditData?.error === 'INSUFFICIENT_CREDITS'
            ? `크레딧이 부족합니다. (보유: ${creditData.balance}, 필요: ${creditData.required})`
            : '크레딧 처리 중 오류가 발생했습니다.'
        );
      }

      const { data: test, error: tErr } = await supabase.from('pricing_tests').insert({
        company_id: companyId,
        status: 'active',
        mission_id: missionUuid,
        template_id: null,
      }).select().single();
      if (tErr) console.warn('[PricingTest] 서브테이블 등록 실패:', tErr.message);

      if (test) {
        const axisRows = AXES.map(a => ({ test_id: test.id, axis_key: a.key, label: a.label, score: 0 }));
        await supabase.from('pricing_axes').insert(axisRows);
      }

      setMissionUuid(crypto.randomUUID());
      navigate('/company');
    } catch (err) {
      console.error('[PricingTest] 등록 실패:', err.message);
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  if (loading) return <div style={{ padding: '40px 48px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', fontSize: 13 }}>로딩 중…</div>;

  return (
    <div style={{ padding: '40px 48px', maxWidth: 900, animation: 'fadeUp 0.5s ease both' }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--accent)', marginBottom: 8, letterSpacing: '0.1em' }}>PRICING TEST</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 6 }}>가격 페이지 검증</h1>
            <p style={{ color: 'var(--text-2)', fontSize: 14 }}>가격 구조의 명확성·지각 가치·행동 장벽·경쟁 포지셔닝을 4축으로 진단합니다.</p>
          </div>
          {view !== 'list' && <Btn variant="ghost" onClick={() => setView('list')}>← 목록</Btn>}
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

            {/* Step 2: 질문 설정 */}
            {createStep === 2 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
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

                  {/* 내 커스텀 질문 그룹 */}
                  {customTemplateQs.length > 0 && (() => {
                    const custSelected = customTemplateQs.filter(q => selectedQuestions.some(s => s.id === q.id));
                    const isOpen = expandedTmpl['__custom__'];
                    return (
                      <div style={{ marginBottom: 8, border: '2px solid var(--accent)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
                        <div onClick={() => setExpandedTmpl(prev => ({ ...prev, '__custom__': !isOpen }))}
                          style={{ display: 'flex', alignItems: 'center', padding: '11px 14px', background: 'var(--surface)', cursor: 'pointer', userSelect: 'none', gap: 10 }}>
                          <span style={{ fontSize: 15 }}>✏️</span>
                          <span style={{ flex: 1, fontWeight: 600, fontSize: 13 }}>내 커스텀 질문</span>
                          {custSelected.length > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)' }}>{custSelected.length}개 선택</span>}
                          <span style={{ color: 'var(--text-3)', fontSize: 12, transition: 'transform 0.2s', transform: isOpen ? 'rotate(90deg)' : 'none', display: 'inline-block' }}>▶</span>
                        </div>
                        {isOpen && (
                          <div style={{ borderTop: '1px solid var(--border)' }}>
                            {customTemplateQs.map((q, qi) => {
                              const isChecked = selectedQuestions.some(s => s.id === q.id);
                              const disabled = !isChecked && !canAddQ(q);
                              return (
                                <div key={q.id} onClick={() => !disabled && toggleQuestion(q)} style={{
                                  display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 14px',
                                  background: isChecked ? 'rgba(232,213,163,0.07)' : 'var(--bg)',
                                  cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.4 : 1,
                                  borderBottom: qi < customTemplateQs.length - 1 ? '1px solid var(--border)' : 'none',
                                }}>
                                  <div style={{ width: 17, height: 17, borderRadius: 4, flexShrink: 0, marginTop: 2, border: `2px solid ${isChecked ? 'var(--accent)' : 'var(--border)'}`, background: isChecked ? 'var(--accent)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    {isChecked && <span style={{ color: '#fff', fontSize: 10, fontWeight: 800, lineHeight: 1 }}>✓</span>}
                                  </div>
                                  <div style={{ flex: 1 }}>
                                    <span style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5 }}>{q.text}</span>
                                    <div style={{ marginTop: 4, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                                      <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, fontWeight: 600, background: TYPE_COLOR[q.type] + '22', color: TYPE_COLOR[q.type] }}>{TYPE_LABEL[q.type]}</span>
                                      {q.type === 'radio' && q.options.length > 0 && <span style={{ fontSize: 11, color: 'var(--text-3)' }}>[{q.options.join(' / ')}]</span>}
                                      {q.type === 'scale' && (
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                          <span style={{ fontSize: 10, color: 'var(--text-3)' }}>{q.options?.[0] || '매우 아니다'}</span>
                                          {[1,2,3,4,5].map(n => <span key={n} style={{ width: 16, height: 16, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, fontFamily: 'var(--font-mono)', border: '1px solid var(--accent)', color: 'var(--accent)' }}>{n}</span>)}
                                          <span style={{ fontSize: 10, color: 'var(--text-3)' }}>{q.options?.[1] || '매우 그렇다'}</span>
                                        </span>
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
                  })()}

                  {QUESTION_TEMPLATES.pricing.map(tmpl => {
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
                              const disabled = !isChecked && !canAddQ(q);
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
                                      {q.type === 'scale' && (
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                          <span style={{ fontSize: 10, color: 'var(--text-3)' }}>{q.options?.[0] || '매우 아니다'}</span>
                                          {[1,2,3,4,5].map(n => (
                                            <span key={n} style={{
                                              width: 16, height: 16, borderRadius: '50%',
                                              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                              fontSize: 9, fontWeight: 700, fontFamily: 'var(--font-mono)',
                                              border: '1px solid var(--accent)',
                                              color: 'var(--accent)',
                                            }}>{n}</span>
                                          ))}
                                          <span style={{ fontSize: 10, color: 'var(--text-3)' }}>{q.options?.[1] || '매우 그렇다'}</span>
                                        </span>
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

                  {/* 질문 만들기 */}
                  <div style={{ marginTop: 14, border: `1px solid ${localCustomQs.length > 0 ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 'var(--radius)', padding: '14px 14px 10px', transition: 'border-color 0.2s' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span>질문 만들기</span>
                      {localCustomQs.length > 0 && (
                        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', background: 'var(--accent-dim)', padding: '2px 8px', borderRadius: 10 }}>+{localCustomQs.length}개 추가됨</span>
                      )}
                    </div>
                    <textarea value={newQText} onChange={e => setNewQText(e.target.value)} rows={2}
                      placeholder="질문을 입력하세요"
                      style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit', fontSize: 13, marginBottom: 8 }} />
                    <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                      {[['radio', '옵션형'], ['scale', '점수형'], ['text', '서술형']].map(([t, label]) => (
                        <button key={t} onClick={() => setNewQType(t)} style={{
                          padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                          border: `1px solid ${newQType === t ? 'var(--accent)' : 'var(--border)'}`,
                          background: newQType === t ? 'var(--accent)' : 'var(--surface)',
                          color: newQType === t ? '#fff' : 'var(--text-2)',
                        }}>{label}</button>
                      ))}
                    </div>
                    {newQType === 'radio' && (
                      <div style={{ marginBottom: 8 }}>
                        {newQOptions.map((opt, i) => (
                          <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
                            <input value={opt} onChange={e => setNewQOptions(prev => prev.map((o, j) => j === i ? e.target.value : o))}
                              placeholder={`옵션 ${i + 1}`}
                              style={{ flex: 1, fontFamily: 'inherit', fontSize: 13, padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--bg)' }} />
                            {newQOptions.length > 2 && (
                              <button onClick={() => setNewQOptions(prev => prev.filter((_, j) => j !== i))}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', fontSize: 16 }}>×</button>
                            )}
                          </div>
                        ))}
                        {newQOptions.length < 6 && (
                          <button onClick={() => setNewQOptions(prev => [...prev, ''])}
                            style={{ background: 'none', border: '1px dashed var(--border)', borderRadius: 'var(--radius)', padding: '5px 12px', fontSize: 12, color: 'var(--text-3)', cursor: 'pointer' }}>
                            + 옵션 추가
                          </button>
                        )}
                      </div>
                    )}
                    {newQType === 'scale' && (
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
                        <input value={newQScaleMin} onChange={e => setNewQScaleMin(e.target.value)}
                          placeholder="1점 라벨 (예: 매우 아니다)"
                          style={{ flex: 1, minWidth: 140, fontFamily: 'inherit', fontSize: 13, padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--bg)' }} />
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                          {[1,2,3,4,5].map(n => <span key={n} style={{ width: 16, height: 16, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, border: '1px solid var(--accent)', color: 'var(--accent)' }}>{n}</span>)}
                        </span>
                        <input value={newQScaleMax} onChange={e => setNewQScaleMax(e.target.value)}
                          placeholder="5점 라벨 (예: 매우 그렇다)"
                          style={{ flex: 1, minWidth: 140, fontFamily: 'inherit', fontSize: 13, padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--bg)' }} />
                      </div>
                    )}
                    {newQType === 'text' && textSelected >= 2 && (
                      <div style={{ fontSize: 12, color: 'var(--accent)', marginBottom: 8 }}>서술형 질문은 최대 2개까지만 추가할 수 있습니다.</div>
                    )}
                    <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                      <Btn size="sm" onClick={handleAddLocalQ}
                        disabled={!newQText.trim() || totalSelected >= 5 || (newQType === 'text' && textSelected >= 2)}>추가</Btn>
                      <Btn size="sm" variant="secondary" onClick={() => setShowSaveModal(true)} disabled={!newQText.trim()}>템플릿에 저장 →</Btn>
                    </div>
                    {localCustomQs.length > 0 && (
                      <div style={{ marginTop: 12 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ width: 16, height: 16, borderRadius: '50%', background: 'var(--accent)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 9, fontWeight: 800, flexShrink: 0 }}>✓</span>
                          추가된 질문 목록
                        </div>
                        {localCustomQs.map((q, i) => (
                          <div key={q.id} style={{
                            display: 'flex', gap: 10, alignItems: 'flex-start',
                            padding: '10px 12px',
                            background: 'var(--accent-dim)',
                            borderRadius: 'var(--radius)',
                            border: '1px solid var(--accent)',
                            borderLeft: '3px solid var(--accent)',
                            marginBottom: 6,
                          }}>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 800, color: '#fff', background: 'var(--accent)', borderRadius: 4, padding: '2px 6px', flexShrink: 0, marginTop: 2 }}>Q{i + 1}</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <span style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5 }}>{q.text}</span>
                              <div style={{ marginTop: 4, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                                <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, fontWeight: 600, background: TYPE_COLOR[q.type] + '22', color: TYPE_COLOR[q.type] }}>{TYPE_LABEL[q.type]}</span>
                                {q.type === 'radio' && q.options?.length > 0 && (
                                  <span style={{ fontSize: 11, color: 'var(--text-3)' }}>[{q.options.join(' / ')}]</span>
                                )}
                                {q.type === 'scale' && (
                                  <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{q.options?.[0] || '매우 아니다'} · 1~5 · {q.options?.[1] || '매우 그렇다'}</span>
                                )}
                              </div>
                            </div>
                            <button onClick={() => setLocalCustomQs(prev => prev.filter(lq => lq.id !== q.id))}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', fontSize: 16, flexShrink: 0, marginTop: 1 }}>×</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: 패널 설정 */}
            {createStep === 3 && (
              <PanelTargetStep
                plan={companyPlan}
                panelCount={panelSize}
                onPanelCount={setPanelSize}
                careerLevels={careerLevels}
                onCareerLevels={setCareerLevels}
                missionType="sub"
                creditBalance={creditBalance}
              />
            )}
          </Card>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20 }}>
            <Btn variant="secondary" onClick={() => createStep > 0 ? setCreateStep(s => s - 1) : setView('list')}>
              {createStep === 0 ? '취소' : '이전'}
            </Btn>
            {createStep < STEPS.length - 1 ? (
              <Btn onClick={() => setCreateStep(s => s + 1)}>다음 →</Btn>
            ) : (
              <Btn onClick={handleSubmit} disabled={submitting || (creditBalance != null && calcCredits(panelSize, careerLevels, 'sub') > creditBalance)}>
                {submitting ? '등록 중…' : '의뢰 제출 →'}
              </Btn>
            )}
          </div>
        </div>
      )}

      {/* ── 목록 ── */}
      {view === 'list' && (
        missions.length === 0 ? (
          <Card style={{ padding: '60px', textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>₩</div>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>등록된 테스트가 없습니다</div>
            <div style={{ color: 'var(--text-2)', fontSize: 13, marginBottom: 20 }}>가격 페이지의 전환 장벽을 패널로 진단해보세요.</div>
            <Btn onClick={() => { setView('create'); setCreateStep(0); }}>+ 새 테스트</Btn>
          </Card>
        ) : (
          <div style={{ display: 'grid', gap: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4 }}>
              <Btn size="sm" onClick={() => { setView('create'); setCreateStep(0); }}>+ 새 테스트</Btn>
            </div>
            {missions.map(m => (
              <Card key={m.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/company/results?id=${m.id}`)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <Badge type={m.status === 'completed' ? 'green' : 'gold'} style={{ marginBottom: 8 }}>
                      {m.status === 'completed' ? '완료' : '진행중'}
                    </Badge>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{m.title || '가격 페이지 검증'}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>
                      {new Date(m.created_at).toLocaleDateString('ko-KR')} · {m.filled_count || 0}/{m.panel_count || 0}명 응답
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--accent)' }}>결과 보기 →</div>
                </div>
              </Card>
            ))}
          </div>
        )
      )}

      {showSaveModal && (
        <ConfirmModal
          title="질문 템플릿에 저장"
          desc={"이 질문을 템플릿에 추가하겠습니까?\n저장된 질문은 이후 의뢰 등록 시 자동으로 표시됩니다."}
          confirmLabel={savingToTemplate ? '저장 중…' : '저장'}
          onConfirm={handleSaveTmpl}
          onCancel={() => setShowSaveModal(false)}
        />
      )}

    </div>
  );
}
