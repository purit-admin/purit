import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import ReactDOM from 'react-dom';
import { Btn, Card, Badge, ConfirmModal } from '../../components/ui';
import PanelTargetStep, { calcCredits, calcPanelPayout, CAREER_LEVELS } from '../../components/ui/PanelTargetStep';
import { supabase } from '../../lib/supabase';
import { navigationGuard } from '../../lib/navigationGuard';
import { QUESTION_TEMPLATES, TYPE_LABEL, TYPE_COLOR } from '../../lib/templates';

const STEPS = ['서비스/타겟 설정', '소재 업로드', '질문 설정', '패널 설정', '검토 & 제출'];
const MAX_IMAGES = 3;
const MAX_FILE_SIZE = 5 * 1024 * 1024;

const INDUSTRIES = [
  '뷰티/코스메틱', '헬스/피트니스', '식품/음료', '패션/의류',
  'SaaS/소프트웨어', '교육/에듀테크', '금융/핀테크', '여행/숙박',
  '부동산/인테리어', '의료/헬스케어', '반려동물', '게임/엔터테인먼트',
  '이커머스/리테일', '자동차/모빌리티', '미디어/콘텐츠', 'B2B 서비스',
  'HR/채용', '법률/컨설팅', '물류/배송', '환경/에너지',
];

export default function NewMission() {
  const navigate = useNavigate();
  const location = useLocation();
  const isEditMode      = Boolean(location.state?.editMode);
  const editMissionId   = location.state?.missionId   || null;
  const initTemplateId   = location.state?.templateId   || null;
  const initTemplateName = location.state?.templateName || null;

  const fileInputRef = useRef(null);
  const [view, setView]         = useState(isEditMode ? 'form' : 'list');
  const [step, setStep]         = useState(0);
  const [missionUuid] = useState(() => editMissionId || crypto.randomUUID());
  const [form, setForm] = useState({
    product: '', lpUrl: '',
    personaAge: '', personaIncome: '', personaRole: '', personaContext: '',
    industry: '',
    panels: 10, briefText: '', focusAreas: [],
    imageUrls: [],
    estimatedMinutes: 5,
  });
  const [industryOpen,        setIndustryOpen]        = useState(false);
  const [industryCustomMode,  setIndustryCustomMode]  = useState(false);
  const [industryCustomInput, setIndustryCustomInput] = useState('');
  const [uploading, setUploading]         = useState(false);
  const [uploadError, setUploadError]     = useState('');
  const [submitting, setSubmitting]       = useState(false);
  const [submitError, setSubmitError]     = useState('');
  const [companyPlan, setCompanyPlan]     = useState(null);
  const [companyId, setCompanyId]         = useState(null);
  const [creditBalance, setCreditBalance] = useState(null);
  const [careerLevels, setCareerLevels]   = useState(['junior']);
  const [missions, setMissions]           = useState([]);
  const [loadingList, setLoadingList]     = useState(true);
  const [listFilter, setListFilter]       = useState('active');
  const [savingDraft, setSavingDraft]     = useState(false);
  const [isDraftMode, setIsDraftMode]     = useState(false);
  const [showDraftModal, setShowDraftModal] = useState(false);
  const [deleteTarget, setDeleteTarget]     = useState(null);
  const [terminateTarget, setTerminateTarget] = useState(null);
  const [pendingNavPath, setPendingNavPath] = useState(null);

  // 질문 설정 state
  const [selectedQuestions, setSelectedQuestions] = useState([]);
  const [localCustomQs,     setLocalCustomQs]     = useState([]);
  const [expandedTmpl,      setExpandedTmpl]      = useState({});
  const [customLPQs,        setCustomLPQs]        = useState([]);
  const [newQText,           setNewQText]          = useState('');
  const [newQType,           setNewQType]          = useState('text');
  const [newQOptions,        setNewQOptions]       = useState(['', '']);
  const [newQScaleMin,       setNewQScaleMin]      = useState('');
  const [newQScaleMax,       setNewQScaleMax]      = useState('');
  const [showSaveModal,      setShowSaveModal]     = useState(false);
  const [savingToTemplate,   setSavingToTemplate]  = useState(false);

  // 플랜 & company id 로드
  useEffect(() => {
    async function fetchPlan() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from('companies').select('id, plan, credit_balance').eq('user_id', user.id).single();
      setCompanyPlan(data?.plan?.toLowerCase() || 'starter');
      if (data?.id) setCompanyId(data.id);
      if (data != null) setCreditBalance(data.credit_balance ?? 0);
    }
    fetchPlan();
  }, []);

  // DB 커스텀 LP 질문 로드
  useEffect(() => {
    if (!companyId) return;
    async function loadCustomLPQs() {
      const { data } = await supabase
        .from('question_templates')
        .select('template_questions(id, question_text, question_type, options, question_order)')
        .eq('company_id', companyId)
        .eq('category', '랜딩페이지')
        .eq('is_default', false);
      const qs = (data || []).flatMap(t =>
        (t.template_questions || [])
          .sort((a, b) => a.question_order - b.question_order)
          .map(q => ({
            id: q.id,
            text: q.question_text,
            type: q.question_type || 'text',
            options: Array.isArray(q.options) ? q.options : (() => { try { return JSON.parse(q.options || '[]'); } catch { return []; } })(),
          }))
      );
      setCustomLPQs(qs);
    }
    loadCustomLPQs();
  }, [companyId]);

  // 의뢰 목록 로드 (list 뷰)
  useEffect(() => {
    if (view !== 'list') return;
    async function loadMissions() {
      setLoadingList(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoadingList(false); return; }
      const { data: co } = await supabase.from('companies').select('id').eq('user_id', user.id).single();
      if (co) {
        const { data } = await supabase.from('missions')
          .select('id, title, status, panel_count, filled_count, created_at')
          .eq('company_id', co.id)
          .or('type.is.null,type.eq.landing_page')
          .order('created_at', { ascending: false });
        setMissions(data || []);
      }
      setLoadingList(false);
    }
    loadMissions();
  }, [view]);

  // 질문 템플릿 페이지에서 templateId/templateName 전달 시 해당 템플릿 미리 선택
  useEffect(() => {
    if (!initTemplateId) return;
    setView('form');
    if (initTemplateName) {
      const target = (QUESTION_TEMPLATES.lp || []).find(t => t.name === initTemplateName);
      if (target) {
        setSelectedQuestions(target.questions.slice(0, 5));
        setExpandedTmpl({ [target.id]: true });
        setStep(2);
      }
    }
  }, []);

  // 편집 모드: 기존 미션 데이터 pre-fill
  useEffect(() => {
    if (!isEditMode || !editMissionId) return;
    async function load() {
      const { data: ms } = await supabase.from('missions').select('*').eq('id', editMissionId).single();
      if (!ms) return;
      if (ms.status === 'draft') setIsDraftMode(true);
      let parsed = {};
      try { parsed = JSON.parse(ms.description || '{}'); } catch {}
      setForm(f => ({
        ...f,
        product:        parsed.product || ms.title || '',
        lpUrl:          ms.target_url || '',
        briefText:      parsed.briefText || '',
        panels:         ms.panel_count || 10,
        focusAreas:     parsed.focusAreas || ms.assets || [],
        imageUrls:      ms.image_urls || [],
        industry:       parsed.industry || '',
        personaAge:     parsed.personaAge || '',
        personaIncome:  parsed.personaIncome || '',
        personaRole:    parsed.personaRole || '',
        personaContext: parsed.personaContext || '',
      }));
      if (Array.isArray(parsed.selectedQuestions)) setSelectedQuestions(parsed.selectedQuestions);
      if (Array.isArray(parsed.careerLevels)) setCareerLevels(parsed.careerLevels);
      if (parsed.step != null) setStep(parsed.step);
    }
    load();
  }, []);

  const FOCUS = ['첫인상 / 가독성', 'CTA 전환율', '가격 및 가치 전달', '신뢰 요소', '모바일 최적화', '핵심 메시지 명확성', '비주얼 완성도', '타겟 일치도'];

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const toggleFocus = (f) => setForm(prev => ({
    ...prev,
    focusAreas: prev.focusAreas.includes(f) ? prev.focusAreas.filter(x => x !== f) : [...prev.focusAreas, f],
  }));

  // 질문 설정 헬퍼
  const lpTemplates      = QUESTION_TEMPLATES.lp || [];
  const allLPSelected    = [...selectedQuestions, ...localCustomQs];
  const totalLPSelected  = allLPSelected.length;
  const textLPSelected   = allLPSelected.filter(q => q.type === 'text').length;
  const canAddLPQ        = (q) => totalLPSelected < 5 && !(q.type === 'text' && textLPSelected >= 2);
  const toggleLPQuestion = (q) => {
    const sel = selectedQuestions.some(s => s.id === q.id);
    if (sel) setSelectedQuestions(prev => prev.filter(s => s.id !== q.id));
    else if (canAddLPQ(q)) setSelectedQuestions(prev => [...prev, q]);
  };

  function handleAddLocalQ() {
    if (!newQText.trim()) return;
    if (!canAddLPQ({ type: newQType })) return;
    const options =
      newQType === 'radio' ? newQOptions.filter(o => o.trim()) :
      newQType === 'scale' ? [newQScaleMin.trim(), newQScaleMax.trim()] : [];
    setLocalCustomQs(prev => [...prev, { id: `local-${Date.now()}`, text: newQText.trim(), type: newQType, options }]);
    setNewQText(''); setNewQType('text'); setNewQOptions(['', '']); setNewQScaleMin(''); setNewQScaleMax('');
  }

  async function handleSaveTmpl() {
    if (!newQText.trim() || !companyId) return;
    setSavingToTemplate(true);
    const options =
      newQType === 'radio' ? newQOptions.filter(o => o.trim()) :
      newQType === 'scale' ? [newQScaleMin.trim(), newQScaleMax.trim()] : [];
    try {
      let { data: tmpl } = await supabase
        .from('question_templates').select('id')
        .eq('company_id', companyId).eq('category', '랜딩페이지').eq('is_default', false)
        .maybeSingle();
      if (!tmpl) {
        const { data: newT, error: tErr } = await supabase
          .from('question_templates')
          .insert({ company_id: companyId, name: '내 커스텀 질문', category: '랜딩페이지', icon: '✏️', description: '직접 만든 질문 모음', is_default: false })
          .select().single();
        if (tErr) throw tErr;
        tmpl = newT;
      }
      const { data: newQ, error: qErr } = await supabase.from('template_questions').insert({
        template_id: tmpl.id, question_text: newQText.trim(), question_type: newQType,
        options, question_order: customLPQs.length + 1,
      }).select().single();
      if (qErr) throw qErr;
      const saved = {
        id: newQ.id, text: newQ.question_text, type: newQ.question_type,
        options: Array.isArray(newQ.options) ? newQ.options : (() => { try { return JSON.parse(newQ.options || '[]'); } catch { return []; } })(),
      };
      setCustomLPQs(prev => [...prev, saved]);
      setLocalCustomQs(prev => [...prev, { ...saved, id: `local-${Date.now()}` }]);
      setNewQText(''); setNewQType('text'); setNewQOptions(['', '']); setNewQScaleMin(''); setNewQScaleMax('');
      setShowSaveModal(false);
    } catch (e) {
      console.error('[NewMission] 템플릿 저장 실패:', e.message);
    } finally {
      setSavingToTemplate(false);
    }
  }

  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    const remaining = MAX_IMAGES - form.imageUrls.length;
    const toUpload = files.slice(0, remaining);

    for (const file of toUpload) {
      if (file.size > MAX_FILE_SIZE) {
        setUploadError(`${file.name}이 5MB를 초과합니다.`);
        e.target.value = '';
        return;
      }
    }

    setUploading(true);
    setUploadError('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: company } = await supabase.from('companies').select('id').eq('user_id', user.id).single();

      const urls = [];
      for (const file of toUpload) {
        const ext = file.name.split('.').pop().toLowerCase();
        const path = `${company.id}/${missionUuid}/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from('mission-assets').upload(path, file, { upsert: false });
        if (error) throw error;
        const { data: { publicUrl } } = supabase.storage.from('mission-assets').getPublicUrl(path);
        urls.push(publicUrl);
      }
      set('imageUrls', [...form.imageUrls, ...urls]);
    } catch (err) {
      setUploadError('업로드 실패: ' + err.message);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const removeImage = (url) => {
    set('imageUrls', form.imageUrls.filter(u => u !== url));
  };

  const shouldBlockNav = view === 'form'
    && (!isEditMode || isDraftMode)
    && Boolean(form.product || form.lpUrl || form.briefText || form.imageUrls.length > 0);


  useEffect(() => {
    const handler = (e) => { if (shouldBlockNav) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [shouldBlockNav]);

  useEffect(() => {
    if (shouldBlockNav) {
      navigationGuard.register({
        onAttempt: (path) => { setPendingNavPath(path); setShowDraftModal(true); },
      });
    } else {
      navigationGuard.unregister();
    }
    return () => navigationGuard.unregister();
  }, [shouldBlockNav]);

  async function handleDeleteMission() {
    if (!deleteTarget) return;
    await supabase.from('missions').delete().eq('id', deleteTarget);
    setMissions(prev => prev.filter(m => m.id !== deleteTarget));
    setDeleteTarget(null);
  }

  async function handleTerminate() {
    if (!terminateTarget) return;
    const { error } = await supabase
      .from('missions')
      .update({ status: 'cancelled' })
      .eq('id', terminateTarget.id);
    if (!error) {
      setMissions(prev => prev.map(m => m.id === terminateTarget.id ? { ...m, status: 'cancelled' } : m));
    }
    setTerminateTarget(null);
  }

  async function saveDraft() {
    if (!companyId) return;
    if (isEditMode && !isDraftMode) return;
    setSavingDraft(true);
    try {
      const persona = [
        form.personaAge && `연령: ${form.personaAge}`,
        form.personaIncome && `소득: ${form.personaIncome}`,
        form.personaRole && `직군: ${form.personaRole}`,
        form.industry && `산업군: ${form.industry}`,
        form.personaContext && form.personaContext,
      ].filter(Boolean).join(' / ');
      const desc = JSON.stringify({
        briefText: form.briefText, careerLevels, selectedQuestions: allLPSelected,
        industry: form.industry, product: form.product,
        personaAge: form.personaAge, personaIncome: form.personaIncome,
        personaRole: form.personaRole, personaContext: form.personaContext,
        focusAreas: form.focusAreas, panels: form.panels, step,
      });
      const payload = {
        company_id: companyId, title: form.product || '임시 저장된 의뢰',
        type: 'landing_page', status: 'draft', target_url: form.lpUrl || null,
        description: desc, panel_count: form.panels || 10,
        image_urls: form.imageUrls, assets: form.focusAreas, persona,
      };
      if (isEditMode && editMissionId) {
        await supabase.from('missions').update(payload).eq('id', editMissionId);
      } else {
        await supabase.from('missions').insert({ id: missionUuid, ...payload });
      }
    } catch (e) {
      console.error('[NewMission] 임시 저장 실패:', e.message);
    } finally {
      setSavingDraft(false);
    }
  }

  const buildDescription = () => {
    const base = { briefText: form.briefText, careerLevels };
    if (allLPSelected.length > 0) base.selectedQuestions = allLPSelected;
    if (form.industry) base.industry = form.industry;
    return JSON.stringify(base);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setSubmitError('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: company, error: companyError } = await supabase
        .from('companies').select('id').eq('user_id', user.id).single();
      if (companyError) throw companyError;

      const persona = [
        form.personaAge && `연령: ${form.personaAge}`,
        form.personaIncome && `소득: ${form.personaIncome}`,
        form.personaRole && `직군: ${form.personaRole}`,
        form.industry && `산업군: ${form.industry}`,
        form.personaContext && form.personaContext,
      ].filter(Boolean).join(' / ');

      const description = buildDescription();

      if (isEditMode && editMissionId) {
        const updatePayload = {
          title:         form.product || '의뢰',
          target_url:    form.lpUrl,
          description,
          persona,
          panel_count:   form.panels,
          reward_amount: calcPanelPayout(careerLevels, 'main'),
          assets:        form.focusAreas,
          image_urls:    form.imageUrls,
        };
        if (isDraftMode) updatePayload.status = 'active';
        const { error } = await supabase.from('missions').update(updatePayload).eq('id', editMissionId);
        if (error) throw error;
        if (isDraftMode) {
          const requiredCredits = calcCredits(form.panels, careerLevels, 'main');
          const { data: creditData, error: creditErr } = await supabase.rpc('reserve_mission_credits', {
            p_mission_id: editMissionId,
            p_company_id: company.id,
            p_credits:    requiredCredits,
          });
          if (creditErr || !creditData?.success) {
            await supabase.from('missions').update({ status: 'draft' }).eq('id', editMissionId);
            throw new Error(
              creditData?.error === 'INSUFFICIENT_CREDITS'
                ? `크레딧이 부족합니다. (보유: ${creditData.balance}, 필요: ${creditData.required})`
                : '크레딧 처리 중 오류가 발생했습니다.'
            );
          }
        }
      } else {
        const { error } = await supabase.from('missions').insert({
          id:                missionUuid,
          company_id:        company.id,
          title:             form.product || '의뢰',
          type:              'landing_page',
          target_url:        form.lpUrl,
          description,
          persona,
          panel_count:       form.panels,
          reward_amount:     calcCredits(form.panels, careerLevels) * 10000,
          status:            'active',
          assets:            form.focusAreas,
          image_urls:        form.imageUrls,
          estimated_minutes: form.estimatedMinutes,
        });
        if (error) throw error;

        // 크레딧 예약
        const requiredCredits = calcCredits(form.panels, careerLevels, 'main');
        const { data: creditData, error: creditErr } = await supabase.rpc('reserve_mission_credits', {
          p_mission_id: missionUuid,
          p_company_id: company.id,
          p_credits:    requiredCredits,
        });
        if (creditErr) throw creditErr;
        if (!creditData?.success) {
          await supabase.from('missions').delete().eq('id', missionUuid);
          throw new Error(
            creditData?.error === 'INSUFFICIENT_CREDITS'
              ? `크레딧이 부족합니다. (보유: ${creditData.balance}, 필요: ${creditData.required})`
              : '크레딧 처리 중 오류가 발생했습니다.'
          );
        }
      }
      navigate('/company');
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page-wrap" style={{ padding: '40px 48px', maxWidth: 760, animation: 'fadeUp 0.5s ease both' }}>

      {/* ── 목록 뷰 ── */}
      {view === 'list' && (
        <div>
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--accent)', marginBottom: 8, letterSpacing: '0.1em' }}>MAIN MISSION</div>
            <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>마케팅 소재 종합 진단</h1>
            <p style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.7 }}>
              랜딩페이지, 광고 소재, 배너 등을 실제 타겟 패널이 종합적으로 진단합니다.
            </p>
          </div>

          <Card style={{ marginBottom: 24, padding: '20px 24px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              {[
                { icon: '🖼', title: '이미지 최대 3장', desc: '랜딩페이지, 광고 소재, 배너 등 최대 3장 업로드' },
                { icon: '📐', title: '영역 어노테이션', desc: '패널이 이미지 위에 직접 영역을 지정해 피드백 제공' },
                { icon: '📊', title: '5차원 정량 평가', desc: '명확성 / 관련성 / 가치 / 차별화 / 신뢰 항목별 점수' },
                { icon: '❓', title: '추가 질문 설정', desc: '최대 5개의 커스텀 질문을 추가로 설정 가능' },
              ].map(({ icon, title, desc }) => (
                <div key={title} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 20, flexShrink: 0 }}>{icon}</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 2 }}>{title}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.5 }}>{desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* 버튼 + 탭 */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
            <Btn size="sm" onClick={() => setView('form')}>+ 새 의뢰 등록하기</Btn>
          </div>
          <div style={{ display: 'flex', gap: 0, marginBottom: 16, borderBottom: '1px solid var(--border)' }}>
            {[['all','전체'],['active','진행'],['completed','완료'],['draft','임시 저장'],['cancelled','취소']].map(([v, l]) => (
              <button key={v} onClick={() => setListFilter(v)} style={{
                padding: '7px 14px', marginBottom: -1, fontSize: 13,
                fontWeight: listFilter === v ? 700 : 500, background: 'transparent',
                color: listFilter === v ? 'var(--accent)' : 'var(--text-3)',
                borderBottom: listFilter === v ? '2px solid var(--accent)' : '2px solid transparent',
                border: 'none', borderRadius: 0, cursor: 'pointer',
              }}>{l}</button>
            ))}
          </div>

          {loadingList ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-3)', fontSize: 13 }}>로딩 중...</div>
          ) : (() => {
            const filtered = listFilter === 'all' ? missions : missions.filter(m => m.status === listFilter);
            if (missions.length === 0) return (
              <Card style={{ padding: '60px', textAlign: 'center' }}>
                <div style={{ fontSize: 40, marginBottom: 16 }}>📋</div>
                <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>등록된 의뢰가 없습니다</div>
                <div style={{ color: 'var(--text-2)', fontSize: 13, marginBottom: 24 }}>
                  마케팅 소재를 등록하고 실제 패널의 진단을 받아보세요.
                </div>
              </Card>
            );
            return (
              <div style={{ display: 'grid', gap: 14 }}>
                {filtered.length === 0 ? (
                  <Card style={{ padding: '32px', textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
                    해당 조건의 의뢰가 없습니다.
                  </Card>
                ) : filtered.map(m => {
                  const isDraft = m.status === 'draft';
                  const filled = m.filled_count ?? 0;
                  const isLive = m.status === 'active' && filled >= 1;
                  const statusBadgeType = isDraft ? 'gold'
                    : m.status === 'active' ? (filled === 0 ? 'blue' : 'green')
                    : m.status === 'completed' ? 'green' : 'gray';
                  const statusBadgeLabel = isDraft ? '임시 저장'
                    : m.status === 'active' ? (filled === 0 ? '매칭 대기' : '진행 중')
                    : m.status === 'completed' ? '완료' : '취소';
                  return (
                    <Card key={m.id} style={{ cursor: 'pointer', border: isDraft ? '1px dashed #f59e0b' : undefined }}
                      onClick={() => {
                        if (isDraft) navigate('/company/new', { state: { editMode: true, missionId: m.id } });
                        else if (m.status !== 'cancelled') navigate(`/company/results?id=${m.id}`);
                      }}>
                      <div className="mc-row">
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 7, flexWrap: 'wrap' }}>
                            <Badge type={statusBadgeType}>{statusBadgeLabel}</Badge>
                            {isLive && (
                              <span style={{ fontSize: 10, color: '#ef4444', background: 'rgba(239,68,68,0.08)', borderRadius: 4, padding: '1px 6px', fontWeight: 700 }}>
                                🔒 수정 잠금
                              </span>
                            )}
                          </div>
                          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{m.title || '마케팅 소재 종합 진단'}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
                            {new Date(m.created_at).toLocaleDateString('ko-KR')} · {filled}/{m.panel_count || 0}명 응답
                          </div>
                        </div>
                        <div className="mc-right">
                          <div style={{ fontSize: 11, color: 'var(--text-3)' }}>피드백 수집</div>
                          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--accent)' }}>
                            {filled}<span style={{ fontSize: 13, color: 'var(--text-3)', fontWeight: 400 }}> / {m.panel_count || 0}</span>
                          </div>
                          <div style={{ width: 80, height: 4, background: '#E2E8F0', borderRadius: 2, overflow: 'hidden' }}>
                            <div style={{ width: `${m.panel_count ? Math.min((filled / m.panel_count) * 100, 100) : 0}%`, height: '100%', background: isLive ? '#ef4444' : 'var(--accent)', borderRadius: 2 }} />
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
                            {new Date(m.created_at).toLocaleDateString('ko-KR')} 등록
                          </div>
                          {isDraft && (
                            <button onClick={e => { e.stopPropagation(); navigate('/company/new', { state: { editMode: true, missionId: m.id } }); }}
                              style={{ padding: '5px 12px', fontSize: 11, fontWeight: 700, borderRadius: 8, border: 'none', background: '#fef3c7', color: '#92400e', cursor: 'pointer' }}>
                              이어 작성하기 →
                            </button>
                          )}
                          {m.status === 'active' && filled === 0 && (
                            <button onClick={e => { e.stopPropagation(); navigate('/company/new', { state: { editMode: true, missionId: m.id } }); }}
                              style={{ padding: '5px 12px', fontSize: 11, fontWeight: 600, borderRadius: 8, border: 'none', background: '#F1F5F9', color: 'var(--text-2)', cursor: 'pointer', transition: 'background 0.12s' }}>
                              수정
                            </button>
                          )}
                          {m.status === 'active' && filled >= 1 && (
                            <button onClick={e => { e.stopPropagation(); setTerminateTarget(m); }}
                              style={{ padding: '5px 12px', fontSize: 11, fontWeight: 600, borderRadius: 8, border: 'none', background: 'rgba(239,68,68,0.08)', color: '#ef4444', cursor: 'pointer', transition: 'background 0.12s' }}>
                              의뢰 조기 종료
                            </button>
                          )}
                          {(isDraft || m.status === 'completed') && (
                            <button onClick={e => { e.stopPropagation(); setDeleteTarget(m.id); }}
                              style={{ padding: '5px 12px', fontSize: 11, fontWeight: 600, borderRadius: 8, border: 'none', background: 'rgba(239,68,68,0.08)', color: '#ef4444', cursor: 'pointer' }}>
                              삭제
                            </button>
                          )}
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}

      {/* ── 등록 폼 뷰 ── */}
      {view === 'form' && (
        <>
          <div style={{ marginBottom: 36 }}>
            <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--accent)', marginBottom: 8, letterSpacing: '0.1em' }}>{isEditMode ? 'EDIT MISSION' : 'NEW MISSION'}</div>
            <h1 style={{ fontSize: 28, fontWeight: 800 }}>{isEditMode ? '의뢰 수정' : '마케팅 소재 종합 진단 등록'}</h1>
          </div>

          {/* NDA 안내 배너 */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 16px', marginBottom: 10,
            background: 'var(--accent-dim)', borderRadius: 'var(--radius)',
            border: '1px solid var(--accent)',
            fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5,
          }}>
            <span style={{ fontSize: 16, flexShrink: 0 }}>🔒</span>
            평가 참가 패널은 기업의 정보를 외부에 발설할 수 없습니다.
          </div>
          {/* 패널 매칭 안내 배너 */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 16px', marginBottom: 28,
            background: 'rgba(16,185,129,0.07)', borderRadius: 'var(--radius)',
            border: '1px solid rgba(16,185,129,0.3)',
            fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5,
          }}>
            <span style={{ fontSize: 16, flexShrink: 0 }}>✨</span>
            의뢰 조건에 맞는 패널이 자동으로 매칭됩니다.
          </div>

          {/* Step indicator */}
          <div style={{ display: 'flex', gap: 0, marginBottom: 40, position: 'relative' }}>
            {STEPS.map((s, i) => (
              <div key={s} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: i === 0 ? 'flex-start' : i === STEPS.length - 1 ? 'flex-end' : 'center', gap: 8 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: i < step ? 'var(--green)' : i === step ? 'var(--accent)' : 'var(--surface-2)',
                  color: i < step ? '#FFFFFF' : i === step ? '#FFFFFF' : 'var(--text-3)',
                  fontSize: 12, fontWeight: 700, transition: 'all 0.3s',
                }}>
                  {i < step ? '✓' : i + 1}
                </div>
                <span style={{ fontSize: 11, color: i === step ? 'var(--text)' : 'var(--text-3)', fontWeight: i === step ? 600 : 400, whiteSpace: 'nowrap' }}>{s}</span>
              </div>
            ))}
          </div>

          <Card>
            {/* Step 0: 서비스 정보 & 타겟 페르소나 */}
            {step === 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>서비스 정보 & 타겟 페르소나</h2>
                <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 4 }}>검증할 서비스와 서비스 타겟에 대해 설정합니다.</p>
                <label style={lbl}>
                  <span style={lblTxt}>검증할 서비스명(의뢰명)</span>
                  <input value={form.product} onChange={e => set('product', e.target.value)} placeholder="프리미엄 러닝화 LP" />
                </label>
                {/* 산업군 선택 */}
                <div>
                  <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-2)', marginBottom: 6 }}>산업군</span>
                  <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
                    <button
                      type="button"
                      onClick={() => setIndustryOpen(o => !o)}
                      style={{
                        width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '9px 14px', background: 'var(--surface)', border: 'none', cursor: 'pointer',
                        fontSize: 13, color: form.industry ? 'var(--text)' : 'var(--text-3)', textAlign: 'left',
                      }}
                    >
                      <span>{form.industry || '산업군을 선택하세요'}</span>
                      <span style={{ transition: 'transform 0.2s', transform: industryOpen ? 'rotate(180deg)' : 'none', display: 'inline-block', color: 'var(--text-3)', fontSize: 11 }}>▼</span>
                    </button>
                    {industryOpen && (
                      <div style={{ borderTop: '1px solid var(--border)', padding: 14, background: 'var(--bg)' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {INDUSTRIES.map(ind => (
                            <button
                              key={ind} type="button"
                              onClick={() => { set('industry', ind); setIndustryCustomMode(false); setIndustryOpen(false); }}
                              style={{
                                padding: '5px 12px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
                                background: form.industry === ind ? 'var(--accent)' : 'var(--surface-2)',
                                color: form.industry === ind ? '#fff' : 'var(--text-2)',
                                border: '1px solid ' + (form.industry === ind ? 'var(--accent)' : 'var(--border)'),
                                transition: 'all 0.12s',
                              }}
                            >{ind}</button>
                          ))}
                          <button
                            type="button"
                            onClick={() => setIndustryCustomMode(m => !m)}
                            style={{
                              padding: '5px 12px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
                              background: industryCustomMode ? 'var(--blue)' : 'var(--surface-2)',
                              color: industryCustomMode ? '#fff' : 'var(--text-2)',
                              border: '1px solid ' + (industryCustomMode ? 'var(--blue)' : 'var(--border)'),
                              transition: 'all 0.12s',
                            }}
                          >✏️ 직접 쓰기</button>
                        </div>
                        {industryCustomMode && (
                          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                            <input
                              value={industryCustomInput}
                              onChange={e => setIndustryCustomInput(e.target.value)}
                              placeholder="산업군을 직접 입력하세요"
                              style={{ flex: 1, fontSize: 12, padding: '6px 10px' }}
                              onKeyDown={e => {
                                if (e.key === 'Enter' && industryCustomInput.trim()) {
                                  set('industry', industryCustomInput.trim());
                                  setIndustryOpen(false); setIndustryCustomMode(false); setIndustryCustomInput('');
                                }
                              }}
                            />
                            <Btn size="sm" onClick={() => {
                              if (industryCustomInput.trim()) {
                                set('industry', industryCustomInput.trim());
                                setIndustryOpen(false); setIndustryCustomMode(false); setIndustryCustomInput('');
                              }
                            }}>확인</Btn>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <label style={lbl}>
                  <span style={lblTxt}>랜딩페이지 URL (선택)</span>
                  <input value={form.lpUrl} onChange={e => set('lpUrl', e.target.value)} placeholder="https://your-landing-page.com" />
                </label>
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16, marginTop: 4 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14, color: 'var(--text-2)' }}>타겟 페르소나</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                      <label style={lbl}>
                        <span style={lblTxt}>연령대</span>
                        <input value={form.personaAge} onChange={e => set('personaAge', e.target.value)} placeholder="35-45세" />
                      </label>
                      <label style={lbl}>
                        <span style={lblTxt}>월 소득 수준</span>
                        <input value={form.personaIncome} onChange={e => set('personaIncome', e.target.value)} placeholder="500만 원 이상" />
                      </label>
                    </div>
                    <label style={lbl}>
                      <span style={lblTxt}>직군/역할</span>
                      <input value={form.personaRole} onChange={e => set('personaRole', e.target.value)} placeholder="직장인 러너, 마케터 등" />
                    </label>
                    <label style={lbl}>
                      <span style={lblTxt}>타겟 상세 (선택)</span>
                      <textarea value={form.personaContext} onChange={e => set('personaContext', e.target.value)}
                        placeholder={"제품: 기능성 러닝화\n퇴근 후 운동하는 30-40대 직장인. 러닝화에 10만 원 이상 지출 경험 있음"}
                        rows={3} style={{ resize: 'vertical' }} />
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* Step 1: 소재 업로드 */}
            {step === 1 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>소재 & 검증 범위</h2>
                <label style={lbl}>
                  <span style={lblTxt}>검증 포커스 (복수 선택)</span>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                    {FOCUS.map(f => (
                      <button key={f} onClick={() => toggleFocus(f)} style={{
                        padding: '6px 14px', borderRadius: 'var(--radius)', fontSize: 12, fontWeight: 500,
                        background: form.focusAreas.includes(f) ? 'var(--accent)' : 'var(--surface-2)',
                        color: form.focusAreas.includes(f) ? '#FFFFFF' : 'var(--text-2)',
                        border: '1px solid ' + (form.focusAreas.includes(f) ? 'var(--accent)' : 'var(--border)'),
                        transition: 'all 0.15s', cursor: 'pointer',
                      }}
                      onMouseEnter={e => { if (!form.focusAreas.includes(f)) e.currentTarget.style.background = 'var(--bg-3)'; }}
                      onMouseLeave={e => { if (!form.focusAreas.includes(f)) e.currentTarget.style.background = 'var(--surface-2)'; }}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                </label>

                {/* 이미지 업로드 */}
                <label style={lbl}>
                  <span style={lblTxt}>검증 이미지 업로드 (선택 · 최대 {MAX_IMAGES}장 · 5MB 이하)</span>
                  <div style={{
                    border: '2px dashed var(--border)', borderRadius: 'var(--radius)',
                    padding: '20px', textAlign: 'center',
                    background: form.imageUrls.length >= MAX_IMAGES ? 'var(--surface-2)' : 'var(--surface)',
                  }}>
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept="image/*"
                      disabled={uploading || form.imageUrls.length >= MAX_IMAGES}
                      onChange={handleImageUpload}
                      style={{ display: 'none' }}
                    />
                    <Btn
                      variant="secondary"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading || form.imageUrls.length >= MAX_IMAGES}
                    >
                      {uploading ? '업로드 중...' : '이미지 선택'}
                    </Btn>
                    <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 8 }}>
                      {form.imageUrls.length >= MAX_IMAGES
                        ? '최대 장수에 도달했습니다.'
                        : '이미지를 업로드하면 패널이 영역을 드래그해 항목별 피드백을 남깁니다.'}
                    </div>
                    {uploadError && (
                      <div style={{ fontSize: 12, color: 'var(--red)', marginTop: 8 }}>{uploadError}</div>
                    )}
                  </div>

                  {form.imageUrls.length > 0 && (
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
                      {form.imageUrls.map((url, i) => (
                        <div key={url} style={{ position: 'relative' }}>
                          <img
                            src={url}
                            alt={`업로드 ${i + 1}`}
                            style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)', display: 'block' }}
                          />
                          <button
                            onClick={() => removeImage(url)}
                            style={{
                              position: 'absolute', top: -6, right: -6,
                              width: 20, height: 20, borderRadius: '50%',
                              background: 'var(--red)', color: '#fff',
                              border: 'none', fontSize: 13, lineHeight: 1,
                              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}
                          >×</button>
                        </div>
                      ))}
                    </div>
                  )}
                </label>

                <label style={lbl}>
                  <span style={lblTxt}>패널에게 전달할 브리핑</span>
                  <textarea value={form.briefText} onChange={e => set('briefText', e.target.value)}
                    placeholder="이 LP는 러닝화 첫 구매자를 타겟으로 합니다. 스크롤 흐름과 CTA 전환 가능성을 중심으로 피드백 부탁드립니다."
                    rows={4} style={{ resize: 'vertical' }} />
                </label>
              </div>
            )}

            {/* Step 2: 질문 설정 */}
            {step === 2 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                  <div>
                    <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>질문 설정</h2>
                    <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6 }}>
                      패널에게 추가로 물을 질문을 최대 5개 선택하세요. 선택하지 않으면 기본 5차원 피드백만 수집됩니다.
                    </p>
                  </div>
                  <div style={{
                    flexShrink: 0,
                    fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 700,
                    padding: '4px 12px', borderRadius: 20,
                    background: totalLPSelected >= 5 ? 'var(--accent)' : 'var(--surface)',
                    color: totalLPSelected >= 5 ? '#fff' : 'var(--text-2)',
                    border: '1px solid var(--border)',
                    whiteSpace: 'nowrap',
                  }}>
                    {totalLPSelected}/5 선택됨
                  </div>
                </div>

                {/* 서술형 한도 안내 */}
                {textLPSelected >= 2 && (
                  <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 'var(--radius)', fontSize: 12, color: 'var(--red)' }}>
                    서술형 질문은 최대 2개까지 선택할 수 있습니다.
                  </div>
                )}

                {/* 내 커스텀 질문 그룹 (DB 저장 LP 질문) */}
                {customLPQs.length > 0 && (() => {
                  const custSelected = customLPQs.filter(q => selectedQuestions.some(s => s.id === q.id));
                  const isOpen = !!expandedTmpl['__custom_lp__'];
                  return (
                    <div style={{ border: '2px solid var(--accent)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
                      <div
                        onClick={() => setExpandedTmpl(prev => ({ ...prev, '__custom_lp__': !isOpen }))}
                        style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', background: 'var(--surface)', cursor: 'pointer', userSelect: 'none', gap: 10 }}
                      >
                        <span style={{ fontSize: 16, flexShrink: 0 }}>✏️</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>내 커스텀 질문</div>
                          <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>질문 템플릿 페이지에서 저장한 마케팅 소재 종합 진단용 질문</div>
                        </div>
                        {custSelected.length > 0 && (
                          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', marginRight: 4 }}>
                            {custSelected.length}개 선택
                          </span>
                        )}
                        <span style={{ color: 'var(--text-3)', fontSize: 11, transition: 'transform 0.2s', display: 'inline-block', transform: isOpen ? 'rotate(90deg)' : 'none' }}>▶</span>
                      </div>
                      {isOpen && (
                        <div style={{ borderTop: '1px solid var(--border)' }}>
                          {customLPQs.map((q, qi) => {
                            const isChecked = selectedQuestions.some(s => s.id === q.id);
                            const disabled  = !isChecked && !canAddLPQ(q);
                            return (
                              <div
                                key={q.id}
                                onClick={() => !disabled && toggleLPQuestion(q)}
                                style={{
                                  display: 'flex', gap: 12, alignItems: 'flex-start',
                                  padding: '11px 16px',
                                  background: isChecked ? 'rgba(232,213,163,0.07)' : 'var(--bg)',
                                  cursor: disabled ? 'not-allowed' : 'pointer',
                                  opacity: disabled ? 0.4 : 1,
                                  borderBottom: qi < customLPQs.length - 1 ? '1px solid var(--border)' : 'none',
                                  transition: 'background 0.1s',
                                }}
                              >
                                <div style={{
                                  width: 17, height: 17, borderRadius: 4, flexShrink: 0, marginTop: 2,
                                  border: `2px solid ${isChecked ? 'var(--accent)' : 'var(--border)'}`,
                                  background: isChecked ? 'var(--accent)' : 'transparent',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}>
                                  {isChecked && <span style={{ color: '#fff', fontSize: 10, fontWeight: 800, lineHeight: 1 }}>✓</span>}
                                </div>
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.55 }}>{q.text}</div>
                                  <div style={{ marginTop: 5, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                                    <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 4, fontWeight: 600, background: TYPE_COLOR[q.type] + '22', color: TYPE_COLOR[q.type] }}>
                                      {TYPE_LABEL[q.type]}
                                    </span>
                                    {q.type === 'radio' && q.options?.length > 0 && (
                                      <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{q.options.join(' / ')}</span>
                                    )}
                                    {q.type === 'scale' && (
                                      <span style={{ fontSize: 11, color: 'var(--text-3)' }}>1 — 5점</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* 템플릿 아코디언 */}
                {lpTemplates.map(tmpl => {
                  const isOpen = !!expandedTmpl[tmpl.id];
                  const selectedInTmpl = tmpl.questions.filter(q => selectedQuestions.some(s => s.id === q.id));
                  return (
                    <div key={tmpl.id} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
                      <div
                        onClick={() => setExpandedTmpl(prev => ({ ...prev, [tmpl.id]: !isOpen }))}
                        style={{
                          display: 'flex', alignItems: 'center', padding: '12px 16px',
                          background: selectedInTmpl.length > 0 ? 'var(--accent-dim)' : 'var(--surface)',
                          cursor: 'pointer', userSelect: 'none', gap: 10,
                        }}
                      >
                        <span style={{ fontSize: 16, flexShrink: 0 }}>{tmpl.icon}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{tmpl.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{tmpl.description}</div>
                        </div>
                        {selectedInTmpl.length > 0 && (
                          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', marginRight: 4 }}>
                            {selectedInTmpl.length}개 선택
                          </span>
                        )}
                        <span style={{
                          color: 'var(--text-3)', fontSize: 11,
                          transition: 'transform 0.2s',
                          display: 'inline-block',
                          transform: isOpen ? 'rotate(90deg)' : 'none',
                        }}>▶</span>
                      </div>

                      {isOpen && (
                        <div style={{ borderTop: '1px solid var(--border)' }}>
                          {tmpl.questions.map((q, qi) => {
                            const isChecked = selectedQuestions.some(s => s.id === q.id);
                            const disabled  = !isChecked && !canAddLPQ(q);
                            return (
                              <div
                                key={q.id}
                                onClick={() => !disabled && toggleLPQuestion(q)}
                                style={{
                                  display: 'flex', gap: 12, alignItems: 'flex-start',
                                  padding: '11px 16px',
                                  background: isChecked ? 'rgba(232,213,163,0.07)' : 'var(--bg)',
                                  cursor: disabled ? 'not-allowed' : 'pointer',
                                  opacity: disabled ? 0.4 : 1,
                                  borderBottom: qi < tmpl.questions.length - 1 ? '1px solid var(--border)' : 'none',
                                  transition: 'background 0.1s',
                                }}
                              >
                                <div style={{
                                  width: 17, height: 17, borderRadius: 4, flexShrink: 0, marginTop: 2,
                                  border: `2px solid ${isChecked ? 'var(--accent)' : 'var(--border)'}`,
                                  background: isChecked ? 'var(--accent)' : 'transparent',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}>
                                  {isChecked && <span style={{ color: '#fff', fontSize: 10, fontWeight: 800, lineHeight: 1 }}>✓</span>}
                                </div>
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.55 }}>{q.text}</div>
                                  <div style={{ marginTop: 5, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                                    <span style={{
                                      fontSize: 10, padding: '1px 7px', borderRadius: 4, fontWeight: 600,
                                      background: TYPE_COLOR[q.type] + '22', color: TYPE_COLOR[q.type],
                                    }}>
                                      {TYPE_LABEL[q.type]}
                                    </span>
                                    {q.type === 'radio' && q.options.length > 0 && (
                                      <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
                                        {q.options.join(' / ')}
                                      </span>
                                    )}
                                    {q.type === 'scale' && (
                                      <span style={{ fontSize: 11, color: 'var(--text-3)' }}>1 — 5점</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* 질문 만들기 */}
                <div style={{ marginTop: 14, border: `1px solid ${localCustomQs.length > 0 ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 'var(--radius)', padding: '14px 14px 10px', transition: 'border-color 0.2s' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>질문 만들기</span>
                    {localCustomQs.length > 0 && (
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', background: 'var(--accent-dim)', padding: '2px 8px', borderRadius: 10 }}>+{localCustomQs.length}개 추가됨</span>
                    )}
                  </div>
                  <textarea value={newQText} onChange={e => setNewQText(e.target.value)} rows={2}
                    placeholder="질문을 입력하세요"
                    style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit', fontSize: 13, marginBottom: 8 }} />
                  <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                    {[['radio', '옵션형'], ['scale', '점수형'], ['text', '서술형']].map(([t, label]) => (
                      <button key={t} onClick={() => setNewQType(t)} style={{
                        padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                        border: `1px solid ${newQType === t ? 'var(--accent)' : 'var(--border)'}`,
                        background: newQType === t ? 'var(--accent)' : 'var(--surface)',
                        color: newQType === t ? '#fff' : 'var(--text-2)',
                      }}>{label}</button>
                    ))}
                  </div>
                  {newQType === 'radio' && (
                    <div style={{ marginBottom: 8 }}>
                      {newQOptions.map((opt, i) => (
                        <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
                          <input value={opt} onChange={e => setNewQOptions(prev => prev.map((o, j) => j === i ? e.target.value : o))}
                            placeholder={`옵션 ${i + 1}`}
                            style={{ flex: 1, fontFamily: 'inherit', fontSize: 13, padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--bg)' }} />
                          {newQOptions.length > 2 && (
                            <button onClick={() => setNewQOptions(prev => prev.filter((_, j) => j !== i))}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', fontSize: 16 }}>×</button>
                          )}
                        </div>
                      ))}
                      {newQOptions.length < 6 && (
                        <button onClick={() => setNewQOptions(prev => [...prev, ''])}
                          style={{ background: 'none', border: '1px dashed var(--border)', borderRadius: 'var(--radius)', padding: '5px 12px', fontSize: 12, color: 'var(--text-3)', cursor: 'pointer' }}>
                          + 옵션 추가
                        </button>
                      )}
                    </div>
                  )}
                  {newQType === 'scale' && (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
                      <input value={newQScaleMin} onChange={e => setNewQScaleMin(e.target.value)}
                        placeholder="1점 라벨 (예: 매우 아니다)"
                        style={{ flex: 1, minWidth: 140, fontFamily: 'inherit', fontSize: 13, padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--bg)' }} />
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                        {[1,2,3,4,5].map(n => <span key={n} style={{ width: 16, height: 16, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, border: '1px solid var(--accent)', color: 'var(--accent)' }}>{n}</span>)}
                      </span>
                      <input value={newQScaleMax} onChange={e => setNewQScaleMax(e.target.value)}
                        placeholder="5점 라벨 (예: 매우 그렇다)"
                        style={{ flex: 1, minWidth: 140, fontFamily: 'inherit', fontSize: 13, padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--bg)' }} />
                    </div>
                  )}
                  {newQType === 'text' && textLPSelected >= 2 && (
                    <div style={{ fontSize: 12, color: 'var(--accent)', marginBottom: 8 }}>서술형 질문은 최대 2개까지만 추가할 수 있습니다.</div>
                  )}
                  <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                    <Btn size="sm" onClick={handleAddLocalQ}
                      disabled={!newQText.trim() || totalLPSelected >= 5 || (newQType === 'text' && textLPSelected >= 2)}>추가</Btn>
                    <Btn size="sm" variant="secondary" onClick={() => setShowSaveModal(true)} disabled={!newQText.trim()}>템플릿에 저장 →</Btn>
                  </div>
                  {localCustomQs.length > 0 && (
                    <div style={{ marginTop: 12 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 16, height: 16, borderRadius: '50%', background: 'var(--accent)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 9, fontWeight: 800, flexShrink: 0 }}>✓</span>
                        추가된 질문 목록
                      </div>
                      {localCustomQs.map((q, i) => (
                        <div key={q.id} style={{
                          display: 'flex', gap: 10, alignItems: 'flex-start',
                          padding: '10px 12px', background: 'var(--accent-dim)',
                          borderRadius: 'var(--radius)', border: '1px solid var(--accent)',
                          borderLeft: '3px solid var(--accent)', marginBottom: 6,
                        }}>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 800, color: '#fff', background: 'var(--accent)', borderRadius: 4, padding: '2px 6px', flexShrink: 0, marginTop: 2 }}>Q{i + 1}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <span style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5 }}>{q.text}</span>
                            <div style={{ marginTop: 4, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                              <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, fontWeight: 600, background: TYPE_COLOR[q.type] + '22', color: TYPE_COLOR[q.type] }}>{TYPE_LABEL[q.type]}</span>
                              {q.type === 'radio' && q.options?.length > 0 && <span style={{ fontSize: 11, color: 'var(--text-3)' }}>[{q.options.join(' / ')}]</span>}
                              {q.type === 'scale' && <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{q.options?.[0] || '매우 아니다'} · 1~5 · {q.options?.[1] || '매우 그렇다'}</span>}
                            </div>
                          </div>
                          <button onClick={() => setLocalCustomQs(prev => prev.filter(lq => lq.id !== q.id))}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', fontSize: 16, flexShrink: 0, marginTop: 1 }}>×</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 선택된 질문 미리보기 */}
                {allLPSelected.length > 0 && (
                  <div style={{ padding: '14px 16px', background: 'var(--accent-dim)', borderRadius: 'var(--radius)', border: '1px solid var(--accent)' }}>
                    <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--accent)', marginBottom: 10, letterSpacing: '0.05em' }}>선택된 질문 ({allLPSelected.length}개)</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {allLPSelected.map((q, i) => (
                        <div key={q.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                          <span style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', flexShrink: 0, marginTop: 2 }}>Q{i + 1}</span>
                          <span style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.5, flex: 1 }}>{q.text}</span>
                          <span style={{
                            fontSize: 10, padding: '1px 6px', borderRadius: 4, fontWeight: 600, flexShrink: 0,
                            background: TYPE_COLOR[q.type] + '22', color: TYPE_COLOR[q.type],
                          }}>
                            {TYPE_LABEL[q.type]}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {allLPSelected.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-3)', fontSize: 13 }}>
                    위 템플릿에서 질문을 선택하거나, 건너뛰기하면 기본 5차원 피드백만 수집됩니다.
                  </div>
                )}
              </div>
            )}

            {/* Step 3: 패널 설정 */}
            {step === 3 && (
              <PanelTargetStep
                plan={companyPlan}
                panelCount={form.panels}
                onPanelCount={(n) => set('panels', n)}
                careerLevels={careerLevels}
                onCareerLevels={setCareerLevels}
                missionType="main"
                creditBalance={creditBalance}
              />
            )}

            {/* Step 4: 검토 & 제출 */}
            {step === 4 && (
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>최종 검토</h2>
                {[
                  ['제품/서비스', form.product || '—'],
                  ['LP URL', form.lpUrl || '—'],
                  ['타겟 페르소나', `${form.personaAge}, ${form.personaRole}` || '—'],
                  ['패널 수', `${form.panels}명`],
                  ['커리어 레벨', careerLevels.map(k => CAREER_LEVELS.find(c => c.key === k)?.label).filter(Boolean).join(', ') || '—'],
                  ['예상 크레딧', `${calcCredits(form.panels, careerLevels, 'main')} 크레딧`],
                  ['검증 포커스', form.focusAreas.join(', ') || '—'],
                  ...(allLPSelected.length > 0 ? [['추가 질문', `${allLPSelected.length}개 선택`]] : []),
                ].map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ width: 140, color: 'var(--text-3)', fontSize: 13, flexShrink: 0 }}>{k}</span>
                    <span style={{ fontWeight: 500, fontSize: 13 }}>{v}</span>
                  </div>
                ))}
                {form.imageUrls.length > 0 && (
                  <div style={{ display: 'flex', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ width: 140, color: 'var(--text-3)', fontSize: 13, flexShrink: 0 }}>업로드 이미지</span>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {form.imageUrls.map((url, i) => (
                        <img key={url} src={url} alt={`이미지 ${i + 1}`}
                          style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border)' }} />
                      ))}
                    </div>
                  </div>
                )}
                <div style={{ marginTop: 24, padding: 16, background: 'var(--accent-dim)', borderRadius: 'var(--radius)', fontSize: 13, color: 'var(--text-2)', lineHeight: 1.7 }}>
                  ⚡ 의뢰 등록 후 패널이 매칭되어 피드백을 시작합니다. Purit Filter를 통과한 피드백만 전달됩니다.
                </div>
                <div style={{ marginTop: 10, padding: '14px 16px', background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius)', lineHeight: 1.75 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#ef4444', marginBottom: 8 }}>⚠️ 수정 가능 시점 안내 (제출 전 반드시 확인)</div>
                  <div style={{ fontSize: 12, color: 'var(--text-2)' }}>
                    <span style={{ display: 'block', marginBottom: 4 }}>
                      ✅ <strong>제출 직후 ~ 첫 피드백 수신 전</strong>: 대시보드 의뢰 카드에서 수정 가능
                    </span>
                    <span style={{ display: 'block', color: '#ef4444', fontWeight: 600, marginBottom: 4 }}>
                      🔒 <strong>첫 피드백 수신 즉시</strong>: 수정 영구 잠금 — 의뢰 조기 종료만 가능
                    </span>
                    <span style={{ display: 'block', fontSize: 12, color: '#ef4444' }}>
                      ※ 조기 종료 시 사용된 크레딧은 환불되지 않습니다.
                    </span>
                  </div>
                </div>
              </div>
            )}
          </Card>

          {/* Navigation */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
            <Btn variant="secondary" onClick={() => {
              if (step > 0) { setStep(s => s - 1); }
              else if (shouldBlockNav) { setShowDraftModal(true); }
              else if (isEditMode) navigate('/company');
              else setView('list');
            }} size="md">
              {step === 0 ? (isEditMode ? '취소' : '목록으로') : '이전'}
            </Btn>
            {submitError && (
              <div style={{ color: 'var(--red)', fontSize: 13, padding: '8px 12px', background: 'var(--red-dim)', borderRadius: 8 }}>
                {submitError}
              </div>
            )}
            <Btn
              onClick={() => step < STEPS.length - 1 ? setStep(s => s + 1) : handleSubmit()}
              size="md"
              disabled={submitting || uploading || (step === STEPS.length - 1 && !isEditMode && creditBalance != null && calcCredits(form.panels, careerLevels, 'main') > creditBalance)}
            >
              {step === STEPS.length - 1 ? (submitting ? '처리 중...' : isEditMode ? '수정 완료 →' : '의뢰 제출 →') : '다음 →'}
            </Btn>
          </div>
        </>
      )}

      {showSaveModal && (
        <ConfirmModal
          title="질문 템플릿에 저장"
          desc={"이 질문을 템플릿에 추가하겠습니까?\n저장된 질문은 이후 의뢰 등록 시 자동으로 표시됩니다."}
          confirmLabel={savingToTemplate ? '저장 중…' : '저장'}
          onConfirm={handleSaveTmpl}
          onCancel={() => setShowSaveModal(false)}
        />
      )}

      {terminateTarget && (
        <ConfirmModal
          title="의뢰를 조기 종료할까요?"
          desc={`"${terminateTarget.title}" 의뢰를 지금 종료하면 패널 매칭이 중단되고 취소 상태로 변경됩니다.\n이 작업은 되돌릴 수 없습니다.`}
          confirmLabel="조기 종료"
          cancelLabel="유지"
          danger
          onConfirm={handleTerminate}
          onCancel={() => setTerminateTarget(null)}
        />
      )}
      {deleteTarget && (
        <ConfirmModal
          title="의뢰를 영구 삭제할까요?"
          desc={"이 의뢰를 영구적으로 삭제합니다.\n삭제된 데이터는 복구할 수 없습니다."}
          confirmLabel="영구 삭제"
          cancelLabel="취소"
          danger
          onConfirm={handleDeleteMission}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {showDraftModal && ReactDOM.createPortal(
        <div onClick={e => e.stopPropagation()}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--bg)', borderRadius: 16, padding: '28px 24px', width: 380, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>작성 중인 내용이 있습니다</div>
            <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6, marginBottom: 12 }}>
              의뢰 등록을 완료하지 않았습니다.<br />임시 저장하고 나가시겠습니까?
            </p>
            <Btn onClick={async () => {
              await saveDraft();
              navigationGuard.unregister();
              setShowDraftModal(false);
              const dest = pendingNavPath;
              setPendingNavPath(null);
              if (dest) navigate(dest);
              else if (isEditMode) navigate('/company');
              else setView('list');
            }} disabled={savingDraft}>
              {savingDraft ? '저장 중...' : '임시 저장 후 나가기'}
            </Btn>
            <Btn variant="secondary" onClick={() => {
              navigationGuard.unregister();
              setShowDraftModal(false);
              const dest = pendingNavPath;
              setPendingNavPath(null);
              if (dest) navigate(dest);
              else if (isEditMode) navigate('/company');
              else setView('list');
            }}>저장 없이 나가기</Btn>
            <Btn variant="ghost" onClick={() => { setShowDraftModal(false); setPendingNavPath(null); }}>계속 작성하기</Btn>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

const lbl = { display: 'flex', flexDirection: 'column', gap: 8 };
const lblTxt = { fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' };
