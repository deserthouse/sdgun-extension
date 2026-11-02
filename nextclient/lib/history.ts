// G2 本地帖历史（Android ThreadHistoryStore 同构移植）：纯客户端记录，
// 打开帖子自动记录（tid 去重置顶，上限 100，FIFO 淘汰）；不构成任何请求。
export interface HistoryEntry {
  tid: string;
  title: string;
  ts: number;
}

const KEY = 'sdg2.history';
const CAP = 100;

export function recordHistory(tid: string, title: string): void {
  if (!tid || !title) return;
  try {
    const arr = loadHistory().filter((e) => e.tid !== tid);
    arr.unshift({ tid, title: title.slice(0, 120), ts: Date.now() });
    localStorage.setItem(KEY, JSON.stringify(arr.slice(0, CAP)));
  } catch { /* 存储满/禁用：历史是增强功能，静默降级 */ }
}

export function loadHistory(): HistoryEntry[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '[]');
    if (!Array.isArray(v)) return [];
    return v.filter((e) => e && typeof e.tid === 'string');
  } catch {
    return [];
  }
}

export function clearHistory(): void {
  try {
    localStorage.removeItem(KEY);
  } catch { /* 同上 */ }
}
