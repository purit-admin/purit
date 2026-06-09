import { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import { useLocation } from 'react-router-dom';
import { Card, Badge, Btn, ConfirmModal } from '../../components/ui';
import ImageAnnotator from '../../components/ui/ImageAnnotator';
import { supabase } from '../../lib/supabase';
import { sendNotification } from '../../lib/notify';
import { getPanelReward } from '../../lib/honorLevels';

const DIM = [
  { key: 'clarity_score',         label: '명확성' },
  { key: 'relevance_score',       label: '관련성' },
  { key: 'value_score',           label: '가치' },
  { key: 'differentiation_score', label: '차별화' },
  { key: 'trust_score',           label: '신뢰' },
];

function calcSubPurityScore(sub, type) {
  if (!sub) return 0;
  const comment = (sub.comment || sub.key_comment || '').trim();
  let score = 15;
  // 코멘트 길이 (최대 45 — 단계적)
  score += comment.length >= 100 ? 45 : comment.length >= 50 ? 30 : comment.length >= 20 ? 15 : comment.length >= 5 ? 6 : 0;
  // 코멘트 내 구체적 키워드 (최대 20)
  const specKw = comment.match(/가격|비용|디자인|메시지|CTA|전환|클릭|레이아웃|색상|브랜드|기능|혜택|경쟁사|수치|ROI/gi) || [];
  score += Math.min(specKw.length * 4, 20);
  // 지표 충실도 (최대 20 — 항목 제출 여부)
  if (type === 'preference') {
    if (sub.preference)       score += 7;
    if (sub.message_clarity)  score += 7;
    if (sub.purchase_intent)  score += 6;
  } else if (type === 'pricing') {
    if (sub.would_buy !== null && sub.would_buy !== undefined) score += 7;
    if (sub.price_fairness)   score += 7;
    if (sub.value_perception) score += 6;
  } else if (type === 'email') {
    if (sub.would_reply !== null && sub.would_reply !== undefined) score += 6;
    if (sub.hook_score)       score += 5;
    if (sub.clarity_score)    score += 4;
    if (sub.open_intent)      score += 3;
    if (sub.curiosity_score)  score += 2;
  }
  return Math.min(100, score);
}

function calcPurityScore(fb) {
  const all = [fb.strengths || '', fb.weaknesses || '', fb.suggestions || ''].join(' ');
  const base     = 20;
  const length   = Math.min(all.length / 8, 20);
  const isImgMission = (fb.missions?.image_urls?.length || 0) > 0;
  const sectionFill = isImgMission
    ? (() => {
        const dimSet = new Set();
        (fb.suggestions || '').split('\n').forEach(line => {
          const m = line.match(/^\[(.+?) \/ \d+점\]/);
          if (m) dimSet.add(m[1]);
        });
        return dimSet.size;
      })()
    : (fb.suggestions || '').split('\n\n').filter(sec => {
        const body = sec.replace(/^\[.+?\]\n?/, '').trim();
        return body.length >= 10;
      }).length;
  const balance  = sectionFill >= 4 ? 10 : sectionFill >= 2 ? 4 : 0;
  const specKw   = all.match(/\d+|%|CTA|클릭|전환|스크롤|이탈|헤드라인|카피|CTR|CVR|ROAS|노출|세션|바운스|히트맵|UX|UI|fold|above|below/gi) || [];
  const specific = Math.min(specKw.length * 4, 25);
  const actKw    = all.match(/추천|바꿔|교체|추가|필요|개선|수정|변경|강화|재배치|삭제|줄여|늘려|이동|배치|고려|적용|테스트|실험|보완/gi) || [];
  const actionable = Math.min(actKw.length * 5, 25);
  const aiKw     = all.match(/중요합니다|생각됩니다|분석됩니다|판단됩니다|여겨집니다|사료됩니다|향상될 것|효과적일 것|효율적일 것/gi) || [];
  const aiPenalty = Math.max(-30, aiKw.length * -12);
  return Math.max(0, Math.min(100, Math.round(base + length + balance + specific + actionable + aiPenalty)));
}

function parseSubDesc(desc, type) {
  if (!desc) return {};
  try {
    const p = JSON.parse(desc);
    if (type === 'preference') return p;
    if (p && typeof p === 'object' && 'content' in p) return p;
    return { content: desc, productDescription: '', customQuestions: [] };
  } catch {
    return { content: desc || '', productDescription: '', customQuestions: [] };
  }
}

function parseLPDesc(desc) {
  const empty = { briefText: '', selectedQuestions: [], product: '', lpUrl: '', focusAreas: [], industry: '' };
  if (!desc) return empty;
  try {
    const p = JSON.parse(desc);
    if (p && typeof p === 'object') return {
      briefText:         p.briefText         || '',
      selectedQuestions: p.selectedQuestions  || [],
      product:           p.product            || '',
      lpUrl:             p.lpUrl              || '',
      focusAreas:        Array.isArray(p.focusAreas) ? p.focusAreas : [],
      industry:          p.industry           || '',
    };
    return { ...empty, briefText: desc };
  } catch { return { ...empty, briefText: desc }; }
}

function getSkippedLabels(suggestions = '') {
  const skipped = new Set();
  (suggestions || '').split('\n').forEach(line => {
    const m = line.match(/^\[(.+?) - 해당 없음\]$/);
    if (m) skipped.add(m[1]);
  });
  return skipped;
}

const PAGE_SIZE = 5;

function Pagination({ page, total, onPage }) {
  const totalPages = Math.ceil(total / PAGE_SIZE);
  if (totalPages <= 1) return null;

  const WINDOW = 5;
  const base = { padding: '4px 9px', borderRadius: 5, fontSize: 12, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-2)', cursor: 'pointer' };

  let winStart = Math.max(1, page - Math.floor(WINDOW / 2));
  let winEnd   = Math.min(totalPages, winStart + WINDOW - 1);
  if (winEnd - winStart < WINDOW - 1) winStart = Math.max(1, winEnd - WINDOW + 1);
  const pageNums = Array.from({ length: winEnd - winStart + 1 }, (_, i) => winStart + i);

  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginTop: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
      {totalPages > WINDOW && (
        <button onClick={() => onPage(Math.max(1, page - WINDOW))} disabled={page <= WINDOW}
          style={{ ...base, opacity: page <= WINDOW ? 0.4 : 1, cursor: page <= WINDOW ? 'not-allowed' : 'pointer' }}>«</button>
      )}
      <button onClick={() => onPage(page - 1)} disabled={page === 1}
        style={{ ...base, opacity: page === 1 ? 0.4 : 1, cursor: page === 1 ? 'not-allowed' : 'pointer' }}>이전</button>
      {winStart > 1 && <span style={{ fontSize: 12, color: 'var(--text-3)', padding: '0 2px' }}>…</span>}
      {pageNums.map(n => (
        <button key={n} onClick={() => onPage(n)} style={{
          ...base,
          background: page === n ? 'var(--accent)' : 'var(--surface)',
          color: page === n ? '#fff' : 'var(--text-2)',
          borderColor: page === n ? 'var(--accent)' : 'var(--border)',
          fontWeight: page === n ? 700 : 400,
        }}>{n}</button>
      ))}
      {winEnd < totalPages && <span style={{ fontSize: 12, color: 'var(--text-3)', padding: '0 2px' }}>…</span>}
      <button onClick={() => onPage(page + 1)} disabled={page === totalPages}
        style={{ ...base, opacity: page === totalPages ? 0.4 : 1, cursor: page === totalPages ? 'not-allowed' : 'pointer' }}>다음</button>
      {totalPages > WINDOW && (
        <button onClick={() => onPage(Math.min(totalPages, page + WINDOW))} disabled={page > totalPages - WINDOW}
          style={{ ...base, opacity: page > totalPages - WINDOW ? 0.4 : 1, cursor: page > totalPages - WINDOW ? 'not-allowed' : 'pointer' }}>»</button>
      )}
    </div>
  );
}

export default function PurityFilter() {
  const location = useLocation();
  const [feedbacks, setFeedbacks]         = useState([]);
  const [selected, setSelected]           = useState(null);
  const [loading, setLoading]             = useState(true);
  const [highlightId, setHighlightId]     = useState(null);
  const [acting, setActing]               = useState(false);
  const [confirmApproveId, setConfirmApproveId] = useState(null);
  const [confirmRejectId, setConfirmRejectId] = useState(null);
  const [confirmResetId, setConfirmResetId]   = useState(null);
  const [resetError, setResetError]           = useState('');
  const [confirmBulkApprove, setConfirmBulkApprove] = useState(false);
  const [confirmBulkReject, setConfirmBulkReject]   = useState(false);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [deleteError, setDeleteError]             = useState('');
  const [bulkActing, setBulkActing]       = useState(false);
  const [filter, setFilter]               = useState('pending');
  const [pendingSubFilter, setPendingSubFilter] = useState('all'); // 'all'|'above65'|'below65'
  const [checkedIds, setCheckedIds]       = useState(new Set());
  const [typeFilter, setTypeFilter]       = useState('all'); // 'all'|'main'|'sub'
  const [listPage, setListPage]           = useState(1);
  const [annotations, setAnnotations]     = useState([]);
  const [adminImageIdx, setAdminImageIdx] = useState(0);
  const [subResponse, setSubResponse]     = useState(null);
  const [subLoading, setSubLoading]       = useState(false);
  const [subResponseMap, setSubResponseMap] = useState({});
  const [statusError, setStatusError]     = useState('');
  const [searchQuery, setSearchQuery]     = useState('');
  const [panelQuery, setPanelQuery]       = useState('');
  const [rejectNote, setRejectNote]       = useState('');

  useEffect(() => {
    const pendingDeeplink = location.state?.feedbackId;
    async function load() {
      try {
      // 검토 대기(pending) 탭을 기본으로 로드. 승인/반려는 최근 300건으로 제한해 초기 로딩 부하 감소.
      // panels에 notif_prefs 포함 — 일괄 승인/반려 알림 시 수신 설정 필터에 사용
      const [pendingRes, approvedRes, rejectedRes] = await Promise.all([
        supabase.from('feedbacks')
          .select('*, missions(title, type, image_urls, description, company_id, companies(user_id)), panels(user_id, name, honor_points, experience, notif_prefs)')
          .eq('status', 'submitted').eq('purity_passed', false)
          .order('created_at', { ascending: true }),
        supabase.from('feedbacks')
          .select('*, missions(title, type, image_urls, description, company_id, companies(user_id)), panels(user_id, name, honor_points, experience, notif_prefs)')
          .eq('purity_passed', true).neq('status', 'draft')
          .order('created_at', { ascending: false }).limit(300),
        supabase.from('feedbacks')
          .select('*, missions(title, type, image_urls, description, company_id, companies(user_id)), panels(user_id, name, honor_points, experience, notif_prefs)')
          .eq('status', 'rejected').eq('purity_passed', false)
          .order('created_at', { ascending: false }).limit(300),
      ]);
      const fbs = [
        ...(pendingRes.data  || []),
        ...(approvedRes.data || []),
        ...(rejectedRes.data || []),
      ];
      setFeedbacks(fbs);
      if (!pendingDeeplink && fbs.length > 0) setSelected(fbs[0].id);
      setLoading(false);

      // 서브 미션 응답 전체 사전 로드 → 목록 점수 즉시 표시
      const prefIds  = [...new Set(fbs.filter(f => f.missions?.type === 'preference').map(f => f.mission_id))];
      const priceIds = [...new Set(fbs.filter(f => f.missions?.type === 'pricing').map(f => f.mission_id))];
      const emailIds = [...new Set(fbs.filter(f => f.missions?.type === 'email').map(f => f.mission_id))];
      const [prefR, priceR, emailR] = await Promise.all([
        prefIds.length  ? supabase.from('preference_responses').select('*').in('mission_id', prefIds)  : { data: [] },
        priceIds.length ? supabase.from('pricing_responses').select('*').in('mission_id', priceIds)    : { data: [] },
        emailIds.length ? supabase.from('email_responses').select('*').in('mission_id', emailIds)      : { data: [] },
      ]);
      const allResps = [...(prefR.data || []), ...(priceR.data || []), ...(emailR.data || [])];
      const map = {};
      fbs.forEach(f => {
        if (!['preference', 'pricing', 'email'].includes(f.missions?.type)) return;
        const resp = allResps.find(r => r.mission_id === f.mission_id && r.panel_id === f.panel_id);
        if (resp) map[f.id] = resp;
      });
      setSubResponseMap(map);
      } catch (err) {
        console.error('[PurityFilter load]', err);
        setLoading(false);
      }
    }
    load();
  }, []);

  useEffect(() => {
    if (loading) return;
    const targetId = location.state?.feedbackId;
    if (!targetId) return;
    const target = feedbacks.find(f => f.id === targetId);
    if (!target) return;

    const tf = target.purity_passed ? 'approved'
      : target.status === 'rejected' ? 'rejected'
      : 'pending';
    setFilter(tf);
    setPendingSubFilter('all');
    setTypeFilter('all');
    setSearchQuery('');
    setPanelQuery('');

    const base =
      tf === 'approved' ? feedbacks.filter(f => f.purity_passed)
      : tf === 'rejected' ? feedbacks.filter(f => f.status === 'rejected' && !f.purity_passed)
      : feedbacks.filter(f => !f.purity_passed && f.status === 'submitted');
    const idx = base.findIndex(f => f.id === targetId);
    if (idx !== -1) setListPage(Math.floor(idx / PAGE_SIZE) + 1);

    setSelected(targetId);
    setHighlightId(targetId);
    window.history.replaceState({}, '', location.pathname);
    const t = setTimeout(() => setHighlightId(null), 3000);
    return () => clearTimeout(t);
  }, [loading, location.state?.feedbackId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selected) { setAnnotations([]); setSubResponse(null); return; }
    const fb = feedbacks.find(f => f.id === selected);
    if (!fb) { setAnnotations([]); setSubResponse(null); return; }
    const mType = fb.missions?.type;
    if (['preference', 'pricing', 'email'].includes(mType)) {
      setAnnotations([]);
      setSubResponse(null);
      setSubLoading(true);
      const table = mType === 'preference' ? 'preference_responses'
        : mType === 'pricing' ? 'pricing_responses' : 'email_responses';
      supabase.from(table).select('*')
        .eq('mission_id', fb.mission_id)
        .eq('panel_id', fb.panel_id)
        .single()
        .then(({ data }) => { setSubResponse(data || null); setSubLoading(false); });
      return;
    }
    setSubResponse(null);
    if (!fb.missions?.image_urls?.length) { setAnnotations([]); return; }
    setAdminImageIdx(0);
    supabase.from('feedback_annotations').select('*')
      .eq('feedback_id', selected).order('created_at')
      .then(({ data }) => setAnnotations(data || []));
  }, [selected, feedbacks]);

  const approve = async (id) => {
    setActing(true); setStatusError('');
    const fb = feedbacks.find(f => f.id === id);
    const isSub = ['preference', 'pricing', 'email'].includes(fb?.missions?.type);
    const baseReward = getPanelReward(fb?.panels?.honor_points || 0, fb?.panels?.experience || '');
    const payoutAmount = isSub ? Math.round(baseReward * (4500 / 8000)) : baseReward;
    const updatePayload = { purity_passed: true, status: 'approved', payout_amount: payoutAmount, rejection_penalty_applied: false };
    const { error } = await supabase.from('feedbacks').update(updatePayload).eq('id', id);
    if (error) { setStatusError('승인 실패: ' + error.message); setActing(false); return; }
    setFeedbacks(fbs => fbs.map(f => f.id === id ? { ...f, ...updatePayload } : f));

    if (fb?.rejection_penalty_applied && fb?.panel_id) {
      supabase.rpc('add_panel_honor_points', { p_panel_id: fb.panel_id, p_delta: 5 }).then(({ error: he }) => { if (he) console.warn('[honor_restore]', he.message); });
    }
    if (fb?.mission_id) supabase.rpc('recalc_mission_consumed', { p_mission_id: fb.mission_id }).then(({ error }) => { if (error) console.warn('[recalc_credits]', error.message); });

    const panelUserId = fb?.panels?.user_id;
    const missionTitle = fb?.missions?.title || '미션';
    if (panelUserId) sendNotification(panelUserId, { type: 'success', icon: '✅', title: '피드백 승인', body: `[${missionTitle}] 피드백이 승인되었습니다. 보상이 곧 지급됩니다.`, actionUrl: '/panel/history', targetRole: 'panel', prefKey: 'feedbackApproved' });

    setSelected(null);
    setActing(false);
    return true;
  };

  const reject = async (id, note = '') => {
    setActing(true); setStatusError('');
    const fb = feedbacks.find(f => f.id === id);
    const isSub = ['preference', 'pricing', 'email'].includes(fb?.missions?.type);
    const hoursOffset = isSub ? 2 : 4;
    const rejectionDeadline = new Date(Date.now() + hoursOffset * 60 * 60 * 1000).toISOString();
    const updatePayload = { purity_passed: false, status: 'rejected', rejection_penalty_applied: true, rejection_deadline: rejectionDeadline };
    if (note.trim()) updatePayload.suggestions = note.trim();
    const { error } = await supabase.from('feedbacks').update(updatePayload).eq('id', id);
    if (error) { setStatusError('반려 실패: ' + error.message); setActing(false); return; }
    const noteUpdate = note.trim() ? { suggestions: note.trim() } : {};
    setFeedbacks(fbs => fbs.map(f => f.id === id ? { ...f, purity_passed: false, status: 'rejected', rejection_penalty_applied: true, rejection_deadline: rejectionDeadline, ...noteUpdate } : f));

    if (fb?.mission_id) {
      const { error: decrErr } = await supabase.rpc('decrement_mission_filled_count', { p_mission_id: fb.mission_id });
      if (decrErr) setStatusError('반려 처리됨. 단, 슬롯 차감 실패: ' + decrErr.message + ' — 미션 슬롯 카운트를 수동으로 확인해 주세요.');
      supabase.rpc('recalc_mission_consumed', { p_mission_id: fb.mission_id }).then(({ error: e }) => { if (e) console.warn('[recalc_credits]', e.message); });
    }
    if (fb?.panel_id) supabase.rpc('add_panel_honor_points', { p_panel_id: fb.panel_id, p_delta: -5 }).then(({ error: e }) => { if (e) console.warn('[honor_penalty]', e.message); });

    const panelUserId = fb?.panels?.user_id;
    const missionTitle = fb?.missions?.title || '미션';
    if (panelUserId) sendNotification(panelUserId, { type: 'warning', icon: '⚠️', title: '피드백 반려', body: `[${missionTitle}] 피드백이 반려되었습니다. ${hoursOffset}시간 내 재제출하면 보상 기회가 유지됩니다.`, actionUrl: '/panel/missions?tab=needsRevision', targetRole: 'panel', prefKey: 'feedbackRejected' });

    setSelected(null);
    setActing(false);
    return true;
  };

  const reset = async (id) => {
    setActing(true); setResetError('');
    const fb = feedbacks.find(f => f.id === id);
    const isRejectReversal = fb?.status === 'rejected';

    // 반려 취소 시: slot 복원을 먼저 — 실패하면 feedbacks 변경 없이 종료 (원자성 보장)
    if (isRejectReversal && fb?.mission_id) {
      const { error: slotErr } = await supabase.rpc('restore_mission_slot', { p_mission_id: fb.mission_id });
      if (slotErr) { setResetError('슬롯 복원 실패: ' + slotErr.message + '\n재시도하거나 수동으로 슬롯을 보정해 주세요.'); setActing(false); return; }
    }

    const { error } = await supabase.from('feedbacks').update({ purity_passed: false, status: 'submitted', rejection_penalty_applied: false }).eq('id', id);
    if (error) { setResetError('취소 실패: ' + error.message); setActing(false); return; }
    setFeedbacks(fbs => fbs.map(f => f.id === id ? { ...f, purity_passed: false, status: 'submitted', rejection_penalty_applied: false } : f));

    if (fb?.mission_id) supabase.rpc('recalc_mission_consumed', { p_mission_id: fb.mission_id }).then(({ error: e }) => { if (e) console.warn('[recalc_credits]', e.message); });

    setConfirmResetId(null);
    setSelected(null);
    setActing(false);
  };

  const adminBulkDeleteFeedbacks = async () => {
    const ids = [...checkedIds];
    setBulkActing(true); setDeleteError('');
    const results = await Promise.all(ids.map(id => supabase.rpc('admin_delete_feedback', { p_feedback_id: id })));
    const failCount = results.filter(r => r.error).length;
    if (failCount > 0) { setDeleteError(`${failCount}건 삭제 실패. 나머지는 정상 삭제되었습니다.`); }
    const succeededIds = ids.filter((id, i) => !results[i].error);
    setFeedbacks(fbs => fbs.filter(f => !succeededIds.includes(f.id)));
    if (succeededIds.includes(selected)) setSelected(null);
    setCheckedIds(new Set());
    setConfirmBulkDelete(false);
    setBulkActing(false);
  };

  const bulkApprove = async () => {
    if (checkedIds.size === 0 || bulkActing) return;
    setBulkActing(true); setStatusError('');
    const ids = [...checkedIds];
    const payoutMap = {};
    ids.forEach(id => {
      const f = feedbacks.find(fb => fb.id === id);
      if (!f) return;
      const isSub = ['preference', 'pricing', 'email'].includes(f.missions?.type);
      const base = getPanelReward(f.panels?.honor_points || 0, f.panels?.experience || '');
      payoutMap[id] = isSub ? Math.round(base * (4500 / 8000)) : base;
    });
    const { error } = await supabase.from('feedbacks')
      .update({ purity_passed: true, status: 'approved', rejection_penalty_applied: false }).in('id', ids);
    if (error) { setStatusError('일괄 승인 실패: ' + error.message); setBulkActing(false); return; }

    // payout_amount: 타입별 금액이 달라 개별 업데이트 필요 — 병렬 처리로 최소화
    await Promise.all(ids.map(id =>
      supabase.from('feedbacks').update({ payout_amount: payoutMap[id] }).eq('id', id)
    ));

    setFeedbacks(fbs => fbs.map(f => ids.includes(f.id) ? { ...f, purity_passed: true, status: 'approved', payout_amount: payoutMap[f.id], rejection_penalty_applied: false } : f));
    const mIds = [...new Set(ids.map(id => feedbacks.find(f => f.id === id)?.mission_id).filter(Boolean))];
    mIds.forEach(mid => supabase.rpc('recalc_mission_consumed', { p_mission_id: mid }).then(({ error: e }) => { if (e) console.warn('[recalc]', e.message); }));

    // HP 복원 (반려 패널 재승인 시)
    ids.forEach(id => {
      const f = feedbacks.find(fb => fb.id === id);
      if (f?.rejection_penalty_applied && f?.panel_id) {
        supabase.rpc('add_panel_honor_points', { p_panel_id: f.panel_id, p_delta: 5 }).then(({ error: he }) => { if (he) console.warn('[bulk_honor_restore]', he.message); });
      }
    });

    // 알림: notif_prefs.feedbackApproved !== false 패널만 배열 INSERT (1회)
    const approvedFbs = ids.map(id => feedbacks.find(fb => fb.id === id)).filter(Boolean);
    const notifRows = approvedFbs
      .filter(f => f.panels?.user_id && f.panels?.notif_prefs?.feedbackApproved !== false)
      .map(f => ({
        user_id: f.panels.user_id,
        type: 'success',
        icon: '✅',
        title: '피드백 승인',
        body: `[${f.missions?.title || '미션'}] 피드백이 승인되었습니다. 보상이 곧 지급됩니다.`,
        action_url: '/panel/history',
        target_role: 'panel',
        read: false,
      }));
    if (notifRows.length > 0) {
      supabase.from('notifications').insert(notifRows).then(({ error: ne }) => { if (ne) console.warn('[bulk_approve_notif]', ne.message); });
    }

    setCheckedIds(new Set()); setBulkActing(false);
    return true;
  };

  const bulkReject = async () => {
    if (checkedIds.size === 0 || bulkActing) return;
    setBulkActing(true); setStatusError('');
    const ids = [...checkedIds];
    const now = Date.now();

    // rejection_deadline: 메인(4h) / 서브(2h) 2개 그룹으로 분리 → 2개 UPDATE로 처리
    const mainDeadline = new Date(now + 4 * 60 * 60 * 1000).toISOString();
    const subDeadline  = new Date(now + 2 * 60 * 60 * 1000).toISOString();
    const subTypes = ['preference', 'pricing', 'email'];
    const mainIds = ids.filter(id => !subTypes.includes(feedbacks.find(fb => fb.id === id)?.missions?.type));
    const subIds  = ids.filter(id =>  subTypes.includes(feedbacks.find(fb => fb.id === id)?.missions?.type));
    const deadlineMap = {};
    mainIds.forEach(id => { deadlineMap[id] = mainDeadline; });
    subIds.forEach(id =>  { deadlineMap[id] = subDeadline;  });

    const { error } = await supabase.from('feedbacks')
      .update({ purity_passed: false, status: 'rejected', rejection_penalty_applied: true }).in('id', ids);
    if (error) { setStatusError('일괄 반려 실패: ' + error.message); setBulkActing(false); return; }

    // rejection_deadline: 2번의 배치 UPDATE (N개 개별 → 2개로 감소)
    const deadlineUpdates = [];
    if (mainIds.length > 0) deadlineUpdates.push(supabase.from('feedbacks').update({ rejection_deadline: mainDeadline }).in('id', mainIds));
    if (subIds.length > 0)  deadlineUpdates.push(supabase.from('feedbacks').update({ rejection_deadline: subDeadline  }).in('id', subIds));
    await Promise.all(deadlineUpdates);

    // filled_count 차감: 미션별로 묶어 RPC 호출 수 최소화
    const missionIdSet = new Set(ids.map(id => feedbacks.find(fb => fb.id === id)?.mission_id).filter(Boolean));
    let slotFailCount = 0;
    await Promise.all([...missionIdSet].map(async mId => {
      const mFbCount = ids.filter(id => feedbacks.find(fb => fb.id === id)?.mission_id === mId).length;
      for (let i = 0; i < mFbCount; i++) {
        const { error: se } = await supabase.rpc('decrement_mission_filled_count', { p_mission_id: mId });
        if (se) { console.warn('[bulk_decrement_slot]', se.message); slotFailCount++; }
      }
    }));
    if (slotFailCount > 0) setStatusError(`일괄 반려 완료. 단, ${slotFailCount}건의 슬롯 차감이 실패했습니다. 해당 미션의 슬롯 카운트를 수동으로 확인해 주세요.`);

    setFeedbacks(fbs => fbs.map(f => ids.includes(f.id) ? { ...f, purity_passed: false, status: 'rejected', rejection_penalty_applied: true, rejection_deadline: deadlineMap[f.id] } : f));
    const mIds = [...missionIdSet];
    mIds.forEach(mid => supabase.rpc('recalc_mission_consumed', { p_mission_id: mid }).then(({ error: e }) => { if (e) console.warn('[recalc]', e.message); }));

    // HP -5 패널티 (병렬)
    ids.forEach(id => {
      const f = feedbacks.find(fb => fb.id === id);
      if (f?.panel_id) supabase.rpc('add_panel_honor_points', { p_panel_id: f.panel_id, p_delta: -5 }).then(({ error: he }) => { if (he) console.warn('[bulkReject honor]', he.message); });
    });

    // 알림: 배열 INSERT 1회
    const rejectedFbs = ids.map(id => feedbacks.find(fb => fb.id === id)).filter(Boolean);
    const notifRows = rejectedFbs
      .filter(f => f.panels?.user_id && f.panels?.notif_prefs?.feedbackRejected !== false)
      .map(f => {
        const isSub = subTypes.includes(f.missions?.type);
        return {
          user_id: f.panels.user_id,
          type: 'warning',
          icon: '⚠️',
          title: '피드백 반려',
          body: `[${f.missions?.title || '미션'}] 피드백이 반려되었습니다. ${isSub ? 2 : 4}시간 내 재제출하면 보상 기회가 유지됩니다.`,
          action_url: '/panel/missions?tab=needsRevision',
          target_role: 'panel',
          read: false,
        };
      });
    if (notifRows.length > 0) {
      supabase.from('notifications').insert(notifRows).then(({ error: ne }) => { if (ne) console.warn('[bulk_reject_notif]', ne.message); });
    }

    setCheckedIds(new Set()); setBulkActing(false);
    return true;
  };

  const toggleCheck = (id) => {
    setCheckedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const getScore = (f) => {
    const isFSub = ['preference', 'pricing', 'email'].includes(f.missions?.type);
    return isFSub ? calcSubPurityScore(subResponseMap[f.id] || null, f.missions?.type) : calcPurityScore(f);
  };
  const filteredBase = filter === 'all' ? feedbacks
    : filter === 'pending' ? feedbacks.filter(f => !f.purity_passed && f.status === 'submitted')
    : filter === 'approved' ? feedbacks.filter(f => f.purity_passed)
    : feedbacks.filter(f => f.status === 'rejected');
  const SUB_TYPES = ['preference', 'pricing', 'email'];
  const applySearchFilters = (arr) => {
    let result = arr;
    const mq = searchQuery.trim().toLowerCase();
    const pq = panelQuery.trim().toLowerCase();
    if (mq) result = result.filter(f => (f.missions?.title || '').toLowerCase().includes(mq));
    if (pq) result = result.filter(f => (f.panels?.name || '').toLowerCase().includes(pq));
    return result;
  };
  // pill 카운트 전용: 상태 필터 + 검색 적용, 타입 필터 미적용
  const filteredBaseBySearch = applySearchFilters(filteredBase);
  const filteredByType = typeFilter === 'all'
    ? filteredBase
    : typeFilter === 'main'
      ? filteredBase.filter(f => !SUB_TYPES.includes(f.missions?.type))
      : filteredBase.filter(f =>  SUB_TYPES.includes(f.missions?.type));
  const filteredBySearch = applySearchFilters(filteredByType);
  const filtered = (filter === 'pending' && pendingSubFilter !== 'all')
    ? filteredBySearch.filter(f => pendingSubFilter === 'above65' ? getScore(f) >= 65 : getScore(f) < 65)
    : filteredBySearch;
  const pagedList = filtered.slice((listPage - 1) * PAGE_SIZE, listPage * PAGE_SIZE);

  const pendingPageIds = pagedList.filter(f => f.status === 'submitted' && !f.purity_passed).map(f => f.id);
  const allPageChecked = pendingPageIds.length > 0 && pendingPageIds.every(id => checkedIds.has(id));
  const toggleAll = () => {
    setCheckedIds(prev => {
      const next = new Set(prev);
      if (allPageChecked) pendingPageIds.forEach(id => next.delete(id));
      else pendingPageIds.forEach(id => next.add(id));
      return next;
    });
  };

  const rejectedPageIds = filter === 'rejected' ? pagedList.map(f => f.id) : [];
  const allRejectedPageChecked = rejectedPageIds.length > 0 && rejectedPageIds.every(id => checkedIds.has(id));
  const toggleAllRejected = () => {
    setCheckedIds(prev => {
      const next = new Set(prev);
      if (allRejectedPageChecked) rejectedPageIds.forEach(id => next.delete(id));
      else rejectedPageIds.forEach(id => next.add(id));
      return next;
    });
  };

  const fb = feedbacks.find(f => f.id === selected);
  const fbSkippedLabels = fb ? getSkippedLabels(fb.suggestions) : new Set();
  const missionType = fb?.missions?.type;
  const isSubMission = ['preference', 'pricing', 'email'].includes(missionType);
  const subDataForScore = fb?.id ? (subResponseMap[fb.id] ?? subResponse) : subResponse;
  const score = fb ? (isSubMission ? calcSubPurityScore(subDataForScore, missionType) : calcPurityScore(fb)) : 0;

  if (loading) return (
    <div style={{ padding: '40px 48px', color: 'var(--text-3)', fontSize: 14 }}>불러오는 중...</div>
  );

  return (
    <div className="page-wrap" style={{ padding: '40px 48px', maxWidth: 1100, animation: 'fadeUp 0.5s ease both' }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 12, fontFamily: 'var(--font-sans)', color: 'var(--text-2)', marginBottom: 8, letterSpacing: '0.1em' }}>PURIT FILTER</div>
        <h1 style={{ fontSize: 28, fontWeight: 800 }}>피드백 품질 검증</h1>
        <p style={{ color: 'var(--text-2)', marginTop: 6, fontSize: 14 }}>AI 생성 여부와 성의 없는 피드백을 자동 감지합니다.</p>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: 'var(--surface)', borderRadius: 'var(--radius)', padding: 4, width: 'fit-content' }}>
        {[['pending', '검토 대기'], ['approved', '승인됨'], ['rejected', '반려됨'], ['all', '전체']].map(([v, l]) => (
          <button key={v} onClick={() => { setFilter(v); setSelected(null); setListPage(1); setCheckedIds(new Set()); setPendingSubFilter('all'); setTypeFilter('all'); setSearchQuery(''); setPanelQuery(''); }} style={{
            padding: '6px 14px', borderRadius: 4, fontSize: 13, fontWeight: 500,
            background: filter === v ? 'var(--bg)' : 'transparent',
            color: filter === v ? 'var(--text)' : 'var(--text-3)',
            border: 'none', transition: 'all 0.15s', cursor: 'pointer',
          }}>{l}</button>
        ))}
      </div>

      {/* 타입 필터 탭 — 메인/서브 구분 */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, alignItems: 'center' }}>
        <span style={{ fontSize: 11, color: 'var(--text-3)', marginRight: 2 }}>타입:</span>
        {[
          ['all',  `전체 (${filteredBaseBySearch.length})`],
          ['main', `메인 (${filteredBaseBySearch.filter(f => !SUB_TYPES.includes(f.missions?.type)).length})`],
          ['sub',  `서브 (${filteredBaseBySearch.filter(f =>  SUB_TYPES.includes(f.missions?.type)).length})`],
        ].map(([v, label]) => (
          <button key={v}
            onClick={() => { setTypeFilter(v); setListPage(1); setCheckedIds(new Set()); setSelected(null); }}
            style={{
              padding: '4px 12px', borderRadius: 99, fontSize: 12, cursor: 'pointer', border: '1px solid',
              background:  typeFilter === v ? 'var(--accent)' : 'transparent',
              color:       typeFilter === v ? '#fff'          : 'var(--text-2)',
              borderColor: typeFilter === v ? 'var(--accent)' : 'var(--border)',
            }}>
            {label}
          </button>
        ))}
      </div>

      {/* 검색 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11, color: 'var(--text-3)' }}>의뢰명:</span>
          <input
            type="text"
            placeholder="의뢰명 검색..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setListPage(1); setSelected(null); setCheckedIds(new Set()); }}
            style={{
              width: 180, padding: '5px 12px', fontSize: 12,
              border: '1px solid var(--border)', borderRadius: 'var(--radius)',
              color: 'var(--text)', background: 'var(--surface)', outline: 'none',
            }}
          />
          {searchQuery && (
            <button
              onClick={() => { setSearchQuery(''); setListPage(1); setSelected(null); setCheckedIds(new Set()); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', fontSize: 14, lineHeight: 1 }}
            >✕</button>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11, color: 'var(--text-3)' }}>패널명:</span>
          <input
            type="text"
            placeholder="패널명 검색..."
            value={panelQuery}
            onChange={(e) => { setPanelQuery(e.target.value); setListPage(1); setSelected(null); setCheckedIds(new Set()); }}
            style={{
              width: 180, padding: '5px 12px', fontSize: 12,
              border: '1px solid var(--border)', borderRadius: 'var(--radius)',
              color: 'var(--text)', background: 'var(--surface)', outline: 'none',
            }}
          />
          {panelQuery && (
            <button
              onClick={() => { setPanelQuery(''); setListPage(1); setSelected(null); setCheckedIds(new Set()); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', fontSize: 14, lineHeight: 1 }}
            >✕</button>
          )}
        </div>
      </div>

      {/* 65점 기준 서브 필터 — 검토 대기 탭에서만 표시 */}
      {filter === 'pending' && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 16, alignItems: 'center' }}>
          <span style={{ fontSize: 11, fontFamily: 'var(--font-sans)', color: 'var(--text-3)', marginRight: 2 }}>점수 기준:</span>
          {[
            ['all', '전체', null],
            ['above65', '65점 이상', filteredBySearch.filter(f => getScore(f) >= 65).length],
            ['below65', '65점 미만', filteredBySearch.filter(f => getScore(f) < 65).length],
          ].map(([v, l, cnt]) => (
            <button key={v} onClick={() => { setPendingSubFilter(v); setListPage(1); setCheckedIds(new Set()); }} style={{
              padding: '4px 12px', borderRadius: 99, fontSize: 12, cursor: 'pointer', border: '1px solid',
              background: pendingSubFilter === v ? 'var(--accent)' : 'transparent',
              color: pendingSubFilter === v ? '#fff' : 'var(--text-2)',
              borderColor: pendingSubFilter === v ? 'var(--accent)' : 'var(--border)',
            }}>
              {l}{cnt !== null ? ` (${cnt})` : ` (${filteredBySearch.length})`}
            </button>
          ))}
        </div>
      )}

      {/* statusError */}
      {statusError && (
        <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius)', color: '#dc2626', fontSize: 13, marginBottom: 16 }}>
          {statusError}
        </div>
      )}

      {feedbacks.length === 0 ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-3)', fontSize: 14, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' }}>
          제출된 피드백이 없습니다.
        </div>
      ) : (
        <div className="purity-layout" style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 20 }}>
          {/* List */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: 11, fontFamily: 'var(--font-sans)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {filter === 'pending' ? '검토 대기' : filter === 'approved' ? '승인됨' : filter === 'rejected' ? '반려됨' : '전체'} ({filtered.length})
              </span>
              {filter === 'pending' && pendingPageIds.length > 0 && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontSize: 11, color: 'var(--text-3)' }}>
                  <input type="checkbox" checked={allPageChecked} onChange={toggleAll}
                    style={{ accentColor: 'var(--accent)', cursor: 'pointer', width: 13, height: 13 }} />
                  전체 선택
                </label>
              )}
              {filter === 'rejected' && rejectedPageIds.length > 0 && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontSize: 11, color: 'var(--text-3)' }}>
                  <input type="checkbox" checked={allRejectedPageChecked} onChange={toggleAllRejected}
                    style={{ accentColor: '#dc2626', cursor: 'pointer', width: 13, height: 13 }} />
                  전체 선택
                </label>
              )}
            </div>

            {/* 일괄 처리 바 */}
            {filter === 'pending' && checkedIds.size > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'var(--accent-dim)', borderRadius: 'var(--radius)', marginBottom: 10, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)', flex: 1 }}>{checkedIds.size}개 선택됨</span>
                <button disabled={bulkActing} onClick={() => setConfirmBulkApprove(true)} style={{ padding: '5px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600, border: 'none', background: '#16a34a', color: '#fff', cursor: bulkActing ? 'not-allowed' : 'pointer', opacity: bulkActing ? 0.6 : 1 }}>
                  {bulkActing ? '처리 중...' : '✓ 일괄 승인'}
                </button>
                <button disabled={bulkActing} onClick={() => setConfirmBulkReject(true)} style={{ padding: '5px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600, border: 'none', background: '#dc2626', color: '#fff', cursor: bulkActing ? 'not-allowed' : 'pointer', opacity: bulkActing ? 0.6 : 1 }}>
                  {bulkActing ? '처리 중...' : '✕ 일괄 반려'}
                </button>
                <button onClick={() => setCheckedIds(new Set())} style={{ padding: '5px 10px', borderRadius: 6, fontSize: 12, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-3)', cursor: 'pointer' }}>
                  선택 해제
                </button>
              </div>
            )}
            {filter === 'rejected' && checkedIds.size > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'rgba(220,38,38,0.07)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 'var(--radius)', marginBottom: 10, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#dc2626', flex: 1 }}>{checkedIds.size}개 선택됨</span>
                <button disabled={bulkActing} onClick={() => { setDeleteError(''); setConfirmBulkDelete(true); }}
                  style={{ padding: '5px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600, border: 'none', background: '#dc2626', color: '#fff', cursor: bulkActing ? 'not-allowed' : 'pointer', opacity: bulkActing ? 0.6 : 1 }}>
                  🗑 삭제 ({checkedIds.size}건)
                </button>
                <button onClick={() => setCheckedIds(new Set())} style={{ padding: '5px 10px', borderRadius: 6, fontSize: 12, border: '1px solid rgba(220,38,38,0.3)', background: 'transparent', color: '#dc2626', cursor: 'pointer' }}>
                  선택 해제
                </button>
              </div>
            )}
            {filtered.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-3)', fontSize: 13, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
                없음
              </div>
            ) : (
              <div>
              {pagedList.map(f => {
                const s = getScore(f);
                const scoreColor = s >= 65 ? '#16a34a' : s >= 45 ? 'var(--accent)' : '#dc2626';
                const isPending = f.status === 'submitted' && !f.purity_passed;
                return (
                  <div key={f.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: 8 }}>
                    {filter === 'pending' && isPending && (
                      <div style={{ paddingTop: 15, flexShrink: 0 }}>
                        <input type="checkbox" checked={checkedIds.has(f.id)} onChange={() => toggleCheck(f.id)}
                          style={{ accentColor: 'var(--accent)', cursor: 'pointer', width: 14, height: 14 }} />
                      </div>
                    )}
                    {filter === 'rejected' && (
                      <div style={{ paddingTop: 15, flexShrink: 0 }}>
                        <input type="checkbox" checked={checkedIds.has(f.id)} onChange={() => toggleCheck(f.id)}
                          style={{ accentColor: '#dc2626', cursor: 'pointer', width: 14, height: 14 }} />
                      </div>
                    )}
                    <div onClick={() => setSelected(f.id)} style={{
                      flex: 1, padding: '14px 16px',
                      background: selected === f.id ? 'var(--accent-dim2)' : 'var(--surface)',
                      borderRadius: 'var(--radius)',
                      border: '1px solid ' + (highlightId === f.id ? '#059669' : selected === f.id ? 'var(--accent)' : checkedIds.has(f.id) ? 'var(--accent-dim)' : 'var(--border)'),
                      boxShadow: highlightId === f.id ? '0 0 0 2px rgba(5,150,105,0.2)' : 'none',
                      cursor: 'pointer', transition: 'all 0.15s',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontWeight: 600, fontSize: 13 }}>{f.panels?.name || '패널'}</span>
                        <span style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 14, color: scoreColor }}>{s}</span>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 8 }}>
                        {f.missions?.title || '의뢰'}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                        <div style={{ flex: 1, height: 3, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                          <div style={{ width: `${s}%`, height: '100%', background: scoreColor, borderRadius: 2 }} />
                        </div>
                        <span style={{ fontSize: 10, fontFamily: 'var(--font-sans)', color: s >= 65 ? '#16a34a' : s >= 45 ? 'var(--accent)' : '#dc2626', fontWeight: 600 }}>
                          {s >= 65 ? '승인 권장' : s >= 45 ? '검토' : '반려 권장'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
              <Pagination page={listPage} total={filtered.length} onPage={setListPage} />
              </div>
            )}
          </div>

          {/* Detail */}
          {fb && (
            <div>
              <Card style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 32 }}>
                <div style={{ textAlign: 'center', flexShrink: 0 }}>
                  <div style={{ fontSize: 11, fontFamily: 'var(--font-sans)', color: 'var(--text-3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Purit Score</div>
                  <div style={{ fontSize: 56, fontWeight: 800, fontFamily: 'var(--font-sans)', lineHeight: 1, color: score >= 65 ? '#16a34a' : score >= 45 ? 'var(--accent)' : '#dc2626' }}>
                    {score}
                  </div>
                  <Badge type={score >= 65 ? 'green' : score >= 45 ? 'gold' : 'red'} style={{ marginTop: 8 }}>
                    {score >= 65 ? '통과 권장' : score >= 45 ? '검토 필요' : '반려 권장'}
                  </Badge>
                </div>
                <div style={{ flex: 1 }}>
                  {isSubMission ? (
                    // 서브 미션 점수 분해 (calcSubPurityScore와 동일 공식)
                    (() => {
                      const cmt = (subDataForScore?.comment || subDataForScore?.key_comment || '').trim();
                      const cLen = cmt.length >= 100 ? 45 : cmt.length >= 50 ? 30 : cmt.length >= 20 ? 15 : cmt.length >= 5 ? 6 : 0;
                      const specKw = cmt.match(/가격|비용|디자인|메시지|CTA|전환|클릭|레이아웃|색상|브랜드|기능|혜택|경쟁사|수치|ROI/gi) || [];
                      const kwScore = Math.min(specKw.length * 4, 20);
                      const metricScore = missionType === 'preference'
                        ? (subDataForScore?.preference ? 7 : 0) + (subDataForScore?.message_clarity ? 7 : 0) + (subDataForScore?.purchase_intent ? 6 : 0)
                        : missionType === 'pricing'
                        ? (subDataForScore?.would_buy != null ? 7 : 0) + (subDataForScore?.price_fairness ? 7 : 0) + (subDataForScore?.value_perception ? 6 : 0)
                        : (subDataForScore?.would_reply != null ? 6 : 0) + (subDataForScore?.hook_score ? 5 : 0) + (subDataForScore?.clarity_score ? 4 : 0) + (subDataForScore?.open_intent ? 3 : 0) + (subDataForScore?.curiosity_score ? 2 : 0);
                      return [
                        { label: '기본 점수',     val: 15,       max: 15 },
                        { label: '코멘트 길이',   val: cLen,     max: 45 },
                        { label: '코멘트 구체성', val: kwScore,  max: 20 },
                        { label: '지표 충실도',   val: Math.min(metricScore, 20), max: 20 },
                      ];
                    })().map(b => (
                      <div key={b.label} style={{ marginBottom: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-3)', marginBottom: 4, fontFamily: 'var(--font-sans)' }}>
                          <span>{b.label}</span><span>{Math.round(b.val)}/{b.max}</span>
                        </div>
                        <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                          <div style={{ width: `${b.max > 0 ? (b.val/b.max)*100 : 0}%`, height: '100%', background: 'var(--accent)', borderRadius: 2 }} />
                        </div>
                      </div>
                    ))
                  ) : (
                    // LP 피드백 점수 분해 (calcPurityScore와 동일 공식)
                    (() => {
                      const all = [fb.strengths||'', fb.weaknesses||'', fb.suggestions||''].join(' ');
                      const isImgMission = (fb.missions?.image_urls?.length || 0) > 0;
                      const sectionFill = isImgMission
                        ? (() => {
                            const dimSet = new Set();
                            (fb.suggestions||'').split('\n').forEach(line => {
                              const m = line.match(/^\[(.+?) \/ \d+점\]/);
                              if (m) dimSet.add(m[1]);
                            });
                            return dimSet.size;
                          })()
                        : (fb.suggestions||'').split('\n\n').filter(sec => {
                            const body = sec.replace(/^\[.+?\]\n?/, '').trim();
                            return body.length >= 10;
                          }).length;
                      const specKw = all.match(/\d+|%|CTA|클릭|전환|스크롤|이탈|헤드라인|카피|CTR|CVR|ROAS|노출|세션|바운스|히트맵|UX|UI|fold|above|below/gi) || [];
                      const actKw  = all.match(/추천|바꿔|교체|추가|필요|개선|수정|변경|강화|재배치|삭제|줄여|늘려|이동|배치|고려|적용|테스트|실험|보완/gi) || [];
                      const aiKw   = all.match(/중요합니다|생각됩니다|분석됩니다|판단됩니다|여겨집니다|사료됩니다|향상될 것|효과적일 것|효율적일 것/gi) || [];
                      return [
                        { label: '기본 점수',   val: 20, max: 20 },
                        { label: '텍스트 길이', val: Math.min(all.length / 8, 20), max: 20 },
                        { label: '섹션 균형',   val: sectionFill >= 4 ? 10 : sectionFill >= 2 ? 4 : 0, max: 10 },
                        { label: '구체성 지수', val: Math.min(specKw.length * 4, 25), max: 25 },
                        { label: '실행 가능성', val: Math.min(actKw.length * 5, 25), max: 25 },
                        { label: 'AI 패턴 패널티', val: Math.max(-30, aiKw.length * -12), max: 0, negative: true },
                      ];
                    })().map(b => (
                      <div key={b.label} style={{ marginBottom: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-3)', marginBottom: 4, fontFamily: 'var(--font-sans)' }}>
                          <span>{b.label}</span>
                          <span style={{ color: b.negative && b.val < 0 ? '#dc2626' : 'var(--text-3)' }}>
                            {b.negative ? (b.val < 0 ? b.val : '—') : `${Math.round(b.val)}/${b.max}`}
                          </span>
                        </div>
                        {!b.negative ? (
                          <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                            <div style={{ width: `${b.max > 0 ? (b.val/b.max)*100 : 0}%`, height: '100%', background: 'var(--accent)', borderRadius: 2 }} />
                          </div>
                        ) : (
                          <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                            <div style={{ width: `${Math.abs(b.val)/30*100}%`, height: '100%', background: '#dc2626', borderRadius: 2 }} />
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </Card>

              <Card>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>
                    {isSubMission ? (
                      missionType === 'preference' ? '소재 비교 응답' :
                      missionType === 'pricing' ? '가격 검증 응답' : '이메일 검증 응답'
                    ) : '피드백 원문'}
                  </div>
                  <Badge type={fb.purity_passed ? 'green' : fb.status === 'rejected' ? 'red' : 'gold'}>
                    {fb.purity_passed ? '승인됨' : fb.status === 'rejected' ? '반려됨' : '대기'}
                  </Badge>
                </div>

                {/* ── 서브 미션 응답 ── */}
                {isSubMission && (
                  <div>
                    {(subLoading && !subDataForScore) ? (
                      <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>응답 데이터 로드 중...</div>
                    ) : !subDataForScore ? (
                      <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>응답 데이터가 없습니다.</div>
                    ) : (
                      <>
                        {/* 소재 비교 */}
                        {missionType === 'preference' && (() => {
                          const d = parseSubDesc(fb.missions?.description, 'preference');
                          const varA = d.variantA || '';
                          const varB = d.variantB || '';
                          const customQs = Array.isArray(d.customQuestions) ? d.customQuestions.filter(Boolean) : [];
                          return (
                            <div>
                              {d.productDescription && (
                                <div style={{ padding: '10px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', marginBottom: 12, fontSize: 12, color: 'var(--text-2)', lineHeight: 1.5 }}>
                                  <div style={{ fontSize: 10, fontFamily: 'var(--font-sans)', color: 'var(--text-3)', marginBottom: 4 }}>제품 설명</div>
                                  {d.productDescription}
                                </div>
                              )}
                              {(varA || varB || d.variantAImage || d.variantBImage) && (
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                                  {[['A', varA, d.variantAImage], ['B', varB, d.variantBImage]].map(([label, text, imgUrl]) => (
                                    <div key={label} style={{
                                      padding: '12px', borderRadius: 'var(--radius)',
                                      border: `2px solid ${subDataForScore.preference === label ? 'var(--accent)' : 'var(--border)'}`,
                                      background: subDataForScore.preference === label ? 'rgba(99,102,241,0.06)' : 'var(--surface)',
                                    }}>
                                      <div style={{ fontSize: 10, fontFamily: 'var(--font-sans)', color: 'var(--text-3)', marginBottom: 6 }}>소재 {label}{subDataForScore.preference === label ? ' ★ 선택됨' : ''}</div>
                                      {imgUrl && <img src={imgUrl} alt={`소재 ${label}`} style={{ width: '100%', borderRadius: 4, marginBottom: 8, objectFit: 'cover', maxHeight: 120 }} />}
                                      <div style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.5, wordBreak: 'break-all' }}>{text || '—'}</div>
                                    </div>
                                  ))}
                                </div>
                              )}
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
                                {[
                                  { label: '선택', value: subDataForScore.preference ? `소재 ${subDataForScore.preference}` : '—' },
                                  { label: '메시지 명확성', value: subDataForScore.message_clarity ? `${subDataForScore.message_clarity}/5` : '—' },
                                  { label: '구매 의향', value: subDataForScore.purchase_intent ? `${subDataForScore.purchase_intent}/5` : '—' },
                                ].map(({ label, value }) => (
                                  <div key={label} style={{ padding: '10px 8px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', textAlign: 'center' }}>
                                    <div style={{ fontSize: 10, fontFamily: 'var(--font-sans)', color: 'var(--text-3)', marginBottom: 4 }}>{label}</div>
                                    <div style={{ fontSize: 15, fontWeight: 800, fontFamily: 'var(--font-sans)', color: 'var(--text)' }}>{value}</div>
                                  </div>
                                ))}
                              </div>
                              {customQs.length > 0 && (
                                <div style={{ padding: '10px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', marginBottom: 14 }}>
                                  <div style={{ fontSize: 10, fontFamily: 'var(--font-sans)', color: 'var(--text-3)', marginBottom: 6 }}>추가 질문</div>
                                  {customQs.map((q, i) => <div key={i} style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.5, marginBottom: 2 }}>{i + 1}. {q}</div>)}
                                </div>
                              )}
                            </div>
                          );
                        })()}

                        {/* 가격 검증 */}
                        {missionType === 'pricing' && (() => {
                          const pd = parseSubDesc(fb.missions?.description, 'pricing');
                          const customQs = Array.isArray(pd.customQuestions) ? pd.customQuestions.filter(Boolean) : [];
                          return (
                            <div>
                              {(pd.content || pd.image) && (
                                <div style={{ padding: '12px 14px', background: 'var(--surface)', borderRadius: 'var(--radius)', marginBottom: 12, fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6 }}>
                                  <div style={{ fontSize: 10, fontFamily: 'var(--font-sans)', color: 'var(--text-3)', marginBottom: 6 }}>가격 페이지 설명</div>
                                  {pd.image && <img src={pd.image} alt="가격 페이지" style={{ width: '100%', borderRadius: 4, marginBottom: 8, objectFit: 'cover', maxHeight: 160 }} />}
                                  {pd.content && <div style={{ whiteSpace: 'pre-wrap' }}>{pd.content}</div>}
                                </div>
                              )}
                              {pd.productDescription && (
                                <div style={{ padding: '10px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', marginBottom: 12, fontSize: 12, color: 'var(--text-2)' }}>
                                  <div style={{ fontSize: 10, fontFamily: 'var(--font-sans)', color: 'var(--text-3)', marginBottom: 4 }}>제품 설명</div>
                                  {pd.productDescription}
                                </div>
                              )}
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
                                {[
                                  { label: '구매 의향', value: subDataForScore.would_buy === true ? 'Yes' : subDataForScore.would_buy === false ? 'No' : '—' },
                                  { label: '가격 공정성', value: subDataForScore.price_fairness ? `${subDataForScore.price_fairness}/5` : '—' },
                                  { label: '가치 인식', value: subDataForScore.value_perception ? `${subDataForScore.value_perception}/5` : '—' },
                                ].map(({ label, value }) => (
                                  <div key={label} style={{ padding: '10px 8px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', textAlign: 'center' }}>
                                    <div style={{ fontSize: 10, fontFamily: 'var(--font-sans)', color: 'var(--text-3)', marginBottom: 4 }}>{label}</div>
                                    <div style={{ fontSize: 15, fontWeight: 800, fontFamily: 'var(--font-sans)', color: 'var(--text)' }}>{value}</div>
                                  </div>
                                ))}
                              </div>
                              {customQs.length > 0 && (
                                <div style={{ padding: '10px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', marginBottom: 14 }}>
                                  <div style={{ fontSize: 10, fontFamily: 'var(--font-sans)', color: 'var(--text-3)', marginBottom: 6 }}>추가 질문</div>
                                  {customQs.map((q, i) => <div key={i} style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.5, marginBottom: 2 }}>{i + 1}. {q}</div>)}
                                </div>
                              )}
                            </div>
                          );
                        })()}

                        {/* 이메일 검증 */}
                        {missionType === 'email' && (() => {
                          const pd = parseSubDesc(fb.missions?.description, 'email');
                          const emailContent = pd.content || fb.missions?.description || '';
                          const customQs = Array.isArray(pd.customQuestions) ? pd.customQuestions.filter(Boolean) : [];
                          return (
                            <div>
                              {emailContent && (
                                <div style={{ padding: '12px 14px', background: 'var(--surface)', borderRadius: 'var(--radius)', marginBottom: 12, fontSize: 12, color: 'var(--text-2)', lineHeight: 1.7, maxHeight: 120, overflowY: 'auto', fontFamily: 'var(--font-sans)' }}>
                                  <div style={{ fontSize: 10, color: 'var(--text-3)', marginBottom: 6, fontFamily: 'sans-serif' }}>이메일 원문</div>
                                  {emailContent}
                                </div>
                              )}
                              {pd.productDescription && (
                                <div style={{ padding: '10px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', marginBottom: 12, fontSize: 12, color: 'var(--text-2)' }}>
                                  <div style={{ fontSize: 10, fontFamily: 'var(--font-sans)', color: 'var(--text-3)', marginBottom: 4 }}>제품 설명</div>
                                  {pd.productDescription}
                                </div>
                              )}
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 12 }}>
                                {[
                                  { label: '답장 의향', value: subDataForScore.would_reply === true ? 'Yes' : subDataForScore.would_reply === false ? 'No' : '—' },
                                  { label: '후킹력', value: subDataForScore.hook_score ? `${subDataForScore.hook_score}/5` : '—' },
                                  { label: '명확성', value: subDataForScore.clarity_score ? `${subDataForScore.clarity_score}/5` : '—' },
                                  { label: '개봉 의향', value: subDataForScore.open_intent ? `${subDataForScore.open_intent}/5` : '—' },
                                  { label: '호기심', value: subDataForScore.curiosity_score ? `${subDataForScore.curiosity_score}/5` : '—' },
                                ].map(({ label, value }) => (
                                  <div key={label} style={{ padding: '10px 8px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', textAlign: 'center' }}>
                                    <div style={{ fontSize: 10, fontFamily: 'var(--font-sans)', color: 'var(--text-3)', marginBottom: 4 }}>{label}</div>
                                    <div style={{ fontSize: 15, fontWeight: 800, fontFamily: 'var(--font-sans)', color: 'var(--text)' }}>{value}</div>
                                  </div>
                                ))}
                              </div>
                              {customQs.length > 0 && (
                                <div style={{ padding: '10px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', marginBottom: 14 }}>
                                  <div style={{ fontSize: 10, fontFamily: 'var(--font-sans)', color: 'var(--text-3)', marginBottom: 6 }}>추가 질문</div>
                                  {customQs.map((q, i) => <div key={i} style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.5, marginBottom: 2 }}>{i + 1}. {q}</div>)}
                                </div>
                              )}
                            </div>
                          );
                        })()}

                        {/* Comment (공통) */}
                        {(subDataForScore.comment || subDataForScore.key_comment) && (
                          <div style={{ padding: '14px', background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', marginBottom: 8 }}>
                            <div style={{ fontSize: 11, fontFamily: 'var(--font-sans)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>코멘트</div>
                            <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.7, whiteSpace: 'pre-line' }}>
                              {subDataForScore.comment || subDataForScore.key_comment}
                            </p>
                          </div>
                        )}
                        {/* 추가 질문 응답 (custom_answers) */}
                        {Array.isArray(subDataForScore?.custom_answers) && subDataForScore.custom_answers.length > 0 && (
                          <div style={{ marginTop: 8, padding: '12px 14px', background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                            <div style={{ fontSize: 11, fontFamily: 'var(--font-sans)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>추가 질문 응답</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                              {subDataForScore.custom_answers.map((a, i) => (
                                <div key={a.questionId || i}>
                                  <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 3, lineHeight: 1.4 }}>{i + 1}. {a.questionText || a.questionId}</div>
                                  <div style={{ fontSize: 13, color: 'var(--text-2)', padding: '6px 10px', background: 'var(--surface)', borderRadius: 6, border: '1px solid var(--border)', lineHeight: 1.6 }}>
                                    {a.answer !== undefined && a.answer !== null && String(a.answer) !== '' ? String(a.answer) : <span style={{ fontStyle: 'italic', color: 'var(--text-3)' }}>응답 없음</span>}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* ── 기존 랜딩페이지 피드백 ── */}
                {!isSubMission && (
                  <>
                    {/* LP 미션 정보 */}
                    {(() => {
                      const { briefText, product, lpUrl, focusAreas, industry } = parseLPDesc(fb.missions?.description);
                      const hasAnyInfo = briefText || product || lpUrl || focusAreas.length > 0 || industry;
                      if (!hasAnyInfo) return null;
                      return (
                        <div style={{ padding: '10px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', marginBottom: 12, fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6 }}>
                          <div style={{ fontSize: 10, fontFamily: 'var(--font-sans)', color: 'var(--text-3)', marginBottom: 8 }}>미션 정보</div>
                          {product && (
                            <div style={{ marginBottom: 4 }}>
                              <span style={{ color: 'var(--text-3)', fontSize: 11 }}>제품명: </span>{product}
                            </div>
                          )}
                          {industry && (
                            <div style={{ marginBottom: 4 }}>
                              <span style={{ color: 'var(--text-3)', fontSize: 11 }}>업종: </span>{industry}
                            </div>
                          )}
                          {lpUrl && (
                            <div style={{ marginBottom: 4 }}>
                              <span style={{ color: 'var(--text-3)', fontSize: 11 }}>LP URL: </span>
                              <a href={lpUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'underline', wordBreak: 'break-all' }}>{lpUrl}</a>
                            </div>
                          )}
                          {focusAreas.length > 0 && (
                            <div style={{ marginBottom: 4, display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
                              <span style={{ color: 'var(--text-3)', fontSize: 11 }}>집중 영역: </span>
                              {focusAreas.map((fa, i) => (
                                <span key={i} style={{ fontSize: 11, padding: '1px 7px', background: 'var(--accent-dim)', color: 'var(--accent)', borderRadius: 99 }}>{fa}</span>
                              ))}
                            </div>
                          )}
                          {briefText && (
                            <div style={{ marginTop: 6, borderTop: '1px solid var(--border)', paddingTop: 6 }}>
                              <span style={{ color: 'var(--text-3)', fontSize: 11 }}>브리핑: </span>{briefText}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                    {/* 이미지 + 어노테이션 오버레이 */}
                    {fb.missions?.image_urls?.length > 0 && (
                      <div style={{ marginBottom: 20 }}>
                        {fb.missions.image_urls.length > 1 && (
                          <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                            {fb.missions.image_urls.map((_, i) => (
                              <button key={i} onClick={() => setAdminImageIdx(i)} style={{
                                padding: '4px 12px', borderRadius: 'var(--radius)', fontSize: 12, fontWeight: 600,
                                cursor: 'pointer', border: '1.5px solid',
                                borderColor: adminImageIdx === i ? 'var(--accent)' : 'var(--border)',
                                background: adminImageIdx === i ? 'var(--accent)' : 'var(--surface)',
                                color: adminImageIdx === i ? '#fff' : 'var(--text-2)',
                              }}>
                                이미지 {i + 1}
                                {annotations.filter(a => a.image_index === i).length > 0 && (
                                  <span style={{ marginLeft: 4, background: 'rgba(255,255,255,0.25)', borderRadius: 8, padding: '0 5px', fontSize: 10 }}>
                                    {annotations.filter(a => a.image_index === i).length}
                                  </span>
                                )}
                              </button>
                            ))}
                          </div>
                        )}
                        <div style={{ borderRadius: 'var(--radius)', overflow: 'hidden', border: '1px solid var(--border)' }}>
                          <ImageAnnotator
                            imageUrl={fb.missions.image_urls[adminImageIdx]}
                            imageIndex={adminImageIdx}
                            annotations={annotations.filter(a => a.image_index === adminImageIdx)}
                            onAdd={() => {}}
                            onRemove={() => {}}
                            readonly={true}
                          />
                        </div>
                        {annotations.length > 0 && (
                          <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--font-sans)' }}>
                            총 어노테이션 {annotations.length}개
                          </div>
                        )}
                      </div>
                    )}

                    {/* 5대 지표 점수 */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 16 }}>
                      {DIM.map(({ key, label }) => {
                        const val = fb[key] || 0;
                        const isSkipped = !val && fbSkippedLabels.has(label);
                        return (
                          <div key={key} style={{ padding: '10px 8px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', textAlign: 'center' }}>
                            <div style={{ fontSize: 10, fontFamily: 'var(--font-sans)', color: 'var(--text-3)', marginBottom: 4 }}>{label}</div>
                            {isSkipped ? (
                              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', padding: '3px 0' }}>해당 없음</div>
                            ) : (
                              <div style={{ fontSize: 18, fontWeight: 800, fontFamily: 'var(--font-sans)', color: val >= 4 ? 'var(--green)' : val <= 2 ? 'var(--red)' : 'var(--text-2)' }}>{val}</div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Text content */}
                    {[
                      { label: '강점', content: fb.strengths, color: 'var(--green)' },
                      { label: '약점', content: fb.weaknesses, color: 'var(--red)' },
                      { label: '개선 제안', content: fb.suggestions, color: 'var(--text-3)' },
                    ].filter(s => s.content).map(({ label, content, color }) => (
                      <div key={label} style={{ marginBottom: 12, padding: '14px', background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                        <div style={{ fontSize: 11, fontFamily: 'var(--font-sans)', color, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>{label}</div>
                        <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.7, whiteSpace: 'pre-line' }}>{content}</p>
                      </div>
                    ))}

                    {/* LP 추가 질문 응답 */}
                    {Array.isArray(fb.custom_answers) && fb.custom_answers.length > 0 && (() => {
                      const { selectedQuestions: lpQs } = parseLPDesc(fb.missions?.description);
                      return (
                        <div style={{ marginTop: 12, padding: '12px 14px', background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                          <div style={{ fontSize: 11, fontFamily: 'var(--font-sans)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>추가 질문 응답</div>
                          {fb.custom_answers.map((a, i) => {
                            const qDef = lpQs.find(q => q.id === a.questionId);
                            return (
                              <div key={a.questionId || i} style={{ marginBottom: 10 }}>
                                <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 4 }}>{i + 1}. {a.questionText || qDef?.text}</div>
                                <div style={{ fontSize: 13, padding: '6px 10px', background: 'var(--surface)', borderRadius: 'var(--radius)', color: 'var(--text-2)', lineHeight: 1.6 }}>
                                  {a.answer !== undefined && a.answer !== '' ? String(a.answer) : <em>응답 없음</em>}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </>
                )}

                <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                  {fb.status !== 'approved' && fb.status !== 'rejected' && (
                    <>
                      <Btn size="sm" disabled={acting} onClick={() => setConfirmApproveId(fb.id)}>
                        ✓ 승인
                      </Btn>
                      <Btn size="sm" variant="danger" disabled={acting} onClick={() => setConfirmRejectId(fb.id)}>
                        {acting ? '처리 중...' : '✕ 반려'}
                      </Btn>
                    </>
                  )}
                  {fb.status === 'approved' && (
                    <Btn size="sm" variant="outline" disabled={acting} onClick={() => { setResetError(''); setConfirmResetId(fb.id); }}>
                      승인 취소
                    </Btn>
                  )}
                  {fb.status === 'rejected' && (
                    <Btn size="sm" variant="outline" disabled={acting} onClick={() => { setResetError(''); setConfirmResetId(fb.id); }}>
                      반려 취소
                    </Btn>
                  )}
                </div>
              </Card>
            </div>
          )}
        </div>
      )}

      {confirmBulkApprove && (
        <ConfirmModal
          title={`피드백 일괄 승인 (${checkedIds.size}건)`}
          desc={`선택한 ${checkedIds.size}건을 모두 승인 처리합니까? 패널에게 승인 알림이 발송됩니다.`}
          confirmLabel="✓ 일괄 승인"
          errorMsg={statusError}
          onConfirm={async () => { setStatusError(''); const ok = await bulkApprove(); if (ok) setConfirmBulkApprove(false); }}
          onCancel={() => { setStatusError(''); setConfirmBulkApprove(false); }}
        />
      )}

      {confirmBulkReject && (
        <ConfirmModal
          title={`피드백 일괄 반려 (${checkedIds.size}건)`}
          desc={`선택한 ${checkedIds.size}건을 모두 반려 처리합니까? 패널에게 반려 알림이 발송됩니다.`}
          confirmLabel="✕ 일괄 반려"
          errorMsg={statusError}
          onConfirm={async () => { setStatusError(''); const ok = await bulkReject(); if (ok) setConfirmBulkReject(false); }}
          onCancel={() => { setStatusError(''); setConfirmBulkReject(false); }}
          danger
        />
      )}

      {confirmApproveId && (
        <ConfirmModal
          title="피드백 승인"
          desc="이 피드백을 승인 처리합니까? 패널에게 승인 알림이 발송됩니다."
          confirmLabel="✓ 승인"
          errorMsg={statusError}
          onConfirm={async () => { setStatusError(''); const ok = await approve(confirmApproveId); if (ok) setConfirmApproveId(null); }}
          onCancel={() => { setStatusError(''); setConfirmApproveId(null); }}
        />
      )}

      {confirmRejectId && ReactDOM.createPortal(
        <div onClick={() => { setStatusError(''); setRejectNote(''); setConfirmRejectId(null); }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div onClick={e => e.stopPropagation()} className="confirm-modal-inner" style={{ background: '#fff', borderRadius: 12, padding: '28px 28px 20px', width: 440, maxWidth: '90vw', boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}>
            <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 12 }}>피드백 반려</div>
            <div style={{ fontSize: 14, color: 'var(--text-2)', marginBottom: 16, lineHeight: 1.6 }}>반려 사유를 입력해 주세요. 패널에게 반려 알림과 함께 전달됩니다.</div>
            <textarea
              value={rejectNote}
              onChange={e => setRejectNote(e.target.value)}
              placeholder="예) 피드백이 너무 짧고 구체적인 근거가 없습니다. 각 차원마다 30자 이상의 이유를 작성해 주세요."
              rows={4}
              style={{ width: '100%', boxSizing: 'border-box', borderRadius: 8, border: '1px solid var(--border)', padding: '10px 12px', fontSize: 13, color: 'var(--text)', lineHeight: 1.6, resize: 'vertical', fontFamily: 'var(--font-sans)', outline: 'none' }}
            />
            {statusError && <div style={{ marginTop: 10, fontSize: 12, color: '#ef4444', background: 'rgba(239,68,68,0.07)', borderRadius: 6, padding: '8px 12px' }}>{statusError}</div>}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
              <Btn variant="ghost" onClick={() => { setStatusError(''); setRejectNote(''); setConfirmRejectId(null); }}>취소</Btn>
              <Btn variant="danger" disabled={acting} onClick={async () => { setStatusError(''); const ok = await reject(confirmRejectId, rejectNote); if (ok) { setRejectNote(''); setConfirmRejectId(null); } }}>
                {acting ? '처리 중...' : '✕ 반려'}
              </Btn>
            </div>
          </div>
        </div>,
        document.body
      )}

      {confirmResetId && (
        <ConfirmModal
          title="검토 중으로 되돌리기"
          desc="이 피드백을 검토 중 상태로 되돌립니까? 반려 취소 시 슬롯이 복원됩니다."
          confirmLabel={acting ? '처리 중...' : '확인'}
          errorMsg={resetError}
          onConfirm={() => reset(confirmResetId)}
          onCancel={() => { setResetError(''); setConfirmResetId(null); }}
        />
      )}

      {confirmBulkDelete && (
        <ConfirmModal
          title="피드백 영구 삭제"
          desc={`선택한 ${checkedIds.size}건을 영구 삭제합니까? 재제출 기한이 지난 반려 피드백을 정리할 때 사용하세요. 삭제 후 복구가 불가능합니다.`}
          confirmLabel={bulkActing ? '삭제 중...' : `삭제 (${checkedIds.size}건)`}
          errorMsg={deleteError}
          onConfirm={adminBulkDeleteFeedbacks}
          onCancel={() => { setDeleteError(''); setConfirmBulkDelete(false); }}
          danger
        />
      )}
    </div>
  );
}
