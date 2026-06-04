import { useState } from 'react';
import ReactDOM from 'react-dom';
import { X, ImagePlus } from 'lucide-react';
import { Btn } from './index';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

const REPORT_TYPES = [
  { key: 'bug',     label: '🐛 버그/오류' },
  { key: 'ux',      label: '😕 UX 불편' },
  { key: 'data',    label: '📊 데이터 이상' },
  { key: 'feature', label: '💡 기능 제안' },
  { key: 'appeal',  label: '⚖️ 이의 신청' },
  { key: 'other',   label: '기타' },
];

export default function BugReportModal({ onClose, pageUrl }) {
  const { user, role } = useAuth();
  const [type, setType] = useState('bug');
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState('');

  async function handleSubmit() {
    if (!title.trim() || !desc.trim()) {
      setErr('제목과 상세 내용을 입력해 주세요.');
      return;
    }
    setSubmitting(true);
    setErr('');

    let screenshot_url = null;
    if (file) {
      const ext = file.name.split('.').pop();
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('bug-screenshots')
        .upload(path, file);
      if (!upErr) {
        const { data } = supabase.storage.from('bug-screenshots').getPublicUrl(path);
        screenshot_url = data.publicUrl;
      } else {
        console.warn('[bug-screenshot upload]', upErr.message);
      }
    }

    const { error: insErr } = await supabase.from('bug_reports').insert({
      user_id: user.id,
      role: role || 'company',
      type,
      page_url: pageUrl || '',
      title: title.trim(),
      description: desc.trim(),
      screenshot_url,
      status: 'pending',
    });

    if (insErr) {
      setErr('제출 중 오류가 발생했습니다. 다시 시도해 주세요.');
      setSubmitting(false);
      return;
    }

    setDone(true);
    setSubmitting(false);
    setTimeout(onClose, 2200);
  }

  function handleFileChange(e) {
    const f = e.target.files[0];
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) {
      setErr('파일 크기는 5MB 이하여야 합니다.');
      return;
    }
    setErr('');
    setFile(f);
  }

  const modal = (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: 16,
          width: '100%', maxWidth: 520,
          boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
          overflow: 'hidden',
        }}
      >
        {/* 헤더 */}
        <div style={{
          padding: '18px 20px 16px',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>버그 / 불편 신고</div>
            {pageUrl && (
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 3, fontFamily: 'monospace' }}>
                {pageUrl}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-3)', display: 'flex', alignItems: 'center', padding: 2,
            }}
          >
            <X size={18} />
          </button>
        </div>

        {done ? (
          <div style={{ padding: '52px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: 36 }}>✅</div>
            <div style={{ marginTop: 14, fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>
              리포트가 제출되었습니다!
            </div>
            <div style={{ marginTop: 6, fontSize: 13, color: 'var(--text-3)' }}>
              피드백 주셔서 감사합니다. 빠르게 확인하겠습니다.
            </div>
          </div>
        ) : (
          <div style={{ padding: 20 }}>
            {/* 유형 */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                유형
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {REPORT_TYPES.map(t => (
                  <button
                    key={t.key}
                    onClick={() => setType(t.key)}
                    style={{
                      padding: '5px 13px', borderRadius: 20, fontSize: 12, fontWeight: 500,
                      cursor: 'pointer', border: '1.5px solid',
                      borderColor: type === t.key ? 'var(--accent)' : 'var(--border)',
                      background: type === t.key ? 'var(--accent-dim)' : 'transparent',
                      color: type === t.key ? 'var(--accent)' : 'var(--text-2)',
                      transition: 'all 0.12s',
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 제목 */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                제목
              </div>
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="어떤 문제가 발생했나요?"
                style={{
                  width: '100%', padding: '9px 12px', borderRadius: 8, fontSize: 13,
                  border: '1.5px solid var(--border)', outline: 'none',
                  fontFamily: 'var(--font-ui)', color: 'var(--text)', boxSizing: 'border-box',
                  transition: 'border-color 0.15s',
                }}
                onFocus={e => e.target.style.borderColor = 'var(--accent)'}
                onBlur={e => e.target.style.borderColor = 'var(--border)'}
              />
            </div>

            {/* 상세 내용 */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                상세 내용
              </div>
              <textarea
                value={desc}
                onChange={e => setDesc(e.target.value)}
                placeholder="재현 방법, 발생 상황, 기대했던 동작 등을 적어주세요."
                rows={4}
                style={{
                  width: '100%', padding: '9px 12px', borderRadius: 8, fontSize: 13,
                  border: '1.5px solid var(--border)', outline: 'none', resize: 'vertical',
                  fontFamily: 'var(--font-ui)', color: 'var(--text)', lineHeight: 1.65,
                  boxSizing: 'border-box', transition: 'border-color 0.15s',
                }}
                onFocus={e => e.target.style.borderColor = 'var(--accent)'}
                onBlur={e => e.target.style.borderColor = 'var(--border)'}
              />
            </div>

            {/* 스크린샷 */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                스크린샷 <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(선택)</span>
              </div>
              <label style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '9px 14px', borderRadius: 8, cursor: 'pointer',
                border: '1.5px dashed ' + (file ? 'var(--accent)' : 'var(--border)'),
                color: file ? 'var(--accent)' : 'var(--text-3)', fontSize: 13,
                background: file ? 'var(--accent-dim2)' : 'transparent',
                transition: 'all 0.15s',
              }}>
                <ImagePlus size={15} />
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {file ? file.name : '파일 선택 (PNG, JPG — 최대 5MB)'}
                </span>
                {file && (
                  <span
                    onClick={e => { e.preventDefault(); setFile(null); }}
                    style={{ color: 'var(--text-3)', fontSize: 11, flexShrink: 0 }}
                  >
                    ✕ 제거
                  </span>
                )}
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />
              </label>
            </div>

            {err && (
              <div style={{ fontSize: 12, color: 'var(--red)', marginBottom: 12 }}>{err}</div>
            )}

            {/* 버튼 */}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <Btn variant="secondary" size="sm" onClick={onClose}>취소</Btn>
              <Btn variant="primary" size="sm" onClick={handleSubmit} disabled={submitting}>
                {submitting ? '제출 중...' : '제출하기 →'}
              </Btn>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return ReactDOM.createPortal(modal, document.body);
}
