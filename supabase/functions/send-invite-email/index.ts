import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS });
  }

  try {
    const { to, companyName, inviterName, role, inviteUrl } = await req.json();

    if (!to || !inviteUrl) {
      return new Response(
        JSON.stringify({ error: 'to and inviteUrl are required' }),
        { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    const roleLabel = role === 'editor' ? '편집자' : '뷰어';
    const roleDesc =
      role === 'editor'
        ? '의뢰 등록·수정 및 전체 결과 열람'
        : '결과 열람만 가능';

    const html = `
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Purit 팀 초대</title>
</head>
<body style="margin:0;padding:0;background:#F8FAFC;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFC;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;border:1px solid #E2E8F0;overflow:hidden;">
          <!-- 헤더 -->
          <tr>
            <td style="background:#10367D;padding:28px 36px;">
              <span style="color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.5px;">PURIT</span>
            </td>
          </tr>
          <!-- 본문 -->
          <tr>
            <td style="padding:36px 36px 24px;">
              <p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0F172A;">
                팀 초대가 도착했습니다
              </p>
              <p style="margin:0 0 24px;font-size:15px;color:#4B556D;line-height:1.6;">
                <strong style="color:#0F172A;">${escapeHtml(inviterName)}</strong>님이 Purit의
                <strong style="color:#10367D;">${escapeHtml(companyName)}</strong> 워크스페이스에 초대했습니다.
              </p>

              <!-- 역할 카드 -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#F1F5F9;border-radius:8px;margin-bottom:28px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0 0 4px;font-size:12px;font-weight:600;color:#8598AA;text-transform:uppercase;letter-spacing:0.5px;">부여 역할</p>
                    <p style="margin:0 0 4px;font-size:16px;font-weight:700;color:#0F172A;">${escapeHtml(roleLabel)}</p>
                    <p style="margin:0;font-size:13px;color:#4B556D;">${escapeHtml(roleDesc)}</p>
                  </td>
                </tr>
              </table>

              <!-- CTA 버튼 -->
              <a href="${inviteUrl}"
                style="display:inline-block;background:#10367D;color:#ffffff;font-size:15px;font-weight:600;
                       text-decoration:none;padding:14px 32px;border-radius:8px;margin-bottom:24px;">
                초대 수락하기 →
              </a>

              <p style="margin:0;font-size:13px;color:#8598AA;line-height:1.6;">
                이 초대 링크는 <strong>7일 후</strong> 만료됩니다.<br/>
                버튼이 동작하지 않는 경우 아래 링크를 복사하여 브라우저에 붙여 넣으세요.<br/>
                <span style="color:#4B556D;word-break:break-all;">${inviteUrl}</span>
              </p>
            </td>
          </tr>
          <!-- 푸터 -->
          <tr>
            <td style="padding:20px 36px;border-top:1px solid #E2E8F0;">
              <p style="margin:0;font-size:12px;color:#8598AA;">
                © 2026 Purit · 이 이메일은 ${escapeHtml(to)}으로 발송되었습니다.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Purit <onboarding@resend.dev>',
        to,
        subject: `[Purit] ${companyName} 팀 초대`,
        html,
      }),
    });

    const result = await res.json();

    if (!res.ok) {
      console.error('[send-invite-email] Resend error:', result);
      return new Response(JSON.stringify({ error: result }), {
        status: 500,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ ok: true, id: result.id }), {
      status: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[send-invite-email] Unexpected error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
});

function escapeHtml(str: string): string {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
