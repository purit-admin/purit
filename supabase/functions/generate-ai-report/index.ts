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
    let missionQuery = supabase.from('missions').select('id, title, company_id, description');
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

    // 권한 게이트: 본인 회사 미션이거나 어드민만 허용
    //   이 함수는 service role 로 DB를 읽어 RLS 를 우회하므로 코드 레벨 소유권 검증이 필수.
    //   누락 시 로그인한 임의 기업이 타사 mission_id 로 호출해 타사 피드백 기반 AI 리포트를
    //   생성(피드백 내용 누출 + Anthropic API 비용)할 수 있음.
    const isAdmin = (user.app_metadata as Record<string, unknown> | undefined)?.role === 'admin';
    if (!isAdmin && (!companyId || mission.company_id !== companyId)) {
      return new Response(JSON.stringify({ error: '권한이 없습니다.' }), {
        status: 403, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
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

    // 6. 미션 description JSON 파싱 (컨텍스트 추출)
    let missionContext = '';
    try {
      const desc = JSON.parse((mission as Record<string, unknown>).description as string || '{}') as Record<string, unknown>;
      const parts: string[] = [];
      if (desc.industry) parts.push(`산업군: ${desc.industry}`);
      if (desc.product) parts.push(`서비스명: ${desc.product}`);
      if (desc.lpUrl) parts.push(`LP URL: ${desc.lpUrl}`);
      if (desc.personaAge || desc.personaRole || desc.personaIncome) {
        const persona = [desc.personaAge, desc.personaRole, desc.personaIncome, desc.personaContext]
          .filter(Boolean).join(', ');
        if (persona) parts.push(`타겟 페르소나: ${persona}`);
      }
      if (desc.briefText) parts.push(`브리핑: ${desc.briefText}`);
      if (Array.isArray(desc.focusAreas) && desc.focusAreas.length > 0) {
        parts.push(`집중 검증 영역: ${(desc.focusAreas as string[]).join(', ')}`);
      }
      missionContext = parts.join('\n');
    } catch {
      // description이 JSON이 아니면 무시
    }

    // 7. 퓨릿 점수 기반 코멘트 선별 (상위 10개)
    function calcPurityScore(f: Record<string, unknown>): number {
      const suggestions = (f.suggestions as string) || '';
      if (!suggestions) return 0;
      let score = 20;
      // 텍스트 길이 (max 20)
      const len = suggestions.length;
      score += Math.min(20, Math.floor(len / 30));
      // 섹션 균형 (max 10)
      const sections = suggestions.split('\n\n').filter((s: string) => s.length > 10).length;
      score += sections >= 4 ? 10 : sections >= 2 ? 4 : 0;
      // 구체성 키워드 (×4, max 25)
      const specificityKws = ['구체적', '특히', '예를 들어', '실제로', '%', '배', '배율', '초', '명', '원', '클릭', '전환', '이탈', '체류'];
      const specCount = specificityKws.filter(k => suggestions.includes(k)).length;
      score += Math.min(25, specCount * 4);
      // 실행 가능성 키워드 (×5, max 25)
      const actionKws = ['개선', '변경', '추가', '제거', '수정', '강화', '명확', '보완', '재작성', '테스트', '대체', '줄여', '늘려'];
      const actionCount = actionKws.filter(k => suggestions.includes(k)).length;
      score += Math.min(25, actionCount * 5);
      // AI 패턴 패널티 (×-12, min -30)
      const aiPatterns = ['안녕하세요', '감사합니다', '도움이 되셨으면', '좋은 하루', '잘 부탁드립니다'];
      const aiCount = aiPatterns.filter(k => suggestions.includes(k)).length;
      score += Math.max(-30, aiCount * -12);
      return Math.max(0, Math.min(100, score));
    }

    const sortedFeedbacks = [...feedbacks].sort(
      (a: Record<string, unknown>, b: Record<string, unknown>) =>
        calcPurityScore(b) - calcPurityScore(a)
    );
    const comments = sortedFeedbacks
      .map((f: Record<string, unknown>) => f.suggestions as string)
      .filter(Boolean)
      .slice(0, 10)
      .join('\n---\n');

    // 8. AI 호출 (ANTHROPIC_API_KEY 없으면 Mock 처리)
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

${missionContext ? `[미션 컨텍스트]\n${missionContext}\n` : ''}
[5대 지표 점수]
${scoreLines}

[패널 코멘트 — 신뢰도 높은 순 최대 10개]
${comments || '(코멘트 없음)'}

위 데이터를 바탕으로 다음 형식의 JSON만 응답하세요 (다른 텍스트 없이):
{
  "tldr": "3~4문장으로 핵심 요약. 가장 중요한 문제와 기회를 구체적으로 언급할 것. (한국어)",
  "priorityFixes": [
    {"area": "개선 영역명", "issue": "패널 코멘트에서 드러난 구체적 문제점", "action": "즉시 실행 가능한 구체적 액션 (예: '헤드라인 카피를 X에서 Y로 변경')", "impact": "기대 효과 (예: 전환율 +15~25% 예상)"},
    {"area": "...", "issue": "...", "action": "...", "impact": "..."},
    {"area": "...", "issue": "...", "action": "...", "impact": "..."}
  ],
  "strengths": ["실제 데이터에 근거한 강점 1 (한국어)", "강점 2 (한국어)", "강점 3 (한국어)"],
  "riskFlags": [
    {"level": "high", "text": "즉시 대응이 필요한 리스크 (한국어)"},
    {"level": "mid", "text": "중기적으로 개선해야 할 리스크 (한국어)"},
    {"level": "low", "text": "모니터링 필요 항목 (한국어)"}
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
          model: 'claude-sonnet-4-6',
          max_tokens: 2048,
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

    // 9. ai_reports INSERT (기존 레코드 있으면 삭제 후 재삽입)
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

    return new Response(JSON.stringify({ success: true, report: inserted, isMock: !anthropicKey }), {
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
