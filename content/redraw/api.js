// redraw/api.js — magapp wap API 薄客户端（v1.18.0）。
// 数据源：https://app.sdgun.com.cn（CORS=*，内容脚本直连）+ https://mag1.sdgun.net（资讯族）。
// 游客 JSON、无凭据、无身份头；全部 fail-open（任何失败返回 null，调用方回落页面解析路径）。
// 预算纪律：调用方各自硬顶+缓存（见 docs/wap_api_integration_plan_2026-10-10.md）。
(function () {
  'use strict';

  const APP = 'https://app.sdgun.com.cn';
  const MAG1 = 'https://mag1.sdgun.net';
  const TIMEOUT = 10000;

  function get(base, path, params) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), TIMEOUT); // ER-05：覆盖含 body 读取的全程
    const url = new URL(base + path);
    for (const [k, v] of Object.entries(params || {})) {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
    }
    const done = () => clearTimeout(timer);
    return fetch(url.toString(), {
      method: 'GET',
      credentials: 'omit',
      signal: ctl.signal,
      headers: { 'Accept': 'application/json' },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { done(); return (d && d.success === true) ? d : null; })
      .catch(() => { done(); return null; });
  }

  // ---- 板块帖子列表：每帖 tid/标题/类型 typeid/封面 pics[]/视频/作者+头像/查看(格式化)/
  //      回复数/相对时间 dateline/unix last_reply_time/is_top/applaud_count，20 条/页 ----
  function forumView(fid, page, order, type) {
    return get(APP, '/mag/circle/v1/forum/forumView', {
      fid, p: page || 1, step: 20, order: order || '', type: type || '',
    }).then((d) => (d && Array.isArray(d.list) ? d.list : null));
  }

  // ---- 全量楼层：每楼点赞数/头像/结构化内容/楼层号；authorid=只看楼主。
  // E-15（2026-10-15 补测）：服务端只认 p 翻页（page 参数被忽略恒回第 1 页），
  // step 为响应下限（实测请求 step=2 得 50 条）——调用方以返回的 meta 为准，勿按 rows.length 判末页 ----
  function commentList(tid, page, authorid) {
    return get(APP, '/mag/circle/v1/Forum/commentList', {
      tid, p: page || 1, step: 10, order: 2, authorid: authorid || 0,
    }).then((d) => {
      if (!d || !Array.isArray(d.list)) return null;
      return {
        rows: d.list,
        meta: {
          page: d.page, step: d.step, count: d.count, totalPage: d.total_page,
        },
      };
    });
  }

  // ---- 官方资讯流（mag1，纯浏览器头游客可读）。EF-01 实测（2026-10-15）：
  // 仅 v2/cat=1 可用（cat=108 空、v3 拒绝）；step 控制条数（服务端上限 20）。
  // 返回顶层 list（含 title/pics_arr/三计数/publish_time_str/link 标签等）----
  function feed(catId, page, step) {
    return get(MAG1, '/mag/info/v2/channel/infoListByCatId', {
      cat_id: catId || 1, step: step || 20, p: page || 1,
    }).then((d) => (d && Array.isArray(d.list) ? d.list : null));
  }

  // ---- Mixed Content 修复（v1.20.2）：站方 API 下发图片 URL 是 http://，HTTPS 页面加载被浏览器拦截 ----
  function httpsImg(u) {
    if (typeof u !== 'string') return u;
    return u.replace(/^http:\/\/(picapp\.sdgun\.net|bbs\.sdgun\.com\.cn)\//i, 'https://$1/');
  }

  // ---- 缩略图参数（v1.20.2）：picapp 是七牛 CDN——原图 1280px/100KB+ 每张加载慢；
  // imageView2/2/w/240 实测返回 6~23KB 缩略图（毫秒级），热帖/列表卡均用此小图 ----
  function thumbUrl(u, w) {
    u = httpsImg(u);
    if (!u || !u.includes('picapp.sdgun.net')) return u; // 非七牛域不动
    return u + (u.includes('?') ? '&' : '?') + 'imageView2/2/w/' + (w || 240);
  }

  // ---- 万单位解析（E-09）：'1.4万'→14000、'28'→28、'28阅读'→28；无法解析→0 ----
  function parseWan(s) {
    const t = String(s == null ? '' : s).trim();
    const m = t.match(/^([\d.]+)\s*万/);
    if (m) return Math.round(parseFloat(m[1]) * 10000);
    const n = parseInt(t.replace(/[^\d]/g, ''), 10);
    return isNaN(n) ? 0 : n;
  }

  // ---- 行数据升级（forumdisplay 消费）：按 tid 建索引，只保留渲染需要的字段。
  // click 保留格式化字符串（"1.4万"/"28"）用于渲染；数值请用 parseWan ----
  function indexThreads(list) {
    const map = {};
    for (const it of list || []) {
      if (it && it.tid != null) map[String(it.tid)] = {
        cover: thumbUrl((Array.isArray(it.pics) && it.pics[0]) || '', 240),
        pics: (Array.isArray(it.pics) ? it.pics : []).slice(0, 3).map((u) => thumbUrl(u, 240)),
        videos: Array.isArray(it.videos) ? it.videos.length : 0,
        authorHead: httpsImg(it.user_head || ''),
        click: String(it.click || '').replace(/阅读\s*$/, ''),
        replies: String(it.reply_count || '').replace(/\D/g, ''),
        relative: it.dateline || '',
        lastpost: it.last_reply_time || '',
        applaud: String(it.applaud_count || '').replace(/\D/g, ''),
        typeid: it.typeid || '',
        isTop: it.is_top === 1,
      };
    }
    return map;
  }

  window.SDGApi = { forumView, commentList, feed, indexThreads, parseWan, _get: get };
})();
