import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Btn, Card } from '../../components/ui';
import PanelTargetStep, { calcCredits, CAREER_LEVELS } from '../../components/ui/PanelTargetStep';
import { supabase } from '../../lib/supabase';
import { QUESTION_TEMPLATES, TYPE_LABEL, TYPE_COLOR } from '../../lib/templates';

const STEPS = ['페르소나 설정', '소재 업로드', '질문 설정', '패널 설정', '검토 & 제출'];
const MAX_IMAGES = 5;
const MAX_FILE_SIZE = 5 * 1024 * 1024;

export default function NewMission() {
  const navigate = useNavigate();
  const location = useLocation();
  const isEditMode    = Boolean(location.state?.editMode);
  const editMissionId = location.state?.missionId || null;

  const fileInputRef = useRef(null);
  const [step, setStep] = useState(0);
  const [missionUuid] = useState(() => editMissionId || crypto.randomUUID());
  const [form, setForm] = useState({
    product: '', lpUrl: '',
    personaAge: '', personaIncome: '', personaRole: '', personaContext: '',
    panels: 10, briefText: '', focusAreas: [],
    imageUrls: [],
    estimatedMinutes: 5,
  });
  const [uploading, setUploading]         = useState(false);
  const [uploadError, setUploadError]     = useState('');
  const [submitting, setSubmitting]       = useState(false);
  const [submitError, setSubmitError]     = useState('');
  const [companyPlan, setCompanyPlan]     = useState(null);
  const [careerLevels, setCareerLevels]   = useState(['junior']);

  // 질문 설정 state
  const [selectedQuestions, setSelectedQuestions] = useState([]);
  const [localCustomQs,     setLocalCustomQs]     = useState([]);
  const [expandedTmpl,      setExpandedTmpl]      = useState({});

  // 플랜 로드
  useEffect(() => {
    async function fetchPlan() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from('companies').select('plan').eq('user_id', user.id).single();
      setCompanyPlan(data?.plan?.toLowerCase() || 'starter');
    }
    fetchPlan();
  }, []);

  // 편집 모드: 기존 미션 데이터 pre-fill
  useEffect(() => {
    if (!isEditMode || !editMissionId) return;
    async function load() {
      const { data: ms } = await supabase.from('missions').select('*').eq('id', editMissionId).single();
      if (!ms) return;
      const briefText = (() => {
        try {
          const p = JSON.parse(ms.description || '');
          return (p && p.briefText) ? p.briefText : (ms.description || '');
        } catch { return ms.description || ''; }
      })();
      setForm(f => ({
        ...f,
        product:        ms.title || '',
        lpUrl:          ms.target_url || '',
        briefText,
        panels:         ms.panel_count || 10,
        focusAreas:     ms.assets || [],
        imageUrls:      ms.image_urls || [],
        personaContext: ms.persona || '',
      }));
      try {
        const p = JSON.parse(ms.description || '{}');
        if (Array.isArray(p.selectedQuestions)) setSelectedQuestions(p.selectedQuestions);
        if (Array.isArray(p.careerLevels)) setCareerLevels(p.careerLevels);
      } catch {}
    }
    load();
  }, []);

  const FOCUS = ['첫인상 / 가독성', 'CTA 전환율', '가격 및 가치 전달', '신뢰 요소', '모바일 최적화', '핵심 메시지 명확성', '비주얼 완성도', '타겟 일치도'];

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const toggleFocus = (f) => setForm(prev => ({
    ...prev,
    focusAreas: prev.focusAreas.includes(f) ? prev.focusAreas.filter(x => x !== f) : [...prev.focusAreas, f],
  }));

  // 질문 설정 헬퍼
  const lpTemplates      = QUESTION_TEMPLATES.lp || [];
  const allLPSelected    = [...selectedQuestions, ...localCustomQs];
  const totalLPSelected  = allLPSelected.length;
  const textLPSelected   = allLPSelected.filter(q => q.type === 'text').length;
  const canAddLPQ        = (q) => totalLPSelected < 5 && !(q.type === 'text' && textLPSelected >= 2);
  const toggleLPQuestion = (q) => {
    const sel = selectedQuestions.some(s => s.id === q.id);
    if (sel) setSelectedQuestions(prev => prev.filter(s => s.id !== q.id));
    else if (canAddLPQ(q)) setSelectedQuestions(prev => [...prev, q]);
  };

  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    const remaining = MAX_IMAGES - form.imageUrls.length;
    const toUpload = files.slice(0, remaining);

    for (const file of toUpload) {
      if (file.size > MAX_FILE_SIZE) {
        setUploadError(`${file.name}이 5MB를 초과합니다.`);
        e.target.value = '';
        return;
      }
    }

    setUploading(true);
    setUploadError('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: company } = await supabase.from('companies').select('id').eq('user_id', user.id).single();

      const urls = [];
      for (const file of toUpload) {
        const ext = file.name.split('.').pop().toLowerCase();
        const path = `${company.id}/${missionUuid}/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from('mission-assets').upload(path, file, { upsert: false });
        if (error) throw error;
        const { data: { publicUrl } } = supabase.storage.from('mission-assets').getPublicUrl(path);
        urls.push(publicUrl);
      }
      set('imageUrls', [...form.imageUrls, ...urls]);
    } catch (err) {
      setUploadError('업로드 실패: ' + err.message);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const removeImage = (url) => {
    set('imageUrls', form.imageUrls.filter(u => u !== url));
  };

  const buildDescription = () => {
    const base = { briefText: form.briefText, careerLevels };
    if (allLPSelected.length > 0) base.selectedQuestions = allLPSelected;
    return JSON.stringify(base);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setSubmitError('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: company, error: companyError } = await supabase
        .from('companies').select('id').eq('user_id', user.id).single();
      if (companyError) throw companyError;

      const persona = [
        form.personaAge && `연령: ${form.personaAge}`,
        form.personaIncome && `소득: ${form.personaIncome}`,
        form.personaRole && `직군: ${form.personaRole}`,
        form.personaContext && form.personaContext,
      ].filter(Boolean).join(' / ');

      const description = buildDescription();

      if (isEditMode && editMissionId) {
        const { error } = await supabase.from('missions').update({
          title:         form.product || '의뢰',
          target_url:    form.lpUrl,
          description,
          persona,
          panel_count:   form.panels,
          reward_amount: calcCredits(form.panels, careerLevels) * 10000,
          assets:        form.focusAreas,
          image_urls:    form.imageUrls,
        }).eq('id', editMissionId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('missions').insert({
          id:                missionUuid,
          company_id:        company.id,
          title:             form.product || '의뢰',
          type:              'landing_page',
          target_url:        form.lpUrl,
          description,
          persona,
          panel_count:       form.panels,
          reward_amount:     calcCredits(form.panels, careerLevels) * 10000,
          status:            'active',
          assets:            form.focusAreas,
          image_urls:        form.imageUrls,
          estimated_minutes: form.estimatedMinutes,
        });
        if (error) throw error;
      }
      navigate('/company');
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ padding: '40px 48px', maxWidth: 760, animation: 'fadeUp 0.5s ease both' }}>
      <div style={{ marginBottom: 36 }}>
        <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--accent)', marginBottom: 8, letterSpacing: '0.1em' }}>{isEditMode ? 'EDIT MISSION' : 'NEW MISSION'}</div>
        <h1 style={{ fontSize: 28, fontWeight: 800 }}>{isEditMode ? '의뢰 수정' : '의뢰 등록'}</h1>
      </div>

      {/* NDA 안내 배너 */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 16px', marginBottom: 28,
        background: 'var(--accent-dim)', borderRadius: 'var(--radius)',
        border: '1px solid var(--accent)',
        fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5,
      }}>
        <span style={{ fontSize: 16, flexShrink: 0 }}>🔒</span>
        평가 참가 패널은 기업의 정보를 외부에 발설할 수 없습니다.
      </div>

      {/* Step indicator */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 40, position: 'relative' }}>
        {STEPS.map((s, i) => (
          <div key={s} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: i === 0 ? 'flex-start' : i === STEPS.length - 1 ? 'flex-end' : 'center', gap: 8 }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: i < step ? 'var(--green)' : i === step ? 'var(--accent)' : 'var(--surface-2)',
              color: i < step ? '#FFFFFF' : i === step ? '#FFFFFF' : 'var(--text-3)',
              fontSize: 12, fontWeight: 700, transition: 'all 0.3s',
            }}>
              {i < step ? '✓' : i + 1}
            </div>
            <span style={{ fontSize: 11, color: i === step ? 'var(--text)' : 'var(--text-3)', fontWeight: i === step ? 600 : 400, whiteSpace: 'nowrap' }}>{s}</span>
          </div>
        ))}
      </div>

      <Card>
        {/* Step 0: 페르소나 설정 */}
        {step === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>타겟 페르소나 설정</h2>
            <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 4 }}>이 조건에 맞는 패널을 매칭합니다. 구체적일수록 수율이 높아집니다.</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <label style={lbl}>
                <span style={lblTxt}>연령대</span>
                <input value={form.personaAge} onChange={e => set('personaAge', e.target.value)} placeholder="35-45세" />
              </label>
              <label style={lbl}>
                <span style={lblTxt}>월 소득 수준</span>
                <input value={form.personaIncome} onChange={e => set('personaIncome', e.target.value)} placeholder="500만 원 이상" />
              </label>
            </div>
            <label style={lbl}>
              <span style={lblTxt}>직군/역할</span>
              <input value={form.personaRole} onChange={e => set('personaRole', e.target.value)} placeholder="직장인 러너, 마케터 등" />
            </label>
            <label style={lbl}>
              <span style={lblTxt}>타겟 상세 (선택)</span>
              <textarea value={form.personaContext} onChange={e => set('personaContext', e.target.value)}
                placeholder={"제품: 기능성 러닝화\n퇴근 후 운동하는 30-40대 직장인. 러닝화에 10만 원 이상 지출 경험 있음"}
                rows={3} style={{ resize: 'vertical' }} />
            </label>
          </div>
        )}

        {/* Step 1: 소재 업로드 */}
        {step === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>소재 & 검증 범위</h2>
            <label style={lbl}>
              <span style={lblTxt}>검증할 제품/서비스명</span>
              <input value={form.product} onChange={e => set('product', e.target.value)} placeholder="프리미엄 러닝화 LP" />
            </label>
            <label style={lbl}>
              <span style={lblTxt}>랜딩페이지 URL</span>
              <input value={form.lpUrl} onChange={e => set('lpUrl', e.target.value)} placeholder="https://your-landing-page.com" />
            </label>
            <label style={lbl}>
              <span style={lblTxt}>검증 포커스 (복수 선택)</span>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                {FOCUS.map(f => (
                  <button key={f} onClick={() => toggleFocus(f)} style={{
                    padding: '6px 14px', borderRadius: 'var(--radius)', fontSize: 12, fontWeight: 500,
                    background: form.focusAreas.includes(f) ? 'var(--accent)' : 'var(--surface-2)',
                    color: form.focusAreas.includes(f) ? '#FFFFFF' : 'var(--text-2)',
                    border: '1px solid ' + (form.focusAreas.includes(f) ? 'var(--accent)' : 'var(--border)'),
                    transition: 'all 0.15s', cursor: 'pointer',
                  }}
                  onMouseEnter={e => { if (!form.focusAreas.includes(f)) e.currentTarget.style.background = 'var(--bg-3)'; }}
                  onMouseLeave={e => { if (!form.focusAreas.includes(f)) e.currentTarget.style.background = 'var(--surface-2)'; }}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </label>

            {/* 이미지 업로드 */}
            <label style={lbl}>
              <span style={lblTxt}>검증 이미지 업로드 (선택 · 최대 {MAX_IMAGES}장 · 5MB 이하)</span>
              <div style={{
                border: '2px dashed var(--border)', borderRadius: 'var(--radius)',
                padding: '20px', textAlign: 'center',
                background: form.imageUrls.length >= MAX_IMAGES ? 'var(--surface-2)' : 'var(--surface)',
              }}>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*"
                  disabled={uploading || form.imageUrls.length >= MAX_IMAGES}
                  onChange={handleImageUpload}
                  style={{ display: 'none' }}
                />
                <Btn
                  variant="secondary"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading || form.imageUrls.length >= MAX_IMAGES}
                >
                  {uploading ? '업로드 중...' : '이미지 선택'}
                </Btn>
                <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 8 }}>
                  {form.imageUrls.length >= MAX_IMAGES
                    ? '최대 장수에 도달했습니다.'
                    : '이미지를 업로드하면 패널이 영역을 드래그해 항목별 피드백을 남깁니다.'}
                </div>
                {uploadError && (
                  <div style={{ fontSize: 12, color: 'var(--red)', marginTop: 8 }}>{uploadError}</div>
                )}
              </div>

              {form.imageUrls.length > 0 && (
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
                  {form.imageUrls.map((url, i) => (
                    <div key={url} style={{ position: 'relative' }}>
                      <img
                        src={url}
                        alt={`업로드 ${i + 1}`}
                        style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)', display: 'block' }}
                      />
                      <button
                        onClick={() => removeImage(url)}
                        style={{
                          position: 'absolute', top: -6, right: -6,
                          width: 20, height: 20, borderRadius: '50%',
                          background: 'var(--red)', color: '#fff',
                          border: 'none', fontSize: 13, lineHeight: 1,
                          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                      >×</button>
                    </div>
                  ))}
                </div>
              )}
            </label>

            <label style={lbl}>
              <span style={lblTxt}>패널에게 전달할 브리핑</span>
              <textarea value={form.briefText} onChange={e => set('briefText', e.target.value)}
                placeholder="이 LP는 러닝화 첫 구매자를 타겟으로 합니다. 스크롤 흐름과 CTA 전환 가능성을 중심으로 피드백 부탁드립니다."
                rows={4} style={{ resize: 'vertical' }} />
            </label>
          </div>
        )}

        {/* Step 2: 질문 설정 */}
        {step === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>질문 설정 (선택)</h2>
                <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6 }}>
                  패널에게 추가로 물을 질문을 최대 5개 선택하세요. 선택하지 않으면 기본 5차원 피드백만 수집됩니다.
                </p>
              </div>
              <div style={{
                flexShrink: 0,
                fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 700,
                padding: '4px 12px', borderRadius: 20,
                background: totalLPSelected >= 5 ? 'var(--accent)' : 'var(--surface)',
                color: totalLPSelected >= 5 ? '#fff' : 'var(--text-2)',
                border: '1px solid var(--border)',
                whiteSpace: 'nowrap',
              }}>
                {totalLPSelected}/5 선택됨
              </div>
            </div>

            {/* 서술형 한도 안내 */}
            {textLPSelected >= 2 && (
              <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 'var(--radius)', fontSize: 12, color: 'var(--red)' }}>
                서술형 질문은 최대 2개까지 선택할 수 있습니다.
              </div>
            )}

            {/* 템플릿 아코디언 */}
            {lpTemplates.map(tmpl => {
              const isOpen = !!expandedTmpl[tmpl.id];
              const selectedInTmpl = tmpl.questions.filter(q => selectedQuestions.some(s => s.id === q.id));
              return (
                <div key={tmpl.id} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
                  <div
                    onClick={() => setExpandedTmpl(prev => ({ ...prev, [tmpl.id]: !isOpen }))}
                    style={{
                      display: 'flex', alignItems: 'center', padding: '12px 16px',
                      background: selectedInTmpl.length > 0 ? 'var(--accent-dim)' : 'var(--surface)',
                      cursor: 'pointer', userSelect: 'none', gap: 10,
                    }}
                  >
                    <span style={{ fontSize: 16, flexShrink: 0 }}>{tmpl.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{tmpl.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{tmpl.description}</div>
                    </div>
                    {selectedInTmpl.length > 0 && (
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', marginRight: 4 }}>
                        {selectedInTmpl.length}개 선택
                      </span>
                    )}
                    <span style={{
                      color: 'var(--text-3)', fontSize: 11,
                      transition: 'transform 0.2s',
                      display: 'inline-block',
                      transform: isOpen ? 'rotate(90deg)' : 'none',
                    }}>▶</span>
                  </div>

                  {isOpen && (
                    <div style={{ borderTop: '1px solid var(--border)' }}>
                      {tmpl.questions.map((q, qi) => {
                        const isChecked = selectedQuestions.some(s => s.id === q.id);
                        const disabled  = !isChecked && !canAddLPQ(q);
                        return (
                          <div
                            key={q.id}
                            onClick={() => !disabled && toggleLPQuestion(q)}
                            style={{
                              display: 'flex', gap: 12, alignItems: 'flex-start',
                              padding: '11px 16px',
                              background: isChecked ? 'rgba(232,213,163,0.07)' : 'var(--bg)',
                              cursor: disabled ? 'not-allowed' : 'pointer',
                              opacity: disabled ? 0.4 : 1,
                              borderBottom: qi < tmpl.questions.length - 1 ? '1px solid var(--border)' : 'none',
                              transition: 'background 0.1s',
                            }}
                          >
                            {/* 체크박스 */}
                            <div style={{
                              width: 17, height: 17, borderRadius: 4, flexShrink: 0, marginTop: 2,
                              border: `2px solid ${isChecked ? 'var(--accent)' : 'var(--border)'}`,
                              background: isChecked ? 'var(--accent)' : 'transparent',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                              {isChecked && <span style={{ color: '#fff', fontSize: 10, fontWeight: 800, lineHeight: 1 }}>✓</span>}
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.55 }}>{q.text}</div>
                              <div style={{ marginTop: 5, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                                <span style={{
                                  fontSize: 10, padding: '1px 7px', borderRadius: 4, fontWeight: 600,
                                  background: TYPE_COLOR[q.type] + '22', color: TYPE_COLOR[q.type],
                                }}>
                                  {TYPE_LABEL[q.type]}
                                </span>
                                {q.type === 'radio' && q.options.length > 0 && (
                                  <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
                                    {q.options.join(' / ')}
                                  </span>
                                )}
                                {q.type === 'scale' && (
                                  <span style={{ fontSize: 11, color: 'var(--text-3)' }}>1 — 5점</span>
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

            {/* 선택된 질문 미리보기 */}
            {allLPSelected.length > 0 && (
              <div style={{ padding: '14px 16px', background: 'var(--accent-dim)', borderRadius: 'var(--radius)', border: '1px solid var(--accent)' }}>
                <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--accent)', marginBottom: 10, letterSpacing: '0.05em' }}>선택된 질문 ({allLPSelected.length}개)</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {allLPSelected.map((q, i) => (
                    <div key={q.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                      <span style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', flexShrink: 0, marginTop: 2 }}>Q{i + 1}</span>
                      <span style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.5, flex: 1 }}>{q.text}</span>
                      <span style={{
                        fontSize: 10, padding: '1px 6px', borderRadius: 4, fontWeight: 600, flexShrink: 0,
                        background: TYPE_COLOR[q.type] + '22', color: TYPE_COLOR[q.type],
                      }}>
                        {TYPE_LABEL[q.type]}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {allLPSelected.length === 0 && (
              <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-3)', fontSize: 13 }}>
                위 템플릿에서 질문을 선택하거나, 건너뛰기하면 기본 5차원 피드백만 수집됩니다.
              </div>
            )}
          </div>
        )}

        {/* Step 3: 패널 설정 */}
        {step === 3 && (
          <PanelTargetStep
            plan={companyPlan}
            panelCount={form.panels}
            onPanelCount={(n) => set('panels', n)}
            careerLevels={careerLevels}
            onCareerLevels={setCareerLevels}
          />
        )}

        {/* Step 4: 검토 & 제출 */}
        {step === 4 && (
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>최종 검토</h2>
            {[
              ['제품/서비스', form.product || '—'],
              ['LP URL', form.lpUrl || '—'],
              ['타겟 페르소나', `${form.personaAge}, ${form.personaRole}` || '—'],
              ['패널 수', `${form.panels}명`],
              ['커리어 레벨', careerLevels.map(k => CAREER_LEVELS.find(c => c.key === k)?.label).filter(Boolean).join(', ') || '—'],
              ['예상 크레딧', `${calcCredits(form.panels, careerLevels)} 크레딧`],
              ['검증 포커스', form.focusAreas.join(', ') || '—'],
              ...(allLPSelected.length > 0 ? [['추가 질문', `${allLPSelected.length}개 선택`]] : []),
            ].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ width: 140, color: 'var(--text-3)', fontSize: 13, flexShrink: 0 }}>{k}</span>
                <span style={{ fontWeight: 500, fontSize: 13 }}>{v}</span>
              </div>
            ))}
            {form.imageUrls.length > 0 && (
              <div style={{ display: 'flex', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ width: 140, color: 'var(--text-3)', fontSize: 13, flexShrink: 0 }}>업로드 이미지</span>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {form.imageUrls.map((url, i) => (
                    <img key={url} src={url} alt={`이미지 ${i + 1}`}
                      style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border)' }} />
                  ))}
                </div>
              </div>
            )}
            <div style={{ marginTop: 24, padding: 16, background: 'var(--accent-dim)', borderRadius: 'var(--radius)', fontSize: 13, color: 'var(--text-2)', lineHeight: 1.7 }}>
              ⚡ 의뢰 등록 후 24시간 내 매칭된 패널이 피드백을 시작합니다. Purit Filter를 통과한 피드백만 전달됩니다.
            </div>
            <div style={{ marginTop: 10, padding: '14px 16px', background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius)', lineHeight: 1.75 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#ef4444', marginBottom: 8 }}>⚠️ 수정 가능 시점 안내 (제출 전 반드시 확인)</div>
              <div style={{ fontSize: 12, color: 'var(--text-2)' }}>
                <span style={{ display: 'block', marginBottom: 4 }}>
                  ✅ <strong>제출 직후 ~ 첫 피드백 수신 전</strong>: 대시보드 의뢰 카드에서 수정 가능
                </span>
                <span style={{ display: 'block', color: '#ef4444', fontWeight: 600 }}>
                  🔒 <strong>첫 피드백 수신 즉시</strong>: 수정 영구 잠금 — 의뢰 조기 종료만 가능
                </span>
              </div>
              <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(239,68,68,0.2)', fontSize: 11, color: 'var(--text-3)' }}>
                패널이 응답을 시작한 후 이미지·질문 등 조건을 변경하면 수집된 데이터 전체가 오염됩니다.
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Navigation */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
        <Btn variant="secondary" onClick={() => step > 0 ? setStep(s => s - 1) : navigate('/company')} size="md">
          {step === 0 ? '취소' : '이전'}
        </Btn>
        {submitError && (
          <div style={{ color: 'var(--red)', fontSize: 13, padding: '8px 12px', background: 'var(--red-dim)', borderRadius: 8 }}>
            {submitError}
          </div>
        )}
        <Btn onClick={() => step < STEPS.length - 1 ? setStep(s => s + 1) : handleSubmit()} size="md" disabled={submitting || uploading}>
          {step === STEPS.length - 1 ? (submitting ? '처리 중...' : isEditMode ? '수정 완료 →' : '의뢰 제출 →') : '다음 →'}
        </Btn>
      </div>
    </div>
  );
}

const lbl = { display: 'flex', flexDirection: 'column', gap: 8 };
const lblTxt = { fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' };
