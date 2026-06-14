-- 048_restore_mission_slot_rpc.sql
-- restore_mission_slot RPC 추가
--
-- 용도: PurityFilter.jsx reset() — 반려(rejected)→검토중(submitted) 되돌리기 시
--       decrement됐던 슬롯을 원자적으로 +1 복원
--
-- 기존 코드 문제:
--   SELECT filled_count → UPDATE filled_count+1  (2단계 비원자적)
--   두 어드민이 동시에 reset하면 양쪽이 같은 값을 읽어 +1이 한 번만 반영될 수 있음
--
-- 해결: 단일 UPDATE (PostgreSQL 행 잠금으로 자동 직렬화)

CREATE OR REPLACE FUNCTION restore_mission_slot(p_mission_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (auth.jwt()->'app_metadata'->>'role') <> 'admin'
  AND (auth.jwt()->'user_metadata'->>'role') <> 'admin' THEN
    RAISE EXCEPTION 'Unauthorized: admin only';
  END IF;

  UPDATE missions
  SET filled_count = COALESCE(filled_count, 0) + 1
  WHERE id = p_mission_id;
END;
$$;
