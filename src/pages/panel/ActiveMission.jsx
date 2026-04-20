import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Btn, ScoreBar, Badge } from '../../components/ui';
import { MISSIONS } from '../../lib/data';

const SECTIONS = [
  { key: 'headline', label: '헤드라인 카피', desc: '첫 화면 메시지가 타겟에게 즉시 공명하는가?' },
  { key: 'social', label: '소셜 프루프', desc: '후기, 수치, 보증이 신뢰를 만드는가?' },
  { key: 'cta', label: 'CTA 효과', desc: 'CTA 버튼의 위치, 문구, 시인성은 적절한가?' },
  { key: 'pricing', label: '가격 앵커링', desc: '가격 제시 방식이 구매 결정을 촉진하는가?' },
];

export default function ActiveMission() {
  const navigate = useNavigate();
  const mission = MISSIONS[0];
  const [step, setStep] = useState(0); // 0=brief, 1=feedback, 2=done
  const [scores, setScores] = useState({ headline: 0, social: 0, cta: 0, pricing: 0 });
  const [comments, setComments] = useState({ headline: '', social: '', cta: '', pricing: '' });
  const [purityWarning, setPurityWarning] = useState('');

  const currentSection = SECTIONS[step - 1];
  const totalSteps = SECTIONS.length + 1;

  const checkPurity = (text) => {
    if (text.length > 10 && text.split(' ').length < 5) {
      setPurityWarning('⚠️ 너무 짧은 피드백은 Purity Filter에서 걸릴 수 있습니다. 구체적인 근거를 추가해주세요.');
    } else if (/좋아요|나쁘네요|별로|좋은것같아요/i.test(text)) {
      setPurityWarning('⚠️ 감성적 표현만으로는 필터를 통과하기 어렵습니다. 전환율에 영향을 미치는 구체적 이유를 작성해주세요.');
    } else {
      setPurityWarning('');
    }
  };

  if (step === 0) return (
    <div style={{ padding: '40px 48px', maxWidth: 720, animation: 'fadeUp 0.5s ease both' }}>
      <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--green)', marginBottom: 8, letterSpacing: '0.1em' }}>ACTIVE MISSION</div>
      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 24 }}>미션 브리핑</h1>
      <Card style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <Badge type="green">진행 중</Badge>
          <Badge type="gray">{mission.industry}</Badge>
        </div>
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>{mission.product}</h2>
        <div style={{ fontSize: 14, color: 'var(--text-2)', marginBottom: 20, lineHeight: 1.7 }}>
          🎯 <strong>타겟 페르소나:</strong> {mission.targetPersona}
        </div>
        <div style={{ padding: '16px', background: 'var(--bg-3)', borderRadius: 'var(--radius)', marginBottom: 20, fontSize: 14, color: 'var(--text-2)', lineHeight: 1.7 }}>
          <strong style={{ color: 'var(--text)' }}>브리핑:</strong><br />
          이 LP는 러닝화 첫 구매자를 타겟으로 합니다. 스크롤 흐름과 CTA 전환 가능성을 중심으로 피드백 부탁드립니다. 당신이 실제 구매자라면 이 페이지에서 구매 버튼을 누르겠습니까?
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
          {mission.tags.map(t => <Badge key={t} type="gold">{t}</Badge>)}
        </div>
        <div style={{ padding: '14px 18px', background: 'var(--accent-dim)', borderRadius: 'var(--radius)', fontSize: 13, lineHeight: 1.7 }}>
          <strong style={{ color: 'var(--accent)' }}>보상: ₩{mission.reward.toLocaleString()}</strong>
          <span style={{ color: 'var(--text-2)' }}> · Purity Filter 통과 시 자동 지급</span>
        </div>
      </Card>
      <div style={{ display: 'flex', gap: 12 }}>
        <Btn variant="secondary" onClick={() => navigate('/panel/missions')}>뒤로</Btn>
        <Btn onClick={() => setStep(1)}>피드백 시작 →</Btn>
      </div>
    </div>
  );

  if (step > SECTIONS.length) return (
    <div style={{ padding: '40px 48px', maxWidth: 600, animation: 'fadeUp 0.5s ease both', textAlign: 'center' }}>
      <div style={{ fontSize: 64, marginBottom: 20 }}>✅</div>
      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 12 }}>피드백 제출 완료!</h1>
      <p style={{ color: 'var(--text-2)', lineHeight: 1.7, marginBottom: 32 }}>
        Purity Filter 검증 중입니다. 통과 시 <strong style={{ color: 'var(--green)' }}>₩{mission.reward.toLocaleString()}</strong>이 적립됩니다.<br />
        일반적으로 2-4시간 내 결과가 확인됩니다.
      </p>
      <Btn onClick={() => navigate('/panel')}>대시보드로 →</Btn>
    </div>
  );

  const sec = SECTIONS[step - 1];

  return (
    <div style={{ padding: '40px 48px', maxWidth: 720, animation: 'fadeUp 0.4s ease both' }}>
      {/* Progress */}
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
        {/* Score selector */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 }}>
            전환 기여도 점수
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {[1, 2, 3, 4, 5].map(n => (
              <button key={n} onClick={() => setScores(s => ({ ...s, [sec.key]: n }))} style={{
                flex: 1, padding: '14px 0', borderRadius: 'var(--radius)',
                background: scores[sec.key] === n ? 'var(--accent)' : scores[sec.key] > n ? 'var(--accent-dim)' : 'var(--surface-2)',
                color: scores[sec.key] === n ? '#0A0A08' : 'var(--text-2)',
                border: '1px solid ' + (scores[sec.key] >= n ? 'rgba(232,213,163,0.4)' : 'var(--border)'),
                fontWeight: 700, fontSize: 16, transition: 'all 0.15s', cursor: 'pointer',
              }}>
                {n}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-3)', marginTop: 6 }}>
            <span>전환 방해</span><span>전환 기여</span>
          </div>
        </div>

        {/* Comment */}
        <div>
          <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
            구체적 피드백
          </div>
          <textarea
            value={comments[sec.key]}
            onChange={e => { setComments(c => ({ ...c, [sec.key]: e.target.value })); checkPurity(e.target.value); }}
            placeholder={`${sec.label}에서 발견한 전환 결함이나 강점을 구체적으로 작성하세요.\n예) "헤드라인이 타겟의 고통점을 직접 건드리지 않아 이탈률이 높을 것 같습니다. 러닝 페이스 개선 수치 등 구체적 성과 언어로 교체 추천합니다."`}
            rows={5} style={{ resize: 'vertical' }}
          />
          {purityWarning && (
            <div style={{ fontSize: 12, color: 'var(--red)', marginTop: 8, padding: '10px 14px', background: 'var(--red-dim)', borderRadius: 'var(--radius)', border: '1px solid rgba(224,112,112,0.2)' }}>
              {purityWarning}
            </div>
          )}
        </div>
      </Card>

      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <Btn variant="secondary" onClick={() => setStep(s => s - 1)}>이전</Btn>
        <Btn
          disabled={!scores[sec.key] || !comments[sec.key].trim()}
          onClick={() => setStep(s => s + 1)}
        >
          {step === SECTIONS.length ? '제출하기 →' : '다음 →'}
        </Btn>
      </div>
    </div>
  );
}
