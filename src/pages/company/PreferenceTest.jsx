import { useState, useEffect } from 'react';
import { Card, Btn, Badge } from '../../components/ui';
import { supabase } from '../../lib/supabase';

const ASSET_TYPES = [
  { key: 'headline',   label: '헤드라인 카피', icon: '◎', desc: '두 가지 헤드라인 중 어느 쪽이 더 구매 욕구를 자극하는가' },
  { key: 'cta',        label: 'CTA 문구',      icon: '▲', desc: '클릭을 유도하는 버튼 텍스트 비교' },
  { key: 'value_prop', label: '가치 제안',     icon: '◆', desc: '제품의 핵심 가치를 설명하는 두 방식 비교' },
  { key: 'lp_section', label: 'LP 섹션',       icon: '◈', desc: '랜딩페이지 특정 섹션의 두 버전 비교' },
  { key: 'ad_copy',    label: '광고 소재',     icon: '●', desc: '두 광고 소재 중 클릭/전환 가능성이 높은 쪽' },
  { key: 'email',      label: '이메일 제목',   icon: '✉', desc: '두 이메일 제목 중 열람율이 높을 쪽' },
];

export default function PreferenceTest() {
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

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const { data: co } = await supabase.from('companies').select('id').eq('user_id', user.id).single();
    setCompanyId(co?.id);
    if (co) {
      const { data } = await supabase.from('preference_tests').select('*').eq('company_id', co.id).order('created_at', { ascending: false });
      setTests(data || []);
    }
    setLoading(false);
  }

  async function handleSubmit() {
    if (!variantA.trim() || !variantB.trim() || !assetType || !companyId) return;
    setSubmitting(true);
    const { data, error } = await supabase.from('preference_tests').insert({
      company_id: companyId, asset_type: assetType, variant_a: variantA.trim(), variant_b: variantB.trim(), panel_size: panelSize, status: 'active',
    }).select().single();
    if (!error) {
      setTests(ts => [data, ...ts]);
      setStep('list');
      setVariantA(''); setVariantB(''); setAssetType('');
    }
    setSubmitting(false);
  }

  async function loadResults(test) {
    setSelectedTest(test);
    const { data: responses } = await supabase.from('preference_responses').select('preference, comment').eq('test_id', test.id);
    if (responses) {
      const total = responses.length;
      const aCount = responses.filter(r => r.preference === 'A').length;
      const aComments = responses.filter(r => r.preference === 'A' && r.comment).map(r => r.comment);
      const bComments = responses.filter(r => r.preference === 'B' && r.comment).map(r => r.comment);
      setResults({ total, aPercent: total ? Math.round((aCount / total) * 100) : 0, bPercent: total ? Math.round(((total - aCount) / total) * 100) : 0, aComments, bComments });
    }
  }

  if (loading) return <div style={{ padding: '40px 48px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', fontSize: 13 }}>데이터 로딩 중…</div>;

  return (
    <div style={{ padding: '40px 48px', maxWidth: 900, animation: 'fadeUp 0.5s ease both' }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--accent)', marginBottom: 8, letterSpacing: '0.1em' }}>PREFERENCE TEST</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 6 }}>선호도 테스트</h1>
            <p style={{ color: 'var(--text-2)', fontSize: 14 }}>두 가지 소재를 패널에게 제시하고 어느 쪽이 더 전환에 기여하는지 측정합니다.</p>
          </div>
          {step === 'list' && <Btn onClick={() => setStep('create')}>+ 새 테스트</Btn>}
          {step === 'create' && <Btn variant="ghost" onClick={() => setStep('list')}>취소</Btn>}
        </div>
      </div>

      {step === 'create' && (
        <Card style={{ padding: '28px' }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 20 }}>소재 유형 선택</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 24 }}>
            {ASSET_TYPES.map(t => (
              <div key={t.key} onClick={() => setAssetType(t.key)} style={{ padding: '14px 16px', borderRadius: 'var(--radius)', border: `1px solid ${assetType === t.key ? 'var(--accent)' : 'var(--border)'}`, cursor: 'pointer', background: assetType === t.key ? 'var(--accent-dim)' : 'var(--surface)', transition: 'all 0.15s' }}>
                <div style={{ fontSize: 18, marginBottom: 6 }}>{t.icon}</div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{t.label}</div>
                <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4, lineHeight: 1.4 }}>{t.desc}</div>
              </div>
            ))}
          </div>
          {assetType && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                {[['A', variantA, setVariantA], ['B', variantB, setVariantB]].map(([label, val, setter]) => (
                  <div key={label}>
                    <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>소재 {label}</div>
                    <textarea value={val} onChange={e => setter(e.target.value)} rows={4} placeholder={`소재 ${label} 텍스트를 입력하세요`} style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit', fontSize: 13 }} />
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 20 }}>
                <label style={{ fontSize: 13 }}>패널 수:
                  <select value={panelSize} onChange={e => setPanelSize(Number(e.target.value))} style={{ marginLeft: 8 }}>
                    {[10, 15, 20, 30].map(n => <option key={n} value={n}>{n}명</option>)}
                  </select>
                </label>
              </div>
              <Btn onClick={handleSubmit} disabled={submitting}>{submitting ? '등록 중…' : '테스트 시작'}</Btn>
            </>
          )}
        </Card>
      )}

      {step === 'list' && (
        tests.length === 0 ? (
          <Card style={{ padding: '60px', textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>◎</div>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>등록된 선호도 테스트가 없습니다</div>
            <div style={{ color: 'var(--text-2)', fontSize: 13, marginBottom: 20 }}>두 소재를 비교해 더 효과적인 카피를 찾아보세요.</div>
            <Btn onClick={() => setStep('create')}>+ 첫 테스트 시작</Btn>
          </Card>
        ) : (
          <div style={{ display: 'grid', gap: 14 }}>
            {tests.map(test => (
              <Card key={test.id} style={{ cursor: 'pointer' }} onClick={() => { loadResults(test); setStep('result'); }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <Badge type={test.status === 'completed' ? 'green' : 'gold'} style={{ marginBottom: 8 }}>{test.status === 'completed' ? '완료' : '진행중'}</Badge>
                    <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>
                      {ASSET_TYPES.find(a => a.key === test.asset_type)?.label || test.asset_type}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-2)' }}>패널 {test.panel_size}명 · {new Date(test.created_at).toLocaleDateString('ko-KR')}</div>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--accent)' }}>결과 보기 →</div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 14 }}>
                  {['A', 'B'].map((label, i) => (
                    <div key={label} style={{ padding: '10px 12px', background: 'var(--bg-3)', borderRadius: 'var(--radius)', fontSize: 13, color: 'var(--text-2)', borderLeft: `2px solid ${i === 0 ? 'var(--blue)' : 'var(--accent)'}` }}>
                      <span style={{ fontWeight: 700, color: i === 0 ? 'var(--blue)' : 'var(--accent)', marginRight: 6 }}>{label}</span>
                      {(i === 0 ? test.variant_a : test.variant_b).slice(0, 60)}{(i === 0 ? test.variant_a : test.variant_b).length > 60 ? '…' : ''}
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        )
      )}

      {step === 'result' && selectedTest && (
        <div>
          <button onClick={() => { setStep('list'); setSelectedTest(null); setResults(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontSize: 13, marginBottom: 20 }}>← 목록으로</button>
          {!results || results.total === 0 ? (
            <Card style={{ padding: '40px', textAlign: 'center' }}>
              <div style={{ color: 'var(--text-3)', fontSize: 13 }}>아직 응답이 없습니다. 패널 수집 후 다시 확인하세요.</div>
            </Card>
          ) : (
            <div>
              <Card style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>선호도 결과 ({results.total}명 응답)</div>
                {[{ label: 'A', pct: results.aPercent, color: 'var(--blue)' }, { label: 'B', pct: results.bPercent, color: 'var(--accent)' }].map(({ label, pct, color }) => (
                  <div key={label} style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
                      <span style={{ fontWeight: 700, color }}>{label}</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, color }}>{pct}%</span>
                    </div>
                    <div style={{ height: 10, background: 'var(--border)', borderRadius: 5, overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 5, transition: 'width 0.8s ease' }} />
                    </div>
                  </div>
                ))}
              </Card>
              {[{ label: 'A', comments: results.aComments, color: 'var(--blue)' }, { label: 'B', comments: results.bComments, color: 'var(--accent)' }].map(({ label, comments, color }) => comments.length > 0 && (
                <div key={label} style={{ marginBottom: 16 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, color }}>소재 {label} 코멘트</div>
                  {comments.map((c, i) => (
                    <div key={i} style={{ padding: '10px 14px', background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', fontSize: 13, color: 'var(--text-2)', marginBottom: 6, borderLeft: `3px solid ${color}` }}>"{c}"</div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
