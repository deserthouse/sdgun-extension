// redraw/forumlist.js — 版块首页分组卡片重绘（三 profile 解析 + mountForumList）。
// 依赖：redraw/base.js（先加载）。挂载入口挂到 window.SDGRedraw.mountForumList。
// 三 profile 覆盖三种服务器形态：bygsjw 富模板 → Discuz 标准移动（div.bm）→ h2 走查兜底。
(function () {
  'use strict';
  const B = window.SDGRedrawBase;
  // 树内容指纹：跨标签副本写 storage.local 的去重依据（见下方写入处）
  let lastTreeKey = '';

  function mountForumList(SDG, opts, cachedGroups) {
    // profile 1: bygsjw 富模板（分组容器 data-byginto）
    let data = [];
    document.querySelectorAll(SDG.forumList.group).forEach((g) => {
      const name = (g.querySelector(SDG.forumList.groupName) || {}).textContent || '';
      const secs = [];
      g.querySelectorAll('li.cl').forEach((li) => {
        const a = li.querySelector(SDG.forumList.sectionLink);
        if (!a) return;
        const fid = (a.getAttribute('href').match(/fid=(\d+)/) || [])[1];
        const icon = li.querySelector('.forum_img img');
        const nm = (icon && icon.getAttribute('alt')) || (a.textContent || '').trim();
        const nums = [...li.querySelectorAll('.forum_num, .num_em, em, span')].map((n) => (n.textContent || '').replace(/\s+/g, '')).filter((s) => /[\d]/.test(s) && s.length <= 8);
        if (fid) secs.push({ fid, name: nm, icon: icon ? icon.getAttribute('src') : '', nums });
      });
      if (secs.length) data.push({ name: name.trim(), secs });
    });

    // profile 2: Discuz 标准移动模板（div.bm / .bm_h 分组 / .bm_c 版块，用户实机样本 2026-10-01）
    if (!data.length) {
      document.querySelectorAll('div.bm').forEach((bm) => {
        const nameEl = bm.querySelector('.bm_h');
        const name = nameEl ? (nameEl.textContent || '').replace(/\s+/g, ' ').trim() : '';
        const secs = [];
        bm.querySelectorAll('a[href*="mod=forumdisplay"]').forEach((a) => {
          const fid = (a.getAttribute('href').match(/fid=(\d+)/) || [])[1];
          if (!fid) return;
          const nm = (a.textContent || '').replace(/\s+/g, ' ').trim();
          const cntEl = a.parentElement.querySelector('.xg1');
          const cnt = cntEl ? (cntEl.textContent || '').replace(/[()（）\s]/g, '') : '';
          secs.push({ fid, name: nm, icon: '', nums: cnt ? [cnt] : [] });
        });
        if (name || secs.length) data.push({ name, secs });
      });
    }

    // profile 3: h2 分组走查（其他未知变体兜底）
    if (!data.length) {
      const els = document.querySelectorAll(SDG.h2walk.groupHeader + ', ' + SDG.h2walk.sectionLink);
      let cur = null;
      const simple = [];
      els.forEach((n) => {
        if (n.tagName === 'H2') {
          if (cur && cur.secs.length) simple.push(cur);
          const nm = (n.textContent || '').replace(/\s+/g, ' ').trim();
          cur = nm ? { name: nm, secs: [] } : null;
          return;
        }
        if (!cur) return;
        const href = n.getAttribute('href') || '';
        const fid = (href.match(/fid=(\d+)/) || [])[1];
        if (!fid) return;
        const name = (n.textContent || '').replace(/\s+/g, ' ').trim();
        if (!name) return;
        const parentTxt = (n.parentElement ? n.parentElement.textContent : '') || '';
        const cnt = (parentTxt.match(/\((\d+)\)/) || [])[1];
        const icon = n.querySelector ? n.querySelector('img') : null;
        cur.secs.push({ fid, name, icon: icon ? icon.getAttribute('src') : '', nums: cnt ? [cnt] : [] });
      });
      if (cur && cur.secs.length) simple.push(cur);
      data = simple;
    }
    // P0-2：live 解析为空 + 会话缓存可用 → 渲染缓存树（服务器壳态降级，标注缓存）
    let fromCache = false;
    if (!data.length && cachedGroups && cachedGroups.length) {
      data = cachedGroups;
      fromCache = true;
    }
    if (!data.length) return false;
    // live 解析成功 → 写会话缓存（供壳态降级用）
    if (!fromCache) {
      const contentKey = JSON.stringify(data.map((g) => ({ name: g.name, secs: g.secs })));
      // A1（v1.20.0）：SDGCache tree 组（session+mirror 双写；rightrail/sidebar 读侧）
      // 内容未变则不重写：mirror 写 storage.local 会触发 boot 的 onChanged 重挂载循环（2026-10-08 事故）
      if (contentKey !== lastTreeKey) {
        lastTreeKey = contentKey;
        if (window.SDGCache) window.SDGCache.set('tree', 'all', data.map((g) => ({ name: g.name, secs: g.secs })));
      }
    }
    // 简易变体的原列表容器（如 #forumlist）在渲染后隐藏
    const legacyList = document.getElementById(SDG.legacyListId);
    if (legacyList) B.hideEl(legacyList);

    const el = B.el;
    const host = document.createElement('div');
    host.id = 'sdg-redraw-list';
    host.classList.add('sdg-host');
    const shadow = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = B.LIST_CSS;
    shadow.appendChild(style);
    if (opts.dark) host.classList.add('dark');

    const wrap = el('div', { class: 'wrap' });
    wrap.appendChild(el('div', { class: 'topbar' }, [el('div', { class: 'tb-in' }, [
      el('a', { class: 'title', text: '论坛首页', href: '#' }),
      el('a', { class: 'qk', text: '搜索', href: 'search.php?mod=forum&mobile=2' }),
      el('a', { class: 'qk', text: '登录', href: 'member.php?mod=logging&action=login&mobile=2' }),
    ])]));
    // 站点统计条（bygsjw .byg_tongji）——数据在场才渲染。
    // 原始文案是"今日 13113 帖子 22840833 会员 678420"连排（v1.16.2 规范化：
    // 标签配对 + 分隔点 + 大数万化），解析不出任何标签则按原文截断兜底。
    const tongji = document.querySelector('.byg_tongji');
    if (tongji) {
      const txt = (tongji.textContent || '').replace(/\s+/g, ' ').trim();
      if (txt) {
        const fmtNum = (s) => {
          const n = parseInt(s.replace(/[^\d]/g, ''), 10);
          if (isNaN(n)) return s;
          if (n >= 100000) {
            const w = n / 10000;
            return (w < 100 ? Math.round(w * 10) / 10 : Math.round(w)) + '万';
          }
          return n.toLocaleString('en-US');
        };
        const parts = [];
        ['今日', '主题', '帖子', '会员'].forEach((label) => {
          const m = txt.match(new RegExp(label + '[::\\s]*([0-9万亿.,]+)'));
          if (m) parts.push(label + ' ' + fmtNum(m[1]));
        });
        const nw = txt.match(/欢迎新会员[:\s]*([^\s·]{1,24})/);
        if (nw) parts.push('新会员 ' + nw[1]);
        wrap.appendChild(el('div', { class: 'statsbar',
          text: parts.length ? parts.join(' · ').slice(0, 100) : txt.slice(0, 80) }));
      }
    }

    data.forEach((grp) => {
      if (!grp.secs.length) return;
      wrap.appendChild(el('div', { class: 'group-title', text: grp.name }));
      const card = el('div', { class: 'card' });
      grp.secs.forEach((s) => {
        const row = el('a', { class: 'section-row', href: `forum.php?mod=forumdisplay&fid=${s.fid}&mobile=2` });
        if (s.icon) row.appendChild(el('img', { class: 'icon', src: s.icon, alt: '',
          onerror: function () {
            // 服务端图标缺失（实测：卫星区 common_153_icon.png 404）→ 回退模板默认图，再失败才隐去
            if (this.dataset.fb) { this.style.display = 'none'; return; }
            this.dataset.fb = '1';
            const fb = SDG.assets && SDG.assets.defaultBoardIcon;
            if (fb) this.src = fb; else this.style.display = 'none';
          } }));
        const mid = el('div', { class: 's-name' }, [el('span', { text: s.name })]);
        const uniq = [...new Set(s.nums)];
        if (uniq.length) mid.appendChild(el('span', { class: 'meta',
          text: uniq.length >= 2 ? `主题 ${uniq[0]} · 帖 ${uniq[1]}` : uniq[0] }));
        row.appendChild(mid);
        card.appendChild(row);
      });
      wrap.appendChild(card);
    });
    wrap.appendChild(el('div', { class: 'hint',
      text: fromCache ? 'SDGun Web Access · 缓存内容（服务器未响应完整页面，点击卡片重新加载）'
                      : 'SDGun Web Access · 重绘层' }));

    shadow.appendChild(wrap);
    // 隐藏原列表但保留结构
    document.querySelectorAll('ul.byg_threadlist_ul, .sub_forum').forEach(B.hideEl);
    const anchor = B.util.contentAnchor();
    if (anchor !== document.body) anchor.classList.add('sdg-host');
    anchor.appendChild(host);
    B.markActive();
    B.util.hideScaffold('standard');
    B.hideTrailingSiblings(anchor);
    // 异步三块：内容河（E-10 开关门控）/ 热帖速览 / 官方编辑流——
    // A2（v1.20.0）拆分为 river/hotfeed/feed 独立文件，共用单一页面 scope（ER-01：注册一次）
    if (opts.enrich !== false && window.SDGScope) {
      const scope = window.SDGScope.register(window.SDGScope.create());
      if (window.SDGRedraw.mountRiver) window.SDGRedraw.mountRiver(el, wrap, opts, scope, false);
      if (window.SDGRedraw.mountHotFeed) window.SDGRedraw.mountHotFeed(el, wrap, opts, data, SDG, scope);
      if (window.SDGRedraw.mountFeed) window.SDGRedraw.mountFeed(el, wrap, opts, scope);
    }
    return true;
  }

  window.SDGRedraw = window.SDGRedraw || {};
  window.SDGRedraw.mountForumList = mountForumList;
})();
