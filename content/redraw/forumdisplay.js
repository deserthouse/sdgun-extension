// redraw/forumdisplay.js — 帖子列表页重绘（parseThreads + mountForumDisplay）。
// 依赖：redraw/base.js（先加载）。挂载入口挂到 window.SDGRedraw.mountForumDisplay。
// 双 profile：bygsjw 富模板（ul.byg_threadlist_ul）→ 简易模板变体（锚点防御式解析）。
// 渲染：v1.8 起行式列表（PC 密度，layout_blueprint L1）——缩略图+标题+作者时间+右对齐统计，
// 悬停标题浮出预览图；字段缺失逐项降级（服务器多形态，解析产出为准）。
(function () {
  'use strict';
  const B = window.SDGRedrawBase;

  // 行式列表样式（追加在共享 LIST_CSS 之后；暗色跟 :host(.dark) 约定）
  const ROW_CSS = `
    .rows { margin-top: 4px; }
    .crumb-home { color: #78716c; text-decoration: none; font-weight: 500; }
    .crumb-home:hover { color: #b01f28; }
    .crumb-sep { color: #a8a29e; font-weight: 400; }
    .fchip.srch { margin-left: auto; border-style: dashed; }
    .trow.bare { padding: 4px 14px; margin: 3px 0; }
    :host(.dark) .crumb-home { color: #a8a29e; }
    :host(.dark) .crumb-home:hover { color: #ff6b7a; }
    :host(.dark) .crumb-sep { color: #78716c; }
    .trow { position:relative; display:flex; align-items:center; gap:12px;
      background:#fff; border:1px solid rgba(0,0,0,.08); border-radius:10px;
      padding:9px 14px; margin:7px 0; }
    .trow .thumb { width:52px; height:52px; border-radius:8px; object-fit:cover;
      flex:none; background:#f5f5f4; }
    .trow .main { flex:1; min-width:0; display:flex; flex-direction:column; gap:3px; }
    .trow .t { font-size:14.5px; font-weight:600; color:#1c1917; text-decoration:none;
      line-height:1.4; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .trow .t:hover { color:#b01f28; }
    .trow .sub { font-size:12px; color:#a8a29e; display:flex; gap:10px; min-width:0; }
    .trow .sub a { color:#78716c; text-decoration:none; }
    .trow .sub a:hover { color:#b01f28; }
    .trow .sub .d { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .trow .stats { flex:none; text-align:right; font-size:12px; color:#a8a29e; line-height:1.5; }
    .trow .stats b { display:block; font-size:14px; color:#57534e; font-weight:600; }
    .trow .hoverp { display:none; position:absolute; right:8px; top:calc(100% + 4px); z-index:60;
      background:#fff; border:1px solid rgba(0,0,0,.12); border-radius:10px; padding:6px;
      box-shadow:0 8px 24px rgba(0,0,0,.14); gap:4px; }
    .trow .hoverp img { width:150px; height:100px; object-fit:cover; border-radius:6px; background:#f5f5f4; }
    .trow:hover .hoverp { display:flex; }
    :host(.dark) .trow { background:#1a1b1e; border-color:#2c2d31; }
    :host(.dark) .trow .t { color:#e7e5e4; }
    :host(.dark) .trow .t:hover { color:#ff6b7a; }
    :host(.dark) .trow .thumb, :host(.dark) .trow .hoverp img { background:#232326; }
    :host(.dark) .trow .sub, :host(.dark) .trow .stats { color:#78716c; }
    :host(.dark) .trow .sub a { color:#a8a29e; }
    :host(.dark) .trow .sub a:hover { color:#ff6b7a; }
    :host(.dark) .trow .stats b { color:#d6d3d1; }
    :host(.dark) .trow .hoverp { background:#1c1d21; border-color:#3a3b40; }
  `;

  function parseThreads(SDG) {
    const F = SDG.forumDisplay;
    const rows = document.querySelectorAll(F.threadRow);
    const threads = [];
    rows.forEach((row) => {
      const t = row.querySelector(F.threadTitle);
      if (!t) return;
      const authorEl = row.querySelector(F.rowAuthor);
      const ems = row.querySelectorAll(F.rowDate);
      const ys = row.querySelectorAll(F.rowStats);
      const previews = [...row.querySelectorAll(F.threadPreview)]
        .map((a) => (a.style && a.style.backgroundImage || '').match(/url\("?([^")]+)"?\)/))
        .filter(Boolean).map((m) => m[1]);
      threads.push({
        title: (t.textContent || '').trim(),
        href: t.getAttribute('href') || '#',
        author: authorEl ? (authorEl.textContent || '').trim() : '',
        authorHref: authorEl ? authorEl.getAttribute('href') : '#',
        date: ems.length ? (ems[0].textContent || '').replace(/\s+/g, ' ').trim() : '',
        replies: ys.length ? (ys[0].textContent || '').replace(/\D/g, '') : '',
        views: ys.length > 1 ? (ys[1].textContent || '').replace(/\D/g, '') : '',
        preview: previews,
      });
    });
    return threads;
  }

  function mountForumDisplay(SDG, opts) {
    const B = window.SDGRedrawBase;
    const F = SDG.forumDisplay;
    const list = document.querySelector('ul.byg_threadlist_ul');
    let simpleMode = false;
    let threads = [];
    if (list) {
      threads = parseThreads(SDG);
      if (!threads.length) {
        // P1-2：真骨架（无任何帖子锚点）交给 boot 重试；版块空/结构变体则渲染空态
        if (!document.querySelector('a[href*="mod=viewthread"]')) return false;
      }
    } else {
      // 简易模板变体：无 bygsjw 列表容器，锚点防御式解析
      simpleMode = true;
      const seen = new Set();
      [...document.querySelectorAll('a[href*="mod=viewthread"]')].forEach((a) => {
        const tid = (a.getAttribute('href').match(/tid=(\d+)/) || [])[1];
        if (!tid || seen.has(tid)) return;
        const t = (a.textContent || '').replace(/\s+/g, ' ').trim();
        if (t.length < 6 || /^(上一页|下一页|\d+)$/.test(t)) return;
        seen.add(tid);
        const rowText = ((a.closest('li') || a.closest('div') || a.parentElement).textContent || '')
          .replace(/\s+/g, ' ').trim();
        const rm = rowText.match(/回复\s*(\d+)/);
        const href0 = (a.getAttribute('href') || '').replace(/mobile=\d+/, 'mobile=2');
        threads.push({
          title: t, href: href0, author: '', date: '',
          replies: rm ? rm[1] : '', views: '', preview: [],
          metaRaw: rowText.slice(t.length).trim(),
        });
      });
      if (!threads.length) return false;
    }

    const boardName = B.util.boardName();

    // 筛选链接：从被隐藏的脚手架提取（真实导航）
    const filterLinks = B.util.collectFilters();

    const el = B.el;
    const host = document.createElement('div');
    host.id = 'sdg-redraw-list';
    host.classList.add('sdg-host');
    const shadow = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = B.LIST_CSS + ROW_CSS;
    shadow.appendChild(style);
    if (opts.dark) host.classList.add('dark');

    const wrap = el('div', { class: 'wrap' });
    // 面包屑：论坛 › 板块名（首页可点回列表）
    wrap.appendChild(el('div', { class: 'topbar' }, [
      el('a', { class: 'crumb-home', text: '论坛', href: 'forum.php?forumlist=1&mobile=2' }),
      el('span', { class: 'crumb-sep', text: '›' }),
      el('span', { class: 'title', text: boardName || '版块' }),
    ]));

    // 筛选行（真实导航 chips）+ 搜索本板块入口（蓝图残余：跳真实 search.php）
    if (filterLinks.length) {
      const row = el('div', { class: 'filters' });
      const seen = new Set();
      filterLinks.forEach(({ label, href }) => {
        if (seen.has(label)) return;
        seen.add(label);
        row.appendChild(el('a', { class: 'fchip', text: label, href }));
      });
      const fid = (location.search.match(/fid=(\d+)/) || [])[1];
      if (fid) {
        row.appendChild(el('a', { class: 'fchip srch', text: '🔍 搜索本板块',
          href: `search.php?mod=forum&srchfid=${fid}&mobile=2` }));
      }
      wrap.appendChild(row);
    }

    // 空态
    if (!threads.length) {
      wrap.appendChild(el('div', { class: 'card empty' }, [
        el('div', { class: 'empty-text', text: '列表为空，或加载未完成（服务器不稳定时常见）' }),
      ]));
      const retry = el('div', { class: 'pager' }, [
        el('button', { text: '重试', onclick: () => location.reload() }),
      ]);
      wrap.appendChild(retry);
      shadow.appendChild(wrap);
      const anchor = B.util.contentAnchor();
      if (anchor !== document.body) anchor.classList.add('sdg-host');
      anchor.appendChild(host);
      B.markActive();
      B.util.hideScaffold('bygsjw');
      B.hideTrailingSiblings(anchor);
      return true;
    }

    const nextA = B.util.pagerAnchor('next');
    const prevA = B.util.pagerAnchor('prev');
    // 工厂：cloneNode 不复制监听器，顶/底两份分页各自新建
    const makePager = () => {
      const box = el('div', { class: 'pager' });
      const pv = el('button', { text: '上一页' });
      if (prevA) pv.addEventListener('click', () => { location.href = prevA.getAttribute('href'); });
      else pv.disabled = true;
      const nx = el('button', { text: '下一页' });
      if (nextA) nx.addEventListener('click', () => { location.href = nextA.getAttribute('href'); });
      else nx.disabled = true;
      box.appendChild(pv); box.appendChild(nx);
      return box;
    };

    // 行式列表（蓝图 L1：PC 密度；底部分页常驻，顶部仅近满页时显示）
    if (threads.length >= 8) wrap.appendChild(makePager());
    const rowsBox = el('div', { class: 'rows' });
    threads.forEach((t) => {
      const bare = !t.author && !t.date && !t.replies && !t.views;
      const row = el('div', { class: 'trow' + (bare ? ' bare' : '') });
      if (t.preview && t.preview.length) {
        row.appendChild(el('img', { class: 'thumb', src: t.preview[0], alt: '', loading: 'lazy' }));
      }
      const main = el('div', { class: 'main' });
      main.appendChild(el('a', { class: 't', text: t.title || '(无题)', href: t.href }));
      const subItems = [];
      if (t.author) subItems.push(el('a', { text: t.author, href: t.authorHref || '#' }));
      if (t.date) subItems.push(el('span', { class: 'd', text: t.date }));
      if (subItems.length) main.appendChild(el('div', { class: 'sub' }, subItems));
      row.appendChild(main);
      if (t.replies || t.views) {
        const st = el('div', { class: 'stats' });
        st.appendChild(el('b', { text: t.replies || '0' }));
        st.appendChild(el('span', { text: `回复 / 查看 ${t.views || 0}` }));
        row.appendChild(st);
      }
      if (t.preview && t.preview.length > 1) {
        const hp = el('div', { class: 'hoverp' });
        t.preview.slice(0, 3).forEach((src) => {
          hp.appendChild(el('img', { src, alt: '', loading: 'lazy' }));
        });
        row.appendChild(hp);
      }
      rowsBox.appendChild(row);
    });
    wrap.appendChild(rowsBox);
    wrap.appendChild(makePager());
    wrap.appendChild(el('div', { class: 'hint', text: 'SDGun Web Access · 重绘层（真实导航）' }));

    shadow.appendChild(wrap);
    if (list) B.hideEl(list);
    else if (simpleMode) {
      const container = B.util.threadContainer();
      if (container && container !== document.body) B.hideEl(container);
    }
    const anchor = B.util.contentAnchor();
    if (anchor !== document.body) anchor.classList.add('sdg-host');
    anchor.appendChild(host);
    B.markActive();
    B.util.hideScaffold('bygsjw');
    B.hideTrailingSiblings(anchor);
    B.wireLightbox(shadow);
    return true;
  }

  window.SDGRedraw = window.SDGRedraw || {};
  window.SDGRedraw.mountForumDisplay = mountForumDisplay;
})();
