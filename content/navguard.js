// navguard.js — 导航守卫（document_start）。诊断日志前缀 [sdg-nav]（用户 F12 可见，报障取证用）。
// 服务器实测定案（2026-10-03/04）：
//   forum.php?mobile=2（裸）   → 302 portal.php?mod=index&mobile=2 → portal 页 JS 踢回 forum.php?mobile=1（ping-pong）
//   forum.php?forumlist=1&mobile=2 → 200 bygsjw 富模板（稳定）
//   内容页（mod=forumdisplay/viewthread）→ bygsjw 模板 common.js 的 ontouchend 设备门（touchemu.js 已根治），
//     守卫的上下文恢复保留为兜底（touchemu 定义失败时仍能接住）
//   portal.php = 永久死端（13.3KB 模板壳+空信息流，根域名默认落点）
// 守卫职责：
//   1) 内容页落地时记录参数上下文（10 秒内有效）；
//   2) 丢参落点（forum.php?mobile=1 无 mod）先恢复上下文（每上下文预算 2 次，防服务器固执回吐死循环）；
//   3) 无上下文/预算耗尽 → 归一化到稳定富首页形态 forumlist=1&mobile=2（每 URL 预算 2 次）；
//   4) 门户页 → 直接送论坛版块列表（每 URL 预算 2 次）。
(function () {
  'use strict';
  try {
    console.log('[sdg-nav] enter', location.pathname);
    if (!/^\/(?:forum|portal)\.php$/.test(location.pathname)) return;

    const params = new URLSearchParams(location.search);
    const mod = params.get('mod');
    // mobile=yes：misc.php?mod=mobile 选择器的落点形态（2026-10-04 测绘发现），按简易版同款处理
    const mobile = params.get('mobile') === 'yes' ? '1' : params.get('mobile');
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

    // ---- 门户页：死端（2026-10-04 实测定案：根域名默认落点，13.3KB 模板壳+空信息流，无文章）----
    // 送论坛版块列表（预算 2 次/URL，防异常回环）
    if (/^\/portal\.php$/.test(location.pathname)) {
      const pkey = 'sdg_portal:' + location.href;
      const p = parseInt(sessionStorage.getItem(pkey) || '0', 10);
      if (p < 2) {
        sessionStorage.setItem(pkey, String(p + 1));
        location.replace(location.origin + '/forum.php?forumlist=1&mobile=2');
      }
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
  } catch (e) { console.log('[sdg-nav] EXC', String(e && e.message || e)); }
})();
