// 登录态（E1-6）：登录/账号信息/退出。
// 语义（总设计 §4/F32）：token 只住 storage.session（浏览器重启即登出，设计如此）；
// 退出=清账+清规则+清 auth；登录 UA 由 SW 的 DNR token 规则注入（fetch 不可设 UA 头）。
import { browser } from 'wxt/browser';
import { magSsKey, LOGIN_URL, USERINFO_URL, encryptPassword } from './rsa';

// 测试缝：与 broker 同一 override 源（localStorage），离线驱动可重定向认证端点
function resolveUrl(url: string): string {
  try {
    const override = localStorage.getItem('sdg2.hostOverride');
    if (!override) return url;
    const u = new URL(url);
    return override + u.pathname;
  } catch {
    return url;
  }
}

export interface AuthInfo {
  token: string;
  userId: string;
  name: string;
}

const AUTH_KEY = 'auth.current';

export async function getAuth(): Promise<AuthInfo | null> {
  const st = await browser.storage.session.get({ [AUTH_KEY]: null });
  return (st[AUTH_KEY] as AuthInfo | null) ?? null;
}

async function apiPost(url: string, form: Record<string, string>): Promise<unknown> {
  // host_permissions 已授权 mag1；mag-ss-key 头经扩展特权请求直发（无 CORS 阻碍）；
  // MAGAPPX UA 由 DNR 规则注入（fetch 禁设 UA 头）。
  const resp = await fetch(resolveUrl(url), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'mag-version': '6.4.0-2.90-30042',
      pt: '1',
      'mag-ss-key': magSsKey(Math.floor(Date.now() / 1000)),
    },
    body: new URLSearchParams(form).toString(),
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return resp.json();
}

export interface LoginResult {
  ok: boolean;
  msg?: string;
  auth?: AuthInfo;
}

export async function login(account: string, password: string): Promise<LoginResult> {
  const body = (await apiPost(LOGIN_URL, {
    account,
    password: encryptPassword(password),
  })) as { success?: boolean; msg?: string; data?: Record<string, unknown> };
  const data = body?.data ?? {};
  if (!body?.success) {
    return { ok: false, msg: body?.msg ?? '登录失败' };
  }
  let token = String(data.token ?? '');
  if (!token) {
    for (const v of Object.values(data)) {
      if (typeof v === 'string' && v.length >= 20) { token = v; break; }
    }
  }
  if (!token) return { ok: false, msg: '登录成功但未取得会话凭证' };
  const auth: AuthInfo = {
    token,
    userId: String(data.user_id ?? data.uid ?? ''),
    name: String(data.username ?? data.name ?? ''),
  };
  await browser.storage.session.set({ [AUTH_KEY]: auth });
  // 会话规则升级为登录态 UA（携带 token 段）；SW 侧 epoch:start 由调用方带 epoch 值
  await browser.runtime.sendMessage({ type: 'auth:activate', token });
  return { ok: true, auth };
}

export async function fetchAccountInfo(userId: string): Promise<Record<string, unknown> | null> {
  try {
    const body = (await apiPost(USERINFO_URL, { id: userId })) as {
      success?: boolean;
      data?: Record<string, unknown>;
    };
    return body?.success ? body.data ?? null : null;
  } catch {
    return null;
  }
}

export async function logout(): Promise<void> {
  await browser.storage.session.remove([AUTH_KEY]);
  await browser.runtime.sendMessage({ type: 'auth:deactivate' });
}
