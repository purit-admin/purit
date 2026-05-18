-- 038_notifications_rls.sql
-- notifications 테이블 RLS 활성화 + 정책 추가
-- 문제: RLS 미설정으로 DELETE 권한이 명시되지 않아 삭제가 조용히 실패하고 새로고침 시 복원됨

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- 기존 정책 제거 (재실행 안전성)
DROP POLICY IF EXISTS "notifications_select_own" ON notifications;
DROP POLICY IF EXISTS "notifications_insert_any" ON notifications;
DROP POLICY IF EXISTS "notifications_update_own" ON notifications;
DROP POLICY IF EXISTS "notifications_delete_own" ON notifications;

-- SELECT: 본인 알림만 조회
CREATE POLICY "notifications_select_own" ON notifications
  FOR SELECT USING (user_id = auth.uid());

-- INSERT: 로그인한 사용자 전체 허용
-- (어드민→패널/기업 알림 발송 용도, SECURITY DEFINER 트리거는 RLS 자동 우회)
CREATE POLICY "notifications_insert_any" ON notifications
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- UPDATE: 본인 알림만 수정 (읽음 처리용)
CREATE POLICY "notifications_update_own" ON notifications
  FOR UPDATE USING (user_id = auth.uid());

-- DELETE: 본인 알림만 삭제
CREATE POLICY "notifications_delete_own" ON notifications
  FOR DELETE USING (user_id = auth.uid());
