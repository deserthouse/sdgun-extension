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
  return <span className="avatar" style={style} aria-hidden>{ch}</span>;
}
