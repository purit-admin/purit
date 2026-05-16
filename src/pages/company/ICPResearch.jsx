import { useState, useEffect } from 'react';
import { Card, Badge, Btn } from '../../components/ui';
import { supabase } from '../../lib/supabase';

const FREQ_COLORS = { high: 'green', mid: 'gold', low: 'gray' };
const FREQ_LABELS = { high: '높음', mid: '보통', low: '낮음' };

export default function ICPResearch() {
  const [tab, setTab] = useState('pain');
  const [researches, setResearches] = useState([]);
  const [selected, setSelected] = useState(null);
  const [painPoints, setPainPoints] = useState([]);
  const [buyTriggers, setBuyTriggers] = useState([]);
  const [language, setLanguage] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newPersona, setNewPersona] = useState('');
  const [step, setStep] = useState('list');
  const [companyId, setCompanyId] = useState(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: co } = await supabase.from('companies').select('id').eq('user_id', user.id).single();
      setCompanyId(co?.id);
      if (co) {
        const { data } = await supabase.from('icp_research').select('*').eq('company_id', co.id).order('created_at', { ascending: false });
        setResearches(data || []);
        if (data?.length) await loadDetail(data[0]);
      }
    } catch (err) {
      console.error('[ICPResearch load error]', err);
    } finally {
      setLoading(false);
    }
  }

  async function loadDetail(research) {
    setSelected(research);
    const [pRes, tRes, lRes] = await Promise.all([
      supabase.from('icp_pain_points').select('*').eq('research_id', research.id).order('percent', { ascending: false }),
      supabase.from('icp_buy_triggers').select('*').eq('research_id', research.id).order('priority_rank'),
      supabase.from('icp_language').select('*').eq('research_id', research.id),
    ]);
    setPainPoints(pRes.data || []);
    setBuyTriggers(tRes.data || []);
    setLanguage(lRes.data || []);
  }

  async function handleCreate() {
    if (!newPersona.trim() || !companyId) return;
    setCreating(true);
    const { data, error } = await supabase.from('icp_research').insert({ company_id: companyId, persona_name: newPersona.trim(), status: 'active' }).select().single();
    if (!error) {
      setResearches(rs => [data, ...rs]);
      await loadDetail(data);
      setNewPersona('');
      setStep('detail');
    }
    setCreating(false);
  }

  if (loading) return <div style={{ padding: '40px 48px', color: 'var(--text-3)', fontFamily: 'var(--font-sans)', fontSize: 13 }}>데이터 로딩 중…</div>;

  const hasData = painPoints.length > 0 || buyTriggers.length > 0 || language.length > 0;

  return (
    <div className="page-wrap" style={{ padding: '40px 48px', maxWidth: 900, animation: 'fadeUp 0.5s ease both' }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 12, fontFamily: 'var(--font-sans)', color: 'var(--text-2)', marginBottom: 8, letterSpacing: '0.1em' }}>ICP RESEARCH</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 6 }}>ICP 리서치</h1>
            <p style={{ color: 'var(--text-2)', fontSize: 14 }}>타겟 고객의 언어·고통점·구매 트리거를 패널을 통해 파악합니다.</p>
          </div>
          <Btn onClick={() => setStep(step === 'create' ? (selected ? 'detail' : 'list') : 'create')}>
            {step === 'create' ? '취소' : '+ 새 리서치'}
          </Btn>
        </div>
      </div>

      {step === 'create' && (
        <Card style={{ padding: '24px', marginBottom: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>타겟 페르소나 설정</div>
          <div style={{ display: 'flex', gap: 12 }}>
            <input value={newPersona} onChange={e => setNewPersona(e.target.value)} placeholder="예: 30대 직장인 러너" style={{ flex: 1 }} onKeyDown={e => e.key === 'Enter' && handleCreate()} />
            <Btn onClick={handleCreate} disabled={creating || !newPersona.trim()}>{creating ? '생성 중…' : '리서치 시작'}</Btn>
          </div>
        </Card>
      )}

      {researches.length > 1 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, overflowX: 'auto' }}>
          {researches.map(r => (
            <button key={r.id} onClick={() => { loadDetail(r); setStep('detail'); }} style={{
              padding: '6px 14px', borderRadius: 'var(--radius)', border: `1px solid ${selected?.id === r.id ? 'var(--accent)' : 'var(--border)'}`,
              background: 'var(--surface)', fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap',
              color: selected?.id === r.id ? 'var(--accent)' : 'var(--text)',
            }}>{r.persona_name}</button>
          ))}
        </div>
      )}

      {researches.length === 0 ? (
        <Card style={{ padding: '60px', textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>◈</div>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>ICP 리서치 데이터가 없습니다</div>
          <div style={{ color: 'var(--text-2)', fontSize: 13, marginBottom: 20 }}>타겟 고객의 언어와 구매 트리거를 먼저 파악하면 광고·카피 효율이 높아집니다.</div>
          <Btn onClick={() => setStep('create')}>+ 첫 리서치 시작</Btn>
        </Card>
      ) : !hasData ? (
        <Card style={{ padding: '40px', textAlign: 'center' }}>
          <div style={{ color: 'var(--text-3)', fontSize: 13 }}>
            <strong>{selected?.persona_name}</strong> 리서치가 진행 중입니다. 패널 수집 후 다시 확인하세요.
          </div>
        </Card>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: 'var(--surface)', borderRadius: 'var(--radius)', padding: 4, width: 'fit-content' }}>
            {[['pain', '고통점'], ['triggers', '구매 트리거'], ['language', '고객 언어']].map(([v, l]) => (
              <button key={v} onClick={() => setTab(v)} style={{
                padding: '7px 18px', borderRadius: 4, fontSize: 13, fontWeight: 500,
                background: tab === v ? 'var(--bg)' : 'transparent',
                color: tab === v ? 'var(--text)' : 'var(--text-3)',
                border: 'none', cursor: 'pointer', transition: 'all 0.15s',
              }}>{l}</button>
            ))}
          </div>

          {tab === 'pain' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {painPoints.length === 0 ? <div style={{ color: 'var(--text-3)', fontSize: 13 }}>데이터 없음</div> :
                painPoints.map(p => (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 18px', background: 'var(--surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
                    <div style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>{p.pain_text}</div>
                    <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 800, fontSize: 16, color: 'var(--text)', flexShrink: 0 }}>{p.percent}%</div>
                    <div style={{ width: 120, height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden', flexShrink: 0 }}>
                      <div style={{ width: `${p.percent}%`, height: '100%', background: 'var(--accent)', borderRadius: 3 }} />
                    </div>
                  </div>
                ))
              }
            </div>
          )}

          {tab === 'triggers' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {buyTriggers.length === 0 ? <div style={{ color: 'var(--text-3)', fontSize: 13 }}>데이터 없음</div> :
                buyTriggers.map((t, i) => (
                  <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 18px', background: 'var(--surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: i === 0 ? 'var(--accent)' : 'var(--border)', color: i === 0 ? '#fff' : 'var(--text-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13, flexShrink: 0 }}>{i + 1}</div>
                    <div style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>{t.trigger_text}</div>
                    <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 800, fontSize: 16, color: 'var(--green)', flexShrink: 0 }}>{t.percent}%</div>
                  </div>
                ))
              }
            </div>
          )}

          {tab === 'language' && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {language.length === 0 ? <div style={{ color: 'var(--text-3)', fontSize: 13 }}>데이터 없음</div> :
                language.map(l => (
                  <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', background: 'var(--surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
                    <span style={{ fontSize: 14, fontWeight: 500 }}>"{l.phrase}"</span>
                    <Badge type={FREQ_COLORS[l.frequency] || 'gray'}>{FREQ_LABELS[l.frequency] || l.frequency}</Badge>
                  </div>
                ))
              }
            </div>
          )}
        </>
      )}
    </div>
  );
}
