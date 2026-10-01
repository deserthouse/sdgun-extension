// v1.2.0 thread-page redraw: Shadow DOM card view over the original floors.
// Principles:
// - Zero extra requests: consumes the already-loaded DOM only.
// - Real navigation: paging / author-filter / per-floor actions navigate the
//   actual page URL (never fetch/POST on our own).
// - Fail-open: any parse error removes the overlay and reveals the original.
(function () {
  'use strict';

  // ---------- shared list styles (forumdisplay + forumlist) ----------
  const LIST_CSS = `
    :host { all: initial; font-family: system-ui, "Segoe UI", "Microsoft YaHei", sans-serif; }
    * { box-sizing: border-box; }
    .wrap { max-width: 860px; margin: 0 auto; padding: 56px 0 32px; }
    .topbar {
      position: fixed; top: 0; left: 0; right: 0; z-index: 50;
      background: rgba(250,250,250,.92); backdrop-filter: blur(10px);
      border-bottom: 1px solid rgba(0,0,0,.08); color: #1c1917;
      display: flex; align-items: center; padding: 10px 18px; font-size: 15px; font-weight: 600;
    }
    .topbar a { color: inherit; text-decoration: none; }
    .card { background:#fff; border:1px solid rgba(0,0,0,.08); border-radius:12px;
      margin: 10px 0; overflow:hidden; box-shadow: 0 1px 3px rgba(0,0,0,.04); }
    .group-title { font-weight:700; font-size:16px; color:#1c1917; margin: 16px 2px 6px; }
    .section-row { display:flex; align-items:center; gap:12px; padding: 12px 16px;
      border-bottom: 1px solid rgba(0,0,0,.06); color:#292524; text-decoration:none; }
    .section-row:last-child { border-bottom: 0; }
    .section-row:hover { background:#fafaf9; }
    .icon { width: 40px; height: 40px; border-radius: 8px; object-fit: cover; flex:none; background:#f5f5f4; }
    .s-name { display:flex; flex-direction:column; gap:2px; font-size:15px; font-weight:500; }
    .s-name .meta { color:#a8a29e; font-size:12px; font-weight:400; }
    .head { display:flex; align-items:center; gap:10px; }
    .head .title { font-size:15.5px; font-weight:600; color:#1c1917; text-decoration:none;
      flex:1; line-height:1.45; }
    .head .title:hover { color:#b01f28; }
    .meta-row { display:flex; gap:14px; align-items:center; margin-top:8px; font-size:12.5px; }
    .meta-row .author { color:#57534e; text-decoration:none; }
    .meta-row .author:hover { color:#b01f28; }
    .meta-row .meta { color:#a8a29e; }
    .meta-row .stat { margin-left:auto; color:#a8a29e; flex:none; }
    .meta-row .floor { flex:none; }
    .preview { margin-top:10px; }
    .preview img { width:100%; max-height:230px; object-fit:cover; border-radius:8px; background:#f5f5f4; }
    .preview.grid { display:grid; grid-template-columns:repeat(3, 1fr); gap:4px; }
    .preview.grid img { aspect-ratio:1/1; max-height:none; border-radius:6px; }
    .filters { display:flex; flex-wrap:wrap; gap:6px; margin: 4px 0 12px; }
    .fchip { border:1px solid rgba(0,0,0,.12); background:#fff; color:#57534e;
      border-radius:12px; padding:3px 11px; font-size:12.5px; text-decoration:none; }
    .fchip:hover { border-color:#b01f28; color:#b01f28; }
    .empty { text-align:center; padding: 28px 16px !important; }
    .empty-text { color:#78716c; font-size:14px; margin-bottom:10px; }
    .pager { display:flex; gap:8px; justify-content:center; margin:18px 0 4px; }
    .pager button { border:1px solid rgba(0,0,0,.12); background:#fff; color:#44403c;
      border-radius:8px; padding:8px 18px; font-size:14px; cursor:pointer; }
    .pager button:hover { border-color:#b01f28; color:#b01f28; }
    .pager button:disabled { opacity:.4; cursor:default; }
    .hint { text-align:center; color:#a8a29e; font-size:12px; margin-top:6px; }

    :host(.dark) .topbar { background: rgba(17,18,20,.92); border-color:#2c2d31; color:#e7e5e4; }
    :host(.dark) .card { background:#1a1b1e; border-color:#2c2d31; box-shadow:none; }
    :host(.dark) .group-title { color:#eceae8; }
    :host(.dark) .section-row { border-color:#2c2d31; color:#d6d3d1; }
    :host(.dark) .section-row:hover { background:#1e1f23; }
    :host(.dark) .icon { background:#232326; }
    :host(.dark) .s-name { color:#d6d3d1; }
    :host(.dark) .head .title { color:#e7e5e4; }
    :host(.dark) .head .title:hover { color:#ff6b7a; }
    :host(.dark) .meta-row .author { color:#a8a29e; }
    :host(.dark) .meta-row .author:hover { color:#ff6b7a; }
    :host(.dark) .meta-row .stat { color:#78716c; }
    :host(.dark) .preview img { background:#232326; }
    :host(.dark) .preview.grid img { background:#2a2b30; }
    :host(.dark) .pager button { background:#1c1d21; border-color:#3a3b40; color:#d6d3d1; }
    :host(.dark) .pager button:hover { border-color:#ff6b7a; color:#ff6b7a; }
    :host(.dark) .filters .fchip { background:#1c1d21; border-color:#3a3b40; color:#a8a29e; }
    :host(.dark) .filters .fchip:hover { border-color:#ff6b7a; color:#ff6b7a; }
    :host(.dark) .empty-text { color:#78716c; }
  `;

  function wireLightbox(shadowRoot) {
    shadowRoot.addEventListener('click', (ev) => {
      const img = ev.target.closest && ev.target.closest('img');
      if (!img || !img.src || img.classList.contains('icon')) return;
      ev.preventDefault();
      const lb = el('div', {
        style: 'position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.88);display:flex;align-items:center;justify-content:center;cursor:zoom-out',
        onclick: (e) => e.currentTarget.remove(),
      }, [el('img', { src: img.src, style: 'max-width:96vw;max-height:96vh;border-radius:4px;' })]);
      document.body.appendChild(lb);
    });
  }

  const CSS = `
    :host { all: initial; font-family: system-ui, "Segoe UI", "Microsoft YaHei", sans-serif; }
    * { box-sizing: border-box; }
    .wrap { max-width: 860px; margin: 0 auto; padding: 56px 0 32px; }
    .topbar {
      position: fixed; top: 0; left: 0; right: 0; z-index: 50;
      background: rgba(250, 250, 250, .92); backdrop-filter: blur(10px);
      border-bottom: 1px solid rgba(0,0,0,.08);
      color: #1c1917; display: flex; align-items: center; gap: 12px;
      padding: 10px 18px; font-size: 14px;
    }
    .topbar .title { font-weight: 600; flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: inherit; text-decoration: none; }
    .topbar .page { color: #78716c; font-size: 12px; flex: none; }
    .card {
      background: #fff; border: 1px solid rgba(0,0,0,.08); border-radius: 12px;
      margin: 10px 0; padding: 14px 18px;
      box-shadow: 0 1px 3px rgba(0,0,0,.04);
    }
    .card.op { border-color: rgba(47,111,63,.45); }
    .head { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
    .avatar { width: 34px; height: 34px; border-radius: 50%; object-fit: cover; background: #e7e5e4; flex: none; }
    .avatar-fallback { width: 34px; height: 34px; border-radius: 50%; background: #d6d3d1; color:#57534e;
      display:flex; align-items:center; justify-content:center; font-size:15px; font-weight:600; flex:none; }
    .author { font-weight: 600; color: #1c1917; text-decoration: none; }
    .author:hover { color: #b01f28; }
    .meta { color: #a8a29e; font-size: 12px; }
    .floor { margin-left: auto; color: #a8a29e; font-size: 12px; flex: none; }
    .body { font-size: 15px; line-height: 1.75; color: #292524; word-break: break-word; }
    .body img { max-width: 100%; height: auto; border-radius: 8px; margin: 4px 0; background:#f5f5f4; }
    .body blockquote, .body .quote {
      border-left: 3px solid #d6d3d1; background: #fafaf9; margin: 8px 0;
      padding: 8px 12px; border-radius: 0 8px 8px 0; color: #57534e; font-size: 14px;
    }
    .body a { color: #b01f28; }
    .body blockquote, .body .quote {
      max-height: 72px; overflow: hidden; cursor: pointer; position: relative;
    }
    .body blockquote.q-open, .body .quote.q-open { max-height: none; cursor: default; }
    .body blockquote:not(.q-open)::after, .body .quote:not(.q-open)::after {
      content: "…展开引用"; position: absolute; right: 8px; bottom: 4px;
      font-size: 11px; color: #b01f28;
    }
    /* 嵌套引用只在最外层显示角标 */
    .body .quote .quote::after, .body blockquote blockquote::after,
    .body .quote blockquote::after, .body blockquote .quote::after {
      display: none !important;
    }
    :host(.dark) .body blockquote:not(.q-open)::after,
    :host(.dark) .body .quote:not(.q-open)::after { color: #ff6b7a; }
    .pager {
      display: flex; gap: 8px; justify-content: center; margin: 18px 0 4px;
    }
    .pager button {
      border: 1px solid rgba(0,0,0,.12); background: #fff; color: #44403c;
      border-radius: 8px; padding: 8px 18px; font-size: 14px; cursor: pointer;
    }
    .pager button:hover { border-color: #b01f28; color: #b01f28; }
    .pager button:disabled { opacity: .4; cursor: default; }
    .hint { text-align: center; color: #a8a29e; font-size: 12px; margin-top: 6px; }
    .tools { display: flex; gap: 8px; align-items: center; margin: 4px 0 10px; }
    .tools .chip { border: 1px solid rgba(0,0,0,.12); background: #fff; color: #44403c;
      border-radius: 14px; padding: 4px 12px; font-size: 12.5px; cursor: pointer; }
    .tools .chip:hover { border-color: #b01f28; color: #b01f28; }
    .tools .chip.on { background: #b01f28; border-color: #b01f28; color: #fff; }
    .tools .jump { width: 64px; border: 1px solid rgba(0,0,0,.12); border-radius: 14px;
      padding: 4px 10px; font-size: 12.5px; background: #fff; color: #292524; }
    .head .reply { margin-left: 6px; font-size: 12px; color: #a8a29e; text-decoration: none; flex: none; }
    .head .reply:hover { color: #b01f28; }
    .card.flash { outline: 2px solid #b01f28; outline-offset: -2px; }
    :host(.dark) .tools .chip { background: #1c1d21; border-color:#3a3b40; color:#d6d3d1; }
    :host(.dark) .tools .chip:hover { border-color:#ff6b7a; color:#ff6b7a; }
    :host(.dark) .tools .chip.on { background:#b01f28; border-color:#b01f28; color:#fff; }
    :host(.dark) .tools .jump { background:#1c1d21; border-color:#3a3b40; color:#d6d3d1; }
    :host(.dark) .head .reply { color:#78716c; }
    :host(.dark) .head .reply:hover { color:#ff6b7a; }
    :host(.dark) .card.flash { outline-color: #ff6b7a; }

    /* dark */
    :host(.dark) .topbar { background: rgba(17,18,20,.92); border-color: #2c2d31; color: #e7e5e4; }
    :host(.dark) .card { background: #1a1b1e; border-color: #2c2d31; box-shadow: none; }
    :host(.dark) .card.op { border-color: #b01f28; }
    :host(.dark) .author { color: #e7e5e4; }
    :host(.dark) .author:hover { color: #ff6b7a; }
    :host(.dark) .avatar-fallback { background:#2c2d31; color:#a8a29e; }
    :host(.dark) .body { color: #d6d3d1; }
    :host(.dark) .body img { background: #232326; }
    :host(.dark) .body blockquote, :host(.dark) .body .quote { background: #232326; border-color:#3f3f46; color:#a8a29e; }
    :host(.dark) .body a { color: #ff6b7a; }
    :host(.dark) .pager button { background: #1c1d21; border-color:#3a3b40; color:#d6d3d1; }
    :host(.dark) .pager button:hover { border-color:#ff6b7a; color:#ff6b7a; }
  `;

  function el(tag, attrs, children) {
    const n = document.createElement(tag);
    if (attrs) for (const [k, v] of Object.entries(attrs)) {
      if (k === 'text') n.textContent = v;
      else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v);
    }
    (children || []).forEach((c) => n.appendChild(c));
    return n;
  }

  function parseFloors(SDG) {
    const floors = [];
    const nodes = document.querySelectorAll(SDG.viewThread.floor);
    nodes.forEach((node) => {
      const authorEl = node.querySelector(SDG.viewThread.author);
      const contentEl = node.querySelector(SDG.viewThread.content);
      if (!authorEl || !contentEl) return;
      const timeEl = node.querySelector(SDG.viewThread.date);
      const floorEl = node.querySelector(SDG.viewThread.postNumber);
      const avatarEl = node.querySelector(SDG.viewThread.authorAvatar);
      floors.push({
        author: (authorEl.textContent || '').trim(),
        authorHref: authorEl.getAttribute('href') || '#',
        time: timeEl ? (timeEl.textContent || '').replace(/\s+/g, ' ').trim() : '',
        floor: floorEl ? (floorEl.textContent || '').trim() : '',
        avatar: avatarEl ? avatarEl.getAttribute('src') : '',
        content: contentEl,
        pid: (node.id || '').replace('pid', ''),
      });
    });
    return floors;
  }

  function floorNum(f) {
    return parseInt((f.floor || '').replace('#', ''), 10) || 0;
  }

  function replyUrl(f) {
    const fid = (location.search.match(/fid=(\d+)/) || [])[1] || '';
    const tid = (location.search.match(/tid=(\d+)/) || [])[1] || '';
    return `forum.php?mod=post&action=reply&fid=${fid}&tid=${tid}&reppost=${f.pid}&extra=&mobile=2`;
  }

  function currentPage() {
    const m = location.search.match(/[?&]page=(\d+)/);
    return m ? parseInt(m[1], 10) : 1;
  }

  function navTo(params) {
    const u = new URL(location.href);
    for (const [k, v] of Object.entries(params)) {
      if (v === null) u.searchParams.delete(k);
      else u.searchParams.set(k, v);
    }
    location.href = u.toString(); // real navigation - original page handles it
  }

  function mount(SDG, opts) {
    const container = document.querySelector(SDG.viewThread.container);
    if (!container) return false;

    const floors = parseFloors(SDG);
    if (!floors.length) return false; // fail-open: nothing parsed

    // 帖子标题：优先 h2（真实标题），排除工具栏文字（.postlist_title 里混着 全部回复/只看楼主）
    const h2el = container.querySelector('h2');
    const title = h2el ? (h2el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80)
      : (document.title || '').split('-')[0].trim();

    const host = document.createElement('div');
    host.id = 'sdg-redraw-host';
    host.classList.add('sdg-host');
    const shadow = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = CSS;
    shadow.appendChild(style);
    if (opts.dark) host.classList.add('dark');

    const wrap = el('div', { class: 'wrap' });
    const page = currentPage();
    const opUid = (floors[0] && (floors[0].authorHref.match(/uid=(\d+)/) || [])[1]) || '';
    const authorFiltered = /authorid=\d+/.test(location.search);

    wrap.appendChild(el('div', { class: 'topbar' }, [
      el('a', { class: 'title', text: title, href: '#' }),
      el('span', { class: 'page', text: `第 ${page} 页` }),
    ]));

    // 工具行：只看楼主（真实导航）+ 跳楼（页内滚动或翻页导航）
    const tools = el('div', { class: 'tools' });
    if (opUid) {
      tools.appendChild(el('button', {
        class: 'chip' + (authorFiltered ? ' on' : ''),
        text: '只看楼主',
        onclick: () => navTo({ authorid: authorFiltered ? null : opUid }),
      }));
    }
    const jumpInput = el('input', { class: 'jump', placeholder: '楼层' });
    const maxFloor = Math.max(0, ...floors.map(floorNum));
    const jumpBtn = el('button', {
      class: 'chip', text: '跳楼',
      onclick: () => {
        const n = parseInt(jumpInput.value, 10);
        if (!n) return;
        const card = wrap.querySelector(`[data-floor="${n}"]`);
        if (card) {
          card.scrollIntoView({ behavior: 'smooth', block: 'start' });
          card.classList.add('flash');
          setTimeout(() => card.classList.remove('flash'), 1200);
        } else {
          const perPage = Math.max(1, page === 1 ? maxFloor : Math.round(maxFloor / page));
          navTo({ page: String(Math.max(1, Math.ceil(n / perPage))) });
        }
      },
    });
    tools.appendChild(jumpInput);
    tools.appendChild(jumpBtn);
    wrap.appendChild(tools);

    floors.forEach((f, i) => {
      const head = el('div', { class: 'head' });
      if (f.avatar) {
        head.appendChild(el('img', { class: 'avatar', src: f.avatar, alt: '' }));
      } else {
        const fb = f.author ? f.author[0].toUpperCase() : '?';
        head.appendChild(el('div', { class: 'avatar-fallback', text: fb }));
      }
      head.appendChild(el('a', { class: 'author', text: f.author || '匿名', href: f.authorHref }));
      head.appendChild(el('span', { class: 'meta', text: f.time }));
      head.appendChild(el('a', { class: 'reply', text: '回复', href: replyUrl(f) }));
      head.appendChild(el('span', { class: 'floor', text: f.floor || `${i + 1}#` }));
      const body = el('div', { class: 'body' });
      try {
        body.appendChild(f.content.cloneNode(true));
        body.querySelectorAll('img').forEach((img) => {
          img.loading = 'lazy';
          img.decoding = 'async';
        });
      } catch (e) { /* skip floor content */ }
      const card = el('div', { class: 'card' + (i === 0 ? ' op' : '') }, [head, body]);
      card.setAttribute('data-floor', String(floorNum(f) || i + 1));
      wrap.appendChild(card);
    });

    // pager: real-navigation buttons
    const tid = (location.search.match(/tid=(\d+)/) || [])[1];
    const prev = el('button', {
      text: '上一页',
      onclick: () => navTo({ page: String(page - 1) }),
    });
    const next = el('button', {
      text: '下一页',
      onclick: () => navTo({ page: String(page + 1) }),
    });
    prev.disabled = page <= 1;
    wrap.appendChild(el('div', { class: 'pager' }, [prev, next]));
    wrap.appendChild(el('div', { class: 'hint', text: 'SDGun Web Access · 重绘层（真实导航）' }));

    wrap.addEventListener('click', (ev) => {
      const q = ev.target.closest && ev.target.closest('blockquote, .quote');
      if (q) q.classList.toggle('q-open');
    });

    shadow.appendChild(wrap);

    // hide original list, keep it in DOM for fail-open restore
    container.style.display = 'none';
    const anchor0 = document.querySelector('#wp') || document.body;
    if (anchor0 !== document.body) anchor0.classList.add('sdg-host');
    anchor0.appendChild(host);
    markActive();
    hideTrailingSiblings(anchor0);

    // lightbox delegation inside shadow (reuse main-document handler semantics)
    wrap.addEventListener('click', (ev) => {
      const img = ev.target.closest && ev.target.closest('img');
      if (!img || !img.src) return;
      if (!img.closest('.body')) return; // avatar clicks pass through
      ev.preventDefault();
      const lb = el('div', {
        style: 'position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.88);display:flex;align-items:center;justify-content:center;cursor:zoom-out',
        onclick: (e) => e.currentTarget.remove(),
      }, [el('img', { src: img.src, style: 'max-width:96vw;max-height:96vh;border-radius:4px;' })]);
      document.body.appendChild(lb);
    });

    return true;
  }

  function unmount() {
    for (const id of ['sdg-redraw-host', 'sdg-redraw-list']) {
      const host = document.getElementById(id);
      if (host) host.remove();
    }
    document.documentElement.classList.remove('sdg-redraw-active');
    const c = document.querySelector('.postlist');
    if (c) c.style.display = '';
    const l = document.querySelector('ul.byg_threadlist_ul');
    if (l) l.style.display = '';
  }

  function markActive() {
    document.documentElement.classList.add('sdg-redraw-active');
  }

  function hideTrailingSiblings(host) {
    let n = host.nextElementSibling;
    while (n) {
      const next = n.nextElementSibling;
      if (n.style) n.style.display = 'none';
      n = next;
    }
  }

  // ---------- forumdisplay: thread card stream ----------
  function parseThreads(SDG) {
    const rows = document.querySelectorAll(SDG.forumDisplay.threadRow);
    const threads = [];
    rows.forEach((row) => {
      const t = row.querySelector(SDG.forumDisplay.threadTitle);
      if (!t) return;
      const authorEl = row.querySelector('.list_bottom a.z');
      const ems = row.querySelectorAll('.list_bottom em.z');
      const ys = row.querySelectorAll('.list_bottom span.y');
      const previews = [...row.querySelectorAll(SDG.forumDisplay.threadPreview)]
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
    const list = document.querySelector('ul.byg_threadlist_ul');
    if (!list) return false;
    const threads = parseThreads(SDG);
    if (!threads.length) return false;

    const hf = document.querySelector('.header_font');
    const boardName = hf ? (hf.textContent || '').trim() : '';

    // 筛选链接：从被隐藏的脚手架提取（真实导航）
    const filterLinks = [];
    document.querySelectorAll('a[href*="filter="], a[href*="orderby="]').forEach((a) => {
      const label = (a.textContent || '').trim();
      const href = a.getAttribute('href');
      if (label && label.length <= 8 && href && !filterLinks.some((f) => f.label === label)) {
        filterLinks.push({ label, href });
      }
    });

    const host = document.createElement('div');
    host.id = 'sdg-redraw-list';
    host.classList.add('sdg-host');
    const shadow = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = LIST_CSS;
    shadow.appendChild(style);
    if (opts.dark) host.classList.add('dark');

    const wrap = el('div', { class: 'wrap' });
    wrap.appendChild(el('div', { class: 'topbar' }, [
      el('a', { class: 'title', text: boardName || '版块', href: '#' }),
    ]));

    // 筛选行（真实导航 chips）
    if (filterLinks.length) {
      const row = el('div', { class: 'filters' });
      const seen = new Set();
      filterLinks.forEach(({ label, href }) => {
        if (seen.has(label)) return;
        seen.add(label);
        row.appendChild(el('a', { class: 'fchip', text: label, href }));
      });
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
      const anchor = document.querySelector('#wp') || document.body;
      if (anchor !== document.body) anchor.classList.add('sdg-host');
      anchor.appendChild(host);
      markActive();
      hideTrailingSiblings(anchor);
      return true;
    }

    const page = currentPage();
    threads.forEach((t) => {
      const head = el('div', { class: 'head' }, [
        el('a', { class: 'title', text: t.title || '(无题)', href: t.href }),
      ]);
      const meta = [];
      if (t.author) meta.push(el('a', { class: 'author', text: t.author, href: t.authorHref }));
      if (t.date) meta.push(el('span', { class: 'meta', text: t.date }));
      meta.push(el('span', { class: 'stat', text: `回复 ${t.replies || 0} · 查看 ${t.views || 0}` }));
      meta.push(el('span', { class: 'floor', text: '' }));
      head.appendChild(el('div', { class: 'meta-row' }, meta));
      const card = el('div', { class: 'card' }, [head]);
      if (t.preview && t.preview.length) {
        const pv = el('div', { class: 'preview' + (t.preview.length > 1 ? ' grid' : '') });
        t.preview.slice(0, 3).forEach((src) => {
          pv.appendChild(el('img', { src, alt: '', loading: 'lazy' }));
        });
        card.appendChild(pv);
      }
      wrap.appendChild(card);
    });

    // real-navigation pager from the template's own anchors
    const nextA = document.querySelector(SDG.forumDisplay.nextLink);
    const prevA = document.querySelector(SDG.forumDisplay.prevLink);
    const pager = el('div', { class: 'pager' });
    const prev = el('button', { text: '上一页' });
    if (prevA) prev.addEventListener('click', () => { location.href = prevA.getAttribute('href'); });
    else prev.disabled = true;
    const next = el('button', { text: '下一页' });
    if (nextA) next.addEventListener('click', () => { location.href = nextA.getAttribute('href'); });
    else next.disabled = true;
    pager.appendChild(prev); pager.appendChild(next);
    wrap.appendChild(pager);
    wrap.appendChild(el('div', { class: 'hint', text: 'SDGun Web Access · 重绘层（真实导航）' }));

    shadow.appendChild(wrap);
    list.style.display = 'none';
    const anchor = document.querySelector('#wp') || document.body;
    if (anchor !== document.body) anchor.classList.add('sdg-host');
    anchor.appendChild(host);
    markActive();
    hideTrailingSiblings(anchor);
    wireLightbox(shadow);
    return true;
  }

  // ---------- forumlist: grouped section cards ----------
  function mountForumList(SDG, opts) {
    // profile 1: bygsjw 富模板（分组容器 data-byginto）
    let data = [];
    document.querySelectorAll('div[data-byginto]').forEach((g) => {
      const name = (g.querySelector('h2 a') || {}).textContent || '';
      const secs = [];
      g.querySelectorAll('li.cl').forEach((li) => {
        const a = li.querySelector('a[href*="mod=forumdisplay"]');
        if (!a) return;
        const fid = (a.getAttribute('href').match(/fid=(\d+)/) || [])[1];
        const icon = li.querySelector('.forum_img img');
        const nm = (icon && icon.getAttribute('alt')) || (a.textContent || '').trim();
        const nums = [...li.querySelectorAll('.forum_num, .num_em, em, span')].map((n) => (n.textContent || '').replace(/\s+/g, '')).filter((s) => /[\d]/.test(s) && s.length <= 8);
        if (fid) secs.push({ fid, name: nm, icon: icon ? icon.getAttribute('src') : '', nums });
      });
      if (name || secs.length) data.push({ name: name.trim(), secs });
    });

    // profile 2: 简易模板变体（无 bygsjw 容器）——h2 为分组，forumdisplay 锚点归属其前最近的 h2
    if (!data.length) {
      const els = document.querySelectorAll('h2, a[href*="mod=forumdisplay"]');
      let cur = null;
      const simple = [];
      els.forEach((n) => {
        if (n.tagName === 'H2') {
          if (cur && cur.secs.length) simple.push(cur);
          const nm = (n.textContent || '').replace(/\s+/g, ' ').trim();
          cur = nm ? { name: nm, secs: [] } : null;
          return;
        }
        if (!cur) return;
        const href = n.getAttribute('href') || '';
        const fid = (href.match(/fid=(\d+)/) || [])[1];
        if (!fid) return;
        const name = (n.textContent || '').replace(/\s+/g, ' ').trim();
        if (!name) return;
        const parentTxt = (n.parentElement ? n.parentElement.textContent : '') || '';
        const cnt = (parentTxt.match(/\((\d+)\)/) || [])[1];
        const icon = n.querySelector ? n.querySelector('img') : null;
        cur.secs.push({ fid, name, icon: icon ? icon.getAttribute('src') : '', nums: cnt ? [cnt] : [] });
      });
      if (cur && cur.secs.length) simple.push(cur);
      data = simple;
    }
    if (!data.length) return false;
    // 简易变体的原列表容器（如 #forumlist）在渲染后隐藏
    const legacyList = document.getElementById('forumlist');
    if (legacyList) legacyList.style.display = 'none';

    const host = document.createElement('div');
    host.id = 'sdg-redraw-list';
    host.classList.add('sdg-host');
    const shadow = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = LIST_CSS;
    shadow.appendChild(style);
    if (opts.dark) host.classList.add('dark');

    const wrap = el('div', { class: 'wrap' });
    wrap.appendChild(el('div', { class: 'topbar' }, [el('a', { class: 'title', text: '板块', href: '#' })]));

    data.forEach((grp) => {
      if (!grp.secs.length) return;
      wrap.appendChild(el('div', { class: 'group-title', text: grp.name }));
      const card = el('div', { class: 'card' });
      grp.secs.forEach((s) => {
        const row = el('a', { class: 'section-row', href: `forum.php?mod=forumdisplay&fid=${s.fid}&mobile=2` });
        if (s.icon) row.appendChild(el('img', { class: 'icon', src: s.icon, alt: '' }));
        const mid = el('div', { class: 's-name' }, [el('span', { text: s.name })]);
        const uniq = [...new Set(s.nums)];
        if (uniq.length) mid.appendChild(el('span', { class: 'meta', text: uniq.slice(0, 2).join(' / ') }));
        row.appendChild(mid);
        card.appendChild(row);
      });
      wrap.appendChild(card);
    });
    wrap.appendChild(el('div', { class: 'hint', text: 'SDGun Web Access · 重绘层' }));

    shadow.appendChild(wrap);
    // 隐藏原列表但保留结构
    document.querySelectorAll('ul.byg_threadlist_ul, .sub_forum').forEach((n) => { n.style.display = 'none'; });
    const anchor = document.querySelector('#wp') || document.body;
    if (anchor !== document.body) anchor.classList.add('sdg-host');
    anchor.appendChild(host);
    markActive();
    hideTrailingSiblings(anchor);
    return true;
  }

  window.SDGRedraw = { mount, mountForumDisplay, mountForumList, unmount };
})();
