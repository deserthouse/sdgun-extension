// 会话 epoch 客户端 API（E1-2；模式=E00-4 验证口径的泛化）：
// epoch 记账住 storage.session（SW 重启可重建、浏览器重启归零），
// 认证 DNR 规则浏览器托管；撤权=清账+清规则（E1-6 收口断言口径）。
import { browser } from 'wxt/browser';

export interface EpochProbe {
  ok: boolean;
  epoch: string | null;
  rulesCount: number;
}

export function epochStart(epoch: string): Promise<unknown> {
  return browser.runtime.sendMessage({ type: 'epoch:start', epoch });
}

export function epochStop(): Promise<unknown> {
  return browser.runtime.sendMessage({ type: 'epoch:stop' });
}

export function epochProbe(): Promise<EpochProbe> {
  return browser.runtime.sendMessage({ type: 'epoch:probe' });
}
