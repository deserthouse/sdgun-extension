// Toggle DNR static rulesets. Chrome persists enabled-state across restarts,
// so no background worker is needed.
const RULESETS = { ua: 'ua_rules', rd: 'redirect_rules' };

async function reflectState() {
  const enabled = new Set(
    (await chrome.declarativeNetRequest.getEnabledRulesets()).map(String),
  );
  for (const [key, id] of Object.entries(RULESETS)) {
    document.getElementById(key).checked = enabled.has(id);
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
document.getElementById('rd').addEventListener('change', (e) =>
  toggle(RULESETS.rd, e.target.checked));
document.getElementById('open').addEventListener('click', () =>
  chrome.tabs.create({ url: 'https://bbs.sdgun.com.cn/forum.php?forumlist=1&mobile=2' }));

reflectState();
