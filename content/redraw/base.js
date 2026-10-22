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
      --text: #1c1917; --text2: #57534e; --text3: #78716c; /* E-14: 4.80:1（原 a8a29e 2.52:1） */
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
    /* E-12：窄屏（侧栏隐藏）时顶栏最小导航入口——宽屏由侧栏承担 */
    .topbar .qk { display: none; align-items: center; gap: 2px; flex: none;
      color: var(--text2); text-decoration: none; font-size: 13px; font-weight: 500;
      padding: 4px 8px; border-radius: 8px; }
    .topbar .qk:hover { background: var(--surface2); color: var(--accent); }
    @media (max-width: 1023px) { .topbar .qk { display: inline-flex; } }

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
    .glabel { font-size: 11.5px; font-weight: 600; color: var(--text3); padding: 6px 2px; letter-spacing: .5px; }
    .fchip { border: 1px solid var(--border2); background: var(--surface); color: var(--text2);
      border-radius: 999px; padding: 6px 14px; font-size: 12.5px; text-decoration: none; transition: all .12s; }
    .fchip:hover { border-color: var(--accent); color: var(--accent); }
    .fchip.on { border-color: var(--accent); color: var(--accent);
      background: color-mix(in srgb, var(--accent) 8%, transparent); font-weight: 600; }
    .empty { text-align: center; padding: 28px 16px !important; }
    .empty-text { color: var(--text3); font-size: 14px; margin-bottom: 10px; }
    .pager { display: flex; gap: 8px; justify-content: center; margin: 18px 0 4px; }
    .pager button { border: 1px solid var(--border2); background: var(--surface); color: var(--text2);
      border-radius: 10px; padding: 9px 24px; font-size: 14px; cursor: pointer; transition: all .12s; }
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
      --text: #1c1917; --text2: #57534e; --text3: #78716c; /* E-14: 4.80:1（原 a8a29e 2.52:1） */
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
    /* E-12：窄屏（侧栏隐藏）时顶栏最小导航入口——宽屏由侧栏承担 */
    .topbar .qk { display: none; align-items: center; gap: 2px; flex: none;
      color: var(--text2); text-decoration: none; font-size: 13px; font-weight: 500;
      padding: 4px 8px; border-radius: 8px; }
    .topbar .qk:hover { background: var(--surface2); color: var(--accent); }
    @media (max-width: 1023px) { .topbar .qk { display: inline-flex; } }

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
    .body { font-size: 16px; line-height: 1.75; color: var(--text); word-break: break-word; }
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
    // E-13（部分，v1.18.4）：保存原 inline display，unmount 恢复原值——不破坏既有内联样式
    if (!n.hasAttribute('data-sdg-hidden')) {
      n.setAttribute('data-sdg-prev-display', n.style.display || '');
    }
    n.style.display = 'none';
    n.setAttribute('data-sdg-hidden', '1');
  }

  function hideTrailingSiblings(host) {
    // E-13（v1.19.0）白名单化：仅隐藏匹配已知脚手架的兄弟节点——
    // 无限范围隐藏会吞掉未知站方模块（操作入口等），宁可漏藏（双内容可见即发现）不可错杀
    let n = host.nextElementSibling;
    const groups = (window.SDG && SDG.scaffold) || {};
    const selectors = [].concat(...Object.values(groups).map((arr) => arr || []));
    const hidden = []; // R14/EV-08：收集实际隐藏节点
    const match = (el) => {
      try { return selectors.some((sel) => el.matches(sel)); } catch (e) { return false; }
    };
    while (n) {
      const next = n.nextElementSibling;
      if (match(n) || !n.id) { hideEl(n); hidden.push(n); } // 无 id 的结构性节点仍隐藏；带 id 的未知模块放过
      n = next;
    }
    return hidden; // R14/EV-08：返回实际隐藏节点
  }

  // R14/EV-08：按节点清单精确恢复隐藏（挂载事务逆操作；只动带本层标记的节点）
  function restoreHidden(nodes) {
    (nodes || []).forEach((n) => {
      try {
        if (n && n.hasAttribute && n.hasAttribute('data-sdg-hidden')) {
          n.style.display = n.getAttribute('data-sdg-prev-display') || '';
          n.removeAttribute('data-sdg-prev-display');
          n.removeAttribute('data-sdg-hidden');
        }
      } catch (e) { /* 单节点恢复失败不阻断 */ }
    });
  }

  // ---------- 灯箱（v1.18.2 E-01 重写）：单例、白名单类、键盘/焦点/滚动锁 ----------
  // E-01 教训：普通 body 子节点会被 theme.css 重绘隐藏规则（body>*:not(.sdg-host)）
  // display:none 压制——overlay 必须带 .sdg-host 白名单类。
  let lightboxState = null; // { overlay, prevFocus, cleanup }

  function closeLightbox() {
    if (!lightboxState) return;
    const { overlay, img, prevFocus, cleanup } = lightboxState;
    lightboxState = null;
    try { document.removeEventListener('keydown', onLightboxKey, true); } catch (e) { /* */ }
    try { if (img) img.src = ''; } catch (e) { /* */ } // R12/EV-07：关闭即中断在途原图加载
    try {
      document.documentElement.style.overflow = overlay.dataset.sdgPrevOverflow || '';
    } catch (e) { /* */ }
    try { overlay.remove(); } catch (e) { /* */ }
    try { if (prevFocus && prevFocus.focus) prevFocus.focus(); } catch (e) { /* */ }
    void cleanup;
  }

  function onLightboxKey(ev) {
    if (!lightboxState) return;
    if (ev.key === 'Escape' || ev.key === 'Esc') {
      ev.preventDefault();
      ev.stopPropagation();
      closeLightbox();
      return;
    }
    if (lightboxState.onKey) lightboxState.onKey(ev); // EF-04：←/→ 图组翻页
  }

  function openLightbox(src, alt, gallery, startIdx) {
    closeLightbox(); // 单例
    const prevFocus = document.activeElement;
    const overlay = el('div', {
      class: 'sdg-host sdg-lightbox',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-label': alt || '图片查看',
    });
    const prevOverflow = document.documentElement.style.overflow;
    overlay.dataset.sdgPrevOverflow = prevOverflow;
    document.documentElement.style.overflow = 'hidden'; // 滚动锁（卸载恢复）
    const img = el('img', {
      src,
      alt: alt || '',
      style: 'max-width:96vw;max-height:96vh;border-radius:4px;display:block;',
    });
    // R12/EV-07：原图加载失败可见可重试（src 因 data-orig 可能与列表缩略不同源，失败须有出口）
    let currentSrc = src;
    const errBox = el('div', {
      text: '原图加载失败 · 点击重试',
      style: 'position:absolute;inset:0;display:none;align-items:center;justify-content:center;'
        + 'color:#fff;font:14px/1.6 system-ui,sans-serif;background:rgba(0,0,0,.55);cursor:pointer;',
    });
    errBox.addEventListener('click', (e) => {
      e.stopPropagation();
      errBox.style.display = 'none';
      // 重试：先摘 src 再赋值——同值赋 src 不触发重新加载（实测 complete=true/nw=0 原地不动）
      img.removeAttribute('src');
      img.src = currentSrc;
    });
    img.addEventListener('error', () => { errBox.style.display = 'flex'; });
    img.addEventListener('load', () => { errBox.style.display = 'none'; });
    // EF-04（v1.19.2）+ ER-08（v1.19.7）：图组模式；打开即按被点图索引初始化
    // （src 与计数同步——此前恒从 0 开始，点第二张显示第二图却标 1/20）
    let idx = Math.max(0, Math.min(startIdx || 0, (gallery ? gallery.length : 1) - 1));
    const list = Array.isArray(gallery) && gallery.length > 1 ? gallery : null;
    const counter = el('div', {
      text: list ? `${idx + 1} / ${list.length}` : '',
      style: 'position:absolute;bottom:16px;left:50%;transform:translateX(-50%);'
        + 'color:#fff;font:13px/1.4 system-ui,sans-serif;background:rgba(0,0,0,.5);'
        + 'border-radius:999px;padding:4px 14px;',
    });
    const show = (i) => {
      if (!list) return;
      idx = (i + list.length) % list.length;
      currentSrc = list[idx];
      img.src = currentSrc;
      counter.textContent = `${idx + 1} / ${list.length}`;
    };
    const navBtn = (text, dir) => {
      const b = el('button', {
        text,
        'aria-label': dir < 0 ? '上一张' : '下一张',
        style: 'position:absolute;top:50%;transform:translateY(-50%);border:0;border-radius:50%;'
          + 'width:46px;height:46px;background:rgba(255,255,255,.14);color:#fff;font-size:20px;'
          + 'cursor:pointer;' + (dir < 0 ? 'left:16px;' : 'right:16px;'),
      });
      b.addEventListener('click', (e) => { e.stopPropagation(); show(idx + dir); });
      return b;
    };
    const closeBtn = el('button', {
      text: '✕',
      'aria-label': '关闭',
      style: 'position:absolute;top:14px;right:18px;z-index:2;border:0;border-radius:50%;'
        + 'width:40px;height:40px;background:rgba(255,255,255,.14);color:#fff;font-size:18px;'
        + 'cursor:pointer;line-height:1;',
    });
    closeBtn.addEventListener('click', (e) => { e.stopPropagation(); closeLightbox(); });
    overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.88);'
      + 'display:flex;align-items:center;justify-content:center;cursor:zoom-out;';
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeLightbox();
    });
    overlay.appendChild(img);
    overlay.appendChild(errBox);
    overlay.appendChild(closeBtn);
    if (list) {
      overlay.appendChild(navBtn('‹', -1));
      overlay.appendChild(navBtn('›', 1));
      overlay.appendChild(counter);
    }
    document.body.appendChild(overlay);
    closeBtn.focus();
    document.addEventListener('keydown', onLightboxKey, true);
    lightboxState = {
      overlay, img, prevFocus, cleanup: null,
      onKey: (ev) => {
        if (!list) return;
        if (ev.key === 'ArrowLeft') { ev.preventDefault(); show(idx - 1); }
        else if (ev.key === 'ArrowRight') { ev.preventDefault(); show(idx + 1); }
      },
    };
  }

  function wireLightbox(shadowRoot) {
    // capture 阶段：站方图片锚点带内联 doane(event)（preventDefault+stopPropagation）
    // 在目标阶段掐死冒泡——bubble 监听收不到。排除：头像（导航/占位）、图标、
    // 热帖卡缩略图（在 <a> 内应导航）；列表行 .thumb 无链接，允许进灯箱。
    shadowRoot.addEventListener('click', (ev) => {
      const img = ev.target.closest && ev.target.closest('img');
      if (!img || !img.src || img.classList.contains('icon') || img.classList.contains('avatar')
          || img.classList.contains('hthumb')) return;
      ev.preventDefault();
      ev.stopPropagation();
      // EF-04：同容器内的内容图组成相册（排除头像/图标/骨架；列表行 thumb 不入组）
      const scopeImgs = [img.closest('.body') || img.closest('.fmain') || img.getRootNode()]
        .flatMap((root) => (root ? [...root.querySelectorAll('.body img')] : []))
        .filter((im) => im.src && !im.classList.contains('avatar') && !im.classList.contains('icon'));
      // R12/EV-07：原图优先——API 升级行的缩略带 data-orig（列表只加载 240 小图，原图按需）
      const origOf = (im) => im.dataset.orig || im.src;
      const gallery = scopeImgs.length > 1 ? scopeImgs.map(origOf) : null;
      // ER-08（v1.19.7）：startIdx 按被点图在组内的实际位置（点第二张开=2/20，不再恒 1/20）
      const startIdx = gallery ? Math.max(0, scopeImgs.indexOf(img)) : 0;
      openLightbox(origOf(img), img.alt, gallery, startIdx);
    }, true);
  }

  // ---------- 站方操作链接收集（E-13/EF-05 前置：只收集不展示） ----------
  function collectActionLinks(rootDoc) {
    const out = {};
    const patterns = {
      reply: 'a[href*="action=reply"]',
      newThread: 'a[href*="mod=post"][href*="action=newthread"]',
      fav: 'a[href*="action=fav"], a[href*="favthread"]',
      share: 'a[href*="mod=misc"][href*="action=share"]',
    };
    for (const [k, sel] of Object.entries(patterns)) {
      try {
        const a = rootDoc.querySelector(sel);
        if (a) out[k] = a.getAttribute('href');
      } catch (e) { /* ignore */ }
    }
    try { window.SDGRedraw.actionLinks = out; } catch (e) { /* ignore */ }
    return out;
  }

  // ---------- 挂载/卸载 ----------
  function unmount() {
    closeLightbox(); // E-01：卸载必须关闭灯箱并恢复滚动锁/焦点
    try { if (window.SDGScope) window.SDGScope.cancelAllScopes(); } catch (e) { /* */ } // E-05
    for (const id of ['sdg-redraw-host', 'sdg-redraw-list', 'sdg-sidebar', 'sdg-rail']) {
      const host = document.getElementById(id);
      if (host) host.remove();
    }
    document.documentElement.classList.remove('sdg-redraw-active');
    document.documentElement.classList.remove('sdg-sb-on'); // 侧栏布局标记
    document.documentElement.classList.remove('sdg-rt-on'); // 右栏布局标记
    document.querySelectorAll('style.sdg-sb-style, style.sdg-rt-style').forEach((s) => s.remove());
    // 恢复挂载期间隐藏的一切（E-13：恢复各自原 inline display，而非统一清空）
    document.querySelectorAll('[data-sdg-hidden]').forEach((n) => {
      n.style.display = n.getAttribute('data-sdg-prev-display') || '';
      n.removeAttribute('data-sdg-prev-display');
      n.removeAttribute('data-sdg-hidden');
    });
    // ER-06（v1.19.5）：删除对 .postlist/ul.byg_threadlist_ul 的统一 display='' 覆盖——
    // [data-sdg-hidden] 恢复已按各自原 inline display 处理，统一清空会覆盖刚恢复的原值
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
      const hidden = [];
      list.forEach((sel) => document.querySelectorAll(sel).forEach((n) => { hideEl(n); hidden.push(n); }));
      return hidden; // R14/EV-08：返回实际隐藏节点（挂载事务逆操作按此精确还原）
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
    // EV-06：站方"合法空结果"判别——空板块/零匹配筛选会返回完整模板+明确空提示文本，
    // 不能沿用"无帖子锚点=服务器壳"的单一判据（此前误报"服务器响应不完整"并自动重试，
    // fid=153 热帖筛选实测）。判据从严：脚手架在场 ∧ 站方空提示文本命中 ∧ 无任何帖子锚点；
    // 只凭"列表容器在场+零行"不判合法空（截断壳同样呈现该形态，宁重试不误报空）。
    looksLegitEmpty(kind) {
      if (kind !== 'forumdisplay') return false;
      if (!document.querySelector('.hd, .ft, .footer')) return false;
      const txt = document.body.textContent || '';
      if (!/指定的范围内尚无主题|尚无主题|暂无主题|没有相关主题|本版块或指定的范围内/.test(txt)) return false;
      return !document.querySelector('a[href*="mod=viewthread"], a[href*="tid="]');
    },
  };

  window.SDGRedrawBase = {
    LIST_CSS, CSS, el, markActive, hideEl, hideTrailingSiblings,
    wireLightbox, unmount, util, normalizeCloned,
    openLightbox, closeLightbox, // E-01：单例灯箱（原版页面与重绘层共用）
    collectActionLinks, // EF-05：显式调用（时机由调用方控制，不藏在 markActive）
    restoreHidden, // R14/EV-08：挂载事务逆操作
  };
  // unmount 挂到主命名空间（boot.js 的开关切换调用 window.SDGRedraw.unmount）
  window.SDGRedraw = window.SDGRedraw || {};
  window.SDGRedraw.unmount = unmount;
})();
