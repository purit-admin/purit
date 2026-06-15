import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import SettlementLedger from '../../components/ui/SettlementLedger';

export default function History() {
  const [feedbacks, setFeedbacks] = useState([]);
  const [panelData, setPanelData] = useState(null);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    async function load() {
      try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data: panel } = await supabase
        .from('panels').select('id, honor_points, experience').eq('user_id', user.id).single();
      if (!panel) { setLoading(false); return; }
      setPanelData(panel);

      const { data: fbs } = await supabase
        .from('feedbacks')
        .select('*, missions(title, reward_amount, type)')
        .eq('panel_id', panel.id)
        .neq('status', 'draft')
        .order('created_at', { ascending: false });

      setFeedbacks(fbs || []);
      setLoading(false);
      } catch (err) {
        console.error('[PanelHistory load]', err);
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return (
    <div style={{ padding: '40px 48px', color: 'var(--text-3)', fontSize: 14 }}>불러오는 중...</div>
  );

  return (
    <div className="page-wrap" style={{ padding: '40px 48px', maxWidth: 860, animation: 'fadeUp 0.5s ease both' }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 12, fontFamily: 'var(--font-sans)', color: 'var(--green)', marginBottom: 8, letterSpacing: '0.1em' }}>LEDGER</div>
        <h1 style={{ fontSize: 28, fontWeight: 800 }}>정산 내역</h1>
      </div>

      <SettlementLedger feedbacks={feedbacks} panelData={panelData} />
    </div>
  );
}
