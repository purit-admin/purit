import { Card, Stat, Badge } from '../../components/ui';
import { CURRENT_PANEL } from '../../lib/data';

const HISTORY = [
  { id: 'h1', mission: '프리미엄 러닝화 LP', company: '어반핏 코리아', reward: 45000, purity: 88, status: 'paid', date: '2025-07-14' },
  { id: 'h2', mission: '단백질 구독 LP', company: '뉴트리아 랩스', reward: 38000, purity: 92, status: 'paid', date: '2025-07-08' },
  { id: 'h3', mission: '법인카드 신청 LP', company: '핀테크베이스', reward: 80000, purity: 85, status: 'pending', date: '2025-07-13' },
  { id: 'h4', mission: '온라인 강의 LP', company: '에듀플러스', reward: 30000, purity: 31, status: 'rejected', date: '2025-07-01' },
];

export default function History() {
  const p = CURRENT_PANEL;
  const paid = HISTORY.filter(h => h.status === 'paid').reduce((s, h) => s + h.reward, 0);
  const pending = HISTORY.filter(h => h.status === 'pending').reduce((s, h) => s + h.reward, 0);

  return (
    <div style={{ padding: '40px 48px', maxWidth: 860, animation: 'fadeUp 0.5s ease both' }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--green)', marginBottom: 8, letterSpacing: '0.1em' }}>EARNINGS</div>
        <h1 style={{ fontSize: 28, fontWeight: 800 }}>내 수익</h1>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, background: 'var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', marginBottom: 32 }}>
        {[
          { label: '총 정산 완료', value: `₩${(paid/10000).toFixed(0)}만`, accent: true },
          { label: '정산 대기 중', value: `₩${(pending/10000).toFixed(0)}만` },
          { label: '평균 Purity', value: `${Math.round(HISTORY.filter(h=>h.status!=='rejected').reduce((s,h)=>s+h.purity,0)/HISTORY.filter(h=>h.status!=='rejected').length)}` },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--surface)', padding: '24px 28px' }}>
            <Stat {...s} />
          </div>
        ))}
      </div>

      <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-2)', marginBottom: 14 }}>이력</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {HISTORY.map(h => (
          <div key={h.id} style={{
            display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px',
            background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)',
            opacity: h.status === 'rejected' ? 0.55 : 1,
          }}>
            <Badge type={h.status === 'paid' ? 'green' : h.status === 'pending' ? 'gold' : 'red'}>
              {h.status === 'paid' ? '정산완료' : h.status === 'pending' ? '검토중' : '필터탈락'}
            </Badge>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600 }}>{h.mission}</div>
              <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{h.company}</div>
            </div>
            <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)' }}>
              Purity {h.purity}
            </div>
            <div style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', color: h.status === 'paid' ? 'var(--green)' : h.status === 'pending' ? 'var(--accent)' : 'var(--text-3)' }}>
              {h.status === 'rejected' ? '—' : `₩${h.reward.toLocaleString()}`}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{h.date}</div>
          </div>
        ))}
      </div>

      {HISTORY.some(h => h.status === 'rejected') && (
        <Card style={{ marginTop: 20, borderColor: 'rgba(224,112,112,0.2)', background: 'var(--red-dim)' }}>
          <div style={{ fontSize: 13, color: 'var(--red)', fontWeight: 600, marginBottom: 6 }}>Purity Filter 탈락 안내</div>
          <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.7 }}>
            Purity Score 50 미만의 피드백은 자동 반려됩니다. 구체적인 전환 근거와 개선안을 포함하면 합격률이 높아집니다. Trust Score에도 영향을 미칩니다.
          </p>
        </Card>
      )}
    </div>
  );
}
