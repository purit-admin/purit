import { useEffect, useState } from 'react';
import { Card, Badge, Btn } from '../../components/ui';
import { supabase } from '../../lib/supabase';

const STATUS_LABEL = { draft: '초안', active: '진행', in_review: '검토중', completed: '완료', cancelled: '취소' };
const STATUS_TYPE  = { draft: 'gray', active: 'green', in_review: 'blue', completed: 'gold', cancelled: 'red' };

export default function AdminMissions() {
  const [missions, setMissions] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState('all');

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('missions')
        .select('*, companies(name)')
        .order('created_at', { ascending: false });
      setMissions(data || []);
      setLoading(false);
    }
    load();
  }, []);

  const updateStatus = async (id, status) => {
    await supabase.from('missions').update({ status }).eq('id', id);
    setMissions(ms => ms.map(m => m.id === id ? { ...m, status } : m));
  };

  const filtered = filter === 'all' ? missions : missions.filter(m => m.status === filter);

  if (loading) return (
    <div style={{ padding: '40px 48px', color: 'var(--text-3)', fontSize: 14 }}>불러오는 중...</div>
  );

  return (
    <div style={{ padding: '40px 48px', maxWidth: 1000, animation: 'fadeUp 0.5s ease both' }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--accent)', marginBottom: 8, letterSpacing: '0.1em' }}>ADMIN</div>
        <h1 style={{ fontSize: 28, fontWeight: 800 }}>미션 관리</h1>
      </div>

      {/* Filter */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: 'var(--surface)', borderRadius: 'var(--radius)', padding: 4, width: 'fit-content' }}>
        {[['all', '전체'], ['active', '진행'], ['completed', '완료'], ['cancelled', '취소']].map(([v, l]) => (
          <button key={v} onClick={() => setFilter(v)} style={{
            padding: '6px 14px', borderRadius: 4, fontSize: 13, fontWeight: 500,
            background: filter === v ? 'var(--bg)' : 'transparent',
            color: filter === v ? 'var(--text)' : 'var(--text-3)',
            border: 'none', transition: 'all 0.15s', cursor: 'pointer',
          }}>{l}</button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-3)', fontSize: 14, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' }}>
          해당 조건의 의뢰가 없습니다.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(m => (
            <Card key={m.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center' }}>
                    <Badge type={STATUS_TYPE[m.status] || 'gray'}>
                      {STATUS_LABEL[m.status] || m.status}
                    </Badge>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-3)' }}>
                      {m.id.slice(0, 8).toUpperCase()}
                    </span>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 4 }}>{m.title}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 4 }}>
                    {m.companies?.name || '—'}{m.persona ? ` · ${m.persona}` : ''}
                  </div>
                  {m.target_url && (
                    <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{m.target_url}</div>
                  )}
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 24 }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 20, marginBottom: 4 }}>
                    {m.filled_count || 0}/{m.panel_count}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 12 }}>패널 슬롯</div>
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                    {m.status === 'active' && (
                      <Btn size="sm" variant="secondary" onClick={() => updateStatus(m.id, 'completed')}>완료 처리</Btn>
                    )}
                    {m.status === 'active' && (
                      <Btn size="sm" variant="danger" onClick={() => updateStatus(m.id, 'cancelled')}>취소</Btn>
                    )}
                    {m.status === 'cancelled' && (
                      <Btn size="sm" onClick={() => updateStatus(m.id, 'active')}>재개</Btn>
                    )}
                  </div>
                </div>
              </div>
              <div style={{ marginTop: 14, width: '100%', height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{
                  width: `${Math.min(((m.filled_count || 0) / m.panel_count) * 100, 100)}%`,
                  height: '100%', background: 'var(--accent)', borderRadius: 2, transition: 'width 0.4s',
                }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-3)', marginTop: 6 }}>
                <span>{new Date(m.created_at).toLocaleDateString('ko-KR')} 등록</span>
                <span>보상 ₩{(m.reward_amount || 0).toLocaleString()}/건</span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
