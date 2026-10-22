# nextclient — SDGun 新版浏览器客户端（G0/E00 实验场）

依据：[扩展域工作计划](../docs/extension_work_plan_2026-10-22.md) N 批 + [扩展分册](../docs/extension_next_design_2026-10-21.md)。
**本目录是实验场**：G1 起并入 extension/（并入时一次性定案公开仓同步策略，见 N-0 卡）。
`node_modules/`、`.output/`、`.wxt/` 不入库；源码 + lockfile + 工具链凭证入库。

## 一条命令复跑

```bash
# 前置（仅首次）：下载便携 Node（sha256 对官方 SHASUMS256.txt 核验）
tests/.venv_review/Scripts/python.exe -B nextclient/tools/fetch_node.py

# 构建（git-bash；npm 走 127.0.0.1:10808 代理）
export PATH="$PWD/tools/node-portable/node-v24.22.1-win-x64:$PATH"
export HTTPS_PROXY=http://127.0.0.1:10808 HTTP_PROXY=http://127.0.0.1:10808
cd nextclient && npm.cmd install --no-fund --no-audit && node.exe node_modules/wxt/bin/wxt.mjs build
```

产物：`.output/chrome-mv3/`（MV3）+ `wxt zip` 产出 `.output/*.zip`。

## 工具链锁定（2026-10-22）

- Node `v24.22.1`（LTS v24 线，官方 latest-v24.x 解析；sha256 `d2046d28…` 对官方 SHASUMS256.txt 核验；凭证=`tools/node-portable.lock.json`）
- 依赖精确版本以 `package-lock.json` 为准（wxt 0.20.27 / Vite 8.3.5 / React 19 / TS 5.9 / Radix dialog / TanStack Query 5）；无全局安装、无 CDN/远程脚本。
- **Playwright 页面不冒充生产打包**（分册红线）；现有离线 JS 探针继续用 Playwright 承载，与构建无关。

## 构建可复现性档位（2026-10-22 实测）

两次干净构建（间隔 `rm -rf .output`）：解包内容逐字节一致（`CONTENT_IDENTICAL`）；
zip 容器字节不一致（条目时间戳随重建变化）。**档位=可重建/输入已固定**（上游 §9.9.5：
未做严格可复现就只称可重建——严格可复现需固定 zip 时间戳，G1 并入发版链时再决策）。

## 当前内容（N-0 骨架）

- `entrypoints/background.ts`：SW 存在性证明（N-4 强停/唤醒验证在此扩）。
- `entrypoints/client/`：React + Radix Dialog + TanStack Query 三件栈在场证明页（离线，零请求）。
- manifest：MV3；权限最小集 `storage` + `declarativeNetRequest`；无 host_permissions（E00 结论后逐域申请）。

## 验收记录（N-0，2026-10-22）

`wxt prepare` → `tsc --noEmit` 通过 → `wxt build` 产出 MV3 四件（manifest/client.html/background.js/chunk 285KB）→ 产物 grep `eval(` 零命中 → zip 89.23KB。两次干净构建内容级一致（见上）。
