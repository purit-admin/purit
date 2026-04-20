import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Stat, Btn, Badge } from '../../components/ui';
import { supabase } from '../../lib/supabase';

const STATUS_LABEL = { draft: '초안', active: '진행 중', in_review: '검토 중', completed: '완료', cancelled: '취소' };
const STATUS_COLOR = { draft: 'gray', active: 'green', in_review: 'blue', completed: 'gold', cancelled: 'red' };

export default function CompanyDashboard() {
  const navigate = useNavigate();
  const [company, setCompany]   = useState(null);
  const [missions, setMissions] = useState([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: co } = await supabase
        .from('companies')
        .select('*')
        .eq('user_id', user.id)
        .single();
      setCompany(co);

      if (co) {
        const { data: ms } = await supabase
          .from('missions')
          .select('*')
          .eq('company_id', co.id)
          .order('created_at', { ascending: false });
        setMissions(ms || []);
      }
      setLoading(false);
    }
    load();
  }, []);

  const activeMissions    = missions.filter(m => m.status === 'active');
  const completedMissions = missions.filter(m => m.status === 'completed');

  if (loading) return (
    <div style={{ padding: '40px 48px', color: 'var(--text-3)', fontSize: 14 }}>불러오는 중...</div>
  );

  return (
    <div style={{ padding: '40px 48px', maxWidth: 1100, animation: 'fadeUp 0.5s ease both' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 40 }}>
        <div>
          <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--accent)', marginBottom: 8, letterSpacing: '0.1em' }}>
            COMPANY PORTAL
          </div>
          <h1 style={{ fontSize: 32, fontWeight: 800, marginBottom: 6 }}>
            {company?.name || '대시보드'}
          </h1>
          <p style={{ color: 'var(--text-2)', fontSize: 14 }}>광고비 집행 전 전환 결함을 미리 잡으세요.</p>
        </div>
        <Btn onClick={() => navigate('/company/new')} size="lg">
          + 새 의뢰 등록
        </Btn>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, background: 'var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', marginBottom: 32 }}>
        {[
          { label: '전체 의뢰',    value: String(missions.length),       sub: '누적' },
          { label: '진행 중',      value: String(activeMissions.length),  sub: '현재 활성' },
          { label: '완료',         value: String(completedMissions.length), sub: '검증 완료' },
          { label: '플랜',         value: company?.plan?.toUpperCase() || 'FREE', sub: '현재 플랜', accent: true },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--surface)', padding: '24px 28px' }}>
            <Stat {...s} />
          </div>
        ))}
      </div>

      {/* 진행 중 의뢰 */}
      <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: 'var(--text-2)' }}>진행 중인 의뢰</h2>
      {activeMissions.length === 0 ? (
        <div style={{
          padding: '40px', textAlign: 'center',
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)', color: 'var(--text-3)', fontSize: 14, marginBottom: 32,
        }}>
          진행 중인 의뢰가 없습니다.{' '}
          <span style={{ color: 'var(--accent)', cursor: 'pointer', fontWeight: 600 }}
            onClick={() => navigate('/company/new')}>첫 의뢰를 등록해보세요 →</span>
        </div>
      ) : (
        activeMissions.map(m => (
          <Card key={m.id} onClick={() => navigate('/company/results')} style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <Badge type="green">진행 중</Badge>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-3)' }}>
                    {m.id.slice(0, 8).toUpperCase()}
                  </span>
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>{m.title}</div>
                {m.persona && (
                  <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 8 }}>
                    타겟 페르소나: {m.persona}
                  </div>
                )}
                {m.target_url && (
                  <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{m.target_url}</div>
                )}
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 24 }}>
                <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 4, fontFamily: 'var(--font-mono)' }}>피드백 수집</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--accent)' }}>
                  {m.filled_count || 0}
                  <span style={{ fontSize: 16, color: 'var(--text-3)', fontWeight: 400 }}> / {m.panel_count}</span>
                </div>
                <div style={{ width: 120, height: 4, background: 'var(--border)', borderRadius: 2, marginTop: 8, overflow: 'hidden', marginLeft: 'auto' }}>
                  <div style={{ width: `${Math.min(((m.filled_count || 0) / m.panel_count) * 100, 100)}%`, height: '100%', background: 'var(--accent)', borderRadius: 2, transition: 'width 0.4s' }} />
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 8 }}>
                  {new Date(m.created_at).toLocaleDateString('ko-KR')} 등록
                </div>
              </div>
            </div>
          </Card>
        ))
      )}

      {/* 전체 의뢰 목록 */}
      <h2 style={{ fontSize: 16, fontWeight: 700, margin: '32px 0 16px', color: 'var(--text-2)' }}>전체 의뢰 현황</h2>
      {missions.length === 0 ? (
        <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-3)', fontSize: 14 }}>
          등록된 의뢰가 없습니다.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {missions.map(m => (
            <div key={m.id} style={{
              display: 'flex', alignItems: 'center', gap: 16,
              padding: '16px 20px', background: 'var(--surface)',
              borderRadius: 'var(--radius)', border: '1px solid var(--border)',
            }}>
              <Badge type={STATUS_COLOR[m.status] || 'gray'}>
                {STATUS_LABEL[m.status] || m.status}
              </Badge>
              <div style={{ flex: 1 }}>
                <span style={{ fontWeight: 600 }}>{m.title}</span>
              </div>
              <div style={{ color: 'var(--text-3)', fontSize: 13, fontFamily: 'var(--font-mono)' }}>
                패널 {m.panel_count}명
              </div>
              <div style={{ color: 'var(--text-3)', fontSize: 12 }}>
                {new Date(m.created_at).toLocaleDateString('ko-KR')}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
