// W2 推广批（T1-2/T1-4）：头像组件——user_head 优先，缺省回退首字。
import React from 'react';

export function Avatar({ src, name, size = 36 }: {
  src?: unknown; name?: unknown; size?: number;
}) {
  const url = typeof src === 'string' && src.startsWith('http') ? src : '';
  const ch = String(name ?? '?').trim().charAt(0) || '?';
  const style: React.CSSProperties = {
    width: size, height: size, borderRadius: '50%', flex: 'none',
    objectFit: 'cover', background: 'var(--surface2)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: 'var(--text2)', fontWeight: 700, fontSize: size * 0.42,
    overflow: 'hidden',
  };
  if (url) {
    return <img className="avatar" style={style} src={url} alt="" loading="lazy"
      referrerPolicy="no-referrer" data-avatar={String(name ?? '')} />;
  }
  // N-D3（XV-3）：中性人物轮廓 SVG 替首字灰块（令牌化 currentColor 随主题）
  return (
    <span className="avatar" style={{ ...style, background: 'var(--surface2)' }} aria-hidden
      data-avatar={String(name ?? '')}>
      <svg width={size * 0.62} height={size * 0.62} viewBox="0 0 24 24" fill="var(--text3)">
        <circle cx="12" cy="8.4" r="4" />
        <path d="M4 20c0-4 3.6-6.4 8-6.4s8 2.4 8 6.4v1H4z" />
      </svg>
    </span>
  );
}
