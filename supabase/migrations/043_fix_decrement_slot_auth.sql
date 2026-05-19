-- 043_fix_decrement_slot_auth.sql
-- decrement_mission_filled_count RPC 권한 수정
-- 원인: 026_fix_rls_user_metadata.sql에서 RLS를 user_metadata→app_metadata로 변경했으나
--       decrement_mission_filled_count는 user_metadata 체크를 그대로 유지하여
--       app_metadata.role이 설정되지 않은 어드민 계정에서 RPC가 RAISE EXCEPTION 발생 → silent failure
--       → filled_count가 반려 시 감소되지 않아 패널의 재작성 시 슬롯 마감으로 잘못 인식됨

CREATE OR REPLACE FUNCTION decrement_mission_filled_count(p_mission_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- app_metadata(보안) 또는 user_metadata(레거시 호환) 양쪽 모두 허용
  IF (auth.jwt()->'app_metadata'->>'role') <> 'admin'
  AND (auth.jwt()->'user_metadata'->>'role') <> 'admin' THEN
    RAISE EXCEPTION 'Unauthorized: admin only';
  END IF;

  UPDATE missions
  SET filled_count = GREATEST(0, COALESCE(filled_count, 0) - 1)
  WHERE id = p_mission_id;
END;
$$;
