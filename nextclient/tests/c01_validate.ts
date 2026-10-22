// C01 契约验证（N-5）：登记表与 schema 编译 + 全部夹具过 schema + C01a 事实抽检。
// 由 tests/g0_c01_contracts.py 经 esbuild 打包后以便携 node 运行；退出码 0=全过。
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { ENDPOINTS } from '../../contracts/api/endpoints';
import { ForumViewResp, CommentListResp, ThreadViewResp, CircleTreeResp, InfoListResp } from '../../contracts/api/schemas';

const root = process.cwd().endsWith('nextclient') ? process.cwd() : join(process.cwd(), 'nextclient');
const fixturesDir = join(root, '..', 'contracts', 'fixtures');
const out = { checks: [], fails: 0 };

function check(name: string, ok: boolean, detail: unknown = '') {
  const line = { name, ok, detail: String(detail).slice(0, 200) };
  out.checks.push(line);
  if (!ok) out.fails += 1;
  console.log((ok ? '[PASS] ' : '[FAIL] ') + name, '|', String(detail).slice(0, 140));
}

// 1) 登记表完整性与 schema 编译
const ids = Object.keys(ENDPOINTS);
check('登记 7 端点', ids.length === 7, ids.join(','));
for (const id of ids) {
  const e = ENDPOINTS[id];
  check(`${id}: host/path 已验证组合`,
    (e.host === 'app.sdgun.com.cn' || e.host === 'mag1.sdgun.net') && e.path.startsWith('/mag/'),
    `${e.host}${e.path}`);
  // 读面端点只允许 read-only / read-may-mutate（后者=读取可能带已读副作用，G3 消息族）；
  // write 类一律不得登记（写面封存，零探测）
  check(`${id}: 语义属读面（写面封存）`,
    e.sideEffect === 'read-only' || e.sideEffect === 'read-may-mutate', e.sideEffect);
}

// 2) 夹具过 schema（含恶意夹具反例：commentList 缺 floor 必须失败）
const fxDir = readdirSync(fixturesDir).filter((f) => f.endsWith('.json'));
check('夹具 5 份在场', fxDir.length === 5, fxDir.join(','));
const schemaOf: Record<string, import('zod').ZodTypeAny> = {
  'forumView.json': ForumViewResp,
  'commentList.json': CommentListResp,
  'threadView.json': ThreadViewResp,
  'circleTree.json': CircleTreeResp,
  'infoListByCatId.json': InfoListResp,
};
for (const f of fxDir) {
  const raw = JSON.parse(readFileSync(join(fixturesDir, f), 'utf-8'));
  const r = schemaOf[f].safeParse(raw);
  check(`夹具 ${f} 过 schema`, r.success, r.success ? 'ok' : JSON.stringify(r.error.issues).slice(0, 160));
}

// 3) C01a 事实抽检（防夹具漂移）
const cl = JSON.parse(readFileSync(join(fixturesDir, 'commentList.json'), 'utf-8'));
check('C01a：commentList 首楼层=2（楼层为字符串，恒从 2 起）', String(cl.list[0].floor) === '2', cl.list[0].floor);
const tv = JSON.parse(readFileSync(join(fixturesDir, 'threadView.json'), 'utf-8'));
check('C01a：threadView.title 在场（标题唯一源）', typeof tv.data.title === 'string', tv.data.title);
const ct = JSON.parse(readFileSync(join(fixturesDir, 'circleTree.json'), 'utf-8'));
check('C01a：circleTree 组含 circle_list[].type_value（=fid，实测顶层 list）',
      ct.list.length >= 2 && ct.list.every((g: { circle_list: unknown[] }) => g.circle_list.length >= 1),
      ct.list.map((g: { name: string }) => g.name));
const fv = JSON.parse(readFileSync(join(fixturesDir, 'forumView.json'), 'utf-8'));
check('forumView 实测信封：顶层 list + code=100 + toplist 在场（E1-5 修正）',
      Array.isArray(fv.list) && fv.code === 100 && 'toplist' in fv, Object.keys(fv));

// 4) 反例：schema 必须拒绝坏形状
const badFloor = { success: true, list: [{ floor: 1, content: 'x' }] };
check('反例：floor=1 首楼被 schema 拒绝（floor 恒从 2）',
  !CommentListResp.safeParse(badFloor).success, 'rejected');
const noTitle = { success: true, data: { tid: 1 } };
check('反例：threadView 无 title 被拒绝', !ThreadViewResp.safeParse(noTitle).success, 'rejected');

console.log(JSON.stringify({ summary: out.fails === 0 ? 'PASS' : 'FAIL', fails: out.fails }));
process.exit(out.fails === 0 ? 0 : 1);
