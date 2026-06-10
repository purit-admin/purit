/**
 * 펭귄 기업 계정의 무료 체험 의뢰 조회 (일회성 진단)
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const envPath = new URL('../.env.local', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const envVars = Object.fromEntries(
  readFileSync(envPath, 'utf8')
    .split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const [k, ...v] = l.split('='); return [k.trim(), v.join('=').trim()]; })
);
const supabase = createClient(envVars.VITE_SUPABASE_URL, envVars.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: companies } = await supabase
  .from('companies')
  .select('id, name, user_id, plan, free_trial_used, credit_balance')
  .ilike('name', '%펭귄%');

console.log('=== 펭귄 회사 ===');
console.log(JSON.stringify(companies, null, 2));

for (const c of companies || []) {
  const { data: missions } = await supabase
    .from('missions')
    .select('id, title, type, status, panel_count, filled_count, is_free_trial, trial_unlocked, unlock_cost, image_urls, created_at')
    .eq('company_id', c.id)
    .order('created_at', { ascending: false });
  console.log(`\n=== ${c.name} 의뢰 목록 ===`);
  (missions || []).forEach(m => {
    console.log(`  [${m.status}] "${m.title}" type=${m.type} free_trial=${m.is_free_trial} 슬롯=${m.filled_count}/${m.panel_count} 이미지=${(m.image_urls||[]).length}장 id=${m.id}`);
  });
}
