// navguard.js — 导航守卫（document_start）。
// 服务器按 URL 里的 mobile 参数分流模板：mobile=1 = 简易版（无样式），mobile=2 = bygsjw 触屏版（完整样式）。
// 两类问题在此统一纠正：
// 1) 内容页（forumdisplay/viewthread）被外部 JS 跳到 forum.php?mobile=1 丢参 → 恢复参数上下文；
// 2) 任何 mobile=1 页面 → 归一化到 mobile=2（把用户留在有样式的触屏版）。
// 护栏：每 URL 会话内最多纠正 2 次，防服务器固执回吐造成死循环。
(function () {
  'use strict';
  try {
    if (!/forum\.php/.test(location.pathname)) return;

    const params = new URLSearchParams(location.search);
    const mod = params.get('mod');
    const mobile = params.get('mobile');

    // ---- 规则 1：内容页被丢参跳到 mobile=1 → 恢复参数上下文（v1.6.1 行为，保留） ----
    if ((mod === 'forumdisplay' || mod === 'viewthread') && mobile === '1') {
      const SKEY = 'sdg_nav_ctx';
      const ctx = sessionStorage.getItem(SKEY);
      if (ctx) {
        sessionStorage.removeItem(SKEY);
        location.replace(location.origin + '/forum.php?' + ctx);
      }
      return;
    }

    // ---- 规则 2：任何 mobile=1 页面 → 归一化 mobile=2（样式完整的触屏版） ----
    // 护栏按 URL 计数，同一 URL 最多纠正 2 次
    if (mobile === '1') {
      const key = 'sdg_m2:' + location.href;
      const n = parseInt(sessionStorage.getItem(key) || '0', 10);
      if (n >= 2) return;
      sessionStorage.setItem(key, String(n + 1));
      const u = new URL(location.href);
      u.searchParams.set('mobile', '2');
      location.replace(u.toString());
      return;
    }

    // ---- 内容页：记录参数上下文（供规则 1 使用），并清纠正计数 ----
    if (mod === 'forumdisplay' || mod === 'viewthread') {
      const keep = new URLSearchParams();
      keep.set('mod', mod);
      for (const k of ['fid', 'tid', 'page', 'authorid', 'orderby', 'filter']) {
        const v = params.get(k);
        if (v) keep.set(k, v);
      }
      keep.set('mobile', '1'); // 上下文按 mobile=1 存（纠正目标形态），归一化由规则 2 完成
      sessionStorage.setItem(SKEY, keep.toString());
      const ckey = 'sdg_m2:' + location.href;
      sessionStorage.removeItem(ckey);
    }
  } catch (e) { /* sessionStorage 不可用则静默 */ }
})();
