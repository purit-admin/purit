import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Badge, Btn } from '../../components/ui';
import { supabase } from '../../lib/supabase';

export default function MissionList() {
  const navigate = useNavigate();
  const [missions, setMissions] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState('all');

  useEffect(() => {
    async function load() {
      const { data: ms } = await supabase
        .from('missions')
        .select('*')
        .order('created_at', { ascending: false });
      setMissions(ms || []);
      setLoading(false);
    }
    load();
  }, []);

  const filtered = filter === 'all'
    ? missions
    : missions.filter(m => m.status === filter);

  if (loading) return (
    <div style={{ padding: '40px 48px', color: 'var(--text-3)', fontSize: 14 }}>불러오는 중...</div>
  );

  return (
    <div style={{ padding: '40px 48px', maxWidth: 900, animation: 'fadeUp 0.5s ease both' }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--green)', marginBottom: 8, letterSpacing: '0.1em' }}>MISSION BOARD</div>
        <h1 style={{ fontSize: 28, fontWeight: 800 }}>미션 탐색</h1>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: 'var(--surface)', borderRadius: 'var(--radius)', padding: 4, width: 'fit-content' }}>
        {[['all', '전체'], ['active', '진행 중'], ['completed', '완료']].map(([v, l]) => (
          <button key={v} onClick={() => setFilter(v)} style={{
            padding: '6px 16px', borderRadius: 4, fontSize: 13, fontWeight: 500,
            background: filter === v ? 'var(--bg)' : 'transparent',
            color: filter === v ? 'var(--text)' : 'var(--text-3)',
            border: 'none', transition: 'all 0.15s', cursor: 'pointer',
          }}>{l}</button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-3)', fontSize: 14, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' }}>
          해당 조건의 미션이 없습니다.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.map(m => {
            const slots = m.panel_count || 0;
            const filled = m.filled_count || 0;
            const isClosed = m.status !== 'active' || filled >= slots;
            return (
              <Card key={m.id} style={{ opacity: isClosed ? 0.6 : 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
                      <Badge type={m.status === 'active' ? 'green' : 'gray'}>
                        {m.status === 'active' ? '진행 중' : m.status === 'completed' ? '완료' : m.status}
                      </Badge>
                      <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)' }}>
                        {m.id.slice(0, 8).toUpperCase()}
                      </span>
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 6 }}>{m.title}</div>
                    {m.persona && (
                      <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 12, lineHeight: 1.6 }}>
                        🎯 타겟: {m.persona}
                      </div>
                    )}
                    {m.target_url && (
                      <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{m.target_url}</div>
                    )}
                  </div>
                  <div style={{ flexShrink: 0, textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 12 }}>
                    <div>
                      <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--green)', fontFamily: 'var(--font-mono)' }}>
                        ₩{(m.reward_amount || 0).toLocaleString()}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>건당 보상</div>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
                      잔여 <strong style={{ color: 'var(--text)' }}>{Math.max(0, slots - filled)}</strong>/{slots} 슬롯
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
                      {new Date(m.created_at).toLocaleDateString('ko-KR')} 등록
                    </div>
                    {!isClosed ? (
                      <Btn size="sm" onClick={() => navigate('/panel/active')}>수락하기</Btn>
                    ) : (
                      <Btn size="sm" variant="ghost" disabled>마감됨</Btn>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
