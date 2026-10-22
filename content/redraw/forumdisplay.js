// redraw/forumdisplay.js — 帖子列表页重绘（parseThreads + mountForumDisplay）。
// 依赖：redraw/base.js（先加载）。挂载入口挂到 window.SDGRedraw.mountForumDisplay。
// 双 profile：bygsjw 富模板（ul.byg_threadlist_ul）→ 简易模板变体（锚点防御式解析）。
// 渲染：v1.8 起行式列表（PC 密度，layout_blueprint L1）——缩略图+标题+作者时间+右对齐统计，
// 悬停标题浮出预览图；字段缺失逐项降级（服务器多形态，解析产出为准）。
(function () {
  'use strict';
  const B = window.SDGRedrawBase;

  // B 式行卡样式（v1.15 设计系统；令牌继承 base LIST_CSS）
  const ROW_CSS = `
    .rows { margin-top: 4px; }
    /* v1.16.2 密度再收一档（截图评审：无缩略图行中段偏空）——竖距 12→10、行距 8→7；
       裸行维持 v1.13 调定值不动（行距断言针对裸行） */
    .trow { position: relative; display: flex; align-items: center; gap: 14px;
      background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);
      padding: 10px 16px; margin: 7px 0; text-decoration: none;
      transition: background .12s, border-color .12s; }
    .trow:hover { background: var(--surface2); border-color: var(--border2); }
    .trow .thumb { width: 88px; height: 60px; border-radius: 10px; object-fit: cover;
      flex: none; background: var(--surface2); }
    .trow .main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px;
      /* v1.18.0：min-height 与图位等高——行高与摘要/头像有无完全解耦，
         API 升级前后恒定（实测 82px 恒定，修复 API 头像 +5px 撑行） */
      min-height: 60px; justify-content: center; }
    .trow .t { font-size: 16px; font-weight: 600; color: var(--text); text-decoration: none;
      line-height: 1.4; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .trow:hover .t { color: var(--accent); }
    .trow .sub { font-size: 13px; color: var(--text3); display: flex; gap: 12px; min-width: 0; }
    .trow .sub a { color: var(--text2); text-decoration: none; }
    .trow .sub a:hover { color: var(--accent); }
    .trow .sub .d { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    /* v1.17.0 F-1：图文增强的摘要行（enrich.js 后台拉取首楼文字，灰字单行省略）。
       v1.17.3：显式 18px 行盒——与摘要骨架严格同高，杜绝亚像素级行高差 */
    .trow .ex { font-size: 12.5px; color: var(--text3); line-height: 18px;
      min-height: 18px; /* E-零位移：空槽（:empty 行盒塌陷为 0）也保持 18px，行高恒定 */
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    /* v1.17.3 骨架/字块：槽位尺寸与真身严格一致（88×60）；字块=无图帖的永久图位 */
    /* v1.18.0 行内作者头像（16px 与 18px 文本行同高——行高解耦）+ 点赞徽标 */
    .trow .ava { width: 16px; height: 16px; border-radius: 4px; object-fit: cover;
      flex: none; background: var(--surface2); align-self: center; }
    .trow .sub .zap { color: var(--text3); }
    .trow .sub .zap b { color: var(--text2); font-weight: 600; }
    .sdg-skel { background: var(--surface2); animation: sdg-pulse 1.6s ease-in-out infinite; }
    .sdg-skel-thumb { width: 88px; height: 60px; border-radius: 10px; flex: none; }
    .sdg-skel-ex { height: 18px; width: 62%; border-radius: 5px; }
    .sdg-tile { width: 88px; height: 60px; border-radius: 10px; flex: none;
      background: var(--surface2); color: var(--text3); font-weight: 700; font-size: 20px;
      display: flex; align-items: center; justify-content: center; }
    @keyframes sdg-pulse { 0%, 100% { opacity: .5; } 50% { opacity: .95; } }
    .trow .stats { flex: none; text-align: right; font-size: 12.5px; color: var(--text3); line-height: 1.5; }
    .trow .stats b { display: block; font-size: 15px; color: var(--text2); font-weight: 600; }
    .trow .hoverp { display: none; position: absolute; right: 8px; top: calc(100% + 4px); z-index: 60;
      background: var(--surface); border: 1px solid var(--border2); border-radius: 12px; padding: 6px;
      box-shadow: 0 8px 24px rgba(0,0,0,.14); gap: 4px; }
    .trow .hoverp img { width: 150px; height: 100px; object-fit: cover; border-radius: 8px; background: var(--surface2); }
    .trow:hover .hoverp, .trow.hp-pin .hoverp { display: flex; }
    .trow.bare { padding: 9px 18px; margin: 6px 0; }
    .trow.pinned { background: color-mix(in srgb, var(--accent) 5%, var(--surface)); }
    .tline { display: flex; align-items: center; gap: 8px; min-width: 0; }
    .type-badge { flex: none; font-size: 11px; font-weight: 600; color: var(--accent);
      border: 1px solid color-mix(in srgb, var(--accent) 40%, transparent);
      background: color-mix(in srgb, var(--accent) 8%, transparent);
      border-radius: 5px; padding: 1px 7px; letter-spacing: .5px; }
    .pin-badge { flex: none; font-size: 11px; font-weight: 600; color: var(--text3);
      border: 1px solid var(--border2); border-radius: 5px; padding: 1px 7px; }
    .tline .t { flex: 1; min-width: 0; }
    .fchip.srch { margin-left: auto; border-style: dashed; }
    /* 板块头卡 + 子版块卡 */
    .boardhead { display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
      background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);
      padding: 12px 18px; margin: 4px 0 10px; }
    .boardhead .bh-name { font-size: 16px; font-weight: 700; color: var(--text); }
    .boardhead .bh-stat { font-size: 13px; color: var(--text3); }
    .boardhead .bh-stat b { color: var(--text2); font-weight: 600; }
    .boardhead a.bh-fav { margin-left: auto; font-size: 12.5px; font-weight: 600; color: var(--accent);
      text-decoration: none; border: 1px solid color-mix(in srgb, var(--accent) 40%, transparent);
      border-radius: 999px; padding: 4px 14px; }
    .boardhead a.bh-fav:hover { background: var(--accent); color: #fff; }
    .subforums { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);
      padding: 6px 0; margin: 0 0 10px; }
    .subforums .sf-title { font-size: 11.5px; font-weight: 700; color: var(--text3);
      padding: 6px 18px 2px; letter-spacing: .8px; }
    .subforums a.sf-row { display: flex; align-items: center; gap: 10px; padding: 7px 18px;
      color: var(--text2); text-decoration: none; font-size: 14px; }
    .subforums a.sf-row:hover { background: var(--surface2); color: var(--accent); }
    .subforums a.sf-row .sf-name { font-weight: 500; color: var(--text); }
    .subforums a.sf-row .sf-meta { margin-left: auto; font-size: 12.5px; color: var(--text3); }
  `;

  function parseThreads(SDG, root) {
    const F = SDG.forumDisplay;
    const rows = (root || document).querySelectorAll(F.threadRow);
    const threads = [];
    rows.forEach((row) => {
      const t = row.querySelector(F.threadTitle);
      if (!t) return;
      const authorEl = row.querySelector(F.rowAuthor);
      const ems = row.querySelectorAll(F.rowDate);
      const ys = row.querySelectorAll(F.rowStats);
      const previews = [...row.querySelectorAll(F.threadPreview)]
        .map((a) => (a.style && a.style.backgroundImage || '').match(/url\("?([^")]+)"?\)/))
        .filter(Boolean).map((m) => m[1]);
      // 类型徽标与标题清洗：list_typename 是独立子元素（不剥离会把"讨论"粘连进标题）
      const typeEl = row.querySelector(F.rowType);
      const type = typeEl ? (typeEl.textContent || '').trim() : '';
      const pin = !!row.querySelector(F.rowPin);
      let title = t.textContent || '';
      if (type) title = title.replace(type, '');
      title = title.replace(/^(置顶|本版置顶|精华)\s*/, '').trim();
      // 日期取 em.z 中匹配日期模式者（首 em 可能是红色"置顶"标签）
      let date = '';
      ems.forEach((e) => {
        const txt = (e.textContent || '').replace(/\s+/g, ' ').trim();
        if (!date && /\d{4}-\d{1,2}-\d{1,2}/.test(txt)) date = txt;
      });
      threads.push({
        title,
        href: t.getAttribute('href') || '#',
        type,
        pin,
        author: authorEl ? (authorEl.textContent || '').trim() : '',
        authorHref: authorEl ? authorEl.getAttribute('href') : '#',
        date,
        replies: ys.length ? (ys[0].textContent || '').replace(/\D/g, '') : '',
        views: ys.length > 1 ? (ys[1].textContent || '').replace(/\D/g, '') : '',
        preview: previews,
      });
    });
    return threads;
  }

  function mountForumDisplay(SDG, opts) {
    const B = window.SDGRedrawBase;
    const F = SDG.forumDisplay;
    const list = document.querySelector('ul.byg_threadlist_ul');
    let simpleMode = false;
    let legitEmpty = false; // EV-06：站方合法空结果（空板块/零匹配筛选）——渲染空态卡，不进重试链
    let threads = [];
    if (list) {
      threads = parseThreads(SDG);
      if (!threads.length) {
        // P1-2：真骨架（无任何帖子锚点）交给 boot 重试；EV-06：站方明确空提示=合法空，照常挂载空态
        if (B.util.looksLegitEmpty('forumdisplay')) {
          legitEmpty = true;
        } else if (!document.querySelector('a[href*="mod=viewthread"]')) {
          return false;
        }
      }
    } else {
      // 简易模板变体：无 bygsjw 列表容器，锚点防御式解析
      simpleMode = true;
      const seen = new Set();
      [...document.querySelectorAll('a[href*="mod=viewthread"]')].forEach((a) => {
        const tid = (a.getAttribute('href').match(/tid=(\d+)/) || [])[1];
        if (!tid || seen.has(tid)) return;
        const t = (a.textContent || '').replace(/\s+/g, ' ').trim();
        if (t.length < 6 || /^(上一页|下一页|\d+)$/.test(t)) return;
        seen.add(tid);
        const rowText = ((a.closest('li') || a.closest('div') || a.parentElement).textContent || '')
          .replace(/\s+/g, ' ').trim();
        const rm = rowText.match(/回复\s*(\d+)/);
        const href0 = (a.getAttribute('href') || '').replace(/mobile=\d+/, 'mobile=2');
        threads.push({
          title: t, href: href0, author: '', date: '',
          replies: rm ? rm[1] : '', views: '', preview: [],
          metaRaw: rowText.slice(t.length).trim(),
        });
      });
      if (!threads.length && B.util.looksLegitEmpty('forumdisplay')) {
        legitEmpty = true; // EV-06：简易模板变体的合法空同样分流
      } else if (!threads.length) {
        return false;
      }
    }

    const boardName = B.util.boardName();

    // 筛选链接：从被隐藏的脚手架提取（真实导航）
    const filterLinks = B.util.collectFilters();

    const el = B.el;
    const host = document.createElement('div');
    host.id = 'sdg-redraw-list';
    host.classList.add('sdg-host');
    const shadow = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = B.LIST_CSS + ROW_CSS;
    shadow.appendChild(style);
    if (opts.dark) host.classList.add('dark');

    const wrap = el('div', { class: 'wrap' });
    // 面包屑：论坛 › 板块名（首页可点回列表）
    const topItems = [
      el('a', { class: 'crumb-home', text: '论坛', href: 'forum.php?forumlist=1&mobile=2' }),
      el('span', { class: 'crumb-sep', text: '›' }),
      el('span', { class: 'title', text: boardName || '版块' }),
    ];
    // E-12：窄屏最小导航（宽屏隐藏，CSS 控制）
    topItems.push(el('a', { class: 'qk', text: '搜索', href: 'search.php?mod=forum&mobile=2' }));
    topItems.push(el('a', { class: 'qk', text: '登录', href: 'member.php?mod=logging&action=login&mobile=2' }));
    topItems.push(el('button', { class: 'qk', text: '复制链接', title: '复制当前页链接',
      onclick: () => { try { navigator.clipboard.writeText(location.origin + location.pathname + location.search); } catch (e) { /* */ } } }));
    wrap.appendChild(el('div', { class: 'topbar' }, [el('div', { class: 'tb-in' }, topItems)]));

    // ---- 板块头卡：今日/主题统计 + 收藏本版（真实链接，页内 DOM 稳定在场） ----
    (function boardHead() {
      const txt = (document.body.textContent || '');
      const today = (txt.match(/今日[^0-9]{0,12}(\d{1,7})/) || [])[1];
      const total = (txt.match(/主题[^0-9]{0,12}(\d{1,9})/) || [])[1]
        || (txt.match(/主题:\s*(\d{1,9})/) || [])[1];
      const favA = [...document.querySelectorAll('a')]
        .find((a) => /收藏本版|收藏/.test(a.textContent || '') && /action=fav|favthread|mod=fav/.test(a.getAttribute('href') || ''))
        || [...document.querySelectorAll('a')].find((a) => (a.textContent || '').trim() === '收藏本版');
      if (!today && !total && !favA) return;
      const bh = el('div', { class: 'boardhead' },
        [el('span', { class: 'bh-name', text: boardName || '版块' })]);
      if (today) {
        bh.appendChild(el('span', { class: 'bh-stat', text: '今日 ' + today + ' ' }));
      }
      if (total) {
        bh.appendChild(el('span', { class: 'bh-stat', text: ' · 主题 ' + total }));
      }
      if (favA) {
        const fav = el('a', { class: 'bh-fav', text: '★ 收藏本版',
          href: favA.getAttribute('href') });
        bh.appendChild(fav);
      }
      wrap.appendChild(bh);
    })();

    // ---- 子版块卡（同一 li.cl 容器内的 forum_img 行：名称+帖子/评论双计数） ----
    (function subforums() {
      const F2 = SDG.forumDisplay;
      const rows = document.querySelectorAll(F2.subforumRow);
      if (!rows.length) return;
      const seen = new Set();
      const box = el('div', { class: 'subforums' });
      box.appendChild(el('div', { class: 'sf-title', text: '子版块' }));
      let any = false;
      rows.forEach((a) => {
        const href = a.getAttribute('href') || '';
        const fid = (href.match(/fid=(\d+)/) || [])[1];
        if (!fid || seen.has(fid)) return;
        seen.add(fid);
        const li = a.closest('li') || a.parentElement;
        const nameEl = li.querySelector(F2.subforumName);
        const name = nameEl ? (nameEl.textContent || '').trim() : ((a.querySelector('img') || {}).alt || '');
        if (!name) return;
        const th = ((li.querySelector(F2.subforumThreads) || {}).textContent || '').replace(/\D/g, '');
        const ps = ((li.querySelector(F2.subforumPosts) || {}).textContent || '').replace(/\D/g, '');
        const rowEl = el('a', { class: 'sf-row',
          href: 'forum.php?mod=forumdisplay&fid=' + fid + '&mobile=2' });
        rowEl.appendChild(el('span', { class: 'sf-name', text: name }));
        // 标签对齐站方语义：forum_threads=主题数、forum_posts=帖子数（此前误标"帖子/评论"）
        if (th || ps) rowEl.appendChild(el('span', { class: 'sf-meta',
          text: `主题 ${th || '-'} · 帖子 ${ps || '-'}` }));
        box.appendChild(rowEl);
        any = true;
      });
      if (any) wrap.appendChild(box);
    })();

    // EF-05（v1.19.3/v1.19.5）：发帖/收藏本版入口——actionLinks 显式收集（此前藏在
    // markActive 的收集时机晚于 actionBar 读取，冷加载首值缺失）
    if (window.SDGRedrawBase && window.SDGRedrawBase.collectActionLinks) {
      try { window.SDGRedrawBase.collectActionLinks(document); } catch (e) { /* */ }
    }
    const apiFid = (location.search.match(/fid=(\d+)/) || [])[1]; // 提前声明（原后段声明因 TDZ 崩溃）
    // ER-09（v1.19.7）筛选契约：URL 带未映射筛选参数时不做 API 升级（映射未证实，HTML 为准）
    const hasUnmappedFilter = /(?:^|&)(?:filter|typeid|orderby|digest|specialtype)=/.test(location.search);
    const actionBar = el('div', { class: 'filters' });
    let actionAdded = false;
    if (apiFid) {
      actionBar.appendChild(el('a', { class: 'fchip', text: '✏️ 发帖',
        href: `forum.php?mod=post&action=newthread&fid=${apiFid}&mobile=2` }));
      actionAdded = true;
    }
    const favA = window.SDGRedraw.actionLinks && window.SDGRedraw.actionLinks.fav;
    if (favA) {
      actionBar.appendChild(el('a', { class: 'fchip', text: '★ 收藏本版', href: favA }));
      actionAdded = true;
    }
    // W2（v1.19.4）：📌 常用切换（storage.sync sdgPinned，≤5 FIFO；侧栏 onChanged 联动刷新）
    if (apiFid && window.SDGScope) {
      const pinBtn = el('button', { class: 'fchip', text: '📌 常用' });
      const refresh = () => {
        try {
          chrome.storage.sync.get({ sdgPinned: [] }, (st) => {
            const pinned = (st && Array.isArray(st.sdgPinned) ? st.sdgPinned : []).map(String);
            pinBtn.classList.toggle('on', pinned.includes(String(apiFid)));
          });
        } catch (e) { /* ignore */ }
      };
      pinBtn.addEventListener('click', () => {
        try {
          chrome.storage.sync.get({ sdgPinned: [] }, (st) => {
            let pinned = (st && Array.isArray(st.sdgPinned) ? st.sdgPinned : []).map(String);
            if (pinned.includes(String(apiFid))) pinned = pinned.filter((x) => x !== String(apiFid));
            else { pinned.push(String(apiFid)); if (pinned.length > 5) pinned = pinned.slice(-5); }
            chrome.storage.sync.set({ sdgPinned: pinned }, () => { try { refresh(); } catch (e2) { /* */ } });
          });
        } catch (e) { /* ignore */ }
      });
      refresh();
      actionBar.appendChild(pinBtn);
      actionAdded = true;
    }
    if (actionAdded) wrap.appendChild(actionBar);

    // 筛选行（R15/EV-09 分组；W-A3/VR-5 重做映射：按 filter 值+orderby 在场判定）。
    // 实测（tests/filterlinks_fixture_v1221.json，fid=39/153/198/190/191/192/193/194）：
    // 站方排序链接全带 filter=（最新回复=filter=lastpost&orderby=lastpost），按参数名映射
    // 会全部塌进"时段"组（VR-5 实锤）；时段组特征=filter=dateline；类型=hot/digest/specialtype/typeid。
    // .on 高亮=组内条件签名匹配（filter+组特征参数），分享 filter=reply 的 回复数/查看数 靠 orderby 区分；
    // 非条件链接（电脑版/简易版类视图切换）不进组、永不亮（VR-5 连带误标修复）。
    if (filterLinks.length) {
      const row = el('div', { class: 'filters' });
      const seen = new Set();
      const Q = (href) => new URLSearchParams(href.split('?')[1] || '');
      const groupOf = (params) => {
        const f = params.get('filter') || '';
        if (params.has('typeid')) return '类型';
        if (f === 'dateline') return '时段';
        if (params.has('orderby')) return '排序';
        if (f === 'hot' || f === 'digest' || f === 'specialtype') return '类型';
        return '';
      };
      // 各组条件签名：值全部相等才算当前选中（每组至多一个 .on）
      const SIG_KEYS = { 排序: ['filter', 'orderby'], 时段: ['filter', 'dateline'], 类型: ['filter', 'specialtype', 'digest', 'typeid'] };
      const sigOf = (params, keys) => keys.map((k) => params.get(k) || '').join('|');
      // 非条件锚点（VR-8）：站方页头视图切换与翻页链接会与真条件同签名——让位用
      const JUNKY = (label) => /^(上一页|下一页|首页|末页)$/.test(label) ||
        label.indexOf('简易版') >= 0 || label.indexOf('电脑版') >= 0 ||
        label.indexOf('触屏版') >= 0 || label.indexOf('手机版') >= 0;
      const bucket = { 类型: [], 排序: [], 时段: [] };
      const other = [];
      const sigIdx = {};
      filterLinks.forEach(({ label, href }) => {
        if (seen.has(label)) return;
        seen.add(label);
        const params = Q(href);
        const g = groupOf(params);
        if (g) {
          // 同组同条件签名只保留一个锚点。VR-5：身份链接与当前条件同参；
          // VR-8（2026-10-22 验收发现）：bygsjw 页头视图切换/顶部翻页在 DOM 序上
          // 先于筛选条，first-wins 会用 下一页/简易版 挤掉真 chip 并误亮——
          // 撞车时非条件标签让位给语义真锚，同为真锚或同为垃圾则先到者得。
          const sig = sigOf(params, SIG_KEYS[g]);
          sigIdx[g] = sigIdx[g] || {};
          if (sig in sigIdx[g]) {
            const i = sigIdx[g][sig];
            if (JUNKY(bucket[g][i].label) && !JUNKY(label)) bucket[g][i] = { label, href };
            return;
          }
          sigIdx[g][sig] = bucket[g].length;
          bucket[g].push({ label, href });
        } else other.push({ label, href });
      });
      const curParams = new URLSearchParams(location.search);
      const curKey = [...curParams.entries()].filter(([, v]) => v).sort().map(([k, v]) => k + '=' + v).join('&');
      const isCur = (gname, href) => {
        const keys = SIG_KEYS[gname];
        if (!keys) return false; // 非条件链接不参与高亮
        return sigOf(curParams, keys) === sigOf(Q(href), keys) && sigOf(Q(href), keys).replace(/\|/g, '') !== '';
      };
      // 当前有筛选时给"全部"复位入口（当前条件反馈的一部分）
      if (curKey && apiFid) {
        row.appendChild(el('a', { class: 'fchip', text: '全部',
          href: `forum.php?mod=forumdisplay&fid=${apiFid}&mobile=2` }));
      }
      ['类型', '排序', '时段'].forEach((gname) => {
        const items = bucket[gname];
        if (!items || !items.length) return;
        row.appendChild(el('span', { class: 'glabel', text: gname }));
        items.forEach(({ label, href }) => {
          row.appendChild(el('a', { class: 'fchip' + (isCur(gname, href) ? ' on' : ''), text: label, href }));
        });
      });
      other.forEach(({ label, href }) => {
        row.appendChild(el('a', { class: 'fchip', text: label, href }));
      });
      const fid = (location.search.match(/fid=(\d+)/) || [])[1];
      if (fid) {
        row.appendChild(el('a', { class: 'fchip srch', text: '🔍 搜索本板块',
          href: `search.php?mod=forum&srchfid=${fid}&mobile=2` }));
      }
      wrap.appendChild(row);
    }

    // 空态（EV-06：合法空=空提示文案+清除筛选入口，无重试语义；非合法空保留重试）
    if (!threads.length) {
      const hasFilter = /(?:^|&)(?:filter|typeid|orderby|digest|specialtype)=/.test(location.search);
      wrap.appendChild(el('div', { class: 'card empty' }, [
        el('div', { class: 'empty-text',
          text: legitEmpty ? '本版块或当前筛选条件下暂无主题' : '列表为空，或加载未完成（服务器不稳定时常见）' }),
      ]));
      const below = legitEmpty ? el('div', { class: 'filters' }) : el('div', { class: 'pager' });
      if (legitEmpty) {
        if (hasFilter && apiFid) {
          below.appendChild(el('a', { class: 'fchip on', text: '✕ 清除筛选，查看全部主题',
            href: `forum.php?mod=forumdisplay&fid=${apiFid}&mobile=2` }));
        } else {
          below.appendChild(el('a', { class: 'fchip', text: '« 返回论坛首页',
            href: 'forum.php?forumlist=1&mobile=2' }));
        }
      } else {
        below.appendChild(el('button', { text: '重试', onclick: () => location.reload() }));
      }
      wrap.appendChild(below);
      // VR-7（2026-10-22 验收发现）：R14 事务化时丢了本分支的 shadow.appendChild(wrap)
      // ——自 v1.21.1 起合法空页重绘完全不渲染（原站空文案 fail-open 可见故未被察觉）。
      shadow.appendChild(wrap);
      // R14/EV-08：空态路径同走提交事务
      if (!commitList(shadow, host, null, false)) return false;
      return true;
    }

    const nextA = B.util.pagerAnchor('next');
    const prevA = B.util.pagerAnchor('prev');
    // 工厂：cloneNode 不复制监听器，顶/底两份分页各自新建
    const makePager = () => {
      const box = el('div', { class: 'pager' });
      const pv = el('button', { text: '上一页' });
      if (prevA) pv.addEventListener('click', () => { location.href = prevA.getAttribute('href'); });
      else pv.disabled = true;
      const nx = el('button', { text: '下一页' });
      if (nextA) nx.addEventListener('click', () => { location.href = nextA.getAttribute('href'); });
      else nx.disabled = true;
      box.appendChild(pv); box.appendChild(nx);
      return box;
    };

    // 行式列表（蓝图 L1：PC 密度；底部分页常驻，顶部分页仅在真有上一页时显示——
    // 首页（无 prev）顶部只会有个失效的"上一页"，纯噪音，用户截图实证）
    if (threads.length >= 8 && prevA) wrap.appendChild(makePager());
    const rowsBox = el('div', { class: 'rows' });
    threads.forEach((t) => {
      const bare = !t.author && !t.date && !t.replies && !t.views;
      const row = el('div', { class: 'trow' + (bare ? ' bare' : '') + (t.pin ? ' pinned' : '') });
      const main = el('div', { class: 'main' });
      const tline = el('div', { class: 'tline' });
      if (t.pin) tline.appendChild(el('span', { class: 'pin-badge', text: '置顶' }));
      if (t.type) tline.appendChild(el('span', { class: 'type-badge', text: t.type }));
      tline.appendChild(el('a', { class: 't', text: t.title || '(无题)', href: t.href }));
      main.appendChild(tline);
      const subItems = [];
      if (t.author) subItems.push(el('a', { text: t.author, href: t.authorHref || '#' }));
      if (t.date) subItems.push(el('span', { class: 'd', text: B.util.toRelative(t.date) }));
      if (subItems.length) main.appendChild(el('div', { class: 'sub' }, subItems));
      row.appendChild(main);
      if (t.replies || t.views) {
        const st = el('div', { class: 'stats' });
        st.appendChild(el('b', { text: t.replies || '0' }));
        st.appendChild(el('span', { text: `回复 / 查看 ${t.views || 0}` }));
        row.appendChild(st);
      }
      if (t.preview && t.preview.length > 1) {
        const hp = el('div', { class: 'hoverp' });
        t.preview.slice(0, 3).forEach((src) => {
          hp.appendChild(el('img', { src, alt: '', loading: 'lazy' }));
        });
        row.appendChild(hp);
      }
      rowsBox.appendChild(row);
      // R14/EV-10：站方封面写入者走 applyRow 单入口（source=html）——封面互斥自此集中一处
      if (t.preview && t.preview.length) {
        applyRow(row, { cover: t.preview[0] }, 'html');
      }
    });
    // R15/EV-09：hover 预览的非 hover 入口——点击行空白处切换驻留（不干扰链接/灯箱/按钮）
    rowsBox.addEventListener('click', (ev) => {
      if (ev.target.closest('a, button, img.thumb')) return;
      const row = ev.target.closest('.trow');
      if (!row || !row.querySelector('.hoverp')) return;
      row.classList.toggle('hp-pin');
    });
    wrap.appendChild(rowsBox);
    wrap.appendChild(makePager());
    wrap.appendChild(el('div', { class: 'hint', text: 'SDGun Web Access · 重绘层（真实导航）' }));

    shadow.appendChild(wrap);
    // R14/EV-08：提交事务（见 commitList）——append 后 hide/markActive/hideScaffold/
    // hideTrailingSiblings 任一步异常即逆序回滚（宿主摘除/原文还原/active 摘除），
    // 返回 false 走 boot 挂载失败链，不再向外抛异常。
    if (!commitList(shadow, host, list, simpleMode)) return false;
    // v1.18.0/v1.18.3：forumView API 行数据升级——E-09 分页契约：
    // HTML 每页 10 条、API step=20，故 apiPage = ceil(htmlPage/2)；缓存键含 source/fid/apiPage；
    // 请求走 PageScope（unmount 级联取消）。任何失败=现状行为。
    // apiFid 已在 EF-05 区块声明（v1.19.3 TDZ 修复）
    if (opts.enrich !== false && window.SDGApi && window.SDGScope && apiFid && !hasUnmappedFilter) {
      const htmlPage = parseInt((location.search.match(/[?&]page=(\d+)/) || [])[1] || '1', 10);
      const apiPage = Math.ceil(htmlPage / 2);
      const scope = window.SDGScope.register(window.SDGScope.create());
      // ER-09（v1.19.7）：forumView 会话缓存（fid+apiPage，5min TTL）——翻页回访零请求
      // A1（v1.20.0）：forumView 会话缓存（forumview 组 5min TTL）
      const fvKey = `${apiFid}:${apiPage}`;
      const fetchForumView = () => {
        if (window.SDGCache) {
          return window.SDGCache.get(window.SDGCache.GROUPS.FORUMVIEW, fvKey).then((c) => {
            if (c && c.list) return c.list;
            return scope.fetchJSON(`https://app.sdgun.com.cn/mag/circle/v1/forum/forumView?fid=${apiFid}&p=${apiPage}&step=20`, 10000)
              .then((d) => {
                if (d && Array.isArray(d.list) && d.list.length) {
                  window.SDGCache.set(window.SDGCache.GROUPS.FORUMVIEW, fvKey, d);
                  return d.list; // 返回数组（消费方 indexThreads 期望数组，非原始响应对象）
                }
                return null;
              });
          });
        }
        return scope.fetchJSON(`https://app.sdgun.com.cn/mag/circle/v1/forum/forumView?fid=${apiFid}&p=${apiPage}&step=20`, 10000);
      };
      fetchForumView()
        .then((list) => {
          if (!list || !list.length) return; // 失败/空=现状（E-08 原则）
          const map = window.SDGApi.indexThreads(list);
          shadow.querySelectorAll('.trow').forEach((row) => {
            const a = row.querySelector('a.t');
            const tid = a && (a.getAttribute('href').match(/tid=(\d+)/) || [])[1];
            const dd = tid && map[tid];
            if (dd) upgradeRow(row, dd, apiFid);
          });
        })
        .catch(() => { /* fail-open */ });
      // v1.17.0 F-1：图文增强（同一 scope；仅摘要职责，cover 由 API 承担）
      if (window.SDGRedraw.enrichRows) {
        try { window.SDGRedraw.enrichRows(shadow, scope); } catch (e) { /* 增强失败不影响列表 */ }
      }
    }
    return true;
  }

  // R14/EV-08：挂载提交事务。每步登记逆操作，任一步异常逆序回滚——
  // 宿主摘除、原文/脚手架按 data-sdg-hidden 标记精确还原（restoreHidden）、
  // sdg-host/sdg-redraw-active 类摘除。返回 false = 已回滚（原文可见，boot 走挂载失败链）；
  // 不向外抛异常。变体：simpleMode 隐藏简易模板容器；list=null 只做脚手架/尾随隐藏（空态路径）。
  function commitList(shadow, host, list, simpleMode) {
    const anchor = B.util.contentAnchor();
    const anchorIsBody = anchor === document.body;
    const undos = [];
    try {
      if (!anchorIsBody) anchor.classList.add('sdg-host');
      undos.push(() => { if (!anchorIsBody) anchor.classList.remove('sdg-host'); });
      anchor.appendChild(host);
      undos.push(() => { try { host.remove(); } catch (e) { /* */ } });
      const hiddenNow = [];
      if (list) { B.hideEl(list); hiddenNow.push(list); }
      else if (simpleMode) {
        const container0 = B.util.threadContainer();
        if (container0 && container0 !== document.body) { B.hideEl(container0); hiddenNow.push(container0); }
      }
      undos.push(() => B.restoreHidden(hiddenNow));
      B.markActive();
      undos.push(() => document.documentElement.classList.remove('sdg-redraw-active'));
      const scaffolded = B.util.hideScaffold('bygsjw');
      undos.push(() => B.restoreHidden(scaffolded));
      const trailing = B.hideTrailingSiblings(anchor);
      undos.push(() => B.restoreHidden(trailing));
      B.wireLightbox(shadow);
      return true;
    } catch (e) {
      for (const u of undos.reverse()) { try { u(); } catch (e2) { /* */ } }
      return false;
    }
  }

  // 行数据升级（v1.18.0）：复用 v1.17.3 槽位体系，零位移——
  // A3（v1.20.1）单入口 applyRow；R14/EV-10 契约收口：
  // ① source 白名单 {html, api, enrich}，未知值 throw（编程错误开发期可见）；
  // ② 封面互斥只作用于封面写入（合并表见 applyRowInner）——字段刷新（头像/时间/点赞/
  //    查看/多图/摘要）不受互斥影响、每次调用都执行（此前 api+api 整行 early-return
  //    会连字段刷新一起跳过）；
  // ③ 三个写入者自此全部真实经此入口：站方直渲（mountForumDisplay 行构建，source=html）、
  //    API 升级（upgradeRow，source=api）、enrich 终态（settleRow，source=enrich）。
  function applyRow(row, fields, source) {
    if (!row || !fields) return;
    if (source !== 'html' && source !== 'api' && source !== 'enrich') {
      throw new Error('applyRow: unknown source "' + source + '"');
    }
    try { applyRowInner(row, fields, source); } catch (e) { /* 单行失败静默 */ }
  }

  // 封面加载失败 → 撤图落字块（槽位永在；对齐 enrich 无图终态，行高不塌）
  function insertCoverTile(row) {
    const t = document.createElement('div');
    t.className = 'sdg-tile';
    t.textContent = (((row.querySelector('.t') || {}).textContent || '').trim().charAt(0)) || '·';
    row.insertBefore(t, row.querySelector('.main'));
  }

  function applyRowInner(row, fields, source) {
    // 封面互斥（EV-10 合并表）：cur=api 永不被覆盖；api 覆盖 html/enrich；空位任何 source 可写
    const cur = row.getAttribute('data-sdg-cover-src') || '';
    if (fields.cover && cur !== 'api' && (source === 'api' || !cur)) {
      const old = row.querySelector('img.thumb, .sdg-tile, .sdg-skel-thumb');
      if (old) old.remove();
      const im = document.createElement('img');
      im.className = 'thumb';
      im.loading = 'lazy';
      im.alt = '';
      im.src = fields.cover;
      // R12/EV-07：保留原图引用——灯箱按需取原图（列表仍只加载 240 缩略，预算不变）
      if (fields.coverOrig) im.dataset.orig = fields.coverOrig;
      im.addEventListener('error', () => {
        im.remove();
        if (!row.isConnected) return;
        if (!row.querySelector('.sdg-tile')) insertCoverTile(row); // EV-10：撤图落字块
      });
      row.insertBefore(im, row.querySelector('.main'));
      row.setAttribute('data-sdg-cover-src', source);
    }
    // 头像（api）
    if (fields.authorHead) {
      const sub = row.querySelector('.sub');
      const authorEl = sub && sub.querySelector('a');
      if (sub && authorEl && !sub.querySelector('img.ava')) {
        const av = document.createElement('img');
        av.className = 'ava';
        av.loading = 'lazy';
        av.alt = '';
        av.src = fields.authorHead;
        av.addEventListener('error', () => { av.remove(); });
        sub.insertBefore(av, authorEl);
      }
    }
    // 相对时间（api）
    if (fields.relative) {
      const dEl = row.querySelector('.sub .d');
      if (dEl) dEl.textContent = fields.relative;
    }
    // 点赞（api）
    if (fields.applaud) {
      const sub = row.querySelector('.sub');
      if (sub && !sub.querySelector('.zap')) {
        const z = document.createElement('span');
        z.className = 'zap';
        z.textContent = '👍 ';
        const b = document.createElement('b');
        b.textContent = fields.applaud;
        z.appendChild(b);
        sub.appendChild(z);
      }
    }
    // 查看（api，格式化字符串直显）
    if (fields.click) {
      const stats = row.querySelector('.stats');
      const viewsSpan = stats && stats.querySelector('span');
      if (viewsSpan) viewsSpan.textContent = `回复 / 查看 ${fields.click}`;
    }
    // 悬停多图（api）：缩略显示，逐张携带原图引用（灯箱取 orig）
    if (Array.isArray(fields.pics) && fields.pics.length > 1 && !row.querySelector('.hoverp')) {
      const hp = document.createElement('div');
      hp.className = 'hoverp';
      fields.pics.slice(0, 3).forEach((src, i2) => {
        const im = document.createElement('img');
        im.loading = 'lazy';
        im.alt = '';
        im.src = src;
        if (fields.picsOrig && fields.picsOrig[i2]) im.dataset.orig = fields.picsOrig[i2];
        hp.appendChild(im);
      });
      row.appendChild(hp);
    }
    // 摘要槽位（enrich）：已存在 .ex 则更新文本
    if (fields.ex !== undefined) {
      const main = row.querySelector('.main');
      if (main) {
        let ex = main.querySelector('.ex');
        if (!ex) {
          ex = document.createElement('div');
          ex.className = 'ex';
          main.appendChild(ex);
        }
        ex.textContent = fields.ex;
      }
    }
  }

  function upgradeRow(row, d, fid) {
    applyRow(row, {
      cover: d.cover, coverOrig: d.coverOrig, pics: d.pics, picsOrig: d.picsOrig,
      authorHead: d.authorHead,
      relative: d.relative, applaud: d.applaud, click: d.click,
    }, 'api');
  }


  window.SDGRedraw = window.SDGRedraw || {};
  window.SDGRedraw.mountForumDisplay = mountForumDisplay;
  window.SDGRedraw.parseThreads = parseThreads; // 单测导出
  window.SDGRedraw.applyRow = applyRow; // A3（v1.20.1）：行升级单入口（enrich/测试消费）
})();
