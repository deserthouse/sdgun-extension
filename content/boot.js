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
    try {
      if (SDG.page.isViewThread()) { ok = window.SDGRedraw.mount(SDG, opts); how = 'viewthread'; }
      else if (SDG.page.isForumDisplay()) { ok = window.SDGRedraw.mountForumDisplay(SDG, opts); how = 'forumdisplay'; }
      else if (SDG.page.isForumList()) { ok = window.SDGRedraw.mountForumList(SDG, opts); how = 'forumlist'; }
    } catch (e) { ok = false; how = 'EXC ' + String(e).slice(0, 60); }
    if (ok) { clearBadge(); }
    else if (how) {
      // 服务器抽风：bygsjw 页面常被截断成骨架（头部在、列表数据缺）。
      // 自动重载一次重试（sessionStorage 护栏防死循环），仍失败则停回退态。
      const looksTruncated = /mobile=\d/.test(location.search)
        && document.querySelector('.hd, .ft, .footer')
        && !document.querySelector('ul.byg_threadlist_ul, .postlist, .sub_forum');
      const key = 'sdg-retry:' + location.href;
      if (looksTruncated && !sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, '1');
        showBadge(ver + ' 服务器响应不完整，自动重试…');
        setTimeout(() => location.reload(), 2500);
        return;
      }
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
