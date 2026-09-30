# Privacy Policy — SDGun Forum Web Access

_Last updated: 2026-09-30 (v1.0.5)_

This browser extension ("SDGun Forum Web Access") does not collect, store, transmit, or share any personal data. It contains no analytics, no tracking, and no remote code.

What it does, entirely on your device:

Presents a mobile User-Agent header for requests to `*.sdgun.com.cn`, so the forum serves its mobile touch version to desktop browsers (the site blocks desktop User-Agents).

This behavior is implemented as a declarative network rule scoped strictly to `*.sdgun.com.cn`. No other website is affected. The extension has no background process, stores no browsing history, and sends nothing to any server other than the requests you yourself make to the SDGun forum.

Permissions rationale:

- `declarativeNetRequestWithHostAccess` + host permission on `*.sdgun.com.cn`: required to modify the User-Agent header as described above.

If you contact the maintainer via GitHub, any communication follows GitHub's own privacy policy. This extension is an unofficial community tool and is not affiliated with SDGun.
