import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card, Btn, Badge, StatusTabs, SegmentFilter } from '../../components/ui';
import { ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { sendNotification } from '../../lib/notify';

const TABS = [
  { key: 'pending',     label: '미처리',  color: '#DC2626' },
  { key: 'in_progress', label: '처리 중', color: '#D97706' },
  { key: 'resolved',    label: '해결됨',  color: '#059669' },
  { key: 'dismissed',   label: '기각',    color: '#94A3B8' },
];

const TYPE_META = {
  bug:     { label: '🐛 버그/오류',   bg: '#FEF2F2', color: '#DC2626' },
  ux:      { label: '😕 UX 불편',    bg: '#FFFBEB', color: '#D97706' },
  data:    { label: '📊 데이터 이상', bg: '#EFF6FF', color: '#2563EB' },
  feature: { label: '💡 기능 제안',   bg: '#F0FDF4', color: '#059669' },
  appeal:  { label: '⚖️ 이의 신청',  bg: '#F5F3FF', color: '#7C3AED' },
  other:   { label: '기타',           bg: '#F8FAFC', color: '#64748B' },
};

const TYPE_FILTER_OPTIONS = [
  { key: 'all',     label: '전체' },
  { key: 'bug',     label: '🐛 버그' },
  { key: 'ux',      label: '😕 UX 불편' },
  { key: 'data',    label: '📊 데이터' },
  { key: 'feature', label: '💡 기능제안' },
  { key: 'appeal',  label: '⚖️ 이의신청' },
  { key: 'other',   label: '기타' },
];

const ROLE_LABEL = { company: '기업', panel: '패널', admin: '어드민' };
const STATUS_OPTS = [
  { key: 'pending',     label: '미처리' },
  { key: 'in_progress', label: '처리 중' },
  { key: 'resolved',    label: '해결됨' },
  { key: 'dismissed',   label: '기각' },
];

const PAGE_SIZE = 10;

function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function BugReports() {
  const [tab, setTab] = useState('pending');
  const [typeFilter, setTypeFilter] = useState('all');
  const [reports, setReports] = useState([]);
  const [counts, setCounts] = useState({ pending: 0, in_progress: 0, resolved: 0, dismissed: 0 });
  const [typeCounts, setTypeCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [memo, setMemo] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [adminReply, setAdminReply] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [sendReplyError, setSendReplyError] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const deeplinkRef = useRef(false);

  useEffect(() => { loadAll(); }, []);
  useEffect(() => { loadTab(); }, [tab, page, typeFilter]);

  // 알림 클릭 딥링크: ?id=xxx 쿼리 파라미터 처리
  // (알림은 문자열 URL로만 이동 → location.state를 못 받으므로 쿼리 경로가 필수)
  // 리포트는 상태별 탭·서버 페이지네이션이라 단건 조회 후 해당 상태 탭으로 전환하고 상세 패널을 연다
  // (상세는 selected 객체로 렌더되므로 목록 페이지 위치와 무관하게 즉시 표시됨)
  useEffect(() => {
    const targetId = searchParams.get('id');
    if (!targetId || deeplinkRef.current) return;
    deeplinkRef.current = true;
    (async () => {
      const { data } = await supabase.from('bug_reports').select('*').eq('id', targetId).single();
      navigate('/admin/reports', { replace: true });
      if (!data) return;
      setTab(data.status);
      setTypeFilter('all');
      setPage(1);
      setSelected(data);
      setMemo(data.admin_memo || '');
      setAdminReply(data.admin_reply || '');
    })();
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadAll() {
    try {
      const { data } = await supabase
        .from('bug_reports')
        .select('status, type');
      if (data) {
        const c = { pending: 0, in_progress: 0, resolved: 0, dismissed: 0 };
        const tc = {};
        data.forEach(r => {
          if (c[r.status] !== undefined) c[r.status]++;
          if (!tc[r.status]) tc[r.status] = {};
          tc[r.status][r.type] = (tc[r.status][r.type] || 0) + 1;
        });
        setCounts(c);
        setTypeCounts(tc);
      }
    } catch (err) {
      console.error('[BugReports loadAll]', err);
    }
  }

  async function loadTab() {
    setLoading(true);
    try {
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      let q = supabase
        .from('bug_reports')
        .select('*', { count: 'exact' })
        .eq('status', tab);
      if (typeFilter !== 'all') q = q.eq('type', typeFilter);
      const { data, count, error } = await q
        .order('created_at', { ascending: false })
        .range(from, to);
      if (!error) {
        setReports(data || []);
        setTotal(count || 0);
      }
    } catch (err) {
      console.error('[BugReports loadTab]', err);
    }
    setLoading(false);
  }

  function handleTabChange(key) {
    setTab(key);
    setTypeFilter('all');
    setPage(1);
    setSelected(null);
    setMemo('');
    setAdminReply('');
  }

  function handleTypeFilterChange(key) {
    setTypeFilter(key);
    setPage(1);
    setSelected(null);
    setMemo('');
    setAdminReply('');
  }

  function handleSelect(r) {
    setSelected(r);
    setMemo(r.admin_memo || '');
    setAdminReply(r.admin_reply || '');
  }

  async function handleStatusChange(reportId, newStatus) {
    setSaving(true);
    setSaveError('');
    const { error } = await supabase
      .from('bug_reports')
      .update({ status: newStatus, admin_memo: memo })
      .eq('id', reportId);
    if (error) {
      setSaveError('상태 변경 중 오류가 발생했습니다: ' + error.message);
      setSaving(false);
      return;
    }
    setReports(rs => rs.filter(r => r.id !== reportId));
    setSelected(null);
    setMemo('');
    setAdminReply('');
    setTotal(t => Math.max(0, t - 1));
    setSaving(false);
    loadAll();
  }

  async function handleSaveMemo() {
    if (!selected) return;
    setSaving(true);
    setSaveError('');
    const { error } = await supabase.from('bug_reports').update({ admin_memo: memo }).eq('id', selected.id);
    if (!error) {
      setSelected(s => ({ ...s, admin_memo: memo }));
      setReports(rs => rs.map(r => r.id === selected.id ? { ...r, admin_memo: memo } : r));
    } else {
      setSaveError('메모 저장 중 오류가 발생했습니다: ' + error.message);
    }
    setSaving(false);
  }

  async function handleSendReply() {
    if (!selected || !adminReply.trim()) return;
    setSendingReply(true);
    setSendReplyError('');
    const now = new Date().toISOString();
    const { error } = await supabase
      .from('bug_reports')
      .update({ admin_reply: adminReply.trim(), replied_at: now })
      .eq('id', selected.id);
    if (!error) {
      setReports(rs => rs.map(r =>
        r.id === selected.id ? { ...r, admin_reply: adminReply.trim(), replied_at: now } : r
      ));
      setSelected(s => ({ ...s, admin_reply: adminReply.trim(), replied_at: now }));
      const actionUrl = selected.role === 'company' ? `/company/bug-reports?id=${selected.id}` : selected.role === 'admin' ? `/admin/reports?id=${selected.id}` : `/panel/bug-reports?id=${selected.id}`;
      sendNotification(selected.user_id, {
        type: 'info', icon: '💬',
        title: '버그/건의 답변이 도착했습니다',
        body: `[${selected.title}] 답변을 확인해보세요.`,
        actionUrl,
        targetRole: selected.role,
      });
    } else {
      setSendReplyError('답변 전송에 실패했습니다. 다시 시도해 주세요.');
    }
    setSendingReply(false);
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="page-wrap" style={{ padding: '32px 40px', fontFamily: 'var(--font-ui)' }}>
      {/* 헤더 */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
          REPORTS
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)', margin: 0, letterSpacing: '-0.02em' }}>
          버그 / 불편 신고
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 6, margin: 0 }}>
          기업·패널 사용자가 제출한 버그 리포트를 확인하고 처리합니다.
        </p>
      </div>

      {/* 상태 탭 */}
      <StatusTabs
        value={tab}
        onChange={handleTabChange}
        style={{ marginBottom: 0 }}
        tabs={TABS.map(t => ({
          key: t.key,
          label: t.label,
          badge: counts[t.key] > 0
            ? (active) => (
                <span style={{
                  minWidth: 18, height: 18, borderRadius: 9,
                  background: active ? t.color : 'var(--bg-3)',
                  color: active ? '#fff' : 'var(--text-3)',
                  fontSize: 11, fontWeight: 700,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  padding: '0 5px',
                }}>
                  {counts[t.key]}
                </span>
              )
            : null,
        }))}
      />

      {/* 유형 서브탭 */}
      <SegmentFilter
        value={typeFilter}
        onChange={handleTypeFilterChange}
        style={{ marginTop: 12, marginBottom: 20 }}
        tabs={TYPE_FILTER_OPTIONS.map(opt => {
          const cnt = opt.key === 'all'
            ? (counts[tab] || 0)
            : (typeCounts[tab]?.[opt.key] || 0);
          return { key: opt.key, label: opt.label, count: cnt > 0 ? cnt : undefined };
        })}
      />

      {/* 본문 — 좌우 2열 */}
      <div className="purity-layout" style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 20, alignItems: 'start' }}>
        {/* 좌: 목록 */}
        <div>
          {loading ? (
            <div style={{ padding: '40px 0', textAlign: 'center', fontSize: 13, color: 'var(--text-3)' }}>불러오는 중…</div>
          ) : reports.length === 0 ? (
            <div style={{ padding: '40px 0', textAlign: 'center', fontSize: 13, color: 'var(--text-3)' }}>리포트가 없습니다.</div>
          ) : (
            <>
              {reports.map(r => {
                const tm = TYPE_META[r.type] || TYPE_META.other;
                const isSelected = selected?.id === r.id;
                return (
                  <div
                    key={r.id}
                    onClick={() => handleSelect(r)}
                    style={{
                      padding: '14px 16px', borderRadius: 12, marginBottom: 8,
                      border: '1.5px solid ' + (isSelected ? 'var(--accent)' : 'var(--border)'),
                      background: isSelected ? 'var(--accent-dim2)' : '#fff',
                      cursor: 'pointer', transition: 'all 0.15s',
                    }}
                  >
                    {/* 타입 뱃지 + 역할 */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
                        background: tm.bg, color: tm.color,
                      }}>
                        {tm.label}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
                        {ROLE_LABEL[r.role] || r.role}
                      </span>
                    </div>
                    {/* 제목 */}
                    <div style={{
                      fontSize: 13, fontWeight: 600, color: 'var(--text)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      marginBottom: 4,
                    }}>
                      {r.title}
                    </div>
                    {/* 페이지 + 날짜 */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.page_url || '—'}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--text-3)', flexShrink: 0 }}>
                        {fmtDate(r.created_at)}
                      </span>
                    </div>
                    {/* 어드민 메모 미리보기 */}
                    {r.admin_memo && (
                      <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-3)', fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        📝 {r.admin_memo}
                      </div>
                    )}
                    {/* 공개 답글 여부 */}
                    {r.admin_reply && (
                      <div style={{ marginTop: 5 }}>
                        <span style={{
                          fontSize: 11, fontWeight: 600, color: '#1C7A39',
                          background: 'rgba(52,199,89,0.10)', border: '1px solid rgba(52,199,89,0.2)',
                          borderRadius: 20, padding: '1px 7px',
                        }}>
                          💬 답변 완료
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* 페이지네이션 */}
              {totalPages > 1 && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 12 }}>
                  <button
                    onClick={() => { setPage(p => Math.max(1, p - 1)); setSelected(null); }}
                    disabled={page === 1}
                    style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', cursor: page === 1 ? 'not-allowed' : 'pointer', opacity: page === 1 ? 0.4 : 1, display: 'flex', alignItems: 'center' }}
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{page} / {totalPages}</span>
                  <button
                    onClick={() => { setPage(p => Math.min(totalPages, p + 1)); setSelected(null); }}
                    disabled={page === totalPages}
                    style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', cursor: page === totalPages ? 'not-allowed' : 'pointer', opacity: page === totalPages ? 0.4 : 1, display: 'flex', alignItems: 'center' }}
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* 우: 상세 */}
        {selected ? (
          <Card style={{ padding: '22px 24px' }}>
            {/* 상단 메타 */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 }}>
              <div>
                {(() => {
                  const tm = TYPE_META[selected.type] || TYPE_META.other;
                  return (
                    <span style={{ fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: tm.bg, color: tm.color }}>
                      {tm.label}
                    </span>
                  );
                })()}
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginTop: 10, lineHeight: 1.3 }}>
                  {selected.title}
                </div>
                <div style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: 12, color: 'var(--text-3)' }}>
                  <span>{ROLE_LABEL[selected.role] || selected.role}</span>
                  <span>·</span>
                  <span style={{ fontFamily: 'monospace' }}>{selected.page_url || '—'}</span>
                  <span>·</span>
                  <span>{fmtDate(selected.created_at)}</span>
                </div>
              </div>
            </div>

            {/* 상세 내용 */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                상세 내용
              </div>
              <div style={{
                fontSize: 13, color: 'var(--text)', lineHeight: 1.75,
                padding: '14px 16px', borderRadius: 10,
                background: 'var(--bg)', border: '1px solid var(--border)',
                whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              }}>
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
                    style={{ width: '100%', borderRadius: 10, border: '1px solid var(--border)', display: 'block', maxHeight: 360, objectFit: 'contain', background: 'var(--bg)' }}
                  />
                  <a
                    href={selected.screenshot_url}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      position: 'absolute', top: 8, right: 8,
                      background: 'rgba(0,0,0,0.55)', color: '#fff',
                      borderRadius: 6, padding: '4px 8px', fontSize: 11,
                      display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none',
                    }}
                  >
                    <ExternalLink size={11} /> 원본 보기
                  </a>
                </div>
              </div>
            )}

            {/* 어드민 메모 */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                어드민 메모
              </div>
              <textarea
                value={memo}
                onChange={e => setMemo(e.target.value)}
                placeholder="내부 처리 메모를 입력하세요…"
                rows={3}
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: 8, fontSize: 13,
                  border: '1.5px solid var(--border)', outline: 'none', resize: 'vertical',
                  fontFamily: 'var(--font-ui)', color: 'var(--text)', lineHeight: 1.65,
                  boxSizing: 'border-box', transition: 'border-color 0.15s',
                }}
                onFocus={e => e.target.style.borderColor = 'var(--accent)'}
                onBlur={e => e.target.style.borderColor = 'var(--border)'}
              />
              <div style={{ marginTop: 6, textAlign: 'right' }}>
                <Btn variant="outline" size="sm" onClick={handleSaveMemo} disabled={saving}>
                  메모 저장
                </Btn>
              </div>
            </div>

            {/* 공개 답글 */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                💬 공개 답글
                <span style={{ fontSize: 10, fontWeight: 400, color: 'var(--text-3)', textTransform: 'none', letterSpacing: 0 }}>
                  사용자에게 전달됩니다
                </span>
              </div>
              <textarea
                value={adminReply}
                onChange={e => setAdminReply(e.target.value)}
                placeholder="사용자에게 보낼 답변을 입력하세요…"
                rows={3}
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: 8, fontSize: 13,
                  border: '1.5px solid var(--accent)', outline: 'none', resize: 'vertical',
                  fontFamily: 'var(--font-ui)', color: 'var(--text)', lineHeight: 1.65,
                  boxSizing: 'border-box', background: 'var(--accent-dim2)',
                }}
              />
              {selected.replied_at && (
                <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>
                  마지막 발송: {fmtDate(selected.replied_at)}
                </div>
              )}
              {sendReplyError && (
                <div style={{ marginTop: 6, padding: '8px 12px', borderRadius: 8, background: 'rgba(239,68,68,0.08)', color: '#ef4444', fontSize: 12, fontWeight: 600 }}>
                  {sendReplyError}
                </div>
              )}
              <div style={{ marginTop: 6, textAlign: 'right' }}>
                <Btn variant="primary" size="sm" onClick={handleSendReply} disabled={sendingReply || !adminReply.trim()}>
                  {sendingReply ? '발송 중…' : '답글 발송'}
                </Btn>
              </div>
            </div>

            {/* 상태 변경 */}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 18 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
                상태 변경
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {STATUS_OPTS.filter(s => s.key !== selected.status).map(s => {
                  const isDanger = s.key === 'dismissed';
                  return (
                    <Btn
                      key={s.key}
                      variant={isDanger ? 'danger' : 'secondary'}
                      size="sm"
                      onClick={() => handleStatusChange(selected.id, s.key)}
                      disabled={saving}
                    >
                      → {s.label}
                    </Btn>
                  );
                })}
              </div>
            </div>
            {saveError && (
              <div style={{ marginTop: 10, fontSize: 13, color: '#ef4444', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '8px 12px' }}>
                {saveError}
              </div>
            )}
          </Card>
        ) : (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            height: 240, borderRadius: 16,
            border: '1.5px dashed var(--border)',
            color: 'var(--text-3)', fontSize: 13,
          }}>
            좌측 목록에서 리포트를 선택하세요
          </div>
        )}
      </div>
    </div>
  );
}
