import { useState } from 'react';
import { Card, ScoreBar, Badge, Btn } from '../../components/ui';
import { FEEDBACKS, MISSIONS } from '../../lib/data';

const SECTION_LABELS = { headline: '헤드라인', social: '소셜 프루프', cta: 'CTA', pricing: '가격' };

export default function Results() {
  const mission = MISSIONS[0];
  const feedbacks = FEEDBACKS;
  const [selected, setSelected] = useState(feedbacks[0].id);
  const fb = feedbacks.find(f => f.id === selected);

  const avgBySection = (section) => {
    const scores = feedbacks.map(f => f.sections[section]?.score || 0);
    return (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1);
  };

  return (
    <div style={{ padding: '40px 48px', maxWidth: 1100, animation: 'fadeUp 0.5s ease both' }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--accent)', marginBottom: 8, letterSpacing: '0.1em' }}>FEEDBACK RESULTS</div>
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 4 }}>{mission.product}</h1>
        <p style={{ color: 'var(--text-2)', fontSize: 14 }}>{mission.targetPersona}</p>
      </div>

      {/* Section scores overview */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 32 }}>
        {Object.entries(SECTION_LABELS).map(([k, label]) => {
          const avg = parseFloat(avgBySection(k));
          const color = avg >= 4 ? 'var(--green)' : avg >= 3 ? 'var(--accent)' : 'var(--red)';
          return (
            <Card key={k} style={{ padding: '20px' }}>
              <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
              <div style={{ fontSize: 36, fontWeight: 800, color, fontFamily: 'var(--font-mono)', lineHeight: 1 }}>{avg}</div>
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>/ 5.0 평균</div>
              <div style={{ marginTop: 12 }}>
                <ScoreBar score={Math.round(avg)} color={color} />
              </div>
            </Card>
          );
        })}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 20 }}>
        {/* Feedback list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
            패널 피드백 ({feedbacks.length})
          </div>
          {feedbacks.map(f => (
            <div key={f.id} onClick={() => setSelected(f.id)} style={{
              padding: '16px', background: selected === f.id ? 'var(--surface-2)' : 'var(--surface)',
              borderRadius: 'var(--radius)', border: '1px solid ' + (selected === f.id ? 'var(--border-light)' : 'var(--border)'),
              cursor: 'pointer', transition: 'all 0.15s',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <span style={{ fontWeight: 600 }}>{f.panelName}</span>
                <Badge type={f.purityScore >= 80 ? 'green' : 'gold'}>
                  P{f.purityScore}
                </Badge>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 8 }}>{f.submittedAt}</div>
              <ScoreBar score={f.overallScore} />
            </div>
          ))}
        </div>

        {/* Feedback detail */}
        {fb && (
          <Card style={{ padding: '28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 18 }}>{fb.panelName}</div>
                <div style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 2 }}>신뢰 점수 {fb.panelScore} · Purity {fb.purityScore}</div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <Badge type="green">승인됨</Badge>
                <Badge type="gray">Trust Lv.{fb.panelScore >= 90 ? 'EXPERT' : 'PRO'}</Badge>
              </div>
            </div>

            {/* Heatmap area */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
                Insight Heatmap
              </div>
              <div style={{
                position: 'relative', background: 'var(--bg-3)', borderRadius: 'var(--radius)',
                border: '1px solid var(--border)', height: 200, overflow: 'hidden',
              }}>
                {/* Simulated LP skeleton */}
                <div style={{ padding: 16, opacity: 0.3 }}>
                  <div style={{ height: 20, background: 'var(--border-light)', borderRadius: 4, width: '60%', marginBottom: 10 }} />
                  <div style={{ height: 12, background: 'var(--border)', borderRadius: 4, width: '80%', marginBottom: 6 }} />
                  <div style={{ height: 12, background: 'var(--border)', borderRadius: 4, width: '70%', marginBottom: 20 }} />
                  <div style={{ height: 36, background: 'var(--surface-2)', borderRadius: 6, width: '40%' }} />
                </div>
                {/* Annotation points */}
                {fb.heatmapPoints.map((pt, i) => (
                  <div key={i} style={{
                    position: 'absolute', left: `${pt.x}%`, top: `${pt.y}%`,
                    transform: 'translate(-50%, -50%)',
                  }}>
                    <div style={{
                      width: 20, height: 20, borderRadius: '50%',
                      background: pt.type === 'positive' ? 'var(--green)' : 'var(--red)',
                      opacity: 0.85, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 10, color: '#fff', fontWeight: 700, cursor: 'default',
                      boxShadow: `0 0 0 4px ${pt.type === 'positive' ? 'rgba(126,200,160,0.25)' : 'rgba(224,112,112,0.25)'}`,
                    }} title={pt.label}>
                      {pt.type === 'positive' ? '+' : '−'}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 12, color: 'var(--text-3)' }}>
                <span>● <span style={{ color: 'var(--green)' }}>긍정</span> {fb.heatmapPoints.filter(p => p.type === 'positive').length}</span>
                <span>● <span style={{ color: 'var(--red)' }}>부정</span> {fb.heatmapPoints.filter(p => p.type === 'negative').length}</span>
              </div>
            </div>

            {/* Section feedback */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {Object.entries(fb.sections).map(([k, v]) => (
                <div key={k} style={{ padding: '16px', background: 'var(--bg-3)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      {SECTION_LABELS[k]}
                    </span>
                    <ScoreBar score={v.score} color={v.score >= 4 ? 'var(--green)' : v.score >= 3 ? 'var(--accent)' : 'var(--red)'} />
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.7 }}>{v.comment}</p>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
