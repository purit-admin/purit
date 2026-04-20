import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Badge, Btn } from '../../components/ui';
import { MISSIONS } from '../../lib/data';

export default function MissionList() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState('all');

  const filtered = filter === 'all' ? MISSIONS : MISSIONS.filter(m => m.status === filter);

  return (
    <div style={{ padding: '40px 48px', maxWidth: 900, animation: 'fadeUp 0.5s ease both' }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--green)', marginBottom: 8, letterSpacing: '0.1em' }}>MISSION BOARD</div>
        <h1 style={{ fontSize: 28, fontWeight: 800 }}>미션 탐색</h1>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: 'var(--surface)', borderRadius: 'var(--radius)', padding: 4, width: 'fit-content' }}>
        {[['all', '전체'], ['active', '진행 중'], ['closed', '마감']].map(([v, l]) => (
          <button key={v} onClick={() => setFilter(v)} style={{
            padding: '6px 16px', borderRadius: 4, fontSize: 13, fontWeight: 500,
            background: filter === v ? 'var(--bg)' : 'transparent',
            color: filter === v ? 'var(--text)' : 'var(--text-3)',
            border: 'none', transition: 'all 0.15s', cursor: 'pointer',
          }}>{l}</button>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {filtered.map(m => (
          <Card key={m.id} style={{ opacity: m.status === 'closed' ? 0.6 : 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
                  <Badge type={m.status === 'active' ? 'green' : 'red'}>
                    {m.status === 'active' ? '진행 중' : '마감'}
                  </Badge>
                  <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)' }}>{m.industry}</span>
                </div>
                <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 6 }}>{m.product}</div>
                <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 12, lineHeight: 1.6 }}>
                  🎯 타겟: {m.targetPersona}
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {m.tags.map(t => <Badge key={t} type="gray">{t}</Badge>)}
                </div>
              </div>
              <div style={{ flexShrink: 0, textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--green)', fontFamily: 'var(--font-mono)' }}>
                    ₩{m.reward.toLocaleString()}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>건당 보상</div>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
                  잔여 <strong style={{ color: 'var(--text)' }}>{m.slots - m.filled}</strong>/{m.slots} 슬롯
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
                  마감 {m.deadline}
                </div>
                {m.status === 'active' && m.filled < m.slots && (
                  <Btn size="sm" onClick={() => navigate('/panel/active')}>수락하기</Btn>
                )}
                {(m.status === 'closed' || m.filled >= m.slots) && (
                  <Btn size="sm" variant="ghost" disabled>마감됨</Btn>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
