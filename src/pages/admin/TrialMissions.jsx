import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, Badge, Btn, ConfirmModal, StatusTabs } from '../../components/ui';
import ImageAnnotator from '../../components/ui/ImageAnnotator';
import { supabase } from '../../lib/supabase';
import { sendNotification } from '../../lib/notify';
import { getPanelReward, getCareerUnlockCredit } from '../../lib/honorLevels';

// 무료 체험 의뢰 통합 관리 — 미션 모니터링 + 피드백 승인/반려 + 미션 완료/취소
// (PurityFilter·Missions와 동일 RPC 시퀀스를 자체 구현 — 두 페이지 회귀 차단)

const STATUS_LABEL = { active: '진행', in_review: '검토중', completed: '완료', cancelled: '취소', draft: '초안' };
const STATUS_TYPE  = { active: 'green', in_review: 'blue', completed: 'blue', cancelled: 'red', draft: 'gray' };
const DIM_META = [
  { key: 'clarity_score', label: '명확' }, { key: 'relevance_score', label: '관련' },
  { key: 'value_score', label: '가치' }, { key: 'differentiation_score', label: '차별' },
  { key: 'trust_score', label: '신뢰' },
];

function fmtDate(s) {
  if (!s) return '—';
  const d = new Date(s);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

// 패널별 평균 점수(5축) 맵 — 무료 체험 공개 2명 자동 선별용 (호평 상위 2명).
// 서버 unlock_free_trial_mission RPC의 AVG((coalesce..)/5.0)·Results.jsx와 동일 공식 (D-121/D-35).
function panelScoreAvgMap(fbs) {
  const acc = {};
  (fbs || []).forEach(f => {
    if (!f.purity_passed || !f.panel_id) return;
    const s = ((f.clarity_score || 0) + (f.relevance_score || 0) + (f.value_score || 0)
               + (f.differentiation_score || 0) + (f.trust_score || 0)) / 5;
    (acc[f.panel_id] ||= []).push(s);
  });
  const out = {};
  Object.entries(acc).forEach(([pid, arr]) => { out[pid] = arr.reduce((a, b) => a + b, 0) / arr.length; });
  return out;
}

// 퓨릿 점수 (메인 미션 기준 — 무료 체험은 항상 메인/이미지)
function calcPurityScore(fb, imageUrls) {
  const all = [fb.strengths || '', fb.weaknesses || '', fb.suggestions || ''].join(' ');
  const base = 20;
  const length = Math.min(all.length / 8, 20);
  const isImg = (imageUrls?.length || 0) > 0;
  const sectionFill = isImg
    ? (() => {
        const dimSet = new Set();
        (fb.suggestions || '').split('\n').forEach(line => {
          const m = line.match(/^\[(.+?) \/ \d+점\]/);
          if (m) dimSet.add(m[1]);
        });
        return dimSet.size;
      })()
    : (fb.suggestions || '').split('\n\n').filter(sec => sec.replace(/^\[.+?\]\n?/, '').trim().length >= 10).length;
  const balance = sectionFill >= 4 ? 10 : sectionFill >= 2 ? 4 : 0;
  const specKw = all.match(/\d+|%|CTA|클릭|전환|스크롤|이탈|헤드라인|카피|CTR|CVR|ROAS|노출|세션|바운스|히트맵|UX|UI|fold|above|below/gi) || [];
  const specific = Math.min(specKw.length * 4, 25);
  const actKw = all.match(/추천|바꿔|교체|추가|필요|개선|수정|변경|강화|재배치|삭제|줄여|늘려|이동|배치|고려|적용|테스트|실험|보완/gi) || [];
  const actionable = Math.min(actKw.length * 5, 25);
  const aiKw = all.match(/중요합니다|생각됩니다|분석됩니다|판단됩니다|여겨집니다|사료됩니다|향상될 것|효과적일 것|효율적일 것/gi) || [];
  const aiPenalty = Math.max(-30, aiKw.length * -12);
  return Math.max(0, Math.min(100, Math.round(base + length + balance + specific + actionable + aiPenalty)));
}

function fbStatus(f) {
  if (f.purity_passed) return { type: 'green', label: '승인됨' };
  if (f.status === 'rejected') return { type: 'red', label: '반려됨' };
  if (f.status === 'submitted') return { type: 'gold', label: '검토 중' };
  return { type: 'gray', label: '작성중' };
}

const TABS = [
  { key: 'all', label: '전체', match: () => true },
  { key: 'active', label: '진행', match: m => m.status === 'active' || m.status === 'in_review' },
  { key: 'completed', label: '완료', match: m => m.status === 'completed' },
  { key: 'cancelled', label: '취소', match: m => m.status === 'cancelled' },
];

export default function TrialMissions() {
  const [searchParams] = useSearchParams();
  const highlightId = searchParams.get('id');

  const [missions, setMissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('all');
  const [selected, setSelected] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [detailFbs, setDetailFbs] = useState([]);
  const [annotations, setAnnotations] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [expandedFb, setExpandedFb] = useState(null);
  const [adminImageIdx, setAdminImageIdx] = useState(0);

  const [acting, setActing] = useState(false);
  const [statusError, setStatusError] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [rejectTarget, setRejectTarget] = useState(null); // feedback
  const [rejectNote, setRejectNote] = useState('');
  const [confirmComplete, setConfirmComplete] = useState(null);
  const [confirmCancel, setConfirmCancel] = useState(null);
  const [confirmReactivate, setConfirmReactivate] = useState(null); // 완료→진행
  const [confirmResume, setConfirmResume] = useState(null);         // 취소→진행
  const [confirmDelete, setConfirmDelete] = useState(null);         // 삭제

  // 일괄 처리 (검토 대기 피드백)
  const [checkedIds, setCheckedIds] = useState(new Set());
  const [bulkActing, setBulkActing] = useState(false);
  const [confirmBulkApprove, setConfirmBulkApprove] = useState(false);
  const [confirmBulkReject, setConfirmBulkReject] = useState(false);

  // 공개 2건 선택 (어드민 지정)
  const [publicSel, setPublicSel] = useState(new Set()); // panel_id Set (최대 2)
  const [savingPublic, setSavingPublic] = useState(false);
  const [publicSaved, setPublicSaved] = useState(false);

  async function loadMissions() {
    const { data } = await supabase
      .from('missions')
      .select('*, companies(name, user_id)')
      .eq('is_free_trial', true)
      .order('created_at', { ascending: false });
    setMissions(data || []);
    return data || [];
  }

  useEffect(() => {
    (async () => {
      try {
        const ms = await loadMissions();
        if (highlightId && ms.find(m => m.id === highlightId)) setSelected(highlightId);
      } catch (e) { console.error('[TrialMissions load]', e); }
      finally { setLoading(false); }
    })();
  }, []); // eslint-disable-line

  // 선택 미션 상세 로드
  useEffect(() => {
    if (!selected) { setDetailFbs([]); setAnnotations([]); setCheckedIds(new Set()); setPublicSel(new Set()); return; }
    setDetailLoading(true); setExpandedFb(null); setAdminImageIdx(0); setStatusError('');
    setCheckedIds(new Set()); setPublicSaved(false);
    (async () => {
      const { data: fbs } = await supabase
        .from('feedbacks')
        .select('*, panels(user_id, name, honor_points, experience, is_expert, notif_prefs)')
        .eq('mission_id', selected)
        .neq('status', 'draft')
        .order('created_at', { ascending: true });
      setDetailFbs(fbs || []);
      // 공개 2건 선택 초기화: 어드민 지정값이 있으면 그것, 없으면 자동 호평 상위 2명(평균점수순)
      const m = missions.find(x => x.id === selected);
      const saved = m?.trial_public_panel_ids;
      if (Array.isArray(saved) && saved.length > 0) {
        setPublicSel(new Set(saved));
      } else {
        const seen = new Set(); const approved = [];
        (fbs || []).forEach(f => {
          if (f.purity_passed && f.panel_id && !seen.has(f.panel_id)) { seen.add(f.panel_id); approved.push(f); }
        });
        // 공개 = 호평 상위 2명 (평균점수 DESC, panel_id ASC) — 서버 unlock RPC·Results와 정합
        const avgMap = panelScoreAvgMap(fbs || []);
        approved.sort((a, b) => {
          const sa = avgMap[a.panel_id] ?? 0, sb = avgMap[b.panel_id] ?? 0;
          if (sb !== sa) return sb - sa;
          return a.panel_id < b.panel_id ? -1 : 1;
        });
        setPublicSel(new Set(approved.slice(0, 2).map(f => f.panel_id)));
      }
      const { data: anns } = await supabase
        .from('feedback_annotations')
        .select('*').eq('mission_id', selected).order('created_at');
      setAnnotations(anns || []);
      setDetailLoading(false);
    })();
  }, [selected]); // eslint-disable-line

  const selMission = missions.find(m => m.id === selected) || null;

  // ── 피드백 승인 ──
  const approve = async (fb) => {
    setActing(true); setStatusError('');
    const baseReward = getPanelReward(fb.panels?.honor_points || 0, fb.panels?.experience || '');
    const payload = { purity_passed: true, status: 'approved', payout_amount: baseReward, rejection_penalty_applied: false };
    const { error } = await supabase.from('feedbacks').update(payload).eq('id', fb.id);
    if (error) { setStatusError('승인 실패: ' + error.message); setActing(false); return; }
    setDetailFbs(fbs => fbs.map(f => f.id === fb.id ? { ...f, ...payload } : f));
    if (fb.rejection_penalty_applied && fb.panel_id) supabase.rpc('restore_feedback_honor', { p_feedback_id: fb.id, p_panel_id: fb.panel_id });
    // 무료 미션이라 recalc_mission_consumed 생략 (credits_consumed는 언락이 관리)
    if (fb.panels?.user_id && fb.panels?.notif_prefs?.feedbackApproved !== false) {
      sendNotification(fb.panels.user_id, {
        type: 'success', icon: '✅', title: '피드백 승인',
        body: `[${selMission?.title || '의뢰'}] 피드백이 승인되었습니다. 보상이 곧 지급됩니다.`,
        actionUrl: '/panel/history', targetRole: 'panel', prefKey: 'feedbackApproved',
      });
    }
    setActing(false);
  };

  // ── 피드백 반려 ──
  const doReject = async () => {
    const fb = rejectTarget;
    setActing(true); setStatusError('');
    const rejectionDeadline = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(); // 메인 4h
    const payload = { purity_passed: false, status: 'rejected', rejection_penalty_applied: true, rejection_deadline: rejectionDeadline };
    if (rejectNote.trim()) payload.suggestions = rejectNote.trim();
    const { error } = await supabase.from('feedbacks').update(payload).eq('id', fb.id);
    if (error) { setStatusError('반려 실패: ' + error.message); setActing(false); return; }
    setDetailFbs(fbs => fbs.map(f => f.id === fb.id ? { ...f, ...payload } : f));
    if (fb.mission_id) await supabase.rpc('decrement_mission_filled_count', { p_mission_id: fb.mission_id });
    if (fb.panel_id) supabase.rpc('reject_feedback_honor', { p_feedback_id: fb.id, p_panel_id: fb.panel_id });
    setMissions(ms => ms.map(m => m.id === fb.mission_id ? { ...m, filled_count: Math.max(0, (m.filled_count || 0) - 1) } : m));
    if (fb.panels?.user_id && fb.panels?.notif_prefs?.feedbackRejected !== false) {
      sendNotification(fb.panels.user_id, {
        type: 'warning', icon: '⚠️', title: '피드백 반려',
        body: `[${selMission?.title || '의뢰'}] 피드백이 반려되었습니다. 4시간 내 재제출하면 보상 기회가 유지됩니다.`,
        actionUrl: '/panel/missions?tab=needsRevision', targetRole: 'panel', prefKey: 'feedbackRejected',
      });
    }
    setRejectTarget(null); setRejectNote(''); setActing(false);
  };

  // ── 미션 완료 ──
  const completeMission = async (m) => {
    setActing(true); setStatusError('');
    const { data, error } = await supabase.rpc('complete_mission_and_refund', { p_mission_id: m.id });
    if (error || !data?.success) { setStatusError(error?.message || data?.error || '완료 처리 실패'); setActing(false); setConfirmComplete(null); return; }
    setMissions(ms => ms.map(x => x.id === m.id ? { ...x, status: 'completed' } : x));
    if (m.companies?.user_id) sendNotification(m.companies.user_id, {
      type: 'success', icon: '🏁', title: '의뢰 완료',
      body: `[${m.title}] 의뢰가 완료 처리되었습니다. 결과를 확인하세요.`,
      actionUrl: `/company/results?id=${m.id}`, targetRole: 'company', prefKey: 'missionComplete',
    });
    setConfirmComplete(null); setActing(false);
  };

  // ── 미션 취소 ──
  const cancelMission = async (m) => {
    setActing(true); setStatusError('');
    const { error } = await supabase.from('missions').update({ status: 'cancelled' }).eq('id', m.id);
    if (error) { setStatusError('취소 실패: ' + error.message); setActing(false); setConfirmCancel(null); return; }
    setMissions(ms => ms.map(x => x.id === m.id ? { ...x, status: 'cancelled' } : x));
    if (m.companies?.user_id) sendNotification(m.companies.user_id, {
      type: 'warning', icon: '🚫', title: '의뢰 취소 처리',
      body: `[${m.title}] 의뢰가 취소 처리되었습니다.`,
      actionUrl: '/company', targetRole: 'company', prefKey: 'missionStatusChange',
    });
    setConfirmCancel(null); setActing(false);
  };

  // ── 미션 재진행 (완료→진행, 크레딧 회수 RPC — 무료라 회수 0) ──
  const reactivateCompleted = async (m) => {
    setActing(true); setStatusError('');
    const { data, error } = await supabase.rpc('reactivate_mission_and_reclaim', { p_mission_id: m.id });
    if (error || !data?.success) {
      const code = data?.error || error?.message || '재진행 처리 실패';
      setStatusError(code === 'INSUFFICIENT_CREDITS' ? '기업 잔여 크레딧이 회수 필요액보다 부족하여 재진행할 수 없습니다.' : code);
      setActing(false); setConfirmReactivate(null); return;
    }
    setMissions(ms => ms.map(x => x.id === m.id ? { ...x, status: 'active' } : x));
    if (m.companies?.user_id) sendNotification(m.companies.user_id, {
      type: 'info', icon: '🔄', title: '의뢰 재진행',
      body: `[${m.title}] 완료된 의뢰가 재진행 처리되었습니다.`,
      actionUrl: '/company', targetRole: 'company', prefKey: 'missionStatusChange',
    });
    setConfirmReactivate(null); setActing(false);
  };

  // ── 미션 재개 (취소→진행) ──
  const resumeMission = async (m) => {
    setActing(true); setStatusError('');
    const { error } = await supabase.from('missions').update({ status: 'active' }).eq('id', m.id);
    if (error) { setStatusError('재개 실패: ' + error.message); setActing(false); setConfirmResume(null); return; }
    setMissions(ms => ms.map(x => x.id === m.id ? { ...x, status: 'active' } : x));
    if (m.companies?.user_id) sendNotification(m.companies.user_id, {
      type: 'success', icon: '▶️', title: '의뢰 재개',
      body: `[${m.title}] 취소된 의뢰가 재개되었습니다. 패널 매칭이 다시 시작됩니다.`,
      actionUrl: '/company', targetRole: 'company', prefKey: 'missionStatusChange',
    });
    setConfirmResume(null); setActing(false);
  };

  // ── 미션 삭제 (어드민 RPC: 삭제 + 무료 체험 기회 복구) ──
  const deleteMission = async (m) => {
    setActing(true); setDeleteError('');
    const { data, error } = await supabase.rpc('admin_delete_trial_mission', { p_mission_id: m.id });
    if (error || !data?.success) { setDeleteError('삭제 실패: ' + (error?.message || data?.error || '알 수 없는 오류')); setActing(false); return; }
    setMissions(ms => ms.filter(x => x.id !== m.id));
    if (selected === m.id) setSelected(null);
    setConfirmDelete(null); setActing(false);
  };

  // ── 일괄 승인 (검토 대기 피드백) ──
  const toggleCheck = (id) => {
    setCheckedIds(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  };
  const pendingIds = detailFbs.filter(f => f.status === 'submitted' && !f.purity_passed).map(f => f.id);
  const allChecked = pendingIds.length > 0 && pendingIds.every(id => checkedIds.has(id));
  const toggleAll = () => {
    setCheckedIds(prev => {
      const next = new Set(prev);
      if (allChecked) pendingIds.forEach(id => next.delete(id));
      else pendingIds.forEach(id => next.add(id));
      return next;
    });
  };

  const bulkApprove = async () => {
    if (checkedIds.size === 0 || bulkActing) return;
    setBulkActing(true); setStatusError('');
    const ids = [...checkedIds];
    const payoutMap = {};
    ids.forEach(id => {
      const f = detailFbs.find(x => x.id === id); if (!f) return;
      payoutMap[id] = getPanelReward(f.panels?.honor_points || 0, f.panels?.experience || '');
    });
    const { error } = await supabase.from('feedbacks')
      .update({ purity_passed: true, status: 'approved', rejection_penalty_applied: false }).in('id', ids);
    if (error) { setStatusError('일괄 승인 실패: ' + error.message); setBulkActing(false); return; }
    await Promise.all(ids.map(id => supabase.from('feedbacks').update({ payout_amount: payoutMap[id] }).eq('id', id)));
    setDetailFbs(fbs => fbs.map(f => ids.includes(f.id) ? { ...f, purity_passed: true, status: 'approved', payout_amount: payoutMap[f.id], rejection_penalty_applied: false } : f));
    // 무료 미션이라 recalc_mission_consumed 생략 (언락이 credits_consumed 관리)
    ids.forEach(id => {
      const f = detailFbs.find(x => x.id === id);
      if (f?.rejection_penalty_applied && f?.panel_id) supabase.rpc('restore_feedback_honor', { p_feedback_id: f.id, p_panel_id: f.panel_id });
    });
    const notifRows = ids.map(id => detailFbs.find(x => x.id === id)).filter(Boolean)
      .filter(f => f.panels?.user_id && f.panels?.notif_prefs?.feedbackApproved !== false)
      .map(f => ({ user_id: f.panels.user_id, type: 'success', icon: '✅', title: '피드백 승인', body: `[${selMission?.title || '의뢰'}] 피드백이 승인되었습니다. 보상이 곧 지급됩니다.`, action_url: '/panel/history', target_role: 'panel', read: false }));
    if (notifRows.length) supabase.from('notifications').insert(notifRows).then(({ error: ne }) => { if (ne) console.warn('[trial bulk approve notif]', ne.message); });
    setCheckedIds(new Set()); setBulkActing(false); setConfirmBulkApprove(false);
  };

  const bulkReject = async () => {
    if (checkedIds.size === 0 || bulkActing) return;
    setBulkActing(true); setStatusError('');
    const ids = [...checkedIds];
    const deadline = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(); // 무료=메인 4h
    const { error } = await supabase.from('feedbacks')
      .update({ purity_passed: false, status: 'rejected', rejection_penalty_applied: true, rejection_deadline: deadline }).in('id', ids);
    if (error) { setStatusError('일괄 반려 실패: ' + error.message); setBulkActing(false); return; }
    setDetailFbs(fbs => fbs.map(f => ids.includes(f.id) ? { ...f, purity_passed: false, status: 'rejected', rejection_penalty_applied: true, rejection_deadline: deadline } : f));
    let mid = null;
    for (const id of ids) {
      const f = detailFbs.find(x => x.id === id);
      if (f?.mission_id) { mid = f.mission_id; await supabase.rpc('decrement_mission_filled_count', { p_mission_id: f.mission_id }); }
      if (f?.panel_id) supabase.rpc('reject_feedback_honor', { p_feedback_id: f.id, p_panel_id: f.panel_id });
    }
    if (mid) setMissions(ms => ms.map(m => m.id === mid ? { ...m, filled_count: Math.max(0, (m.filled_count || 0) - ids.length) } : m));
    const notifRows = ids.map(id => detailFbs.find(x => x.id === id)).filter(Boolean)
      .filter(f => f.panels?.user_id && f.panels?.notif_prefs?.feedbackRejected !== false)
      .map(f => ({ user_id: f.panels.user_id, type: 'warning', icon: '⚠️', title: '피드백 반려', body: `[${selMission?.title || '의뢰'}] 피드백이 반려되었습니다. 4시간 내 재제출하면 보상 기회가 유지됩니다.`, action_url: '/panel/missions?tab=needsRevision', target_role: 'panel', read: false }));
    if (notifRows.length) supabase.from('notifications').insert(notifRows).then(({ error: ne }) => { if (ne) console.warn('[trial bulk reject notif]', ne.message); });
    setCheckedIds(new Set()); setBulkActing(false); setConfirmBulkReject(false);
  };

  // ── 공개 2건 선택 (승인된 피드백만, 최대 2) ──
  const togglePublic = (panelId) => {
    setPublicSel(prev => {
      const next = new Set(prev);
      if (next.has(panelId)) next.delete(panelId);
      else if (next.size < 2) next.add(panelId);
      return next;
    });
    setPublicSaved(false);
  };
  const savePublic = async () => {
    if (publicSel.size !== 2 || savingPublic) return;
    setSavingPublic(true); setStatusError('');
    const ids = [...publicSel];
    // 보호 컬럼이라 직접 UPDATE 불가(092 트리거) → 어드민 전용 RPC
    const { data, error } = await supabase.rpc('admin_set_trial_public', { p_mission_id: selected, p_panel_ids: ids });
    if (error || !data?.success) { setStatusError('공개 설정 저장 실패: ' + (error?.message || data?.error || '알 수 없는 오류')); setSavingPublic(false); return; }
    setMissions(ms => ms.map(m => m.id === selected ? { ...m, trial_public_panel_ids: ids } : m));
    setSavingPublic(false); setPublicSaved(true);
  };

  const tabbed = missions
    .filter(TABS.find(t => t.key === tab).match)
    .filter(m => !searchQuery.trim() || (m.title || '').toLowerCase().includes(searchQuery.trim().toLowerCase()));
  const pendingCount = detailFbs.filter(f => f.status === 'submitted' && !f.purity_passed).length;

  // 헤더 표시용: 승인 피드백 기준 실시간 상태 (등록 추정치 unlock_cost 대신 실제 잠긴 패널 경력 합)
  const approvedPanels = (() => {
    const seen = new Set(); const arr = [];
    detailFbs.forEach(f => { if (f.purity_passed && f.panel_id && !seen.has(f.panel_id)) { seen.add(f.panel_id); arr.push(f); } });
    return arr;
  })();
  const publicSaved2 = !!(selMission && Array.isArray(selMission.trial_public_panel_ids) && selMission.trial_public_panel_ids.length === 2);
  const effectivePublicSet = (() => {
    if (publicSaved2) return new Set(selMission.trial_public_panel_ids);
    // 자동 공개 = 호평 상위 2명 (평균점수 DESC, panel_id ASC) — 서버 unlock RPC·Results와 정합
    const avgMap = panelScoreAvgMap(detailFbs);
    const sorted = [...approvedPanels].sort((a, b) => {
      const sa = avgMap[a.panel_id] ?? 0, sb = avgMap[b.panel_id] ?? 0;
      if (sb !== sa) return sb - sa;
      return a.panel_id < b.panel_id ? -1 : 1;
    });
    return new Set(sorted.slice(0, 2).map(f => f.panel_id));
  })();
  const liveLockedCost = approvedPanels.filter(f => !effectivePublicSet.has(f.panel_id))
    .reduce((s, f) => s + getCareerUnlockCredit(f.panels?.experience || ''), 0);
  // 완료 차단: 미언락 + 잠길 피드백 존재(승인 3명+)인데 공개 2건 미저장 → 완료 불가
  const trialCompleteBlocked = !!(selMission && !selMission.trial_unlocked && approvedPanels.length > 2 && !publicSaved2);

  if (loading) return <div style={{ padding: '40px 48px', color: 'var(--text-3)', fontSize: 14 }}>불러오는 중...</div>;

  return (
    <div className="page-wrap" style={{ padding: '32px 48px' }}>
      <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 6 }}>체험 의뢰 관리</div>
      <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 20, lineHeight: 1.6 }}>
        무료 체험 의뢰의 모니터링·피드백 승인/반려·완료/취소를 한 곳에서 처리합니다. 전문가 패널 계정(expert1·expert2)으로 슬롯을 선점 수락하세요.
      </p>

      {/* 상태 탭 */}
      <StatusTabs
        value={tab}
        onChange={(v) => { setTab(v); setSelected(null); }}
        tabs={TABS.map(t => ({ key: t.key, label: t.label, count: missions.filter(t.match).length }))}
      />
      {/* 검색 */}
      <div style={{ marginBottom: 20 }}>
        <input
          type="text"
          placeholder="의뢰명으로 검색..."
          value={searchQuery}
          onChange={(e) => { setSearchQuery(e.target.value); setSelected(null); }}
          style={{ width: 260, padding: '7px 13px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text)', background: 'var(--surface)', outline: 'none' }}
        />
      </div>

      {statusError && (
        <div style={{ padding: '10px 14px', marginBottom: 16, borderRadius: 8, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', color: '#dc2626', fontSize: 13, fontWeight: 600 }}>{statusError}</div>
      )}

      <div className="purity-layout" style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 16, alignItems: 'start' }}>
        {/* ── 좌: 미션 목록 ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {tabbed.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-3)', fontSize: 13, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
              해당 상태의 체험 의뢰가 없습니다.
            </div>
          ) : tabbed.map(m => {
            const sel = selected === m.id;
            const slotsFull = (m.filled_count || 0) >= (m.panel_count || 0);
            return (
              <Card key={m.id} onClick={() => setSelected(m.id)} style={{
                padding: 14, cursor: 'pointer',
                border: sel ? '2px solid var(--accent)' : (m.id === highlightId ? '2px solid var(--accent)' : '1px solid var(--border)'),
                background: sel ? 'rgba(16,54,125,0.04)' : 'var(--surface)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5, flexWrap: 'wrap' }}>
                  <Badge type="gold">🎁 체험</Badge>
                  <Badge type={STATUS_TYPE[m.status] || 'gray'}>{STATUS_LABEL[m.status] || m.status}</Badge>
                  {m.trial_unlocked && <Badge type="green">언락됨</Badge>}
                </div>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 3 }}>{m.title}</div>
                <div style={{ fontSize: 12, color: 'var(--text-2)' }}>{m.companies?.name || '—'} · {fmtDate(m.created_at)}</div>
                <div style={{ fontSize: 12, fontWeight: 700, marginTop: 5, color: slotsFull ? 'var(--text)' : '#F59E0B' }}>
                  슬롯 {m.filled_count || 0}/{m.panel_count || 0}{!slotsFull && m.status === 'active' && ' · 선점 필요'}
                </div>
              </Card>
            );
          })}
        </div>

        {/* ── 우: 상세 ── */}
        <div>
          {!selMission ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)', fontSize: 14, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' }}>
              왼쪽에서 체험 의뢰를 선택하세요.
            </div>
          ) : (
            <>
              {/* 미션 헤더 + 액션 */}
              <Card style={{ padding: 20, marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 18, fontWeight: 800 }}>{selMission.title}</span>
                      <Badge type={STATUS_TYPE[selMission.status] || 'gray'}>{STATUS_LABEL[selMission.status] || selMission.status}</Badge>
                      {selMission.trial_unlocked
                        ? <Badge type="green">언락됨</Badge>
                        : publicSaved2
                          ? <Badge type="gold">2건 공개 설정됨</Badge>
                          : <Badge type="gray">공개 대기</Badge>}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-2)' }}>
                      {selMission.companies?.name || '—'} · 슬롯 {selMission.filled_count || 0}/{selMission.panel_count || 0} · {
                        selMission.trial_unlocked
                          ? `언락 비용 ${Math.ceil(selMission.unlock_cost || 0)}cr`
                          : approvedPanels.length === 0
                            ? '언락 비용: 피드백 승인 후 확정'
                            : `예상 언락 비용 ${Math.ceil(liveLockedCost)}cr (잠긴 패널 경력 합)`
                      }
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    {(selMission.status === 'active' || selMission.status === 'in_review') && (
                      <>
                        <Btn size="sm" onClick={() => setConfirmComplete(selMission)} disabled={acting || trialCompleteBlocked}>완료 처리</Btn>
                        <Btn size="sm" variant="danger" onClick={() => setConfirmCancel(selMission)} disabled={acting}>취소</Btn>
                      </>
                    )}
                    {selMission.status === 'completed' && (
                      <Btn size="sm" onClick={() => setConfirmReactivate(selMission)} disabled={acting}>재진행</Btn>
                    )}
                    {selMission.status === 'cancelled' && (
                      <>
                        <Btn size="sm" onClick={() => setConfirmResume(selMission)} disabled={acting}>재개</Btn>
                        <Btn size="sm" variant="danger" onClick={() => setConfirmDelete(selMission)} disabled={acting}>삭제</Btn>
                      </>
                    )}
                    </div>
                    {(selMission.status === 'active' || selMission.status === 'in_review') && trialCompleteBlocked && (
                      <div style={{ fontSize: 11, color: '#F59E0B', fontWeight: 600, textAlign: 'right' }}>
                        공개 2건을 저장해야 완료할 수 있습니다
                      </div>
                    )}
                  </div>
                </div>
              </Card>

              {/* 공개 2건 선택 (미언락 + 승인 피드백 존재 시) */}
              {!selMission.trial_unlocked && detailFbs.some(f => f.purity_passed) && (
                <Card style={{ padding: 14, marginBottom: 12, background: 'var(--accent-dim2)', border: '1px solid var(--accent-dim)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>기업에 공개할 피드백 선택 (2건 고정)</div>
                      <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 2, lineHeight: 1.5 }}>
                        승인된 피드백 중 정확히 2건을 골라 저장하면 기업에게 즉시 공개되고 나머지는 잠금(블러)됩니다. 현재 <b>{publicSel.size}/2</b> 선택
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                      {publicSaved && <span style={{ fontSize: 12, color: '#16a34a', fontWeight: 700 }}>✓ 저장됨</span>}
                      <Btn size="sm" onClick={savePublic} disabled={savingPublic || publicSel.size !== 2}>{savingPublic ? '저장 중…' : '공개 설정 저장'}</Btn>
                    </div>
                  </div>
                </Card>
              )}

              {/* 피드백 목록 */}
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span>피드백 {detailFbs.length}건 {pendingCount > 0 && <span style={{ color: '#F59E0B' }}>· 검토 대기 {pendingCount}</span>}</span>
                {pendingIds.length > 0 && (
                  <label style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontSize: 12, color: 'var(--text-3)', fontWeight: 600 }}>
                    <input type="checkbox" checked={allChecked} onChange={toggleAll} style={{ accentColor: 'var(--accent)', cursor: 'pointer', width: 14, height: 14 }} />
                    전체 선택
                  </label>
                )}
              </div>

              {/* 일괄 처리 바 */}
              {checkedIds.size > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'var(--accent-dim)', borderRadius: 'var(--radius)', marginBottom: 10, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)', flex: 1 }}>{checkedIds.size}개 선택됨</span>
                  <button disabled={bulkActing} onClick={() => setConfirmBulkApprove(true)} style={{ padding: '5px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600, border: 'none', background: '#16a34a', color: '#fff', cursor: bulkActing ? 'not-allowed' : 'pointer', opacity: bulkActing ? 0.6 : 1 }}>{bulkActing ? '처리 중...' : '✓ 일괄 승인'}</button>
                  <button disabled={bulkActing} onClick={() => setConfirmBulkReject(true)} style={{ padding: '5px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600, border: 'none', background: '#dc2626', color: '#fff', cursor: bulkActing ? 'not-allowed' : 'pointer', opacity: bulkActing ? 0.6 : 1 }}>{bulkActing ? '처리 중...' : '✕ 일괄 반려'}</button>
                  <button onClick={() => setCheckedIds(new Set())} style={{ padding: '5px 10px', borderRadius: 6, fontSize: 12, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-3)', cursor: 'pointer' }}>선택 해제</button>
                </div>
              )}

              {detailLoading ? (
                <div style={{ color: 'var(--text-3)', fontSize: 13 }}>피드백 불러오는 중...</div>
              ) : detailFbs.length === 0 ? (
                <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-3)', fontSize: 13, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
                  제출된 피드백이 없습니다. 패널 수락·제출을 기다리세요.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {detailFbs.map(f => {
                    const score = calcPurityScore(f, selMission.image_urls);
                    const st = fbStatus(f);
                    const isPending = f.status === 'submitted' && !f.purity_passed;
                    const open = expandedFb === f.id;
                    const fbAnns = annotations.filter(a => a.feedback_id === f.id);
                    const scoreColor = score >= 65 ? '#16a34a' : score >= 45 ? 'var(--accent)' : '#dc2626';
                    return (
                      <Card key={f.id} style={{ padding: 14 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', minWidth: 0 }}>
                            {isPending && (
                              <input type="checkbox" checked={checkedIds.has(f.id)} onChange={() => toggleCheck(f.id)} style={{ accentColor: 'var(--accent)', cursor: 'pointer', width: 14, height: 14, flexShrink: 0 }} />
                            )}
                            <span style={{ fontWeight: 700, fontSize: 13 }}>{f.panels?.name || '패널'}</span>
                            <Badge type={st.type}>{st.label}</Badge>
                            <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
                              {DIM_META.map(d => `${d.label[0]}${f[d.key] ?? '-'}`).join(' ')}
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                            {!selMission.trial_unlocked && f.purity_passed && (
                              <button onClick={() => togglePublic(f.panel_id)} disabled={!publicSel.has(f.panel_id) && publicSel.size >= 2}
                                style={{ padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700,
                                  cursor: (!publicSel.has(f.panel_id) && publicSel.size >= 2) ? 'not-allowed' : 'pointer',
                                  border: `1.5px solid ${publicSel.has(f.panel_id) ? '#16a34a' : 'var(--border)'}`,
                                  background: publicSel.has(f.panel_id) ? 'rgba(22,163,74,0.1)' : 'var(--surface)',
                                  color: publicSel.has(f.panel_id) ? '#16a34a' : 'var(--text-3)',
                                  opacity: (!publicSel.has(f.panel_id) && publicSel.size >= 2) ? 0.45 : 1 }}>
                                {publicSel.has(f.panel_id) ? '🔓 공개' : '🔒 잠금'}
                              </button>
                            )}
                            <div style={{ textAlign: 'right' }}>
                              <span style={{ fontSize: 11, color: 'var(--text-3)', marginRight: 4 }}>퓨릿</span>
                              <span style={{ fontFamily: 'var(--font-sans)', fontWeight: 800, fontSize: 16, color: scoreColor }}>{score}</span>
                            </div>
                            <Btn size="sm" variant="ghost" onClick={() => setExpandedFb(open ? null : f.id)}>{open ? '접기' : '상세'}</Btn>
                          </div>
                        </div>

                        {isPending && (
                          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                            <Btn size="sm" onClick={() => approve(f)} disabled={acting}>승인</Btn>
                            <Btn size="sm" variant="danger" onClick={() => { setRejectTarget(f); setRejectNote(''); }} disabled={acting}>반려</Btn>
                          </div>
                        )}

                        {open && (
                          <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                            {/* 어노테이션 */}
                            {Array.isArray(selMission.image_urls) && selMission.image_urls.length > 0 && fbAnns.length > 0 && (
                              <div style={{ marginBottom: 12 }}>
                                {selMission.image_urls.length > 1 && (
                                  <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                                    {selMission.image_urls.map((_, i) => (
                                      <button key={i} onClick={() => setAdminImageIdx(i)} style={{
                                        padding: '4px 12px', borderRadius: 'var(--radius)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                                        border: `1.5px solid ${adminImageIdx === i ? 'var(--accent)' : 'var(--border)'}`,
                                        background: adminImageIdx === i ? 'var(--accent)' : 'var(--surface)', color: adminImageIdx === i ? '#fff' : 'var(--text-2)',
                                      }}>이미지 {i + 1} ({fbAnns.filter(a => a.image_index === i).length})</button>
                                    ))}
                                  </div>
                                )}
                                <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
                                  <ImageAnnotator
                                    imageUrl={selMission.image_urls[adminImageIdx]}
                                    imageIndex={adminImageIdx}
                                    annotations={fbAnns.filter(a => a.image_index === adminImageIdx)}
                                    seqPool={fbAnns}
                                    readonly
                                  />
                                </div>
                              </div>
                            )}
                            {/* 총평·코멘트 */}
                            <div style={{ fontSize: 12.5, color: 'var(--text)', lineHeight: 1.7, whiteSpace: 'pre-wrap', background: 'var(--bg-2)', borderRadius: 'var(--radius)', padding: '12px 14px' }}>
                              {f.suggestions || '작성된 내용이 없습니다.'}
                            </div>
                          </div>
                        )}
                      </Card>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* 반려 사유 모달 */}
      {rejectTarget && (
        <ConfirmModal
          title="피드백 반려"
          desc={
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 10 }}>반려 사유를 입력하면 패널에게 전달됩니다. (선택)</div>
              <textarea
                value={rejectNote}
                onChange={e => setRejectNote(e.target.value)}
                placeholder="예: 어노테이션 코멘트가 너무 추상적입니다. 구체적 개선안을 추가해주세요."
                style={{ width: '100%', minHeight: 80, padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, resize: 'vertical', fontFamily: 'inherit' }}
              />
            </div>
          }
          confirmLabel={acting ? '처리 중…' : '반려하기'}
          cancelLabel="취소"
          danger
          errorMsg={statusError}
          onConfirm={doReject}
          onCancel={() => { setRejectTarget(null); setRejectNote(''); setStatusError(''); }}
        />
      )}

      {/* 완료 확인 */}
      {confirmComplete && (
        <ConfirmModal
          title="의뢰를 완료 처리할까요?"
          desc="무료 체험 의뢰를 완료 처리합니다. (무료 미션은 환불·소비 재계산 없이 상태만 완료됩니다.)"
          confirmLabel={acting ? '처리 중…' : '완료 처리'}
          cancelLabel="취소"
          errorMsg={statusError}
          onConfirm={() => completeMission(confirmComplete)}
          onCancel={() => { setConfirmComplete(null); setStatusError(''); }}
        />
      )}

      {/* 취소 확인 */}
      {confirmCancel && (
        <ConfirmModal
          title="의뢰를 취소할까요?"
          desc="무료 체험 의뢰를 취소 처리합니다. 기업에 취소 알림이 발송됩니다."
          confirmLabel={acting ? '처리 중…' : '취소 처리'}
          cancelLabel="유지"
          danger
          errorMsg={statusError}
          onConfirm={() => cancelMission(confirmCancel)}
          onCancel={() => { setConfirmCancel(null); setStatusError(''); }}
        />
      )}

      {/* 재진행 확인 (완료→진행) */}
      {confirmReactivate && (
        <ConfirmModal
          title="완료된 의뢰를 다시 진행할까요?"
          desc="완료된 무료 체험 의뢰를 진행 상태로 되돌립니다. (무료 의뢰는 크레딧 회수가 발생하지 않습니다.) 기업에 재진행 알림이 발송됩니다."
          confirmLabel={acting ? '처리 중…' : '재진행'}
          cancelLabel="취소"
          errorMsg={statusError}
          onConfirm={() => reactivateCompleted(confirmReactivate)}
          onCancel={() => { setConfirmReactivate(null); setStatusError(''); }}
        />
      )}

      {/* 재개 확인 (취소→진행) */}
      {confirmResume && (
        <ConfirmModal
          title="취소된 의뢰를 재개할까요?"
          desc="취소된 무료 체험 의뢰를 진행 상태로 되돌립니다. 패널 매칭이 다시 시작되고 기업에 재개 알림이 발송됩니다."
          confirmLabel={acting ? '처리 중…' : '재개'}
          cancelLabel="취소"
          errorMsg={statusError}
          onConfirm={() => resumeMission(confirmResume)}
          onCancel={() => { setConfirmResume(null); setStatusError(''); }}
        />
      )}

      {/* 삭제 확인 */}
      {confirmDelete && (
        <ConfirmModal
          title="의뢰를 삭제할까요?"
          desc="이 무료 체험 의뢰를 영구 삭제합니다. 되돌릴 수 없습니다. 기업의 무료 체험 기회가 복구되어 다시 무료 의뢰를 등록할 수 있게 됩니다."
          confirmLabel={acting ? '처리 중…' : '삭제'}
          cancelLabel="취소"
          danger
          errorMsg={deleteError}
          onConfirm={() => deleteMission(confirmDelete)}
          onCancel={() => { setConfirmDelete(null); setDeleteError(''); }}
        />
      )}

      {/* 일괄 승인 확인 */}
      {confirmBulkApprove && (
        <ConfirmModal
          title={`${checkedIds.size}건을 일괄 승인할까요?`}
          desc="선택한 검토 대기 피드백을 모두 승인합니다. 각 패널에게 승인 알림과 보상이 지급됩니다."
          confirmLabel={bulkActing ? '처리 중…' : '일괄 승인'}
          cancelLabel="취소"
          errorMsg={statusError}
          onConfirm={bulkApprove}
          onCancel={() => { setConfirmBulkApprove(false); setStatusError(''); }}
        />
      )}

      {/* 일괄 반려 확인 */}
      {confirmBulkReject && (
        <ConfirmModal
          title={`${checkedIds.size}건을 일괄 반려할까요?`}
          desc="선택한 검토 대기 피드백을 모두 반려합니다. 각 패널에게 반려 알림이 발송되고 4시간 내 재제출 기회가 부여됩니다."
          confirmLabel={bulkActing ? '처리 중…' : '일괄 반려'}
          cancelLabel="취소"
          danger
          errorMsg={statusError}
          onConfirm={bulkReject}
          onCancel={() => { setConfirmBulkReject(false); setStatusError(''); }}
        />
      )}
    </div>
  );
}
