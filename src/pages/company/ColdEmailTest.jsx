import { useState, useEffect } from 'react';
import { Card, Badge, Btn } from '../../components/ui';
import { supabase } from '../../lib/supabase';

const METRIC_META = {
  hook:      { label: '훅 강도',    color: 'var(--accent)', desc: '첫 문장이 계속 읽게 만드는가?' },
  clarity:   { label: '제안 명확성', color: 'var(--blue)',   desc: '무엇을 원하는지 즉시 이해되는가?' },
  curiosity: { label: '호기심 유발', color: '#C084FC',       desc: '답장하고 싶은 욕구를 만드는가?' },
  relevance: { label: '관련성',     color: 'var(--green)',  desc: '나와 관련있는 내용이라고 느끼는가?' },
};

export default function ColdEmailTest() {
  const [step, setStep] = useState('list');
  const [emailText, setEmailText] = useState('');
  const [tests, setTests] = useState([]);
  const [selectedTest, setSelectedTest] = useState(null);
  const [metrics, setMetrics] = useState([]);
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
      const { data } = await supabase.from('cold_email_tests').select('*').eq('company_id', co.id).order('created_at', { ascending: false });
      setTests(data || []);
    }
    setLoading(false);
  }

  async function handleSubmit() {
    if (!emailText.trim() || !companyId) return;
    setSubmitting(true);
    const { data: test, error } = await supabase.from('cold_email_tests').insert({ company_id: companyId, email_text: emailText.trim(), status: 'active' }).select().single();
    if (!error) {
      setTests(ts => [test, ...ts]);
      setEmailText('');
      setStep('list');
    }
    setSubmitting(false);
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

  if (loading) return <div style={{ padding: '40px 48px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', fontSize: 13 }}>데이터 로딩 중…</div>;

  const replyRate = responses.length ? Math.round((responses.filter(r => r.would_reply).length / responses.length) * 100) : 0;

  return (
    <div style={{ padding: '40px 48px', maxWidth: 900, animation: 'fadeUp 0.5s ease both' }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--accent)', marginBottom: 8, letterSpacing: '0.1em' }}>COLD EMAIL TEST</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 6 }}>콜드메일 테스트</h1>
            <p style={{ color: 'var(--text-2)', fontSize: 14 }}>대량 발송 전 타겟 패널에게 먼저 검증받아 답장율을 높이세요.</p>
          </div>
          {step === 'list' && <Btn onClick={() => setStep('create')}>+ 새 테스트</Btn>}
          {step !== 'list' && <Btn variant="ghost" onClick={() => { setStep('list'); setSelectedTest(null); }}>← 목록</Btn>}
        </div>
      </div>

      {step === 'create' && (
        <Card style={{ padding: '28px' }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>이메일 본문 입력</div>
          <textarea
            value={emailText}
            onChange={e => setEmailText(e.target.value)}
            rows={12}
            placeholder="제목: [이메일 제목]&#10;&#10;안녕하세요...&#10;&#10;이메일 전체 내용을 입력하세요."
            style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit', fontSize: 13, marginBottom: 16 }}
          />
          <Btn onClick={handleSubmit} disabled={submitting || !emailText.trim()}>{submitting ? '등록 중…' : '테스트 시작'}</Btn>
        </Card>
      )}

      {step === 'list' && (
        tests.length === 0 ? (
          <Card style={{ padding: '60px', textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>✉</div>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>등록된 콜드메일 테스트가 없습니다</div>
            <div style={{ color: 'var(--text-2)', fontSize: 13, marginBottom: 20 }}>발송 전 패널 검증으로 답장율을 높여보세요.</div>
            <Btn onClick={() => setStep('create')}>+ 첫 테스트 시작</Btn>
          </Card>
        ) : (
          <div style={{ display: 'grid', gap: 14 }}>
            {tests.map(test => (
              <Card key={test.id} style={{ cursor: 'pointer' }} onClick={() => loadResults(test)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <Badge type={test.status === 'completed' ? 'green' : 'gold'} style={{ marginBottom: 8 }}>{test.status === 'completed' ? '완료' : '진행중'}</Badge>
                    <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5, maxWidth: 600 }}>
                      {test.email_text.slice(0, 100)}{test.email_text.length > 100 ? '…' : ''}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 8, fontFamily: 'var(--font-mono)' }}>{new Date(test.created_at).toLocaleDateString('ko-KR')}</div>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--accent)', flexShrink: 0, marginLeft: 16 }}>결과 보기 →</div>
                </div>
              </Card>
            ))}
          </div>
        )
      )}

      {step === 'result' && selectedTest && (
        <div>
          {metrics.length === 0 && responses.length === 0 ? (
            <Card style={{ padding: '40px', textAlign: 'center' }}>
              <div style={{ color: 'var(--text-3)', fontSize: 13 }}>아직 패널 응답이 없습니다. 수집 후 다시 확인하세요.</div>
            </Card>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, background: 'var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', marginBottom: 24 }}>
                {[
                  { label: '예상 답장율', value: `${replyRate}%`, accent: true },
                  ...Object.entries(METRIC_META).map(([key, meta]) => {
                    const m = metrics.find(x => x.metric_key === key);
                    return { label: meta.label, value: m ? `${Number(m.score).toFixed(1)}/5` : '—' };
                  }),
                ].map(s => (
                  <div key={s.label} style={{ background: 'var(--surface)', padding: '18px 20px' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginBottom: 6 }}>{s.label}</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: s.accent ? 'var(--accent)' : 'var(--text)' }}>{s.value}</div>
                  </div>
                ))}
              </div>

              {metrics.length > 0 && (
                <Card style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>4축 점수</div>
                  {Object.entries(METRIC_META).map(([key, meta]) => {
                    const m = metrics.find(x => x.metric_key === key);
                    const score = m ? Number(m.score) : 0;
                    return (
                      <div key={key} style={{ marginBottom: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
                          <span style={{ fontWeight: 600 }}>{meta.label}</span>
                          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, color: meta.color }}>{score.toFixed(1)}/5</span>
                        </div>
                        <div style={{ height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ width: `${(score / 5) * 100}%`, height: '100%', background: meta.color, borderRadius: 3, transition: 'width 0.8s ease' }} />
                        </div>
                      </div>
                    );
                  })}
                </Card>
              )}

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
                      {r.comment && <div style={{ fontSize: 13, color: 'var(--text-2)', paddingLeft: 0, borderLeft: '2px solid var(--border)', paddingLeft: 10 }}>"{r.comment}"</div>}
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
