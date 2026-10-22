// E00-2 RSA 互操作实验页：协议加密形态的浏览器侧复刻（镜像 android SdApi.kt 语义，
// 只读引用其已验证口径：公钥/双盐/76 列换行/ss-key 单行）。
// window.__rsa 供 Playwright 驱动调用；真实协议私钥不存在于此，向量互验用测试密钥对。
import { browser } from 'wxt/browser';
import { JSEncrypt } from 'jsencrypt';
import { md5 } from 'js-md5';

// 官方协议公钥（X.509 SPKI，Base64；只读引用 android SdApi.kt RSA_PUBKEY_B64）
const OFFICIAL_PUBKEY_B64 =
  'MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC7qPCn9w81CW7I9dbc+0YReFNEkiP/' +
  'x7nTs5lAw+hLXmLsxNZtE/2kFN2XK3jcFOw6TSq/EbGhC9CD51q6n1B4AyfId+aGgB52ejR' +
  'UrxvK+JOEWJrzXCbIOZg0QLfai+tFkmTi5jK91mQpX2di6xhiMk18gwnBmmNQQrSlEr1YgwIDAQAB';

const APP_CODE = 'shuidan';
const SIG1_SALT = 'nanjingxinxi';
const SIG2_SALT = 'nanjinglinyan';

function rsaEncryptB64(pubPemOrB64: string, plain: string): string {
  const j = new JSEncrypt();
  j.setPublicKey(pubPemOrB64);
  const out = j.encrypt(plain);
  if (out === false) throw new Error('rsa encrypt failed');
  return out; // 标准 Base64 单行
}

function rsaDecryptB64(privPem: string, b64: string): string {
  const j = new JSEncrypt();
  j.setPrivateKey(privPem);
  const out = j.decrypt(b64);
  if (out === false) throw new Error('rsa decrypt failed');
  return out;
}

// android.util.Base64.DEFAULT 语义：76 列换行 + 尾换行（官方抓包定案；无换行服务端解密即败）
function wrap76(b64: string): string {
  const lines = b64.match(/.{1,76}/g) ?? [];
  return lines.join('\n') + '\n';
}

declare global {
  interface Window {
    __rsa: {
      officialPubB64: string;
      encrypt: (pub: string, plain: string) => string;
      decrypt: (priv: string, b64: string) => string;
      encryptPassword: (plain: string) => string; // 官方公钥 + 76 列 + 尾换行
      ssKey: (unixSec: number) => string; // 官方公钥 + 单行（无换行）
      sig1: (utdid: string) => string;
      sig2: (utdid: string) => string;
      encForm: (s: string) => string;
    };
    __extId: string;
  }
}

window.__rsa = {
  officialPubB64: OFFICIAL_PUBKEY_B64,
  encrypt: rsaEncryptB64,
  decrypt: rsaDecryptB64,
  encryptPassword: (plain) => wrap76(rsaEncryptB64(OFFICIAL_PUBKEY_B64, plain)),
  ssKey: (unixSec) => rsaEncryptB64(OFFICIAL_PUBKEY_B64, `${APP_CODE},${unixSec}`),
  sig1: (utdid) => md5(`${APP_CODE}magapp${utdid}${SIG1_SALT}`),
  sig2: (utdid) => md5(`${APP_CODE}magapp${utdid}${SIG2_SALT}`),
  encForm: (s) => encodeURIComponent(s),
};

// 页面本身零行为（驱动经 __rsa 驱动）；extId 供 DNR 联调用
document.title = 'rsalab:' + browser.runtime.id;
