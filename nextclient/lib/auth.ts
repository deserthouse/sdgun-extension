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
  /** F01：服务端要求图形验证码（code 1009）——验证后重试登录 */
  captchaRequired?: boolean;
}

export async function login(account: string, password: string): Promise<LoginResult> {
  const body = (await apiPost(LOGIN_URL, {
    account,
    password: encryptPassword(password),
  })) as { success?: boolean; msg?: string; code?: number; data?: Record<string, unknown> };
  const data = body?.data ?? {};
  if (!body?.success) {
    // F01（官 APK RequestInterceptor 口径）：code 1009 → 图形验证码流程
    if (body?.code === 1009) {
      return { ok: false, captchaRequired: true, msg: body?.msg ?? '请完成图形验证' };
    }
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

// ---- F01 图形验证码链（官 APK 口径：code 1009 → 图 captcha?time= →
// verifyPicSecurityCode(security_code) → 成功后原动作重试）----
const VERIFY_PIC_URL = 'https://mag1.sdgun.net/mag/user/v1/User/verifyPicSecurityCode';
const CAPTCHA_IMG_URL = 'https://mag1.sdgun.net/captcha';

export function captchaImageUrl(): string {
  // resolveUrl 只拼 pathname 会丢 query——验证码图 time 参数必须保留，手动拼
  try {
    const ov = localStorage.getItem('sdg2.hostOverride');
    if (ov) return `${ov}/captcha?time=${Date.now()}`;
  } catch { /* 非 extension 页环境 */ }
  return `${CAPTCHA_IMG_URL}?time=${Date.now()}`;
}

export async function verifyPicSecurityCode(code: string): Promise<{ ok: boolean; msg?: string }> {
  try {
    const body = (await apiPost(VERIFY_PIC_URL, { security_code: code })) as {
      success?: boolean; msg?: string;
    };
    return { ok: Boolean(body?.success), msg: body?.msg };
  } catch {
    return { ok: false, msg: '验证请求失败（网络）' };
  }
}
