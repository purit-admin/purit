import { useState, useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, Btn, Badge, ConfirmModal, SegmentFilter } from '../../components/ui';
import ImageAnnotator from '../../components/ui/ImageAnnotator';
import { supabase } from '../../lib/supabase';
import { getPanelReward } from '../../lib/honorLevels';
import { resolveAssetType, resolveEmailGoal } from '../../lib/subMissionMeta';


const DIM_LABEL = { clarity: '명확성', relevance: '관련성', value: '가치', differentiation: '차별화', trust: '신뢰' };

function charCountMeta(text) {
  const len = text.trim().length;
  if (len >= 50) return { color: '#16a34a', label: '좋습니다!' };
  if (len >= 30) return { color: '#d97706', label: `조금 더 설명하면 좋아요 (${len}/50)` };
  return { color: '#9ca3af', label: `최소 30자 이상 입력해주세요 (${len}/30)` };
}

const DIM_META = {
  clarity:         { label: '명확성', short: '명', color: '#34C759', bg: 'rgba(52,199,89,0.12)'   },
  relevance:       { label: '관련성', short: '관', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)'  },
  value:           { label: '가치',   short: '가', color: '#6366f1', bg: 'rgba(99,102,241,0.12)'  },
  differentiation: { label: '차별화', short: '차', color: '#ef4444', bg: 'rgba(239,68,68,0.12)'   },
  trust:           { label: '신뢰',   short: '신', color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' },
};

// 제출된 이미지 미션 피드백(feedbacks.suggestions 텍스트 + custom_answers)에서
// 총평·"해당 없음"(skippedDims)·추가질문을 복원값으로 추출 — 재작성 진입 2경로(Path A/B) 공용
function parseImageSubmission(fb) {
  const out = { overallComment: null, skippedDims: null, customAnswers: null };
  if (fb?.suggestions) {
    const overallMatch = fb.suggestions.match(/\[총평\]\n([\s\S]*)$/);
    if (overallMatch) out.overallComment = overallMatch[1].trim();
    const dimMap = { '명확성': 'clarity', '관련성': 'relevance', '가치': 'value', '차별화': 'differentiation', '신뢰': 'trust' };
    const sk = { clarity: false, relevance: false, value: false, differentiation: false, trust: false };
    let anySkip = false;
    fb.suggestions.split('\n').forEach(line => {
      const m = line.match(/^\[(.+?) - 해당 없음\]$/);
      if (m && dimMap[m[1]]) { sk[dimMap[m[1]]] = true; anySkip = true; }
    });
    if (anySkip) out.skippedDims = sk;
  }
  if (Array.isArray(fb?.custom_answers)) out.customAnswers = fb.custom_answers;
  return out;
}

const hasDraftProgress = (fb) => {
  if (fb.clarity_score || fb.relevance_score || fb.value_score || fb.differentiation_score || fb.trust_score) return true;
  if (!fb.strengths) return false;
  try {
    const saved = JSON.parse(fb.strengths);
    if (saved.__subType || saved.__comments || saved.customAnswers?.length) return true;
    return Object.values(saved).some(v => v && typeof v === 'string' && v.trim());
  } catch { return false; }
};


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
  if (!desc) return { briefText: '', selectedQuestions: [] };
  try {
    const p = JSON.parse(desc);
    if (p && typeof p === 'object' && 'briefText' in p)
      return { briefText: p.briefText || '', selectedQuestions: p.selectedQuestions || [] };
    return { briefText: desc, selectedQuestions: [] };
  } catch { return { briefText: desc, selectedQuestions: [] }; }
}

function TypedQuestionsBlock({ qs, get, set }) {
  const TYPE_COLOR_LOCAL = { radio: 'var(--blue)', scale: 'var(--accent)', text: 'var(--green)' };
  const TYPE_LABEL_LOCAL = { radio: '옵션형', scale: '점수형', text: '서술형' };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 4 }}>
      <div style={{ fontSize: 12, fontFamily: 'var(--font-sans)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
        추가 질문 ({qs.length}개)
      </div>
      {qs.map((q, idx) => {
        const ans = get(q.id);
        return (
          <div key={q.id} style={{ padding: '14px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', borderLeft: `3px solid ${TYPE_COLOR_LOCAL[q.type] || 'var(--accent)'}` }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 12 }}>
              <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--text-2)', fontWeight: 700, flexShrink: 0, marginTop: 1 }}>Q{idx + 1}</span>
              <span style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5, flex: 1 }}>{q.text}</span>
              <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: (TYPE_COLOR_LOCAL[q.type] || 'var(--accent)') + '22', color: TYPE_COLOR_LOCAL[q.type] || 'var(--accent)', fontWeight: 600, flexShrink: 0 }}>
                {TYPE_LABEL_LOCAL[q.type] || q.type}
              </span>
            </div>
            {q.type === 'radio' && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {q.options.map(opt => (
                  <button key={opt} onClick={() => set(q.id, q.text, q.type, opt)} style={{
                    padding: '8px 14px', borderRadius: 'var(--radius)',
                    border: `1.5px solid ${ans === opt ? 'var(--blue)' : 'var(--border)'}`,
                    background: ans === opt ? 'rgba(0,122,255,0.1)' : 'var(--surface)',
                    color: ans === opt ? 'var(--blue)' : 'var(--text-2)',
                    fontWeight: ans === opt ? 700 : 400, fontSize: 13, cursor: 'pointer', transition: 'all 0.12s',
                  }}>{opt}</button>
                ))}
              </div>
            )}
            {q.type === 'scale' && (
              <div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[1, 2, 3, 4, 5].map(n => (
                    <button key={n} onClick={() => set(q.id, q.text, q.type, n)} style={{
                      flex: 1, padding: '10px 0', borderRadius: 'var(--radius)',
                      background: ans === n ? 'var(--accent)' : ans > n ? 'var(--accent-dim)' : 'var(--surface-2)',
                      color: ans === n ? '#FFF' : 'var(--text-2)',
                      border: `1px solid ${ans >= n ? 'var(--accent)' : 'var(--border)'}`,
                      fontWeight: 700, fontSize: 15, cursor: 'pointer', transition: 'all 0.15s',
                    }}>{n}</button>
                  ))}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-3)', marginTop: 4 }}>
                  <span>{q.options?.[0] || '매우 낮음'}</span><span>{q.options?.[1] || '매우 높음'}</span>
                </div>
              </div>
            )}
            {q.type === 'text' && (
              <div>
                <textarea
                  value={ans || ''}
                  onChange={e => set(q.id, q.text, q.type, e.target.value)}
                  rows={3}
                  placeholder="자유롭게 작성해주세요."
                  style={{ resize: 'vertical', fontFamily: 'inherit', fontSize: 13, width: '100%' }}
                />
                {ans && ans.length < 10 && (
                  <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 4 }}>
                    최소 10자 이상 입력해주세요 ({ans.length}/10)
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function ActiveMission() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const missionId  = searchParams.get('id');
  const resubmitId = searchParams.get('resubmit');

  // ── LIST VIEW ──
  const [panel, setPanel]           = useState(null);
  const [drafts, setDrafts]         = useState(null);
  const [panelPending, setPanelPending] = useState(false);

  // ── FORM VIEW ──
  const [mission, setMission]   = useState(null);
  const [step, setStep]         = useState(0);
  const [submitting, setSubmitting]       = useState(false);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);
  const [draftId, setDraftId]             = useState(null);
  const autoSaveTimer = useRef(null);
  const commentUpdateTimers = useRef({});
  const bottomSectionRef = useRef(null);
  const [isResubmit, setIsResubmit]           = useState(false);
  const [deadlineExpired, setDeadlineExpired] = useState(false);
  const [slotTaken, setSlotTaken]             = useState(false);
  const [missionEnded, setMissionEnded]       = useState(false);
  const [deadlineBanner, setDeadlineBanner]   = useState(null); // { label, value: Date }
  const [cancelModal, setCancelModal]         = useState(false);
  const [imgFullscreen, setImgFullscreen]     = useState(false);
  const [cancelConfirming, setCancelConfirming] = useState(false);
  const [cancelError, setCancelError]         = useState('');
  const [startError, setStartError]           = useState('');
  const [submitError, setSubmitError]         = useState('');
  const [annDeleteError, setAnnDeleteError]   = useState('');
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [submitConfirmCountdown, setSubmitConfirmCountdown] = useState(0);
  const pendingSubmitRef = useRef(null);

  // ── IMAGE ANNOTATION ──
  const [annotations, setAnnotations]         = useState([]);
  const [currentImageIdx, setCurrentImageIdx] = useState(0);
  const [viewedImages, setViewedImages]       = useState(() => new Set([0]));
  const [activeDimension, setActiveDimension] = useState('clarity');
  const [commentWarn, setCommentWarn]         = useState(false); // 코멘트 미작성 영역 경고 표시
  const [missionKind, setMissionKind] = useState('all');
  const [overallComment, setOverallComment]   = useState('');
  const [skippedDims, setSkippedDims]         = useState({ clarity: false, relevance: false, value: false, differentiation: false, trust: false });

  const hasImages = Boolean(mission && Array.isArray(mission.image_urls) && mission.image_urls.length > 0);
  const missionType = mission?.type || null;
  const isSubMission = ['preference', 'pricing', 'email'].includes(missionType);
  const isMainMission = !isSubMission;
  const lpParsed  = (mission && isMainMission) ? parseLPDesc(mission.description) : null;
  const lpTypedQs = lpParsed?.selectedQuestions || [];

  // ── SUB-MISSION STATE ──
  const [prefChoice, setPrefChoice]           = useState('');     // 'A' | 'B'
  const [prefClarity, setPrefClarity]         = useState(0);
  const [prefIntent, setPrefIntent]           = useState(0);
  const [prefComment, setPrefComment]         = useState('');
  const [priceFairness, setPriceFairness]     = useState(0);
  const [priceValue, setPriceValue]           = useState(0);
  const [priceWouldBuy, setPriceWouldBuy]     = useState(null); // true | false
  const [priceComment, setPriceComment]       = useState('');
  const [emailOpenIntent, setEmailOpenIntent] = useState(0);
  const [emailCuriosity, setEmailCuriosity]   = useState(0);
  const [emailHook, setEmailHook]             = useState(0);
  const [emailClarity, setEmailClarity]       = useState(0);
  const [emailWouldReply, setEmailWouldReply] = useState(null); // true | false
  const [emailComment, setEmailComment]       = useState('');
  const [customAnswers, setCustomAnswers]     = useState([]); // [{questionId, questionText, type, answer}]

  // ── 제출 확인 카운트다운 ──
  useEffect(() => {
    if (showSubmitConfirm) setSubmitConfirmCountdown(5);
    else setSubmitConfirmCountdown(0);
  }, [showSubmitConfirm]);
  useEffect(() => {
    if (submitConfirmCountdown <= 0) return;
    const t = setTimeout(() => setSubmitConfirmCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [submitConfirmCountdown]);

  useEffect(() => {
    setMission(null);
    setStep(0);
    setDeadlineExpired(false);
    setSlotTaken(false);
    setDeadlineBanner(null);
    setIsResubmit(false);
    setAlreadySubmitted(false);
    setDraftId(null);
    setAnnotations([]);
    setCustomAnswers([]);
    setCurrentImageIdx(0);
    setViewedImages(new Set([0]));
    setActiveDimension('clarity');
    setCommentWarn(false);
    setOverallComment('');
    setSkippedDims({ clarity: false, relevance: false, value: false, differentiation: false, trust: false });

    async function load() {
      try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: p } = await supabase.from('panels').select('*').eq('user_id', user.id).single();
      setPanel(p);

      // 비활성 패널(pending/rejected/banned/suspended)은 미션 접근 차단 (accept_mission_slot RPC·Sidebar 게이트와 다중 방어)
      if (p?.status && p.status !== 'active') {
        setPanelPending(true);
        return;
      }

      if (missionId) {
        const { data: ms } = await supabase.from('missions').select('*').eq('id', missionId).single();
        setMission(ms || false);

        if (ms && p) {
          const { data: existing } = await supabase
            .from('feedbacks')
            .select('id, status, clarity_score, relevance_score, value_score, differentiation_score, trust_score, strengths, suggestions, custom_answers, submission_deadline, rejection_deadline')
            .eq('mission_id', ms.id)
            .eq('panel_id', p.id)
            .limit(1);

          if (existing && existing.length > 0) {
            const fb = existing[0];
            const willResubmit = Boolean(resubmitId && fb.id === resubmitId && fb.status === 'rejected');

            if (willResubmit) {
              // 클라이언트 사전 만료 체크 (서버 왕복 최소화)
              if (fb.rejection_deadline && new Date(fb.rejection_deadline) < new Date()) {
                setDeadlineExpired(true);
                return;
              }
              // 원자적 슬롯 재예약 + status='draft' 복원 (동시 경쟁 처리 포함)
              const { data: reaccepted, error: reErr } = await supabase.rpc('reaccept_rejected_feedback', {
                p_feedback_id: fb.id,
              });
              if (reErr || !reaccepted) {
                // RPC 응답 유실 가능성 — DB 상태 직접 재확인 (네트워크 오류로 응답이 손실되어도 DB 변경은 성공했을 수 있음)
                const { data: freshFb } = await supabase
                  .from('feedbacks').select('status').eq('id', fb.id).single();
                if (freshFb?.status !== 'draft') {
                  setSlotTaken(true);
                  return;
                }
                // DB에서 이미 'draft'이면 RPC가 성공한 것으로 간주하고 진행
              }
              setDraftId(fb.id);
              setIsResubmit(true);
              if (fb.rejection_deadline) {
                setDeadlineBanner({ label: '재제출 마감', value: new Date(fb.rejection_deadline) });
              }
              if (ms.image_urls?.length > 0) {
                const { data: anns } = await supabase.from('feedback_annotations').select('*').eq('feedback_id', fb.id).order('created_at');
                setAnnotations(anns || []);
                // 재작성 시작: 모든 이미지를 다시 확인하도록 게이트 초기화([0]만 본 것으로) — 총평 섹션은 전수확인 후 개방
                setViewedImages(new Set([0]));
                // 총평·"해당 없음"·추가질문 복원 (원본 제출본 = suggestions/custom_answers)
                const sub = parseImageSubmission(fb);
                if (sub.overallComment) setOverallComment(sub.overallComment);
                if (sub.skippedDims)    setSkippedDims(sub.skippedDims);
                if (sub.customAnswers)  setCustomAnswers(sub.customAnswers);
              } else if (['preference', 'pricing', 'email'].includes(ms.type)) {
                const tbl = ms.type === 'preference' ? 'preference_responses' : ms.type === 'pricing' ? 'pricing_responses' : 'email_responses';
                const { data: subResp } = await supabase.from(tbl).select('*').eq('mission_id', ms.id).eq('panel_id', p.id).single();
                if (subResp) {
                  if (ms.type === 'preference') {
                    if (subResp.preference)      setPrefChoice(subResp.preference);
                    if (subResp.message_clarity) setPrefClarity(subResp.message_clarity);
                    if (subResp.purchase_intent) setPrefIntent(subResp.purchase_intent);
                    if (subResp.comment)         setPrefComment(subResp.comment);
                  } else if (ms.type === 'pricing') {
                    if (subResp.price_fairness)  setPriceFairness(subResp.price_fairness);
                    if (subResp.value_perception) setPriceValue(subResp.value_perception);
                    if (subResp.would_buy !== null && subResp.would_buy !== undefined) setPriceWouldBuy(subResp.would_buy);
                    if (subResp.key_comment)     setPriceComment(subResp.key_comment);
                  } else if (ms.type === 'email') {
                    if (subResp.open_intent)     setEmailOpenIntent(subResp.open_intent);
                    if (subResp.curiosity_score) setEmailCuriosity(subResp.curiosity_score);
                    if (subResp.hook_score)      setEmailHook(subResp.hook_score);
                    if (subResp.clarity_score)   setEmailClarity(subResp.clarity_score);
                    if (subResp.would_reply !== null && subResp.would_reply !== undefined) setEmailWouldReply(subResp.would_reply);
                    if (subResp.comment)         setEmailComment(subResp.comment);
                  }
                  if (Array.isArray(subResp?.custom_answers)) setCustomAnswers(subResp.custom_answers);
                }
              }
              // 재작성 모드: 브리핑 스킵하고 폼으로 바로 이동
              setStep(1);
            } else if (['submitted', 'approved', 'rejected'].includes(fb.status)) {
              setAlreadySubmitted(true);
            } else {
              // 의뢰가 완료/취소된 경우 — 제출 불가 안내 후 삭제 유도
              if (ms.status !== 'active') {
                setMissionEnded(true);
                setDraftId(fb.id);
                return;
              }
              // 재작성 draft vs 최초 draft: rejection_deadline 유무로 구분
              if (fb.rejection_deadline) {
                // 재작성 draft(재수락 후 작성 중): rejection_deadline이 만료 기준
                if (new Date(fb.rejection_deadline) < new Date()) {
                  setDeadlineExpired(true);
                  return;
                }
                setDeadlineBanner({ label: '재제출 마감', value: new Date(fb.rejection_deadline) });
                setIsResubmit(true); // 서브미션 UPDATE 경로 + 미션 카운트 중복 방지
              } else {
                // 최초 draft: submission_deadline이 만료 기준
                if (fb.submission_deadline && new Date(fb.submission_deadline) < new Date()) {
                  setDeadlineExpired(true);
                  return;
                }
                if (fb.submission_deadline) {
                  setDeadlineBanner({ label: '제출 마감', value: new Date(fb.submission_deadline) });
                }
              }
              setDraftId(fb.id);
              if (fb.strengths) {
                try {
                  const saved = JSON.parse(fb.strengths);
                  if (saved.__subType) {
                    if (saved.__subType === 'preference') {
                      if (saved.prefChoice)  setPrefChoice(saved.prefChoice);
                      if (saved.prefClarity) setPrefClarity(saved.prefClarity);
                      if (saved.prefIntent)  setPrefIntent(saved.prefIntent);
                      if (saved.prefComment) setPrefComment(saved.prefComment);
                    } else if (saved.__subType === 'pricing') {
                      if (saved.priceFairness) setPriceFairness(saved.priceFairness);
                      if (saved.priceValue)    setPriceValue(saved.priceValue);
                      if (saved.priceWouldBuy !== undefined && saved.priceWouldBuy !== null) setPriceWouldBuy(saved.priceWouldBuy);
                      if (saved.priceComment)  setPriceComment(saved.priceComment);
                    } else if (saved.__subType === 'email') {
                      if (saved.emailOpenIntent) setEmailOpenIntent(saved.emailOpenIntent);
                      if (saved.emailCuriosity)  setEmailCuriosity(saved.emailCuriosity);
                      if (saved.emailHook)       setEmailHook(saved.emailHook);
                      if (saved.emailClarity)    setEmailClarity(saved.emailClarity);
                      if (saved.emailWouldReply !== undefined && saved.emailWouldReply !== null) setEmailWouldReply(saved.emailWouldReply);
                      if (saved.emailComment)    setEmailComment(saved.emailComment);
                    }
                    if (Array.isArray(saved.customAnswers)) setCustomAnswers(saved.customAnswers);
                  }
                } catch {}
              }
              // 이미지 미션: 기존 어노테이션 로드 + LP 질문 응답 복원
              if (ms.image_urls?.length > 0) {
                const { data: anns } = await supabase
                  .from('feedback_annotations')
                  .select('*')
                  .eq('feedback_id', fb.id)
                  .order('created_at');
                setAnnotations(anns || []);
                const isRewriteDraft = Boolean(fb.rejection_deadline); // 재작성 재진입 vs 최초 draft 구분
                // 실제로 확인한 이미지만 복원: 저장된 viewedImages + 어노테이션이 있는 이미지(확실히 본 것) 합집합
                // (구: 저장물이 있으면 전체를 봤다고 간주 → 안 본 이미지도 통과시켜 총평 게이트가 조기 개방되던 버그 D-141)
                const restoredViewed = new Set([0]);
                // 재작성 draft는 모든 이미지 재확인을 강제 — 어노테이션 보유 이미지를 '확인됨'으로 자동 통과시키지 않음
                if (!isRewriteDraft) {
                  (anns || []).forEach(a => { if (typeof a.image_index === 'number') restoredViewed.add(a.image_index); });
                }
                let sOverall = null, sCustom = null, sSkipped = null;
                if (fb.strengths) {
                  try {
                    const s = JSON.parse(fb.strengths);
                    if (Array.isArray(s.customAnswers)) sCustom = s.customAnswers;
                    if (s.overallComment) sOverall = s.overallComment;
                    if (s.skippedDims) sSkipped = s.skippedDims;
                    if (Array.isArray(s.viewedImages)) s.viewedImages.forEach(i => restoredViewed.add(i));
                  } catch {}
                }
                // 재작성 draft인데 자동저장(strengths)에 없는 항목은 원본 제출본(suggestions/custom_answers)에서 폴백 복원
                if (isRewriteDraft) {
                  const sub = parseImageSubmission(fb);
                  if (sOverall == null) sOverall = sub.overallComment;
                  if (sCustom == null)  sCustom  = sub.customAnswers;
                  if (sSkipped == null) sSkipped = sub.skippedDims;
                }
                if (sCustom)  setCustomAnswers(sCustom);
                if (sOverall) setOverallComment(sOverall);
                if (sSkipped) setSkippedDims(prev => ({ ...prev, ...sSkipped }));
                setViewedImages(restoredViewed);
              }
            }
          }
        }
      } else {
        const { data: fbs } = await supabase
          .from('feedbacks')
          .select('*, missions(*)')
          .eq('panel_id', p.id)
          .eq('status', 'draft');
        setDrafts(fbs || []);
      }
      } catch (err) {
        console.error('[PanelActiveMission load]', err);
        if (!missionId) setDrafts([]);
      }
    }
    load();
  }, [missionId, resubmitId]);

  // 이미지 미션 자동 저장 (LP 질문 응답 + 총평 + 차원 건너뛰기)
  useEffect(() => {
    if (!draftId || !hasImages || isSubMission || step < 1) return;
    clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      const toSave = {};
      if (customAnswers.length) toSave.customAnswers = customAnswers;
      if (overallComment) toSave.overallComment = overallComment;
      if (Object.values(skippedDims).some(Boolean)) toSave.skippedDims = skippedDims;
      if (viewedImages.size > 1) toSave.viewedImages = [...viewedImages]; // 실제 확인한 이미지 인덱스 보존 (복원 시 게이트 정확도)
      if (Object.keys(toSave).length === 0) return;
      supabase.from('feedbacks')
        .update({ strengths: JSON.stringify(toSave) })
        .eq('id', draftId)
        .then(({ error }) => { if (error) console.warn('[이미지 자동저장 실패]', error.message); });
    }, 1500);
    return () => clearTimeout(autoSaveTimer.current);
  }, [customAnswers, overallComment, skippedDims, viewedImages]);

  // 서브 미션 자동 저장
  useEffect(() => {
    if (!draftId || !missionId || !isSubMission || step < 1) return;
    clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => saveSubProgress(), 1500);
    return () => clearTimeout(autoSaveTimer.current);
  }, [prefChoice, prefClarity, prefIntent, prefComment,
      priceFairness, priceValue, priceWouldBuy, priceComment,
      emailOpenIntent, emailCuriosity, emailHook, emailClarity, emailWouldReply, emailComment,
      customAnswers]);

  const saveSubProgress = () => {
    if (!draftId || !missionType) return;
    let subState = { __subType: missionType };
    if (missionType === 'preference') {
      subState = { ...subState, prefChoice, prefClarity, prefIntent, prefComment };
    } else if (missionType === 'pricing') {
      subState = { ...subState, priceFairness, priceValue, priceWouldBuy, priceComment };
    } else if (missionType === 'email') {
      subState = { ...subState, emailOpenIntent, emailCuriosity, emailHook, emailClarity, emailWouldReply, emailComment };
    }
    subState = { ...subState, customAnswers };
    supabase.from('feedbacks').update({ strengths: JSON.stringify(subState) })
      .eq('id', draftId).then(({ error }) => { if (error) console.warn('[서브 자동저장 실패]', error.message); });
  };

  // 제출 후 공통 후처리: 게이미피케이션 RPC + 어드민 알림
  const postSubmitActions = async (resubmitMode = false) => {
    if (!panel?.id) return;
    if (!resubmitMode) {
      await supabase.rpc('add_panel_honor_points', { p_panel_id: panel.id, p_delta: 5 })
        .then(({ error }) => { if (error) console.warn('[honor_points +5]', error.message); });
    }
    supabase.rpc('check_and_award_badges', { p_panel_id: panel.id })
      .then(({ error }) => { if (error) console.warn('[check_and_award_badges]', error.message); });
    if (mission?.id) {
      supabase.rpc('notify_admin_on_feedback_submitted', { p_mission_id: mission.id, p_is_resubmit: resubmitMode, p_feedback_id: draftId })
        .then(({ error }) => { if (error) console.warn('[notify_admin_feedback]', error.message); });
    }
  };

  const handleCancelAccept = async () => {
    setCancelConfirming(true);
    const { error } = await supabase.rpc('cancel_panel_feedback', { p_mission_id: mission.id });
    setCancelConfirming(false);
    if (error) { setCancelError('취소 중 오류: ' + error.message); return; }
    navigate('/panel/missions');
  };

  const handleStart = async () => {
    if (!mission || !panel) return;
    if (draftId) { setStep(1); return; }
    setStartError('미션을 먼저 수락해 주세요. 미션 목록에서 수락 후 다시 시도해 주세요.');
  };

  const hasSavedProgress = Boolean(draftId) && (
    hasImages
      ? annotations.length > 0 || customAnswers.length > 0
      : Boolean(prefChoice || prefClarity || prefIntent || priceFairness || priceValue || priceWouldBuy !== null || emailOpenIntent || emailCuriosity || emailHook || emailWouldReply !== null)
  );

  const handleResume = () => { setStep(1); };

  // 현재 차원+이미지에 코멘트 미작성 영역이 있는지 (경고·차단 판단용)
  const hasEmptyCommentAt = (dim, imgIdx) =>
    annotations.some(a => a.dimension === dim && a.image_index === imgIdx && !(a.comment || '').trim());

  // 차원 뱃지 전환 시도 — ①미작성 코멘트 있으면 차단+경고 ②선택 차원이 다른 이미지에만 있으면 그 이미지로 이동
  const attemptSwitchDimension = (key) => {
    if (key === activeDimension) return;
    if (hasEmptyCommentAt(activeDimension, currentImageIdx)) { setCommentWarn(true); return; }
    setCommentWarn(false);
    setActiveDimension(key);
    // 선택한 차원의 어노테이션이 현재 이미지에 없고 다른 이미지에 있으면 → 적어둔 이미지로 자연스럽게 이동
    const onCurrent = annotations.some(a => a.dimension === key && a.image_index === currentImageIdx);
    if (!onCurrent) {
      const target = annotations.filter(a => a.dimension === key).map(a => a.image_index).sort((x, y) => x - y)[0];
      if (target !== undefined && target !== currentImageIdx) {
        setCurrentImageIdx(target);
        setViewedImages(prev => { const s = new Set(prev); s.add(target); return s; });
      }
    }
  };

  // 어노테이션 추가 (이미지 모드)
  const handleAddAnnotation = async (annotationData) => {
    if (!draftId || !mission || !panel) return;
    // 직전 드래그한 영역의 코멘트를 안 적었으면 새 영역 추가 차단 + 경고 (먼저 코멘트 작성 또는 영역 삭제)
    if (hasEmptyCommentAt(annotationData.dimension, annotationData.image_index)) { setCommentWarn(true); return; }
    const { data, error } = await supabase
      .from('feedback_annotations')
      .insert({
        feedback_id: draftId,
        mission_id:  mission.id,
        panel_id:    panel.id,
        image_index: annotationData.image_index,
        x_pct:       annotationData.x_pct,
        y_pct:       annotationData.y_pct,
        w_pct:       annotationData.w_pct,
        h_pct:       annotationData.h_pct,
        dimension:   annotationData.dimension,
        score:       annotationData.score,
        comment:     annotationData.comment,
      })
      .select('*')
      .single();
    if (!error && data) setAnnotations(prev => [...prev, data]);
  };

  // 어노테이션 삭제 (이미지 모드)
  const handleRemoveAnnotation = async (annId) => {
    clearTimeout(commentUpdateTimers.current[annId]);
    const { error } = await supabase.from('feedback_annotations').delete().eq('id', annId);
    if (error) {
      setAnnDeleteError('영역 삭제에 실패했습니다. 다시 시도해 주세요.');
      return;
    }
    setAnnDeleteError('');
    setAnnotations(prev => prev.filter(a => a.id !== annId));
  };

  // 차원 건너뛰기 토글 — 스킵 시 해당 차원 어노테이션 일괄 삭제
  const toggleSkipDim = async (dim) => {
    const willSkip = !skippedDims[dim];
    if (willSkip && draftId) {
      annotations.filter(a => a.dimension === dim).forEach(ann => clearTimeout(commentUpdateTimers.current[ann.id]));
      const { error } = await supabase.from('feedback_annotations').delete().eq('feedback_id', draftId).eq('dimension', dim);
      if (error) {
        setAnnDeleteError('영역 삭제에 실패했습니다. 다시 시도해 주세요.');
        return;
      }
      setAnnDeleteError('');
      setAnnotations(prev => prev.filter(a => a.dimension !== dim));
    }
    setSkippedDims(prev => ({ ...prev, [dim]: willSkip }));
  };

  // 어노테이션 코멘트 업데이트 (debounce 1s)
  const handleUpdateAnnotationComment = (annId, comment) => {
    setAnnotations(prev => prev.map(a => a.id === annId ? { ...a, comment } : a));
    clearTimeout(commentUpdateTimers.current[annId]);
    commentUpdateTimers.current[annId] = setTimeout(() => {
      supabase.from('feedback_annotations').update({ comment }).eq('id', annId);
    }, 1000);
  };

  const handleSubMissionSubmit = async () => {
    if (!mission || !panel || !draftId) return;
    setSubmitting(true);
    try {
      let suggestionText = '';
      const emailGoalLabel = missionType === 'email' ? resolveEmailGoal(parseSubDesc(mission.description, 'email')).label : '';

      if (isResubmit) {
        // 재제출: 기존 응답 행 UPDATE
        if (missionType === 'preference') {
          await supabase.from('preference_responses').update({ preference: prefChoice, comment: prefComment, message_clarity: prefClarity || null, purchase_intent: prefIntent || null, custom_answers: customAnswers }).eq('mission_id', mission.id).eq('panel_id', panel.id);
          suggestionText = `[선호 소재] ${prefChoice}\n[메시지 명확성] ${prefClarity}/5\n[구매 전환 의향] ${prefIntent}/5\n[코멘트] ${prefComment}`;
        } else if (missionType === 'pricing') {
          await supabase.from('pricing_responses').update({ would_buy: priceWouldBuy, key_comment: priceComment, price_fairness: priceFairness || null, value_perception: priceValue || null, custom_answers: customAnswers }).eq('mission_id', mission.id).eq('panel_id', panel.id);
          suggestionText = `[구매 의향] ${priceWouldBuy ? '있음' : '없음'}\n[가격 적절성] ${priceFairness}/5\n[가치 인식] ${priceValue}/5\n[코멘트] ${priceComment}`;
        } else if (missionType === 'email') {
          await supabase.from('email_responses').update({ would_reply: emailWouldReply, hook_score: emailHook || null, clarity_score: emailClarity || null, open_intent: emailOpenIntent || null, curiosity_score: emailCuriosity || null, comment: emailComment, custom_answers: customAnswers }).eq('mission_id', mission.id).eq('panel_id', panel.id);
          suggestionText = `[전환 목표] ${emailGoalLabel}\n[목표 행동 의향] ${emailWouldReply ? '있음' : '없음'}\n[훅 강도] ${emailHook}/5\n[명확성] ${emailClarity}/5\n[개봉 의향] ${emailOpenIntent}/5\n[호기심] ${emailCuriosity}/5\n[코멘트] ${emailComment}`;
        }
      } else {
        // 최초 제출: INSERT
        if (missionType === 'preference') {
          const { data: prefTest } = await supabase.from('preference_tests').select('id').eq('mission_id', mission.id).single();
          await supabase.from('preference_responses').insert({ test_id: prefTest?.id, panel_id: panel.id, mission_id: mission.id, preference: prefChoice, comment: prefComment, message_clarity: prefClarity || null, purchase_intent: prefIntent || null, custom_answers: customAnswers, status: 'submitted' });
          suggestionText = `[선호 소재] ${prefChoice}\n[메시지 명확성] ${prefClarity}/5\n[구매 전환 의향] ${prefIntent}/5\n[코멘트] ${prefComment}`;
        } else if (missionType === 'pricing') {
          const { data: pricingTest } = await supabase.from('pricing_tests').select('id').eq('mission_id', mission.id).single();
          await supabase.from('pricing_responses').insert({ test_id: pricingTest?.id, panel_id: panel.id, mission_id: mission.id, would_buy: priceWouldBuy, key_comment: priceComment, price_fairness: priceFairness || null, value_perception: priceValue || null, custom_answers: customAnswers, status: 'submitted' });
          suggestionText = `[구매 의향] ${priceWouldBuy ? '있음' : '없음'}\n[가격 적절성] ${priceFairness}/5\n[가치 인식] ${priceValue}/5\n[코멘트] ${priceComment}`;
        } else if (missionType === 'email') {
          const { data: emailTest } = await supabase.from('cold_email_tests').select('id').eq('mission_id', mission.id).single();
          await supabase.from('email_responses').insert({ test_id: emailTest?.id, panel_id: panel.id, mission_id: mission.id, would_reply: emailWouldReply, hook_score: emailHook || null, clarity_score: emailClarity || null, open_intent: emailOpenIntent || null, curiosity_score: emailCuriosity || null, comment: emailComment, custom_answers: customAnswers, status: 'submitted' });
          suggestionText = `[전환 목표] ${emailGoalLabel}\n[목표 행동 의향] ${emailWouldReply ? '있음' : '없음'}\n[훅 강도] ${emailHook}/5\n[명확성] ${emailClarity}/5\n[개봉 의향] ${emailOpenIntent}/5\n[호기심] ${emailCuriosity}/5\n[코멘트] ${emailComment}`;
        }
      }

      const { error: fbError } = await supabase.from('feedbacks').update({
        strengths: null, weaknesses: null,
        suggestions: suggestionText,
        purity_passed: false, status: 'submitted',
      }).eq('id', draftId);
      if (fbError) throw fbError;

      // filled_count는 수락/재수락 시점에 이미 처리됨 — 제출 시 변동 없음
      if (!isResubmit) {
        await supabase.rpc('increment_panel_mission_count', { panel_id: panel.id });
      }
      await postSubmitActions(isResubmit);

      setStep(6);
    } catch (err) {
      setSubmitError('제출 중 오류: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    if (!mission || !panel || !draftId) return;
    setSubmitting(true);
    try {
      let updatePayload;

      if (hasImages) {
        // 코멘트 debounce 타이머 플러시 — 미저장 코멘트를 제출 전 즉시 동기화
        const pendingIds = Object.keys(commentUpdateTimers.current);
        if (pendingIds.length > 0) {
          pendingIds.forEach(id => clearTimeout(commentUpdateTimers.current[id]));
          commentUpdateTimers.current = {};
        }
        if (annotations.length > 0) {
          await Promise.all(
            annotations.map(ann =>
              supabase.from('feedback_annotations').update({ comment: ann.comment || '' }).eq('id', ann.id)
            )
          );
        }

        // 어노테이션 → dimension별 평균 점수 계산
        const avg = (dim) => {
          const hits = annotations.filter(a => a.dimension === dim);
          if (!hits.length) return null;
          return Math.round(hits.reduce((s, a) => s + a.score, 0) / hits.length);
        };
        updatePayload = {
          clarity_score:         avg('clarity'),
          relevance_score:       avg('relevance'),
          value_score:           avg('value'),
          differentiation_score: avg('differentiation'),
          trust_score:           avg('trust'),
          strengths:             null,
          weaknesses:            null,
          suggestions:           (() => {
            const annLines  = annotations.map(a => `[${DIM_LABEL[a.dimension]} / ${a.score}점] ${a.comment}`).join('\n');
            const skipLines = Object.entries(skippedDims).filter(([, v]) => v).map(([k]) => `[${DIM_LABEL[k]} - 해당 없음]`).join('\n');
            const body = [annLines, skipLines].filter(Boolean).join('\n');
            return [body, overallComment ? `\n[총평]\n${overallComment}` : ''].join('').trim();
          })(),
          custom_answers: customAnswers.length > 0 ? customAnswers : null,
          purity_passed: false,
          status:        'submitted',
        };
      } else {
        return; // 이미지 없는 미션은 제출 불가 (하위 호환 안전 가드)
      }

      const { error: fbError } = await supabase.from('feedbacks').update(updatePayload).eq('id', draftId);
      if (fbError) throw fbError;

      // filled_count는 수락/재수락 시점에 이미 처리됨 — 제출 시 변동 없음
      if (!isResubmit) {
        await supabase.rpc('increment_panel_mission_count', { panel_id: panel.id });
      }
      await postSubmitActions(isResubmit);

      setStep(6);
    } catch (err) {
      setSubmitError('제출 중 오류: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  /* ══════════════════════════════════════════
     목록 뷰
  ══════════════════════════════════════════ */
  if (!missionId) {
    if (drafts === null) return (
      <div style={{ padding: '40px 48px', color: 'var(--text-3)', fontSize: 14 }}>불러오는 중...</div>
    );

    const TYPE_BADGE = {
      preference: <Badge type="blue">소재 비교</Badge>,
      pricing:    <Badge type="gold">가격 검증</Badge>,
      email:      <Badge type="blue">이메일 검증</Badge>,
    };

    const renderDraftCard = (fb) => {
      const m = fb.missions;
      if (!m) return null;
      const hasProgress = hasDraftProgress(fb);
      const isSubM = ['preference', 'pricing', 'email'].includes(m.type);
      const baseRew = getPanelReward(panel?.honor_points || 0, panel?.experience);
      const cardReward = isSubM ? Math.round(baseRew * 4500 / 8000) : baseRew;
      return (
        <Card key={fb.id}>
          <div className="mc-row">
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 7, flexWrap: 'wrap' }}>
                <Badge type="gold">진행 중</Badge>
                {TYPE_BADGE[m.type]}
                {m.image_urls?.length > 0 && <Badge type="blue">이미지 {m.image_urls.length}장</Badge>}
                <span style={{ fontSize: 11, fontFamily: 'var(--font-sans)', color: 'var(--text-3)' }}>
                  {m.id.slice(0, 8).toUpperCase()}
                </span>
              </div>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{m.title}</div>
              {m.persona && (
                <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 4, lineHeight: 1.5 }}>
                  🎯 타겟: {m.persona}
                </div>
              )}
            </div>
            <div className="mc-right">
              <div>
                <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--green)', fontFamily: 'var(--font-sans)' }}>
                  ₩{cardReward.toLocaleString()}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>건당 보상</div>
              </div>
              <Btn size="sm" onClick={() => navigate(`/panel/active?id=${m.id}`)}>
                {hasProgress ? '이어하기 →' : '피드백 시작하기 →'}
              </Btn>
            </div>
          </div>
        </Card>
      );
    };

    const mainDrafts = drafts.filter(fb => fb.missions && (!fb.missions.type || fb.missions.type === 'landing_page'));
    const subDrafts  = drafts.filter(fb => fb.missions && ['preference', 'pricing', 'email'].includes(fb.missions.type));

    return (
      <div className="page-wrap" style={{ padding: '40px 48px', maxWidth: 900, animation: 'fadeUp 0.5s ease both' }}>
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 12, fontFamily: 'var(--font-sans)', color: 'var(--green)', marginBottom: 8, letterSpacing: '0.1em' }}>ACTIVE MISSIONS</div>
          <h1 style={{ fontSize: 28, fontWeight: 800 }}>진행 중인 미션</h1>
        </div>
        {drafts.length === 0 ? (
          <div style={{ padding: '48px 40px', textAlign: 'center', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' }}>
            <div style={{ fontSize: 36, marginBottom: 16 }}>📋</div>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>아직 진행 중인 미션이 없어요</div>
            <div style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 24 }}>
              미션 탐색에서 마음에 드는 미션을 수락하면 여기에 표시됩니다.
            </div>
            <Btn variant="outline" onClick={() => navigate('/panel/missions')}>미션 탐색 보기 →</Btn>
          </div>
        ) : (
          <>
          {/* 메인/서브 전환 탭 */}
          <SegmentFilter
            value={missionKind}
            onChange={setMissionKind}
            tabs={[
              { key: 'all', label: '전체', count: mainDrafts.length + subDrafts.length },
              { key: 'main', label: '메인 미션', count: mainDrafts.length },
              { key: 'sub', label: '서브 미션', count: subDrafts.length },
            ]}
            style={{ marginBottom: 20 }}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
            {(missionKind === 'main' || (missionKind === 'all' && mainDrafts.length > 0)) && (
            <div>
              {mainDrafts.length === 0 ? (
                <div style={{ padding: '28px', textAlign: 'center', color: 'var(--text-3)', fontSize: 14, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' }}>
                  진행 중인 메인 미션이 없습니다.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {mainDrafts.map(renderDraftCard)}
                </div>
              )}
            </div>
            )}
            {(missionKind === 'sub' || (missionKind === 'all' && subDrafts.length > 0)) && (
            <div>
              {subDrafts.length === 0 ? (
                <div style={{ padding: '28px', textAlign: 'center', color: 'var(--text-3)', fontSize: 14, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' }}>
                  진행 중인 서브 미션이 없습니다.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {subDrafts.map(renderDraftCard)}
                </div>
              )}
            </div>
            )}
          </div>
          </>
        )}
      </div>
    );
  }

  /* ══════════════════════════════════════════
     폼 뷰 공통 가드
  ══════════════════════════════════════════ */
  if (mission === null) return (
    <div style={{ padding: '40px 48px', color: 'var(--text-3)', fontSize: 14 }}>불러오는 중...</div>
  );

  if (mission === false) return (
    <div className="page-wrap" style={{ padding: '40px 48px', maxWidth: 560, animation: 'fadeUp 0.4s ease both' }}>
      <div style={{ fontSize: 12, fontFamily: 'var(--font-sans)', color: 'var(--green)', marginBottom: 8, letterSpacing: '0.1em' }}>ACTIVE MISSION</div>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '48px 40px', textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>📋</div>
        <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 8 }}>미션을 찾을 수 없어요</div>
        <Btn onClick={() => navigate('/panel/active')}>목록으로 돌아가기</Btn>
      </div>
    </div>
  );

  if (alreadySubmitted) return (
    <div style={{ padding: '40px 48px', maxWidth: 600, textAlign: 'center' }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>✋</div>
      <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 12 }}>이미 제출한 미션입니다</h2>
      <p style={{ color: 'var(--text-2)', marginBottom: 28 }}>이 미션에 대한 피드백을 이미 제출하셨습니다.</p>
      <Btn onClick={() => navigate('/panel/active')}>목록으로 돌아가기</Btn>
    </div>
  );

  /* ─── 마감 배너 공용 엘리먼트 (브리핑·서브·이미지·텍스트 폼 공통) ─── */
  const deadlineBannerEl = deadlineBanner ? (() => {
    const now = new Date();
    const diff = deadlineBanner.value - now;
    const totalMin = Math.max(0, Math.floor(diff / 60000));
    const hrs  = Math.floor(totalMin / 60);
    const mins = totalMin % 60;
    const remaining   = diff <= 0 ? '만료됨' : hrs > 0 ? `${hrs}시간 ${mins}분 남음` : `${mins}분 남음`;
    const isUrgent    = diff > 0 && diff < 60 * 60 * 1000;
    const bgColor     = isUrgent ? 'rgba(239,68,68,0.07)' : 'rgba(245,158,11,0.07)';
    const borderColor = isUrgent ? 'rgba(239,68,68,0.25)' : 'rgba(245,158,11,0.3)';
    const textColor   = isUrgent ? 'var(--red, #ef4444)' : '#D97706';
    return (
      <div style={{ marginBottom: 16, padding: '10px 14px', background: bgColor, border: `1px solid ${borderColor}`, borderRadius: 'var(--radius)', display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
        <span>⏱</span>
        <span style={{ fontWeight: 600, color: textColor }}>{deadlineBanner.label}: {remaining}</span>
      </div>
    );
  })() : null;

  /* ─── 자동 저장 배지 공용 엘리먼트 (서브·이미지 폼 헤더 우측) ─── */
  const autoSaveBadgeEl = (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 8,
      padding: '9px 16px', borderRadius: 999,
      background: 'var(--green-dim)', border: '1px solid rgba(22,163,74,0.35)',
      fontSize: 14, fontWeight: 700, color: '#1C7A39', whiteSpace: 'nowrap',
      boxShadow: '0 1px 4px rgba(22,163,74,0.12)',
    }} title="현재 페이지를 벗어나도 작성 내용이 자동으로 저장됩니다.">
      <span style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--green)', animation: 'pulse 1.4s ease-in-out infinite' }} />
      자동 저장 중
    </div>
  );

  if (panelPending) {
    const st = panel?.status;
    // 반려: 사유 + 재제출 버튼
    if (st === 'rejected') return (
      <div className="page-wrap" style={{ padding: '40px 48px', maxWidth: 560, textAlign: 'center', animation: 'fadeUp 0.4s ease both' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>📝</div>
        <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 12 }}>검증 서류가 반려되었습니다</h2>
        {panel?.rejection_reason && (
          <div style={{ fontSize: 13.5, color: '#78350F', background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: 8, padding: '12px 16px', margin: '0 auto 20px', maxWidth: 480, textAlign: 'left', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
            <strong style={{ color: '#92400E' }}>거절 사유</strong><br/>{panel.rejection_reason}
          </div>
        )}
        <p style={{ color: 'var(--text-2)', marginBottom: 28, lineHeight: 1.7 }}>사유를 확인하고 서류를 보완하여 재제출해 주세요.</p>
        <Btn onClick={() => navigate('/panel/verify-docs')}>서류 재제출하기 →</Btn>
      </div>
    );
    // 영구 차단
    if (st === 'banned') return (
      <div className="page-wrap" style={{ padding: '40px 48px', maxWidth: 560, textAlign: 'center', animation: 'fadeUp 0.4s ease both' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🚫</div>
        <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 12 }}>계정이 영구 정지되었습니다</h2>
        <p style={{ color: 'var(--text-2)', marginBottom: 28, lineHeight: 1.7 }}>
          누적 거절 횟수가 한도에 도달하여 이 계정으로는 더 이상 심사를 받을 수 없습니다.<br/>이의가 있으시면 운영팀에 연락해주세요.
        </p>
      </div>
    );
    // 계정 정지
    if (st === 'suspended') return (
      <div className="page-wrap" style={{ padding: '40px 48px', maxWidth: 560, textAlign: 'center', animation: 'fadeUp 0.4s ease both' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🚫</div>
        <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 12 }}>계정이 정지되었습니다</h2>
        <p style={{ color: 'var(--text-2)', marginBottom: 28, lineHeight: 1.7 }}>
          관리자에 의해 계정 활동이 정지되었습니다.<br/>문의사항은 운영팀에 연락해주세요.
        </p>
      </div>
    );
    // 심사 대기(pending)
    const hasDocs = !!(panel?.health_insurance_url || panel?.linkedin_url || panel?.portfolio_url || panel?.portfolio_file_url);
    return (
      <div className="page-wrap" style={{ padding: '40px 48px', maxWidth: 560, animation: 'fadeUp 0.4s ease both' }}>
        {hasDocs ? (
          <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid #F59E0B', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20 }}>⏳</span>
            <span style={{ fontSize: 14, color: 'var(--text-2)' }}>
              <strong>심사 대기 중입니다.</strong> 검증 서류 검토 후 미션 참여가 활성화됩니다. (1–2 영업일 소요)
            </span>
          </div>
        ) : (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📋</div>
            <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 12 }}>서비스 이용을 위한 경력 인증을 해주세요.</h2>
            <p style={{ color: 'var(--text-2)', marginBottom: 28, lineHeight: 1.7 }}>
              서류 검토 후 승인이 완료되면 미션 참여가 가능합니다.
            </p>
            <Btn onClick={() => navigate('/panel/verify-docs')}>서류 제출하기 →</Btn>
          </div>
        )}
      </div>
    );
  }

  if (slotTaken) return (
    <div className="page-wrap" style={{ padding: '40px 48px', maxWidth: 560, textAlign: 'center', animation: 'fadeUp 0.4s ease both' }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>🚫</div>
      <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 12 }}>슬롯이 이미 차지되었습니다</h2>
      <p style={{ color: 'var(--text-2)', marginBottom: 28, lineHeight: 1.7 }}>
        재작성 버튼을 누르기 전에 다른 패널이 빈 슬롯을 먼저 수락했습니다.<br />
        다른 미션에 참여해 주세요.
      </p>
      <Btn onClick={() => navigate('/panel/missions')}>미션 관리로 돌아가기</Btn>
    </div>
  );

  if (deadlineExpired) return (
    <div className="page-wrap" style={{ padding: '40px 48px', maxWidth: 560, textAlign: 'center', animation: 'fadeUp 0.4s ease both' }}>
      {cancelModal && (
        <ConfirmModal
          title="초안을 삭제할까요?"
          desc="작성 중이던 피드백 초안이 삭제됩니다."
          confirmLabel={cancelConfirming ? '처리 중...' : '초안 삭제'}
          cancelLabel="취소"
          danger
          onConfirm={handleCancelAccept}
          onCancel={() => setCancelModal(false)}
          errorMsg={cancelError}
        />
      )}
      <div style={{ fontSize: 48, marginBottom: 16 }}>⏰</div>
      <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 12 }}>제출 기한이 만료되었습니다</h2>
      <p style={{ color: 'var(--text-2)', marginBottom: 28, lineHeight: 1.7 }}>
        미션 제출 또는 재제출 기한이 지났습니다.<br />
        슬롯이 자동 해제되어 다른 패널이 참여할 수 있습니다.
      </p>
      <Btn danger onClick={() => { setCancelError(''); setCancelModal(true); }}>초안 삭제하기</Btn>
      <Btn variant="ghost" onClick={() => navigate('/panel/missions')} style={{ marginLeft: 8 }}>미션 관리로 돌아가기</Btn>
    </div>
  );

  if (missionEnded) return (
    <div className="page-wrap" style={{ padding: '40px 48px', maxWidth: 560, textAlign: 'center', animation: 'fadeUp 0.4s ease both' }}>
      {cancelModal && (
        <ConfirmModal
          title="초안을 삭제할까요?"
          desc="작성 중이던 피드백 초안이 삭제됩니다. 이 의뢰는 이미 종료되어 더 이상 제출할 수 없습니다."
          confirmLabel={cancelConfirming ? '처리 중...' : '초안 삭제'}
          cancelLabel="취소"
          danger
          onConfirm={handleCancelAccept}
          onCancel={() => setCancelModal(false)}
          errorMsg={cancelError}
        />
      )}
      <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
      <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 12 }}>의뢰가 종료되었습니다</h2>
      <p style={{ color: 'var(--text-2)', marginBottom: 28, lineHeight: 1.7 }}>
        이 의뢰는 완료 또는 취소 처리되어 더 이상 피드백을 제출할 수 없습니다.<br />
        작성 중이던 초안을 삭제하고 다른 미션에 참여하세요.
      </p>
      <Btn danger onClick={() => { setCancelError(''); setCancelModal(true); }}>초안 삭제하기</Btn>
      <Btn variant="ghost" onClick={() => navigate('/panel/missions')} style={{ marginLeft: 8 }}>미션 관리로 돌아가기</Btn>
    </div>
  );

  /* ─── 브리핑 화면 ─── */
  if (step === 0) return (
    <div className="page-wrap" style={{ padding: '40px 48px', maxWidth: 720, animation: 'fadeUp 0.5s ease both' }}>
      {cancelModal && (
        <ConfirmModal
          title="수락을 취소할까요?"
          desc={`작성 중이던 피드백 초안이 모두 삭제됩니다.\n이 미션은 다시 참여가능 목록으로 돌아갑니다.`}
          confirmLabel={cancelConfirming ? '처리 중...' : '수락 취소'}
          cancelLabel="계속 작성하기"
          danger
          onConfirm={handleCancelAccept}
          onCancel={() => setCancelModal(false)}
        />
      )}

      <div style={{ fontSize: 12, fontFamily: 'var(--font-sans)', color: 'var(--green)', marginBottom: 8, letterSpacing: '0.1em' }}>ACTIVE MISSION</div>
      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 24 }}>미션 브리핑</h1>
      {isResubmit && (
        <div style={{ marginBottom: 16, padding: '12px 16px', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 'var(--radius)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 16 }}>✏️</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--red, #ef4444)' }}>재작성 모드</div>
            <div style={{ fontSize: 12, color: 'var(--text-2)' }}>반려된 피드백을 수정하여 재제출합니다. 이전 내용이 복원되었습니다. {['preference','pricing','email'].includes(mission?.type) ? 2 : 4}시간 내에 제출하지 않으면 수락이 자동 취소됩니다.</div>
          </div>
        </div>
      )}
      {deadlineBannerEl}
      <Card style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <Badge type="gold">{isResubmit ? '재작성 중' : '진행 중'}</Badge>
          {hasImages && <Badge type="blue">이미지 어노테이션</Badge>}
        </div>
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>{mission.title}</h2>
        {mission.persona && (
          <div style={{ fontSize: 14, color: 'var(--text-2)', marginBottom: 16, lineHeight: 1.7 }}>
            🎯 <strong>타겟 페르소나:</strong> {mission.persona}
          </div>
        )}
        {mission.type === 'preference' && (() => {
          const meta = resolveAssetType(parseSubDesc(mission.description, 'preference'));
          if (!meta) return null;
          return (
            <div style={{ padding: '14px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <strong style={{ color: 'var(--text)', fontSize: 14 }}>검증 유형:</strong>
                <Badge type="blue">{meta.label}</Badge>
              </div>
              {meta.desc && <div style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 8, lineHeight: 1.6 }}>{meta.desc}</div>}
            </div>
          );
        })()}
        {mission.type === 'email' && (() => {
          const goal = resolveEmailGoal(parseSubDesc(mission.description, 'email'));
          return (
            <div style={{ padding: '14px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <strong style={{ color: 'var(--text)', fontSize: 14 }}>전환 목표:</strong>
                <Badge type="blue">{goal.label}</Badge>
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 8, lineHeight: 1.6 }}>이 이메일을 받은 사람이 "{goal.label}" 행동을 하도록 만드는 것이 목표입니다.</div>
            </div>
          );
        })()}
        {(() => {
          if (!mission.description) return null;
          const subTypes = ['preference', 'pricing', 'email'];
          if (subTypes.includes(mission.type)) {
            const parsed = parseSubDesc(mission.description, mission.type);
            const text = parsed.productDescription || '';
            if (!text) return null;
            return (
              <div style={{ padding: '16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', marginBottom: 16, fontSize: 14, color: 'var(--text-2)', lineHeight: 1.7 }}>
                <strong style={{ color: 'var(--text)' }}>제품/타겟 설명:</strong><br />{text}
              </div>
            );
          }
          return (
            <div style={{ padding: '16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', marginBottom: 16, fontSize: 14, color: 'var(--text-2)', lineHeight: 1.7 }}>
              <strong style={{ color: 'var(--text)' }}>브리핑:</strong><br />{lpParsed ? lpParsed.briefText : mission.description}
            </div>
          );
        })()}
        {!['preference', 'pricing', 'email'].includes(mission.type) && Array.isArray(mission.assets) && mission.assets.length > 0 && (
          <div style={{ padding: '12px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', marginBottom: 16 }}>
            <strong style={{ color: 'var(--text)', fontSize: 14 }}>검증 포커스:</strong>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
              {mission.assets.map((a, i) => <Badge key={i} type="blue">{a}</Badge>)}
            </div>
          </div>
        )}
        {mission.target_url && (
          <a href={mission.target_url} target="_blank" rel="noreferrer"
            style={{ fontSize: 13, color: 'var(--text-2)', display: 'inline-block', marginBottom: 16 }}>
            🔗 랜딩페이지 보기 →
          </a>
        )}
        {hasImages && (
          <div style={{ padding: '12px 16px', background: 'var(--surface-2)', borderRadius: 'var(--radius)', marginBottom: 16, fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6 }}>
            📸 이미지 {mission.image_urls.length}장이 업로드되어 있습니다.<br />
            이미지 위를 드래그해서 영역을 지정하고, 항목별 점수와 코멘트를 달아주세요.
          </div>
        )}
        {(() => {
          const isSub = ['preference', 'pricing', 'email'].includes(mission.type);
          const base  = getPanelReward(panel?.honor_points || 0, panel?.experience);
          const disp  = isSub ? Math.round(base * 4500 / 8000) : base;
          return (
            <div style={{ padding: '14px 18px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 13 }}>
              <strong style={{ color: 'var(--text)' }}>보상: ₩{disp.toLocaleString()}</strong>
              <span style={{ color: 'var(--text-2)' }}> · Purit Filter 통과 시 자동 지급</span>
            </div>
          );
        })()}
      </Card>
      {(cancelError || startError) && (
        <div style={{ marginBottom: 12, padding: '10px 14px', borderRadius: 'var(--radius)', background: 'rgba(239,68,68,0.08)', color: 'var(--red,#ef4444)', fontSize: 13, fontWeight: 600 }}>
          {cancelError || startError}
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {draftId ? (
          <Btn variant="ghost" onClick={() => { setCancelError(''); setCancelModal(true); }} style={{ fontSize: 12, color: 'var(--text-3)' }}>수락 취소</Btn>
        ) : <div />}
        <div style={{ display: 'flex', gap: 12 }}>
          <Btn variant="secondary" onClick={() => navigate('/panel/active')}>목록으로</Btn>
          {hasSavedProgress
            ? <Btn onClick={handleResume}>이어하기 →</Btn>
            : <Btn onClick={() => { setStartError(''); handleStart(); }}>피드백 시작하기 →</Btn>
          }
        </div>
      </div>
    </div>
  );

  /* ─── 완료 화면 ─── */
  if (step >= 6) return (
    <div className="page-wrap" style={{ padding: '40px 48px', maxWidth: 600, animation: 'fadeUp 0.5s ease both', textAlign: 'center' }}>
      <div style={{ fontSize: 64, marginBottom: 20 }}>{isResubmit ? '🔄' : '✅'}</div>
      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 12 }}>
        {isResubmit ? '피드백 재제출 완료!' : '피드백 제출 완료!'}
      </h1>
      <p style={{ color: 'var(--text-2)', lineHeight: 1.7, marginBottom: 32 }}>
        {isResubmit
          ? '수정된 피드백이 어드민 검토 대기 중으로 이동했습니다. '
          : 'Purit Filter 검증 중입니다. '}
        통과 시{' '}
        <strong style={{ color: 'var(--green)' }}>₩{(() => { const isSub = ['preference','pricing','email'].includes(mission.type); const base = getPanelReward(panel?.honor_points||0, panel?.experience); return (isSub ? Math.round(base*4500/8000) : base).toLocaleString(); })()}</strong>이 적립됩니다.
      </p>
      <Btn onClick={() => navigate('/panel')}>대시보드로 →</Btn>
    </div>
  );

  /* ─── 제출 확인 모달 포털 (서브·이미지·텍스트 폼 공통) ─── */
  const submitConfirmPortal = showSubmitConfirm && ReactDOM.createPortal(
    <div onClick={() => setShowSubmitConfirm(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9000 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg)', borderRadius: 'var(--radius-lg)', padding: '40px', width: 'max-content', maxWidth: '90vw', border: '1px solid var(--border)', animation: 'fadeUp 0.2s ease both' }}>
        <div style={{ fontSize: 13, fontFamily: 'var(--font-sans)', color: 'var(--text-2)', marginBottom: 12, letterSpacing: '0.1em' }}>SUBMIT CHECK</div>
        <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 24 }}>피드백을 제출할까요?</h2>
        <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', padding: '20px 22px', marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 15 }}>
          {[
            '구체적인 이유·개선 방향이 담긴 피드백일수록 승인 확률이 높아집니다.',
            '글자 수가 많을수록 승인 가능성이 높아집니다.',
            '반려된 피드백은 보상이 지급되지 않습니다.',
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
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
          <Btn variant="secondary" onClick={() => setShowSubmitConfirm(false)}>아니요, 더 검토할게요</Btn>
          <Btn
            onClick={() => {
              setShowSubmitConfirm(false);
              if (pendingSubmitRef.current) {
                pendingSubmitRef.current();
                pendingSubmitRef.current = null;
              }
            }}
            disabled={submitConfirmCountdown > 0}
          >
            {submitConfirmCountdown > 0 ? `${submitConfirmCountdown}초 후 제출 가능` : '네, 제출합니다 →'}
          </Btn>
        </div>
      </div>
    </div>,
    document.body
  );

  /* ─── 서브 미션 폼 ─── */
  if (isSubMission && step >= 1) {
    const parsedDesc = parseSubDesc(mission.description, missionType);
    const emailGoal = missionType === 'email' ? resolveEmailGoal(parsedDesc) : null;

    // selectedQuestions 우선, 없으면 구 포맷(templateQuestions + customQuestions) 폴백
    const allTypedQs = parsedDesc.selectedQuestions
      ? parsedDesc.selectedQuestions
      : [
          ...(parsedDesc.templateQuestions || []),
          ...(parsedDesc.customQuestions || [])
            .filter(Boolean)
            .map(q => typeof q === 'string'
              ? { id: q, text: q, type: 'text', options: [] }
              : q
            ),
        ];

    const setCustomAnswer = (questionId, questionText, type, answer) => {
      setCustomAnswers(prev => {
        const idx = prev.findIndex(a => a.questionId === questionId);
        const entry = { questionId, questionText, type, answer };
        return idx >= 0 ? prev.map((a, i) => i === idx ? entry : a) : [...prev, entry];
      });
    };

    const getCustomAnswer = (questionId) =>
      customAnswers.find(a => a.questionId === questionId)?.answer;

    const allTypedQsAnswered = () => allTypedQs.every(q => {
      const ans = getCustomAnswer(q.id);
      if (ans === undefined || ans === null || ans === '') return false;
      if (q.type === 'text') return String(ans).trim().length >= 10;
      return true;
    });

    const ScoreRow = ({ label, value, setter }) => (
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 12, fontFamily: 'var(--font-sans)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>{label}</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {[1, 2, 3, 4, 5].map(n => (
            <button key={n} onClick={() => setter(n)} style={{
              flex: 1, padding: '10px 0', borderRadius: 'var(--radius)',
              background: value === n ? 'var(--accent)' : value > n ? 'var(--accent-dim)' : 'var(--surface-2)',
              color: value === n ? '#FFF' : 'var(--text-2)',
              border: `1px solid ${value >= n ? 'var(--accent)' : 'var(--border)'}`,
              fontWeight: 700, fontSize: 15, cursor: 'pointer', transition: 'all 0.15s',
            }}>{n}</button>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-3)', marginTop: 4 }}>
          <span>매우 낮음</span><span>매우 높음</span>
        </div>
      </div>
    );

    const canSubmit = () => {
      const baseOk = (() => {
        if (missionType === 'preference') return prefChoice && prefClarity && prefIntent && prefComment.trim().length >= 30;
        if (missionType === 'pricing') return priceWouldBuy !== null && priceFairness && priceValue && priceComment.trim().length >= 30;
        if (missionType === 'email') return emailWouldReply !== null && emailHook && emailClarity && emailOpenIntent && emailCuriosity && emailComment.trim().length >= 30;
        return false;
      })();
      return baseOk && (allTypedQs.length === 0 || allTypedQsAnswered());
    };

    return (
      <div className="page-wrap" style={{ padding: '40px 48px', maxWidth: 760, animation: 'fadeUp 0.4s ease both' }}>
        <button onClick={() => setStep(0)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', padding: 0, marginBottom: 14, fontSize: 13, fontWeight: 600, color: 'var(--text-2)', cursor: 'pointer' }}>
          ← 브리핑으로
        </button>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 24 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12, fontFamily: 'var(--font-sans)', color: 'var(--green)', marginBottom: 4, letterSpacing: '0.1em' }}>FEEDBACK</div>
            <h1 style={{ fontSize: 24, fontWeight: 800 }}>{mission.title}</h1>
          </div>
          <div style={{ flexShrink: 0 }}>{autoSaveBadgeEl}</div>
        </div>
        {deadlineBannerEl}

        {/* 소재 비교 A/B */}
        {missionType === 'preference' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {(() => {
              const meta = resolveAssetType(parsedDesc);
              if (!meta) return null;
              return (
                <div style={{ padding: '12px 16px', background: 'var(--accent-dim2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>검증 유형</span>
                  <Badge type="blue">{meta.label}</Badge>
                  {meta.desc && <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{meta.desc}</span>}
                </div>
              );
            })()}
            {parsedDesc.productDescription && (
              <div style={{ padding: '12px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6 }}>
                <div style={{ fontSize: 11, fontFamily: 'var(--font-sans)', color: 'var(--text-3)', marginBottom: 6, textTransform: 'uppercase' }}>제품 설명</div>
                {parsedDesc.productDescription}
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {[['A', parsedDesc.variantA, parsedDesc.variantAImage, 'var(--blue)'], ['B', parsedDesc.variantB, parsedDesc.variantBImage, 'var(--accent)']].map(([label, text, imgUrl, color]) => (
                <div key={label} onClick={() => setPrefChoice(label)} style={{ padding: '16px', borderRadius: 'var(--radius)', border: `2px solid ${prefChoice === label ? color : 'var(--border)'}`, background: 'var(--surface)', cursor: 'pointer', transition: 'all 0.15s' }}>
                  <div style={{ fontWeight: 800, fontSize: 16, color, marginBottom: 10 }}>소재 {label} {prefChoice === label ? '✓' : ''}</div>
                  {imgUrl && (
                    <img src={imgUrl} alt={`소재 ${label}`} style={{ width: '100%', borderRadius: 'var(--radius)', marginBottom: 10, objectFit: 'cover', maxHeight: 160 }} />
                  )}
                  <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{text}</div>
                </div>
              ))}
            </div>
            {prefChoice && <div style={{ fontSize: 12, color: 'var(--green)', fontWeight: 600, textAlign: 'center' }}>✓ 소재 {prefChoice}를 선택했습니다</div>}
            <Card>
              <ScoreRow label="메시지 명확성 (선택한 소재)" value={prefClarity} setter={setPrefClarity} />
              <ScoreRow label="구매 전환 의향 (선택한 소재)" value={prefIntent} setter={setPrefIntent} />
            </Card>
            {allTypedQs.length > 0 && <TypedQuestionsBlock qs={allTypedQs} get={getCustomAnswer} set={setCustomAnswer} />}
            <Card>
              <div style={{ fontSize: 11, fontFamily: 'var(--font-sans)', color: 'var(--green)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>총 평가</div>
              <div style={{ fontSize: 12, fontFamily: 'var(--font-sans)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>선택 이유 및 개선 의견</div>
              <textarea value={prefComment} onChange={e => setPrefComment(e.target.value)} rows={4} placeholder="어떤 이유로 해당 소재를 선택했는지, 개선할 점은 무엇인지 구체적으로 작성해주세요." style={{ resize: 'vertical' }} />
              <div style={{ marginTop: 6, fontSize: 11, fontFamily: 'var(--font-sans)', color: charCountMeta(prefComment).color, fontWeight: 600 }}>
                {charCountMeta(prefComment).label}
              </div>
            </Card>
          </div>
        )}

        {/* 가격 페이지 */}
        {missionType === 'pricing' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {(parsedDesc.content || parsedDesc.image) && (
              <div style={{ padding: '16px 20px', background: 'var(--surface)', borderRadius: 'var(--radius)', fontSize: 13, color: 'var(--text-2)', lineHeight: 1.7, border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 11, fontFamily: 'var(--font-sans)', color: 'var(--text-3)', marginBottom: 8, textTransform: 'uppercase' }}>가격 구성</div>
                {parsedDesc.image && (
                  <img src={parsedDesc.image} alt="가격 페이지" style={{ width: '100%', borderRadius: 'var(--radius)', marginBottom: 10, objectFit: 'cover', maxHeight: 240 }} />
                )}
                {parsedDesc.content && <div style={{ whiteSpace: 'pre-wrap' }}>{parsedDesc.content}</div>}
              </div>
            )}
            {parsedDesc.productDescription && (
              <div style={{ padding: '12px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6 }}>
                <div style={{ fontSize: 11, fontFamily: 'var(--font-sans)', color: 'var(--text-3)', marginBottom: 6, textTransform: 'uppercase' }}>제품 설명</div>
                {parsedDesc.productDescription}
              </div>
            )}
            <Card>
              <ScoreRow label="가격 적절성 (시장 대비)" value={priceFairness} setter={setPriceFairness} />
              <ScoreRow label="가격 대비 가치 인식" value={priceValue} setter={setPriceValue} />
              <div style={{ fontSize: 12, fontFamily: 'var(--font-sans)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>구매 의향</div>
              <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
                {[['있음', true], ['없음', false]].map(([label, val]) => (
                  <button key={label} onClick={() => setPriceWouldBuy(val)} style={{ flex: 1, padding: '10px', borderRadius: 'var(--radius)', border: `1.5px solid ${priceWouldBuy === val ? (val ? 'var(--green)' : 'var(--red)') : 'var(--border)'}`, background: priceWouldBuy === val ? (val ? 'rgba(74,222,128,0.1)' : 'rgba(239,68,68,0.08)') : 'var(--surface)', fontWeight: 600, fontSize: 14, cursor: 'pointer', transition: 'all 0.15s', color: priceWouldBuy === val ? (val ? 'var(--green)' : 'var(--red)') : 'var(--text-2)' }}>
                    구매 의향 {label}
                  </button>
                ))}
              </div>
            </Card>
            {allTypedQs.length > 0 && <TypedQuestionsBlock qs={allTypedQs} get={getCustomAnswer} set={setCustomAnswer} />}
            <Card>
              <div style={{ fontSize: 11, fontFamily: 'var(--font-sans)', color: 'var(--green)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>총 평가</div>
              <div style={{ fontSize: 12, fontFamily: 'var(--font-sans)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>가격 피드백 (구매 장벽, 개선점)</div>
              <textarea value={priceComment} onChange={e => setPriceComment(e.target.value)} rows={4} placeholder="가격에서 망설여지는 부분, 더 합리적이라고 느끼기 위해 필요한 것 등을 구체적으로 적어주세요." style={{ resize: 'vertical' }} />
              <div style={{ marginTop: 6, fontSize: 11, fontFamily: 'var(--font-sans)', color: charCountMeta(priceComment).color, fontWeight: 600 }}>
                {charCountMeta(priceComment).label}
              </div>
            </Card>
          </div>
        )}

        {/* 이메일 */}
        {missionType === 'email' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {emailGoal && (
              <div style={{ padding: '12px 16px', background: 'var(--accent-dim2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>전환 목표</span>
                <Badge type="blue">{emailGoal.label}</Badge>
                <span style={{ fontSize: 12, color: 'var(--text-2)' }}>이 이메일이 유도하려는 행동</span>
              </div>
            )}
            <div style={{ padding: '16px 20px', background: 'var(--surface)', borderRadius: 'var(--radius)', fontSize: 13, color: 'var(--text-2)', lineHeight: 1.8, whiteSpace: 'pre-wrap', border: '1px solid var(--border)', fontFamily: 'inherit', maxHeight: 280, overflowY: 'auto' }}>
              <div style={{ fontSize: 11, fontFamily: 'var(--font-sans)', color: 'var(--text-3)', marginBottom: 10, textTransform: 'uppercase' }}>이메일 원문</div>
              {parsedDesc.content || mission.description}
            </div>
            {parsedDesc.productDescription && (
              <div style={{ padding: '12px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6 }}>
                <div style={{ fontSize: 11, fontFamily: 'var(--font-sans)', color: 'var(--text-3)', marginBottom: 6, textTransform: 'uppercase' }}>제품 설명</div>
                {parsedDesc.productDescription}
              </div>
            )}
            <Card>
              <ScoreRow label="제목줄 개봉 의향" value={emailOpenIntent} setter={setEmailOpenIntent} />
              <ScoreRow label="훅 강도 (첫 문장)" value={emailHook} setter={setEmailHook} />
              <ScoreRow label="메시지 명확성" value={emailClarity} setter={setEmailClarity} />
              <ScoreRow label="호기심/행동 욕구" value={emailCuriosity} setter={setEmailCuriosity} />
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>이 이메일을 보면 목표대로 행동하시겠어요?</div>
              {emailGoal && <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 10 }}>목표: {emailGoal.label}</div>}
              <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
                {[['그렇다', true], ['아니다', false]].map(([label, val]) => (
                  <button key={label} onClick={() => setEmailWouldReply(val)} style={{ flex: 1, padding: '10px', borderRadius: 'var(--radius)', border: `1.5px solid ${emailWouldReply === val ? (val ? 'var(--green)' : 'var(--red)') : 'var(--border)'}`, background: emailWouldReply === val ? (val ? 'rgba(74,222,128,0.1)' : 'rgba(239,68,68,0.08)') : 'var(--surface)', fontWeight: 600, fontSize: 14, cursor: 'pointer', transition: 'all 0.15s', color: emailWouldReply === val ? (val ? 'var(--green)' : 'var(--red)') : 'var(--text-2)' }}>
                    {label}
                  </button>
                ))}
              </div>
            </Card>
            {allTypedQs.length > 0 && <TypedQuestionsBlock qs={allTypedQs} get={getCustomAnswer} set={setCustomAnswer} />}
            <Card>
              <div style={{ fontSize: 11, fontFamily: 'var(--font-sans)', color: 'var(--green)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>총 평가</div>
              <div style={{ fontSize: 12, fontFamily: 'var(--font-sans)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>이메일 피드백</div>
              <textarea value={emailComment} onChange={e => setEmailComment(e.target.value)} rows={4} placeholder="가장 인상적인 부분과 개선이 필요한 부분을 구체적으로 작성해주세요." style={{ resize: 'vertical' }} />
              <div style={{ marginTop: 6, fontSize: 11, fontFamily: 'var(--font-sans)', color: charCountMeta(emailComment).color, fontWeight: 600 }}>
                {charCountMeta(emailComment).label}
              </div>
            </Card>
          </div>
        )}

        {submitError && (
          <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 'var(--radius)', background: 'rgba(239,68,68,0.08)', color: 'var(--red,#ef4444)', fontSize: 13, fontWeight: 600 }}>
            {submitError}
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
          <Btn disabled={!canSubmit() || submitting} onClick={() => { setSubmitError(''); pendingSubmitRef.current = handleSubMissionSubmit; setShowSubmitConfirm(true); }}>
            {submitting ? '제출 중...' : '피드백 제출하기 →'}
          </Btn>
        </div>
        {submitConfirmPortal}
      </div>
    );
  }

  /* ─── 이미지 어노테이션 모드 ─── */
  if (hasImages && step >= 1) {
    const imageUrls = mission.image_urls;
    const curAnns   = annotations.filter(a => a.image_index === currentImageIdx && a.dimension === activeDimension);

    // 코멘트 미작성(빈 코멘트) 영역이 하나라도 있으면 미완료 — 차원 완료·총평 진입·제출 모두 차단
    const hasEmptyComment = annotations.some(a => !(a.comment || '').trim());
    const dimDone = Object.fromEntries(
      Object.keys(DIM_META).map(k => [k, annotations.some(a => a.dimension === k && (a.comment || '').trim()) || skippedDims[k]])
    );
    const allDimsDone    = Object.values(dimDone).every(Boolean);
    const allImagesViewed = viewedImages.size >= imageUrls.length;
    const lpQsAnswered = lpTypedQs.length === 0 || lpTypedQs.every(q => {
      const a = customAnswers.find(x => x.questionId === q.id)?.answer;
      if (a === undefined || a === null || a === '') return false;
      if (q.type === 'text') return String(a).trim().length >= 10;
      return true;
    });
    const canSubmitImage = allDimsDone && allImagesViewed && !hasEmptyComment && overallComment.trim().length >= 30 && lpQsAnswered;

    return (
      <div className="page-wrap" style={{ padding: '40px 48px', maxWidth: 1400, animation: 'fadeUp 0.4s ease both' }}>
        {deadlineBannerEl}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 12, fontFamily: 'var(--font-sans)', color: 'var(--green)', marginBottom: 4, letterSpacing: '0.1em' }}>ANNOTATION MODE</div>
            <h1 style={{ fontSize: 24, fontWeight: 800 }}>{mission.title}</h1>
          </div>
          {autoSaveBadgeEl}
        </div>

        {/* 검증 포커스 리마인더 — 기업이 지정한 중점 항목을 보며 피드백 */}
        {Array.isArray(mission.assets) && mission.assets.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', marginBottom: 16 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>검증 포커스:</span>
            {mission.assets.map((a, i) => <Badge key={i} type="blue">{a}</Badge>)}
          </div>
        )}

        {/* 차원 선택 탭 — 전체 폭, split 위에 배치 */}
        <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 8 }}>
          아래 탭을 클릭하고 이미지를 드래그하세요. 같은 탭에서 여러 번 드래그 할 수 있습니다.
        </p>
        <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          {Object.entries(DIM_META).map(([key, meta]) => {
            const count    = annotations.filter(a => a.dimension === key).length;
            const done     = count > 0;
            const skipped  = skippedDims[key];
            const isActive = activeDimension === key;
            return (
              <button
                key={key}
                onClick={() => attemptSwitchDimension(key)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '7px 14px', borderRadius: 'var(--radius)', fontSize: 12, fontWeight: 700,
                  cursor: 'pointer', border: '2px solid',
                  borderColor: isActive ? (skipped ? '#94a3b8' : meta.color) : (done || skipped) ? (skipped ? '#94a3b8' : meta.color) : 'var(--border)',
                  background: isActive ? (skipped ? '#94a3b8' : meta.color) : skipped ? 'rgba(148,163,184,0.18)' : done ? meta.bg : 'var(--surface)',
                  color: isActive ? '#fff' : skipped ? '#94a3b8' : done ? meta.color : 'var(--text-2)',
                  transition: 'all 0.12s',
                  opacity: skipped && !isActive ? 0.75 : 1,
                }}
              >
                {skipped && !isActive && <span>—</span>}
                {!done && !skipped && <span style={{ fontSize: 10, opacity: 0.5 }}>○</span>}
                {meta.label}
                {count > 0 && !skipped && (
                  <span style={{
                    background: isActive ? 'rgba(255,255,255,0.25)' : 'var(--bg)',
                    borderRadius: 10, padding: '1px 6px', fontSize: 10,
                    color: isActive ? '#fff' : meta.color,
                  }}>{count}</span>
                )}
                {skipped && (
                  <span style={{
                    background: isActive ? 'rgba(255,255,255,0.25)' : 'rgba(148,163,184,0.2)',
                    borderRadius: 10, padding: '1px 6px', fontSize: 10,
                    color: isActive ? '#fff' : '#94a3b8',
                  }}>N/A</span>
                )}
              </button>
            );
          })}
        </div>

        {/* 현재 활성 차원 — 피드백 없음 체크박스 — 콘텐츠 너비만큼 */}
        <div style={{ display: 'inline-flex', alignItems: 'center', marginBottom: 12, padding: '7px 12px', background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, color: 'var(--text-2)', userSelect: 'none' }}>
            <input
              type="checkbox"
              checked={skippedDims[activeDimension]}
              onChange={() => toggleSkipDim(activeDimension)}
              style={{ width: 14, height: 14, cursor: 'pointer', accentColor: '#94a3b8' }}
            />
            <span>
              <strong style={{ color: DIM_META[activeDimension]?.color }}>{DIM_META[activeDimension]?.label}</strong>
              {' '}차원에는 피드백할 내용이 없습니다
            </span>
          </label>
        </div>

        {/* 이미지 탭 — 전체 폭, split 위에 배치 */}
        {imageUrls.length > 1 && (
          <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            {imageUrls.map((_, i) => (
              <button
                key={i}
                onClick={() => {
                  // 현재 이미지에 코멘트 미작성 영역이 있으면 이미지 전환 차단 + 경고
                  if (hasEmptyCommentAt(activeDimension, currentImageIdx)) { setCommentWarn(true); return; }
                  setCommentWarn(false);
                  setCurrentImageIdx(i);
                  setViewedImages(prev => { const s = new Set(prev); s.add(i); return s; });
                }}
                style={{
                  padding: '5px 14px', borderRadius: 'var(--radius)', fontSize: 12, fontWeight: 600,
                  cursor: 'pointer', border: '1.5px solid',
                  borderColor: currentImageIdx === i ? 'var(--accent)' : viewedImages.has(i) ? 'var(--accent)' : 'var(--border)',
                  background: currentImageIdx === i ? 'var(--accent)' : 'var(--surface)',
                  color: currentImageIdx === i ? '#fff' : viewedImages.has(i) ? 'var(--accent)' : 'var(--text-2)',
                  transition: 'all 0.12s',
                  opacity: viewedImages.has(i) ? 1 : 0.6,
                }}
              >
                이미지 {i + 1}
                {viewedImages.has(i) && (
                  <span style={{ marginLeft: 4 }}>✓</span>
                )}
                {annotations.filter(a => a.image_index === i).length > 0 && (
                  <span style={{ marginLeft: 5, background: 'rgba(16,54,125,0.15)', borderRadius: 10, padding: '1px 6px', fontSize: 10 }}>
                    {annotations.filter(a => a.image_index === i).length}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* 좌우 분할 레이아웃 */}
        <div className="dim-tab-layout">
          {/* ── 왼쪽: 이미지 고정 영역 ── */}
          <div className="dim-tab-left">
            {/* 어노테이터 */}
            <div style={{ borderRadius: 'var(--radius-lg)', overflow: 'hidden', position: 'relative' }}>
              <ImageAnnotator
                imageUrl={imageUrls[currentImageIdx]}
                imageIndex={currentImageIdx}
                annotations={curAnns}
                onAdd={handleAddAnnotation}
                onRemove={handleRemoveAnnotation}
                readonly={false}
                dragDisabled={skippedDims[activeDimension]}
                activeDimension={activeDimension}
              />
              {/* 전체보기 버튼 */}
              <button
                onClick={() => setImgFullscreen(true)}
                style={{
                  position: 'absolute', bottom: 10, right: 10,
                  width: 32, height: 32,
                  background: 'rgba(0,0,0,0.55)', border: 'none',
                  borderRadius: 6, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', transition: 'background 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.8)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(0,0,0,0.55)'}
                title="전체 보기"
              >
                {/* Maximize icon */}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 3 21 3 21 9" />
                  <polyline points="9 21 3 21 3 15" />
                  <line x1="21" y1="3" x2="14" y2="10" />
                  <line x1="3" y1="21" x2="10" y2="14" />
                </svg>
              </button>
            </div>
          </div>

          {/* ── 오른쪽: 코멘트 영역 ── */}
          <div className="dim-tab-right" style={{ width: 420 }}>
            {annDeleteError && (
              <div style={{ marginBottom: 12, padding: '8px 12px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius)', color: 'var(--red)', fontSize: 13 }}>
                {annDeleteError}
              </div>
            )}
            {/* 코멘트 박스 — 현재 이미지의 어노테이션별 */}
            {curAnns.length > 0 ? (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontFamily: 'var(--font-sans)', color: 'var(--text-3)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>
                  코멘트 작성 ({curAnns.length}개 영역)
                </div>
                {commentWarn && curAnns.some(a => !(a.comment || '').trim()) && (
                  <div style={{ marginBottom: 10, padding: '9px 12px', borderRadius: 'var(--radius)', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.35)', color: 'var(--red,#ef4444)', fontSize: 12.5, fontWeight: 600, lineHeight: 1.5 }}>
                    ⚠️ 작성하지 않은 코멘트가 있습니다. 코멘트를 입력하거나 ✕로 영역을 삭제한 뒤 진행해 주세요.
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {curAnns.map(ann => {
                    const meta = DIM_META[ann.dimension];
                    const seqNum = curAnns.filter(a => a.dimension === ann.dimension).findIndex(a => a.id === ann.id) + 1;
                    return (
                      <div key={ann.id} style={{
                        border: '1px solid var(--border)',
                        borderLeft: `3px solid ${meta.color}`,
                        borderRadius: 'var(--radius)',
                        padding: '12px 14px',
                        background: 'var(--surface)',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                          <span style={{ background: meta.color, color: '#fff', borderRadius: 4, padding: '2px 8px', fontSize: 12, fontWeight: 700 }}>
                            {meta.short}{seqNum}
                          </span>
                          <span style={{ fontSize: 12, color: 'var(--text-2)', fontWeight: 600 }}>{meta.label}</span>
                          <span style={{ fontSize: 12, color: 'var(--text-2)', fontFamily: 'var(--font-sans)' }}>{ann.score}점</span>
                          <button
                            onClick={() => handleRemoveAnnotation(ann.id)}
                            style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', fontSize: 13, lineHeight: 1, padding: '2px 4px', borderRadius: 3 }}
                            title="영역 삭제"
                          >✕</button>
                        </div>
                        <textarea
                          value={ann.comment || ''}
                          onChange={e => handleUpdateAnnotationComment(ann.id, e.target.value)}
                          placeholder="구체적인 이유와 개선 방향을 포함하여 작성해주세요."
                          rows={3}
                          style={{
                            width: '100%', boxSizing: 'border-box',
                            padding: '8px 10px', borderRadius: 'var(--radius)',
                            border: commentWarn && !(ann.comment || '').trim() ? '1.5px solid var(--red,#ef4444)' : '1px solid var(--border)',
                            background: 'var(--bg)',
                            color: 'var(--text)', fontSize: 13, lineHeight: 1.6,
                            resize: 'vertical', fontFamily: 'inherit',
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
                <div style={{ marginTop: 10, fontSize: 13, fontWeight: 600, color: 'var(--text-2)', textAlign: 'center', lineHeight: 1.6 }}>
                  {DIM_META[activeDimension]?.label}에 관한 코멘트를 추가로 남기려면<br />이미지를 다시 드래그하세요.
                </div>
              </div>
            ) : (
              <div style={{ marginBottom: 16, padding: '32px 20px', textAlign: 'center', background: 'var(--surface)', border: '1px dashed var(--border)', borderRadius: 'var(--radius-lg)' }}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>✏️</div>
                <div style={{ fontSize: 13, color: 'var(--text-3)', lineHeight: 1.6 }}>
                  이미지 위를 드래그해서<br />영역을 지정하면<br />코멘트 박스가 여기에 표시됩니다
                </div>
              </div>
            )}

            {/* 진행 현황 힌트 */}
            {!allDimsDone || !allImagesViewed ? (
              <div style={{ marginTop: 8, padding: '14px 16px', background: 'var(--surface)', border: '1.5px dashed var(--text-3)', borderRadius: 'var(--radius)', fontSize: 14, fontWeight: 600, color: 'var(--text-2)', textAlign: 'center', lineHeight: 1.6 }}>
                5대 지표 작성 완료 및 모든 이미지 확인 후 총평 작성 가능
              </div>
            ) : hasEmptyComment ? (
              <div style={{ marginTop: 8, padding: '14px 16px', background: 'rgba(239,68,68,0.06)', border: '1.5px dashed rgba(239,68,68,0.45)', borderRadius: 'var(--radius)', fontSize: 14, fontWeight: 600, color: 'var(--red,#ef4444)', textAlign: 'center', lineHeight: 1.6 }}>
                작성하지 않은 코멘트가 있어 총평으로 넘어갈 수 없습니다.<br />각 차원 탭에서 빈 코멘트를 채우거나 영역을 삭제해 주세요.
              </div>
            ) : (
              <button
                onClick={() => bottomSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                style={{ marginTop: 8, width: '100%', padding: '12px 14px', background: 'rgba(22,163,74,0.07)', border: '1.5px solid rgba(22,163,74,0.3)', borderRadius: 'var(--radius)', fontSize: 12, color: '#16a34a', fontWeight: 600, textAlign: 'center', cursor: 'pointer' }}
              >
                ✓ 아래에서 총평을 작성해 주세요 ↓
              </button>
            )}

            <div style={{ marginTop: 12 }}>
              <Btn variant="secondary" onClick={() => setStep(0)}>브리핑으로</Btn>
            </div>
          </div>
        </div>

        {/* ── 추가 질문 + 총평 + 제출 — 소재 아래 ── */}
        {allDimsDone && allImagesViewed && !hasEmptyComment && (
          <div ref={bottomSectionRef} style={{ marginTop: 32, borderTop: '2px solid var(--border)', paddingTop: 28 }}>
            <div style={{ fontSize: 12, fontFamily: 'var(--font-sans)', color: '#16a34a', marginBottom: 16, letterSpacing: '0.06em', fontWeight: 700 }}>
              ✓ 모든 차원 평가 완료 — 총평 및 추가 질문을 작성해 주세요
            </div>

            {lpTypedQs.length > 0 && (
              <Card style={{ marginBottom: 16 }}>
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12 }}>추가 질문</div>
                <TypedQuestionsBlock
                  qs={lpTypedQs}
                  get={id => customAnswers.find(a => a.questionId === id)?.answer}
                  set={(qId, qText, type, ans) => setCustomAnswers(prev => {
                    const idx = prev.findIndex(a => a.questionId === qId);
                    const entry = { questionId: qId, questionText: qText, type, answer: ans };
                    return idx >= 0 ? prev.map((a, i) => i === idx ? entry : a) : [...prev, entry];
                  })}
                />
              </Card>
            )}

            <Card style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontFamily: 'var(--font-sans)', color: 'var(--text-2)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10, fontWeight: 700 }}>
                총평 (필수)
              </div>
              <textarea
                value={overallComment}
                onChange={e => setOverallComment(e.target.value)}
                placeholder="전반적인 인상, 가장 개선이 필요한 부분, 특히 좋았던 점을 자유롭게 작성해주세요."
                rows={5}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  padding: '10px 12px', borderRadius: 'var(--radius)',
                  border: '1px solid var(--border)', background: 'var(--bg)',
                  color: 'var(--text)', fontSize: 13, lineHeight: 1.6,
                  resize: 'vertical', fontFamily: 'inherit',
                }}
              />
              <div style={{ marginTop: 6, fontSize: 11, fontFamily: 'var(--font-sans)', color: charCountMeta(overallComment).color, fontWeight: 600 }}>
                {charCountMeta(overallComment).label}
              </div>
            </Card>

            {submitError && (
              <div style={{ marginBottom: 12, padding: '10px 14px', borderRadius: 'var(--radius)', background: 'rgba(239,68,68,0.08)', color: 'var(--red,#ef4444)', fontSize: 13, fontWeight: 600 }}>
                {submitError}
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Btn
                disabled={!canSubmitImage || submitting}
                onClick={() => { setSubmitError(''); pendingSubmitRef.current = handleSubmit; setShowSubmitConfirm(true); }}
              >
                {submitting ? '제출 중...' : '피드백 제출하기 →'}
              </Btn>
            </div>
          </div>
        )}

        {/* 이미지 전체보기 모달 */}
        {imgFullscreen && ReactDOM.createPortal(
          <div
            onClick={() => setImgFullscreen(false)}
            style={{
              position: 'fixed', inset: 0, zIndex: 9999,
              background: 'rgba(0,0,0,0.88)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'zoom-out',
            }}
          >
            <img
              src={imageUrls[currentImageIdx]}
              alt="소재 전체보기"
              onClick={e => e.stopPropagation()}
              style={{
                maxWidth: '92vw', maxHeight: '92vh',
                objectFit: 'contain',
                borderRadius: 8,
                cursor: 'default',
                boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
              }}
            />
            <button
              onClick={() => setImgFullscreen(false)}
              style={{
                position: 'fixed', top: 20, right: 24,
                background: 'rgba(255,255,255,0.15)', border: 'none',
                borderRadius: 8, cursor: 'pointer',
                width: 36, height: 36,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>,
          document.body
        )}

        {cancelModal && (
          <ConfirmModal
            title="수락을 취소할까요?"
            desc={`작성 중이던 피드백 초안이 모두 삭제됩니다.\n이 미션은 다시 참여가능 목록으로 돌아갑니다.`}
            confirmLabel={cancelConfirming ? '처리 중...' : '수락 취소'}
            cancelLabel="계속 작성하기"
            danger
            onConfirm={handleCancelAccept}
            onCancel={() => setCancelModal(false)}
            errorMsg={cancelError}
          />
        )}
        {submitConfirmPortal}
      </div>
    );
  }

  return null;
}
