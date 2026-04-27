import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Stat, Btn, Badge } from '../../components/ui';
import { supabase } from '../../lib/supabase';

export default function PanelDashboard() {
  const navigate = useNavigate();
  const [panel, setPanel]     = useState(null);
  const [missions, setMissions] = useState([]);
  const [loading, setLoading]  = useState(true);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: p } = await supabase
        .from('panels').select('*').eq('user_id', user.id).single();
      setPanel(p);

      const [{ data: ms }, { data: myFeedbacks }] = await Promise.all([
        supabase.from('missions').select('*, feedbacks(id)').eq('status', 'active')
          .order('created_at', { ascending: false }).limit(10),
        supabase.from('feedbacks').select('mission_id').eq('panel_id', p?.id),
      ]);

      const myMissionIds = new Set((myFeedbacks || []).map(f => f.mission_id));
      setMissions((ms || []).filter(m => !myMissionIds.has(m.id)));

      setLoading(false);
    }
    load();
  }, []);

  if (loading) return (
    <div style={{ padding: '40px 48px', color: 'var(--text-3)', fontSize: 14 }}>불러오는 중...</div>
  );

  const name = panel?.name || '패널';

  return (
    <div style={{ padding: '40px 48px', maxWidth: 1000, animation: 'fadeUp 0.5s ease both' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 40 }}>
        <div>
          <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--green)', marginBottom: 8, letterSpacing: '0.1em' }}>PANEL PORTAL</div>
          <h1 style={{ fontSize: 32, fontWeight: 800, marginBottom: 4 }}>안녕하세요, {name}님</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
            <Badge type="green">ACTIVE</Badge>
            <span style={{ fontSize: 13, color: 'var(--text-2)' }}>패널 계정</span>
          </div>
        </div>
        <Btn onClick={() => navigate('/panel/missions')} size="lg" variant="outline">
          미션 탐색 →
        </Btn>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, background: 'var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', marginBottom: 32 }}>
        {[
          { label: '완료 미션', value: String(panel?.total_missions || 0), sub: '총 누적' },
          { label: '활성 미션', value: String(missions.length), sub: '현재 참여 가능' },
          { label: '내 상태', value: '활성', sub: '패널 등급', accent: true },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--surface)', padding: '24px 28px' }}>
            <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>{s.label}</div>
            <div style={{ fontSize: 32, fontWeight: 800, color: s.accent ? 'var(--accent)' : 'var(--text)', fontFamily: 'var(--font-mono)', lineHeight: 1, marginBottom: 4 }}>{s.value}</div>
            <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Available missions */}
      <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: 'var(--text-2)' }}>
        참여 가능한 미션{' '}
        <span style={{ color: 'var(--green)', fontSize: 13 }}>{missions.length}건</span>
      </h2>

      {missions.length === 0 ? (
        <div style={{
          padding: '40px', textAlign: 'center',
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)', color: 'var(--text-3)', fontSize: 14,
        }}>
          현재 매칭 가능한 미션이 없습니다.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {missions.map(m => (
            <Card key={m.id} onClick={() => navigate(`/panel/active?id=${m.id}`)} style={{ cursor: 'pointer' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                    <Badge type="green">진행 중</Badge>
                    <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)' }}>
                      {m.id.slice(0, 8).toUpperCase()}
                    </span>
                  </div>
                  <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 4 }}>{m.title}</div>
                  {m.persona && (
                    <div style={{ fontSize: 13, color: 'var(--text-2)' }}>🎯 {m.persona}</div>
                  )}
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--green)', fontFamily: 'var(--font-mono)' }}>
                    ₩{(m.reward_amount || 0).toLocaleString()}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>
                    잔여 {Math.max(0, (m.panel_count || 0) - (m.feedbacks?.length ?? m.filled_count ?? 0))}/{m.panel_count} 슬롯
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
