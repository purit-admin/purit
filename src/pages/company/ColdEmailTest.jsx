// 콜드 이메일 테스트 — Wynter의 Cold Email Test를 PURIT 버전으로 재설계
// 세일즈/아웃바운드 이메일의 훅·명확성·호기심 유발·답장 의향을 측정

import { useState } from 'react';
import { Card, Badge, Btn, ScoreBar } from '../../components/ui';

const METRICS = [
  { key: 'hook', label: '훅 강도', score: 2.4, color: 'var(--accent)', desc: '첫 문장이 계속 읽게 만드는가?' },
  { key: 'clarity', label: '제안 명확성', score: 3.1, color: 'var(--blue)', desc: '무엇을 원하는지 즉시 이해되는가?' },
  { key: 'curiosity', label: '호기심 유발', score: 2.0, color: '#C084FC', desc: '답장하고 싶은 욕구를 만드는가?' },
  { key: 'relevance', label: '관련성', score: 3.4, color: 'var(--green)', desc: '수신자 상황에 맞는 메시지인가?' },
];

const SAMPLE_EMAIL = `안녕하세요 {이름}님,

귀사의 러닝화 LP를 살펴봤는데, 헤드라인에서 타겟 고객의 고통점이 바로 보이지 않더라고요.

저희는 실제 구매 의향이 있는 전문가 패널로 랜딩페이지의 전환 결함을 사전에 잡아드립니다.

광고비 집행 전에 100만 원으로 수천만 원의 낭비를 막는 방법, 한번 얘기해볼까요?

10분짜리 데모 보내드리겠습니다.`;

const FEEDBACK = [
  { panelist: 'B2B SaaS AE · 6년', reply: false, hook: 2, clarity: 3, comment: '첫 문장에서 "살펴봤는데"가 너무 막연해서 실제로 분석했다는 느낌이 안 남. 구체적 발견 내용 하나만 넣으면 클릭률 올라갈 듯.' },
  { panelist: '이커머스 PM · 4년', reply: true, hook: 3, clarity: 4, comment: '"100만 원으로 수천만 원 낭비 방지" 수치가 인상적임. 하지만 어떻게 그 수치가 나오는지 근거가 없어서 반신반의.' },
  { panelist: '스타트업 CMO · 9년', reply: false, hook: 1, clarity: 2, comment: '"{이름}님" 머지태그 그대로 보임. 퍼스널라이제이션 실패. 그리고 "데모 보내드리겠습니다"는 상대방의 시간을 고려하지 않은 요청.' },
];

export default function ColdEmailTest() {
  const [tab, setTab] = useState('email');
  const avgReplyRate = Math.round((FEEDBACK.filter(f => f.reply).length / FEEDBACK.length) * 100);

  return (
    <div style={{ padding: '40px 48px', maxWidth: 980, animation: 'fadeUp 0.5s ease both' }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--accent)', marginBottom: 8, letterSpacing: '0.1em' }}>COLD EMAIL TEST</div>
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 6 }}>콜드 이메일 검증</h1>
        <p style={{ color: 'var(--text-2)', fontSize: 14 }}>
          발송 전, 실제 타겟 직군에게 이메일을 미리 읽히고 답장 의향과 개선 포인트를 받으세요.
        </p>
      </div>

      {/* Score bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, background: 'var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', marginBottom: 28 }}>
        {METRICS.map(m => (
          <div key={m.key} style={{ background: 'var(--surface)', padding: '22px 20px' }}>
            <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>{m.label}</div>
            <div style={{ fontSize: 36, fontWeight: 800, color: m.color, fontFamily: 'var(--font-mono)', lineHeight: 1, marginBottom: 6 }}>{m.score}</div>
            <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden', marginBottom: 8 }}>
              <div style={{ width: `${(m.score / 5) * 100}%`, height: '100%', background: m.color, borderRadius: 2 }} />
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{m.desc}</div>
          </div>
        ))}
      </div>

      {/* Reply rate banner */}
      <Card style={{ marginBottom: 24, padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 20, borderColor: avgReplyRate >= 50 ? 'rgba(126,200,160,0.3)' : 'rgba(224,112,112,0.3)', background: avgReplyRate >= 50 ? 'var(--green-dim)' : 'var(--red-dim)' }}>
        <div style={{ fontSize: 48, fontWeight: 800, fontFamily: 'var(--font-mono)', color: avgReplyRate >= 50 ? 'var(--green)' : 'var(--red)', lineHeight: 1 }}>{avgReplyRate}%</div>
        <div>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>예상 답장 의향률</div>
          <div style={{ fontSize: 13, color: 'var(--text-2)' }}>패널 {FEEDBACK.length}명 중 {FEEDBACK.filter(f => f.reply).length}명이 "답장할 것 같다"고 응답. 업계 평균 콜드메일 회신율 2-5% 대비 {avgReplyRate >= 30 ? '우수' : '개선 필요'}.</div>
        </div>
      </Card>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: 'var(--surface)', borderRadius: 'var(--radius)', padding: 4, width: 'fit-content' }}>
        {[['email', '이메일 원문'], ['feedback', '패널 피드백'], ['rewrite', '개선 제안']].map(([v, l]) => (
          <button key={v} onClick={() => setTab(v)} style={{
            padding: '7px 18px', borderRadius: 4, fontSize: 13, fontWeight: 500,
            background: tab === v ? 'var(--bg)' : 'transparent',
            color: tab === v ? 'var(--text)' : 'var(--text-3)',
            border: 'none', cursor: 'pointer', transition: 'all 0.15s',
          }}>{l}</button>
        ))}
      </div>

      {tab === 'email' && (
        <Card style={{ padding: '28px' }}>
          <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.06em' }}>테스트한 이메일 원문</div>
          <pre style={{ fontFamily: 'var(--font-sans)', fontSize: 14, color: 'var(--text-2)', lineHeight: 1.9, whiteSpace: 'pre-wrap', background: 'var(--bg-3)', padding: '20px', borderRadius: 'var(--radius)' }}>
            {SAMPLE_EMAIL}
          </pre>
        </Card>
      )}

      {tab === 'feedback' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {FEEDBACK.map((f, i) => (
            <Card key={i}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>{f.panelist}</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Badge type={f.reply ? 'green' : 'red'}>{f.reply ? '답장 의향 O' : '답장 의향 X'}</Badge>
                    <ScoreBar score={f.hook} max={5} color="var(--accent)" />
                  </div>
                </div>
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.7, padding: '12px 14px', background: 'var(--bg-3)', borderRadius: 'var(--radius)', borderLeft: f.reply ? '3px solid var(--green)' : '3px solid var(--red)' }}>
                {f.comment}
              </div>
            </Card>
          ))}
        </div>
      )}

      {tab === 'rewrite' && (
        <Card style={{ padding: '24px 28px' }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 16 }}>AI 개선안</div>
          <pre style={{ fontFamily: 'var(--font-sans)', fontSize: 14, color: 'var(--text)', lineHeight: 1.9, whiteSpace: 'pre-wrap', background: 'var(--bg-3)', padding: '20px', borderRadius: 'var(--radius)', border: '1px solid rgba(126,200,160,0.2)' }}>
{`안녕하세요 홍길동님,

귀사 러닝화 LP의 헤드라인("새로운 나를 만나다")에서
타겟 고객의 구체적 고통점이 보이지 않더라고요.

저희가 실제 직장인 러너 8명에게 미리 읽혔을 때,
"이 제품이 나를 위한 건지 모르겠다"는 반응이 6/8이었습니다.

광고 집행 전에 이 결함 하나를 잡는 데 드는 비용은 90만 원.
A/B 테스트까지 갈 필요 없이, 48시간 안에 나옵니다.

5분짜리 사례 영상 보내드려도 될까요?`}
          </pre>
          <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
            {['훅 강화', '수신자 이름 명시', '구체적 수치 삽입', '부드러운 CTA'].map(tag => (
              <Badge key={tag} type="green">{tag}</Badge>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
