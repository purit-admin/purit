-- 113_bug_reports_admin_delete.sql
-- 어드민 버그/불편 신고 관리 — 해결됨·기각 리포트 삭제(선택 삭제) 기능 지원
--
--  배경: bug_reports 는 RLS 활성(022) 상태에서 INSERT(본인)·SELECT(본인+어드민)·UPDATE(어드민) 정책만 있고
--    DELETE 정책이 없었음 → 어드민 화면에서 .delete() 호출 시 RLS가 "에러 없이 0행 삭제"로 조용히 실패
--    (니체 규칙 15: RLS 활성 테이블에 DELETE 정책 부재 = 무음 실패. 화면은 사라진 듯 보여도 새로고침 시 복원).
--
--  해결: 어드민 전용 DELETE 정책 추가. 026 패턴과 동일하게 app_metadata.role 로 판별(D-58 —
--    user_metadata 는 사용자 본인이 위조 가능하므로 권한 판별에 절대 사용 금지).
--
-- ⚠️ Supabase SQL Editor 수동 실행 필요. 순수 RLS 정책 — 클라이언트는 이 정책이 있어야 삭제가 실제 반영됨.

DROP POLICY IF EXISTS "bug_reports_admin_delete" ON bug_reports;
CREATE POLICY "bug_reports_admin_delete" ON bug_reports
  FOR DELETE USING (
    (auth.jwt()->'app_metadata'->>'role') = 'admin'
  );
