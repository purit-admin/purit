import { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import { Card, Badge, Btn, ConfirmModal, StatusTabs, SegmentFilter } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { getPanelReward, getExperienceCareerKey, fmtSuspendRelease } from '../../lib/honorLevels';

const DIFF_META = {
  easy:   { label: '쉬움',   color: 'var(--green)' },
  normal: { label: '보통',   color: 'var(--text-2)' },
  hard:   { label: '어려움', color: 'var(--red, #ef4444)' },
};

const PAGE_SIZE = 5;

const TABS = [
  { key: 'new',          label: '새로운 미션' },
  { key: 'inProgress',   label: '이어하기' },
  { key: 'needsRevision', label: '수정 필요' },
];

const EMPTY_MSG = {
  new:           { icon: '🔍', title: '새로운 미션이 없어요',    desc: '현재 참여 가능한 미션이 없습니다. 잠시 후 다시 확인해보세요.' },
  inProgress:    { icon: '📋', title: '진행 중인 미션이 없어요', desc: '새로운 미션 탭에서 미션을 수락하면 여기에 표시됩니다.' },
  needsRevision: { icon: '✅', title: '수정 필요한 미션이 없어요', desc: '반려된 피드백이 없습니다.' },
};

const WINDOW = 5;
function Pagination({ page, total, onPage }) {
  const totalPages = Math.ceil(total / PAGE_SIZE);
  if (totalPages <= 1) return null;
  const winStart = Math.max(1, page - 2);
  const winEnd   = Math.min(totalPages, winStart + WINDOW - 1);
  const pageNums = Array.from({ length: winEnd - winStart + 1 }, (_, i) => winStart + i);
  const btnStyle = (active) => ({
    padding: '5px 10px', borderRadius: 6, border: '1px solid var(--border)',
    background: active ? 'var(--accent)' : 'var(--surface)',
    color: active ? '#fff' : 'var(--text)',
    cursor: 'pointer', fontSize: 13, fontWeight: active ? 700 : 400,
  });
  const disabledStyle = { padding: '5px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', cursor: 'not-allowed', opacity: 0.4, fontSize: 13 };
  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginTop: 12, justifyContent: 'center' }}>
      {page > WINDOW && (
        <button onClick={() => onPage(Math.max(1, page - WINDOW))} style={btnStyle(false)}>«</button>
      )}
      <button onClick={() => onPage(page - 1)} disabled={page === 1}
        style={page === 1 ? disabledStyle : btnStyle(false)}>이전</button>
      {pageNums.map(n => (
        <button key={n} onClick={() => onPage(n)} style={btnStyle(page === n)}>{n}</button>
      ))}
      <button onClick={() => onPage(page + 1)} disabled={page === totalPages}
        style={page === totalPages ? disabledStyle : btnStyle(false)}>다음</button>
      {page <= totalPages - WINDOW && (
        <button onClick={() => onPage(Math.min(totalPages, page + WINDOW))} style={btnStyle(false)}>»</button>
      )}
    </div>
  );
}

const REJECTION_GUIDE = 'Purit Filter 검수 시스템에 의해 반려되었습니다.\n주요 반려 기준: 내용 길이 부족 / AI 생성 의심 / 구체성 부족\n해당 사유를 참고하여 재작성해 주세요.';

function formatRemaining(deadline) {
  if (!deadline) return null;
  const diff = new Date(deadline) - new Date();
  if (diff <= 0) return '만료됨';
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (h > 0) return `${h}시간 ${m}분 남음`;
  return `${m}분 남음`;
}

function MissionCard({ m, mode, feedbackId, rejectionDeadline, submissionDeadline, suggestions, navigate, setModal, onDismiss, onResubmit, panelHonorPoints = 0, panelExperience = '' }) {
  const [reasonOpen, setReasonOpen] = useState(false);
  const slots  = m.panel_count  || 0;
  const filled = m.filled_count || 0;
  const isSubMission = ['preference', 'pricing', 'email'].includes(m.type);
  const baseReward = getPanelReward(panelHonorPoints, panelExperience);
  const displayReward = isSubMission ? Math.round(baseReward * 4500 / 8000) : baseReward;

  return (
    <Card>
      <div className="mc-row">
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 7, flexWrap: 'wrap' }}>
            {mode === 'new'          && <Badge type="green">참여가능</Badge>}
            {mode === 'inProgress'   && <Badge type="gold">진행 중</Badge>}
            {mode === 'needsRevision' && <Badge type="red">반려됨</Badge>}
            {m.type === 'preference' && <Badge type="blue">소재 비교</Badge>}
            {m.type === 'pricing'    && <Badge type="gold">가격 검증</Badge>}
            {m.type === 'email'      && <Badge type="blue">이메일 검증</Badge>}
            <span style={{ fontSize: 11, fontFamily: 'var(--font-sans)', color: 'var(--text-3)' }}>
              {m.id.slice(0, 8).toUpperCase()}
            </span>
          </div>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{m.title}</div>
          {m.persona && (
            <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 6, lineHeight: 1.5 }}>
              🎯 타겟: {m.persona}
            </div>
          )}
          {m.target_url && (
            <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{m.target_url}</div>
          )}
          {mode === 'inProgress' && (() => {
            const deadline = rejectionDeadline || submissionDeadline;
            const label = rejectionDeadline ? '재제출 마감' : '제출 마감';
            const remaining = formatRemaining(deadline);
            const isExpiring = deadline && (new Date(deadline) - new Date()) < 3600000;
            if (!remaining) return null;
            return (
              <div style={{ marginTop: 6 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: isExpiring ? 'var(--red,#ef4444)' : '#F59E0B', fontFamily: 'var(--font-sans)' }}>
                  ⏱ {label}: {remaining}
                </div>
              </div>
            );
          })()}
          {mode === 'needsRevision' && (() => {
            const remaining = formatRemaining(rejectionDeadline);
            const isExpiring = rejectionDeadline && (new Date(rejectionDeadline) - new Date()) < 3600000;
            return (
              <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {remaining && (
                  <div style={{ fontSize: 11, fontWeight: 700, color: isExpiring ? 'var(--red,#ef4444)' : '#F59E0B', fontFamily: 'var(--font-sans)' }}>
                    ⏱ 재제출 마감: {remaining}
                  </div>
                )}
                <button
                  onClick={() => setReasonOpen(r => !r)}
                  style={{ fontSize: 12, color: 'var(--text-2)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline', textAlign: 'left' }}
                >
                  {reasonOpen ? '탈락 사유 닫기 ▲' : '탈락 사유 보기 ▼'}
                </button>
              </div>
            );
          })()}
          {mode === 'needsRevision' && reasonOpen && (
            <div style={{ marginTop: 8 }}>
              {suggestions && (
                <div style={{ fontSize: 12, color: 'var(--text-2)', background: 'var(--surface)', borderRadius: 6, padding: '8px 12px', lineHeight: 1.6, whiteSpace: 'pre-wrap', marginBottom: 6 }}>
                  {suggestions}
                </div>
              )}
              <div style={{ fontSize: 12, color: 'var(--text-3)', background: 'var(--bg-2)', borderRadius: 6, padding: '8px 12px', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                {REJECTION_GUIDE}
              </div>
            </div>
          )}
        </div>
        <div className="mc-right">
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--green)', fontFamily: 'var(--font-sans)' }}>
              ₩{displayReward.toLocaleString()}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>건당 보상</div>
          </div>
          {mode === 'new' && (
            <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
              잔여 <strong style={{ color: 'var(--text)' }}>{Math.max(0, slots - filled)}</strong>/{slots} 슬롯
            </div>
          )}
          {(m.estimated_minutes || m.difficulty) && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              {m.estimated_minutes && (
                <span style={{ fontSize: 11, color: 'var(--text-3)' }}>⏱ {m.estimated_minutes}분</span>
              )}
              {m.difficulty && (
                <span style={{ fontSize: 11, fontWeight: 700, color: DIFF_META[m.difficulty]?.color || 'var(--text-3)' }}>
                  {DIFF_META[m.difficulty]?.label || m.difficulty}
                </span>
              )}
            </div>
          )}
          <div style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-sans)' }}>
            {new Date(m.created_at).toLocaleDateString('ko-KR')}
          </div>
          {mode === 'new' && (
            <Btn size="sm" onClick={() => setModal({ type: 'accept', mission: m })}>수락하기</Btn>
          )}
          {mode === 'inProgress' && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              {m.status === 'active' ? (
                <Btn size="sm" onClick={() => navigate(`/panel/active?id=${m.id}`)}>이어하기 →</Btn>
              ) : (
                <span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600 }}>의뢰가 종료되었습니다</span>
              )}
              <Btn size="sm" variant="ghost" onClick={() => setModal({ type: 'cancel', mission: m })}
                style={{ fontSize: 11, color: 'var(--text-3)' }}>{m.status === 'active' ? '수락 취소' : '초안 삭제'}</Btn>
            </div>
          )}
          {mode === 'needsRevision' && (() => {
            const missionEnded = m.status !== 'active';
            const slotsFull = !missionEnded && (m.filled_count || 0) >= (m.panel_count || 1);
            if (missionEnded || slotsFull) return (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600 }}>
                  {missionEnded ? '의뢰 종료' : '슬롯 마감'} · 재작성 불가
                </span>
                <Btn size="sm" variant="ghost" onClick={() => onDismiss(feedbackId)}
                  style={{ fontSize: 11, color: 'var(--text-3)' }}>삭제</Btn>
              </div>
            );
            return (
              <Btn size="sm" variant="outline" onClick={() => onResubmit(feedbackId, rejectionDeadline, m.title)}>
                재작성 →
              </Btn>
            );
          })()}
        </div>
      </div>
    </Card>
  );
}

export default function MissionList() {
  const navigate = useNavigate();
  const location = useLocation();
  const [missions, setMissions]       = useState([]);
  // feedbackMap: { [missionId]: { status, id, suggestions, rejection_deadline, submission_deadline, dismissed, revision_dismissed } }
  const [feedbackMap, setFeedbackMap] = useState({});
  const [panelId, setPanelId]               = useState(null);
  const [panelStatus, setPanelStatus]       = useState('active');
  const [panelRejectionReason, setPanelRejectionReason] = useState('');
  const [panelSuspendUntil, setPanelSuspendUntil] = useState(null);
  const [panelHasDocs, setPanelHasDocs]     = useState(false);
  const [panelHonorPoints, setPanelHonorPoints] = useState(0);
  const [panelExperience, setPanelExperience]   = useState('');
  const [loading, setLoading]         = useState(true);
  const initialTab = new URLSearchParams(location.search).get('tab');
  const [filter, setFilter]           = useState(TABS.some(t => t.key === initialTab) ? initialTab : 'new');
  const [modal, setModal]             = useState(null);
  const [confirming, setConfirming]   = useState(false);
  const [acceptError, setAcceptError] = useState('');
  const [cancelError, setCancelError] = useState('');
  const [dismissTarget, setDismissTarget] = useState(null); // feedbackId
  const [dismissing, setDismissing]       = useState(false);
  const [dismissError, setDismissError]   = useState('');
  const [resubmitTarget, setResubmitTarget] = useState(null); // { missionId, feedbackId, rejectionDeadline, missionTitle }
  const [acceptCountdown, setAcceptCountdown]     = useState(0);
  const [resubmitCountdown, setResubmitCountdown] = useState(0);
  const [mainPage, setMainPage]       = useState(1);
  const [subPage, setSubPage]         = useState(1);
  const [missionKind, setMissionKind] = useState('all');

  // 수락 모달 열릴 때 카운트다운 시작
  useEffect(() => {
    if (modal?.type === 'accept') setAcceptCountdown(5);
    else setAcceptCountdown(0);
  }, [modal?.type]);
  useEffect(() => {
    if (acceptCountdown <= 0) return;
    const t = setTimeout(() => setAcceptCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [acceptCountdown]);

  // 재작성 모달 열릴 때 카운트다운 시작
  useEffect(() => {
    if (resubmitTarget) setResubmitCountdown(5);
    else setResubmitCountdown(0);
  }, [resubmitTarget]);
  useEffect(() => {
    if (resubmitCountdown <= 0) return;
    const t = setTimeout(() => setResubmitCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resubmitCountdown]);

  useEffect(() => {
    let sub = null;

    async function load() {
      try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data: p } = await supabase
        .from('panels').select('id, honor_points, experience, status, rejection_reason, suspend_until, health_insurance_url, linkedin_url, portfolio_url, portfolio_file_url').eq('user_id', user.id).single();
      if (!p) { setLoading(false); return; }
      setPanelId(p.id);
      setPanelStatus(p.status || 'active');
      setPanelRejectionReason(p.rejection_reason || '');
      setPanelSuspendUntil(p.suspend_until || null);
      setPanelHasDocs(!!(p.health_insurance_url || p.linkedin_url || p.portfolio_url || p.portfolio_file_url));
      setPanelHonorPoints(p.honor_points ?? 0);
      setPanelExperience(p.experience || '');

      // 만료된 draft/rejected 정리 (fire-and-forget 아님 — feedbacks 로드 전 완료 필요)
      await supabase.rpc('expire_panel_drafts').then(({ error: e }) => { if (e) console.warn('[expire_drafts]', e.message); });

      const { data: myFeedbacks } = await supabase.from('feedbacks').select('mission_id, status, id, suggestions, rejection_deadline, submission_deadline, dismissed, revision_dismissed').eq('panel_id', p.id);

      const map = {};
      (myFeedbacks || []).forEach(f => {
        map[f.mission_id] = { status: f.status, id: f.id, suggestions: f.suggestions, rejection_deadline: f.rejection_deadline, submission_deadline: f.submission_deadline, dismissed: f.dismissed, revision_dismissed: f.revision_dismissed };
      });
      setFeedbackMap(map);

      // active 미션만 로드 (전체 missions 로드 시 PostgREST 1000행 절단 + 페이로드 폭발)
      // 단, 이어하기(draft)·수정 필요(rejected) 탭은 종료된 미션도 표시해야 하므로 해당 미션은 id로 함께 조회
      const inFlightIds = (myFeedbacks || []).filter(f => f.status === 'draft' || f.status === 'rejected').map(f => f.mission_id);
      let missionQuery = supabase.from('missions').select('id, title, type, status, persona, target_url, panel_count, filled_count, description, image_urls, estimated_minutes, difficulty, created_at');
      missionQuery = inFlightIds.length > 0
        ? missionQuery.or(`status.eq.active,id.in.(${inFlightIds.join(',')})`)
        : missionQuery.eq('status', 'active');
      const { data: ms } = await missionQuery.order('created_at', { ascending: false });
      setMissions(ms || []);
      setLoading(false);

      // active 미션만 구독 — 무필터 전 테이블 구독은 접속 패널 전원에게 모든 UPDATE 브로드캐스트 (Realtime 할당량 폭발)
      // 트레이드오프: active→completed 전환은 수신 못 함(필터 불통과) → 새로고침 시 반영, ActiveMission load()가 비active 차단으로 방어
      sub = supabase
        .channel(`panel-missions-realtime-${p.id}-${Date.now()}`)
        .on('postgres_changes', {
          event: 'UPDATE', schema: 'public', table: 'missions',
          filter: 'status=eq.active',
        }, (payload) => {
          setMissions(prev => prev.map(m => m.id === payload.new.id ? { ...m, ...payload.new } : m));
        })
        .subscribe();
      } catch (err) {
        console.error('[PanelMissions load]', err);
        setLoading(false);
      }
    }

    load();
    return () => { if (sub) supabase.removeChannel(sub); };
  }, []);

  const handleConfirmAccept = async () => {
    if (!modal) return;
    setConfirming(true);

    let pid = panelId;
    if (!pid) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: p } = await supabase.from('panels').select('id').eq('user_id', user.id).single();
        pid = p?.id;
        if (pid) setPanelId(pid);
      }
    }

    if (!pid) {
      setConfirming(false);
      setAcceptError('패널 계정을 찾을 수 없습니다. 패널로 가입된 계정인지 확인해주세요.');
      return;
    }

    const isSubM = ['preference', 'pricing', 'email'].includes(modal.mission.type);
    const subDl  = new Date(Date.now() + (isSubM ? 2 : 4) * 60 * 60 * 1000).toISOString();
    // 원자적 슬롯 예약: filled_count < panel_count 조건부 증가 + feedbacks INSERT (동시성 안전)
    const { data: newFbId, error } = await supabase.rpc('accept_mission_slot', {
      p_mission_id:          modal.mission.id,
      p_submission_deadline: subDl,
    });
    setConfirming(false);
    if (error) {
      setAcceptError('수락 중 오류: ' + error.message);
      return;
    }
    if (!newFbId) {
      setAcceptError('슬롯이 마감되었습니다. 다른 의뢰를 선택해주세요.');
      return;
    }
    setFeedbackMap(prev => ({ ...prev, [modal.mission.id]: { status: 'draft', id: newFbId, suggestions: null } }));
    // 기업에게 첫 패널 매칭 알림 (RPC 내부에서 filled_count=1 조건 검사)
    supabase.rpc('notify_company_first_panel_accepted', { p_mission_id: modal.mission.id })
      .then(({ error }) => { if (error) console.warn('[notify_first_panel]', error.message); });
    const target = modal.mission.id;
    setModal(null);
    navigate(`/panel/active?id=${target}`);
  };

  const handleConfirmCancel = async () => {
    if (!modal) return;
    setConfirming(true);
    const { error } = await supabase.rpc('cancel_panel_feedback', {
      p_mission_id: modal.mission.id,
    });
    setConfirming(false);
    if (error) {
      setCancelError('수락 취소 중 오류가 발생했습니다. 다시 시도해 주세요.');
      return;
    }
    setCancelError('');
    const newMap = { ...feedbackMap };
    delete newMap[modal.mission.id];
    setFeedbackMap(newMap);
    setModal(null);
  };

  const handleDismissRejected = async (feedbackId) => {
    if (dismissing) return;
    setDismissing(true);
    setDismissError('');
    const { error } = await supabase.rpc('dismiss_rejected_feedback', { p_feedback_id: feedbackId });
    if (error) {
      setDismissError('삭제에 실패했습니다. 다시 시도해주세요.');
      setDismissing(false);
      return;
    }
    // feedbackMap에서 revision_dismissed 처리 → [수정 필요] 탭에서만 즉시 사라짐 ([지급 거절] 탭은 유지)
    setFeedbackMap(prev => {
      const next = { ...prev };
      for (const [mId, fb] of Object.entries(next)) {
        if (fb.id === feedbackId) { next[mId] = { ...fb, revision_dismissed: true }; break; }
      }
      return next;
    });
    setDismissTarget(null);
    setDismissing(false);
  };

  const filtered = (() => {
    if (filter === 'new') {
      const panelKey = panelExperience ? getExperienceCareerKey(panelExperience) : null;
      let list = missions.filter(m => {
        if (feedbackMap[m.id] || m.status !== 'active' || (m.filled_count || 0) >= (m.panel_count || 1)) return false;
        try {
          const desc = JSON.parse(m.description || '{}');
          const cl = desc.careerLevels;
          // 경력 제한 미션: 경력 미설정(panelKey=null) 패널에게는 미노출, 설정된 경우 등급 매칭 시만 노출
          if (Array.isArray(cl) && cl.length > 0 && (!panelKey || !cl.includes(panelKey))) return false;
        } catch { /* 파싱 실패 시 노출 */ }
        return true;
      });
      return list;
    }
    if (filter === 'inProgress')    return missions.filter(m => feedbackMap[m.id]?.status === 'draft');
    if (filter === 'needsRevision') return missions.filter(m => {
      const fb = feedbackMap[m.id];
      if (fb?.status !== 'rejected') return false;
      if (fb.dismissed || fb.revision_dismissed) return false;
      // rejection_deadline이 설정되어 있고 이미 만료됐으면 목록에서 제외
      if (fb.rejection_deadline && new Date(fb.rejection_deadline) < new Date()) return false;
      return true;
    });
    return [];
  })();

  const mainFiltered = filtered.filter(m => !m.type || m.type === 'landing_page');
  const subFiltered  = filtered.filter(m => ['preference', 'pricing', 'email'].includes(m.type));
  const mainPaged    = mainFiltered.slice((mainPage - 1) * PAGE_SIZE, mainPage * PAGE_SIZE);
  const subPaged     = subFiltered.slice((subPage - 1) * PAGE_SIZE, subPage * PAGE_SIZE);

  // 삭제·수락취소 등으로 목록이 줄어 현재 페이지가 범위를 벗어나면 마지막 페이지로 보정 (빈 화면 방지, D-170)
  // setPage를 다른 setState updater 안이 아닌 effect에서 호출 → StrictMode 이중 감소 회피(D-161)
  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(mainFiltered.length / PAGE_SIZE));
    if (mainPage > maxPage) setMainPage(maxPage);
  }, [mainFiltered.length, mainPage]);
  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(subFiltered.length / PAGE_SIZE));
    if (subPage > maxPage) setSubPage(maxPage);
  }, [subFiltered.length, subPage]);

  if (loading) return (
    <div style={{ padding: '40px 48px', color: 'var(--text-3)', fontSize: 14 }}>불러오는 중...</div>
  );

  if (panelStatus === 'suspended') return (
    <div className="page-wrap" style={{ padding: '40px 48px', maxWidth: 900 }}>
      <Card style={{ textAlign: 'center', padding: '48px 24px' }}>
        <div style={{ fontSize: 36, marginBottom: 16 }}>🚫</div>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>계정이 정지되었습니다</h2>
        <p style={{ color: 'var(--text-2)', fontSize: 14, lineHeight: 1.7 }}>
          관리자에 의해 계정 활동이 정지되었습니다.<br/>
          {fmtSuspendRelease(panelSuspendUntil) || '문의사항은 운영팀에 연락해주세요.'}
        </p>
      </Card>
    </div>
  );

  if (panelStatus === 'rejected') return (
    <div className="page-wrap" style={{ padding: '40px 48px', maxWidth: 900 }}>
      <Card style={{ textAlign: 'center', padding: '48px 24px' }}>
        <div style={{ fontSize: 36, marginBottom: 16 }}>📝</div>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>검증 서류가 반려되었습니다</h2>
        {panelRejectionReason && (
          <div style={{
            fontSize: 13.5, color: '#78350F', background: '#FFFBEB', border: '1px solid #FCD34D',
            borderRadius: 8, padding: '12px 16px', margin: '0 auto 20px', maxWidth: 480,
            textAlign: 'left', lineHeight: 1.6, whiteSpace: 'pre-wrap',
          }}>
            <strong style={{ color: '#92400E' }}>거절 사유</strong><br/>{panelRejectionReason}
          </div>
        )}
        <p style={{ color: 'var(--text-2)', fontSize: 14, lineHeight: 1.7, marginBottom: 20 }}>
          사유를 확인하고 서류를 보완하여 재제출해 주세요.
        </p>
        <Btn onClick={() => navigate('/panel/verify-docs')}>서류 재제출하기 →</Btn>
      </Card>
    </div>
  );

  if (panelStatus === 'banned') return (
    <div className="page-wrap" style={{ padding: '40px 48px', maxWidth: 900 }}>
      <Card style={{ textAlign: 'center', padding: '48px 24px' }}>
        <div style={{ fontSize: 36, marginBottom: 16 }}>🚫</div>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>계정이 영구 정지되었습니다</h2>
        <p style={{ color: 'var(--text-2)', fontSize: 14, lineHeight: 1.7 }}>
          누적 거절 횟수가 한도에 도달하여 이 계정으로는 더 이상 심사를 받을 수 없습니다.<br/>
          이의가 있으시면 운영팀에 연락해주세요.
        </p>
      </Card>
    </div>
  );

  if (panelStatus === 'pending') return (
    <div className="page-wrap" style={{ padding: '40px 48px', maxWidth: 900 }}>
      {panelHasDocs ? (
        <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid #F59E0B', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20 }}>⏳</span>
          <span style={{ fontSize: 14, color: 'var(--text-2)' }}>
            <strong>심사 대기 중입니다.</strong> 검증 서류 검토 후 미션 참여가 활성화됩니다. (1–2 영업일 소요)
          </span>
        </div>
      ) : (
        <Card style={{ textAlign: 'center', padding: '48px 24px' }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>📋</div>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>서비스 이용을 위한 경력 인증을 해주세요.</h2>
          <p style={{ color: 'var(--text-2)', fontSize: 14, lineHeight: 1.7, marginBottom: 20 }}>
            서류 검토 후 승인이 완료되면 미션 참여가 가능합니다.
          </p>
          <Btn onClick={() => navigate('/panel/verify-docs')}>서류 제출하기 →</Btn>
        </Card>
      )}
    </div>
  );

  const changeTab = (key) => { setFilter(key); setMainPage(1); setSubPage(1); };

  const now = new Date();
  const rejectedCount = Object.values(feedbackMap).filter(f =>
    f.status === 'rejected' &&
    !f.dismissed &&
    !f.revision_dismissed &&
    (!f.rejection_deadline || new Date(f.rejection_deadline) >= now)
  ).length;

  return (
    <div className="page-wrap" style={{ padding: '40px 48px', maxWidth: 900, animation: 'fadeUp 0.5s ease both' }}>

      {/* ── 반려 피드백 숨김 확인 모달 ── */}
      {dismissTarget && ReactDOM.createPortal(
        <ConfirmModal
          title="피드백을 삭제할까요?"
          desc={'[수정 필요] 목록에서 제거됩니다.\n정산 내역 [지급 거절] 탭에서는 계속 확인할 수 있습니다.'}
          confirmLabel={dismissing ? '처리 중...' : '삭제'}
          cancelLabel="취소"
          danger
          onConfirm={() => handleDismissRejected(dismissTarget)}
          onCancel={() => { setDismissTarget(null); setDismissError(''); }}
          errorMsg={dismissError}
        />,
        document.body
      )}

      {/* ── 재작성 확인 모달 (portal) ── */}
      {resubmitTarget && ReactDOM.createPortal(
        <div onClick={() => setResubmitTarget(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9000 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg)', borderRadius: 'var(--radius-lg)', padding: '40px', width: 'max-content', maxWidth: '90vw', border: '1px solid var(--border)', animation: 'fadeUp 0.2s ease both' }}>
            <div style={{ fontSize: 13, fontFamily: 'var(--font-sans)', color: 'var(--text-2)', marginBottom: 12, letterSpacing: '0.1em' }}>RESUBMIT</div>
            <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>재작성을 시작할까요?</h2>
            <div style={{ fontSize: 16, color: 'var(--text-2)', marginBottom: 4, fontWeight: 600 }}>{resubmitTarget.missionTitle}</div>
            {(() => {
              const diff = resubmitTarget.rejectionDeadline ? new Date(resubmitTarget.rejectionDeadline) - new Date() : null;
              if (!diff || diff <= 0) return null;
              const h = Math.floor(diff / 3600000);
              const min = Math.floor((diff % 3600000) / 60000);
              const isExpiring = diff < 3600000;
              const label = h > 0 ? `${h}시간 ${min}분 남음` : `${min}분 남음`;
              return (
                <div style={{ fontSize: 14, fontWeight: 700, color: isExpiring ? 'var(--red,#ef4444)' : '#F59E0B', marginBottom: 24 }}>
                  ⏱ 재제출 마감: {label}
                </div>
              );
            })()}
            <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', padding: '20px 22px', marginBottom: 28, display: 'flex', flexDirection: 'column', gap: 15 }}>
              {[
                '재작성 중인 미션은 [이어하기] 탭에서 확인할 수 있습니다.',
                '마감 시간 내에 제출하지 않으면 수락이 자동 취소됩니다.',
                '이전에 작성한 내용이 자동으로 복원됩니다.',
              ].map((t, i) => (
                <div key={i} style={{ display: 'flex', gap: 12, fontSize: 15, color: 'var(--text-2)', lineHeight: 1.5 }}>
                  <span style={{ color: '#F59E0B', flexShrink: 0, marginTop: 1 }}>⚠</span>
                  <span>{t}</span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '14px 16px', borderRadius: 'var(--radius)', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', marginBottom: 28 }}>
              <span style={{ color: 'var(--red,#ef4444)', flexShrink: 0, fontSize: 16 }}>🚨</span>
              <span style={{ fontSize: 15, color: 'var(--red,#ef4444)', fontWeight: 700, lineHeight: 1.5 }}>지속적인 반려는 패널 계정 정지로 이어질 수 있습니다.</span>
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <Btn variant="secondary" onClick={() => setResubmitTarget(null)}>취소</Btn>
              <Btn disabled={resubmitCountdown > 0} onClick={() => {
                const { missionId, feedbackId } = resubmitTarget;
                setResubmitTarget(null);
                navigate(`/panel/active?id=${missionId}&resubmit=${feedbackId}`);
              }}>
                {resubmitCountdown > 0 ? `${resubmitCountdown}초 후 시작 가능` : '재작성 시작 →'}
              </Btn>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── 수락 모달 (portal) ── */}
      {modal?.type === 'accept' && ReactDOM.createPortal(
        <div onClick={() => { setModal(null); setAcceptError(''); }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9000 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg)', borderRadius: 'var(--radius-lg)', padding: '40px', width: 'max-content', maxWidth: '90vw', border: '1px solid var(--border)', animation: 'fadeUp 0.2s ease both' }}>
            <div style={{ fontSize: 13, fontFamily: 'var(--font-sans)', color: 'var(--text-2)', marginBottom: 12, letterSpacing: '0.1em' }}>MISSION ACCEPT</div>
            <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>미션을 수락하시겠어요?</h2>
            <div style={{ fontSize: 16, color: 'var(--text-2)', marginBottom: 24, fontWeight: 600 }}>{modal.mission.title}</div>
            <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', padding: '20px 22px', marginBottom: 28, display: 'flex', flexDirection: 'column', gap: 15 }}>
              {[
                '강점·문제점의 구체적인 이유와 개선 방향을 항상 포함해야 합니다.',
                '단순 감상·짧은 답변은 Purit Filter에서 자동 반려됩니다.',
                'AI 문체는 자동 감지됩니다. 반드시 자신의 언어로 직접 작성해 주세요.',
                `수락 후 ${['preference','pricing','email'].includes(modal.mission.type) ? 2 : 4}시간 내에 제출하지 않으면 수락이 자동 취소됩니다.`,
              ].map((t, i) => (
                <div key={i} style={{ display: 'flex', gap: 12, fontSize: 15, color: 'var(--text-2)', lineHeight: 1.5 }}>
                  <span style={{ color: '#F59E0B', flexShrink: 0, marginTop: 1 }}>⚠</span>
                  <span>{t}</span>
                </div>
              ))}
            </div>
            {acceptError && (
              <div style={{ marginBottom: 14, padding: '12px 16px', borderRadius: 'var(--radius)', background: 'rgba(239,68,68,0.08)', color: 'var(--red,#ef4444)', fontSize: 15, fontWeight: 600 }}>
                {acceptError}
              </div>
            )}
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <Btn variant="secondary" onClick={() => { setModal(null); setAcceptError(''); }} disabled={confirming}>취소</Btn>
              <Btn onClick={handleConfirmAccept} disabled={confirming || acceptCountdown > 0}>
                {confirming ? '처리 중...' : acceptCountdown > 0 ? `${acceptCountdown}초 후 수락 가능` : '수락하기 →'}
              </Btn>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── 수락 취소 / 초안 삭제 모달 ── */}
      {modal?.type === 'cancel' && (() => {
        // 종료된 의뢰(status!=='active')의 초안은 '수락 취소'가 아니라 '초안 삭제'로 워딩 통일 (니체2-R)
        // — 이미 종료돼 참여 목록으로 되돌아갈 수 없으므로 ActiveMission missionEnded('초안 삭제하기')와 일치시킴.
        const missionEnded = modal.mission?.status !== 'active';
        return (
          <ConfirmModal
            title={missionEnded ? '초안을 삭제할까요?' : '수락을 취소할까요?'}
            desc={missionEnded
              ? `작성 중이던 피드백 초안이 삭제됩니다.\n이미 종료된 의뢰라 다시 참여할 수 없습니다.`
              : `작성 중이던 피드백 초안이 모두 삭제됩니다.\n이 미션은 다시 참여가능 목록으로 돌아갑니다.`}
            confirmLabel={confirming ? '처리 중...' : (missionEnded ? '초안 삭제' : '수락 취소')}
            cancelLabel={missionEnded ? '닫기' : '계속 작성하기'}
            danger
            onConfirm={handleConfirmCancel}
            onCancel={() => { setModal(null); setCancelError(''); }}
            errorMsg={cancelError}
          />
        );
      })()}

      {/* ── 헤더 ── */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 12, fontFamily: 'var(--font-sans)', color: 'var(--green)', marginBottom: 8, letterSpacing: '0.1em' }}>MISSION BOARD</div>
        <h1 style={{ fontSize: 28, fontWeight: 800 }}>미션 관리</h1>
      </div>

      {/* ── 탭 ── */}
      <StatusTabs
        value={filter}
        onChange={changeTab}
        style={{ marginBottom: 24 }}
        tabs={TABS.map(({ key, label }) => ({
          key,
          label,
          badge: key === 'needsRevision' && rejectedCount > 0 ? (
            <span style={{
              background: 'var(--red, #ef4444)', color: '#fff',
              borderRadius: 99, fontSize: 11, fontWeight: 700,
              padding: '1px 6px', lineHeight: 1.6, minWidth: 18, textAlign: 'center',
            }}>{rejectedCount}</span>
          ) : null,
        }))}
      />

      {/* ── 빈 상태 ── */}
      {filtered.length === 0 && (() => {
        const e = EMPTY_MSG[filter];
        return (
          <div style={{ padding: '48px 40px', textAlign: 'center', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' }}>
            <div style={{ fontSize: 36, marginBottom: 16 }}>{e.icon}</div>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>{e.title}</div>
            <div style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: filter === 'inProgress' ? 24 : 0 }}>
              {e.desc}
            </div>
            {filter === 'inProgress' && (
              <Btn variant="outline" onClick={() => changeTab('new')}>새로운 미션 보기 →</Btn>
            )}
          </div>
        );
      })()}

      {/* ── 메인/서브 분리 목록 ── */}
      {filtered.length > 0 && (
        <>
        {/* 메인/서브 전환 탭 */}
        <SegmentFilter
          value={missionKind}
          onChange={setMissionKind}
          tabs={[
            { key: 'all', label: '전체', count: mainFiltered.length + subFiltered.length },
            { key: 'main', label: '메인', count: mainFiltered.length },
            { key: 'sub', label: '서브', count: subFiltered.length },
          ]}
          style={{ marginBottom: 20 }}
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
          {(missionKind === 'main' || (missionKind === 'all' && mainFiltered.length > 0)) && (
          <div>
            {mainFiltered.length === 0 ? (
              <div style={{ padding: '28px', textAlign: 'center', color: 'var(--text-3)', fontSize: 14, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' }}>
                해당 조건의 미션이 없습니다.
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {mainPaged.map(m => (
                    <MissionCard
                      key={m.id}
                      m={m}
                      mode={filter}
                      feedbackId={feedbackMap[m.id]?.id}
                      rejectionDeadline={feedbackMap[m.id]?.rejection_deadline}
                      submissionDeadline={feedbackMap[m.id]?.submission_deadline}
                      suggestions={feedbackMap[m.id]?.suggestions}
                      navigate={navigate}
                      setModal={setModal}
                      onDismiss={(fid) => { setDismissError(''); setDismissTarget(fid); }}
                      onResubmit={(fid, rdl, title) => setResubmitTarget({ missionId: m.id, feedbackId: fid, rejectionDeadline: rdl, missionTitle: title })}
                      panelHonorPoints={panelHonorPoints}
                      panelExperience={panelExperience}
                    />
                  ))}
                </div>
                <Pagination page={mainPage} total={mainFiltered.length} onPage={setMainPage} />
              </>
            )}
          </div>
          )}

          {(missionKind === 'sub' || (missionKind === 'all' && subFiltered.length > 0)) && (
          <div>
            {subFiltered.length === 0 ? (
              <div style={{ padding: '28px', textAlign: 'center', color: 'var(--text-3)', fontSize: 14, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' }}>
                해당 조건의 미션이 없습니다.
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {subPaged.map(m => (
                    <MissionCard
                      key={m.id}
                      m={m}
                      mode={filter}
                      feedbackId={feedbackMap[m.id]?.id}
                      rejectionDeadline={feedbackMap[m.id]?.rejection_deadline}
                      submissionDeadline={feedbackMap[m.id]?.submission_deadline}
                      suggestions={feedbackMap[m.id]?.suggestions}
                      navigate={navigate}
                      setModal={setModal}
                      onDismiss={(fid) => { setDismissError(''); setDismissTarget(fid); }}
                      onResubmit={(fid, rdl, title) => setResubmitTarget({ missionId: m.id, feedbackId: fid, rejectionDeadline: rdl, missionTitle: title })}
                      panelHonorPoints={panelHonorPoints}
                      panelExperience={panelExperience}
                    />
                  ))}
                </div>
                <Pagination page={subPage} total={subFiltered.length} onPage={setSubPage} />
              </>
            )}
          </div>
          )}
        </div>
        </>
      )}
    </div>
  );
}
