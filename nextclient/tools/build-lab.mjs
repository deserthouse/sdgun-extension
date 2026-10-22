// 实验室构建（E70-08）：把 entrypoints_lab/* 复制进 entrypoints/ 后执行
// SDG_LAB_PERMS=1 wxt build；产品构建（wxt build）不含实验页。
// 用法：node tools/build-lab.mjs（在 nextclient/ 内或由驱动以绝对路径调）
import { cpSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const lab = join(root, 'entrypoints_lab');
if (!existsSync(lab)) { console.error('no entrypoints_lab'); process.exit(1); }
for (const d of ['authlab', 'rsalab']) {
  cpSync(join(lab, d), join(root, 'entrypoints', d), { recursive: true });
}
const env = { ...process.env, SDG_LAB_PERMS: '1' };
const r = spawnSync(process.execPath, [join(root, 'node_modules/wxt/bin/wxt.mjs'), 'build'],
  { cwd: root, env, stdio: 'inherit' });
process.exit(r.status ?? 1);
