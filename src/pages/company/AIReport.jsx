import { useState, useEffect } from 'react';
import { Card, Badge, Btn } from '../../components/ui';
import { supabase } from '../../lib/supabase';

const DIMS = [
  { key: 'clarity_score',         label: '헤드라인·명확성' },
  { key: 'relevance_score',       label: '관련성·페르소나' },
  { key: 'value_score',           label: '가치·가격' },
  { key: 'differentiation_score', label: '차별화' },
  { key: 'trust_score',           label: '신뢰·사회적 증거' },
];

const IMPACT_MAP = {
  clarity_score:         ['전환율 +15~25% 예상', '헤드라인이 카테고리 정체성 없이 타겟이 즉시 이탈합니다.', '구체적 성과 수치를 포함한 헤드라인으로 교체하세요.'],
  relevance_score:       ['전환율 +10~15% 예상', '타겟 고객의 상황·고통에 공감하는 메시지가 부족합니다.', '페르소나 언어로 재작성하고 "당신의 문제" 중심으로 구성하세요.'],
  value_score:           ['전환율 +8~12% 예상', '가격 대비 가치 전달이 불명확합니다.', '구체적 수치·비교·사용 후기로 가치를 수치화하세요.'],
  differentiation_score: ['전환율 +8~12% 예상', '"왜 이 제품이어야 하는가"에 대한 답이 없습니다.', '경쟁 대비 고유 강점 섹션 또는 비교표를 추가하세요.'],
  trust_score:           ['전환율 +6~10% 예상', '신뢰 근거가 부족하거나 구매 흐름에서 보이지 않습니다.', '리뷰·수치·미디어 노출 근거를 구매 버튼 주변에 배치하세요.'],
};

function getVerdict(score) {
  if (score >= 4.0) return { text: '우수', color: 'var(--green)' };
  if (score >= 3.0) return { text: '보통', color: '#F59E0B' };
  return { text: '개선 필요', color: 'var(--red)' };
}

export default function AIReport() {
  const [expanded, setExpanded] = useState(null);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [aiGenerated, setAiGenerated] = useState(false);
  const [latestMissionId, setLatestMissionId] = useState(null);
  const [generateError, setGenerateError] = useState(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data: co } = await supabase.from('companies').select('id, name').eq('user_id', user.id).single();
    if (!co) { setLoading(false); return; }

    const { data: missions } = await supabase.from('missions').select('id, title, created_at').eq('company_id', co.id).order('created_at', { ascending: false }).limit(1);
    const latestMission = missions?.[0];

    const missionIds = (await supabase.from('missions').select('id').eq('company_id', co.id)).data?.map(m => m.id) || [];
    if (!missionIds.length) { setLoading(false); return; }

    if (latestMission?.id) setLatestMissionId(latestMission.id);

    let { data: feedbacks } = await supabase.from('feedbacks')
      .select('clarity_score,relevance_score,value_score,differentiation_score,trust_score,strengths,weaknesses,created_at')
      .in('mission_id', missionIds)
      .eq('purity_passed', true);

    // purity_passed 없으면 submitted 전체로 폴백
    if (!feedbacks?.length) {
      const { data: fallback } = await supabase.from('feedbacks')
        .select('clarity_score,relevance_score,value_score,differentiation_score,trust_score,strengths,weaknesses,created_at')
        .in('mission_id', missionIds)
        .eq('status', 'submitted');
      feedbacks = fallback || [];
    }

    if (!feedbacks?.length) { setLoading(false); return; }

    // 로컬 계산 (폴백용)
    const dimAvgs = {};
    DIMS.forEach(d => {
      const vals = feedbacks.map(f => f[d.key]).filter(Boolean);
      dimAvgs[d.key] = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    });
    const overallAvg = Object.values(dimAvgs).reduce((a, b) => a + b, 0) / DIMS.length;
    const verdict = getVerdict(overallAvg);
    const sortedDims = [...DIMS].sort((a, b) => dimAvgs[a.key] - dimAvgs[b.key]);
    const localPriorityFixes = sortedDims.slice(0, 3).map((d, i) => ({
      priority: i + 1,
      area: d.label,
      impact: IMPACT_MAP[d.key][0],
      issue: IMPACT_MAP[d.key][1],
      action: IMPACT_MAP[d.key][2],
    }));
    const topStrengths = [...DIMS].sort((a, b) => dimAvgs[b.key] - dimAvgs[a.key]).slice(0, 2);
    const localStrengths = [
      ...feedbacks.slice(0, 2).map(f => f.strengths).filter(Boolean),
      ...topStrengths.map(d => `${d.label} 영역 점수 ${dimAvgs[d.key].toFixed(1)}/5 — 유지 권장`),
    ].filter(Boolean).slice(0, 3);
    const localRiskFlags = feedbacks.map(f => f.weaknesses).filter(Boolean).slice(0, 2).map((text, i) => ({
      level: i === 0 ? 'high' : 'mid',
      text,
    }));

    const baseReport = {
      mission: latestMission?.title || '최근 의뢰',
      company: co.name,
      generatedAt: new Date().toLocaleString('ko-KR'),
      panelCount: feedbacks.length,
      overallVerdict: verdict.text,
      verdictColor: verdict.color,
      tldr: `${co.name}의 LP는 종합 전환 점수 ${overallAvg.toFixed(1)}/5입니다. ${sortedDims[0].label} 개선이 가장 시급하며, ${topStrengths[0].label}은 강점으로 유지하세요.`,
      priorityFixes: localPriorityFixes,
      strengths: localStrengths,
      riskFlags: localRiskFlags,
    };

    // 기존 AI 리포트 확인
    if (latestMission?.id) {
      const { data: aiRow } = await supabase
        .from('ai_reports')
        .select('*')
        .eq('mission_id', latestMission.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (aiRow) {
        const aiVerdict = getVerdict(aiRow.overall_score ?? overallAvg);
        setReport({
          ...baseReport,
          panelCount: aiRow.panel_count ?? feedbacks.length,
          generatedAt: new Date(aiRow.created_at).toLocaleString('ko-KR') + ' (AI 분석)',
          overallVerdict: aiVerdict.text,
          verdictColor: aiVerdict.color,
          tldr: aiRow.tldr ?? baseReport.tldr,
          priorityFixes: (aiRow.priority_fixes ?? []).map((f, i) => ({ ...f, priority: i + 1 })),
          strengths: aiRow.strengths ?? baseReport.strengths,
          riskFlags: aiRow.risk_flags ?? baseReport.riskFlags,
        });
        setAiGenerated(true);
        setLoading(false);
        return;
      }
    }

    setReport(baseReport);
    setLoading(false);
  }

  async function generateReport() {
    if (!latestMissionId) return;
    setGenerating(true);
    setGenerateError(null);
    try {
      const { data, error } = await supabase.functions.invoke('generate-ai-report', {
        body: { mission_id: latestMissionId },
      });
      if (error) throw error;
      if (data?.report) {
        const r = data.report;
        const aiVerdict = getVerdict(r.overall_score ?? 0);
        setReport(prev => ({
          ...prev,
          panelCount: r.panel_count ?? prev.panelCount,
          generatedAt: new Date(r.created_at).toLocaleString('ko-KR') + ' (AI 분석)',
          overallVerdict: aiVerdict.text,
          verdictColor: aiVerdict.color,
          tldr: r.tldr ?? prev.tldr,
          priorityFixes: (r.priority_fixes ?? []).map((f, i) => ({ ...f, priority: i + 1 })),
          strengths: r.strengths ?? prev.strengths,
          riskFlags: r.risk_flags ?? prev.riskFlags,
        }));
        setAiGenerated(true);
      }
    } catch (e) {
      setGenerateError(e?.message ?? 'AI 리포트 생성 중 오류가 발생했습니다.');
    } finally {
      setGenerating(false);
    }
  }

  if (loading) return (
    <div style={{ padding: '40px 48px', color: 'var(--text-3)', fontFamily: 'var(--font-sans)', fontSize: 13 }}>리포트 로드 중…</div>
  );

  if (!report) return (
    <div style={{ padding: '40px 48px', maxWidth: 880 }}>
      <div style={{ fontSize: 12, fontFamily: 'var(--font-sans)', color: 'var(--text-2)', marginBottom: 8, letterSpacing: '0.1em' }}>AI INSIGHT REPORT</div>
      <Card style={{ padding: '60px', textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>🤖</div>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>분석할 피드백 데이터가 없습니다</div>
        <div style={{ color: 'var(--text-2)', fontSize: 13 }}>의뢰를 등록하고 패널 피드백이 수집되면 AI 리포트가 자동 생성됩니다.</div>
      </Card>
    </div>
  );

  return (
    <div className="page-wrap" style={{ padding: '40px 48px', maxWidth: 880, animation: 'fadeUp 0.5s ease both' }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 12, fontFamily: 'var(--font-sans)', color: 'var(--text-2)', marginBottom: 8, letterSpacing: '0.1em' }}>
          AI INSIGHT REPORT{aiGenerated && <span style={{ marginLeft: 8, color: 'var(--green)' }}>✦ AI 분석 완료</span>}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 4 }}>{report.mission}</h1>
            <div style={{ fontSize: 13, color: 'var(--text-3)' }}>
              {report.company} · 패널 {report.panelCount}명 · {report.generatedAt}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10 }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, fontFamily: 'var(--font-sans)', color: 'var(--text-3)', marginBottom: 4 }}>종합 판정</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: report.verdictColor }}>{report.overallVerdict}</div>
            </div>
            {latestMissionId && (
              <Btn
                variant="primary"
                size="sm"
                onClick={generateReport}
                disabled={generating}
              >
                {generating ? '분석 중…' : aiGenerated ? 'AI 리포트 재생성' : 'AI 리포트 생성'}
              </Btn>
            )}
          </div>
        </div>
        {generateError && (
          <div style={{ marginTop: 12, padding: '10px 14px', background: 'var(--surface)', borderRadius: 'var(--radius)', fontSize: 13, color: 'var(--red)', border: '1px solid var(--border)' }}>
            {generateError}
          </div>
        )}
      </div>

      {/* TL;DR */}
      <Card style={{ marginBottom: 24, background: 'linear-gradient(135deg, var(--surface), var(--bg-3))', borderLeft: '3px solid var(--accent)' }}>
        <div style={{ fontSize: 11, fontFamily: 'var(--font-sans)', color: 'var(--text-2)', marginBottom: 8, letterSpacing: '0.08em' }}>TL;DR — 핵심 요약</div>
        <p style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--text)', marginBottom: 0 }}>{report.tldr}</p>
      </Card>

      {/* Priority Fixes */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>우선 개선 과제</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {report.priorityFixes.map(fix => (
            <Card
              key={fix.priority}
              style={{ cursor: 'pointer', transition: 'all 0.15s' }}
              onClick={() => setExpanded(expanded === fix.priority ? null : fix.priority)}
            >
              <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: fix.priority === 1 ? 'var(--red)' : fix.priority === 2 ? 'var(--accent)' : 'var(--blue)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14, flexShrink: 0 }}>
                  {fix.priority}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>{fix.area}</span>
                    <Badge type="green">{fix.impact}</Badge>
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: expanded === fix.priority ? 10 : 0 }}>{fix.issue}</div>
                  {expanded === fix.priority && (
                    <div style={{ padding: '12px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 13, color: 'var(--text)', lineHeight: 1.7 }}>
                      <strong>권장 액션:</strong> {fix.action}
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Strengths */}
      {report.strengths.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>유지할 강점</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {report.strengths.map((s, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, padding: '12px 16px', background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', borderLeft: '3px solid var(--green)' }}>
                <span style={{ color: 'var(--green)', flexShrink: 0 }}>✓</span>
                <span style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6 }}>{s}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Risk Flags */}
      {report.riskFlags.length > 0 && (
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>리스크 플래그</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {report.riskFlags.map((f, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '12px 16px', background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', borderLeft: `3px solid ${f.level === 'high' ? 'var(--red)' : 'var(--accent)'}` }}>
                <Badge type={f.level === 'high' ? 'red' : 'gold'} style={{ flexShrink: 0 }}>{f.level === 'high' ? 'HIGH' : 'MID'}</Badge>
                <span style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6 }}>{f.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
