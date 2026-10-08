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

  window.SDGRedraw = window.SDGRedraw || {};
  window.SDGRedraw.mountForumList = mountForumList;
})();
