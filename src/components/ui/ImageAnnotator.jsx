import { useState, useRef, useEffect, useCallback } from 'react';
import { Btn } from './index';

const DIMENSIONS = [
  { key: 'clarity',         label: '명확성',   color: '#34C759', bg: 'rgba(52,199,89,0.18)'   },
  { key: 'relevance',       label: '관련성',   color: '#f59e0b', bg: 'rgba(245,158,11,0.18)'  },
  { key: 'value',           label: '가치',     color: '#6366f1', bg: 'rgba(99,102,241,0.18)'  },
  { key: 'differentiation', label: '차별화',   color: '#ef4444', bg: 'rgba(239,68,68,0.18)'   },
  { key: 'trust',           label: '신뢰',     color: '#94a3b8', bg: 'rgba(148,163,184,0.18)' },
];

const dimMeta = Object.fromEntries(DIMENSIONS.map(d => [d.key, d]));

function AnnotationTooltip({ ann, onRemove, onClose, readonly }) {
  const meta = dimMeta[ann.dimension];
  return (
    <div
      onClick={e => e.stopPropagation()}
      style={{
        position: 'absolute', bottom: 'calc(100% + 6px)', left: 0,
        background: 'var(--bg)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius)', padding: '10px 12px',
        minWidth: 200, maxWidth: 280, zIndex: 20,
        boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
        fontSize: 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <span style={{ background: meta.color, color: '#fff', borderRadius: 4, padding: '2px 7px', fontSize: 11, fontWeight: 700 }}>
          {meta.label}
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)', fontWeight: 700 }}>{ann.score}점</span>
        <span style={{ marginLeft: 'auto', cursor: 'pointer', color: 'var(--text-3)', fontSize: 14, lineHeight: 1 }} onClick={onClose}>×</span>
      </div>
      {ann.comment && (
        <div style={{ color: 'var(--text-2)', lineHeight: 1.5, marginBottom: readonly ? 0 : 8 }}>{ann.comment}</div>
      )}
      {!readonly && (
        <button
          onClick={() => { onRemove(ann.id); onClose(); }}
          style={{ fontSize: 11, color: 'var(--red)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          삭제
        </button>
      )}
    </div>
  );
}

export default function ImageAnnotator({ imageUrl, imageIndex = 0, annotations = [], onAdd, onRemove, readonly = false }) {
  const containerRef = useRef(null);
  const [dragging, setDragging]       = useState(false);
  const [dragStart, setDragStart]     = useState({ x: 0, y: 0 });
  const [dragRect, setDragRect]       = useState(null);
  const [popup, setPopup]             = useState(null);
  const [popupForm, setPopupForm]     = useState({ dimension: 'clarity', score: 3, comment: '' });
  const [selectedAnn, setSelectedAnn] = useState(null);

  const getRelativePct = useCallback((clientX, clientY) => {
    const rect = containerRef.current.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(100, ((clientX - rect.left)  / rect.width)  * 100)),
      y: Math.max(0, Math.min(100, ((clientY - rect.top)   / rect.height) * 100)),
    };
  }, []);

  const handleMouseDown = useCallback((e) => {
    if (readonly) return;
    if (e.button !== 0) return;
    e.preventDefault();
    const pct = getRelativePct(e.clientX, e.clientY);
    setDragging(true);
    setDragStart(pct);
    setDragRect({ x: pct.x, y: pct.y, w: 0, h: 0 });
    setSelectedAnn(null);
  }, [readonly, getRelativePct]);

  useEffect(() => {
    if (!dragging) return;

    const handleMove = (e) => {
      const pct = getRelativePct(e.clientX, e.clientY);
      setDragRect({
        x: Math.min(dragStart.x, pct.x),
        y: Math.min(dragStart.y, pct.y),
        w: Math.abs(pct.x - dragStart.x),
        h: Math.abs(pct.y - dragStart.y),
      });
    };

    const handleUp = (e) => {
      setDragging(false);
      const pct = getRelativePct(e.clientX, e.clientY);
      const rect = {
        x: Math.min(dragStart.x, pct.x),
        y: Math.min(dragStart.y, pct.y),
        w: Math.abs(pct.x - dragStart.x),
        h: Math.abs(pct.y - dragStart.y),
      };
      setDragRect(null);
      if (rect.w > 2 && rect.h > 2) {
        setPopup(rect);
        setPopupForm({ dimension: 'clarity', score: 3, comment: '' });
      }
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [dragging, dragStart, getRelativePct]);

  const handleConfirm = () => {
    if (!popupForm.comment.trim()) return;
    onAdd({
      image_index: imageIndex,
      x_pct: popup.x,
      y_pct: popup.y,
      w_pct: popup.w,
      h_pct: popup.h,
      dimension: popupForm.dimension,
      score:     popupForm.score,
      comment:   popupForm.comment.trim(),
    });
    setPopup(null);
  };

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      {/* 이미지 + 드래그 레이어 */}
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        style={{
          position: 'relative',
          display: 'block',
          width: '100%',
          cursor: readonly ? 'default' : 'crosshair',
          userSelect: 'none',
        }}
      >
        <img
          src={imageUrl}
          alt="검증 이미지"
          draggable={false}
          style={{ display: 'block', width: '100%', pointerEvents: 'none' }}
        />

        {/* 기존 어노테이션 오버레이 */}
        {annotations.map(ann => {
          const meta = dimMeta[ann.dimension];
          const isSelected = selectedAnn === ann.id;
          return (
            <div
              key={ann.id}
              onClick={e => { e.stopPropagation(); setSelectedAnn(isSelected ? null : ann.id); }}
              style={{
                position: 'absolute',
                left:   `${ann.x_pct}%`,
                top:    `${ann.y_pct}%`,
                width:  `${ann.w_pct}%`,
                height: `${ann.h_pct}%`,
                background: isSelected ? meta.bg : `${meta.bg}`,
                border: `2px solid ${meta.color}`,
                borderRadius: 3,
                cursor: 'pointer',
                boxSizing: 'border-box',
              }}
            >
              {/* 배지 */}
              <div style={{
                position: 'absolute', top: -1, left: -1,
                background: meta.color, color: '#fff',
                fontSize: 10, fontWeight: 700, padding: '1px 5px',
                borderRadius: '2px 0 2px 0', lineHeight: 1.6,
                whiteSpace: 'nowrap',
              }}>
                {meta.label[0]} {ann.score}
              </div>

              {/* 툴팁 */}
              {isSelected && (
                <AnnotationTooltip
                  ann={ann}
                  onRemove={onRemove}
                  onClose={() => setSelectedAnn(null)}
                  readonly={readonly}
                />
              )}
            </div>
          );
        })}

        {/* 드래그 프리뷰 */}
        {dragRect && dragRect.w > 0 && (
          <div style={{
            position: 'absolute',
            left:   `${dragRect.x}%`,
            top:    `${dragRect.y}%`,
            width:  `${dragRect.w}%`,
            height: `${dragRect.h}%`,
            border: '2px dashed var(--accent)',
            background: 'rgba(99,102,241,0.08)',
            pointerEvents: 'none',
            boxSizing: 'border-box',
          }} />
        )}
      </div>

      {/* 안내 문구 */}
      {!readonly && annotations.length === 0 && (
        <div style={{
          position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(0,0,0,0.55)', color: '#fff',
          fontSize: 12, padding: '5px 14px', borderRadius: 20, pointerEvents: 'none',
          whiteSpace: 'nowrap',
        }}>
          이미지 위를 드래그해서 영역을 지정하세요
        </div>
      )}

      {/* 어노테이션 추가 팝업 */}
      {popup && (
        <div
          onClick={() => setPopup(null)}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 9999,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--bg)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)', padding: 28, width: 400,
              boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
            }}
          >
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>어노테이션 추가</div>

            {/* Dimension 선택 */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 8 }}>평가 항목</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {DIMENSIONS.map(d => (
                  <button
                    key={d.key}
                    onClick={() => setPopupForm(f => ({ ...f, dimension: d.key }))}
                    style={{
                      padding: '5px 12px', borderRadius: 'var(--radius)', fontSize: 12, fontWeight: 600,
                      cursor: 'pointer', border: '1.5px solid',
                      borderColor: popupForm.dimension === d.key ? d.color : 'var(--border)',
                      background: popupForm.dimension === d.key ? d.bg : 'var(--surface)',
                      color: popupForm.dimension === d.key ? d.color : 'var(--text-2)',
                      transition: 'all 0.12s',
                    }}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 점수 선택 */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 8 }}>점수 (1 = 매우 낮음 · 5 = 매우 높음)</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {[1, 2, 3, 4, 5].map(n => (
                  <button
                    key={n}
                    onClick={() => setPopupForm(f => ({ ...f, score: n }))}
                    style={{
                      width: 40, height: 40, borderRadius: 'var(--radius)', fontSize: 14, fontWeight: 700,
                      cursor: 'pointer', border: '1.5px solid',
                      borderColor: popupForm.score === n ? 'var(--accent)' : 'var(--border)',
                      background: popupForm.score === n ? 'var(--accent)' : 'var(--surface)',
                      color: popupForm.score === n ? '#fff' : 'var(--text-2)',
                      transition: 'all 0.12s',
                    }}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            {/* 코멘트 */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 8 }}>코멘트 <span style={{ color: 'var(--red)' }}>*</span></div>
              <textarea
                value={popupForm.comment}
                onChange={e => setPopupForm(f => ({ ...f, comment: e.target.value }))}
                placeholder="이 영역에서 발견한 문제점이나 강점을 구체적으로 작성해주세요."
                rows={3}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  padding: '10px 12px', borderRadius: 'var(--radius)',
                  border: '1px solid var(--border)', background: 'var(--surface)',
                  color: 'var(--text)', fontSize: 13, lineHeight: 1.6,
                  resize: 'vertical', fontFamily: 'inherit',
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <Btn variant="secondary" size="sm" onClick={() => setPopup(null)}>취소</Btn>
              <Btn size="sm" onClick={handleConfirm} disabled={!popupForm.comment.trim()}>추가</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
