# -*- coding: utf-8 -*-
"""SDGun Web Access 扩展打包/自测脚本

用法:
  python tools/extension_build.py            # 校验 + 打包两种 zip 到 dist/
  python tools/extension_build.py --test     # 额外在临时目录跑 CLI 加载冒烟测试

流程: JSON/manifest 一致性校验 -> 打包 -> (可选)拷贝到临时目录做 CLI 冒烟。
绝不直接对扩展源码目录跑加载测试 —— CLI 测试会生成 _metadata 缓存,
污染用户接下来的 UI 安装(v1.0.0~1.0.4 安装拉锯战的疑似帮凶)。
"""
import json, os, shutil, subprocess, sys, tempfile, zipfile

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # 扩展文件就在仓库根
DIST = os.path.join(REPO, 'dist')
NAME = 'sdgun-forum-web-access'
EXCLUDE_DIRS = {'_metadata', 'tools', 'dist', '.git'}
EXCLUDE_FILES = {'README.md'}

def check():
    man = json.load(open(os.path.join(REPO, 'manifest.json'), encoding='utf-8'))
    for rs in man['declarative_net_request']['rule_resources']:
        rules = json.load(open(os.path.join(REPO, rs['path']), encoding='utf-8'))
        ids = [r['id'] for r in rules]
        assert len(ids) == len(set(ids)), f'dup rule id in {rs["path"]}'
        for r in rules:
            a = r['action']
            if a['type'] == 'redirect':
                assert ('url' in a) != ('regexSubstitution' in a), f'rule {r["id"]}: mixed redirect form'
            if a['type'] == 'modifyHeaders':
                for h in a.get('requestHeaders', []) + a.get('responseHeaders', []):
                    assert h['header'] and h['operation'], f'rule {r["id"]}: bad header op'
    print(f'[check] manifest v{man["version"]}, rulesets:',
          [r['path'] for r in man['declarative_net_request']['rule_resources']])
    return man['version']

def pack(version, out_zip, store_layout):
    """store_layout=False: zip 内含 <name>/ 顶层目录(解压即装/GitHub release)
       store_layout=True:  manifest 在 zip 根目录(Edge/Chrome 商店提交格式)"""
    with zipfile.ZipFile(out_zip, 'w', zipfile.ZIP_DEFLATED) as z:
        for root, dirs, files in os.walk(REPO):
            dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]
            for f in files:
                if f in EXCLUDE_FILES:
                    continue
                p = os.path.join(root, f)
                arc = os.path.relpath(p, REPO).replace(os.sep, '/')
                if not store_layout:
                    arc = f'{NAME}/{arc}'
                z.write(p, arc)
    print(f'[pack] {os.path.basename(out_zip)} ({os.path.getsize(out_zip)}B, store_layout={store_layout})')

def smoke_test():
    """拷贝扩展文件到临时目录后 CLI 加载冒烟 —— 永远不在源码目录上跑"""
    tmp = tempfile.mkdtemp(prefix='sdgun_ext_smoke_')
    try:
        copy = os.path.join(tmp, 'ext')
        os.makedirs(copy)
        for root, dirs, files in os.walk(REPO):
            dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]
            for f in files:
                if f in EXCLUDE_FILES:
                    continue
                rel = os.path.relpath(os.path.join(root, f), REPO)
                dst = os.path.join(copy, rel)
                os.makedirs(os.path.dirname(dst), exist_ok=True)
                shutil.copy2(os.path.join(root, f), dst)
        edge = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
        if not os.path.exists(edge):
            edge = r'C:\Program Files\Microsoft\Edge\Application\msedge.exe'
        profile = tempfile.mkdtemp(prefix='sdgun_ext_prof_')
        p = subprocess.run(
            [edge, '--headless=new', '--disable-gpu', '--enable-logging=stderr',
             f'--user-data-dir={profile}', f'--load-extension={copy}',
             '--timeout=3000', 'about:blank'],
            capture_output=True, text=True, timeout=40)
        shutil.rmtree(profile, ignore_errors=True)
        bad = [l for l in p.stderr.splitlines()
               if any(k in l.lower() for k in ('incorrect', 'invalid', 'could not', "couldn't"))]
        if bad:
            print('[smoke] FAIL:'); [print(' ', l[:200]) for l in bad[:5]]; sys.exit(1)
        print('[smoke] clean')
    finally:
        shutil.rmtree(tmp, ignore_errors=True)

if __name__ == '__main__':
    shutil.rmtree(os.path.join(REPO, '_metadata'), ignore_errors=True)  # stale CLI cache
    v = check()
    os.makedirs(DIST, exist_ok=True)
    for f in os.listdir(DIST):
        if f.startswith(NAME):
            os.remove(os.path.join(DIST, f))
    pack(v, os.path.join(DIST, f'{NAME}-v{v}.zip'), store_layout=False)
    pack(v, os.path.join(DIST, f'{NAME}-v{v}-store.zip'), store_layout=True)
    if '--test' in sys.argv:
        smoke_test()
