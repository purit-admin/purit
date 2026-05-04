import { useState, useEffect } from 'react';
import { Card, Stat, Badge, Btn } from '../../components/ui';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, LineChart, Line, CartesianGrid } from 'recharts';
import { supabase } from '../../lib/supabase';

export default function RevenueManagement() {
  const [tab, setTab] = useState('overview');
  const [gmvData, setGmvData] = useState([]);
  const [settlements, setSettlements] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    const [gmvRes, settRes, invRes] = await Promise.all([
      supabase.from('gmv_snapshots').select('*').order('year').order('month_num'),
      supabase.from('settlements').select('*').order('created_at', { ascending: false }),
      supabase.from('invoices').select('*').order('invoice_date', { ascending: false }),
    ]);
    if (!gmvRes.error) setGmvData(gmvRes.data);
    if (!settRes.error) setSettlements(settRes.data);
    if (!invRes.error) setInvoices(invRes.data);
    setLoading(false);
  }

  async function handleSettle(id) {
    const { error } = await supabase
      .from('settlements')
      .update({ status: 'paid' })
      .eq('id', id);
    if (!error) setSettlements(s => s.map(x => x.id === id ? { ...x, status: 'paid' } : x));
  }

  async function handleSettleAll() {
    const pendingIds = settlements.filter(s => s.status === 'pending').map(s => s.id);
    if (!pendingIds.length) return;
    const { error } = await supabase
      .from('settlements')
      .update({ status: 'paid' })
      .in('id', pendingIds);
    if (!error) setSettlements(s => s.map(x => pendingIds.includes(x.id) ? { ...x, status: 'paid' } : x));
  }

  async function handleInvoiceStatus(id, newStatus) {
    const { error } = await supabase
      .from('invoices')
      .update({ status: newStatus })
      .eq('id', id);
    if (!error) setInvoices(inv => inv.map(x => x.id === id ? { ...x, status: newStatus } : x));
  }

  if (loading) return (
    <div style={{ padding: '40px 48px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', fontSize: 13 }}>
      데이터 로딩 중…
    </div>
  );

  const lastMonth = gmvData[gmvData.length - 1];
  const monthlyGMV = lastMonth ? lastMonth.gmv * 10000 : 0;
  const marginRate = lastMonth ? Math.round((lastMonth.margin / lastMonth.gmv) * 100) : 0;
  const pendingAmt = settlements.filter(s => s.status === 'pending').reduce((a, s) => a + Number(s.amount), 0);
  const pendingInvAmt = invoices.filter(i => i.status === 'pending').reduce((a, i) => a + Number(i.amount), 0);

  const chartData = gmvData.map(d => ({
    month: d.month_label,
    gmv: Number(d.gmv),
    margin: Number(d.margin),
    panel_pay: Number(d.panel_pay),
  }));

  return (
    <div className="page-wrap" style={{ padding: '40px 48px', maxWidth: 1060, animation: 'fadeUp 0.5s ease both' }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--accent)', marginBottom: 8, letterSpacing: '0.1em' }}>ADMIN · REVENUE</div>
        <h1 style={{ fontSize: 28, fontWeight: 800 }}>수익 & 정산 관리</h1>
      </div>

      {/* KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, background: 'var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', marginBottom: 28 }}>
        {[
          { label: '이번 달 GMV', raw: monthlyGMV, accent: true },
          { label: '영업 마진율', value: `${marginRate}%`, sub: '목표 40%+' },
          { label: '패널 정산 대기', raw: pendingAmt },
          { label: '미수금 (기업)', raw: pendingInvAmt },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--surface)', padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</div>
            {s.raw != null ? (
              <div style={{ lineHeight: 1 }}>
                <div style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 700, letterSpacing: '0.08em', marginBottom: 3 }}>KRW</div>
                <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--text)' }}>{Math.round(s.raw).toLocaleString()}</div>
              </div>
            ) : (
              <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1 }}>{s.value}</div>
            )}
            {s.sub && <div style={{ fontSize: 13, color: 'var(--text-3)' }}>{s.sub}</div>}
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: 'var(--surface)', borderRadius: 'var(--radius)', padding: 4, width: 'fit-content' }}>
        {[['overview', 'GMV 차트'], ['settlements', '패널 정산'], ['invoices', '기업 청구']].map(([v, l]) => (
          <button key={v} onClick={() => setTab(v)} style={{
            padding: '7px 18px', borderRadius: 4, fontSize: 13, fontWeight: 500,
            background: tab === v ? 'var(--bg)' : 'transparent',
            color: tab === v ? 'var(--text)' : 'var(--text-3)',
            border: 'none', cursor: 'pointer', transition: 'all 0.15s',
          }}>{l}</button>
        ))}
      </div>

      {tab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <Card>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 16 }}>월간 GMV / 마진 (만 원)</div>
            {chartData.length === 0 ? (
              <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)', fontSize: 13 }}>
                데이터 없음
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData} barGap={4}>
                  <XAxis dataKey="month" tick={{ fill: 'var(--text-3)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'var(--text-3)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12 }} />
                  <Bar dataKey="gmv" fill="var(--border-light)" radius={[4, 4, 0, 0]} name="GMV" />
                  <Bar dataKey="margin" fill="var(--accent)" radius={[4, 4, 0, 0]} name="마진" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>
          <Card>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 16 }}>마진율 추이 (%)</div>
            {chartData.length === 0 ? (
              <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)', fontSize: 13 }}>
                데이터 없음
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="month" tick={{ fill: 'var(--text-3)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'var(--text-3)', fontSize: 11 }} axisLine={false} tickLine={false} unit="%" domain={[30, 50]} />
                  <Tooltip
                    contentStyle={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12 }}
                    formatter={(v, n, p) => [`${Math.round((p.payload.margin / p.payload.gmv) * 100)}%`, '마진율']}
                  />
                  <Line type="monotone" dataKey={(d) => Math.round((d.margin / d.gmv) * 100)} stroke="var(--green)" strokeWidth={2.5} dot={{ fill: 'var(--green)', r: 4 }} name="마진율" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </Card>
        </div>
      )}

      {tab === 'settlements' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 14, color: 'var(--text-2)' }}>
              정산 대기 <strong style={{ color: 'var(--accent)' }}>₩{(pendingAmt / 10000).toFixed(1)}만</strong> · {settlements.filter(s => s.status === 'pending').length}건
            </div>
            <Btn size="sm" onClick={handleSettleAll}>일괄 정산 처리</Btn>
          </div>
          {settlements.length === 0 ? (
            <Card><div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>정산 데이터 없음</div></Card>
          ) : (
            <Card style={{ padding: 0, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {['패널', '등급', '미션', '정산액', '마감일', '상태', ''].map(h => (
                      <th key={h} style={{ padding: '12px 18px', textAlign: 'left', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {settlements.map((s, i) => (
                    <tr key={s.id} style={{ borderBottom: i < settlements.length - 1 ? '1px solid var(--border)' : 'none' }}>
                      <td style={{ padding: '12px 18px', fontWeight: 600, fontSize: 13 }}>{s.panel_name}</td>
                      <td style={{ padding: '12px 18px' }}><Badge type={s.tier === 'EXPERT' ? 'gold' : 'blue'}>{s.tier}</Badge></td>
                      <td style={{ padding: '12px 18px', fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-2)' }}>{s.missions_count}건</td>
                      <td style={{ padding: '12px 18px' }}>
                        {s.status === 'rejected' ? (
                          <span style={{ color: 'var(--text-3)', fontWeight: 700 }}>—</span>
                        ) : (
                          <div style={{ lineHeight: 1 }}>
                            <div style={{ fontSize: 9, color: 'var(--text-3)', fontWeight: 700, letterSpacing: '0.08em', marginBottom: 2 }}>KRW</div>
                            <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-mono)', color: s.status === 'paid' ? 'var(--green)' : 'var(--accent)' }}>{Number(s.amount).toLocaleString()}</div>
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '12px 18px', fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>{s.due_date}</td>
                      <td style={{ padding: '12px 18px' }}>
                        <Badge type={s.status === 'paid' ? 'green' : s.status === 'pending' ? 'gold' : 'red'}>
                          {s.status === 'paid' ? '정산완료' : s.status === 'pending' ? '대기중' : '반려'}
                        </Badge>
                      </td>
                      <td style={{ padding: '12px 18px' }}>
                        {s.status === 'pending' && <Btn size="sm" variant="secondary" onClick={() => handleSettle(s.id)}>정산</Btn>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </div>
      )}

      {tab === 'invoices' && (
        <div>
          <div style={{ marginBottom: 16, fontSize: 14, color: 'var(--text-2)' }}>
            미수금 <strong style={{ color: 'var(--red)' }}>₩{(pendingInvAmt / 10000).toFixed(0)}만</strong>
          </div>
          {invoices.length === 0 ? (
            <Card><div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>청구 데이터 없음</div></Card>
          ) : (
            <Card style={{ padding: 0, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {['기업', '플랜', '청구액', '청구일', '상태', ''].map(h => (
                      <th key={h} style={{ padding: '12px 18px', textAlign: 'left', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv, i) => (
                    <tr key={inv.id} style={{ borderBottom: i < invoices.length - 1 ? '1px solid var(--border)' : 'none' }}>
                      <td style={{ padding: '12px 18px', fontWeight: 600, fontSize: 13 }}>{inv.company_name}</td>
                      <td style={{ padding: '12px 18px' }}><Badge type="gray">{inv.plan}</Badge></td>
                      <td style={{ padding: '12px 18px' }}>
                        <div style={{ lineHeight: 1 }}>
                          <div style={{ fontSize: 9, color: 'var(--text-3)', fontWeight: 700, letterSpacing: '0.08em', marginBottom: 2 }}>KRW</div>
                          <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text)' }}>{Number(inv.amount).toLocaleString()}</div>
                        </div>
                      </td>
                      <td style={{ padding: '12px 18px', fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>{inv.invoice_date}</td>
                      <td style={{ padding: '12px 18px' }}>
                        <Badge type={inv.status === 'paid' ? 'green' : 'red'}>
                          {inv.status === 'paid' ? '수납완료' : '미수금'}
                        </Badge>
                      </td>
                      <td style={{ padding: '12px 18px' }}>
                        {inv.status === 'pending' && (
                          <Btn size="sm" variant="danger" onClick={() => handleInvoiceStatus(inv.id, 'paid')}>수납 처리</Btn>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
