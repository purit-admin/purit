import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, Btn, Badge } from '../../components/ui';
import { supabase } from '../../lib/supabase';

const SECTIONS = [
  { key: 'clarity',         label: '명확성',   desc: '첫 화면 메시지가 타겟에게 즉시 이해되는가?' },
  { key: 'relevance',       label: '관련성',   desc: '콘텐츠가 타겟 페르소나의 니즈에 정확히 맞는가?' },
  { key: 'value',           label: '가치',     desc: '제품/서비스의 가치가 명확하게 전달되는가?' },
  { key: 'differentiation', label: '차별화',   desc: '경쟁 대비 차별점이 설득력 있게 드러나는가?' },
  { key: 'trust',           label: '신뢰',     desc: 'CTA, 소셜 프루프, 보증이 구매 신뢰를 만드는가?' },
];

const hasDraftProgress = (fb) => {
  if (fb.clarity_score || fb.relevance_score || fb.value_score || fb.differentiation_score || fb.trust_score) return true;
  if (!fb.strengths) return false;
  try {
    const saved = JSON.parse(fb.strengths);
    return Object.values(saved).some(v => v && v.trim());
  } catch { return false; }
};

export default function ActiveMission() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const missionId = searchParams.get('id');

  // ── LIST VIEW ──
  const [panel, setPanel]   = useState(null);
  const [drafts, setDrafts] = useState(null); // null=로딩, array=로드됨

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
  const [cancelModal, setCancelModal]         = useState(false);
  const [cancelConfirming, setCancelConfirming] = useState(false);

  useEffect(() => {
    // 폼 뷰 상태 초기화 (URL 변경 시)
    setMission(null);
    setStep(0);
    setScores({ clarity: 0, relevance: 0, value: 0, differentiation: 0, trust: 0 });
    setComments({ clarity: '', relevance: '', value: '', differentiation: '', trust: '' });
    setAlreadySubmitted(false);
    setDraftId(null);

    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: p } = await supabase.from('panels').select('*').eq('user_id', user.id).single();
      setPanel(p);

      if (missionId) {
        // ── 폼 뷰: 특정 미션 로드 ──
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
            if (['submitted', 'approved', 'rejected'].includes(fb.status)) {
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
                try { setComments(JSON.parse(fb.strengths)); } catch {}
              }
            }
          }
        }
      } else {
        // ── 목록 뷰: 이 패널의 draft 피드백 전체 조회 ──
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

  // 점수·코멘트 변경 시 자동 저장 (폼 뷰, draft 중에만)
  useEffect(() => {
    if (!draftId || step < 1 || !missionId) return;
    clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => saveProgress(), 1500);
    return () => {
      clearTimeout(autoSaveTimer.current);
      if (draftId && step >= 1) saveProgress();
    };
  }, [scores, comments]);

  const saveProgress = () => {
    if (!draftId) return;
    setAutoSaving(true);
    supabase.from('feedbacks').update({
      clarity_score:         scores.clarity         || null,
      relevance_score:       scores.relevance       || null,
      value_score:           scores.value           || null,
      differentiation_score: scores.differentiation || null,
      trust_score:           scores.trust           || null,
      strengths:             JSON.stringify(comments),
    }).eq('id', draftId).then(() => setAutoSaving(false));
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
    Object.values(scores).some(s => s > 0) ||
    Object.values(comments).some(c => c.trim())
  );

  const handleResume = () => {
    const keys = ['clarity', 'relevance', 'value', 'differentiation', 'trust'];
    const firstEmpty = keys.findIndex(k => !scores[k]);
    setStep(firstEmpty === -1 ? SECTIONS.length : firstEmpty + 1);
  };

  const handleSubmit = async () => {
    if (!mission || !panel || !draftId) return;
    setSubmitting(true);
    try {
      const { error: fbError } = await supabase
        .from('feedbacks')
        .update({
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
          purity_passed:         false,
          status:                'submitted',
        })
        .eq('id', draftId);
      if (fbError) throw fbError;

      const { error: msError } = await supabase.rpc('increment_mission_filled_count', { mission_id: mission.id });
      if (msError) throw msError;

      const { error: pnError } = await supabase.rpc('increment_panel_mission_count', { panel_id: panel.id });
      if (pnError) throw pnError;

      setStep(SECTIONS.length + 1);
    } catch (err) {
      alert('제출 중 오류: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  /* ══════════════════════════════════════════
     목록 뷰 (id 파라미터 없음)
  ══════════════════════════════════════════ */
  if (!missionId) {
    if (drafts === null) return (
      <div style={{ padding: '40px 48px', color: 'var(--text-3)', fontSize: 14 }}>불러오는 중...</div>
    );

    return (
      <div style={{ padding: '40px 48px', maxWidth: 900, animation: 'fadeUp 0.5s ease both' }}>
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--green)', marginBottom: 8, letterSpacing: '0.1em' }}>ACTIVE MISSIONS</div>
          <h1 style={{ fontSize: 28, fontWeight: 800 }}>진행 중인 미션</h1>
        </div>

        {drafts.length === 0 ? (
          <div style={{
            padding: '48px 40px', textAlign: 'center',
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
          }}>
            <div style={{ fontSize: 36, marginBottom: 16 }}>📋</div>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>아직 진행 중인 미션이 없어요</div>
            <div style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 24 }}>
              미션 탐색에서 마음에 드는 미션을 수락하면 여기에 표시됩니다.
            </div>
            <Btn variant="outline" onClick={() => navigate('/panel/missions')}>미션 탐색 보기 →</Btn>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {drafts.map(fb => {
              const m = fb.missions;
              if (!m) return null;
              const hasProgress = hasDraftProgress(fb);
              return (
                <Card key={fb.id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
                        <Badge type="gold">진행 중</Badge>
                        <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)' }}>
                          {m.id.slice(0, 8).toUpperCase()}
                        </span>
                      </div>
                      <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 6 }}>{m.title}</div>
                      {m.persona && (
                        <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 8, lineHeight: 1.6 }}>
                          🎯 타겟: {m.persona}
                        </div>
                      )}
                      {m.target_url && (
                        <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{m.target_url}</div>
                      )}
                    </div>
                    <div style={{ flexShrink: 0, textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 12 }}>
                      <div>
                        <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--green)', fontFamily: 'var(--font-mono)' }}>
                          ₩{(m.reward_amount || 0).toLocaleString()}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>건당 보상</div>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
                        {new Date(m.created_at).toLocaleDateString('ko-KR')} 등록
                      </div>
                      <Btn size="sm" onClick={() => navigate(`/panel/active?id=${m.id}`)}>
                        {hasProgress ? '이어하기 →' : '피드백 시작하기 →'}
                      </Btn>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  /* ══════════════════════════════════════════
     폼 뷰 (id 파라미터 있음)
  ══════════════════════════════════════════ */
  if (mission === null) return (
    <div style={{ padding: '40px 48px', color: 'var(--text-3)', fontSize: 14 }}>불러오는 중...</div>
  );

  if (mission === false) return (
    <div style={{ padding: '40px 48px', maxWidth: 560, animation: 'fadeUp 0.4s ease both' }}>
      <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--green)', marginBottom: 8, letterSpacing: '0.1em' }}>ACTIVE MISSION</div>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '48px 40px', textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>📋</div>
        <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 8 }}>미션을 찾을 수 없어요</div>
        <div style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 28, lineHeight: 1.7 }}>
          요청한 미션이 존재하지 않습니다.
        </div>
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
    <div style={{ padding: '40px 48px', maxWidth: 720, animation: 'fadeUp 0.5s ease both' }}>

      {cancelModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--bg)', borderRadius: 'var(--radius-lg)', padding: '32px', maxWidth: 400, width: '90%', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: '#ef4444', marginBottom: 10, letterSpacing: '0.1em' }}>CANCEL ACCEPT</div>
            <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 6 }}>수락을 취소할까요?</h2>
            <div style={{ fontSize: 14, color: 'var(--text-2)', fontWeight: 600, marginBottom: 16 }}>{mission.title}</div>
            <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', padding: '14px 16px', marginBottom: 24, fontSize: 13, color: 'var(--text-2)', lineHeight: 1.7 }}>
              작성 중이던 피드백 초안이 모두 삭제됩니다.<br />
              이 미션은 다시 참여가능 목록으로 돌아갑니다.
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <Btn onClick={() => setCancelModal(false)} disabled={cancelConfirming}>계속 작성하기</Btn>
              <Btn variant="danger" onClick={handleCancelAccept} disabled={cancelConfirming}>
                {cancelConfirming ? '처리 중...' : '수락 취소'}
              </Btn>
            </div>
          </div>
        </div>
      )}

      <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--green)', marginBottom: 8, letterSpacing: '0.1em' }}>ACTIVE MISSION</div>
      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 24 }}>미션 브리핑</h1>
      <Card style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <Badge type="gold">진행 중</Badge>
        </div>
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>{mission.title}</h2>
        {mission.persona && (
          <div style={{ fontSize: 14, color: 'var(--text-2)', marginBottom: 16, lineHeight: 1.7 }}>
            🎯 <strong>타겟 페르소나:</strong> {mission.persona}
          </div>
        )}
        {mission.description && (
          <div style={{ padding: '16px', background: 'var(--bg-3)', borderRadius: 'var(--radius)', marginBottom: 16, fontSize: 14, color: 'var(--text-2)', lineHeight: 1.7 }}>
            <strong style={{ color: 'var(--text)' }}>브리핑:</strong><br />{mission.description}
          </div>
        )}
        {mission.target_url && (
          <a href={mission.target_url} target="_blank" rel="noreferrer"
            style={{ fontSize: 13, color: 'var(--accent)', display: 'inline-block', marginBottom: 16 }}>
            🔗 랜딩페이지 보기 →
          </a>
        )}
        <div style={{ padding: '14px 18px', background: 'var(--accent-dim)', borderRadius: 'var(--radius)', fontSize: 13 }}>
          <strong style={{ color: 'var(--accent)' }}>보상: ₩{(mission.reward_amount || 0).toLocaleString()}</strong>
          <span style={{ color: 'var(--text-2)' }}> · Purit Filter 통과 시 자동 지급</span>
        </div>
      </Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {draftId ? (
          <Btn variant="ghost" onClick={() => setCancelModal(true)}
            style={{ fontSize: 12, color: 'var(--text-3)' }}>수락 취소</Btn>
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
    <div style={{ padding: '40px 48px', maxWidth: 600, animation: 'fadeUp 0.5s ease both', textAlign: 'center' }}>
      <div style={{ fontSize: 64, marginBottom: 20 }}>✅</div>
      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 12 }}>피드백 제출 완료!</h1>
      <p style={{ color: 'var(--text-2)', lineHeight: 1.7, marginBottom: 32 }}>
        Purit Filter 검증 중입니다. 통과 시{' '}
        <strong style={{ color: 'var(--green)' }}>₩{(mission.reward_amount || 0).toLocaleString()}</strong>이 적립됩니다.
      </p>
      <Btn onClick={() => navigate('/panel')}>대시보드로 →</Btn>
    </div>
  );

  /* ─── 피드백 입력 화면 ─── */
  const sec = SECTIONS[step - 1];
  const isLast = step === SECTIONS.length;

  return (
    <div style={{ padding: '40px 48px', maxWidth: 720, animation: 'fadeUp 0.4s ease both' }}>
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
        <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-3)' }}>
          {step} / {SECTIONS.length}
        </div>
        {autoSaving && (
          <div style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>저장 중...</div>
        )}
        {!autoSaving && draftId && (
          <div style={{ fontSize: 11, color: 'var(--green)', fontFamily: 'var(--font-mono)' }}>✓ 자동 저장됨</div>
        )}
      </div>
      <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }}>{sec.label}</h1>
      <p style={{ color: 'var(--text-2)', marginBottom: 28 }}>{sec.desc}</p>

      <Card style={{ marginBottom: 20 }}>
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 }}>
            점수 (1~5)
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {[1, 2, 3, 4, 5].map(n => (
              <button key={n} onClick={() => setScores(s => ({ ...s, [sec.key]: n }))} style={{
                flex: 1, padding: '14px 0', borderRadius: 'var(--radius)',
                background: scores[sec.key] === n ? 'var(--accent)' : scores[sec.key] > n ? 'var(--accent-dim)' : 'var(--surface-2)',
                color: scores[sec.key] === n ? '#FFFFFF' : 'var(--text-2)',
                border: '1px solid ' + (scores[sec.key] >= n ? 'rgba(232,213,163,0.4)' : 'var(--border)'),
                fontWeight: 700, fontSize: 16, transition: 'all 0.15s', cursor: 'pointer',
              }}>{n}</button>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-3)', marginTop: 6 }}>
            <span>매우 낮음</span><span>매우 높음</span>
          </div>
        </div>

        <div>
          <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
            구체적 피드백
          </div>
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

      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <Btn variant="secondary" onClick={() => setStep(s => s - 1)}>이전</Btn>
        <Btn
          disabled={!scores[sec.key] || !comments[sec.key].trim() || submitting}
          onClick={() => isLast ? handleSubmit() : setStep(s => s + 1)}
        >
          {isLast ? (submitting ? '제출 중...' : '제출하기 →') : '다음 →'}
        </Btn>
      </div>
    </div>
  );
}
