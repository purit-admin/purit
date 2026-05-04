import { useEffect, useState } from 'react';
import { Card, Badge, Btn, ConfirmModal } from '../../components/ui';
import { supabase } from '../../lib/supabase';

const STATUS_LABEL = { draft: '초안', active: '진행', in_review: '검토중', completed: '완료', cancelled: '취소' };
const STATUS_TYPE  = { draft: 'gray', active: 'green', in_review: 'blue', completed: 'gold', cancelled: 'red' };
const PAGE_SIZE = 10;

function fmtCr(n) { return parseFloat((n ?? 0).toFixed(2)); }

function Pagination({ page, total, onPage }) {
  const totalPages = Math.ceil(total / PAGE_SIZE);
  if (totalPages <= 1) return null;
  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginTop: 12, justifyContent: 'center' }}>
      <button onClick={() => onPage(page - 1)} disabled={page === 1}
        style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', cursor: page === 1 ? 'not-allowed' : 'pointer', opacity: page === 1 ? 0.4 : 1, fontSize: 13 }}>
        이전
      </button>
      {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
        <button key={n} onClick={() => onPage(n)}
          style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid var(--border)', background: page === n ? 'var(--accent)' : 'var(--surface)', color: page === n ? '#fff' : 'var(--text)', cursor: 'pointer', fontSize: 13, fontWeight: page === n ? 700 : 400 }}>
          {n}
        </button>
      ))}
      <button onClick={() => onPage(page + 1)} disabled={page === totalPages}
        style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', cursor: page === totalPages ? 'not-allowed' : 'pointer', opacity: page === totalPages ? 0.4 : 1, fontSize: 13 }}>
        다음
      </button>
    </div>
  );
}

function MissionCard({ m, onUpdateStatus, onDelete, onRecalc }) {
  return (
    <Card key={m.id}>
      <div className="mc-row">
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 7, alignItems: 'center', flexWrap: 'wrap' }}>
            <Badge type={STATUS_TYPE[m.status] || 'gray'}>
              {STATUS_LABEL[m.status] || m.status}
            </Badge>
            {m.type === 'preference' && <Badge type="blue">소재 비교</Badge>}
            {m.type === 'pricing'    && <Badge type="gold">가격 검증</Badge>}
            {m.type === 'email'      && <Badge type="green">이메일 검증</Badge>}
            {(!m.type || m.type === 'landing_page') && <Badge type="gray">LP 검증</Badge>}
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-3)' }}>
              {m.id.slice(0, 8).toUpperCase()}
            </span>
          </div>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 3 }}>{m.title}</div>
          <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 3 }}>
            {m.companies?.name || '—'}{m.persona ? ` · ${m.persona}` : ''}
          </div>
          {m.target_url && (
            <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{m.target_url}</div>
          )}
        </div>
        <div className="mc-right">
          <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 16 }}>
            {m.feedbacks?.length ?? m.filled_count ?? 0}/{m.panel_count}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-3)' }}>패널 슬롯</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {m.status === 'active' && (
              <Btn size="sm" variant="secondary" onClick={() => onUpdateStatus(m.id, 'completed')}>완료 처리</Btn>
            )}
            {m.status === 'active' && (
              <Btn size="sm" variant="danger" onClick={() => onUpdateStatus(m.id, 'cancelled')}>취소</Btn>
            )}
            {m.status === 'completed' && (
              <Btn size="sm" onClick={() => onUpdateStatus(m.id, 'active')}>재진행</Btn>
            )}
            {m.status === 'cancelled' && (
              <Btn size="sm" onClick={() => onUpdateStatus(m.id, 'active')}>재개</Btn>
            )}
            {m.status === 'cancelled' && (
              <Btn size="sm" variant="danger" onClick={() => onDelete(m.id)}>삭제</Btn>
            )}
          </div>
          {m.credits_reserved > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
              <span>{`예상 ${fmtCr(m.credits_reserved)} / 사용 ${fmtCr(m.credits_consumed)} (환불 ${fmtCr(Math.max(0, (m.credits_reserved ?? 0) - (m.credits_consumed ?? 0)))} cr)`}</span>
              {m.status !== 'cancelled' && (
                <button onClick={() => onRecalc(m.id)} title="크레딧 재계산"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontSize: 13, padding: 0, lineHeight: 1 }}>
                  ↺
                </button>
              )}
            </div>
          )}
          <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
            {new Date(m.created_at).toLocaleDateString('ko-KR')}
          </div>
        </div>
      </div>
    </Card>
  );
}

export default function AdminMissions() {
  const [missions, setMissions] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState('active');
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [mainPage, setMainPage] = useState(1);
  const [subPage, setSubPage]   = useState(1);
  const [statusError, setStatusError] = useState('');

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from('missions')
        .select('*, companies(name), feedbacks(id)')
        .order('created_at', { ascending: false });
      if (error) console.error('[AdminMissions]', error.message);
      setMissions(data || []);
      setLoading(false);
    }
    load();
  }, []);

  const updateStatus = async (id, newStatus) => {
    setStatusError('');
    if (newStatus === 'completed') {
      const { data, error } = await supabase.rpc('complete_mission_and_refund', { p_mission_id: id });
      if (error || !data?.success) {
        setStatusError(error?.message || data?.error || '완료 처리 실패');
        return;
      }
      setMissions(ms => ms.map(m => m.id === id
        ? { ...m, status: 'completed', credits_consumed: data.credits_consumed }
        : m
      ));
    } else {
      await supabase.from('missions').update({ status: newStatus }).eq('id', id);
      setMissions(ms => ms.map(m => m.id === id ? { ...m, status: newStatus } : m));
    }
  };

  const deleteMission = async (id) => {
    await supabase.from('missions').delete().eq('id', id);
    setMissions(ms => ms.filter(m => m.id !== id));
    setConfirmDelete(null);
  };

  const recalcCredits = async (id) => {
    const { data, error } = await supabase.rpc('recalc_mission_consumed', { p_mission_id: id });
    if (error) { setStatusError('재계산 실패: ' + error.message); return; }
    setMissions(ms => ms.map(m => m.id === id ? { ...m, credits_consumed: data } : m));
  };

  const filtered = filter === 'all' ? missions : missions.filter(m => m.status === filter);

  const mainMissions = filtered.filter(m => !m.type || m.type === 'landing_page');
  const subMissions  = filtered.filter(m => ['preference', 'pricing', 'email'].includes(m.type));

  const mainPaged = mainMissions.slice((mainPage - 1) * PAGE_SIZE, mainPage * PAGE_SIZE);
  const subPaged  = subMissions.slice((subPage - 1) * PAGE_SIZE, subPage * PAGE_SIZE);

  if (loading) return (
    <div style={{ padding: '40px 48px', color: 'var(--text-3)', fontSize: 14 }}>불러오는 중...</div>
  );

  return (
    <div className="page-wrap" style={{ padding: '40px 48px', maxWidth: 1000, animation: 'fadeUp 0.5s ease both' }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--accent)', marginBottom: 8, letterSpacing: '0.1em' }}>ADMIN</div>
        <h1 style={{ fontSize: 28, fontWeight: 800 }}>미션 관리</h1>
      </div>

      {statusError && (
        <div style={{ marginBottom: 16, padding: '10px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius)', fontSize: 13, color: '#ef4444' }}>
          완료 처리 실패: {statusError}
        </div>
      )}

      {/* Filter */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: 'var(--surface)', borderRadius: 'var(--radius)', padding: 4, width: 'fit-content' }}>
        {[['all', '전체'], ['active', '진행'], ['completed', '완료'], ['cancelled', '취소']].map(([v, l]) => (
          <button key={v} onClick={() => { setFilter(v); setMainPage(1); setSubPage(1); }} style={{
            padding: '6px 14px', borderRadius: 4, fontSize: 13, fontWeight: 500,
            background: filter === v ? 'var(--bg)' : 'transparent',
            color: filter === v ? 'var(--text)' : 'var(--text-3)',
            border: 'none', transition: 'all 0.15s', cursor: 'pointer',
          }}>{l}</button>
        ))}
      </div>

      {/* Delete confirm modal (portal) */}
      {confirmDelete && (
        <ConfirmModal
          title="미션을 삭제하시겠습니까?"
          desc="취소된 미션과 관련 데이터가 영구적으로 삭제됩니다."
          confirmLabel="삭제"
          cancelLabel="취소"
          danger
          onConfirm={() => deleteMission(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      {/* 메인/서브 분리 (모든 탭 공통) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
        {/* 메인 미션 섹션 */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-2)' }}>메인 의뢰</h2>
            <Badge type="gray">{mainMissions.length}개</Badge>
          </div>
          {mainMissions.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-3)', fontSize: 14, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' }}>
              해당 조건의 미션이 없습니다.
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {mainPaged.map(m => (
                  <MissionCard key={m.id} m={m} onUpdateStatus={updateStatus} onDelete={setConfirmDelete} onRecalc={recalcCredits} />
                ))}
              </div>
              <Pagination page={mainPage} total={mainMissions.length} onPage={setMainPage} />
            </>
          )}
        </div>

        {/* 서브 의뢰 섹션 */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-2)' }}>서브 의뢰</h2>
            <Badge type="blue">{subMissions.length}개</Badge>
          </div>
          {subMissions.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-3)', fontSize: 14, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' }}>
              해당 조건의 미션이 없습니다.
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {subPaged.map(m => (
                  <MissionCard key={m.id} m={m} onUpdateStatus={updateStatus} onDelete={setConfirmDelete} onRecalc={recalcCredits} />
                ))}
              </div>
              <Pagination page={subPage} total={subMissions.length} onPage={setSubPage} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
