// send-otp/index.ts
// 휴대폰 OTP 인증번호 발송 (실제 SMS) — Signup·VerifyPhone·panel/Profile에서 호출
//
// 흐름: { phone } 수신 → 번호 정규화·형식 검증 → 재발송 제한(rate limit) →
//       6자리 코드 생성 → phone_otps INSERT(만료 5분) → Solapi SMS 발송
//
// ── 필요한 Supabase Secrets ──────────────────────────────────
//   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (기본 제공)
//   SOLAPI_API_KEY / SOLAPI_API_SECRET / SOLAPI_SENDER_PHONE (SMS 발송)
//
// ※ 인증 불필요(anon 호출) — 가입 전 미인증 사용자도 인증해야 하므로.
//   남용 방지는 phone_otps rate limit(번호당 60초 간격·1시간 5회)으로 처리.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { sendSms } from '../_shared/solapi.ts';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// 처리된 결과(검증 실패·재발송 제한·발송 실패 등)는 항상 200 + { ok:false, error } 로 반환 —
// supabase.functions.invoke가 비-2xx면 data를 비우는 버전이 있어, 한국어 메시지를 확실히 전달하기 위함.
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

// 숫자만 추출 (하이픈·공백 제거)
function normalizePhone(raw: string): string {
  return String(raw ?? '').replace(/\D/g, '');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST')   return json({ ok: false, error: 'Method not allowed' }, 405);

  let phone = '';
  try {
    const body = await req.json();
    phone = normalizePhone(body.phone);
  } catch {
    return json({ ok: false, error: '잘못된 요청입니다.' });
  }

  // 한국 휴대폰 형식: 010xxxxxxxx (10~11자리, 01로 시작)
  if (!/^01[016789]\d{7,8}$/.test(phone)) {
    return json({ ok: false, error: '올바른 휴대폰 번호를 입력해 주세요.' });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // ── 재발송 제한(rate limit) ──────────────────────────────────
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data: recent } = await supabase
    .from('phone_otps')
    .select('created_at')
    .eq('phone', phone)
    .gte('created_at', oneHourAgo)
    .order('created_at', { ascending: false });

  if (recent && recent.length > 0) {
    const lastSentMs = Date.now() - new Date(recent[0].created_at).getTime();
    if (lastSentMs < 60 * 1000) {
      return json({ ok: false, error: '잠시 후 다시 시도해 주세요. (재발송은 1분 후 가능)' });
    }
    if (recent.length >= 5) {
      return json({ ok: false, error: '인증 요청이 너무 많습니다. 1시간 후 다시 시도해 주세요.' });
    }
  }

  // ── 6자리 코드 생성 ──────────────────────────────────────────
  const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, '0');
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

  const { error: insErr } = await supabase
    .from('phone_otps')
    .insert({ phone, code, expires_at: expiresAt });

  if (insErr) {
    console.error('[send-otp] insert error:', insErr.message);
    return json({ ok: false, error: '인증번호 발급에 실패했습니다. 잠시 후 다시 시도해 주세요.' });
  }

  // ── SMS 발송 ─────────────────────────────────────────────────
  try {
    await sendSms(phone, `[Purit] 인증번호 ${code} 를 입력해 주세요. (5분 이내)`);
  } catch (err) {
    console.error('[send-otp] SMS 발송 실패:', (err as Error).message);
    return json({ ok: false, error: '인증번호 발송에 실패했습니다. 잠시 후 다시 시도해 주세요.' });
  }

  return json({ ok: true });
});
