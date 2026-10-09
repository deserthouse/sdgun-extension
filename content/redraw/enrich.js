// redraw/enrich.js — 列表图文增强（v1.17.0 F-1：帖子列表补缩略图+摘要）。
// 机制：对无站方缩略图的行，后台拉取该帖 mobile=1 标准模板页（18KB，稳定轻量），
// 解析首楼正文 → 第一张内容图 + 文字摘要；按 tid 持久缓存（7 天，同一帖终身拉一次）。
// 预算纪律：每页列表最多补 4 行、串行间隔 2 秒、仅无图行——对服务器的额外压力
// 与用户自己快速点开 4 个帖子相当（绿区：游客页、人类节奏、有缓存、零伪造）。
// 开关：popup「图文增强」（prefs.enrich，默认开）；boot 经 opts.enrich 传入。
(function () {
  'use strict';
  const B = window.SDGRedrawBase || {};
  const CACHE_KEY = 'sdg_tx_cache';
  const CACHE_MAX = 600;      // 条目上限（约 200KB），超限按时间淘汰
  const TTL = 7 * 86400e3;    // 首楼内容基本不变，7 天足够
  const PER_PAGE_CAP = 4;
  const GAP_MS = 2000;

  // 解析帖子页（mobile=1 标准模板）：首楼 #postmessage_{pid} → {ex, img}
  function parseThreadPage(html) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const first = doc.querySelector('div[id^="postmessage_"]');
    if (!first) return null;
    const c = first.cloneNode(true);
    c.querySelectorAll('blockquote, .quote, script, style, i.pstatus, .jammer').forEach((n) => n.remove());
    const imgs = [...c.querySelectorAll('img')];
    c.querySelectorAll('img').forEach((n) => n.remove());
    const ex = (c.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 90);
    let img = '';
    for (const im of imgs) {
      const s = im.getAttribute('src') || im.getAttribute('data-src') || im.getAttribute('file') || '';
      if (!s) continue;
      // 跳过模板/表情/图标（相对路径的 static/template 目录与表情关键词）
      if (/^(?:\.?\/)?(?:static|template)\//i.test(s) || /smiley|smile|emot|icon/i.test(s)) continue;
      img = s;
      break;
    }
    if (!ex && !img) return null;
    return { ex, img };
  }

  function readCache(cb) {
    try {
      chrome.storage.local.get({ [CACHE_KEY]: '{}' }, (st) => {
        let map = {};
        try { map = JSON.parse(st[CACHE_KEY] || '{}') || {}; } catch (e) { map = {}; }
        cb(map);
      });
    } catch (e) { cb({}); }
  }

  function writeCache(map) {
    try {
      const keys = Object.keys(map);
      if (keys.length > CACHE_MAX) {
        keys.sort((a, b) => (map[a].t || 0) - (map[b].t || 0));
        for (const k of keys.slice(0, keys.length - CACHE_MAX)) delete map[k];
      }
      chrome.storage.local.set({ [CACHE_KEY]: JSON.stringify(map) });
    } catch (e) { /* 存储满则放弃 */ }
  }

  // 把增强数据落到一行（.trow）：图插到行首（与站方缩略图同槽位），摘要加到 .main 尾
  function applyToRow(row, d) {
    if (!d) return;
    if (d.img && !row.querySelector('img.thumb')) {
      const im = document.createElement('img');
      im.className = 'thumb';
      im.loading = 'lazy';
      im.alt = '';
      im.src = d.img;
      im.addEventListener('error', () => { im.remove(); });
      row.insertBefore(im, row.firstChild);
    }
    const main = row.querySelector('.main');
    if (d.ex && main && !main.querySelector('.ex')) {
      const ex = document.createElement('div');
      ex.className = 'ex';
      ex.textContent = d.ex;
      main.appendChild(ex);
    }
  }

  // 入口：列表挂载后调用（shadowRoot 内 .trow 无 img.thumb 的行）
  function enrichRows(shadowRoot) {
    const rows = [...shadowRoot.querySelectorAll('.trow')].filter((r) => !r.querySelector('img.thumb'));
    if (!rows.length) return;
    readCache((cache) => {
      const queue = [];
      rows.forEach((row) => {
        const a = row.querySelector('a.t');
        const tid = a && (a.getAttribute('href').match(/tid=(\d+)/) || [])[1];
        if (!tid) return;
        const hit = cache[tid];
        if (hit && hit.t > Date.now() - TTL) {
          applyToRow(row, hit);
          return;
        }
        queue.push({ row, tid });
      });
      queue.slice(0, PER_PAGE_CAP).forEach(({ row, tid }, i) => {
        setTimeout(() => {
          fetch(`forum.php?mod=viewthread&tid=${tid}&mobile=1`, { credentials: 'same-origin' })
            .then((r) => r.text())
            .then((html) => {
              const p = parseThreadPage(html);
              if (!p) return;
              cache[tid] = { t: Date.now(), ex: p.ex, img: p.img };
              writeCache(cache);
              // 行可能已被重挂载替换（主题切换等）——按 tid 重新定位
              const live = shadowRoot.querySelector(`a.t[href*="tid=${tid}"]`);
              applyToRow(live ? live.closest('.trow') : row, cache[tid]);
            })
            .catch(() => { /* 单帖失败静默，不打扰列表 */ });
        }, i * GAP_MS);
      });
    });
  }

  // 首页热帖流的图回填（v1.17.0 F-2 配套）：卡片缺图时查共享 tid 缓存，
  // 缺失则低优先级补拉（每会话 ≤3 条、间隔 2s）——与列表增强同一缓存，同一帖只拉一次
  const HOT_BACKFILL_CAP = 3;
  function enrichHotFeed(box) {
    const items = [...box.querySelectorAll('a.hitem')];
    if (!items.length) return;
    readCache((cache) => {
      const queue = [];
      items.forEach((a) => {
        const tid = (a.getAttribute('href').match(/tid=(\d+)/) || [])[1];
        if (!tid) return;
        const hit = cache[tid];
        if (hit && hit.t > Date.now() - TTL && hit.img && !a.querySelector('img.hthumb')) {
          insertHotThumb(a, hit.img);
          return;
        }
        if (!a.querySelector('img.hthumb')) queue.push({ a, tid });
      });
      queue.slice(0, HOT_BACKFILL_CAP).forEach(({ a, tid }, i) => {
        setTimeout(() => {
          fetch(`forum.php?mod=viewthread&tid=${tid}&mobile=1`, { credentials: 'same-origin' })
            .then((r) => r.text())
            .then((html) => {
              const p = parseThreadPage(html);
              if (!p || !p.img) return;
              cache[tid] = { t: Date.now(), ex: p.ex, img: p.img };
              writeCache(cache);
              const live = box.querySelector(`a.hitem[href*="tid=${tid}"]`);
              if (live) insertHotThumb(live, p.img);
            })
            .catch(() => { /* 静默 */ });
        }, i * GAP_MS);
      });
    });
  }

  function insertHotThumb(a, src) {
    const im = document.createElement('img');
    im.className = 'hthumb';
    im.loading = 'lazy';
    im.alt = '';
    im.src = src;
    im.addEventListener('error', () => { im.remove(); });
    a.insertBefore(im, a.firstChild);
  }

  window.SDGRedraw = window.SDGRedraw || {};
  window.SDGRedraw.enrichRows = enrichRows;
  window.SDGRedraw.enrichHotFeed = enrichHotFeed;
  window.SDGRedraw.parseThreadPage = parseThreadPage; // 单测导出
})();
