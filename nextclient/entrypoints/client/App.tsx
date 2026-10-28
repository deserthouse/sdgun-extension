import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { applyTheme, setThemeMode, themeMode, watchSystemTheme, type ThemeMode } from '../../lib/theme';
import { epochProbe, type EpochProbe } from '../../lib/epoch';
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
          ? <ThreadPage key={route.param} tid={route.param!} pid={route.param2} />
          : route.name === 'editor'
          ? <EditorPage key={route.param ?? 'compose'} tid={route.param} />
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
              <div className="card" style={{ display: 'flex', alignItems: 'center',
                justifyContent: 'space-between' }}>
                <label style={{ fontSize: 14 }} htmlFor="clear-cache-btn">清除本机缓存</label>
                <button id="clear-cache-btn" className="btn" data-test="clear-cache"
                  onClick={clearCache}>清除</button>
              </div>
              {cacheMsg && (
                <p data-test="clear-cache-msg" style={{ fontSize: 12.5, color: 'var(--text3)',
                  margin: '8px 2px' }}>{cacheMsg}</p>
              )}
              <p style={{ fontSize: 12.5, color: 'var(--text2)', lineHeight: 1.6 }}>
                站点接管开启后，论坛页面将改由本客户端渲染；可随时关闭回到经典模式。
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
