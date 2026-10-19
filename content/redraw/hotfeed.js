// 拆分自 forumlist.js（A2，v1.20.0 R7-2，纯移动）。
(function () {
  'use strict';
  const B = window.SDGRedrawBase;
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

  function loadHotFeed(el, wrap, opts, treeData, SDG, scope) {
    try {
      const sc_dead_check = () => scope && scope.isDead();
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
        if (window.SDGCache) window.SDGCache.set('hotfeed', 'all', items); // A1：30min TTL+mirror
      };

      const fetchBoards = () => {
        render([], true); // 先出占位（无任何缓存时热帖区不至于空白无声）
        let done = 0;
        const results = [];
        picked.forEach((b, i) => {
          setTimeout(() => {
            // E-08（v1.18.3）：API 首选/HTML 回退封装——三态区分（成功列表/成功空/失败）；
            // 失败或坏形状每板块至多回退一次 HTML；万单位经 parseWan（'1.4万'≠14）
            const fetchBoardHot = () => {
              const viaHtml = () => scope.fetchText(`forum.php?mod=forumdisplay&fid=${b.fid}&mobile=2`, 15000)
                .then((html) => {
                  if (!html) return { state: 'fail', items: [] };
                  const doc = new DOMParser().parseFromString(html, 'text/html');
                  const threads = (window.SDGRedraw.parseThreads
                    ? window.SDGRedraw.parseThreads(SDG, doc) : []);
                  threads.sort((a2, b2) =>
                    (parseInt(b2.replies || 0, 10) * 10 + parseInt(b2.views || 0, 10))
                    - (parseInt(a2.replies || 0, 10) * 10 + parseInt(a2.views || 0, 10)));
                  return { state: threads.length ? 'ok' : 'empty',
                    items: threads.slice(0, HOT_PER_BOARD).map((t) => ({
                      title: t.title, href: t.href, board: b.name,
                      replies: parseInt(t.replies || 0, 10) || 0,
                      views: parseInt(t.views || 0, 10) || 0,
                      img: (t.preview && t.preview[0]) || '',
                    })) };
                });
              if (window.SDGApi) {
                return scope.fetchJSON(`https://app.sdgun.com.cn/mag/circle/v1/forum/forumView?fid=${b.fid}&p=1&step=20`, 10000)
                  .then((d) => {
                    if (d && Array.isArray(d.list) && d.list.length) {
                      return { state: 'ok', items: d.list.slice(0, HOT_PER_BOARD).map((it) => ({
                        title: String(it.title || it.subject || '')
                          .replace(/^\s*(【[^】]*】|置顶|本版置顶|精华)\s*/, '').trim(),
                        href: `forum.php?mod=viewthread&tid=${it.tid}&mobile=2`,
                        board: b.name,
                        replies: window.SDGApi.parseWan(it.reply_count),
                        views: window.SDGApi.parseWan(it.click),
                        applaud: parseInt(String(it.applaud_count || '').replace(/\D/g, ''), 10) || 0,
                        img: (Array.isArray(it.pics) && it.pics[0]) || '',
                      })) };
                    }
                    // 成功但空/坏形状 → 一次 HTML 回退
                    return viaHtml();
                  })
                  .catch(() => viaHtml());
              }
              return viaHtml();
            };
            const work = fetchBoardHot().then((r) => r.items);
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

      // 缓存优先（A1：hotfeed 组 30min TTL + mirror 内聚于 SDGCache）
      const hotCheck = () => {
        if (window.SDGCache) {
          window.SDGCache.get('hotfeed', 'all').then((c) => {
            if (sc_dead_check()) return;
            if (c && c.items && c.items.length) { render(c.items, false); return; }
            fetchBoards();
          });
        } else {
          fetchBoards();
        }
      };
      hotCheck();
    } catch (e) { /* 热帖流失败静默 */ }
  }

  window.SDGRedraw = window.SDGRedraw || {};
  window.SDGRedraw.mountHotFeed = loadHotFeed;
})();
