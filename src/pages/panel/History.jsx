import { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import { Card, Badge, ConfirmModal, StatusTabs } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { getPanelReward } from '../../lib/honorLevels';

const REJECTION_GUIDE = 'Purit Filter 검수 시스템에 의해 반려되었습니다.\n주요 반려 기준: 내용 길이 부족 / AI 생성 의심 / 구체성 부족\n해당 사유를 참고하여 재작성해 주세요.';


const fmtAmt = (n) => {
  if (!n) return '₩0';
  const man  = Math.floor(n / 10000);
  const rest = n % 10000;
  if (!man)  return `₩${rest.toLocaleString()}`;
  if (!rest) return `₩${man}만`;
  return `₩${man}만 ${rest.toLocaleString()}`;
};

const STATUS_LABEL = { submitted: '정산 대기', approved: '정산 확정', rejected: '지급 거절' };
const STATUS_TYPE  = { submitted: 'gold',      approved: 'green',    rejected: 'red' };

const TABS = [
  { key: 'pending',  label: '정산 대기' },
  { key: 'approved', label: '정산 확정' },
  { key: 'rejected', label: '지급 거절' },
];

const PAGE_SIZE = 5;

const WINDOW = 5;
function Pagination({ page, total, onPage }) {
  const totalPages = Math.ceil(total / PAGE_SIZE);
  if (totalPages <= 1) return null;
  const winStart = Math.max(1, page - 2);
  const winEnd   = Math.min(totalPages, winStart + WINDOW - 1);
  const pageNums = Array.from({ length: winEnd - winStart + 1 }, (_, i) => winStart + i);
  const btnBase  = { padding: '5px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-2)', cursor: 'pointer', fontSize: 13 };
  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginTop: 16, justifyContent: 'center' }}>
      {page > WINDOW && (
        <button onClick={() => onPage(Math.max(1, page - WINDOW))} style={btnBase}>«</button>
      )}
      <button onClick={() => onPage(page - 1)} disabled={page === 1}
        style={{ ...btnBase, cursor: page === 1 ? 'not-allowed' : 'pointer', opacity: page === 1 ? 0.4 : 1 }}>이전</button>
      {pageNums.map(n => (
        <button key={n} onClick={() => onPage(n)} style={{ ...btnBase,
          background: page === n ? 'var(--accent)' : 'var(--surface)',
          color: page === n ? '#fff' : 'var(--text-2)',
          border: '1px solid ' + (page === n ? 'var(--accent)' : 'var(--border)'),
          fontWeight: page === n ? 700 : 400 }}>{n}</button>
      ))}
      <button onClick={() => onPage(page + 1)} disabled={page === totalPages}
        style={{ ...btnBase, cursor: page === totalPages ? 'not-allowed' : 'pointer', opacity: page === totalPages ? 0.4 : 1 }}>다음</button>
      {page <= totalPages - WINDOW && (
        <button onClick={() => onPage(Math.min(totalPages, page + WINDOW))} style={btnBase}>»</button>
      )}
    </div>
  );
}

export default function History() {
  const [feedbacks, setFeedbacks]     = useState([]);
  const [panelData, setPanelData]     = useState(null);
  const [loading, setLoading]         = useState(true);
  const [tab, setTab]                 = useState('pending');
  const [page, setPage]               = useState(1);
  const [openReasonId, setOpenReasonId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null); // feedbackId
  const [deleting, setDeleting]         = useState(false);
  const [deleteError, setDeleteError]   = useState('');

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

  const getStatusKey = (f) => {
    if (f.purity_passed) return 'approved';
    if (f.status === 'rejected') return 'rejected';
    return 'submitted';
  };

  const approved = feedbacks.filter(f => f.purity_passed);
  const pending  = feedbacks.filter(f => !f.purity_passed && f.status === 'submitted');
  const rejected = feedbacks.filter(f => !f.purity_passed && f.status === 'rejected' && !f.dismissed);

  const calcReward = (f) => {
    if (f.purity_passed && f.payout_amount != null) return Number(f.payout_amount);
    const isSub = ['preference', 'pricing', 'email'].includes(f.missions?.type);
    const base = getPanelReward(panelData?.honor_points || 0, panelData?.experience || '');
    return isSub ? Math.round(base * (4500 / 8000)) : base;
  };

  const handleDeleteRejected = async () => {
    if (deleting || !deleteTarget) return;
    setDeleting(true);
    setDeleteError('');
    const { error } = await supabase.rpc('delete_rejected_feedback', { p_feedback_id: deleteTarget });
    if (error) {
      setDeleteError('삭제에 실패했습니다. 다시 시도해주세요.');
      setDeleting(false);
      return;
    }
    setFeedbacks(prev => prev.filter(f => f.id !== deleteTarget));
    setDeleteTarget(null);
    setDeleting(false);
  };

  const totalPaid    = approved.reduce((s, f) => s + calcReward(f), 0);
  const totalPending = pending.reduce((s, f)  => s + calcReward(f), 0);

  const filtered = tab === 'pending'  ? pending
    : tab === 'approved' ? approved
    : rejected;
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <>
    {deleteTarget && ReactDOM.createPortal(
      <ConfirmModal
        title="피드백을 삭제할까요?"
        desc={'지급 거절된 피드백을 목록에서 삭제합니다.\n삭제된 피드백은 복구할 수 없습니다.'}
        confirmLabel={deleting ? '처리 중...' : '삭제'}
        cancelLabel="취소"
        danger
        onConfirm={handleDeleteRejected}
        onCancel={() => { setDeleteTarget(null); setDeleteError(''); }}
        errorMsg={deleteError}
      />,
      document.body
    )}
    <div className="page-wrap" style={{ padding: '40px 48px', maxWidth: 860, animation: 'fadeUp 0.5s ease both' }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 12, fontFamily: 'var(--font-sans)', color: 'var(--green)', marginBottom: 8, letterSpacing: '0.1em' }}>LEDGER</div>
        <h1 style={{ fontSize: 28, fontWeight: 800 }}>정산 내역</h1>
      </div>

      {/* 통계 카드 */}
      <div className="stat-inline-three" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, background: 'var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', marginBottom: 32 }}>
        <div style={{ background: 'var(--surface)', padding: '24px 28px' }}>
          <div style={{ fontSize: 11, fontFamily: 'var(--font-sans)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>총 정산 확정</div>
          <div style={{ lineHeight: 1, marginBottom: 6 }}>
            <div style={{ fontSize: 9, color: 'var(--text-3)', fontWeight: 700, letterSpacing: '0.08em', marginBottom: 3 }}>KRW</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.03em' }}>{Math.round(totalPaid).toLocaleString()}</div>
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-3)', fontFamily: 'var(--font-sans)' }}>{approved.length}건</div>
        </div>
        <div style={{ background: 'var(--surface)', padding: '24px 28px' }}>
          <div style={{ fontSize: 11, fontFamily: 'var(--font-sans)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>정산 대기 중</div>
          <div style={{ lineHeight: 1, marginBottom: 6 }}>
            <div style={{ fontSize: 9, color: 'var(--text-3)', fontWeight: 700, letterSpacing: '0.08em', marginBottom: 3 }}>KRW</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.03em' }}>{Math.round(totalPending).toLocaleString()}</div>
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-3)', fontFamily: 'var(--font-sans)' }}>{pending.length}건</div>
        </div>
        <div style={{ background: 'var(--surface)', padding: '24px 28px' }}>
          <div style={{ fontSize: 11, fontFamily: 'var(--font-sans)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>지급 거절</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: rejected.length > 0 ? 'var(--red, #ef4444)' : 'var(--text)', fontFamily: 'var(--font-sans)', lineHeight: 1, marginBottom: 6 }}>
            {rejected.length}건
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-3)' }}>Purit Filter 미통과</div>
        </div>
      </div>

      {/* 탭 */}
      <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-2)', marginBottom: 10 }}>현황</h2>
      <StatusTabs
        value={tab}
        onChange={(v) => { setTab(v); setPage(1); setOpenReasonId(null); }}
        tabs={TABS.map(t => ({ key: t.key, label: t.label }))}
        style={{ marginBottom: 14 }}
      />

      {filtered.length === 0 ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-3)', fontSize: 14, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' }}>
          해당 항목이 없습니다.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {paged.map((f) => {
            const statusKey    = getStatusKey(f);
            const isRejected   = statusKey === 'rejected';
            const reward       = calcReward(f);
            const isReasonOpen = openReasonId === f.id;
            return (
              <div key={f.id} style={{
                display: 'flex', flexDirection: 'column',
                background: 'var(--surface)', borderRadius: 'var(--radius)',
                border: `1px solid ${isRejected ? 'rgba(239,68,68,0.25)' : 'var(--border)'}`,
                overflow: 'hidden',
              }}>
                {/* 메인 행 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px' }}>
                  <Badge type={STATUS_TYPE[statusKey]}>
                    {STATUS_LABEL[statusKey]}
                  </Badge>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600 }}>{f.missions?.title || '미션'}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
                      {new Date(f.created_at).toLocaleDateString('ko-KR')}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    {isRejected ? (
                      <span style={{ fontWeight: 700, color: 'var(--text-3)' }}>—</span>
                    ) : (
                      <>
                        <div style={{ fontSize: 9, color: 'var(--text-3)', fontWeight: 700, letterSpacing: '0.08em', marginBottom: 2 }}>KRW</div>
                        <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-sans)', color: statusKey === 'approved' ? 'var(--green)' : 'var(--accent)' }}>{reward.toLocaleString()}</div>
                        {statusKey === 'submitted' && (
                          <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 2 }}>(예상)</div>
                        )}
                      </>
                    )}
                  </div>
                  {isRejected && (
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <button
                        onClick={() => setOpenReasonId(isReasonOpen ? null : f.id)}
                        style={{ fontSize: 12, color: 'var(--text-3)', background: 'none', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', textDecoration: 'underline' }}
                      >
                        {isReasonOpen ? '탈락 사유 닫기 ▲' : '탈락 사유 보기 ▼'}
                      </button>
                      <button
                        onClick={() => { setDeleteError(''); setDeleteTarget(f.id); }}
                        style={{ fontSize: 12, color: 'var(--red, #ef4444)', background: 'none', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', textDecoration: 'underline' }}
                      >
                        삭제
                      </button>
                    </div>
                  )}
                </div>
                {/* 탈락 사유 펼침 영역 */}
                {isRejected && isReasonOpen && (
                  <div style={{ borderTop: '1px solid var(--border)', padding: '12px 20px', background: 'rgba(239,68,68,0.04)' }}>
                    <div style={{ fontSize: 12, color: 'var(--red, #ef4444)', fontWeight: 600, marginBottom: 8 }}>반려 사유 · Purit Filter 기준 미달</div>
                    {f.suggestions && (
                      <div style={{ padding: '8px 12px', background: 'var(--surface)', borderRadius: 6, fontSize: 12, color: 'var(--text-2)', whiteSpace: 'pre-wrap', fontFamily: 'var(--font-sans)', lineHeight: 1.7, marginBottom: 8 }}>{f.suggestions}</div>
                    )}
                    <div style={{ fontSize: 12, color: 'var(--text-3)', background: 'var(--bg-2)', borderRadius: 6, padding: '8px 12px', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                      {REJECTION_GUIDE}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          <Pagination page={page} total={filtered.length} onPage={setPage} />
        </div>
      )}

      {tab !== 'approved' && rejected.length > 0 && (
        <Card style={{ marginTop: 20, borderColor: 'rgba(224,112,112,0.2)', background: 'var(--red-dim)' }}>
          <div style={{ fontSize: 13, color: 'var(--red)', fontWeight: 600, marginBottom: 6 }}>Purit Filter 탈락 안내</div>
          <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.7 }}>
            Purit Filter를 통과하지 못한 피드백은 보상이 지급되지 않습니다. 구체적인 전환 근거와 개선안을 포함하면 합격률이 높아집니다.
          </p>
        </Card>
      )}
    </div>
    </>
  );
}
