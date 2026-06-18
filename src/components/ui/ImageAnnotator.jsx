import { useState, useRef, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { Btn } from './index';

const DIMENSIONS = [
  { key: 'clarity',         label: '명확성', short: '명', color: '#34C759', bg: 'rgba(52,199,89,0.18)'   },
  { key: 'relevance',       label: '관련성', short: '관', color: '#f59e0b', bg: 'rgba(245,158,11,0.18)'  },
  { key: 'value',           label: '가치',   short: '가', color: '#6366f1', bg: 'rgba(99,102,241,0.18)'  },
  { key: 'differentiation', label: '차별화', short: '차', color: '#ef4444', bg: 'rgba(239,68,68,0.18)'   },
  { key: 'trust',           label: '신뢰',   short: '신', color: '#94a3b8', bg: 'rgba(148,163,184,0.18)' },
];

const dimMeta = Object.fromEntries(DIMENSIONS.map(d => [d.key, d]));

function getDimSeq(pool, ann) {
  const sameDim = pool.filter(a => a.dimension === ann.dimension);
  return sameDim.findIndex(a => a.id === ann.id) + 1;
}

export default function ImageAnnotator({ imageUrl, imageIndex = 0, annotations = [], onAdd, onRemove, readonly = false, activeDimension = 'clarity', dragDisabled = false, seqPool, highlightedId }) {
  const containerRef = useRef(null);
  const [dragging, setDragging]       = useState(false);
  const [dragStart, setDragStart]     = useState({ x: 0, y: 0 });
  const [dragRect, setDragRect]       = useState(null);
  const [popup, setPopup]             = useState(null);
  const [popupForm, setPopupForm]     = useState({ dimension: 'clarity', score: 3 });
  const [selectedAnn, setSelectedAnn] = useState(null);
  const [imgError, setImgError]       = useState(false);

  useEffect(() => { setImgError(false); }, [imageUrl]);

  const getRelativePct = useCallback((clientX, clientY) => {
    const rect = containerRef.current.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(100, ((clientX - rect.left)  / rect.width)  * 100)),
      y: Math.max(0, Math.min(100, ((clientY - rect.top)   / rect.height) * 100)),
    };
  }, []);

  const handleMouseDown = useCallback((e) => {
    if (readonly || dragDisabled) return;
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
        setPopupForm({ dimension: activeDimension, score: 3 });
      }
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [dragging, dragStart, getRelativePct, activeDimension]);

  const handleConfirm = () => {
    onAdd({
      image_index: imageIndex,
      x_pct: popup.x,
      y_pct: popup.y,
      w_pct: popup.w,
      h_pct: popup.h,
      dimension: popupForm.dimension,
      score:     popupForm.score,
      comment:   '',
    });
    setPopup(null);
  };

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      {/* 이미지 + 드래그 레이어 */}
      <div
        ref={containerRef}
        onMouseDown={imgError ? undefined : handleMouseDown}
        style={{
          position: 'relative',
          display: 'block',
          width: '100%',
          cursor: (readonly || dragDisabled || imgError) ? 'default' : 'crosshair',
          userSelect: 'none',
        }}
      >
        {imgError ? (
          <div style={{
            width: '100%', minHeight: 240, background: 'var(--bg-2, #f4f4f5)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 8, color: 'var(--text-3, #9ca3af)', fontSize: 13,
          }}>
            <span style={{ fontSize: 32 }}>🖼️</span>
            <span>이미지를 불러올 수 없습니다</span>
            <span style={{ fontSize: 11, opacity: 0.7, maxWidth: 300, textAlign: 'center', wordBreak: 'break-all' }}>{imageUrl}</span>
          </div>
        ) : (
          <img
            src={imageUrl}
            alt="검증 이미지"
            draggable={false}
            onError={() => setImgError(true)}
            style={{ display: 'block', width: '100%', pointerEvents: 'none' }}
          />
        )}

        {/* 기존 어노테이션 오버레이 */}
        {!imgError && annotations.map(ann => {
          const meta = dimMeta[ann.dimension];
          const seqNum = getDimSeq(seqPool || annotations, ann);
          const isSelected = selectedAnn === ann.id;
          const isHidden = highlightedId !== null && highlightedId !== undefined && ann.id !== highlightedId;
          const showBelow = ann.y_pct < 25;
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
                background: meta.bg,
                border: `2px solid ${meta.color}`,
                borderRadius: 3,
                cursor: readonly ? 'default' : 'crosshair',
                boxSizing: 'border-box',
                display: isHidden ? 'none' : undefined,
              }}
            >
              {/* 번호 뱃지 */}
              <div style={{
                position: 'absolute', top: -1, left: -1,
                background: meta.color, color: '#fff',
                fontSize: 10, fontWeight: 700, padding: '1px 5px',
                borderRadius: '2px 0 2px 0', lineHeight: 1.6,
                whiteSpace: 'nowrap',
              }}>
                {seqNum}
              </div>

              {/* 툴팁 */}
              {isSelected && (
                <div
                  onClick={e => e.stopPropagation()}
                  style={{
                    position: 'absolute',
                    ...(showBelow ? { top: 'calc(100% + 6px)' } : { bottom: 'calc(100% + 6px)' }), left: 0,
                    background: 'var(--bg)', border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)', padding: '8px 12px',
                    minWidth: 160, maxWidth: 240, zIndex: 20,
                    boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
                    fontSize: 12,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: ann.comment ? 6 : 0 }}>
                    <span style={{ background: meta.color, color: '#fff', borderRadius: 4, padding: '2px 7px', fontSize: 11, fontWeight: 700 }}>
                      {seqNum}
                    </span>
                    <span style={{ color: 'var(--text-2)', fontWeight: 700 }}>{ann.score}점</span>
                    <span
                      style={{ marginLeft: 'auto', cursor: 'pointer', color: 'var(--text-3)', fontSize: 14, lineHeight: 1 }}
                      onClick={() => setSelectedAnn(null)}
                    >×</span>
                  </div>
                  {ann.comment && (
                    <div style={{ color: 'var(--text-2)', lineHeight: 1.5, marginBottom: readonly ? 0 : 6 }}>{ann.comment}</div>
                  )}
                  {!readonly && (
                    <button
                      onClick={() => { onRemove(ann.id); setSelectedAnn(null); }}
                      style={{ fontSize: 11, color: 'var(--red)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                    >
                      삭제
                    </button>
                  )}
                </div>
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
      {!readonly && !dragDisabled && annotations.length === 0 && (
        <div style={{
          position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(0,0,0,0.55)', color: '#fff',
          fontSize: 12, padding: '5px 14px', borderRadius: 20, pointerEvents: 'none',
          whiteSpace: 'nowrap',
        }}>
          이미지 위를 드래그해서 영역을 지정하세요
        </div>
      )}

      {/* 영역 설정 팝업 — Framer Motion CSS transform 컨텍스트를 벗어나도록 portal 사용 (D-19) */}
      {popup && ReactDOM.createPortal(
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
              borderRadius: 'var(--radius-lg)', padding: 28, width: 380, maxWidth: '90vw',
              boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
            }}
          >
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>영역 설정</div>

            {/* 선택된 지표 고정 표시 */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 8 }}>평가 항목</div>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '7px 16px', borderRadius: 'var(--radius)',
                background: dimMeta[popupForm.dimension]?.bg,
                border: `2px solid ${dimMeta[popupForm.dimension]?.color}`,
                color: dimMeta[popupForm.dimension]?.color,
                fontWeight: 700, fontSize: 14,
              }}>
                {dimMeta[popupForm.dimension]?.label}
                <span style={{ fontSize: 11, opacity: 0.65, fontWeight: 400 }}>선택됨</span>
              </div>
            </div>

            {/* 점수 선택 */}
            <div style={{ marginBottom: 24 }}>
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

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <Btn variant="secondary" size="sm" onClick={() => setPopup(null)}>취소</Btn>
              <Btn size="sm" onClick={handleConfirm}>추가</Btn>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
