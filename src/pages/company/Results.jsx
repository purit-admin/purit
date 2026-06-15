import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, ScoreBar, Badge, Btn, StatusTabs, SegmentFilter } from '../../components/ui';
import ImageAnnotator from '../../components/ui/ImageAnnotator';
import ChargeOptionsModal from '../../components/ui/ChargeOptionsModal';
import { supabase } from '../../lib/supabase';
import { resolveCompany } from '../../lib/resolveCompany';
import { getCareerUnlockCredit, applyUnlockDiscount, TRIAL_FIRST_UNLOCK_DISCOUNT, TRIAL_UNLOCK_DISCOUNT_WINDOW_HOURS } from '../../lib/honorLevels';
import { resolveEmailGoal } from '../../lib/subMissionMeta';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Tooltip,
} from 'recharts';

const DIM_META = {
  clarity:         { key: 'clarity_score',         label: '명확성', short: '명', color: '#34C759', bg: 'rgba(52,199,89,0.18)'   },
  relevance:       { key: 'relevance_score',        label: '관련성', short: '관', color: '#f59e0b', bg: 'rgba(245,158,11,0.18)'  },
  value:           { key: 'value_score',            label: '가치',   short: '가', color: '#6366f1', bg: 'rgba(99,102,241,0.18)'  },
  differentiation: { key: 'differentiation_score',  label: '차별화', short: '차', color: '#ef4444', bg: 'rgba(239,68,68,0.18)'   },
  trust:           { key: 'trust_score',            label: '신뢰',   short: '신', color: '#94a3b8', bg: 'rgba(148,163,184,0.18)' },
};
const DIMS = ['clarity', 'relevance', 'value', 'differentiation', 'trust'];

const PAGE_SIZE = 5;

function Pagination({ page, total, onPage }) {
  const totalPages = Math.ceil(total / PAGE_SIZE);
  if (totalPages <= 1) return null;
  const base = { padding: '3px 7px', borderRadius: 5, fontSize: 11, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-2)', cursor: 'pointer' };
  const winStart = Math.max(1, page - 2);
  const winEnd   = Math.min(totalPages, winStart + 4);
  const pageNums = Array.from({ length: winEnd - winStart + 1 }, (_, i) => winStart + i);
  return (
    <div style={{ display: 'flex', gap: 3, alignItems: 'center', marginTop: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
      {page > 5 && <button onClick={() => onPage(Math.max(1, page - 5))} style={base}>«</button>}
      <button onClick={() => onPage(page - 1)} disabled={page === 1}
        style={{ ...base, opacity: page === 1 ? 0.4 : 1, cursor: page === 1 ? 'not-allowed' : 'pointer' }}>‹</button>
      {pageNums.map(n => (
        <button key={n} onClick={() => onPage(n)} style={{
          ...base,
          background: page === n ? 'var(--accent)' : 'var(--surface)',
          color: page === n ? '#fff' : 'var(--text-2)',
          borderColor: page === n ? 'var(--accent)' : 'var(--border)',
          fontWeight: page === n ? 700 : 400,
        }}>{n}</button>
      ))}
      <button onClick={() => onPage(page + 1)} disabled={page === totalPages}
        style={{ ...base, opacity: page === totalPages ? 0.4 : 1, cursor: page === totalPages ? 'not-allowed' : 'pointer' }}>›</button>
      {page <= totalPages - 5 && <button onClick={() => onPage(Math.min(totalPages, page + 5))} style={base}>»</button>}
    </div>
  );
}

const TYPE_INFO = {
  landing_page: { label: 'LP검증',    color: 'var(--accent)' },
  preference:   { label: '소재비교',  color: '#64748B' },
  pricing:      { label: '가격검증',  color: '#f59e0b' },
  email:        { label: '이메일검증', color: '#34C759' },
};

function extractOverallComment(suggestions = '') {
  const match = (suggestions || '').match(/\[총평\]\n([\s\S]*?)$/);
  return match?.[1]?.trim() || '';
}

function parseSubDesc(desc, type) {
  if (!desc) return {};
  try {
    const p = JSON.parse(desc);
    if (type === 'preference') return p;
    if (p && typeof p === 'object' && 'content' in p) return p;
    return { content: desc, productDescription: '', customQuestions: [] };
  } catch {
    return { content: desc || '', productDescription: '', customQuestions: [] };
  }
}

function parseLPDesc(desc) {
  if (!desc) return { briefText: '', selectedQuestions: [] };
  try {
    const p = JSON.parse(desc);
    if (p && typeof p === 'object' && 'briefText' in p)
      return { briefText: p.briefText || '', selectedQuestions: p.selectedQuestions || [] };
    return { briefText: desc, selectedQuestions: [] };
  } catch { return { briefText: desc, selectedQuestions: [] }; }
}

function PanelBadges({ panelId, profiles }) {
  const p = profiles?.[panelId];
  if (!p) return null;
  return (
    <span style={{ display: 'inline-flex', gap: 4, marginLeft: 6, verticalAlign: 'middle' }}>
      {p.industry && <Badge type="blue" style={{ fontSize: 10 }}>{p.industry}</Badge>}
      {p.experience && <Badge type="gray" style={{ fontSize: 10 }}>{p.experience}</Badge>}
    </span>
  );
}

/* ─── 도움 됨/안 됨 평가 버튼 ─── */
function HelpfulnessButtons({ refType, refId, panelId, companyId, helpRatings, onRated }) {
  if (!companyId || !refId || !panelId) return null;
  const key     = `${refType}:${refId}`;
  const current = helpRatings[key] ?? null;

  return (
    <span style={{ display: 'inline-flex', gap: 4 }}>
      {[
        { label: '👍 도움 됨',    value: 'helpful'   },
        { label: '👎 도움 안 됨', value: 'unhelpful' },
      ].map(({ label, value }) => {
        const isActive   = current === value;
        const activeColor = value === 'helpful' ? 'var(--green)' : 'var(--red, #ef4444)';
        return (
          <button
            key={value}
            onClick={e => { e.stopPropagation(); onRated(refType, refId, panelId, value); }}
            title={current === null ? '평가하기 (선택)' : '평가 변경/취소'}
            style={{
              fontSize: 10, padding: '2px 7px', borderRadius: 10, lineHeight: 1,
              border: `1px solid ${isActive ? activeColor : 'var(--border)'}`,
              background: isActive
                ? (value === 'helpful' ? 'rgba(52,199,89,0.12)' : 'rgba(239,68,68,0.08)')
                : 'transparent',
              color: isActive ? activeColor : 'var(--text-3)',
              cursor: 'pointer', transition: 'all 0.15s',
              opacity: current === null ? 0.55 : 1,
            }}
          >
            {label}
          </button>
        );
      })}
    </span>
  );
}

function calcAvg(arr, key) {
  const valid = arr.filter(r => r[key] != null && r[key] > 0);
  if (!valid.length) return null;
  return (valid.reduce((s, r) => s + r[key], 0) / valid.length).toFixed(1);
}

/* ─── 미션 목록 아이템 ─── */
function MissionItem({ m, isSelected, onClick }) {
  const typeInfo    = TYPE_INFO[m.type] || TYPE_INFO.landing_page;
  const isCompleted = m.status === 'completed';
  const isCancelled = m.status === 'cancelled';
  return (
    <div
      onClick={onClick}
      style={{
        padding: '10px 12px', borderRadius: 'var(--radius)',
        background: 'var(--surface)',
        border: `1px solid ${isSelected ? 'var(--text)' : 'var(--border)'}`,
        cursor: 'pointer', marginBottom: 6, transition: 'all 0.15s',
      }}
    >
      {m.type && m.type !== 'landing_page' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <span style={{
            fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
            background: typeInfo.color + '22', color: typeInfo.color,
            border: `1px solid ${typeInfo.color}44`,
          }}>{typeInfo.label}</span>
        </div>
      )}
      <div style={{ fontSize: 13, fontWeight: isSelected ? 700 : 500, color: 'var(--text)', lineHeight: 1.4 }}>
        {m.title}
      </div>
      <div style={{ fontSize: 11, marginTop: 4, display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
        {isCompleted && <span style={{ color: '#22c55e', fontWeight: 700 }}>✅ 완료</span>}
        {isCancelled && <span style={{ color: 'var(--text-3)', fontWeight: 600 }}>조기 종료</span>}
        {m.is_free_trial && <span style={{ color: '#92400e', fontWeight: 700 }}>🎁 체험</span>}
        <span style={{ color: 'var(--text-3)' }}>피드백 {m.filled_count || 0}개</span>
      </div>
    </div>
  );
}

/* ─── 점수 카드 그리드 ─── */
function ScoreCardRow({ items }) {
  return (
    <div className="score-card-row" style={{ display: 'grid', gridTemplateColumns: `repeat(${items.length}, 1fr)`, gap: 10, maxWidth: `${items.length * 220}px`, margin: '0 auto 20px' }}>
      {items.map(({ label, value, color }) => {
        const num = parseFloat(value);
        const c = color || (isNaN(num) ? 'var(--text-3)' : num >= 4 ? 'var(--green)' : num <= 2 ? 'var(--red)' : 'var(--text-2)');
        return (
          <Card key={label} style={{ padding: '16px', textAlign: 'center' }}>
            <div style={{ fontSize: 11, fontFamily: 'var(--font-sans)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>{label}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: c, fontFamily: 'var(--font-sans)', lineHeight: 1 }}>
              {value ?? '—'}
            </div>
            {!isNaN(num) && <div style={{ marginTop: 8 }}><ScoreBar score={Math.round(num)} color={c} /></div>}
          </Card>
        );
      })}
    </div>
  );
}

/* ─── 비율 바 (A/B, 예/아니오) ─── */
function RatioBar({ aLabel, bLabel, aCount, bCount, aColor = 'var(--accent)', bColor = 'var(--border)' }) {
  const total = aCount + bCount;
  if (!total) return null;
  const aPct = Math.round((aCount / total) * 100);
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
        <span>{aLabel} <span style={{ color: aColor, fontFamily: 'var(--font-sans)' }}>{aPct}%</span></span>
        <span><span style={{ color: 'var(--text-3)', fontFamily: 'var(--font-sans)' }}>{100 - aPct}%</span> {bLabel}</span>
      </div>
      <div style={{ height: 10, borderRadius: 5, background: 'var(--border)', overflow: 'hidden', display: 'flex' }}>
        <div style={{ width: `${aPct}%`, background: aColor, transition: 'width 0.4s', borderRadius: 5 }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>
        <span>{aCount}명 선택</span><span>{bCount}명 선택</span>
      </div>
    </div>
  );
}

/* ─── 코멘트 목록 ─── */
function CommentList({ items }) {
  const [page, setPage] = useState(1);
  if (!items?.length) return (
    <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>코멘트가 없습니다</div>
  );
  const paged = items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {paged.map((item, i) => (
          <div key={i} style={{ padding: '14px 16px', background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
            {(item.label || item.actions) && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 600 }}>{item.label}</div>
                {item.actions && <div style={{ flexShrink: 0 }}>{item.actions}</div>}
              </div>
            )}
            <div style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.75, fontWeight: 500 }}>
              {item.text || <span style={{ fontStyle: 'italic', color: 'var(--text-3)', fontWeight: 400, fontSize: 13 }}>내용 없음</span>}
            </div>
          </div>
        ))}
      </div>
      <Pagination page={page} total={items.length} onPage={setPage} />
    </div>
  );
}

/* ─── 어노테이션 코멘트 1줄 더보기 (DOM overflow 감지) ─── */
function TruncatedComment({ text }) {
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) setOverflows(ref.current.scrollWidth > ref.current.clientWidth);
  }, [text]);
  return (
    <div>
      <div ref={ref} style={{
        fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6,
        ...(expanded ? { whiteSpace: 'pre-wrap' } : { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }),
      }}>{text}</div>
      {overflows && (
        <button onClick={e => { e.stopPropagation(); setExpanded(v => !v); }} style={{
          marginTop: 3, fontSize: 11, color: 'var(--accent)', background: 'none', border: 'none',
          cursor: 'pointer', padding: 0, fontWeight: 600,
        }}>{expanded ? '접기 ▲' : '더보기 ▼'}</button>
      )}
    </div>
  );
}

/* ─── 텍스트 더보기 토글 ─── */
const EXPAND_LIMIT = 200;
function ExpandableText({ text, limit = EXPAND_LIMIT }) {
  const [expanded, setExpanded] = useState(false);
  if (!text) return null;
  const isLong = text.length > limit;
  return (
    <div>
      <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
        {isLong && !expanded ? text.slice(0, limit) + '…' : text}
      </div>
      {isLong && (
        <button
          onClick={() => setExpanded(e => !e)}
          style={{ marginTop: 6, fontSize: 12, color: 'var(--text-2)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontWeight: 600 }}
        >
          {expanded ? '접기 ▲' : '더보기 ▼'}
        </button>
      )}
    </div>
  );
}

/* ─── 커스텀 질문 결과 섹션 (아코디언) ─── */
function CustomQuestionsSection({ questions, responses, locked = false, onUnlock = null }) {
  const [expanded, setExpanded] = useState({});
  if (!questions?.length) return null;
  const allAnswers = (responses || []).flatMap(r => r.custom_answers || []);
  if (!allAnswers.length) return null;

  const toggle = key => setExpanded(prev => ({ ...prev, [key]: !prev[key] }));
  const typeLabelMap = { radio: '옵션형', scale: '점수형', text: '서술형' };
  const typeColorMap = { radio: 'var(--text-2)', scale: 'var(--text-2)', text: '#34C759' };
  const typeBg = { radio: 'rgba(16,54,125,0.12)', scale: 'rgba(99,102,241,0.15)', text: 'rgba(52,199,89,0.15)' };

  // 무료 체험 미언락: 질문(텍스트)은 공개, 응답(answer)만 잠금
  if (locked) {
    return (
      <div style={{ marginTop: 28, borderTop: '1px solid var(--border)', paddingTop: 20 }}>
        <div style={{ fontSize: 12, fontFamily: 'var(--font-sans)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>추가 질문 응답</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {questions.map((q, qi) => {
            const answers = allAnswers.filter(a => a.questionId === q.id);
            if (!answers.length) return null;
            return (
              <div key={q.id || qi} style={{ borderRadius: 'var(--radius)', border: '1px solid var(--border)', overflow: 'hidden' }}>
                {/* 질문 — 공개 */}
                <div style={{ display: 'flex', alignItems: 'center', padding: '12px 14px', background: 'var(--surface)', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, flexShrink: 0, background: typeBg[q.type] || typeBg.text, color: typeColorMap[q.type] || typeColorMap.text }}>
                      {typeLabelMap[q.type] || '서술'}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', lineHeight: 1.4 }}>
                      {qi + 1}. {q.text}
                    </span>
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--text-3)', flexShrink: 0 }}>응답 {answers.length}건</span>
                </div>
                {/* 응답 — 잠금 */}
                <div style={{ position: 'relative', borderTop: '1px solid var(--border)' }}>
                  <div style={{ filter: 'blur(6px)', userSelect: 'none', pointerEvents: 'none', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ height: 12, width: '80%', background: 'var(--bg-2)', borderRadius: 4 }} />
                    <div style={{ height: 12, width: '55%', background: 'var(--bg-2)', borderRadius: 4 }} />
                  </div>
                  <LockOverlay onUnlock={onUnlock} label="🔒 잠금 해제 후 응답 열람" />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 28, borderTop: '1px solid var(--border)', paddingTop: 20 }}>
      <div style={{ fontSize: 12, fontFamily: 'var(--font-sans)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>추가 질문 응답</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {questions.map((q, qi) => {
          const key = q.id || qi;
          const isOpen = !!expanded[key];
          const answers = allAnswers.filter(a => a.questionId === q.id).map(a => a.answer);
          if (!answers.length) return null;
          return (
            <div key={key} style={{ borderRadius: 'var(--radius)', border: '1px solid var(--border)', overflow: 'hidden' }}>
              <div
                onClick={() => toggle(key)}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: isOpen ? 'var(--surface-2)' : 'var(--surface)', cursor: 'pointer', userSelect: 'none', gap: 10 }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, flexShrink: 0, background: typeBg[q.type] || typeBg.text, color: typeColorMap[q.type] || typeColorMap.text }}>
                    {typeLabelMap[q.type] || '서술'}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', lineHeight: 1.4 }}>
                    {qi + 1}. {q.text}
                  </span>
                  {q.type === 'scale' && (() => {
                    const valid = answers.map(Number).filter(n => !isNaN(n) && n > 0);
                    const avg = valid.length ? (valid.reduce((s, v) => s + v, 0) / valid.length).toFixed(1) : null;
                    const num = parseFloat(avg);
                    const c = isNaN(num) ? 'var(--text-3)' : num >= 4 ? 'var(--green)' : num >= 3 ? 'var(--accent)' : 'var(--red)';
                    return avg ? (
                      <span style={{ fontSize: 12, fontWeight: 800, fontFamily: 'var(--font-sans)', padding: '2px 8px', borderRadius: 8, background: 'var(--surface-2)', border: `1px solid ${c}55`, color: c, flexShrink: 0 }}>
                        평균 {avg}점
                      </span>
                    ) : null;
                  })()}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-sans)' }}>{answers.length}개</span>
                  <span style={{ fontSize: 10, color: 'var(--text-3)', display: 'inline-block', transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▼</span>
                </div>
              </div>
              {isOpen && (
                <div style={{ padding: '14px', background: 'var(--surface)', borderTop: '1px solid var(--border)' }}>
                  {q.type === 'radio' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                      {(q.options || []).map(opt => {
                        const cnt = answers.filter(a => a === opt).length;
                        const pct = answers.length ? Math.round((cnt / answers.length) * 100) : 0;
                        return (
                          <div key={opt}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                              <span style={{ color: 'var(--text-2)' }}>{opt}</span>
                              <span style={{ fontFamily: 'var(--font-sans)', color: 'var(--text)', fontWeight: 700 }}>{pct}%</span>
                            </div>
                            <div style={{ height: 7, borderRadius: 4, background: 'var(--border)', overflow: 'hidden' }}>
                              <div style={{ width: `${pct}%`, height: '100%', background: 'var(--accent)', borderRadius: 4, transition: 'width 0.4s' }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {q.type === 'scale' && (() => {
                    const valid = answers.map(Number).filter(n => !isNaN(n) && n > 0);
                    const avg = valid.length ? (valid.reduce((s, v) => s + v, 0) / valid.length).toFixed(1) : null;
                    const num = parseFloat(avg);
                    const c = isNaN(num) ? 'var(--text-3)' : num >= 4 ? 'var(--green)' : num >= 3 ? 'var(--accent)' : 'var(--red)';
                    return (
                      <div style={{ display: 'flex', justifyContent: 'center' }}>
                        <div style={{ textAlign: 'center', padding: '16px 32px', background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', minWidth: 140 }}>
                          <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>점수형 평균</div>
                          <div style={{ fontSize: 28, fontWeight: 800, color: c, fontFamily: 'var(--font-sans)', lineHeight: 1 }}>{avg ?? '—'}</div>
                          {avg && <div style={{ marginTop: 8 }}><ScoreBar score={Math.round(num)} color={c} /></div>}
                        </div>
                      </div>
                    );
                  })()}
                  {q.type !== 'radio' && q.type !== 'scale' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {answers.map((a, i) => (
                        <div key={i} style={{ padding: '10px 12px', background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', fontSize: 13, color: 'var(--text-2)', lineHeight: 1.65 }}>
                          {a || <span style={{ fontStyle: 'italic', color: 'var(--text-3)' }}>내용 없음</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── 서브미션 결과: preference ─── */
function PreferenceResults({ responses, mission, panelProfiles, companyId, helpRatings, onRated }) {
  if (!responses?.length) return <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-3)', fontSize: 14 }}>응답 데이터가 없습니다.</div>;
  const aCount = responses.filter(r => r.preference === 'A').length;
  const bCount = responses.filter(r => r.preference === 'B').length;
  const parsedDesc = parseSubDesc(mission?.description, 'preference');
  const allTypedQs = parsedDesc.selectedQuestions || [
    ...(parsedDesc.templateQuestions || []),
    ...(parsedDesc.customQuestions || []).filter(Boolean).map(q =>
      typeof q === 'string' ? { id: q, text: q, type: 'text', options: [] } : q
    ),
  ];

  return (
    <div>
      {(parsedDesc.variantA || parsedDesc.variantAImage || parsedDesc.variantB || parsedDesc.variantBImage) && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 10, fontFamily: 'var(--font-sans)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>제출된 소재</div>
          <div className="form-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ padding: '12px 14px', background: 'var(--surface)', border: '2px solid var(--accent)', borderRadius: 'var(--radius)' }}>
              <div style={{ fontSize: 10, fontFamily: 'var(--font-sans)', color: 'var(--text-3)', marginBottom: 8, fontWeight: 700, textTransform: 'uppercase' }}>소재 A</div>
              {parsedDesc.variantAImage && <img src={parsedDesc.variantAImage} alt="소재 A" style={{ width: '100%', borderRadius: 6, marginBottom: 8, maxHeight: 160, objectFit: 'cover' }} />}
              {parsedDesc.variantA && <ExpandableText text={parsedDesc.variantA} />}
            </div>
            <div style={{ padding: '12px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
              <div style={{ fontSize: 10, fontFamily: 'var(--font-sans)', color: 'var(--text-3)', marginBottom: 8, fontWeight: 700, textTransform: 'uppercase' }}>소재 B</div>
              {parsedDesc.variantBImage && <img src={parsedDesc.variantBImage} alt="소재 B" style={{ width: '100%', borderRadius: 6, marginBottom: 8, maxHeight: 160, objectFit: 'cover' }} />}
              {parsedDesc.variantB && <ExpandableText text={parsedDesc.variantB} />}
            </div>
          </div>
        </div>
      )}
      {parsedDesc.productDescription && (
        <div style={{ padding: '10px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', marginBottom: 20 }}>
          <div style={{ fontSize: 10, fontFamily: 'var(--font-sans)', color: 'var(--text-3)', marginBottom: 4, textTransform: 'uppercase' }}>제품 설명</div>
          <ExpandableText text={parsedDesc.productDescription} />
        </div>
      )}
      <div style={{ marginBottom: 4, fontSize: 12, fontFamily: 'var(--font-sans)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>A/B 선호도 결과</div>
      <RatioBar aLabel="소재 A" bLabel="소재 B" aCount={aCount} bCount={bCount} aColor="var(--accent)" />
      <ScoreCardRow items={[
        { label: '메시지 명확성 평균', value: calcAvg(responses, 'message_clarity') },
        { label: '구매 전환 의향 평균', value: calcAvg(responses, 'purchase_intent') },
      ]} />
      <CustomQuestionsSection questions={allTypedQs} responses={responses} />
      <div style={{ marginTop: 28, borderTop: '1px solid var(--border)', paddingTop: 20 }}>
        <div style={{ fontSize: 12, fontFamily: 'var(--font-sans)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>총 평가 — 패널 코멘트</div>
        <CommentList items={responses.map((r, i) => ({
          label: <span>패널 #{i + 1} · 소재 {r.preference}<PanelBadges panelId={r.panel_id} profiles={panelProfiles} /></span>,
          actions: <HelpfulnessButtons refType="preference" refId={r.id} panelId={r.panel_id} companyId={companyId} helpRatings={helpRatings} onRated={onRated} />,
          text: r.comment,
        }))} />
      </div>
    </div>
  );
}

/* ─── 서브미션 결과: pricing ─── */
function PricingResults({ responses, mission, panelProfiles, companyId, helpRatings, onRated }) {
  if (!responses?.length) return <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-3)', fontSize: 14 }}>응답 데이터가 없습니다.</div>;
  const buyYes = responses.filter(r => r.would_buy === true).length;
  const buyNo  = responses.filter(r => r.would_buy === false).length;
  const parsedDesc = parseSubDesc(mission?.description, 'pricing');
  const allTypedQs = parsedDesc.selectedQuestions || [
    ...(parsedDesc.templateQuestions || []),
    ...(parsedDesc.customQuestions || []).filter(Boolean).map(q =>
      typeof q === 'string' ? { id: q, text: q, type: 'text', options: [] } : q
    ),
  ];

  return (
    <div>
      {(parsedDesc.content || parsedDesc.image) && (
        <div style={{ padding: '12px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', marginBottom: 20 }}>
          <div style={{ fontSize: 10, fontFamily: 'var(--font-sans)', color: 'var(--text-3)', marginBottom: 6, textTransform: 'uppercase' }}>가격 구성</div>
          {parsedDesc.image && <img src={parsedDesc.image} alt="가격" style={{ width: '100%', borderRadius: 'var(--radius)', marginBottom: 8, maxHeight: 200, objectFit: 'cover' }} />}
          {parsedDesc.content && <ExpandableText text={parsedDesc.content} />}
        </div>
      )}
      <div style={{ marginBottom: 4, fontSize: 12, fontFamily: 'var(--font-sans)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>구매 의향</div>
      <RatioBar aLabel="구매 의향 있음" bLabel="구매 의향 없음" aCount={buyYes} bCount={buyNo} aColor="var(--green)" />
      <ScoreCardRow items={[
        { label: '가격 적절성 평균', value: calcAvg(responses, 'price_fairness') },
        { label: '가격 대비 가치 평균', value: calcAvg(responses, 'value_perception') },
      ]} />
      <CustomQuestionsSection questions={allTypedQs} responses={responses} />
      <div style={{ marginTop: 28, borderTop: '1px solid var(--border)', paddingTop: 20 }}>
        <div style={{ fontSize: 12, fontFamily: 'var(--font-sans)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>총 평가 — 패널 코멘트</div>
        <CommentList items={responses.map((r, i) => ({
          label: <span>패널 #{i + 1}<PanelBadges panelId={r.panel_id} profiles={panelProfiles} /></span>,
          actions: <HelpfulnessButtons refType="pricing" refId={r.id} panelId={r.panel_id} companyId={companyId} helpRatings={helpRatings} onRated={onRated} />,
          text: r.key_comment,
        }))} />
      </div>
    </div>
  );
}

/* ─── 서브미션 결과: email ─── */
function EmailResults({ responses, mission, panelProfiles, companyId, helpRatings, onRated }) {
  if (!responses?.length) return <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-3)', fontSize: 14 }}>응답 데이터가 없습니다.</div>;
  const replyYes = responses.filter(r => r.would_reply === true).length;
  const replyNo  = responses.filter(r => r.would_reply === false).length;
  const parsedDesc = parseSubDesc(mission?.description, 'email');
  const emailGoal = resolveEmailGoal(parsedDesc);
  const allTypedQs = parsedDesc.selectedQuestions || [
    ...(parsedDesc.templateQuestions || []),
    ...(parsedDesc.customQuestions || []).filter(Boolean).map(q =>
      typeof q === 'string' ? { id: q, text: q, type: 'text', options: [] } : q
    ),
  ];

  return (
    <div>
      {parsedDesc.content && (
        <div style={{ padding: '12px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', marginBottom: 20 }}>
          <div style={{ fontSize: 10, fontFamily: 'var(--font-sans)', color: 'var(--text-3)', marginBottom: 8, textTransform: 'uppercase' }}>이메일 원문</div>
          <ExpandableText text={parsedDesc.content} limit={250} />
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, fontFamily: 'var(--font-sans)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>전환 목표</span>
        <Badge type="blue">{emailGoal.label}</Badge>
      </div>
      <div style={{ marginBottom: 4, fontSize: 12, fontFamily: 'var(--font-sans)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>목표 행동 의향</div>
      <RatioBar aLabel="그렇다" bLabel="아니다" aCount={replyYes} bCount={replyNo} aColor="var(--green)" />
      <ScoreCardRow items={[
        { label: '개봉 의향',    value: calcAvg(responses, 'open_intent') },
        { label: '훅 강도',      value: calcAvg(responses, 'hook_score') },
        { label: '메시지 명확성', value: calcAvg(responses, 'clarity_score') },
        { label: '호기심',       value: calcAvg(responses, 'curiosity_score') },
      ]} />
      <CustomQuestionsSection questions={allTypedQs} responses={responses} />
      <div style={{ marginTop: 28, borderTop: '1px solid var(--border)', paddingTop: 20 }}>
        <div style={{ fontSize: 12, fontFamily: 'var(--font-sans)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>총 평가 — 패널 코멘트</div>
        <CommentList items={responses.map((r, i) => ({
          label: <span>패널 #{i + 1}<PanelBadges panelId={r.panel_id} profiles={panelProfiles} /></span>,
          actions: <HelpfulnessButtons refType="email" refId={r.id} panelId={r.panel_id} companyId={companyId} helpRatings={helpRatings} onRated={onRated} />,
          text: r.comment,
        }))} />
      </div>
    </div>
  );
}

/* ─── 이미지 미션: 차원 탭 뷰 ─── */
/* ─── 무료 체험 잠금 오버레이 ─── */
function LockOverlay({ onUnlock, label = '🔒 잠금 해제 후 열람' }) {
  return (
    <div
      onClick={onUnlock}
      style={{
        position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(248,250,252,0.35)', borderRadius: 'var(--radius)',
        cursor: onUnlock ? 'pointer' : 'default',
      }}
    >
      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)', background: 'rgba(255,255,255,0.9)', padding: '4px 12px', borderRadius: 999, border: '1px solid var(--accent)' }}>
        {label}
      </span>
    </div>
  );
}

function DimTabView({ dim, imageUrls, currentImageIdx, setCurrentImageIdx, allAnnotations, panelProfiles, locked = false, unlockedPanelIds = null }) {
  const isAnnLocked = (panelId) => locked && unlockedPanelIds && !unlockedPanelIds.has(panelId);
  const [selectedAnnId, setSelectedAnnId] = useState(null);
  const [annPage, setAnnPage] = useState(1);
  const meta = DIM_META[dim];
  const imgAnns = allAnnotations.filter(a => a.dimension === dim && a.image_index === currentImageIdx);
  const allDimAnns = (() => {
    const base = allAnnotations.filter(a => a.dimension === dim);
    if (!locked || !unlockedPanelIds) return base;
    // 무료 체험: 잠금 해제된 코멘트를 앞 페이지로, 잠긴 코멘트는 뒷 페이지로 정렬 (궁금증 유발)
    return [...base].sort((a, b) => (isAnnLocked(a.panel_id) ? 1 : 0) - (isAnnLocked(b.panel_id) ? 1 : 0));
  })();
  const pagedAnns = allDimAnns.slice((annPage - 1) * PAGE_SIZE, annPage * PAGE_SIZE);

  // dim 변경 시 페이지 초기화
  const prevDim = useRef(dim);
  if (prevDim.current !== dim) { prevDim.current = dim; if (annPage !== 1) setAnnPage(1); }

  const handleAnnClick = (ann) => {
    const next = selectedAnnId === ann.id ? null : ann.id;
    setSelectedAnnId(next);
    if (next !== null) setCurrentImageIdx(ann.image_index);
  };

  return (
    <div className="dim-tab-layout">

      {/* ── 왼쪽: 이미지 (sticky 고정) ── */}
      <div className="dim-tab-left">
        {/* 이미지 탭 */}
        {imageUrls.length > 1 && (
          <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
            {imageUrls.map((_, i) => {
              const cnt = allAnnotations.filter(a => a.dimension === dim && a.image_index === i).length;
              return (
                <button key={i} onClick={() => { setCurrentImageIdx(i); setSelectedAnnId(null); }} style={{
                  padding: '5px 14px', borderRadius: 'var(--radius)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  border: `1.5px solid ${currentImageIdx === i ? 'var(--accent)' : 'var(--border)'}`,
                  background: currentImageIdx === i ? 'var(--accent)' : 'var(--surface)',
                  color: currentImageIdx === i ? '#fff' : 'var(--text-2)',
                }}>
                  이미지 {i + 1}
                  {cnt > 0 && <span style={{ marginLeft: 5, opacity: 0.8 }}>({cnt})</span>}
                </button>
              );
            })}
          </div>
        )}

        {/* 이미지 + 어노테이션 오버레이 */}
        <div style={{ border: `1px solid ${meta.color}44`, borderRadius: 'var(--radius-lg)', overflow: 'hidden', marginBottom: 10 }}>
          <ImageAnnotator
            imageUrl={imageUrls[currentImageIdx]}
            imageIndex={currentImageIdx}
            annotations={imgAnns.map(a => isAnnLocked(a.panel_id) ? { ...a, comment: '' } : a)}
            seqPool={allDimAnns}
            highlightedId={selectedAnnId}
            readonly
          />
        </div>

      </div>

      {/* ── 오른쪽: 코멘트 목록 ── */}
      <div className="dim-tab-right">
        {(() => {
          const scores = allDimAnns.map(a => a.score).filter(s => s != null && !isNaN(s));
          const avg = scores.length ? (scores.reduce((s, v) => s + v, 0) / scores.length).toFixed(1) : null;
          return (
            <div style={{ fontSize: 12, fontFamily: 'var(--font-sans)', color: 'var(--text-2)', marginBottom: 10, fontWeight: 600 }}>
              코멘트 {allDimAnns.length}개{avg ? <span style={{ marginLeft: 6 }}>· 평균 {avg}점</span> : null}
            </div>
          );
        })()}
        {allDimAnns.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-3)', fontSize: 13, background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
            이 차원에 남겨진 어노테이션이 없습니다.
          </div>
        ) : (
          <div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {pagedAnns.map((ann, i) => {
                const globalIdx = (annPage - 1) * PAGE_SIZE + i;
                const isActive = selectedAnnId === ann.id;
                return (
                  <div
                    key={ann.id}
                    onClick={() => handleAnnClick(ann)}
                    style={{
                      padding: '10px 12px', background: 'var(--surface)',
                      borderRadius: 'var(--radius)', cursor: 'pointer',
                      border: isActive ? `1.5px solid ${meta.color}` : '1px solid var(--border)',
                      borderLeft: `3px solid ${meta.color}`,
                      transition: 'all 0.15s',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: ann.comment ? 6 : 0, flexWrap: 'wrap' }}>
                      <span style={{ background: meta.color, color: '#fff', borderRadius: 4, padding: '2px 6px', fontSize: 11, fontWeight: 700 }}>
                        {globalIdx + 1}
                      </span>
                      <span style={{ fontSize: 12, color: 'var(--text-2)', fontFamily: 'var(--font-sans)', fontWeight: 700 }}>{ann.score}점</span>
                      <span style={{ fontSize: 11, color: 'var(--text-3)' }}>이미지 {ann.image_index + 1}</span>
                      <PanelBadges panelId={ann.panel_id} profiles={panelProfiles} />
                    </div>
                    {ann.comment
                      ? (isAnnLocked(ann.panel_id)
                          ? <div style={{ position: 'relative' }}>
                              <div style={{ filter: 'blur(5px)', userSelect: 'none', pointerEvents: 'none' }}><TruncatedComment text={ann.comment} /></div>
                              <LockOverlay />
                            </div>
                          : <TruncatedComment text={ann.comment} />)
                      : <div style={{ fontSize: 12, color: 'var(--text-3)', fontStyle: 'italic' }}>코멘트 없음</div>
                    }
                  </div>
                );
              })}
            </div>
            <Pagination page={annPage} total={allDimAnns.length} onPage={setAnnPage} />
          </div>
        )}
      </div>

    </div>
  );
}

/* ─── 이미지 미션: 종합 탭 ─── */
function SummaryTabView({ feedbacks, panelProfiles, mission, companyId, helpRatings, onRated, locked = false, unlockedPanelIds = null, onUnlock = null }) {
  const [commentPage, setCommentPage] = useState(1);
  const isPanelLocked = (panelId) => locked && unlockedPanelIds && !unlockedPanelIds.has(panelId);
  const radarData = DIMS.map(dim => {
    const key = DIM_META[dim].key;
    const val = calcAvg(feedbacks, key);
    return { label: DIM_META[dim].label, value: val ? parseFloat(val) : 0 };
  });

  const overallComments = feedbacks
    .map((fb, i) => ({ panel: i + 1, panelId: fb.panel_id, fbId: fb.id, text: extractOverallComment(fb.suggestions), passed: fb.purity_passed }))
    .filter(c => c.text);
  if (locked && unlockedPanelIds) {
    // 무료 체험: 공개 총평을 앞 페이지로, 잠긴 총평은 뒷 페이지로 정렬 (궁금증 유발)
    overallComments.sort((a, b) => (isPanelLocked(a.panelId) ? 1 : 0) - (isPanelLocked(b.panelId) ? 1 : 0));
    // 정렬 후 표시 순서대로 패널 번호 재부여 (#1 #3 #2 처럼 비연속으로 보이지 않도록)
    overallComments.forEach((c, idx) => { c.panel = idx + 1; });
  }
  const pagedComments = overallComments.slice((commentPage - 1) * PAGE_SIZE, commentPage * PAGE_SIZE);

  return (
    <div>
      {/* 5대 지표 평균 점수 카드 */}
      <div style={{ fontSize: 12, fontFamily: 'var(--font-sans)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>5대 지표 평균 점수</div>
      <div className="score-five-col" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 24 }}>
        {DIMS.map(dim => {
          const key = DIM_META[dim].key;
          const val = calcAvg(feedbacks, key);
          const num = parseFloat(val);
          const c = isNaN(num) || !val ? 'var(--text-3)' : num >= 4 ? 'var(--green)' : num >= 3 ? 'var(--accent)' : 'var(--red)';
          return (
            <Card key={dim} style={{ padding: '16px', textAlign: 'center' }}>
              <div style={{ fontSize: 10, fontFamily: 'var(--font-sans)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{DIM_META[dim].label}</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: c, fontFamily: 'var(--font-sans)', lineHeight: 1 }}>{val ?? '—'}</div>
              {val && <div style={{ marginTop: 8 }}><ScoreBar score={Math.round(num)} color={c} /></div>}
            </Card>
          );
        })}
      </div>

      {/* 레이더 차트 */}
      {radarData.some(d => d.value > 0) && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 12, fontFamily: 'var(--font-sans)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>방사형 차트</div>
          <div style={{ height: 260, background: 'var(--surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', padding: '16px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData}>
                <PolarGrid stroke="var(--border)" />
                <PolarAngleAxis dataKey="label" tick={{ fontSize: 12, fill: 'var(--text-2)' }} />
                <PolarRadiusAxis angle={90} domain={[0, 5]} tick={false} axisLine={false} />
                <Radar name="평균" dataKey="value" stroke="var(--accent)" fill="var(--accent)" fillOpacity={0.25} strokeWidth={2} />
                <Tooltip formatter={(v) => [`${Number(v).toFixed(1)}점`, '평균']} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* LP 추가 질문 집계 */}
      {(() => {
        const { selectedQuestions: lpQs } = parseLPDesc(mission?.description);
        if (!lpQs.length) return null;
        return (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '24px 0 16px' }}>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              <span style={{ fontSize: 11, fontFamily: 'var(--font-sans)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>추가 질문 집계</span>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            </div>
            <CustomQuestionsSection questions={lpQs} responses={feedbacks} locked={locked} onUnlock={onUnlock} />
          </>
        );
      })()}

      {/* 총평 목록 */}
      <div style={{ fontSize: 12, fontFamily: 'var(--font-sans)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12, marginTop: 28 }}>
        패널 총평 ({overallComments.length}개)
      </div>
      {overallComments.length === 0 ? (
        <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-3)', fontSize: 13, background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
          총평 데이터가 없습니다.
        </div>
      ) : (
        <div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {pagedComments.map(({ panel, panelId, fbId, text, passed }) => {
              const cLocked = isPanelLocked(panelId);
              const cCredit = getCareerUnlockCredit(panelProfiles[panelId]?.experience || '');
              return (
              <div key={panel} style={{ padding: '14px 16px', background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12, fontWeight: 600 }}>패널 #{panel}</span>
                    <PanelBadges panelId={panelId} profiles={panelProfiles} />
                    {passed && <Badge type="green">Purit 통과</Badge>}
                    {cLocked && (
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', background: 'var(--accent-dim, rgba(16,54,125,0.08))', padding: '2px 8px', borderRadius: 999, border: '1px solid var(--accent)' }}>
                        🔒 {cCredit}크레딧
                      </span>
                    )}
                  </div>
                  {!cLocked && (
                    <div style={{ flexShrink: 0 }}>
                      <HelpfulnessButtons refType="feedback" refId={fbId} panelId={panelId} companyId={companyId} helpRatings={helpRatings} onRated={onRated} />
                    </div>
                  )}
                </div>
                {cLocked ? (
                  <div style={{ position: 'relative' }}>
                    <div style={{ filter: 'blur(5px)', userSelect: 'none', pointerEvents: 'none', fontSize: 14, color: 'var(--text)', lineHeight: 1.75, fontWeight: 500 }}>{text}</div>
                    <LockOverlay onUnlock={onUnlock} label={`🔒 ${cCredit}크레딧으로 잠금 해제`} />
                  </div>
                ) : (
                  <div style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.75, fontWeight: 500 }}>{text}</div>
                )}
              </div>
              );
            })}
          </div>
          <Pagination page={commentPage} total={overallComments.length} onPage={setCommentPage} />
        </div>
      )}
    </div>
  );
}

/* ─── 텍스트 미션 결과 (이미지 없는 구형 미션) ─── */
function TextMissionResults({ feedbacks, panelProfiles, mission, companyId, helpRatings, onRated, locked = false, unlockedPanelIds = null, onUnlock = null }) {
  const isPanelLocked = (panelId) => locked && unlockedPanelIds && !unlockedPanelIds.has(panelId);
  // 무료 체험: 공개 패널을 앞으로, 잠긴 패널은 뒤로 정렬 (궁금증 유발)
  const orderedFeedbacks = (locked && unlockedPanelIds)
    ? [...feedbacks].sort((a, b) => (isPanelLocked(a.panel_id) ? 1 : 0) - (isPanelLocked(b.panel_id) ? 1 : 0))
    : feedbacks;
  const [activeFb, setActiveFb] = useState(orderedFeedbacks[0]?.id || null);
  const [panelPage, setPanelPage] = useState(1);
  const fb = orderedFeedbacks.find(f => f.id === activeFb) || null;
  const pagedFeedbacks = orderedFeedbacks.slice((panelPage - 1) * PAGE_SIZE, panelPage * PAGE_SIZE);

  return (
    <div>
    <div className="results-layout" style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 16 }}>
      {/* 패널 목록 */}
      <div>
        <div style={{ fontSize: 11, fontFamily: 'var(--font-sans)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>패널 피드백 ({feedbacks.length})</div>
        {pagedFeedbacks.map((f, i) => {
          const globalIdx = (panelPage - 1) * PAGE_SIZE + i;
          const overallAvg = DIMS.reduce((s, d) => s + (f[DIM_META[d].key] || 0), 0) / DIMS.length;
          const pLocked = isPanelLocked(f.panel_id);
          return (
            <div key={f.id} onClick={() => setActiveFb(f.id)} style={{
              padding: '12px', background: activeFb === f.id ? 'var(--surface-2)' : 'var(--surface)',
              borderRadius: 'var(--radius)', border: `1px solid ${activeFb === f.id ? 'var(--border-light)' : 'var(--border)'}`,
              cursor: 'pointer', marginBottom: 6, transition: 'all 0.15s',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>패널 #{globalIdx + 1}</span>
                  <PanelBadges panelId={f.panel_id} profiles={panelProfiles} />
                  {pLocked && <span style={{ fontSize: 11 }}>🔒</span>}
                </div>
                <Badge type={f.purity_passed ? 'green' : 'gray'}>{f.purity_passed ? '통과' : '검토 중'}</Badge>
              </div>
              <div style={pLocked ? { filter: 'blur(4px)', userSelect: 'none', pointerEvents: 'none' } : undefined}>
                <ScoreBar score={Math.round(overallAvg)} />
              </div>
            </div>
          );
        })}
        <Pagination page={panelPage} total={feedbacks.length} onPage={setPanelPage} />
      </div>

      {/* 상세 */}
      {fb && (
        isPanelLocked(fb.panel_id) ? (
          <Card style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>피드백 상세</div>
              <Badge type="green">Purit 통과</Badge>
            </div>
            <div style={{ position: 'relative' }}>
              <div style={{ filter: 'blur(6px)', userSelect: 'none', pointerEvents: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {DIMS.map(dim => {
                  const score = fb[DIM_META[dim].key] || 0;
                  return (
                    <div key={dim} style={{ padding: '14px', background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <span style={{ fontSize: 12, fontFamily: 'var(--font-sans)', color: 'var(--text-2)', textTransform: 'uppercase' }}>{DIM_META[dim].label}</span>
                        <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--accent)', fontFamily: 'var(--font-sans)' }}>{score || '—'}</span>
                      </div>
                      {score > 0 && <ScoreBar score={score} color="var(--accent)" />}
                    </div>
                  );
                })}
              </div>
              <LockOverlay onUnlock={onUnlock} label={`🔒 ${getCareerUnlockCredit(panelProfiles[fb.panel_id]?.experience || '')}크레딧으로 잠금 해제`} />
            </div>
          </Card>
        ) : fb.purity_passed ? (
          <Card style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>피드백 상세</div>
              <Badge type="green">Purit 통과</Badge>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {DIMS.map(dim => {
                const score = fb[DIM_META[dim].key] || 0;
                const c = score >= 4 ? 'var(--green)' : score >= 3 ? 'var(--accent)' : 'var(--red)';
                return (
                  <div key={dim} style={{ padding: '14px', background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontSize: 12, fontFamily: 'var(--font-sans)', color: 'var(--text-2)', textTransform: 'uppercase' }}>{DIM_META[dim].label}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 18, fontWeight: 800, color: c, fontFamily: 'var(--font-sans)' }}>{score || '—'}</span>
                        {score > 0 && <span style={{ fontSize: 12, color: 'var(--text-3)' }}>/5</span>}
                      </div>
                    </div>
                    {score > 0 && <ScoreBar score={score} color={c} />}
                  </div>
                );
              })}
              {fb.suggestions && (
                <div style={{ padding: '14px', background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ fontSize: 11, fontFamily: 'var(--font-sans)', color: 'var(--text-3)', textTransform: 'uppercase' }}>개선 제안</div>
                    <HelpfulnessButtons refType="feedback" refId={fb.id} panelId={fb.panel_id} companyId={companyId} helpRatings={helpRatings} onRated={onRated} />
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.7, whiteSpace: 'pre-line' }}>{fb.suggestions}</p>
                </div>
              )}
            </div>
          </Card>
        ) : (
          <Card style={{ padding: '48px 28px', textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🔍</div>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>검토 중인 피드백입니다</div>
            <p style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.7, maxWidth: 300, margin: '0 auto' }}>
              어드민의 Purity Filter 승인 후 피드백 상세를 확인할 수 있습니다.
            </p>
          </Card>
        )
      )}
    </div>
    {/* LP 추가 질문 집계 */}
    {(() => {
      const { selectedQuestions: lpQs } = parseLPDesc(mission?.description);
      if (!lpQs.length) return null;
      return (
        <div style={{ marginTop: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            <span style={{ fontSize: 11, fontFamily: 'var(--font-sans)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>추가 질문 집계</span>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          </div>
          <CustomQuestionsSection questions={lpQs} responses={feedbacks} locked={locked} onUnlock={onUnlock} />
        </div>
      );
    })()}
  </div>
  );
}

/* ══════════════════════════════════════════
   메인 컴포넌트
══════════════════════════════════════════ */
export default function Results() {
  const [searchParams] = useSearchParams();
  const [missions, setMissions]           = useState([]);
  const [selected, setSelected]           = useState(null);
  const [feedbacks, setFeedbacks]         = useState([]);
  const [allAnnotations, setAllAnnotations] = useState([]);
  const [subResponses, setSubResponses]   = useState(null);
  const [activeDimTab, setActiveDimTab]   = useState('clarity');
  const [currentImageIdx, setCurrentImageIdx] = useState(0);
  const [loading, setLoading]             = useState(true);
  const [fbLoading, setFbLoading]         = useState(false);
  const [shareToken, setShareToken]       = useState(null);
  const [shareLoading, setShareLoading]   = useState(false);
  const [shareCopied, setShareCopied]     = useState(false);
  const [shareError, setShareError]       = useState('');
  const [sharePermissions, setSharePermissions] = useState({ show_comments: true, show_annotations: true });
  const [panelProfiles, setPanelProfiles] = useState({});
  const [companyId, setCompanyId]         = useState(null);
  const [helpRatings, setHelpRatings]     = useState({});
  const [ratingInFlight, setRatingInFlight] = useState(new Set());
  const [mainPage, setMainPage]           = useState(1);
  const [subPage, setSubPage]             = useState(1);
  const [missionKind, setMissionKind]     = useState('all');
  const [missionTab, setMissionTab]       = useState('all');
  const [period, setPeriod]               = useState('all');
  const [creditBalance, setCreditBalance] = useState(0);
  const [showUnlockPay, setShowUnlockPay] = useState(false);
  const [unlocking, setUnlocking]         = useState(false);
  const [unlockError, setUnlockError]     = useState('');
  const [nowTick, setNowTick]             = useState(Date.now()); // 할인 카운트다운 1초 틱

  // 미션 목록 로드
  useEffect(() => {
    async function load() {
      try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const { company: co } = await resolveCompany(user.id);
      if (!co) { setLoading(false); return; }
      setCompanyId(co.id);
      setCreditBalance(co.credit_balance ?? 0);
      // completed는 전부 표시, cancelled는 어드민이 완료 처리(company_notified_at SET)한 경우만 표시
      // dismissed=true 의뢰는 기업 포털에서 숨김 처리
      const { data: ms } = await supabase.from('missions').select('*').eq('company_id', co.id)
        .or('status.eq.completed,and(status.eq.cancelled,company_notified_at.not.is.null)')
        .eq('dismissed', false)
        .order('created_at', { ascending: false });
      setMissions(ms || []);
      if (ms?.length > 0) {
        const paramId = searchParams.get('id');
        const initialMission = paramId ? ms.find(m => m.id === paramId) : null;
        const target = initialMission || ms[0];
        setSelected(target.id);
        setShareToken(target.share_token || null);
        setSharePermissions(target.share_permissions || { show_comments: true, show_annotations: true });
        if (target.status === 'cancelled') setMissionTab('cancelled');
        // 초기 선택 미션이 속한 페이지로 이동
        const mains = ms.filter(m => !m.type || m.type === 'landing_page');
        const subs  = ms.filter(m => ['preference', 'pricing', 'email'].includes(m.type));
        const mIdx = mains.findIndex(m => m.id === target.id);
        if (mIdx >= 0) setMainPage(Math.floor(mIdx / PAGE_SIZE) + 1);
        const sIdx = subs.findIndex(m => m.id === target.id);
        if (sIdx >= 0) setSubPage(Math.floor(sIdx / PAGE_SIZE) + 1);
      }
      setLoading(false);
      } catch (err) {
        console.error('[CompanyResults load]', err);
        setLoading(false);
      }
    }
    load();
  }, []);

  // 선택 미션 변경 시 데이터 로드
  useEffect(() => {
    if (!selected) return;
    setFbLoading(true);
    setAllAnnotations([]);
    setSubResponses(null);
    setPanelProfiles({});
    setHelpRatings({});
    setActiveDimTab('clarity');
    setCurrentImageIdx(0);

    const m = missions.find(mx => mx.id === selected);
    setShareToken(m?.share_token || null);
    setSharePermissions(m?.share_permissions || { show_comments: true, show_annotations: true });
    const mType = m?.type;
    const hasImgs = Array.isArray(m?.image_urls) && m.image_urls.length > 0;

    async function loadFeedback() {
      try {
      // completed / cancelled: 승인된(purity_passed=true) 피드백만 표시
      // 무료 체험은 서버 마스킹 RPC 경유 — 잠긴 패널 텍스트(코멘트·총평·추가질문 응답)가
      // 클라로 내려오지 않도록 서버에서 차단 (페이월 서버 차단, 니체-TRIAL-페이월)
      let fbs = [];
      let trialAnns = null;
      if (m?.is_free_trial) {
        const { data: tr } = await supabase.rpc('get_company_trial_feedbacks', { p_mission_id: selected });
        fbs = tr?.feedbacks || [];
        trialAnns = tr?.annotations || [];
      } else {
        const { data } = await supabase
          .from('feedbacks')
          .select('*')
          .eq('mission_id', selected)
          .eq('purity_passed', true)
          .order('created_at', { ascending: false });
        fbs = data || [];
      }
      setFeedbacks(fbs);

      // 무료 체험 미언락 미션을 처음 열면 할인 48h 앵커(trial_results_seen_at) 세팅 (멱등 — NULL일 때만 NOW())
      if (m?.is_free_trial && !m?.trial_unlocked && !m?.trial_results_seen_at) {
        supabase.rpc('touch_trial_results_seen', { p_mission_id: selected }).then(({ data: seenRes }) => {
          if (seenRes?.success && seenRes.seen_at) {
            setMissions(ms => ms.map(mx => mx.id === selected ? { ...mx, trial_results_seen_at: seenRes.seen_at } : mx));
          }
        });
      }

      const approvedPanelIds = (fbs || []).map(f => f.panel_id).filter(Boolean);

      const { data: ppRows } = await supabase.rpc('get_panel_public_profiles', { p_mission_id: selected });
      if (ppRows) {
        const map = {};
        ppRows.forEach(r => { map[r.panel_id] = { industry: r.industry, experience: r.experience, is_expert: r.is_expert }; });
        setPanelProfiles(map);
      }

      if (hasImgs && !['preference', 'pricing', 'email'].includes(mType)) {
        if (m?.is_free_trial) {
          // 무료 체험: 위 RPC가 잠긴 패널 comment 까지 마스킹해 반환 (직접 쿼리 금지 — 페이월 우회 방지)
          setAllAnnotations(trialAnns || []);
        } else {
          const { data: anns } = await supabase
            .from('feedback_annotations')
            .select('*')
            .eq('mission_id', selected)
            .in('panel_id', approvedPanelIds.length > 0 ? approvedPanelIds : ['none'])
            .order('created_at');
          setAllAnnotations(anns || []);
        }
      }


      let subData = null;
      if (approvedPanelIds.length > 0) {
        if (mType === 'preference') {
          const { data } = await supabase.from('preference_responses').select('*').eq('mission_id', selected).in('panel_id', approvedPanelIds);
          subData = data || [];
          setSubResponses(subData);
        } else if (mType === 'pricing') {
          const { data } = await supabase.from('pricing_responses').select('*').eq('mission_id', selected).in('panel_id', approvedPanelIds);
          subData = data || [];
          setSubResponses(subData);
        } else if (mType === 'email') {
          const { data } = await supabase.from('email_responses').select('*').eq('mission_id', selected).in('panel_id', approvedPanelIds);
          subData = data || [];
          setSubResponses(subData);
        }
      } else if (['preference', 'pricing', 'email'].includes(mType)) {
        setSubResponses([]);
      }

      // helpfulness ratings 배치 로드
      const currentCompanyId = companyId;
      if (currentCompanyId && approvedPanelIds.length > 0) {
        const annsData = hasImgs && !['preference', 'pricing', 'email'].includes(mType)
          ? (await supabase.from('feedback_annotations').select('id').eq('mission_id', selected).in('panel_id', approvedPanelIds)).data || []
          : [];
        const allRefIds = [
          ...(fbs || []).map(f => f.id),
          ...annsData.map(a => a.id),
          ...(subData || []).map(r => r.id),
        ].filter(Boolean);

        if (allRefIds.length > 0) {
          const { data: existingRatings } = await supabase
            .from('feedback_helpfulness_ratings')
            .select('ref_type, ref_id, is_helpful')
            .eq('company_id', currentCompanyId)
            .in('ref_id', allRefIds);

          const rMap = {};
          (existingRatings || []).forEach(r => {
            rMap[`${r.ref_type}:${r.ref_id}`] = r.is_helpful ? 'helpful' : 'unhelpful';
          });
          setHelpRatings(rMap);
        }
      }

      } catch (err) {
        console.error('[loadFeedback error]', err);
      } finally {
        setFbLoading(false);
      }
    }
    loadFeedback();
  }, [selected, companyId]);

  // 도움 됨/안 됨 평가 핸들러
  const handleRate = async (refType, refId, panelId, value) => {
    if (!companyId || !refId) return;
    const key = `${refType}:${refId}`;
    if (ratingInFlight.has(key)) return;

    const prevRatings = helpRatings;
    const isHelpful  = value === 'helpful';
    const wasValue   = helpRatings[key];
    const newValue   = wasValue === value ? null : value;

    setHelpRatings(r => ({ ...r, [key]: newValue }));
    setRatingInFlight(s => new Set([...s, key]));

    const { error } = await supabase.rpc('rate_panel_feedback_helpfulness', {
      p_company_id: companyId,
      p_panel_id:   panelId,
      p_ref_type:   refType,
      p_ref_id:     refId,
      p_is_helpful: isHelpful,
    });

    if (error) {
      setHelpRatings(prevRatings);
      console.error('[rate_panel_feedback_helpfulness]', error.message);
    } else if (isHelpful && panelId) {
      supabase.rpc('check_and_award_badges', { p_panel_id: panelId })
        .then(({ error: bErr }) => { if (bErr) console.warn('[check_and_award_badges]', bErr.message); });
    }

    setRatingInFlight(s => { const n = new Set(s); n.delete(key); return n; });
  };

  // 공유 링크 핸들러
  const handleGenerateShare = async () => {
    if (!selected) return;
    setShareLoading(true);
    setShareError('');
    const token = crypto.randomUUID().replace(/-/g, '');
    const { error } = await supabase.from('missions').update({ share_token: token, share_permissions: sharePermissions }).eq('id', selected);
    if (!error) {
      setShareToken(token);
      setMissions(ms => ms.map(m => m.id === selected ? { ...m, share_token: token, share_permissions: sharePermissions } : m));
    } else {
      setShareError('공유 링크 생성 실패: ' + error.message);
    }
    setShareLoading(false);
  };

  const handleCopyShare = () => {
    const url = `${window.location.origin}/share/${shareToken}`;
    navigator.clipboard.writeText(url).then(() => {
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    });
  };

  const handleRevokeShare = async () => {
    if (!selected) return;
    setShareError('');
    const { error } = await supabase.from('missions').update({ share_token: null }).eq('id', selected);
    if (error) {
      setShareError('공유 해제 실패: ' + error.message);
      return;
    }
    setShareToken(null);
    setMissions(ms => ms.map(m => m.id === selected ? { ...m, share_token: null } : m));
  };

  const handlePermissionToggle = async (key) => {
    const prev = sharePermissions;
    const next = { ...sharePermissions, [key]: !sharePermissions[key] };
    setSharePermissions(next);
    if (shareToken) {
      const { error } = await supabase.from('missions').update({ share_permissions: next }).eq('id', selected);
      if (error) {
        setSharePermissions(prev);
        setShareError('권한 저장 실패: ' + error.message);
      } else {
        setMissions(ms => ms.map(m => m.id === selected ? { ...m, share_permissions: next } : m));
      }
    }
  };

  // 할인 카운트다운 1초 틱 — 무료 체험 미언락 미션 열람 중일 때만 (조기 return 앞 = Rules of Hooks 준수)
  useEffect(() => {
    const m = missions.find(mx => mx.id === selected);
    if (!m?.is_free_trial || m?.trial_unlocked) return;
    const endMs = m.trial_results_seen_at
      ? new Date(m.trial_results_seen_at).getTime() + TRIAL_UNLOCK_DISCOUNT_WINDOW_HOURS * 3600 * 1000
      : null;
    const t = setInterval(() => {
      setNowTick(Date.now());
      if (endMs !== null && Date.now() >= endMs) clearInterval(t); // 마감 후 틱 중단
    }, 1000);
    return () => clearInterval(t);
  }, [selected, missions]);

  if (loading) return (
    <div style={{ padding: '40px 48px', color: 'var(--text-3)', fontSize: 14 }}>불러오는 중...</div>
  );

  const mission = missions.find(m => m.id === selected) || null;
  const isSubMission  = mission && ['preference', 'pricing', 'email'].includes(mission.type);
  const hasImages     = mission && Array.isArray(mission.image_urls) && mission.image_urls.length > 0 && !isSubMission;

  // 무료 체험 부분 잠금: 미언락이면 호평(점수 상위) 2명만 상세 공개(점수 집계는 전체 공개)
  const trialLocked = !!mission?.is_free_trial && !mission?.trial_unlocked;
  // 패널별 평균 점수(5축) — 공개 선별 정렬·티저 집계용. 서버 AVG((coalesce..)/5.0)와 동일 공식 (D-121)
  const panelAvgScore = (() => {
    const acc = {};
    feedbacks.forEach(f => {
      if (!f.panel_id) return;
      const s = ((f.clarity_score || 0) + (f.relevance_score || 0) + (f.value_score || 0)
                 + (f.differentiation_score || 0) + (f.trust_score || 0)) / 5;
      (acc[f.panel_id] ||= []).push(s);
    });
    const out = {};
    Object.entries(acc).forEach(([pid, arr]) => { out[pid] = arr.reduce((a, b) => a + b, 0) / arr.length; });
    return out;
  })();
  const unlockedPanelIds = (() => {
    const ids = [...new Set(feedbacks.map(f => f.panel_id).filter(Boolean))];
    if (!trialLocked) return new Set(ids);
    // 어드민이 공개 패널을 직접 지정했으면 그 값을 우선 사용 (없으면 점수 상위 2명 자동 선별)
    const adminPublic = mission?.trial_public_panel_ids;
    if (Array.isArray(adminPublic) && adminPublic.length > 0) return new Set(adminPublic);
    // 공개 = 호평 상위 2명. 정렬: 평균점수 DESC, panel_id ASC tiebreaker (서버 ROW_NUMBER와 1:1 정합)
    const sorted = [...ids].sort((a, b) => {
      const sa = panelAvgScore[a] ?? 0, sb = panelAvgScore[b] ?? 0;
      if (sb !== sa) return sb - sa;
      return a < b ? -1 : 1;
    });
    return new Set(sorted.slice(0, 2));
  })();
  // 언락 정가 = 잠긴 패널(공개 2명 제외)의 경력 크레딧 합 (실제 참여 경력 기준)
  const lockedPanelIds = [...new Set(feedbacks.map(f => f.panel_id).filter(Boolean))].filter(pid => !unlockedPanelIds.has(pid));
  const unlockBaseCost = lockedPanelIds.reduce((s, pid) => s + getCareerUnlockCredit(panelProfiles[pid]?.experience || ''), 0);

  // 30% 첫 언락 할인 + 48h 마감 — 결과 최초 열람(trial_results_seen_at)부터 카운트다운
  const seenAtMs = mission?.trial_results_seen_at ? new Date(mission.trial_results_seen_at).getTime() : null;
  const discountEndMs = seenAtMs ? seenAtMs + TRIAL_UNLOCK_DISCOUNT_WINDOW_HOURS * 3600 * 1000 : null;
  const withinDiscount = trialLocked && (discountEndMs === null || nowTick < discountEndMs);
  const unlockCost = applyUnlockDiscount(unlockBaseCost, withinDiscount); // 표시가 = 서버 결제가 (D-121)
  const discountRemainMs = discountEndMs ? Math.max(0, discountEndMs - nowTick) : null;

  // 잠긴 쪽 티저 — 잠긴 패널 중 "치명적 지적"(어느 한 축이라도 ≤2점) 수 + 가장 약한 축
  const trialTeaser = (() => {
    if (!trialLocked || lockedPanelIds.length === 0) return null;
    let criticalCount = 0;
    const axisSum = { clarity_score: 0, relevance_score: 0, value_score: 0, differentiation_score: 0, trust_score: 0 };
    let axisN = 0;
    lockedPanelIds.forEach(pid => {
      const fbs = feedbacks.filter(f => f.panel_id === pid);
      const isCritical = fbs.some(f => Math.min(
        f.clarity_score ?? 5, f.relevance_score ?? 5, f.value_score ?? 5,
        f.differentiation_score ?? 5, f.trust_score ?? 5,
      ) <= 2);
      if (isCritical) criticalCount++;
      fbs.forEach(f => {
        DIMS.forEach(d => { const k = DIM_META[d].key; if (f[k] != null) axisSum[k] += f[k]; });
        axisN++;
      });
    });
    let weakest = null, weakestAvg = Infinity;
    if (axisN > 0) DIMS.forEach(d => {
      const avg = axisSum[DIM_META[d].key] / axisN;
      if (avg < weakestAvg) { weakestAvg = avg; weakest = DIM_META[d].label; }
    });
    return { criticalCount, lockedCount: lockedPanelIds.length, weakestAxis: weakest };
  })();

  const handleUnlock = async () => {
    if (!mission) return;
    setUnlocking(true); setUnlockError('');
    try {
      const { data, error } = await supabase.rpc('unlock_free_trial_mission', { p_mission_id: mission.id });
      if (error) throw error;
      if (data?.success) {
        setMissions(ms => ms.map(m => m.id === mission.id ? { ...m, trial_unlocked: true } : m));
        if (typeof data.new_balance === 'number') setCreditBalance(data.new_balance);
        setShowUnlockPay(false);
      } else if (data?.error === 'INSUFFICIENT_CREDITS') {
        setUnlockError('크레딧이 부족합니다. 충전 후 잠금을 해제하세요.');
        setShowUnlockPay(true);
      } else {
        setUnlockError('잠금 해제 중 오류가 발생했습니다.');
      }
    } catch (e) {
      setUnlockError(e.message || '잠금 해제에 실패했습니다.');
    } finally {
      setUnlocking(false);
    }
  };

  // 기간 필터 — 의뢰 등록일(mission.created_at) 기준으로 미션 목록 필터링
  const cutoff = period === 'all' ? null : new Date(Date.now() - (period === '3m' ? 90 : 30) * 86400000);
  const periodMissions = cutoff ? missions.filter(m => new Date(m.created_at) >= cutoff) : missions;

  const tabFiltered   = missionTab === 'all' ? periodMissions : periodMissions.filter(m => m.status === missionTab);
  const mainMissions  = tabFiltered.filter(m => !m.type || m.type === 'landing_page');
  const subMissions   = tabFiltered.filter(m => ['preference', 'pricing', 'email'].includes(m.type));
  const pagedMain     = mainMissions.slice((mainPage - 1) * PAGE_SIZE, mainPage * PAGE_SIZE);
  const pagedSub      = subMissions.slice((subPage - 1) * PAGE_SIZE, subPage * PAGE_SIZE);

  const handleMissionTab = (tab) => {
    setMissionTab(tab);
    setMainPage(1);
    setSubPage(1);
    setSelected(null);
  };

  const DIM_TABS = [...DIMS, 'summary'];

  return (
    <div className="page-wrap" style={{ padding: '40px 48px', maxWidth: 1360, animation: 'fadeUp 0.5s ease both' }}>
      {/* 헤더 */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 12, fontFamily: 'var(--font-sans)', color: 'var(--text-2)', marginBottom: 8, letterSpacing: '0.1em' }}>FEEDBACK RESULTS</div>
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 4 }}>피드백 결과</h1>
      </div>

      <div className="results-layout" style={{ display: 'grid', gridTemplateColumns: '230px 1fr', gap: 20, alignItems: 'flex-start' }}>

        {/* 좌측: 미션 선택 패널 */}
        <div className="results-sidebar" style={{ position: 'sticky', top: 24 }}>
          {/* 기간 필터 */}
          <SegmentFilter
            value={period}
            onChange={(val) => { setPeriod(val); setMainPage(1); setSubPage(1); setSelected(null); }}
            tabs={[{ key: 'all', label: '전체' }, { key: '3m', label: '3개월' }, { key: '1m', label: '1개월' }]}
            style={{ marginBottom: 10 }}
          />
          {/* 탭 필터 */}
          <StatusTabs
            value={missionTab}
            onChange={handleMissionTab}
            tabs={[
              { key: 'all', label: '전체' },
              { key: 'completed', label: '완료' },
              { key: 'cancelled', label: '취소' },
            ]}
            style={{ marginBottom: 14 }}
          />

            {(mainMissions.length > 0 || subMissions.length > 0) && (
              <SegmentFilter
                value={missionKind}
                onChange={setMissionKind}
                tabs={[
                  { key: 'all', label: '전체', count: mainMissions.length + subMissions.length },
                  { key: 'main', label: '메인 의뢰', count: mainMissions.length },
                  { key: 'sub', label: '서브 의뢰', count: subMissions.length },
                ]}
                style={{ marginBottom: 16 }}
              />
            )}
            {(mainMissions.length > 0 || subMissions.length > 0) && (missionKind === 'main' || missionKind === 'all') && (
              mainMissions.length > 0 ? (
              <div style={{ marginBottom: 20 }}>
                {pagedMain.map(m => (
                  <MissionItem key={m.id} m={m} isSelected={selected === m.id} onClick={() => setSelected(m.id)} />
                ))}
                <Pagination page={mainPage} total={mainMissions.length} onPage={setMainPage} />
              </div>
              ) : missionKind === 'main' ? (
              <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>해당 의뢰가 없습니다.</div>
              ) : null
            )}
            {(mainMissions.length > 0 || subMissions.length > 0) && (missionKind === 'sub' || missionKind === 'all') && (
              subMissions.length > 0 ? (
              <div>
                {pagedSub.map(m => (
                  <MissionItem key={m.id} m={m} isSelected={selected === m.id} onClick={() => setSelected(m.id)} />
                ))}
                <Pagination page={subPage} total={subMissions.length} onPage={setSubPage} />
              </div>
              ) : missionKind === 'sub' ? (
              <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>해당 의뢰가 없습니다.</div>
              ) : null
            )}
            {mainMissions.length === 0 && subMissions.length === 0 && (
              <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
                {missions.length === 0 ? '완료된 의뢰가 없습니다.' : '해당 의뢰가 없습니다.'}
              </div>
            )}
          </div>

          {/* 우측: 콘텐츠 영역 */}
          <div>
            {/* 미션 헤더 + 공유 링크 */}
            {mission && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, gap: 16, flexWrap: 'wrap' }}>
                <div>
                  <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 2 }}>{mission.title}</h2>
                  <div style={{ fontSize: 13, color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>승인된 피드백 {feedbacks.length}개</span>
                    {mission?.status === 'cancelled' && (
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 10, background: 'rgba(148,163,184,0.15)', color: 'var(--text-3)', border: '1px solid var(--border)' }}>
                        조기 종료
                      </span>
                    )}
                  </div>
                </div>
                {mission?.status === 'completed' && !trialLocked && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, flexShrink: 0 }}>
                    {/* 공개 범위 토글 */}
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      {[
                        { key: 'show_comments',    label: '코멘트' },
                        { key: 'show_annotations', label: '어노테이션' },
                      ].map(({ key, label }) => (
                        <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: 12, color: 'var(--text-2)', userSelect: 'none' }}>
                          <input
                            type="checkbox"
                            checked={sharePermissions[key]}
                            onChange={() => handlePermissionToggle(key)}
                            style={{ accentColor: 'var(--accent)', width: 14, height: 14 }}
                          />
                          {label} 공개
                        </label>
                      ))}
                    </div>
                    {/* 공유 링크 버튼 */}
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      {shareToken ? (
                        <>
                          <span style={{ fontSize: 12, color: 'var(--green)', fontFamily: 'var(--font-sans)' }}>🔗 공유 중</span>
                          <Btn size="sm" variant="outline" onClick={handleCopyShare}>{shareCopied ? '✓ 복사됨' : 'URL 복사'}</Btn>
                          <Btn size="sm" variant="ghost" onClick={handleRevokeShare} style={{ fontSize: 11, color: 'var(--text-3)' }}>공유 해제</Btn>
                        </>
                      ) : (
                        <Btn size="sm" variant="secondary" onClick={handleGenerateShare} disabled={shareLoading}>
                          {shareLoading ? '생성 중...' : '🔗 공유 링크 생성'}
                        </Btn>
                      )}
                    </div>
                    {shareError && (
                      <div style={{ fontSize: 12, color: 'var(--red,#ef4444)', fontWeight: 600 }}>
                        {shareError}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* 콘텐츠 */}
            {!mission ? null : fbLoading ? (
              <div style={{ color: 'var(--text-3)', fontSize: 14 }}>피드백 불러오는 중...</div>
            ) : feedbacks.length === 0 && !isSubMission ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-3)', fontSize: 14, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' }}>
                승인된 피드백이 없습니다.
              </div>
            ) : (
              <>
                {/* 무료 체험 부분 잠금 배너 — 호평 2명 공개 + 잠긴 쪽 티저 + 30%/48h 할인 */}
                {trialLocked && (
                  <div style={{
                    padding: '18px 20px', marginBottom: 20, borderRadius: 'var(--radius-lg)',
                    background: 'rgba(16,54,125,0.06)', border: '1px solid var(--accent)',
                    display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                  }}>
                    <div style={{ minWidth: 200, flex: 1 }}>
                      <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--accent)', marginBottom: 4 }}>
                        🔒 무료 체험 결과 — 호평 패널 2명 공개 중
                      </div>
                      {/* 잠긴 쪽 티저: 치명적 지적 수 (궁금증 유발) */}
                      {trialTeaser && trialTeaser.criticalCount > 0 && (
                        <div style={{ fontSize: 13.5, color: '#b91c1c', fontWeight: 700, lineHeight: 1.6, marginBottom: 4 }}>
                          ⚠️ 잠긴 {trialTeaser.lockedCount}명 중 <strong>{trialTeaser.criticalCount}명</strong>이 심각한 문제(1~2점)를 지적했습니다.
                        </div>
                      )}
                      <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6 }}>
                        5축 점수는 전체 패널 기준으로 집계됩니다. 누가, 무엇을 지적했는지 전체 피드백·어노테이션을 보려면 잠금을 해제하세요.
                      </div>
                    </div>
                    {/* 우측: 가격·할인을 버튼에 녹임 + 카운트다운·에러는 버튼 아래 */}
                    <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 6, minWidth: 180 }}>
                      <Btn onClick={handleUnlock} disabled={unlocking} style={{ height: 'auto', padding: '16px 20px', lineHeight: 1.4 }}>
                        {unlocking ? '처리 중...' : withinDiscount && unlockBaseCost > 0 ? (
                          <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                            <span style={{ padding: '2px 8px', borderRadius: 5, background: 'rgba(255,255,255,0.22)', fontSize: 11, fontWeight: 800 }}>
                              첫 언락 {Math.round(TRIAL_FIRST_UNLOCK_DISCOUNT * 100)}%↓
                            </span>
                            <span style={{ fontWeight: 800 }}>
                              <span style={{ textDecoration: 'line-through', opacity: 0.7, fontWeight: 600 }}>{unlockBaseCost}cr</span> → {unlockCost}크레딧으로 잠금 해제
                            </span>
                          </span>
                        ) : `전체 잠금 해제 (${unlockCost}cr)`}
                      </Btn>
                      {withinDiscount && discountRemainMs != null && (
                        <div style={{ fontSize: 11.5, color: '#b91c1c', fontWeight: 700, textAlign: 'center' }}>
                          ⏳ 할인 마감까지 {(() => {
                            const sec = Math.floor(discountRemainMs / 1000);
                            const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
                            return `${h}시간 ${String(m).padStart(2, '0')}분 ${String(s).padStart(2, '0')}초`;
                          })()}
                        </div>
                      )}
                      {unlockError && (
                        <div style={{ fontSize: 12, color: '#ef4444', fontWeight: 600, textAlign: 'center' }}>{unlockError}</div>
                      )}
                    </div>
                  </div>
                )}
                {showUnlockPay && companyId && (
                  <ChargeOptionsModal
                    needed={unlockCost}
                    currentBalance={creditBalance}
                    companyId={companyId}
                    onSuccess={(newBalance) => { if (typeof newBalance === 'number') setCreditBalance(newBalance); setShowUnlockPay(false); handleUnlock(); }}
                    onClose={() => setShowUnlockPay(false)}
                  />
                )}

                {/* 서브 미션 */}
                {isSubMission && (
                  <Card style={{ padding: '24px' }}>
                    {mission.type === 'preference' && <PreferenceResults key={mission?.id} responses={subResponses} mission={mission} panelProfiles={panelProfiles} companyId={companyId} helpRatings={helpRatings} onRated={handleRate} />}
                    {mission.type === 'pricing'    && <PricingResults    key={mission?.id} responses={subResponses} mission={mission} panelProfiles={panelProfiles} companyId={companyId} helpRatings={helpRatings} onRated={handleRate} />}
                    {mission.type === 'email'      && <EmailResults      key={mission?.id} responses={subResponses} mission={mission} panelProfiles={panelProfiles} companyId={companyId} helpRatings={helpRatings} onRated={handleRate} />}
                    {!subResponses && <div style={{ color: 'var(--text-3)', fontSize: 14 }}>응답 데이터 로드 중...</div>}
                  </Card>
                )}

                {/* 이미지 미션 — 차원 탭 뷰 */}
                {hasImages && (
                  <div>
                    {/* 탭 버튼 */}
                    <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
                      {DIM_TABS.map(tab => {
                        const isSummary = tab === 'summary';
                        const meta = isSummary ? null : DIM_META[tab];
                        const isActive = activeDimTab === tab;
                        const annCount = isSummary ? 0 : allAnnotations.filter(a => a.dimension === tab).length;
                        return (
                          <button key={tab} onClick={() => setActiveDimTab(tab)} style={{
                            padding: '8px 16px', borderRadius: 'var(--radius)', fontSize: 13, fontWeight: 700,
                            cursor: 'pointer', border: '2px solid', transition: 'all 0.12s',
                            borderColor: isActive ? (isSummary ? 'var(--accent)' : meta.color) : 'var(--border)',
                            background: isActive ? (isSummary ? 'var(--accent)' : meta.color) : 'var(--surface)',
                            color: isActive ? '#fff' : 'var(--text-2)',
                          }}>
                            {isSummary ? '종합' : meta.label}
                            {!isSummary && annCount > 0 && (
                              <span style={{ marginLeft: 6, background: isActive ? 'rgba(255,255,255,0.25)' : 'var(--bg)', borderRadius: 10, padding: '1px 6px', fontSize: 11, color: isActive ? '#fff' : meta.color }}>
                                {annCount}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {/* 탭 콘텐츠 */}
                    {activeDimTab === 'summary' ? (
                      <SummaryTabView key={mission?.id} feedbacks={feedbacks} panelProfiles={panelProfiles} mission={mission} companyId={companyId} helpRatings={helpRatings} onRated={handleRate} locked={trialLocked} unlockedPanelIds={unlockedPanelIds} onUnlock={handleUnlock} />
                    ) : (
                      <DimTabView
                        key={mission?.id}
                        dim={activeDimTab}
                        imageUrls={mission.image_urls}
                        currentImageIdx={currentImageIdx}
                        setCurrentImageIdx={setCurrentImageIdx}
                        allAnnotations={allAnnotations}
                        panelProfiles={panelProfiles}
                        locked={trialLocked}
                        unlockedPanelIds={unlockedPanelIds}
                      />
                    )}
                  </div>
                )}

                {/* 텍스트 미션 (이미지 없는 구형) */}
                {!isSubMission && !hasImages && feedbacks.length > 0 && (
                  <TextMissionResults key={mission?.id} feedbacks={feedbacks} panelProfiles={panelProfiles} mission={mission} companyId={companyId} helpRatings={helpRatings} onRated={handleRate} locked={trialLocked} unlockedPanelIds={unlockedPanelIds} onUnlock={handleUnlock} />
                )}
              </>
            )}
          </div>
        </div>
    </div>
  );
}
