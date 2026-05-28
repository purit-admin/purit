import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, X } from 'lucide-react';
import { Card, Btn } from '../../components/ui';
import { supabase } from '../../lib/supabase';

const ACCENT = '#10367D';
const BORDER = '#E2E8F0';
const T1     = '#0F172A';
const T2     = '#475569';
const T3     = '#94A3B8';

const LINKEDIN_RE = /^https?:\/\/(www\.)?linkedin\.com\/in\/.+/i;
const URL_RE      = /^https?:\/\/.+/i;

function UploadZone({ file, onFile, accept = '.pdf,.jpg,.jpeg,.png', label = '파일 업로드' }) {
  const inputRef = useRef(null);
  const [drag, setDrag]   = useState(false);
  const handleDrop = e => {
    e.preventDefault(); setDrag(false);
    const f = e.dataTransfer.files?.[0]; if (f) onFile(f);
  };
  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={e => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={handleDrop}
      style={{
        border: `2px dashed ${drag ? ACCENT : BORDER}`, borderRadius: 10,
        padding: '16px 14px', background: drag ? 'rgba(16,54,125,0.04)' : '#fff',
        cursor: 'pointer', textAlign: 'center', transition: 'all 0.15s',
      }}
    >
      <input ref={inputRef} type="file" accept={accept} style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
      {file ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <Upload size={14} color={ACCENT} />
          <span style={{ fontSize: 13, color: ACCENT, fontWeight: 600 }}>{file.name}</span>
          <button type="button"
            onClick={e => { e.stopPropagation(); onFile(null); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: T3, padding: 0, display: 'flex' }}>
            <X size={14} />
          </button>
        </div>
      ) : (
        <div>
          <Upload size={20} color={T3} style={{ margin: '0 auto 6px' }} />
          <div style={{ fontSize: 13, color: T2 }}>{label}</div>
          <div style={{ fontSize: 11, color: T3, marginTop: 3 }}>클릭하거나 파일을 여기에 끌어놓으세요</div>
        </div>
      )}
    </div>
  );
}

export default function VerifyDocs() {
  const navigate = useNavigate();

  const [certFile,      setCertFile]      = useState(null);
  const [careerChoice,  setCareerChoice]  = useState(null);
  const [linkedinUrl,   setLinkedinUrl]   = useState('');
  const [portfolioFile, setPortfolioFile] = useState(null);
  const [portfolioText, setPortfolioText] = useState('');
  const [submitting,    setSubmitting]    = useState(false);
  const [error,         setError]         = useState('');

  const handleSubmit = async () => {
    setError('');
    if (!certFile) {
      setError('건강보험 자격득실 확인서를 첨부해 주세요.'); return;
    }
    if (!careerChoice) {
      setError('LinkedIn 프로필 또는 포트폴리오/이력서 중 하나를 선택해 주세요.'); return;
    }
    if (careerChoice === 'linkedin') {
      if (!linkedinUrl.trim()) { setError('LinkedIn 프로필 URL을 입력해 주세요.'); return; }
      if (!LINKEDIN_RE.test(linkedinUrl.trim())) { setError('올바른 LinkedIn URL을 입력해 주세요. (예: https://linkedin.com/in/홍길동)'); return; }
    }
    if (careerChoice === 'portfolio' && !portfolioText.trim() && !portfolioFile) {
      setError('포트폴리오/이력서 URL을 입력하거나 파일을 첨부해 주세요.'); return;
    }
    if (careerChoice === 'portfolio' && portfolioText.trim() && !URL_RE.test(portfolioText.trim())) {
      setError('올바른 URL 형식을 입력해 주세요. (예: https://...)'); return;
    }

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      let healthInsuranceUrl = null;
      let portfolioFileUrl   = null;

      if (certFile) {
        const ext  = certFile.name.split('.').pop();
        const path = `${user.id}/health_insurance.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from('panel-verification-docs').upload(path, certFile, { upsert: true });
        if (!uploadErr) healthInsuranceUrl = path;
        else console.warn('[VerifyDocs] 건강보험 파일 업로드 실패:', uploadErr.message);
      }

      if (portfolioFile) {
        const ext  = portfolioFile.name.split('.').pop();
        const path = `${user.id}/portfolio.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from('panel-verification-docs').upload(path, portfolioFile, { upsert: true });
        if (!uploadErr) portfolioFileUrl = path;
        else console.warn('[VerifyDocs] 포트폴리오 파일 업로드 실패:', uploadErr.message);
      }

      const { error: rpcErr } = await supabase.rpc('save_panel_verification_docs', {
        p_user_id:              user.id,
        p_health_insurance_url: healthInsuranceUrl || null,
        p_linkedin_url:         careerChoice === 'linkedin' ? (linkedinUrl.trim() || null) : null,
        p_portfolio_url:        portfolioFileUrl || (careerChoice === 'portfolio' ? portfolioText.trim() || null : null),
      });

      if (rpcErr) { setError('저장 중 오류가 발생했습니다. 다시 시도해 주세요.'); return; }
      navigate('/panel');
    } catch {
      setError('오류가 발생했습니다. 다시 시도해 주세요.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 24px' }}>
    <div style={{ width: '100%', maxWidth: 560 }}>
      <div style={{ marginBottom: 28, textAlign: 'center' }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: T1, marginBottom: 6 }}>경력 인증 서류 제출</div>
        <div style={{ fontSize: 14, color: T2 }}>심사 승인을 위해 아래 서류를 제출해 주세요.</div>
      </div>

      {/* 건강보험 자격득실 확인서 */}
      <Card style={{ padding: '20px 22px', marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: T1, marginBottom: 4 }}>
          연차 인증 (건강보험 자격득실 확인서) <span style={{ color: '#E53E3E', fontSize: 13 }}>*</span>
        </div>
        <div style={{ fontSize: 13, color: T2, marginBottom: 4 }}>
          토스 · 카카오톡에서 30초 발급 가능합니다.
        </div>
        <div style={{ fontSize: 12, color: T3, marginBottom: 12 }}>
          PDF 또는 이미지, 5MB 이하
        </div>
        <UploadZone
          file={certFile} onFile={setCertFile}
          accept=".pdf,.jpg,.jpeg,.png"
          label="자격득실 확인서 업로드"
        />
      </Card>

      {/* 경력 인증 */}
      <Card style={{ padding: '20px 22px', marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: T1, marginBottom: 4 }}>
          경력 인증 <span style={{ color: '#E53E3E', fontSize: 13 }}>*</span>
        </div>
        <div style={{ fontSize: 13, color: T2, marginBottom: 14 }}>아래 중 하나를 선택해 주세요.</div>

        {/* 선택 카드 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
          {[
            { id: 'linkedin',  label: 'LinkedIn 프로필', desc: '링크드인 프로필 URL 입력' },
            { id: 'portfolio', label: '포트폴리오 / 이력서', desc: 'URL 입력 또는 파일 업로드' },
          ].map(opt => (
            <button key={opt.id} type="button"
              onClick={() => setCareerChoice(opt.id)}
              style={{
                width: '100%', padding: '12px 14px', borderRadius: 10,
                border: careerChoice === opt.id ? `2px solid ${ACCENT}` : `1.5px solid ${BORDER}`,
                background: careerChoice === opt.id ? 'rgba(16,54,125,0.05)' : '#fff',
                textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 600, color: careerChoice === opt.id ? ACCENT : T1 }}>{opt.label}</div>
              <div style={{ fontSize: 12, color: T3, marginTop: 2 }}>{opt.desc}</div>
            </button>
          ))}
        </div>

        {/* LinkedIn URL 입력 */}
        {careerChoice === 'linkedin' && (
          <input
            type="url"
            placeholder="https://linkedin.com/in/홍길동"
            value={linkedinUrl}
            onChange={e => setLinkedinUrl(e.target.value)}
            style={{
              width: '100%', padding: '11px 13px', borderRadius: 9,
              border: `1px solid ${BORDER}`, fontSize: 14,
              fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
            }}
            onFocus={e => { e.target.style.borderColor = ACCENT; e.target.style.boxShadow = '0 0 0 3px rgba(16,54,125,0.10)'; }}
            onBlur={e => { e.target.style.borderColor = BORDER; e.target.style.boxShadow = 'none'; }}
          />
        )}

        {/* 포트폴리오 URL + 파일 */}
        {careerChoice === 'portfolio' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input
              type="url"
              placeholder="https://notion.so/내_포트폴리오 (선택)"
              value={portfolioText}
              onChange={e => setPortfolioText(e.target.value)}
              style={{
                width: '100%', padding: '11px 13px', borderRadius: 9,
                border: `1px solid ${BORDER}`, fontSize: 14,
                fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
              }}
              onFocus={e => { e.target.style.borderColor = ACCENT; e.target.style.boxShadow = '0 0 0 3px rgba(16,54,125,0.10)'; }}
              onBlur={e => { e.target.style.borderColor = BORDER; e.target.style.boxShadow = 'none'; }}
            />
            <UploadZone
              file={portfolioFile} onFile={setPortfolioFile}
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
              label="파일로 업로드 (선택)"
            />
          </div>
        )}
      </Card>

      {/* 에러 */}
      {error && (
        <div style={{
          fontSize: 13, color: '#C53030', background: '#FFF5F5',
          border: '1px solid #FED7D7', borderRadius: 8, padding: '10px 14px', marginBottom: 14,
        }}>
          {error}
        </div>
      )}

      {/* 제출 버튼 */}
      <Btn
        onClick={handleSubmit}
        disabled={submitting}
        style={{ width: '100%', padding: '14px 0', fontSize: 15, fontWeight: 700, borderRadius: 10 }}
      >
        {submitting ? '제출 중...' : '서류 제출하기 →'}
      </Btn>

      <div style={{ fontSize: 12, color: T3, textAlign: 'center', marginTop: 12 }}>
        서류 검토 후 어드민이 심사를 완료하면 미션 참여가 가능합니다.
      </div>
    </div>
    </div>
  );
}
