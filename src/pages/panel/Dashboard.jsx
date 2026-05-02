import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Stat, Btn, Badge } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import {
  getHonorLevel, getNextLevel, getProgressPct, getPanelReward,
  HONOR_COLOR_META, fmtWon,
} from '../../lib/honorLevels';

const DIFF_META = {
  easy:   { label: '쉬움',   color: 'var(--green)' },
  normal: { label: '보통',   color: '#3b82f6' },
  hard:   { label: '어려움', color: 'var(--red, #ef4444)' },
};

export default function PanelDashboard() {
  const navigate = useNavigate();
  const [panel, setPanel]         = useState(null);
  const [missions, setMissions]   = useState([]);
  const [histFeedbacks, setHistFeedbacks] = useState([]);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let { data: p } = await supabase
        .from('panels').select('*').eq('user_id', user.id).single();
      if (!p) { setLoading(false); return; }
      setPanel(p);

      // 잠수 페널티(감가상각) 지연 적용
      const { data: decayRes } = await supabase.rpc('apply_honor_decay', { p_panel_id: p.id });
      if (decayRes?.applied) {
        const { data: fresh } = await supabase
          .from('panels').select('*').eq('user_id', user.id).single();
        p = fresh;
        setPanel(fresh);
      }

      const [{ data: ms }, { data: myFeedbacks }, { data: hFbs }] = await Promise.all([
        supabase.from('missions').select('*, feedbacks(id)').eq('status', 'active')
          .order('created_at', { ascending: false }),
        supabase.from('feedbacks').select('mission_id, status').eq('panel_id', p?.id),
        supabase.from('feedbacks')
          .select('status, purity_passed, missions(reward_amount)')
          .eq('panel_id', p?.id)
          .neq('status', 'draft'),
      ]);

      const myMissionIds = new Set((myFeedbacks || []).map(f => f.mission_id));
      setMissions(
        (ms || []).filter(m =>
          !myMissionIds.has(m.id) &&
          (m.filled_count || 0) < (m.panel_count || 1)
        )
      );
      setHistFeedbacks(hFbs || []);

      // Draft 이어하기 알림: 24h 이상 방치된 draft 미션마다 알림 생성
      if (p?.id && user?.id) {
        const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { data: staleDrafts } = await supabase
          .from('feedbacks')
          .select('mission_id, missions(title)')
          .eq('panel_id', p.id)
          .eq('status', 'draft')
          .lt('created_at', cutoff);

        if (staleDrafts && staleDrafts.length > 0) {
          const todayStart = new Date();
          todayStart.setHours(0, 0, 0, 0);
          const { data: existingNotifs } = await supabase
            .from('notifications')
            .select('title')
            .eq('user_id', user.id)
            .ilike('title', '%이어하기 알림%')
            .gte('created_at', todayStart.toISOString());

          const sentTitles = new Set((existingNotifs || []).map(n => n.title));

          const toInsert = staleDrafts
            .filter(d => {
              const title = `[${d.missions?.title || '미션'}] 이어하기 알림`;
              return !sentTitles.has(title);
            })
            .map(d => ({
              user_id: user.id,
              type: 'warning',
              icon: '⏰',
              title: `[${d.missions?.title || '미션'}] 이어하기 알림`,
              body: '24시간 이상 미완료 미션이 있습니다. 이어서 참여해주세요.',
              action_url: `/panel/active?id=${d.mission_id}`,
              read: false,
            }));

          if (toInsert.length > 0) {
            await supabase.from('notifications').insert(toInsert);
          }
        }
      }

      setLoading(false);
    }
    load();
  }, []);

  if (loading) return (
    <div style={{ padding: '40px 48px', color: 'var(--text-3)', fontSize: 14 }}>불러오는 중...</div>
  );

  const name        = panel?.name || '패널';
  const trustScore  = panel?.trust_score || 0;
  const streakCount = panel?.streak_count || 0;

  // 명예 레벨 파생 값
  const honorPoints = panel?.honor_points ?? 0;
  const honorLevel  = getHonorLevel(honorPoints);
  const nextLevel   = getNextLevel(honorPoints);
  const progressPct = getProgressPct(honorPoints);
  const colorMeta   = HONOR_COLOR_META[honorLevel.colorTier];
  const nextReward  = nextLevel ? getPanelReward(nextLevel.minPoints, panel?.experience) : null;
  const curReward   = getPanelReward(honorPoints, panel?.experience);

  const approvedFbs = histFeedbacks.filter(f => f.purity_passed);
  const pendingFbs  = histFeedbacks.filter(f => !f.purity_passed && f.status === 'submitted');
  const rejectedFbs = histFeedbacks.filter(f => !f.purity_passed && f.status === 'rejected');
  const totalPaid    = approvedFbs.reduce((s, f) => s + (f.missions?.reward_amount || 0), 0);
  const totalPending = pendingFbs.reduce((s, f)  => s + (f.missions?.reward_amount || 0), 0);

  return (
    <div style={{ padding: '40px 48px', maxWidth: 1000, animation: 'fadeUp 0.5s ease both' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 }}>
        <div>
          <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--green)', marginBottom: 8, letterSpacing: '0.1em' }}>PANEL PORTAL</div>
          <h1 style={{ fontSize: 32, fontWeight: 800, marginBottom: 4 }}>안녕하세요, {name}님</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
            <span style={{
              fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
              padding: '3px 10px', borderRadius: 20,
              color: colorMeta.color, background: colorMeta.bg,
              border: `1px solid ${colorMeta.color}`,
            }}>
              Lv.{honorLevel.level} · {colorMeta.label}
            </span>
            <span style={{ fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
              {honorPoints.toLocaleString()}pts
            </span>
            {streakCount >= 2 && (
              <span style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 600 }}>
                🔥 {streakCount}회 연속
              </span>
            )}
          </div>
        </div>
        <Btn onClick={() => navigate('/panel/missions')} size="lg" variant="outline">
          미션 탐색 →
        </Btn>
      </div>

      {/* 명예 레벨 카드 */}
      <div style={{
        background: 'var(--surface)', border: `1px solid ${colorMeta.color}`,
        borderRadius: 'var(--radius-lg)', padding: '20px 28px', marginBottom: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: 6 }}>
            명예 레벨
            <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }} className="honor-info-wrap">
              <span style={{
                width: 15, height: 15, borderRadius: '50%', background: 'var(--border)',
                color: 'var(--text-3)', fontSize: 10, fontWeight: 700, fontFamily: 'var(--font-mono)',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'default',
                userSelect: 'none',
              }}>i</span>
              <span className="honor-tooltip" style={{
                position: 'absolute', left: '50%', top: '100%', transform: 'translateX(-50%)',
                marginTop: 6, zIndex: 10, pointerEvents: 'none',
                background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
                padding: '10px 14px', minWidth: 210,
                fontSize: 12, color: 'var(--text-2)', lineHeight: 1.7,
                display: 'none',
              }}>
                <div style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 6, fontSize: 12 }}>HP 획득/차감 규칙</div>
                {[
                  ['미션 제출 완료', '+5 pts'],
                  ['기업 도움 됨 평가', '+15 pts'],
                  ['기업 도움 안 됨 평가', '−20 pts'],
                  ['30일 비활동 후 매주', '−200 pts'],
                ].map(([desc, val]) => (
                  <div key={desc} style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
                    <span style={{ color: 'var(--text-3)' }}>{desc}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: val.startsWith('+') ? 'var(--green)' : 'var(--red, #ef4444)', whiteSpace: 'nowrap' }}>{val}</span>
                  </div>
                ))}
              </span>
            </span>
          </span>
          <span style={{ fontSize: 22, fontWeight: 800, fontFamily: 'var(--font-mono)', color: colorMeta.color }}>
            Lv.{honorLevel.level}
          </span>
        </div>

        {/* 진행률 바 */}
        <div style={{ height: 8, borderRadius: 99, background: 'var(--border)', overflow: 'hidden', marginBottom: 8 }}>
          <div style={{
            height: '100%', borderRadius: 99,
            width: `${progressPct}%`,
            background: colorMeta.color,
            transition: 'width 0.6s ease',
          }} />
        </div>

        {/* 다음 레벨 안내 */}
        {nextLevel ? (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
            <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
              다음 레벨까지 <strong style={{ color: 'var(--text-2)' }}>{(nextLevel.minPoints - honorPoints).toLocaleString()}점</strong>
            </span>
            <span style={{ fontSize: 12, color: colorMeta.color, fontWeight: 700 }}>
              다음 레벨 달성 시 1회당 {fmtWon(nextReward)}을 받습니다!
            </span>
          </div>
        ) : (
          <div style={{ fontSize: 12, color: colorMeta.color, fontWeight: 700 }}>
            🏆 최고 레벨 달성! 현재 1회당 {fmtWon(curReward)}
          </div>
        )}
      </div>

      {/* 신뢰도 */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)', padding: '20px 28px', marginBottom: 24,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)' }}>내 신뢰도</span>
          <span style={{ fontSize: 18, fontWeight: 800, fontFamily: 'var(--font-mono)', color: trustScore >= 80 ? 'var(--green)' : trustScore >= 60 ? 'var(--accent)' : 'var(--text-2)' }}>
            {trustScore}%
          </span>
        </div>
        <div style={{ height: 6, borderRadius: 99, background: 'var(--border)', overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 99,
            width: `${trustScore}%`,
            background: trustScore >= 80 ? 'var(--green)' : trustScore >= 60 ? 'var(--accent)' : '#94a3b8',
            transition: 'width 0.6s ease',
          }} />
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 6 }}>
          Purity Filter 통과율 기준 — 높을수록 우선 미션 배정
        </div>
      </div>

      {/* 미션 현황 */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>미션 현황</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, background: 'var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          {[
            { label: '완료 미션',   value: String(panel?.total_missions || 0), sub: '총 누적' },
            { label: '참여 가능',   value: String(missions.length),            sub: '현재 오픈 미션' },
            { label: '이번 주 활동', value: String(streakCount),               sub: '7일 내 제출', accent: streakCount >= 3 },
          ].map(s => (
            <div key={s.label} style={{ background: 'var(--surface)', padding: '24px 28px' }}>
              <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>{s.label}</div>
              <div style={{ fontSize: 32, fontWeight: 800, color: s.accent ? 'var(--accent)' : 'var(--text)', fontFamily: 'var(--font-mono)', lineHeight: 1, marginBottom: 4 }}>{s.value}</div>
              <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{s.sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 수익 현황 */}
      <div style={{ marginBottom: 32, marginTop: 24 }}>
        <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>수익 현황</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, background: 'var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          <div style={{ background: 'var(--surface)', padding: '24px 28px' }}>
            <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>총 정산 완료</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--accent)', fontFamily: 'var(--font-mono)', lineHeight: 1, marginBottom: 6 }}>
              {fmtWon(totalPaid)}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>{approvedFbs.length}건</div>
          </div>
          <div style={{ background: 'var(--surface)', padding: '24px 28px' }}>
            <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>정산 대기 중</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text)', fontFamily: 'var(--font-mono)', lineHeight: 1, marginBottom: 6 }}>
              {fmtWon(totalPending)}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>{pendingFbs.length}건</div>
          </div>
          <div style={{ background: 'var(--surface)', padding: '24px 28px' }}>
            <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>필터 탈락</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: rejectedFbs.length > 0 ? 'var(--red, #ef4444)' : 'var(--text)', fontFamily: 'var(--font-mono)', lineHeight: 1, marginBottom: 6 }}>
              {rejectedFbs.length}건
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-3)' }}>Purit Filter 미통과</div>
          </div>
        </div>
      </div>
    </div>
  );
}
