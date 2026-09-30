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

  // ---- thread-page redraw (Shadow DOM card view; fail-open) ----
  function applyRedraw() {
    if (!window.SDGRedraw) return;
    if (!prefs.skin) { window.SDGRedraw.unmount(); return; }
    const opts = {
      dark: prefs.theme === 'dark' || (prefs.theme === 'auto' && systemDark()),
    };
    let ok = false;
    try {
      if (SDG.page.isViewThread()) ok = window.SDGRedraw.mount(SDG, opts);
      else if (SDG.page.isForumDisplay()) ok = window.SDGRedraw.mountForumDisplay(SDG, opts);
      else if (SDG.page.isForumList()) ok = window.SDGRedraw.mountForumList(SDG, opts);
    } catch (e) { ok = false; }
    if (!ok) window.SDGRedraw.unmount(); // fail-open
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
