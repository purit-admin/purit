import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Card, Btn, Badge } from '../../components/ui';
import { supabase } from '../../lib/supabase';

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

export default function PreferenceTest() {
  const location = useLocation();
  const initTemplateId = location.state?.templateId || null;

  const [step, setStep] = useState('list');
  const [assetType, setAssetType] = useState('');
  const [variantA, setVariantA] = useState('');
  const [variantB, setVariantB] = useState('');
  const [panelSize, setPanelSize] = useState(10);
  const [tests, setTests] = useState([]);
  const [selectedTest, setSelectedTest] = useState(null);
  const [results, setResults] = useState(null);
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
      const t = templates.find(x => x.id === selectedTemplateId);
      setSelectedTemplate(t || null);
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
        supabase.from('preference_tests').select('*').eq('company_id', co.id).order('created_at', { ascending: false }),
        supabase.from('question_templates')
          .select('*, template_questions(id, question_text, question_order)')
          .eq('category', '광고소재')
          .eq('is_default', true),
      ]);
      setTests(testsData || []);
      const sorted = (tmplData || []).map(t => ({
        ...t,
        template_questions: [...(t.template_questions || [])].sort((a, b) => a.question_order - b.question_order),
      }));
      setTemplates(sorted);
      if (initTemplateId && !selectedTemplate) {
        setSelectedTemplate(sorted.find(t => t.id === initTemplateId) || null);
      }
    }
    setLoading(false);
  }

  async function handleSubmit() {
    if (!variantA.trim() || !variantB.trim() || !assetType || !companyId) return;
    setSubmitting(true);
    try {
      // 1. missions INSERT
      const missionId = crypto.randomUUID();
      const { error: mErr } = await supabase.from('missions').insert({
        id: missionId,
        company_id: companyId,
        title: `소재 비교: ${ASSET_TYPES.find(a => a.key === assetType)?.label || assetType}`,
        type: 'preference',
        description: JSON.stringify({ variantA: variantA.trim(), variantB: variantB.trim() }),
        panel_count: panelSize,
        reward_amount: (PRICE_PER[panelSize] || 90) * 1000,
        status: 'active',
        assets: selectedTemplate ? [selectedTemplate.name] : [],
      });
      if (mErr) throw mErr;

      // 2. preference_tests INSERT
      const { data, error } = await supabase.from('preference_tests').insert({
        company_id: companyId,
        asset_type: assetType,
        variant_a: variantA.trim(),
        variant_b: variantB.trim(),
        panel_size: panelSize,
        status: 'active',
        mission_id: missionId,
        template_id: selectedTemplateId || null,
      }).select().single();
      if (error) throw error;

      setTests(ts => [data, ...ts]);
      setStep('list');
      setVariantA(''); setVariantB(''); setAssetType(''); setSelectedTemplateId(initTemplateId);
    } catch (err) {
      console.error('[PreferenceTest] 등록 실패:', err.message);
    } finally {
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
      const avgClarity = responses.filter(r => r.message_clarity).reduce((s, r) => s + r.message_clarity, 0) / (responses.filter(r => r.message_clarity).length || 1);
      const avgIntent = responses.filter(r => r.purchase_intent).reduce((s, r) => s + r.purchase_intent, 0) / (responses.filter(r => r.purchase_intent).length || 1);
      setResults({
        total,
        aPercent: total ? Math.round((aCount / total) * 100) : 0,
        bPercent: total ? Math.round(((total - aCount) / total) * 100) : 0,
        aComments: responses.filter(r => r.preference === 'A' && r.comment).map(r => r.comment),
        bComments: responses.filter(r => r.preference === 'B' && r.comment).map(r => r.comment),
        avgClarity: responses.some(r => r.message_clarity) ? avgClarity.toFixed(1) : null,
        avgIntent: responses.some(r => r.purchase_intent) ? avgIntent.toFixed(1) : null,
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
          {step === 'list' && <Btn onClick={() => setStep('create')}>+ 새 테스트</Btn>}
          {step === 'create' && <Btn variant="ghost" onClick={() => setStep('list')}>취소</Btn>}
        </div>
      </div>

      {/* ── 생성 폼 ── */}
      {step === 'create' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* 소재 유형 */}
          <Card>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>1. 소재 유형 선택</div>
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
          </Card>

          {assetType && (
            <>
              {/* 소재 입력 */}
              <Card>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>2. 소재 A / B 입력</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  {[['A', variantA, setVariantA, 'var(--blue)'], ['B', variantB, setVariantB, 'var(--accent)']].map(([label, val, setter, color]) => (
                    <div key={label}>
                      <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8, fontWeight: 700 }}>
                        소재 {label}
                      </div>
                      <textarea
                        value={val}
                        onChange={e => setter(e.target.value)}
                        rows={5}
                        placeholder={`소재 ${label} 텍스트를 입력하세요\n(카피, 문구, 이미지 URL 등)`}
                        style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit', fontSize: 13, borderLeft: `3px solid ${color}` }}
                      />
                    </div>
                  ))}
                </div>
              </Card>

              {/* 패널 + 템플릿 */}
              <Card>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>3. 패널 설정 & 질문 템플릿</div>
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
                        style={{
                          padding: '10px 14px', borderRadius: 'var(--radius)',
                          border: `1px solid ${!selectedTemplateId ? 'var(--accent)' : 'var(--border)'}`,
                          background: !selectedTemplateId ? 'var(--accent-dim)' : 'var(--surface)',
                          cursor: 'pointer', fontSize: 13, color: 'var(--text-2)', transition: 'all 0.15s',
                        }}
                      >
                        기본 A/B 선호도 질문만 사용
                      </div>
                      {templates.map(t => (
                        <div
                          key={t.id}
                          onClick={() => setSelectedTemplateId(t.id)}
                          style={{
                            padding: '10px 14px', borderRadius: 'var(--radius)',
                            border: `1px solid ${selectedTemplateId === t.id ? 'var(--accent)' : 'var(--border)'}`,
                            background: selectedTemplateId === t.id ? 'var(--accent-dim)' : 'var(--surface)',
                            cursor: 'pointer', transition: 'all 0.15s',
                          }}
                        >
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

              <Btn onClick={handleSubmit} disabled={submitting || !variantA.trim() || !variantB.trim()}>
                {submitting ? '등록 중…' : '테스트 의뢰 시작 →'}
              </Btn>
            </>
          )}
        </div>
      )}

      {/* ── 목록 ── */}
      {step === 'list' && (
        tests.length === 0 ? (
          <Card style={{ padding: '60px', textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>◎</div>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>등록된 테스트가 없습니다</div>
            <div style={{ color: 'var(--text-2)', fontSize: 13, marginBottom: 20 }}>두 소재를 비교해 더 효과적인 카피를 찾아보세요.</div>
            <Btn onClick={() => setStep('create')}>+ 첫 테스트 시작</Btn>
          </Card>
        ) : (
          <div style={{ display: 'grid', gap: 14 }}>
            {tests.map(test => (
              <Card key={test.id} style={{ cursor: 'pointer' }} onClick={() => { loadResults(test); setStep('result'); }}>
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
      {step === 'result' && selectedTest && (
        <div>
          <button onClick={() => { setStep('list'); setSelectedTest(null); setResults(null); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontSize: 13, marginBottom: 20 }}>
            ← 목록으로
          </button>

          {!results || results.total === 0 ? (
            <Card style={{ padding: '40px', textAlign: 'center' }}>
              <div style={{ color: 'var(--text-3)', fontSize: 13 }}>아직 응답이 없습니다. 패널 수집 후 다시 확인하세요.</div>
            </Card>
          ) : (
            <div style={{ display: 'grid', gap: 16 }}>
              {/* A/B 선호도 바 */}
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
                    <div style={{ padding: '12px', background: 'var(--bg-3)', borderRadius: 'var(--radius)', textAlign: 'center' }}>
                      <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>{results.avgClarity}<span style={{ fontSize: 14 }}>/5</span></div>
                      <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>메시지 명확성</div>
                    </div>
                    <div style={{ padding: '12px', background: 'var(--bg-3)', borderRadius: 'var(--radius)', textAlign: 'center' }}>
                      <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>{results.avgIntent}<span style={{ fontSize: 14 }}>/5</span></div>
                      <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>구매 전환 의향</div>
                    </div>
                  </div>
                )}
              </Card>

              {/* 코멘트 */}
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
