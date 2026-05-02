import { useEffect, useState } from 'react';
import { Card, Badge, Btn, Stat } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { getHonorLevel, HONOR_COLOR_META } from '../../lib/honorLevels';

const scoreColor = (s) => s >= 80 ? 'var(--green)' : s >= 60 ? 'var(--accent)' : 'var(--red)';

export default function AdminPanels() {
  const [panels, setPanels]       = useState([]);
  const [selected, setSelected]   = useState(null);
  const [loading, setLoading]     = useState(true);
  const [acting, setActing]       = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [levelFilter, setLevelFilter]   = useState('all');

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from('panels')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) console.error('[AdminPanels]', error.message);
      setPanels(data || []);
      setLoading(false);
    }
    load();
  }, []);

  const updatePanel = async (id, fields) => {
    setActing(true);
    await supabase.from('panels').update(fields).eq('id', id);
    setPanels(ps => ps.map(p => p.id === id ? { ...p, ...fields } : p));
    setActing(false);
  };

  const filtered = panels.filter(p => {
    const statusOk = statusFilter === 'all' || (p.status || 'active') === statusFilter;
    if (!statusOk) return false;
    if (levelFilter === 'all') return true;
    const lv = getHonorLevel(p.honor_points ?? 0).level;
    if (levelFilter === '1-3')  return lv >= 1 && lv <= 3;
    if (levelFilter === '4-6')  return lv >= 4 && lv <= 6;
    if (levelFilter === '7-9')  return lv >= 7 && lv <= 9;
    if (levelFilter === '10')   return lv === 10;
    return true;
  });

  const panel = selected ? panels.find(p => p.id === selected) : null;

  const activeCount    = panels.filter(p => (p.status || 'active') === 'active').length;
  const pendingCount   = panels.filter(p => p.status === 'pending').length;
  const suspendedCount = panels.filter(p => p.status === 'suspended').length;
  const avgTrust       = activeCount > 0
    ? Math.round(panels.filter(p => (p.status || 'active') === 'active').reduce((s, p) => s + (p.trust_score || 0), 0) / activeCount)
    : 0;

  if (loading) return (
    <div style={{ padding: '40px 48px', color: 'var(--text-3)', fontSize: 14 }}>불러오는 중...</div>
  );

  return (
    <div style={{ padding: '40px 48px', maxWidth: 1100, animation: 'fadeUp 0.5s ease both' }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--accent)', marginBottom: 8, letterSpacing: '0.1em' }}>ADMIN · PANEL MANAGEMENT</div>
        <h1 style={{ fontSize: 28, fontWeight: 800 }}>패널 관리</h1>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, background: 'var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', marginBottom: 28 }}>
        {[
          { label: '전체 패널',  value: String(panels.length) },
          { label: '활성',       value: String(activeCount) },
          { label: '심사 대기',  value: String(pendingCount) },
          { label: '평균 Trust', value: String(avgTrust), accent: true },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--surface)', padding: '20px 24px' }}>
            <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>{s.label}</div>
            <div style={{ fontSize: 32, fontWeight: 800, color: s.accent ? 'var(--accent)' : 'var(--text)', fontFamily: 'var(--font-mono)', lineHeight: 1 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 4, background: 'var(--surface)', borderRadius: 'var(--radius)', padding: 4 }}>
          {[['all', '전체'], ['active', '활성'], ['pending', '심사대기'], ['suspended', '정지']].map(([v, l]) => (
            <button key={v} onClick={() => setStatusFilter(v)} style={{
              padding: '5px 12px', borderRadius: 3, fontSize: 12, fontWeight: 500,
              background: statusFilter === v ? 'var(--bg)' : 'transparent',
              color: statusFilter === v ? 'var(--text)' : 'var(--text-3)',
              border: 'none', cursor: 'pointer', transition: 'all 0.15s',
            }}>{l}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {[['all', '전체 레벨'], ['1-3', 'Lv.1-3'], ['4-6', 'Lv.4-6'], ['7-9', 'Lv.7-9'], ['10', 'Lv.10']].map(([v, l]) => (
            <button key={v} onClick={() => setLevelFilter(v)} style={{
              padding: '5px 12px', borderRadius: 'var(--radius)', fontSize: 12, fontWeight: 500,
              background: levelFilter === v ? 'var(--accent)' : 'var(--surface)',
              color: levelFilter === v ? '#FFFFFF' : 'var(--text-3)',
              border: '1px solid ' + (levelFilter === v ? 'var(--accent)' : 'var(--border)'),
              cursor: 'pointer', transition: 'all 0.15s',
            }}>{l}</button>
          ))}
        </div>
      </div>

      {panels.length === 0 ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-3)', fontSize: 14, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' }}>
          등록된 패널이 없습니다.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 360px' : '1fr', gap: 20 }}>
          {/* Table */}
          <Card style={{ padding: 0, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['이름', '직군', 'Trust', '레벨', '완료', '상태', ''].map(h => (
                    <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((p, i) => {
                  const status = p.status || 'active';
                  const hl     = getHonorLevel(p.honor_points ?? 0);
                  const cm     = HONOR_COLOR_META[hl.colorTier];
                  return (
                    <tr key={p.id} onClick={() => setSelected(selected === p.id ? null : p.id)} style={{
                      borderBottom: i < filtered.length - 1 ? '1px solid var(--border)' : 'none',
                      background: selected === p.id ? 'var(--surface-2)' : 'transparent',
                      cursor: 'pointer', transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => selected !== p.id && (e.currentTarget.style.background = 'var(--bg-3)')}
                    onMouseLeave={e => selected !== p.id && (e.currentTarget.style.background = 'transparent')}
                    >
                      <td style={{ padding: '12px 16px', fontWeight: 600, fontSize: 13 }}>{p.name}</td>
                      <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-3)' }}>{p.industry || '—'}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: 15, color: scoreColor(p.trust_score || 0) }}>
                          {p.trust_score || 0}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10, color: cm.color, background: cm.bg, border: `1px solid ${cm.color}` }}>
                          Lv.{hl.level}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-2)' }}>{p.total_missions || 0}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <Badge type={status === 'active' ? 'green' : status === 'pending' ? 'gold' : 'red'}>
                          {status === 'active' ? '활성' : status === 'pending' ? '심사중' : '정지'}
                        </Badge>
                      </td>
                      <td style={{ padding: '12px 16px', color: 'var(--text-3)', fontSize: 12 }}>→</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>

          {/* Detail panel */}
          {panel && (() => {
            const status  = panel.status || 'active';
            const hl      = getHonorLevel(panel.honor_points ?? 0);
            const cm      = HONOR_COLOR_META[hl.colorTier];
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <Card>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 20, marginBottom: 4 }}>{panel.name}</div>
                      <div style={{ fontSize: 13, color: 'var(--text-2)' }}>{panel.industry || '직군 미설정'}</div>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 700, padding: '4px 12px', borderRadius: 20, color: cm.color, background: cm.bg, border: `1px solid ${cm.color}` }}>
                      Lv.{hl.level} · {(panel.honor_points ?? 0).toLocaleString()}pts
                    </span>
                  </div>

                  <div style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-3)', marginBottom: 6, fontFamily: 'var(--font-mono)' }}>
                      <span>TRUST SCORE</span>
                      <span style={{ color: scoreColor(panel.trust_score || 0), fontWeight: 700 }}>{panel.trust_score || 0}</span>
                    </div>
                    <div style={{ height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ width: `${panel.trust_score || 0}%`, height: '100%', background: scoreColor(panel.trust_score || 0), borderRadius: 3 }} />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {[
                      { label: '경력',       value: panel.experience || '—' },
                      { label: '완료 미션',  value: `${panel.total_missions || 0}건` },
                      { label: '명예 포인트', value: `${(panel.honor_points ?? 0).toLocaleString()}pts` },
                      { label: '가입일',     value: new Date(panel.created_at).toLocaleDateString('ko-KR') },
                      { label: '상태',       value: status === 'active' ? '활성' : status === 'pending' ? '심사중' : '정지' },
                    ].map(({ label, value }) => (
                      <div key={label} style={{ padding: '10px 12px', background: 'var(--bg-3)', borderRadius: 'var(--radius)' }}>
                        <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{label}</div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{value}</div>
                      </div>
                    ))}
                  </div>
                </Card>

                {/* 뱃지 */}
                <Card style={{ padding: '18px 20px' }}>
                  <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>획득 뱃지</div>
                  {(panel.badges && panel.badges.length > 0) ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {panel.badges.map(b => (
                        <span key={b} style={{
                          padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                          background: 'var(--accent-dim)', color: 'var(--accent)',
                          border: '1px solid rgba(232,213,163,0.4)',
                        }}>{b}</span>
                      ))}
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: 'var(--text-3)' }}>획득한 뱃지가 없습니다.</div>
                  )}
                  {(panel.streak_count > 0) && (
                    <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-2)' }}>
                      🔥 이번 주 {panel.streak_count}건 제출
                    </div>
                  )}
                </Card>

                {/* Actions */}
                <Card style={{ padding: '18px 20px' }}>
                  <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 }}>관리 액션</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {status === 'pending' && (
                      <>
                        <Btn size="sm" disabled={acting} style={{ justifyContent: 'center' }}
                          onClick={() => updatePanel(panel.id, { status: 'active' })}>
                          ✓ 심사 승인
                        </Btn>
                        <Btn size="sm" variant="danger" disabled={acting} style={{ justifyContent: 'center' }}
                          onClick={() => updatePanel(panel.id, { status: 'suspended' })}>
                          ✕ 심사 거절
                        </Btn>
                      </>
                    )}
                    {status === 'active' && (
                      <Btn size="sm" variant="danger" disabled={acting} style={{ justifyContent: 'center' }}
                        onClick={() => updatePanel(panel.id, { status: 'suspended' })}>
                        활동 정지
                      </Btn>
                    )}
                    {status === 'suspended' && (
                      <Btn size="sm" disabled={acting} style={{ justifyContent: 'center' }}
                        onClick={() => updatePanel(panel.id, { status: 'active' })}>
                        활동 재개
                      </Btn>
                    )}
                  </div>
                </Card>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
