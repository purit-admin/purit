import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Stat, Badge } from '../../components/ui';
import { supabase } from '../../lib/supabase';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [stats, setStats]   = useState({ missions: 0, panels: 0, feedbacks: 0, passed: 0 });
  const [panels, setPanels] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [
        { count: mCount, error: e1 },
        { count: pCount, error: e2 },
        { count: fbCount, error: e3 },
        { count: passedCount, error: e4 },
        { data: panelList, error: e5 },
      ] = await Promise.all([
        supabase.from('missions').select('*', { count: 'exact', head: true }),
        supabase.from('panels').select('*', { count: 'exact', head: true }),
        supabase.from('feedbacks').select('*', { count: 'exact', head: true }),
        supabase.from('feedbacks').select('*', { count: 'exact', head: true }).eq('purity_passed', true),
        supabase.from('panels').select('*').order('created_at', { ascending: false }).limit(10),
      ]);

      [e1,e2,e3,e4,e5].forEach((e,i) => e && console.error(`[AdminDashboard] query${i+1}:`, e.message));
      setStats({
        missions:  mCount  || 0,
        panels:    pCount  || 0,
        feedbacks: fbCount || 0,
        passed:    passedCount || 0,
      });
      setPanels(panelList || []);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return (
    <div style={{ padding: '40px 48px', color: 'var(--text-3)', fontSize: 14 }}>불러오는 중...</div>
  );

  const purityRate = stats.feedbacks > 0
    ? Math.round((stats.passed / stats.feedbacks) * 100)
    : 0;

  const pendingFeedbacks = stats.feedbacks - stats.passed;

  return (
    <div style={{ padding: '40px 48px', maxWidth: 1100, animation: 'fadeUp 0.5s ease both' }}>
      <div style={{ marginBottom: 40 }}>
        <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--accent)', marginBottom: 8, letterSpacing: '0.1em' }}>ADMIN PORTAL</div>
        <h1 style={{ fontSize: 32, fontWeight: 800 }}>플랫폼 개요</h1>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, background: 'var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', marginBottom: 32 }}>
        {[
          { label: '총 의뢰',      value: String(stats.missions),  sub: '누적' },
          { label: '등록 패널',    value: String(stats.panels),    sub: '전체' },
          { label: '총 피드백',    value: String(stats.feedbacks), sub: '제출됨' },
          { label: 'Purit 통과율', value: `${purityRate}%`,       sub: '품질 기준', accent: true },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--surface)', padding: '24px 20px' }}>
            <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>{s.label}</div>
            <div style={{ fontSize: 32, fontWeight: 800, color: s.accent ? 'var(--accent)' : 'var(--text)', fontFamily: 'var(--font-mono)', lineHeight: 1, marginBottom: 4 }}>{s.value}</div>
            <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{s.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20, marginBottom: 24 }}>
        {/* Quick actions */}
        <Card>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 16 }}>빠른 작업</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { label: '검토 대기 피드백', count: pendingFeedbacks, type: 'gold', path: '/admin/purity' },
              { label: '전체 미션 현황', count: stats.missions, type: 'blue', path: '/admin/missions' },
              { label: '등록 패널 관리', count: stats.panels, type: 'green', path: '/admin/panels' },
            ].map(item => (
              <div key={item.label} onClick={() => navigate(item.path)} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '14px 16px', background: 'var(--bg-3)', borderRadius: 'var(--radius)',
                border: '1px solid var(--border)', cursor: 'pointer', transition: 'background 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'}
              onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-3)'}
              >
                <span style={{ fontSize: 13 }}>{item.label}</span>
                <Badge type={item.type}>{item.count}</Badge>
              </div>
            ))}
          </div>
        </Card>

        {/* Purit summary */}
        <Card>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 16 }}>Purit 현황</div>
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <div style={{ fontSize: 56, fontWeight: 800, fontFamily: 'var(--font-mono)', color: purityRate >= 70 ? 'var(--green)' : purityRate >= 50 ? 'var(--accent)' : 'var(--red)', lineHeight: 1 }}>
              {purityRate}%
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 8 }}>통과율</div>
          </div>
          <div style={{ height: 8, background: 'var(--border)', borderRadius: 4, overflow: 'hidden', marginTop: 8 }}>
            <div style={{ width: `${purityRate}%`, height: '100%', background: 'var(--accent)', borderRadius: 4, transition: 'width 0.8s ease' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-3)', marginTop: 10 }}>
            <span>통과 {stats.passed}건</span>
            <span>미통과 {stats.feedbacks - stats.passed}건</span>
          </div>
        </Card>
      </div>

      {/* Panels table */}
      <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 14, color: 'var(--text-2)' }}>패널 현황</h2>
      {panels.length === 0 ? (
        <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-3)', fontSize: 14, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' }}>
          등록된 패널이 없습니다.
        </div>
      ) : (
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['이름', '직군', 'Trust Score', '등급', '완료 미션', '상태'].map(h => (
                  <th key={h} style={{ padding: '14px 20px', textAlign: 'left', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {panels.map((p, i) => (
                <tr key={p.id} style={{ borderBottom: i < panels.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <td style={{ padding: '14px 20px', fontWeight: 600 }}>{p.name}</td>
                  <td style={{ padding: '14px 20px', fontSize: 13, color: 'var(--text-2)' }}>{p.industry || '—'}</td>
                  <td style={{ padding: '14px 20px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: (p.trust_score || 0) >= 80 ? 'var(--green)' : (p.trust_score || 0) >= 60 ? 'var(--accent)' : 'var(--text-2)' }}>
                    {p.trust_score || 0}
                  </td>
                  <td style={{ padding: '14px 20px' }}>
                    <Badge type={p.tier === 'EXPERT' || p.tier === 'ELITE' ? 'gold' : p.tier === 'PRO' ? 'blue' : 'gray'}>
                      {p.tier || 'ROOKIE'}
                    </Badge>
                  </td>
                  <td style={{ padding: '14px 20px', fontSize: 13, color: 'var(--text-2)', fontFamily: 'var(--font-mono)' }}>{p.total_missions || 0}</td>
                  <td style={{ padding: '14px 20px' }}>
                    <Badge type={p.status === 'active' ? 'green' : p.status === 'pending' ? 'gold' : 'red'}>
                      {p.status === 'active' ? '활성' : p.status === 'pending' ? '심사중' : p.status === 'suspended' ? '정지' : '활성'}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
