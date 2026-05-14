import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Card, Badge, Btn, ConfirmModal } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { sendNotification } from '../../lib/notify';

const STATUS_LABEL = { draft: '초안', active: '진행', in_review: '검토중', completed: '완료', cancelled: '취소' };
const STATUS_TYPE  = { draft: 'gray', active: 'green', in_review: 'blue', completed: 'blue', cancelled: 'red' };
const PAGE_SIZE = 5;

function fmtCr(n) { return parseFloat((n ?? 0).toFixed(2)); }

const WINDOW = 5;
function Pagination({ page, total, onPage }) {
  const totalPages = Math.ceil(total / PAGE_SIZE);
  if (totalPages <= 1) return null;
  const winStart = Math.max(1, page - 2);
  const winEnd   = Math.min(totalPages, winStart + WINDOW - 1);
  const pageNums = [];
  for (let i = winStart; i <= winEnd; i++) pageNums.push(i);
  const btnStyle = (active) => ({
    padding: '5px 9px', borderRadius: 6, border: '1px solid var(--border)',
    background: active ? 'var(--accent)' : 'var(--surface)',
    color: active ? '#fff' : 'var(--text)',
    cursor: 'pointer', fontSize: 12, fontWeight: active ? 700 : 400, minWidth: 30,
  });
  return (
    <div style={{ display: 'flex', gap: 3, alignItems: 'center', marginTop: 12, justifyContent: 'center' }}>
      <button onClick={() => onPage(Math.max(1, page - WINDOW))} disabled={page <= 1}
        style={{ ...btnStyle(false), opacity: page <= 1 ? 0.4 : 1, cursor: page <= 1 ? 'not-allowed' : 'pointer' }}>«</button>
      <button onClick={() => onPage(page - 1)} disabled={page === 1}
        style={{ ...btnStyle(false), opacity: page === 1 ? 0.4 : 1, cursor: page === 1 ? 'not-allowed' : 'pointer' }}>‹</button>
      {pageNums.map(n => (
        <button key={n} onClick={() => onPage(n)} style={btnStyle(page === n)}>{n}</button>
      ))}
      <button onClick={() => onPage(page + 1)} disabled={page === totalPages}
        style={{ ...btnStyle(false), opacity: page === totalPages ? 0.4 : 1, cursor: page === totalPages ? 'not-allowed' : 'pointer' }}>›</button>
      <button onClick={() => onPage(Math.min(totalPages, page + WINDOW))} disabled={page >= totalPages}
        style={{ ...btnStyle(false), opacity: page >= totalPages ? 0.4 : 1, cursor: page >= totalPages ? 'not-allowed' : 'pointer' }}>»</button>
    </div>
  );
}

const DETAIL_PAGE_SIZE = 5;

function getFeedbackStatus(f) {
  if (f.purity_passed) return { type: 'green', label: '승인됨' };
  if (f.status === 'rejected') return { type: 'red', label: '반려됨' };
  return { type: 'gold', label: '검토 중' };
}

function MissionDetail({ mission, onFeedbackClick }) {
  const [fbFilter, setFbFilter] = useState('all');
  const [detailPage, setDetailPage] = useState(1);

  const allFbs   = (mission.feedbacks || []).filter(f => f.status !== 'draft');
  const approved = allFbs.filter(f => f.purity_passed);
  const rejected = allFbs.filter(f => !f.purity_passed && f.status === 'rejected');
  const pending  = allFbs.filter(f => !f.purity_passed && f.status !== 'rejected');

  const feedbacks = fbFilter === 'all'
    ? [...approved, ...rejected, ...pending]
    : fbFilter === 'approved' ? approved
    : fbFilter === 'rejected' ? rejected
    : pending;

  const totalPages = Math.ceil(feedbacks.length / DETAIL_PAGE_SIZE);
  const paged = feedbacks.slice((detailPage - 1) * DETAIL_PAGE_SIZE, detailPage * DETAIL_PAGE_SIZE);

  const handleTab = (v) => { setFbFilter(v); setDetailPage(1); };

  const TABS = [
    { v: 'all',      l: `전체(${allFbs.length})` },
    { v: 'pending',  l: `검토중(${pending.length})` },
    { v: 'approved', l: `승인(${approved.length})` },
    { v: 'rejected', l: `반려(${rejected.length})` },
  ];

  return (
    <div style={{ marginTop: 6, marginBottom: 4, borderLeft: '3px solid var(--accent-dim)', paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <Card style={{ padding: '14px 16px' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', letterSpacing: '0.07em', marginBottom: 8 }}>미션 정보</div>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{mission.title}</div>
        <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 2 }}>{mission.companies?.name || '—'}</div>
        <div style={{ fontSize: 12, color: 'var(--text-3)' }}>패널 슬롯: {allFbs.length}/{mission.panel_count}건</div>
      </Card>
      <Card style={{ padding: '14px 16px' }}>
        <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
          {TABS.map(t => (
            <button key={t.v} onClick={() => handleTab(t.v)} style={{
              padding: '4px 10px', borderRadius: 99, fontSize: 12, cursor: 'pointer', border: '1px solid',
              background:  fbFilter === t.v ? 'var(--accent)' : 'transparent',
              color:       fbFilter === t.v ? '#fff' : 'var(--text-2)',
              borderColor: fbFilter === t.v ? 'var(--accent)' : 'var(--border)',
            }}>{t.l}</button>
          ))}
        </div>
        {feedbacks.length === 0 ? (
          <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>해당 피드백이 없습니다.</div>
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {paged.map(f => {
                const st = getFeedbackStatus(f);
                return (
                  <div key={f.id}
                    onClick={() => onFeedbackClick(f.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', cursor: 'pointer' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-2)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {f.panels?.name || '패널'}
                    </span>
                    <Badge type={st.type}>{st.label}</Badge>
                    <span style={{ fontSize: 11, color: 'var(--text-3)', flexShrink: 0 }}>
                      {f.created_at ? new Date(f.created_at).toLocaleDateString('ko-KR') : '—'}
                    </span>
                  </div>
                );
              })}
            </div>
            {totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 10 }}>
                <button onClick={() => setDetailPage(p => Math.max(1, p - 1))} disabled={detailPage === 1}
                  style={{ background: 'none', border: 'none', cursor: detailPage === 1 ? 'not-allowed' : 'pointer', opacity: detailPage === 1 ? 0.3 : 1, fontSize: 16 }}>‹</button>
                <span style={{ fontSize: 12, color: 'var(--text-2)', fontWeight: 500 }}>{detailPage} / {totalPages}</span>
                <button onClick={() => setDetailPage(p => Math.min(totalPages, p + 1))} disabled={detailPage === totalPages}
                  style={{ background: 'none', border: 'none', cursor: detailPage === totalPages ? 'not-allowed' : 'pointer', opacity: detailPage === totalPages ? 0.3 : 1, fontSize: 16 }}>›</button>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}

function MissionCard({ m, onUpdateStatus, onDelete, onRecalc, onCancelMission, onCompleteMission, onReactivateMission, isHighlighted, isSelected, onSelect }) {
  return (
    <Card key={m.id} onClick={() => onSelect(m)} style={{ outline: isHighlighted ? '2px solid var(--accent)' : isSelected ? '2px solid var(--border)' : 'none', background: isSelected ? 'var(--accent-dim2)' : undefined, transition: 'outline 0.3s, background 0.15s', cursor: 'pointer' }}>
      <div className="mc-row">
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 7, alignItems: 'center', flexWrap: 'wrap' }}>
            <Badge type={m.status === 'active' ? ((m.filled_count ?? 0) === 0 ? 'gray' : 'green') : (STATUS_TYPE[m.status] || 'gray')}>
              {m.status === 'active' ? ((m.filled_count ?? 0) === 0 ? '매칭 대기' : '진행 중') : (STATUS_LABEL[m.status] || m.status)}
            </Badge>
            {m.type === 'preference' && <Badge type="blue">소재 비교</Badge>}
            {m.type === 'pricing'    && <Badge type="gold">가격 검증</Badge>}
            {m.type === 'email'      && <Badge type="blue">이메일 검증</Badge>}
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--text-3)' }}>
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
          <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 16 }}>
            {m.feedbacks?.length ?? m.filled_count ?? 0}/{m.panel_count}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-3)' }}>패널 슬롯</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {m.status === 'active' && (
              <Btn size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); onCompleteMission(m); }}>완료 처리</Btn>
            )}
            {m.status === 'active' && (
              <Btn size="sm" variant="danger" onClick={(e) => { e.stopPropagation(); onCancelMission(m.id); }}>취소</Btn>
            )}
            {m.status === 'completed' && (
              <Btn size="sm" onClick={(e) => { e.stopPropagation(); onReactivateMission({ id: m.id, label: '재진행', desc: `완료된 미션을 다시 진행 상태로 되돌립니까? 환불된 크레딧(${Math.max(0, (m.credits_reserved ?? 0) - (m.credits_consumed ?? 0)).toFixed(2)}cr)이 기업 계정에서 회수됩니다. 기업에게 재진행 알림이 발송됩니다.`, fromStatus: 'completed' }); }}>재진행</Btn>
            )}
            {m.status === 'cancelled' && (
              <Btn size="sm" onClick={(e) => { e.stopPropagation(); onReactivateMission({ id: m.id, label: '재개', desc: '취소된 미션을 다시 진행 상태로 되돌립니까? 패널 매칭이 재시작됩니다. 기업에게 재개 알림이 발송됩니다.', fromStatus: 'cancelled' }); }}>재개</Btn>
            )}
            {m.status === 'cancelled' && (
              <Btn size="sm" variant="danger" onClick={(e) => { e.stopPropagation(); onDelete(m.id); }}>삭제</Btn>
            )}
          </div>
          {m.credits_reserved > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
              <span>{`예상 ${fmtCr(m.credits_reserved)} / 사용 ${fmtCr(m.credits_consumed)} (환불 ${fmtCr(Math.max(0, (m.credits_reserved ?? 0) - (m.credits_consumed ?? 0)))} cr)`}</span>
              {m.status !== 'cancelled' && (
                <button onClick={(e) => { e.stopPropagation(); onRecalc(m.id); }} title="크레딧 재계산"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-2)', fontSize: 13, padding: 0, lineHeight: 1 }}>
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
  const location = useLocation();
  const navigate  = useNavigate();
  const [missions, setMissions] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState('active');
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleteError, setDeleteError]     = useState('');
  const [confirmCancel, setConfirmCancel] = useState(null);
  const [confirmComplete, setConfirmComplete] = useState(null);
  const [confirmReactivate, setConfirmReactivate] = useState(null);
  const [mainPage, setMainPage] = useState(1);
  const [subPage, setSubPage]   = useState(1);
  const [statusError, setStatusError] = useState('');
  const [highlightId, setHighlightId] = useState(null);
  const [selectedMission, setSelectedMission] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const { data, error } = await supabase
          .from('missions')
          .select('*, companies(name, user_id), feedbacks(id, status, purity_passed, created_at, panels(name))')
          .neq('status', 'draft')
          .order('created_at', { ascending: false });
        if (error) console.error('[AdminMissions]', error.message);
        setMissions(data || []);
        setLoading(false);
      } catch (err) {
        console.error('[AdminMissions load]', err);
        setLoading(false);
      }
    }
    load();
  }, []);

  useEffect(() => {
    if (loading) return;
    const targetId = location.state?.missionId;
    if (!targetId) return;
    const target = missions.find(m => m.id === targetId);
    if (!target) return;

    const targetStatus = target.status === 'draft' ? 'all' : target.status;
    setFilter(targetStatus);

    const isMain = !target.type || target.type === 'landing_page';
    const filteredMs = targetStatus === 'all' ? missions : missions.filter(m => m.status === targetStatus);
    const category = filteredMs.filter(m =>
      isMain ? (!m.type || m.type === 'landing_page')
             : ['preference', 'pricing', 'email'].includes(m.type)
    );
    const idx = category.findIndex(m => m.id === targetId);
    if (idx !== -1) {
      const pg = Math.floor(idx / PAGE_SIZE) + 1;
      if (isMain) setMainPage(pg); else setSubPage(pg);
    }

    setHighlightId(targetId);
    window.history.replaceState({}, '', location.pathname);
    const t = setTimeout(() => setHighlightId(null), 3000);
    return () => clearTimeout(t);
  }, [loading, location.state?.missionId]); // eslint-disable-line react-hooks/exhaustive-deps

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
      setSelectedMission(prev => prev?.id === id ? { ...prev, status: 'completed', credits_consumed: data.credits_consumed } : prev);
      const completedMission = missions.find(m => m.id === id);
      if (completedMission?.companies?.user_id) {
        sendNotification(completedMission.companies.user_id, {
          type: 'success', icon: '🏁',
          title: '의뢰 완료',
          body: `[${completedMission.title}] 의뢰가 완료 처리되었습니다. 잔여 크레딧이 환불되었습니다.`,
          actionUrl: `/company/results?id=${completedMission.id}`,
          targetRole: 'company',
        });
      }
    } else {
      const { error: updateErr } = await supabase.from('missions').update({ status: newStatus }).eq('id', id);
      if (updateErr) { setStatusError('상태 변경 실패: ' + updateErr.message); return; }
      setMissions(ms => ms.map(m => m.id === id ? { ...m, status: newStatus } : m));
      setSelectedMission(prev => prev?.id === id ? { ...prev, status: newStatus } : prev);
      const foundM = missions.find(m => m.id === id);
      if (foundM?.companies?.user_id) {
        if (newStatus === 'cancelled') {
          sendNotification(foundM.companies.user_id, { type: 'warning', icon: '🚫', title: '의뢰 취소 처리', body: `[${foundM.title}] 의뢰가 취소 처리되었습니다.`, actionUrl: `/company/results?id=${id}`, targetRole: 'company' });
        } else if (newStatus === 'active') {
          sendNotification(foundM.companies.user_id, { type: 'success', icon: '▶️', title: '의뢰 재개', body: `[${foundM.title}] 취소된 의뢰가 재개되었습니다. 패널 매칭이 다시 시작됩니다.`, actionUrl: `/company/results?id=${id}`, targetRole: 'company' });
        }
      }
    }
  };

  const reactivateCompleted = async (id) => {
    setStatusError('');
    const { data, error } = await supabase.rpc('reactivate_mission_and_reclaim', { p_mission_id: id });
    if (error || !data?.success) {
      const errCode = data?.error || error?.message || '재진행 처리 실패';
      if (errCode === 'INSUFFICIENT_CREDITS') {
        setStatusError(`기업 잔여 크레딧(${data.balance?.toFixed(2)}cr)이 회수 필요액(${data.required?.toFixed(2)}cr)보다 부족합니다. 재진행할 수 없습니다.`);
      } else {
        setStatusError(errCode);
      }
      return;
    }
    setMissions(ms => ms.map(m => m.id === id ? { ...m, status: 'active' } : m));
    setSelectedMission(prev => prev?.id === id ? { ...prev, status: 'active' } : prev);
    const foundM = missions.find(m => m.id === id);
    if (foundM?.companies?.user_id) {
      sendNotification(foundM.companies.user_id, { type: 'info', icon: '🔄', title: '의뢰 재진행', body: `[${foundM.title}] 완료된 의뢰가 재진행 처리되었습니다.`, actionUrl: `/company/results?id=${id}`, targetRole: 'company' });
    }
  };

  const deleteMission = async (id) => {
    const { error } = await supabase.from('missions').delete().eq('id', id);
    if (error) {
      setDeleteError('삭제 중 오류가 발생했습니다: ' + error.message);
      return;
    }
    setDeleteError('');
    setMissions(ms => ms.filter(m => m.id !== id));
    setSelectedMission(prev => prev?.id === id ? null : prev);
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
        <div style={{ fontSize: 12, fontFamily: 'var(--font-sans)', color: 'var(--text-2)', marginBottom: 8, letterSpacing: '0.1em' }}>ADMIN</div>
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
          <button key={v} onClick={() => { setFilter(v); setMainPage(1); setSubPage(1); setHighlightId(null); setSelectedMission(null); }} style={{
            padding: '6px 14px', borderRadius: 4, fontSize: 13, fontWeight: 500,
            background: filter === v ? 'var(--bg)' : 'transparent',
            color: filter === v ? 'var(--text)' : 'var(--text-3)',
            border: 'none', transition: 'all 0.15s', cursor: 'pointer',
          }}>{l}</button>
        ))}
      </div>

      {/* Delete confirm modal */}
      {confirmDelete && (
        <ConfirmModal
          title="미션을 삭제하시겠습니까?"
          desc="취소된 미션과 관련 데이터가 영구적으로 삭제됩니다."
          confirmLabel="삭제"
          cancelLabel="취소"
          danger
          errorMsg={deleteError}
          onConfirm={() => deleteMission(confirmDelete)}
          onCancel={() => { setConfirmDelete(null); setDeleteError(''); }}
        />
      )}

      {/* Cancel confirm modal */}
      {confirmCancel && (
        <ConfirmModal
          title="이 미션을 취소하시겠습니까?"
          desc="미션을 취소하면 패널 피드백 수집이 즉시 중단됩니다. 기업에게 취소 알림이 발송됩니다. 계속하시겠습니까?"
          confirmLabel="미션 취소"
          cancelLabel="돌아가기"
          danger
          onConfirm={() => { updateStatus(confirmCancel, 'cancelled'); setConfirmCancel(null); }}
          onCancel={() => setConfirmCancel(null)}
        />
      )}

      {/* Complete confirm modal */}
      {confirmComplete && (() => {
        const approvedCount = (confirmComplete.feedbacks || []).filter(f => f.purity_passed).length;
        return (
          <ConfirmModal
            title="완료 처리하시겠습니까?"
            desc={`완료 처리 시 승인된 ${approvedCount}건 피드백 기준으로 크레딧이 정산되며, 잔여 크레딧은 기업 계정에 환불됩니다. 계속하시겠습니까?`}
            confirmLabel="완료 처리"
            cancelLabel="돌아가기"
            onConfirm={() => { updateStatus(confirmComplete.id, 'completed'); setConfirmComplete(null); }}
            onCancel={() => setConfirmComplete(null)}
          />
        );
      })()}

      {/* Reactivate confirm modal */}
      {confirmReactivate && (
        <ConfirmModal
          title={confirmReactivate.label}
          desc={confirmReactivate.desc}
          confirmLabel={confirmReactivate.label}
          cancelLabel="돌아가기"
          onConfirm={() => {
            if (confirmReactivate.fromStatus === 'completed') {
              reactivateCompleted(confirmReactivate.id);
            } else {
              updateStatus(confirmReactivate.id, 'active');
            }
            setConfirmReactivate(null);
          }}
          onCancel={() => setConfirmReactivate(null)}
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
                  <div key={m.id}>
                    <MissionCard m={m} onUpdateStatus={updateStatus} onDelete={setConfirmDelete} onRecalc={recalcCredits} onCancelMission={setConfirmCancel} onCompleteMission={setConfirmComplete} onReactivateMission={setConfirmReactivate} isHighlighted={m.id === highlightId} isSelected={selectedMission?.id === m.id} onSelect={(mission) => setSelectedMission(prev => prev?.id === mission.id ? null : mission)} />
                    {selectedMission?.id === m.id && (
                      <MissionDetail mission={selectedMission} onFeedbackClick={(feedbackId) => navigate('/admin/purity', { state: { feedbackId } })} />
                    )}
                  </div>
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
                  <div key={m.id}>
                    <MissionCard m={m} onUpdateStatus={updateStatus} onDelete={setConfirmDelete} onRecalc={recalcCredits} onCancelMission={setConfirmCancel} onCompleteMission={setConfirmComplete} onReactivateMission={setConfirmReactivate} isHighlighted={m.id === highlightId} isSelected={selectedMission?.id === m.id} onSelect={(mission) => setSelectedMission(prev => prev?.id === mission.id ? null : mission)} />
                    {selectedMission?.id === m.id && (
                      <MissionDetail mission={selectedMission} onFeedbackClick={(feedbackId) => navigate('/admin/purity', { state: { feedbackId } })} />
                    )}
                  </div>
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
