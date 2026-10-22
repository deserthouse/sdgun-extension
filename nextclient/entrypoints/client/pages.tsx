// E1-5 游客阅读链页面：聚焦（资讯+板块速览）、社区（板块树）、板块（forumView 列表）。
// E1-6：我的（登录表单/账号视图/退出）。
import { useEffect, useState } from 'react';
import { useEndpoint } from '../../lib/queries';
import { StateBlock, StateBadge } from './StateBlock';
import { epochStart, epochStop, epochProbe } from '../../lib/epoch';
import { getAuth, login, logout, fetchAccountInfo, type AuthInfo } from '../../lib/auth';

/* eslint-disable @typescript-eslint/no-explicit-any */
const row = (d: any) => (d?.list ?? []) as any[];

export function MyPage() {
  const [auth, setAuth] = useState<AuthInfo | null | 'loading'>('loading');
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    getAuth().then(setAuth).catch(() => setAuth(null));
  }, []);

  useEffect(() => {
    if (auth && auth !== 'loading' && auth.userId) {
      fetchAccountInfo(auth.userId).then(setInfo).catch(() => {});
    } else {
      setInfo(null);
    }
  }, [auth]);

  async function doLogin(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      const r = await login(account, password);
      if (!r.ok) { setErr(r.msg ?? '登录失败'); return; }
      await epochStart(`auth-${Date.now().toString(36)}`);
      setAuth(r.auth ?? null);
      setPassword('');
    } catch (ex) {
      setErr(String((ex as Error).message ?? ex).slice(0, 120));
    } finally {
      setBusy(false);
    }
  }

  async function doLogout() {
    await logout();
    await epochStop();
    await epochProbe(); // 确认规则清空后回登录面
    setAuth(null);
    setInfo(null);
  }

  if (auth === 'loading') return <p style={{ color: 'var(--text3)' }}>…</p>;
  if (!auth) {
    return (
      <>
        <form data-test="login" onSubmit={doLogin}
          style={{ maxWidth: 380, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input value={account} onChange={(e) => setAccount(e.target.value)}
            placeholder="账号" autoComplete="username"
            style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border2)',
              background: 'var(--surface)', color: 'var(--text)' }} />
          <input value={password} onChange={(e) => setPassword(e.target.value)} type="password"
            placeholder="密码" autoComplete="current-password"
            style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border2)',
              background: 'var(--surface)', color: 'var(--text)' }} />
          {err && <div data-test="login-error" style={{ color: 'var(--accent)', fontSize: 13 }}>{err}</div>}
          <button className="btn" data-test="login-submit" disabled={busy || !account || !password}>
            {busy ? '登录中…' : '登录'}
          </button>
          <p style={{ fontSize: 12, color: 'var(--text3)' }}>
            密码经官方 RSA 形态加密后提交（E00-2 互验口径）；会话凭证只存本浏览器会话。
          </p>
        </form>
        <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 14 }}>
          官方页面（H5，新标签打开）：
          <a className="chip" target="_blank" rel="noreferrer"
            href="https://bbs.sdgun.com.cn/home.php?mod=space&do=profile&mobile=2">个人中心</a>
          <a className="chip" target="_blank" rel="noreferrer"
            href="https://bbs.sdgun.com.cn/forum.php?mod=guide&mobile=2">论坛导读</a>
        </p>
      </>
    );
  }
  return (
    <div data-test="account">
      <AccountCard auth={auth as AuthInfo} info={info} onLogout={doLogout} />
      <MessagesPanel />
    </div>
  );
}

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
function AccountCard({ auth, info, onLogout }: { auth: AuthInfo; info: Record<string, unknown> | null; onLogout: () => void }) {
  return (
    <div className="card" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
      <span className="board-icon board-icon-empty"
        style={{ background: 'var(--surface2)' }}>{auth.name[0] ?? '?'}</span>
      <div style={{ flex: 1 }}>
        <div className="card-title" data-test="account-name">{auth.name || auth.userId}</div>
        <div className="card-meta">
          {String(info?.group_name ?? '')}{info?.group_level ? ` · Lv.${info.group_level}` : ''}
          {info?.sign ? ` · ${String(info.sign).slice(0, 30)}` : ''}
        </div>
      </div>
      <button className="btn" data-test="logout" onClick={onLogout}>退出登录</button>
    </div>
  );
}

function MessagesPanel() {
  const [tab, setTab] = useState<'msg' | 'notify'>('msg');
  const msg = useEndpoint(tab === 'msg' ? 'userMessageGroupList' : 'userNotifyIndex',
    tab === 'msg' ? { p: 1 } : {});
  const items = (msg.data as any)?.list ?? [];
  return (
    <div style={{ marginTop: 18 }}>
      <div className="chiprow">
        <button className={'btn' + (tab === 'msg' ? ' on' : '')} data-test="tab-msg"
          style={tab === 'msg' ? { borderColor: 'var(--accent)', color: 'var(--accent)' } : {}}
          onClick={() => setTab('msg')}>消息</button>
        <button className={'btn' + (tab === 'notify' ? ' on' : '')} data-test="tab-notify"
          style={tab === 'notify' ? { borderColor: 'var(--accent)', color: 'var(--accent)' } : {}}
          onClick={() => setTab('notify')}>通知</button>
      </div>
      <StateBlock state={msg.state} fail={msg.fail} onRetry={() => msg.refetch()} skeletonRows={3} />
      {tab === 'msg' && msg.state !== 'InitialLoading' && items.length === 0 && (
        <div className="state-card" data-test="empty">暂无消息会话</div>
      )}
      {tab === 'msg' && items.map((m: any) => (
        <div key={String(m.id)} className="card">
          <div className="card-title">{m.name ?? m.title ?? m.user_name ?? '(消息)'}</div>
          {m.last_summary ?? m.content ? (
            <div className="card-sub">{String(m.last_summary ?? m.content ?? '').slice(0, 60)}</div>
          ) : null}
        </div>
      ))}
      {tab === 'notify' && msg.state !== 'InitialLoading' && msg.data && (
        <div data-test="notify-summary">
          {(() => {
            const d = (msg.data as any).data ?? {};
            const rows = [
              ['私信', d.has_letter ? '有新私信' : '暂无新私信'],
              ['系统通知', String(d.system_notify_count ?? 0)],
              ['好友申请', String(d.friend_apply_count ?? 0)],
            ];
            return rows.map(([k, v]) => (
              <div key={k} className="card" style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="card-title">{k}</span>
                <span className="card-meta">{v}</span>
              </div>
            ));
          })()}
        </div>
      )}
    </div>
  );
}

export function FocusPage() {
  const info = useEndpoint('infoListByCatId', { cat_id: 7, step: 20, p: 1 });
  const tree = useEndpoint('circleTree');
  return (
    <section>
      <h2 style={{ fontSize: 15, color: 'var(--text2)', margin: '0 0 10px' }}>
        资讯 <StateBadge state={info.state} />
      </h2>
      <StateBlock state={info.state === 'Data' ? 'Data' : info.state} fail={info.fail}
        onRetry={() => info.refetch()} />
      {info.state !== 'InitialLoading' && row(info.data).map((it: any) => (
        <a key={String(it.id)} className="card info-card" href={it.link ?? '#'}
          target="_blank" rel="noreferrer">
          <div className="card-title">{it.title}</div>
          {it.des ? <div className="card-sub">{String(it.des).slice(0, 80)}</div> : null}
          <div className="card-meta">
            {it.from || it.user_name} · {it.publish_time_str} · 评 {it.comment_count ?? 0}
          </div>
        </a>
      ))}
      <h2 style={{ fontSize: 15, color: 'var(--text2)', margin: '18px 0 10px' }}>
        官方页面（H5）
      </h2>
      <div className="chiprow" data-test="tools">
        {[['论坛导读', 'forum.php?mod=guide&mobile=2'], ['个人中心', 'home.php?mod=space&do=profile&mobile=2'],
          ['站内搜索', 'search.php?mod=forum&mobile=2']].map(([t, path]) => (
          <a key={t} className="chip" target="_blank" rel="noreferrer"
            href={`https://bbs.sdgun.com.cn/${path}`}>{t} ↗</a>
        ))}
      </div>
      <h2 style={{ fontSize: 15, color: 'var(--text2)', margin: '18px 0 10px' }}>
        板块速览 <StateBadge state={tree.state} />
      </h2>
      <StateBlock state={tree.state} fail={tree.fail} onRetry={() => tree.refetch()} skeletonRows={2} />
      {tree.state !== 'InitialLoading' && row(tree.data).slice(0, 2).map((g: any) => (
        <div key={g.id} className="chiprow">
          {g.circle_list.slice(0, 4).map((c: any) => (
            <a key={c.id} className="chip" href={`#/board/${c.type_value}`}>{c.name}</a>
          ))}
        </div>
      ))}
    </section>
  );
}

export function CommunityPage() {
  const tree = useEndpoint('circleTree');
  return (
    <section>
      <StateBlock state={tree.state} fail={tree.fail} onRetry={() => tree.refetch()} />
      {tree.state !== 'InitialLoading' && row(tree.data).map((g: any) => (
        <div key={g.id} style={{ marginBottom: 18 }}>
          <h2 style={{ fontSize: 15, color: 'var(--text2)', margin: '0 0 8px' }}>{g.name}</h2>
          <div className="grid2">
            {g.circle_list.map((c: any) => (
              <a key={c.id} className="card board-card" href={`#/board/${c.type_value}`}>
                {c.icon_url
                  ? <img className="board-icon" src={c.icon_url} alt="" referrerPolicy="no-referrer" />
                  : <span className="board-icon board-icon-empty">{(c.name || '?')[0]}</span>}
                <div>
                  <div className="card-title">{c.name}</div>
                  {c.des ? <div className="card-sub">{String(c.des).slice(0, 60)}</div> : null}
                </div>
              </a>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}

export function BoardPage({ fid }: { fid: string }) {
  const [page, setPage] = useState(1);
  const STEP = 20;
  const q = useEndpoint('forumView', { fid, p: page, step: STEP });
  const rows = row(q.data);
  const atEnd = rows.length < STEP;
  return (
    <section>
      <p style={{ margin: '0 0 10px', fontSize: 13 }}>
        <a href="#/community" style={{ color: 'var(--accent)' }}>‹ 社区</a>
        <span style={{ color: 'var(--text3)' }}> · 版块 {fid}</span>
      </p>
      <StateBlock state={q.state} fail={q.fail} onRetry={() => q.refetch()} />
      {q.state !== 'InitialLoading' && rows.map((t: any) => (
        <a key={String(t.tid)} className="card thread-row" href={`#/thread/${t.tid}`}>
          {t.is_top ? <span className="pin">置顶</span> : null}
          <div>
            <div className="card-title">{t.subject}</div>
            <div className="card-meta">
              {t.user_name} · {t.lastpost || t.dateline} · 回 {t.reply_count ?? 0} · {t.click}
            </div>
          </div>
        </a>
      ))}
      <div className="chiprow" style={{ justifyContent: 'center', marginTop: 14 }}>
        <button className="btn" disabled={page <= 1} onClick={() => setPage(page - 1)}>上一页</button>
        <span style={{ color: 'var(--text3)', fontSize: 12 }}>第 {page} 页</span>
        <button className="btn" disabled={atEnd || rows.length === 0}
          onClick={() => setPage(page + 1)}>下一页</button>
      </div>
    </section>
  );
}
