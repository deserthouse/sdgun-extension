// W2 推广批（T1-1）：基础格式化层——相对时间与计数。
// 口径：unix 秒（10 位）识别为时间戳；已格式化字符串原样透传（服务端
// lastpost 等字段形态混排，R-A0/账本既有认知）。

const NL = 10 ** 9; // 2001-09-09：低于此值不是合理 unix 秒

export function formatTime(input: unknown, now = Date.now()): string {
  if (input === null || input === undefined || input === '') return '';
  if (typeof input === 'number' || (typeof input === 'string' && /^\d{10}$/.test(input.trim()))) {
    const n = Number(input);
    if (n >= NL) {
      const ms = n * 1000;
      const diff = now - ms;
      if (diff < 0) return formatAbs(ms);
      if (diff < 60_000) return '刚刚';
      if (diff < 3600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
      if (diff < 86_400_000) return `${Math.floor(diff / 3600_000)} 小时前`;
      if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)} 天前`;
      return formatAbs(ms);
    }
  }
  return String(input);
}

function formatAbs(ms: number): string {
  const d = new Date(ms);
  const now = new Date();
  const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  if (d.getFullYear() === now.getFullYear()) {
    return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
  return ymd;
}

export function formatCount(input: unknown): string {
  const n = Number(String(input ?? '').replace(/[^\d.]/g, ''));
  if (!Number.isFinite(n)) return String(input ?? '');
  if (n >= 10000) {
    const w = n / 10000;
    return `${w >= 100 ? Math.round(w) : Math.round(w * 10) / 10}万`;
  }
  return String(n);
}
