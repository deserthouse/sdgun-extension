# sdgun-web-access

桌面浏览器直接访问 SDGun 论坛（Discuz 触屏版）的最小浏览器扩展。

论坛 `bbs.sdgun.com.cn` 通过服务端插件（closedonpc）屏蔽 PC 浏览器的 User-Agent，只放行移动端——本扩展用一条声明式网络规则把发往 `*.sdgun.com.cn` 的请求伪装成 Android Chrome 手机 UA，从而在桌面浏览器里完整使用触屏版（看帖 / 登录 / 发帖入口齐全）。

## 安装（免商店，本地加载）

1. 下载本仓库（或 release zip 解压）；
2. 打开 `edge://extensions/`（Edge）或 `chrome://extensions/`（Chrome）；
3. 开启「开发人员模式 / 开发者模式」→「加载解压缩的扩展」→ 选择仓库根目录（含 `manifest.json`）；
4. 正常访问 `https://bbs.sdgun.com.cn`。装好或切换开关后，已打开的论坛标签页需刷新一次。

## 工作原理

- Manifest V3 + `declarativeNetRequest` 静态规则（`rules/ua.json`）：在网络层把 `*.sdgun.com.cn` 请求的 User-Agent 请求头改写为固定的 Android Chrome UA；
- 无 background、无 content script、无任何运行时代码；开关状态由浏览器自身持久化；
- 权限仅 `declarativeNetRequestWithHostAccess` + `*.sdgun.com.cn` 域，不触碰其他任何网站，无数据收集（见 `PRIVACY.md`）。

## 构建与自测

```bash
python tools/extension_build.py --test
```

产出 `dist/` 下两种 zip：`*-vX.Y.Z.zip`（套一层目录，解压即装，用于 GitHub release）与 `*-store.zip`（manifest 位于根目录，用于商店提交）。

## 说明与免责

- 本扩展为非官方社区工具，与 SDGun 论坛无任何关联；
- UA 伪装仅用于绕过论坛对 PC 端的展示限制，不涉及绕过任何权限、付费或访问控制；
- `rules/redirects.json` 为旧域名（mag1/app.sdgun 等）死链重写的备用规则集，因 Edge「加载解压缩」安装路径对其校验行为与 CLI 不一致暂未注册，如需启用可自行在 `manifest.json` 的 `rule_resources` 中添加后以真实安装路径验证。
