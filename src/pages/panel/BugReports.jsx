import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, EmptyState } from '../../components/ui';
import { ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';
import { supabase } from '../../lib/supabase';

const TYPE_META = {
  bug:     { label: '🐛 버그/오류',   bg: '#FEF2F2', color: '#DC2626' },
  ux:      { label: '😕 UX 불편',    bg: '#FFFBEB', color: '#D97706' },
  data:    { label: '📊 데이터 이상', bg: '#EFF6FF', color: '#2563EB' },
  feature: { label: '💡 기능 제안',   bg: '#F0FDF4', color: '#059669' },
  appeal:  { label: '⚖️ 이의 신청',  bg: '#F5F3FF', color: '#7C3AED' },
  other:   { label: '기타',           bg: '#F8FAFC', color: '#64748B' },
};

const STATUS_META = {
  pending:     { label: '미처리',  bg: 'var(--bg-2)',          color: 'var(--text-3)',  border: 'var(--border)' },
  in_progress: { label: '처리 중', bg: '#FFFBEB',              color: '#D97706',        border: 'rgba(217,119,6,0.3)' },
  resolved:    { label: '해결됨',  bg: 'rgba(52,199,89,0.10)', color: '#1C7A39',        border: 'rgba(52,199,89,0.2)' },
  dismissed:   { label: '기각',    bg: '#F1F5F9',              color: '#64748B',        border: '#CBD5E1' },
};

const PAGE_SIZE = 5;

function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function PanelBugReports() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [searchParams] = useSearchParams();
  const focusId = searchParams.get('id');

  useEffect(() => { setSelected(null); load(); }, [page]);

  // 알림(💬 답변 도착)에서 진입 시 해당 리포트 자동 선택 — 페이지네이션과 무관하게 id로 직접 조회
  useEffect(() => {
    if (!focusId) return;
    (async () => {
      const { data } = await supabase.from('bug_reports').select('*').eq('id', focusId).single();
      if (data) setSelected(data);
    })();
  }, [focusId]);

  async function load() {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const { data, count } = await supabase
        .from('bug_reports')
        .select('*', { count: 'exact' })
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .range(from, to);
      setReports(data || []);
      setTotal(count || 0);
    } catch (err) {
      console.error('[BugReports load]', err);
    }
    setLoading(false);
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="page-wrap" style={{ padding: '32px 40px', fontFamily: 'var(--font-ui)' }}>
      {/* 헤더 */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
          MY REPORTS
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)', margin: 0, letterSpacing: '-0.02em' }}>
          버그 / 건의 현황
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 6, marginBottom: 0 }}>
          제출한 리포트와 관리자 답변을 확인합니다.
        </p>
      </div>

      {loading ? (
        <div style={{ padding: '60px 0', textAlign: 'center', fontSize: 13, color: 'var(--text-3)' }}>불러오는 중…</div>
      ) : reports.length === 0 ? (
        <EmptyState
          icon="📋"
          title="아직 제출한 리포트가 없습니다."
          desc={"버그나 불편 사항이 있으면 사이드바 하단의\n'버그 / 불편 신고' 버튼을 사용해 주세요."}
        />
      ) : (
        <div className="results-layout" style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 20, alignItems: 'start' }}>
          {/* 좌: 목록 */}
          <div>
            {reports.map(r => {
              const tm = TYPE_META[r.type] || TYPE_META.other;
              const sm = STATUS_META[r.status] || STATUS_META.pending;
              const isSelected = selected?.id === r.id;
              return (
                <div
                  key={r.id}
                  onClick={() => setSelected(r)}
                  style={{
                    padding: '13px 15px', borderRadius: 12, marginBottom: 8,
                    border: '1.5px solid ' + (isSelected ? 'var(--accent)' : 'var(--border)'),
                    background: isSelected ? 'var(--accent-dim2)' : '#fff',
                    cursor: 'pointer', transition: 'all 0.15s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: tm.bg, color: tm.color }}>
                      {tm.label}
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: sm.bg, color: sm.color, border: '1px solid ' + sm.border }}>
                      {sm.label}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 3 }}>
                    {r.title}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{fmtDate(r.created_at)}</span>
                    {r.admin_reply && (
                      <span style={{ fontSize: 11, fontWeight: 600, color: '#1C7A39', background: 'rgba(52,199,89,0.10)', border: '1px solid rgba(52,199,89,0.2)', borderRadius: 20, padding: '1px 7px' }}>
                        💬 답변 있음
                      </span>
                    )}
                  </div>
                </div>
              );
            })}

            {/* 페이지네이션 */}
            {totalPages > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 12 }}>
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', cursor: page === 1 ? 'not-allowed' : 'pointer', opacity: page === 1 ? 0.4 : 1, display: 'flex', alignItems: 'center' }}
                >
                  <ChevronLeft size={14} />
                </button>
                <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{page} / {totalPages}</span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', cursor: page === totalPages ? 'not-allowed' : 'pointer', opacity: page === totalPages ? 0.4 : 1, display: 'flex', alignItems: 'center' }}
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            )}
          </div>

          {/* 우: 상세 */}
          {selected ? (
            <Card style={{ padding: '22px 24px' }}>
              {/* 메타 */}
              <div style={{ marginBottom: 18 }}>
                {(() => {
                  const tm = TYPE_META[selected.type] || TYPE_META.other;
                  const sm = STATUS_META[selected.status] || STATUS_META.pending;
                  return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: tm.bg, color: tm.color }}>{tm.label}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: sm.bg, color: sm.color, border: '1px solid ' + sm.border }}>{sm.label}</span>
                    </div>
                  );
                })()}
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', lineHeight: 1.3, marginBottom: 8 }}>
                  {selected.title}
                </div>
                <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--text-3)', flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: 'monospace' }}>{selected.page_url || '—'}</span>
                  <span>·</span>
                  <span>{fmtDate(selected.created_at)}</span>
                </div>
              </div>

              {/* 상세 내용 */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                  상세 내용
                </div>
                <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.75, padding: '14px 16px', borderRadius: 10, background: 'var(--bg)', border: '1px solid var(--border)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {selected.description}
                </div>
              </div>

              {/* 스크린샷 */}
              {selected.screenshot_url && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                    스크린샷
                  </div>
                  <div style={{ position: 'relative' }}>
                    <img
                      src={selected.screenshot_url}
                      alt="스크린샷"
                      style={{ width: '100%', borderRadius: 10, border: '1px solid var(--border)', display: 'block', maxHeight: 300, objectFit: 'contain', background: 'var(--bg)' }}
                    />
                    <a
                      href={selected.screenshot_url}
                      target="_blank"
                      rel="noreferrer"
                      style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.55)', color: '#fff', borderRadius: 6, padding: '4px 8px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none' }}
                    >
                      <ExternalLink size={11} /> 원본 보기
                    </a>
                  </div>
                </div>
              )}

              {/* 관리자 답변 */}
              {selected.admin_reply ? (
                <div style={{ marginTop: 4 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                    💬 관리자 답변
                  </div>
                  <div style={{ padding: '14px 16px', borderRadius: 10, background: 'var(--accent-dim2)', border: '1.5px solid var(--accent)', fontSize: 13, color: 'var(--text)', lineHeight: 1.75, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {selected.admin_reply}
                  </div>
                  {selected.replied_at && (
                    <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 5 }}>
                      답변일: {fmtDate(selected.replied_at)}
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ padding: '16px', borderRadius: 10, background: 'var(--bg-2)', border: '1px dashed var(--border)', fontSize: 13, color: 'var(--text-3)', textAlign: 'center' }}>
                  아직 관리자 답변이 없습니다.
                </div>
              )}
            </Card>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, borderRadius: 16, border: '1.5px dashed var(--border)', color: 'var(--text-3)', fontSize: 13 }}>
              좌측 목록에서 리포트를 선택하세요
            </div>
          )}
        </div>
      )}
    </div>
  );
}
