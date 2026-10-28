// E1-5 游客阅读链页面：聚焦（资讯+板块速览）、社区（板块树）、板块（forumView 列表）。
// E1-6：我的（登录表单/账号视图/退出）。
import { useEffect, useRef, useState } from 'react';
import { useEndpoint } from '../../lib/queries';
import { StateBlock, StateBadge } from './StateBlock';
import { epochStart, epochStop, epochProbe } from '../../lib/epoch';
import { login, fetchAccountInfo, verifyPicSecurityCode, captchaImageUrl, type AuthInfo } from '../../lib/auth';
import { useSession } from '../../lib/session';

/* eslint-disable @typescript-eslint/no-explicit-any */
const row = (d: any) => (d?.list ?? []) as any[];

export function MyPage() {
  const { session, logout: sessionLogout, epochRef } = useSession();
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState<Record<string, unknown> | null>(null);
  // F01 图形验证码态（code 1009 → 验证后自动重试登录）
  const [captcha, setCaptcha] = useState(false);
  const [capCode, setCapCode] = useState('');
  const auth = session === 'loading' ? null : session.auth;

  useEffect(() => {
    if (auth && auth.userId) {
      const ep = epochRef.current;
      fetchAccountInfo(auth.userId).then((d) => {
        if (epochRef.current === ep) setInfo(d); // E24-01：epoch 变了不回填
      }).catch(() => {});
    } else {
      setInfo(null);
    }
  }, [auth?.userId]);

  async function attemptLogin(): Promise<void> {
    setErr('');
    setBusy(true);
    try {
      const r = await login(account, password);
      if (!r.ok) {
        if (r.captchaRequired) setCaptcha(true);
        setErr(r.msg ?? '登录失败');
        return;
      }
      setCaptcha(false);
      setCapCode('');
      await epochStart(`auth-${Date.now().toString(36)}`);
      setPassword('');
    } catch (ex) {
      setErr(String((ex as Error).message ?? ex).slice(0, 120));
    } finally {
      setBusy(false);
    }
  }

  async function doLogin(e: React.FormEvent) {
    e.preventDefault();
    await attemptLogin();
  }

  // F01：验证码验证成功 → 原动作重试（官 APK 事件口径：pic_captcha_success → 重发）
  async function doVerifyCaptcha() {
    if (!capCode.trim() || busy) return;
    setBusy(true);
    setErr('');
    try {
      const v = await verifyPicSecurityCode(capCode.trim());
      if (!v.ok) {
        setErr(v.msg ?? '验证码不正确');
        return;
      }
      await attemptLogin();
    } finally {
      setBusy(false);
    }
  }

  async function doLogout() {
    await sessionLogout(); // E24-01：走 SessionProvider（cancel+清缓存+撤规则+清auth）
    setErr('');
    setInfo(null);
  }

  if (session === 'loading') return <p style={{ color: 'var(--text3)' }}>…</p>;
  if (!auth) {
    return (
      <>
        <form data-test="login" onSubmit={doLogin}
          style={{ maxWidth: 380, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <label style={{ fontSize: 13, color: 'var(--text2)' }} htmlFor="login-account">账号</label>
          <input id="login-account" value={account} onChange={(e) => setAccount(e.target.value)}
            placeholder="账号" autoComplete="username"
            style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border2)',
              background: 'var(--surface)', color: 'var(--text)' }} />
          <label style={{ fontSize: 13, color: 'var(--text2)' }} htmlFor="login-password">密码</label>
          <input id="login-password" value={password} onChange={(e) => setPassword(e.target.value)}
            type="password" placeholder="密码" autoComplete="current-password"
            aria-describedby={err ? 'login-error' : undefined}
            style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border2)',
              background: 'var(--surface)', color: 'var(--text)' }} />
          {err && <div id="login-error" data-test="login-error" role="alert"
            style={{ color: 'var(--accent)', fontSize: 13 }}>{err}</div>}
          {captcha && (
            <div className="card" data-test="captcha-block"
              style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div className="card-title" style={{ fontSize: 13.5 }}>图形验证（F01）</div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <img data-test="captcha-img" src={captchaImageUrl()} alt="图形验证码"
                  title="点击刷新"
                  onClick={(e) => { (e.target as HTMLImageElement).src = captchaImageUrl(); }}
                  style={{ height: 40, borderRadius: 6, border: '1px solid var(--border2)' }} />
                <input data-test="captcha-input" value={capCode}
                  onChange={(e) => setCapCode(e.target.value)}
                  placeholder="输入图中字符"
                  aria-label="图形验证码输入框"
                  style={{ flex: 1, padding: '9px 12px', borderRadius: 10,
                    border: '1px solid var(--border2)', background: 'var(--surface)',
                    color: 'var(--text)' }} />
              </div>
              <button className="btn" data-test="captcha-verify"
                disabled={busy || !capCode.trim()} onClick={doVerifyCaptcha}>
                {busy ? '验证中…' : '验证并重试登录'}
              </button>
            </div>
          )}
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
      <Collections />
      <p style={{ fontSize: 13, color: 'var(--text2)', marginTop: 12 }}>
        消息与通知已移至左栏「消息」页。
      </p>
    </div>
  );
}

// C4-3 收藏列表（userCollectList）：静态取证形态渲染——标题/分类/时间，
// link 为站方原始链接（H5 新标签打开，不猜客户端路由映射）。
function Collections() {
  const q = useEndpoint('userCollectList', { p: 1 });
  const rows = row(q.data);
  return (
    <div data-test="collections" style={{ marginTop: 16 }}>
      <h2 style={{ fontSize: 15, color: 'var(--text2)', margin: '0 0 8px' }}>
        我的收藏 <StateBadge state={q.state} />
      </h2>
      <StateBlock state={q.state} fail={q.fail} onRetry={() => q.refetch()} skeletonRows={2} />
      {q.state !== 'InitialLoading' && rows.length === 0 && (
        <div className="state-card" data-test="collections-empty">暂无收藏</div>
      )}
      {rows.map((c: any, i: number) => {
        const link = typeof c.link === 'string' && c.link.startsWith('http') ? c.link : null;
        const inner = (
          <>
            <div className="card-title">{String(c.title ?? '(收藏项)')}</div>
            <div className="card-meta">
              {String(c.catName ?? '')}{c.createTimeStr ? ` · ${String(c.createTimeStr)}` : ''}
            </div>
          </>
        );
        return link
          ? <a key={String(c.id ?? i)} className="card" data-test="collect-row"
              href={link} target="_blank" rel="noreferrer">{inner}</a>
          : <div key={String(c.id ?? i)} className="card" data-test="collect-row">{inner}</div>;
      })}
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

const CHANNELS = [
  { id: 7, label: '最新' },
  { id: 12, label: '评测' },
  { id: 13, label: '攻略' },
];

// C4-2 我的板块（userCircleList）：登录态聚焦页区块；行=circle 对象
// （2026-10-21 实采同树形态），fid 取 type_value（树同款）兜底 fid。
function MyBoards({ userId }: { userId: string }) {
  const q = useEndpoint('userCircleList', { uid: userId });
  const rows = row(q.data);
  return (
    <div data-test="my-boards" style={{ marginBottom: 16 }}>
      <h2 style={{ fontSize: 15, color: 'var(--text2)', margin: '0 0 8px' }}>
        我的板块 <StateBadge state={q.state} />
      </h2>
      <StateBlock state={q.state} fail={q.fail} onRetry={() => q.refetch()} skeletonRows={1} />
      {q.state !== 'InitialLoading' && rows.length === 0 && (
        <div className="state-card" data-test="my-boards-empty">暂无加入的板块</div>
      )}
      {rows.length > 0 && (
        <div className="chiprow" data-test="my-boards-chips" style={{ marginBottom: 0 }}>
          {rows.map((c: any, i: number) => {
            const fid = String(c.type_value ?? c.fid ?? '');
            if (!fid) return null;
            return (
              <a key={`${fid}-${i}`} className="chip" href={`#/board/${fid}`}>
                {c.name ?? fid}{Number(c.new_content) > 0 ? ' · 有新' : ''}
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function FocusPage() {
  const [channel, setChannel] = useState(7);
  const info = useEndpoint('infoListByCatId', { cat_id: channel, step: 20, p: 1 });
  const tree = useEndpoint('circleTree');
  const { session } = useSession();
  const auth = session === 'loading' ? null : session.auth;
  return (
    <section>
      {auth && <MyBoards userId={auth.userId} />}
      <div className="chiprow" style={{ marginBottom: 10 }}>
        {CHANNELS.map((c) => (
          <button key={c.id} data-test={`channel-${c.id}`}
            className={'chip' + (channel === c.id ? ' on' : '')}
            style={channel === c.id ? { borderColor: 'var(--accent)', color: 'var(--accent)' } : {}}
            onClick={() => setChannel(c.id)}>{c.label}</button>
        ))}
      </div>
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
        <div key={g.id} className="chiprow" data-test="board-chips">
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

// C1-1 排序条：forumView order 参数（值域=forumDetail orders 官方枚举，R-A0 实测；
// 默认 lastpost=官方 Android 同款默认）。切排序=换查询游标：页码回 1、EOF 复位。
const ORDERS = [
  { key: 'lastpost', label: '最新回复' },
  { key: 'dateline', label: '发帖时间' },
  { key: 'replies', label: '回复数' },
  { key: 'views', label: '查看数' },
  { key: 'heat', label: '热门度' },
] as const;

// E70-03 分页适配器：响应无 total_page 元数据时不得用 rows<step 推定 EOF——
// 允许试探下一页；空页才结束（endReached；E24-02：内容重复不作 EOF 信号）。
// 切 fid 由 App key 重挂载重置。
export function BoardPage({ fid }: { fid: string }) {
  const [page, setPage] = useState(1);
  const [order, setOrder] = useState<string>('lastpost');
  const STEP = 20;
  const q = useEndpoint('forumView', { fid, p: page, step: STEP, order });
  // C1-4 板块名映射：circleTree（5min 暖缓存，与社区页/编辑器共享）派生 fid→name
  const tree = useEndpoint('circleTree');
  const boardName = useMemo(() => {
    for (const g of (tree.data as any)?.list ?? []) {
      for (const c of g.circle_list ?? []) {
        if (String(c.type_value) === fid) return String(c.name);
      }
    }
    return '';
  }, [tree.data, fid]);
  const [endReached, setEndReached] = useState(false);
  const rowsAll = row(q.data);
  // E24-02 修复：替换页语义（每页独立渲染），去重仅在当前响应内（useMemo 不写 ref）。
  // EOF 判定=响应空列表（非 render 后过滤恰好 0——此前 seenRef 全局消耗导致回上页清空）。
  const rows = useMemo(() => {
    const seen = new Set<string>();
    return rowsAll.filter((t: any) => {
      const k = String(t.tid);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }, [rowsAll]);
  useEffect(() => {
    if (q.isPending || q.isFetching) return;
    if (q.data && row(q.data).length === 0) setEndReached(true);
  }, [q.data, q.isPending, q.isFetching]);
  const isPinned = (t: any) => Number(t.is_top) > 0;
  return (
    <section>
      <p style={{ margin: '0 0 10px', fontSize: 13 }}>
        <a href="#/community" style={{ color: 'var(--accent)' }}>‹ 社区</a>
        <span style={{ color: 'var(--text3)' }} data-test="board-name">
          · {boardName || `版块 ${fid}`}
        </span>
      </p>
      <div className="chiprow" data-test="order-chips" role="group" aria-label="板块排序">
        {ORDERS.map((o) => (
          <button key={o.key} type="button" data-test={`order-${o.key}`} aria-pressed={order === o.key}
            className={'chip' + (order === o.key ? ' on' : '')}
            style={order === o.key ? { borderColor: 'var(--accent)', color: 'var(--accent)' } : {}}
            onClick={() => {
              if (o.key === order) return;
              setOrder(o.key);
              setPage(1);
              setEndReached(false);
            }}>{o.label}</button>
        ))}
      </div>
      <StateBlock state={q.state} fail={q.fail} onRetry={() => q.refetch()} />
      {q.state !== 'InitialLoading' && rows.map((t: any) => (
        <a key={String(t.tid)} className="card thread-row" href={`#/thread/${t.tid}`}>
          {isPinned(t) ? <span className="pin">置顶</span> : null}
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
        <button className="btn" data-test="next-page" disabled={endReached}
          onClick={() => setPage(page + 1)}>下一页</button>
      </div>
      {endReached && <div className="state-card" data-test="no-more">没有更多了</div>}
    </section>
  );
}
