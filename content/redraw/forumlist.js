// redraw/forumlist.js — 版块首页分组卡片重绘（三 profile 解析 + mountForumList）。
// 依赖：redraw/base.js（先加载）。挂载入口挂到 window.SDGRedraw.mountForumList。
// 三 profile 覆盖三种服务器形态：bygsjw 富模板 → Discuz 标准移动（div.bm）→ h2 走查兜底。
(function () {
  'use strict';
  const B = window.SDGRedrawBase;

  function mountForumList(SDG, opts, cachedGroups) {
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
    // P0-2：live 解析为空 + 会话缓存可用 → 渲染缓存树（服务器壳态降级，标注缓存）
    let fromCache = false;
    if (!data.length && cachedGroups && cachedGroups.length) {
      data = cachedGroups;
      fromCache = true;
    }
    if (!data.length) return false;
    // live 解析成功 → 写会话缓存（供壳态降级用）
    if (!fromCache) {
      try {
        sessionStorage.setItem('sdg_tree_cache',
          JSON.stringify({ t: Date.now(), groups: data.map((g) => ({ name: g.name, secs: g.secs })) }));
      } catch (e) { /* 存储满则跳过 */ }
    }
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
    wrap.appendChild(el('div', { class: 'hint',
      text: fromCache ? 'SDGun Web Access · 缓存内容（服务器未响应完整页面，点击卡片重新加载）'
                      : 'SDGun Web Access · 重绘层' }));

    shadow.appendChild(wrap);
    // 隐藏原列表但保留结构
    document.querySelectorAll('ul.byg_threadlist_ul, .sub_forum').forEach(B.hideEl);
    const anchor = B.util.contentAnchor();
    if (anchor !== document.body) anchor.classList.add('sdg-host');
    anchor.appendChild(host);
    B.markActive();
    B.util.hideScaffold('standard');
    B.hideTrailingSiblings(anchor);
    // Batch2 内容河：异步加载（不阻塞主渲染）
    loadRiver(el, wrap, opts);
    return true;
  }

  // ---------- 内容河：最近回复（fid=39 最新 10 帖；每会话自动 1 请求 + 缓存 + 手动刷新） ----------
  const RIVER_CSS = `
    .river { background:#fff; border:1px solid rgba(0,0,0,.08); border-radius:12px;
      padding:4px 0; margin:14px 0; }
    .river .rhead { display:flex; align-items:center; padding:8px 16px 6px; }
    .river .rhead .rt { font-weight:700; font-size:14.5px; color:#1c1917; flex:1; }
    .river .rhead button { border:none; background:none; color:#a8a29e; font-size:12px;
      cursor:pointer; padding:2px 6px; }
    .river .rhead button:hover { color:#b01f28; }
    .river a.ritem { display:flex; gap:10px; padding:6px 16px; font-size:13.5px;
      color:#44403c; text-decoration:none; }
    .river a.ritem:hover { background:#fafaf9; color:#b01f28; }
    .river a.ritem .rt2 { flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .river a.ritem .rd { flex:none; color:#a8a29e; font-size:12px; }
    .river .rempty { padding:6px 16px 12px; color:#a8a29e; font-size:12.5px; }
    :host(.dark) .river { background:#1a1b1e; border-color:#2c2d31; }
    :host(.dark) .river .rhead .rt { color:#eceae8; }
    :host(.dark) .river a.ritem { color:#d6d3d1; }
    :host(.dark) .river a.ritem:hover { background:#1e1f23; color:#ff6b7a; }
  `;
  const RIVER_FID = 39;      // 站务公告——站方公告流，作为"最近动态"源
  const RIVER_URL = `forum.php?mod=forumdisplay&fid=${RIVER_FID}&mobile=2`;

  function parseRiverItems(html) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const items = [];
    const seen = new Set();
    doc.querySelectorAll('ul.byg_threadlist_ul > li.cl, li.cl').forEach((li) => {
      const a = li.querySelector('a[href*="mod=viewthread"]');
      if (!a) return;
      const tid = (a.getAttribute('href').match(/tid=(\d+)/) || [])[1];
      const t = (a.textContent || '').replace(/\s+/g, ' ').trim();
      if (!tid || seen.has(tid) || t.length < 6) return;
      seen.add(tid);
      items.push({ t: t.slice(0, 60), href: a.getAttribute('href') });
    });
    return items.slice(0, 10);
  }

  function renderRiver(box, el, items, opts) {
    box.textContent = '';
    const head = el('div', { class: 'rhead' }, [
      el('span', { class: 'rt', text: '最近回复' }),
    ]);
    const rf = el('button', { text: '刷新', title: '重新获取（手动）' });
    rf.addEventListener('click', () => {
      try { sessionStorage.removeItem('sdg_river_done'); } catch (e) { /* */ }
      loadRiver(el, box.closest('.wrap'), opts, true);
    });
    head.appendChild(rf);
    box.appendChild(head);
    if (!items.length) {
      box.appendChild(el('div', { class: 'rempty', text: '暂未获取到（服务器不稳时常见）' }));
      return;
    }
    items.forEach((it) => {
      const a = el('a', { class: 'ritem', href: it.href });
      a.appendChild(el('span', { class: 'rt2', text: it.t }));
      a.appendChild(el('span', { class: 'rd', text: '' }));
      box.appendChild(a);
    });
  }

  function loadRiver(el, wrap, opts, force) {
    if (!wrap) return;
    try {
      // 已有区块（刷新路径）则复用；否则插到筛选行/分组标题之前
      let box = wrap.querySelector('.river');
      const fresh = !box;
      if (fresh) {
        box = el('div', { class: 'river' });
        const styleHost = box; // 样式走主 style 元素外挂：插入 RIVER_CSS 一次
        wrap.insertBefore(box, wrap.querySelector('.group-title, .card, .hint'));
      }
      // 样式（一次性）
      const host = wrap.getRootNode().host;
      if (host && !host.dataset.riverCss) {
        host.dataset.riverCss = '1';
        const st = document.createElement('style');
        st.textContent = RIVER_CSS;
        host.shadowRoot.appendChild(st);
      }
      // 缓存优先
      let items = [];
      try {
        const raw = sessionStorage.getItem('sdg_river_cache');
        if (raw) items = JSON.parse(raw).items || [];
      } catch (e) { /* */ }
      const done = force ? false : !!sessionStorage.getItem('sdg_river_done');
      if (items.length) renderRiver(box, el, items, opts);
      if (done) return;
      // 会话内首次：拉取（同源、复用页面 Cookie，限 1 次自动请求）
      sessionStorage.setItem('sdg_river_done', '1');
      fetch(RIVER_URL, { credentials: 'same-origin' })
        .then((r) => r.text())
        .then((html) => {
          const parsed = parseRiverItems(html);
          if (parsed.length) {
            try { sessionStorage.setItem('sdg_river_cache', JSON.stringify({ t: Date.now(), items: parsed })); } catch (e) { /* */ }
            renderRiver(box, el, parsed, opts);
          } else if (!items.length) {
            renderRiver(box, el, [], opts); // 空态（服务器壳）
          }
        })
        .catch(() => { if (!items.length) renderRiver(box, el, [], opts); });
    } catch (e) { /* 内容河失败静默 */ }
  }

  window.SDGRedraw = window.SDGRedraw || {};
  window.SDGRedraw.mountForumList = mountForumList;
})();
