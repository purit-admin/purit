import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const DIMS = [
  { key: 'clarity',         label: '명확성',  color: '#10367D', icon: '◎' },
  { key: 'relevance',       label: '관련성',  color: '#34D399', icon: '◆' },
  { key: 'value',           label: '가치',    color: '#E8D5A3', icon: '▲' },
  { key: 'differentiation', label: '차별화',  color: '#C084FC', icon: '◈' },
  { key: 'trust',           label: '신뢰',    color: '#6EE7B7', icon: '●' },
];

export default function ShareResult() {
  const { token } = useParams();
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: result, error } = await supabase.rpc('get_shared_mission', { p_token: token });
      if (error || !result) { setNotFound(true); setLoading(false); return; }
      setData(result);
      setLoading(false);
    }
    load();
  }, [token]);

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', fontSize: 13 }}>
      데이터 로딩 중…
    </div>
  );

  if (notFound) return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', gap: 12 }}>
      <div style={{ fontSize: 48 }}>🔒</div>
      <div style={{ fontWeight: 700, fontSize: 20 }}>링크를 찾을 수 없습니다</div>
      <div style={{ fontSize: 14, color: 'var(--text-3)' }}>공유 링크가 만료되었거나 잘못된 주소입니다.</div>
    </div>
  );

  const scores = data.scores || {};
  const overallAvg = DIMS.reduce((sum, d) => sum + (scores[d.key] || 0), 0) / DIMS.length;
  const persona = data.persona || {};
  const createdDate = data.created_at ? new Date(data.created_at).toLocaleDateString('ko-KR') : '';

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: '60px 24px' }}>
      <div style={{ maxWidth: 680, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <div style={{ display: 'inline-block', padding: '4px 14px', background: 'var(--surface)', borderRadius: 20, fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--accent)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 20, border: '1px solid var(--border)' }}>
            Powered by Purity
          </div>
          <h1 style={{ fontSize: 30, fontWeight: 800, marginBottom: 8 }}>{data.title}</h1>
          <div style={{ fontSize: 13, color: 'var(--text-3)' }}>검증일: {createdDate} · 패널 {data.feedback_count}명 응답</div>
        </div>

        {/* Overall score */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '32px', textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>종합 전환 점수</div>
          <div style={{ fontSize: 72, fontWeight: 800, fontFamily: 'var(--font-mono)', lineHeight: 1, color: overallAvg >= 4 ? 'var(--green)' : overallAvg >= 3 ? 'var(--accent)' : 'var(--red)', marginBottom: 4 }}>
            {overallAvg.toFixed(1)}
          </div>
          <div style={{ fontSize: 14, color: 'var(--text-3)' }}>/ 5.0</div>
        </div>

        {/* Score bars */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '28px 32px', marginBottom: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 20 }}>5차원 점수</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {DIMS.map(d => {
              const score = scores[d.key] || 0;
              return (
                <div key={d.key}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ color: d.color, fontSize: 14 }}>{d.icon}</span>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{d.label}</span>
                    </div>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: 16, color: d.color }}>{score.toFixed(1)}</span>
                  </div>
                  <div style={{ height: 8, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ width: `${(score / 5) * 100}%`, height: '100%', background: d.color, borderRadius: 4, transition: 'width 1s ease' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Persona */}
        {persona && Object.keys(persona).length > 0 && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '28px 32px', marginBottom: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 16 }}>검증 타겟 페르소나</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {[
                ['산업군', persona.industry],
                ['직책', persona.role],
                ['경력', persona.experience],
                ['지역', persona.region],
              ].filter(([, v]) => v).map(([label, value]) => (
                <div key={label} style={{ padding: '10px 14px', background: 'var(--bg-3)', borderRadius: 8 }}>
                  <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{label}</div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{value}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-3)', lineHeight: 1.8 }}>
          이 결과는 <strong style={{ color: 'var(--text-2)' }}>Purity</strong> 플랫폼에서 실제 패널이 제공한 피드백을 기반으로 집계되었습니다.<br />
          <a href="/" style={{ color: 'var(--accent)', textDecoration: 'none' }}>Purity로 내 제품 검증받기 →</a>
        </div>
      </div>
    </div>
  );
}
