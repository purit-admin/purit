-- 084_panel_docs_update_policy.sql
-- 패널 검증 서류 재제출 실패 수정 (D-118)
-- 문제: panel-verification-docs 버킷에 INSERT/SELECT 정책만 있고 UPDATE 정책이 없음.
--       VerifyDocs.jsx 업로드는 고정 경로(`{user.id}/health_insurance.{ext}`) + upsert:true.
--       동일 확장자로 재제출하면 경로가 겹쳐 upsert가 UPDATE(덮어쓰기)로 동작 →
--       UPDATE 정책이 없어 RLS가 조용히 400 차단 → "건강보험 파일 업로드에 실패했습니다".
--       (최초 제출 또는 다른 확장자 제출은 INSERT라 통과 → 간헐적으로 보였음)
-- 해결: INSERT 정책과 동일 조건의 FOR UPDATE 정책 추가 (본인 user_id 하위 경로만 덮어쓰기 허용).

DROP POLICY IF EXISTS "panel_update_own_docs" ON storage.objects;

CREATE POLICY "panel_update_own_docs"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'panel-verification-docs'
  AND auth.uid()::text = split_part(name, '/', 1)
)
WITH CHECK (
  bucket_id = 'panel-verification-docs'
  AND auth.uid()::text = split_part(name, '/', 1)
);

-- 수평 전개: mission-assets 버킷도 동일 결함 (INSERT/SELECT만, UPDATE 없음).
--   PreferenceTest.jsx(`{companyId}/{missionUuid}/va|vb.{ext}`) / PricingTest.jsx(`pricing.{ext}`)가
--   upsert:true + 고정 파일명 → 기업이 같은 A/B·가격 이미지를 교체 재업로드하면 경로 충돌 →
--   upsert가 UPDATE로 동작 → 정책 없어 400, 게다가 catch에서 console.error만 → 사용자 무반응 실패.
-- 해결: INSERT 정책과 동일 조건(authenticated)의 FOR UPDATE 정책 추가.

DROP POLICY IF EXISTS "auth_update_mission_assets" ON storage.objects;

CREATE POLICY "auth_update_mission_assets"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'mission-assets'
  AND auth.role() = 'authenticated'
)
WITH CHECK (
  bucket_id = 'mission-assets'
  AND auth.role() = 'authenticated'
);
