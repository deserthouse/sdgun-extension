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
    // follow system switches while on auto
    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        if (prefs.theme === 'auto') applyTheme();
      });
    }
  }

  // ---- page-type tag immediately (CSS applies before prefs arrive) ----
  applyTheme();

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

  function applyRedraw() {
    if (!window.SDGRedraw) { showBadge('SDGun ' + (window.SDG_VER || '') + ' redraw.js 未加载'); return; }
    if (!prefs.skin) { window.SDGRedraw.unmount(); clearBadge(); return; }
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
