import { readFileSync } from 'fs';

const envPath = new URL('../.env.local', import.meta.url).pathname.replace(/^\/?([A-Z]:)/, '$1');
const env = Object.fromEntries(
  readFileSync(envPath, 'utf8').split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const [k, ...v] = l.split('='); return [k.trim(), v.join('=').trim()]; })
);

const ref = (env.VITE_SUPABASE_URL || '').match(/https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1];
const token = env.SUPABASE_ACCESS_TOKEN;
if (!ref || !token) { console.error('ref 또는 access token 누락'); process.exit(1); }

async function q(sql) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  });
  const text = await res.text();
  if (!res.ok) { console.error(`HTTP ${res.status}:`, text); return null; }
  try { return JSON.parse(text); } catch { return text; }
}

console.log('===== 등록된 pg_cron 작업 전체 =====');
const jobs = await q(`SELECT jobid, jobname, schedule, active, command FROM cron.job ORDER BY jobid;`);
console.log(JSON.stringify(jobs, null, 2));

console.log('\n===== 경력 자동증가 함수 존재 여부 =====');
const fn = await q(`SELECT proname, pg_get_function_identity_arguments(oid) AS args FROM pg_proc WHERE proname = 'auto_increment_panel_experience';`);
console.log(JSON.stringify(fn, null, 2));

console.log('\n===== 확정된 패널 표본(경력 자동증가 대상) =====');
const sample = await q(`SELECT count(*) FILTER (WHERE experience_confirmed_at IS NOT NULL) AS confirmed,
  count(*) FILTER (WHERE experience_confirmed_at IS NOT NULL AND age(now(), experience_confirmed_at) >= interval '1 year') AS due_now
  FROM panels;`);
console.log(JSON.stringify(sample, null, 2));
