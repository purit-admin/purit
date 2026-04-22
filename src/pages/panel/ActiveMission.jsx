import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Btn, Badge } from '../../components/ui';
import { supabase } from '../../lib/supabase';

const SECTIONS = [
  { key: 'clarity',         label: '명확성',   desc: '첫 화면 메시지가 타겟에게 즉시 이해되는가?' },
  { key: 'relevance',       label: '관련성',   desc: '콘텐츠가 타겟 페르소나의 니즈에 정확히 맞는가?' },
  { key: 'value',           label: '가치',     desc: '제품/서비스의 가치가 명확하게 전달되는가?' },
  { key: 'differentiation', label: '차별화',   desc: '경쟁 대비 차별점이 설득력 있게 드러나는가?' },
  { key: 'trust',           label: '신뢰',     desc: 'CTA, 소셜 프루프, 보증이 구매 신뢰를 만드는가?' },
];

export default function ActiveMission() {
  const navigate = useNavigate();
  const [mission, setMission]   = useState(null);
  const [panel, setPanel]       = useState(null);
  const [step, setStep]         = useState(0);
  const [scores, setScores]     = useState({ clarity: 0, relevance: 0, value: 0, differentiation: 0, trust: 0 });
  const [comments, setComments] = useState({ clarity: '', relevance: '', value: '', differentiation: '', trust: '' });
  const [purityWarning, setPurityWarning] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 패널 정보 조회
      const { data: p } = await supabase
        .from('panels').select('*').eq('user_id', user.id).single();
      setPanel(p);

      // 활성 미션 1개 조회
      const { data: ms } = await supabase
        .from('missions').select('*').eq('status', 'active').limit(1).single();
      setMission(ms);
    }
    load();
  }, []);

  const checkPurity = (text) => {
    if (text.length > 10 && text.split(' ').length < 4) {
      setPurityWarning('⚠️ 너무 짧은 피드백은 Purit Filter에서 걸릴 수 있습니다. 구체적인 근거를 추가해주세요.');
    } else if (/^(좋아요|나쁘네요|별로|좋은것같아요|모르겠어요)$/i.test(text.trim())) {
      setPurityWarning('⚠️ 감성적 표현만으로는 필터를 통과하기 어렵습니다. 구체적 이유를 작성해주세요.');
    } else {
      setPurityWarning('');
    }
  };

  const handleSubmit = async () => {
    if (!mission || !panel) return;
    setSubmitting(true);
    try {
      // 1. feedbacks 테이블에 저장
      const { error: fbError } = await supabase.from('feedbacks').insert({
        mission_id:            mission.id,
        panel_id:              panel.id,
        clarity_score:         scores.clarity,
        relevance_score:       scores.relevance,
        value_score:           scores.value,
        differentiation_score: scores.differentiation,
        trust_score:           scores.trust,
        strengths:             comments.clarity,
        weaknesses:            comments.relevance,
        suggestions:           [comments.value, comments.differentiation, comments.trust]
                                 .filter(Boolean).join('\n'),
        purity_passed:         false,
        status:                'submitted',
      });
      if (fbError) throw fbError;

      // 2. missions.filled_count +1
      const { error: msError } = await supabase
        .from('missions')
        .update({ filled_count: (mission.filled_count || 0) + 1 })
        .eq('id', mission.id);
      if (msError) throw msError;

      // 3. panels.total_missions +1
      const { error: pnError } = await supabase
        .from('panels')
        .update({ total_missions: (panel.total_missions || 0) + 1 })
        .eq('id', panel.id);
      if (pnError) throw pnError;

      setStep(SECTIONS.length + 1);
    } catch (err) {
      alert('제출 중 오류: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!mission) return (
    <div style={{ padding: '40px 48px', color: 'var(--text-3)', fontSize: 14 }}>
      {mission === null ? '미션을 불러오는 중...' : '현재 참여 가능한 미션이 없습니다.'}
    </div>
  );

  /* ─── 브리핑 화면 ─── */
  if (step === 0) return (
    <div style={{ padding: '40px 48px', maxWidth: 720, animation: 'fadeUp 0.5s ease both' }}>
      <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--green)', marginBottom: 8, letterSpacing: '0.1em' }}>ACTIVE MISSION</div>
      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 24 }}>미션 브리핑</h1>
      <Card style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <Badge type="green">진행 중</Badge>
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
      <div style={{ display: 'flex', gap: 12 }}>
        <Btn variant="secondary" onClick={() => navigate('/panel/missions')}>뒤로</Btn>
        <Btn onClick={() => setStep(1)}>피드백 시작 →</Btn>
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

      <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', marginBottom: 8 }}>
        {step} / {SECTIONS.length}
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
                color: scores[sec.key] === n ? '#0A0A08' : 'var(--text-2)',
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
