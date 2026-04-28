import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Stat, Btn, Badge } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { motion } from 'framer-motion';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  RadialBarChart, RadialBar,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts';

const STATUS_LABEL = { draft: '초안', active: '진행 중', in_review: '검토 중', completed: '완료', cancelled: '취소' };
const STATUS_COLOR = { draft: 'gray', active: 'green', in_review: 'blue', completed: 'gold', cancelled: 'red' };

const BENCHMARK = { 명확성: 3.2, 관련성: 3.5, 가치: 3.0, 차별성: 2.8, 신뢰도: 3.3 };
const SCORE_KEYS = ['clarity_score', 'relevance_score', 'value_score', 'differentiation_score', 'trust_score'];
const DIM_LABELS = ['명확성', '관련성', '가치', '차별성', '신뢰도'];

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, ease: 'easeOut', delay },
});
const stagger = { initial: {}, animate: { transition: { staggerChildren: 0.07 } } };
const staggerItem = { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0, transition: { duration: 0.4 } } };

function computeRadar(fbs) {
  const avg = key => {
    const vals = fbs.map(f => f[key]).filter(v => v != null && v > 0);
    return vals.length ? +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : 0;
  };
  return DIM_LABELS.map((label, i) => ({
    dimension: label,
    score: avg(SCORE_KEYS[i]),
    benchmark: BENCHMARK[label],
    fullMark: 5,
  }));
}

function computeSentiment(missions, fbs) {
  return missions.slice(0, 5).map(m => {
    const mFbs = fbs.filter(f => f.mission_id === m.id);
    if (!mFbs.length) return { name: m.title?.slice(0, 7), positive: 0, negative: 0 };
    const posCount = mFbs.filter(f => {
      const scores = SCORE_KEYS.map(k => f[k]).filter(v => v != null && v > 0);
      const a = scores.length ? scores.reduce((s, v) => s + v, 0) / scores.length : 0;
      return a >= 3.5;
    }).length;
    const positive = Math.round((posCount / mFbs.length) * 100);
    return { name: m.title?.slice(0, 7), positive, negative: 100 - positive };
  });
}

export default function CompanyDashboard() {
  const navigate = useNavigate();
  const [company, setCompany]     = useState(null);
  const [missions, setMissions]   = useState([]);
  const [feedbacks, setFeedbacks] = useState([]);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: co } = await supabase
        .from('companies')
        .select('*')
        .eq('user_id', user.id)
        .single();
      setCompany(co);

      if (co) {
        const { data: ms } = await supabase
          .from('missions')
          .select('*, feedbacks(id)')
          .eq('company_id', co.id)
          .order('created_at', { ascending: false });
        setMissions(ms || []);

        if (ms?.length) {
          const { data: fb } = await supabase
            .from('feedbacks')
            .select('clarity_score,relevance_score,value_score,differentiation_score,trust_score,mission_id')
            .eq('status', 'submitted')
            .in('mission_id', ms.map(m => m.id));
          setFeedbacks(fb || []);
        }
      }
      setLoading(false);
    }
    load();
  }, []);

  const activeMissions    = missions.filter(m => m.status === 'active');
  const completedMissions = missions.filter(m => m.status === 'completed');

  const radarData     = computeRadar(feedbacks);
  const overallScore  = radarData.reduce((acc, d) => acc + d.score, 0) / radarData.length;
  const gaugeValue    = feedbacks.length > 0 ? Math.round((overallScore / 5) * 100) : 0;
  const gaugeData     = [{ name: '전환 지수', value: gaugeValue, fill: '#6366f1' }];
  const sentimentData = computeSentiment(missions, feedbacks);

  if (loading) return (
    <div style={{ padding: '40px 48px', color: 'var(--text-3)', fontSize: 14 }}>불러오는 중...</div>
  );

  return (
    <div style={{ padding: '40px 48px', maxWidth: 1100 }}>

      {/* Header */}
      <motion.div {...fadeUp(0)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 40 }}>
        <div>
          <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--accent)', marginBottom: 8, letterSpacing: '0.1em' }}>
            COMPANY PORTAL
          </div>
          <h1 style={{ fontSize: 32, fontWeight: 800, marginBottom: 6 }}>
            {company?.name || '대시보드'}
          </h1>
          <p style={{ color: 'var(--text-2)', fontSize: 14 }}>광고비 집행 전 전환 결함을 미리 잡으세요.</p>
        </div>
        <Btn onClick={() => navigate('/company/new')} size="lg">+ 새 의뢰 등록</Btn>
      </motion.div>

      {/* Stats */}
      <motion.div
        variants={stagger}
        initial="initial"
        animate="animate"
        style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, background: 'var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', marginBottom: 32 }}
      >
        {[
          { label: '전체 의뢰',  value: String(missions.length),          sub: '누적' },
          { label: '진행 중',    value: String(activeMissions.length),    sub: '현재 활성' },
          { label: '완료',       value: String(completedMissions.length), sub: '검증 완료' },
          { label: '수집 피드백', value: String(feedbacks.length),         sub: '제출 완료', accent: feedbacks.length > 0 },
        ].map(s => (
          <motion.div key={s.label} variants={staggerItem} style={{ background: 'var(--surface)', padding: '24px 28px' }}>
            <Stat {...s} />
          </motion.div>
        ))}
      </motion.div>

      {/* Chart Row 1: 레이더 + KPI 게이지 */}
      <motion.div {...fadeUp(0.1)} style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 16, marginBottom: 16 }}>

        {/* 5차원 레이더 차트 */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '28px 24px' }}>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--accent)', letterSpacing: '0.08em', marginBottom: 4 }}>5-DIMENSION BALANCE</div>
            <div style={{ fontSize: 17, fontWeight: 700 }}>전환 메시지 5차원 진단</div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
              {feedbacks.length > 0 ? `패널 ${feedbacks.length}명 제출 기준 · 플랫폼 벤치마크 비교` : '피드백 수집 시 실데이터로 업데이트됩니다'}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <RadarChart data={radarData} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
              <PolarGrid stroke="var(--border)" />
              <PolarAngleAxis dataKey="dimension" tick={{ fill: 'var(--text-2)', fontSize: 12, fontWeight: 600 }} />
              <PolarRadiusAxis angle={90} domain={[0, 5]} tick={false} axisLine={false} />
              <Radar name="내 점수" dataKey="score" stroke="#6366f1" fill="#6366f1" fillOpacity={0.25} strokeWidth={2} isAnimationActive animationDuration={1000} />
              <Radar name="벤치마크" dataKey="benchmark" stroke="#94a3b8" fill="#94a3b8" fillOpacity={0.1} strokeWidth={1.5} strokeDasharray="4 3" isAnimationActive animationDuration={1000} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: 'var(--text-2)', paddingTop: 8 }} />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        {/* KPI 게이지 */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '28px 24px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--accent)', letterSpacing: '0.08em', marginBottom: 4 }}>OVERALL KPI</div>
            <div style={{ fontSize: 17, fontWeight: 700 }}>전환 지수 달성률</div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>5개 축 종합 퍼포먼스</div>
          </div>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ResponsiveContainer width="100%" height={190}>
              <RadialBarChart
                data={gaugeData}
                innerRadius="55%"
                outerRadius="85%"
                startAngle={180}
                endAngle={0}
                barSize={18}
              >
                <RadialBar background={{ fill: 'var(--border)' }} dataKey="value" cornerRadius={10} isAnimationActive animationDuration={1200} />
              </RadialBarChart>
            </ResponsiveContainer>
            <div style={{ position: 'absolute', bottom: 14, textAlign: 'center' }}>
              <div style={{ fontSize: 40, fontWeight: 900, color: feedbacks.length > 0 ? 'var(--accent)' : 'var(--text-3)', lineHeight: 1 }}>
                {feedbacks.length > 0 ? gaugeValue : '—'}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 4 }}>
                {feedbacks.length > 0 ? '/ 100점' : '데이터 없음'}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 4 }}>
            {radarData.map(d => (
              <div key={d.dimension} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ fontSize: 11, color: 'var(--text-2)', width: 44, flexShrink: 0 }}>{d.dimension}</div>
                <div style={{ flex: 1, height: 5, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(d.score / 5) * 100}%` }}
                    transition={{ duration: 0.9, ease: 'easeOut', delay: 0.3 }}
                    style={{ height: '100%', background: '#6366f1', borderRadius: 3 }}
                  />
                </div>
                <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-2)', width: 24, textAlign: 'right' }}>
                  {d.score > 0 ? d.score : '—'}
                </div>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Chart Row 2: 긍/부정 스택 바 */}
      <motion.div {...fadeUp(0.2)} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '28px 24px', marginBottom: 32 }}>
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--accent)', letterSpacing: '0.08em', marginBottom: 4 }}>SENTIMENT ANALYSIS</div>
          <div style={{ fontSize: 17, fontWeight: 700 }}>타겟별 긍/부정 반응 분포</div>
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
            {feedbacks.length > 0 ? '평균 점수 3.5 이상 = 긍정 반응 기준' : '피드백 수집 시 실데이터로 업데이트됩니다'}
          </div>
        </div>
        {sentimentData.length > 0 ? (
          <ResponsiveContainer width="100%" height={Math.max(180, sentimentData.length * 44)}>
            <BarChart data={sentimentData} layout="vertical" margin={{ top: 0, right: 24, bottom: 0, left: 64 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
              <XAxis type="number" domain={[0, 100]} tick={{ fill: 'var(--text-3)', fontSize: 11 }} tickFormatter={v => `${v}%`} />
              <YAxis type="category" dataKey="name" tick={{ fill: 'var(--text-2)', fontSize: 12, fontWeight: 600 }} width={60} />
              <Tooltip
                formatter={(value, name) => [`${value}%`, name === 'positive' ? '긍정' : '부정']}
                contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
              />
              <Legend
                iconType="circle"
                iconSize={8}
                formatter={v => v === 'positive' ? '긍정 반응' : '부정 반응'}
                wrapperStyle={{ fontSize: 12, color: 'var(--text-2)' }}
              />
              <Bar dataKey="positive" stackId="a" fill="#6366f1" isAnimationActive animationDuration={1000} />
              <Bar dataKey="negative" stackId="a" fill="#f87171" radius={[0, 4, 4, 0]} isAnimationActive animationDuration={1000} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)', fontSize: 14 }}>
            의뢰를 등록하고 피드백이 수집되면 차트가 표시됩니다.
          </div>
        )}
      </motion.div>

      {/* 진행 중인 의뢰 */}
      <motion.div {...fadeUp(0.3)}>
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: 'var(--text-2)' }}>진행 중인 의뢰</h2>
        {activeMissions.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', color: 'var(--text-3)', fontSize: 14, marginBottom: 32 }}>
            진행 중인 의뢰가 없습니다.{' '}
            <span style={{ color: 'var(--accent)', cursor: 'pointer', fontWeight: 600 }} onClick={() => navigate('/company/new')}>첫 의뢰를 등록해보세요 →</span>
          </div>
        ) : (
          <motion.div variants={stagger} initial="initial" animate="animate" style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 32 }}>
            {activeMissions.map(m => (
              <motion.div key={m.id} variants={staggerItem} whileHover={{ y: -2 }} transition={{ duration: 0.15 }}>
                <Card onClick={() => navigate('/company/results')}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                        <Badge type="green">진행 중</Badge>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-3)' }}>
                          {m.id.slice(0, 8).toUpperCase()}
                        </span>
                      </div>
                      <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>{m.title}</div>
                      {m.target_url && (
                        <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{m.target_url}</div>
                      )}
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 24 }}>
                      <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 4, fontFamily: 'var(--font-mono)' }}>피드백 수집</div>
                      <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--accent)' }}>
                        {m.feedbacks?.length ?? m.filled_count ?? 0}
                        <span style={{ fontSize: 16, color: 'var(--text-3)', fontWeight: 400 }}> / {m.panel_count}</span>
                      </div>
                      <div style={{ width: 120, height: 4, background: 'var(--border)', borderRadius: 2, marginTop: 8, overflow: 'hidden', marginLeft: 'auto' }}>
                        <div style={{ width: `${Math.min(((m.feedbacks?.length ?? m.filled_count ?? 0) / m.panel_count) * 100, 100)}%`, height: '100%', background: 'var(--accent)', borderRadius: 2, transition: 'width 0.4s' }} />
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 8 }}>
                        {new Date(m.created_at).toLocaleDateString('ko-KR')} 등록
                      </div>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        )}
      </motion.div>

      {/* 전체 의뢰 현황 */}
      <motion.div {...fadeUp(0.35)}>
        <h2 style={{ fontSize: 16, fontWeight: 700, margin: '32px 0 16px', color: 'var(--text-2)' }}>전체 의뢰 현황</h2>
        {missions.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-3)', fontSize: 14 }}>
            등록된 의뢰가 없습니다.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {missions.map(m => (
              <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px', background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                <Badge type={STATUS_COLOR[m.status] || 'gray'}>{STATUS_LABEL[m.status] || m.status}</Badge>
                <div style={{ flex: 1 }}><span style={{ fontWeight: 600 }}>{m.title}</span></div>
                <div style={{ color: 'var(--text-3)', fontSize: 13, fontFamily: 'var(--font-mono)' }}>패널 {m.panel_count}명</div>
                <div style={{ color: 'var(--text-3)', fontSize: 12 }}>{new Date(m.created_at).toLocaleDateString('ko-KR')}</div>
              </div>
            ))}
          </div>
        )}
      </motion.div>

    </div>
  );
}
