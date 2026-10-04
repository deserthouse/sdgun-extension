# Privacy Policy — SDGun Forum Web Access

_Last updated: 2026-10-04 (v1.6.6)_

This browser extension ("SDGun Forum Web Access") does not collect, store, or share any personal data. It contains no analytics, no tracking, and no remote code. Everything it does happens locally in your browser:

- **Mobile User-Agent presentation**: a declarative network rule scoped strictly to `*.sdgun.com.cn` presents a mobile User-Agent header, because the forum serves its mobile touch version only to mobile User-Agents. No other website is affected, and the extension sends nothing to any server beyond the page requests you yourself make to the forum.
- **Reading layer**: content scripts restyle the forum's own pages into a card layout (wide layout, dark mode, image lightbox). The re-rendering happens entirely on your device; if parsing fails, the original page is shown unchanged. No page content is stored.
- **Preferences**: your theme and feature toggles are saved in `chrome.storage.sync` — your own settings, stored by the browser (and carried through your own browser-account sync if you have it enabled). Nothing else is stored: no browsing history, no page content, no credentials.

Permissions rationale:

- `declarativeNetRequestWithHostAccess` + host permission on `*.sdgun.com.cn`: required to present the mobile User-Agent header on the forum domain only.
- `storage`: required to remember your display preferences (theme, toggles).
- `scripting`: used only by the popup's "diagnose current page" button, on demand, to report whether the restyling layer is active on the current forum tab.

The extension has no background process. If you contact the maintainer via GitHub, any communication follows GitHub's own privacy policy. This extension is an unofficial community tool and is not affiliated with SDGun.
