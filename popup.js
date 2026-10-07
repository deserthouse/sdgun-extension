// Popup: UA ruleset toggle + theming preferences (skin on/off, theme choice).
// Chrome persists DNR enabled-state and sync storage across restarts,
// so no background worker is needed.
const RULESETS = { ua: 'ua_rules' };

async function reflectState() {
  document.getElementById('ver').textContent = 'v' + chrome.runtime.getManifest().version;
  const enabled = new Set(
    (await chrome.declarativeNetRequest.getEnabledRulesets()).map(String),
  );
  for (const [key, id] of Object.entries(RULESETS)) {
    document.getElementById(key).checked = enabled.has(id);
  }
  const prefs = await chrome.storage.sync.get({ skin: true, theme: 'auto', redraw: true });
  document.getElementById('skin').checked = prefs.skin;
  document.getElementById('redraw').checked = prefs.redraw;
  for (const b of document.querySelectorAll('#theme button')) {
    b.classList.toggle('on', b.dataset.v === prefs.theme);
  }
}

async function toggle(id, on) {
  const update = on
    ? { enableRulesetIds: [id] }
    : { disableRulesetIds: [id] };
  await chrome.declarativeNetRequest.updateEnabledRulesets(update);
}

document.getElementById('ua').addEventListener('change', (e) =>
  toggle(RULESETS.ua, e.target.checked));

document.getElementById('skin').addEventListener('change', (e) =>
  chrome.storage.sync.set({ skin: e.target.checked }));

document.getElementById('redraw').addEventListener('change', (e) =>
  chrome.storage.sync.set({ redraw: e.target.checked }));

document.querySelectorAll('#theme button').forEach((b) => {
  b.addEventListener('click', async () => {
    await chrome.storage.sync.set({ theme: b.dataset.v });
    for (const x of document.querySelectorAll('#theme button')) {
      x.classList.toggle('on', x === b);
    }
  });
});

document.getElementById('open').addEventListener('click', () =>
  chrome.tabs.create({ url: 'https://bbs.sdgun.com.cn/forum.php?forumlist=1&mobile=2' }));

reflectState();

// ---- 状态面板（自动）：当前论坛页的页型/形态/重绘挂载一览 ----
// 形态分类与 navguard/boot 的判定口径一致（2026-10-05 popup 升级）
async function activeForumTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !/sdgun\.com\.cn/.test(tab.url || '')) return null;
  return tab;
}

async function refreshStatus() {
  const box = document.getElementById('status');
  try {
    const tab = await activeForumTab();
    if (!tab) { box.style.display = 'none'; return; }
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const cls = document.documentElement.className || '';
        const pageType = cls.includes('sdg-page-viewthread') ? '帖子页'
          : cls.includes('sdg-page-forumdisplay') ? '板块页'
          : cls.includes('sdg-page-forumlist') ? '论坛首页' : '其他/登录页';
        let form = '未知形态';
        if (/\/portal\.php$/.test(location.pathname)) form = '门户页（守卫会送回论坛）';
        else if (document.querySelector('#sdg-redraw-list, #sdg-redraw-host')) form = '已重绘（卡片/行式）';
        else if (document.querySelector('.sub_forum') && !document.querySelector('.sub_forum a')) form = '⚠ 服务器空壳';
        else if (document.querySelector('[data-byginto], .sub_forum')) form = 'bygsjw 富模板';
        else if (document.querySelector('div.bm')) form = '标准移动模板';
        const rail = !!document.getElementById('sdg-rail');
        const sidebar = !!document.getElementById('sdg-sidebar');
        const badge = (document.getElementById('sdg-diag-badge') || {}).textContent || null;
        return { pageType, form, sidebar, rail, badge, url: location.href.slice(0, 80) };
      },
    });
    const s = results[0].result;
    if (!s) { box.style.display = 'none'; return; }
    box.style.display = 'block';
    box.innerHTML =
      `<b style="color:#9f9">${s.pageType}</b> · ${s.form}` +
      `<br>侧栏 ${s.sidebar ? '✓' : '—'} · 右栏 ${s.rail ? '✓' : '—'} · 主题${s.badge ? '' : '正常'}` +
      (s.badge ? `<br><span style="color:#f99">⚠ ${s.badge}</span>` : '');
  } catch (e) {
    box.style.display = 'none';
  }
}
refreshStatus();

// ---- 诊断报告（含会话导航轨迹）+ 一键复制 ----
async function collectDiagnostics() {
  const tab = await activeForumTab();
  if (!tab) {
    return '当前活动标签页不是论坛页面。请先打开 bbs.sdgun.com.cn 再点诊断。URL=' + (tab ? tab.url : '?');
  }
  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id, allFrames: true },
    func: () => {
      const html = document.documentElement;
      const navlog = (() => { try { return JSON.parse(sessionStorage.getItem('sdg_navlog') || '[]'); } catch (e) { return []; } })();
      const anchors = {
        forumdisplay: document.querySelectorAll('a[href*="mod=forumdisplay"]').length,
        viewthread: document.querySelectorAll('a[href*="mod=viewthread"]').length,
        filter: document.querySelectorAll('a[href*="filter="]').length,
      };
      return JSON.stringify({
        href: location.href.slice(0, 90),
        htmlClass: html.className || '(空)',
        hostList: !!document.getElementById('sdg-redraw-list'),
        hostThread: !!document.getElementById('sdg-redraw-host'),
        sidebar: !!document.getElementById('sdg-sidebar'),
        rail: !!document.getElementById('sdg-rail'),
        badge: (document.getElementById('sdg-diag-badge') || {}).textContent || null,
        anchors,
        navTrail: navlog,
        title: document.title.slice(0, 40),
      }, null, 1);
    },
  });
  const ver = chrome.runtime.getManifest().version;
  const head = `SDGun 扩展诊断 v${ver} · ${new Date().toLocaleString()}\n`;
  return head + results.map((r) => r.result || JSON.stringify(r.error || null)).join('\n---\n');
}

document.getElementById('diag').addEventListener('click', async () => {
  const out = document.getElementById('diagout');
  const cp = document.getElementById('copydiag');
  out.style.display = 'block';
  cp.style.display = 'block';
  out.value = '采集中…';
  try {
    out.value = await collectDiagnostics();
  } catch (e) {
    out.value = '诊断失败: ' + String(e).slice(0, 200);
  }
});

document.getElementById('copydiag').addEventListener('click', async () => {
  const cp = document.getElementById('copydiag');
  try {
    const text = await collectDiagnostics();
    await navigator.clipboard.writeText(text);
    cp.textContent = '已复制 ✓';
    setTimeout(() => { cp.textContent = '复制诊断信息'; }, 1500);
  } catch (e) {
    cp.textContent = '复制失败';
    setTimeout(() => { cp.textContent = '复制诊断信息'; }, 1500);
  }
});
