import { useNavigate } from 'react-router-dom';
import { Card, Stat, Btn, Badge, ScoreBar } from '../../components/ui';
import { CURRENT_PANEL, MISSIONS, getTierColor } from '../../lib/data';

export default function PanelDashboard() {
  const navigate = useNavigate();
  const p = CURRENT_PANEL;

  return (
    <div style={{ padding: '40px 48px', maxWidth: 1000, animation: 'fadeUp 0.5s ease both' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 40 }}>
        <div>
          <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--green)', marginBottom: 8, letterSpacing: '0.1em' }}>PANEL PORTAL</div>
          <h1 style={{ fontSize: 32, fontWeight: 800, marginBottom: 4 }}>안녕하세요, {p.name}님</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
            <Badge type={getTierColor(p.tier)}>{p.tier}</Badge>
            <span style={{ fontSize: 13, color: 'var(--text-2)' }}>{p.industry} · {p.experience} 경력</span>
          </div>
        </div>
        <Btn onClick={() => navigate('/panel/missions')} size="lg" variant="outline">
          미션 탐색 →
        </Btn>
      </div>

      {/* Trust Score */}
      <Card style={{ marginBottom: 24, background: 'linear-gradient(135deg, var(--surface), var(--bg-3))', borderColor: 'var(--border-light)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 40 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Trust Score
            </div>
            <div style={{ fontSize: 56, fontWeight: 800, color: 'var(--accent)', fontFamily: 'var(--font-mono)', lineHeight: 1 }}>
              {p.trustScore}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>/ 100</div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ height: 8, background: 'var(--border)', borderRadius: 4, overflow: 'hidden', marginBottom: 8 }}>
              <div style={{ width: `${p.trustScore}%`, height: '100%', background: 'linear-gradient(90deg, var(--accent-2), var(--accent))', borderRadius: 4, transition: 'width 1s ease' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
              <span>ROOKIE</span><span>PRO</span><span>EXPERT</span><span>ELITE</span>
            </div>
            <div style={{ marginTop: 12, fontSize: 13, color: 'var(--text-2)' }}>
              다음 등급(ELITE)까지 <strong style={{ color: 'var(--accent)' }}>8점</strong> 필요 · 고단가 의뢰 우선 매칭
            </div>
          </div>
        </div>
      </Card>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, background: 'var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', marginBottom: 32 }}>
        {[
          { label: '완료 미션', value: p.completedMissions, sub: '총 누적' },
          { label: '총 수익', value: `₩${(p.totalEarned/10000).toFixed(0)}만`, sub: '정산 완료', accent: true },
          { label: '수락률', value: '94%', sub: '승인 피드백 기준' },
          { label: '평균 Purity', value: '87', sub: '최근 10건' },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--surface)', padding: '24px 28px' }}>
            <Stat {...s} />
          </div>
        ))}
      </div>

      {/* Available missions preview */}
      <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: 'var(--text-2)' }}>
        매칭된 미션 <span style={{ color: 'var(--green)', fontSize: 13 }}>2건</span>
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {MISSIONS.filter(m => m.status === 'active').map(m => (
          <Card key={m.id} onClick={() => navigate('/panel/missions')} style={{ cursor: 'pointer' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                  <Badge type="green">매칭됨</Badge>
                  <span style={{ fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>{m.industry}</span>
                </div>
                <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 4 }}>{m.product}</div>
                <div style={{ fontSize: 13, color: 'var(--text-2)' }}>{m.targetPersona}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--green)', fontFamily: 'var(--font-mono)' }}>
                  ₩{m.reward.toLocaleString()}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>마감 {m.deadline}</div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
