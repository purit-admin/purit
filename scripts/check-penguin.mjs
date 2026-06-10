// check-penguin.mjs — 읽기 전용: '펭귄' 포함 계정 조회만 (삭제 없음)
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const envPath = new URL('../.env.local', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const envVars = Object.fromEntries(
  readFileSync(envPath, 'utf8').split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const [k, ...v] = l.split('='); return [k.trim(), v.join('=').trim()]; })
);
const supabase = createClient(envVars.VITE_SUPABASE_URL, envVars.VITE_SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const NEEDLE = '펭귄';
const { data: companies, error: ce } = await supabase.from('companies')
  .select('id,user_id,name,email,plan,created_at').ilike('name', `%${NEEDLE}%`);
const { data: panels, error: pe } = await supabase.from('panels')
  .select('id,user_id,name,email,status').ilike('name', `%${NEEDLE}%`);

console.log('=== companies(기업) ===');
console.log(ce ? `ERROR: ${ce.message}` : JSON.stringify(companies, null, 2));
console.log('=== panels(패널) ===');
console.log(pe ? `ERROR: ${pe.message}` : JSON.stringify(panels, null, 2));
