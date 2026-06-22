// ============================================================
// backup-storage.mjs — Supabase Storage 파일 전체 백업 (Free 플랜용 수동 백업)
//
// 무엇을 하는가:
//   - service_role 키로 Storage 버킷의 모든 파일(이미지·서류·스크린샷)을 폴더 구조
//     그대로 <BACKUP_DIR 또는 backups>/<날짜시각>_storage/<버킷>/<경로> 에 다운로드한다.
//   - 폴더를 재귀 순회하고, 100개 초과 폴더도 offset 페이지네이션으로 누락 없이 받는다.
//
// 사용법 (프로젝트 루트에서):
//   node scripts/backup-storage.mjs
//
// 주의:
//   - backup-db.mjs(데이터 행)와 짝. 이 스크립트는 Storage 파일만 백업한다.
//   - 백업 파일에는 고객 개인정보(서류·스크린샷)가 들어 있다 → git 업로드 금지(backups/ 는 .gitignore).
//   - .env.local 의 BACKUP_DIR 가 있으면 거기(OneDrive 등 클라우드 동기화 폴더 → 기기 독립)에 저장.
// ============================================================

import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

// --- .env.local 파싱 (backup-db.mjs 와 동일 방식) ---
function loadEnv() {
  const envPath = path.join(ROOT, '.env.local')
  if (!fs.existsSync(envPath)) {
    console.error('❌ .env.local 파일을 찾을 수 없습니다:', envPath)
    process.exit(1)
  }
  const env = {}
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
  return env
}

const env = loadEnv()
const SUPABASE_URL = env.VITE_SUPABASE_URL
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌ VITE_SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY 가 .env.local 에 없습니다.')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

// --- 백업 대상 버킷 (2_Architecture.txt 기준) ---
const BUCKETS = ['mission-assets', 'bug-screenshots', 'panel-verification-docs']

const LIST_LIMIT = 100

// 한 폴더(prefix)의 항목을 offset 페이지네이션으로 전부 나열
async function listAll(bucket, prefix) {
  let items = []
  let offset = 0
  for (;;) {
    const { data, error } = await supabase.storage.from(bucket).list(prefix, {
      limit: LIST_LIMIT,
      offset,
      sortBy: { column: 'name', order: 'asc' },
    })
    if (error) throw new Error(`list 실패 [${bucket}/${prefix}]: ${error.message}`)
    items = items.concat(data)
    if (data.length < LIST_LIMIT) break
    offset += LIST_LIMIT
  }
  return items
}

// prefix 아래의 모든 "파일" 경로를 재귀로 수집
async function collectFiles(bucket, prefix, acc) {
  const items = await listAll(bucket, prefix)
  for (const it of items) {
    const full = prefix ? `${prefix}/${it.name}` : it.name
    // 폴더는 id 가 null (메타데이터 없음) → 재귀, 파일은 id 존재 → 수집
    if (it.id === null || it.id === undefined) {
      await collectFiles(bucket, full, acc)
    } else {
      acc.push(full)
    }
  }
  return acc
}

function stamp() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
}

async function main() {
  const baseDir = env.BACKUP_DIR ? path.resolve(env.BACKUP_DIR) : path.join(ROOT, 'backups')
  const outDir = path.join(baseDir, `${stamp()}_storage`)
  fs.mkdirSync(outDir, { recursive: true })
  console.log('🖼️  Storage 백업 시작 →', outDir)
  console.log('   대상:', SUPABASE_URL)
  console.log('')

  const summary = []

  for (const bucket of BUCKETS) {
    let files
    try {
      files = await collectFiles(bucket, '', [])
    } catch (e) {
      console.log(`  ⚠️  ${bucket} — 목록 실패(건너뜀): ${e.message}`)
      summary.push({ bucket, files: null, downloaded: 0, error: e.message })
      continue
    }

    let ok = 0
    let fail = 0
    for (const filePath of files) {
      const { data, error } = await supabase.storage.from(bucket).download(filePath)
      if (error || !data) {
        fail += 1
        console.log(`     ✗ ${bucket}/${filePath} — ${error?.message || '다운로드 실패'}`)
        continue
      }
      const buf = Buffer.from(await data.arrayBuffer())
      const dest = path.join(outDir, bucket, filePath)
      fs.mkdirSync(path.dirname(dest), { recursive: true })
      fs.writeFileSync(dest, buf)
      ok += 1
    }
    console.log(`  ✅ ${bucket} — ${ok}/${files.length} 파일${fail ? ` (실패 ${fail})` : ''}`)
    summary.push({ bucket, files: files.length, downloaded: ok, failed: fail, error: null })
  }

  fs.writeFileSync(
    path.join(outDir, '_summary.json'),
    JSON.stringify({ created_at: new Date().toISOString(), source: SUPABASE_URL, buckets: summary }, null, 2),
  )

  const totalFiles = summary.reduce((s, x) => s + (x.downloaded || 0), 0)
  const failedBuckets = summary.filter((x) => x.error)
  console.log('')
  console.log(`🎉 완료 — 총 ${totalFiles} 파일 다운로드, ${BUCKETS.length}개 버킷`)
  if (failedBuckets.length) console.log(`   ⚠️ 목록 실패 버킷: ${failedBuckets.map((b) => b.bucket).join(', ')}`)
  console.log('   저장 위치:', outDir)
}

main().catch((e) => {
  console.error('❌ Storage 백업 중 오류:', e)
  process.exit(1)
})
