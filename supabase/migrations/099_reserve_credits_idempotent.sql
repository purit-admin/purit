-- 099_reserve_credits_idempotent.sql
-- reserve_mission_credits 멱등성(idempotency) — 크레딧 잔액 이중 차감 방지.
--
-- 배경 (구버그, 018 본문):
--   UPDATE companies SET credit_balance = credit_balance - p_credits  -- 호출 시마다 무조건 차감
--   UPDATE missions  SET credits_reserved = p_credits                 -- 예약량은 덮어쓰기
--   → 같은 의뢰에 reserve 가 두 번 호출되면 credits_reserved 는 그대로인데 credit_balance 는 두 번 깎임.
--
-- 터지는 경로:
--   · draft→active 제출에서 reserve 성공 후 status UPDATE 가 네트워크 오류로 실패 → 사용자 재제출 → reserve 재호출
--     (D-101: reserve 먼저 → 성공 시 status='active'. reserve 와 status 변경이 별개 트랜잭션이라 사이에서 끊기면 재시도됨)
--   · 제출 버튼 연타 / 두 탭 동시 제출 (companies FOR UPDATE 잠금은 순서만 정렬, 각자 차감은 못 막음)
--   ※ D-128(서브 의뢰 active 수정 시 이중차감)은 클라 가드 — draft→active 재시도 경로는 미커버.
--
-- 처리: "차액(delta)만 차감" 방식.
--   delta := p_credits - 현재 credits_reserved
--   · 최초 예약: 현재 reserved=0 → delta=p_credits (정상 차감)
--   · 재시도/연타: 현재 reserved=p_credits → delta=0 → 추가 차감 없음 (멱등)
--   · 금액 변경(엣지): 차액만 반영 (delta<0 이면 환불 방향)
--   동시성: companies FOR UPDATE 가 회사 단위로 직렬화 → 2번째 호출은 1번째 커밋 후 reserved 값을 읽어 delta=0.

CREATE OR REPLACE FUNCTION reserve_mission_credits(
  p_mission_id UUID,
  p_company_id UUID,
  p_credits    NUMERIC
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_balance  NUMERIC;
  v_reserved NUMERIC;
  v_delta    NUMERIC;
BEGIN
  -- 소유권 + 잔액 잠금 (본인 회사만 — owner 게이트, FOR UPDATE 로 동시 호출 직렬화)
  SELECT credit_balance INTO v_balance
  FROM companies
  WHERE id = p_company_id AND user_id = auth.uid()
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
  END IF;

  -- 이미 예약된 양 (멱등 처리 기준점)
  SELECT COALESCE(credits_reserved, 0) INTO v_reserved
  FROM missions
  WHERE id = p_mission_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'mission_not_found');
  END IF;

  -- 차액만 차감 (재호출 시 delta=0 → 멱등)
  v_delta := p_credits - v_reserved;

  -- 추가 차감이 필요할 때만 잔액 검사 (delta<=0 이면 동일/환불 → 검사 불필요)
  IF v_delta > 0 AND v_balance < v_delta THEN
    RETURN jsonb_build_object(
      'success',  false,
      'error',    'INSUFFICIENT_CREDITS',
      'balance',  v_balance,
      'required', v_delta
    );
  END IF;

  UPDATE companies SET credit_balance = credit_balance - v_delta WHERE id = p_company_id;
  UPDATE missions  SET credits_reserved = p_credits             WHERE id = p_mission_id;

  RETURN jsonb_build_object('success', true, 'balance', v_balance - v_delta);
END;
$$;

GRANT EXECUTE ON FUNCTION reserve_mission_credits(UUID, UUID, NUMERIC) TO authenticated;
