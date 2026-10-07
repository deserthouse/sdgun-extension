// redraw/sidebar.js — 左栏论坛树导航（layout_blueprint Batch 2）。
// 树数据源：会话缓存 sdg_tree_cache（forumlist 解析成功时写入）；无缓存时仅显示首页入口。
// 布局：fixed 左栏 212px + 页面主锚点右移（.sdg-sb-on #wp）；<1100px 自动隐藏（Batch3 细化断点）。
// 主题：三段循环按钮（light→dark→auto），走 chrome.storage.sync，boot 的 onChanged 会重挂载（幂等）。
(function () {
  'use strict';

  const SB_CSS = `
    :host { all:initial; display:block; box-sizing:border-box;
      position:fixed; left:0; top:0; bottom:0; width:212px; z-index:2147483000;
      background:rgba(250,250,250,1); border-right:1px solid rgba(0,0,0,.08);
      font-family:system-ui,"Segoe UI","Microsoft YaHei",sans-serif; font-size:13px;
      color:#292524; overflow-y:auto; padding:14px 12px; }
    :host .brand { font-weight:700; font-size:14px; color:#b01f28; text-decoration:none;
      display:block; margin-bottom:10px; }
    :host a.home { display:block; padding:6px 10px; border-radius:8px;
      color:#44403c; text-decoration:none; font-weight:600; margin-bottom:8px; }
    :host a.home:hover { background:rgba(176,31,40,.08); }
    :host .grp { font-size:11.5px; font-weight:700; color:#a8a29e; margin:10px 4px 4px;
      letter-spacing:.5px; }
    :host a.bd { display:flex; align-items:center; gap:8px; padding:5px 10px;
      border-radius:8px; color:#44403c; text-decoration:none; }
    :host a.bd:hover { background:#f5f5f4; }
    :host a.bd.cur { background:rgba(176,31,40,.1); color:#b01f28; font-weight:600; }
    :host a.bd .nm { flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    :host a.bd img { width:18px; height:18px; border-radius:4px; object-fit:cover; flex:none;
      background:#eee; }
    :host .foot { margin-top:14px; border-top:1px solid rgba(0,0,0,.06); padding-top:10px; }
    :host button.theme { width:100%; border:1px solid rgba(0,0,0,.12); background:#fff;
      color:#57534e; border-radius:8px; padding:6px 0; font-size:12.5px; cursor:pointer; }
    :host button.theme:hover { border-color:#b01f28; color:#b01f28; }
    style.sdg-sb-style { }
    .sdg-sb-on #wp { margin-left: 212px; }
    @media (max-width: 1023px) {
      :host { display:none; }
      .sdg-sb-on #wp { margin-left: 0; }
    }
    @media (prefers-color-scheme: dark), (dark) { }
  `;
  const SB_CSS_DARK = `
    :host { background:rgba(17,18,20,1); border-right-color:#2c2d31; color:#d6d3d1; }
    :host a.home { color:#e7e5e4; }
    :host a.home:hover { background:rgba(255,107,122,.12); }
    :host a.bd { color:#d6d3d1; }
    :host a.bd:hover { background:#1e1f23; }
    :host a.bd.cur { background:rgba(255,107,122,.14); color:#ff6b7a; }
    :host .foot { border-top-color:#2c2d31; }
    :host button.theme { background:#1c1d21; border-color:#3a3b40; color:#a8a29e; }
    :host button.theme:hover { border-color:#ff6b7a; color:#ff6b7a; }
  `;

  const THEME_LABEL = { light: '主题：浅色', dark: '主题：深色', auto: '主题：跟随系统' };
  const NEXT = { light: 'dark', dark: 'auto', auto: 'light' };

  function mountSidebar(opts) {
    if (document.getElementById('sdg-sidebar')) return true;
    let groups = [];
    try {
      const raw = sessionStorage.getItem('sdg_tree_cache');
      if (raw) groups = (JSON.parse(raw).groups) || [];
    } catch (e) { /* 无缓存则只显示首页 */ }

    const host = document.createElement('div');
    host.id = 'sdg-sidebar';
    host.className = 'sdg-host'; // theme.css 重绘期白名单（body > *:not(.sdg-host) 全隐藏）
    const shadow = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = SB_CSS + (opts && opts.dark ? SB_CSS_DARK : '');
    shadow.appendChild(style);

    const el = (tag, attrs) => {
      const n = document.createElement(tag);
      for (const k of Object.keys(attrs || {})) {
        if (k === 'text') n.textContent = attrs[k];
        else n.setAttribute(k, attrs[k]);
      }
      return n;
    };

    shadow.appendChild(el('a', { class: 'brand', text: 'SDGun 导航', href: 'forum.php?forumlist=1&mobile=2' }));
    shadow.appendChild(el('a', { class: 'home', text: '论坛首页', href: 'forum.php?forumlist=1&mobile=2' }));

    const curFid = (location.search.match(/fid=(\d+)/) || [])[1];
    const foot = el('div', { class: 'foot' });
    // 树渲染（插入到 foot 之前）；跨标签副本（storage.local）供深链/新标签无会话缓存时异步补渲染
    function renderGroups(arr) {
      if (!arr || !arr.length || host.dataset.treeFilled) return;
      host.dataset.treeFilled = '1';
      shadow.querySelectorAll('.grp, a.bd').forEach((n) => n.remove());
      arr.forEach((g) => {
        if (!g.secs || !g.secs.length) return;
        const grp = el('div', { class: 'grp', text: g.name || '板块' });
        shadow.insertBefore(grp, foot);
        g.secs.forEach((s) => {
          const a = el('a', { class: 'bd' + (String(s.fid) === curFid ? ' cur' : ''),
            href: `forum.php?mod=forumdisplay&fid=${s.fid}&mobile=2` });
          if (s.icon) {
            const im = el('img', { src: s.icon, alt: '', loading: 'lazy', referrerpolicy: 'no-referrer' });
            a.appendChild(im);
          }
          a.appendChild(el('span', { class: 'nm', text: s.name || `fid${s.fid}` }));
          shadow.insertBefore(a, foot);
        });
      });
    }
    renderGroups(groups);
    try {
      chrome.storage.local.get({ sdg_tree_cache_ls: null }, (st) => {
        try {
          if (st && st.sdg_tree_cache_ls) renderGroups(JSON.parse(st.sdg_tree_cache_ls).groups);
        } catch (e) { /* ignore */ }
      });
    } catch (e) { /* storage 不可用 */ }

    const btn = el('button', { class: 'theme', text: THEME_LABEL[(opts && opts.theme) || 'auto'] });
    btn.addEventListener('click', () => {
      try {
        chrome.storage.sync.get({ theme: 'auto' }, (st) => {
          chrome.storage.sync.set({ theme: NEXT[st.theme] || 'auto' });
        });
      } catch (e) { /* storage 不可用则静默 */ }
    });
    foot.appendChild(btn);
    shadow.appendChild(foot);

    document.body.appendChild(host);
    // 布局标记 + 主锚点右移
    document.documentElement.classList.add('sdg-sb-on');
    if (!document.querySelector('style.sdg-sb-style')) {
      const st = document.createElement('style');
      st.className = 'sdg-sb-style';
      st.textContent = '.sdg-sb-on #wp { margin-left: 212px; } @media (max-width:1023px){ .sdg-sb-on #wp { margin-left:0; } }';
      (document.head || document.documentElement).appendChild(st);
    }
    return true;
  }

  window.SDGRedraw = window.SDGRedraw || {};
  window.SDGRedraw.mountSidebar = mountSidebar;
})();
