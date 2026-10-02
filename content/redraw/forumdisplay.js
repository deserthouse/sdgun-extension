// redraw/forumdisplay.js — 帖子列表页卡片流重绘（parseThreads + mountForumDisplay）。
// 依赖：redraw/base.js（先加载）。挂载入口挂到 window.SDGRedraw.mountForumDisplay。
// 双 profile：bygsjw 富模板（ul.byg_threadlist_ul）→ 简易模板变体（锚点防御式解析）。
(function () {
  'use strict';
  const B = window.SDGRedrawBase;

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
    style.textContent = B.LIST_CSS;
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
      const anchor = B.util.contentAnchor();
      if (anchor !== document.body) anchor.classList.add('sdg-host');
      anchor.appendChild(host);
      B.markActive();
      B.util.hideScaffold('bygsjw');
      B.hideTrailingSiblings(anchor);
      return true;
    }

    const pager = el('div', { class: 'pager' });
    const nextA = B.util.pagerAnchor('next');
    const prevA = B.util.pagerAnchor('prev');
    const prev = el('button', { text: '上一页' });
    if (prevA) prev.addEventListener('click', () => { location.href = prevA.getAttribute('href'); });
    else prev.disabled = true;
    const next = el('button', { text: '下一页' });
    if (nextA) next.addEventListener('click', () => { location.href = nextA.getAttribute('href'); });
    else next.disabled = true;
    pager.appendChild(prev); pager.appendChild(next);

    const page = B ? 1 : 1; // 占位（卡片流不显示页码，保留结构）

    threads.forEach((t) => {
      const head = el('div', { class: 'head' }, [
        el('a', { class: 'title', text: t.title || '(无题)', href: t.href }),
      ]);
      const meta = [];
      if (t.author) meta.push(el('a', { class: 'author', text: t.author, href: t.authorHref }));
      if (t.date) meta.push(el('span', { class: 'meta', text: t.date }));
      if (t.replies || t.views) meta.push(el('span', { class: 'stat', text: `回复 ${t.replies || 0} · 查看 ${t.views || 0}` }));
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

    wrap.appendChild(pager);
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
