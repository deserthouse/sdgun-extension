// 拆分自 forumlist.js（A2，v1.20.0 R7-2，纯移动）。
(function () {
  'use strict';
  const B = window.SDGRedrawBase;
  // ---------- 官方编辑流（EF-01，v1.19.1）：mag1 资讯（纯浏览器头游客可读） ----------
  // catId 配置驱动：优先 config.global_wap_index_cat_id，空则回退 cat=1（实测唯一有数据的频道，
  // v1.19.1 实测 step 上限 20）；解析结果记 sessionStorage 供诊断。任何失败=整区不渲染（不占位）。
  const FEED_CSS = `
    .feed { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);
      padding: 12px 14px 14px; margin: 14px 0; }
    .feed .fhead2 { display: flex; align-items: baseline; gap: 8px; margin-bottom: 10px; }
    .feed .fhead2 .ft { font-weight: 700; font-size: 15px; color: var(--text); }
    .feed .fhead2 .hsub { font-size: 12px; color: var(--text3); }
    /* R15/EV-09：折叠开关（默认折叠，展开才拉取——折叠期零请求） */
    .feed .fToggle { border: none; background: none; color: var(--text3); font-size: 12px;
      cursor: pointer; padding: 4px 8px; margin-left: auto; border-radius: 6px; }
    .feed .fToggle:hover { color: var(--accent); background: var(--surface2); }
    .feed.collapsed .fitem { display: none; }
    .feed a.fitem { display: flex; gap: 10px; padding: 9px 10px; border: 1px solid var(--border);
      border-radius: 12px; text-decoration: none; margin-bottom: 8px; transition: background .12s, border-color .12s; }
    .feed a.fitem:last-child { margin-bottom: 0; }
    .feed a.fitem:hover { background: var(--surface2); border-color: var(--border2); }
    .feed .fitem img.fthumb { width: 84px; height: 56px; border-radius: 8px; object-fit: cover;
      flex: none; background: var(--surface2); }
    .feed .fitem .fmain { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 5px; }
    .feed .fitem .ft2 { font-size: 13.5px; font-weight: 600; color: var(--text); line-height: 1.45;
      display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .feed a.fitem:hover .ft2 { color: var(--accent); }
    .feed .fitem .fmeta { font-size: 11.5px; color: var(--text3); display: flex; gap: 8px;
      align-items: center; overflow: hidden; white-space: nowrap; }
    .feed .fitem button.fshare { border: 1px solid var(--border2); background: var(--surface);
      color: var(--text3); border-radius: 6px; padding: 1px 8px; font-size: 11px; cursor: pointer;
      flex: none; transition: all .12s; }
    .feed .fitem button.fshare:hover { border-color: var(--accent); color: var(--accent); }
  `;
  function firstFeedPic(item) {
    const arr = item && Array.isArray(item.pics_arr) ? item.pics_arr : [];
    for (const p of arr) {
      if (typeof p === 'string' && p) return p;
      if (p && typeof p === 'object') { const u = p.pic || p.url || p.image; if (u) return u; }
    }
    return '';
  }
  function loadFeed(el, wrap, opts, scope) {
    try {
      const sc_dead = () => scope.isDead();
      // catId 解析：config.global_wap_index_cat_id → 空/无数据回退 cat=1；各一次，结果缓存
      const tryCat = (catId, fallback) => {
        scope.fetchJSON(`https://mag1.sdgun.net/mag/info/v2/channel/infoListByCatId?cat_id=${catId}&step=20&p=1`, 10000)
          .then((d) => {
            if (sc_dead()) return;
            const list = d && Array.isArray(d.list) ? d.list : [];
            if (list.length) {
              try { if (window.SDGCache) window.SDGCache.set(window.SDGCache.GROUPS.FEEDCAT, 'all', String(catId)); } catch (e) { /* */ }
              finish(list);
            } else if (fallback) {
              tryCat(fallback, null);
            } // 双空：整区不渲染
          })
          .catch(() => { if (fallback) tryCat(fallback, null); });
      };
      const finish = (list) => {
        const items = list.slice(0, 8).map((it) => ({
          title: String(it.title || '').trim(),
          href: it.link || 'forum.php?forumlist=1&mobile=2',
          // W5 实证：share_info.share_url 是服务端下发的完整 threadWapPage 链接（tid+circle_id），
          // 无需客户端映射——存原值供"复制分享链接"
          share: (it.share_info && it.share_info.share_url) || '',
          img: firstFeedPic(it),
          meta: [it.publish_time_str, it.from]
            .filter(Boolean).map(String).join(' · ')
            + (it.comment_count ? ` · 评论 ${window.SDGApi ? window.SDGApi.parseWan(it.comment_count) : it.comment_count}` : '')
            + (it.applaud_count ? ` · 👍 ${window.SDGApi ? window.SDGApi.parseWan(it.applaud_count) : it.applaud_count}` : ''),
        })).filter((x) => x.title);
        if (!items.length) return;
        // R9/EV-02：DTO {items}（此前写裸数组、读侧要求 c.items，缓存永不命中）
        try { if (window.SDGCache) window.SDGCache.set(window.SDGCache.GROUPS.FEED, 'all', { items }); } catch (e) { /* */ }
        scope.delay(0, () => { if (!scope.isDead()) renderFeed(el, wrap, items, toggleState); });
      };
      // R9/EV-02：缓存命中 → 渲染即止（不再拉 config/频道）；未命中且 feedcat 已解析 →
      // 直接拉已解析频道；仅"无缓存且频道未知"才 +1 config 请求（旧代码无条件拉 config，
      // 注释声称"会话一次"与实现不符）。stale=TTL 过期即 miss，不做后台刷新。
      const startFetch = () => {
        let resolved = '';
        try { resolved = (window.SDGCache && window.SDGCache.getSync(window.SDGCache.GROUPS.FEEDCAT, 'all')) || ''; } catch (e) { /* */ }
        if (resolved && resolved !== '0') { tryCat(resolved, null); return; }
        scope.fetchJSON('https://mag1.sdgun.net/mag/index/v2/Index/config', 10000).then((d) => {
          if (sc_dead()) return;
          const cfg = d && d.data ? d.data : {};
          const cfgCat = String(cfg.global_wap_index_cat_id || '').trim();
          tryCat(cfgCat && cfgCat !== '0' ? cfgCat : '1', cfgCat === '1' ? null : '1');
        }).catch(() => tryCat('1', null));
      };
      // R15/EV-09：默认折叠——折叠期零请求（拉取推迟到首次展开）；展开态会话内记忆
      let expanded = false;
      try { expanded = sessionStorage.getItem('sdg_fd_open') === '1'; } catch (e) { /* */ }
      let dataDone = false;
      let pendingData = false; // 折叠期缓存 miss，展开后需拉取
      const toggleState = {
        get expanded() { return expanded; },
        onToggle: () => {
          expanded = !expanded;
          try { sessionStorage.setItem('sdg_fd_open', expanded ? '1' : '0'); } catch (e) { /* */ }
          const bx = wrap.querySelector('.feed');
          if (expanded) {
            if (!dataDone) {
              dataDone = true;
              if (pendingData) startFetch();
              else tryLoad();
            } else if (bx) bx.classList.remove('collapsed');
          } else if (bx) {
            bx.classList.add('collapsed');
          }
        },
      };
      const tryLoad = () => {
        // 缓存优先（命中即渲染零请求）；miss 记 pending，按折叠态决定立即拉或推迟
        if (window.SDGCache) {
          window.SDGCache.get(window.SDGCache.GROUPS.FEED, 'all').then((c) => {
            if (sc_dead()) return;
            if (c && Array.isArray(c.items) && c.items.length) {
              dataDone = true;
              renderFeed(el, wrap, c.items, toggleState);
              return;
            }
            pendingData = true;
            if (expanded) { dataDone = true; startFetch(); }
          });
        } else {
          dataDone = true;
          startFetch();
        }
      };
      // 初始：展开 → 取数据；折叠（默认）→ 仅头部壳，零请求
      if (expanded) { dataDone = true; tryLoad(); }
      else renderFeed(el, wrap, null, toggleState);
    } catch (e) { /* feed 失败静默 */ }
  }
  function renderFeed(el, wrap, items, toggle) {
    try {
      let box = wrap.querySelector('.feed');
      const shellOnly = !items; // R15/EV-09：折叠壳（仅头部，零请求零位移）
      if (!box) {
        box = el('div', { class: 'feed' });
        wrap.insertBefore(box, wrap.querySelector('.group-title, .card, .hint'));
      }
      const host = wrap.getRootNode().host;
      if (host && !host.dataset.feedCss) {
        host.dataset.feedCss = '1';
        const st = document.createElement('style');
        st.textContent = FEED_CSS;
        host.shadowRoot.appendChild(st);
      }
      box.textContent = '';
      const head = el('div', { class: 'fhead2' }, [
        el('span', { class: 'ft', text: '官方精选' }),
        el('span', { class: 'hsub', text: '编辑推荐 · mag 资讯' }),
      ]);
      if (toggle) {
        const btn = el('button', { class: 'fToggle', text: toggle.expanded ? '收起 ▴' : '展开 ▾',
          title: '默认折叠；展开时才拉取数据' });
        btn.addEventListener('click', toggle.onToggle);
        head.appendChild(btn);
      }
      box.appendChild(head);
      if (shellOnly) { box.classList.add('collapsed'); return; }
      box.classList.toggle('collapsed', !(toggle && toggle.expanded));
      items.forEach((it) => {
        const a = el('a', { class: 'fitem', href: it.href });
        if (it.img) {
          const im = el('img', { class: 'fthumb', src: it.img, alt: '', loading: 'lazy' });
          im.addEventListener('error', () => { im.remove(); });
          a.appendChild(im);
        }
        const main = el('div', { class: 'fmain' });
        main.appendChild(el('div', { class: 'ft2', text: it.title }));
        const meta = el('div', { class: 'fmeta', text: it.meta });
        if (it.share) {
          // W5：复制站方 H5 分享链接（手机 PC 皆可开；阻止卡片默认导航）
          const shareBtn = el('button', { class: 'fshare', text: '分享链接', title: '复制本帖 H5 分享链接',
            onclick: (e) => {
              e.preventDefault();
              e.stopPropagation();
              // EF-07（v1.19.7）：await clipboard 结果，真实成功才提示
              navigator.clipboard.writeText(it.share).then(() => {
                e.target.textContent = '已复制';
                setTimeout(() => { try { e.target.textContent = '分享链接'; } catch (e3) { /* */ } }, 1500);
              }).catch(() => {
                e.target.textContent = '复制失败';
                setTimeout(() => { try { e.target.textContent = '分享链接'; } catch (e3) { /* */ } }, 1500);
              });
            } });
          meta.appendChild(shareBtn);
        }
        main.appendChild(meta);
        a.appendChild(main);
        box.appendChild(a);
      });
    } catch (e) { /* 渲染失败静默 */ }
  }

  window.SDGRedraw = window.SDGRedraw || {};
  window.SDGRedraw.mountFeed = loadFeed;
})();
