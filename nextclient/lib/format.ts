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

// S2/F1 契约（三轮复审+评估定案）：含非数字字符的字符串（"3.6万阅读"/"67.8万"）
// 原样透传——旧版剥中文单位致"67.8万阅读"变"看 3.6"（三轮 P1 互证）。
// 仅纯数字才走压缩逻辑；空/undefined→''。
export function formatCount(input: unknown): string {
  if (input === null || input === undefined || input === '') return '';
  const str = String(input).trim();
  // 纯数字（含千分位逗号）→解析压缩
  if (/^[\d,.]+$/.test(str)) {
    const n = Number(str.replace(/,/g, ''));
    if (Number.isFinite(n)) {
      if (n >= 10000) {
        const w = n / 10000;
        return `${w >= 100 ? Math.round(w) : Math.round(w * 10) / 10}万`;
      }
      return String(n);
    }
  }
  // 含非数字（已格式化/带单位/无效）→原样透传
  return str;
}

// S2/F1 配套：热榜排序用数值解析（"3.6万"→36000，非纯数字→NaN 退 0——
// 旧版 Number("3.6万")=NaN 致排序全乱）
export function parseCountNum(input: unknown): number {
  if (input === null || input === undefined) return 0;
  const str = String(input).trim();
  // 纯数字
  if (/^[\d,.]+$/.test(str)) {
    const n = Number(str.replace(/,/g, ''));
    return Number.isFinite(n) ? n : 0;
  }
  // N万/N亿 形态
  const m = str.match(/^([\d.]+)\s*万/);
  if (m) return Math.round(Number(m[1]) * 10000) || 0;
  const m2 = str.match(/^([\d.]+)\s*亿/);
  if (m2) return Math.round(Number(m2[1]) * 100000000) || 0;
  // 含其他文字（"3.6万阅读"）→提取数字+万
  const m3 = str.match(/([\d.]+)\s*万/);
  if (m3) return Math.round(Number(m3[1]) * 10000) || 0;
  return 0;
}
