# -*- coding: utf-8 -*-
"""受控复现实验：Edge 对 DNR redirect 规则的 UI 安装校验

变量矩阵（每组=独立临时扩展目录+独立临时 profile，全部干净拷贝）：
  A: v1.0.2 redirects（url 形式 3 条）+ v1.0.5 ua   —— 用户报错 id 204 的组合
  B: 仅 url 形式 redirect 规则（无 ua 规则）
  C: 仅 regexSubstitution redirect 规则
  D: v1.0.5 ua + 修复后 enum 的 redirects（候选恢复形态）

判定：CLI headless 加载读 stderr；同时用 --dump-dom 访问 mag1 死链看落点是否被重定向
（重定向生效 = 规则被实际加载执行，比安装提示更硬）。
"""
import json, os, shutil, subprocess, tempfile, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EXT = ROOT
EDGE_CANDIDATES = [
    r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe',
    r'C:\Program Files\Microsoft\Edge\Application\msedge.exe',
]
EDGE = next(e for e in EDGE_CANDIDATES if os.path.exists(e))

URL_FORM = [
    {"id": 204, "priority": 1,
     "action": {"type": "redirect", "url": "https://bbs.sdgun.com.cn/forum.php?forumlist=1&mobile=2"},
     "condition": {"regexFilter": "^https://(www\\.)?sdgun\\.net/", "resourceTypes": ["main_frame"]}},
    {"id": 206, "priority": 1,
     "action": {"type": "redirect", "url": "https://bbs.sdgun.com.cn/forum.php?forumlist=1&mobile=2"},
     "condition": {"regexFilter": "^https://mag1\\.sdgun\\.net/", "resourceTypes": ["main_frame"]}},
]
REGEX_FORM = [
    {"id": 201, "priority": 3,
     "action": {"type": "redirect",
                "regexSubstitution": "https://bbs.sdgun.com.cn/forum.php?mod=viewthread&tid=\\1&mobile=2"},
     "condition": {"regexFilter": "^https://mag1\\.sdgun\\.net/mag/wap/v1/wap/waphome/topicindex\\?id=(\\d+)",
                   "resourceTypes": ["main_frame"]}},
]
UA_RULE = json.load(open(os.path.join(EXT, 'rules/ua.json'), encoding='utf-8'))

def make_variant(name, redirects):
    src = tempfile.mkdtemp(prefix=f'dnrx_{name}_')
    dst = os.path.join(src, 'ext')
    shutil.copytree(EXT, dst)
    shutil.rmtree(os.path.join(dst, '_metadata'), ignore_errors=True)
    json.dump(redirects, open(os.path.join(dst, 'rules/redirects.json'), 'w', encoding='utf-8'),
              ensure_ascii=False, indent=1)
    man_path = os.path.join(dst, 'manifest.json')
    man = json.load(open(man_path, encoding='utf-8'))
    if redirects:
        man['declarative_net_request']['rule_resources'].append(
            {"id": "redirect_rules", "enabled": True, "path": "rules/redirects.json"})
    json.dump(man, open(man_path, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
    return dst

def run_case(name, redirects, probe_url=None):
    ext_dir = make_variant(name, redirects)
    profile = tempfile.mkdtemp(prefix=f'dnrx_prof_{name}_')
    res = {}
    try:
        # 1) install-time check via stderr logging
        p = subprocess.run(
            [EDGE, '--headless=new', '--disable-gpu', '--enable-logging=stderr',
             f'--user-data-dir={profile}', f'--load-extension={ext_dir}',
             '--timeout=2500', 'about:blank'],
            capture_output=True, text=True, timeout=40)
        bad = [l for l in p.stderr.splitlines()
               if any(k in l.lower() for k in ('incorrect', 'invalid', "couldn't", 'could not'))]
        res['install'] = bad[0][:160] if bad else 'clean'
        # 2) functional probe: does the redirect actually fire?
        if probe_url:
            profile2 = tempfile.mkdtemp(prefix=f'dnrx_p2_{name}_')
            try:
                q = subprocess.run(
                    [EDGE, '--headless=new', '--disable-gpu',
                     f'--user-data-dir={profile2}', f'--load-extension={ext_dir}',
                     '--virtual-time-budget=12000', '--timeout=20000', '--dump-dom', probe_url],
                    capture_output=True, text=True, timeout=60)
                dom = q.stdout
                if '<title>' in dom[:4000]:
                    import re
                    m = re.search(r'forum\.php\?[^"\'<\s]*viewthread[^"\'<\s]*', dom)
                    res['redirect_fired'] = bool(m) or 'forumlist' in dom
                    res['dom_title'] = re.search(r'<title>([^<]*)</title>', dom).group(1)[:50]
                else:
                    res['redirect_fired'] = 'no-dom(headless race)'
            finally:
                shutil.rmtree(profile2, ignore_errors=True)
    finally:
        shutil.rmtree(profile, ignore_errors=True)
        shutil.rmtree(os.path.dirname(ext_dir), ignore_errors=True)
    print(f'[{name}] install={res["install"]}')
    if probe_url:
        print(f'         redirect_fired={res.get("redirect_fired")} dom={res.get("dom_title","")}')
    return res

if __name__ == '__main__':
    print('Edge:', EDGE)
    run_case('A_url_plus_ua_v102', URL_FORM,
             'https://mag1.sdgun.net/mag/wap/v1/wap/waphome/topicindex?id=100000')
    run_case('B_url_only', URL_FORM)
    run_case('C_regex_only', REGEX_FORM)
    run_case('D_url_plus_ua_fixed', URL_FORM,
             'https://mag1.sdgun.net/mag/wap/v1/wap/waphome/topicindex?id=100000')
