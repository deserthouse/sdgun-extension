// 设计令牌（E1-2）：暖白/墨色基底 + 暖红强调，对齐项目既有重绘令牌口径
// （extension/content/redraw/rightrail.js 的 surface/text/accent 体系）。
// 明/暗/跟随系统三态：data-theme 由 theme.ts 解析写入（auto 跟随 matchMedia 并监听变化）。
export const TOKENS = `
  :root, :root[data-theme='light'] {
    --bg: #f6f5f4; --surface: #ffffff; --surface2: #f1efee;
    --border: rgba(0,0,0,.08); --border2: rgba(0,0,0,.14);
    --text: #1c1917; --text2: #57534e; --text3: #a8a29e;
    --accent: #b01f28;
  }
  :root[data-theme='dark'] {
    --bg: #131417; --surface: #17181b; --surface2: #222329;
    --border: #26272c; --border2: #34353b;
    --text: #e7e5e4; --text2: #a8a29e; --text3: #78716c;
    --accent: #ff6b7a;
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
