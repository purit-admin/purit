-- 063_panel_verification_bucket_rls.sql
-- panel-verification-docs Storage 버킷 생성 + RLS 정책
-- ※ Supabase SQL Editor에서 실행하거나 supabase db push로 적용

-- ① 버킷 생성 (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('panel-verification-docs', 'panel-verification-docs', false)
ON CONFLICT (id) DO NOTHING;

-- ② 기존 정책 제거 (멱등성 보장)
DROP POLICY IF EXISTS "panel_upload_own_docs"  ON storage.objects;
DROP POLICY IF EXISTS "admin_read_all_docs"    ON storage.objects;
DROP POLICY IF EXISTS "panel_read_own_docs"    ON storage.objects;

-- ③ 패널 본인 업로드: 자신의 user_id 하위 경로에만 업로드 가능
CREATE POLICY "panel_upload_own_docs"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'panel-verification-docs'
  AND auth.uid()::text = split_part(name, '/', 1)
);

-- ④ 어드민 전체 읽기 (app_metadata role 기반 — D-58 준수)
CREATE POLICY "admin_read_all_docs"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'panel-verification-docs'
  AND (auth.jwt()->'app_metadata'->>'role') = 'admin'
);

-- ⑤ 패널 본인은 자기 파일만 읽기 가능
CREATE POLICY "panel_read_own_docs"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'panel-verification-docs'
  AND auth.uid()::text = split_part(name, '/', 1)
);
