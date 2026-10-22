import { useEffect, useState } from 'react';
import { applyTheme, setThemeMode, themeMode, watchSystemTheme, type ThemeMode } from '../../lib/theme';
import { epochProbe, epochStart, type EpochProbe } from '../../lib/epoch';
import { setTakeoverEnabled, takeoverEnabled } from '../../lib/switch';
import { BoardPage, CommunityPage, FocusPage, MyPage } from './pages';
import { MessagesPage } from './messages';
import { EditorPage } from './editor';
import { ThreadPage } from './thread';

const TABS = [
  { id: 'focus', label: '聚焦' },
  { id: 'community', label: '社区' },
  { id: 'messages', label: '消息' },
  { id: 'my', label: '我的' },
] as const;

function currentRoute(): { name: string; param?: string } {
  const h = location.hash.replace(/^#\/?/, '');
  const board = h.match(/^board\/(\d+)/);
  if (board) return { name: 'board', param: board[1] };
  const thread = h.match(/^thread\/(\d+)/);
  if (thread) return { name: 'thread', param: thread[1] };
  if (h === 'editor') return { name: 'editor' };
  if (h === 'settings') return { name: 'settings' };
  if (TABS.some((t) => t.id === h)) return { name: h };
  return { name: 'focus' };
}

export default function App() {
  const [route, setRoute] = useState<{ name: string; param?: string }>(currentRoute);
  const [probe, setProbe] = useState<EpochProbe | null>(null);
  const [mode, setMode] = useState<ThemeMode>(themeMode);
  const [takeover, setTakeover] = useState<boolean | null>(null); // null=未读

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
    epochProbe()
      // E1-5：客户端启动自动开游客会话（装游客 UA 规则）；已有 epoch 不覆盖
      .then((p0) => (p0 && p0.epoch ? p0 : epochStart(`guest-${Date.now().toString(36)}`)))
      .then((p) => { if (alive && p && 'ok' in (p as object)) setProbe(p as EpochProbe); })
      .catch(() => {});
    return () => { alive = false; };
  }, [route]);

  const tab = TABS.find((t) => t.id === route.name) ?? TABS[0];
  const isTab = TABS.some((t) => t.id === route.name);

  return (
    <>
      {takeover === false && (  // E1-3：接管未启用提示（grid 外，避免挤压 rail）
        <div data-test="takeover-banner"
          style={{
            background: 'var(--surface2)', color: 'var(--text2)', fontSize: 12.5,
            padding: '7px 16px', borderBottom: '1px solid var(--border)',
          }}>
          站点接管未启用：论坛页仍由经典重绘渲染；本客户端页面始终可用。
          （设置见左栏底部）
        </div>
      )}
      <div className="shell">
      <nav className="navcol" style={{
        background: 'var(--surface)', borderRight: '1px solid var(--border)',
        padding: '20px 14px', display: 'flex', flexDirection: 'column', gap: 4,
      }}>
        <div className="nav-collapse" style={{ fontWeight: 700, fontSize: 16, padding: '6px 10px 18px' }}>
          SDGun <span style={{ color: 'var(--accent)' }}>New</span>
        </div>
        {TABS.map((t) => (
          <a key={t.id} href={`#/${t.id}`} data-tab={t.id} title={t.label}
            style={{
              display: 'block', padding: '10px 12px', borderRadius: 10, fontSize: 14,
              textDecoration: 'none',
              background: route.name === t.id ? 'var(--surface2)' : 'transparent',
              color: route.name === t.id ? 'var(--accent)' : 'var(--text2)',
              fontWeight: route.name === t.id ? 700 : 400,
            }}>
            {t.label[0]}<span className="nav-collapse">{t.label.slice(1)}</span>
          </a>
        ))}
        <a className="chip nav-collapse" data-test="search-h5"
          href="https://bbs.sdgun.com.cn/search.php?mod=forum&mobile=2"
          target="_blank" rel="noreferrer" style={{ marginTop: 10 }}>🔍 H5 搜索</a>
        <a data-test="settings-link" href="#/settings" title="设置"
          style={{ marginTop: 'auto', fontSize: 13, color: 'var(--text2)', textDecoration: 'none',
            padding: '8px 10px', borderRadius: 10 }}>
          ⚙ <span className="nav-collapse">设置</span>
        </a>
      </nav>
      <main style={{ padding: '32px 40px', maxWidth: 860 }}>
        {route.name === 'board'
          ? <BoardPage key={route.param} fid={route.param!} />
          : route.name === 'thread'
          ? <ThreadPage key={route.param} tid={route.param!} />
          : route.name === 'editor'
          ? <EditorPage />
          : route.name === 'settings'
          ? (
            <div data-test="settings-page" style={{ maxWidth: 520 }}>
              <h1 style={{ fontSize: 24, margin: '0 0 16px' }} data-test="page-title">设置</h1>
              <div className="card" style={{ display: 'flex', alignItems: 'center',
                justifyContent: 'space-between' }}>
                <label htmlFor="theme-select" style={{ fontSize: 14 }}>外观主题</label>
                <select id="theme-select" data-test="theme" value={mode}
                  onChange={(e) => { const v = e.target.value as ThemeMode; setMode(v); setThemeMode(v); }}
                  style={{ background: 'var(--surface2)', color: 'var(--text2)',
                    border: '1px solid var(--border2)', borderRadius: 8, padding: '6px 10px' }}>
                  <option value="auto">跟随系统</option>
                  <option value="light">浅色</option>
                  <option value="dark">深色</option>
                </select>
              </div>
              <div className="card" style={{ display: 'flex', alignItems: 'center',
                justifyContent: 'space-between' }}>
                <label htmlFor="takeover-check" style={{ fontSize: 14 }}>启用站点接管</label>
                <input id="takeover-check" data-test="takeover" type="checkbox"
                  checked={takeover === true} disabled={takeover === null}
                  onChange={(e) => { const v = e.target.checked; setTakeover(v); setTakeoverEnabled(v); }} />
              </div>
              <p style={{ fontSize: 12.5, color: 'var(--text2)', lineHeight: 1.6 }}>
                站点接管开启后，论坛页面将改由本客户端渲染（当前版本尚未接线，开启无效果）。
              </p>
              <details style={{ marginTop: 14, fontSize: 12.5, color: 'var(--text3)' }}>
                <summary style={{ cursor: 'pointer' }}>诊断信息（开发者）</summary>
                <div style={{ marginTop: 8 }}>
                  epoch：{probe ? (probe.epoch ?? '无') : '…'}<br />
                  auth 规则：{probe ? probe.rulesCount : '…'}
                </div>
              </details>
            </div>
          )
          : (
            <>
              <h1 style={{ fontSize: 24, margin: '0 0 8px' }} data-test="page-title">{tab.label}</h1>
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
