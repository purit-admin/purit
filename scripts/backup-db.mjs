// ============================================================
// backup-db.mjs — Supabase 클라우드 DB 전체 데이터 백업 (Free 플랜용 수동 백업)
//
// 무엇을 하는가:
//   - service_role 키로 모든 데이터 테이블 + 가입 계정(auth.users)을 전부 읽어
//     backups/<날짜시각>/ 폴더에 테이블별 JSON 파일로 저장한다.
//   - 1000행 절단(Supabase 기본 Max Rows)을 피하려고 .range()로 페이지네이션한다.
//
// 사용법 (프로젝트 루트에서):
//   node scripts/backup-db.mjs
//
// 주의:
//   - 백업 파일에는 고객 개인정보가 들어 있다. backups/ 는 .gitignore에 등록됨 (git 업로드 금지).
//   - 스키마(테이블 구조)는 git의 supabase/migrations 에 있으므로 여기선 데이터만 받는다.
//   - Storage 파일(이미지·서류)은 별도. 이 스크립트는 DB row만 백업한다.
// ============================================================

import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

// --- .env.local 파싱 (dotenv 없이 직접) ---
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

// --- 백업 대상 테이블 (4_DBSchema.txt 기준) ---
const TABLES = [
  'companies', 'panels', 'missions', 'feedbacks', 'feedback_annotations',
  'feedback_helpfulness_ratings', 'gmv_snapshots', 'settlements', 'invoices',
  'notifications', 'team_members', 'question_templates', 'template_questions',
  'preference_tests', 'preference_responses', 'pricing_tests', 'pricing_axes',
  'pricing_responses', 'cold_email_tests', 'email_responses',
  'icp_research', 'icp_pain_points', 'icp_buy_triggers', 'icp_language',
  'icp_pulse_subscriptions', 'icp_pulse_quarters', 'icp_pulse_pains', 'icp_pulse_gains',
  'brand_tracking_campaigns', 'brand_tracking_monthly', 'brand_perception_items',
  'ai_reports', 'bug_reports',
]

const PAGE = 1000

async function dumpTable(name) {
  let all = []
  let from = 0
  for (;;) {
    const { data, error } = await supabase
      .from(name)
      .select('*')
      .range(from, from + PAGE - 1)
    if (error) {
      // 테이블이 없거나 권한 문제 등 — 건너뛰되 기록
      return { name, count: null, error: error.message }
    }
    all = all.concat(data)
    if (data.length < PAGE) break
    from += PAGE
  }
  return { name, count: all.length, rows: all }
}

async function dumpAuthUsers() {
  let all = []
  let page = 1
  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: PAGE })
    if (error) return { name: 'auth_users', count: null, error: error.message }
    all = all.concat(data.users)
    if (data.users.length < PAGE) break
    page += 1
  }
  return { name: 'auth_users', count: all.length, rows: all }
}

function stamp() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
}

async function main() {
  // 저장 위치: .env.local 의 BACKUP_DIR 가 있으면 거기(예: OneDrive 동기화 폴더 → 기기 독립),
  //            없으면 프로젝트 내 backups/ (로컬, .gitignore 등록됨)
  const baseDir = env.BACKUP_DIR ? path.resolve(env.BACKUP_DIR) : path.join(ROOT, 'backups')
  const outDir = path.join(baseDir, stamp())
  fs.mkdirSync(outDir, { recursive: true })
  console.log('📦 백업 시작 →', outDir)
  console.log('   대상:', SUPABASE_URL)
  console.log('')

  const summary = []

  // auth.users 먼저
  const au = await dumpAuthUsers()
  if (au.error) {
    console.log(`  ⚠️  auth_users — 실패: ${au.error}`)
  } else {
    fs.writeFileSync(path.join(outDir, 'auth_users.json'), JSON.stringify(au.rows, null, 2))
    console.log(`  ✅ auth_users — ${au.count} 행`)
  }
  summary.push({ table: 'auth_users', count: au.count, error: au.error || null })

  // 데이터 테이블
  for (const t of TABLES) {
    const r = await dumpTable(t)
    if (r.error) {
      console.log(`  ⚠️  ${t} — 실패(건너뜀): ${r.error}`)
    } else {
      fs.writeFileSync(path.join(outDir, `${t}.json`), JSON.stringify(r.rows, null, 2))
      console.log(`  ✅ ${t} — ${r.count} 행`)
    }
    summary.push({ table: t, count: r.count, error: r.error || null })
  }

  // 요약 메타 파일
  fs.writeFileSync(
    path.join(outDir, '_summary.json'),
    JSON.stringify({ created_at: new Date().toISOString(), source: SUPABASE_URL, tables: summary }, null, 2),
  )

  const totalRows = summary.reduce((s, x) => s + (x.count || 0), 0)
  const failed = summary.filter((x) => x.error)
  console.log('')
  console.log(`🎉 완료 — 총 ${totalRows} 행, ${summary.length}개 테이블`)
  if (failed.length) console.log(`   ⚠️ 실패/건너뜀 ${failed.length}개: ${failed.map((f) => f.table).join(', ')}`)
  console.log('   저장 위치:', outDir)
}

main().catch((e) => {
  console.error('❌ 백업 중 오류:', e)
  process.exit(1)
})
