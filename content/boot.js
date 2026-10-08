// v1.1.0 theming layer: page-type tagging, dark-mode class management,
// image lightbox. Everything is fail-open: any missing element = feature
// silently skipped; the original page keeps working untouched.

(function () {
  'use strict';
  const SDG = window.SDG;
  if (!SDG) return; // selectors.js missing -> do nothing

  // ---- preferences (synced via chrome.storage; fail-open defaults) ----
  let prefs = { theme: 'auto', skin: true, lightbox: true, redraw: true };
  try {
    chrome.storage.sync.get(prefs, (stored) => {
      prefs = Object.assign(prefs, stored || {});
      applyTheme();
      applyRedraw();
    });
    chrome.storage.onChanged.addListener((changes) => {
      for (const k of Object.keys(changes)) prefs[k] = changes[k].newValue;
      applyTheme();
      applyRedraw();
    });
  } catch (e) {
    applyTheme(); // storage unavailable -> defaults
    applyRedraw();
  }

  function systemDark() {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  function applyTheme() {
    const root = document.documentElement;
    root.classList.toggle('sdg-theme-dark',
      prefs.skin && (prefs.theme === 'dark' || (prefs.theme === 'auto' && systemDark())));
    root.classList.toggle('sdg-skin-off', !prefs.skin);
    // page-type tag for CSS hooks
    root.classList.toggle('sdg-page-forumlist', SDG.page.isForumList());
    root.classList.toggle('sdg-page-forumdisplay', SDG.page.isForumDisplay());
    root.classList.toggle('sdg-page-viewthread', SDG.page.isViewThread());
    // L3 登录/搜索页（member.php / search.php）：PC 排版注入钩子（theme.css 按此标签限宽居中）
    root.classList.toggle('sdg-page-login', /\/member\.php$/.test(location.pathname));
    root.classList.toggle('sdg-page-search', /\/search\.php$/.test(location.pathname));
  }

  // ---- page-type tag immediately (CSS applies before prefs arrive) ----
  applyTheme();

  // follow system switches while on auto（顶层注册一次，避免叠加）
  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (prefs.theme === 'auto') applyTheme();
    });
  }

  // ---- thread/list-page redraw (Shadow DOM card view; fail-open + 诊断角标) ----
  function showBadge(msg) {
    try {
      let b = document.getElementById('sdg-diag-badge');
      if (!b) {
        b = document.createElement('div');
        b.id = 'sdg-diag-badge';
        b.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:2147483646;background:rgba(176,31,40,.92);color:#fff;font:11px/1.4 system-ui,sans-serif;padding:4px 8px;border-radius:6px;pointer-events:none;';
        (document.body || document.documentElement).appendChild(b);
      }
      b.textContent = msg;
    } catch (e) { /* ignore */ }
  }
  function showShellOverlay(ver) {
    try {
      if (document.getElementById('sdg-shell-overlay')) return;
      const ov = document.createElement('div');
      ov.id = 'sdg-shell-overlay';
      ov.style.cssText = 'position:fixed;inset:0;z-index:2147483600;display:flex;align-items:center;justify-content:center;'
        + 'background:rgba(245,245,244,.96);font-family:system-ui,"Segoe UI","Microsoft YaHei",sans-serif;';
      if (document.documentElement.classList.contains('sdg-theme-dark')) {
        ov.style.background = 'rgba(17,18,20,.97)';
      }
      const card = document.createElement('div');
      card.style.cssText = 'max-width:420px;margin:0 24px;padding:28px 30px;border:1px solid rgba(0,0,0,.1);'
        + 'border-radius:14px;background:#fff;text-align:center;color:#292524;';
      if (document.documentElement.classList.contains('sdg-theme-dark')) {
        card.style.background = '#1a1b1e';
        card.style.borderColor = '#2c2d31';
        card.style.color = '#d6d3d1';
      }
      const h = document.createElement('div');
      h.style.cssText = 'font-weight:700;font-size:17px;margin-bottom:10px;';
      h.textContent = '服务器响应不完整';
      const t = document.createElement('div');
      t.style.cssText = 'font-size:13.5px;line-height:1.7;opacity:.75;margin-bottom:18px;';
      t.textContent = '论坛服务器偶尔不稳定，稍后重试通常可恢复。' + (ver ? '（' + ver + '）' : '');
      const b = document.createElement('button');
      b.style.cssText = 'border:0;border-radius:9px;background:#b01f28;color:#fff;'
        + 'padding:9px 34px;font-size:14px;cursor:pointer;';
      b.textContent = '重试';
      b.addEventListener('click', () => { try { sessionStorage.removeItem('sdg-retry:' + location.href); } catch (e) {} location.reload(); });
      card.appendChild(h); card.appendChild(t); card.appendChild(b);
      ov.appendChild(card);
      document.body.appendChild(ov);
    } catch (e) { /* ignore */ }
  }

  function clearBadge() {
    const b = document.getElementById('sdg-diag-badge');
    if (b) b.remove();
  }

  let lateObserver = null;
  function watchLateContent(cb) {
    if (lateObserver) return; // 单例：同页只观察一次
    try {
      lateObserver = new MutationObserver((muts) => {
        for (const m of muts) {
          for (const n of m.addedNodes) {
            if (n.nodeType !== 1) continue;
            const hit = n.matches && (n.matches('ul.byg_threadlist_ul, .postlist, .sub_forum, div.bm, div[id^="pid"]')
              || n.querySelector && n.querySelector('ul.byg_threadlist_ul, .postlist, .sub_forum, div.bm, div[id^="pid"]'));
            if (hit) {
              lateObserver.disconnect();
              lateObserver = null;
              cb();
              return;
            }
          }
        }
      });
      lateObserver.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => {
        if (lateObserver) { lateObserver.disconnect(); lateObserver = null; }
      }, 10000);
    } catch (e) { /* observer 不可用则放弃 */ }
  }

  function applyRedraw() {
    if (!window.SDGRedraw) { showBadge('SDGun ' + (window.SDG_VER || '') + ' redraw.js 未加载'); return; }
    if (!prefs.skin || prefs.redraw === false) { window.SDGRedraw.unmount(); clearBadge(); return; }
    const opts = {
      dark: prefs.theme === 'dark' || (prefs.theme === 'auto' && systemDark()),
    };
    const ver = 'v' + (window.SDG_VER || '');
    let ok = false, how = '';
    // 幂等：重挂载前先卸载（主题切换经 onChanged 会重跑本函数，否则 host 叠层）
    try { window.SDGRedraw.unmount(); } catch (e) { /* ignore */ }
    try {
      if (SDG.page.isViewThread()) { ok = window.SDGRedraw.mount(SDG, opts); how = 'viewthread'; }
      else if (SDG.page.isForumDisplay()) { ok = window.SDGRedraw.mountForumDisplay(SDG, opts); how = 'forumdisplay'; }
      else if (SDG.page.isForumList()) { ok = window.SDGRedraw.mountForumList(SDG, opts); how = 'forumlist'; }
    } catch (e) { ok = false; how = 'EXC ' + String(e).slice(0, 160); console.log('[sdg-boot] EXC', (e && e.stack) || e); }
    if (ok) {
      clearBadge();
      const ov = document.getElementById('sdg-shell-overlay');
      if (ov) ov.remove();
      // Batch2：左栏论坛树导航（树取会话缓存；主题切换经重挂载刷新配色/按钮文案）
      try {
        if (window.SDGRedraw.mountSidebar) {
          window.SDGRedraw.mountSidebar({ dark: opts.dark, theme: prefs.theme });
        }
      } catch (e) { /* 侧栏失败不影响主内容 */ }
      // 视觉审计修复：顶栏让位（侧栏/右栏激活时给宿主打位移类）
      try {
        const sbOn = document.documentElement.classList.contains('sdg-sb-on');
        const rtOn = document.documentElement.classList.contains('sdg-rt-on');
        for (const id of ['sdg-redraw-list', 'sdg-redraw-host']) {
          const h = document.getElementById(id);
          if (!h) continue;
          h.classList.toggle('sb-shift', sbOn);
          h.classList.toggle('rt-shift', rtOn);
        }
      } catch (e) { /* ignore */ }
      // Batch3：帖子页右栏（楼主卡+楼层速览，仅 viewthread 有 lastFloors）
      try {
        if (how === 'viewthread' && window.SDGRedraw.mountRail) {
          window.SDGRedraw.mountRail({ dark: opts.dark });
        }
      } catch (e) { /* 右栏失败不影响主内容 */ }
      // 内容页成功渲染 → 清丢参恢复预算，下一次被服务器踢回时有全额恢复机会
      try {
        Object.keys(sessionStorage).filter((k) => k.indexOf('sdg_rs:') === 0)
          .forEach((k) => sessionStorage.removeItem(k));
      } catch (e) { /* ignore */ }
    }
    else if (how) {
      // 服务器抽风：bygsjw 页面常被截断成骨架/空壳（脚手架在、内容缺——两类形态，v1.7 统一判定）。
      // 自动重载一次重试（sessionStorage 护栏防死循环），仍失败则试论坛树缓存，再失败停回退态。
      const looksEmpty = (window.SDGRedrawBase && window.SDGRedrawBase.util.looksEmpty
        && /mobile=\d/.test(location.search)) ? window.SDGRedrawBase.util.looksEmpty(how) : false;
      const key = 'sdg-retry:' + location.href;
      if (looksEmpty && !sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, '1');
        showBadge(ver + ' 服务器响应不完整，自动重试…');
        setTimeout(() => location.reload(), 2500);
        return;
      }
      // P0-2 论坛树缓存：壳态重试耗尽后，用会话内缓存树渲染（标注缓存），不再白屏
      if (how === 'forumlist') {
        try {
          const raw = sessionStorage.getItem('sdg_tree_cache');
          if (raw) {
            const cache = JSON.parse(raw);
            if (cache && cache.groups && cache.groups.length
                && window.SDGRedraw.mountForumList(SDG, opts, cache.groups)) {
              clearBadge();
              return;
            }
          }
        } catch (e) { /* 缓存损坏则走回退 */ }
      }
      // 壳态终局覆盖层（同 Android 错误层哲学）：重试与缓存都未救回时，
      // 居中给出人话提示+重试钮，替代裸壳页。挂载成功路径会移除。
      if (looksEmpty) showShellOverlay(ver);
      // P1-3：两段式响应（壳+AJAX）——内容后到，观察容器出现后重挂载一次
      watchLateContent(() => {
        showBadge(ver + ' 内容延迟到达，重新挂载…');
        applyRedraw();
      });
      showBadge(ver + ' 重绘未命中 [' + how + '] 已回退原版');
    }
    else { clearBadge(); }
  }

  // ---- image lightbox (delegated; works for content added later too) ----
  function initLightbox() {
    if (!prefs.lightbox || !prefs.skin) return;
    document.addEventListener('click', (ev) => {
      const img = ev.target.closest && ev.target.closest(SDG.common.contentImages);
      if (!img) return;
      ev.preventDefault();
      ev.stopPropagation();
      const overlay = document.createElement('div');
      overlay.className = 'sdg-lightbox';
      const big = document.createElement('img');
      big.src = img.src;
      overlay.appendChild(big);
      overlay.addEventListener('click', () => overlay.remove());
      document.body.appendChild(overlay);
    }, true);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLightbox);
  } else {
    initLightbox();
  }
})();
