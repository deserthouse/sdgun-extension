// redraw/base.js — 共享样式、DOM 工具、挂载/卸载基础设施。
// 所有重绘模块（viewthread/forumdisplay/forumlist）经由 window.SDGRedrawBase 引用。
(function () {
  'use strict';

  // ---------- 列表页样式（forumdisplay + forumlist 共用） ----------
  const LIST_CSS = `
    :host { all: initial; font-family: system-ui, "Segoe UI", "Microsoft YaHei", sans-serif; }
    * { box-sizing: border-box; }
    .wrap { max-width: 860px; margin: 0 auto; padding: 56px 0 32px; }
    .topbar {
      position: fixed; top: 0; left: 0; right: 0; z-index: 50;
      background: rgba(250,250,250,.92); backdrop-filter: blur(10px);
      border-bottom: 1px solid rgba(0,0,0,.08); color: #1c1917;
      display: flex; align-items: center; padding: 10px 18px; font-size: 15px; font-weight: 600;
    }
    .topbar a { color: inherit; text-decoration: none; }
    .card { background:#fff; border:1px solid rgba(0,0,0,.08); border-radius:12px;
      margin: 10px 0; overflow:hidden; box-shadow: 0 1px 3px rgba(0,0,0,.04); }
    .group-title { font-weight:700; font-size:16px; color:#1c1917; margin: 16px 2px 6px; }
    .section-row { display:flex; align-items:center; gap:12px; padding: 12px 16px;
      border-bottom: 1px solid rgba(0,0,0,.06); color:#292524; text-decoration:none; }
    .section-row:last-child { border-bottom: 0; }
    .section-row:hover { background:#fafaf9; }
    .icon { width: 40px; height: 40px; border-radius: 8px; object-fit: cover; flex:none; background:#f5f5f4; }
    .s-name { display:flex; flex-direction:column; gap:2px; font-size:15px; font-weight:500; }
    .s-name .meta { color:#a8a29e; font-size:12px; font-weight:400; }
    .head { display:flex; align-items:center; gap:10px; }
    .head .title { font-size:15.5px; font-weight:600; color:#1c1917; text-decoration:none;
      flex:1; line-height:1.45; }
    .head .title:hover { color:#b01f28; }
    .meta-row { display:flex; gap:14px; align-items:center; margin-top:8px; font-size:12.5px; }
    .meta-row .author { color:#57534e; text-decoration:none; }
    .meta-row .author:hover { color:#b01f28; }
    .meta-row .meta { color:#a8a29e; }
    .meta-row .stat { margin-left:auto; color:#a8a29e; flex:none; }
    .meta-row .floor { flex:none; }
    .preview { margin-top:10px; }
    .preview img { width:100%; max-height:230px; object-fit:cover; border-radius:8px; background:#f5f5f4; }
    .preview.grid { display:grid; grid-template-columns:repeat(3, 1fr); gap:4px; }
    .preview.grid img { aspect-ratio:1/1; max-height:none; border-radius:6px; }
    .filters { display:flex; flex-wrap:wrap; gap:6px; margin: 4px 0 12px; }
    .fchip { border:1px solid rgba(0,0,0,.12); background:#fff; color:#57534e;
      border-radius:12px; padding:3px 11px; font-size:12.5px; text-decoration:none; }
    .fchip:hover { border-color:#b01f28; color:#b01f28; }
    .empty { text-align:center; padding: 28px 16px !important; }
    .empty-text { color:#78716c; font-size:14px; margin-bottom:10px; }
    .pager { display:flex; gap:8px; justify-content:center; margin:18px 0 4px; }
    .pager button { border:1px solid rgba(0,0,0,.12); background:#fff; color:#44403c;
      border-radius:8px; padding:8px 18px; font-size:14px; cursor:pointer; }
    .pager button:hover { border-color:#b01f28; color:#b01f28; }
    .pager button:disabled { opacity:.4; cursor:default; }
    .hint { text-align:center; color:#a8a29e; font-size:12px; margin-top:6px; }

    :host(.dark) .topbar { background: rgba(17,18,20,.92); border-color:#2c2d31; color:#e7e5e4; }
    :host(.dark) .card { background:#1a1b1e; border-color:#2c2d31; box-shadow:none; }
    :host(.dark) .group-title { color:#eceae8; }
    :host(.dark) .section-row { border-color:#2c2d31; color:#d6d3d1; }
    :host(.dark) .section-row:hover { background:#1e1f23; }
    :host(.dark) .icon { background:#232326; }
    :host(.dark) .s-name { color:#d6d3d1; }
    :host(.dark) .head .title { color:#e7e5e4; }
    :host(.dark) .head .title:hover { color:#ff6b7a; }
    :host(.dark) .meta-row .author { color:#a8a29e; }
    :host(.dark) .meta-row .author:hover { color:#ff6b7a; }
    :host(.dark) .meta-row .stat { color:#78716c; }
    :host(.dark) .preview img { background:#232326; }
    :host(.dark) .preview.grid img { background:#2a2b30; }
    :host(.dark) .pager button { background:#1c1d21; border-color:#3a3b40; color:#d6d3d1; }
    :host(.dark) .pager button:hover { border-color:#ff6b7a; color:#ff6b7a; }
    :host(.dark) .filters .fchip { background:#1c1d21; border-color:#3a3b40; color:#a8a29e; }
    :host(.dark) .filters .fchip:hover { border-color:#ff6b7a; color:#ff6b7a; }
    :host(.dark) .empty-text { color:#78716c; }
    /* 视觉审计修复：侧栏/右栏激活时顶栏让位（boot 加 sb-shift/rt-shift 类） */
    :host(.sb-shift) .topbar { left: 212px; }
    @media (max-width: 1023px) { :host(.sb-shift) .topbar { left: 0; } }
    :host(.rt-shift) .topbar { right: 216px; }
    @media (max-width: 1279px) { :host(.rt-shift) .topbar { right: 0; } }
  `;

  // ---------- 帖子页样式 ----------
  const CSS = `
    :host { all: initial; font-family: system-ui, "Segoe UI", "Microsoft YaHei", sans-serif; }
    * { box-sizing: border-box; }
    .wrap { max-width: 860px; margin: 0 auto; padding: 56px 0 32px; }
    .topbar {
      position: fixed; top: 0; left: 0; right: 0; z-index: 50;
      background: rgba(250, 250, 250, .92); backdrop-filter: blur(10px);
      border-bottom: 1px solid rgba(0,0,0,.08);
      color: #1c1917; display: flex; align-items: center; gap: 12px;
      padding: 10px 18px; font-size: 14px;
    }
    .topbar .title { font-weight: 600; flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: inherit; text-decoration: none; }
    .topbar .page { color: #78716c; font-size: 12px; flex: none; }
    .card {
      background: #fff; border: 1px solid rgba(0,0,0,.08); border-radius: 12px;
      margin: 10px 0; padding: 14px 18px;
      box-shadow: 0 1px 3px rgba(0,0,0,.04);
    }
    .card.op { border-color: rgba(176,31,40,.45); }
    .head { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
    .avatar { width: 34px; height: 34px; border-radius: 50%; object-fit: cover; background: #e7e5e4; flex: none; }
    .avatar-fallback { width: 34px; height: 34px; border-radius: 50%; background: #d6d3d1; color:#57534e;
      display:flex; align-items:center; justify-content:center; font-size:15px; font-weight:600; flex:none; }
    .author { font-weight: 600; color: #1c1917; text-decoration: none; }
    .author:hover { color: #b01f28; }
    .meta { color: #a8a29e; font-size: 12px; }
    .floor { margin-left: auto; color: #a8a29e; font-size: 12px; flex: none; }
    .body { font-size: 15px; line-height: 1.75; color: #292524; word-break: break-word; }
    .body img { max-width: 100%; height: auto; border-radius: 8px; margin: 4px 0; background:#f5f5f4; }
    .body blockquote, .body .quote {
      border-left: 3px solid #d6d3d1; background: #fafaf9; margin: 8px 0;
      padding: 8px 12px; border-radius: 0 8px 8px 0; color: #57534e; font-size: 14px;
    }
    .body a { color: #b01f28; }
    .body blockquote, .body .quote {
      max-height: 72px; overflow: hidden; cursor: pointer; position: relative;
    }
    .body blockquote.q-open, .body .quote.q-open { max-height: none; cursor: default; }
    .body blockquote:not(.q-open)::after, .body .quote:not(.q-open)::after {
      content: "…展开引用"; position: absolute; right: 8px; bottom: 4px;
      font-size: 11px; color: #b01f28;
    }
    /* 嵌套引用只在最外层显示角标 */
    .body .quote .quote::after, .body blockquote blockquote::after,
    .body .quote blockquote::after, .body blockquote .quote::after {
      display: none !important;
    }
    :host(.dark) .body blockquote:not(.q-open)::after,
    :host(.dark) .body .quote:not(.q-open)::after { color: #ff6b7a; }
    .pager {
      display: flex; gap: 8px; justify-content: center; margin: 18px 0 4px;
    }
    .pager button {
      border: 1px solid rgba(0,0,0,.12); background: #fff; color: #44403c;
      border-radius: 8px; padding: 8px 18px; font-size: 14px; cursor: pointer;
    }
    .pager button:hover { border-color: #b01f28; color: #b01f28; }
    .pager button:disabled { opacity: .4; cursor: default; }
    .hint { text-align: center; color: #a8a29e; font-size: 12px; margin-top: 6px; }
    .tools { display: flex; gap: 8px; align-items: center; margin: 4px 0 10px; }
    .tools .chip { border: 1px solid rgba(0,0,0,.12); background: #fff; color: #44403c;
      border-radius: 14px; padding: 4px 12px; font-size: 12.5px; cursor: pointer; }
    .tools .chip:hover { border-color: #b01f28; color: #b01f28; }
    .tools .chip.on { background: #b01f28; border-color: #b01f28; color: #fff; }
    .tools .jump { width: 64px; border: 1px solid rgba(0,0,0,.12); border-radius: 14px;
      padding: 4px 10px; font-size: 12.5px; background: #fff; color: #292524; }
    .head .reply { margin-left: 6px; font-size: 12px; color: #a8a29e; text-decoration: none; flex: none; }
    .head .reply:hover { color: #b01f28; }
    .card.flash { outline: 2px solid #b01f28; outline-offset: -2px; }
    :host(.dark) .tools .chip { background: #1c1d21; border-color:#3a3b40; color:#d6d3d1; }
    :host(.dark) .tools .chip:hover { border-color:#ff6b7a; color:#ff6b7a; }
    :host(.dark) .tools .chip.on { background:#b01f28; border-color:#b01f28; color:#fff; }
    :host(.dark) .tools .jump { background:#1c1d21; border-color:#3a3b40; color:#d6d3d1; }
    :host(.dark) .head .reply { color:#78716c; }
    :host(.dark) .head .reply:hover { color:#ff6b7a; }
    :host(.dark) .card.flash { outline-color: #ff6b7a; }

    /* dark */
    :host(.dark) .topbar { background: rgba(17,18,20,.92); border-color: #2c2d31; color: #e7e5e4; }
    :host(.dark) .card { background: #1a1b1e; border-color: #2c2d31; box-shadow: none; }
    :host(.dark) .card.op { border-color: #b01f28; }
    :host(.dark) .author { color: #e7e5e4; }
    :host(.dark) .author:hover { color: #ff6b7a; }
    :host(.dark) .avatar-fallback { background:#2c2d31; color:#a8a29e; }
    :host(.dark) .body { color: #d6d3d1; }
    :host(.dark) .body img { background: #232326; }
    :host(.dark) .body blockquote, :host(.dark) .body .quote { background: #232326; border-color:#3f3f46; color:#a8a29e; }
    :host(.dark) .body a { color: #ff6b7a; }
    :host(.dark) .pager button { background: #1c1d21; border-color:#3a3b40; color:#d6d3d1; }
    :host(.dark) .pager button:hover { border-color:#ff6b7a; color:#ff6b7a; }
    :host(.sb-shift) .topbar { left: 212px; }
    @media (max-width: 1023px) { :host(.sb-shift) .topbar { left: 0; } }
    :host(.rt-shift) .topbar { right: 216px; }
    @media (max-width: 1279px) { :host(.rt-shift) .topbar { right: 0; } }
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
      const byClass = document.querySelector(kind === 'next' ? SDG.util.pagerNextByClass
        : SDG.util.pagerPrevByClass);
      if (byClass) return byClass;
      const text = kind === 'next' ? SDG.util.pagerNextByText : SDG.util.pagerPrevByText;
      return [...document.querySelectorAll('a')].find((a) => (a.textContent || '').trim() === text);
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
