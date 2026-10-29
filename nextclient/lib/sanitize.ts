// 正文 HTML 清洗（G2/F-安全红线）：渲染端 DOMPurify（有 DOM 处，绝不在 SW）。
// 白名单：图片只放行站方图域（picapp/bbs 附件），其余协议/脚本/表单一律剥离。
import DOMPurify from 'dompurify';

// 正文图白名单=协议级（论坛正文大量外链图床；禁 data:/javascript: 等危险协议；
// 渲染统一 referrerpolicy=no-referrer 兜隐私）
const ALLOWED_IMG = /^https?:\/\//i;

// img src 域白名单钩子（模块级注册一次；sanitize 时自动生效）
// eslint-disable-next-line @typescript-eslint/no-explicit-any
DOMPurify.addHook('afterSanitizeAttributes', (node: any) => {
  if (node?.tagName !== 'IMG') return;
  const v = node.getAttribute('src') || '';
  if (!ALLOWED_IMG.test(v) && !v.startsWith('data:image/')) {
    node.removeAttribute('src');
  }
  // W3/批B：CLS 缓解——懒加载+异步解码（无服务端尺寸，无法彻底消除跳动）
  if (node.getAttribute('src')) {
    node.setAttribute('loading', 'lazy');
    node.setAttribute('decoding', 'async');
  }
});

// 懒加载归一化（E70-02 修复，清洗前执行）：站方正文 img 常把真图放在
// data-original/data-src/data-lazy-src 而 src 为占位/缩略——清洗白名单剥属性会
// 导致全部图片丢失可加载 src（60 图主楼零图实证）。归一化规则：
//   懒加载属性即显示图 → 无条件提升为 src；旧 src（常为占位 none.gif/缩略）留
//   data-sdg-thumb。首版"占位才提升"的规则被回归抓出：占位 gif 本身是合法
//   https，按协议判定会把真图留在 data-original 永不显示。
const LAZY_ATTRS = ['data-original', 'data-src', 'data-lazy-src'];

export function normalizeLazyImages(html: string): string {
  const wrap = document.createElement('div');
  wrap.innerHTML = html;
  wrap.querySelectorAll('img').forEach((im) => {
    const lazy = LAZY_ATTRS.map((a) => im.getAttribute(a) || '').find((v) => ALLOWED_IMG.test(v));
    if (lazy) {
      const oldSrc = im.getAttribute('src') || '';
      im.setAttribute('src', lazy);
      if (oldSrc && oldSrc !== lazy) im.setAttribute('data-sdg-thumb', oldSrc);
    }
    LAZY_ATTRS.forEach((a) => im.removeAttribute(a));
  });
  return wrap.innerHTML;
}

export function sanitizeContent(html: string): string {
  return DOMPurify.sanitize(normalizeLazyImages(html), {
    ALLOWED_TAGS: ['p', 'br', 'b', 'strong', 'i', 'em', 'u', 's', 'blockquote',
      'ul', 'ol', 'li', 'img', 'a', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'pre', 'code', 'span', 'div', 'font',
      'strike', 'hr', 'sub', 'sup'],
    ALLOWED_ATTR: ['src', 'href', 'alt', 'class', 'style', 'colspan', 'rowspan',
      'color', 'size', 'referrerpolicy', 'data-sdg-idx', 'data-sdg-orig', 'data-sdg-thumb'],
    ALLOW_DATA_ATTR: false,
  });
}

// 从清洗后的正文提取内容图（灯箱索引用）
export function extractImages(sanitizedHtml: string): string[] {
  const wrap = document.createElement('div');
  wrap.innerHTML = sanitizedHtml;
  return [...wrap.querySelectorAll('img')]
    .map((im) => (im as HTMLImageElement).getAttribute('src') || '')
    .filter((s) => s.startsWith('http'));
}
