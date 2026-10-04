// redraw/rightrail.js — 帖子页右栏（layout_blueprint Batch 3）。
// 楼主卡（头像/名/本页楼数）+ 楼层速览（本页楼主楼层锚点 chips，点击平滑滚动）。
// 数据：viewthread mount 导出的 window.SDGRedraw.lastFloors（零额外解析/请求）。
// 布局：fixed 右栏 208px，仅 ≥1280px 显示（.sdg-rt-on 下 #wp 右让位）；楼层数据缺失则不挂载。
(function () {
  'use strict';

  const RT_CSS = `
    :host { all:initial; display:block; box-sizing:border-box;
      position:fixed; right:8px; top:60px; width:200px; max-height:calc(100vh - 76px);
      overflow-y:auto; z-index:2147483000;
      background:rgba(250,250,250,.97); border:1px solid rgba(0,0,0,.08); border-radius:12px;
      font-family:system-ui,"Segoe UI","Microsoft YaHei",sans-serif; font-size:12.5px;
      color:#292524; padding:12px; }
    :host .opcard { display:flex; flex-direction:column; align-items:center; gap:6px;
      padding-bottom:10px; border-bottom:1px solid rgba(0,0,0,.06); }
    :host .opcard img { width:56px; height:56px; border-radius:12px; object-fit:cover; background:#e7e5e4; }
    :host .opcard .afb { width:56px; height:56px; border-radius:12px; background:#d6d3d1;
      color:#57534e; display:flex; align-items:center; justify-content:center; font-size:22px; font-weight:700; }
    :host .opcard a { font-weight:700; color:#1c1917; text-decoration:none; font-size:13.5px; }
    :host .opcard a:hover { color:#b01f28; }
    :host .opcard .cnt { color:#a8a29e; font-size:11.5px; }
    :host .sect { font-size:11px; font-weight:700; color:#a8a29e; margin:10px 2px 6px; letter-spacing:.5px; }
    :host .chips { display:flex; flex-wrap:wrap; gap:4px; }
    :host .chips button { border:1px solid rgba(0,0,0,.12); background:#fff; color:#57534e;
      border-radius:6px; padding:2px 8px; font-size:11.5px; cursor:pointer; }
    :host .chips button:hover { border-color:#b01f28; color:#b01f28; }
    :host(.dark) { background:rgba(23,24,27,.97); border-color:#2c2d31; color:#d6d3d1; }
    :host(.dark) .opcard { border-bottom-color:#2c2d31; }
    :host(.dark) .opcard img, :host(.dark) .opcard .afb { background:#232326; }
    :host(.dark) .opcard a { color:#e7e5e4; }
    :host(.dark) .opcard a:hover { color:#ff6b7a; }
    :host(.dark) .chips button { background:#1c1d21; border-color:#3a3b40; color:#a8a29e; }
    :host(.dark) .chips button:hover { border-color:#ff6b7a; color:#ff6b7a; }
    @media (max-width: 1279px) { :host { display:none; } }
  `;
  const PAGE_CSS = `
    .sdg-rt-on #wp { margin-right: 216px; }
    @media (max-width: 1279px) { .sdg-rt-on #wp { margin-right: 0; } }
  `;

  function mountRail(opts) {
    const existing = document.getElementById('sdg-rail');
    if (existing) existing.remove();
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
    style.textContent = RT_CSS + (opts && opts.dark ? '' : '');
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
    if (!document.querySelector('style.sdg-rt-style')) {
      const st = document.createElement('style');
      st.className = 'sdg-rt-style';
      st.textContent = PAGE_CSS;
      (document.head || document.documentElement).appendChild(st);
    }
    return true;
  }

  window.SDGRedraw = window.SDGRedraw || {};
  window.SDGRedraw.mountRail = mountRail;
})();
