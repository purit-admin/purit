import { useState } from 'react';
import { Card, Stat, Badge, Btn } from '../../components/ui';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, LineChart, Line, CartesianGrid } from 'recharts';

const MONTHLY_GMV = [
  { month: '3월', gmv: 180, panelPay: 108, margin: 72 },
  { month: '4월', gmv: 240, panelPay: 144, margin: 96 },
  { month: '5월', gmv: 310, panelPay: 186, margin: 124 },
  { month: '6월', gmv: 420, panelPay: 252, margin: 168 },
  { month: '7월', gmv: 280, panelPay: 168, margin: 112 },
];

const SETTLEMENTS = [
  { id: 's1', panel: '김서연', tier: 'EXPERT', missions: 2, amount: 83000, status: 'pending', dueDate: '2025-07-20' },
  { id: 's2', panel: '이준혁', tier: 'PRO', missions: 1, amount: 38000, status: 'pending', dueDate: '2025-07-20' },
  { id: 's3', panel: '박지민', tier: 'PRO', missions: 3, amount: 114000, status: 'paid', dueDate: '2025-07-13' },
  { id: 's4', panel: '한소희', tier: 'EXPERT', missions: 4, amount: 192000, status: 'paid', dueDate: '2025-07-10' },
  { id: 's5', panel: '최민준', tier: 'PRO', missions: 1, amount: 30000, status: 'rejected', dueDate: '2025-07-08' },
];

const CLIENT_INVOICES = [
  { id: 'i1', company: '어반핏 코리아', plan: 'Pro', amount: 1980000, status: 'paid', date: '2025-07-01' },
  { id: 'i2', company: '뉴트리아 랩스', plan: 'Starter', amount: 790000, status: 'paid', date: '2025-07-01' },
  { id: 'i3', company: '핀테크베이스', plan: '건당', amount: 800000, status: 'pending', date: '2025-07-15' },
];

export default function RevenueManagement() {
  const [tab, setTab] = useState('overview');

  const pendingAmt = SETTLEMENTS.filter(s => s.status === 'pending').reduce((a, s) => a + s.amount, 0);
  const paidAmt = SETTLEMENTS.filter(s => s.status === 'paid').reduce((a, s) => a + s.amount, 0);
  const monthlyGMV = MONTHLY_GMV[MONTHLY_GMV.length - 1].gmv * 10000;
  const marginRate = Math.round((MONTHLY_GMV[MONTHLY_GMV.length - 1].margin / MONTHLY_GMV[MONTHLY_GMV.length - 1].gmv) * 100);

  return (
    <div style={{ padding: '40px 48px', maxWidth: 1060, animation: 'fadeUp 0.5s ease both' }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--accent)', marginBottom: 8, letterSpacing: '0.1em' }}>ADMIN · REVENUE</div>
        <h1 style={{ fontSize: 28, fontWeight: 800 }}>수익 & 정산 관리</h1>
      </div>

      {/* KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, background: 'var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', marginBottom: 28 }}>
        {[
          { label: '이번 달 GMV', value: `₩${(monthlyGMV / 10000).toFixed(0)}만`, accent: true },
          { label: '영업 마진율', value: `${marginRate}%`, sub: '목표 40%+' },
          { label: '패널 정산 대기', value: `₩${(pendingAmt / 10000).toFixed(1)}만` },
          { label: '미수금 (기업)', value: `₩${(CLIENT_INVOICES.filter(i => i.status === 'pending').reduce((a, i) => a + i.amount, 0) / 10000).toFixed(0)}만` },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--surface)', padding: '22px 24px' }}>
            <Stat {...s} />
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
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={MONTHLY_GMV} barGap={4}>
                <XAxis dataKey="month" tick={{ fill: 'var(--text-3)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text-3)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12 }} />
                <Bar dataKey="gmv" fill="var(--border-light)" radius={[4, 4, 0, 0]} name="GMV" />
                <Bar dataKey="margin" fill="var(--accent)" radius={[4, 4, 0, 0]} name="마진" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
          <Card>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 16 }}>마진율 추이 (%)</div>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={MONTHLY_GMV}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="month" tick={{ fill: 'var(--text-3)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text-3)', fontSize: 11 }} axisLine={false} tickLine={false} unit="%" domain={[30, 50]} />
                <Tooltip contentStyle={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12 }} formatter={(v, n, p) => [`${Math.round((p.payload.margin / p.payload.gmv) * 100)}%`, '마진율']} />
                <Line type="monotone" dataKey={(d) => Math.round((d.margin / d.gmv) * 100)} stroke="var(--green)" strokeWidth={2.5} dot={{ fill: 'var(--green)', r: 4 }} name="마진율" />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </div>
      )}

      {tab === 'settlements' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 14, color: 'var(--text-2)' }}>
              정산 대기 <strong style={{ color: 'var(--accent)' }}>₩{(pendingAmt / 10000).toFixed(1)}만</strong> · {SETTLEMENTS.filter(s => s.status === 'pending').length}건
            </div>
            <Btn size="sm">일괄 정산 처리</Btn>
          </div>
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
                {SETTLEMENTS.map((s, i) => (
                  <tr key={s.id} style={{ borderBottom: i < SETTLEMENTS.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <td style={{ padding: '12px 18px', fontWeight: 600, fontSize: 13 }}>{s.panel}</td>
                    <td style={{ padding: '12px 18px' }}><Badge type={s.tier === 'EXPERT' ? 'gold' : 'blue'}>{s.tier}</Badge></td>
                    <td style={{ padding: '12px 18px', fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-2)' }}>{s.missions}건</td>
                    <td style={{ padding: '12px 18px', fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 14, color: s.status === 'paid' ? 'var(--green)' : s.status === 'rejected' ? 'var(--text-3)' : 'var(--accent)' }}>
                      {s.status === 'rejected' ? '—' : `₩${s.amount.toLocaleString()}`}
                    </td>
                    <td style={{ padding: '12px 18px', fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>{s.dueDate}</td>
                    <td style={{ padding: '12px 18px' }}>
                      <Badge type={s.status === 'paid' ? 'green' : s.status === 'pending' ? 'gold' : 'red'}>
                        {s.status === 'paid' ? '정산완료' : s.status === 'pending' ? '대기중' : '반려'}
                      </Badge>
                    </td>
                    <td style={{ padding: '12px 18px' }}>
                      {s.status === 'pending' && <Btn size="sm" variant="secondary">정산</Btn>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      {tab === 'invoices' && (
        <div>
          <div style={{ marginBottom: 16, fontSize: 14, color: 'var(--text-2)' }}>
            미수금 <strong style={{ color: 'var(--red)' }}>₩{(CLIENT_INVOICES.filter(i => i.status === 'pending').reduce((a, i) => a + i.amount, 0) / 10000).toFixed(0)}만</strong>
          </div>
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
                {CLIENT_INVOICES.map((inv, i) => (
                  <tr key={inv.id} style={{ borderBottom: i < CLIENT_INVOICES.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <td style={{ padding: '12px 18px', fontWeight: 600, fontSize: 13 }}>{inv.company}</td>
                    <td style={{ padding: '12px 18px' }}><Badge type="gray">{inv.plan}</Badge></td>
                    <td style={{ padding: '12px 18px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text)' }}>₩{inv.amount.toLocaleString()}</td>
                    <td style={{ padding: '12px 18px', fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>{inv.date}</td>
                    <td style={{ padding: '12px 18px' }}>
                      <Badge type={inv.status === 'paid' ? 'green' : 'red'}>
                        {inv.status === 'paid' ? '수납완료' : '미수금'}
                      </Badge>
                    </td>
                    <td style={{ padding: '12px 18px' }}>
                      {inv.status === 'pending' && <Btn size="sm" variant="danger">독촉</Btn>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}
    </div>
  );
}
