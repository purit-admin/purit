// _shared/solapi.ts — Solapi 알림톡 발송 공통 헬퍼

const SOLAPI_KEY    = Deno.env.get('SOLAPI_API_KEY')!;
const SOLAPI_SECRET = Deno.env.get('SOLAPI_API_SECRET')!;
const SOLAPI_SENDER = Deno.env.get('SOLAPI_SENDER_PHONE')!;  // 발신 번호 (01012345678)
const SOLAPI_PF_ID  = Deno.env.get('SOLAPI_PF_ID')!;         // 카카오 채널 pfId (KA01PF...)

// ── HMAC-SHA256 서명 생성 ──────────────────────────────────────
async function hmacSha256(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// ── Solapi Authorization 헤더 생성 ────────────────────────────
async function buildAuthHeader(): Promise<string> {
  const date      = new Date().toISOString();
  const salt      = crypto.randomUUID().replace(/-/g, '');
  const signature = await hmacSha256(SOLAPI_SECRET, date + salt);
  return `HMAC-SHA256 apiKey=${SOLAPI_KEY}, date=${date}, salt=${salt}, signature=${signature}`;
}

// ── 알림톡 발송 ───────────────────────────────────────────────
// variables 예시: { '#{내용}': '피드백이 승인되었습니다.' }
// disableSms=false: 알림톡 실패 시 SMS로 자동 폴백
export async function sendAlimtalk(
  to: string,
  templateId: string,
  variables: Record<string, string>,
): Promise<void> {
  const auth = await buildAuthHeader();

  const res = await fetch('https://api.solapi.com/messages/v4/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': auth,
    },
    body: JSON.stringify({
      message: {
        to,
        from: SOLAPI_SENDER,
        kakaoOptions: {
          pfId: SOLAPI_PF_ID,
          templateId,
          variables,
          disableSms: false,
        },
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Solapi ${res.status}: ${body}`);
  }
}
