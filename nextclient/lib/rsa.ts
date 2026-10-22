// 协议加密（E1-6）：登录密码密文与 mag-ss-key。与 rsalab/lib/guestua 同一公开常量口径
// （Android SdApi.kt 只读引用）；jsencrypt 打包（E00-2 双向互验通过）。
// 形态定案：密码=76 列换行+尾换行（android.util.Base64.DEFAULT 实测语义）；
// mag-ss-key=单行无换行。
import { JSEncrypt } from 'jsencrypt';

const OFFICIAL_PUBKEY_B64 =
  'MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC7qPCn9w81CW7I9dbc+0YReFNEkiP/' +
  'x7nTs5lAw+hLXmLsxNZtE/2kFN2XK3jcFOw6TSq/EbGhC9CD51q6n1B4AyfId+aGgB52ejR' +
  'UrxvK+JOEWJrzXCbIOZg0QLfai+tFkmTi5jK91mQpX2di6xhiMk18gwnBmmNQQrSlEr1YgwIDAQAB';

function rsaEncryptB64(plain: string): string {
  const j = new JSEncrypt();
  j.setPublicKey(OFFICIAL_PUBKEY_B64);
  const out = j.encrypt(plain);
  if (out === false) throw new Error('rsa encrypt failed');
  return out;
}

export function encryptPassword(plain: string): string {
  const b64 = rsaEncryptB64(plain);
  const lines = b64.match(/.{1,76}/g) ?? [];
  return lines.join('\n') + '\n';
}

export function magSsKey(unixSec: number): string {
  return rsaEncryptB64(`shuidan,${unixSec}`);
}

export const LOGIN_URL = 'https://mag1.sdgun.net/mag/user/v1/user/login';
export const USERINFO_URL = 'https://mag1.sdgun.net/mag/user/v1/User/getUserInfo';
