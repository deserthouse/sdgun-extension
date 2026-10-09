// redraw/forumlist.js — 版块首页分组卡片重绘（三 profile 解析 + mountForumList）。
// 依赖：redraw/base.js（先加载）。挂载入口挂到 window.SDGRedraw.mountForumList。
// 三 profile 覆盖三种服务器形态：bygsjw 富模板 → Discuz 标准移动（div.bm）→ h2 走查兜底。
(function () {
  'use strict';
  const B = window.SDGRedrawBase;
  // 树内容指纹：跨标签副本写 storage.local 的去重依据（见下方写入处）
  let lastTreeKey = '';

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
      const contentKey = JSON.stringify(data.map((g) => ({ name: g.name, secs: g.secs })));
      const payload = JSON.stringify({ t: Date.now(), groups: data.map((g) => ({ name: g.name, secs: g.secs })) });
      try {
        sessionStorage.setItem('sdg_tree_cache', payload);
      } catch (e) { /* 存储满则跳过 */ }
      // 跨标签持久副本（新标签深链打开时侧栏树仍可用）。
      // 内容未变则不再重写：写 storage.local 会触发 boot 的 onChanged → 重挂载 → 再写，
      // 不去重即自激循环（2026-10-08 首页闪烁事故，boot 侧另有 area 过滤双保险）。
      if (contentKey !== lastTreeKey) {
        lastTreeKey = contentKey;
        try { chrome.storage.local.set({ sdg_tree_cache_ls: payload }); } catch (e) { /* ignore */ }
      }
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
    wrap.appendChild(el('div', { class: 'topbar' }, [el('div', { class: 'tb-in' }, [el('a', { class: 'title', text: '论坛首页', href: '#' })])]));
    // 站点统计条（bygsjw .byg_tongji）——数据在场才渲染。
    // 原始文案是"今日 13113 帖子 22840833 会员 678420"连排（v1.16.2 规范化：
    // 标签配对 + 分隔点 + 大数万化），解析不出任何标签则按原文截断兜底。
    const tongji = document.querySelector('.byg_tongji');
    if (tongji) {
      const txt = (tongji.textContent || '').replace(/\s+/g, ' ').trim();
      if (txt) {
        const fmtNum = (s) => {
          const n = parseInt(s.replace(/[^\d]/g, ''), 10);
          if (isNaN(n)) return s;
          if (n >= 100000) {
            const w = n / 10000;
            return (w < 100 ? Math.round(w * 10) / 10 : Math.round(w)) + '万';
          }
          return n.toLocaleString('en-US');
        };
        const parts = [];
        ['今日', '主题', '帖子', '会员'].forEach((label) => {
          const m = txt.match(new RegExp(label + '[::\\s]*([0-9万亿.,]+)'));
          if (m) parts.push(label + ' ' + fmtNum(m[1]));
        });
        const nw = txt.match(/欢迎新会员[:\s]*([^\s·]{1,24})/);
        if (nw) parts.push('新会员 ' + nw[1]);
        wrap.appendChild(el('div', { class: 'statsbar',
          text: parts.length ? parts.join(' · ').slice(0, 100) : txt.slice(0, 80) }));
      }
    }

    data.forEach((grp) => {
      if (!grp.secs.length) return;
      wrap.appendChild(el('div', { class: 'group-title', text: grp.name }));
      const card = el('div', { class: 'card' });
      grp.secs.forEach((s) => {
        const row = el('a', { class: 'section-row', href: `forum.php?mod=forumdisplay&fid=${s.fid}&mobile=2` });
        if (s.icon) row.appendChild(el('img', { class: 'icon', src: s.icon, alt: '',
          onerror: function () {
            // 服务端图标缺失（实测：卫星区 common_153_icon.png 404）→ 回退模板默认图，再失败才隐去
            if (this.dataset.fb) { this.style.display = 'none'; return; }
            this.dataset.fb = '1';
            const fb = SDG.assets && SDG.assets.defaultBoardIcon;
            if (fb) this.src = fb; else this.style.display = 'none';
          } }));
        const mid = el('div', { class: 's-name' }, [el('span', { text: s.name })]);
        const uniq = [...new Set(s.nums)];
        if (uniq.length) mid.appendChild(el('span', { class: 'meta',
          text: uniq.length >= 2 ? `主题 ${uniq[0]} · 帖 ${uniq[1]}` : uniq[0] }));
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
    // v1.17.0 F-2：热帖速览（活跃前 5 板块 × 3 条；预算/缓存见 loadHotFeed）
    if (opts.enrich !== false) {
      loadHotFeed(el, wrap, opts, data, SDG);
    }
    return true;
  }

  // ---------- 内容河：最近回复（fid=39 最新 10 帖；每会话自动 1 请求 + 缓存 + 手动刷新） ----------
  const RIVER_CSS = `
    .river { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);
      padding: 4px 0; margin: 14px 0; }
    .river .rhead { display: flex; align-items: center; padding: 10px 18px 8px; }
    .river .rhead .rt { font-weight: 700; font-size: 15px; color: var(--text); flex: 1; }
    .river .rhead .rt a.rboard { color: inherit; text-decoration: none; border-bottom: 1px dashed var(--text3); }
    .river .rhead .rt a.rboard:hover { color: var(--accent); border-bottom-color: var(--accent); }
    .river .rhead button { border: none; background: none; color: var(--text3); font-size: 12px;
      cursor: pointer; padding: 2px 6px; }
    .river .rhead button:hover { color: var(--accent); }
    .river a.ritem { display: flex; gap: 10px; padding: 7px 18px; font-size: 14px;
      color: var(--text2); text-decoration: none; transition: background .12s; }
    .river a.ritem:hover { background: var(--surface2); color: var(--accent); }
    .river a.ritem .rt2 { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .river a.ritem .rd { flex: none; color: var(--text3); font-size: 12.5px; }
    .river .rempty { padding: 6px 18px 12px; color: var(--text3); font-size: 13px; }
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
      const raw = (a.textContent || '').replace(/\s+/g, ' ').trim();
      // 站方行文把日期并进标题文本，两种形态都剥出走右对齐列，并归一为可解析格式
      // （点分→横线、去"日"尾），渲染时走相对时间：
      //   尾部裸日期"…说明2026.9.27" + 前置括号日期"【2026.9.27】广告位招租"（实测公告标题两种都有）
      let t = raw;
      let dNorm = '';
      const dmEnd = t.match(/^(.*?)\s*(\d{4}[.．\-]\d{1,2}[.．\-]\d{1,2}日?)\s*$/);
      if (dmEnd) { t = dmEnd[1].trim(); dNorm = dmEnd[2]; }
      const dmLead = t.match(/^【\s*(\d{4}[.．\-]\d{1,2}[.．\-]\d{1,2}日?)\s*】\s*/);
      if (dmLead) { t = t.slice(dmLead[0].length).trim(); if (!dNorm) dNorm = dmLead[1]; }
      t = t.trim();
      if (!tid || seen.has(tid) || t.length < 6) return;
      seen.add(tid);
      dNorm = dNorm.replace(/[.．]/g, '-').replace(/日$/, '');
      items.push({ t: t.slice(0, 60), d: dNorm, href: a.getAttribute('href') });
    });
    return items.slice(0, 10);
  }

  function boardNameOf(fid) {
    try {
      const raw = sessionStorage.getItem('sdg_tree_cache');
      if (raw) {
        for (const g of (JSON.parse(raw).groups) || []) {
          for (const b of g.secs || []) if (String(b.fid) === String(fid)) return b.name;
        }
      }
    } catch (e) { /* ignore */ }
    return null;
  }

  function renderRiver(box, el, items, opts) {
    box.textContent = '';
    box.style.display = ''; // v1.17.3：填充完成后亮相（与空盒隐藏配套）
    // 单板块河：板块名标在头部（可点入板块）；逐行同名是噪音
    const bn = boardNameOf(RIVER_FID) || '站务公告';
    const rt = el('span', { class: 'rt', text: '最近回复 · ' });
    rt.appendChild(el('a', { class: 'rboard', text: bn,
      href: `forum.php?mod=forumdisplay&fid=${RIVER_FID}&mobile=2` }));
    const head = el('div', { class: 'rhead' }, [rt]);
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
      if (it.d) a.appendChild(el('span', { class: 'rd', text: B.util.toRelative(it.d) || it.d }));
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
        box.style.display = 'none'; // v1.17.3：有内容才亮相（杜绝空卡闪现+内容位移）
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
      const tryFetch = (attempt) => fetch(RIVER_URL, { credentials: 'same-origin' })
        .then((r) => r.text())
        .then((html) => {
          const parsed = parseRiverItems(html);
          if (parsed.length) {
            const js = JSON.stringify({ t: Date.now(), items: parsed });
            try { sessionStorage.setItem('sdg_river_cache', js); } catch (e) { /* */ }
            // 跨标签镜像：深链/新标签打开板块页时右栏公告卡仍可挂载（rightrail 读取此键）
            try { chrome.storage.local.set({ sdg_river_cache_ls: js }); } catch (e) { /* */ }
            renderRiver(box, el, parsed, opts);
          } else if (attempt === 0) {
            // 服务器壳响应（结构在数据缺）：4 秒后自动补一枪
            setTimeout(() => tryFetch(1), 4000);
          } else if (!items.length) {
            renderRiver(box, el, [], opts); // 空态（服务器壳）
          }
        })
        .catch(() => { if (attempt === 0) setTimeout(() => tryFetch(1), 4000); else if (!items.length) renderRiver(box, el, [], opts); });
      tryFetch(0);
    } catch (e) { /* 内容河失败静默 */ }
  }

  // ---------- 热帖速览（v1.17.0 F-2：资讯流替代，数据全来自 web 游客页） ----------
  // 预算纪律：活跃前 5 板块（树缓存帖子数排序，公告 39 除外——公告河已覆盖）各拉一次
  // 板块列表页（mobile=2，串行间隔 1.2s），取热力前 3；30 分钟 TTL 持久缓存。
  const HOT_CSS = `
    .hotfeed { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);
      padding: 12px 14px 14px; margin: 14px 0; }
    .hotfeed .hhead { display: flex; align-items: baseline; gap: 8px; margin-bottom: 10px; }
    .hotfeed .hhead .ht { font-weight: 700; font-size: 15px; color: var(--text); }
    .hotfeed .hhead .hsub { font-size: 12px; color: var(--text3); }
    .hotfeed .hgrid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    @media (max-width: 719px) { .hotfeed .hgrid { grid-template-columns: 1fr; } }
    .hotfeed a.hitem { display: flex; gap: 10px; padding: 9px 10px; border: 1px solid var(--border);
      border-radius: 12px; text-decoration: none; transition: background .12s, border-color .12s; }
    .hotfeed a.hitem:hover { background: var(--surface2); border-color: var(--border2); }
    .hotfeed .hitem img.hthumb { width: 84px; height: 56px; border-radius: 8px; object-fit: cover;
      flex: none; background: var(--surface2); }
    .hotfeed .hitem .hmain { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 5px; }
    .hotfeed .hitem .ht2 { font-size: 13.5px; font-weight: 600; color: var(--text); line-height: 1.45;
      display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .hotfeed a.hitem:hover .ht2 { color: var(--accent); }
    .hotfeed .hitem .hmeta { font-size: 11.5px; color: var(--text3); display: flex; gap: 8px;
      align-items: center; overflow: hidden; white-space: nowrap; }
    .hotfeed .hitem .hbd { flex: none; font-weight: 600; color: var(--accent);
      border: 1px solid color-mix(in srgb, var(--accent) 35%, transparent);
      border-radius: 4px; padding: 0 5px; }
    .hotfeed .hloading { color: var(--text3); font-size: 13px; padding: 4px 2px; }
    /* v1.17.3 热帖图位三态（骨架/图/字块）——槽位永在，卡片零位移 */
    .hotfeed .sdg-skel { background: var(--surface2); animation: sdg-pulse 1.6s ease-in-out infinite; }
    .hotfeed .sdg-skel-hthumb { width: 84px; height: 56px; border-radius: 8px; flex: none; }
    .hotfeed .sdg-tile { width: 84px; height: 56px; border-radius: 8px; flex: none;
      background: var(--surface2); color: var(--text3); font-weight: 700; font-size: 18px;
      display: flex; align-items: center; justify-content: center; }
    @keyframes sdg-pulse { 0%, 100% { opacity: .5; } 50% { opacity: .95; } }
  `;
  const HOT_CACHE_KEY = 'sdg_hot_cache';
  const HOT_TTL = 30 * 60e3;
  const HOT_BOARDS = 5;
  const HOT_PER_BOARD = 3;
  const HOT_GAP = 1200;

  // '64万'/'1022万'/'8288' → 数值（树缓存计数是站方万化文本）
  function parseCount(s) {
    const t = String(s || '').trim();
    const m = t.match(/^([\d.]+)\s*万/);
    if (m) return Math.round(parseFloat(m[1]) * 10000);
    const n = parseInt(t.replace(/[^\d]/g, ''), 10);
    return isNaN(n) ? 0 : n;
  }

  function renderHotFeed(box, el, items, pending) {
    box.textContent = '';
    const head = el('div', { class: 'hhead' }, [
      el('span', { class: 'ht', text: '热帖速览' }),
      el('span', { class: 'hsub', text: '活跃板块 · 近期回复' }),
    ]);
    box.appendChild(head);
    const grid = el('div', { class: 'hgrid' });
    items.slice(0, HOT_BOARDS * HOT_PER_BOARD).forEach((it) => {
      const a = el('a', { class: 'hitem', href: it.href });
      // 图位三态：站方图 / 骨架（回填原地换真身）/ 字块——槽位永在，卡片零位移
      if (it.img) {
        const im = el('img', { class: 'hthumb', src: it.img, alt: '', loading: 'lazy' });
        im.addEventListener('error', () => { im.remove(); insertHotTile(a, it.title); });
        a.appendChild(im);
      } else {
        const sk = el('div', { class: 'sdg-skel sdg-skel-hthumb' });
        a.appendChild(sk);
      }
      const main = el('div', { class: 'hmain' });
      main.appendChild(el('div', { class: 'ht2', text: it.title || '(无题)' }));
      const meta = el('div', { class: 'hmeta' });
      if (it.board) meta.appendChild(el('span', { class: 'hbd', text: it.board }));
      meta.appendChild(el('span', {
        class: 'hm', text: `回复 ${it.replies || 0} · 查看 ${it.views || 0}`
          + (it.applaud ? ` · 👍 ${it.applaud}` : '') }));
      main.appendChild(meta);
      a.appendChild(main);
      grid.appendChild(a);
    });
    box.appendChild(grid);
    if (pending) box.appendChild(el('div', { class: 'hloading', text: '热帖加载中…' }));
    else if (window.SDGRedraw.enrichHotFeed) {
      try { window.SDGRedraw.enrichHotFeed(box); } catch (e) { /* 回填失败静默 */ }
    }
  }

  function insertHotTile(a, title) {
    const t = document.createElement('div');
    t.className = 'sdg-tile';
    t.textContent = (String(title || '').trim().charAt(0) || '·').toUpperCase();
    a.insertBefore(t, a.querySelector('.hmain'));
  }

  function loadHotFeed(el, wrap, opts, treeData, SDG) {
    try {
      let box = wrap.querySelector('.hotfeed');
      if (!box) {
        box = el('div', { class: 'hotfeed' });
        wrap.insertBefore(box, wrap.querySelector('.group-title, .card, .hint'));
      }
      const host = wrap.getRootNode().host;
      if (host && !host.dataset.hotCss) {
        host.dataset.hotCss = '1';
        const st = document.createElement('style');
        st.textContent = HOT_CSS;
        host.shadowRoot.appendChild(st);
      }
      // 板块选择：树缓存帖子数排序前 5（公告 39 除外）
      const boards = [];
      (treeData || []).forEach((g) => (g.secs || []).forEach((s) => {
        if (String(s.fid) === '39') return;
        boards.push({ fid: String(s.fid), name: s.name, score: parseCount((s.nums || [])[1]) });
      }));
      if (!boards.length) return;
      boards.sort((a, b) => b.score - a.score);
      const picked = boards.slice(0, HOT_BOARDS);

      const render = (items, pending) => renderHotFeed(box, el, items, pending);
      const draw = (all, pending) => {
        all.sort((a, b) => (b.replies * 10 + (b.views || 0) * 1) - (a.replies * 10 + (a.views || 0) * 1));
        render(all, pending);
      };

      const persist = (items) => {
        const payload = JSON.stringify({ t: Date.now(), items });
        try { sessionStorage.setItem('sdg_hot_cache', payload); } catch (e) { /* */ }
        try { chrome.storage.local.set({ sdg_hot_cache_ls: payload }); } catch (e) { /* */ }
      };

      const fetchBoards = () => {
        render([], true); // 先出占位（无任何缓存时热帖区不至于空白无声）
        let done = 0;
        const results = [];
        picked.forEach((b, i) => {
          setTimeout(() => {
            // v1.18.0：列表数据切 forumView JSON（同请求数；封面/点赞原生齐备）；api.js 缺席回落 HTML 解析
            let work;
            if (window.SDGApi) {
              work = window.SDGApi.forumView(b.fid, 1).then((list) => (list || []).map((it) => ({
                title: String(it.title || it.subject || '')
                  .replace(/^\s*(【[^】]*】|置顶|本版置顶|精华)\s*/, '').trim(),
                href: `forum.php?mod=viewthread&tid=${it.tid}&mobile=2`,
                board: b.name,
                replies: parseInt(String(it.reply_count || '').replace(/\D/g, ''), 10) || 0,
                views: parseInt(String(it.click || '').replace(/\D/g, ''), 10) || 0,
                applaud: parseInt(String(it.applaud_count || '').replace(/\D/g, ''), 10) || 0,
                img: (Array.isArray(it.pics) && it.pics[0]) || '',
              })).slice(0, HOT_PER_BOARD));
            } else {
              work = fetch(`forum.php?mod=forumdisplay&fid=${b.fid}&mobile=2`, { credentials: 'same-origin' })
                .then((r) => r.text())
                .then((html) => {
                  const doc = new DOMParser().parseFromString(html, 'text/html');
                  const threads = (window.SDGRedraw.parseThreads
                    ? window.SDGRedraw.parseThreads(SDG, doc) : []);
                  threads.sort((a2, b2) =>
                    (parseInt(b2.replies || 0, 10) * 10 + parseInt(b2.views || 0, 10))
                    - (parseInt(a2.replies || 0, 10) * 10 + parseInt(a2.views || 0, 10)));
                  return threads.slice(0, HOT_PER_BOARD).map((t) => ({
                    title: t.title, href: t.href, board: b.name,
                    replies: parseInt(t.replies || 0, 10) || 0,
                    views: parseInt(t.views || 0, 10) || 0,
                    img: (t.preview && t.preview[0]) || '',
                  }));
                });
            }
            work.then((items) => {
              results.push(...items);
            }).catch(() => { /* 单板块失败跳过 */ }).then(() => {
              done += 1;
              // v1.17.3：网格一次成型（此前每板块重绘一次，首页内容被反复推下）
              if (done === picked.length) {
                draw(results, false);
                if (results.length) persist(results);
              }
            });
          }, i * HOT_GAP);
        });
      };

      // 缓存优先：会话内 30 分钟 → 跨标签镜像（TTL 放宽 4 倍，过期后台静默重拉刷新）
      try {
        const raw = sessionStorage.getItem('sdg_hot_cache');
        if (raw) {
          const c = JSON.parse(raw);
          if (c && c.items && c.items.length && Date.now() - c.t < HOT_TTL) {
            render(c.items, false);
            return;
          }
        }
      } catch (e) { /* ignore */ }
      let mirrored = false;
      try {
        chrome.storage.local.get({ sdg_hot_cache_ls: null }, (st) => {
          try {
            if (st && st.sdg_hot_cache_ls) {
              const c = JSON.parse(st.sdg_hot_cache_ls);
              if (c && c.items && c.items.length && Date.now() - c.t < HOT_TTL) {
                render(c.items, false);
                mirrored = true;
              } else if (c && c.items && c.items.length) {
                render(c.items, true); // 过期镜像先顶着，后台刷新
              }
            }
          } catch (e) { /* ignore */ }
          if (!mirrored) fetchBoards();
        });
      } catch (e) { fetchBoards(); }
    } catch (e) { /* 热帖流失败静默 */ }
  }

  window.SDGRedraw = window.SDGRedraw || {};
  window.SDGRedraw.mountForumList = mountForumList;
})();
