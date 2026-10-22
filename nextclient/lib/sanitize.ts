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
});

export function sanitizeContent(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p', 'br', 'b', 'strong', 'i', 'em', 'u', 's', 'blockquote',
      'ul', 'ol', 'li', 'img', 'a', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'pre', 'code', 'span', 'div', 'font',
      'strike', 'hr', 'sub', 'sup'],
    ALLOWED_ATTR: ['src', 'href', 'alt', 'class', 'style', 'colspan', 'rowspan',
      'color', 'size', 'referrerpolicy', 'data-sdg-idx'],
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
