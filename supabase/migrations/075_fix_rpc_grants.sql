-- 075: RPC GRANT EXECUTE 누락 수정
--
-- 067~073에서 생성된 5개 함수에 GRANT 구문 누락
-- → 비로그인/로그인 사용자가 클라이언트에서 호출 시 권한 오류 발생 가능
--
-- peek_team_invite      : 비로그인 사용자(anon)가 초대 링크 클릭 시 조회 → anon + authenticated 모두 필요
-- accept_team_invite    : 로그인 사용자만 수락 가능 → authenticated
-- notify_admin_on_feedback_submitted  : panel/ActiveMission.jsx에서 supabase.rpc() 직접 호출 → authenticated
-- notify_company_first_panel_accepted : panel/Missions.jsx에서 supabase.rpc() 직접 호출 → authenticated
-- notify_owner_team_member_joined     : InviteAccept.jsx에서 supabase.rpc() 직접 호출 → authenticated

GRANT EXECUTE ON FUNCTION peek_team_invite(UUID)                              TO anon;
GRANT EXECUTE ON FUNCTION peek_team_invite(UUID)                              TO authenticated;
GRANT EXECUTE ON FUNCTION accept_team_invite(UUID)                            TO authenticated;
GRANT EXECUTE ON FUNCTION notify_admin_on_feedback_submitted(UUID, BOOLEAN)   TO authenticated;
GRANT EXECUTE ON FUNCTION notify_company_first_panel_accepted(UUID)           TO authenticated;
GRANT EXECUTE ON FUNCTION notify_owner_team_member_joined(UUID, TEXT, TEXT)   TO authenticated;
