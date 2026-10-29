// 设计令牌（E1-2）：暖白/墨色基底 + 暖红强调，对齐项目既有重绘令牌口径
// （extension/content/redraw/rightrail.js 的 surface/text/accent 体系）。
// 明/暗/跟随系统三态：data-theme 由 theme.ts 解析写入（auto 跟随 matchMedia 并监听变化）。
export const TOKENS = `
  :root, :root[data-theme='light'] {
    --bg: #f6f5f4; --surface: #ffffff; --surface2: #f1efee;
    --border: rgba(0,0,0,.08); --border2: rgba(0,0,0,.14);
    --text: #1c1917; --text2: #57534e; --text3: #a8a29e;
    --accent: #b01f28;
    --accent-soft: rgba(176,31,40,.08);
    --ok: #1a7f4f; --warn: #9a6700;
    --focus-ring: 0 0 0 2px #f6f5f4, 0 0 0 4px rgba(176,31,40,.55);
  }
  :root[data-theme='dark'] {
    --bg: #131417; --surface: #1b1d21; --surface2: #26282e;
    --border: #2a2c32; --border2: #3a3c43;
    --text: #e7e5e4; --text2: #a8a29e; --text3: #78716c;
    --accent: #ff6b7a;
    --accent-soft: rgba(255,107,122,.10);
    --ok: #4ade80; --warn: #fbbf24;
    --focus-ring: 0 0 0 2px #131417, 0 0 0 4px rgba(255,107,122,.55);
  }
  /* W2 设计令牌：字阶/行高/间距/圆角（语义类在 pages.css 消费） */
  :root {
    --fs-2xs: 12px; --lh-2xs: 1.45;
    --fs-xs: 13px;  --lh-xs: 1.5;
    --fs-sm: 14px;  --lh-sm: 1.55;
    --fs-md: 15.5px; --lh-md: 1.6;
    --fs-lg: 17px;  --lh-lg: 1.45;
    --fs-xl: 20px;  --lh-xl: 1.35;
    --fs-2xl: 24px; --lh-2xl: 1.3;
    --sp-1: 4px; --sp-2: 8px; --sp-3: 12px; --sp-4: 16px;
    --sp-6: 24px; --sp-8: 32px;
    --r-sm: 8px; --r-md: 12px; --r-lg: 16px; --r-full: 999px;
    --nav-w: 232px;
    --content-w: 760px;
    --tabbar-h: 58px;
  }
`;

export type ThemeMode = 'auto' | 'light' | 'dark';
const KEY = 'sdg2.theme';

export function themeMode(): ThemeMode {
  const v = localStorage.getItem(KEY);
  return v === 'light' || v === 'dark' ? v : 'auto';
}

export function setThemeMode(m: ThemeMode): void {
  localStorage.setItem(KEY, m);
  applyTheme();
}

export function applyTheme(): void {
  const m = themeMode();
  const resolved =
    m === 'auto'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : m;
  document.documentElement.dataset.theme = resolved;
}

export function watchSystemTheme(): void {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (themeMode() === 'auto') applyTheme();
  });
}
