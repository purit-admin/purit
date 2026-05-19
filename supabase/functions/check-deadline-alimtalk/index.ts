// check-deadline-alimtalk/index.ts
// pg_cron이 30분마다 호출 → 마감 1시간 이내 패널에게 알림톡 발송
//
// ── 발송 조건 ────────────────────────────────────────────────
//   [최초 draft]  submission_deadline  ∈ (now, now+1h]  AND rejection_deadline IS NULL
//   [재제출 draft/rejected]  rejection_deadline ∈ (now, now+1h]
//   → 두 경우 모두 deadline_alimtalk_sent = false 인 것만
//   → 발송 후 deadline_alimtalk_sent = true 로 SET (중복 방지)
//
// ── 필요한 Secret ─────────────────────────────────────────────
//   SOLAPI_TPL_DEADLINE_REMINDER   마감 1시간 전 템플릿 ID
//   (나머지는 _shared/solapi.ts 참조)
//
// ── 알림톡 템플릿 변수 ────────────────────────────────────────
//   #{미션명}    의뢰 제목
//   #{마감시간}  "오후 3:30 (약 45분 후)" 형식
//   #{구분}      "제출" 또는 "재제출"

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { sendAlimtalk } from '../_shared/solapi.ts';

const DEADLINE_TPL = Deno.env.get('SOLAPI_TPL_DEADLINE_REMINDER')!;

// "오후 3:30 (약 45분 후)" 형식 포맷터
function formatDeadline(deadline: Date, now: Date): string {
  const diffMin = Math.round((deadline.getTime() - now.getTime()) / 60_000);
  const timeStr = deadline.toLocaleTimeString('ko-KR', {
    hour:   '2-digit',
    minute: '2-digit',
    hour12: true,
  });
  return `${timeStr} (약 ${diffMin}분 후)`;
}

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const now          = new Date();
  const oneHourLater = new Date(now.getTime() + 60 * 60 * 1_000);

  // ── 1. 최초 draft — submission_deadline 임박 ─────────────────
  const { data: initialDrafts, error: e1 } = await supabase
    .from('feedbacks')
    .select(`
      id, submission_deadline,
      panels!inner ( phone, phone_verified, name ),
      missions!inner ( title )
    `)
    .eq('status', 'draft')
    .is('rejection_deadline', null)
    .eq('deadline_alimtalk_sent', false)
    .gt('submission_deadline', now.toISOString())
    .lte('submission_deadline', oneHourLater.toISOString());

  if (e1) console.error('[check-deadline] initialDrafts 조회 실패:', e1.message);

  // ── 2. 재제출 draft / rejected — rejection_deadline 임박 ──────
  const { data: resubmitItems, error: e2 } = await supabase
    .from('feedbacks')
    .select(`
      id, rejection_deadline,
      panels!inner ( phone, phone_verified, name ),
      missions!inner ( title )
    `)
    .in('status', ['draft', 'rejected'])
    .not('rejection_deadline', 'is', null)
    .eq('deadline_alimtalk_sent', false)
    .gt('rejection_deadline', now.toISOString())
    .lte('rejection_deadline', oneHourLater.toISOString());

  if (e2) console.error('[check-deadline] resubmitItems 조회 실패:', e2.message);

  // ── 처리 목록 통합 ────────────────────────────────────────────
  type Row = {
    id: string;
    deadline: string;
    type: '제출' | '재제출';
    panels: { phone: string; phone_verified: boolean; name: string };
    missions: { title: string };
  };

  const toProcess: Row[] = [
    ...(initialDrafts  || []).map(f => ({ ...f, deadline: f.submission_deadline, type: '제출'   as const })),
    ...(resubmitItems  || []).map(f => ({ ...f, deadline: f.rejection_deadline,  type: '재제출' as const })),
  ];

  let sent = 0;
  let failed = 0;

  for (const f of toProcess) {
    const panel = f.panels;

    // 패널: OTP 인증 완료 + 전화번호 있어야 발송
    if (!panel?.phone || !panel?.phone_verified) continue;

    const variables = {
      '#{미션명}':   f.missions?.title || '미션',
      '#{마감시간}': formatDeadline(new Date(f.deadline), now),
      '#{구분}':     f.type,
    };

    try {
      await sendAlimtalk(panel.phone, DEADLINE_TPL, variables);

      // 발송 완료 플래그 SET
      const { error: ue } = await supabase
        .from('feedbacks')
        .update({ deadline_alimtalk_sent: true })
        .eq('id', f.id);

      if (ue) console.warn(`[check-deadline] sent 플래그 저장 실패 feedback=${f.id}:`, ue.message);
      else sent++;

      console.log(`[check-deadline] 발송 완료 — to=${panel.phone} type=${f.type} feedback=${f.id}`);
    } catch (err) {
      failed++;
      console.error(`[check-deadline] 발송 실패 feedback=${f.id}:`, (err as Error).message);
    }
  }

  return new Response(
    JSON.stringify({ processed: toProcess.length, sent, failed }),
    { headers: { 'Content-Type': 'application/json' } },
  );
});
