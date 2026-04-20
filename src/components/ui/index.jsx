import { clsx } from 'clsx';

export const Btn = ({ children, variant = 'primary', size = 'md', onClick, disabled, style, className }) => {
  const base = {
    display: 'inline-flex', alignItems: 'center', gap: '7px',
    fontFamily: 'var(--font-ui)', fontWeight: 500, letterSpacing: '-0.01em',
    borderRadius: 'var(--radius)', cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'all 0.15s ease', border: '1px solid transparent',
    opacity: disabled ? 0.45 : 1,
  };
  const sizes = {
    sm: { padding: '6px 14px', fontSize: '13px' },
    md: { padding: '10px 20px', fontSize: '14px' },
    lg: { padding: '13px 28px', fontSize: '15px' },
  };
  const variants = {
    primary: { background: 'var(--text)', color: '#FFFFFF', borderColor: 'var(--text)' },
    secondary: { background: 'var(--bg-2)', color: 'var(--text)', borderColor: 'var(--border)' },
    ghost: { background: 'transparent', color: 'var(--text-2)', borderColor: 'transparent' },
    danger: { background: 'var(--red-dim)', color: 'var(--red)', borderColor: 'rgba(255,59,48,0.25)' },
    outline: { background: 'transparent', color: 'var(--text)', borderColor: 'var(--border)' },
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{ ...base, ...sizes[size], ...variants[variant], ...style }}
      className={className}
    >
      {children}
    </button>
  );
};

export const Card = ({ children, style, className, onClick }) => (
  <div
    onClick={onClick}
    style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)',
      padding: '28px',
      cursor: onClick ? 'pointer' : 'default',
      transition: 'box-shadow 0.18s ease, border-color 0.18s ease',
      ...style,
    }}
    className={className}
    onMouseEnter={e => { if (onClick) { e.currentTarget.style.boxShadow = 'var(--shadow)'; e.currentTarget.style.borderColor = 'var(--text-3)'; } }}
    onMouseLeave={e => { if (onClick) { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = 'var(--border)'; } }}
  >
    {children}
  </div>
);

export const Stat = ({ label, value, sub, accent }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
    <div style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
    <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-0.03em', color: accent ? 'var(--text)' : 'var(--text)', lineHeight: 1 }}>{value}</div>
    {sub && <div style={{ fontSize: 13, color: 'var(--text-3)' }}>{sub}</div>}
  </div>
);

export const ScoreBar = ({ score, max = 5, color = 'var(--text)' }) => (
  <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
    {Array.from({ length: max }).map((_, i) => (
      <div key={i} style={{
        width: 28, height: 4, borderRadius: 2,
        background: i < score ? color : 'var(--border-light)',
        transition: 'background 0.25s',
      }} />
    ))}
    <span style={{ fontSize: 12, color: 'var(--text-3)', marginLeft: 6, fontFamily: 'var(--font-mono)' }}>{score}/{max}</span>
  </div>
);

export const Badge = ({ children, type = 'gray' }) => (
  <span className={`tag tag-${type}`}>{children}</span>
);

export const Divider = ({ style }) => (
  <div style={{ height: 1, background: 'var(--border)', ...style }} />
);

export const EmptyState = ({ icon, title, desc }) => (
  <div style={{ textAlign: 'center', padding: '72px 24px', color: 'var(--text-3)' }}>
    <div style={{ fontSize: 44, marginBottom: 16 }}>{icon}</div>
    <div style={{ fontWeight: 600, fontSize: 17, color: 'var(--text-2)', marginBottom: 8, letterSpacing: '-0.01em' }}>{title}</div>
    <div style={{ fontSize: 14, lineHeight: 1.6 }}>{desc}</div>
  </div>
);
