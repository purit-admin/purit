import { useNavigate } from 'react-router-dom';
import { Card, Stat, Btn, Badge } from '../../components/ui';
import { MISSIONS, COMPANY_PROJECTS, getStatusColor } from '../../lib/data';

export default function CompanyDashboard() {
  const navigate = useNavigate();
  const activeProjects = COMPANY_PROJECTS.length;

  return (
    <div style={{ padding: '40px 48px', maxWidth: 1100, animation: 'fadeUp 0.5s ease both' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 40 }}>
        <div>
          <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--accent)', marginBottom: 8, letterSpacing: '0.1em' }}>
            COMPANY PORTAL
          </div>
          <h1 style={{ fontSize: 32, fontWeight: 800, marginBottom: 6 }}>어반핏 코리아</h1>
          <p style={{ color: 'var(--text-2)', fontSize: 14 }}>광고비 집행 전 전환 결함을 미리 잡으세요.</p>
        </div>
        <Btn onClick={() => navigate('/company/new')} size="lg">
          + 새 의뢰 등록
        </Btn>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, background: 'var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', marginBottom: 32 }}>
        {[
          { label: '진행 의뢰', value: '1', sub: '현재 활성' },
          { label: '수집된 피드백', value: '2 / 8', sub: '이번 의뢰' },
          { label: '평균 전환 점수', value: '2.5 / 5', sub: '개선 필요' },
          { label: '절감 예상 광고비', value: '₩ 800만', sub: '전환율 개선 기준', accent: true },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--surface)', padding: '24px 28px' }}>
            <Stat {...s} />
          </div>
        ))}
      </div>

      {/* Active project */}
      <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: 'var(--text-2)' }}>진행 중인 의뢰</h2>
      {MISSIONS.filter(m => m.id === 'm1').map(m => (
        <Card key={m.id} onClick={() => navigate('/company/results')} style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <Badge type="green">검토 중</Badge>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-3)' }}>{m.id.toUpperCase()}</span>
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>{m.product}</div>
              <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 12 }}>타겟 페르소나: {m.targetPersona}</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {m.tags.map(t => <Badge key={t} type="gray">{t}</Badge>)}
              </div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 24 }}>
              {/* Progress */}
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 8, fontFamily: 'var(--font-mono)' }}>
                피드백 수집
              </div>
              <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--accent)' }}>
                {m.filled} <span style={{ fontSize: 16, color: 'var(--text-3)' }}>/ {m.slots}</span>
              </div>
              <div style={{ width: 120, height: 4, background: 'var(--border)', borderRadius: 2, marginTop: 8, overflow: 'hidden' }}>
                <div style={{ width: `${(m.filled/m.slots)*100}%`, height: '100%', background: 'var(--accent)', borderRadius: 2 }} />
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 12 }}>마감 {m.deadline}</div>
            </div>
          </div>
        </Card>
      ))}

      {/* Recent missions list */}
      <h2 style={{ fontSize: 16, fontWeight: 700, margin: '32px 0 16px', color: 'var(--text-2)' }}>전체 의뢰 현황</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {MISSIONS.map(m => (
          <div key={m.id} style={{
            display: 'flex', alignItems: 'center', gap: 16,
            padding: '16px 20px', background: 'var(--surface)', borderRadius: 'var(--radius)',
            border: '1px solid var(--border)',
          }}>
            <Badge type={m.status === 'active' ? 'green' : 'red'}>{m.status === 'active' ? '진행' : '마감'}</Badge>
            <div style={{ flex: 1 }}>
              <span style={{ fontWeight: 600 }}>{m.product}</span>
              <span style={{ color: 'var(--text-3)', fontSize: 13, marginLeft: 10 }}>{m.company}</span>
            </div>
            <div style={{ color: 'var(--text-3)', fontSize: 13, fontFamily: 'var(--font-mono)' }}>
              {m.filled}/{m.slots} 패널
            </div>
            <div style={{ color: 'var(--text-3)', fontSize: 12 }}>{m.createdAt}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
