// 新旧调度开关（E1-3）：storage.sync 单键，默认关（旧重绘为默认站点 UI）。
// 契约：
//   - 键 sdg2.client.enabled，布尔；缺失=false。
//   - client 页面自身永远可用（开关只影响站点接管，不影响自有页）。
//   - 合并构建（G2 前）时：content script 在 document_start 读本键决定旧重绘是否挂载
//     （开=旧重绘不挂载、由新版接管；关=现状）——两渲染器不得同时绑定同一 DOM。
import { browser } from 'wxt/browser';

const KEY = 'sdg2.client.enabled';

export async function takeoverEnabled(): Promise<boolean> {
  const st = await browser.storage.sync.get({ [KEY]: false });
  return st[KEY] === true;
}

export async function setTakeoverEnabled(v: boolean): Promise<void> {
  await browser.storage.sync.set({ [KEY]: v });
}
