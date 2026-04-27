import { useEffect, useState } from 'react';
import { Card, Stat, Badge } from '../../components/ui';
import { supabase } from '../../lib/supabase';

const STATUS_LABEL = { submitted: '검토 중', approved: '정산완료', rejected: '필터탈락' };
const STATUS_TYPE  = { submitted: 'gold', approved: 'green', rejected: 'red' };

export default function History() {
  const [feedbacks, setFeedbacks] = useState([]);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: panel } = await supabase
        .from('panels').select('id').eq('user_id', user.id).single();
      if (!panel) { setLoading(false); return; }

      const { data: fbs } = await supabase
        .from('feedbacks')
        .select('*, missions(title, reward_amount)')
        .eq('panel_id', panel.id)
        .neq('status', 'draft')
        .order('created_at', { ascending: false });

      setFeedbacks(fbs || []);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return (
    <div style={{ padding: '40px 48px', color: 'var(--text-3)', fontSize: 14 }}>불러오는 중...</div>
  );

  const approved = feedbacks.filter(f => f.purity_passed);
  const pending  = feedbacks.filter(f => !f.purity_passed && f.status === 'submitted');
  const rejected = feedbacks.filter(f => !f.purity_passed && f.status === 'rejected');

  const totalPaid    = approved.reduce((s, f) => s + (f.missions?.reward_amount || 0), 0);
  const totalPending = pending.reduce((s, f)  => s + (f.missions?.reward_amount || 0), 0);

  const avgScore = () => {
    const valid = feedbacks.filter(f => f.status !== 'rejected');
    if (!valid.length) return '—';
    const sum = valid.reduce((s, f) => {
      const avg = ['clarity_score', 'relevance_score', 'value_score', 'differentiation_score', 'trust_score']
        .reduce((a, k) => a + (f[k] || 0), 0) / 5;
      return s + avg;
    }, 0);
    return (sum / valid.length).toFixed(1);
  };

  return (
    <div style={{ padding: '40px 48px', maxWidth: 860, animation: 'fadeUp 0.5s ease both' }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--green)', marginBottom: 8, letterSpacing: '0.1em' }}>EARNINGS</div>
        <h1 style={{ fontSize: 28, fontWeight: 800 }}>내 수익</h1>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, background: 'var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', marginBottom: 32 }}>
        {[
          { label: '총 정산 완료', value: `₩${(totalPaid / 10000).toFixed(0)}만`, accent: true },
          { label: '정산 대기 중', value: `₩${(totalPending / 10000).toFixed(0)}만` },
          { label: '평균 점수', value: avgScore() },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--surface)', padding: '24px 28px' }}>
            <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>{s.label}</div>
            <div style={{ fontSize: 32, fontWeight: 800, color: s.accent ? 'var(--accent)' : 'var(--text)', fontFamily: 'var(--font-mono)', lineHeight: 1, marginBottom: 4 }}>{s.value}</div>
          </div>
        ))}
      </div>

      <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-2)', marginBottom: 14 }}>이력</h2>

      {feedbacks.length === 0 ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-3)', fontSize: 14, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' }}>
          제출한 피드백이 없습니다.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {feedbacks.map((f) => {
            const isPassed  = f.purity_passed;
            const isRejected = !isPassed && f.status === 'rejected';
            const statusKey = isPassed ? 'approved' : isRejected ? 'rejected' : 'submitted';
            const reward    = f.missions?.reward_amount || 0;
            return (
              <div key={f.id} style={{
                display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px',
                background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)',
                opacity: isRejected ? 0.55 : 1,
              }}>
                <Badge type={STATUS_TYPE[statusKey]}>
                  {STATUS_LABEL[statusKey]}
                </Badge>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>{f.missions?.title || '의뢰'}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
                    {new Date(f.created_at).toLocaleDateString('ko-KR')}
                  </div>
                </div>
                <div style={{
                  fontWeight: 700, fontFamily: 'var(--font-mono)',
                  color: isPassed ? 'var(--green)' : isRejected ? 'var(--text-3)' : 'var(--accent)',
                }}>
                  {isRejected ? '—' : `₩${reward.toLocaleString()}`}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {rejected.length > 0 && (
        <Card style={{ marginTop: 20, borderColor: 'rgba(224,112,112,0.2)', background: 'var(--red-dim)' }}>
          <div style={{ fontSize: 13, color: 'var(--red)', fontWeight: 600, marginBottom: 6 }}>Purit Filter 탈락 안내</div>
          <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.7 }}>
            Purit Filter를 통과하지 못한 피드백은 보상이 지급되지 않습니다. 구체적인 전환 근거와 개선안을 포함하면 합격률이 높아집니다.
          </p>
        </Card>
      )}
    </div>
  );
}
