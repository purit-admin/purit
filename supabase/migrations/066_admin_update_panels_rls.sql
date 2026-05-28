-- 066_admin_update_panels_rls.sql
-- 어드민이 패널 상태(status) 직접 변경 가능하도록 panels UPDATE RLS 추가
-- 기존 UPDATE 정책: 본인(user_id = auth.uid())만 가능
-- 문제: 어드민의 supabase.from('panels').update() 호출이 RLS에 막혀 0행 업데이트 (D-5 silent failure)
--       로컬 state는 갱신되어 성공처럼 보이지만 DB는 미변경 → 패널 새로고침 시 원상복귀

CREATE POLICY "admin_update_panels"
  ON panels
  FOR UPDATE
  TO authenticated
  USING ((auth.jwt()->'app_metadata'->>'role') = 'admin')
  WITH CHECK ((auth.jwt()->'app_metadata'->>'role') = 'admin');
