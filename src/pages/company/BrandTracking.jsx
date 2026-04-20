// 브랜드 트래킹 — Wynter의 Brand Research Survey를 월간 인지도 추적 서비스로 변형
// 광고 집행 전후 타겟 인지도/포지셔닝 변화를 정량적으로 추적

import { Card, Stat, Badge, Btn } from '../../components/ui';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts';

const TRACKING_DATA = [
  { month: '4월', awareness: 12, clarity: 2.8, differentiation: 1.9, nps: 22 },
  { month: '5월', awareness: 18, clarity: 3.1, differentiation: 2.2, nps: 28 },
  { month: '6월', awareness: 24, clarity: 3.3, differentiation: 2.4, nps: 31 },
  { month: '7월', awareness: 31, clarity: 3.6, differentiation: 2.7, nps: 38 },
];

const PERCEPTION = [
  { label: '프리미엄하다', percent: 72 },
  { label: '신뢰할 수 있다', percent: 58 },
  { label: '나를 위한 브랜드다', percent: 44 },
  { label: '경쟁사와 다르다', percent: 31 },
  { label: '가격이 합리적이다', percent: 67 },
];

export default function BrandTracking() {
  return (
    <div style={{ padding: '40px 48px', maxWidth: 1060, animation: 'fadeUp 0.5s ease both' }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--accent)', marginBottom: 8, letterSpacing: '0.1em' }}>BRAND TRACKING</div>
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 6 }}>브랜드 인지도 추적</h1>
        <p style={{ color: 'var(--text-2)', fontSize: 14 }}>
          광고 집행 전후 타겟 고객의 브랜드 인지·포지셔닝 변화를 매월 패널 리서치로 추적합니다.
        </p>
      </div>

      {/* KPI stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, background: 'var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', marginBottom: 28 }}>
        {[
          { label: '타겟 인지율', value: '31%', sub: '전월 +7%p', accent: true },
          { label: '메시지 명확성', value: '3.6', sub: '/ 5.0' },
          { label: '차별화 점수', value: '2.7', sub: '/ 5.0' },
          { label: 'NPS', value: '+38', sub: '전월 +7' },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--surface)', padding: '24px 24px' }}>
            <Stat {...s} />
          </div>
        ))}
      </div>

      {/* Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
        <Card>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 16 }}>브랜드 인지율 추이 (%)</div>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={TRACKING_DATA}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="month" tick={{ fill: 'var(--text-3)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--text-3)', fontSize: 11 }} axisLine={false} tickLine={false} domain={[0, 50]} unit="%" />
              <Tooltip contentStyle={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12 }} />
              <Line type="monotone" dataKey="awareness" stroke="var(--accent)" strokeWidth={2.5} dot={{ fill: 'var(--accent)', r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
        <Card>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 16 }}>메시지 명확성 / 차별화 점수 추이</div>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={TRACKING_DATA}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="month" tick={{ fill: 'var(--text-3)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--text-3)', fontSize: 11 }} axisLine={false} tickLine={false} domain={[0, 5]} />
              <Tooltip contentStyle={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12 }} />
              <Line type="monotone" dataKey="clarity" stroke="var(--blue)" strokeWidth={2} dot={{ fill: 'var(--blue)', r: 3 }} name="명확성" />
              <Line type="monotone" dataKey="differentiation" stroke="#C084FC" strokeWidth={2} dot={{ fill: '#C084FC', r: 3 }} name="차별화" />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Brand perception */}
      <Card style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 20 }}>브랜드 인식 항목별 동의율</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {PERCEPTION.map(p => (
            <div key={p.label}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                <span style={{ color: 'var(--text-2)' }}>{p.label}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: p.percent >= 60 ? 'var(--green)' : p.percent >= 40 ? 'var(--accent)' : 'var(--red)' }}>
                  {p.percent}%
                </span>
              </div>
              <div style={{ height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{
                  width: `${p.percent}%`, height: '100%', borderRadius: 3,
                  background: p.percent >= 60 ? 'var(--green)' : p.percent >= 40 ? 'var(--accent)' : 'var(--red)',
                  transition: 'width 0.8s ease',
                }} />
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Schedule next */}
      <Card style={{ background: 'var(--accent-dim2)', borderColor: 'rgba(232,213,163,0.15)', padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>다음 추적 리서치</div>
          <div style={{ fontSize: 13, color: 'var(--text-2)' }}>2025년 8월 15일 예정 · 패널 20명 · 분기 포지셔닝 변화 포함</div>
        </div>
        <Btn size="sm" variant="outline">일정 조정</Btn>
      </Card>
    </div>
  );
}
