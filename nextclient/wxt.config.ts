import { readFileSync } from 'node:fs';
import { defineConfig } from 'wxt';

// 新线产品配置（G1/E1-0 起；G0 实验场配置退役）。
// 版本唯一事实源=package.json 的 version（分册 §5.2：生产 manifest 由构建得到，
// 不得手写两份）——本文件读取注入，产物 manifest 是派生物。
// Chrome manifest.version 只接受点分整数：预发布段（-alpha.N）进 version_name 展示位。
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8')) as {
  version: string;
};
const [versionBase, versionPre] = pkg.version.split('-');
// alpha.N → Chrome 整数版本单调映射（E70-08）：alpha.1=2.0.0（已发布耗用）、
// alpha.2=2.0.1、alpha.3=2.0.2 …——保证每个 alpha 的整数版本严格递增且不复用。
const alphaMatch = versionPre?.match(/^alpha\.(\d+)$/);
const versionNumeric = alphaMatch
  ? `2.0.${Math.max(0, Number(alphaMatch[1]) - 1)}`
  : versionBase;

// host_permissions 产品最小集（E1-1，按 E00 结论逐域）：
//   app.sdgun.com.cn  — 客户端 API（E00-1-E：无授权则认证头静默不注入）
//   mag1.sdgun.net    — 资讯流
//   picapp.sdgun.net  — 图床（不继承认证头：DNR 规则只挂登记的 API host+path）
// bbs 域不随首批（E00-3 实证桥跟随在真实标签、无需扩展权限；G2+ 按实测定）。
// 实验室构建变体：SDG_LAB_PERMS=1 时追加本地回显域（仅 E00-1 驱动使用，产品构建不含）。
const LAB_HOSTS = ['http://127.0.0.1:8777/*', 'http://127.0.0.1:8778/*'];
const hostPermissions = [
  'https://app.sdgun.com.cn/*',
  'https://mag1.sdgun.net/*',
  'https://picapp.sdgun.net/*',
  ...(process.env.SDG_LAB_PERMS === '1' ? LAB_HOSTS : []),
];

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  // contracts/ 在仓库根（nextclient 之外），vite 从那里上溯不到本目录 node_modules——
  // 与 tests/c01_validate 的 esbuild alias 同理（E1-4 起 client 打包含契约 schema）。
  vite: () => ({
    resolve: { alias: { zod: new URL('./node_modules/zod', import.meta.url).pathname } },
  }),
  manifest: {
    name: 'SDGun New Client',
    version: versionNumeric,
    ...(versionPre ? { version_name: pkg.version } : {}),
    permissions: ['storage', 'declarativeNetRequest'],
    host_permissions: hostPermissions,
    // E70-08：浏览器工具栏点击 → 打开/聚焦客户端页（无 popup，onClicked 生效）
    action: {},
  },
});
