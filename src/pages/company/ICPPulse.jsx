import { useState, useEffect } from 'react';
import { Card, Badge, Btn, Stat } from '../../components/ui';
import { supabase } from '../../lib/supabase';

export default function ICPPulse() {
  const [subscription, setSubscription] = useState(null);
  const [quarters, setQuarters] = useState([]);
  const [selectedQ, setSelectedQ] = useState(null);
  const [pains, setPains] = useState([]);
  const [gains, setGains] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [companyId, setCompanyId] = useState(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const { data: co } = await supabase.from('companies').select('id').eq('user_id', user.id).single();
    setCompanyId(co?.id);
    if (co) {
      const { data: sub } = await supabase.from('icp_pulse_subscriptions').select('*').eq('company_id', co.id).eq('status', 'active').single();
      setSubscription(sub);
      if (sub) {
        const { data: qs } = await supabase.from('icp_pulse_quarters').select('*').eq('subscription_id', sub.id).order('collected_at', { ascending: false });
        setQuarters(qs || []);
        if (qs?.length) await loadQuarterDetail(qs[0]);
      }
    }
    setLoading(false);
  }

  async function loadQuarterDetail(q) {
    setSelectedQ(q);
    const [pRes, gRes] = await Promise.all([
      supabase.from('icp_pulse_pains').select('*').eq('quarter_id', q.id).order('frequency_percent', { ascending: false }),
      supabase.from('icp_pulse_gains').select('*').eq('quarter_id', q.id).order('frequency_percent', { ascending: false }),
    ]);
    setPains(pRes.data || []);
    setGains(gRes.data || []);
  }

  async function handleSubscribe() {
    if (!companyId) return;
    setCreating(true);
    const { data, error } = await supabase.from('icp_pulse_subscriptions').insert({ company_id: companyId, panel_size: 20, status: 'active' }).select().single();
    if (!error) {
      setSubscription(data);
      setQuarters([]);
    }
    setCreating(false);
  }

  if (loading) return <div style={{ padding: '40px 48px', color: 'var(--text-3)', fontFamily: 'var(--font-sans)', fontSize: 13 }}>데이터 로딩 중…</div>;

  return (
    <div className="page-wrap" style={{ padding: '40px 48px', maxWidth: 900, animation: 'fadeUp 0.5s ease both' }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 12, fontFamily: 'var(--font-sans)', color: 'var(--text-2)', marginBottom: 8, letterSpacing: '0.1em' }}>ICP PULSE</div>
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 6 }}>ICP Pulse</h1>
        <p style={{ color: 'var(--text-2)', fontSize: 14 }}>분기마다 타겟 고객 인사이트를 자동 수집해 시장 변화를 추적합니다.</p>
      </div>

      {!subscription ? (
        <Card style={{ padding: '60px', textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>◆</div>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>ICP Pulse 구독이 없습니다</div>
          <div style={{ color: 'var(--text-2)', fontSize: 13, marginBottom: 20 }}>분기별 자동 ICP 추적을 시작하면 시장 변화를 조기에 감지할 수 있습니다.</div>
          <Btn onClick={handleSubscribe} disabled={creating}>{creating ? '시작 중…' : '구독 시작하기'}</Btn>
        </Card>
      ) : quarters.length === 0 ? (
        <Card style={{ padding: '40px', textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
          <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 8 }}>첫 번째 분기 데이터 수집 중</div>
          <div style={{ color: 'var(--text-2)', fontSize: 13 }}>패널 조사가 완료되면 여기에 결과가 표시됩니다.</div>
          <div style={{ marginTop: 16, fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--font-sans)' }}>
            구독 시작일: {new Date(subscription.created_at).toLocaleDateString('ko-KR')} · 패널 {subscription.panel_size}명
          </div>
        </Card>
      ) : (
        <>
          {/* Quarter selector */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 24, overflowX: 'auto' }}>
            {quarters.map(q => (
              <button key={q.id} onClick={() => loadQuarterDetail(q)} style={{
                padding: '8px 16px', borderRadius: 'var(--radius)', border: `1px solid ${selectedQ?.id === q.id ? 'var(--accent)' : 'var(--border)'}`,
                background: 'var(--surface)', fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap',
                color: selectedQ?.id === q.id ? 'var(--accent)' : 'var(--text)', fontWeight: selectedQ?.id === q.id ? 700 : 400,
              }}>{q.quarter_label}</button>
            ))}
          </div>

          {selectedQ && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
                {selectedQ.buying_trigger && (
                  <Card>
                    <div style={{ fontSize: 11, fontFamily: 'var(--font-sans)', color: 'var(--text-3)', marginBottom: 8 }}>TOP 구매 트리거</div>
                    <div style={{ fontSize: 15, fontWeight: 600 }}>{selectedQ.buying_trigger}</div>
                  </Card>
                )}
                {selectedQ.top_channel && (
                  <Card>
                    <div style={{ fontSize: 11, fontFamily: 'var(--font-sans)', color: 'var(--text-3)', marginBottom: 8 }}>TOP 유입 채널</div>
                    <div style={{ fontSize: 15, fontWeight: 600 }}>{selectedQ.top_channel}</div>
                  </Card>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>주요 고통점</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {pains.length === 0 ? <div style={{ color: 'var(--text-3)', fontSize: 13 }}>데이터 없음</div> :
                      pains.map(p => (
                        <div key={p.id} style={{ padding: '10px 14px', background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', borderLeft: '3px solid var(--red)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: 13 }}>{p.pain_text}</span>
                            <span style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, color: 'var(--red)', fontSize: 13, marginLeft: 8 }}>{p.frequency_percent}%</span>
                          </div>
                        </div>
                      ))
                    }
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>원하는 결과</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {gains.length === 0 ? <div style={{ color: 'var(--text-3)', fontSize: 13 }}>데이터 없음</div> :
                      gains.map(g => (
                        <div key={g.id} style={{ padding: '10px 14px', background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', borderLeft: '3px solid var(--green)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: 13 }}>{g.gain_text}</span>
                            <span style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, color: 'var(--green)', fontSize: 13, marginLeft: 8 }}>{g.frequency_percent}%</span>
                          </div>
                        </div>
                      ))
                    }
                  </div>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
