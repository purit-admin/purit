import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Card, Badge, Btn, ConfirmModal } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { sendNotification } from '../../lib/notify';

const STATUS_LABEL = { draft: '초안', active: '진행', in_review: '검토중', completed: '완료', cancelled: '취소' };
const STATUS_TYPE  = { draft: 'gray', active: 'green', in_review: 'blue', completed: 'blue', cancelled: 'red' };
const PAGE_SIZE = 5;

function fmtCr(n) { return parseFloat((n ?? 0).toFixed(2)); }

function fmtTimeLeft(deadline) {
  if (!deadline) return null;
  const diff = new Date(deadline) - new Date();
  if (diff <= 0) return { label: '만료됨', color: '#EF4444' };
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const label = h > 0 ? `${h}시간 ${m}분 남음` : `${m}분 남음`;
  const color = diff < 3600000 ? '#F59E0B' : 'var(--text-3)';
  return { label, color };
}

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

  const drafts   = (mission.feedbacks || []).filter(f => f.status === 'draft' && new Date(f.submission_deadline) > new Date());
  const allFbs   = (mission.feedbacks || []).filter(f => f.status !== 'draft');
  const approved = allFbs.filter(f => f.purity_passed);
  const rejected = allFbs.filter(f => !f.purity_passed && f.status === 'rejected');
  const pending  = allFbs.filter(f => !f.purity_passed && f.status !== 'rejected');

  const feedbacks = fbFilter === 'all'
    ? [...approved, ...rejected, ...pending]
    : fbFilter === 'approved' ? approved
    : fbFilter === 'rejected' ? rejected
    : fbFilter === 'drafting' ? drafts
    : pending;

  const totalPages = Math.ceil(feedbacks.length / DETAIL_PAGE_SIZE);
  const paged = feedbacks.slice((detailPage - 1) * DETAIL_PAGE_SIZE, detailPage * DETAIL_PAGE_SIZE);

  const handleTab = (v) => { setFbFilter(v); setDetailPage(1); };

  const TABS = [
    { v: 'all',      l: `전체(${allFbs.length})` },
    { v: 'drafting', l: `작성중(${drafts.length})` },
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
        <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
          패널 슬롯: {allFbs.length + drafts.length}/{mission.panel_count}건
          {drafts.length > 0 && <span style={{ marginLeft: 6, color: 'var(--text-3)' }}>(작성중 {drafts.length}명)</span>}
        </div>
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
                const isDraft = f.status === 'draft';
                const st = isDraft ? { type: 'gray', label: '작성중' } : getFeedbackStatus(f);
                const timeLeft = isDraft ? fmtTimeLeft(f.submission_deadline) : null;
                return (
                  <div key={f.id}
                    onClick={isDraft ? undefined : () => onFeedbackClick(f.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', cursor: isDraft ? 'default' : 'pointer' }}
                    onMouseEnter={isDraft ? undefined : e => e.currentTarget.style.background = 'var(--bg-2)'}
                    onMouseLeave={isDraft ? undefined : e => e.currentTarget.style.background = 'transparent'}
                  >
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {f.panels?.name || '패널'}
                    </span>
                    {timeLeft && (
                      <span style={{ fontSize: 11, color: timeLeft.color, flexShrink: 0 }}>{timeLeft.label}</span>
                    )}
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

function MissionCard({ m, onUpdateStatus, onDelete, onRecalc, onCancelMission, onCompleteMission, onReactivateMission, onEarlyComplete, isHighlighted, isSelected, onSelect }) {
  const allFbs    = (m.feedbacks || []).filter(f => f.status !== 'draft');
  const approved  = allFbs.filter(f => f.purity_passed);
  const reviewing = allFbs.filter(f => !f.purity_passed && f.status !== 'rejected');
  const panelCount = m.panel_count || 0;

  // 검토 중인 피드백이 있거나, 승인 수가 요청 슬롯에 미달이면 완료 차단
  const completeBlocked = allFbs.length === 0 || reviewing.length > 0 || approved.length < panelCount;

  return (
    <Card key={m.id} onClick={() => onSelect(m)} style={{ outline: isHighlighted ? '2px solid var(--accent)' : isSelected ? '2px solid var(--border)' : 'none', background: isSelected ? 'var(--accent-dim2)' : undefined, transition: 'outline 0.3s, background 0.15s', cursor: 'pointer', padding: '10px 14px' }}>
      {/* 상단: 좌측 정보 + 우측 슬롯·버튼 */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', gap: 5, marginBottom: 5, alignItems: 'center', flexWrap: 'wrap' }}>
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
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>{m.title}</div>
          <div style={{ fontSize: 12, color: 'var(--text-2)' }}>
            {m.companies?.name || '—'}{m.persona ? ` · ${m.persona}` : ''}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
          {/* 슬롯 카운트 인라인 */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
            <span style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 15 }}>
              {m.filled_count ?? 0}/{m.panel_count}
            </span>
            <span style={{ fontSize: 11, color: 'var(--text-3)' }}>패널 슬롯</span>
          </div>
          {/* 버튼 + 안내 문구 */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              {m.status === 'active' && (
                <Btn size="sm" variant="secondary"
                  disabled={completeBlocked}
                  onClick={(e) => { e.stopPropagation(); onCompleteMission(m); }}>
                  완료 처리
                </Btn>
              )}
              {m.status === 'active' && (
                <Btn size="sm" variant="danger" onClick={(e) => { e.stopPropagation(); onCancelMission(m.id); }}>취소</Btn>
              )}
              {m.status === 'completed' && (
                <Btn size="sm" onClick={(e) => { e.stopPropagation(); onReactivateMission({ id: m.id, label: '재진행', desc: `완료된 미션을 다시 진행 상태로 되돌립니까? 환불된 크레딧(${Math.max(0, (m.credits_reserved ?? 0) - (m.credits_consumed ?? 0)).toFixed(2)}cr)이 기업 계정에서 회수됩니다. 기업에게 재진행 알림이 발송됩니다.`, fromStatus: 'completed' }); }}>재진행</Btn>
              )}
              {/* 조기종료 완료: 검토 중 없으면 승인 수 무관하게 공개 (company가 이미 취소한 상태) */}
              {m.status === 'cancelled' && allFbs.length > 0 && !m.company_notified_at && (
                <Btn size="sm" variant="secondary"
                  disabled={reviewing.length > 0}
                  onClick={(e) => { e.stopPropagation(); onEarlyComplete(m); }}>
                  완료 처리
                </Btn>
              )}
              {m.status === 'cancelled' && m.company_notified_at && (
                <Badge type="green">기업 공개됨</Badge>
              )}
              {m.status === 'cancelled' && (
                <Btn size="sm" onClick={(e) => { e.stopPropagation(); onReactivateMission({ id: m.id, label: '재개', desc: '취소된 미션을 다시 진행 상태로 되돌립니까? 패널 매칭이 재시작됩니다. 기업에게 재개 알림이 발송됩니다.', fromStatus: 'cancelled' }); }}>재개</Btn>
              )}
              {m.status === 'cancelled' && (
                <Btn size="sm" variant="danger" onClick={(e) => { e.stopPropagation(); onDelete(m.id); }}>삭제</Btn>
              )}
            </div>
            {m.status === 'active' && allFbs.length === 0 && (
              <div style={{ fontSize: 10, color: 'var(--text-3)', textAlign: 'right' }}>수집된 피드백이 없습니다</div>
            )}
            {m.status === 'active' && allFbs.length > 0 && completeBlocked && (() => {
              const parts = [];
              if (reviewing.length > 0) parts.push(`검토 중 ${reviewing.length}건`);
              if (approved.length < panelCount) parts.push(`승인 ${approved.length}/${panelCount}건`);
              return <div style={{ fontSize: 10, color: '#F59E0B', textAlign: 'right' }}>{parts.join(' · ')} — 전체 승인 후 완료 가능</div>;
            })()}
            {m.status === 'cancelled' && allFbs.length > 0 && reviewing.length > 0 && (
              <div style={{ fontSize: 10, color: '#F59E0B', textAlign: 'right' }}>검토 중 {reviewing.length}건 먼저 처리 필요</div>
            )}
          </div>
        </div>
      </div>
      {/* 하단: 날짜(좌) + 크레딧(우) */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, paddingTop: 6, borderTop: '1px solid var(--border-light)' }}>
        <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
          {new Date(m.created_at).toLocaleDateString('ko-KR')}
        </div>
        {m.credits_reserved > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text-3)' }}>
            <span>{`예상 ${fmtCr(m.credits_reserved)} / 사용 ${fmtCr(m.credits_consumed)} (환불 ${fmtCr(Math.max(0, (m.credits_reserved ?? 0) - (m.credits_consumed ?? 0)))} cr)`}</span>
            {m.status !== 'cancelled' && (
              <button onClick={(e) => { e.stopPropagation(); onRecalc(m.id); }} title="크레딧 재계산"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-2)', fontSize: 13, padding: 0, lineHeight: 1 }}>
                ↺
              </button>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

export default function AdminMissions() {
  const location = useLocation();
  const navigate  = useNavigate();
  const [searchParams] = useSearchParams();
  const [missions, setMissions] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState('active');
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleteError, setDeleteError]     = useState('');
  const [confirmCancel, setConfirmCancel] = useState(null);
  const [confirmComplete, setConfirmComplete] = useState(null);
  const [confirmReactivate, setConfirmReactivate] = useState(null);
  const [confirmEarlyComplete, setConfirmEarlyComplete] = useState(null);
  const [earlyCompleteError, setEarlyCompleteError] = useState('');
  const [mainPage, setMainPage] = useState(1);
  const [subPage, setSubPage]   = useState(1);
  const [statusError, setStatusError] = useState('');
  const [highlightId, setHighlightId] = useState(null);
  const [selectedMission, setSelectedMission] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const { data, error } = await supabase
          .from('missions')
          .select('*, companies(name, user_id), feedbacks(id, status, purity_passed, created_at, submission_deadline, panels(name))')
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
    setSearchQuery('');

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

  // 알림 클릭 딥링크: ?missionId=xxx 쿼리 파라미터 처리
  useEffect(() => {
    if (loading) return;
    const targetId = searchParams.get('missionId');
    if (!targetId) return;
    const target = missions.find(m => m.id === targetId);
    if (!target) return;

    const targetStatus = target.status === 'draft' ? 'all' : target.status;
    setFilter(targetStatus);
    setSearchQuery('');

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
    navigate(location.pathname, { replace: true });
    const t = setTimeout(() => setHighlightId(null), 3000);
    return () => clearTimeout(t);
  }, [loading, searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

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
          targetRole: 'company', prefKey: 'missionComplete',
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
          sendNotification(foundM.companies.user_id, { type: 'warning', icon: '🚫', title: '의뢰 취소 처리', body: `[${foundM.title}] 의뢰가 취소 처리되었습니다.`, actionUrl: '/company', targetRole: 'company', prefKey: 'missionStatusChange' });
        } else if (newStatus === 'active') {
          sendNotification(foundM.companies.user_id, { type: 'success', icon: '▶️', title: '의뢰 재개', body: `[${foundM.title}] 취소된 의뢰가 재개되었습니다. 패널 매칭이 다시 시작됩니다.`, actionUrl: '/company', targetRole: 'company', prefKey: 'missionStatusChange' });
        }
      }
    }
    return true;
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
      sendNotification(foundM.companies.user_id, { type: 'info', icon: '🔄', title: '의뢰 재진행', body: `[${foundM.title}] 완료된 의뢰가 재진행 처리되었습니다.`, actionUrl: '/company', targetRole: 'company', prefKey: 'missionStatusChange' });
    }
    return true;
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

  // 취소 탭 뱃지: 아직 미처리(검토 중) 피드백이 있는 조기 종료 미션 수
  const cancelledPendingCount = missions.filter(m =>
    m.status === 'cancelled' &&
    (m.feedbacks || []).some(f => f.status !== 'draft' && !f.purity_passed && f.status !== 'rejected')
  ).length;

  const earlyCompleteMission = async (m) => {
    setEarlyCompleteError('');
    if (!m?.companies?.user_id) { setEarlyCompleteError('기업 정보를 찾을 수 없습니다.'); return; }
    // DB 게이트 먼저 설정 — 이 컬럼이 set되어야 기업 Results.jsx에 의뢰 공개됨
    const { error: updateErr } = await supabase
      .from('missions')
      .update({ company_notified_at: new Date().toISOString() })
      .eq('id', m.id);
    if (updateErr) { setEarlyCompleteError('완료 처리 중 오류가 발생했습니다.'); return; }
    sendNotification(m.companies.user_id, {
      type: 'success', icon: '🏁',
      title: '조기 종료 의뢰 피드백 검토 완료',
      body: `[${m.title}] 의뢰의 피드백 검토가 완료되었습니다. 피드백 결과 페이지에서 확인하세요.`,
      actionUrl: `/company/results?id=${m.id}`,
      targetRole: 'company', prefKey: 'earlyComplete',
    });
    setConfirmEarlyComplete(null);
    // 최신 데이터 리로드 (완료 처리 버튼 사라짐 + PurityFilter 변경 반영)
    const { data } = await supabase
      .from('missions')
      .select('*, companies(name, user_id), feedbacks(id, status, purity_passed, created_at, submission_deadline, panels(name))')
      .neq('status', 'draft')
      .order('created_at', { ascending: false });
    if (data) {
      setMissions(data);
      setSelectedMission(prev => prev ? (data.find(mm => mm.id === prev.id) || null) : null);
    }
  };

  const filtered = filter === 'all' ? missions : missions.filter(m => m.status === filter);
  const searchFiltered = searchQuery.trim()
    ? filtered.filter(m => (m.title || '').toLowerCase().includes(searchQuery.trim().toLowerCase()))
    : filtered;

  const mainMissions = searchFiltered.filter(m => !m.type || m.type === 'landing_page');
  const subMissions  = searchFiltered.filter(m => ['preference', 'pricing', 'email'].includes(m.type));

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
          {statusError}
        </div>
      )}

      {/* Filter */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: 'var(--surface)', borderRadius: 'var(--radius)', padding: 4, width: 'fit-content' }}>
        {[['all', '전체'], ['active', '진행'], ['completed', '완료'], ['cancelled', '취소']].map(([v, l]) => (
          <button key={v} onClick={() => { setFilter(v); setMainPage(1); setSubPage(1); setHighlightId(null); setSelectedMission(null); setSearchQuery(''); }} style={{
            padding: '6px 14px', borderRadius: 4, fontSize: 13, fontWeight: 500,
            background: filter === v ? 'var(--bg)' : 'transparent',
            color: filter === v ? 'var(--text)' : 'var(--text-3)',
            border: 'none', transition: 'all 0.15s', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
          }}>
            {l}
            {v === 'cancelled' && cancelledPendingCount > 0 && (
              <span style={{ background: '#ef4444', color: '#fff', borderRadius: 99, fontSize: 10, fontWeight: 700, padding: '1px 6px', lineHeight: 1.5 }}>
                {cancelledPendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* 의뢰명 검색 */}
      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 6 }}>
        <input
          type="text"
          placeholder="의뢰명으로 검색..."
          value={searchQuery}
          onChange={(e) => { setSearchQuery(e.target.value); setMainPage(1); setSubPage(1); setSelectedMission(null); }}
          style={{
            width: 260, padding: '7px 13px', fontSize: 13,
            border: '1px solid var(--border)', borderRadius: 'var(--radius)',
            color: 'var(--text)', background: 'var(--surface)', outline: 'none',
          }}
        />
        {searchQuery && (
          <button
            onClick={() => { setSearchQuery(''); setMainPage(1); setSubPage(1); setSelectedMission(null); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', fontSize: 15, lineHeight: 1 }}
          >✕</button>
        )}
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
          errorMsg={statusError}
          onConfirm={async () => { setStatusError(''); const ok = await updateStatus(confirmCancel, 'cancelled'); if (ok) setConfirmCancel(null); }}
          onCancel={() => { setStatusError(''); setConfirmCancel(null); }}
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
            errorMsg={statusError}
            onConfirm={async () => { setStatusError(''); const ok = await updateStatus(confirmComplete.id, 'completed'); if (ok) setConfirmComplete(null); }}
            onCancel={() => { setStatusError(''); setConfirmComplete(null); }}
          />
        );
      })()}

      {/* 조기 종료 완료 처리 modal */}
      {confirmEarlyComplete && (() => {
        const ecApproved = (confirmEarlyComplete.feedbacks || []).filter(f => f.purity_passed).length;
        return (
          <ConfirmModal
            title="조기 종료 완료 처리"
            desc={`"${confirmEarlyComplete.title}" 의뢰의 피드백 검토가 완료됐습니다.\n승인된 피드백 ${ecApproved}건이 기업에게 공개됩니다.\n(취소 상태 유지, 크레딧 환불 없음)`}
            confirmLabel="완료 처리"
            cancelLabel="돌아가기"
            errorMsg={earlyCompleteError}
            onConfirm={async () => { await earlyCompleteMission(confirmEarlyComplete); }}
            onCancel={() => { setConfirmEarlyComplete(null); setEarlyCompleteError(''); }}
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
          errorMsg={statusError}
          onConfirm={async () => {
            setStatusError('');
            const ok = confirmReactivate.fromStatus === 'completed'
              ? await reactivateCompleted(confirmReactivate.id)
              : await updateStatus(confirmReactivate.id, 'active');
            if (ok) setConfirmReactivate(null);
          }}
          onCancel={() => { setStatusError(''); setConfirmReactivate(null); }}
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
                    <MissionCard m={m} onUpdateStatus={updateStatus} onDelete={setConfirmDelete} onRecalc={recalcCredits} onCancelMission={setConfirmCancel} onCompleteMission={setConfirmComplete} onReactivateMission={setConfirmReactivate} onEarlyComplete={setConfirmEarlyComplete} isHighlighted={m.id === highlightId} isSelected={selectedMission?.id === m.id} onSelect={(mission) => setSelectedMission(prev => prev?.id === mission.id ? null : mission)} />
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
                    <MissionCard m={m} onUpdateStatus={updateStatus} onDelete={setConfirmDelete} onRecalc={recalcCredits} onCancelMission={setConfirmCancel} onCompleteMission={setConfirmComplete} onReactivateMission={setConfirmReactivate} onEarlyComplete={setConfirmEarlyComplete} isHighlighted={m.id === highlightId} isSelected={selectedMission?.id === m.id} onSelect={(mission) => setSelectedMission(prev => prev?.id === mission.id ? null : mission)} />
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
