import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Stat, Btn, Badge } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import {
  getHonorLevel, getNextLevel, getProgressPct, getPanelReward,
  HONOR_COLOR_META, fmtWon, fmtKRW,
} from '../../lib/honorLevels';

const C = {
  pageBg:  '#F8FAFC',
  cardBg:  '#FFFFFF',
  primary: '#10367D',
  text:    '#0F172A',
  text2:   '#475569',
  text3:   '#94A3B8',
  shadow:  '0 1px 3px rgba(0,0,0,0.06)',
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
    <div style={{ background: C.pageBg, minHeight: '100vh', padding: '40px 48px', color: C.text3, fontSize: 14 }}>불러오는 중...</div>
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
    <div className="page-wrap" style={{ background: C.pageBg, minHeight: '100vh', padding: '40px 48px', maxWidth: 1000, animation: 'fadeUp 0.5s ease both' }}>
      {/* Header */}
      <div className="dash-header-row" style={{ marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: C.text, marginBottom: 8 }}>안녕하세요, {name}님</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
              padding: '3px 10px', borderRadius: 20,
              color: colorMeta.color, background: colorMeta.bg,
              border: `1px solid ${colorMeta.color}`,
            }}>
              Lv.{honorLevel.level} · {colorMeta.label}
            </span>
            <span style={{ fontSize: 12, color: C.text3 }}>
              {honorPoints.toLocaleString()}pts
            </span>
            {streakCount >= 2 && (
              <span style={{ fontSize: 13, color: C.primary, fontWeight: 600 }}>
                🔥 {streakCount}회 연속
              </span>
            )}
          </div>
        </div>
        <button
          onClick={() => navigate('/panel/missions')}
          style={{ padding: '12px 24px', borderRadius: 12, background: C.primary, color: '#fff', fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer', height: 48, transition: 'opacity 0.15s' }}
          onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
          onMouseLeave={e => e.currentTarget.style.opacity = '1'}
        >미션 탐색 →</button>
      </div>

      {/* 명예 레벨 카드 */}
      <div style={{ background: C.cardBg, borderRadius: 16, padding: '24px 28px', marginBottom: 12, boxShadow: C.shadow }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: C.text2, display: 'flex', alignItems: 'center', gap: 6 }}>
            명예 레벨
            <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }} className="honor-info-wrap">
              <span style={{
                width: 15, height: 15, borderRadius: '50%', background: '#E2E8F0',
                color: C.text3, fontSize: 10, fontWeight: 700,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'default',
                userSelect: 'none',
              }}>i</span>
              <span className="honor-tooltip" style={{
                position: 'absolute', left: '50%', top: '100%', transform: 'translateX(-50%)',
                marginTop: 6, zIndex: 10, pointerEvents: 'none',
                background: C.cardBg, borderRadius: 12,
                boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                padding: '10px 14px', minWidth: 210,
                fontSize: 12, color: C.text2, lineHeight: 1.7,
                display: 'none',
              }}>
                <div style={{ fontWeight: 700, color: C.text, marginBottom: 6, fontSize: 12 }}>HP 획득/차감 규칙</div>
                {[
                  ['미션 제출 완료', '+5 pts'],
                  ['기업 도움 됨 평가', '+15 pts'],
                  ['기업 도움 안 됨 평가', '−20 pts'],
                  ['30일 비활동 후 매주', '−200 pts'],
                ].map(([desc, val]) => (
                  <div key={desc} style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
                    <span style={{ color: C.text3 }}>{desc}</span>
                    <span style={{ fontWeight: 700, color: val.startsWith('+') ? '#22C55E' : '#EF4444', whiteSpace: 'nowrap' }}>{val}</span>
                  </div>
                ))}
              </span>
            </span>
          </span>
          <span style={{ fontSize: 22, fontWeight: 800, color: colorMeta.color }}>
            Lv.{honorLevel.level}
          </span>
        </div>

        <div style={{ height: 8, borderRadius: 99, background: '#E2E8F0', overflow: 'hidden', marginBottom: 10 }}>
          <div style={{ height: '100%', borderRadius: 99, width: `${progressPct}%`, background: colorMeta.color, transition: 'width 0.6s ease' }} />
        </div>

        {nextLevel ? (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
            <span style={{ fontSize: 12, color: C.text3 }}>
              다음 레벨까지 <strong style={{ color: C.text2 }}>{(nextLevel.minPoints - honorPoints).toLocaleString()}점</strong>
            </span>
            <span style={{ fontSize: 12, color: C.primary, fontWeight: 600 }}>
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
      <div style={{ background: C.cardBg, borderRadius: 16, padding: '20px 28px', marginBottom: 20, boxShadow: C.shadow }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: C.text2 }}>내 신뢰도</span>
          <span style={{ fontSize: 18, fontWeight: 800, color: trustScore >= 80 ? '#22C55E' : trustScore >= 60 ? C.primary : C.text2 }}>
            {trustScore}%
          </span>
        </div>
        <div style={{ height: 6, borderRadius: 99, background: '#E2E8F0', overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 99,
            width: `${trustScore}%`,
            background: trustScore >= 80 ? '#22C55E' : trustScore >= 60 ? C.primary : '#94a3b8',
            transition: 'width 0.6s ease',
          }} />
        </div>
        <div style={{ fontSize: 12, color: C.text3, marginTop: 6 }}>
          Purity Filter 통과율 기준 — 높을수록 우선 미션 배정
        </div>
      </div>

      {/* 미션 현황 */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.text2, marginBottom: 10 }}>미션 현황</div>
        <div className="dash-stat-grid-3">
          {[
            { label: '완료 미션',   value: String(panel?.total_missions || 0), sub: '총 누적' },
            { label: '참여 가능',   value: String(missions.length),            sub: '현재 오픈 미션' },
            { label: '이번 주 활동', value: String(streakCount),               sub: '7일 내 제출', accent: streakCount >= 3 },
          ].map(s => (
            <div key={s.label} style={{ background: C.cardBg, borderRadius: 16, padding: '20px 24px', boxShadow: C.shadow }}>
              <div style={{ fontSize: 12, color: C.text3, fontWeight: 500, marginBottom: 8 }}>{s.label}</div>
              <div style={{ fontSize: 32, fontWeight: 800, color: s.accent ? C.primary : C.text, letterSpacing: '-0.03em', lineHeight: 1, marginBottom: 4 }}>{s.value}</div>
              <div style={{ fontSize: 12, color: C.text3 }}>{s.sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 수익 현황 */}
      <div style={{ marginBottom: 32, marginTop: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.text2, marginBottom: 10 }}>수익 현황</div>
        <div className="dash-stat-grid-3">
          <div style={{ background: C.cardBg, borderRadius: 16, padding: '20px 24px', boxShadow: C.shadow }}>
            <div style={{ fontSize: 12, color: C.text3, fontWeight: 500, marginBottom: 8 }}>총 정산 완료</div>
            <div style={{ lineHeight: 1, marginBottom: 6 }}>
              <div style={{ fontSize: 10, color: C.text3, fontWeight: 700, letterSpacing: '0.08em', marginBottom: 3 }}>KRW</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: C.primary, letterSpacing: '-0.03em' }}>{fmtKRW(totalPaid)}</div>
            </div>
            <div style={{ fontSize: 13, color: C.text3 }}>{approvedFbs.length}건</div>
          </div>
          <div style={{ background: C.cardBg, borderRadius: 16, padding: '20px 24px', boxShadow: C.shadow }}>
            <div style={{ fontSize: 12, color: C.text3, fontWeight: 500, marginBottom: 8 }}>정산 대기 중</div>
            <div style={{ lineHeight: 1, marginBottom: 6 }}>
              <div style={{ fontSize: 10, color: C.text3, fontWeight: 700, letterSpacing: '0.08em', marginBottom: 3 }}>KRW</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: C.text, letterSpacing: '-0.03em' }}>{fmtKRW(totalPending)}</div>
            </div>
            <div style={{ fontSize: 13, color: C.text3 }}>{pendingFbs.length}건</div>
          </div>
          <div style={{ background: C.cardBg, borderRadius: 16, padding: '20px 24px', boxShadow: C.shadow }}>
            <div style={{ fontSize: 12, color: C.text3, fontWeight: 500, marginBottom: 8 }}>필터 탈락</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: rejectedFbs.length > 0 ? '#EF4444' : C.text3, letterSpacing: '-0.03em', lineHeight: 1, marginBottom: 6 }}>
              {rejectedFbs.length}건
            </div>
            <div style={{ fontSize: 13, color: C.text3 }}>Purit Filter 미통과</div>
          </div>
        </div>
      </div>
    </div>
  );
}
