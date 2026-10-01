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

// 诊断：读取当前活动论坛标签页的注入状态（MAIN world 可见信息）
document.getElementById('diag').addEventListener('click', async () => {
  const out = document.getElementById('diagout');
  out.style.display = 'block';
  out.value = '采集中…';
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !/sdgun\.com\.cn/.test(tab.url || '')) {
      out.value = '当前活动标签页不是论坛页面。请先打开 bbs.sdgun.com.cn 再点诊断。URL=' + (tab ? tab.url : '?');
      return;
    }
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      func: () => {
        const html = document.documentElement;
        const bodyStyle = getComputedStyle(document.body);
        const anchors = {
          forumdisplay: document.querySelectorAll('a[href*="mod=forumdisplay"]').length,
          viewthread: document.querySelectorAll('a[href*="mod=viewthread"]').length,
          filter: document.querySelectorAll('a[href*="filter="]').length,
        };
        return JSON.stringify({
          href: location.href.slice(0, 90),
          htmlClass: html.className || '(空)',
          bodyBg: bodyStyle.backgroundColor,
          hostList: !!document.getElementById('sdg-redraw-list'),
          hostThread: !!document.getElementById('sdg-redraw-host'),
          badge: !!document.getElementById('sdg-diag-badge'),
          anchors,
          title: document.title.slice(0, 40),
        }, null, 1);
      },
    });
    out.value = results.map((r) => r.result || JSON.stringify(r.error || null)).join('\n---\n');
  } catch (e) {
    out.value = '诊断失败: ' + String(e).slice(0, 200);
  }
});
