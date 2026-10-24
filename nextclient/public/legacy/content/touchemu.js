// touchemu.js — MAIN world（页面 JS 上下文）document_start。
// 根因（2026-10-04 读源定案）：bygsjw 模板 common.js 第二行
//   var supporttouch = "ontouchend" in document;
//   !supporttouch && (window.location.href = 'forum.php?mobile=1');
// 桌面浏览器即使带手机 UA 也没有 ontouchend → 必触发丢参跳转（fid/tid/mod 全丢）。
// 此处在页面脚本执行前给 document 定义该属性，让模板按触摸设备对待：
// 跳转分支不执行，common.js 其余功能（含壳形态的内容注入）正常保留。
(function () {
  'use strict';
  try {
    if (!('ontouchend' in document)) {
      Object.defineProperty(document, 'ontouchend', { value: null, configurable: true });
    }
  } catch (e) { /* 定义失败则回退 navguard 兜底 */ }
})();
