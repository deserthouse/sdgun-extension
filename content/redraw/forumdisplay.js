// redraw/forumdisplay.js — 帖子列表页重绘（parseThreads + mountForumDisplay）。
// 依赖：redraw/base.js（先加载）。挂载入口挂到 window.SDGRedraw.mountForumDisplay。
// 双 profile：bygsjw 富模板（ul.byg_threadlist_ul）→ 简易模板变体（锚点防御式解析）。
// 渲染：v1.8 起行式列表（PC 密度，layout_blueprint L1）——缩略图+标题+作者时间+右对齐统计，
// 悬停标题浮出预览图；字段缺失逐项降级（服务器多形态，解析产出为准）。
(function () {
  'use strict';
  const B = window.SDGRedrawBase;

  // B 式行卡样式（v1.15 设计系统；令牌继承 base LIST_CSS）
  const ROW_CSS = `
    .rows { margin-top: 4px; }
    /* v1.16.2 密度再收一档（截图评审：无缩略图行中段偏空）——竖距 12→10、行距 8→7；
       裸行维持 v1.13 调定值不动（行距断言针对裸行） */
    .trow { position: relative; display: flex; align-items: center; gap: 14px;
      background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);
      padding: 10px 16px; margin: 7px 0; text-decoration: none;
      transition: background .12s, border-color .12s; }
    .trow:hover { background: var(--surface2); border-color: var(--border2); }
    .trow .thumb { width: 88px; height: 60px; border-radius: 10px; object-fit: cover;
      flex: none; background: var(--surface2); }
    .trow .main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
    .trow .t { font-size: 16px; font-weight: 600; color: var(--text); text-decoration: none;
      line-height: 1.4; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .trow:hover .t { color: var(--accent); }
    .trow .sub { font-size: 13px; color: var(--text3); display: flex; gap: 12px; min-width: 0; }
    .trow .sub a { color: var(--text2); text-decoration: none; }
    .trow .sub a:hover { color: var(--accent); }
    .trow .sub .d { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    /* v1.17.0 F-1：图文增强的摘要行（enrich.js 后台拉取首楼文字，灰字单行省略） */
    .trow .ex { font-size: 12.5px; color: var(--text3); line-height: 1.45;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    /* v1.17.1 骨架占位（入队即占位，数据原地填充） */
    .sdg-skel { background: var(--surface2); animation: sdg-pulse 1.6s ease-in-out infinite; }
    .sdg-skel-thumb { width: 88px; height: 60px; border-radius: 10px; flex: none; }
    .sdg-skel-ex { height: 13px; width: 62%; margin-top: 3px; border-radius: 5px; }
    @keyframes sdg-pulse { 0%, 100% { opacity: .5; } 50% { opacity: .95; } }
    .trow .stats { flex: none; text-align: right; font-size: 12.5px; color: var(--text3); line-height: 1.5; }
    .trow .stats b { display: block; font-size: 15px; color: var(--text2); font-weight: 600; }
    .trow .hoverp { display: none; position: absolute; right: 8px; top: calc(100% + 4px); z-index: 60;
      background: var(--surface); border: 1px solid var(--border2); border-radius: 12px; padding: 6px;
      box-shadow: 0 8px 24px rgba(0,0,0,.14); gap: 4px; }
    .trow .hoverp img { width: 150px; height: 100px; object-fit: cover; border-radius: 8px; background: var(--surface2); }
    .trow:hover .hoverp { display: flex; }
    .trow.bare { padding: 9px 18px; margin: 6px 0; }
    .trow.pinned { background: color-mix(in srgb, var(--accent) 5%, var(--surface)); }
    .tline { display: flex; align-items: center; gap: 8px; min-width: 0; }
    .type-badge { flex: none; font-size: 11px; font-weight: 600; color: var(--accent);
      border: 1px solid color-mix(in srgb, var(--accent) 40%, transparent);
      background: color-mix(in srgb, var(--accent) 8%, transparent);
      border-radius: 5px; padding: 1px 7px; letter-spacing: .5px; }
    .pin-badge { flex: none; font-size: 11px; font-weight: 600; color: var(--text3);
      border: 1px solid var(--border2); border-radius: 5px; padding: 1px 7px; }
    .tline .t { flex: 1; min-width: 0; }
    .fchip.srch { margin-left: auto; border-style: dashed; }
    /* 板块头卡 + 子版块卡 */
    .boardhead { display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
      background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);
      padding: 12px 18px; margin: 4px 0 10px; }
    .boardhead .bh-name { font-size: 16px; font-weight: 700; color: var(--text); }
    .boardhead .bh-stat { font-size: 13px; color: var(--text3); }
    .boardhead .bh-stat b { color: var(--text2); font-weight: 600; }
    .boardhead a.bh-fav { margin-left: auto; font-size: 12.5px; font-weight: 600; color: var(--accent);
      text-decoration: none; border: 1px solid color-mix(in srgb, var(--accent) 40%, transparent);
      border-radius: 999px; padding: 4px 14px; }
    .boardhead a.bh-fav:hover { background: var(--accent); color: #fff; }
    .subforums { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);
      padding: 6px 0; margin: 0 0 10px; }
    .subforums .sf-title { font-size: 11.5px; font-weight: 700; color: var(--text3);
      padding: 6px 18px 2px; letter-spacing: .8px; }
    .subforums a.sf-row { display: flex; align-items: center; gap: 10px; padding: 7px 18px;
      color: var(--text2); text-decoration: none; font-size: 14px; }
    .subforums a.sf-row:hover { background: var(--surface2); color: var(--accent); }
    .subforums a.sf-row .sf-name { font-weight: 500; color: var(--text); }
    .subforums a.sf-row .sf-meta { margin-left: auto; font-size: 12.5px; color: var(--text3); }
  `;

  function parseThreads(SDG, root) {
    const F = SDG.forumDisplay;
    const rows = (root || document).querySelectorAll(F.threadRow);
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
      // 类型徽标与标题清洗：list_typename 是独立子元素（不剥离会把"讨论"粘连进标题）
      const typeEl = row.querySelector(F.rowType);
      const type = typeEl ? (typeEl.textContent || '').trim() : '';
      const pin = !!row.querySelector(F.rowPin);
      let title = t.textContent || '';
      if (type) title = title.replace(type, '');
      title = title.replace(/^(置顶|本版置顶|精华)\s*/, '').trim();
      // 日期取 em.z 中匹配日期模式者（首 em 可能是红色"置顶"标签）
      let date = '';
      ems.forEach((e) => {
        const txt = (e.textContent || '').replace(/\s+/g, ' ').trim();
        if (!date && /\d{4}-\d{1,2}-\d{1,2}/.test(txt)) date = txt;
      });
      threads.push({
        title,
        href: t.getAttribute('href') || '#',
        type,
        pin,
        author: authorEl ? (authorEl.textContent || '').trim() : '',
        authorHref: authorEl ? authorEl.getAttribute('href') : '#',
        date,
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
      el('div', { class: 'tb-in' }, [
        el('a', { class: 'crumb-home', text: '论坛', href: 'forum.php?forumlist=1&mobile=2' }),
        el('span', { class: 'crumb-sep', text: '›' }),
        el('span', { class: 'title', text: boardName || '版块' }),
      ]),
    ]));

    // ---- 板块头卡：今日/主题统计 + 收藏本版（真实链接，页内 DOM 稳定在场） ----
    (function boardHead() {
      const txt = (document.body.textContent || '');
      const today = (txt.match(/今日[^0-9]{0,12}(\d{1,7})/) || [])[1];
      const total = (txt.match(/主题[^0-9]{0,12}(\d{1,9})/) || [])[1]
        || (txt.match(/主题:\s*(\d{1,9})/) || [])[1];
      const favA = [...document.querySelectorAll('a')]
        .find((a) => /收藏本版|收藏/.test(a.textContent || '') && /action=fav|favthread|mod=fav/.test(a.getAttribute('href') || ''))
        || [...document.querySelectorAll('a')].find((a) => (a.textContent || '').trim() === '收藏本版');
      if (!today && !total && !favA) return;
      const bh = el('div', { class: 'boardhead' },
        [el('span', { class: 'bh-name', text: boardName || '版块' })]);
      if (today) {
        bh.appendChild(el('span', { class: 'bh-stat', text: '今日 ' + today + ' ' }));
      }
      if (total) {
        bh.appendChild(el('span', { class: 'bh-stat', text: ' · 主题 ' + total }));
      }
      if (favA) {
        const fav = el('a', { class: 'bh-fav', text: '★ 收藏本版',
          href: favA.getAttribute('href') });
        bh.appendChild(fav);
      }
      wrap.appendChild(bh);
    })();

    // ---- 子版块卡（同一 li.cl 容器内的 forum_img 行：名称+帖子/评论双计数） ----
    (function subforums() {
      const F2 = SDG.forumDisplay;
      const rows = document.querySelectorAll(F2.subforumRow);
      if (!rows.length) return;
      const seen = new Set();
      const box = el('div', { class: 'subforums' });
      box.appendChild(el('div', { class: 'sf-title', text: '子版块' }));
      let any = false;
      rows.forEach((a) => {
        const href = a.getAttribute('href') || '';
        const fid = (href.match(/fid=(\d+)/) || [])[1];
        if (!fid || seen.has(fid)) return;
        seen.add(fid);
        const li = a.closest('li') || a.parentElement;
        const nameEl = li.querySelector(F2.subforumName);
        const name = nameEl ? (nameEl.textContent || '').trim() : ((a.querySelector('img') || {}).alt || '');
        if (!name) return;
        const th = ((li.querySelector(F2.subforumThreads) || {}).textContent || '').replace(/\D/g, '');
        const ps = ((li.querySelector(F2.subforumPosts) || {}).textContent || '').replace(/\D/g, '');
        const rowEl = el('a', { class: 'sf-row',
          href: 'forum.php?mod=forumdisplay&fid=' + fid + '&mobile=2' });
        rowEl.appendChild(el('span', { class: 'sf-name', text: name }));
        // 标签对齐站方语义：forum_threads=主题数、forum_posts=帖子数（此前误标"帖子/评论"）
        if (th || ps) rowEl.appendChild(el('span', { class: 'sf-meta',
          text: `主题 ${th || '-'} · 帖子 ${ps || '-'}` }));
        box.appendChild(rowEl);
        any = true;
      });
      if (any) wrap.appendChild(box);
    })();

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

    // 行式列表（蓝图 L1：PC 密度；底部分页常驻，顶部分页仅在真有上一页时显示——
    // 首页（无 prev）顶部只会有个失效的"上一页"，纯噪音，用户截图实证）
    if (threads.length >= 8 && prevA) wrap.appendChild(makePager());
    const rowsBox = el('div', { class: 'rows' });
    threads.forEach((t) => {
      const bare = !t.author && !t.date && !t.replies && !t.views;
      const row = el('div', { class: 'trow' + (bare ? ' bare' : '') + (t.pin ? ' pinned' : '') });
      if (t.preview && t.preview.length) {
        row.appendChild(el('img', { class: 'thumb', src: t.preview[0], alt: '', loading: 'lazy',
          onerror: function () { this.style.display = 'none'; } }));
      }
      const main = el('div', { class: 'main' });
      const tline = el('div', { class: 'tline' });
      if (t.pin) tline.appendChild(el('span', { class: 'pin-badge', text: '置顶' }));
      if (t.type) tline.appendChild(el('span', { class: 'type-badge', text: t.type }));
      tline.appendChild(el('a', { class: 't', text: t.title || '(无题)', href: t.href }));
      main.appendChild(tline);
      const subItems = [];
      if (t.author) subItems.push(el('a', { text: t.author, href: t.authorHref || '#' }));
      if (t.date) subItems.push(el('span', { class: 'd', text: B.util.toRelative(t.date) }));
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
    // v1.17.0 F-1：图文增强（无站方缩略图的行后台补图+摘要；预算/缓存见 enrich.js）
    if (opts.enrich !== false && window.SDGRedraw.enrichRows) {
      try { window.SDGRedraw.enrichRows(shadow); } catch (e) { /* 增强失败不影响列表 */ }
    }
    return true;
  }

  window.SDGRedraw = window.SDGRedraw || {};
  window.SDGRedraw.mountForumDisplay = mountForumDisplay;
  window.SDGRedraw.parseThreads = parseThreads; // 单测导出
})();
