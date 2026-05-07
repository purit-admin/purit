import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Badge, Btn } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { QUESTION_TEMPLATES, TEMPLATE_BY_NAME, TYPE_LABEL, TYPE_COLOR } from '../../lib/templates';

const TABS = [
  { key: 'lp',         label: '마케팅 소재 종합 진단', category: '랜딩페이지', badge: 'blue',  icon: null, path: '/company/new',         desc: '랜딩페이지·광고 소재 등 마케팅 소재를 5차원으로 종합 진단' },
  { key: 'preference', label: '소재 비교 A/B',  category: '광고소재',  badge: 'blue',  icon: null, path: '/company/preference',    desc: '두 소재 중 어떤 것이 더 전환율 높은지 실 패널로 검증' },
  { key: 'pricing',    label: '가격 페이지',     category: '가격',     badge: 'gold',  icon: null, path: '/company/pricing-test',  desc: '가격 구성·플랜 명확성·WTP를 정밀 측정' },
  { key: 'email',      label: '이메일 검증',     category: '이메일',   badge: 'blue',  icon: null, path: '/company/email-test',    desc: '제목줄·개봉 의향·CTA 효과를 패널 피드백으로 진단' },
  { key: 'custom',     label: '커스텀 질문',     category: null,       badge: null,    icon: '➕', path: null,                    desc: '나만의 질문을 직접 만들어 의뢰에 자동 포함하세요' },
];

const CUSTOM_CAT_TABS = [
  { key: 'lp',         label: '마케팅 소재 종합 진단', category: '랜딩페이지' },
  { key: 'preference', label: '소재 비교 A/B',  category: '광고소재' },
  { key: 'pricing',    label: '가격 페이지',    category: '가격' },
  { key: 'email',      label: '이메일 검증',    category: '이메일' },
];

const BADGE_COLORS = { 랜딩페이지: 'blue', 광고소재: 'blue', 가격: 'gold', 이메일: 'blue', LP검증: 'blue', LP: 'blue' };
const TYPE_BG = { radio: 'rgba(59,130,246,0.13)', scale: 'rgba(99,102,241,0.13)', text: 'rgba(52,199,89,0.13)' };
const TYPE_COL = { radio: '#3b82f6', scale: 'var(--accent)', text: '#34C759' };

export default function QuestionTemplates() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('lp');
  const [selected, setSelected] = useState(null);
  const [companyId, setCompanyId] = useState(null);

  // 질문 만들기 탭 전용 상태
  const [customCategory, setCustomCategory] = useState('preference');
  const [customQList, setCustomQList] = useState([]);
  const [customLoading, setCustomLoading] = useState(false);
  const [newQText, setNewQText] = useState('');
  const [newQType, setNewQType] = useState('text');
  const [newQOptions, setNewQOptions] = useState(['', '']);
  const [newQScaleMin, setNewQScaleMin] = useState('');
  const [newQScaleMax, setNewQScaleMax] = useState('');
  const [savingQ, setSavingQ] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => { load(); }, []);
  useEffect(() => { setSelected(null); }, [activeTab]);
  useEffect(() => {
    if (companyId && activeTab === 'custom') loadCustomQs(companyId, customCategory);
  }, [companyId, activeTab, customCategory]);

  async function load() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data: co } = await supabase.from('companies').select('id').eq('user_id', user.id).single();
    if (co) setCompanyId(co.id);

    const baseQuery = supabase
      .from('question_templates')
      .select('*, template_questions(id, question_text, question_order, question_type, options)')
      .order('use_count', { ascending: false });

    const { data, error } = await (co
      ? baseQuery.or(`is_default.eq.true,company_id.eq.${co.id}`)
      : baseQuery.eq('is_default', true));

    if (error) console.error('[QuestionTemplates]', error.message);
    if (data) {
      const allData = [...data];
      // lp 템플릿이 DB에 없으면 로컬 상수로 폴백 (D-31 패턴)
      const hasLp = allData.some(t => t.category === '랜딩페이지' && t.is_default);
      if (!hasLp) {
        (QUESTION_TEMPLATES.lp || []).forEach(t => allData.push({
          ...t, is_default: true, template_questions: [], use_count: 0,
        }));
      }
      setTemplates(allData.map(t => ({
        ...t,
        template_questions: [...(t.template_questions || [])].sort((a, b) => a.question_order - b.question_order),
      })));
    }
    setLoading(false);
  }

  async function loadCustomQs(cid, cat) {
    setCustomLoading(true);
    const catLabel = { lp: '랜딩페이지', preference: '광고소재', pricing: '가격', email: '이메일' }[cat];
    const { data } = await supabase
      .from('question_templates')
      .select('id, template_questions(id, question_text, question_type, options, question_order)')
      .eq('company_id', cid)
      .eq('category', catLabel)
      .eq('is_default', false);
    const qs = (data || []).flatMap(t =>
      (t.template_questions || [])
        .sort((a, b) => a.question_order - b.question_order)
        .map(q => ({ ...q, _templateId: t.id }))
    );
    setCustomQList(qs);
    setCustomLoading(false);
  }

  async function handleSaveCustomQ() {
    if (!newQText.trim() || !companyId) return;
    setSavingQ(true);
    setSaveError('');
    const catLabel = { lp: '랜딩페이지', preference: '광고소재', pricing: '가격', email: '이메일' }[customCategory];
    const options =
      newQType === 'radio' ? newQOptions.filter(o => o.trim()) :
      newQType === 'scale' ? [newQScaleMin.trim(), newQScaleMax.trim()] : [];
    try {
      let { data: tmpl, error: findErr } = await supabase
        .from('question_templates')
        .select('id')
        .eq('company_id', companyId)
        .eq('category', catLabel)
        .eq('is_default', false)
        .maybeSingle();

      if (findErr) throw findErr;

      if (!tmpl) {
        const { data: newT, error: tErr } = await supabase
          .from('question_templates')
          .insert({ company_id: companyId, name: '내 커스텀 질문', category: catLabel,
                    icon: '✏️', description: '직접 만든 질문 모음', is_default: false })
          .select().single();
        if (tErr) throw tErr;
        tmpl = newT;
      }

      const nextOrder = customQList.length + 1;
      const { error: qErr } = await supabase.from('template_questions').insert({
        template_id: tmpl.id,
        question_text: newQText.trim(),
        question_type: newQType,
        options: options,
        question_order: nextOrder,
      });
      if (qErr) throw qErr;

      setNewQText('');
      setNewQType('text');
      setNewQOptions(['', '']);
      setNewQScaleMin('');
      setNewQScaleMax('');
      await loadCustomQs(companyId, customCategory);
    } catch (e) {
      console.error('[CustomQ save]', e.message);
      setSaveError(e.message || '저장에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setSavingQ(false);
    }
  }

  async function handleDeleteCustomQ(qid) {
    await supabase.from('template_questions').delete().eq('id', qid);
    setCustomQList(prev => prev.filter(q => q.id !== qid));
  }

  async function handleUse(template) {
    const tab = TABS.find(t => t.key === activeTab);
    // 로컬 폴백 템플릿(UUID 아닌 id)은 DB update 생략
    const isDbTemplate = template.id && template.id.includes('-') && template.id.length > 20;
    if (isDbTemplate) {
      await supabase.from('question_templates')
        .update({ use_count: (template.use_count || 0) + 1 })
        .eq('id', template.id);
    }
    navigate(tab.path, { state: { templateId: template.id, templateName: template.name } });
  }

  const currentTab = TABS.find(t => t.key === activeTab);
  const filtered = templates.filter(t => t.category === currentTab?.category && t.is_default);
  const selectedTemplate = templates.find(t => t.id === selected);

  const parseOptions = (opts) => {
    if (Array.isArray(opts)) return opts;
    try { return JSON.parse(opts || '[]'); } catch { return []; }
  };

  return (
    <div className="page-wrap" style={{ padding: '40px 48px', maxWidth: 1060, animation: 'fadeUp 0.5s ease both' }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--accent)', marginBottom: 8, letterSpacing: '0.1em' }}>QUESTION TEMPLATES</div>
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 6 }}>질문 템플릿</h1>
        <p style={{ color: 'var(--text-2)', fontSize: 14 }}>의뢰 유형별 검증된 질문 세트를 미리보기하고, 나만의 커스텀 질문을 저장·관리하세요.</p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 28, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '10px 18px',
              fontSize: 13, fontWeight: activeTab === tab.key ? 700 : 500,
              color: activeTab === tab.key ? 'var(--accent)' : 'var(--text-3)',
              background: 'none', border: 'none', cursor: 'pointer',
              borderBottom: activeTab === tab.key ? '2px solid var(--accent)' : '2px solid transparent',
              marginBottom: -1, transition: 'all 0.15s',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            {tab.icon && <span>{tab.icon}</span>}
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── 질문 만들기 탭 ── */}
      {activeTab === 'custom' && (
        <div style={{ display: 'grid', gap: 20 }}>
          {/* 탭 설명 */}
          <div style={{ background: 'var(--accent-dim)', borderRadius: 'var(--radius)', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20 }}>✏️</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--accent)' }}>커스텀 질문</div>
              <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 2 }}>나만의 질문을 만들어 저장하면, 해당 카테고리 의뢰 등록 시 자동으로 나타납니다.</div>
            </div>
          </div>

          {/* 카테고리 선택 */}
          <div style={{ display: 'flex', gap: 8 }}>
            {CUSTOM_CAT_TABS.map(c => (
              <button key={c.key} onClick={() => setCustomCategory(c.key)} style={{
                padding: '8px 16px', borderRadius: 'var(--radius)',
                border: `1px solid ${customCategory === c.key ? 'var(--accent)' : 'var(--border)'}`,
                background: customCategory === c.key ? 'var(--accent-dim)' : 'var(--surface)',
                color: customCategory === c.key ? 'var(--accent)' : 'var(--text-2)',
                fontWeight: 600, fontSize: 13, cursor: 'pointer', transition: 'all 0.15s',
              }}>{c.label}</button>
            ))}
          </div>

          {/* 기존 커스텀 질문 목록 */}
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-2)', marginBottom: 10 }}>
              저장된 커스텀 질문
              <span style={{ fontWeight: 400, fontSize: 12, color: 'var(--text-3)', marginLeft: 8 }}>
                {customLoading ? '로딩 중…' : `${customQList.length}개`}
              </span>
            </div>
            {!customLoading && customQList.length === 0 && (
              <div style={{ padding: '20px', background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
                아직 만든 질문이 없습니다. 아래에서 첫 질문을 추가해보세요.
              </div>
            )}
            {customQList.map((q, i) => {
              const opts = parseOptions(q.options);
              const qType = q.question_type || 'text';
              return (
                <div key={q.id} style={{
                  display: 'flex', gap: 10, alignItems: 'flex-start',
                  padding: '12px 14px', marginBottom: 6,
                  background: 'var(--bg-3)', borderRadius: 'var(--radius)',
                  border: '1px solid var(--border)',
                }}>
                  <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)', fontWeight: 700, fontSize: 12, flexShrink: 0, paddingTop: 2 }}>Q{i + 1}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5 }}>{q.question_text}</div>
                    <div style={{ marginTop: 5, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                      <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 4, fontWeight: 600, background: TYPE_BG[qType], color: TYPE_COL[qType], border: `1px solid ${TYPE_COL[qType]}44` }}>
                        {TYPE_LABEL[qType] || '서술형'}
                      </span>
                      {qType === 'radio' && opts.length > 0 && (
                        <span style={{ fontSize: 11, color: 'var(--text-3)' }}>[{opts.join(' / ')}]</span>
                      )}
                      {qType === 'scale' && (
                        <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
                          {opts[0] || '매우 아니다'} · 1~5 · {opts[1] || '매우 그렇다'}
                        </span>
                      )}
                    </div>
                  </div>
                  <button onClick={() => handleDeleteCustomQ(q.id)} style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--text-3)', fontSize: 16, padding: '2px 4px', flexShrink: 0,
                  }}>×</button>
                </div>
              );
            })}
          </div>

          {/* 질문 빌더 */}
          <Card>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>새 질문 추가</div>

            {/* 질문 텍스트 */}
            <textarea
              value={newQText}
              onChange={e => setNewQText(e.target.value)}
              rows={3}
              placeholder="질문 내용을 입력하세요"
              style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit', fontSize: 13, marginBottom: 14 }}
            />

            {/* 타입 선택 */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 8 }}>질문 타입</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {[['radio', '옵션형'], ['scale', '점수형'], ['text', '서술형']].map(([t, l]) => (
                  <button key={t} onClick={() => setNewQType(t)} style={{
                    padding: '7px 16px', borderRadius: 'var(--radius)',
                    border: `1px solid ${newQType === t ? TYPE_COL[t] : 'var(--border)'}`,
                    background: newQType === t ? TYPE_BG[t] : 'var(--surface)',
                    color: newQType === t ? TYPE_COL[t] : 'var(--text-2)',
                    fontWeight: 600, fontSize: 12, cursor: 'pointer', transition: 'all 0.15s',
                  }}>{l}</button>
                ))}
              </div>
            </div>

            {/* 옵션형: 옵션 목록 */}
            {newQType === 'radio' && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 8 }}>선택지 (최소 2개)</div>
                {newQOptions.map((opt, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: 12, color: 'var(--text-3)', width: 36, flexShrink: 0 }}>옵션 {i + 1}</span>
                    <input
                      value={opt}
                      onChange={e => setNewQOptions(prev => prev.map((o, j) => j === i ? e.target.value : o))}
                      placeholder={`옵션 ${i + 1}`}
                      style={{ flex: 1, padding: '6px 10px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', fontSize: 13, background: 'var(--bg)', color: 'var(--text)' }}
                    />
                    {newQOptions.length > 2 && (
                      <button onClick={() => setNewQOptions(prev => prev.filter((_, j) => j !== i))}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', fontSize: 16, padding: '2px' }}>×</button>
                    )}
                  </div>
                ))}
                {newQOptions.length < 6 && (
                  <button onClick={() => setNewQOptions(prev => [...prev, ''])}
                    style={{ background: 'none', border: '1px dashed var(--border)', borderRadius: 'var(--radius)', padding: '6px 14px', fontSize: 12, color: 'var(--text-3)', cursor: 'pointer', width: '100%', marginTop: 4 }}>
                    + 옵션 추가
                  </button>
                )}
              </div>
            )}

            {/* 점수형: 최솟값·최댓값 라벨 */}
            {newQType === 'scale' && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 8 }}>척도 라벨 (선택)</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {[['1점 라벨', newQScaleMin, setNewQScaleMin, '예: 매우 아니다'], ['5점 라벨', newQScaleMax, setNewQScaleMax, '예: 매우 그렇다']].map(([label, val, setter, ph]) => (
                    <div key={label}>
                      <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 4 }}>{label}</div>
                      <input value={val} onChange={e => setter(e.target.value)} placeholder={ph}
                        style={{ width: '100%', padding: '6px 10px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', fontSize: 13, background: 'var(--bg)', color: 'var(--text)', boxSizing: 'border-box' }} />
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{newQScaleMin || '매우 아니다'}</span>
                  {[1,2,3,4,5].map(n => (
                    <span key={n} style={{ width: 18, height: 18, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, border: '1px solid var(--accent)', color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>{n}</span>
                  ))}
                  <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{newQScaleMax || '매우 그렇다'}</span>
                </div>
              </div>
            )}

            {/* 서술형: 별도 입력 없음 */}
            {newQType === 'text' && (
              <div style={{ marginBottom: 14, padding: '10px 12px', background: 'var(--bg-3)', borderRadius: 'var(--radius)', fontSize: 12, color: 'var(--text-3)' }}>
                패널이 자유롭게 텍스트로 답변합니다. (10자 이상 필수)
              </div>
            )}

            <Btn onClick={handleSaveCustomQ} disabled={savingQ || !newQText.trim() || !companyId}>
              {savingQ ? '저장 중…' : '질문 추가 →'}
            </Btn>
            {saveError && (
              <div style={{ fontSize: 12, color: 'var(--red, #ef4444)', marginTop: 8 }}>{saveError}</div>
            )}
          </Card>
        </div>
      )}

      {/* ── 기존 템플릿 탭들 ── */}
      {activeTab !== 'custom' && (
        <>
          {/* Tab description */}
          <div style={{
            background: 'var(--accent-dim)', borderRadius: 'var(--radius)',
            padding: '12px 16px', marginBottom: 24,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 20 }}>{currentTab?.icon}</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--accent)' }}>{currentTab?.label}</div>
                <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 2 }}>{currentTab?.desc}</div>
              </div>
            </div>
            <Btn size="sm" onClick={() => navigate(currentTab?.path)}
              style={{ background: '#111', color: '#fff', border: 'none' }}>
              바로 의뢰 등록 →
            </Btn>
          </div>

          {loading ? (
            <div style={{ padding: '40px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', fontSize: 13 }}>로딩 중…</div>
          ) : filtered.length === 0 ? (
            <Card style={{ padding: '60px', textAlign: 'center' }}>
              <div style={{ fontSize: 40, marginBottom: 16 }}>{currentTab?.icon}</div>
              <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>이 유형의 템플릿이 없습니다</div>
              <div style={{ color: 'var(--text-2)', fontSize: 13, marginBottom: 20 }}>관리자가 기본 템플릿을 추가하면 여기에 표시됩니다.</div>
              <Btn onClick={() => navigate(currentTab?.path)}>바로 의뢰 등록하기</Btn>
            </Card>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 400px' : '1fr', gap: 20 }}>
              {/* 템플릿 카드 그리드 (섹션 구분 렌더링) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                {(() => {
                  const groups = [];
                  let currentLabel = null;
                  filtered.forEach(t => {
                    const label = t.sectionLabel || null;
                    if (label !== currentLabel) {
                      currentLabel = label;
                      groups.push({ label, items: [] });
                    }
                    groups[groups.length - 1].items.push(t);
                  });
                  return groups.map((group, gi) => (
                    <div key={gi}>
                      {group.label && (
                        <div style={{ marginBottom: 12 }}>
                          <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--accent)', letterSpacing: '0.08em', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>
                            {group.label}
                          </div>
                          <div style={{ height: 1, background: 'var(--border)' }} />
                        </div>
                      )}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
                        {group.items.map(t => (
                          <Card
                            key={t.id}
                            style={{ transition: 'all 0.15s', borderColor: selected === t.id ? 'var(--accent)' : undefined }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div style={{
                                  width: 38, height: 38, borderRadius: 'var(--radius)',
                                  background: 'var(--accent-dim)', display: 'flex', alignItems: 'center',
                                  justifyContent: 'center', fontSize: 18, color: 'var(--accent)',
                                }}>
                                  {t.icon}
                                </div>
                                <div>
                                  <div style={{ fontWeight: 700, fontSize: 14 }}>{t.name}</div>
                                  <Badge type={BADGE_COLORS[t.category] || 'gray'} style={{ marginTop: 4 }}>{t.category}</Badge>
                                </div>
                              </div>
                            </div>
                            <p style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6, marginBottom: 14 }}>{t.description}</p>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
                                {t.template_questions?.length || 0}개 문항 · {t.use_count || 0}회 사용
                              </span>
                              <Btn size="sm" variant="secondary" onClick={() => setSelected(t.id)}>
                                미리보기
                              </Btn>
                            </div>
                          </Card>
                        ))}
                      </div>
                    </div>
                  ));
                })()}
              </div>

              {/* 우측 사이드 패널 */}
              {selectedTemplate && (
                <div style={{ position: 'sticky', top: 24 }}>
                  <Card>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                      <div>
                        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{selectedTemplate.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
                          {(selectedTemplate.template_questions?.length || 0) > 0
                            ? selectedTemplate.template_questions.length
                            : (TEMPLATE_BY_NAME[selectedTemplate.name]?.questions?.length || 0)}개 문항
                        </div>
                      </div>
                      <button
                        onClick={() => setSelected(null)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', fontSize: 18 }}
                      >✕</button>
                    </div>

                    <p style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6, marginBottom: 16 }}>
                      {selectedTemplate.description}
                    </p>

                    <Btn size="sm" onClick={() => handleUse(selectedTemplate)} style={{ width: '100%', marginBottom: 16 }}>
                      이 템플릿으로 의뢰 등록 →
                    </Btn>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {(() => {
                        const dbQs = selectedTemplate.template_questions || [];
                        const localQs = TEMPLATE_BY_NAME[selectedTemplate.name]?.questions || [];
                        const questions = dbQs.length > 0 ? dbQs : localQs;
                        return questions.map((q, i) => {
                          const qType = (q.question_type ?? q.type) || 'text';
                          const qText = q.question_text ?? q.text;
                          const opts = Array.isArray(q.options) ? q.options : (q.options ? JSON.parse(q.options) : []);
                          return (
                            <div key={q.id || i} style={{
                              display: 'flex', gap: 10, padding: '10px 12px',
                              background: 'var(--bg-3)', borderRadius: 'var(--radius)', fontSize: 13,
                              alignItems: 'flex-start',
                            }}>
                              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)', fontWeight: 700, flexShrink: 0, paddingTop: 1 }}>
                                Q{i + 1}
                              </span>
                              <div style={{ flex: 1 }}>
                                <span style={{ color: 'var(--text-2)', lineHeight: 1.6 }}>{qText}</span>
                                {qType === 'scale' && opts.length >= 2 && (
                                  <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-3)' }}>
                                    <span>{opts[0]}</span>
                                    {[1,2,3,4,5].map(n => <span key={n} style={{ width: 14, height: 14, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, border: '1px solid var(--accent)', color: 'var(--accent)' }}>{n}</span>)}
                                    <span>{opts[1]}</span>
                                  </div>
                                )}
                                {qType === 'radio' && opts.length > 0 && (
                                  <div style={{ marginTop: 4, fontSize: 11, color: 'var(--text-3)' }}>[{opts.join(' / ')}]</div>
                                )}
                              </div>
                              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4, flexShrink: 0, background: TYPE_BG[qType], color: TYPE_COL[qType], border: `1px solid ${TYPE_COL[qType]}44` }}>
                                {TYPE_LABEL[qType] || '서술형'}
                              </span>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </Card>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
