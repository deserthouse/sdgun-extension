// 回复草稿键（E70-04 修复）：owner（guest/账号 id）+ tid（+未来回复目标 pid）三维隔离。
// 键切换必须无条件重绘为存值或空串——首版只在新值非空时 setText 导致跨帖串留（截图复现）。
export function draftKey(owner: string, tid: string): string {
  return `sdg2.draft.${owner}.${tid}`;
}

export const GUEST_OWNER = 'guest';
