import { useEffect, useState } from 'react';
import { Card, ScoreBar, Badge, Btn } from '../../components/ui';
import { supabase } from '../../lib/supabase';

const DIM = [
  { key: 'clarity_score',         label: '명확성' },
  { key: 'relevance_score',       label: '관련성' },
  { key: 'value_score',           label: '가치' },
  { key: 'differentiation_score', label: '차별화' },
  { key: 'trust_score',           label: '신뢰' },
];


function getSkippedLabels(suggestions = '') {
  const skipped = new Set();
  (suggestions || '').split('\n').forEach(line => {
    const m = line.match(/^\[(.+?) - 해당 없음\]$/);
    if (m) skipped.add(m[1]);
  });
  return skipped;
}

export default function Results() {
  const [missions, setMissions]         = useState([]);
  const [selected, setSelected]         = useState(null);
  const [feedbacks, setFeedbacks]       = useState([]);   // panels 조인 포함
  const [activeFb, setActiveFb]         = useState(null);
  const [loading, setLoading]           = useState(true);
  const [fbLoading, setFbLoading]       = useState(false);


  // 공유 링크
  const [shareToken, setShareToken]   = useState(null);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: co } = await supabase
        .from('companies').select('id').eq('user_id', user.id).single();
      if (!co) { setLoading(false); return; }

      const { data: ms } = await supabase
        .from('missions')
        .select('*')
        .eq('company_id', co.id)
        .order('created_at', { ascending: false });
      setMissions(ms || []);
      if (ms && ms.length > 0) {
        setSelected(ms[0].id);
        setShareToken(ms[0].share_token || null);
      }
      setLoading(false);
    }
    load();
  }, []);

  useEffect(() => {
    if (!selected) return;
    setFbLoading(true);
    const m = missions.find(m => m.id === selected);
    setShareToken(m?.share_token || null);

    supabase
      .from('feedbacks')
      .select('*')
      .eq('mission_id', selected)
      .neq('status', 'draft')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setFeedbacks(data || []);
        setActiveFb(data?.length > 0 ? data[0].id : null);
        setFbLoading(false);
      });
  }, [selected]);

  const handleGenerateShare = async () => {
    if (!selected) return;
    setShareLoading(true);
    const token = crypto.randomUUID().replace(/-/g, '');
    const { error } = await supabase
      .from('missions')
      .update({ share_token: token })
      .eq('id', selected);
    if (!error) {
      setShareToken(token);
      setMissions(ms => ms.map(m => m.id === selected ? { ...m, share_token: token } : m));
    }
    setShareLoading(false);
  };

  const handleCopyShare = () => {
    const url = `${window.location.origin}/share/${shareToken}`;
    navigator.clipboard.writeText(url).then(() => {
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    });
  };

  const handleRevokeShare = async () => {
    if (!selected) return;
    await supabase.from('missions').update({ share_token: null }).eq('id', selected);
    setShareToken(null);
    setMissions(ms => ms.map(m => m.id === selected ? { ...m, share_token: null } : m));
  };

  if (loading) return (
    <div style={{ padding: '40px 48px', color: 'var(--text-3)', fontSize: 14 }}>불러오는 중...</div>
  );

  const mission = missions.find(m => m.id === selected);
  const fb = feedbacks.find(f => f.id === activeFb) || null;
  const fbSkippedLabels = fb ? getSkippedLabels(fb.suggestions) : new Set();

  const avg = (key) => {
    if (!feedbacks.length) return '—';
    const valid = feedbacks.filter(f => f[key] > 0);
    if (!valid.length) return '—';
    return (valid.reduce((a, f) => a + (f[key] || 0), 0) / valid.length).toFixed(1);
  };

  return (
    <div style={{ padding: '40px 48px', maxWidth: 1200, animation: 'fadeUp 0.5s ease both' }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--accent)', marginBottom: 8, letterSpacing: '0.1em' }}>FEEDBACK RESULTS</div>
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 4 }}>피드백 결과</h1>
      </div>

      {/* Mission selector */}
      {missions.length > 1 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
          {missions.map(m => (
            <button key={m.id} onClick={() => setSelected(m.id)} style={{
              padding: '6px 14px', borderRadius: 'var(--radius)', fontSize: 13, fontWeight: 500,
              background: selected === m.id ? 'var(--accent)' : 'var(--surface)',
              color: selected === m.id ? '#FFFFFF' : 'var(--text-2)',
              border: '1px solid ' + (selected === m.id ? 'var(--accent)' : 'var(--border)'),
              cursor: 'pointer', transition: 'all 0.15s',
            }}>
              {m.title}
            </button>
          ))}
        </div>
      )}

      {missions.length === 0 ? (
        <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-3)', fontSize: 14, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' }}>
          등록된 의뢰가 없습니다.
        </div>
      ) : (
        <>
          {/* Mission info + 공유 링크 */}
          {mission && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, gap: 16, flexWrap: 'wrap' }}>
              <p style={{ color: 'var(--text-2)', fontSize: 14, flex: 1 }}>{mission.persona}</p>

              {/* 공유 링크 영역 */}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                {shareToken ? (
                  <>
                    <span style={{ fontSize: 12, color: 'var(--green)', fontFamily: 'var(--font-mono)' }}>
                      🔗 공유 중
                    </span>
                    <Btn size="sm" variant="outline" onClick={handleCopyShare}>
                      {shareCopied ? '✓ 복사됨' : 'URL 복사'}
                    </Btn>
                    <Btn size="sm" variant="ghost" onClick={handleRevokeShare}
                      style={{ fontSize: 11, color: 'var(--text-3)' }}>
                      공유 해제
                    </Btn>
                  </>
                ) : (
                  <Btn size="sm" variant="secondary" onClick={handleGenerateShare} disabled={shareLoading}>
                    {shareLoading ? '생성 중...' : '🔗 공유 링크 생성'}
                  </Btn>
                )}
              </div>
            </div>
          )}


          {/* 5차원 평균 점수 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 32 }}>
            {DIM.map(({ key, label }) => {
              const val = avg(key);
              const num = parseFloat(val);
              const color = isNaN(num) ? 'var(--text-3)' : num >= 4 ? 'var(--green)' : num >= 3 ? 'var(--accent)' : 'var(--red)';
              return (
                <Card key={key} style={{ padding: '20px' }}>
                  <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
                  <div style={{ fontSize: 36, fontWeight: 800, color, fontFamily: 'var(--font-mono)', lineHeight: 1 }}>{val}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>/ 5.0 평균</div>
                  {!isNaN(num) && (
                    <div style={{ marginTop: 12 }}>
                      <ScoreBar score={Math.round(num)} color={color} />
                    </div>
                  )}
                </Card>
              );
            })}
          </div>

          {fbLoading ? (
            <div style={{ color: 'var(--text-3)', fontSize: 14 }}>피드백 불러오는 중...</div>
          ) : feedbacks.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-3)', fontSize: 14, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' }}>
              아직 제출된 피드백이 없습니다.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 20 }}>
              {/* Feedback list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                  패널 피드백 ({feedbacks.length})
                </div>
                {feedbacks.map((f, i) => {
                  const overallAvg = DIM.reduce((sum, { key }) => sum + (f[key] || 0), 0) / DIM.length;
                  return (
                    <div key={f.id} onClick={() => setActiveFb(f.id)} style={{
                      padding: '16px', background: activeFb === f.id ? 'var(--surface-2)' : 'var(--surface)',
                      borderRadius: 'var(--radius)', border: '1px solid ' + (activeFb === f.id ? 'var(--border-light)' : 'var(--border)'),
                      cursor: 'pointer', transition: 'all 0.15s',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                        <span style={{ fontWeight: 600, fontSize: 13 }}>패널 #{i + 1}</span>
                        <Badge type={f.purity_passed ? 'green' : 'gray'}>
                          {f.purity_passed ? '통과' : '검토 중'}
                        </Badge>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 8 }}>
                        {new Date(f.created_at).toLocaleDateString('ko-KR')}
                      </div>
                      <ScoreBar score={Math.round(overallAvg)} />
                    </div>
                  );
                })}
              </div>

              {/* Feedback detail */}
              {fb && (
                fb.purity_passed ? (
                  <Card style={{ padding: '28px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 18 }}>피드백 상세</div>
                        <div style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 2 }}>
                          {new Date(fb.created_at).toLocaleString('ko-KR')}
                        </div>
                      </div>
                      <Badge type="green">Purit 통과</Badge>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      {DIM.map(({ key, label }) => {
                        const score = fb[key] || 0;
                        const isSkipped = !score && fbSkippedLabels.has(label);
                        const color = score >= 4 ? 'var(--green)' : score >= 3 ? 'var(--accent)' : 'var(--red)';
                        return (
                          <div key={key} style={{ padding: '16px', background: 'var(--bg-3)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isSkipped ? 0 : 10 }}>
                              <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                {label}
                              </span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                {isSkipped ? (
                                  <span style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic' }}>해당 없음</span>
                                ) : (
                                  <>
                                    <span style={{ fontSize: 20, fontWeight: 800, color, fontFamily: 'var(--font-mono)' }}>{score}</span>
                                    <span style={{ fontSize: 12, color: 'var(--text-3)' }}>/5</span>
                                  </>
                                )}
                              </div>
                            </div>
                            {!isSkipped && <ScoreBar score={score} color={color} />}
                          </div>
                        );
                      })}

                      {fb.strengths && (
                        <div style={{ padding: '16px', background: 'var(--bg-3)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                          <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--green)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>강점</div>
                          <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.7 }}>{fb.strengths}</p>
                        </div>
                      )}
                      {fb.weaknesses && (
                        <div style={{ padding: '16px', background: 'var(--bg-3)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                          <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--red)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>약점</div>
                          <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.7 }}>{fb.weaknesses}</p>
                        </div>
                      )}
                      {fb.suggestions && (
                        <div style={{ padding: '16px', background: 'var(--bg-3)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                          <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>개선 제안</div>
                          <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.7, whiteSpace: 'pre-line' }}>{fb.suggestions}</p>
                        </div>
                      )}
                    </div>
                  </Card>
                ) : (
                  <Card style={{ padding: '48px 28px', textAlign: 'center' }}>
                    <div style={{ fontSize: 40, marginBottom: 16 }}>🔍</div>
                    <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 10 }}>검토 중인 피드백입니다</div>
                    <p style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.7, maxWidth: 320, margin: '0 auto' }}>
                      어드민의 Purity Filter 승인 후<br />피드백 상세 내용을 확인할 수 있습니다.
                    </p>
                    <div style={{ marginTop: 20, fontSize: 12, color: 'var(--text-3)' }}>
                      {new Date(fb.created_at).toLocaleString('ko-KR')}
                    </div>
                  </Card>
                )
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
