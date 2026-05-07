import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, ScoreBar, Badge, Btn } from '../../components/ui';
import ImageAnnotator from '../../components/ui/ImageAnnotator';
import { supabase } from '../../lib/supabase';
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
  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginTop: 12, justifyContent: 'center' }}>
      <button onClick={() => onPage(page - 1)} disabled={page === 1} style={{ padding: '5px 10px', borderRadius: 6, background: 'var(--surface)', color: 'var(--text-2)', border: '1px solid var(--border)', cursor: page === 1 ? 'not-allowed' : 'pointer', opacity: page === 1 ? 0.4 : 1, fontSize: 13 }}>이전</button>
      {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
        <button key={n} onClick={() => onPage(n)} style={{ padding: '5px 10px', borderRadius: 6, background: page === n ? 'var(--accent)' : 'var(--surface)', color: page === n ? '#fff' : 'var(--text-2)', border: '1px solid ' + (page === n ? 'var(--accent)' : 'var(--border)'), cursor: 'pointer', fontSize: 13, fontWeight: page === n ? 700 : 400 }}>{n}</button>
      ))}
      <button onClick={() => onPage(page + 1)} disabled={page === totalPages} style={{ padding: '5px 10px', borderRadius: 6, background: 'var(--surface)', color: 'var(--text-2)', border: '1px solid var(--border)', cursor: page === totalPages ? 'not-allowed' : 'pointer', opacity: page === totalPages ? 0.4 : 1, fontSize: 13 }}>다음</button>
    </div>
  );
}

const TYPE_INFO = {
  landing_page: { label: 'LP검증',    color: 'var(--accent)' },
  preference:   { label: '소재비교',  color: '#10367D' },
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
    <span style={{ display: 'inline-flex', gap: 4, marginLeft: 8, verticalAlign: 'middle' }}>
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
  const typeInfo = TYPE_INFO[m.type] || TYPE_INFO.landing_page;
  return (
    <div
      onClick={onClick}
      style={{
        padding: '10px 12px', borderRadius: 'var(--radius)',
        background: isSelected ? 'var(--accent-dim)' : 'var(--surface)',
        border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
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
      <div style={{ fontSize: 13, fontWeight: isSelected ? 700 : 500, color: isSelected ? 'var(--accent)' : 'var(--text)', lineHeight: 1.4 }}>
        {m.title}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 3 }}>
        피드백 {m.filled_count || 0}개
      </div>
    </div>
  );
}

/* ─── 점수 카드 그리드 ─── */
function ScoreCardRow({ items }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${items.length}, 1fr)`, gap: 10, marginBottom: 20 }}>
      {items.map(({ label, value, color }) => {
        const num = parseFloat(value);
        const c = color || (isNaN(num) ? 'var(--text-3)' : num >= 4 ? 'var(--green)' : num >= 3 ? 'var(--accent)' : 'var(--red)');
        return (
          <Card key={label} style={{ padding: '16px', textAlign: 'center' }}>
            <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>{label}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: c, fontFamily: 'var(--font-mono)', lineHeight: 1 }}>
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
        <span>{aLabel} <span style={{ color: aColor, fontFamily: 'var(--font-mono)' }}>{aPct}%</span></span>
        <span><span style={{ color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>{100 - aPct}%</span> {bLabel}</span>
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
          <div key={i} style={{ padding: '12px 14px', background: 'var(--bg-3)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', fontSize: 13, color: 'var(--text-2)', lineHeight: 1.65 }}>
            {item.label && <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', marginBottom: 4, textTransform: 'uppercase' }}>{item.label}</div>}
            {item.text || <span style={{ fontStyle: 'italic', color: 'var(--text-3)' }}>내용 없음</span>}
          </div>
        ))}
      </div>
      <Pagination page={page} total={items.length} onPage={setPage} />
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
          style={{ marginTop: 6, fontSize: 12, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontWeight: 600 }}
        >
          {expanded ? '접기 ▲' : '더보기 ▼'}
        </button>
      )}
    </div>
  );
}

/* ─── 커스텀 질문 결과 섹션 (아코디언) ─── */
function CustomQuestionsSection({ questions, responses }) {
  const [expanded, setExpanded] = useState({});
  if (!questions?.length) return null;
  const allAnswers = (responses || []).flatMap(r => r.custom_answers || []);
  if (!allAnswers.length) return null;

  const toggle = key => setExpanded(prev => ({ ...prev, [key]: !prev[key] }));
  const typeLabelMap = { radio: '옵션형', scale: '점수형', text: '서술형' };
  const typeColorMap = { radio: '#10367D', scale: 'var(--accent)', text: '#34C759' };
  const typeBg = { radio: 'rgba(16,54,125,0.12)', scale: 'rgba(99,102,241,0.15)', text: 'rgba(52,199,89,0.15)' };

  return (
    <div style={{ marginTop: 28, borderTop: '1px solid var(--border)', paddingTop: 20 }}>
      <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>추가 질문 응답</div>
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
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, flexShrink: 0, background: typeBg[q.type] || typeBg.text, color: typeColorMap[q.type] || typeColorMap.text }}>
                    {typeLabelMap[q.type] || '서술'}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', lineHeight: 1.4 }}>
                    {qi + 1}. {q.text}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>{answers.length}개</span>
                  <span style={{ fontSize: 10, color: 'var(--text-3)', display: 'inline-block', transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▼</span>
                </div>
              </div>
              {isOpen && (
                <div style={{ padding: '14px', background: 'var(--bg-3)', borderTop: '1px solid var(--border)' }}>
                  {q.type === 'radio' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                      {(q.options || []).map(opt => {
                        const cnt = answers.filter(a => a === opt).length;
                        const pct = answers.length ? Math.round((cnt / answers.length) * 100) : 0;
                        return (
                          <div key={opt}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                              <span style={{ color: 'var(--text-2)' }}>{opt}</span>
                              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)', fontWeight: 700 }}>{pct}%</span>
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
                    return <ScoreCardRow items={[{ label: '점수형 평균', value: avg }]} />;
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
      {/* 소재 A/B 원본 */}
      {(parsedDesc.variantA || parsedDesc.variantAImage || parsedDesc.variantB || parsedDesc.variantBImage) && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>제출된 소재</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ padding: '12px 14px', background: 'var(--surface)', border: '2px solid var(--accent)', borderRadius: 'var(--radius)' }}>
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--accent)', marginBottom: 8, fontWeight: 700, textTransform: 'uppercase' }}>소재 A</div>
              {parsedDesc.variantAImage && (
                <img src={parsedDesc.variantAImage} alt="소재 A" style={{ width: '100%', borderRadius: 6, marginBottom: 8, maxHeight: 160, objectFit: 'cover' }} />
              )}
              {parsedDesc.variantA && <ExpandableText text={parsedDesc.variantA} />}
            </div>
            <div style={{ padding: '12px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', marginBottom: 8, fontWeight: 700, textTransform: 'uppercase' }}>소재 B</div>
              {parsedDesc.variantBImage && (
                <img src={parsedDesc.variantBImage} alt="소재 B" style={{ width: '100%', borderRadius: 6, marginBottom: 8, maxHeight: 160, objectFit: 'cover' }} />
              )}
              {parsedDesc.variantB && <ExpandableText text={parsedDesc.variantB} />}
            </div>
          </div>
        </div>
      )}
      {parsedDesc.productDescription && (
        <div style={{ padding: '10px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', marginBottom: 20 }}>
          <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', marginBottom: 4, textTransform: 'uppercase' }}>제품 설명</div>
          <ExpandableText text={parsedDesc.productDescription} />
        </div>
      )}
      <div style={{ marginBottom: 4, fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>A/B 선호도 결과</div>
      <RatioBar aLabel="소재 A" bLabel="소재 B" aCount={aCount} bCount={bCount} aColor="var(--accent)" />
      <ScoreCardRow items={[
        { label: '메시지 명확성 평균', value: calcAvg(responses, 'message_clarity') },
        { label: '구매 전환 의향 평균', value: calcAvg(responses, 'purchase_intent') },
      ]} />
      <CustomQuestionsSection questions={allTypedQs} responses={responses} />
      <div style={{ marginTop: 28, borderTop: '1px solid var(--border)', paddingTop: 20 }}>
        <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>총 평가 — 패널 코멘트</div>
        <CommentList items={responses.map((r, i) => ({
          label: <span>패널 #{i + 1} · 소재 {r.preference}<PanelBadges panelId={r.panel_id} profiles={panelProfiles} /><HelpfulnessButtons refType="preference" refId={r.id} panelId={r.panel_id} companyId={companyId} helpRatings={helpRatings} onRated={onRated} /></span>,
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
          <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', marginBottom: 6, textTransform: 'uppercase' }}>가격 구성</div>
          {parsedDesc.image && <img src={parsedDesc.image} alt="가격" style={{ width: '100%', borderRadius: 'var(--radius)', marginBottom: 8, maxHeight: 200, objectFit: 'cover' }} />}
          {parsedDesc.content && <ExpandableText text={parsedDesc.content} />}
        </div>
      )}
      <div style={{ marginBottom: 4, fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>구매 의향</div>
      <RatioBar aLabel="구매 의향 있음" bLabel="구매 의향 없음" aCount={buyYes} bCount={buyNo} aColor="var(--green)" />
      <ScoreCardRow items={[
        { label: '가격 적절성 평균', value: calcAvg(responses, 'price_fairness') },
        { label: '가격 대비 가치 평균', value: calcAvg(responses, 'value_perception') },
      ]} />
      <CustomQuestionsSection questions={allTypedQs} responses={responses} />
      <div style={{ marginTop: 28, borderTop: '1px solid var(--border)', paddingTop: 20 }}>
        <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>총 평가 — 패널 코멘트</div>
        <CommentList items={responses.map((r, i) => ({
          label: <span>패널 #{i + 1}<PanelBadges panelId={r.panel_id} profiles={panelProfiles} /><HelpfulnessButtons refType="pricing" refId={r.id} panelId={r.panel_id} companyId={companyId} helpRatings={helpRatings} onRated={onRated} /></span>,
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
  const allTypedQs = parsedDesc.selectedQuestions || [
    ...(parsedDesc.templateQuestions || []),
    ...(parsedDesc.customQuestions || []).filter(Boolean).map(q =>
      typeof q === 'string' ? { id: q, text: q, type: 'text', options: [] } : q
    ),
  ];

  return (
    <div>
      {parsedDesc.content && (
        <div style={{ padding: '12px 14px', background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', marginBottom: 20 }}>
          <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', marginBottom: 8, textTransform: 'uppercase' }}>이메일 원문</div>
          <ExpandableText text={parsedDesc.content} limit={250} />
        </div>
      )}
      <div style={{ marginBottom: 4, fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>답장 의향</div>
      <RatioBar aLabel="답장하겠음" bLabel="답장 안 함" aCount={replyYes} bCount={replyNo} aColor="var(--green)" />
      <ScoreCardRow items={[
        { label: '개봉 의향',    value: calcAvg(responses, 'open_intent') },
        { label: '훅 강도',      value: calcAvg(responses, 'hook_score') },
        { label: '메시지 명확성', value: calcAvg(responses, 'clarity_score') },
        { label: '호기심',       value: calcAvg(responses, 'curiosity_score') },
      ]} />
      <CustomQuestionsSection questions={allTypedQs} responses={responses} />
      <div style={{ marginTop: 28, borderTop: '1px solid var(--border)', paddingTop: 20 }}>
        <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>총 평가 — 패널 코멘트</div>
        <CommentList items={responses.map((r, i) => ({
          label: <span>패널 #{i + 1}<PanelBadges panelId={r.panel_id} profiles={panelProfiles} /><HelpfulnessButtons refType="email" refId={r.id} panelId={r.panel_id} companyId={companyId} helpRatings={helpRatings} onRated={onRated} /></span>,
          text: r.comment,
        }))} />
      </div>
    </div>
  );
}

/* ─── 이미지 미션: 차원 탭 뷰 ─── */
function DimTabView({ dim, imageUrls, currentImageIdx, setCurrentImageIdx, allAnnotations, panelProfiles }) {
  const [selectedAnnId, setSelectedAnnId] = useState(null);
  const [annPage, setAnnPage] = useState(1);
  const meta = DIM_META[dim];
  const imgAnns = allAnnotations.filter(a => a.dimension === dim && a.image_index === currentImageIdx);
  const allDimAnns = allAnnotations.filter(a => a.dimension === dim);
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
    <div>
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
      <div style={{ border: `1px solid ${meta.color}44`, borderRadius: 'var(--radius-lg)', overflow: 'hidden', marginBottom: 16 }}>
        <ImageAnnotator
          imageUrl={imageUrls[currentImageIdx]}
          imageIndex={currentImageIdx}
          annotations={imgAnns}
          seqPool={allDimAnns}
          highlightedId={selectedAnnId}
          readonly
        />
      </div>

      {/* 어노테이션 개수 안내 */}
      <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 12 }}>
        <span style={{ color: meta.color, fontWeight: 700 }}>{meta.label}</span> 차원 어노테이션 {allDimAnns.length}개 (전체 이미지 합산)
        {selectedAnnId && <span style={{ marginLeft: 8, color: 'var(--accent)', fontWeight: 600 }}>— 선택된 항목만 표시 중 (다시 클릭하면 전체 표시)</span>}
      </div>

      {/* 코멘트 목록 */}
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
                    padding: '12px 14px', background: isActive ? 'var(--accent-dim, rgba(99,102,241,0.08))' : 'var(--bg-3)',
                    borderRadius: 'var(--radius)', cursor: 'pointer',
                    border: isActive ? `1.5px solid ${meta.color}` : '1px solid var(--border)',
                    borderLeft: `3px solid ${meta.color}`,
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: ann.comment ? 8 : 0, flexWrap: 'wrap' }}>
                    <span style={{ background: meta.color, color: '#fff', borderRadius: 4, padding: '2px 7px', fontSize: 11, fontWeight: 700 }}>
                      {globalIdx + 1}
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--accent)', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{ann.score}점</span>
                    <span style={{ fontSize: 11, color: 'var(--text-3)' }}>이미지 {ann.image_index + 1}</span>
                    <PanelBadges panelId={ann.panel_id} profiles={panelProfiles} />
                  </div>
                  {ann.comment ? (
                    <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.65 }}>{ann.comment}</div>
                  ) : (
                    <div style={{ fontSize: 12, color: 'var(--text-3)', fontStyle: 'italic' }}>코멘트 없음</div>
                  )}
                </div>
              );
            })}
          </div>
          <Pagination page={annPage} total={allDimAnns.length} onPage={setAnnPage} />
        </div>
      )}
    </div>
  );
}

/* ─── 이미지 미션: 종합 탭 ─── */
function SummaryTabView({ feedbacks, panelProfiles, mission, companyId, helpRatings, onRated }) {
  const [commentPage, setCommentPage] = useState(1);
  const radarData = DIMS.map(dim => {
    const key = DIM_META[dim].key;
    const val = calcAvg(feedbacks, key);
    return { label: DIM_META[dim].label, value: val ? parseFloat(val) : 0 };
  });

  const overallComments = feedbacks
    .map((fb, i) => ({ panel: i + 1, panelId: fb.panel_id, fbId: fb.id, text: extractOverallComment(fb.suggestions), passed: fb.purity_passed }))
    .filter(c => c.text);
  const pagedComments = overallComments.slice((commentPage - 1) * PAGE_SIZE, commentPage * PAGE_SIZE);

  return (
    <div>
      {/* 5차원 평균 점수 카드 */}
      <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>5차원 평균 점수</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 24 }}>
        {DIMS.map(dim => {
          const key = DIM_META[dim].key;
          const val = calcAvg(feedbacks, key);
          const num = parseFloat(val);
          const c = isNaN(num) || !val ? 'var(--text-3)' : num >= 4 ? 'var(--green)' : num >= 3 ? 'var(--accent)' : 'var(--red)';
          return (
            <Card key={dim} style={{ padding: '16px', textAlign: 'center' }}>
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{DIM_META[dim].label}</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: c, fontFamily: 'var(--font-mono)', lineHeight: 1 }}>{val ?? '—'}</div>
              {val && <div style={{ marginTop: 8 }}><ScoreBar score={Math.round(num)} color={c} /></div>}
            </Card>
          );
        })}
      </div>

      {/* 레이더 차트 */}
      {radarData.some(d => d.value > 0) && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>방사형 차트</div>
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

      {/* 총평 목록 */}
      <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
        패널 총평 ({overallComments.length}개)
      </div>
      {overallComments.length === 0 ? (
        <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-3)', fontSize: 13, background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
          총평 데이터가 없습니다.
        </div>
      ) : (
        <div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {pagedComments.map(({ panel, panelId, fbId, text, passed }) => (
              <div key={panel} style={{ padding: '14px 16px', background: 'var(--bg-3)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12, fontWeight: 600 }}>패널 #{panel}</span>
                  <PanelBadges panelId={panelId} profiles={panelProfiles} />
                  {passed && <Badge type="green">Purit 통과</Badge>}
                  <HelpfulnessButtons refType="feedback" refId={fbId} panelId={panelId} companyId={companyId} helpRatings={helpRatings} onRated={onRated} />
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.7 }}>{text}</div>
              </div>
            ))}
          </div>
          <Pagination page={commentPage} total={overallComments.length} onPage={setCommentPage} />
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
              <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>추가 질문 집계</span>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            </div>
            <CustomQuestionsSection questions={lpQs} responses={feedbacks} />
          </>
        );
      })()}
    </div>
  );
}

/* ─── 텍스트 미션 결과 (이미지 없는 구형 미션) ─── */
function TextMissionResults({ feedbacks, panelProfiles, mission, companyId, helpRatings, onRated }) {
  const [activeFb, setActiveFb] = useState(feedbacks[0]?.id || null);
  const [panelPage, setPanelPage] = useState(1);
  const fb = feedbacks.find(f => f.id === activeFb) || null;
  const pagedFeedbacks = feedbacks.slice((panelPage - 1) * PAGE_SIZE, panelPage * PAGE_SIZE);

  return (
    <div>
    <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 16 }}>
      {/* 패널 목록 */}
      <div>
        <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>패널 피드백 ({feedbacks.length})</div>
        {pagedFeedbacks.map((f, i) => {
          const globalIdx = (panelPage - 1) * PAGE_SIZE + i;
          const overallAvg = DIMS.reduce((s, d) => s + (f[DIM_META[d].key] || 0), 0) / DIMS.length;
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
                </div>
                <Badge type={f.purity_passed ? 'green' : 'gray'}>{f.purity_passed ? '통과' : '검토 중'}</Badge>
              </div>
              <ScoreBar score={Math.round(overallAvg)} />
            </div>
          );
        })}
        <Pagination page={panelPage} total={feedbacks.length} onPage={setPanelPage} />
      </div>

      {/* 상세 */}
      {fb && (
        fb.purity_passed ? (
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
                  <div key={dim} style={{ padding: '14px', background: 'var(--bg-3)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-2)', textTransform: 'uppercase' }}>{DIM_META[dim].label}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 18, fontWeight: 800, color: c, fontFamily: 'var(--font-mono)' }}>{score || '—'}</span>
                        {score > 0 && <span style={{ fontSize: 12, color: 'var(--text-3)' }}>/5</span>}
                      </div>
                    </div>
                    {score > 0 && <ScoreBar score={score} color={c} />}
                  </div>
                );
              })}
              {fb.suggestions && (
                <div style={{ padding: '14px', background: 'var(--bg-3)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--accent)', textTransform: 'uppercase' }}>개선 제안</div>
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
            <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>추가 질문 집계</span>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          </div>
          <CustomQuestionsSection questions={lpQs} responses={feedbacks} />
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
  const [panelProfiles, setPanelProfiles] = useState({});
  const [companyId, setCompanyId]         = useState(null);
  const [helpRatings, setHelpRatings]     = useState({});
  const [ratingInFlight, setRatingInFlight] = useState(new Set());

  // 미션 목록 로드
  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: co } = await supabase.from('companies').select('id').eq('user_id', user.id).single();
      if (!co) { setLoading(false); return; }
      setCompanyId(co.id);
      const { data: ms } = await supabase.from('missions').select('*').eq('company_id', co.id).neq('status', 'draft').order('created_at', { ascending: false });
      setMissions(ms || []);
      if (ms?.length > 0) {
        const paramId = searchParams.get('id');
        const initialMission = paramId ? ms.find(m => m.id === paramId) : null;
        const target = initialMission || ms[0];
        setSelected(target.id);
        setShareToken(target.share_token || null);
      }
      setLoading(false);
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
    const mType = m?.type;
    const hasImgs = Array.isArray(m?.image_urls) && m.image_urls.length > 0;

    async function loadFeedback() {
      const { data: fbs } = await supabase
        .from('feedbacks')
        .select('*')
        .eq('mission_id', selected)
        .neq('status', 'draft')
        .order('created_at', { ascending: false });
      setFeedbacks(fbs || []);

      const { data: ppRows } = await supabase.rpc('get_panel_public_profiles', { p_mission_id: selected });
      if (ppRows) {
        const map = {};
        ppRows.forEach(r => { map[r.panel_id] = { industry: r.industry, experience: r.experience }; });
        setPanelProfiles(map);
      }

      if (hasImgs && !['preference', 'pricing', 'email'].includes(mType)) {
        const { data: anns } = await supabase
          .from('feedback_annotations')
          .select('*')
          .eq('mission_id', selected)
          .order('created_at');
        setAllAnnotations(anns || []);
      }

      let subData = null;
      if (mType === 'preference') {
        const { data } = await supabase.from('preference_responses').select('*').eq('mission_id', selected);
        subData = data || [];
        setSubResponses(subData);
      } else if (mType === 'pricing') {
        const { data } = await supabase.from('pricing_responses').select('*').eq('mission_id', selected);
        subData = data || [];
        setSubResponses(subData);
      } else if (mType === 'email') {
        const { data } = await supabase.from('email_responses').select('*').eq('mission_id', selected);
        subData = data || [];
        setSubResponses(subData);
      }

      // helpfulness ratings 배치 로드
      const currentCompanyId = companyId;
      if (currentCompanyId) {
        const annsData = hasImgs && !['preference', 'pricing', 'email'].includes(mType)
          ? (await supabase.from('feedback_annotations').select('id').eq('mission_id', selected)).data || []
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

      setFbLoading(false);
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
    }

    setRatingInFlight(s => { const n = new Set(s); n.delete(key); return n; });
  };

  // 공유 링크 핸들러
  const handleGenerateShare = async () => {
    if (!selected) return;
    setShareLoading(true);
    const token = crypto.randomUUID().replace(/-/g, '');
    const { error } = await supabase.from('missions').update({ share_token: token }).eq('id', selected);
    if (!error) {
      setShareToken(token);
      setMissions(ms => ms.map(m => m.id === selected ? { ...m, share_token: token } : m));
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
    await supabase.from('missions').update({ share_token: null }).eq('id', selected);
    setShareToken(null);
    setMissions(ms => ms.map(m => m.id === selected ? { ...m, share_token: null } : m));
  };

  if (loading) return (
    <div style={{ padding: '40px 48px', color: 'var(--text-3)', fontSize: 14 }}>불러오는 중...</div>
  );

  const mission = missions.find(m => m.id === selected) || null;
  const isSubMission  = mission && ['preference', 'pricing', 'email'].includes(mission.type);
  const hasImages     = mission && Array.isArray(mission.image_urls) && mission.image_urls.length > 0 && !isSubMission;
  const mainMissions  = missions.filter(m => !m.type || m.type === 'landing_page');
  const subMissions   = missions.filter(m => ['preference', 'pricing', 'email'].includes(m.type));

  const DIM_TABS = [...DIMS, 'summary'];

  return (
    <div className="page-wrap" style={{ padding: '40px 48px', maxWidth: 1360, animation: 'fadeUp 0.5s ease both' }}>
      {/* 헤더 */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--accent)', marginBottom: 8, letterSpacing: '0.1em' }}>FEEDBACK RESULTS</div>
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 4 }}>피드백 결과</h1>
      </div>

      {missions.length === 0 ? (
        <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-3)', fontSize: 14, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' }}>
          등록된 의뢰가 없습니다.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '230px 1fr', gap: 20, alignItems: 'flex-start' }}>

          {/* 좌측: 미션 선택 패널 */}
          <div style={{ position: 'sticky', top: 24 }}>
            {mainMissions.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>메인 의뢰</div>
                {mainMissions.map(m => (
                  <MissionItem key={m.id} m={m} isSelected={selected === m.id} onClick={() => setSelected(m.id)} />
                ))}
              </div>
            )}
            {subMissions.length > 0 && (
              <div>
                <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>서브 의뢰</div>
                {subMissions.map(m => (
                  <MissionItem key={m.id} m={m} isSelected={selected === m.id} onClick={() => setSelected(m.id)} />
                ))}
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
                  <div style={{ fontSize: 13, color: 'var(--text-3)' }}>
                    피드백 {feedbacks.length}개 수신
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                  {shareToken ? (
                    <>
                      <span style={{ fontSize: 12, color: 'var(--green)', fontFamily: 'var(--font-mono)' }}>🔗 공유 중</span>
                      <Btn size="sm" variant="outline" onClick={handleCopyShare}>{shareCopied ? '✓ 복사됨' : 'URL 복사'}</Btn>
                      <Btn size="sm" variant="ghost" onClick={handleRevokeShare} style={{ fontSize: 11, color: 'var(--text-3)' }}>공유 해제</Btn>
                    </>
                  ) : (
                    <Btn size="sm" variant="secondary" onClick={handleGenerateShare} disabled={shareLoading}>
                      {shareLoading ? '생성 중...' : '🔗 공유 링크 생성'}
                    </Btn>
                  )}
                </div>
              </div>
            )}

            {/* 콘텐츠 */}
            {fbLoading ? (
              <div style={{ color: 'var(--text-3)', fontSize: 14 }}>피드백 불러오는 중...</div>
            ) : feedbacks.length === 0 && !isSubMission ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-3)', fontSize: 14, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' }}>
                아직 제출된 피드백이 없습니다.
              </div>
            ) : (
              <>
                {/* 서브 미션 */}
                {isSubMission && (
                  <Card style={{ padding: '24px' }}>
                    {mission.type === 'preference' && <PreferenceResults responses={subResponses} mission={mission} panelProfiles={panelProfiles} companyId={companyId} helpRatings={helpRatings} onRated={handleRate} />}
                    {mission.type === 'pricing'    && <PricingResults    responses={subResponses} mission={mission} panelProfiles={panelProfiles} companyId={companyId} helpRatings={helpRatings} onRated={handleRate} />}
                    {mission.type === 'email'      && <EmailResults      responses={subResponses} mission={mission} panelProfiles={panelProfiles} companyId={companyId} helpRatings={helpRatings} onRated={handleRate} />}
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
                      <SummaryTabView feedbacks={feedbacks} panelProfiles={panelProfiles} mission={mission} companyId={companyId} helpRatings={helpRatings} onRated={handleRate} />
                    ) : (
                      <DimTabView
                        dim={activeDimTab}
                        imageUrls={mission.image_urls}
                        currentImageIdx={currentImageIdx}
                        setCurrentImageIdx={setCurrentImageIdx}
                        allAnnotations={allAnnotations}
                        panelProfiles={panelProfiles}
                      />
                    )}
                  </div>
                )}

                {/* 텍스트 미션 (이미지 없는 구형) */}
                {!isSubMission && !hasImages && feedbacks.length > 0 && (
                  <TextMissionResults feedbacks={feedbacks} panelProfiles={panelProfiles} mission={mission} companyId={companyId} helpRatings={helpRatings} onRated={handleRate} />
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
