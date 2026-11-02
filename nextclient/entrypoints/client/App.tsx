import { useEffect, useRef, useState } from 'react';
import { browser } from 'wxt/browser';
import { useQueryClient } from '@tanstack/react-query';
import { applyTheme, setThemeMode, themeMode, watchSystemTheme, type ThemeMode } from '../../lib/theme';
import { epochProbe, type EpochProbe } from '../../lib/epoch';
import { setTakeoverEnabled, takeoverEnabled } from '../../lib/switch';
import { useEndpoint } from '../../lib/queries';
import { useSession } from '../../lib/session';
import { BoardPage, CommunityPage, FocusPage, MyPage, UserProfilePage } from './pages';
import { MessagesPage } from './messages';
import { IconFocus, IconCommunity, IconMail, IconUser, IconSearch, IconGear } from './icons';
import { EditorPage } from './editor';
import { ThreadPage } from './thread';
import { SearchPage } from './search';
import { AccountSettingsPage } from './account';

const TABS = [
  { id: 'focus', label: '聚焦', icon: IconFocus },
  { id: 'community', label: '社区', icon: IconCommunity },
  { id: 'messages', label: '消息', icon: IconMail },
  { id: 'my', label: '我的', icon: IconUser },
] as const;

function currentRoute(): { name: string; param?: string; param2?: string } {
  const h = location.hash.replace(/^#\/?/, '');
  const board = h.match(/^board\/(\d+)/);
  if (board) return { name: 'board', param: board[1] };
  const thread = h.match(/^thread\/(\d+)(?:\/(\d+))?/);
  if (thread) return { name: 'thread', param: thread[1], param2: thread[2] };
  const user = h.match(/^user\/(\d+)(?:\/(fans|follows))?/); // F2-1：粉丝/关注列表子路由
  if (user) return { name: 'user', param: user[1], param2: user[2] };
  const editor = h.match(/^editor(?:\?tid=(\d+))?/); // C1-5：#/editor?tid=N=回复模式
  if (editor) return { name: 'editor', param: editor[1] };
  if (h === 'settings') return { name: 'settings' };
  if (h === 'about') return { name: 'about' }; // B-2：关于页
  if (h === 'search') return { name: 'search' }; // G4：原生搜索
  if (h === 'account') return { name: 'account' }; // G5：账号设置
  if (TABS.some((t) => t.id === h)) return { name: h };
  return { name: 'focus' };
}

export default function App() {
  const [route, setRoute] = useState<{ name: string; param?: string; param2?: string }>(currentRoute);
  const [probe, setProbe] = useState<EpochProbe | null>(null);
  const [mode, setMode] = useState<ThemeMode>(themeMode);
  const [takeover, setTakeover] = useState<boolean | null>(null); // null=未读
  const [cacheMsg, setCacheMsg] = useState('');
  // R3-2 未读徽标：登录态通知摘要（计数含私信+系统+好友申请）
  const { session: navSession } = useSession();
  const navAuthed = navSession !== 'loading' && navSession.auth !== null;
  // G1b 未读轮询：登录态 60s 自动刷新 + 窗口聚焦即刷（浏览器关闭不承诺送达——已背书口径）
  const notifyQ = useEndpoint('userNotifyIndex', {}, { enabled: navAuthed, refetchMs: 60000 });
  const nd = (notifyQ.data as any)?.data ?? {};
  const msgUnread = (Number(nd.has_letter) || 0) + (Number(nd.system_notify_count) || 0)
    + (Number(nd.friend_apply_count) || 0);
  const [bannerOpen, setBannerOpen] = useState(() => {
    try { return localStorage.getItem('sdg2.banner.dismissed') !== '1'; } catch { return true; }
  });
  // F3-1 1001 重登引导：登录态查询被 1001 拒（token 失效）→ 全局横幅。
  // 不自动清 session；用户点「前往登录」或手动关闭消除。
  const [authExpired, setAuthExpired] = useState(false);
  const qc = useQueryClient();

  useEffect(() => { takeoverEnabled().then(setTakeover).catch(() => setTakeover(false)); }, []);

  useEffect(() => {
    applyTheme();
    watchSystemTheme();
    const onHash = () => {
      setRoute(currentRoute());
      // 到登录页即消横幅（登录动作本身会走 SessionProvider 刷新）
      if (currentRoute().name === 'my') setAuthExpired(false);
    };
    const onExpired = () => setAuthExpired(true);
    window.addEventListener('hashchange', onHash);
    window.addEventListener('sdg2:auth-expired', onExpired);
    return () => {
      window.removeEventListener('hashchange', onHash);
      window.removeEventListener('sdg2:auth-expired', onExpired);
    };
  }, []);

  useEffect(() => {
    let alive = true;
    // 诊断探针只读（epochStart 已移入 SessionProvider ready 守卫——C3-4）
    epochProbe()
      .then((p) => { if (alive) setProbe(p); })
      .catch(() => {});
    return () => { alive = false; };
  }, [route]);

  const tab = TABS.find((t) => t.id === route.name) ?? TABS[0];
  const isTab = TABS.some((t) => t.id === route.name);

  // C1-6 清除本机缓存：查询缓存（内存）+ localStorage sdg2.* 残留键。
  // 草稿（sdg2.draft.*，用户内容）与主题（sdg2.theme，偏好）明确保留——
  // 计划原字面「清 sdg2.*」会连用户草稿一起删，收窄（auth/epoch=登出语义不动）。
  function clearCache() {
    qc.clear();
    let n = 0;
    try {
      const kill: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('sdg2.') && !k.startsWith('sdg2.draft.') && k !== 'sdg2.theme') {
          kill.push(k);
        }
      }
      kill.forEach((k) => localStorage.removeItem(k));
      n = kill.length;
    } catch { /* 存储不可用时仅清内存缓存 */ }
    setCacheMsg(`已清除查询缓存${n > 0 ? `与 ${n} 项残留键` : ''}（草稿与主题保留）`);
  }

  // B-1（E31-06）横幅独立层：fixed 顶栏 + 实测高度变量——侧导航用同一变量
  // 收缩自身高度（100vh - banner），「设置」入口不再依赖滚动露出。
  const bannerRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = bannerRef.current;
    if (!el) return;
    const apply = () => {
      try {
        document.documentElement.style.setProperty('--sdg-banner-h', `${el.offsetHeight}px`);
      } catch { /* 非页面环境 */ }
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => {
      ro.disconnect();
      try { document.documentElement.style.setProperty('--sdg-banner-h', '0px'); } catch { /* 同上 */ }
    };
  }, [takeover, bannerOpen, authExpired]);

  return (
    <>
      <div ref={bannerRef} data-test="banner-stack" className="banner-stack">
        {takeover === false && bannerOpen && (  // E1-3 提示；W2 视觉审查：可关闭+去布局耦合文案
          <div data-test="takeover-banner" style={{
            background: 'var(--surface2)', color: 'var(--text2)', fontSize: 12.5,
            padding: '7px 16px', borderBottom: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <span style={{ flex: 1 }}>
              站点接管未启用：论坛页仍由经典重绘渲染，本客户端页面始终可用；可在设置中开启。
            </span>
            <button className="btn" data-test="banner-dismiss" style={{ padding: '2px 10px' }}
              onClick={() => { try { localStorage.setItem('sdg2.banner.dismissed', '1'); } catch {} setBannerOpen(false); }}>
              知道了
            </button>
          </div>
        )}
        {authExpired && (
          <div data-test="relogin-banner" style={{
            background: 'var(--accent-soft)', color: 'var(--text)', fontSize: 12.5,
            padding: '7px 16px', borderBottom: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <span style={{ flex: 1 }}>
              登录已过期：服务端拒绝了会话凭证（code 1001），重新登录后继续使用账号功能。
            </span>
            <a className="btn btn-primary" data-test="relogin-go" href="#/my" style={{ padding: '2px 10px' }}>
              前往登录
            </a>
            <button className="btn" data-test="relogin-dismiss" style={{ padding: '2px 10px' }}
              onClick={() => setAuthExpired(false)}>关闭</button>
          </div>
        )}
      </div>
      <div className="shell">
      <nav className="navcol" aria-label="主导航">
        <div className="navbrand">SDGun<span className="navbrand-sub">客户端</span></div>
        {TABS.map((t) => {
          const Icon = t.icon;
          const unread = t.id === 'messages' ? msgUnread : 0;
          return (
            <a key={t.id} href={`#/${t.id}`} data-tab={t.id} title={t.label}
              className="navlink"
              aria-current={(route.name === t.id
                || (t.id === 'community' && ['board', 'thread', 'editor'].includes(route.name)))
                ? 'page' : undefined}>
              <Icon />
              <span>{t.label}</span>
              {unread > 0 && <i className="navbadge" data-test="nav-unread"
                aria-label={`${unread} 条未读`}>{unread > 99 ? '99+' : unread}</i>}
            </a>
          );
        })}
        <a className="navlink navtools" data-test="search-entry" href="#/search"
          aria-current={route.name === 'search' ? 'page' : undefined}>
          <IconSearch /><span>搜索</span>
        </a>
        <div className="navfoot">
          <a className="navlink" data-test="settings-link" href="#/settings" title="设置"
            aria-current={route.name === 'settings' ? 'page' : undefined}>
            <IconGear /><span>设置</span>
          </a>
        </div>
      </nav>
      <main className="main">
        {route.name === 'board'
          ? <BoardPage key={route.param} fid={route.param!} />
          : route.name === 'thread'
          ? <ThreadPage key={route.param} tid={route.param!} pid={route.param2} />
          : route.name === 'user'
          ? <UserProfilePage key={route.param} uid={route.param!}
              tab={route.param2 as 'fans' | 'follows' | undefined} />
          : route.name === 'editor'
          ? <EditorPage key={route.param ?? 'compose'} tid={route.param} />
          : route.name === 'about'
          ? <AboutPage probe={probe} />
          : route.name === 'search'
          ? <SearchPage />
          : route.name === 'account'
          ? <AccountSettingsPage />
          : route.name === 'settings'
          ? (
            <div data-test="settings-page">
              <div className="page-header">
                <h1 className="page-title" data-test="page-title">设置</h1>
              </div>
              <div className="setrow">
                <label htmlFor="theme-select" className="setrow-label">外观主题</label>
                <select id="theme-select" className="setrow-select" data-test="theme" value={mode}
                  onChange={(e) => { const v = e.target.value as ThemeMode; setMode(v); setThemeMode(v); }}>
                  <option value="auto">跟随系统</option>
                  <option value="light">浅色</option>
                  <option value="dark">深色</option>
                </select>
              </div>
              <div className="setrow">
                <label id="takeover-label" className="setrow-label">启用站点接管</label>
                <button id="takeover-check" className="toggle" data-test="takeover"
                  role="switch" aria-checked={takeover === true} aria-labelledby="takeover-label"
                  disabled={takeover === null}
                  onClick={() => { const v = !(takeover === true); setTakeover(v); setTakeoverEnabled(v); }}>
                  <span className="toggle-knob" />
                </button>
              </div>
              <div className="setrow">
                <label className="setrow-label">清除本机缓存</label>
                <button className="btn" data-test="clear-cache" onClick={clearCache}>清除</button>
              </div>
              {cacheMsg && (
                <p data-test="clear-cache-msg" className="page-sub" style={{ margin: '8px 2px' }}>{cacheMsg}</p>
              )}
              <p className="page-sub" style={{ lineHeight: 1.6 }}>
                站点接管开启后，论坛页面将改由本客户端渲染；可随时关闭回到经典模式。
              </p>
              <div className="section-title" style={{ color: 'var(--text3)' }}>关于</div>
              <div className="setrow" style={{ alignItems: 'center' }}>
                <span className="setrow-label">版本、数据源与声明</span>
                <a className="btn" data-test="about-entry" href="#/about">查看</a>
              </div>
              <details className="page-sub">
                <summary style={{ cursor: 'pointer' }}>诊断信息</summary>
                <div style={{ marginTop: 8 }}>
                  epoch：{probe ? (probe.epoch ?? '无') : '…'}<br />
                  auth 规则：{probe ? probe.rulesCount : '…'}
                </div>
              </details>
            </div>
          )
          : (
            <>
              <div className="page-header">
                <h1 className="page-title" data-test="page-title">{tab.label}</h1>
              </div>
              {route.name === 'focus' && <FocusPage />}
              {route.name === 'community' && <CommunityPage />}
              {route.name === 'messages' && <MessagesPage />}
              {route.name === 'my' && <MyPage />}
            </>
          )}
      </main>
      </div>
    </>
  );
}

// B-2 关于页（E31-06）：版本（manifest 事实源）、数据源与存储披露、声明入口。
// 文案口径=README「唯一官方分发渠道」+AI 披露既有表述，不新增承诺。
function AboutPage({ probe }: { probe: EpochProbe | null }) {
  let ver = '';
  let verName = '';
  try {
    const m = browser.runtime.getManifest();
    ver = String(m.version ?? '');
    verName = String((m as { version_name?: string }).version_name ?? '');
  } catch { /* 非 extension 环境 */ }
  return (
    <div data-test="about-page">
      <div className="page-header">
        <p className="crumb"><a href="#/settings">‹ 设置</a></p>
        <h1 className="page-title" data-test="page-title">关于</h1>
      </div>
      <div className="card">
        <div className="card-title">SDGun 客户端（浏览器版）</div>
        <div className="card-meta" data-test="about-version">
          版本 {verName || ver || '未知'}{verName && ver !== verName ? `（manifest ${ver}）` : ''}
          {' '}· 预发布通道（alpha）
        </div>
        <p className="page-sub" style={{ lineHeight: 1.7 }}>
          本扩展是 SDGun 论坛（bbs.sdgun.com.cn）的第三方非官方客户端：阅读走触屏版网页，
          资讯/帖子数据走官方 App 同源接口（app.sdgun.com.cn / mag1.sdgun.net / picapp.sdgun.net）。
          GitHub 仓库是本扩展的唯一官方分发渠道；其他任何来源出现的同名扩展均非官方版本。
        </p>
        <p className="page-sub" style={{ lineHeight: 1.7 }}>
          数据行为：偏好与缓存只保存在本浏览器（storage.local/sync/session），无开发者遥测；
          登录凭证只存会话级存储，浏览器关闭即登出。诊断信息仅本机可见（epoch：{probe ? (probe.epoch ?? '无') : '…'}）。
        </p>
        <p className="page-sub" style={{ lineHeight: 1.7 }}>
          声明：本项目与 SDGun 论坛无隶属关系；使用本扩展产生的一切操作（含登录后的发帖、
          点赞、关注等真实写入）由使用者本人账号与责任承担。代码全部由 AI 编写（人类提出需求与验收），
          源码在 GitHub 公开可审计。
        </p>
        <div className="chiprow" style={{ marginTop: 10 }}>
          <a className="chip" data-test="about-repo" target="_blank" rel="noreferrer"
            href="https://github.com/deserthouse/sdgun-extension">GitHub 仓库 ↗</a>
          <a className="chip" data-test="about-releases" target="_blank" rel="noreferrer"
            href="https://github.com/deserthouse/sdgun-extension/releases">版本发布 ↗</a>
          <a className="chip" data-test="about-privacy" target="_blank" rel="noreferrer"
            href="https://github.com/deserthouse/sdgun-extension#readme">说明文档 ↗</a>
        </div>
      </div>
    </div>
  );
}
