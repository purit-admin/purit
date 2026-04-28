import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Card, Badge, Btn } from '../../components/ui';
import { supabase } from '../../lib/supabase';

const METRIC_META = {
  hook:      { label: '훅 강도',    color: 'var(--accent)', desc: '첫 문장이 계속 읽게 만드는가?' },
  clarity:   { label: '제안 명확성', color: 'var(--blue)',   desc: '무엇을 원하는지 즉시 이해되는가?' },
  curiosity: { label: '호기심 유발', color: '#C084FC',       desc: '답장하고 싶은 욕구를 만드는가?' },
  relevance: { label: '관련성',     color: 'var(--green)',  desc: '나와 관련있는 내용이라고 느끼는가?' },
};

const PANEL_COUNTS = [10, 15, 20, 30];
const PRICE_PER = { 10: 90, 15: 130, 20: 170, 30: 250 };

export default function ColdEmailTest() {
  const location = useLocation();
  const initTemplateId = location.state?.templateId || null;

  const [step, setStep] = useState('list');
  const [emailText, setEmailText] = useState('');
  const [panelSize, setPanelSize] = useState(10);
  const [tests, setTests] = useState([]);
  const [selectedTest, setSelectedTest] = useState(null);
  const [metrics, setMetrics] = useState([]);
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
        supabase.from('cold_email_tests').select('*').eq('company_id', co.id).order('created_at', { ascending: false }),
        supabase.from('question_templates')
          .select('*, template_questions(id, question_text, question_order)')
          .eq('category', '이메일')
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

  async function handleSubmit() {
    if (!emailText.trim() || !companyId) return;
    setSubmitting(true);
    try {
      // 1. missions INSERT
      const missionId = crypto.randomUUID();
      const firstLine = emailText.trim().split('\n')[0].replace(/^제목[:：]\s*/i, '').slice(0, 50);
      const { error: mErr } = await supabase.from('missions').insert({
        id: missionId,
        company_id: companyId,
        title: `이메일 검증: ${firstLine || '콜드메일'}`,
        type: 'email',
        description: emailText.trim(),
        panel_count: panelSize,
        reward_amount: (PRICE_PER[panelSize] || 90) * 1000,
        status: 'active',
        assets: selectedTemplate ? [selectedTemplate.name] : [],
      });
      if (mErr) throw mErr;

      // 2. cold_email_tests INSERT
      const { data: test, error } = await supabase.from('cold_email_tests').insert({
        company_id: companyId,
        email_text: emailText.trim(),
        status: 'active',
        mission_id: missionId,
        template_id: selectedTemplateId || null,
      }).select().single();
      if (error) throw error;

      setTests(ts => [test, ...ts]);
      setEmailText('');
      setSelectedTemplateId(initTemplateId);
      setStep('list');
    } catch (err) {
      console.error('[ColdEmailTest] 등록 실패:', err.message);
    } finally {
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
    setStep('result');
  }

  if (loading) return <div style={{ padding: '40px 48px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', fontSize: 13 }}>로딩 중…</div>;

  const replyCount = responses.filter(r => r.would_reply).length;
  const replyRate = responses.length ? Math.round((replyCount / responses.length) * 100) : 0;
  const avgOpenIntent = responses.filter(r => r.open_intent).reduce((s, r) => s + r.open_intent, 0) / (responses.filter(r => r.open_intent).length || 1);
  const avgCuriosity = responses.filter(r => r.curiosity_score).reduce((s, r) => s + r.curiosity_score, 0) / (responses.filter(r => r.curiosity_score).length || 1);

  return (
    <div style={{ padding: '40px 48px', maxWidth: 900, animation: 'fadeUp 0.5s ease both' }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--accent)', marginBottom: 8, letterSpacing: '0.1em' }}>COLD EMAIL TEST</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 6 }}>이메일 검증</h1>
            <p style={{ color: 'var(--text-2)', fontSize: 14 }}>대량 발송 전 타겟 패널에게 먼저 검증받아 개봉률과 답장율을 높이세요.</p>
          </div>
          {step === 'list' && <Btn onClick={() => setStep('create')}>+ 새 테스트</Btn>}
          {step !== 'list' && <Btn variant="ghost" onClick={() => { setStep('list'); setSelectedTest(null); }}>← 목록</Btn>}
        </div>
      </div>

      {/* ── 생성 폼 ── */}
      {step === 'create' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <Card>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>1. 이메일 원문 입력</div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 10 }}>
              제목줄부터 서명까지 전체 이메일 내용을 입력하세요. 패널이 실제로 받는 것처럼 검토합니다.
            </div>
            <textarea
              value={emailText}
              onChange={e => setEmailText(e.target.value)}
              rows={12}
              placeholder={'제목: [이메일 제목줄]\n\n안녕하세요, [이름]님.\n\n[이메일 본문 내용 전체]\n\n[CTA 문구]\n\n감사합니다.\n[발신자 이름]'}
              style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit', fontSize: 13, lineHeight: 1.7 }}
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
                  >기본 이메일 평가 질문만 사용</div>
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

          <Btn onClick={handleSubmit} disabled={submitting || !emailText.trim()}>
            {submitting ? '등록 중…' : '이메일 검증 의뢰 시작 →'}
          </Btn>
        </div>
      )}

      {/* ── 목록 ── */}
      {step === 'list' && (
        tests.length === 0 ? (
          <Card style={{ padding: '60px', textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>✉</div>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>등록된 이메일 테스트가 없습니다</div>
            <div style={{ color: 'var(--text-2)', fontSize: 13, marginBottom: 20 }}>발송 전 패널 검증으로 개봉률과 답장율을 높여보세요.</div>
            <Btn onClick={() => setStep('create')}>+ 첫 테스트 시작</Btn>
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
      {step === 'result' && selectedTest && (
        <div style={{ display: 'grid', gap: 16 }}>
          {metrics.length === 0 && responses.length === 0 ? (
            <Card style={{ padding: '40px', textAlign: 'center' }}>
              <div style={{ color: 'var(--text-3)', fontSize: 13 }}>아직 패널 응답이 없습니다. 수집 후 다시 확인하세요.</div>
            </Card>
          ) : (
            <>
              {/* 핵심 KPI */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                {[
                  { label: '예상 답장율', value: `${replyRate}%`, color: replyRate >= 20 ? 'var(--green)' : replyRate >= 10 ? 'var(--accent)' : 'var(--red)' },
                  { label: '개봉 의향', value: responses.some(r => r.open_intent) ? `${avgOpenIntent.toFixed(1)}/5` : '—', color: 'var(--blue)' },
                  { label: '호기심 유발', value: responses.some(r => r.curiosity_score) ? `${avgCuriosity.toFixed(1)}/5` : '—', color: '#C084FC' },
                ].map(s => (
                  <div key={s.label} style={{ padding: '16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', textAlign: 'center' }}>
                    <div style={{ fontSize: 24, fontWeight: 800, color: s.color, fontFamily: 'var(--font-mono)' }}>{s.value}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 6 }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {/* 4축 점수 */}
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

              {/* 이메일 원문 */}
              <Card>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>검증된 이메일 원문</div>
                <pre style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-word', background: 'var(--bg-3)', padding: '14px', borderRadius: 'var(--radius)', margin: 0 }}>
                  {selectedTest.email_text}
                </pre>
              </Card>

              {/* 패널 피드백 */}
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
