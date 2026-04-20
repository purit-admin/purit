import { Card, Stat, Badge, Btn } from '../../components/ui';
import { MISSIONS, PANELS, FEEDBACKS } from '../../lib/data';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';

const chartData = [
  { name: '6/23', feedbacks: 4, passed: 3 },
  { name: '6/30', feedbacks: 7, passed: 6 },
  { name: '7/7', feedbacks: 12, passed: 10 },
  { name: '7/14', feedbacks: 8, passed: 7 },
];

export default function AdminDashboard() {
  return (
    <div style={{ padding: '40px 48px', maxWidth: 1100, animation: 'fadeUp 0.5s ease both' }}>
      <div style={{ marginBottom: 40 }}>
        <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--accent)', marginBottom: 8, letterSpacing: '0.1em' }}>ADMIN PORTAL</div>
        <h1 style={{ fontSize: 32, fontWeight: 800 }}>플랫폼 개요</h1>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1, background: 'var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', marginBottom: 32 }}>
        {[
          { label: '총 의뢰', value: MISSIONS.length },
          { label: '활성 패널', value: PANELS.length },
          { label: '피드백 수', value: FEEDBACKS.length },
          { label: 'Purity 통과율', value: '87%', accent: true },
          { label: '이번 달 GMV', value: '₩280만' },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--surface)', padding: '24px 20px' }}>
            <Stat {...s} />
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 20, marginBottom: 24 }}>
        {/* Chart */}
        <Card>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 20 }}>주간 피드백 / Purity 통과</div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={chartData} barGap={4}>
              <XAxis dataKey="name" tick={{ fill: 'var(--text-3)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--text-3)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12 }} />
              <Bar dataKey="feedbacks" fill="var(--border-light)" radius={[4,4,0,0]} />
              <Bar dataKey="passed" fill="var(--accent)" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Quick actions */}
        <Card>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 16 }}>빠른 작업</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { label: '대기 중인 피드백 검토', count: 3, type: 'gold' },
              { label: '신규 패널 심사', count: 1, type: 'blue' },
              { label: '미매칭 의뢰', count: 2, type: 'red' },
            ].map(item => (
              <div key={item.label} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '12px 16px', background: 'var(--bg-3)', borderRadius: 'var(--radius)',
                border: '1px solid var(--border)', cursor: 'pointer',
              }}>
                <span style={{ fontSize: 13 }}>{item.label}</span>
                <Badge type={item.type}>{item.count}</Badge>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Panels table */}
      <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 14, color: 'var(--text-2)' }}>패널 현황</h2>
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['이름', '직군', 'Trust Score', '등급', '완료', '총 수익', '상태'].map(h => (
                <th key={h} style={{ padding: '14px 20px', textAlign: 'left', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PANELS.map((p, i) => (
              <tr key={p.id} style={{ borderBottom: i < PANELS.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <td style={{ padding: '14px 20px', fontWeight: 600 }}>{p.name}</td>
                <td style={{ padding: '14px 20px', fontSize: 13, color: 'var(--text-2)' }}>{p.industry}</td>
                <td style={{ padding: '14px 20px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: p.trustScore >= 90 ? 'var(--accent)' : p.trustScore >= 75 ? 'var(--blue)' : 'var(--text-2)' }}>
                  {p.trustScore}
                </td>
                <td style={{ padding: '14px 20px' }}><Badge type={p.tier === 'EXPERT' ? 'gold' : 'blue'}>{p.tier}</Badge></td>
                <td style={{ padding: '14px 20px', fontSize: 13, color: 'var(--text-2)', fontFamily: 'var(--font-mono)' }}>{p.completedMissions}</td>
                <td style={{ padding: '14px 20px', fontSize: 13, color: 'var(--green)', fontFamily: 'var(--font-mono)' }}>₩{(p.totalEarned/10000).toFixed(0)}만</td>
                <td style={{ padding: '14px 20px' }}><Badge type="green">활성</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
