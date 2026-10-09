// redraw/enrich.js — 列表图文增强（v1.17.0 F-1；v1.17.1 全页化+骨架占位）。
// 机制：对无站方缩略图的行，后台拉取该帖 mobile=1 标准模板页（18KB，稳定轻量），
// 解析首楼正文 → 第一张内容图 + 文字摘要；按 tid 持久缓存（7 天，同一帖终身拉一次）。
// 预算纪律：整页无图行全补（上限 12 覆盖满页）、串行间隔 1.5 秒——单在途请求，
// 节奏与用户自己逐帖点开相当（绿区：游客页、人类节奏、有缓存、零伪造）。
// 占位：入队即渲染骨架（图位+摘要条），数据原地填充，排版零跳动。
// 开关：popup「图文增强」（prefs.enrich，默认开）；boot 经 opts.enrich 传入。
(function () {
  'use strict';
  const B = window.SDGRedrawBase || {};
  const CACHE_KEY = 'sdg_tx_cache';
  const CACHE_MAX = 600;      // 条目上限（约 200KB），超限按时间淘汰
  const TTL = 7 * 86400e3;    // 首楼内容基本不变，7 天足够
  const PER_PAGE_CAP = 12;    // 覆盖满页（bygsjw 每页 10~14 行）
  const GAP_MS = 1500;

  // 解析帖子页（mobile=1 标准模板）：首楼 #postmessage_{pid} → {ex, img}
  function parseThreadPage(html) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const first = doc.querySelector('div[id^="postmessage_"]');
    if (!first) return null;
    const c = first.cloneNode(true);
    c.querySelectorAll('blockquote, .quote, script, style, i.pstatus, .jammer').forEach((n) => n.remove());
    const imgs = [...c.querySelectorAll('img')];
    c.querySelectorAll('img').forEach((n) => n.remove());
    // 摘要清洗：BBCode 残留（[url=…]/bare url=https://…）与多余空白
    let ex = (c.textContent || '').replace(/\s+/g, ' ').trim();
    ex = ex.replace(/\[url=[^\]]*\]/gi, '')
           .replace(/url=https?:\/\/\S+/gi, '')
           .replace(/\s{2,}/g, ' ')
           .replace(/^[\s|·-]+/, '')
           .trim()
           .slice(0, 90);
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

  // ---- 骨架占位（v1.17.3 零位移版）：与挂载同任务落位（首帧即最终版式），
  // 终态槽位永不消失——图→img / 无图→首字字块 tile；摘要骨架与 .ex 行盒同高（18px）。
  // 仅存的收縮：解析失败/无摘要时摘骨架撤除（罕见，18px 一次性落定）。----
  function addSkeleton(row) {
    if (!row || row.dataset.sdgEnrich) return;
    row.dataset.sdgEnrich = 'pending';
    if (!row.querySelector('img.thumb') && !row.querySelector('.sdg-tile')
        && !row.querySelector('.sdg-skel-thumb')) {
      const sk = document.createElement('div');
      sk.className = 'sdg-skel sdg-skel-thumb';
      row.insertBefore(sk, row.firstChild);
    }
    const main = row.querySelector('.main');
    if (main && !main.querySelector('.sdg-skel-ex')) {
      const sk = document.createElement('div');
      sk.className = 'sdg-skel sdg-skel-ex';
      main.appendChild(sk);
    }
  }

  function removeSkeleton(row) {
    if (!row) return;
    delete row.dataset.sdgEnrich;
    row.querySelectorAll('.sdg-skel').forEach((n) => n.remove());
  }

  function locateRow(shadowRoot, tid) {
    const a = shadowRoot.querySelector(`a.t[href*="tid=${tid}"]`);
    return a ? a.closest('.trow') : null;
  }

  // 首字字块（无图帖的永久图位）：槽位永在，杜绝宽度/高度位移
  function insertTile(row, text) {
    const t = document.createElement('div');
    t.className = 'sdg-tile';
    const ch = (String(text || '').trim().charAt(0) || '·').toUpperCase();
    t.textContent = ch;
    row.insertBefore(t, row.querySelector('.main'));
  }

  // 终态落位：img 或 tile 二选一进图位；摘要在场则填文本，**不在场也保留空槽**（18px，
  // v1.18.0 零位移终解——行高与数据有无完全解耦）；撤骨架
  function settleRow(shadowRoot, tid, d) {
    const row = locateRow(shadowRoot, tid);
    if (!row) return;
    if (!row.querySelector('img.thumb') && !row.querySelector('.sdg-tile')) {
      if (d && d.img) {
        const im = document.createElement('img');
        im.className = 'thumb';
        im.loading = 'lazy';
        im.alt = '';
        im.src = d.img;
        im.addEventListener('error', () => {
          im.remove();
          if (!row.isConnected) return;
          insertTile(row, (row.querySelector('.t') || {}).textContent);
        });
        row.insertBefore(im, row.querySelector('.main'));
      } else {
        insertTile(row, (row.querySelector('.t') || {}).textContent);
      }
    }
    const main = row.querySelector('.main');
    if (main && !main.querySelector('.ex')) {
      const ex = document.createElement('div');
      ex.className = 'ex';
      ex.textContent = (d && d.ex) || '';
      main.appendChild(ex);
    }
    removeSkeleton(row);
  }

  // 入口：列表挂载后同步调用（骨架与挂载同任务→首帧即终版式；缓存命中/拉取在后续任务原地换真身）
  function enrichRows(shadowRoot) {
    const rows = [...shadowRoot.querySelectorAll('.trow')].filter((r) => !r.querySelector('img.thumb'));
    if (!rows.length) return;
    const candidates = [];
    rows.forEach((row) => {
      const a = row.querySelector('a.t');
      const tid = a && (a.getAttribute('href').match(/tid=(\d+)/) || [])[1];
      if (!tid) return;
      addSkeleton(row); // 同步占位（先于任何异步回调，杜绝素行→图文行跳变）
      candidates.push({ tid });
    });
    if (!candidates.length) return;
    readCache((cache) => {
      const queue = [];
      candidates.forEach(({ tid }) => {
        const hit = cache[tid];
        if (hit && hit.t > Date.now() - TTL) {
          settleRow(shadowRoot, tid, hit);
          return;
        }
        queue.push(tid);
      });
      queue.slice(0, PER_PAGE_CAP).forEach((tid, i) => {
        setTimeout(() => {
          fetch(`forum.php?mod=viewthread&tid=${tid}&mobile=1`, { credentials: 'same-origin' })
            .then((r) => r.text())
            .then((html) => {
              const p = parseThreadPage(html);
              if (p) {
                cache[tid] = { t: Date.now(), ex: p.ex, img: p.img };
                writeCache(cache);
                settleRow(shadowRoot, tid, cache[tid]);
              } else {
                // 解析失败：不缓存（下次重试）；槽位降级为字块保版式，摘骨架撤除
                settleRow(shadowRoot, tid, null);
              }
            })
            .catch(() => { settleRow(shadowRoot, tid, null); });
        }, i * GAP_MS);
      });
    });
  }

  // 首页热帖流的图回填（F-2 配套）：骨架在 renderHotFeed 建卡时已就位，
  // 此处只做终态解析——图或字块二选一换入，槽位永在（卡片零位移）。
  // 预算：缓存优先，缺失低优先级补拉（每会话 ≤3 条、间隔 1.5s，与列表共享 tid 缓存）。
  const HOT_BACKFILL_CAP = 3;
  function enrichHotFeed(box) {
    const items = [...box.querySelectorAll('a.hitem')].filter((a) => a.querySelector('.sdg-skel-hthumb'));
    if (!items.length) return;
    readCache((cache) => {
      const queue = [];
      items.forEach((a) => {
        const tid = (a.getAttribute('href').match(/tid=(\d+)/) || [])[1];
        if (!tid) return;
        const hit = cache[tid];
        if (hit && hit.t > Date.now() - TTL) {
          settleHotCard(box, tid, hit);
          return;
        }
        queue.push(tid);
      });
      queue.slice(0, HOT_BACKFILL_CAP).forEach((tid, i) => {
        setTimeout(() => {
          fetch(`forum.php?mod=viewthread&tid=${tid}&mobile=1`, { credentials: 'same-origin' })
            .then((r) => r.text())
            .then((html) => {
              const p = parseThreadPage(html);
              if (p) {
                cache[tid] = { t: Date.now(), ex: p.ex, img: p.img };
                writeCache(cache);
                settleHotCard(box, tid, cache[tid]);
              } else {
                settleHotCard(box, tid, null);
              }
            })
            .catch(() => { settleHotCard(box, tid, null); });
        }, i * GAP_MS);
      });
    });
  }

  // 热帖卡终态：图→img / 无图→字块；骨架永撤但槽位由真身顶替
  function settleHotCard(box, tid, d) {
    const a = box.querySelector(`a.hitem[href*="tid=${tid}"]`);
    if (!a) return;
    const skel = a.querySelector('.sdg-skel-hthumb');
    const title = (a.querySelector('.ht2') || {}).textContent;
    if (d && d.img) {
      const im = document.createElement('img');
      im.className = 'hthumb';
      im.loading = 'lazy';
      im.alt = '';
      im.src = d.img;
      im.addEventListener('error', () => {
        im.remove();
        insertHotTileFor(a, title);
      });
      if (skel) a.replaceChild(im, skel); else a.insertBefore(im, a.querySelector('.hmain'));
    } else {
      insertHotTileFor(a, title);
      if (skel) skel.remove();
    }
  }

  function insertHotTileFor(a, title) {
    if (a.querySelector('.sdg-tile')) return;
    const t = document.createElement('div');
    t.className = 'sdg-tile';
    t.textContent = (String(title || '').trim().charAt(0) || '·').toUpperCase();
    a.insertBefore(t, a.querySelector('.hmain'));
  }

  window.SDGRedraw = window.SDGRedraw || {};
  window.SDGRedraw.enrichRows = enrichRows;
  window.SDGRedraw.enrichHotFeed = enrichHotFeed;
  window.SDGRedraw.parseThreadPage = parseThreadPage; // 单测导出
})();
