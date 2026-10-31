import { readFileSync } from 'node:fs';
import { defineConfig } from 'wxt';

// 合并构建（B2）：旧线经典重绘 + 新线客户端 = 单一扩展。
// 版本唯一事实源=package.json 的 version（分册 §5.2）；Chrome manifest.version
// 只收点分整数——预发布段进 version_name。alpha.N → 2.0.{N-1} 单调递增。
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8')) as {
  version: string;
};
const [versionBase, versionPre] = pkg.version.split('-');
const alphaMatch = versionPre?.match(/^alpha\.(\d+)$/);
const versionNumeric = alphaMatch
  ? `2.0.${Math.max(0, Number(alphaMatch[1]) - 1)}`
  : versionBase;

// host_permissions 合并集：新线 API 域（E1-1）+ 旧线 bbs 域（content_scripts 匹配）
// + picapp 图床（不继承认证头）+ 实验室变体（SDG_LAB_PERMS=1）。
const LAB_HOSTS = ['http://127.0.0.1:8777/*', 'http://127.0.0.1:8778/*'];
const hostPermissions = [
  'https://app.sdgun.com.cn/*',
  'https://mag1.sdgun.net/*',
  'https://picapp.sdgun.net/*',
  '*://*.sdgun.com.cn/*',   // 旧线 bbs 域（content scripts + DNR UA 规则）
  ...(process.env.SDG_LAB_PERMS === '1' ? LAB_HOSTS : []),
];

// 旧线 content scripts（E1-3/B2）：经典重绘注入链。
// boot.js 内建接管开关消费（sdg2.client.enabled=true → startLegacy 不执行）。
const LEGACY = 'legacy';
const legacyContentScripts = [
  {
    matches: ['*://bbs.sdgun.com.cn/*'],
    js: [`${LEGACY}/content/navguard.js`],
    run_at: 'document_start' as const,
  },
  {
    matches: ['*://bbs.sdgun.com.cn/*'],
    js: [`${LEGACY}/content/touchemu.js`],
    run_at: 'document_start' as const,
    world: 'MAIN' as const,
  },
  {
    matches: ['*://bbs.sdgun.com.cn/*'],
    js: [
      `${LEGACY}/content/selectors.js`,
      `${LEGACY}/content/redraw/base.js`,
      `${LEGACY}/content/redraw/scope.js`,
      `${LEGACY}/content/redraw/cache.js`,
      `${LEGACY}/content/redraw/api.js`,
      `${LEGACY}/content/redraw/viewthread.js`,
      `${LEGACY}/content/redraw/forumdisplay.js`,
      `${LEGACY}/content/redraw/forumlist.js`,
      `${LEGACY}/content/redraw/sidebar.js`,
      `${LEGACY}/content/redraw/rightrail.js`,
      `${LEGACY}/content/redraw/enrich.js`,
      `${LEGACY}/content/redraw/river.js`,
      `${LEGACY}/content/redraw/hotfeed.js`,
      `${LEGACY}/content/redraw/feed.js`,
      `${LEGACY}/content/boot.js`,
    ],
    css: [`${LEGACY}/content/theme.css`],
    run_at: 'document_end' as const,
  },
];

// 旧线 DNR UA 规则（静态，规则 ID 101 与新线 SW session 规则 9001+/9101+ 不冲突）
const dnrRules = [{
  id: 'ua_rules',
  enabled: true,
  path: `legacy/rules/ua.json`,
}];

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  vite: () => ({
    resolve: { alias: { zod: new URL('./node_modules/zod', import.meta.url).pathname } },
  }),
  manifest: {
    name: 'SDGun',
    version: versionNumeric,
    ...(versionPre ? { version_name: pkg.version } : {}),
    permissions: ['storage', 'declarativeNetRequest', 'scripting'], // scripting=旧线 popup「诊断当前页」按需注入（E31-08 合并回归修复）
    host_permissions: hostPermissions,
    // B2：popup=旧线（UA 开关/主题/状态面板/诊断），内含"打开新版客户端"链接
    action: {
      default_popup: 'legacy/popup.html',
      default_title: 'SDGun',
    },
    content_scripts: legacyContentScripts,
    declarative_net_request: { rule_resources: dnrRules },
    icons: {
      '16': 'legacy/icons/icon16.png',
      '48': 'legacy/icons/icon48.png',
      '128': 'legacy/icons/icon128.png',
    },
  },
});
