// 拆分自 forumlist.js（A2，v1.20.0 R7-2，纯移动）。
(function () {
  'use strict';
  const B = window.SDGRedrawBase;
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
      // A1（v1.20.0）：读 SDGCache tree 组（getSync 同步快路径；异步 mirror 未回填时自然缺名）
      const groups = window.SDGCache && window.SDGCache.getSync('tree', 'all');
      for (const g of (groups || [])) {
        for (const b of g.secs || []) if (String(b.fid) === String(fid)) return b.name;
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

  function loadRiver(el, wrap, opts, scope, force) {
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
      // 缓存优先（A1：river 组 getSync 快路径）
      let items = [];
      try {
        const cached = window.SDGCache && window.SDGCache.getSync('river', 'all');
        if (cached) items = cached.slice(0, 10);
      } catch (e) { /* */ }
      const done = force ? false : !!sessionStorage.getItem('sdg_river_done');
      if (items.length) renderRiver(box, el, items, opts);
      if (done) return;
      // 会话内首次：拉取（同源、复用页面 Cookie，限 1 次自动请求）
      sessionStorage.setItem('sdg_river_done', '1');
      const retry = (attempt) => {
        if (scope) scope.delay(4000, () => tryFetch(attempt)); else setTimeout(() => tryFetch(attempt), 4000);
      };
      const tryFetch = (attempt) => {
        const p = scope ? scope.fetchText(RIVER_URL, 12000)
          : fetch(RIVER_URL, { credentials: 'omit' }).then((r) => (r.ok ? r.text() : null)).catch(() => null);
        p.then((html) => {
          const parsed = html ? parseRiverItems(html) : [];
          if (parsed.length) {
            // A1（v1.20.0）：SDGCache river 组（mirror 双写，rightrail 经镜像读）
            if (window.SDGCache) window.SDGCache.set('river', 'all', parsed);
            renderRiver(box, el, parsed, opts);
          } else if (attempt === 0) {
            retry(1); // 服务器壳响应（结构在数据缺）：4 秒后自动补一枪
          } else if (!items.length) {
            renderRiver(box, el, [], opts); // 空态（服务器壳）
          }
        }).catch(() => { if (attempt === 0) retry(1); else if (!items.length) renderRiver(box, el, [], opts); });
      };
      tryFetch(0);
    } catch (e) { /* 内容河失败静默 */ }
  }

  window.SDGRedraw = window.SDGRedraw || {};
  window.SDGRedraw.mountRiver = loadRiver;
})();
