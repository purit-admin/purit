import { useState } from 'react';
import { Card, Badge, Btn, Stat } from '../../components/ui';
import { PANELS, getTierColor } from '../../lib/data';

const EXTENDED_PANELS = [
  ...PANELS,
  { id: 'p4', name: '최민준', email: 'mj.choi@email.com', industry: '퍼포먼스 마케터', experience: '3년', trustScore: 62, tier: 'PRO', completedMissions: 8, totalEarned: 240000, joinedAt: '2025-03-10', status: 'active' },
  { id: 'p5', name: '한소희', email: 'sh.han@email.com', industry: '스타트업 대표', experience: '6년', trustScore: 91, tier: 'EXPERT', completedMissions: 41, totalEarned: 1680000, joinedAt: '2024-01-05', status: 'active' },
  { id: 'p6', name: '오태양', email: 'ty.oh@email.com', industry: '콘텐츠 마케터', experience: '2년', trustScore: 44, tier: 'ROOKIE', completedMissions: 3, totalEarned: 72000, joinedAt: '2025-06-01', status: 'suspended' },
  { id: 'p7', name: '정유진', email: 'yj.jung@email.com', industry: 'B2B 영업', experience: '8년', trustScore: 0, tier: 'ROOKIE', completedMissions: 0, totalEarned: 0, joinedAt: '2025-07-14', status: 'pending' },
];

const TIER_ORDER = ['ELITE', 'EXPERT', 'PRO', 'ROOKIE'];

export default function AdminPanels() {
  const [selected, setSelected] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [tierFilter, setTierFilter] = useState('all');

  const filtered = EXTENDED_PANELS.filter(p =>
    (statusFilter === 'all' || p.status === statusFilter) &&
    (tierFilter === 'all' || p.tier === tierFilter)
  );

  const panel = selected ? EXTENDED_PANELS.find(p => p.id === selected) : null;

  const tierColor = (tier) => {
    if (tier === 'ELITE' || tier === 'EXPERT') return 'gold';
    if (tier === 'PRO') return 'blue';
    return 'gray';
  };

  const scoreColor = (score) =>
    score >= 80 ? 'var(--green)' : score >= 60 ? 'var(--accent)' : 'var(--red)';

  return (
    <div style={{ padding: '40px 48px', maxWidth: 1100, animation: 'fadeUp 0.5s ease both' }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--accent)', marginBottom: 8, letterSpacing: '0.1em' }}>ADMIN · PANEL MANAGEMENT</div>
        <h1 style={{ fontSize: 28, fontWeight: 800 }}>패널 관리</h1>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1, background: 'var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', marginBottom: 28 }}>
        {[
          { label: '전체 패널', value: EXTENDED_PANELS.length },
          { label: '활성', value: EXTENDED_PANELS.filter(p => p.status === 'active').length },
          { label: '심사 대기', value: EXTENDED_PANELS.filter(p => p.status === 'pending').length },
          { label: '활동 정지', value: EXTENDED_PANELS.filter(p => p.status === 'suspended').length },
          { label: '평균 Trust', value: Math.round(EXTENDED_PANELS.filter(p => p.status === 'active').reduce((s, p) => s + p.trustScore, 0) / EXTENDED_PANELS.filter(p => p.status === 'active').length) },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--surface)', padding: '20px 24px' }}>
            <Stat {...s} />
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 4, background: 'var(--surface)', borderRadius: 'var(--radius)', padding: 4 }}>
          {[['all', '전체'], ['active', '활성'], ['pending', '심사대기'], ['suspended', '정지']].map(([v, l]) => (
            <button key={v} onClick={() => setStatusFilter(v)} style={{
              padding: '5px 12px', borderRadius: 3, fontSize: 12, fontWeight: 500,
              background: statusFilter === v ? 'var(--bg)' : 'transparent',
              color: statusFilter === v ? 'var(--text)' : 'var(--text-3)',
              border: 'none', cursor: 'pointer', transition: 'all 0.15s',
            }}>{l}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {['all', 'EXPERT', 'PRO', 'ROOKIE'].map(t => (
            <button key={t} onClick={() => setTierFilter(t)} style={{
              padding: '5px 12px', borderRadius: 'var(--radius)', fontSize: 12, fontWeight: 500,
              background: tierFilter === t ? 'var(--accent)' : 'var(--surface)',
              color: tierFilter === t ? '#0A0A08' : 'var(--text-3)',
              border: '1px solid ' + (tierFilter === t ? 'var(--accent)' : 'var(--border)'),
              cursor: 'pointer', transition: 'all 0.15s',
            }}>{t === 'all' ? '전체 등급' : t}</button>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 360px' : '1fr', gap: 20 }}>
        {/* Table */}
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['이름', '직군 · 경력', 'Trust', '등급', '완료', '총 수익', '상태', ''].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((p, i) => (
                <tr key={p.id} onClick={() => setSelected(selected === p.id ? null : p.id)} style={{
                  borderBottom: i < filtered.length - 1 ? '1px solid var(--border)' : 'none',
                  background: selected === p.id ? 'var(--surface-2)' : 'transparent',
                  cursor: 'pointer', transition: 'background 0.15s',
                }}
                  onMouseEnter={e => selected !== p.id && (e.currentTarget.style.background = 'var(--bg-3)')}
                  onMouseLeave={e => selected !== p.id && (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={{ padding: '12px 16px', fontWeight: 600, fontSize: 13 }}>{p.name}</td>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-3)' }}>{p.industry} · {p.experience}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: 15, color: scoreColor(p.trustScore) }}>
                      {p.trustScore}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px' }}><Badge type={tierColor(p.tier)}>{p.tier}</Badge></td>
                  <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-2)' }}>{p.completedMissions}</td>
                  <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--green)' }}>
                    {p.totalEarned > 0 ? `₩${(p.totalEarned / 10000).toFixed(0)}만` : '—'}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <Badge type={p.status === 'active' ? 'green' : p.status === 'pending' ? 'gold' : 'red'}>
                      {p.status === 'active' ? '활성' : p.status === 'pending' ? '심사중' : '정지'}
                    </Badge>
                  </td>
                  <td style={{ padding: '12px 16px', color: 'var(--text-3)', fontSize: 12 }}>→</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        {/* Panel detail */}
        {panel && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Card>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 20, marginBottom: 4 }}>{panel.name}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-2)' }}>{panel.email}</div>
                </div>
                <Badge type={tierColor(panel.tier)}>{panel.tier}</Badge>
              </div>

              {/* Trust score bar */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-3)', marginBottom: 6, fontFamily: 'var(--font-mono)' }}>
                  <span>TRUST SCORE</span><span style={{ color: scoreColor(panel.trustScore), fontWeight: 700 }}>{panel.trustScore}</span>
                </div>
                <div style={{ height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ width: `${panel.trustScore}%`, height: '100%', background: scoreColor(panel.trustScore), borderRadius: 3 }} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
                {[
                  { label: '직군', value: panel.industry },
                  { label: '경력', value: panel.experience },
                  { label: '완료 미션', value: `${panel.completedMissions}건` },
                  { label: '총 수익', value: panel.totalEarned > 0 ? `₩${(panel.totalEarned / 10000).toFixed(0)}만` : '—' },
                  { label: '가입일', value: panel.joinedAt },
                  { label: '상태', value: panel.status === 'active' ? '활성' : panel.status === 'pending' ? '심사 중' : '정지' },
                ].map(({ label, value }) => (
                  <div key={label} style={{ padding: '10px 12px', background: 'var(--bg-3)', borderRadius: 'var(--radius)' }}>
                    <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{label}</div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{value}</div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Actions */}
            <Card style={{ padding: '18px 20px' }}>
              <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 }}>관리 액션</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {panel.status === 'pending' && (
                  <>
                    <Btn size="sm" style={{ justifyContent: 'center' }}>✓ 심사 승인</Btn>
                    <Btn size="sm" variant="danger" style={{ justifyContent: 'center' }}>✕ 심사 거절</Btn>
                  </>
                )}
                {panel.status === 'active' && (
                  <>
                    <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 6 }}>등급 수동 조정</div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {['ROOKIE', 'PRO', 'EXPERT'].filter(t => t !== panel.tier).map(t => (
                        <Btn key={t} size="sm" variant="secondary" style={{ flex: 1, justifyContent: 'center', fontSize: 11 }}>→ {t}</Btn>
                      ))}
                    </div>
                    <Btn size="sm" variant="danger" style={{ justifyContent: 'center', marginTop: 4 }}>활동 정지</Btn>
                  </>
                )}
                {panel.status === 'suspended' && (
                  <Btn size="sm" style={{ justifyContent: 'center' }}>활동 재개</Btn>
                )}
              </div>
            </Card>

            {/* Trust score history */}
            <Card style={{ padding: '18px 20px' }}>
              <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Trust Score 변화</div>
              {panel.status === 'active' && panel.completedMissions > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {[
                    { event: 'Purity Filter 통과', delta: '+3', date: '07-14' },
                    { event: 'Purity Filter 통과', delta: '+3', date: '07-08' },
                    { event: '광고주 피드백 긍정', delta: '+5', date: '06-30' },
                    { event: 'Purity 탈락', delta: '-8', date: '06-15' },
                  ].map((e, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                      <span style={{ color: 'var(--text-2)' }}>{e.event}</span>
                      <div style={{ display: 'flex', gap: 10 }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: e.delta.startsWith('+') ? 'var(--green)' : 'var(--red)' }}>{e.delta}</span>
                        <span style={{ color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>{e.date}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: 13, color: 'var(--text-3)', textAlign: 'center', padding: '16px 0' }}>이력 없음</div>
              )}
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
