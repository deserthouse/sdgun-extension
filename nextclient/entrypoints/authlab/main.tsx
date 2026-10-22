// E00-1 实验页：从扩展 origin 对回显端点发两种请求（XHR 命中面 / img 类型），
// 结果写进 window.__lab 供 Playwright 驱动读取。不发任何真实站点请求（真服务端
// 回读由 Python 驱动单独触发，本页只做回显矩阵）。
import { browser } from 'wxt/browser';

const ECHO = 'http://127.0.0.1:8777/echo';

async function fetchEcho(): Promise<Record<string, string>> {
  const r = await fetch(ECHO, { cache: 'no-store' });
  return (await r.json()) as Record<string, string>;
}

async function imgEcho(): Promise<boolean> {
  return new Promise((resolve) => {
    const im = new Image();
    im.onload = () => resolve(true);
    im.onerror = () => resolve(true); // 回显非图片必 error，但请求已发出并计账
    im.src = ECHO + '?via=img&t=' + Date.now();
  });
}

declare global {
  interface Window {
    __lab: {
      run: () => Promise<{ xhr: Record<string, string>; viaImgDone: boolean }>;
      startRules: (host: string, path: string, epoch: string) => Promise<unknown>;
      stopRules: () => Promise<unknown>;
      extId: string;
    };
  }
}

window.__lab = {
  run: async () => ({ xhr: await fetchEcho(), viaImgDone: await imgEcho() }),
  startRules: (host, path, epoch) =>
    browser.runtime.sendMessage({ type: 'authRules:start', host, path, epoch }),
  stopRules: () => browser.runtime.sendMessage({ type: 'authRules:stop' }),
  extId: browser.runtime.id,
};
