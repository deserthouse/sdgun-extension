// navguard.js — 导航守卫（document_start）。
// 服务器实测定案（2026-10-03）：
//   forum.php?mobile=2（裸）   → 302 portal.php?mod=index&mobile=2 → portal 页 JS 踢回 forum.php?mobile=1（ping-pong）
//   forum.php?forumlist=1&mobile=2 → 200 bygsjw 富模板（稳定）
//   内容页（mod=forumdisplay/viewthread）→ 服务器不定期用"外部 JS 丢参跳转"形态回应：剥光参数踢回 forum.php?mobile=1
// 守卫职责：
//   1) 内容页落地时记录参数上下文（10 秒内有效）；
//   2) 丢参落点（forum.php?mobile=1 无 mod）先恢复上下文（每上下文预算 2 次，防服务器固执回吐死循环）；
//   3) 无上下文/预算耗尽 → 归一化到稳定富首页形态 forumlist=1&mobile=2（每 URL 预算 2 次）。
(function () {
  'use strict';
  try {
    if (!/forum\.php/.test(location.pathname)) return;

    const params = new URLSearchParams(location.search);
    const mod = params.get('mod');
    const mobile = params.get('mobile');
    const SKEY = 'sdg_nav_ctx';

    // ---- 内容页：记录上下文，不跳转 ----
    // mobile=2 交 bygsjw 解析器，mobile=1 交简易档解析器，两边都能渲染；
    // 恢复目标按 mobile=1 存（裸 mobile=2 会 302 进 portal ping-pong）。
    if (mod === 'forumdisplay' || mod === 'viewthread') {
      const keep = new URLSearchParams();
      keep.set('mod', mod);
      for (const k of ['fid', 'tid', 'page', 'authorid', 'orderby', 'filter']) {
        const v = params.get(k);
        if (v) keep.set(k, v);
      }
      keep.set('mobile', '1');
      sessionStorage.setItem(SKEY, JSON.stringify({ q: keep.toString(), t: Date.now() }));
      return;
    }

    // ---- 健康首页（mobile=2 / forumlist=1 / 无参数）：旧上下文已过时，清除 ----
    if (mobile !== '1') {
      sessionStorage.removeItem(SKEY);
      return;
    }

    // ---- mobile=1 无 mod：丢参落点 或 真简易首页 ----
    // 先查上下文：10 秒内记录过内容页 → 恢复（预算 2 次/上下文）
    let ctx = null;
    try {
      const raw = sessionStorage.getItem(SKEY);
      if (raw) {
        const o = JSON.parse(raw);
        if (o && o.q && Date.now() - o.t < 10000) ctx = o.q;
      }
    } catch (e) { /* 上下文损坏按无上下文处理 */ }
    if (ctx) {
      const rk = 'sdg_rs:' + ctx;
      const n = parseInt(sessionStorage.getItem(rk) || '0', 10);
      if (n < 2) {
        sessionStorage.setItem(rk, String(n + 1));
        location.replace(location.origin + '/forum.php?' + ctx);
        return;
      }
    }
    // 无上下文/已过期（真简易首页）或恢复预算耗尽 → 归一化到稳定富首页形态
    const key = 'sdg_m2:' + location.href;
    const m = parseInt(sessionStorage.getItem(key) || '0', 10);
    if (m >= 2) return;
    sessionStorage.setItem(key, String(m + 1));
    location.replace(location.origin + '/forum.php?forumlist=1&mobile=2');
  } catch (e) { /* sessionStorage 不可用则静默 */ }
})();
