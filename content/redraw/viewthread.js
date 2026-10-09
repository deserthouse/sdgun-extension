// redraw/viewthread.js — 帖子详情页重绘（parseFloors + mount）。
// 依赖：redraw/base.js（先加载）。挂载入口挂到 window.SDGRedraw.mount。
// 渲染：v1.8 楼层双列（蓝图 L2）——左头像列 72px + 右内容列；楼主楼层徽标+左边条（全部 OP 楼，
// 非仅首楼）；回复钮沉底右对齐。
(function () {
  'use strict';
  const B = window.SDGRedrawBase;

  // 楼层双列样式（追加在共享 CSS 之后；.body 等内容样式复用 base 层）
  const FLOOR_CSS = `
    .reply-main { display:flex; justify-content:center; margin:16px 0 4px; }
    .reply-main .reply-btn { display:inline-block; border:1px solid var(--accent); color:var(--accent);
      border-radius:12px; padding:10px 48px; font-size:15px; font-weight:600; text-decoration:none; transition:all .12s; }
    .reply-main .reply-btn:hover { background:var(--accent); color:#fff; }
    :host(.dark) .reply-main .reply-btn { border-color:#ff6b7a; color:#ff6b7a; }
    :host(.dark) .reply-main .reply-btn:hover { background:#ff6b7a; color:#1a1b1e; }
    .crumb-home { color:var(--text3); text-decoration:none; font-weight:500; flex:none; }
    .crumb-home:hover { color:var(--accent); }
    :host(.dark) .crumb-home { color:#a8a29e; }
    :host(.dark) .crumb-home:hover { color:#ff6b7a; }
    .fcard { display:flex; gap:14px; background:var(--surface); border:1px solid var(--border);
      border-radius:var(--radius); padding:14px 18px; margin:10px 0; }
    .fcard.opf { border-left:3px solid var(--accent); }
    .fcard.flash { outline: 2px solid var(--accent); outline-offset: -2px; }
    .fava { flex:none; width:72px; display:flex; flex-direction:column; align-items:center; gap:6px; }
    .fava a { display:block; }
    .fava img { width:64px; height:64px; border-radius:14px; object-fit:cover; background:var(--surface2); }
    .fava .afb { width:64px; height:64px; border-radius:14px; background:var(--surface2); color:var(--text2);
      display:flex; align-items:center; justify-content:center; font-size:26px; font-weight:700; }
    .fmain { flex:1; min-width:0; display:flex; flex-direction:column; }
    .fhead { display:flex; align-items:center; gap:10px; margin-bottom:8px; flex-wrap:wrap; }
    .fhead .author { font-weight:600; color:var(--text); text-decoration:none; font-size:15px; }
    .fhead .author:hover { color:var(--accent); }
    .badge-op { font-size:11px; font-weight:700; color:var(--surface); background:var(--accent);
      border-radius:5px; padding:1px 8px; letter-spacing:.5px; flex:none; }
    .fhead .meta { color:var(--text3); font-size:12.5px; }
    .fhead .floor { margin-left:auto; color:var(--text3); font-size:12.5px; flex:none; }
    .ffoot { display:flex; justify-content:flex-end; margin-top:10px; }
    .ffoot .reply { font-size:12.5px; color:var(--text3); text-decoration:none;
      border:1px solid var(--border2); border-radius:999px; padding:3px 14px; }
    .ffoot .vote { font-size:12.5px; text-decoration:none; border-radius:999px; padding:3px 12px;
      border:1px solid var(--border2); }
    .ffoot .vote.up { color:var(--accent); }
    .ffoot .vote.up:hover { background:var(--accent); color:#fff; }
    .ffoot .vote.down { color:var(--text3); }
    .ffoot .vote.down:hover { border-color:var(--accent); color:var(--accent); }
    .ffoot .reply:hover { color:var(--accent); border-color:var(--accent); }
  `;

  function parseFloors(SDG) {
    const V = SDG.viewThread;
    const floors = [];
    const nodes = document.querySelectorAll(V.floor);

    // fid 兜底来源：viewthread URL 通常无 fid——从页面链接（发帖/回帖）提取
    let pageFid = (location.search.match(/fid=(\d+)/) || [])[1] || '';
    if (!pageFid) {
      const fidA = document.querySelector('a[href*="mod=post"]');
      if (fidA) pageFid = (fidA.getAttribute('href').match(/fid=(\d+)/) || [])[1] || '';
    }

    nodes.forEach((node) => {
      let authorEl = node.querySelector(V.author);
      let contentEl = node.querySelector(V.content);
      let timeEl = node.querySelector(V.date);
      let floorEl = node.querySelector(V.postNumber);
      const avatarEl = node.querySelector(V.authorAvatar);
      let replyA = node.querySelector(V.replyAnchor);
      // 赞/踩：站点 postreview 真实链接（do=support / do=oppose，带 tid+pid+hash；
      // 游客点击=站点自身登录引导，与回复按钮同性质）
      const supportA = node.querySelector('a[href*="postreview"][href*="do=support"]');
      const opposeA = node.querySelector('a[href*="postreview"][href*="do=oppose"]')
        || node.querySelector('a[href*="postreview"]:not([href*="do=support"])');
      const supportHref = supportA ? supportA.getAttribute('href') : '';
      const opposeHref = opposeA ? opposeA.getAttribute('href') : '';

      // mobile=1 标准移动模板：内容在楼层头的兄弟节点（#postmessage_{pid}），头部元素形态不同
      const pid = (node.id || '').replace('pid', '');
      if (!authorEl || !contentEl) {
        authorEl = node.querySelector('a[href*="mod=space"]');
        contentEl = pid ? document.getElementById('postmessage_' + pid) : null;
        timeEl = node.querySelector('em[id^="authorposton"] font, em[id^="authorposton"]');
        floorEl = node.querySelector('em');
        if (contentEl && pid && pageFid) {
          replyA = null; // 无每楼回复链接，构造兜底（replyUrl 用 pageFid）
        }
      }
      if (!authorEl || !contentEl) return;
      // 2026-10-08 修正：bygsjw 形态下 .grey 首个匹配是"楼号+作者"行（li.grey），
      // 真实时间在同楼层第二个 li.grey（浏览/回复统计行）尾部。按日期模式从楼层头提取，
      // 拿不到则置空——绝不把楼号/作者错当时间显示。
      let time = timeEl ? (timeEl.textContent || '').replace(/\s+/g, ' ').trim() : '';
      if (!/\d{4}-\d{1,2}-\d{1,2}/.test(time)) {
        const headTxt = (node.querySelector('.post_author') || node).textContent || '';
        const m = headTxt.match(/\d{4}-\d{1,2}-\d{1,2}\s+\d{1,2}:\d{2}(?::\d{2})?/);
        time = m ? m[0] : (/^\d+#/.test(time) ? '' : time);
      }
      floors.push({
        replyHref: replyA ? replyA.getAttribute('href') : '',
        author: (authorEl.textContent || '').trim(),
        authorHref: authorEl.getAttribute('href') || '#',
        time,
        floor: floorEl ? (floorEl.textContent || '').trim() : '',
        avatar: avatarEl ? avatarEl.getAttribute('src') : '',
        content: contentEl,
        pid,
        fid: pageFid,
        supportHref,
        opposeHref,
      });
    });
    return floors;
  }

  function floorNum(f) {
    return parseInt((f.floor || '').replace('#', ''), 10) || 0;
  }

  function replyUrl(f) {
    const fid = f.fid || (location.search.match(/fid=(\d+)/) || [])[1] || '';
    const tid = (location.search.match(/tid=(\d+)/) || [])[1] || '';
    return `forum.php?mod=post&action=reply&fid=${fid}&tid=${tid}&reppost=${f.pid}&extra=&mobile=1`;
  }

  function currentPage() {
    const m = location.search.match(/[?&]page=(\d+)/);
    return m ? parseInt(m[1], 10) : 1;
  }

  function navTo(params) {
    const u = new URL(location.href);
    for (const [k, v] of Object.entries(params)) {
      if (v === null) u.searchParams.delete(k);
      else u.searchParams.set(k, v);
    }
    location.href = u.toString(); // real navigation - original page handles it
  }

  function mount(SDG, opts) {
    const B = window.SDGRedrawBase;
    let container = document.querySelector(SDG.viewThread.container);
    // mobile=1 标准移动模板：无 .postlist 容器——楼层头 div[id^=pid] 的共同父级即容器
    if (!container) {
      const first = document.querySelector(SDG.viewThread.floor);
      container = first ? first.parentElement : null;
    }
    if (!container) return false;

    const floors = parseFloors(SDG);
    if (!floors.length) return false; // fail-open: nothing parsed

    // 帖子标题：优先 h2（真实标题），排除工具栏文字（.postlist_title 里混着 全部回复/只看楼主）
    // mobile=1 无 h2：title 形如 "板名+帖子标题SDGUN,..."——去板名取后半（用第一个楼层正文前缀比对不可靠，直接截断站名后缀）
    const h2el = container.querySelector('h2');
    let title;
    if (h2el) {
      title = (h2el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80);
    } else {
      const raw = (document.title || '').split('-')[0].trim();
      const cut = raw.indexOf('SDGUN,');
      title = (cut > 0 ? raw.slice(0, cut) : raw).trim().slice(0, 80);
    }

    const host = document.createElement('div');
    host.id = 'sdg-redraw-host';
    host.classList.add('sdg-host');
    const shadow = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = B.CSS + FLOOR_CSS;
    shadow.appendChild(style);
    if (opts.dark) host.classList.add('dark');

    const el = B.el;
    const wrap = el('div', { class: 'wrap' });
    const page = currentPage();
    const opUid = (floors[0] && (floors[0].authorHref.match(/uid=(\d+)/) || [])[1]) || '';
    const authorFiltered = /authorid=\d+/.test(location.search);

    const backFid = (floors[0] && floors[0].fid) || (location.search.match(/fid=(\d+)/) || [])[1] || '';
    const topItems = [];
    if (backFid) topItems.push(el('a', { class: 'crumb-home', text: '‹ 板块',
      href: `forum.php?mod=forumdisplay&fid=${backFid}&mobile=2` }));
    topItems.push(el('a', { class: 'title', text: title, href: '#' }));
    topItems.push(el('span', { class: 'page', text: `第 ${page} 页` }));
    wrap.appendChild(el('div', { class: 'topbar' }, [el('div', { class: 'tb-in' }, topItems)]));

    // 工具行：只看楼主（真实导航）+ 跳楼（页内滚动或翻页导航）
    const tools = el('div', { class: 'tools' });
    if (opUid) {
      tools.appendChild(el('button', {
        class: 'chip' + (authorFiltered ? ' on' : ''),
        text: '只看楼主',
        onclick: () => navTo({ authorid: authorFiltered ? null : opUid }),
      }));
    }
    const jumpInput = el('input', { class: 'jump', placeholder: '楼层' });
    const maxFloor = Math.max(0, ...floors.map(floorNum));
    const jumpBtn = el('button', {
      class: 'chip', text: '跳楼',
      onclick: () => {
        const n = parseInt(jumpInput.value, 10);
        if (!n) return;
        const card = wrap.querySelector(`[data-floor="${n}"]`);
        if (card) {
          card.scrollIntoView({ behavior: 'smooth', block: 'start' });
          card.classList.add('flash');
          setTimeout(() => card.classList.remove('flash'), 1200);
        } else {
          const perPage = Math.max(1, page === 1 ? maxFloor : Math.round(maxFloor / page));
          navTo({ page: String(Math.max(1, Math.ceil(n / perPage))) });
        }
      },
    });
    tools.appendChild(jumpInput);
    tools.appendChild(jumpBtn);
    wrap.appendChild(tools);

    floors.forEach((f, i) => {
      const isOp = opUid && (f.authorHref.match(/uid=(\d+)/) || [])[1] === opUid;
      const card = el('div', { class: 'fcard' + (isOp ? ' opf' : '') });
      card.setAttribute('data-floor', String(floorNum(f) || i + 1));

      // 左：头像列（72px）。头像包作者空间链接（2026-10-09 D-2：此前裸 img 点击无反应），
      // img 带 avatar 类供灯箱捕获监听排除
      const ava = el('div', { class: 'fava' });
      const avaInner = f.avatar
        ? el('img', { class: 'avatar', src: f.avatar, alt: '', loading: 'lazy' })
        : el('div', { class: 'afb', text: f.author ? f.author[0].toUpperCase() : '?' });
      if (f.authorHref && f.authorHref !== '#') {
        const al = el('a', { href: f.authorHref });
        al.appendChild(avaInner);
        ava.appendChild(al);
      } else {
        ava.appendChild(avaInner);
      }
      card.appendChild(ava);

      // 右：内容列（头行 → 正文 → 底行）
      const main = el('div', { class: 'fmain' });
      const head = el('div', { class: 'fhead' });
      head.appendChild(el('a', { class: 'author', text: f.author || '匿名', href: f.authorHref }));
      if (isOp) head.appendChild(el('span', { class: 'badge-op', text: '楼主' }));
      head.appendChild(el('span', { class: 'meta', text: f.time }));
      head.appendChild(el('span', { class: 'floor', text: f.floor || `${i + 1}#` }));
      main.appendChild(head);

      const body = el('div', { class: 'body' });
      try {
        const clone = f.content.cloneNode(true);
        B.normalizeCloned(clone);
        body.appendChild(clone);
        body.querySelectorAll('img').forEach((img) => {
          img.loading = 'lazy';
          img.decoding = 'async';
        });
      } catch (e) { /* skip floor content */ }
      main.appendChild(body);

      const foot = el('div', { class: 'ffoot' });
      if (f.supportHref) {
        foot.appendChild(el('a', { class: 'vote up', text: '👍 支持', href: f.supportHref }));
      }
      if (f.opposeHref) {
        foot.appendChild(el('a', { class: 'vote down', text: '👎', href: f.opposeHref, title: '反对' }));
      }
      foot.appendChild(el('a', { class: 'reply', text: '回复', href: f.replyHref || replyUrl(f) }));
      main.appendChild(foot);

      card.appendChild(main);
      wrap.appendChild(card);
    });

    // pager: real-navigation buttons
    const prev = el('button', {
      text: '上一页',
      onclick: () => navTo({ page: String(page - 1) }),
    });
    const next = el('button', {
      text: '下一页',
      onclick: () => navTo({ page: String(page + 1) }),
    });
    prev.disabled = page <= 1;
    wrap.appendChild(el('div', { class: 'pager' }, [prev, next]));
    // 回复本帖主入口（官方 App 底部评论框的对应物；游客点入=站点登录提示页，真实导航）
    const replyFid = (floors[0] && floors[0].fid) || (location.search.match(/fid=(\d+)/) || [])[1] || '';
    if (replyFid) {
      wrap.appendChild(el('div', { class: 'reply-main' }, [
        el('a', { class: 'reply-btn',
          href: `forum.php?mod=post&action=reply&fid=${replyFid}&tid=${(location.search.match(/tid=(\d+)/) || [])[1] || ''}&extra=&mobile=1`,
          text: '✏️ 回复本帖' }),
      ]));
    }
    wrap.appendChild(el('div', { class: 'hint', text: 'SDGun Web Access · 重绘层（真实导航）' }));

    wrap.addEventListener('click', (ev) => {
      const q = ev.target.closest && ev.target.closest('blockquote, .quote');
      if (q) q.classList.toggle('q-open');
    });

    shadow.appendChild(wrap);

    B.hideEl(container);
    const anchor0 = B.util.contentAnchor();
    if (anchor0 !== document.body) anchor0.classList.add('sdg-host');
    anchor0.appendChild(host);
    B.markActive();
    B.util.hideScaffold('viewthread');
    B.hideTrailingSiblings(anchor0);

    B.wireLightbox(shadow);
    // Batch3：导出楼层数据供右栏（楼主卡+速览）使用
    try { window.SDGRedraw.lastFloors = floors; } catch (e) { /* ignore */ }

    return true;
  }

  window.SDGRedraw = window.SDGRedraw || {};
  window.SDGRedraw.mount = mount;
})();
