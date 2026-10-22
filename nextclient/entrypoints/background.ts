// E00-1 认证头实验：SW 侧 DNR session 规则管理（假 token，仅实验）。
// 验证目标（work_plan N-1）：
//   ① 扩展 origin 发起、精确 host+path 命中时 User-Agent 被 rewrite 为 MAGAPPX 形态；
//   ② 非扩展 initiator 同路径头不在场（initiatorDomains 隔离）；
//   ③ 图片类型不命中（resourceTypes 仅 xmlhttprequest）；
//   ④ epoch 栅栏：停止即清空 session 规则（getSessionRules 归零）。
// initiatorDomains 以 chrome.runtime.id 为成员——"Chrome 把扩展 origin 视作以其 id
// 参与 initiator 域匹配"正是 E00-1 要实证的假设；若断言 ② 失败即构成 Chrome 限制证据。
import { browser } from 'wxt/browser';
import { magUa, newUtdid } from '../lib/guestua';

const MAGAPPX_UA =
  'Mozilla/5.0 (Linux; Android 15; SDG-G0-LAB) AppleWebKit/537.36 (KHTML, like Gecko) ' +
  'Version/4.0 Chrome/124.0.0.0 Mobile Safari/537.36 MAGAPPX/2.9.0/30042/FAKE_TOKEN_G0_LAB/client';

type LabMsg =
  | { type: 'authRules:start'; host: string; path: string; epoch: string }
  | { type: 'authRules:stop' }
  | { type: 'lab:probe' }
  | { type: 'epoch:start'; epoch: string; token?: string }
  | { type: 'epoch:stop' }
  | { type: 'epoch:probe' }
  | { type: 'auth:activate'; token: string }
  | { type: 'auth:deactivate' };

async function installUaRules(utdid: string, token?: string): Promise<void> {
  const ua = magUa(utdid, token);
  await browser.declarativeNetRequest.updateSessionRules({
    removeRuleIds: [9101, 9102],
    addRules: [9101, 9102].map((id, i) => ({
      id,
      priority: 1,
      action: {
        type: 'modifyHeaders' as never,
        requestHeaders: [
          { header: 'User-Agent', operation: 'set' as never, value: ua },
        ],
      },
      condition: {
        urlFilter: i === 0 ? '||app.sdgun.com.cn/mag/' : '||mag1.sdgun.net/mag/',
        resourceTypes: ['xmlhttprequest' as never],
        initiatorDomains: [browser.runtime.id],
      },
    })),
  });
}

export default defineBackground(() => {
  // N-4：会话状态只住 storage.session（SW 重启可重建、浏览器重启归零），
  // 模块级不持任何可变状态（强停后旧内存态自然丢弃=epoch 栅栏的另一半）。
  browser.runtime.onMessage.addListener(async (msg: LabMsg) => {
    if (msg.type === 'authRules:start') {
      try {
        await browser.declarativeNetRequest.updateSessionRules({
          removeRuleIds: [9001],
          addRules: [{
            id: 9001,
            priority: 1,
            action: {
              type: 'modifyHeaders' as never,
              requestHeaders: [
                { header: 'User-Agent', operation: 'set' as never, value: MAGAPPX_UA },
              ],
            },
            condition: {
              urlFilter: `||${msg.host}${msg.path}`,
              resourceTypes: ['xmlhttprequest' as never],
              initiatorDomains: [browser.runtime.id], // ②：非扩展 initiator 不命中
            },
          }],
        });
        await browser.storage.session.set({ epoch: msg.epoch, setAt: Date.now() });
        return { ok: true, epoch: msg.epoch, uaTail: MAGAPPX_UA.split('/').pop() };
      } catch (e) {
        return { ok: false, error: String(e) };
      }
    }
    if (msg.type === 'authRules:stop') {
      await browser.declarativeNetRequest.updateSessionRules({ removeRuleIds: [9001] });
      const rules = await browser.declarativeNetRequest.getSessionRules();
      return { ok: true, remaining: rules.length };
    }
    if (msg.type === 'lab:probe') {
      const st = await browser.storage.session.get(['epoch', 'setAt']);
      const rules = await browser.declarativeNetRequest.getSessionRules();
      return {
        ok: true,
        epoch: st.epoch ?? null,
        setAt: st.setAt ?? null,
        rulesCount: rules.length,
      };
    }
    // ---- E1-2/E1-5 会话 epoch（产品命名空间；模式=E00-4 验证口径）----
    // epoch:start：记账入 storage.session + 安装游客 UA 规则（app 域 WAF 丢弃非
    // MAGAPPX UA 连接，E00-1/E1-5 双实证；游客 UA 无凭据——合成 utdid+公开盐）。
    // epoch:stop：清账 + 清全部会话规则（9001 认证实验/9101 app/9102 mag1 游客）。
    if (msg.type === 'epoch:start') {
      const st0 = await browser.storage.sync.get({ 'sdg2.utdid': null });
      let utdid = st0['sdg2.utdid'] as string | null;
      if (!utdid) {
        utdid = newUtdid();
        await browser.storage.sync.set({ 'sdg2.utdid': utdid });
      }
      const authSt = await browser.storage.session.get({ 'auth.current': null });
      const token = msg.token
        ?? ((authSt['auth.current'] as { token?: string } | null)?.token) ?? undefined;
      await installUaRules(utdid, token);
      await browser.storage.session.set({ 'epoch.current': msg.epoch, 'epoch.setAt': Date.now() });
      const rules = await browser.declarativeNetRequest.getSessionRules();
      return { ok: true, epoch: msg.epoch, rulesCount: rules.length };
    }
    if (msg.type === 'epoch:stop') {
      await browser.storage.session.remove(['epoch.current', 'epoch.setAt']);
      await browser.declarativeNetRequest.updateSessionRules({ removeRuleIds: [9001, 9101, 9102] });
      return { ok: true };
    }
    // ---- E1-6 登录态：epoch 存活期内把会话 UA 升级为携带 token 的登录态（或降回游客）----
    if (msg.type === 'auth:activate') {
      const st0 = await browser.storage.sync.get({ 'sdg2.utdid': null });
      const utdid = (st0['sdg2.utdid'] as string | null) ?? newUtdid();
      await installUaRules(utdid, msg.token);
      return { ok: true };
    }
    if (msg.type === 'auth:deactivate') {
      const st0 = await browser.storage.sync.get({ 'sdg2.utdid': null });
      const utdid = (st0['sdg2.utdid'] as string | null) ?? newUtdid();
      await installUaRules(utdid); // 降回游客 UA（无凭据）
      return { ok: true };
    }
    if (msg.type === 'epoch:probe') {
      const st = await browser.storage.session.get(['epoch.current', 'epoch.setAt']);
      const rules = await browser.declarativeNetRequest.getSessionRules();
      return {
        ok: true,
        epoch: (st['epoch.current'] as string) ?? null,
        rulesCount: rules.length,
      };
    }
    return undefined;
  });
});
