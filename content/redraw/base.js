// redraw/base.js — 共享样式、DOM 工具、挂载/卸载基础设施。
// 所有重绘模块（viewthread/forumdisplay/forumlist）经由 window.SDGRedrawBase 引用。
(function () {
  'use strict';

  // ---------- 列表页样式（v1.15 设计系统：令牌/排版阶梯/三层明暗/B 式卡片） ----------
  const LIST_CSS = `
    :host {
      all: initial;
      font-family: system-ui, "Segoe UI", "Microsoft YaHei", sans-serif;
      /* 设计令牌 */
      --bg: #f6f5f4; --surface: #ffffff; --surface2: #f1efee;
      --border: rgba(0,0,0,.08); --border2: rgba(0,0,0,.14);
      --text: #1c1917; --text2: #57534e; --text3: #a8a29e;
      --accent: #b01f28; --radius: 14px;
    }
    :host(.dark) {
      --bg: #131417; --surface: #1a1b1e; --surface2: #222329;
      --border: #27282d; --border2: #34353b;
      --text: #e7e5e4; --text2: #a8a29e; --text3: #78716c;
      --accent: #ff6b7a;
    }
    * { box-sizing: border-box; }
    .wrap { max-width: 1040px; margin: 0 auto; padding: 60px 20px 32px; }

    /* 顶栏：内容列内左对齐（面包屑/标题左，操作右） */
    .topbar {
      position: fixed; top: 0; left: 0; right: 0; z-index: 50;
      background: color-mix(in srgb, var(--surface) 88%, transparent);
      backdrop-filter: blur(12px);
      border-bottom: 1px solid var(--border);
      color: var(--text);
    }
    .tb-in { max-width: 1040px; margin: 0 auto; display: flex; align-items: center;
      gap: 10px; padding: 11px 20px; font-size: 15px; font-weight: 600; }
    .topbar a { color: inherit; text-decoration: none; }
    .crumb-home { color: var(--text3); font-weight: 500; }
    .crumb-home:hover { color: var(--accent); }
    .crumb-sep { color: var(--text3); font-weight: 400; }
    .topbar .title { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

    .card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);
      margin: 8px 0; overflow: hidden; box-shadow: 0 1px 2px rgba(0,0,0,.03); }
    /* v1.16.2 密度收紧：分组标题上间距 20→14（截图评审"略显松散"） */
    .group-title { font-weight: 700; font-size: 17px; color: var(--text); margin: 14px 2px 6px; }
    .section-row { display: flex; align-items: center; gap: 12px; padding: 12px 16px;
      border-bottom: 1px solid var(--border); color: var(--text2); text-decoration: none;
      transition: background .12s; }
    .section-row:last-child { border-bottom: 0; }
    .section-row:hover { background: var(--surface2); }
    .icon { width: 40px; height: 40px; border-radius: 10px; object-fit: cover; flex: none; background: var(--surface2); }
    .s-name { display: flex; flex-direction: column; gap: 2px; font-size: 15px; font-weight: 500; color: var(--text); }
    .s-name .meta { color: var(--text3); font-size: 12.5px; font-weight: 400; }
    .head { display: flex; align-items: center; gap: 10px; }
    .head .title { font-size: 17px; font-weight: 600; color: var(--text); text-decoration: none;
      flex: 1; line-height: 1.45; }
    .head .title:hover { color: var(--accent); }
    .meta-row { display: flex; gap: 14px; align-items: center; margin-top: 8px; font-size: 13px; color: var(--text3); }
    .meta-row .author { color: var(--text2); text-decoration: none; }
    .meta-row .author:hover { color: var(--accent); }
    .meta-row .stat { margin-left: auto; flex: none; }
    .preview { margin-top: 12px; }
    .preview img { width: 100%; max-height: 260px; object-fit: cover; border-radius: 10px; background: var(--surface2); }
    .preview.grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 5px; }
    .preview.grid img { aspect-ratio: 1/1; max-height: none; border-radius: 8px; }
    .filters { display: flex; flex-wrap: wrap; gap: 6px; margin: 4px 0 12px; }
    .fchip { border: 1px solid var(--border2); background: var(--surface); color: var(--text2);
      border-radius: 999px; padding: 4px 13px; font-size: 12.5px; text-decoration: none; transition: all .12s; }
    .fchip:hover { border-color: var(--accent); color: var(--accent); }
    .empty { text-align: center; padding: 28px 16px !important; }
    .empty-text { color: var(--text3); font-size: 14px; margin-bottom: 10px; }
    .pager { display: flex; gap: 8px; justify-content: center; margin: 18px 0 4px; }
    .pager button { border: 1px solid var(--border2); background: var(--surface); color: var(--text2);
      border-radius: 10px; padding: 8px 22px; font-size: 14px; cursor: pointer; transition: all .12s; }
    .pager button:hover { border-color: var(--accent); color: var(--accent); }
    .pager button:disabled { opacity: .4; cursor: default; }
    .hint { text-align: center; color: var(--text3); font-size: 12px; margin-top: 6px; }
    .statsbar { text-align: center; color: var(--text3); font-size: 13px; padding: 8px 0 0; letter-spacing: .3px; }

    /* 侧栏/右栏激活时顶栏让位（boot 加 sb-shift/rt-shift 类）；
       右栏实际占位 = 264 宽 + 14 右边距 = 278（2026-10-08 修正：原 220 不足，
       1400-1560 视口下右栏压住内容列；断点与 theme.css/rightrail.js 三处同步） */
    :host(.sb-shift) .topbar { left: 212px; }
    @media (max-width: 1023px) { :host(.sb-shift) .topbar { left: 0; } }
    :host(.rt-shift) .topbar { right: 278px; }
    @media (max-width: 1559px) { :host(.rt-shift) .topbar { right: 0; } }
  `;

  // ---------- 帖子页样式（v1.15 令牌化） ----------
  const CSS = `
    :host {
      all: initial;
      font-family: system-ui, "Segoe UI", "Microsoft YaHei", sans-serif;
      --surface: #ffffff; --surface2: #f1efee;
      --border: rgba(0,0,0,.08); --border2: rgba(0,0,0,.14);
      --text: #1c1917; --text2: #57534e; --text3: #a8a29e;
      --accent: #b01f28; --radius: 14px;
    }
    :host(.dark) {
      --surface: #1a1b1e; --surface2: #222329;
      --border: #27282d; --border2: #34353b;
      --text: #e7e5e4; --text2: #a8a29e; --text3: #78716c;
      --accent: #ff6b7a;
    }
    * { box-sizing: border-box; }
    .wrap { max-width: 1040px; margin: 0 auto; padding: 60px 20px 32px; }
    .topbar {
      position: fixed; top: 0; left: 0; right: 0; z-index: 50;
      background: color-mix(in srgb, var(--surface) 88%, transparent);
      backdrop-filter: blur(12px); border-bottom: 1px solid var(--border); color: var(--text);
    }
    .tb-in { max-width: 1040px; margin: 0 auto; display: flex; align-items: center;
      gap: 10px; padding: 11px 20px; font-size: 15px; font-weight: 600; }
    .topbar a { color: inherit; text-decoration: none; }
    .topbar .title { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .topbar .title:hover { color: var(--accent); }
    .topbar .page { color: var(--text3); font-size: 13px; font-weight: 400; flex: none; }
    .card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);
      margin: 10px 0; padding: 14px 18px; box-shadow: 0 1px 2px rgba(0,0,0,.03); }
    .card.op { border-color: color-mix(in srgb, var(--accent) 45%, var(--border)); }
    .tools { display: flex; gap: 8px; margin: 12px 0; align-items: center; }
    .tools .chip { border: 1px solid var(--border2); background: var(--surface); color: var(--text2);
      border-radius: 999px; padding: 4px 14px; font-size: 12.5px; cursor: pointer; }
    .tools .chip:hover, .tools .chip.on { border-color: var(--accent); color: var(--accent); }
    .tools .jump { width: 64px; border: 1px solid var(--border2); background: var(--surface); color: var(--text2);
      border-radius: 999px; padding: 4px 12px; font-size: 12.5px; }
    .reply-main { display: flex; justify-content: center; margin: 18px 0 4px; }
    .pager { display: flex; gap: 8px; justify-content: center; margin: 18px 0 4px; }
    .pager button { border: 1px solid var(--border2); background: var(--surface); color: var(--text2);
      border-radius: 10px; padding: 8px 22px; font-size: 14px; cursor: pointer; }
    .pager button:hover { border-color: var(--accent); color: var(--accent); }
    .pager button:disabled { opacity: .4; cursor: default; }
    .hint { text-align: center; color: var(--text3); font-size: 12px; margin-top: 6px; }

    /* 楼层内容（FLOOR_CSS 的 .fcard 之外，正文与引用折叠） */
    .head { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
    .avatar { width: 34px; height: 34px; border-radius: 50%; object-fit: cover; background: var(--surface2); flex: none; }
    .avatar-fallback { width: 34px; height: 34px; border-radius: 50%; background: var(--surface2); color: var(--text2);
      display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 14px; flex: none; }
    .author { font-weight: 600; color: var(--text); text-decoration: none; }
    .author:hover { color: var(--accent); }
    .meta { color: var(--text3); font-size: 12px; }
    .floor { margin-left: auto; color: var(--text3); font-size: 12.5px; flex: none; }
    .body { font-size: 15.5px; line-height: 1.75; color: var(--text); word-break: break-word; }
    .body img { max-width: 100%; height: auto; border-radius: 10px; margin: 4px 0; background: var(--surface2); }
    .body a { color: var(--accent); }
    .body blockquote, .body .quote { background: var(--surface2); border-left: 3px solid var(--border2);
      border-radius: 8px; padding: 8px 12px; margin: 6px 0; color: var(--text2);
      max-height: 72px; overflow: hidden; cursor: pointer; position: relative; font-size: 14px; }
    .body blockquote.q-open, .body .quote.q-open { max-height: none; cursor: default; }
    .body blockquote:not(.q-open)::after, .body .quote:not(.q-open)::after {
      content: "展开引用"; position: absolute; right: 10px; bottom: 4px;
      font-size: 11.5px; color: var(--accent); }
    .card.flash { outline: 2px solid var(--accent); outline-offset: -2px; }

    :host(.sb-shift) .topbar { left: 212px; }
    @media (max-width: 1023px) { :host(.sb-shift) .topbar { left: 0; } }
    :host(.rt-shift) .topbar { right: 278px; }
    @media (max-width: 1559px) { :host(.rt-shift) .topbar { right: 0; } }
  `;

  // ---------- DOM 小工具 ----------
  function el(tag, attrs, children) {
    const n = document.createElement(tag);
    if (attrs) for (const [k, v] of Object.entries(attrs)) {
      if (k === 'text') n.textContent = v;
      else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v);
    }
    (children || []).forEach((c) => n.appendChild(c));
    return n;
  }

  // 克隆内容规范化（2026-10-05 用户实机截图定位）：
  // ①移除模板编辑记录（i.pstatus"本帖最后由…编辑"——元数据噪音，与楼层时间戳重复）；
  // ②内联 rem 字号换算为 px：站点内容用移动 rem 方案（.18rem 在 375px 手机=18px，根=100px），
  //   PC 上根字号被 flexible.js 膨胀到数百 px，rem 原样进 Shadow DOM 会爆成巨字（.18rem→72px 实测）。
  //   按"rem×100=设计 px"换算保留作者意图。
  function normalizeCloned(root) {
    if (!root) return;
    try {
      if (root.matches && root.matches('i.pstatus')) { root.remove(); return; }
      root.querySelectorAll('i.pstatus').forEach((n) => n.remove());
      // 含根元素自身（克隆根常带内联 rem 字号，querySelectorAll 不含根）
      const all = [root, ...root.querySelectorAll('*')];
      all.forEach((e) => {
        const st = e.getAttribute && e.getAttribute('style');
        if (!st || st.indexOf('rem') === -1) return;
        e.setAttribute('style', st.replace(/(-?\d*\.?\d+)rem/g, (_, v) => {
          return (Math.round(parseFloat(v) * 1000) / 10) + 'px';
        }));
      });
    } catch (e) { /* 规范化失败不影响主内容 */ }
  }


  function markActive() {
    document.documentElement.classList.add('sdg-redraw-active');
  }

  function hideEl(n) {
    if (!n) return;
    n.style.display = 'none';
    n.setAttribute('data-sdg-hidden', '1');
  }

  function hideTrailingSiblings(host) {
    let n = host.nextElementSibling;
    while (n) {
      const next = n.nextElementSibling;
      hideEl(n);
      n = next;
    }
  }

  function wireLightbox(shadowRoot) {
    shadowRoot.addEventListener('click', (ev) => {
      const img = ev.target.closest && ev.target.closest('img');
      if (!img || !img.src || img.classList.contains('icon') || img.classList.contains('avatar')) return;
      ev.preventDefault();
      const lb = el('div', {
        style: 'position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.88);display:flex;align-items:center;justify-content:center;cursor:zoom-out',
        onclick: (e) => e.currentTarget.remove(),
      }, [el('img', { src: img.src, style: 'max-width:96vw;max-height:96vh;border-radius:4px;' })]);
      document.body.appendChild(lb);
    });
  }

  // ---------- 挂载/卸载 ----------
  function unmount() {
    for (const id of ['sdg-redraw-host', 'sdg-redraw-list', 'sdg-sidebar', 'sdg-rail']) {
      const host = document.getElementById(id);
      if (host) host.remove();
    }
    document.documentElement.classList.remove('sdg-redraw-active');
    document.documentElement.classList.remove('sdg-sb-on'); // 侧栏布局标记
    document.documentElement.classList.remove('sdg-rt-on'); // 右栏布局标记
    document.querySelectorAll('style.sdg-sb-style, style.sdg-rt-style').forEach((s) => s.remove());
    // 恢复挂载期间隐藏的一切（含简易容器/兄弟节点/legacy 列表）
    document.querySelectorAll('[data-sdg-hidden]').forEach((n) => {
      n.style.display = '';
      n.removeAttribute('data-sdg-hidden');
    });
    const c = document.querySelector('.postlist');
    if (c) c.style.display = '';
    const l = document.querySelector('ul.byg_threadlist_ul');
    if (l) l.style.display = '';
  }

  // ---------- 结构性 DOM 辅助（引用 SDG.util 选择器串） ----------
  const util = {
    contentAnchor() {
      return document.querySelector(SDG.util.contentAnchor) || document.body;
    },
    boardName() {
      const hf = document.querySelector(SDG.util.boardHeaderFont);
      if (hf) return (hf.textContent || '').trim();
      const crumb = [...document.querySelectorAll('a,div,span')]
        .map((n) => (n.textContent || '').trim())
        .find((t) => new RegExp(SDG.util.boardBreadcrumb).test(t));
      const m = crumb ? crumb.match(new RegExp(SDG.util.boardBreadcrumb)) : null;
      return m ? m[1].trim()
        : ((document.title || '').split('-')[0].replace(/SDGun/i, '').trim() || '版块');
    },
    pagerAnchor(kind) {
      // 站方禁用态 = <a href="javascript:;" class="grey">上一页</a>（实测 fid=190 第 1 页）：
      // 只认真实 href，否则会构造出点了没反应的死按钮，并让顶部分页在首页误现（2026-10-08）
      const isReal = (a) => {
        const h = (a && a.getAttribute('href')) || '';
        return !!h && h.indexOf('javascript:') !== 0;
      };
      const byClass = document.querySelector(kind === 'next' ? SDG.util.pagerNextByClass
        : SDG.util.pagerPrevByClass);
      if (byClass && isReal(byClass)) return byClass;
      const text = kind === 'next' ? SDG.util.pagerNextByText : SDG.util.pagerPrevByText;
      return [...document.querySelectorAll('a')]
        .find((a) => (a.textContent || '').trim() === text && isReal(a)) || null;
    },
    collectFilters() {
      const out = [];
      document.querySelectorAll(SDG.util.filterLinks).forEach((a) => {
        const label = (a.textContent || '').trim();
        const href = a.getAttribute('href');
        if (label && label.length <= 8 && href && !out.some((f) => f.label === label)) {
          out.push({ label, href });
        }
      });
      return out;
    },
    threadContainer() {
      const firstA = document.querySelector(SDG.util.viewthreadAnchor);
      return firstA ? (firstA.closest('ul') || firstA.closest('div')) : null;
    },
    hideScaffold(variant) {
      const groups = SDG.scaffold || {};
      const list = groups[variant] || groups.standard || [];
      list.forEach((sel) => document.querySelectorAll(sel).forEach(hideEl));
    },
    // 空壳判定（2026-10-04 全页覆盖，按页型）：脚手架在场 + 该页型内容签名缺失 = 服务器壳响应。
    // 按页型隔离签名——m1 帖子页的 div.bm 里也有 forumdisplay 面包屑，全局 OR 链会误判（单测抓出）。
    // kind: 'forumlist' | 'forumdisplay' | 'viewthread'
    // 相对时间：'2026-7-23' / '2026-7-23 17:26' → 刚刚/N分钟前/N小时前/昨天/M-d/往年年-月-日
    toRelative(dateStr) {
      if (!dateStr) return '';
      const m = String(dateStr).match(/(\d{4})-(\d{1,2})-(\d{1,2})(?:\s+(\d{1,2}):(\d{2}))?/);
      if (!m) return String(dateStr).trim();
      const d = new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0));
      const diff = Date.now() - d.getTime();
      if (diff < 0 || isNaN(diff)) return String(dateStr).trim();
      const MIN = 6e4, HOUR = 36e5, DAY = 864e5;
      if (diff < MIN) return '刚刚';
      if (diff < HOUR) return Math.floor(diff / MIN) + ' 分钟前';
      if (diff < DAY) return Math.floor(diff / HOUR) + ' 小时前';
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      if (d >= new Date(today.getTime() - DAY)) return '昨天';
      if (d >= new Date(today.getTime() - 6 * DAY)) return (m[2] | 0) + '-' + (m[3] | 0);
      if (+m[1] === now.getFullYear()) return (m[2] | 0) + '-' + (m[3] | 0);
      return m[1] + '-' + (m[2] | 0) + '-' + (m[3] | 0);
    },
    looksEmpty(kind) {
      if (!document.querySelector('.hd, .ft, .footer')) return false; // 结构都不在：非壳（错误页另管）
      if (kind === 'forumlist') {
        return !document.querySelector('.sub_forum a[href*="forumdisplay"], div.bm a[href*="mod=forumdisplay"]');
      }
      if (kind === 'forumdisplay') {
        return !document.querySelector('a[href*="mod=viewthread"], a[href*="tid="]');
      }
      if (kind === 'viewthread') {
        return !document.querySelector('[id^="postmessage_"], div[id^="pid"]');
      }
      return false;
    },
  };

  window.SDGRedrawBase = {
    LIST_CSS, CSS, el, markActive, hideEl, hideTrailingSiblings,
    wireLightbox, unmount, util, normalizeCloned,
  };
  // unmount 挂到主命名空间（boot.js 的开关切换调用 window.SDGRedraw.unmount）
  window.SDGRedraw = window.SDGRedraw || {};
  window.SDGRedraw.unmount = unmount;
})();
