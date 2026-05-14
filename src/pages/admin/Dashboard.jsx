import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Stat, Badge } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { getHonorLevel, HONOR_COLOR_META } from '../../lib/honorLevels';

const C = {
  pageBg:  '#F8FAFC',
  cardBg:  '#FFFFFF',
  primary: '#10367D',
  text:    '#0F172A',
  text2:   '#475569',
  text3:   '#94A3B8',
  blue50:  '#E8EEF8',
  shadow:  '0 1px 3px rgba(0,0,0,0.06)',
};

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [stats, setStats]   = useState({ missions: 0, panels: 0, feedbacks: 0, passed: 0 });
  const [panels, setPanels] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [
          { count: mCount, error: e1 },
          { count: pCount, error: e2 },
          { count: fbCount, error: e3 },
          { count: passedCount, error: e4 },
          { data: panelList, error: e5 },
        ] = await Promise.all([
          supabase.from('missions').select('*', { count: 'exact', head: true }).neq('status', 'draft'),
          supabase.from('panels').select('*', { count: 'exact', head: true }),
          supabase.from('feedbacks').select('*', { count: 'exact', head: true }).neq('status', 'draft'),
          supabase.from('feedbacks').select('*', { count: 'exact', head: true }).neq('status', 'draft').eq('purity_passed', true),
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
      } catch (err) {
        console.error('[AdminDashboard load]', err);
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return (
    <div style={{ background: C.pageBg, minHeight: '100vh', padding: '40px 48px', color: C.text3, fontSize: 14 }}>불러오는 중...</div>
  );

  const purityRate = stats.feedbacks > 0
    ? Math.round((stats.passed / stats.feedbacks) * 100)
    : 0;

  const pendingFeedbacks = stats.feedbacks - stats.passed;
  const purityColor = purityRate >= 70 ? '#22C55E' : purityRate >= 50 ? C.primary : '#EF4444';

  return (
    <div className="page-wrap" style={{ background: C.pageBg, minHeight: '100vh', padding: '40px 48px', maxWidth: 1100, animation: 'fadeUp 0.5s ease both' }}>
      <div style={{ marginBottom: 36 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: C.text }}>플랫폼 개요</h1>
      </div>

      {/* Stats */}
      <div className="dash-stat-grid-4">
        {[
          { label: '총 의뢰',      value: String(stats.missions),  sub: '누적' },
          { label: '등록 패널',    value: String(stats.panels),    sub: '전체' },
          { label: '총 피드백',    value: String(stats.feedbacks), sub: '제출됨' },
          { label: '검증 통과율',  value: `${purityRate}%`,       sub: 'Purit Filter', accent: true },
        ].map(s => (
          <div key={s.label} style={{ background: C.cardBg, borderRadius: 16, padding: '24px', boxShadow: C.shadow }}>
            <div style={{ fontSize: 12, color: C.text3, fontWeight: 500, marginBottom: 10 }}>{s.label}</div>
            <div style={{ fontSize: 36, fontWeight: 800, color: s.accent ? C.primary : C.text, letterSpacing: '-0.03em', lineHeight: 1, marginBottom: 6 }}>{s.value}</div>
            <div style={{ fontSize: 12, color: C.text3 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      <div className="dash-two-col">
        {/* Quick actions */}
        <div style={{ background: C.cardBg, borderRadius: 16, padding: '24px', boxShadow: C.shadow }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 16 }}>빠른 작업</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { label: '검토 대기 피드백', count: pendingFeedbacks, type: 'gold', path: '/admin/purity' },
              { label: '전체 미션 현황',   count: stats.missions,    type: 'blue', path: '/admin/missions' },
              { label: '등록 패널 관리',   count: stats.panels,      type: 'green', path: '/admin/panels' },
            ].map(item => (
              <div key={item.label} onClick={() => navigate(item.path)} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '14px 16px', background: '#F8FAFC', borderRadius: 12,
                cursor: 'pointer', transition: 'background 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = C.blue50}
              onMouseLeave={e => e.currentTarget.style.background = '#F8FAFC'}
              >
                <span style={{ fontSize: 14, color: C.text2, fontWeight: 500 }}>{item.label}</span>
                <Badge type={item.type}>{item.count}</Badge>
              </div>
            ))}
          </div>
        </div>

        {/* Purit summary */}
        <div style={{ background: C.cardBg, borderRadius: 16, padding: '24px', boxShadow: C.shadow }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 16 }}>Purit 현황</div>
          <div style={{ textAlign: 'center', padding: '12px 0' }}>
            <div style={{ fontSize: 52, fontWeight: 800, color: purityColor, letterSpacing: '-0.04em', lineHeight: 1 }}>
              {purityRate}%
            </div>
            <div style={{ fontSize: 12, color: C.text3, marginTop: 8 }}>통과율</div>
          </div>
          <div style={{ height: 6, background: '#E2E8F0', borderRadius: 4, overflow: 'hidden', marginTop: 12 }}>
            <div style={{ width: `${purityRate}%`, height: '100%', background: purityColor, borderRadius: 4, transition: 'width 0.8s ease' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: C.text3, marginTop: 10 }}>
            <span>통과 {stats.passed}건</span>
            <span>미통과 {stats.feedbacks - stats.passed}건</span>
          </div>
        </div>
      </div>

      {/* Panels table */}
      <div style={{ fontSize: 15, fontWeight: 700, color: C.text2, marginBottom: 12 }}>최근 패널</div>
      {panels.length === 0 ? (
        <div style={{ padding: '32px', textAlign: 'center', color: C.text3, fontSize: 14, background: C.cardBg, borderRadius: 16, boxShadow: C.shadow }}>
          등록된 패널이 없습니다.
        </div>
      ) : (
        <div style={{ background: C.cardBg, borderRadius: 16, overflow: 'hidden', boxShadow: C.shadow }}>
          <div className="table-scroll">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#F8FAFC' }}>
                {['이름', '직군', 'Trust Score', '등급', '완료 미션', '상태'].map(h => (
                  <th key={h} style={{ padding: '12px 20px', textAlign: 'left', fontSize: 11, color: C.text3, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {panels.map((p, i) => (
                <tr key={p.id}
                  style={{ borderTop: '1px solid #F1F5F9', transition: 'background 0.12s', cursor: 'default' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={{ padding: '14px 20px', fontWeight: 600, color: C.text, fontSize: 14 }}>{p.name}</td>
                  <td style={{ padding: '14px 20px', fontSize: 13, color: C.text2 }}>{p.industry || '—'}</td>
                  <td style={{ padding: '14px 20px', fontWeight: 700, color: (p.trust_score || 0) >= 80 ? '#22C55E' : (p.trust_score || 0) >= 60 ? C.primary : C.text2, fontSize: 14 }}>
                    {p.trust_score || 0}
                  </td>
                  <td style={{ padding: '14px 20px' }}>
                    {(() => {
                      const hl = getHonorLevel(p.honor_points ?? 0);
                      const cm = HONOR_COLOR_META[hl.colorTier];
                      return (
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10, color: cm.color, background: cm.bg, border: `1px solid ${cm.color}` }}>
                          Lv.{hl.level}
                        </span>
                      );
                    })()}
                  </td>
                  <td style={{ padding: '14px 20px', fontSize: 13, color: C.text2 }}>{p.total_missions || 0}</td>
                  <td style={{ padding: '14px 20px' }}>
                    <Badge type={p.status === 'active' ? 'green' : p.status === 'pending' ? 'gold' : 'red'}>
                      {p.status === 'active' ? '활성' : p.status === 'pending' ? '심사중' : p.status === 'suspended' ? '정지' : '활성'}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </div>
  );
}
