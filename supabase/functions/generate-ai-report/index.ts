import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  try {
    // 1. 인증
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');

    // 사용자 인증 검증용 (anon key 사용)
    const supabaseUser = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    // DB 작업용 (service role)
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // 2. mission_id 수신
    const { mission_id } = await req.json();

    // company 조회
    const { data: company } = await supabase
      .from('companies')
      .select('id, name')
      .eq('user_id', user.id)
      .single();

    // company가 없으면 admin일 수 있으므로 mission에서 직접 company_id 사용
    let companyId = company?.id;
    let companyName = company?.name ?? 'PURIT';

    // 3. 미션 정보 조회
    let missionQuery = supabase.from('missions').select('id, title, company_id');
    if (mission_id) {
      missionQuery = missionQuery.eq('id', mission_id);
    } else if (companyId) {
      missionQuery = missionQuery.eq('company_id', companyId).order('created_at', { ascending: false }).limit(1);
    }
    const { data: missions } = await missionQuery;
    const mission = missions?.[0];

    if (!mission) {
      return new Response(JSON.stringify({ error: '미션을 찾을 수 없습니다.' }), {
        status: 404, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    if (!companyId) companyId = mission.company_id;

    // 4. 피드백 조회 (purity_passed=true 우선, 없으면 전체)
    let { data: feedbacks } = await supabase
      .from('feedbacks')
      .select('clarity_score,relevance_score,value_score,differentiation_score,trust_score,suggestions,strengths,weaknesses')
      .eq('mission_id', mission.id)
      .eq('purity_passed', true);

    if (!feedbacks || feedbacks.length === 0) {
      const { data: allFeedbacks } = await supabase
        .from('feedbacks')
        .select('clarity_score,relevance_score,value_score,differentiation_score,trust_score,suggestions,strengths,weaknesses')
        .eq('mission_id', mission.id);
      feedbacks = allFeedbacks ?? [];
    }

    if (!feedbacks || feedbacks.length === 0) {
      return new Response(JSON.stringify({ error: '분석할 피드백 데이터가 없습니다.' }), {
        status: 422, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    // 5. 점수 집계
    const DIMS = [
      { key: 'clarity_score', label: '헤드라인·명확성' },
      { key: 'relevance_score', label: '관련성·페르소나' },
      { key: 'value_score', label: '가치·가격' },
      { key: 'differentiation_score', label: '차별화' },
      { key: 'trust_score', label: '신뢰·사회적 증거' },
    ] as const;

    const scores: Record<string, number> = {};
    for (const dim of DIMS) {
      const vals = feedbacks.map((f: Record<string, unknown>) => f[dim.key] as number).filter(Boolean);
      scores[dim.key] = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    }
    const overallScore = Object.values(scores).reduce((a, b) => a + b, 0) / DIMS.length;

    // 6. 패널 코멘트 수집 (suggestions)
    const comments = feedbacks
      .map((f: Record<string, unknown>) => f.suggestions as string)
      .filter(Boolean)
      .slice(0, 10)
      .join('\n---\n');

    // 7. AI 호출 (ANTHROPIC_API_KEY 없으면 Mock 처리)
    let aiResult: {
      tldr: string;
      priorityFixes: Array<{ area: string; issue: string; action: string; impact: string }>;
      strengths: string[];
      riskFlags: Array<{ level: string; text: string }>;
    };

    if (anthropicKey) {
      const scoreLines = DIMS.map(d => `- ${d.label}: ${scores[d.key].toFixed(2)}/5`).join('\n');
      const prompt = `당신은 전환율 최적화(CRO) 전문가입니다. 아래 패널 피드백 데이터를 분석해 마케팅 개선 인사이트를 한국어로 제공하세요.

미션: ${mission.title}
기업: ${companyName}
패널 수: ${feedbacks.length}명
종합 점수: ${overallScore.toFixed(2)}/5

5차원 점수:
${scoreLines}

패널 코멘트 (일부):
${comments || '(코멘트 없음)'}

다음 형식의 JSON만 응답하세요 (다른 텍스트 없이):
{
  "tldr": "2~3문장으로 핵심 요약 (한국어)",
  "priorityFixes": [
    {"area": "개선 영역명", "issue": "문제 설명", "action": "구체적 권장 액션", "impact": "기대 효과 (예: 전환율 +15% 예상)"},
    {"area": "...", "issue": "...", "action": "...", "impact": "..."},
    {"area": "...", "issue": "...", "action": "...", "impact": "..."}
  ],
  "strengths": ["강점 1 (한국어)", "강점 2 (한국어)"],
  "riskFlags": [
    {"level": "high", "text": "리스크 설명 (한국어)"},
    {"level": "mid", "text": "리스크 설명 (한국어)"}
  ]
}`;

      const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 1024,
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      if (!anthropicRes.ok) {
        throw new Error(`Anthropic API 오류: ${anthropicRes.status}`);
      }

      const anthropicData = await anthropicRes.json();
      const rawText = anthropicData.content?.[0]?.text ?? '{}';

      // JSON 파싱 (마크다운 코드블록 제거)
      const jsonStr = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      aiResult = JSON.parse(jsonStr);
    } else {
      // API Key 없을 때 Mock 응답 (로컬 계산 기반)
      const sortedDims = [...DIMS].sort((a, b) => scores[a.key] - scores[b.key]);
      aiResult = {
        tldr: `[Mock] ${companyName}의 LP 종합 점수는 ${overallScore.toFixed(1)}/5입니다. ${sortedDims[0].label} 개선이 가장 시급합니다. ANTHROPIC_API_KEY를 설정하면 실제 AI 분석을 받을 수 있습니다.`,
        priorityFixes: sortedDims.slice(0, 3).map((d, i) => ({
          area: d.label,
          issue: `${d.label} 점수 ${scores[d.key].toFixed(1)}/5 — 개선 필요`,
          action: '전문 카피라이터와 함께 해당 영역 메시지를 재작성하세요.',
          impact: `전환율 +${(3 - i) * 5}~${(4 - i) * 5}% 예상`,
        })),
        strengths: [...DIMS]
          .sort((a, b) => scores[b.key] - scores[a.key])
          .slice(0, 2)
          .map(d => `${d.label} 점수 ${scores[d.key].toFixed(1)}/5 — 유지 권장`),
        riskFlags: [{ level: 'mid', text: 'ANTHROPIC_API_KEY 미설정으로 실제 AI 분석이 비활성화된 상태입니다.' }],
      };
    }

    // 8. ai_reports INSERT (기존 레코드 있으면 삭제 후 재삽입)
    await supabase.from('ai_reports').delete().eq('mission_id', mission.id).eq('company_id', companyId);

    const { data: inserted, error: insertErr } = await supabase.from('ai_reports').insert({
      mission_id: mission.id,
      company_id: companyId,
      tldr: aiResult.tldr,
      priority_fixes: aiResult.priorityFixes,
      strengths: aiResult.strengths,
      risk_flags: aiResult.riskFlags,
      overall_score: parseFloat(overallScore.toFixed(2)),
      panel_count: feedbacks.length,
    }).select().single();

    if (insertErr) throw insertErr;

    return new Response(JSON.stringify({ success: true, report: inserted }), {
      status: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('generate-ai-report error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
});
