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
    const timer = setTimeout(() => ctl.abort(), TIMEOUT);
    const url = new URL(base + path);
    for (const [k, v] of Object.entries(params || {})) {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
    }
    return fetch(url.toString(), {
      method: 'GET',
      credentials: 'omit',
      signal: ctl.signal,
      headers: { 'Accept': 'application/json' },
    }).then((r) => {
      clearTimeout(timer);
      if (!r.ok) return null;
      return r.json();
    }).then((d) => {
      if (!d || d.success !== true) return null;
      return d;
    }).catch(() => null);
  }

  // ---- 板块帖子列表：每帖 tid/标题/类型 typeid/封面 pics[]/视频/作者+头像/查看(格式化)/
  //      回复数/相对时间 dateline/unix last_reply_time/is_top/applaud_count，20 条/页 ----
  function forumView(fid, page, order, type) {
    return get(APP, '/mag/circle/v1/forum/forumView', {
      fid, p: page || 1, step: 20, order: order || '', type: type || '',
    }).then((d) => (d && Array.isArray(d.list) ? d.list : null));
  }

  // ---- 全量楼层：每楼点赞数/头像/结构化内容/楼层号；authorid=只看楼主 ----
  function commentList(tid, page, authorid) {
    return get(APP, '/mag/circle/v1/Forum/commentList', {
      tid, page: page || 1, step: 10, order: 2, authorid: authorid || 0,
    }).then((d) => (d && Array.isArray(d.list) ? d.list : null));
  }

  // ---- 官方资讯流（mag1，纯浏览器头游客可读）----
  function feed(catId, page) {
    return get(MAG1, '/mag/info/v2/channel/infoListByCatId', {
      cat_id: catId || 1, step: 1, p: page || 1,
    }).then((d) => (d && Array.isArray(d.list) ? d.list : null));
  }

  // ---- 行数据升级（forumdisplay 消费）：按 tid 建索引，只保留渲染需要的字段 ----
  function indexThreads(list) {
    const map = {};
    for (const it of list || []) {
      if (it && it.tid != null) map[String(it.tid)] = {
        cover: (Array.isArray(it.pics) && it.pics[0]) || '',
        videos: Array.isArray(it.videos) ? it.videos.length : 0,
        authorHead: it.user_head || '',
        click: String(it.click || '').replace(/阅读$/, ''),
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

  window.SDGApi = { forumView, commentList, feed, indexThreads, _get: get };
})();
