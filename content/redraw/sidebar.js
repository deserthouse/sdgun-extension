// redraw/sidebar.js — 左栏论坛树导航（layout_blueprint Batch 2）。
// 树数据源：会话缓存 sdg_tree_cache（forumlist 解析成功时写入）；无缓存时仅显示首页入口。
// 布局：fixed 左栏 212px + 页面主锚点右移（.sdg-sb-on #wp）；<1100px 自动隐藏（Batch3 细化断点）。
// 主题：三段循环按钮（light→dark→auto），走 chrome.storage.sync，boot 的 onChanged 会重挂载（幂等）。
(function () {
  'use strict';

  const SB_CSS = `
    :host { all: initial; display: flex; flex-direction: column; box-sizing: border-box;
      position: fixed; left: 0; top: 0; bottom: 0; width: 216px; z-index: 2147483000;
      --surface: #ffffff; --surface2: #f1efee; --border: rgba(0,0,0,.08); --border2: rgba(0,0,0,.14);
      --text: #1c1917; --text2: #57534e; --text3: #a8a29e; --accent: #b01f28;
      background: var(--surface); border-right: 1px solid var(--border);
      font-family: system-ui, "Segoe UI", "Microsoft YaHei", sans-serif; font-size: 13px;
      color: var(--text); overflow-y: auto; padding: 16px 12px 14px; }
    :host .brand { font-weight: 800; font-size: 15px; color: var(--accent); text-decoration: none;
      display: flex; align-items: center; gap: 7px; margin: 0 6px 12px; letter-spacing: .3px; }
    :host .brand svg { width: 17px; height: 17px; }
    :host a.home { display: flex; align-items: center; gap: 9px; padding: 7px 10px; border-radius: 10px;
      color: var(--text2); text-decoration: none; font-weight: 600; margin: 1px 0; transition: background .12s; }
    :host a.home:hover { background: var(--surface2); color: var(--text); }
    :host a.home svg { width: 15px; height: 15px; opacity: .75; flex: none; }
    :host a.home.quick { font-weight: 500; font-size: 12.5px; padding: 5px 10px; color: var(--text3); }
    :host .grp { font-size: 11px; font-weight: 700; color: var(--text3); margin: 14px 10px 5px;
      letter-spacing: .8px; }
    :host a.bd { position: relative; display: flex; align-items: center; gap: 9px; padding: 6px 10px;
      border-radius: 10px; color: var(--text2); text-decoration: none; transition: background .12s; }
    :host a.bd:hover { background: var(--surface2); color: var(--text); }
    :host a.bd.cur { background: color-mix(in srgb, var(--accent) 10%, transparent); color: var(--accent); font-weight: 600; }
    :host a.bd.cur::before { content: ""; position: absolute; left: 0; top: 7px; bottom: 7px;
      width: 3px; border-radius: 2px; background: var(--accent); }
    :host a.bd .nm { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    :host a.bd img { width: 20px; height: 20px; border-radius: 6px; object-fit: cover; flex: none;
      background: var(--surface2); }
    :host .tree-hint { color: var(--text3); font-size: 11.5px; padding: 8px 10px; line-height: 1.5; }
    :host .foot { margin-top: auto; border-top: 1px solid var(--border); padding-top: 10px; }
    :host button.theme { width: 100%; border: 1px solid var(--border2); background: var(--surface);
      color: var(--text2); border-radius: 10px; padding: 6px 0; font-size: 12px; cursor: pointer;
      display: flex; align-items: center; justify-content: center; gap: 6px; transition: all .12s; }
    :host button.theme:hover { border-color: var(--accent); color: var(--accent); }
    :host button.theme svg { width: 13px; height: 13px; }
    /* 窄视口隐藏（v1.15 重写时丢失，本轮 AVD 对比在 420px 视口暴露） */
    @media (max-width: 1023px) { :host { display: none; } }
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
    style.textContent = opts && opts.dark ? SB_CSS.replace('--surface: #ffffff', '--surface: #17181b').replace('--surface2: #f1efee', '--surface2: #222329').replace('--border: rgba(0,0,0,.08)', '--border: #26272c').replace('--border2: rgba(0,0,0,.14)', '--border2: #34353b').replace('--text: #1c1917', '--text: #e7e5e4').replace('--text2: #57534e', '--text2: #a8a29e').replace('--text3: #a8a29e', '--text3: #78716c').replace('--accent: #b01f28', '--accent: #ff6b7a') : SB_CSS;
    shadow.appendChild(style);

    const el = (tag, attrs) => {
      const n = document.createElement(tag);
      for (const k of Object.keys(attrs || {})) {
        if (k === 'text') n.textContent = attrs[k];
        else n.setAttribute(k, attrs[k]);
      }
      return n;
    };

    const svgIcon = (d) => {
      const ns = 'http://www.w3.org/2000/svg';
      const sv = document.createElementNS(ns, 'svg');
      sv.setAttribute('viewBox', '0 0 24 24');
      sv.setAttribute('fill', 'none');
      sv.setAttribute('stroke', 'currentColor');
      sv.setAttribute('stroke-width', '2');
      sv.setAttribute('stroke-linecap', 'round');
      sv.setAttribute('stroke-linejoin', 'round');
      const path = document.createElementNS(ns, 'path');
      path.setAttribute('d', d);
      sv.appendChild(path);
      return sv;
    };
    const ICONS = {
      brand: 'M12 2L3 7l9 5 9-5-9-5zM3 17l9 5 9-5M3 12l9 5 9-5',
      home: 'M3 12l9-9 9 9M5 10v10h5v-6h4v6h5V10',
      search: 'M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.35-4.35',
      user: 'M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z',
      theme: 'M21 12.8A9 9 0 1111.2 3 7 7 0 0021 12.8z',
    };
    const brandEl = el('a', { class: 'brand', href: 'forum.php?forumlist=1&mobile=2' });
    brandEl.appendChild(svgIcon(ICONS.brand));
    brandEl.appendChild(document.createTextNode('SDGun 导航'));
    shadow.appendChild(brandEl);
    const homeEl = el('a', { class: 'home', href: 'forum.php?forumlist=1&mobile=2' });
    homeEl.appendChild(svgIcon(ICONS.home));
    homeEl.appendChild(document.createTextNode('论坛首页'));
    shadow.appendChild(homeEl);
    // 快捷入口（真实页面导航）：全局搜索 + 登录/我的（游客态=登录页）
    const q1 = el('a', { class: 'home quick', href: 'search.php?mod=forum&mobile=2' });
    q1.appendChild(svgIcon(ICONS.search)); q1.appendChild(document.createTextNode('搜索'));
    shadow.appendChild(q1);
    const q2 = el('a', { class: 'home quick', href: 'member.php?mod=logging&action=login&mobile=2' });
    q2.appendChild(svgIcon(ICONS.user)); q2.appendChild(document.createTextNode('登录 / 我的'));
    shadow.appendChild(q2);

    const curFid = (location.search.match(/fid=(\d+)/) || [])[1];
    const foot = el('div', { class: 'foot' });
    const btn = el('button', { class: 'theme' });
    btn.appendChild(svgIcon(ICONS.theme));
    btn.appendChild(document.createTextNode(THEME_LABEL[(opts && opts.theme) || 'auto'].replace('主题：', '')));
    btn.addEventListener('click', () => {
      try {
        chrome.storage.sync.get({ theme: 'auto' }, (st) => {
          chrome.storage.sync.set({ theme: NEXT[st.theme] || 'auto' });
        });
      } catch (e) { /* storage 不可用则静默 */ }
    });
    foot.appendChild(btn);
    shadow.appendChild(foot); // 必须先入树：下方 renderGroups 的 insertBefore 以 foot 为参照
    // 树渲染（插入到 foot 之前）；跨标签副本（storage.local）供深链/新标签无会话缓存时异步补渲染
    function renderGroups(arr) {
      if (!arr || !arr.length || host.dataset.treeFilled) return;
      host.dataset.treeFilled = '1';
      shadow.querySelectorAll('.grp, a.bd, .tree-hint').forEach((n) => n.remove());
      arr.forEach((g) => {
        if (!g.secs || !g.secs.length) return;
        const grp = el('div', { class: 'grp', text: g.name || '板块' });
        shadow.insertBefore(grp, foot);
        g.secs.forEach((s) => {
          const a = el('a', { class: 'bd' + (String(s.fid) === curFid ? ' cur' : ''),
            href: `forum.php?mod=forumdisplay&fid=${s.fid}&mobile=2` });
          if (s.icon) {
            const im = el('img', { src: s.icon, alt: '', loading: 'lazy', referrerpolicy: 'no-referrer' });
            im.addEventListener('error', () => {
              // 图标 404（实测：卫星区 common_153_icon.png）→ 模板默认图回退，再失败才隐去
              if (im.dataset.fb) { im.style.display = 'none'; return; }
              im.dataset.fb = '1';
              const fb = window.SDG && window.SDG.assets && window.SDG.assets.defaultBoardIcon;
              if (fb) im.src = fb; else im.style.display = 'none';
            });
            a.appendChild(im);
          }
          a.appendChild(el('span', { class: 'nm', text: s.name || `fid${s.fid}` }));
          shadow.insertBefore(a, foot);
        });
      });
    }
    renderGroups(groups);
    if (!groups.length) {
      const hint = el('div', { class: 'tree-hint', text: '板块树将在首次访问论坛首页后显示' });
      shadow.insertBefore(hint, foot);
    }
    try {
      chrome.storage.local.get({ sdg_tree_cache_ls: null }, (st) => {
        try {
          if (st && st.sdg_tree_cache_ls) renderGroups(JSON.parse(st.sdg_tree_cache_ls).groups);
        } catch (e) { /* ignore */ }
      });
    } catch (e) { /* storage 不可用 */ }

    document.body.appendChild(host);
    // 布局标记（版式规则集中在 theme.css）
    document.documentElement.classList.add('sdg-sb-on');
    return true;
  }

  window.SDGRedraw = window.SDGRedraw || {};
  window.SDGRedraw.mountSidebar = mountSidebar;
})();
