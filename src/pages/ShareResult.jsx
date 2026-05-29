import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer,
} from 'recharts';

const DIMS = [
  { key: 'clarity',         label: '명확성',  color: '#6366F1' },
  { key: 'relevance',       label: '관련성',  color: '#34D399' },
  { key: 'value',           label: '가치',    color: '#F59E0B' },
  { key: 'differentiation', label: '차별화',  color: '#C084FC' },
  { key: 'trust',           label: '신뢰',    color: '#6EE7B7' },
];

const TYPE_LABELS = {
  preference: '소재 비교',
  pricing: '가격 검증',
  email: '이메일 검증',
};

const DIM_LABEL_MAP = {
  clarity: '명확성',
  relevance: '관련성',
  value: '가치',
  differentiation: '차별화',
  trust: '신뢰',
};

function extractOverallComment(suggestions) {
  if (!suggestions) return '';
  const marker = '[총평]';
  const idx = suggestions.indexOf(marker);
  if (idx !== -1) {
    return suggestions.slice(idx + marker.length).replace(/^\n/, '').trim();
  }
  return suggestions.trim();
}

export default function ShareResult() {
  const { token } = useParams();
  const [data, setData] = useState(null);
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
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F8FAFC', color: '#8598AA', fontFamily: 'var(--font-sans)', fontSize: 13 }}>
      데이터 로딩 중…
    </div>
  );

  if (notFound) return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#F8FAFC', gap: 12 }}>
      <div style={{ fontSize: 48 }}>🔒</div>
      <div style={{ fontWeight: 700, fontSize: 20, color: '#0F172A' }}>링크를 찾을 수 없습니다</div>
      <div style={{ fontSize: 14, color: '#8598AA' }}>공유 링크가 만료되었거나 잘못된 주소입니다.</div>
    </div>
  );

  const scores = data.scores || {};
  const overallAvg = DIMS.reduce((sum, d) => sum + (scores[d.key] || 0), 0) / DIMS.length;
  const persona = (typeof data.persona === 'object' && data.persona) ? data.persona : {};
  const createdDate = data.created_at ? new Date(data.created_at).toLocaleDateString('ko-KR') : '';
  const perms = data.share_permissions || { show_comments: true, show_annotations: true };
  const isImage = Array.isArray(data.image_urls) && data.image_urls.length > 0;
  const isSub = ['preference', 'pricing', 'email'].includes(data.type);
  const typeLabel = TYPE_LABELS[data.type];
  const feedbacks = data.feedbacks || [];
  const annotations = data.annotations || [];
  const subResp = data.sub_responses;

  const radarData = DIMS.map(d => ({
    subject: d.label,
    value: scores[d.key] || 0,
    fullMark: 5,
  }));

  const annByDim = {};
  annotations.forEach(a => {
    if (!annByDim[a.dimension]) annByDim[a.dimension] = [];
    annByDim[a.dimension].push(a);
  });

  const scoreColor = overallAvg >= 4 ? '#10B981' : overallAvg <= 2 ? '#EF4444' : '#0F172A';

  return (
    <div className="share-page" style={{ minHeight: '100vh', background: '#F8FAFC', fontFamily: 'var(--font-sans)' }}>
      {/* Top header bar */}
      <div style={{ background: '#fff', borderBottom: '1px solid #E2E8F0', padding: '12px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ fontWeight: 900, fontSize: 17, color: '#10367D', letterSpacing: '-0.01em' }}>PURITY</div>
        <button
          className="share-print-hide"
          onClick={() => window.print()}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#10367D', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
        >
          🖨 PDF로 저장
        </button>
      </div>

      <div style={{ maxWidth: 820, margin: '0 auto', padding: '40px 24px 64px' }}>
        {/* Mission header */}
        <div style={{ marginBottom: 32, textAlign: 'center' }}>
          {typeLabel ? (
            <div style={{ display: 'inline-block', padding: '3px 12px', background: 'rgba(16,54,125,0.08)', borderRadius: 20, fontSize: 11, color: '#10367D', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 12 }}>
              {typeLabel}
            </div>
          ) : (
            <div style={{ display: 'inline-block', padding: '4px 14px', background: '#F1F5F9', borderRadius: 20, fontSize: 11, color: '#4B556D', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12, border: '1px solid #E2E8F0' }}>
              Powered by Purity
            </div>
          )}
          <h1 style={{ fontSize: 28, fontWeight: 800, color: '#0F172A', marginBottom: 8, lineHeight: 1.3 }}>{data.title}</h1>
          <div style={{ fontSize: 13, color: '#8598AA' }}>검증일: {createdDate} · 패널 {data.feedback_count}명 응답</div>
        </div>

        {/* Radar + scores 2-col grid */}
        <div className="share-chart-section share-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
          {/* Radar chart card */}
          <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, padding: '24px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#4B556D', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.08em' }}>5대 지표 레이더</div>
            <ResponsiveContainer width="100%" height={220}>
              <RadarChart data={radarData} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
                <PolarGrid stroke="#E2E8F0" />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fill: '#4B556D', fontWeight: 600 }} />
                <Radar name="점수" dataKey="value" stroke="#6366F1" fill="#6366F1" fillOpacity={0.22} strokeWidth={2} dot={{ fill: '#6366F1', r: 3 }} />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          {/* Overall + dim bars */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, padding: '20px 24px', textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: '#8598AA', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>종합 전환 점수</div>
              <div style={{ fontSize: 60, fontWeight: 800, lineHeight: 1, color: scoreColor, marginBottom: 2 }}>
                {overallAvg.toFixed(1)}
              </div>
              <div style={{ fontSize: 13, color: '#8598AA' }}>/ 5.0</div>
            </div>
            <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, padding: '16px 20px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 10 }}>
              {DIMS.map(d => {
                const score = scores[d.key] || 0;
                return (
                  <div key={d.key} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#4B556D', width: 44, flexShrink: 0 }}>{d.label}</span>
                    <div style={{ flex: 1, height: 6, background: '#E2E8F0', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ width: `${(score / 5) * 100}%`, height: '100%', background: d.color, borderRadius: 3 }} />
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 800, color: d.color, width: 28, textAlign: 'right', flexShrink: 0 }}>{score.toFixed(1)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Persona */}
        {Object.keys(persona).length > 0 && (
          <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, padding: '20px 24px', marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#4B556D', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>검증 타겟 페르소나</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[
                ['산업군', persona.industry],
                ['직책', persona.role],
                ['경력', persona.experience],
                ['지역', persona.region],
              ].filter(([, v]) => v).map(([label, value]) => (
                <div key={label} style={{ padding: '10px 14px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8 }}>
                  <div style={{ fontSize: 10, color: '#8598AA', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{label}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#0F172A' }}>{value}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Panel comments */}
        {perms.show_comments && feedbacks.length > 0 && (
          <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, padding: '20px 24px', marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#4B556D', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>
              패널 총평 <span style={{ color: '#8598AA', fontWeight: 400 }}>({feedbacks.length}명)</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {feedbacks.map(fb => {
                const comment = isImage ? extractOverallComment(fb.suggestions) : fb.suggestions;
                if (!comment) return null;
                return (
                  <div key={fb.idx} style={{ padding: '14px 16px', background: '#F8FAFC', borderRadius: 10, border: '1px solid #E2E8F0' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#10367D', marginBottom: 6 }}>패널 {fb.idx}</div>
                    <div style={{ fontSize: 13, color: '#0F172A', lineHeight: 1.75, whiteSpace: 'pre-wrap' }}>{comment}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Annotation summary */}
        {isImage && perms.show_annotations && annotations.length > 0 && (
          <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, padding: '20px 24px', marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#4B556D', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>차원별 어노테이션 코멘트</div>
            {Object.entries(annByDim).map(([dim, anns]) => {
              const withComment = anns.filter(a => a.comment);
              if (!withComment.length) return null;
              return (
                <div key={dim} style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#0F172A', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ background: 'rgba(16,54,125,0.08)', color: '#10367D', padding: '2px 8px', borderRadius: 10, fontSize: 11 }}>
                      {DIM_LABEL_MAP[dim] || dim}
                    </span>
                    <span style={{ color: '#8598AA', fontWeight: 400, fontSize: 12 }}>{withComment.length}개 코멘트</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {withComment.map((a, i) => (
                      <div key={i} style={{ fontSize: 13, color: '#0F172A', padding: '8px 12px', background: '#F8FAFC', borderRadius: 8, lineHeight: 1.6, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                        <span style={{ fontSize: 11, color: '#8598AA', flexShrink: 0, marginTop: 2 }}>점수 {a.score}</span>
                        <span>{a.comment}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Sub-mission results */}
        {isSub && subResp && (
          <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, padding: '20px 24px', marginBottom: 20 }}>

            {data.type === 'preference' && (() => {
              const total = (subResp.choice_a_count || 0) + (subResp.choice_b_count || 0);
              const pctA = total > 0 ? Math.round((subResp.choice_a_count / total) * 100) : 0;
              const pctB = total > 0 ? Math.round((subResp.choice_b_count / total) * 100) : 0;
              return (
                <>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#4B556D', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>소재 비교 결과</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                    {[['A안', pctA, subResp.choice_a_count], ['B안', pctB, subResp.choice_b_count]].map(([label, pct, count]) => (
                      <div key={label} style={{ textAlign: 'center', padding: '18px 12px', background: '#F8FAFC', borderRadius: 10, border: '1px solid #E2E8F0' }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#4B556D', marginBottom: 6 }}>{label}</div>
                        <div style={{ fontSize: 32, fontWeight: 800, color: '#10367D', lineHeight: 1 }}>{pct}%</div>
                        <div style={{ fontSize: 11, color: '#8598AA', marginTop: 4 }}>{count}명 선택</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    {[['메시지 명확성', subResp.avg_message_clarity], ['구매 의향', subResp.avg_purchase_intent]].map(([label, val]) => (
                      <div key={label} style={{ textAlign: 'center', padding: '14px', background: '#F8FAFC', borderRadius: 10, border: '1px solid #E2E8F0' }}>
                        <div style={{ fontSize: 11, color: '#8598AA', marginBottom: 4 }}>{label}</div>
                        <div style={{ fontSize: 22, fontWeight: 800, color: '#0F172A' }}>{Number(val || 0).toFixed(1)}</div>
                        <div style={{ fontSize: 10, color: '#8598AA' }}>/ 5.0</div>
                      </div>
                    ))}
                  </div>
                </>
              );
            })()}

            {data.type === 'pricing' && (() => {
              const total = subResp.total_count || 0;
              const buyPct = total > 0 ? Math.round(((subResp.would_buy_count || 0) / total) * 100) : 0;
              const buyColor = buyPct >= 60 ? '#10B981' : buyPct >= 40 ? '#F59E0B' : '#EF4444';
              return (
                <>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#4B556D', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>가격 검증 결과</div>
                  <div style={{ background: '#F8FAFC', borderRadius: 10, border: '1px solid #E2E8F0', padding: '20px', textAlign: 'center', marginBottom: 16 }}>
                    <div style={{ fontSize: 11, color: '#8598AA', marginBottom: 6 }}>구매 의향</div>
                    <div style={{ fontSize: 40, fontWeight: 800, color: buyColor, lineHeight: 1 }}>{buyPct}%</div>
                    <div style={{ fontSize: 12, color: '#8598AA', marginTop: 4 }}>{subResp.would_buy_count}/{total}명</div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    {[['가격 적절성', subResp.avg_price_fairness], ['가치 인식', subResp.avg_value_perception]].map(([label, val]) => (
                      <div key={label} style={{ textAlign: 'center', padding: '14px', background: '#F8FAFC', borderRadius: 10, border: '1px solid #E2E8F0' }}>
                        <div style={{ fontSize: 11, color: '#8598AA', marginBottom: 4 }}>{label}</div>
                        <div style={{ fontSize: 22, fontWeight: 800, color: '#0F172A' }}>{Number(val || 0).toFixed(1)}</div>
                        <div style={{ fontSize: 10, color: '#8598AA' }}>/ 5.0</div>
                      </div>
                    ))}
                  </div>
                </>
              );
            })()}

            {data.type === 'email' && (() => {
              const total = subResp.total_count || 0;
              const replyPct = total > 0 ? Math.round(((subResp.would_reply_count || 0) / total) * 100) : 0;
              const replyColor = replyPct >= 60 ? '#10B981' : replyPct >= 40 ? '#F59E0B' : '#EF4444';
              return (
                <>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#4B556D', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>이메일 검증 결과</div>
                  <div style={{ background: '#F8FAFC', borderRadius: 10, border: '1px solid #E2E8F0', padding: '20px', textAlign: 'center', marginBottom: 16 }}>
                    <div style={{ fontSize: 11, color: '#8598AA', marginBottom: 6 }}>답장 의향</div>
                    <div style={{ fontSize: 40, fontWeight: 800, color: replyColor, lineHeight: 1 }}>{replyPct}%</div>
                    <div style={{ fontSize: 12, color: '#8598AA', marginTop: 4 }}>{subResp.would_reply_count}/{total}명</div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    {[
                      ['오픈 의향', subResp.avg_open_intent],
                      ['후킹 점수', subResp.avg_hook_score],
                      ['명확성', subResp.avg_clarity_score],
                      ['호기심 유발', subResp.avg_curiosity_score],
                    ].map(([label, val]) => (
                      <div key={label} style={{ textAlign: 'center', padding: '14px', background: '#F8FAFC', borderRadius: 10, border: '1px solid #E2E8F0' }}>
                        <div style={{ fontSize: 11, color: '#8598AA', marginBottom: 4 }}>{label}</div>
                        <div style={{ fontSize: 22, fontWeight: 800, color: '#0F172A' }}>{Number(val || 0).toFixed(1)}</div>
                        <div style={{ fontSize: 10, color: '#8598AA' }}>/ 5.0</div>
                      </div>
                    ))}
                  </div>
                </>
              );
            })()}

          </div>
        )}

        {/* Footer */}
        <div style={{ textAlign: 'center', fontSize: 12, color: '#8598AA', lineHeight: 1.9, marginTop: 48 }}>
          이 결과는 <strong style={{ color: '#4B556D' }}>Purity</strong> 플랫폼에서 실제 패널이 제공한 피드백을 기반으로 집계되었습니다.<br />
          <a href="/" style={{ color: '#10367D', textDecoration: 'none', fontWeight: 600 }}>Purity로 내 제품 검증받기 →</a>
        </div>
      </div>
    </div>
  );
}
