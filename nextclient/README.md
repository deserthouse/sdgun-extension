# SDGun 新版浏览器客户端（2.0 预览通道）

这一分支保存 2.0 预览版的源码快照。扩展可浏览帖子和个人资料，支持登录、编辑草稿和提交内容。经典稳定版的说明见 [main 分支](https://github.com/deserthouse/sdgun-extension/tree/main)。

## 下载与版本

从 [Releases](https://github.com/deserthouse/sdgun-extension/releases) 选择目标 `v2.0.0-alpha.N` 预发布并下载该版 Chrome ZIP。文件名与 SHA-256 见该版本的发布说明。解压后，在扩展管理页选择“加载已解压的扩展程序”，指向含 manifest.json 的目录。

[BUILD-INFO.md](../BUILD-INFO.md) 对应本分支当前快照，记录开发仓提交、工具链、构建时间和附件摘要。查看旧版时请切换到对应 tag。版本字符串取自 [package.json](package.json)，Chrome 的数字版本由 [WXT 配置](wxt.config.ts) 转换。

## 源码与构建

在快照根目录使用 Node.js 24.22.1 及其 npm，依赖版本见 [package-lock.json](package-lock.json)。

```sh
cd nextclient
npm ci
npm run build
```

WXT 的 Chrome MV3 输出在 `.output/chrome-mv3/`。发布附件的摘要标识发布时的 ZIP，重新打包的时间戳可能不同。

## 数据与 AI 使用声明

预览版支持登录、联网读取论坛数据以及按用户操作上传和发布。草稿和部分阅读状态保存在本机。经典版的隐私说明仅适用于经典版。

本项目不含任何人类成分。项目代码由 AI 编写，需求、审阅与验收由维护者负责。
