// redraw/viewthread.js — 帖子详情页重绘（parseFloors + mount）。
// 依赖：redraw/base.js（先加载）。挂载入口挂到 window.SDGRedraw.mount。
// 渲染：v1.8 楼层双列（蓝图 L2）——左头像列 72px + 右内容列；楼主楼层徽标+左边条（全部 OP 楼，
// 非仅首楼）；回复钮沉底右对齐。
(function () {
  'use strict';
  const B = window.SDGRedrawBase;

  // 楼层双列样式（追加在共享 CSS 之后；.body 等内容样式复用 base 层）
  const FLOOR_CSS = `
    .fcard { display:flex; gap:14px; background:#fff; border:1px solid rgba(0,0,0,.08);
      border-radius:12px; padding:14px 16px; margin:10px 0; }
    .fcard.opf { border-left:3px solid #b01f28; }
    .fcard.flash { outline: 2px solid #b01f28; outline-offset: -2px; }
    .fava { flex:none; width:72px; display:flex; flex-direction:column; align-items:center; gap:6px; }
    .fava img { width:64px; height:64px; border-radius:12px; object-fit:cover; background:#e7e5e4; }
    .fava .afb { width:64px; height:64px; border-radius:12px; background:#d6d3d1; color:#57534e;
      display:flex; align-items:center; justify-content:center; font-size:26px; font-weight:700; }
    .fmain { flex:1; min-width:0; display:flex; flex-direction:column; }
    .fhead { display:flex; align-items:center; gap:10px; margin-bottom:8px; flex-wrap:wrap; }
    .fhead .author { font-weight:600; color:#1c1917; text-decoration:none; font-size:14.5px; }
    .fhead .author:hover { color:#b01f28; }
    .badge-op { font-size:11px; font-weight:700; color:#fff; background:#b01f28;
      border-radius:4px; padding:1px 7px; letter-spacing:.5px; flex:none; }
    .fhead .meta { color:#a8a29e; font-size:12px; }
    .fhead .floor { margin-left:auto; color:#a8a29e; font-size:12.5px; flex:none; }
    .ffoot { display:flex; justify-content:flex-end; margin-top:10px; }
    .ffoot .reply { font-size:12px; color:#a8a29e; text-decoration:none;
      border:1px solid rgba(0,0,0,.12); border-radius:6px; padding:3px 12px; }
    .ffoot .reply:hover { color:#b01f28; border-color:#b01f28; }
    :host(.dark) .fcard { background:#1a1b1e; border-color:#2c2d31; }
    :host(.dark) .fcard.opf { border-left-color:#ff6b7a; }
    :host(.dark) .fava img, :host(.dark) .fava .afb { background:#232326; }
    :host(.dark) .fhead .author { color:#e7e5e4; }
    :host(.dark) .fhead .author:hover { color:#ff6b7a; }
    :host(.dark) .badge-op { background:#ff6b7a; color:#1a1b1e; }
    :host(.dark) .ffoot .reply { color:#78716c; border-color:#3a3b40; }
    :host(.dark) .ffoot .reply:hover { color:#ff6b7a; border-color:#ff6b7a; }
  `;

  function parseFloors(SDG) {
    const V = SDG.viewThread;
    const floors = [];
    const nodes = document.querySelectorAll(V.floor);

    // fid 兜底来源：viewthread URL 通常无 fid——从页面链接（发帖/回帖）提取
    let pageFid = (location.search.match(/fid=(\d+)/) || [])[1] || '';
    if (!pageFid) {
      const fidA = document.querySelector('a[href*="mod=post"]');
      if (fidA) pageFid = (fidA.getAttribute('href').match(/fid=(\d+)/) || [])[1] || '';
    }

    nodes.forEach((node) => {
      let authorEl = node.querySelector(V.author);
      let contentEl = node.querySelector(V.content);
      let timeEl = node.querySelector(V.date);
      let floorEl = node.querySelector(V.postNumber);
      const avatarEl = node.querySelector(V.authorAvatar);
      let replyA = node.querySelector(V.replyAnchor);

      // mobile=1 标准移动模板：内容在楼层头的兄弟节点（#postmessage_{pid}），头部元素形态不同
      const pid = (node.id || '').replace('pid', '');
      if (!authorEl || !contentEl) {
        authorEl = node.querySelector('a[href*="mod=space"]');
        contentEl = pid ? document.getElementById('postmessage_' + pid) : null;
        timeEl = node.querySelector('em[id^="authorposton"] font, em[id^="authorposton"]');
        floorEl = node.querySelector('em');
        if (contentEl && pid && pageFid) {
          replyA = null; // 无每楼回复链接，构造兜底（replyUrl 用 pageFid）
        }
      }
      if (!authorEl || !contentEl) return;
      floors.push({
        replyHref: replyA ? replyA.getAttribute('href') : '',
        author: (authorEl.textContent || '').trim(),
        authorHref: authorEl.getAttribute('href') || '#',
        time: timeEl ? (timeEl.textContent || '').replace(/\s+/g, ' ').trim() : '',
        floor: floorEl ? (floorEl.textContent || '').trim() : '',
        avatar: avatarEl ? avatarEl.getAttribute('src') : '',
        content: contentEl,
        pid,
        fid: pageFid,
      });
    });
    return floors;
  }

  function floorNum(f) {
    return parseInt((f.floor || '').replace('#', ''), 10) || 0;
  }

  function replyUrl(f) {
    const fid = f.fid || (location.search.match(/fid=(\d+)/) || [])[1] || '';
    const tid = (location.search.match(/tid=(\d+)/) || [])[1] || '';
    return `forum.php?mod=post&action=reply&fid=${fid}&tid=${tid}&reppost=${f.pid}&extra=&mobile=1`;
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
    const B = window.SDGRedrawBase;
    let container = document.querySelector(SDG.viewThread.container);
    // mobile=1 标准移动模板：无 .postlist 容器——楼层头 div[id^=pid] 的共同父级即容器
    if (!container) {
      const first = document.querySelector(SDG.viewThread.floor);
      container = first ? first.parentElement : null;
    }
    if (!container) return false;

    const floors = parseFloors(SDG);
    if (!floors.length) return false; // fail-open: nothing parsed

    // 帖子标题：优先 h2（真实标题），排除工具栏文字（.postlist_title 里混着 全部回复/只看楼主）
    // mobile=1 无 h2：title 形如 "板名+帖子标题SDGUN,..."——去板名取后半（用第一个楼层正文前缀比对不可靠，直接截断站名后缀）
    const h2el = container.querySelector('h2');
    let title;
    if (h2el) {
      title = (h2el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80);
    } else {
      const raw = (document.title || '').split('-')[0].trim();
      const cut = raw.indexOf('SDGUN,');
      title = (cut > 0 ? raw.slice(0, cut) : raw).trim().slice(0, 80);
    }

    const host = document.createElement('div');
    host.id = 'sdg-redraw-host';
    host.classList.add('sdg-host');
    const shadow = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = B.CSS + FLOOR_CSS;
    shadow.appendChild(style);
    if (opts.dark) host.classList.add('dark');

    const el = B.el;
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
      const isOp = opUid && (f.authorHref.match(/uid=(\d+)/) || [])[1] === opUid;
      const card = el('div', { class: 'fcard' + (isOp ? ' opf' : '') });
      card.setAttribute('data-floor', String(floorNum(f) || i + 1));

      // 左：头像列（72px）
      const ava = el('div', { class: 'fava' });
      if (f.avatar) ava.appendChild(el('img', { src: f.avatar, alt: '', loading: 'lazy' }));
      else ava.appendChild(el('div', { class: 'afb', text: f.author ? f.author[0].toUpperCase() : '?' }));
      card.appendChild(ava);

      // 右：内容列（头行 → 正文 → 底行）
      const main = el('div', { class: 'fmain' });
      const head = el('div', { class: 'fhead' });
      head.appendChild(el('a', { class: 'author', text: f.author || '匿名', href: f.authorHref }));
      if (isOp) head.appendChild(el('span', { class: 'badge-op', text: '楼主' }));
      head.appendChild(el('span', { class: 'meta', text: f.time }));
      head.appendChild(el('span', { class: 'floor', text: f.floor || `${i + 1}#` }));
      main.appendChild(head);

      const body = el('div', { class: 'body' });
      try {
        body.appendChild(f.content.cloneNode(true));
        body.querySelectorAll('img').forEach((img) => {
          img.loading = 'lazy';
          img.decoding = 'async';
        });
      } catch (e) { /* skip floor content */ }
      main.appendChild(body);

      const foot = el('div', { class: 'ffoot' });
      foot.appendChild(el('a', { class: 'reply', text: '回复', href: f.replyHref || replyUrl(f) }));
      main.appendChild(foot);

      card.appendChild(main);
      wrap.appendChild(card);
    });

    // pager: real-navigation buttons
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

    B.hideEl(container);
    const anchor0 = B.util.contentAnchor();
    if (anchor0 !== document.body) anchor0.classList.add('sdg-host');
    anchor0.appendChild(host);
    B.markActive();
    B.util.hideScaffold('viewthread');
    B.hideTrailingSiblings(anchor0);

    B.wireLightbox(shadow);

    return true;
  }

  window.SDGRedraw = window.SDGRedraw || {};
  window.SDGRedraw.mount = mount;
})();
