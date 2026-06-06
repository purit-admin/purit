import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Stat, Btn, Badge } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import {
  getHonorLevel, getNextLevel, getProgressPct, getPanelReward,
  getExperienceCareerKey, HONOR_COLOR_META, fmtWon, fmtKRW,
} from '../../lib/honorLevels';

const BADGE_CATALOG_DASH = [
  { key: '영점_조준',    name: '영점 조준',    tier: 'rookie' },
  { key: '유효_타격',    name: '유효 타격',    tier: 'rookie' },
  { key: '데이터_스캐너', name: '데이터 스캐너', tier: 'rookie' },
  { key: '제로_데펙트',  name: '제로 데펙트',  tier: 'elite'  },
  { key: '크리티컬_샷',  name: '크리티컬 샷',  tier: 'elite'  },
  { key: '트렌드_오라클', name: '트렌드 오라클', tier: 'elite'  },
  { key: '절대_영도',    name: '절대 영도',    tier: 'master' },
  { key: '픽셀_아키텍트', name: '픽셀 아키텍트', tier: 'master' },
  { key: '에이펙스_노드', name: '에이펙스 노드', tier: 'master' },
  { key: '마이크로스코프', name: '마이크로스코프', tier: 'hidden' },
  { key: '퀵_타겟팅',    name: '퀵 타겟팅',   tier: 'hidden' },
  { key: '블랙_스완',    name: '블랙 스완',   tier: 'hidden' },
];

const DASH_TIER_STYLES = {
  rookie: { background: '#F1F5F9', color: '#334155', border: '1px solid #CBD5E1' },
  elite:  { background: '#EEF2FF', color: '#1E40AF', border: '1px solid #BFDBFE' },
  master: { background: '#0A0A0A', color: '#F1F5F9', border: '1px solid #3D3D3D' },
  hidden: { background: '#0D1B2A', color: '#BAE6FD', border: '1px solid #38BDF8', fontStyle: 'italic' },
};

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
  const [panelStatus, setPanelStatus] = useState('active');
  const [missions, setMissions]   = useState([]);
  const [histFeedbacks, setHistFeedbacks] = useState([]);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    async function load() {
      try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      let { data: p } = await supabase
        .from('panels').select('*').eq('user_id', user.id).single();
      if (!p) { setLoading(false); return; }
      setPanel(p);
      setPanelStatus(p.status || 'active');

      // 잠수 페널티(감가상각) 지연 적용
      const { data: decayRes } = await supabase.rpc('apply_honor_decay', { p_panel_id: p.id });
      if (decayRes?.applied) {
        const { data: fresh } = await supabase
          .from('panels').select('*').eq('user_id', user.id).single();
        p = fresh;
        setPanel(fresh);
        setPanelStatus(fresh.status || 'active');
      }

      // 만료된 draft 정리 (filled_count 복원 + 수락 취소됨 알림 — migration 037)
      await supabase.rpc('expire_panel_drafts').then(({ error: e }) => {
        if (e) console.warn('[expire_drafts]', e.message);
      });

      const [{ data: ms }, { data: myFeedbacks }, { data: hFbs }] = await Promise.all([
        supabase.from('missions').select('id, title, type, status, persona, description, image_urls, panel_count, filled_count, created_at').eq('status', 'active')
          .order('created_at', { ascending: false }),
        supabase.from('feedbacks').select('mission_id, status').eq('panel_id', p?.id),
        supabase.from('feedbacks')
          .select('status, purity_passed, payout_amount, updated_at, created_at, missions(type)')
          .eq('panel_id', p?.id)
          .neq('status', 'draft'),
      ]);

      const myMissionIds = new Set((myFeedbacks || []).map(f => f.mission_id));
      const panelKey = p.experience ? getExperienceCareerKey(p.experience) : null;
      setMissions(
        (ms || []).filter(m => {
          if (myMissionIds.has(m.id) || (m.filled_count || 0) >= (m.panel_count || 1)) return false;
          if (panelKey) {
            try {
              const desc = JSON.parse(m.description || '{}');
              const cl = desc.careerLevels;
              if (Array.isArray(cl) && cl.length > 0 && !cl.includes(panelKey)) return false;
            } catch {}
          }
          return true;
        })
      );
      setHistFeedbacks(hFbs || []);

      // 마감 임박 알림: 쿼리 3개 → 1개로 최적화 (deadline 임박 draft+rejected 통합 조회)
      if (p?.id && user?.id && p?.notif_prefs?.deadlineWarning !== false) {
        const now = new Date();
        const inOneHour = new Date(now.getTime() + 60 * 60 * 1000);
        const { data: soonFbs } = await supabase
          .from('feedbacks')
          .select('id, mission_id, status, submission_deadline, rejection_deadline, missions(title)')
          .eq('panel_id', p.id)
          .in('status', ['draft', 'rejected'])
          .not('submission_deadline', 'is', null)
          .or(`submission_deadline.lte.${inOneHour.toISOString()},rejection_deadline.lte.${inOneHour.toISOString()}`);

        const candidates = (soonFbs || []).flatMap(d => {
          const items = [];
          const subDl = d.submission_deadline ? new Date(d.submission_deadline) : null;
          const rejDl = d.rejection_deadline  ? new Date(d.rejection_deadline)  : null;
          if (d.status === 'draft' && !d.rejection_deadline && subDl && subDl > now && subDl <= inOneHour) {
            items.push({ title: `[${d.missions?.title || '미션'}] 마감 임박 알림`, body: '1시간 후 제출 마감입니다. 지금 바로 참여해주세요.', action_url: `/panel/active?id=${d.mission_id}` });
          }
          if (d.status === 'draft' && d.rejection_deadline && rejDl && rejDl > now && rejDl <= inOneHour) {
            items.push({ title: `[${d.missions?.title || '미션'}] 재제출 마감 임박 알림`, body: '1시간 후 재제출 마감입니다. 지금 바로 완료해주세요.', action_url: `/panel/active?id=${d.mission_id}&resubmit=${d.id}` });
          }
          if (d.status === 'rejected' && rejDl && rejDl > now && rejDl <= inOneHour) {
            items.push({ title: `[${d.missions?.title || '미션'}] 재제출 마감 임박 알림`, body: '1시간 후 재제출 기회가 만료됩니다. 지금 바로 재작성하세요.', action_url: '/panel/missions' });
          }
          return items;
        });

        if (candidates.length > 0) {
          const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
          const { data: existingNotifs } = await supabase
            .from('notifications').select('title').eq('user_id', user.id)
            .ilike('title', '%마감 임박%').gte('created_at', todayStart.toISOString());
          const sentTitles = new Set((existingNotifs || []).map(n => n.title));
          const toInsert = candidates.filter(d => !sentTitles.has(d.title)).map(d => ({ user_id: user.id, type: 'warning', icon: '⏰', title: d.title, body: d.body, action_url: d.action_url, read: false, target_role: 'panel' }));
          if (toInsert.length > 0) supabase.from('notifications').insert(toInsert).then(({ error: ne }) => { if (ne) console.warn('[deadline_notif]', ne.message); });
        }
      }

      setLoading(false);
      } catch (err) {
        console.error('[PanelDashboard load error]', err);
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return (
    <div style={{ background: C.pageBg, minHeight: '100vh', padding: '40px 48px', color: C.text3, fontSize: 14 }}>불러오는 중...</div>
  );

  if (panelStatus === 'suspended') return (
    <div className="page-wrap" style={{ padding: '40px 48px', maxWidth: 900 }}>
      <Card style={{ textAlign: 'center', padding: '48px 24px' }}>
        <div style={{ fontSize: 36, marginBottom: 16 }}>🚫</div>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>계정이 정지되었습니다</h2>
        <p style={{ color: 'var(--text-2)', fontSize: 14, lineHeight: 1.7 }}>
          관리자에 의해 계정 활동이 정지되었습니다.<br/>
          문의사항은 운영팀에 연락해주세요.
        </p>
      </Card>
    </div>
  );

  const name        = panel?.name || '패널';
  const trustScore  = panel?.trust_score || 0;
  const streakCount = panel?.streak_count || 0;
  const weeklyCount = histFeedbacks.filter(f => {
    if (!f.created_at) return false;
    return new Date(f.created_at) >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  }).length;

  // 명예 레벨 파생 값
  const honorPoints = panel?.honor_points ?? 0;
  const honorLevel  = getHonorLevel(honorPoints);
  const nextLevel   = getNextLevel(honorPoints);
  const progressPct = getProgressPct(honorPoints);
  const colorMeta   = HONOR_COLOR_META[honorLevel.colorTier];
  const nextReward  = nextLevel ? getPanelReward(nextLevel.minPoints, panel?.experience) : null;
  const curReward   = getPanelReward(honorPoints, panel?.experience);

  const selectedBadgeKey  = panel?.selected_badge;
  const earnedBadgeSet    = new Set(panel?.badges || []);
  const selectedBadgeMeta = selectedBadgeKey && earnedBadgeSet.has(selectedBadgeKey)
    ? BADGE_CATALOG_DASH.find(b => b.key === selectedBadgeKey)
    : null;

  const approvedFbs = histFeedbacks.filter(f => f.purity_passed);
  const pendingFbs  = histFeedbacks.filter(f => !f.purity_passed && f.status === 'submitted');
  const rejectedFbs = histFeedbacks.filter(f => !f.purity_passed && f.status === 'rejected');
  const calcDashReward = (f) => {
    if (f.purity_passed && f.payout_amount != null) return Number(f.payout_amount);
    const isSub = ['preference', 'pricing', 'email'].includes(f.missions?.type);
    const base = getPanelReward(panel?.honor_points || 0, panel?.experience || '');
    return isSub ? Math.round(base * (4500 / 8000)) : base;
  };
  const totalPaid    = approvedFbs.reduce((s, f) => s + calcDashReward(f), 0);
  const totalPending = pendingFbs.reduce((s, f)  => s + calcDashReward(f), 0);

  return (
    <div className="page-wrap" style={{ background: C.pageBg, minHeight: '100vh', padding: '40px 48px', maxWidth: 1000, animation: 'fadeUp 0.5s ease both' }}>
      {/* 심사 대기 배너 */}
      {panelStatus === 'pending' && (
        <div style={{
          background: 'rgba(245,158,11,0.1)', border: '1px solid #F59E0B',
          borderRadius: 10, padding: '12px 16px', marginBottom: 12,
          display: 'flex', alignItems: 'center', gap: 10
        }}>
          <span style={{ fontSize: 20 }}>⏳</span>
          <span style={{ fontSize: 14, color: 'var(--text-2)' }}>
            <strong>심사 대기 중입니다.</strong> 검증 서류 검토 후 미션 참여가 활성화됩니다. (1–2 영업일 소요)
          </span>
        </div>
      )}
      {/* 검증 서류 미제출 유도 카드 */}
      {panelStatus === 'pending' && !panel?.health_insurance_url && !panel?.linkedin_url && !panel?.portfolio_url && (
        <Card style={{ padding: '16px 18px', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>경력 인증 서류 제출 필요</div>
              <div style={{ fontSize: 13, color: 'var(--text-2)' }}>심사 승인을 위해 검증 서류를 제출해 주세요.</div>
            </div>
            <Btn onClick={() => navigate('/panel/verify-docs')} style={{ whiteSpace: 'nowrap' }}>서류 제출하기 →</Btn>
          </div>
        </Card>
      )}
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
            {selectedBadgeMeta && (
              <span style={{
                fontSize: 11, fontWeight: 600, padding: '2px 8px',
                borderRadius: 4, ...DASH_TIER_STYLES[selectedBadgeMeta.tier],
              }}>
                {selectedBadgeMeta.name}
              </span>
            )}
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
            { label: '이번 주 활동', value: String(weeklyCount),               sub: '7일 내 제출', accent: weeklyCount >= 3 },
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
            <div style={{ fontSize: 12, color: C.text3, fontWeight: 500, marginBottom: 8 }}>총 정산 확정</div>
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
