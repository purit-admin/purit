// otp.js — 휴대폰 OTP 인증 공용 클라이언트 헬퍼 (단일 출처, D-35)
//   send-otp / verify-otp Edge Function을 호출하는 3개 화면(Signup·VerifyPhone·panel/Profile) 공유.
//   반환: { ok: boolean, error?: string } — 화면은 ok면 진행, 아니면 error 표시.

import { supabase } from './supabase';

// 인증번호 발송 요청 (실제 SMS)
export async function requestOtp(phone) {
  try {
    const { data, error } = await supabase.functions.invoke('send-otp', { body: { phone } });
    // functions.invoke는 함수가 4xx/5xx를 반환하면 error를 채우지만 data(본문)도 함께 옴 →
    // 서버가 내려준 한국어 메시지를 우선 사용
    if (data && typeof data.ok === 'boolean') return data;
    if (error) return { ok: false, error: '인증번호 발송에 실패했습니다. 잠시 후 다시 시도해 주세요.' };
    return { ok: false, error: '인증번호 발송에 실패했습니다.' };
  } catch {
    return { ok: false, error: '네트워크 오류로 발송에 실패했습니다.' };
  }
}

// 인증번호 검증
export async function confirmOtp(phone, code) {
  try {
    const { data, error } = await supabase.functions.invoke('verify-otp', { body: { phone, code } });
    if (data && typeof data.ok === 'boolean') return data;
    if (error) return { ok: false, error: '인증에 실패했습니다. 잠시 후 다시 시도해 주세요.' };
    return { ok: false, error: '인증에 실패했습니다.' };
  } catch {
    return { ok: false, error: '네트워크 오류로 인증에 실패했습니다.' };
  }
}
