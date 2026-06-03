import { supabase } from './supabase';

/**
 * 현재 userId에 대한 회사 + 팀 역할을 해석합니다.
 * - 회사 오너이면 { company, teamRole: null } 반환
 * - 활성 팀원이면 { company, teamRole: 'editor'|'viewer' } 반환
 * - 둘 다 아니면 { company: null, teamRole: null } 반환
 *
 * canEdit = teamRole === null || teamRole === 'editor'
 */
export async function resolveCompany(userId) {
  if (!userId) return { company: null, teamRole: null };

  // 1. 오너 확인
  const { data: ownerCo } = await supabase
    .from('companies')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (ownerCo) return { company: ownerCo, teamRole: null };

  // 2. 팀원 확인
  const { data: mem } = await supabase
    .from('team_members')
    .select('company_id, role')
    .eq('user_id', userId)
    .eq('status', 'active')
    .single();

  if (mem) {
    const { data: co } = await supabase
      .from('companies')
      .select('*')
      .eq('id', mem.company_id)
      .single();
    return { company: co ?? null, teamRole: mem.role };
  }

  return { company: null, teamRole: null };
}
