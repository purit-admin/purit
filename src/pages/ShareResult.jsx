import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer,
} from 'recharts';
import ImageAnnotator from '../components/ui/ImageAnnotator';

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

const ANN_DIMS = [
  { key: 'clarity',         label: '명확성', color: '#34C759' },
  { key: 'relevance',       label: '관련성', color: '#f59e0b' },
  { key: 'value',           label: '가치',   color: '#6366f1' },
  { key: 'differentiation', label: '차별화', color: '#ef4444' },
  { key: 'trust',           label: '신뢰',   color: '#94a3b8' },
];

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
  const [activeImg, setActiveImg] = useState(0);
  const [activeDim, setActiveDim] = useState('all');
  const [highlightedId, setHighlightedId] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const { data: result, error } = await supabase.rpc('get_shared_mission', { p_token: token });
        if (error || !result) { setNotFound(true); setLoading(false); return; }
        setData(result);
        setLoading(false);
      } catch {
        setNotFound(true);
        setLoading(false);
      }
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
  const persona = (typeof data.persona === 'string' && data.persona.trim()) ? data.persona.trim() : '';
  const createdDate = data.created_at ? new Date(data.created_at).toLocaleDateString('ko-KR') : '';
  const perms = data.share_permissions || { show_comments: true, show_annotations: true };
  const isImage = Array.isArray(data.image_urls) && data.image_urls.length > 0;
  const isSub = ['preference', 'pricing', 'email'].includes(data.type);
  const typeLabel = TYPE_LABELS[data.type];
  const feedbacks = data.feedbacks || [];
  const annotations = (data.annotations || []).map((a, i) => ({ ...a, id: i }));
  const subResp = data.sub_responses;

  const radarData = DIMS.map(d => ({
    subject: d.label,
    value: scores[d.key] || 0,
    fullMark: 5,
  }));

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
        {persona && (
          <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, padding: '20px 24px', marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#4B556D', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>검증 타겟 페르소나</div>
            <div style={{ fontSize: 13, color: '#0F172A', lineHeight: 1.75, whiteSpace: 'pre-wrap', wordBreak: 'keep-all' }}>{persona}</div>
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

        {/* Image + Annotations */}
        {isImage && perms.show_annotations && (
          <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, padding: '20px 24px', marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#4B556D', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>이미지 어노테이션</div>

            {/* 이미지 탭 */}
            {data.image_urls.length > 1 && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                {data.image_urls.map((_, i) => (
                  <button key={i} onClick={() => { setActiveImg(i); setHighlightedId(null); }}
                    style={{ padding: '5px 14px', borderRadius: 20, border: '1px solid',
                      borderColor: activeImg === i ? '#10367D' : '#E2E8F0',
                      background: activeImg === i ? '#10367D' : '#fff',
                      color: activeImg === i ? '#fff' : '#4B556D',
                      fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                    이미지 {i + 1}
                  </button>
                ))}
              </div>
            )}

            {/* 차원 탭 */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
              <button onClick={() => { setActiveDim('all'); setHighlightedId(null); }}
                style={{ padding: '5px 14px', borderRadius: 20, border: '1px solid',
                  borderColor: activeDim === 'all' ? '#10367D' : '#E2E8F0',
                  background: activeDim === 'all' ? '#10367D' : '#fff',
                  color: activeDim === 'all' ? '#fff' : '#4B556D',
                  fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                전체 {annotations.filter(a => a.image_index === activeImg).length}
              </button>
              {ANN_DIMS.map(d => {
                const cntAll = annotations.filter(a => a.dimension === d.key).length;
                const cntImg = annotations.filter(a => a.image_index === activeImg && a.dimension === d.key).length;
                const isAct = activeDim === d.key;
                return (
                  <button key={d.key} onClick={() => { setActiveDim(d.key); setHighlightedId(null); }}
                    style={{ padding: '5px 14px', borderRadius: 20,
                      border: `1px solid ${isAct ? d.color : '#E2E8F0'}`,
                      background: isAct ? d.color : '#fff',
                      color: isAct ? '#fff' : cntAll === 0 ? '#C0C9D4' : '#4B556D',
                      fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                    {d.label}{cntAll > 0 ? ` ${cntAll}` : ''}
                  </button>
                );
              })}
            </div>

            {/* 이미지 + 코멘트 패널 */}
            {(() => {
              const imgAnns = annotations.filter(a => a.image_index === activeImg);
              const dimAnns = activeDim === 'all' ? imgAnns : imgAnns.filter(a => a.dimension === activeDim);
              const withComment = dimAnns.filter(a => a.comment);
              return (
                <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <ImageAnnotator
                      imageUrl={data.image_urls[activeImg]}
                      imageIndex={activeImg}
                      annotations={dimAnns}
                      seqPool={annotations}
                      readonly={true}
                      highlightedId={highlightedId}
                    />
                  </div>
                  {withComment.length > 0 && (
                    <div style={{ width: 260, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#8598AA', marginBottom: 2 }}>
                        코멘트 {withComment.length}개 · 클릭하면 해당 박스 강조
                      </div>
                      {withComment.map(a => {
                        const dm = ANN_DIMS.find(d => d.key === a.dimension);
                        const isHl = highlightedId === a.id;
                        const seqNum = annotations.filter(x => x.dimension === a.dimension).findIndex(x => x.id === a.id) + 1;
                        return (
                          <div key={a.id}
                            onClick={() => setHighlightedId(isHl ? null : a.id)}
                            style={{ padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
                              border: `1px solid ${isHl ? (dm?.color || '#10367D') : '#E2E8F0'}`,
                              background: isHl ? `${dm?.color}18` : '#F8FAFC',
                              transition: 'border-color 0.15s, background 0.15s' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                              <span style={{ background: dm?.color || '#888', color: '#fff', borderRadius: 4, padding: '1px 7px', fontSize: 11, fontWeight: 700 }}>{seqNum}</span>
                              <span style={{ fontSize: 11, color: dm?.color || '#888', fontWeight: 600 }}>{dm?.label}</span>
                              <span style={{ fontSize: 11, color: '#8598AA', marginLeft: 'auto' }}>{a.score}점</span>
                            </div>
                            <div style={{ fontSize: 12, color: '#0F172A', lineHeight: 1.6 }}>{a.comment}</div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })()}
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
                    <div style={{ fontSize: 11, color: '#8598AA', marginBottom: 6 }}>목표 행동 의향</div>
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
