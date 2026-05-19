// send-alimtalk/index.ts
// Supabase DB Webhook: notifications 테이블 INSERT 시 알림톡 발송
//
// ── 발송 대상 (8개 이벤트) ───────────────────────────────────
//   [패널] 피드백 승인 / 피드백 반려
//   [기업] 의뢰 완료 / 조기종료 피드백 공개 / 의뢰 취소 처리 / 의뢰 재개 / 의뢰 재진행
//
// ── 필요한 Supabase Secrets (supabase secrets set 으로 등록) ─
//   SOLAPI_API_KEY              Solapi API 키
//   SOLAPI_API_SECRET           Solapi API 시크릿
//   SOLAPI_SENDER_PHONE         발신 번호 (예: 01012345678)
//   SOLAPI_PF_ID                카카오 채널 pfId (예: KA01PF...)
//   SOLAPI_TPL_PANEL_APPROVED   패널 피드백 승인 템플릿 ID
//   SOLAPI_TPL_PANEL_REJECTED   패널 피드백 반려 템플릿 ID
//   SOLAPI_TPL_CO_COMPLETED     기업 의뢰 완료 템플릿 ID
//   SOLAPI_TPL_CO_EARLY_DONE    기업 조기종료 피드백 공개 템플릿 ID
//   SOLAPI_TPL_CO_CANCELLED     기업 의뢰 취소 처리 템플릿 ID
//   SOLAPI_TPL_CO_REACTIVATED   기업 취소 의뢰 재개 템플릿 ID
//   SOLAPI_TPL_CO_RESUMED       기업 완료 의뢰 재진행 템플릿 ID

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { sendAlimtalk } from '../_shared/solapi.ts';

// ── notifications.title → 알림톡 템플릿 ID 매핑 ───────────────
const TITLE_TO_TPL: Record<string, string | undefined> = {
  '피드백 승인':                        Deno.env.get('SOLAPI_TPL_PANEL_APPROVED'),
  '피드백 반려':                        Deno.env.get('SOLAPI_TPL_PANEL_REJECTED'),
  '의뢰 완료':                          Deno.env.get('SOLAPI_TPL_CO_COMPLETED'),
  '조기 종료 의뢰 피드백 검토 완료':   Deno.env.get('SOLAPI_TPL_CO_EARLY_DONE'),
  '의뢰 취소 처리':                     Deno.env.get('SOLAPI_TPL_CO_CANCELLED'),
  '의뢰 재개':                          Deno.env.get('SOLAPI_TPL_CO_REACTIVATED'),
  '의뢰 재진행':                        Deno.env.get('SOLAPI_TPL_CO_RESUMED'),
};

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return new Response('Bad Request', { status: 400 });
  }

  // INSERT 이벤트이고 notifications 테이블인지 확인
  if (payload.type !== 'INSERT' || payload.table !== 'notifications') {
    return new Response('OK', { status: 200 });
  }

  const notif = payload.record as {
    user_id: string;
    title: string;
    body: string;
    target_role: 'panel' | 'company' | null;
  };

  // 알림톡 대상 타이틀인지 확인
  const templateId = TITLE_TO_TPL[notif.title];
  if (!templateId) {
    return new Response('OK', { status: 200 }); // 알림톡 불필요한 이벤트
  }

  // Supabase 어드민 클라이언트 (RLS 우회하여 전화번호 조회)
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // target_role 기준으로 전화번호 조회
  let phone: string | null = null;

  if (notif.target_role === 'panel') {
    const { data } = await supabase
      .from('panels')
      .select('phone, phone_verified')
      .eq('user_id', notif.user_id)
      .single();
    // 패널은 OTP 인증 완료된 번호만 사용
    if (data?.phone && data?.phone_verified) phone = data.phone;

  } else if (notif.target_role === 'company') {
    const { data } = await supabase
      .from('companies')
      .select('phone')
      .eq('user_id', notif.user_id)
      .single();
    if (data?.phone) phone = data.phone;
  }

  if (!phone) {
    console.log(`[send-alimtalk] 전화번호 없음 — user_id=${notif.user_id} title="${notif.title}"`);
    return new Response('OK', { status: 200 });
  }

  try {
    await sendAlimtalk(phone, templateId, { '#{내용}': notif.body });
    console.log(`[send-alimtalk] 발송 완료 — to=${phone} title="${notif.title}"`);
  } catch (err) {
    // 알림톡 실패해도 서비스 중단 없음 (로그만 남김)
    console.error(`[send-alimtalk] 발송 실패 — ${(err as Error).message}`);
  }

  return new Response('OK', { status: 200 });
});
