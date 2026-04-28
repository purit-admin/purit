import { useEffect, useState } from 'react';
import { Card, Badge, Btn } from '../../components/ui';
import ImageAnnotator from '../../components/ui/ImageAnnotator';
import { supabase } from '../../lib/supabase';

const DIM = [
  { key: 'clarity_score',         label: '명확성' },
  { key: 'relevance_score',       label: '관련성' },
  { key: 'value_score',           label: '가치' },
  { key: 'differentiation_score', label: '차별화' },
  { key: 'trust_score',           label: '신뢰' },
];

function calcPurityScore(fb) {
  const texts = [fb.strengths || '', fb.weaknesses || '', fb.suggestions || ''].join(' ');
  const length     = Math.min(texts.length / 8, 25);
  const specific   = Math.min((texts.match(/\d+|%|CTA|클릭|전환|스크롤|이탈|헤드라인|카피/gi)?.length || 0) * 5, 30);
  const actionable = Math.min((texts.match(/추천|바꿔|교체|추가|필요|개선|수정|변경/gi)?.length || 0) * 8, 25);
  const aiPenalty  = (texts.match(/중요합니다|생각됩니다|분석됩니다|판단됩니다/gi)?.length || 0) * -15;
  return Math.max(0, Math.min(100, Math.round(length + specific + actionable + aiPenalty + 20)));
}

export default function PurityFilter() {
  const [feedbacks, setFeedbacks]     = useState([]);
  const [selected, setSelected]       = useState(null);
  const [loading, setLoading]         = useState(true);
  const [acting, setActing]           = useState(false);
  const [filter, setFilter]           = useState('pending');
  const [annotations, setAnnotations] = useState([]);
  const [adminImageIdx, setAdminImageIdx] = useState(0);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('feedbacks')
        .select('*, missions(title, image_urls), panels(name)')
        .order('created_at', { ascending: false });
      setFeedbacks(data || []);
      if (data && data.length > 0) setSelected(data[0].id);
      setLoading(false);
    }
    load();
  }, []);

  useEffect(() => {
    if (!selected) { setAnnotations([]); return; }
    const fb = feedbacks.find(f => f.id === selected);
    if (!fb?.missions?.image_urls?.length) { setAnnotations([]); return; }
    setAdminImageIdx(0);
    supabase.from('feedback_annotations').select('*')
      .eq('feedback_id', selected).order('created_at')
      .then(({ data }) => setAnnotations(data || []));
  }, [selected, feedbacks]);

  const approve = async (id) => {
    setActing(true);
    const { error } = await supabase.from('feedbacks').update({ purity_passed: true, status: 'approved' }).eq('id', id);
    if (error) { alert('승인 실패: ' + error.message); setActing(false); return; }
    setFeedbacks(fbs => fbs.map(f => f.id === id ? { ...f, purity_passed: true, status: 'approved' } : f));
    setSelected(null);
    setActing(false);
  };

  const reject = async (id) => {
    setActing(true);
    const { error } = await supabase.from('feedbacks').update({ purity_passed: false, status: 'rejected' }).eq('id', id);
    if (error) { alert('반려 실패: ' + error.message); setActing(false); return; }
    setFeedbacks(fbs => fbs.map(f => f.id === id ? { ...f, purity_passed: false, status: 'rejected' } : f));
    setSelected(null);
    setActing(false);
  };

  const reset = async (id) => {
    setActing(true);
    const { error } = await supabase.from('feedbacks').update({ purity_passed: false, status: 'submitted' }).eq('id', id);
    if (error) { alert('취소 실패: ' + error.message); setActing(false); return; }
    setFeedbacks(fbs => fbs.map(f => f.id === id ? { ...f, purity_passed: false, status: 'submitted' } : f));
    setSelected(null);
    setActing(false);
  };

  const filtered = filter === 'all' ? feedbacks
    : filter === 'pending' ? feedbacks.filter(f => !f.purity_passed && f.status === 'submitted')
    : filter === 'approved' ? feedbacks.filter(f => f.purity_passed)
    : feedbacks.filter(f => f.status === 'rejected');

  const fb = filtered.find(f => f.id === selected);
  const score = fb ? calcPurityScore(fb) : 0;

  if (loading) return (
    <div style={{ padding: '40px 48px', color: 'var(--text-3)', fontSize: 14 }}>불러오는 중...</div>
  );

  return (
    <div style={{ padding: '40px 48px', maxWidth: 1100, animation: 'fadeUp 0.5s ease both' }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--accent)', marginBottom: 8, letterSpacing: '0.1em' }}>PURIT FILTER</div>
        <h1 style={{ fontSize: 28, fontWeight: 800 }}>피드백 품질 검증</h1>
        <p style={{ color: 'var(--text-2)', marginTop: 6, fontSize: 14 }}>AI 생성 여부와 성의 없는 피드백을 자동 감지합니다.</p>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: 'var(--surface)', borderRadius: 'var(--radius)', padding: 4, width: 'fit-content' }}>
        {[['pending', '검토 대기'], ['approved', '승인됨'], ['rejected', '반려됨'], ['all', '전체']].map(([v, l]) => (
          <button key={v} onClick={() => { setFilter(v); setSelected(null); }} style={{
            padding: '6px 14px', borderRadius: 4, fontSize: 13, fontWeight: 500,
            background: filter === v ? 'var(--bg)' : 'transparent',
            color: filter === v ? 'var(--text)' : 'var(--text-3)',
            border: 'none', transition: 'all 0.15s', cursor: 'pointer',
          }}>{l}</button>
        ))}
      </div>

      {feedbacks.length === 0 ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-3)', fontSize: 14, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' }}>
          제출된 피드백이 없습니다.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 20 }}>
          {/* List */}
          <div>
            <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
              {filter === 'pending' ? '검토 대기' : filter === 'approved' ? '승인됨' : filter === 'rejected' ? '반려됨' : '전체'} ({filtered.length})
            </div>
            {filtered.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-3)', fontSize: 13, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
                없음
              </div>
            ) : (
              filtered.map(f => {
                const s = calcPurityScore(f);
                const scoreColor = s >= 70 ? 'var(--green)' : s >= 45 ? 'var(--accent)' : 'var(--red)';
                return (
                  <div key={f.id} onClick={() => setSelected(f.id)} style={{
                    padding: '14px 16px', marginBottom: 8,
                    background: selected === f.id ? 'var(--surface-2)' : 'var(--surface)',
                    borderRadius: 'var(--radius)', border: '1px solid ' + (selected === f.id ? 'var(--border-light)' : 'var(--border)'),
                    cursor: 'pointer', transition: 'all 0.15s',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontWeight: 600, fontSize: 13 }}>{f.panels?.name || '패널'}</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 14, color: scoreColor }}>{s}</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 8 }}>
                      {f.missions?.title || '의뢰'}
                    </div>
                    <div style={{ height: 3, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ width: `${s}%`, height: '100%', background: scoreColor, borderRadius: 2 }} />
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Detail */}
          {fb && (
            <div>
              <Card style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 32 }}>
                <div style={{ textAlign: 'center', flexShrink: 0 }}>
                  <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Purit Score</div>
                  <div style={{ fontSize: 56, fontWeight: 800, fontFamily: 'var(--font-mono)', lineHeight: 1, color: score >= 70 ? 'var(--green)' : score >= 45 ? 'var(--accent)' : 'var(--red)' }}>
                    {score}
                  </div>
                  <Badge type={score >= 70 ? 'green' : score >= 45 ? 'gold' : 'red'} style={{ marginTop: 8 }}>
                    {score >= 70 ? '통과 권장' : score >= 45 ? '검토 필요' : '반려 권장'}
                  </Badge>
                </div>
                <div style={{ flex: 1 }}>
                  {[
                    { label: '텍스트 길이', val: Math.min(25, ([fb.strengths||'', fb.weaknesses||'', fb.suggestions||''].join(' ').length / 8)), max: 25 },
                    { label: '구체성 지수',  val: Math.min(30, ([fb.strengths||'', fb.weaknesses||'', fb.suggestions||''].join(' ').match(/\d+|%|CTA|클릭|전환/gi)?.length||0)*5), max: 30 },
                    { label: '실행 가능성', val: Math.min(25, ([fb.strengths||'', fb.weaknesses||'', fb.suggestions||''].join(' ').match(/추천|바꿔|교체|추가|필요|개선/gi)?.length||0)*8), max: 25 },
                    { label: 'AI 감지 패널티', val: 20, max: 20 },
                  ].map(b => (
                    <div key={b.label} style={{ marginBottom: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-3)', marginBottom: 4, fontFamily: 'var(--font-mono)' }}>
                        <span>{b.label}</span><span>{Math.round(b.val)}/{b.max}</span>
                      </div>
                      <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ width: `${(b.val/b.max)*100}%`, height: '100%', background: 'var(--accent)', borderRadius: 2 }} />
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              <Card>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>피드백 원문</div>
                  <Badge type={fb.purity_passed ? 'green' : fb.status === 'rejected' ? 'red' : 'gold'}>
                    {fb.purity_passed ? '승인됨' : fb.status === 'rejected' ? '반려됨' : '대기'}
                  </Badge>
                </div>

                {/* 이미지 + 어노테이션 오버레이 */}
                {fb.missions?.image_urls?.length > 0 && (
                  <div style={{ marginBottom: 20 }}>
                    {fb.missions.image_urls.length > 1 && (
                      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                        {fb.missions.image_urls.map((_, i) => (
                          <button key={i} onClick={() => setAdminImageIdx(i)} style={{
                            padding: '4px 12px', borderRadius: 'var(--radius)', fontSize: 12, fontWeight: 600,
                            cursor: 'pointer', border: '1.5px solid',
                            borderColor: adminImageIdx === i ? 'var(--accent)' : 'var(--border)',
                            background: adminImageIdx === i ? 'var(--accent)' : 'var(--surface)',
                            color: adminImageIdx === i ? '#fff' : 'var(--text-2)',
                          }}>
                            이미지 {i + 1}
                            {annotations.filter(a => a.image_index === i).length > 0 && (
                              <span style={{ marginLeft: 4, background: 'rgba(255,255,255,0.25)', borderRadius: 8, padding: '0 5px', fontSize: 10 }}>
                                {annotations.filter(a => a.image_index === i).length}
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                    <div style={{ borderRadius: 'var(--radius)', overflow: 'hidden', border: '1px solid var(--border)' }}>
                      <ImageAnnotator
                        imageUrl={fb.missions.image_urls[adminImageIdx]}
                        imageIndex={adminImageIdx}
                        annotations={annotations.filter(a => a.image_index === adminImageIdx)}
                        onAdd={() => {}}
                        onRemove={() => {}}
                        readonly={true}
                      />
                    </div>
                    {annotations.length > 0 && (
                      <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
                        총 어노테이션 {annotations.length}개
                      </div>
                    )}
                  </div>
                )}

                {/* 5차원 점수 */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                  {DIM.map(({ key, label }) => {
                    const val = fb[key] || 0;
                    return (
                      <div key={key} style={{ padding: '8px 12px', background: 'var(--bg-3)', borderRadius: 'var(--radius)', textAlign: 'center', minWidth: 70 }}>
                        <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', marginBottom: 4 }}>{label}</div>
                        <div style={{ fontSize: 18, fontWeight: 800, fontFamily: 'var(--font-mono)', color: val >= 4 ? 'var(--green)' : val >= 3 ? 'var(--accent)' : 'var(--red)' }}>{val}</div>
                      </div>
                    );
                  })}
                </div>

                {/* Text content */}
                {[
                  { label: '강점', content: fb.strengths, color: 'var(--green)' },
                  { label: '약점', content: fb.weaknesses, color: 'var(--red)' },
                  { label: '개선 제안', content: fb.suggestions, color: 'var(--accent)' },
                ].filter(s => s.content).map(({ label, content, color }) => (
                  <div key={label} style={{ marginBottom: 12, padding: '14px', background: 'var(--bg-3)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>{label}</div>
                    <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.7, whiteSpace: 'pre-line' }}>{content}</p>
                  </div>
                ))}

                <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                  {fb.status !== 'approved' && fb.status !== 'rejected' && (
                    <>
                      <Btn size="sm" disabled={acting} onClick={() => approve(fb.id)}>
                        {acting ? '처리 중...' : '✓ 승인'}
                      </Btn>
                      <Btn size="sm" variant="danger" disabled={acting} onClick={() => reject(fb.id)}>
                        {acting ? '처리 중...' : '✕ 반려'}
                      </Btn>
                    </>
                  )}
                  {fb.status === 'approved' && (
                    <Btn size="sm" variant="outline" disabled={acting} onClick={() => reset(fb.id)}>
                      {acting ? '처리 중...' : '승인 취소'}
                    </Btn>
                  )}
                  {fb.status === 'rejected' && (
                    <Btn size="sm" variant="outline" disabled={acting} onClick={() => reset(fb.id)}>
                      {acting ? '처리 중...' : '반려 취소'}
                    </Btn>
                  )}
                </div>
              </Card>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
