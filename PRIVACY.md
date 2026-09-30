# Privacy Policy — SDGun Forum Web Access

_Last updated: 2026-09-30_

This browser extension ("SDGun Forum Web Access") does not collect, store, transmit, or share any personal data. It contains no analytics, no tracking, and no remote code.

What it does, entirely on your device:

1. Presents a mobile User-Agent header for requests to `*.sdgun.com.cn`, so the forum serves its mobile touch version to desktop browsers (the site blocks desktop UAs).
2. Redirects navigation to legacy SDGun hostnames (`mag1.sdgun.net`, `app.sdgun.com.cn`, `https://sdgun.net`) to the working forum at `bbs.sdgun.com.cn`.

Both behaviors are implemented as declarative network rules scoped strictly to `*.sdgun.com.cn` and `*.sdgun.net`. No other website is affected. The extension has no background process, stores no browsing history, and sends nothing to any server other than the requests you yourself make to the SDGun forum.

Permissions rationale:

- `declarativeNetRequestWithHostAccess` + host permissions on `*.sdgun.com.cn` / `*.sdgun.net`: required to modify the User-Agent header and perform the redirects described above.

If you contact the maintainer via GitHub, any communication follows GitHub's own privacy policy. This extension is an unofficial community tool and is not affiliated with SDGun.
