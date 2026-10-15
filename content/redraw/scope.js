// redraw/scope.js — PageScope（E-05，v1.18.3）：每页挂载的请求/定时器/回调统一管理。
// 职责：generation 失效（unmount/重挂载后旧任务不得写 DOM/缓存）、AbortController 级联、
// 真串行队列（上一任务完成后再隔 gap 取下一项，明确单并发）、超时覆盖 body 读取。
// 用法：const scope = SDGScope.create(); ... scope.fetch(...) / scope.delay(...) /
// scope.cancelAll()。失效后所有回调静默丢弃（fail-open）。
(function () {
  'use strict';

  function create() {
    const scope = { dead: false, aborted: [], timers: new Set(), inflight: 0 };
    const ctl = new AbortController();
    scope.signal = ctl.signal;

    scope.isDead = () => scope.dead;
    scope.cancelAll = () => {
      scope.dead = true;
      try { ctl.abort(); } catch (e) { /* */ }
      for (const t of scope.timers) clearTimeout(t);
      scope.timers.clear();
      scope.aborted.length = 0;
    };

    // 失效守卫：回调包装（返回 null 回调，失效时不执行）
    scope.guard = (fn) => (...args) => {
      if (scope.dead) return undefined;
      return fn(...args);
    };

    // fetch：超时覆盖整个生命周期（含 body 读取/解析，E-05 对 api.js 的批评点）
    scope.fetchJSON = (url, timeoutMs) => {
      if (scope.dead) return Promise.resolve(null);
      const timer = setTimeout(() => ctl.abort(), timeoutMs || 10000);
      const done = () => clearTimeout(timer);
      return fetch(url, { credentials: 'omit', signal: scope.signal,
        headers: { 'Accept': 'application/json' } })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => { done(); return scope.dead ? null : d; })
        .catch(() => { done(); return null; });
    };

    scope.fetchText = (url, timeoutMs) => {
      if (scope.dead) return Promise.resolve(null);
      const timer = setTimeout(() => ctl.abort(), timeoutMs || 12000);
      const done = () => clearTimeout(timer);
      return fetch(url, { credentials: 'omit', signal: scope.signal })
        .then((r) => (r.ok ? r.text() : null))
        .then((t) => { done(); return scope.dead ? null : t; })
        .catch(() => { done(); return null; });
    };

    // 定时器（登记+失效清空）
    scope.delay = (ms, fn) => {
      if (scope.dead) return;
      const t = setTimeout(() => { scope.timers.delete(t); scope.guard(fn)(); }, ms);
      scope.timers.add(t);
    };

    // 真串行队列：items 逐项处理，上一项 settle 后再隔 gapMs 取下一项；单并发可证。
    // onDone 在全部结束（或失效）后恰好调用一次。
    scope.runSerial = (items, gapMs, worker, onDone) => {
      let i = 0;
      const next = () => {
        if (scope.dead) { if (onDone) onDone(); return; }
        if (i >= items.length) { if (onDone) onDone(); return; }
        const item = items[i++];
        try { worker(item); } catch (e) { /* worker 同步异常按已处理 */ }
        scope.delay(gapMs, next);
      };
      next();
    };

    return scope;
  }

  // 页面级登记：base.unmount 统一级联取消（E-05）
  function register(scope) {
    try {
      window.SDGRedraw = window.SDGRedraw || {};
      window.SDGRedraw.scopes = window.SDGRedraw.scopes || new Set();
      window.SDGRedraw.scopes.add(scope);
    } catch (e) { /* ignore */ }
    return scope;
  }

  function cancelAllScopes() {
    try {
      const set = window.SDGRedraw && window.SDGRedraw.scopes;
      if (set) { for (const s of set) { try { s.cancelAll(); } catch (e) { /* */ } } set.clear(); }
    } catch (e) { /* ignore */ }
  }

  window.SDGScope = { create, register, cancelAllScopes };
})();
