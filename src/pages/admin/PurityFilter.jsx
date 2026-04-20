import { useState } from 'react';
import { Card, Badge, Btn, ScoreBar } from '../../components/ui';
import { FEEDBACKS } from '../../lib/data';

const CRITERIA = [
  { key: 'length', label: '텍스트 길이', weight: 20 },
  { key: 'specificity', label: '구체성 지수', weight: 30 },
  { key: 'actionability', label: '실행 가능성', weight: 25 },
  { key: 'ai_detect', label: 'AI 생성 감지', weight: 25 },
];

function simulatePurity(feedback) {
  const text = Object.values(feedback.sections).map(s => s.comment).join(' ');
  const length = Math.min(text.length / 5, 20);
  const specificity = text.match(/\d+|%|CTA|클릭|전환|스크롤|이탈/gi)?.length * 5 || 0;
  const actionability = text.match(/추천|바꿔|교체|추가|필요|개선/gi)?.length * 8 || 0;
  const aiPenalty = text.match(/중요합니다|생각됩니다|분석됩니다/gi)?.length * -15 || 0;
  return Math.min(100, Math.round(length + Math.min(specificity, 30) + Math.min(actionability, 25) + aiPenalty + 20));
}

export default function PurityFilter() {
  const [selected, setSelected] = useState(FEEDBACKS[0].id);
  const fb = FEEDBACKS.find(f => f.id === selected);
  const score = fb ? simulatePurity(fb) : 0;

  const breakdown = [
    { label: '텍스트 길이', score: Math.min(20, Object.values(fb?.sections||{}).map(s=>s.comment.length).reduce((a,b)=>a+b,0)/5), max: 20 },
    { label: '구체성 지수', score: Math.min(30, (Object.values(fb?.sections||{}).map(s=>s.comment).join(' ').match(/\d+|%|CTA|클릭|전환/gi)?.length||0)*5), max: 30 },
    { label: '실행 가능성', score: Math.min(25, (Object.values(fb?.sections||{}).map(s=>s.comment).join(' ').match(/추천|바꿔|교체|추가|필요|개선/gi)?.length||0)*8), max: 25 },
    { label: 'AI 감지 (패널티)', score: 5, max: 25 },
  ];

  return (
    <div style={{ padding: '40px 48px', maxWidth: 1000, animation: 'fadeUp 0.5s ease both' }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--accent)', marginBottom: 8, letterSpacing: '0.1em' }}>PURITY FILTER</div>
        <h1 style={{ fontSize: 28, fontWeight: 800 }}>피드백 품질 검증</h1>
        <p style={{ color: 'var(--text-2)', marginTop: 6, fontSize: 14 }}>AI 생성 여부와 성의 없는 피드백을 자동 감지합니다.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 20 }}>
        {/* List */}
        <div>
          <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
            검토 대기 ({FEEDBACKS.length})
          </div>
          {FEEDBACKS.map(f => {
            const s = simulatePurity(f);
            return (
              <div key={f.id} onClick={() => setSelected(f.id)} style={{
                padding: '14px 16px', marginBottom: 8,
                background: selected === f.id ? 'var(--surface-2)' : 'var(--surface)',
                borderRadius: 'var(--radius)', border: '1px solid ' + (selected === f.id ? 'var(--border-light)' : 'var(--border)'),
                cursor: 'pointer', transition: 'all 0.15s',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{f.panelName}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 14, color: s >= 75 ? 'var(--green)' : s >= 50 ? 'var(--accent)' : 'var(--red)' }}>
                    {s}
                  </span>
                </div>
                <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ width: `${s}%`, height: '100%', background: s >= 75 ? 'var(--green)' : s >= 50 ? 'var(--accent)' : 'var(--red)', borderRadius: 2 }} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Detail */}
        {fb && (
          <div>
            {/* Score */}
            <Card style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 32 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Purity Score</div>
                <div style={{ fontSize: 56, fontWeight: 800, fontFamily: 'var(--font-mono)', lineHeight: 1, color: score >= 75 ? 'var(--green)' : score >= 50 ? 'var(--accent)' : 'var(--red)' }}>
                  {score}
                </div>
                <Badge type={score >= 75 ? 'green' : score >= 50 ? 'gold' : 'red'} style={{ marginTop: 8 }}>
                  {score >= 75 ? '통과' : score >= 50 ? '검토 필요' : '반려'}
                </Badge>
              </div>
              <div style={{ flex: 1 }}>
                {breakdown.map(b => (
                  <div key={b.label} style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-3)', marginBottom: 6, fontFamily: 'var(--font-mono)' }}>
                      <span>{b.label}</span>
                      <span>{Math.round(b.score)}/{b.max}</span>
                    </div>
                    <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ width: `${(b.score/b.max)*100}%`, height: '100%', background: 'var(--accent)', borderRadius: 2 }} />
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Feedback content */}
            <Card>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 16 }}>피드백 원문</div>
              {Object.entries(fb.sections).map(([k, v]) => (
                <div key={k} style={{ marginBottom: 16, padding: '14px', background: 'var(--bg-3)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                    {k} · 점수 {v.score}/5
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.7 }}>{v.comment}</p>
                </div>
              ))}
              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <Btn variant="danger" size="sm">반려 처리</Btn>
                <Btn size="sm">수동 승인</Btn>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
