import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Card, Btn, Badge } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { QUESTION_TEMPLATES, TYPE_LABEL, TYPE_COLOR } from '../../lib/templates';

const ASSET_TYPES = [
  { key: 'headline',   label: '헤드라인 카피', icon: '◎', desc: '두 헤드라인 중 구매 욕구를 더 자극하는 쪽' },
  { key: 'cta',        label: 'CTA 문구',      icon: '▲', desc: '클릭을 유도하는 버튼 텍스트 비교' },
  { key: 'value_prop', label: '가치 제안',     icon: '◆', desc: '핵심 가치를 설명하는 두 방식 비교' },
  { key: 'lp_section', label: 'LP 섹션',       icon: '◈', desc: '랜딩페이지 특정 섹션의 두 버전 비교' },
  { key: 'ad_copy',    label: '광고 소재',     icon: '●', desc: '두 광고 소재 중 전환 가능성 높은 쪽' },
  { key: 'email',      label: '이메일 제목',   icon: '✉', desc: '두 이메일 제목 중 열람율이 높을 쪽' },
];

const PANEL_COUNTS = [10, 15, 20, 30];
const PRICE_PER = { 10: 90, 15: 130, 20: 170, 30: 250 };
const STEPS = ['소재 유형', '소재 입력', '제품 설명', '질문 설정'];

export default function PreferenceTest() {
  const location = useLocation();
  const navigate = useNavigate();
  const initTemplateId = location.state?.templateId || null;
  const submittingRef = useRef(false);

  const [view, setView] = useState('list');
  const [createStep, setCreateStep] = useState(0);
  const [missionUuid, setMissionUuid] = useState(() => crypto.randomUUID());

  // Step 0
  const [assetType, setAssetType] = useState('');
  // Step 1
  const [variantA, setVariantA] = useState('');
  const [variantB, setVariantB] = useState('');
  const [variantAImage, setVariantAImage] = useState(null);
  const [variantBImage, setVariantBImage] = useState(null);
  const [uploadingA, setUploadingA] = useState(false);
  const [uploadingB, setUploadingB] = useState(false);
  // Step 2
  const [productDescription, setProductDescription] = useState('');
  // Step 3
  const [panelSize, setPanelSize] = useState(10);
  const [selectedQuestions, setSelectedQuestions] = useState([]);
  const [expandedTmpl, setExpandedTmpl] = useState({});
  const [customQTexts, setCustomQTexts] = useState([]);

  const [tests, setTests] = useState([]);
  const [selectedTest, setSelectedTest] = useState(null);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [companyId, setCompanyId] = useState(null);

  const fileInputARef = useRef(null);
  const fileInputBRef = useRef(null);

  const initTemplateName = location.state?.templateName || null;

  useEffect(() => {
    load();
    if (initTemplateId) {
      setView('create');
      setCreateStep(3);
      if (initTemplateName) {
        const target = QUESTION_TEMPLATES.preference.find(t => t.name === initTemplateName);
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
        .from('preference_tests').select('*').eq('company_id', co.id).order('created_at', { ascending: false });
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

  async function handleImageUpload(variant, file) {
    if (!file || !companyId) return;
    const loadingSetter = variant === 'A' ? setUploadingA : setUploadingB;
    const imageSetter = variant === 'A' ? setVariantAImage : setVariantBImage;
    const fileName = variant === 'A' ? 'va' : 'vb';
    loadingSetter(true);
    try {
      const ext = file.name.split('.').pop().toLowerCase();
      const path = `${companyId}/${missionUuid}/${fileName}.${ext}`;
      const { error } = await supabase.storage.from('mission-assets').upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('mission-assets').getPublicUrl(path);
      imageSetter(publicUrl);
    } catch (err) {
      console.error('[PreferenceTest] 이미지 업로드 실패:', err.message);
    } finally {
      loadingSetter(false);
    }
  }

  async function handleSubmit() {
    if (!variantA.trim() || !variantB.trim() || !assetType || !companyId) return;
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    try {
      const { error: mErr } = await supabase.from('missions').insert({
        id: missionUuid,
        company_id: companyId,
        title: `소재 비교: ${ASSET_TYPES.find(a => a.key === assetType)?.label || assetType}`,
        type: 'preference',
        description: JSON.stringify({
          variantA: variantA.trim(),
          variantB: variantB.trim(),
          variantAImage: variantAImage || null,
          variantBImage: variantBImage || null,
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

      const { error: tErr } = await supabase.from('preference_tests').insert({
        company_id: companyId,
        asset_type: assetType,
        variant_a: variantA.trim(),
        variant_b: variantB.trim(),
        panel_size: panelSize,
        status: 'active',
        mission_id: missionUuid,
        template_id: null,
      });
      if (tErr) console.warn('[PreferenceTest] 서브테이블 등록 실패:', tErr.message);

      setMissionUuid(crypto.randomUUID());
      navigate('/company');
    } catch (err) {
      console.error('[PreferenceTest] 등록 실패:', err.message);
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  async function loadResults(test) {
    setSelectedTest(test);
    const { data: responses } = await supabase
      .from('preference_responses')
      .select('preference, comment, message_clarity, purchase_intent')
      .eq('test_id', test.id);
    if (responses) {
      const total = responses.length;
      const aCount = responses.filter(r => r.preference === 'A').length;
      const clarityVals = responses.filter(r => r.message_clarity);
      const intentVals = responses.filter(r => r.purchase_intent);
      setResults({
        total, aPercent: total ? Math.round((aCount / total) * 100) : 0,
        bPercent: total ? Math.round(((total - aCount) / total) * 100) : 0,
        aComments: responses.filter(r => r.preference === 'A' && r.comment).map(r => r.comment),
        bComments: responses.filter(r => r.preference === 'B' && r.comment).map(r => r.comment),
        avgClarity: clarityVals.length ? (clarityVals.reduce((s, r) => s + r.message_clarity, 0) / clarityVals.length).toFixed(1) : null,
        avgIntent: intentVals.length ? (intentVals.reduce((s, r) => s + r.purchase_intent, 0) / intentVals.length).toFixed(1) : null,
      });
    }
  }

  if (loading) return <div style={{ padding: '40px 48px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', fontSize: 13 }}>로딩 중…</div>;

  return (
    <div style={{ padding: '40px 48px', maxWidth: 900, animation: 'fadeUp 0.5s ease both' }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--accent)', marginBottom: 8, letterSpacing: '0.1em' }}>PREFERENCE TEST</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 6 }}>소재 비교 A/B</h1>
            <p style={{ color: 'var(--text-2)', fontSize: 14 }}>두 소재를 패널에게 제시하고, 어느 쪽이 더 전환에 기여하는지 측정합니다.</p>
          </div>
          {view === 'create' && <Btn variant="ghost" onClick={() => setView('list')}>취소</Btn>}
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
            {/* Step 0: 소재 유형 선택 */}
            {createStep === 0 && (
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>소재 유형을 선택하세요</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                  {ASSET_TYPES.map(t => (
                    <div key={t.key} onClick={() => setAssetType(t.key)} style={{
                      padding: '14px 16px', borderRadius: 'var(--radius)',
                      border: `1px solid ${assetType === t.key ? 'var(--accent)' : 'var(--border)'}`,
                      cursor: 'pointer',
                      background: assetType === t.key ? 'var(--accent-dim)' : 'var(--surface)',
                      transition: 'all 0.15s',
                    }}>
                      <div style={{ fontSize: 18, marginBottom: 6 }}>{t.icon}</div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{t.label}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4, lineHeight: 1.4 }}>{t.desc}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Step 1: 소재 A/B 입력 + 이미지 업로드 */}
            {createStep === 1 && (
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>소재 A / B 입력</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  {[
                    ['A', variantA, setVariantA, variantAImage, setVariantAImage, uploadingA, fileInputARef, 'var(--blue)'],
                    ['B', variantB, setVariantB, variantBImage, setVariantBImage, uploadingB, fileInputBRef, 'var(--accent)'],
                  ].map(([label, val, setter, img, imgSetter, uploading, ref, color]) => (
                    <div key={label}>
                      <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8, fontWeight: 700 }}>소재 {label}</div>
                      <textarea
                        value={val}
                        onChange={e => setter(e.target.value)}
                        rows={5}
                        placeholder={`소재 ${label} 텍스트를 입력하세요\n(카피, 문구, 설명 등)`}
                        style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit', fontSize: 13, borderLeft: `3px solid ${color}`, marginBottom: 10 }}
                      />
                      <input type="file" accept="image/*" ref={ref} style={{ display: 'none' }}
                        onChange={e => { if (e.target.files[0]) handleImageUpload(label, e.target.files[0]); e.target.value = ''; }} />
                      {img ? (
                        <div style={{ position: 'relative', display: 'inline-block' }}>
                          <img src={img} alt={`소재 ${label}`} style={{ width: '100%', maxHeight: 160, objectFit: 'cover', borderRadius: 6, border: `1px solid ${color}` }} />
                          <button onClick={() => imgSetter(null)} style={{
                            position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: '50%',
                            background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>×</button>
                        </div>
                      ) : (
                        <Btn variant="secondary" size="sm" disabled={uploading} onClick={() => ref.current?.click()}>
                          {uploading ? '업로드 중...' : '이미지 추가 (선택)'}
                        </Btn>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Step 2: 제품/타겟 설명 */}
            {createStep === 2 && (
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>제품 / 타겟 설명</div>
                <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 16 }}>패널에게 표시됩니다. 어떤 제품인지, 어떤 타겟을 대상으로 하는지 간단히 적어주세요.</p>
                <textarea
                  value={productDescription}
                  onChange={e => setProductDescription(e.target.value)}
                  rows={4}
                  placeholder={"예) 제품명: 기능성 러닝화 / 타겟: 30-40대 직장인 러너"}
                  style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit', fontSize: 13 }}
                />
              </div>
            )}

            {/* Step 3: 패널 수 & 질문 설정 */}
            {createStep === 3 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                {/* 패널 수 */}
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

                {/* 질문 설정 */}
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

                  {QUESTION_TEMPLATES.preference.map(tmpl => {
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

                  {/* 커스텀 질문 (서술형) */}
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

          {/* 네비게이션 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20 }}>
            <Btn variant="secondary" onClick={() => createStep > 0 ? setCreateStep(s => s - 1) : setView('list')}>
              {createStep === 0 ? '취소' : '이전'}
            </Btn>
            {createStep < STEPS.length - 1 ? (
              <Btn onClick={() => setCreateStep(s => s + 1)} disabled={
                (createStep === 0 && !assetType) ||
                (createStep === 1 && (!variantA.trim() || !variantB.trim()))
              }>
                다음 →
              </Btn>
            ) : (
              <Btn onClick={handleSubmit} disabled={submitting || !variantA.trim() || !variantB.trim()}>
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
            <div style={{ fontSize: 40, marginBottom: 16 }}>◎</div>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>등록된 테스트가 없습니다</div>
            <div style={{ color: 'var(--text-2)', fontSize: 13, marginBottom: 20 }}>두 소재를 비교해 더 효과적인 카피를 찾아보세요.</div>
            <Btn onClick={() => { setView('create'); setCreateStep(0); }}>+ 새 테스트</Btn>
          </Card>
        ) : (
          <div style={{ display: 'grid', gap: 14 }}>
            {tests.map(test => (
              <Card key={test.id} style={{ cursor: 'pointer' }} onClick={() => { loadResults(test); setView('result'); }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <Badge type={test.status === 'completed' ? 'green' : 'gold'} style={{ marginBottom: 8 }}>
                      {test.status === 'completed' ? '완료' : '진행중'}
                    </Badge>
                    <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>
                      {ASSET_TYPES.find(a => a.key === test.asset_type)?.label || test.asset_type}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
                      패널 {test.panel_size}명 · {new Date(test.created_at).toLocaleDateString('ko-KR')}
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--accent)' }}>결과 보기 →</div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 14 }}>
                  {[['A', test.variant_a, 'var(--blue)'], ['B', test.variant_b, 'var(--accent)']].map(([label, text, color]) => (
                    <div key={label} style={{ padding: '10px 12px', background: 'var(--bg-3)', borderRadius: 'var(--radius)', fontSize: 13, color: 'var(--text-2)', borderLeft: `3px solid ${color}` }}>
                      <span style={{ fontWeight: 700, color, marginRight: 6 }}>{label}</span>
                      {text.slice(0, 60)}{text.length > 60 ? '…' : ''}
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        )
      )}

      {/* ── 결과 ── */}
      {view === 'result' && selectedTest && (
        <div>
          <button onClick={() => { setView('list'); setSelectedTest(null); setResults(null); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontSize: 13, marginBottom: 20 }}>
            ← 목록으로
          </button>
          {!results || results.total === 0 ? (
            <Card style={{ padding: '40px', textAlign: 'center' }}>
              <div style={{ color: 'var(--text-3)', fontSize: 13 }}>아직 응답이 없습니다. 패널 수집 후 다시 확인하세요.</div>
            </Card>
          ) : (
            <div style={{ display: 'grid', gap: 16 }}>
              <Card>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>선호도 결과 ({results.total}명 응답)</div>
                {[['A', results.aPercent, 'var(--blue)'], ['B', results.bPercent, 'var(--accent)']].map(([label, pct, color]) => (
                  <div key={label} style={{ marginBottom: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
                      <span style={{ fontWeight: 700, color }}>소재 {label}</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, color }}>{pct}%</span>
                    </div>
                    <div style={{ height: 12, background: 'var(--border)', borderRadius: 6, overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 6, transition: 'width 0.8s ease' }} />
                    </div>
                  </div>
                ))}
                {results.avgClarity && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                    {[['메시지 명확성', results.avgClarity], ['구매 전환 의향', results.avgIntent]].map(([lbl, val]) => (
                      <div key={lbl} style={{ padding: '12px', background: 'var(--bg-3)', borderRadius: 'var(--radius)', textAlign: 'center' }}>
                        <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>{val}<span style={{ fontSize: 14 }}>/5</span></div>
                        <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>{lbl}</div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
              {[['A', results.aComments, 'var(--blue)'], ['B', results.bComments, 'var(--accent)']].map(([label, comments, color]) =>
                comments.length > 0 && (
                  <div key={label}>
                    <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, color }}>소재 {label} 코멘트</div>
                    {comments.map((c, i) => (
                      <div key={i} style={{ padding: '10px 14px', background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', fontSize: 13, color: 'var(--text-2)', marginBottom: 6, borderLeft: `3px solid ${color}` }}>
                        "{c}"
                      </div>
                    ))}
                  </div>
                )
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
