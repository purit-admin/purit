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

// 피드백 목록에서 패널 속성 기준 필터링
function applySegmentFilter(feedbacks, industryFilter, expFilter) {
  return feedbacks.filter(f => {
    if (industryFilter && f.panel_industry !== industryFilter) return false;
    if (expFilter      && f.panel_experience !== expFilter)    return false;
    return true;
  });
}

export default function Results() {
  const [missions, setMissions]         = useState([]);
  const [selected, setSelected]         = useState(null);
  const [feedbacks, setFeedbacks]       = useState([]);   // panels 조인 포함
  const [activeFb, setActiveFb]         = useState(null);
  const [loading, setLoading]           = useState(true);
  const [fbLoading, setFbLoading]       = useState(false);

  // 세그먼트 필터
  const [industryFilter, setIndustryFilter] = useState('');
  const [expFilter, setExpFilter]           = useState('');

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
    setIndustryFilter('');
    setExpFilter('');
    const m = missions.find(m => m.id === selected);
    setShareToken(m?.share_token || null);

    // feedbacks + panels 조인으로 패널 속성 함께 로드
    supabase
      .from('feedbacks')
      .select('*, panels(industry, experience, name)')
      .eq('mission_id', selected)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        const enriched = (data || []).map(f => ({
          ...f,
          panel_industry:   f.panels?.industry   || '',
          panel_experience: f.panels?.experience || '',
          panel_name:       f.panels?.name       || '',
        }));
        setFeedbacks(enriched);
        setActiveFb(enriched.length > 0 ? enriched[0].id : null);
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

  // 세그먼트 필터 적용
  const filteredFeedbacks = applySegmentFilter(feedbacks, industryFilter, expFilter);
  const fb = filteredFeedbacks.find(f => f.id === activeFb) || null;

  const avg = (key) => {
    if (!filteredFeedbacks.length) return '—';
    const valid = filteredFeedbacks.filter(f => f[key] > 0);
    if (!valid.length) return '—';
    return (valid.reduce((a, f) => a + (f[key] || 0), 0) / valid.length).toFixed(1);
  };

  // 세그먼트 드롭다운 옵션 구성 (feedbacks에서 unique 값)
  const industries  = [...new Set(feedbacks.map(f => f.panel_industry).filter(Boolean))];
  const experiences = [...new Set(feedbacks.map(f => f.panel_experience).filter(Boolean))];

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

          {/* 패널 세그먼트 필터 */}
          {feedbacks.length > 0 && (industries.length > 0 || experiences.length > 0) && (
            <div style={{
              display: 'flex', gap: 12, alignItems: 'center', marginBottom: 20,
              padding: '12px 16px', background: 'var(--surface)', borderRadius: 'var(--radius)',
              border: '1px solid var(--border)', flexWrap: 'wrap',
            }}>
              <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0 }}>
                패널 필터
              </span>
              {industries.length > 0 && (
                <select value={industryFilter} onChange={e => { setIndustryFilter(e.target.value); setActiveFb(null); }}
                  style={{ fontSize: 13, padding: '4px 10px' }}>
                  <option value="">전체 직군</option>
                  {industries.map(i => <option key={i} value={i}>{i}</option>)}
                </select>
              )}
              {experiences.length > 0 && (
                <select value={expFilter} onChange={e => { setExpFilter(e.target.value); setActiveFb(null); }}
                  style={{ fontSize: 13, padding: '4px 10px' }}>
                  <option value="">전체 경력</option>
                  {experiences.map(e => <option key={e} value={e}>{e}</option>)}
                </select>
              )}
              {(industryFilter || expFilter) && (
                <button onClick={() => { setIndustryFilter(''); setExpFilter(''); }}
                  style={{ fontSize: 12, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', borderRadius: 4 }}>
                  필터 초기화 ✕
                </button>
              )}
              <span style={{ fontSize: 12, color: 'var(--text-3)', marginLeft: 'auto' }}>
                {filteredFeedbacks.length} / {feedbacks.length} 피드백
              </span>
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
          ) : filteredFeedbacks.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-3)', fontSize: 14, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' }}>
              {feedbacks.length === 0 ? '아직 제출된 피드백이 없습니다.' : '선택한 세그먼트에 해당하는 피드백이 없습니다.'}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 20 }}>
              {/* Feedback list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                  패널 피드백 ({filteredFeedbacks.length})
                </div>
                {filteredFeedbacks.map((f, i) => {
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
                      {f.panel_industry && (
                        <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 4 }}>
                          {f.panel_industry}{f.panel_experience ? ` · ${f.panel_experience}` : ''}
                        </div>
                      )}
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
                <Card style={{ padding: '28px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 18 }}>피드백 상세</div>
                      <div style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 2 }}>
                        {new Date(fb.created_at).toLocaleString('ko-KR')}
                        {fb.panel_industry && (
                          <span style={{ marginLeft: 10, padding: '2px 8px', background: 'var(--surface-2)', borderRadius: 4, fontSize: 11 }}>
                            {fb.panel_industry}{fb.panel_experience ? ` · ${fb.panel_experience}` : ''}
                          </span>
                        )}
                      </div>
                    </div>
                    <Badge type={fb.purity_passed ? 'green' : 'gray'}>
                      {fb.purity_passed ? 'Purit 통과' : '검토 중'}
                    </Badge>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {DIM.map(({ key, label }) => {
                      const score = fb[key] || 0;
                      const color = score >= 4 ? 'var(--green)' : score >= 3 ? 'var(--accent)' : 'var(--red)';
                      return (
                        <div key={key} style={{ padding: '16px', background: 'var(--bg-3)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                            <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                              {label}
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontSize: 20, fontWeight: 800, color, fontFamily: 'var(--font-mono)' }}>{score}</span>
                              <span style={{ fontSize: 12, color: 'var(--text-3)' }}>/5</span>
                            </div>
                          </div>
                          <ScoreBar score={score} color={color} />
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
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
