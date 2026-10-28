// 回复草稿键（E70-04 修复）：owner（guest/账号 id）+ tid（+未来回复目标 pid）三维隔离。
// 键切换必须无条件重绘为存值或空串——首版只在新值非空时 setText 导致跨帖串留（截图复现）。
import { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import { getAuth } from './auth';

export function draftKey(owner: string, tid: string): string {
  return `sdg2.draft.${owner}.${tid}`;
}

export const GUEST_OWNER = 'guest';

// W1/E28-02：草稿 owner 实时派生（storage.onChanged 跨标签广播 + 卸载兜底）——
// 身份切换后键空间立即更新，后输入写新账号键，旧账号键保留原文。
export function useDraftOwner(): string | null {
  const [owner, setOwner] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    const read = () => {
      getAuth()
        .then((a) => { if (alive) setOwner(a ? `u${a.userId}` : GUEST_OWNER); })
        // 读取瞬时失败≠登出——保持现 owner 不降级（降级只认成功读到的 null），
        // 否则草稿会写进 guest 键（W1/E28-02 实测抓到的写串路径）
        .catch(() => { /* 保留现值；下次 read/广播再试 */ });
    };
    read();
    const lst = (changes: Record<string, unknown>, area: string) => {
      if (area === 'session' && 'auth.current' in changes) read();
    };
    browser.storage.onChanged.addListener(lst);
    const t = setInterval(read, 3000); // 广播兜底
    return () => {
      alive = false;
      browser.storage.onChanged.removeListener(lst);
      clearInterval(t);
    };
  }, []);
  return owner;
}

// C1-5 回复草稿统一读写（帖子页 ReplyDraft 与编辑器 tid 模式共用一键——
// 此前ReplyDraft 存纯文本、编辑器存 JSON {title,board,content}，同键互踩）。
// 存储格式=JSON {content}；历史纯文本值读侧兼容（读时迁移，写时统一 JSON）。
export function loadReplyDraftText(key: string): string {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return '';
    if (raw.startsWith('{')) {
      const d = JSON.parse(raw) as { content?: unknown };
      return typeof d.content === 'string' ? d.content : '';
    }
    return raw;
  } catch {
    return '';
  }
}

export function saveReplyDraftText(key: string, text: string): void {
  localStorage.setItem(key, JSON.stringify({ content: text }));
}
