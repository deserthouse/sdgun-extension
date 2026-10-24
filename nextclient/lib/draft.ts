// 回复草稿键（E70-04 修复）：owner（guest/账号 id）+ tid（+未来回复目标 pid）三维隔离。
// 键切换必须无条件重绘为存值或空串——首版只在新值非空时 setText 导致跨帖串留（截图复现）。
export function draftKey(owner: string, tid: string): string {
  return `sdg2.draft.${owner}.${tid}`;
}

export const GUEST_OWNER = 'guest';

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
