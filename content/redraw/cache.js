// redraw/cache.js — 统一缓存层（A1，v1.20.0）。
// 消除散布 5 模块 × 19 处的 storage 手写调用：声明式 define(name, opts) +
// get/set/remove/clear；session+local 双写（mirror）、TTL 过期、可选 LRU 上限。
// 键序列化：`name:key`（多个逻辑组同名 key 不冲突）。
// 同步读：session 层提供 getSync（boot/navguard 早期同步路径专用，仅 session 域有值）。
// 注意：chrome.storage 仅扩展世界可用；页面早期同步路径用 getSync（sessionStorage 直读）。
(function () {
  'use strict';

  const REGISTRY = {};   // name -> opts
  const MEMORY = {};     // name -> {key: {v, t}} —— session 域镜像（getSync 快路径 + 跨 local 一致性）

  function serialize(name, key) { return name + ':' + key; }

  // 声明缓存组。opts:
  //   area: 'session'(默认) | 'local' | 'sync'
  //   mirror: 双写（session 快 + local 持久），get 优先 session
  //   ttl: 毫秒；过期读返回 null（set 时带时间戳）
  //   lru: 最大条目数（超限按 t 淘汰最旧）
  function define(name, opts) {
    REGISTRY[name] = Object.assign({ area: 'session', mirror: false, ttl: 0, lru: 0 }, opts || {});
  }

  function readLocal(key) {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.get({ [key]: null }, (st) => resolve(st ? (st[key] ?? null) : null));
      } catch (e) { resolve(null); }
    });
  }

  function writeLocal(key, value) {
    try {
      if (value === null) chrome.storage.local.remove(key, () => {});
      else chrome.storage.local.set({ [key]: value }, () => {});
    } catch (e) { /* ignore */ }
  }

  // get：异步（local/sync/mirror 全兼容），TTL 过期→null 并清理
  function get(name, key) {
    const cfg = REGISTRY[name];
    if (!cfg) return Promise.resolve(null);
    const sk = serialize(name, key);
    if (cfg.area === 'local') {
      return readLocal(sk).then((raw) => {
        if (!raw) return null;
        return unwrap(raw, cfg, sk);
      });
    }
    if (cfg.area === 'sync') {
      return new Promise((resolve) => {
        try {
          chrome.storage.sync.get({ [sk]: null }, (st) => {
            const raw = st ? (st[sk] ?? null) : null;
            resolve(raw ? unwrap(raw, cfg, sk) : null);
          });
        } catch (e) { resolve(null); }
      });
    }
    // session + mirror
    return new Promise((resolve) => {
      try {
        const raw = sessionStorage.getItem(sk);
        if (raw !== null) { resolve(unwrap(JSON.parse(raw), cfg, sk)); return; }
        if (cfg.mirror) {
          readLocal(sk).then((raw2) => {
            if (raw2) {
              try { sessionStorage.setItem(sk, raw2); } catch (e) { /* */ }
              resolve(unwrap(JSON.parse(raw2), cfg, sk));
              return;
            }
            resolve(null);
          });
          return;
        }
        resolve(null);
      } catch (e) { resolve(null); }
    });
  }

  function unwrap(raw, cfg, sk) {
    if (cfg.ttl && raw.t && Date.now() - raw.t > cfg.ttl) {
      try { sessionStorage.removeItem(sk); } catch (e) { /* */ }
      if (cfg.mirror) writeLocal(sk, null);
      return null;
    }
    return raw.v;
  }

  // set：统一入口。值包 {v, t}；mirror 双写；LRU 淘汰（按 t 升序删最旧）。
  function set(name, key, value) {
    const cfg = REGISTRY[name];
    if (!cfg) return;
    const sk = serialize(name, key);
    const raw = JSON.stringify({ v: value, t: Date.now() });
    try {
      if (cfg.area === 'local') {
        writeLocal(sk, raw);
      } else if (cfg.area === 'sync') {
        try { chrome.storage.sync.set({ [sk]: raw }, () => {}); } catch (e) { /* */ }
      } else {
        sessionStorage.setItem(sk, raw);
        if (cfg.mirror) writeLocal(sk, raw);
      }
      if (cfg.lru) evictLru(cfg, sk);
    } catch (e) { /* 存储满等静默 */ }
  }

  function evictLru(cfg, skKeep) {
    if (cfg.area === 'local') return; // 本扩展 local 组均走 LRU 语义由调用方容量上限控制，暂不遍历
    try {
      const entries = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const k = sessionStorage.key(i);
        if (!k || !k.startsWith(cfgName(cfg) + ':') || k === skKeep) continue;
        try {
          const raw = JSON.parse(sessionStorage.getItem(k));
          entries.push({ k, t: raw.t || 0 });
        } catch (e) { /* */ }
      }
      if (entries.length <= cfg.lru) return;
      entries.sort((a, b) => a.t - b.t);
      for (const e of entries.slice(0, entries.length - cfg.lru)) sessionStorage.removeItem(e.k);
    } catch (e) { /* */ }
  }

  function cfgName(cfg) {
    for (const [name, o] of Object.entries(REGISTRY)) if (o === cfg) return name;
    return '';
  }

  function remove(name, key) {
    const cfg = REGISTRY[name];
    if (!cfg) return;
    const sk = serialize(name, key);
    try {
      if (cfg.area === 'local') writeLocal(sk, null);
      else if (cfg.area === 'sync') { try { chrome.storage.sync.remove(sk, () => {}); } catch (e) { /* */ } }
      else sessionStorage.removeItem(sk);
    } catch (e) { /* */ }
  }

  // 同步读（仅 session 域有内存镜像；未命中返回 null——早期路径可接受）
  function getSync(name, key) {
    const cfg = REGISTRY[name];
    if (!cfg || cfg.area !== 'session') return null;
    const sk = serialize(name, key);
    try {
      const raw = sessionStorage.getItem(sk);
      if (raw === null) return null;
      const o = JSON.parse(raw);
      if (cfg.ttl && o.t && Date.now() - o.t > cfg.ttl) return null;
      return o.v;
    } catch (e) { return null; }
  }

  // ---- 声明（键语义唯一事实源；详见 self_review 执行排期表）----
  define('tree',   { area: 'session', mirror: true });            // 树缓存（无 TTL，会话+跨标签）
  define('river',  { area: 'session', mirror: true });            // 公告河
  define('hotfeed',{ area: 'session', mirror: true, ttl: 30 * 60e3 });   // 热帖流 30min
  define('feed',   { area: 'session', ttl: 30 * 60e3 });          // 官方精选 30min
  define('feedcat',{ area: 'session' });                          // 生效频道 id
  define('forumview', { area: 'session', ttl: 5 * 60e3 });        // forumView 5min
  define('threads',{ area: 'local', ttl: 7 * 86400e3 });          // 逐帖摘要 7 天（旧 sdg_tx_cache_v2）
  define('owner',  { area: 'session' });                          // 楼主身份 {uid, ev}

  window.SDGCache = { define, get, set, remove, getSync,
    // 兼容旧键读取（owner 迁移用）
    _rawSessionGet: (k) => { try { return sessionStorage.getItem(k); } catch (e) { return null; } },
    _rawSessionSet: (k, v) => { try { sessionStorage.setItem(k, v); } catch (e) { /* */ } } };
})();
