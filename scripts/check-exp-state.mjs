import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const envPath = new URL('../.env.local', import.meta.url).pathname.replace(/^\/?([A-Z]:)/, '$1');
const env = Object.fromEntries(
  readFileSync(envPath, 'utf8').split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const [k, ...v] = l.split('='); return [k.trim(), v.join('=').trim()]; })
);
const supabase = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data, error } = await supabase
  .from('panels')
  .select('name, email, experience, experience_years, is_executive, experience_confirmed_at');

if (error) { console.error(error.message); process.exit(1); }

const now = Date.now();
const YEAR = 365.25 * 24 * 3600 * 1000;
let confirmed = 0, due = 0;
console.log('패널 경력 상태:');
for (const p of data) {
  const conf = p.experience_confirmed_at ? new Date(p.experience_confirmed_at) : null;
  const elapsedYrs = conf ? Math.floor((now - conf.getTime()) / YEAR) : null;
  if (conf) confirmed++;
  if (conf && elapsedYrs >= 1) due++;
  console.log(`  - ${(p.name||'(무명)').padEnd(10)} exp=${String(p.experience).padEnd(6)} yrs=${p.experience_years ?? '-'} head=${p.is_executive ? 'Y':'N'} 확정=${conf ? conf.toISOString().slice(0,10) : '미확정'} ${elapsedYrs!=null ? `(${elapsedYrs}년경과${elapsedYrs>=1?' ⚠️자동+'+elapsedYrs+'대상':''})` : ''}`);
}
console.log(`\n총 ${data.length}명 / 경력확정 ${confirmed}명 / 자동증가 대상(확정후 1년+) ${due}명`);
