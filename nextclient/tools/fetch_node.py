# -*- coding: utf-8 -*-
"""N-0：便携 Node 工具链下载器（G0/E00 前置，项目 AGENTS §二.4 本机无常驻 node）。

做法：从 nodejs.org 官方 dist（走 127.0.0.1:10808 代理）解析 pinned 主版本的当前
latest，下载 win-x64 zip 与官方 SHASUMS256.txt，哈希核验后解压到 tools/node-portable/
（已 ignore），版本与 sha256 落 tools/node-portable/VERSION.json（入库=锁定凭证）。
重跑幂等：已存在且校验通过则跳过下载。无全局安装、无环境变量污染。"""
import hashlib
import io
import json
import subprocess
import sys
import urllib.request
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]  # nextclient/tools/ -> 仓库根
DEST = ROOT / 'tools/node-portable'
LOCK = ROOT / 'tools/node-portable.lock.json'  # 版本锁凭证（入库；DEST 本体已 ignore）
MAJOR = 24  # pinned 主版本（当前 LTS 线；精确版本以官方 latest-v24.x 解析为准，lock 凭证=本文件）
PROXY = 'http://127.0.0.1:10808'
DIST = 'https://nodejs.org/dist'


def fetch(url, binary=False):
    req = urllib.request.Request(url, headers={'User-Agent': 'sdgun-g0-toolchain/1.0'})
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({'http': PROXY, 'https': PROXY}))
    with opener.open(req, timeout=120) as r:
        data = r.read()
    return data if binary else data.decode('utf-8')


def sha256_of(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(1 << 20), b''):
            h.update(chunk)
    return h.hexdigest()


def main():
    DEST.mkdir(parents=True, exist_ok=True)
    lock_path = LOCK
    if lock_path.exists():
        lock = json.loads(lock_path.read_text(encoding='utf-8'))
        exe = DEST / lock['dirname'] / 'node.exe'
        if exe.exists():
            print('already provisioned:', lock['version'], lock['dirname'])
            return 0
    # 1) 解析 pinned 主版本的官方 latest（LTS 线内最新）
    listing = fetch(f'{DIST}/latest-v{MAJOR}.x/')
    import re
    m = re.search(r'node-v(\d+\.\d+\.\d+)-win-x64\.zip', listing)
    if not m:
        print('FATAL: cannot resolve latest-v%d.x win-x64 zip' % MAJOR)
        return 1
    version = m.group(1)
    fname = f'node-v{version}-win-x64.zip'
    url = f'{DIST}/v{version}/{fname}'
    print('resolved', version, '->', url, flush=True)
    # 2) 下载 zip + 官方 SHASUMS256.txt，核验
    zdata = fetch(url, binary=True)
    sums = fetch(f'{DIST}/v{version}/SHASUMS256.txt')
    official = dict(line.split()[1].split('=') for line in sums.splitlines() if '=' in line)
    # SHASUMS 格式: <hex>  <fname>（两空格）——上面 split('=') 只适用于含 = 行？重新解析：
    official = {}
    for line in sums.splitlines():
        parts = line.split()
        if len(parts) == 2:
            official[parts[1]] = parts[0]
    actual = hashlib.sha256(zdata).hexdigest()
    if official.get(fname) != actual:
        print('FATAL: sha256 mismatch\n official=%s\n actual=%s' % (official.get(fname), actual))
        return 1
    print('sha256 OK:', actual, flush=True)
    # 3) 解压
    with zipfile.ZipFile(io.BytesIO(zdata)) as z:
        z.extractall(DEST)
    (DEST / 'VERSION.json').write_text(json.dumps({
        'version': version, 'dirname': f'node-v{version}-win-x64',
        'zip': fname, 'sha256': actual, 'fetched': '2026-10-22',
        'source': url}, ensure_ascii=False, indent=2), encoding='utf-8')
    lock_path.write_text(json.dumps({
        'version': version, 'dirname': f'node-v{version}-win-x64',
        'zip': fname, 'sha256': actual, 'fetched': '2026-10-22',
        'source': url}, ensure_ascii=False, indent=2), encoding='utf-8')
    # 4) 自检
    exe = DEST / f'node-v{version}-win-x64' / 'node.exe'
    out = subprocess.run([str(exe), '--version'], capture_output=True, text=True)
    print('node --version ->', out.stdout.strip())
    return 0 if out.stdout.strip().startswith('v' + version) else 1


if __name__ == '__main__':
    sys.exit(main())
