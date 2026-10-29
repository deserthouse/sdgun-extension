import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { applyTheme, setThemeMode, themeMode, watchSystemTheme, type ThemeMode } from '../../lib/theme';
import { epochProbe, type EpochProbe } from '../../lib/epoch';
import { setTakeoverEnabled, takeoverEnabled } from '../../lib/switch';
import { BoardPage, CommunityPage, FocusPage, MyPage } from './pages';
import { MessagesPage } from './messages';
import { IconFocus, IconCommunity, IconMail, IconUser, IconSearch, IconGear } from './icons';
import { EditorPage } from './editor';
import { ThreadPage } from './thread';

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
  const editor = h.match(/^editor(?:\?tid=(\d+))?/); // C1-5：#/editor?tid=N=回复模式
  if (editor) return { name: 'editor', param: editor[1] };
  if (h === 'settings') return { name: 'settings' };
  if (TABS.some((t) => t.id === h)) return { name: h };
  return { name: 'focus' };
}

export default function App() {
  const [route, setRoute] = useState<{ name: string; param?: string; param2?: string }>(currentRoute);
  const [probe, setProbe] = useState<EpochProbe | null>(null);
  const [mode, setMode] = useState<ThemeMode>(themeMode);
  const [takeover, setTakeover] = useState<boolean | null>(null); // null=未读
  const [cacheMsg, setCacheMsg] = useState('');
  const [bannerOpen, setBannerOpen] = useState(() => {
    try { return localStorage.getItem('sdg2.banner.dismissed') !== '1'; } catch { return true; }
  });
  const qc = useQueryClient();

  useEffect(() => { takeoverEnabled().then(setTakeover).catch(() => setTakeover(false)); }, []);

  useEffect(() => {
    applyTheme();
    watchSystemTheme();
    const onHash = () => setRoute(currentRoute());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
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

  return (
    <>
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
      <div className="shell">
      <nav className="navcol" aria-label="主导航">
        <div className="navbrand">SDGun <em>New</em></div>
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <a key={t.id} href={`#/${t.id}`} data-tab={t.id} title={t.label}
              className="navlink"
              aria-current={(route.name === t.id
                || (t.id === 'community' && ['board', 'thread', 'editor'].includes(route.name)))
                ? 'page' : undefined}>
              <Icon />
              <span>{t.label}</span>
            </a>
          );
        })}
        <a className="navlink navtools" data-test="search-h5"
          href="https://bbs.sdgun.com.cn/search.php?mod=forum&mobile=2"
          target="_blank" rel="noreferrer">
          <IconSearch /><span>H5 搜索</span>
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
          : route.name === 'editor'
          ? <EditorPage key={route.param ?? 'compose'} tid={route.param} />
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
