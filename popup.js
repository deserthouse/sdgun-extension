// Popup: UA ruleset toggle + theming preferences (skin on/off, theme choice).
// Chrome persists DNR enabled-state and sync storage across restarts,
// so no background worker is needed.
const RULESETS = { ua: 'ua_rules' };

async function reflectState() {
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
