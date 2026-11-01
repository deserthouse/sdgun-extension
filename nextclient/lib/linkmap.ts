// F3-3 深链统一：站方 URL → 客户端 hash 路由的唯一映射器。
// 纪律：只映射已登记路由（thread/board/user）；不认识的 URL 返回 null=调用方走外开，
// 不猜板块/用户参数语义。映射器是纯函数（深链契约测试直接打它）。
const SDGUN_HOSTS = new Set(['bbs.sdgun.com.cn', 'app.sdgun.com.cn']);

export function internalRouteFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (!SDGUN_HOSTS.has(u.hostname)) return null;
    const q = u.searchParams;
    // 帖子：viewthread tid / threadWapPage tid（H5 分享页，单 tid 服务端自解析板块）
    const tid = q.get('tid');
    if (tid && /^\d+$/.test(tid)) return `#/thread/${tid}`;
    // 板块：forumdisplay fid
    if (u.pathname.includes('forumdisplay') && q.get('fid') && /^\d+$/.test(q.get('fid')!)) {
      return `#/board/${q.get('fid')}`;
    }
    // 用户：home.php?mod=space&uid=N
    if (q.get('mod') === 'space' && q.get('uid') && /^\d+$/.test(q.get('uid')!)) {
      return `#/user/${q.get('uid')}`;
    }
    return null;
  } catch {
    return null;
  }
}
