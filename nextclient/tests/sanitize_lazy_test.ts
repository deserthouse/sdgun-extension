// M1-a 懒加载归一化验证（离线；esbuild 打包后跑在真实浏览器页）。
// 反例：60 图 data-original 样本（E70-02 实测形态）→ 全部提升为可加载 src；
// 缩略/原图对：src 留缩略、原图进 data-sdg-orig；危险协议/相对地址剥离。
import { readFileSync } from 'node:fs';
import { sanitizeContent, extractImages } from '../lib/sanitize';

const results: { name: string; ok: boolean; detail: string }[] = [];
function check(name: string, ok: boolean, detail: string) {
  results.push({ name, ok, detail: detail.slice(0, 160) });
  console.log((ok ? '[PASS] ' : '[FAIL] ') + name, '|', detail.slice(0, 120));
}

function imgHtml(n: number, attrs: string): string {
  return Array.from({ length: n }, () => `<img ${attrs}>`).join('');
}

// 反例形态：60 图全 data-original、src 为占位
const lazy60 = imgHtml(60, 'src="https://bbs.sdgun.com.cn/static/image/common/none.gif" '
  + 'data-original="https://picapp.sdgun.net/pic/real_{i}.jpg"');
const out60 = sanitizeContent(lazy60);
const doc = new DOMParser().parseFromString(out60, 'text/html');
const imgs = [...doc.querySelectorAll('img')];
const goodSrcs = imgs.filter((im) => /^https:\/\/picapp\.sdgun\.net\/pic\/real_/.test(im.getAttribute('src') || ''));
check('60 图 data-original 全部提升为可加载 src', goodSrcs.length === 60,
  `good=${goodSrcs.length}/60 first=${imgs[0]?.getAttribute('src')?.slice(0, 60)}`);
check('懒加载属性清洗后移除', imgs.every((im) => !im.hasAttribute('data-original')), 'attrs gone');
const extracted = extractImages(out60);
check('extractImages 提取全部真图（灯箱可用）', extracted.length === 60, `n=${extracted.length}`);

// 缩略/原图对：src 留缩略，原图进 data-sdg-orig
const pair = sanitizeContent('<img src="https://picapp.sdgun.net/t.jpg" data-original="https://picapp.sdgun.net/full.jpg">');
const pairDoc = new DOMParser().parseFromString(pair, 'text/html');
const pim = pairDoc.querySelector('img')!;
check('缩略/原图对：src=原图（懒加载即显示图）', pim.getAttribute('src') === 'https://picapp.sdgun.net/full.jpg', pim.getAttribute('src') || '');
check('旧缩略留 data-sdg-thumb', pim.getAttribute('data-sdg-thumb') === 'https://picapp.sdgun.net/t.jpg', pim.getAttribute('data-sdg-thumb') || '');

// 危险/无效：javascript: 与相对地址不提升、不保留
const danger = sanitizeContent('<img src="" data-original="javascript:alert(1)">'
  + '<img data-original="/relative/x.jpg">');
const dDoc = new DOMParser().parseFromString(danger, 'text/html');
const dImgs = [...dDoc.querySelectorAll('img')];
check('javascript:/相对地址不提升', dImgs.every((im) => !im.getAttribute('src')), 'stripped');

// 洁净输出：script/onclick 不复活
const xss = sanitizeContent('<img src="https://picapp.sdgun.net/x.jpg" onclick="alert(1)"><script>alert(2)</script>');
check('XSS 不复活（onclick/script 剥离）', !xss.includes('onclick') && !xss.includes('<script'), xss.slice(0, 60));

console.log('SUMMARY:' + JSON.stringify({ fails: results.filter((r) => !r.ok).length }));
