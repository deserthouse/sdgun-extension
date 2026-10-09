# sdgun-extension

桌面浏览器访问 SDGun 论坛的社区扩展：UA 伪装 + 现代化卡片界面（Manifest V3，Chrome / Edge / Brave 等 Chromium 系浏览器通用）。

论坛 `bbs.sdgun.com.cn` 通过服务端插件（closedonpc）屏蔽 PC 浏览器的 User-Agent，只放行移动端。本扩展一方面在网络层把发往 `*.sdgun.com.cn` 的请求改写为手机 UA（入口能力），另一方面在页面层把 Discuz 触屏版重绘为现代卡片式界面（全部功能可在弹窗开关）：

| 页面 | 效果 |
|---|---|
| 帖子页 | 楼层双列卡片（头像列+内容列）、楼主楼层徽标与高亮、吸顶标题栏（真实标题+页码）、只看楼主、楼层跳转、右栏楼主卡+楼层速览（宽屏）、每楼回复入口（进原版回帖页）、引用块折叠 |
| 帖子列表 | 行式紧凑列表（缩略图+标题+作者时间+回复/查看，悬停浮出预览图）、筛选链（类型/排序/时间，真实导航）、本板块搜索入口、上下双分页；**图文增强**（v1.17.0，可关）：对无站方缩略图的行后台限速拉取该帖页补首图+摘要（tid 级 7 天缓存，每页 ≤4 次、间隔 2s） |
| 论坛首页 | 分组板块卡 + 站点统计 + 公告河；**热帖速览**（v1.17.0，可关）：活跃前 5 板块 × 各 3 条热帖两列卡流（板块列表页数据、30 分钟缓存——不调用任何非官方接口） |
| 版块列表 | 分组卡片（图标/版块名/统计）+「最近回复」内容河（站务公告最新帖，每次会话最多一次请求） |
| 全局 | 左栏论坛树导航（当前板块高亮、主题切换钮）、三档响应式断点（宽屏三栏/中屏双栏/窄屏单栏）、暗色模式（跟随系统/手动）、图片灯箱、SDGun 品牌红强调色 |
| 弹窗 | 功能开关、当前页状态面板（页型/服务器形态自动识别）、诊断信息一键复制 |

所有重绘层 fail-open：论坛模板改版或解析失败时自动回退原版页面，不会白屏。

## 安装（免商店，本地加载）

1. 下载本仓库（或 release zip 解压）；
2. 打开 `chrome://extensions/`（Chrome）或 `edge://extensions/`（Edge）；
3. 开启「开发者模式」→「加载已解压的扩展程序」→ 选择仓库根目录（含 `manifest.json`）；
4. 正常访问 `https://bbs.sdgun.com.cn`。装好或切换开关后，已打开的论坛标签页需刷新一次。

## 工作原理

- `rules/ua.json`：`declarativeNetRequest` 静态规则，把 `*.sdgun.com.cn` 请求的 User-Agent 改写为 Android Chrome UA（仅此一域）；
- `content/navguard.js`（document_start）：导航守卫——记录内容页参数上下文，纠正论坛脚本的丢参跳转，把门户死端直送论坛列表；
- `content/touchemu.js`（document_start、MAIN world）：补齐桌面浏览器的触摸能力特征（`ontouchend`），使论坛触屏模板不把桌面降级到丢参的简易版——仅影响展示形态，不改变可访问的内容；
- `content/selectors.js`（触屏版选择器集中表，模板改版只改这里）+ `content/redraw/`（base 共享层 + 帖子页/帖子列表/版块列表/左栏导航/右栏速览五模块，Shadow DOM 重绘层，样式隔离、fail-open；论坛响应为空壳时自动重试并可用会话内缓存渲染）+ `content/boot.js`（偏好开关与页面类型路由），document_end 注入；
- `chrome.storage.sync` 仅存储你的显示偏好（主题/开关），无其他任何数据进出；
- 交互全部走真实页面导航（翻页/筛选/回帖均为真实 URL），**扩展自身不发起任何额外请求、不构造任何协议**；权限仅 `*.sdgun.com.cn` 单域 + 本地偏好存储（`storage`）与弹窗「诊断当前页」按钮（`scripting`，按需读取注入状态）。

## 构建与自测

```bash
python tools/extension_build.py --test
```

产出 `dist/` 下两种 zip：GitHub release 版与商店提交版。

## 说明与免责（Disclaimer）

**本扩展只起到外观美化的作用**：它将论坛自有的移动端触屏版页面在桌面浏览器中重新排版呈现，不提供任何页面内容之外的额外能力。本扩展的全部效用，等同于在手机上用浏览器直接访问 bbs.sdgun.com.cn——你能看到的一切内容、能进行的一切操作，与手机浏览器直接访问完全一致。

- **不存储任何数据**：不收集、不存储、不上传、不分享任何用户数据与论坛内容；无统计、无埋点、无远程代码。唯一的本地数据是界面偏好（主题与功能开关，由浏览器自身保存），详见 `PRIVACY.md`。
- **不提供任何逆向、破解服务**：不逆向论坛程序或协议，不破解任何权限、付费墙或访问控制；UA 改写仅用于解除论坛对 PC 端的展示限制，其呈现的全部内容均为任何手机浏览器无需凭据即可公开访问的内容。
- **不侵犯任何版权**：本仓库不含任何论坛素材或资源，不复制、不分发任何受版权保护的内容；扩展内展示的一切内容版权归原权利人所有。
- **不承担任何法律责任**：在适用法律允许的最大范围内，本扩展按「现状」（AS IS）提供，不作任何明示或默示担保；因使用本扩展产生的一切后果由使用者自行承担，开发者不承担任何责任。使用即表示同意自行遵守论坛规则。
- **非官方**：本扩展与 SDGun 论坛及其运营方无任何关联，未获其授权或认可。
- 论坛平台协议可能限制第三方客户端的存在，本声明即对这一事实的如实披露。

**Disclaimer**: This extension is a purely cosmetic layer over the forum's own mobile pages; its effect is identical to visiting bbs.sdgun.com.cn directly in a browser on a phone. It stores no user data, provides no reverse-engineering or cracking services, infringes no copyright, and is provided AS IS without warranty of any kind — the developers assume no legal liability for its use. Unofficial; not affiliated with SDGun.

## AI 使用披露（AI Disclosure）

本项目的全部代码由 AI 编写，不含任何人类编写成分；人类负责提出需求、审阅与验收（All code in this project is AI-written; humans define requirements and provide review and acceptance）。

---

*SDGun is a trademark of its respective owner; this project is not affiliated with it.*
