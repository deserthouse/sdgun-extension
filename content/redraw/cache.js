// redraw/cache.js — 统一缓存层（A1，v1.20.0；R9 v1.20.4 序列化契约闭合 EV-01）。
// 消除散布 5 模块 × 19 处的 storage 手写调用：声明式 define(name, opts) +
// get/set/remove/clear；session+local 双写（mirror）、TTL 过期、可选 LRU 上限。
// 键序列化：`name:key`（多个逻辑组同名 key 不冲突）。
// 存储形态契约（EV-01）：值包 envelope {v, t} 恒为对象——local/sync 域直接存对象
// （chrome.storage 原生结构化克隆），仅 session 域（sessionStorage 只收字符串）做
// JSON.stringify/parse；读侧遇到非对象 envelope（历史脏数据）一律清键返回 null
// （接受一次冷缓存，不搬旧数据）。v1.20.0~1.20.3 曾 set 存字符串、get 不 parse，
// local/sync 往返恒 undefined——本契约是那次事故的根治。
// 组名唯一事实源 = GROUPS 常量，调用方禁止裸写字符串；未注册组 get/set/remove
// 一律 throw（迁移遗漏必须开发期可见，不许静默吞掉——enrich 组名错位两版未察觉的教训）。
// 同步读：session 层提供 getSync（早期同步路径专用，仅 session 域有值）。
// 注意：chrome.storage 仅扩展世界可用；页面早期同步路径用 getSync（sessionStorage 直读）。
(function () {
  'use strict';

  // 组名常量（唯一事实源；define 声明与全部调用方共用）
  const GROUPS = {
    TREE: 'tree', RIVER: 'river', HOTFEED: 'hotfeed', FEED: 'feed',
    FEEDCAT: 'feedcat', FORUMVIEW: 'forumview', THREADS: 'threads', OWNER: 'owner',
  };

  const REGISTRY = {};   // name -> opts

  function serialize(name, key) { return name + ':' + key; }

  function unregisterError(name) {
    return new Error('SDGCache: unregistered group "' + name + '"');
  }

  // 声明缓存组。opts:
  //   area: 'session'(默认) | 'local' | 'sync'
  //   mirror: 双写（session 快 + local 持久），get 优先 session
  //   ttl: 毫秒；过期读返回 null（set 时带时间戳）
  //   lru: 最大条目数（超限按 t 淘汰最旧；容量含本次键严格 = lru）
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

  function removeLocal(key) {
    try { chrome.storage.local.remove(key, () => {}); } catch (e) { /* ignore */ }
  }

  function removeSyncKey(key) {
    try { chrome.storage.sync.remove(key, () => {}); } catch (e) { /* ignore */ }
  }

  // 脏数据/过期清理：session 与所属域（或镜像）一并清，杜绝"清了又从另一域复活"
  function purge(cfg, sk) {
    try { sessionStorage.removeItem(sk); } catch (e) { /* */ }
    if (cfg.area === 'local') removeLocal(sk);
    else if (cfg.area === 'sync') removeSyncKey(sk);
    else if (cfg.mirror) removeLocal(sk);
  }

  function parseEnvelope(s) {
    try { return JSON.parse(s); } catch (e) { return null; } // null → unwrap 按脏数据清键
  }

  // envelope 契约：{v, t} 对象。非对象（历史字符串/损坏值）→ 清键返回 null
  function unwrap(raw, cfg, sk) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) { purge(cfg, sk); return null; }
    if (cfg.ttl && raw.t && Date.now() - raw.t > cfg.ttl) { purge(cfg, sk); return null; }
    return raw.v;
  }

  // get：异步（local/sync/mirror 全兼容），TTL 过期→null 并清理
  function get(name, key) {
    const cfg = REGISTRY[name];
    if (!cfg) throw unregisterError(name);
    const sk = serialize(name, key);
    if (cfg.area === 'local') {
      return readLocal(sk).then((raw) => (raw ? unwrap(raw, cfg, sk) : null));
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
        if (raw !== null) { resolve(unwrap(parseEnvelope(raw), cfg, sk)); return; }
        if (cfg.mirror) {
          readLocal(sk).then((raw2) => {
            if (raw2) {
              // local envelope 已是对象：回填 session 必须显式 stringify
              // （隐式 toString 会写成 "[object Object]"）
              try { sessionStorage.setItem(sk, JSON.stringify(raw2)); } catch (e) { /* */ }
              resolve(unwrap(raw2, cfg, sk));
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

  // set：统一入口。值包 {v, t} 对象：local/sync 直接存对象，session 存 JSON 字符串。
  // mirror 双写；LRU 淘汰（按 t 升序删最旧，容量含本次键严格 = lru）。
  function set(name, key, value) {
    const cfg = REGISTRY[name];
    if (!cfg) throw unregisterError(name);
    const sk = serialize(name, key);
    const envelope = { v: value, t: Date.now() };
    try {
      if (cfg.area === 'local') {
        writeLocal(sk, envelope);
      } else if (cfg.area === 'sync') {
        try { chrome.storage.sync.set({ [sk]: envelope }, () => {}); } catch (e) { /* */ }
      } else {
        sessionStorage.setItem(sk, JSON.stringify(envelope));
        if (cfg.mirror) writeLocal(sk, envelope);
      }
      if (cfg.lru) evictLru(cfg);
    } catch (e) { /* 存储满等静默 */ }
  }

  function evictLru(cfg) {
    if (cfg.area === 'local') return; // local 组容量上限由调用方裁剪（threads → enrich CACHE_MAX）
    try {
      const prefix = serialize(cfgName(cfg), '');
      const entries = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const k = sessionStorage.key(i);
        if (!k || !k.startsWith(prefix)) continue;
        try {
          const raw = JSON.parse(sessionStorage.getItem(k));
          entries.push({ k, t: (raw && raw.t) || 0 });
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
    if (!cfg) throw unregisterError(name);
    const sk = serialize(name, key);
    try {
      if (cfg.area === 'local') removeLocal(sk);
      else if (cfg.area === 'sync') removeSyncKey(sk);
      else {
        try { sessionStorage.removeItem(sk); } catch (e) { /* */ }
        if (cfg.mirror) removeLocal(sk); // EV-01：镜像同步清，杜绝下一次 get 从 local 复活
      }
    } catch (e) { /* */ }
  }

  // 同步读（仅 session 域；未命中返回 null——早期路径可接受）
  function getSync(name, key) {
    const cfg = REGISTRY[name];
    if (!cfg || cfg.area !== 'session') return null;
    const sk = serialize(name, key);
    try {
      const raw = sessionStorage.getItem(sk);
      if (raw === null) return null;
      const o = parseEnvelope(raw);
      if (!o || typeof o !== 'object' || Array.isArray(o)) return null;
      if (cfg.ttl && o.t && Date.now() - o.t > cfg.ttl) return null;
      return o.v;
    } catch (e) { return null; }
  }

  // ---- 声明（键语义唯一事实源）----
  define(GROUPS.TREE,      { area: 'session', mirror: true });            // 树缓存（无 TTL，会话+跨标签）
  define(GROUPS.RIVER,     { area: 'session', mirror: true });            // 公告河
  define(GROUPS.HOTFEED,   { area: 'session', mirror: true, ttl: 30 * 60e3 });   // 热帖流 30min
  define(GROUPS.FEED,      { area: 'session', ttl: 30 * 60e3 });          // 官方精选 30min
  define(GROUPS.FEEDCAT,   { area: 'session' });                          // 生效频道 id
  define(GROUPS.FORUMVIEW, { area: 'session', ttl: 5 * 60e3 });           // forumView 5min
  define(GROUPS.THREADS,   { area: 'local', ttl: 7 * 86400e3 });          // 逐帖摘要 7 天
  define(GROUPS.OWNER,     { area: 'session' });                          // 楼主身份 {uid, ev}

  window.SDGCache = { define, get, set, remove, getSync, GROUPS,
    // 兼容旧键读取（owner 迁移用）
    _rawSessionGet: (k) => { try { return sessionStorage.getItem(k); } catch (e) { return null; } },
    _rawSessionSet: (k, v) => { try { sessionStorage.setItem(k, v); } catch (e) { /* */ } } };
})();
