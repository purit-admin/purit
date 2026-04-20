import { Card, Badge, Btn } from '../../components/ui';
import { MISSIONS } from '../../lib/data';

export default function AdminMissions() {
  return (
    <div style={{ padding: '40px 48px', maxWidth: 1000, animation: 'fadeUp 0.5s ease both' }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--accent)', marginBottom: 8, letterSpacing: '0.1em' }}>ADMIN</div>
        <h1 style={{ fontSize: 28, fontWeight: 800 }}>미션 관리</h1>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {MISSIONS.map(m => (
          <Card key={m.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                  <Badge type={m.status === 'active' ? 'green' : 'red'}>{m.status === 'active' ? '진행' : '마감'}</Badge>
                  <Badge type="gray">{m.industry}</Badge>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-3)', alignSelf: 'center' }}>{m.id.toUpperCase()}</span>
                </div>
                <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 4 }}>{m.product}</div>
                <div style={{ fontSize: 13, color: 'var(--text-2)' }}>{m.company} · {m.targetPersona}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 20, marginBottom: 4 }}>
                  {m.filled}/{m.slots}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 12 }}>패널 슬롯</div>
                <Btn size="sm" variant="secondary">상세 보기</Btn>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
