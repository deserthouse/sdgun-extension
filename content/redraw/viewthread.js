// redraw/viewthread.js — 帖子详情页卡片重绘（parseFloors + mount）。
// 依赖：redraw/base.js（先加载）。挂载入口挂到 window.SDGRedraw.mount。
(function () {
  'use strict';
  const B = window.SDGRedrawBase;

  function parseFloors(SDG) {
    const V = SDG.viewThread;
    const floors = [];
    const nodes = document.querySelectorAll(V.floor);
    nodes.forEach((node) => {
      const authorEl = node.querySelector(V.author);
      const contentEl = node.querySelector(V.content);
      if (!authorEl || !contentEl) return;
      const timeEl = node.querySelector(V.date);
      const floorEl = node.querySelector(V.postNumber);
      const avatarEl = node.querySelector(V.authorAvatar);
      const replyA = node.querySelector(V.replyAnchor);
      floors.push({
        replyHref: replyA ? replyA.getAttribute('href') : '',
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
    const B = window.SDGRedrawBase;
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
    style.textContent = B.CSS;
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
      const head = el('div', { class: 'head' });
      if (f.avatar) {
        head.appendChild(el('img', { class: 'avatar', src: f.avatar, alt: '' }));
      } else {
        const fb = f.author ? f.author[0].toUpperCase() : '?';
        head.appendChild(el('div', { class: 'avatar-fallback', text: fb }));
      }
      head.appendChild(el('a', { class: 'author', text: f.author || '匿名', href: f.authorHref }));
      head.appendChild(el('span', { class: 'meta', text: f.time }));
      head.appendChild(el('a', { class: 'reply', text: '回复', href: f.replyHref || replyUrl(f) }));
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
