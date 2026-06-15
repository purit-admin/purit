import { useState, useEffect } from 'react';
import { Card, Badge, Btn, ConfirmModal, StatusTabs } from '../../components/ui';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, LineChart, Line, CartesianGrid } from 'recharts';
import { supabase } from '../../lib/supabase';
import { getPanelReward } from '../../lib/honorLevels';

export default function RevenueManagement() {
  const [tab, setTab] = useState('overview');
  const [gmvData, setGmvData] = useState([]);
  const [feedbackSettlements, setFeedbackSettlements] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirmInvoice, setConfirmInvoice] = useState(null);
  const [invoiceError, setInvoiceError] = useState('');

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const [gmvRes, settRes, invRes] = await Promise.all([
        supabase.from('gmv_snapshots').select('*').order('year').order('month_num'),
        supabase
          .from('feedbacks')
          .select('id, payout_amount, missions(id, title, type, status), panels(id, name, honor_points, experience)')
          .eq('purity_passed', true)
          .neq('status', 'draft')
          .order('created_at', { ascending: false })
          .limit(500),
        supabase.from('invoices').select('*').order('invoice_date', { ascending: false }),
      ]);
      if (!gmvRes.error) setGmvData(gmvRes.data || []);
      if (!settRes.error) setFeedbackSettlements(settRes.data || []);
      if (!invRes.error) setInvoices(invRes.data || []);
      setLoading(false);
    } catch (err) {
      console.error('[Revenue loadAll]', err);
      setLoading(false);
    }
  }

  async function handleInvoiceStatus(id, newStatus) {
    setInvoiceError('');
    const { error } = await supabase
      .from('invoices')
      .update({ status: newStatus })
      .eq('id', id);
    if (error) { setInvoiceError('처리 실패: ' + error.message); return; }
    setInvoices(inv => inv.map(x => x.id === id ? { ...x, status: newStatus } : x));
    setConfirmInvoice(null);
  }

  if (loading) return (
    <div style={{ padding: '40px 48px', color: 'var(--text-3)', fontFamily: 'var(--font-sans)', fontSize: 13 }}>
      데이터 로딩 중…
    </div>
  );

  const calcSettleAmt = (f) => {
    if (f.payout_amount != null) return Number(f.payout_amount);
    const isSub = ['preference', 'pricing', 'email'].includes(f.missions?.type);
    const base = getPanelReward(f.panels?.honor_points || 0, f.panels?.experience || '');
    return isSub ? Math.round(base * (4500 / 8000)) : base;
  };

  const lastMonth = gmvData[gmvData.length - 1];
  const monthlyGMV = lastMonth ? lastMonth.gmv * 10000 : 0;
  const marginRate = lastMonth && lastMonth.gmv > 0 ? Math.round((lastMonth.margin / lastMonth.gmv) * 100) : 0;
  const pendingSettlements = feedbackSettlements.filter(f => f.missions?.status !== 'completed');
  const pendingAmt = pendingSettlements.reduce((a, f) => a + calcSettleAmt(f), 0);
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
        <div style={{ fontSize: 12, fontFamily: 'var(--font-sans)', color: 'var(--text-2)', marginBottom: 8, letterSpacing: '0.1em' }}>ADMIN · REVENUE</div>
        <h1 style={{ fontSize: 28, fontWeight: 800 }}>수익 & 정산 관리</h1>
      </div>

      {/* KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, background: 'var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', marginBottom: 28 }}>
        {[
          { label: '이번 달 GMV', raw: monthlyGMV, accent: true },
          { label: '영업 마진율', value: `${marginRate}%`, sub: '목표 40%+' },
          { label: '패널 정산 대기', raw: pendingAmt, sub: `${pendingSettlements.length}건` },
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
      <StatusTabs
        value={tab}
        onChange={setTab}
        tabs={[
          { key: 'overview', label: 'GMV 차트' },
          { key: 'settlements', label: '패널 정산' },
          { key: 'invoices', label: '기업 청구' },
        ]}
        style={{ marginBottom: 24 }}
      />

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
                    formatter={(v, n, p) => [`${p.payload.gmv > 0 ? Math.round((p.payload.margin / p.payload.gmv) * 100) : 0}%`, '마진율']}
                  />
                  <Line type="monotone" dataKey={(d) => d.gmv > 0 ? Math.round((d.margin / d.gmv) * 100) : 0} stroke="var(--green)" strokeWidth={2.5} dot={{ fill: 'var(--green)', r: 4 }} name="마진율" />
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
              지급 대기 <strong style={{ color: 'var(--text)' }}>₩{(pendingAmt / 10000).toFixed(1)}만</strong> · {pendingSettlements.length}건
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--font-sans)' }}>
              실제 지급은 미션 완료 후 계좌 이체로 처리됩니다
            </div>
          </div>
          {feedbackSettlements.length === 0 ? (
            <Card><div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>승인된 정산 내역 없음</div></Card>
          ) : (
            <Card style={{ padding: 0, overflow: 'hidden' }}>
              <div className="table-scroll">
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      {['패널', '미션', '유형', '정산액', '상태'].map(h => (
                        <th key={h} style={{ padding: '12px 18px', textAlign: 'left', fontSize: 11, fontFamily: 'var(--font-sans)', color: 'var(--text-3)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {feedbackSettlements.map((f, i) => {
                      const amt = calcSettleAmt(f);
                      const isPaid = f.missions?.status === 'completed';
                      const mType = f.missions?.type;
                      return (
                        <tr key={f.id} style={{ borderBottom: i < feedbackSettlements.length - 1 ? '1px solid var(--border)' : 'none' }}>
                          <td style={{ padding: '12px 18px', fontWeight: 600, fontSize: 13 }}>{f.panels?.name || '—'}</td>
                          <td style={{ padding: '12px 18px', fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--text-2)' }}>{f.missions?.title || '—'}</td>
                          <td style={{ padding: '12px 18px' }}>
                            {mType && mType !== 'landing_page' && (
                              <Badge type="blue">
                                {mType === 'preference' ? '소재비교' : mType === 'pricing' ? '가격검증' : '이메일검증'}
                              </Badge>
                            )}
                          </td>
                          <td style={{ padding: '12px 18px' }}>
                            <div style={{ lineHeight: 1 }}>
                              <div style={{ fontSize: 9, color: 'var(--text-3)', fontWeight: 700, letterSpacing: '0.08em', marginBottom: 2 }}>KRW</div>
                              <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-sans)', color: isPaid ? 'var(--green)' : 'var(--accent)' }}>{amt.toLocaleString()}</div>
                            </div>
                          </td>
                          <td style={{ padding: '12px 18px' }}>
                            <Badge type={isPaid ? 'green' : 'gold'}>
                              {isPaid ? '지급완료' : '지급대기'}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
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
              <div className="table-scroll">
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      {['기업', '플랜', '청구액', '청구일', '상태', ''].map(h => (
                        <th key={h} style={{ padding: '12px 18px', textAlign: 'left', fontSize: 11, fontFamily: 'var(--font-sans)', color: 'var(--text-3)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((inv, i) => (
                      <tr key={inv.id} style={{ borderBottom: i < invoices.length - 1 ? '1px solid var(--border)' : 'none' }}>
                        <td style={{ padding: '12px 18px', fontWeight: 600, fontSize: 13 }}>{inv.company_name}</td>
                        <td style={{ padding: '12px 18px' }}>
                          {inv.payment_type === 'credits'
                            ? <Badge type="blue">크레딧 {inv.credits_amount}cr</Badge>
                            : <Badge type="gray">{inv.plan} 플랜</Badge>
                          }
                        </td>
                        <td style={{ padding: '12px 18px' }}>
                          <div style={{ lineHeight: 1 }}>
                            <div style={{ fontSize: 9, color: 'var(--text-3)', fontWeight: 700, letterSpacing: '0.08em', marginBottom: 2 }}>KRW</div>
                            <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-sans)', color: 'var(--text)' }}>{Number(inv.amount).toLocaleString()}</div>
                          </div>
                        </td>
                        <td style={{ padding: '12px 18px', fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--font-sans)' }}>{inv.invoice_date}</td>
                        <td style={{ padding: '12px 18px' }}>
                          <Badge type={inv.status === 'paid' ? 'green' : 'red'}>
                            {inv.status === 'paid' ? '수납완료' : '미수금'}
                          </Badge>
                        </td>
                        <td style={{ padding: '12px 18px' }}>
                          {inv.status === 'pending' && (
                            <Btn size="sm" variant="danger" onClick={() => { setInvoiceError(''); setConfirmInvoice({ id: inv.id, newStatus: 'paid' }); }}>수납 처리</Btn>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}

      {confirmInvoice && (
        <ConfirmModal
          title="수납 처리"
          desc="해당 청구 건을 수납 완료로 처리합니다."
          confirmLabel="수납 처리"
          danger
          errorMsg={invoiceError}
          onConfirm={async () => {
            const { id, newStatus } = confirmInvoice;
            await handleInvoiceStatus(id, newStatus);
          }}
          onCancel={() => { setConfirmInvoice(null); setInvoiceError(''); }}
        />
      )}
    </div>
  );
}
