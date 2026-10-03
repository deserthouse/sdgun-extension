// navguard.js — 导航守卫（document_start）。
// 服务器某外部 JS 会把 forumdisplay/viewthread 页面跳转到 forum.php?mobile=1，
// 且丢弃 mod/fid/tid 参数——用户表现为"点不开任何板块"。
// 策略：离开内容页前记住参数上下文；落到无参数的 forum.php?mobile=1 时，
// 若刚从内容页被跳来（计数护栏防死循环），纠正回带参数的 mobile=1 页面。
(function () {
  'use strict';
  try {
    const SKEY = 'sdg_nav_ctx';
    const CKEY = 'sdg_nav_fix';

    const params = new URLSearchParams(location.search);
    const mod = params.get('mod');

    if (mod === 'forumdisplay' || mod === 'viewthread') {
      // 内容页：记录上下文（板块/帖子参数 + mobile=1 形态），清零纠正计数
      const keep = new URLSearchParams();
      keep.set('mod', mod);
      for (const k of ['fid', 'tid', 'page', 'authorid', 'orderby', 'filter']) {
        const v = params.get(k);
        if (v) keep.set(k, v);
      }
      keep.set('mobile', '1');
      sessionStorage.setItem(SKEY, keep.toString());
      sessionStorage.removeItem(CKEY);
      return;
    }

    // 落点：forum.php 无 mod（被丢参跳转的简易首页）
    if (!mod && /forum\.php/.test(location.pathname)) {
      const ctx = sessionStorage.getItem(SKEY);
      if (!ctx) return;
      let fixes = parseInt(sessionStorage.getItem(CKEY) || '0', 10);
      if (fixes >= 2) return; // 护栏：纠正两次仍被跳，放弃（保留可用首页）
      sessionStorage.setItem(CKEY, String(fixes + 1));
      sessionStorage.removeItem(SKEY);
      location.replace(location.origin + '/forum.php?' + ctx);
    }
  } catch (e) { /* sessionStorage 不可用则静默 */ }
})();
