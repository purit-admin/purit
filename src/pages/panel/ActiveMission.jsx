import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, Btn, Badge, ConfirmModal } from '../../components/ui';
import ImageAnnotator from '../../components/ui/ImageAnnotator';
import { supabase } from '../../lib/supabase';
import { sendNotification } from '../../lib/notify';

const SECTIONS = [
  { key: 'clarity',         label: '명확성',   desc: '첫 화면 메시지가 타겟에게 즉시 이해되는가?' },
  { key: 'relevance',       label: '관련성',   desc: '콘텐츠가 타겟 페르소나의 니즈에 정확히 맞는가?' },
  { key: 'value',           label: '가치',     desc: '제품/서비스의 가치가 명확하게 전달되는가?' },
  { key: 'differentiation', label: '차별화',   desc: '경쟁 대비 차별점이 설득력 있게 드러나는가?' },
  { key: 'trust',           label: '신뢰',     desc: 'CTA, 소셜 프루프, 보증이 구매 신뢰를 만드는가?' },
];

const DIM_LABEL = { clarity: '명확성', relevance: '관련성', value: '가치', differentiation: '차별화', trust: '신뢰' };

const DIM_META = {
  clarity:         { label: '명확성', short: '명', color: '#34C759', bg: 'rgba(52,199,89,0.12)'   },
  relevance:       { label: '관련성', short: '관', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)'  },
  value:           { label: '가치',   short: '가', color: '#6366f1', bg: 'rgba(99,102,241,0.12)'  },
  differentiation: { label: '차별화', short: '차', color: '#ef4444', bg: 'rgba(239,68,68,0.12)'   },
  trust:           { label: '신뢰',   short: '신', color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' },
};

const hasDraftProgress = (fb) => {
  if (fb.clarity_score || fb.relevance_score || fb.value_score || fb.differentiation_score || fb.trust_score) return true;
  if (!fb.strengths) return false;
  try {
    const saved = JSON.parse(fb.strengths);
    if (saved.__subType || saved.__comments || saved.customAnswers?.length) return true;
    return Object.values(saved).some(v => v && typeof v === 'string' && v.trim());
  } catch { return false; }
};

function parseCommentsFromSuggestions(suggestions) {
  const result = { clarity: '', relevance: '', value: '', differentiation: '', trust: '' };
  const labelMap = { '명확성': 'clarity', '관련성': 'relevance', '가치': 'value', '차별화': 'differentiation', '신뢰': 'trust' };
  const sections = (suggestions || '').split('\n\n');
  for (const section of sections) {
    const lines = section.split('\n');
    const m = lines[0]?.match(/^\[(.+)\]$/);
    if (m && labelMap[m[1]]) result[labelMap[m[1]]] = lines.slice(1).join('\n');
  }
  return result;
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
                  <span>매우 낮음</span><span>매우 높음</span>
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
  const [panel, setPanel]   = useState(null);
  const [drafts, setDrafts] = useState(null);

  // ── FORM VIEW ──
  const [mission, setMission]   = useState(null);
  const [step, setStep]         = useState(0);
  const [scores, setScores]     = useState({ clarity: 0, relevance: 0, value: 0, differentiation: 0, trust: 0 });
  const [comments, setComments] = useState({ clarity: '', relevance: '', value: '', differentiation: '', trust: '' });
  const [purityWarning, setPurityWarning] = useState('');
  const [submitting, setSubmitting]       = useState(false);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);
  const [draftId, setDraftId]             = useState(null);
  const [autoSaving, setAutoSaving]       = useState(false);
  const autoSaveTimer = useRef(null);
  const commentUpdateTimers = useRef({});
  const [isResubmit, setIsResubmit]           = useState(false);
  const [cancelModal, setCancelModal]         = useState(false);
  const [cancelConfirming, setCancelConfirming] = useState(false);

  // ── IMAGE ANNOTATION ──
  const [annotations, setAnnotations]         = useState([]);
  const [currentImageIdx, setCurrentImageIdx] = useState(0);
  const [viewedImages, setViewedImages]       = useState(() => new Set([0]));
  const [activeDimension, setActiveDimension] = useState('clarity');
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

  useEffect(() => {
    setMission(null);
    setStep(0);
    setScores({ clarity: 0, relevance: 0, value: 0, differentiation: 0, trust: 0 });
    setComments({ clarity: '', relevance: '', value: '', differentiation: '', trust: '' });
    setAlreadySubmitted(false);
    setDraftId(null);
    setAnnotations([]);
    setCustomAnswers([]);
    setCurrentImageIdx(0);
    setViewedImages(new Set([0]));
    setActiveDimension('clarity');
    setOverallComment('');
    setSkippedDims({ clarity: false, relevance: false, value: false, differentiation: false, trust: false });

    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: p } = await supabase.from('panels').select('*').eq('user_id', user.id).single();
      setPanel(p);

      if (missionId) {
        const { data: ms } = await supabase.from('missions').select('*').eq('id', missionId).single();
        setMission(ms || false);

        if (ms && p) {
          const { data: existing } = await supabase
            .from('feedbacks')
            .select('id, status, clarity_score, relevance_score, value_score, differentiation_score, trust_score, strengths')
            .eq('mission_id', ms.id)
            .eq('panel_id', p.id)
            .limit(1);

          if (existing && existing.length > 0) {
            const fb = existing[0];
            const willResubmit = Boolean(resubmitId && fb.id === resubmitId && fb.status === 'rejected');

            if (willResubmit) {
              // 반려된 피드백을 draft로 되돌려 재작성 모드 진입
              await supabase.from('feedbacks').update({ status: 'draft' }).eq('id', fb.id);
              setDraftId(fb.id);
              setIsResubmit(true);
              setScores({
                clarity:         fb.clarity_score         || 0,
                relevance:       fb.relevance_score       || 0,
                value:           fb.value_score           || 0,
                differentiation: fb.differentiation_score || 0,
                trust:           fb.trust_score           || 0,
              });
              if (ms.image_urls?.length > 0) {
                const { data: anns } = await supabase.from('feedback_annotations').select('*').eq('feedback_id', fb.id).order('created_at');
                setAnnotations(anns || []);
                if (fb.suggestions) {
                  const overallMatch = fb.suggestions.match(/\[총평\]\n([\s\S]*)$/);
                  if (overallMatch) setOverallComment(overallMatch[1].trim());
                  const dimMap = { '명확성': 'clarity', '관련성': 'relevance', '가치': 'value', '차별화': 'differentiation', '신뢰': 'trust' };
                  const newSkipped = { clarity: false, relevance: false, value: false, differentiation: false, trust: false };
                  fb.suggestions.split('\n').forEach(line => {
                    const m = line.match(/^\[(.+?) - 해당 없음\]$/);
                    if (m && dimMap[m[1]]) newSkipped[dimMap[m[1]]] = true;
                  });
                  setSkippedDims(newSkipped);
                }
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
              } else {
                if (fb.suggestions) setComments(parseCommentsFromSuggestions(fb.suggestions));
              }
            } else if (['submitted', 'approved', 'rejected'].includes(fb.status)) {
              setAlreadySubmitted(true);
            } else {
              setDraftId(fb.id);
              setScores({
                clarity:         fb.clarity_score         || 0,
                relevance:       fb.relevance_score       || 0,
                value:           fb.value_score           || 0,
                differentiation: fb.differentiation_score || 0,
                trust:           fb.trust_score           || 0,
              });
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
                  } else {
                    if (saved.__comments) {
                      setComments(saved.__comments);
                      if (Array.isArray(saved.customAnswers)) setCustomAnswers(saved.customAnswers);
                    } else {
                      setComments(saved);
                    }
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
                if (fb.strengths) {
                  try {
                    const s = JSON.parse(fb.strengths);
                    if (Array.isArray(s.customAnswers)) setCustomAnswers(s.customAnswers);
                  } catch {}
                }
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
    }
    load();
  }, [missionId]);

  // 텍스트 모드 자동 저장 (이미지/서브미션 모드에서는 비활성)
  useEffect(() => {
    if (!draftId || step < 1 || !missionId || hasImages || isSubMission) return;
    clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => saveProgress(), 1500);
    return () => {
      clearTimeout(autoSaveTimer.current);
      if (draftId && step >= 1) saveProgress();
    };
  }, [scores, comments, customAnswers]);

  // 이미지 미션 LP 질문 자동 저장
  useEffect(() => {
    if (!draftId || !hasImages || isSubMission || step < 1 || !customAnswers.length) return;
    clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      supabase.from('feedbacks')
        .update({ strengths: JSON.stringify({ customAnswers }) })
        .eq('id', draftId);
    }, 1500);
    return () => clearTimeout(autoSaveTimer.current);
  }, [customAnswers]);

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

  const saveProgress = () => {
    if (!draftId) return;
    setAutoSaving(true);
    supabase.from('feedbacks').update({
      clarity_score:         scores.clarity         || null,
      relevance_score:       scores.relevance       || null,
      value_score:           scores.value           || null,
      differentiation_score: scores.differentiation || null,
      trust_score:           scores.trust           || null,
      strengths:             JSON.stringify(
        customAnswers.length > 0
          ? { __comments: comments, customAnswers }
          : comments
      ),
    }).eq('id', draftId).then(() => setAutoSaving(false));
  };

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
    setAutoSaving(true);
    supabase.from('feedbacks').update({ strengths: JSON.stringify(subState) })
      .eq('id', draftId).then(() => setAutoSaving(false));
  };

  const checkPurity = (text) => {
    if (text.length > 10 && text.split(' ').length < 4) {
      setPurityWarning('⚠️ 너무 짧은 피드백은 Purit Filter에서 걸릴 수 있습니다. 구체적인 근거를 추가해주세요.');
    } else if (/^(좋아요|나쁘네요|별로|좋은것같아요|모르겠어요)$/i.test(text.trim())) {
      setPurityWarning('⚠️ 감성적 표현만으로는 필터를 통과하기 어렵습니다. 구체적 이유를 작성해주세요.');
    } else {
      setPurityWarning('');
    }
  };

  // 제출 후 공통 후처리: 게이미피케이션 RPC + 기업 알림
  const postSubmitActions = async (resubmitMode = false) => {
    if (!panel?.id) return;
    if (!resubmitMode) {
      await supabase.rpc('update_panel_gamification', { p_panel_id: panel.id });
      await supabase.rpc('add_panel_honor_points', { p_panel_id: panel.id, p_delta: 5 });
    }
    if (mission?.company_id) {
      const { data: company } = await supabase
        .from('companies').select('user_id').eq('id', mission.company_id).single();
      if (company?.user_id) {
        sendNotification(company.user_id, {
          type: 'success',
          icon: '📊',
          title: resubmitMode ? '피드백 재제출' : '새 피드백 도착',
          body: resubmitMode
            ? `[${mission.title}] 패널이 피드백을 수정하여 재제출했습니다.`
            : `[${mission.title}] 패널이 피드백을 제출했습니다.`,
          actionUrl: '/company/results',
        });
      }
    }
  };

  const handleCancelAccept = async () => {
    setCancelConfirming(true);
    const { error } = await supabase.rpc('cancel_panel_feedback', { p_mission_id: mission.id });
    setCancelConfirming(false);
    if (error) { alert('취소 중 오류: ' + error.message); return; }
    navigate('/panel/missions');
  };

  const handleStart = async () => {
    if (!mission || !panel) return;
    if (draftId) { setStep(1); return; }
    const { data, error } = await supabase.from('feedbacks').insert({
      mission_id:            mission.id,
      panel_id:              panel.id,
      clarity_score:         null,
      relevance_score:       null,
      value_score:           null,
      differentiation_score: null,
      trust_score:           null,
      strengths:             null,
      weaknesses:            null,
      suggestions:           null,
      purity_passed:         false,
      status:                'draft',
    }).select('id').single();
    if (!error && data) setDraftId(data.id);
    setStep(1);
  };

  const hasSavedProgress = Boolean(draftId) && (
    hasImages
      ? annotations.length > 0 || customAnswers.length > 0
      : isSubMission
        ? Boolean(prefChoice || prefClarity || prefIntent || priceFairness || priceValue || priceWouldBuy !== null || emailOpenIntent || emailHook || emailWouldReply !== null)
        : Object.values(scores).some(s => s > 0) || Object.values(comments).some(c => c.trim()) || customAnswers.length > 0
  );

  const handleResume = () => {
    if (hasImages || isSubMission) { setStep(1); return; }
    const keys = ['clarity', 'relevance', 'value', 'differentiation', 'trust'];
    const firstEmpty = keys.findIndex(k => !scores[k]);
    setStep(firstEmpty === -1 ? SECTIONS.length : firstEmpty + 1);
  };

  // 어노테이션 추가 (이미지 모드)
  const handleAddAnnotation = async (annotationData) => {
    if (!draftId || !mission || !panel) return;
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
    await supabase.from('feedback_annotations').delete().eq('id', annId);
    setAnnotations(prev => prev.filter(a => a.id !== annId));
  };

  // 차원 건너뛰기 토글 — 스킵 시 해당 차원 어노테이션 일괄 삭제
  const toggleSkipDim = async (dim) => {
    const willSkip = !skippedDims[dim];
    if (willSkip && draftId) {
      annotations.filter(a => a.dimension === dim).forEach(ann => clearTimeout(commentUpdateTimers.current[ann.id]));
      await supabase.from('feedback_annotations').delete().eq('feedback_id', draftId).eq('dimension', dim);
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
          suggestionText = `[답장 의향] ${emailWouldReply ? '있음' : '없음'}\n[훅 강도] ${emailHook}/5\n[명확성] ${emailClarity}/5\n[개봉 의향] ${emailOpenIntent}/5\n[호기심] ${emailCuriosity}/5\n[코멘트] ${emailComment}`;
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
          suggestionText = `[답장 의향] ${emailWouldReply ? '있음' : '없음'}\n[훅 강도] ${emailHook}/5\n[명확성] ${emailClarity}/5\n[개봉 의향] ${emailOpenIntent}/5\n[호기심] ${emailCuriosity}/5\n[코멘트] ${emailComment}`;
        }
      }

      const { error: fbError } = await supabase.from('feedbacks').update({
        strengths: null, weaknesses: null,
        suggestions: suggestionText,
        purity_passed: false, status: 'submitted',
      }).eq('id', draftId);
      if (fbError) throw fbError;

      if (!isResubmit) {
        await supabase.rpc('increment_mission_filled_count', { mission_id: mission.id });
        await supabase.rpc('increment_panel_mission_count', { panel_id: panel.id });
      }
      await postSubmitActions(isResubmit);

      setStep(SECTIONS.length + 1);
    } catch (err) {
      alert('제출 중 오류: ' + err.message);
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
        updatePayload = {
          clarity_score:         scores.clarity,
          relevance_score:       scores.relevance,
          value_score:           scores.value,
          differentiation_score: scores.differentiation,
          trust_score:           scores.trust,
          strengths:             null,
          weaknesses:            null,
          suggestions:           SECTIONS
            .map(s => comments[s.key] ? `[${s.label}]\n${comments[s.key]}` : null)
            .filter(Boolean)
            .join('\n\n'),
          custom_answers: customAnswers.length > 0 ? customAnswers : null,
          purity_passed: false,
          status:        'submitted',
        };
      }

      const { error: fbError } = await supabase.from('feedbacks').update(updatePayload).eq('id', draftId);
      if (fbError) throw fbError;

      if (!isResubmit) {
        await supabase.rpc('increment_mission_filled_count', { mission_id: mission.id });
        await supabase.rpc('increment_panel_mission_count', { panel_id: panel.id });
      }
      await postSubmitActions(isResubmit);

      setStep(SECTIONS.length + 1);
    } catch (err) {
      alert('제출 중 오류: ' + err.message);
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
                  ₩{(m.reward_amount || 0).toLocaleString()}
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
            {/* 메인 미션 섹션 */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-2)' }}>메인 미션</h2>
                <Badge type="gray">{mainDrafts.length}개</Badge>
              </div>
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
            {/* 서브 미션 섹션 */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-2)' }}>서브 미션</h2>
                <Badge type="blue">{subDrafts.length}개</Badge>
              </div>
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
          </div>
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
            <div style={{ fontSize: 12, color: 'var(--text-2)' }}>반려된 피드백을 수정하여 재제출합니다. 이전 내용이 복원되었습니다.</div>
          </div>
        </div>
      )}
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
        <div style={{ padding: '14px 18px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 13 }}>
          <strong style={{ color: 'var(--text)' }}>보상: ₩{(mission.reward_amount || 0).toLocaleString()}</strong>
          <span style={{ color: 'var(--text-2)' }}> · Purit Filter 통과 시 자동 지급</span>
        </div>
      </Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {draftId ? (
          <Btn variant="ghost" onClick={() => setCancelModal(true)} style={{ fontSize: 12, color: 'var(--text-3)' }}>수락 취소</Btn>
        ) : <div />}
        <div style={{ display: 'flex', gap: 12 }}>
          <Btn variant="secondary" onClick={() => navigate('/panel/active')}>목록으로</Btn>
          {hasSavedProgress
            ? <Btn onClick={handleResume}>이어하기 →</Btn>
            : <Btn onClick={handleStart}>피드백 시작하기 →</Btn>
          }
        </div>
      </div>
    </div>
  );

  /* ─── 완료 화면 ─── */
  if (step > SECTIONS.length) return (
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
        <strong style={{ color: 'var(--green)' }}>₩{(mission.reward_amount || 0).toLocaleString()}</strong>이 적립됩니다.
      </p>
      <Btn onClick={() => navigate('/panel')}>대시보드로 →</Btn>
    </div>
  );

  /* ─── 서브 미션 폼 ─── */
  if (isSubMission && step >= 1) {
    const parsedDesc = parseSubDesc(mission.description, missionType);

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
        if (missionType === 'preference') return prefChoice && prefClarity && prefIntent && prefComment.trim();
        if (missionType === 'pricing') return priceWouldBuy !== null && priceFairness && priceValue;
        if (missionType === 'email') return emailWouldReply !== null && emailHook && emailClarity && emailOpenIntent;
        return false;
      })();
      return baseOk && (allTypedQs.length === 0 || allTypedQsAnswered());
    };

    return (
      <div className="page-wrap" style={{ padding: '40px 48px', maxWidth: 760, animation: 'fadeUp 0.4s ease both' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 12, fontFamily: 'var(--font-sans)', color: 'var(--green)', marginBottom: 4, letterSpacing: '0.1em' }}>FEEDBACK</div>
            <h1 style={{ fontSize: 24, fontWeight: 800 }}>{mission.title}</h1>
          </div>
          <Btn variant="secondary" onClick={() => setStep(0)}>브리핑으로</Btn>
        </div>

        {/* 소재 비교 A/B */}
        {missionType === 'preference' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
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
            </Card>
          </div>
        )}

        {/* 이메일 */}
        {missionType === 'email' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
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
              <ScoreRow label="호기심/답장 욕구" value={emailCuriosity} setter={setEmailCuriosity} />
              <div style={{ fontSize: 12, fontFamily: 'var(--font-sans)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>답장 의향</div>
              <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
                {[['답장하겠음', true], ['답장 안 함', false]].map(([label, val]) => (
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
            </Card>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 24 }}>
          <Btn disabled={!canSubmit() || submitting} onClick={handleSubMissionSubmit}>
            {submitting ? '제출 중...' : '피드백 제출하기 →'}
          </Btn>
        </div>
      </div>
    );
  }

  /* ─── 이미지 어노테이션 모드 ─── */
  if (hasImages && step >= 1) {
    const imageUrls = mission.image_urls;
    const curAnns   = annotations.filter(a => a.image_index === currentImageIdx);

    const dimDone = Object.fromEntries(
      Object.keys(DIM_META).map(k => [k, annotations.some(a => a.dimension === k) || skippedDims[k]])
    );
    const allDimsDone    = Object.values(dimDone).every(Boolean);
    const allImagesViewed = imageUrls.length <= 1 || viewedImages.size >= imageUrls.length;
    const lpQsAnswered = lpTypedQs.length === 0 || lpTypedQs.every(q => {
      const a = customAnswers.find(x => x.questionId === q.id)?.answer;
      if (a === undefined || a === null || a === '') return false;
      if (q.type === 'text') return String(a).trim().length >= 10;
      return true;
    });
    const canSubmitImage = allDimsDone && allImagesViewed && overallComment.trim().length > 0 && lpQsAnswered;

    return (
      <div className="page-wrap" style={{ padding: '40px 48px', maxWidth: 960, animation: 'fadeUp 0.4s ease both' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 12, fontFamily: 'var(--font-sans)', color: 'var(--green)', marginBottom: 4, letterSpacing: '0.1em' }}>ANNOTATION MODE</div>
            <h1 style={{ fontSize: 24, fontWeight: 800 }}>이미지 어노테이션</h1>
            <p style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 4 }}>
              차원 탭을 클릭하고 해당 영역을 드래그하세요 · 5개 차원 모두 완료 후 총평 작성
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'var(--font-sans)', color: Object.values(dimDone).filter(Boolean).length === 5 ? 'var(--green)' : 'var(--accent)' }}>
              {Object.values(dimDone).filter(Boolean).length}/5
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-3)' }}>차원 완료</div>
          </div>
        </div>

        {/* 차원 선택 탭 */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
          {Object.entries(DIM_META).map(([key, meta]) => {
            const count    = annotations.filter(a => a.dimension === key).length;
            const done     = count > 0;
            const skipped  = skippedDims[key];
            const isActive = activeDimension === key;
            return (
              <button
                key={key}
                onClick={() => setActiveDimension(key)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '9px 18px', borderRadius: 'var(--radius)', fontSize: 13, fontWeight: 700,
                  cursor: 'pointer', border: '2px solid',
                  borderColor: isActive ? (skipped ? '#94a3b8' : meta.color) : (done || skipped) ? (skipped ? '#94a3b8' : meta.color) : 'var(--border)',
                  background: isActive ? (skipped ? '#94a3b8' : meta.color) : skipped ? 'rgba(148,163,184,0.18)' : done ? meta.bg : 'var(--surface)',
                  color: isActive ? '#fff' : skipped ? '#94a3b8' : done ? meta.color : 'var(--text-2)',
                  transition: 'all 0.12s',
                  opacity: skipped && !isActive ? 0.75 : 1,
                }}
              >
                {skipped && !isActive && <span>—</span>}
                {!done && !skipped && <span style={{ fontSize: 11, opacity: 0.5 }}>○</span>}
                {meta.label}
                {count > 0 && !skipped && (
                  <span style={{
                    background: isActive ? 'rgba(255,255,255,0.25)' : 'var(--bg)',
                    borderRadius: 10, padding: '1px 7px', fontSize: 11,
                    color: isActive ? '#fff' : meta.color,
                  }}>{count}</span>
                )}
                {skipped && (
                  <span style={{
                    background: isActive ? 'rgba(255,255,255,0.25)' : 'rgba(148,163,184,0.2)',
                    borderRadius: 10, padding: '1px 7px', fontSize: 10,
                    color: isActive ? '#fff' : '#94a3b8',
                  }}>N/A</span>
                )}
              </button>
            );
          })}
        </div>

        {/* 현재 활성 차원 — 피드백 없음 체크박스 */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14, padding: '8px 14px', background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--text-2)', userSelect: 'none' }}>
            <input
              type="checkbox"
              checked={skippedDims[activeDimension]}
              onChange={() => toggleSkipDim(activeDimension)}
              style={{ width: 15, height: 15, cursor: 'pointer', accentColor: '#94a3b8' }}
            />
            <span>
              <strong style={{ color: DIM_META[activeDimension]?.color }}>{DIM_META[activeDimension]?.label}</strong>
              {' '}차원에는 피드백할 내용이 없습니다
            </span>
          </label>
        </div>

        {/* 이미지 탭 */}
        {imageUrls.length > 1 && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            {imageUrls.map((_, i) => (
              <button
                key={i}
                onClick={() => {
                  setCurrentImageIdx(i);
                  setViewedImages(prev => { const s = new Set(prev); s.add(i); return s; });
                }}
                style={{
                  padding: '6px 16px', borderRadius: 'var(--radius)', fontSize: 12, fontWeight: 600,
                  cursor: 'pointer', border: '1.5px solid',
                  borderColor: currentImageIdx === i ? 'var(--accent)' : viewedImages.has(i) ? 'var(--accent)' : 'var(--border)',
                  background: currentImageIdx === i ? 'var(--accent)' : 'var(--surface)',
                  color: currentImageIdx === i ? '#fff' : viewedImages.has(i) ? 'var(--accent)' : 'var(--text-2)',
                  transition: 'all 0.12s',
                  opacity: viewedImages.has(i) ? 1 : 0.6,
                }}
              >
                이미지 {i + 1}
                {annotations.filter(a => a.image_index === i).length > 0 && (
                  <span style={{ marginLeft: 6, background: 'rgba(255,255,255,0.25)', borderRadius: 10, padding: '1px 6px', fontSize: 10 }}>
                    {annotations.filter(a => a.image_index === i).length}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* 어노테이터 */}
        <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', marginBottom: 16 }}>
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
        </div>

        {/* 코멘트 박스 — 현재 이미지의 어노테이션별 */}
        {curAnns.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontFamily: 'var(--font-sans)', color: 'var(--text-3)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>
              코멘트 작성 ({curAnns.length}개 영역)
            </div>
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
                    </div>
                    <textarea
                      value={ann.comment || ''}
                      onChange={e => handleUpdateAnnotationComment(ann.id, e.target.value)}
                      placeholder={`${meta.label} 측면에서 발견한 문제점이나 강점을 구체적으로 작성해주세요.`}
                      rows={3}
                      style={{
                        width: '100%', boxSizing: 'border-box',
                        padding: '8px 10px', borderRadius: 'var(--radius)',
                        border: '1px solid var(--border)', background: 'var(--bg)',
                        color: 'var(--text)', fontSize: 13, lineHeight: 1.6,
                        resize: 'vertical', fontFamily: 'inherit',
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 차원 완료 현황 안내 */}
        {!allDimsDone && (
          <div style={{
            marginBottom: 16, padding: '12px 16px',
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius)', fontSize: 12, color: 'var(--text-2)',
          }}>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>5개 차원 모두 어노테이션을 남기거나 '피드백할 내용이 없습니다'로 표시해야 제출할 수 있어요</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {Object.entries(dimDone).map(([key, done]) => (
                <span key={key} style={{
                  fontSize: 11, padding: '3px 10px', borderRadius: 12,
                  background: done ? (skippedDims[key] ? 'rgba(148,163,184,0.18)' : DIM_META[key].bg) : 'var(--bg)',
                  color: done ? (skippedDims[key] ? '#94a3b8' : DIM_META[key].color) : 'var(--text-3)',
                  border: `1px solid ${done ? (skippedDims[key] ? '#94a3b8' : DIM_META[key].color) : 'var(--border)'}`,
                }}>
                  {done ? (skippedDims[key] ? '—' : '✓') : '○'} {DIM_META[key].label}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* 총평 — 5개 차원 모두 완료 후 표시 */}
        {allDimsDone && (
          <div style={{
            marginBottom: 16, padding: '16px 18px',
            background: 'var(--surface)', border: '1.5px solid var(--accent)',
            borderRadius: 'var(--radius)',
          }}>
            <div style={{ fontSize: 12, fontFamily: 'var(--font-sans)', color: 'var(--text-2)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10, fontWeight: 700 }}>
              ✓ 모든 차원 평가 완료 — 총평 작성 (필수)
            </div>
            <textarea
              value={overallComment}
              onChange={e => setOverallComment(e.target.value)}
              placeholder="전반적인 인상, 가장 개선이 필요한 부분, 특히 좋았던 점을 자유롭게 작성해주세요."
              rows={4}
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: '10px 12px', borderRadius: 'var(--radius)',
                border: '1px solid var(--border)', background: 'var(--bg)',
                color: 'var(--text)', fontSize: 13, lineHeight: 1.6,
                resize: 'vertical', fontFamily: 'inherit',
              }}
            />
          </div>
        )}

        {allDimsDone && lpTypedQs.length > 0 && (
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

        {imageUrls.length > 1 && !allImagesViewed && (
          <div style={{
            marginBottom: 12, padding: '10px 14px',
            background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.4)',
            borderRadius: 'var(--radius)', fontSize: 12, color: '#b45309',
          }}>
            📷 이미지 {imageUrls.map((_, i) => i).filter(i => !viewedImages.has(i)).map(i => `${i + 1}번`).join(', ')}을 아직 확인하지 않았습니다. 모든 이미지를 확인한 후 제출할 수 있습니다.
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <Btn variant="secondary" onClick={() => setStep(0)}>브리핑으로</Btn>
            {draftId && (
              <Btn variant="ghost" onClick={() => setCancelModal(true)} style={{ fontSize: 12, color: 'var(--text-3)' }}>수락 취소</Btn>
            )}
          </div>
          <Btn
            disabled={!canSubmitImage || submitting}
            onClick={handleSubmit}
          >
            {submitting ? '제출 중...' : '제출하기 →'}
          </Btn>
        </div>

        {cancelModal && (
          <ConfirmModal
            title="수락을 취소할까요?"
            desc="작성 중이던 모든 어노테이션이 삭제됩니다."
            confirmLabel={cancelConfirming ? '처리 중...' : '수락 취소'}
            cancelLabel="계속 작성하기"
            danger
            onConfirm={handleCancelAccept}
            onCancel={() => setCancelModal(false)}
          />
        )}
      </div>
    );
  }

  /* ─── 텍스트 피드백 모드 (이미지 없는 미션) ─── */
  const sec = SECTIONS[step - 1];
  const isLast = step === SECTIONS.length;

  return (
    <div className="page-wrap" style={{ padding: '40px 48px', maxWidth: 720, animation: 'fadeUp 0.4s ease both' }}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 32 }}>
        {SECTIONS.map((s, i) => (
          <div key={s.key} style={{
            flex: 1, height: 4, borderRadius: 2,
            background: i < step - 1 ? 'var(--green)' : i === step - 1 ? 'var(--accent)' : 'var(--border)',
            transition: 'background 0.3s',
          }} />
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ fontSize: 12, fontFamily: 'var(--font-sans)', color: 'var(--text-3)' }}>{step} / {SECTIONS.length}</div>
        {autoSaving && <div style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-sans)' }}>저장 중...</div>}
        {!autoSaving && draftId && <div style={{ fontSize: 11, color: 'var(--green)', fontFamily: 'var(--font-sans)' }}>✓ 자동 저장됨</div>}
      </div>
      <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }}>{sec.label}</h1>
      <p style={{ color: 'var(--text-2)', marginBottom: 28 }}>{sec.desc}</p>

      <Card style={{ marginBottom: 20 }}>
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 12, fontFamily: 'var(--font-sans)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 }}>점수 (1~5)</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {[1, 2, 3, 4, 5].map(n => (
              <button key={n} onClick={() => setScores(s => ({ ...s, [sec.key]: n }))} style={{
                flex: 1, padding: '14px 0', borderRadius: 'var(--radius)',
                background: scores[sec.key] === n ? 'var(--accent)' : scores[sec.key] > n ? 'var(--accent-dim)' : 'var(--surface-2)',
                color: scores[sec.key] === n ? '#FFFFFF' : 'var(--text-2)',
                border: '1px solid ' + (scores[sec.key] >= n ? 'var(--accent)' : 'var(--border)'),
                fontWeight: 700, fontSize: 16, transition: 'all 0.15s', cursor: 'pointer',
              }}>{n}</button>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-3)', marginTop: 6 }}>
            <span>매우 낮음</span><span>매우 높음</span>
          </div>
        </div>
        <div>
          <div style={{ fontSize: 12, fontFamily: 'var(--font-sans)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>구체적 피드백</div>
          <textarea
            value={comments[sec.key]}
            onChange={e => { setComments(c => ({ ...c, [sec.key]: e.target.value })); checkPurity(e.target.value); }}
            placeholder={`${sec.label} 측면에서 발견한 문제점이나 강점을 구체적으로 작성해주세요.`}
            rows={5} style={{ resize: 'vertical' }}
          />
          {purityWarning && (
            <div style={{ fontSize: 12, color: 'var(--red)', marginTop: 8, padding: '10px 14px', background: 'var(--red-dim)', borderRadius: 'var(--radius)' }}>
              {purityWarning}
            </div>
          )}
        </div>
      </Card>

      {isLast && lpTypedQs.length > 0 && (
        <Card style={{ marginBottom: 20 }}>
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

      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <Btn variant="secondary" onClick={() => setStep(s => s - 1)}>이전</Btn>
        <Btn
          disabled={!scores[sec.key] || !comments[sec.key].trim() || submitting || (isLast && !(lpTypedQs.length === 0 || lpTypedQs.every(q => {
            const a = customAnswers.find(x => x.questionId === q.id)?.answer;
            if (a === undefined || a === null || a === '') return false;
            if (q.type === 'text') return String(a).trim().length >= 10;
            return true;
          })))}
          onClick={() => isLast ? handleSubmit() : setStep(s => s + 1)}
        >
          {isLast ? (submitting ? '제출 중...' : '제출하기 →') : '다음 →'}
        </Btn>
      </div>
    </div>
  );
}
