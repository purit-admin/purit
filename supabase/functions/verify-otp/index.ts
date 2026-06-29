// verify-otp/index.ts
// 휴대폰 OTP 인증번호 검증 (서버사이드) — Signup·VerifyPhone·panel/Profile에서 호출
//
// 흐름: { phone, code } 수신 → 최신 미인증 행 조회 → 만료/시도횟수 검사 →
//       시도 +1 → 코드 일치 시 verified=true → { ok }
//
// ※ 인증 불필요(anon 호출). 검증 자체가 코드 보유를 증명하므로 안전.
//   시도 횟수 5회 초과 시 차단, 5분 만료, 일치 시 1회만 성공.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

function normalizePhone(raw: string): string {
  return String(raw ?? '').replace(/\D/g, '');
}

const MAX_ATTEMPTS = 5;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST')   return json({ ok: false, error: 'Method not allowed' }, 405);

  let phone = '';
  let code = '';
  try {
    const body = await req.json();
    phone = normalizePhone(body.phone);
    code = String(body.code ?? '').replace(/\D/g, '');
  } catch {
    return json({ ok: false, error: '잘못된 요청입니다.' });
  }

  if (!phone || code.length !== 6) {
    return json({ ok: false, error: '인증번호 6자리를 입력해 주세요.' });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // 최신 미인증 발송 행 1건
  const { data: rows, error: selErr } = await supabase
    .from('phone_otps')
    .select('id, code, expires_at, attempts, verified')
    .eq('phone', phone)
    .eq('verified', false)
    .order('created_at', { ascending: false })
    .limit(1);

  if (selErr) {
    console.error('[verify-otp] select error:', selErr.message);
    return json({ ok: false, error: '인증 처리 중 오류가 발생했습니다.' });
  }

  const row = rows?.[0];
  if (!row) {
    return json({ ok: false, error: '인증번호를 먼저 요청해 주세요.' });
  }
  if (new Date(row.expires_at).getTime() < Date.now()) {
    return json({ ok: false, error: '인증번호가 만료되었습니다. 다시 요청해 주세요.' });
  }
  if (row.attempts >= MAX_ATTEMPTS) {
    return json({ ok: false, error: '시도 횟수를 초과했습니다. 다시 요청해 주세요.' });
  }

  // 시도 횟수 증가 (일치 여부와 무관하게 먼저 기록 — 무차별 대입 방지)
  await supabase
    .from('phone_otps')
    .update({ attempts: row.attempts + 1 })
    .eq('id', row.id);

  if (code !== row.code) {
    const left = MAX_ATTEMPTS - (row.attempts + 1);
    return json({
      ok: false,
      error: left > 0 ? `인증번호가 일치하지 않습니다. (${left}회 남음)` : '시도 횟수를 초과했습니다. 다시 요청해 주세요.',
    });
  }

  // 검증 성공
  await supabase
    .from('phone_otps')
    .update({ verified: true, verified_at: new Date().toISOString() })
    .eq('id', row.id);

  return json({ ok: true });
});
