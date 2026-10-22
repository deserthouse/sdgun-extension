// 游客请求 UA（E1-5）：app 域 WAF 丢弃非 MAGAPPX UA 连接（E00-1 实证）——
// 游客读取也需要 app 形态 UA。合成 utdid（22 位，客户端本地身份，服务端不校验真实性），
// sig 双盐为公开常量——游客 UA 不携带任何凭据（token 段仅在登录态出现，E1-6）。
import { md5 } from 'js-md5';

const APP_CODE = 'shuidan';
const SIG1_SALT = 'nanjingxinxi';
const SIG2_SALT = 'nanjinglinyan';
const WEB_UA = 'Mozilla/5.0 (Linux; Android 16; Pixel 8) AppleWebKit/537.36 '
  + '(KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';

export function sig1(utdid: string): string {
  return md5(`${APP_CODE}magapp${utdid}${SIG1_SALT}`);
}

export function sig2(utdid: string): string {
  return md5(`${APP_CODE}magapp${utdid}${SIG2_SALT}`);
}

export function magUa(utdid: string, token?: string): string {
  const segs = ['MAGAPPX', '6.4.0-2.90-30042', 'Android 16 google Pixel 8',
    APP_CODE, utdid, sig1(utdid), sig2(utdid)];
  if (token) segs.push(token);
  return `${WEB_UA} ${segs.join('|')}`;
}

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

export function newUtdid(): string {
  const buf = new Uint8Array(22);
  crypto.getRandomValues(buf);
  let x = Number(new DataView(buf.buffer).getUint32(0, true)) || 1;
  let out = '';
  for (let i = 0; i < 22; i += 1) {
    x = (Math.imul(x, 6364136223846793005) + 1442695040888963407) >>> 0;
    out += ALPHABET[(x >>> 16) % ALPHABET.length];
  }
  return out;
}
