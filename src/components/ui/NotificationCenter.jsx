import { useState } from 'react';
import { Card, Badge, Btn } from '../ui';

const NOTIFS_BY_ROLE = {
  company: [
    { id: 'n1', type: 'success', icon: '✓', title: '피드백 수집 완료', body: '프리미엄 러닝화 LP — 패널 5/8명 피드백 완료. 결과를 확인하세요.', time: '방금 전', read: false, action: '/company/results' },
    { id: 'n2', type: 'warning', icon: '⚠', title: 'Purity Filter 탈락', body: '패널 1명의 피드백이 품질 기준 미달로 반려됐습니다. 대체 패널이 자동 배정됩니다.', time: '2시간 전', read: false, action: '/company/results' },
    { id: 'n3', type: 'info', icon: '◆', title: 'ICP Pulse 분기 리포트 준비됨', body: '2025 Q3 ICP 인텔리전스 리포트가 생성됐습니다.', time: '어제', read: true, action: '/company/icp-pulse' },
    { id: 'n4', type: 'info', icon: '◎', title: '브랜드 추적 리서치 시작', body: '8월 브랜드 인지도 패널 조사가 시작됩니다. 20명 매칭 완료.', time: '3일 전', read: true, action: '/company/brand' },
  ],
  panel: [
    { id: 'n1', type: 'success', icon: '₩', title: '정산 완료', body: '단백질 구독 LP 피드백 ₩38,000 입금됐습니다.', time: '방금 전', read: false, action: '/panel/history' },
    { id: 'n2', type: 'info', icon: '◎', title: '새 미션 매칭', body: '핀테크베이스 — 법인카드 신청 LP 의뢰가 당신의 페르소나와 매칭됐습니다. ₩80,000', time: '1시간 전', read: false, action: '/panel/missions' },
    { id: 'n3', type: 'warning', icon: '⚠', title: 'Purity 탈락 알림', body: '온라인 강의 LP 피드백이 구체성 지수 부족으로 반려됐습니다. Trust Score -8점.', time: '5일 전', read: true, action: '/panel/history' },
  ],
  admin: [
    { id: 'n1', type: 'warning', icon: '⚠', title: '심사 대기 패널', body: '정유진님의 패널 가입 신청이 심사 대기 중입니다.', time: '방금 전', read: false, action: '/admin/panels' },
    { id: 'n2', type: 'info', icon: '◎', title: '미매칭 의뢰 발생', body: '핀테크베이스 B2B 의뢰가 페르소나 매칭에 실패했습니다. 수동 개입 필요.', time: '3시간 전', read: false, action: '/admin/missions' },
    { id: 'n3', type: 'success', icon: '₩', title: '이번 달 GMV 달성', body: '7월 GMV ₩280만 달성. 목표 대비 93%.', time: '오늘 오전', read: true, action: '/admin' },
  ],
};

const TYPE_COLORS = {
  success: 'var(--green)',
  warning: 'var(--accent)',
  info: 'var(--blue)',
};

const TYPE_BG = {
  success: 'var(--green-dim)',
  warning: 'var(--accent-dim)',
  info: 'var(--blue-dim)',
};

export default function NotificationCenter({ role = 'company' }) {
  const [notifs, setNotifs] = useState(NOTIFS_BY_ROLE[role] || []);
  const unread = notifs.filter(n => !n.read).length;

  const markAll = () => setNotifs(ns => ns.map(n => ({ ...n, read: true })));
  const markOne = (id) => setNotifs(ns => ns.map(n => n.id === id ? { ...n, read: true } : n));

  return (
    <div style={{ padding: '40px 48px', maxWidth: 700, animation: 'fadeUp 0.5s ease both' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 }}>
        <div>
          <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: role === 'company' ? 'var(--blue)' : role === 'panel' ? 'var(--green)' : 'var(--accent)', marginBottom: 8, letterSpacing: '0.1em' }}>
            NOTIFICATIONS
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 800 }}>
            알림 센터
            {unread > 0 && (
              <span style={{ marginLeft: 12, fontSize: 16, fontFamily: 'var(--font-mono)', background: 'var(--red)', color: '#fff', padding: '2px 10px', borderRadius: 20, verticalAlign: 'middle' }}>
                {unread}
              </span>
            )}
          </h1>
        </div>
        {unread > 0 && (
          <Btn size="sm" variant="ghost" onClick={markAll}>모두 읽음 처리</Btn>
        )}
      </div>

      {notifs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-3)' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🔔</div>
          <div style={{ fontWeight: 600, color: 'var(--text-2)' }}>알림이 없습니다</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {notifs.map(n => (
            <div
              key={n.id}
              onClick={() => markOne(n.id)}
              style={{
                display: 'flex', gap: 16, padding: '18px 20px',
                background: n.read ? 'var(--surface)' : 'var(--surface-2)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid ' + (n.read ? 'var(--border)' : 'var(--border-light)'),
                cursor: 'pointer', transition: 'all 0.15s', position: 'relative',
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-light)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = n.read ? 'var(--border)' : 'var(--border-light)'}
            >
              {/* Unread dot */}
              {!n.read && (
                <div style={{
                  position: 'absolute', top: 18, right: 18,
                  width: 8, height: 8, borderRadius: '50%', background: 'var(--red)',
                }} />
              )}

              {/* Icon */}
              <div style={{
                width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                background: TYPE_BG[n.type],
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 16, color: TYPE_COLORS[n.type],
              }}>
                {n.icon}
              </div>

              {/* Content */}
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                  <span style={{ fontWeight: n.read ? 500 : 700, fontSize: 14 }}>{n.title}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', flexShrink: 0, marginLeft: 12 }}>{n.time}</span>
                </div>
                <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6, marginBottom: 0 }}>{n.body}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
