// redraw/rightrail.js — 帖子页右栏（layout_blueprint Batch 3）。
// 楼主卡（头像/名/本页楼数）+ 楼层速览（本页楼主楼层锚点 chips，点击平滑滚动）。
// 数据：viewthread mount 导出的 window.SDGRedraw.lastFloors（零额外解析/请求）。
// 布局：fixed 右栏 208px，仅 ≥1280px 显示（.sdg-rt-on 下 #wp 右让位）；楼层数据缺失则不挂载。
(function () {
  'use strict';

  const RT_CSS = `
    :host { all: initial; display: block; box-sizing: border-box;
      --surface: #ffffff; --surface2: #f1efee; --border: rgba(0,0,0,.08); --border2: rgba(0,0,0,.14);
      --text: #1c1917; --text2: #57534e; --text3: #a8a29e; --accent: #b01f28;
      position: fixed; right: 14px; top: 64px; width: 264px; max-height: calc(100vh - 80px);
      overflow-y: auto; z-index: 2147483000;
      background: var(--surface); border: 1px solid var(--border); border-radius: 16px;
      font-family: system-ui, "Segoe UI", "Microsoft YaHei", sans-serif; font-size: 13px;
      color: var(--text); padding: 14px; }
    :host .sect { font-size: 11.5px; font-weight: 700; color: var(--text3); margin: 2px 2px 8px; letter-spacing: .8px; }
    :host a.nitem { display: block; padding: 6px 6px; border-radius: 8px;
      color: var(--text2); text-decoration: none; font-size: 13px; line-height: 1.5;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap; transition: background .12s; }
    :host a.nitem:hover { background: var(--surface2); color: var(--accent); }
    :host a.nmore { display: block; margin-top: 8px; padding: 6px; border-top: 1px solid var(--border);
      color: var(--accent); text-decoration: none; font-size: 12.5px; font-weight: 600; }
    :host a.nmore:hover { text-decoration: underline; }
    :host .opcard { display: flex; flex-direction: column; align-items: center; gap: 6px;
      padding-bottom: 10px; border-bottom: 1px solid var(--border); }
    :host .opcard img { width: 56px; height: 56px; border-radius: 14px; object-fit: cover; background: var(--surface2); }
    :host .opcard .afb { width: 56px; height: 56px; border-radius: 14px; background: var(--surface2);
      color: var(--text2); display: flex; align-items: center; justify-content: center; font-size: 22px; font-weight: 700; }
    :host .opcard a { font-weight: 700; color: var(--text); text-decoration: none; font-size: 13.5px; }
    :host .opcard a:hover { color: var(--accent); }
    :host .opcard .cnt { color: var(--text3); font-size: 11.5px; }
    :host .chips { display: flex; flex-wrap: wrap; gap: 4px; }
    :host .chips button { border: 1px solid var(--border2); background: var(--surface); color: var(--text2);
      border-radius: 7px; padding: 2px 8px; font-size: 11.5px; cursor: pointer; }
    :host .chips button:hover { border-color: var(--accent); color: var(--accent); }
    @media (max-width: 1399px) { :host { display: none; } }
  `;
  const RT_DARK = `
    :host { --surface: #17181b; --surface2: #222329; --border: #26272c; --border2: #34353b;
      --text: #e7e5e4; --text2: #a8a29e; --text3: #78716c; --accent: #ff6b7a; }
  `;

  function mountRail(opts) {
    const existing = document.getElementById('sdg-rail');
    if (existing) existing.remove();
    // 帖子页：楼主卡+楼层速览（原逻辑）；列表页：公告卡（复用内容河缓存，消灭右侧空白）
    const isThread = /mod=viewthread/.test(location.search);
    if (!isThread) return mountNoticeRail(opts);
    const floors = (window.SDGRedraw || {}).lastFloors;
    if (!floors || !floors.length) return false;

    const op = floors[0];
    const opUid = (op.authorHref.match(/uid=(\d+)/) || [])[1] || '';
    const opFloors = opUid
      ? floors.filter((f) => (f.authorHref.match(/uid=(\d+)/) || [])[1] === opUid)
      : [op];
    if (!op.author) return false;

    const host = document.createElement('div');
    host.id = 'sdg-rail';
    host.className = 'sdg-host'; // theme.css 重绘白名单
    if (opts && opts.dark) host.classList.add('dark');
    const shadow = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = RT_CSS + (opts && opts.dark ? RT_DARK : '');
    shadow.appendChild(style);

    const el = (tag, attrs) => {
      const n = document.createElement(tag);
      for (const k of Object.keys(attrs || {})) {
        if (k === 'text') n.textContent = attrs[k];
        else n.setAttribute(k, attrs[k]);
      }
      return n;
    };

    const card = el('div', { class: 'opcard' });
    if (op.avatar) card.appendChild(el('img', { src: op.avatar, alt: '', referrerpolicy: 'no-referrer' }));
    else card.appendChild(el('div', { class: 'afb', text: op.author[0].toUpperCase() }));
    card.appendChild(el('a', { text: op.author, href: op.authorHref || '#' }));
    card.appendChild(el('span', { class: 'cnt', text: `本页 ${opFloors.length} 楼` }));
    shadow.appendChild(card);

    shadow.appendChild(el('div', { class: 'sect', text: '楼主楼层速览' }));
    const chips = el('div', { class: 'chips' });
    opFloors.slice(0, 30).forEach((f) => {
      const label = f.floor || `${floors.indexOf(f) + 1}#`;
      const b = el('button', { text: label });
      b.addEventListener('click', () => {
        const n = (String(label).match(/(\d+)/) || [])[1];
        const target = document.querySelector(`#sdg-redraw-host`) &&
          document.getElementById('sdg-redraw-host').shadowRoot.querySelector(`[data-floor="${n}"]`);
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
          target.classList.add('flash');
          setTimeout(() => target.classList.remove('flash'), 1200);
        }
      });
      chips.appendChild(b);
    });
    if (opFloors.length > 30) chips.appendChild(el('span', { class: 'cnt', text: `…共 ${opFloors.length} 楼` }));
    shadow.appendChild(chips);

    document.body.appendChild(host);
    document.documentElement.classList.add('sdg-rt-on');
    return true;
  }

  // 列表页右栏：公告卡（数据=内容河缓存 fid=39 最新帖；无缓存则隐藏右栏）
  function mountNoticeRail(opts) {
    let items = [];
    try {
      const raw = sessionStorage.getItem('sdg_river_cache');
      if (raw) items = (JSON.parse(raw).items || []).slice(0, 8);
    } catch (e) { /* ignore */ }
    if (!items.length) return false;

    const host = document.createElement('div');
    host.id = 'sdg-rail';
    host.className = 'sdg-host';
    if (opts && opts.dark) host.classList.add('dark');
    const shadow = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = RT_CSS + (opts && opts.dark ? RT_DARK : '');
    shadow.appendChild(style);

    const el = (tag, attrs) => {
      const n = document.createElement(tag);
      for (const k of Object.keys(attrs || {})) {
        if (k === 'text') n.textContent = attrs[k];
        else n.setAttribute(k, attrs[k]);
      }
      return n;
    };

    shadow.appendChild(el('div', { class: 'sect', text: '最新公告' }));
    items.forEach((it) => {
      const a = el('a', { class: 'nitem', href: it.href });
      a.appendChild(el('span', { class: 'nt', text: it.t }));
      shadow.appendChild(a);
    });
    const more = el('a', { class: 'nmore', text: '进入站务公告 ›',
      href: 'forum.php?mod=forumdisplay&fid=39&mobile=2' });
    shadow.appendChild(more);

    document.body.appendChild(host);
    document.documentElement.classList.add('sdg-rt-on');
    return true;
  }

  window.SDGRedraw = window.SDGRedraw || {};
  window.SDGRedraw.mountRail = mountRail;
})();
