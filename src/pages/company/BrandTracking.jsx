import { useState, useEffect } from 'react';
import { Card, Stat, Badge, Btn } from '../../components/ui';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts';
import { supabase } from '../../lib/supabase';

export default function BrandTracking() {
  const [campaign, setCampaign] = useState(null);
  const [monthlyData, setMonthlyData] = useState([]);
  const [perceptions, setPerceptions] = useState([]);
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
      const { data: cam } = await supabase.from('brand_tracking_campaigns').select('*').eq('company_id', co.id).eq('status', 'active').order('created_at', { ascending: false }).limit(1).single();
      setCampaign(cam);
      if (cam) {
        const [mRes, pRes] = await Promise.all([
          supabase.from('brand_tracking_monthly').select('*').eq('campaign_id', cam.id).order('month_label'),
          supabase.from('brand_perception_items').select('*').eq('campaign_id', cam.id).order('agreement_percent', { ascending: false }),
        ]);
        setMonthlyData(mRes.data || []);
        setPerceptions(pRes.data || []);
      }
    }
    setLoading(false);
  }

  async function handleStart() {
    if (!companyId) return;
    setCreating(true);
    const { data, error } = await supabase.from('brand_tracking_campaigns').insert({ company_id: companyId, panel_size: 30, status: 'active' }).select().single();
    if (!error) {
      setCampaign(data);
      setMonthlyData([]);
      setPerceptions([]);
    }
    setCreating(false);
  }

  if (loading) return <div style={{ padding: '40px 48px', color: 'var(--text-3)', fontFamily: 'var(--font-sans)', fontSize: 13 }}>데이터 로딩 중…</div>;

  const latest = monthlyData[monthlyData.length - 1];
  const chartData = monthlyData.map(d => ({
    month: d.month_label,
    인지도: Number(d.awareness_percent),
    명확성: Number(d.clarity_score) * 20,
    차별화: Number(d.differentiation_score) * 20,
    NPS: Number(d.nps_score),
  }));

  return (
    <div className="page-wrap" style={{ padding: '40px 48px', maxWidth: 1060, animation: 'fadeUp 0.5s ease both' }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 12, fontFamily: 'var(--font-sans)', color: 'var(--text-2)', marginBottom: 8, letterSpacing: '0.1em' }}>BRAND TRACKING</div>
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 6 }}>브랜드 추적</h1>
        <p style={{ color: 'var(--text-2)', fontSize: 14 }}>매월 타겟 고객 패널을 통해 브랜드 인지도·포지셔닝 변화를 추적합니다.</p>
      </div>

      {!campaign ? (
        <Card style={{ padding: '60px', textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>◆</div>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>브랜드 추적 캠페인이 없습니다</div>
          <div style={{ color: 'var(--text-2)', fontSize: 13, marginBottom: 20 }}>월간 브랜드 추적을 시작하면 광고 효과를 정량적으로 측정할 수 있습니다.</div>
          <Btn onClick={handleStart} disabled={creating}>{creating ? '시작 중…' : '브랜드 추적 시작'}</Btn>
        </Card>
      ) : monthlyData.length === 0 ? (
        <Card style={{ padding: '40px', textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
          <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 8 }}>첫 번째 월간 데이터 수집 중</div>
          <div style={{ color: 'var(--text-2)', fontSize: 13 }}>패널 조사가 완료되면 여기에 결과가 표시됩니다.</div>
        </Card>
      ) : (
        <>
          {/* KPI */}
          {latest && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, background: 'var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', marginBottom: 28 }}>
              {[
                { label: '브랜드 인지도', value: `${latest.awareness_percent}%`, accent: true },
                { label: '메시지 명확성', value: `${Number(latest.clarity_score).toFixed(1)}/5` },
                { label: '차별화 점수', value: `${Number(latest.differentiation_score).toFixed(1)}/5` },
                { label: 'NPS', value: String(latest.nps_score) },
              ].map(s => (
                <div key={s.label} style={{ background: 'var(--surface)', padding: '22px 24px' }}>
                  <Stat {...s} />
                </div>
              ))}
            </div>
          )}

          {/* Trend chart */}
          <Card style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 16 }}>월간 추이 (%로 정규화)</div>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="month" tick={{ fill: 'var(--text-3)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text-3)', fontSize: 11 }} axisLine={false} tickLine={false} unit="%" />
                <Tooltip contentStyle={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12 }} />
                <Line type="monotone" dataKey="인지도" stroke="var(--accent)" strokeWidth={2} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="명확성" stroke="var(--blue)" strokeWidth={2} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="차별화" stroke="#C084FC" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </Card>

          {/* Perceptions */}
          {perceptions.length > 0 && (
            <Card>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 16 }}>브랜드 인식 항목</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {perceptions.map(p => (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ width: 200, fontSize: 13, flexShrink: 0 }}>{p.statement}</div>
                    <div style={{ flex: 1, height: 8, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ width: `${p.agreement_percent}%`, height: '100%', background: 'var(--accent)', borderRadius: 4, transition: 'width 0.8s ease' }} />
                    </div>
                    <span style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 14, width: 44, textAlign: 'right', flexShrink: 0 }}>{p.agreement_percent}%</span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
