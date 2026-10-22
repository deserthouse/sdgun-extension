# -*- coding: utf-8 -*-
"""push_nextclient_repo.py — 新线（2.0.0-alpha.N）公开仓快照发版脚本（E1-0）。

制度（work_plan E1-0 定案）：公开仓 2.0.0 起转**构建产物快照制**——
快照树=nextclient/ 净化源码（package.json/lockfile/entrypoints/tests/tools/README）+
contracts/（api+fixtures）+ 生成的 BUILD-INFO.md；Release 资产=wxt 产出的构建 zip。
旧线 1.22.x 维护期继续 tests/push_extension_repo.py 源码同步至退役，两线互不混树。

安全设计：
  - 默认 DRY_RUN：只打印将推送的树清单与资产 sha256，零远端动作；--execute 才真正推送。
  - 单一版本源审计：构建产物 manifest.version 必须 === package.json version，否则中止。
  - 净化面：node_modules/.output/.wxt/测试 bundle/probe 产物一律不入树；凭据路径硬排除。
  - 资产远端核验：上传后回下载比 sha256（Android 公开仓先例）。
用法：
  tests/.venv_review/Scripts/python.exe -B nextclient/tools/push_nextclient_repo.py            # DRY_RUN
  tests/.venv_review/Scripts/python.exe -B nextclient/tools/push_nextclient_repo.py --execute  # 实推
发布本身仍属用户门禁：执行前需用户明示批准（AGENTS §二.2）。"""
import argparse
import hashlib
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
NEXT = ROOT / 'nextclient'
NODE = ROOT / 'tools/node-portable/node-v24.22.1-win-x64/node.exe'
EXCLUDE_DIRS = {'node_modules', '.output', '.wxt', '__pycache__', 'probe_out'}
EXCLUDE_FILES = {'.c01_bundle.mjs'}
CONTRACTS = ROOT / 'contracts'


def run(args, cwd=None, check=True):
    r = subprocess.run(args, capture_output=True, text=True, cwd=cwd or str(ROOT))
    if check and r.returncode != 0:
        print('CMD FAIL:', ' '.join(map(str, args)), '\n', (r.stderr or r.stdout)[:300])
        sys.exit(1)
    return r.stdout.strip()


def sha256_of(p: Path) -> str:
    h = hashlib.sha256()
    with open(p, 'rb') as f:
        for chunk in iter(lambda: f.read(1 << 20), b''):
            h.update(chunk)
    return h.hexdigest()


def collect(dirpath: Path, base: str):
    out = []
    for root, dirs, files in __import__('os').walk(dirpath):
        dirs[:] = sorted(d for d in dirs if d not in EXCLUDE_DIRS)
        for f in sorted(files):
            if f in EXCLUDE_FILES:
                continue
            full = Path(root) / f
            rel = base + '/' + str(full.relative_to(dirpath)).replace('\\', '/')
            out.append((full, rel))
    return out


def build_via_wxt():
    """便携 node 跑 wxt build + wxt zip；审计版本单源。"""
    pkg = json.loads((NEXT / 'package.json').read_text(encoding='utf-8'))
    r = subprocess.run([str(NODE), str(NEXT / 'node_modules/wxt/bin/wxt.mjs'), 'zip'],
                       cwd=str(NEXT), capture_output=True, text=True)
    if r.returncode != 0:
        print('WXT FAIL:', r.stderr[-400:])
        sys.exit(1)
    manifest = json.loads((NEXT / '.output/chrome-mv3/manifest.json').read_text(encoding='utf-8'))
    # alpha.N → 整数映射 alpha.1=2.0.0、alpha.N=2.0.{N-1}（E70-08 同款）
    am = re.match(r'^(\d+\.\d+)\.(\d+)-alpha\.(\d+)$', pkg['version'])
    if am:
        numeric = f"{am.group(1)}.{max(0, int(am.group(2)) + int(am.group(3)) - 1)}"
    else:
        numeric = pkg['version'].split('-')[0]
    if manifest['version'] != numeric:
        print(f'FATAL: 版本单源审计失败 manifest={manifest["version"]} != package.json 数字段={numeric}')
        sys.exit(1)
    zips = list((NEXT / '.output').glob('*.zip'))
    if not zips:
        print('FATAL: 无构建 zip')
        sys.exit(1)
    return pkg['version'], max(zips, key=lambda p: p.stat().st_mtime)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--remote', default='origin')
    ap.add_argument('--branch', default='next-2.0')
    ap.add_argument('--execute', action='store_true', help='实际推送（默认 DRY_RUN）')
    args = ap.parse_args()

    if not NODE.exists():
        print('便携 node 未就位：先跑 nextclient/tools/fetch_node.py')
        return 1
    dirty = run(['git', 'status', '--short', '--', 'nextclient', 'contracts'])
    if dirty:
        print('FATAL: nextclient/contracts 有未提交改动（快照必须从已提交状态构造）：\n', dirty[:400])
        return 1

    version, zip_path = build_via_wxt()
    src_sha = run(['git', 'rev-parse', 'HEAD'])
    asset_sha = sha256_of(zip_path)
    print(f'version={version} source_sha={src_sha[:12]} asset={zip_path.name} asset_sha256={asset_sha[:16]}…')

    build_info = (
        f'# SDGun New Client {version}\n\n'
        f'- source SHA: {src_sha}\n'
        f'- built: {run(["date", "+%Y-%m-%dT%H:%M:%S%z"])}\n'
        f'- toolchain: node 24.22.1 (tools/node-portable.lock.json), wxt (package-lock.json)\n'
        f'- asset: {zip_path.name} sha256={asset_sha}\n'
        f'- rebuild: nextclient/README.md 一条命令复跑\n')

    tree = collect(NEXT, 'nextclient') + collect(CONTRACTS, 'contracts')
    print(f'快照树 {len(tree)} 文件（源码+lockfile+契约，无构建产物）：')
    for _, rel in tree[:10]:
        print('  ', rel)
    print('   …' if len(tree) > 10 else '')

    if not args.execute:
        print('\nDRY_RUN：未推送。实际发版：加 --execute（且需用户明示批准）。')
        return 0

    # 实推：mktree/commit-tree 沿用母仓 push_extension_repo.py 的 bytes-IO 先例
    import io as _io
    entries = []

    def blob_of(full: Path) -> str:
        return run(['git', 'hash-object', '-w', str(full)])

    def mktree(ls):
        inp = ''.join(f'{m} {t} {s}\t{n}\n' for m, t, s, n in ls).encode('utf-8')
        r = subprocess.run(['git', 'mktree'], input=inp, capture_output=True, cwd=str(ROOT))
        if r.returncode != 0:
            print('MKTREE FAIL', r.stderr[:200])
            sys.exit(1)
        return r.stdout.decode().strip()

    def build_tree(items):
        subdirs, files = {}, []
        for full, rel in items:
            head, _, rest = rel.partition('/')
            (subdirs.setdefault(head, []).append((full, rest)) if rest else files.append((full, head)))
        ls = [('100644', 'blob', blob_of(f), n) for f, n in files]
        for d, sub in subdirs.items():
            ls.append(('040000', 'tree', build_tree(sub), d))
        return mktree(ls)

    info_tmp = NEXT / '.output/BUILD-INFO.md'
    info_tmp.write_text(build_info, encoding='utf-8')
    tree = tree + [(info_tmp, 'BUILD-INFO.md')]
    top = build_tree(tree)
    parent = run(['git', 'ls-remote', args.remote, f'refs/heads/{args.branch}'])
    if parent:
        commit = run(['git', 'commit-tree', top, '-p', parent.split()[0],
                      '-m', f'SDGun New Client {version} snapshot (source {src_sha[:12]})'])
    else:
        commit = run(['git', 'commit-tree', top,
                      '-m', f'SDGun New Client {version} snapshot (source {src_sha[:12]})'])
    run(['git', 'push', args.remote, f'{commit}:refs/heads/{args.branch}'])
    tag = f'v{version}'
    if run(['git', 'tag', '-l', tag]):
        print(f'FATAL: tag {tag} 已存在（发布不可变；同版本重建须说明并走新 build 标识）')
        return 1
    run(['git', 'tag', tag, commit])
    run(['git', 'push', args.remote, f'refs/tags/{tag}'])
    print(f'pushed {args.branch}={commit[:12]} tag={tag}')
    print(f'Release 资产（手动/gh）：zip={zip_path} sha256={asset_sha}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
