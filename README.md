# sdgun-extension

桌面浏览器访问 SDGun 论坛的社区扩展：UA 伪装 + 现代化卡片界面（Manifest V3，Chrome / Edge / Brave 等 Chromium 系浏览器通用）。

论坛 `bbs.sdgun.com.cn` 通过服务端插件（closedonpc）屏蔽 PC 浏览器的 User-Agent，只放行移动端。本扩展一方面在网络层把发往 `*.sdgun.com.cn` 的请求改写为手机 UA（入口能力），另一方面在页面层把 Discuz 触屏版重绘为现代卡片式界面（v1.3.0 全部功能可在弹窗开关）：

| 页面 | 效果 |
|---|---|
| 帖子页 | 楼层卡片化、吸顶标题栏（真实标题+页码）、只看楼主、楼层跳转、每楼回复入口（进原版回帖页）、引用块折叠 |
| 帖子列表 | 帖子卡片流（标题/作者/回复/查看/预览图）、筛选链（类型/排序/时间，真实导航）、分页 |
| 版块列表 | 分组卡片（图标/版块名/统计） |
| 全局 | 宽屏 860px 排版、暗色模式（跟随系统/手动）、图片灯箱、SDGun 品牌红强调色 |

所有重绘层 fail-open：论坛模板改版或解析失败时自动回退原版页面，不会白屏。

## 安装（免商店，本地加载）

1. 下载本仓库（或 release zip 解压）；
2. 打开 `chrome://extensions/`（Chrome）或 `edge://extensions/`（Edge）；
3. 开启「开发者模式」→「加载已解压的扩展程序」→ 选择仓库根目录（含 `manifest.json`）；
4. 正常访问 `https://bbs.sdgun.com.cn`。装好或切换开关后，已打开的论坛标签页需刷新一次。

## 工作原理

- `rules/ua.json`：`declarativeNetRequest` 静态规则，把 `*.sdgun.com.cn` 请求的 User-Agent 改写为 Android Chrome UA；
- `content/`：三个 content script——`selectors.js`（触屏版选择器集中表，模板改版只改这里）、`redraw.js`（Shadow DOM 卡片重绘层，样式隔离）、`boot.js`（偏好与页面类型路由）；
- `chrome.storage.sync` 仅存储你的显示偏好（主题/开关），无其他任何数据进出；
- 交互全部走真实页面导航（翻页/筛选/回帖均为真实 URL），**扩展自身不发起任何额外请求、不构造任何协议**；权限仅 `*.sdgun.com.cn` 域。

## 隐私

不收集、不上传、不分享任何数据；无统计、无埋点、无远程代码。详见 `PRIVACY.md`。

## 构建与自测

```bash
python tools/extension_build.py --test
```

产出 `dist/` 下两种 zip：GitHub release 版与商店提交版。

## 说明与免责（Disclaimer）

- 本扩展为**非官方**社区工具，与 SDGun 论坛及其运营方无任何关联；仓库不含任何论坛资源。
- UA 伪装仅用于绕过论坛对 PC 端的**展示**限制，不涉及绕过任何权限、付费或访问控制；所有数据均为任何手机浏览器无需凭据即可公开访问的内容。
- 按「现状」（AS IS）提供，不提供任何担保；使用本扩展产生的后果由使用者自行承担。
- 平台用户协议可能禁止第三方客户端，本声明即对此事实的披露。

## AI 使用披露（AI Disclosure）

本扩展的代码由 AI 辅助编写，经人类审阅、验收与决策（AI-assisted development with human review and acceptance）。

---

*SDGun is a trademark of its respective owner; this project is not affiliated with it.*
