// redraw/forumlist.js — 版块首页分组卡片重绘（三 profile 解析 + mountForumList）。
// 依赖：redraw/base.js（先加载）。挂载入口挂到 window.SDGRedraw.mountForumList。
// 三 profile 覆盖三种服务器形态：bygsjw 富模板 → Discuz 标准移动（div.bm）→ h2 走查兜底。
(function () {
  'use strict';
  const B = window.SDGRedrawBase;

  function mountForumList(SDG, opts) {
    // profile 1: bygsjw 富模板（分组容器 data-byginto）
    let data = [];
    document.querySelectorAll(SDG.forumList.group).forEach((g) => {
      const name = (g.querySelector(SDG.forumList.groupName) || {}).textContent || '';
      const secs = [];
      g.querySelectorAll('li.cl').forEach((li) => {
        const a = li.querySelector(SDG.forumList.sectionLink);
        if (!a) return;
        const fid = (a.getAttribute('href').match(/fid=(\d+)/) || [])[1];
        const icon = li.querySelector('.forum_img img');
        const nm = (icon && icon.getAttribute('alt')) || (a.textContent || '').trim();
        const nums = [...li.querySelectorAll('.forum_num, .num_em, em, span')].map((n) => (n.textContent || '').replace(/\s+/g, '')).filter((s) => /[\d]/.test(s) && s.length <= 8);
        if (fid) secs.push({ fid, name: nm, icon: icon ? icon.getAttribute('src') : '', nums });
      });
      if (secs.length) data.push({ name: name.trim(), secs });
    });

    // profile 2: Discuz 标准移动模板（div.bm / .bm_h 分组 / .bm_c 版块，用户实机样本 2026-10-01）
    if (!data.length) {
      document.querySelectorAll('div.bm').forEach((bm) => {
        const nameEl = bm.querySelector('.bm_h');
        const name = nameEl ? (nameEl.textContent || '').replace(/\s+/g, ' ').trim() : '';
        const secs = [];
        bm.querySelectorAll('a[href*="mod=forumdisplay"]').forEach((a) => {
          const fid = (a.getAttribute('href').match(/fid=(\d+)/) || [])[1];
          if (!fid) return;
          const nm = (a.textContent || '').replace(/\s+/g, ' ').trim();
          const cntEl = a.parentElement.querySelector('.xg1');
          const cnt = cntEl ? (cntEl.textContent || '').replace(/[()（）\s]/g, '') : '';
          secs.push({ fid, name: nm, icon: '', nums: cnt ? [cnt] : [] });
        });
        if (name || secs.length) data.push({ name, secs });
      });
    }

    // profile 3: h2 分组走查（其他未知变体兜底）
    if (!data.length) {
      const els = document.querySelectorAll(SDG.h2walk.groupHeader + ', ' + SDG.h2walk.sectionLink);
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
    const legacyList = document.getElementById(SDG.legacyListId);
    if (legacyList) B.hideEl(legacyList);

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
    document.querySelectorAll('ul.byg_threadlist_ul, .sub_forum').forEach(B.hideEl);
    const anchor = B.util.contentAnchor();
    if (anchor !== document.body) anchor.classList.add('sdg-host');
    anchor.appendChild(host);
    B.markActive();
    B.util.hideScaffold('standard');
    B.hideTrailingSiblings(anchor);
    return true;
  }

  window.SDGRedraw = window.SDGRedraw || {};
  window.SDGRedraw.mountForumList = mountForumList;
})();
