import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Badge, Btn } from '../../components/ui';
import { supabase } from '../../lib/supabase';

export default function MissionList() {
  const navigate = useNavigate();
  const [missions, setMissions]       = useState([]);
  const [feedbackMap, setFeedbackMap] = useState({});
  const [panelId, setPanelId]         = useState(null);
  const [loading, setLoading]         = useState(true);
  const [filter, setFilter]           = useState('available');
  const [modal, setModal]             = useState(null); // { type: 'accept'|'cancel', mission }
  const [confirming, setConfirming]   = useState(false);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: p } = await supabase
        .from('panels').select('id').eq('user_id', user.id).single();
      if (!p) { setLoading(false); return; }
      setPanelId(p.id);

      const [{ data: myFeedbacks }, { data: ms }] = await Promise.all([
        supabase.from('feedbacks').select('mission_id, status').eq('panel_id', p.id),
        supabase.from('missions').select('*').order('created_at', { ascending: false }),
      ]);

      const map = {};
      (myFeedbacks || []).forEach(f => { map[f.mission_id] = f.status; });
      setFeedbackMap(map);
      setMissions(ms || []);
      setLoading(false);
    }
    load();
  }, []);

  const handleConfirmAccept = async () => {
    if (!modal) return;
    setConfirming(true);

    // state의 panelId가 없으면 직접 재조회
    let pid = panelId;
    if (!pid) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: p } = await supabase.from('panels').select('id').eq('user_id', user.id).single();
        pid = p?.id;
        if (pid) setPanelId(pid);
      }
    }

    if (!pid) {
      setConfirming(false);
      alert('패널 계정을 찾을 수 없습니다. 패널로 가입된 계정인지 확인해주세요.');
      return;
    }

    const { error } = await supabase.from('feedbacks').insert({
      mission_id:            modal.mission.id,
      panel_id:              pid,
      clarity_score:         null,
      relevance_score:       null,
      value_score:           null,
      differentiation_score: null,
      trust_score:           null,
      strengths:             null,
      weaknesses:            null,
      suggestions:           null,
      purity_passed:         false,
      status:                'draft',
    });
    setConfirming(false);
    if (error) {
      alert('수락 중 오류: ' + error.message);
      return;
    }
    setFeedbackMap(prev => ({ ...prev, [modal.mission.id]: 'draft' }));
    const target = modal.mission.id;
    setModal(null);
    navigate(`/panel/active?id=${target}`);
  };

  const handleConfirmCancel = async () => {
    if (!modal) return;
    setConfirming(true);
    const { error } = await supabase.rpc('cancel_panel_feedback', {
      p_mission_id: modal.mission.id,
    });
    setConfirming(false);
    if (!error) {
      const newMap = { ...feedbackMap };
      delete newMap[modal.mission.id];
      setFeedbackMap(newMap);
      setModal(null);
    }
  };

  const filtered =
    filter === 'available'
      ? missions.filter(m => !feedbackMap[m.id] && m.status === 'active' && (m.filled_count || 0) < (m.panel_count || 0))
    : filter === 'inProgress'
      ? missions.filter(m => feedbackMap[m.id] === 'draft')
      : missions.filter(m => ['submitted', 'approved', 'rejected'].includes(feedbackMap[m.id]));

  if (loading) return (
    <div style={{ padding: '40px 48px', color: 'var(--text-3)', fontSize: 14 }}>불러오는 중...</div>
  );

  return (
    <div style={{ padding: '40px 48px', maxWidth: 900, animation: 'fadeUp 0.5s ease both' }}>

      {/* ── 모달 ── */}
      {modal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div style={{
            background: 'var(--bg)', borderRadius: 'var(--radius-lg)', padding: '32px',
            maxWidth: 440, width: '90%', border: '1px solid var(--border)',
            animation: 'fadeUp 0.2s ease both',
          }}>
            {modal.type === 'accept' ? (
              <>
                <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--accent)', marginBottom: 10, letterSpacing: '0.1em' }}>MISSION ACCEPT</div>
                <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 6 }}>미션을 수락하시겠어요?</h2>
                <div style={{ fontSize: 14, color: 'var(--text-2)', marginBottom: 20, fontWeight: 600 }}>
                  {modal.mission.title}
                </div>
                <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', padding: '16px 18px', marginBottom: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {[
                    '피드백은 구체적인 근거와 함께 성의 있게 작성해야 합니다.',
                    '단순 감상·짧은 답변은 Purit Filter에서 자동 반려됩니다.',
                    '반려된 피드백은 보상이 지급되지 않습니다.',
                  ].map((t, i) => (
                    <div key={i} style={{ display: 'flex', gap: 10, fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5 }}>
                      <span style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 1 }}>⚠</span>
                      <span>{t}</span>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <Btn variant="secondary" onClick={() => setModal(null)} disabled={confirming}>취소</Btn>
                  <Btn onClick={handleConfirmAccept} disabled={confirming}>
                    {confirming ? '처리 중...' : '수락하기 →'}
                  </Btn>
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--red, #ef4444)', marginBottom: 10, letterSpacing: '0.1em' }}>CANCEL ACCEPT</div>
                <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 6 }}>수락을 취소할까요?</h2>
                <div style={{ fontSize: 14, color: 'var(--text-2)', marginBottom: 20, fontWeight: 600 }}>
                  {modal.mission.title}
                </div>
                <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', padding: '16px 18px', marginBottom: 24, fontSize: 13, color: 'var(--text-2)', lineHeight: 1.7 }}>
                  작성 중이던 피드백 초안이 모두 삭제됩니다.<br />
                  이 미션은 다시 참여가능 목록으로 돌아갑니다.
                </div>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <Btn onClick={() => setModal(null)} disabled={confirming}>계속 작성하기</Btn>
                  <Btn variant="danger" onClick={handleConfirmCancel} disabled={confirming}>
                    {confirming ? '처리 중...' : '수락 취소'}
                  </Btn>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── 헤더 ── */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--green)', marginBottom: 8, letterSpacing: '0.1em' }}>MISSION BOARD</div>
        <h1 style={{ fontSize: 28, fontWeight: 800 }}>미션 탐색</h1>
      </div>

      {/* ── 탭 ── */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: 'var(--surface)', borderRadius: 'var(--radius)', padding: 4, width: 'fit-content' }}>
        {[['available', '참여가능'], ['inProgress', '진행 중'], ['done', '완료']].map(([v, l]) => (
          <button key={v} onClick={() => v === 'inProgress' ? navigate('/panel/active') : setFilter(v)} style={{
            padding: '6px 16px', borderRadius: 4, fontSize: 13, fontWeight: 500,
            background: filter === v ? 'var(--bg)' : 'transparent',
            color: filter === v ? 'var(--text)' : 'var(--text-3)',
            border: 'none', transition: 'all 0.15s', cursor: 'pointer',
          }}>{l}</button>
        ))}
      </div>

      {/* ── 진행 중 빈 상태 ── */}
      {filter === 'inProgress' && filtered.length === 0 && (
        <div style={{
          padding: '48px 40px', textAlign: 'center',
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
        }}>
          <div style={{ fontSize: 36, marginBottom: 16 }}>📋</div>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>아직 진행 중인 미션이 없어요</div>
          <div style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 24 }}>
            미션 탐색에서 마음에 드는 미션을 수락하면 여기에 표시됩니다.
          </div>
          <Btn variant="outline" onClick={() => setFilter('available')}>미션 탐색 보기 →</Btn>
        </div>
      )}

      {/* ── 참여가능·완료 빈 상태 ── */}
      {filter !== 'inProgress' && filtered.length === 0 && (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-3)', fontSize: 14, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' }}>
          해당 조건의 미션이 없습니다.
        </div>
      )}

      {/* ── 미션 목록 ── */}
      {filtered.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.map(m => {
            const slots = m.panel_count || 0;
            const filled = m.filled_count || 0;
            const myStatus = feedbackMap[m.id];
            const isDone = ['submitted', 'approved', 'rejected'].includes(myStatus);
            const isInProgress = myStatus === 'draft';
            return (
              <Card key={m.id} style={{ opacity: isDone ? 0.75 : 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
                      {isDone ? (
                        <Badge type="gray">완료</Badge>
                      ) : isInProgress ? (
                        <Badge type="gold">진행 중</Badge>
                      ) : (
                        <Badge type="green">참여가능</Badge>
                      )}
                      {m.type === 'preference' && <Badge type="blue">소재 비교</Badge>}
                      {m.type === 'pricing'    && <Badge type="gold">가격 검증</Badge>}
                      {m.type === 'email'      && <Badge type="green">이메일 검증</Badge>}
                      <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)' }}>
                        {m.id.slice(0, 8).toUpperCase()}
                      </span>
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 6 }}>{m.title}</div>
                    {m.persona && (
                      <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 12, lineHeight: 1.6 }}>
                        🎯 타겟: {m.persona}
                      </div>
                    )}
                    {m.target_url && (
                      <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{m.target_url}</div>
                    )}
                  </div>
                  <div style={{ flexShrink: 0, textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 12 }}>
                    <div>
                      <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--green)', fontFamily: 'var(--font-mono)' }}>
                        ₩{(m.reward_amount || 0).toLocaleString()}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>건당 보상</div>
                    </div>
                    {!isDone && (
                      <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
                        잔여 <strong style={{ color: 'var(--text)' }}>{Math.max(0, slots - filled)}</strong>/{slots} 슬롯
                      </div>
                    )}
                    <div style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
                      {new Date(m.created_at).toLocaleDateString('ko-KR')} 등록
                    </div>

                    {isDone ? (
                      <Btn size="sm" variant="ghost" disabled>완료됨</Btn>
                    ) : isInProgress ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
                        <Btn size="sm" onClick={() => navigate(`/panel/active?id=${m.id}`)}>이어하기 →</Btn>
                        <Btn size="sm" variant="ghost" onClick={() => setModal({ type: 'cancel', mission: m })}
                          style={{ fontSize: 11, color: 'var(--text-3)' }}>수락 취소</Btn>
                      </div>
                    ) : (
                      <Btn size="sm" onClick={() => setModal({ type: 'accept', mission: m })}>수락하기</Btn>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
