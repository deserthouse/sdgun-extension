// E1-5 游客阅读链页面：聚焦（资讯+板块速览）、社区（板块树）、板块（forumView 列表）。
// E1-6：我的（登录表单/账号视图/退出）。
import { useEffect, useRef, useState } from 'react';
import { useEndpoint } from '../../lib/queries';
import { StateBlock, StateBadge } from './StateBlock';
import { epochStart, epochStop, epochProbe } from '../../lib/epoch';
import { login, fetchAccountInfo, verifyPicSecurityCode, captchaImageUrl, type AuthInfo } from '../../lib/auth';
import { useSession } from '../../lib/session';
import { formatTime, formatCount } from '../../lib/format';
import { internalRouteFromUrl } from '../../lib/linkmap';
import { loadHistory, clearHistory } from '../../lib/history';
import { Avatar } from './Avatar';
import { FollowButton } from './thread';

/* eslint-disable @typescript-eslint/no-explicit-any */
const row = (d: any) => (d?.list ?? []) as any[];

export function MyPage() {
  const { session, logout: sessionLogout, epochRef } = useSession();
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPw, setShowPw] = useState(false);
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
          <div style={{ position: 'relative' }}>
            <input id="login-password" value={password} onChange={(e) => setPassword(e.target.value)}
              type={showPw ? 'text' : 'password'} placeholder="密码" autoComplete="current-password"
              aria-describedby={err ? 'login-error' : undefined}
              style={{ padding: '10px 44px 10px 12px', borderRadius: 10, border: '1px solid var(--border2)',
                background: 'var(--surface)', color: 'var(--text)', width: '100%', boxSizing: 'border-box' }} />
            <button type="button" data-test="pw-toggle" onClick={() => setShowPw(!showPw)}
              aria-label={showPw ? '隐藏密码' : '显示密码'}
              style={{ position: 'absolute', right: 8, top: 8, border: 'none', background: 'none',
                color: 'var(--text3)', cursor: 'pointer', fontSize: 12 }}>
              {showPw ? '隐藏' : '显示'}
            </button>
          </div>
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
          <button className="btn btn-primary" data-test="login-submit"
            disabled={busy || !account || !password}
            style={{ width: '100%', justifyContent: 'center', padding: '10px 0', fontSize: 14 }}>
            {busy ? '登录中…' : '登录'}
          </button>
          <p style={{ fontSize: 12, color: 'var(--text3)' }}>
            密码加密后提交，不会明文传输；会话凭证只保存在本浏览器会话中。
          </p>
        </form>
        <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 14 }}>
          官方页面（H5，新标签打开）：
          <a className="chip" target="_blank" rel="noreferrer"
            href="https://bbs.sdgun.com.cn/home.php?mod=space&do=profile&mobile=2">个人中心</a>
          <a className="chip" target="_blank" rel="noreferrer"
            href="https://bbs.sdgun.com.cn/forum.php?mod=guide&mobile=2">论坛导读</a>
          <a className="chip" target="_blank" rel="noreferrer"
            href="https://bbs.sdgun.com.cn/member.php?mod=register&mobile=2">注册账号</a>
          <a className="chip" target="_blank" rel="noreferrer"
            href="https://bbs.sdgun.com.cn/member.php?mod=logging&action=lostpasswd&mobile=2">找回密码</a>
        </p>
      </>
    );
  }
  return (
    <div data-test="account">
      <AccountCard auth={auth as AuthInfo} info={info} onLogout={doLogout} />
      <UserThreadList uid={auth.userId} isSelf={true} />
      <Collections />
      <LocalHistory />
      <MyVisitors />
      <p style={{ fontSize: 13, color: 'var(--text2)', marginTop: 12 }}>
        消息与通知已移至左栏「消息」页。
      </p>
    </div>
  );
}

// G2 本地帖历史（纯客户端，零请求——Android ThreadHistoryStore 同构）
function LocalHistory() {
  const [rows, setRows] = useState(() => loadHistory());
  const [open, setOpen] = useState(false);
  return (
    <div data-test="local-history" style={{ marginTop: 16 }}>
      <h2 style={{ fontSize: 15, color: 'var(--text2)', margin: '0 0 8px', display: 'flex',
        alignItems: 'center', gap: 10 }}>
        最近浏览
        <button className="btn" data-test="history-toggle" aria-expanded={open}
          style={{ padding: '2px 10px' }} onClick={() => setOpen(!open)}>
          {open ? '收起' : `展开（${rows.length}）`}
        </button>
        {rows.length > 0 && open && (
          <button className="btn" data-test="history-clear" style={{ padding: '2px 10px' }}
            onClick={() => { clearHistory(); setRows([]); }}>清空</button>
        )}
      </h2>
      {open && (rows.length === 0
        ? <div className="state-card" data-test="history-empty">暂无浏览记录</div>
        : rows.slice(0, 30).map((e) => (
          <a key={e.tid} className="card" data-test="history-row" href={`#/thread/${e.tid}`}>
            <div className="card-title">{e.title}</div>
            <div className="card-meta">{formatTime(Math.floor(e.ts / 1000))}</div>
          </a>)))}
    </div>
  );
}

// G2 访客列表（myVisitor：谁看过我——登录态读端点，合成验证）
function MyVisitors() {
  // R4/WP7（BU-04）：分页化（累积+去重）
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<any[]>([]);
  const q = useEndpoint('myVisitor', { p: page, step: 20 });
  useEffect(() => {
    const fresh = ((q.data as any)?.list ?? []) as any[];
    if (q.state !== 'Data' && q.state !== 'Stale') return;
    setRows((prev) => {
      if (page === 1) return fresh;
      const seen = new Set(prev.map((r) => String(r.user?.user_id ?? r.user_id ?? '')));
      return [...prev, ...fresh.filter((r) => !seen.has(String(r.user?.user_id ?? r.user_id ?? '')))];
    });
  }, [q.data, q.state, page]);
  const canMore = (q.state === 'Data' || q.state === 'Stale')
    && ((q.data as any)?.list ?? []).length >= 20;
  return (
    <div data-test="my-visitors" style={{ marginTop: 16 }}>
      <h2 style={{ fontSize: 15, color: 'var(--text2)', margin: '0 0 8px' }}>
        最近访客 <StateBadge state={q.state} />
      </h2>
      <StateBlock state={q.state} fail={q.fail} onRetry={() => q.refetch()} skeletonRows={1} />
      {q.state === 'Empty' && <div className="state-card" data-test="visitors-empty">暂无访客记录</div>}
      {rows.length > 0 && (
        <div className="chiprow">
          {rows.slice(0, 30).map((v, i) => {
            // soak 实测修正：myVisitor 行=嵌套 {user:{…}, visit_time_str}；
            // listUserVisitor 行=扁平。两形态都取。
            const vu = v.user ?? v;
            const uid = String(vu.user_id ?? vu.userId ?? '');
            const name = String(vu.name ?? (uid || '(访客)'));
            return uid
              ? <a key={uid + i} className="chip" href={`#/user/${uid}`} data-test="visitor-row"
                  title={v.visit_time_str ? `最近来访 ${String(v.visit_time_str)}` : undefined}>
                  <Avatar src={vu.head} name={name} size={20} />{name}</a>
              : <span key={i} className="chip">{name}</span>;
          })}
        </div>
      )}
      {canMore && (
        <div className="chiprow" style={{ justifyContent: 'center' }}>
          <button className="btn" data-test="visitors-more" disabled={q.isFetching}
            onClick={() => setPage((v) => v + 1)}>加载更多</button>
        </div>
      )}
    </div>
  );
}

// C4-3 收藏列表（userCollectList）：静态取证形态渲染——标题/分类/时间，
// link 为站方原始链接（H5 新标签打开，不猜客户端路由映射）。
function Collections() {
  // R3-1 分页化：累积+去重，20/页
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<any[]>([]);
  const q = useEndpoint('userCollectList', { p: page });
  useEffect(() => {
    const fresh = row(q.data);
    if (q.state !== 'Data' && q.state !== 'Stale') return;
    setRows((prev) => {
      if (page === 1) return fresh;
      const seen = new Set(prev.map((r: any) => String(r.id ?? '')));
      return [...prev, ...fresh.filter((r: any) => !seen.has(String(r.id ?? '')))];
    });
  }, [q.data, q.state, page]);
  const canMore = (q.state === 'Data' || q.state === 'Stale') && row(q.data).length >= 20;
  return (
    <div data-test="collections" style={{ marginTop: 16 }}>
      <h2 style={{ fontSize: 15, color: 'var(--text2)', margin: '0 0 8px' }}>
        我的收藏 <StateBadge state={q.state} />
      </h2>
      {page === 1 && (
        <StateBlock state={q.state} fail={q.fail} onRetry={() => q.refetch()} skeletonRows={2} />
      )}
      {q.state === 'Empty' && page === 1 && (
        <div className="state-card" data-test="collections-empty">暂无收藏</div>
      )}
      {rows.map((c: any, i: number) => {
        // F3-3 深链统一：站方 link 可映射（tid/fid/uid）→ 客户端路由；其余外开
        const link = typeof c.link === 'string' && c.link.startsWith('http') ? c.link : null;
        const route = link ? internalRouteFromUrl(link) : null;
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
              href={route ?? link} {...(route ? {} : { target: '_blank', rel: 'noreferrer' })}>{inner}</a>
          : <div key={String(c.id ?? i)} className="card" data-test="collect-row">{inner}</div>;
      })}
      {canMore && (
        <div className="chiprow" style={{ justifyContent: 'center' }}>
          <button className="btn" data-test="collect-more" disabled={q.isFetching}
            onClick={() => setPage((v) => v + 1)}>
            {q.isFetching ? '加载中…' : '加载更多'}
          </button>
        </div>
      )}
    </div>
  );
}

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
function AccountCard({ auth, info, onLogout }: { auth: AuthInfo; info: Record<string, unknown> | null; onLogout: () => void }) {
  return (
    <div className="card" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
      <Avatar src={info?.head ?? info?.user_head} name={auth.name} size={44} />
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

// F2-1 粉丝/关注列表（userFansList/userFollowList v3；self 分流 myFansList/MyFollowsList v1）。
// 行=FansFollowsDataView 消费字段（2026-11-02 静态取证）；行点击→ #/user/{userId}。
function UserFansList({ uid, tab, isSelf }: { uid: string; tab: 'fans' | 'follows'; isSelf: boolean }) {
  // soak 实测修正（2026-11-03）：v1 self 端点需 user_id 参数（无参=code0 拒）——
  // self/他人统一走 v3 双端点（userFansList/userFollowList 均带 user_id 实测通）
  const id = tab === 'fans' ? 'userFansList' : 'userFollowList';
  // R4/WP7（BU-04）：分页化（累积+去重+加载更多——Collections 既有模式）
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<any[]>([]);
  const q = useEndpoint(id, { user_id: uid, p: page, step: 20 });
  useEffect(() => { setPage(1); setRows([]); }, [uid, tab]);
  useEffect(() => {
    const fresh = row(q.data);
    if (q.state !== 'Data' && q.state !== 'Stale') return;
    setRows((prev) => {
      if (page === 1) return fresh;
      const seen = new Set(prev.map((r) => String(r.user_id ?? r.userId ?? '')));
      return [...prev, ...fresh.filter((r) => !seen.has(String(r.user_id ?? r.userId ?? '')))];
    });
  }, [q.data, q.state, page]);
  const canMore = (q.state === 'Data' || q.state === 'Stale') && row(q.data).length >= 20;
  return (
    <div data-test={`user-${tab}`} style={{ marginTop: 14 }}>
      <h2 style={{ fontSize: 15, color: 'var(--text2)', margin: '0 0 8px' }}>
        {tab === 'fans' ? '粉丝' : '关注'} <StateBadge state={q.state} />
        <a className="chip" style={{ marginLeft: 10 }} href={`#/user/${uid}`}>‹ 返回主页</a>
      </h2>
      <StateBlock state={q.state} fail={q.fail} onRetry={() => q.refetch()} skeletonRows={2} />
      {q.state === 'Empty' && (
        <div className="state-card" data-test={`user-${tab}-empty`}>
          {tab === 'fans' ? '暂无粉丝' : '暂无关注'}
        </div>
      )}
      {rows.map((u: any, i: number) => {
        const ruid = String(u.user_id ?? u.userId ?? u.uid ?? ''); // 真实键=user_id（soak 实测）
        const inner = (
          <>
            <Avatar src={u.head} name={u.name ?? ruid} size={36} />
            <div style={{ flex: 1 }}>
              <div className="card-title">{String(u.name ?? (ruid || '(用户)'))}</div>
              <div className="card-meta">
                {Number(u.status) === 2 ? '互相关注' : ''}
                {u.cert_des ? ` · ${String(u.cert_des)}` : ''}
                {u.distance_info ? ` · ${String(u.distance_info)}` : ''}
              </div>
            </div>
          </>
        );
        return ruid
          ? <a key={`${ruid}-${i}`} className="card" data-test="fan-row" href={`#/user/${ruid}`}>{inner}</a>
          : <div key={i} className="card" data-test="fan-row">{inner}</div>;
      })}
      {canMore && (
        <div className="chiprow" style={{ justifyContent: 'center' }}>
          <button className="btn" data-test="fans-more" disabled={q.isFetching}
            onClick={() => setPage((v) => v + 1)}>加载更多</button>
        </div>
      )}
    </div>
  );
}

// F2-2 用户帖子列表：self=userContentList（官方「论坛帖子」）；
// 他人=userForumOrShowPage（user_id+config_id=3，官方 tab 链路等价推断——记录在端点 notes）。
function UserThreadList({ uid, isSelf = false }: { uid: string; isSelf?: boolean }) {
  // soak 实测修正（2026-11-03）：userContentList v1 需 type 参数（code0 拒）；
  // userForumOrShowPage 对 self（实测 n=2）与他人（n=20）均通——统一单端点
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<any[]>([]);
  const q = useEndpoint('userForumOrShowPage',
    { user_id: uid, config_id: 3, p: page, step: 20 });
  useEffect(() => { setPage(1); setRows([]); }, [uid]);
  useEffect(() => {
    const fresh = row(q.data);
    if (q.state !== 'Data' && q.state !== 'Stale') return;
    setRows((prev) => {
      if (page === 1) return fresh;
      const seen = new Set(prev.map((r) => String(r.tid ?? r.id ?? '')));
      return [...prev, ...fresh.filter((r) => !seen.has(String(r.tid ?? r.id ?? '')))];
    });
  }, [q.data, q.state, page]);
  const canMore = (q.state === 'Data' || q.state === 'Stale') && row(q.data).length >= 20;
  return (
    <div data-test="user-threads" style={{ marginTop: 14 }}>
      <h2 style={{ fontSize: 15, color: 'var(--text2)', margin: '0 0 8px' }}>
        {isSelf ? '我的帖子' : 'TA 的帖子'} <StateBadge state={q.state} />
      </h2>
      <StateBlock state={q.state} fail={q.fail} onRetry={() => q.refetch()} skeletonRows={2} />
      {q.state === 'Empty' && (
        <div className="state-card" data-test="user-threads-empty">暂无帖子</div>
      )}
      {rows.map((t: any, i: number) => (
        <ThreadPreviewCard key={String(t.tid ?? t.id ?? i)} t={t} testAttr="user-thread-row" />
      ))}
      {canMore && (
        <div className="chiprow" style={{ justifyContent: 'center' }}>
          <button className="btn" data-test="uthreads-more" disabled={q.isFetching}
            onClick={() => setPage((v) => v + 1)}>加载更多</button>
        </div>
      )}
    </div>
  );
}

// R3-3 他人主页：userHome 资料+统计；F2 粉丝/关注/帖子列表接入。
export function UserProfilePage({ uid, tab }: { uid: string; tab?: 'fans' | 'follows' }) {
  const { session } = useSession();
  const myId = session === 'loading' ? '' : String(session.auth?.userId ?? '');
  const isSelf = uid === myId && myId !== '';
  const up = useEndpoint('userHome', { uid });
  const root = (up.data as any) ?? {};
  const d = root.data ?? {};
  // soak 实测修正（2026-11-03）：tab_config 在响应**顶层**（数组形态，非 data 内字符串）——
  // 首版读 data.tab_config 恒 undefined=帖子区块永不渲染（真实缺陷）。兼容字符串旧形态。
  const hasForumTab = useMemo(() => {
    try {
      const tc = root.tab_config ?? d.tab_config;
      const arr = typeof tc === 'string' ? JSON.parse(tc) : tc;
      return Array.isArray(arr) && arr.some((e: any) => String(e?.config_id) === '3');
    } catch { return false; }
  }, [up.data]);
  return (
    <section>
      <p className="crumb"><a href="#/community">‹ 社区</a></p>
      <div className="board-head" data-test="user-head">
        <Avatar src={d.head} name={d.name ?? uid} size={56} />
        <div>
          <div className="card-title" data-test="user-name">{d.name ?? uid}</div>
          {d.sign ? <div className="card-sub">{String(d.sign).slice(0, 60)}</div> : null}
          <div className="card-meta">
            {d.group_name ? `${d.group_name}${d.group_level ? ` · Lv.${d.group_level}` : ''}` : ''}
          </div>
          <div className="card-meta">
            {/* soak 实测修正（2026-11-03）：真实计数键=fans_count/follow_count/showTopicNumber
                （首版 fans_num/follow_num 恒 0——真实缺陷） */}
            {d.showTopicNumber != null && `帖 ${formatCount(d.showTopicNumber)} · `}
            <a data-test="fans-link" href={`#/user/${uid}/fans`}>粉 {formatCount(d.fans_count ?? d.fans_num)}</a> ·{' '}
            <a data-test="follows-link" href={`#/user/${uid}/follows`}>关注 {formatCount(d.follow_count ?? d.follow_num)}</a>
          </div>
        </div>
        {/* R4b/BU-05：主页关注钮——数据就绪后才挂载（initial 随数据一次性定格，
            避免 skeleton 期 initial=null 被 useState 定格为 false——wp6 F1a 实测） */}
        {!isSelf && d.name && (
          <FollowButton userId={uid} name={String(d.name ?? uid)}
            initial={Number(d.relation_status) === 1 || Number(d.relation_status) === 2 ? true
              : Number(d.relation_status) === 0 ? false : null} />
        )}
      </div>
      <StateBlock state={up.state} fail={up.fail} onRetry={() => up.refetch()} skeletonRows={2} />
      {tab
        ? <UserFansList uid={uid} tab={tab} isSelf={isSelf} />
        : (
          <>
            {(isSelf || hasForumTab) && <UserThreadList uid={uid} isSelf={isSelf} />}
            <p className="page-sub" style={{ marginTop: 12 }}>
              更多区块（动态/相册等官方用户页能力）随端点勘定逐步接入。
            </p>
          </>
        )}
    </section>
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
      {q.state === 'Empty' && (
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

// R2/WP1-B（BU-01）统一链接分流：站内可映射→同窗 hash 锚（零新标签）；
// 外站 http(s)→外开；缺 link/异常协议→null（调用方渲染非链接卡，禁 '#'空页）。
function cardLinkTarget(link: unknown): { href: string; external: boolean } | null {
  if (typeof link !== 'string' || !link.trim()) return null;
  if (!/^https?:\/\//i.test(link)) return null; // javascript:/data: 等→不可点
  const route = internalRouteFromUrl(link);
  if (route) return { href: route, external: false };
  return { href: link, external: true };
}

// R3/WP2-B（BU-02）跨入口图文一致：forumView/userForumOrShowPage 行→同一预览卡。
// 只消费行内字段（零 N+1——禁逐帖 threadView）；无图不渲染占位、视频行 video_url
// 有值→▶ 徽标；长标题 CSS 截断。复用 Board 行字段名（soak 真实键）。
function ThreadPreviewCard({ t, className = 'card thread-row', leading, testAttr }: {
  t: any; className?: string; leading?: React.ReactNode; testAttr?: string;
}) {
  const tid = String(t.tid ?? '');
  if (!tid) return null;
  const pics = Array.isArray(t.pics) ? t.pics
    : Array.isArray(t.pics_arr) ? t.pics_arr : [];
  const pic0 = pics.find((u: unknown) => typeof u === 'string' && u.startsWith('http'));
  const videoUrl = typeof t.video_url === 'string' && t.video_url ? t.video_url
    : (Array.isArray(t.videos) && t.videos[0] && (t.videos[0].url || t.videos[0].video_url)) || null;
  const des = typeof t.des === 'string' && t.des.trim()
    ? t.des.replace(/<[^>]+>/g, '').trim().slice(0, 60) : '';
  const count = pics.length || (t.pics_count ? Number(t.pics_count) : 0);
  return (
    <a className={className} href={`#/thread/${tid}`} data-test={testAttr}>
      {leading}
      {pic0 && (
        <span className="thread-thumb" data-test="row-thumb">
          <img src={pic0} alt="" loading="lazy" referrerPolicy="no-referrer" />
          {count > 1 && <i className="thumb-count">{count} 图</i>}
        </span>
      )}
      <div className="thread-main">
        <div className="card-title">{String(t.subject ?? t.title ?? '')}</div>
        {des ? <div className="card-sub">{des}</div> : null}
        <div className="card-meta">
          {t.user_name ? `${String(t.user_name)} · ` : ''}
          {formatTime(t.last_reply_time ?? t.lastpost ?? t.dateline)} ·{' '}
          回 {formatCount(t.reply_count ?? t.comment_count)} · 看 {formatCount(t.click)}
          {videoUrl ? <span style={{ marginLeft: 6, color: 'var(--accent)' }}>▶ 视频</span> : null}
        </div>
      </div>
    </a>
  );
}

// G1 热议热榜（旧线 forumlist/hotfeed 模式移植）：活跃板块×order=heat 各取 3 条，
// 客户端聚合按（回复×10+查看）排序取前 10。请求预算=板块数（≤5）/5min（staleTime）。
// 数据经 lift 上浮到 HotFeed 聚合（React state 桥，不绕 TanStack）。
function HotBoard({ fid, onRows }: { fid: string; onRows: (fid: string, rows: any[]) => void }) {
  const q = useEndpoint('forumView', { fid, p: 1, step: 3, order: 'heat' });
  useEffect(() => {
    if (q.state === 'Data' || q.state === 'Stale') onRows(fid, row(q.data));
  }, [q.data, q.state, fid]);
  return null;
}
function HotFeed({ fids }: { fids: string[] }) {
  const [byBoard, setByBoard] = useState<Record<string, any[]>>({});
  const merged = useMemo(() => {
    const all = Object.values(byBoard).flat();
    const seen = new Set<string>();
    return all
      .filter((t: any) => { const k = String(t.tid); if (seen.has(k)) return false; seen.add(k); return true; })
      .sort((a: any, b: any) => (Number(b.reply_count) * 10 + Number(b.click))
        - (Number(a.reply_count) * 10 + Number(a.click)))
      .slice(0, 10);
  }, [byBoard]);
  return (
    <div data-test="hotfeed" style={{ marginBottom: 16 }}>
      <div className="section-title">热议热榜</div>
      {merged.length === 0 && (
        <div className="card-meta" style={{ padding: '4px 2px' }}>热榜生成中…</div>
      )}
      {merged.map((t: any, i: number) => (
        <ThreadPreviewCard key={String(t.tid)} t={t} testAttr="hot-row"
          leading={<span style={{ color: 'var(--text3)', fontSize: 12, minWidth: 20 }}>{i + 1}</span>} />
      ))}
      {fids.slice(0, 5).map((fid) => (
        <HotBoard key={fid} fid={fid} onRows={(f, rs) => setByBoard((prev) => ({ ...prev, [f]: rs }))} />
      ))}

</div>
  );
}
export function FocusPage() {
  const [channel, setChannel] = useState(7);
  const [page, setPage] = useState(1);
  // E31-05 修复：累积语义（追加去重），频道切换原子重置游标与列表——
  // 上一版「加载更多」实为替换页 + 换频道继承页码（p2 起步显示假空态）
  const [items, setItems] = useState<any[]>([]);
  const info = useEndpoint('infoListByCatId', { cat_id: channel, step: 20, p: page });
  useEffect(() => {
    const rows = row(info.data);
    if (info.state !== 'Data' && info.state !== 'Empty' && info.state !== 'Stale') return;
    setItems((prev) => {
      if (page === 1) return rows;
      const seen = new Set(prev.map((r: any) => String(r.id)));
      return [...prev, ...rows.filter((r: any) => !seen.has(String(r.id)))];
    });
  }, [info.data, info.state, page]);
  const canLoadMore = (info.state === 'Data' || info.state === 'Stale')
    && row(info.data).length >= 20; // 满页才可能还有下一页
  const tree = useEndpoint('circleTree');
  const { session } = useSession();
  const auth = session === 'loading' ? null : session.auth;
  return (
    <section>
      {auth && <MyBoards userId={auth.userId} />}
      <div className="section-title">频道</div>
      <div className="chiprow" role="group" aria-label="资讯频道" style={{ marginBottom: 10 }}>
        {CHANNELS.map((c) => (
          <button key={c.id} data-test={`channel-${c.id}`} aria-pressed={channel === c.id}
            className={'chip' + (channel === c.id ? ' on' : '')}
            style={channel === c.id ? { borderColor: 'var(--accent)', color: 'var(--accent)' } : {}}
            onClick={() => { setChannel(c.id); setPage(1); setItems([]); }}>{c.label}</button>
        ))}
      </div>
      <div className="section-title">资讯 <StateBadge state={info.state} /></div>
      {(page === 1 || info.state === 'RetryableError') && (
        <StateBlock state={info.state === 'Data' ? 'Data' : info.state} fail={info.fail}
          onRetry={() => info.refetch()} />
      )}
      {items.map((it: any) => {
        // BU-01：本站链（帖/板块/用户）同窗内跳；真资讯外链才外开；缺 link=非链接卡
        const tgt = cardLinkTarget(it.link);
        const inner = (
          <>
            <div className="card-title">{it.title}</div>
            {it.des ? <div className="card-sub">{String(it.des).slice(0, 80)}</div> : null}
            <div className="card-meta">
              {it.from || it.user_name} · {it.publish_time_str} · 评 {formatCount(it.comment_count)}
            </div>
          </>
        );
        if (!tgt) {
          return <div key={String(it.id)} className="card info-card" data-test="info-no-link">{inner}</div>;
        }
        return tgt.external
          ? <a key={String(it.id)} className="card info-card" href={tgt.href} target="_blank" rel="noreferrer">{inner}</a>
          : <a key={String(it.id)} className="card info-card" href={tgt.href}>{inner}</a>;
      })}
      {canLoadMore && (
        <div className="chiprow" style={{ justifyContent: 'center' }}>
          <button className="btn" data-test="info-more" disabled={info.isFetching}
            onClick={() => setPage((v) => v + 1)}>
            {info.isFetching ? '加载中…' : '加载更多'}
          </button>
        </div>
      )}
      {tree.state !== 'InitialLoading' && (() => {
        const fids: string[] = [];
        for (const g of row(tree.data)) {
          for (const c of (g.circle_list ?? [])) {
            const fid = String(c.type_value ?? '');
            if (fid && fids.length < 5) fids.push(fid);
          }
        }
        return fids.length > 0 ? <HotFeed fids={fids} /> : null;
      })()}
      <div className="section-title">快捷入口</div>
      <div className="chiprow" data-test="tools">
        {/* G9：原生搜索内链（窄屏 navtools 隐藏——聚焦页是窄屏搜索的可达入口） */}
        <a className="chip" data-test="tools-search" href="#/search">搜索板块/圈子</a>
        {[['论坛导读', 'forum.php?mod=guide&mobile=2'], ['个人中心', 'home.php?mod=space&do=profile&mobile=2'],
          ['H5 搜索', 'search.php?mod=forum&mobile=2']].map(([t, path]) => (
          <a key={t} className="chip" target="_blank" rel="noreferrer"
            href={`https://bbs.sdgun.com.cn/${path}`}>{t} ↗</a>
        ))}
      </div>
      <div className="section-title">板块速览 <StateBadge state={tree.state} /></div>
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
          <div className="section-title">{g.name}</div>
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
const boardStateKey = (fid: string) => `sdg2.boardstate.${fid}`;

function readBoardState(fid: string): { page: number; order: string } {
  try {
    const raw = sessionStorage.getItem(boardStateKey(fid));
    if (raw) {
      const d = JSON.parse(raw);
      if (Number(d.page) >= 1 && typeof d.order === 'string') {
        return { page: Number(d.page), order: d.order };
      }
    }
  } catch { /* 损坏则回默认 */ }
  return { page: 1, order: 'lastpost' };
}

export function BoardPage({ fid }: { fid: string }) {
  const restored = readBoardState(fid);
  const [page, setPage] = useState(restored.page);
  const [order, setOrder] = useState<string>(restored.order);
  const STEP = 20;
  const q = useEndpoint('forumView', { fid, p: page, step: STEP, order }, { keepPrev: true });
  // R2-1 板块头卡+分类筛选：forumDetail 提供板块名/图标/今日帖/threadtypes
  const detail = useEndpoint('forumDetail', { fid });
  const dData = (detail.data as any)?.data ?? {};
  const boardIcon = String(dData.icon ?? '');
  const todayNum = Number(dData.today_num) || 0;
  const totalNum = String(dData.total_num ?? '');
  const typeChips = Array.isArray(dData.threadtypes) ? dData.threadtypes : [];
  // F2-3 角色可见性：forumDetail.moderators 版主徽章（渲染防御：数组取 name/user_name，
  // 字符串按分隔符拆；不识别形态不渲染——不做权限推断）
  const mods = useMemo(() => {
    const m = dData.moderators;
    if (Array.isArray(m)) {
      return m.map((x: any) => String(x?.name ?? x?.user_name ?? '')).filter(Boolean);
    }
    if (typeof m === 'string' && m.trim()) {
      return m.split(/[,，、;；\s]+/).filter(Boolean);
    }
    return [];
  }, [detail.data]);
  const [activeType, setActiveType] = useState('');
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
  // W3/T3-4：返回状态保留（页码+排序；离开板块后再进恢复现场）
  useEffect(() => {
    try { sessionStorage.setItem(boardStateKey(fid), JSON.stringify({ page, order })); } catch {}
  }, [fid, page, order]);
  const isPinned = (t: any) => Number(t.is_top) > 0;
  const rtree = useEndpoint('circleTree');
  const dirBoards = useMemo(() => {
    const out: { fid: string; name: string }[] = [];
    for (const g of (rtree.data as any)?.list ?? []) {
      for (const c of g.circle_list ?? []) {
        if (String(c.type_value) !== fid) out.push({ fid: String(c.type_value), name: c.name });
      }
    }
    return out.slice(0, 10);
  }, [rtree.data, fid]);
  return (
    <section>
      <div className="page-header">
        <p className="crumb">
          <a href="#/community">‹ 社区</a>
          <span className="dim" data-test="board-name"> · {boardName || `版块 ${fid}`}</span>
        </p>
        {(boardName || boardIcon) && (
          <div className="board-head" data-test="board-head">
            {boardIcon && <img className="board-head-icon" src={boardIcon} alt=""
              referrerPolicy="no-referrer" />}
            <div>
              <div className="card-title">{boardName || `版块 ${fid}`}</div>
              {(todayNum || totalNum) && (
                <div className="card-meta">今日 {todayNum} · 共 {totalNum} 帖</div>
              )}
              {mods.length > 0 && (
                <div className="card-meta" data-test="board-mods">
                  版主：{mods.slice(0, 5).join(' · ')}{mods.length > 5 ? ' 等' : ''}
                </div>
              )}
            </div>
            <a className="btn btn-primary board-head-compose" data-test="compose-entry"
              href="#/editor">发帖</a>
          </div>
        )}
      </div>
      {typeChips.length > 0 && (
        <div className="chiprow" data-test="type-chips" role="group" aria-label="分类筛选">
          <button className={'chip' + (activeType === '' ? ' on' : '')}
            style={activeType === '' ? { borderColor: 'var(--accent)', color: 'var(--accent)' } : {}}
            onClick={() => { setActiveType(''); setPage(1); }}>全部</button>
          {typeChips.map((t: any) => {
            const tid = String(t.typeid ?? '');
            return (
              <button key={tid} data-test={`type-${tid}`} aria-pressed={activeType === tid}
                className={'chip' + (activeType === tid ? ' on' : '')}
                style={activeType === tid ? { borderColor: 'var(--accent)', color: 'var(--accent)' } : {}}
                onClick={() => { setActiveType(tid); setPage(1); }}>{t.name ?? tid}</button>
            );
          })}
        </div>
      )}
      <div className="section-title">排序</div>
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
      {q.state !== 'InitialLoading' && rows
        .filter((t: any) => !activeType || String(t.typeid ?? '') === activeType)
        .map((t: any) => {
        const pics = Array.isArray(t.pics) ? t.pics.filter((u: unknown) =>
          typeof u === 'string' && u.startsWith('http')) : [];
        return (
          <a key={String(t.tid)} className="card thread-row" href={`#/thread/${t.tid}`}>
            {isPinned(t) ? <span className="pin">置顶</span> : null}
            <Avatar src={t.user_head} name={t.user_name} size={36} />
            <div className="thread-main">
              <div className="card-title">{t.subject}</div>
              {t.des ? <div className="card-sub">{String(t.des).replace(/<[^>]+>/g, '').trim().slice(0, 60)}</div> : null}
              <div className="card-meta">
                {t.user_name} · {formatTime(t.last_reply_time ?? t.lastpost ?? t.dateline)} ·
                回 {formatCount(t.reply_count)} · 看 {formatCount(t.click)}
              </div>
            </div>
            {pics.length > 0 && (
              <span className="thread-thumb" data-test="row-thumb">
                <img src={pics[0]} alt="" loading="lazy" referrerPolicy="no-referrer" />
                {pics.length > 1 && <i className="thumb-count">{pics.length} 图</i>}
              </span>
            )}
          </a>
        );
      })}
      <div className="chiprow" style={{ justifyContent: 'center', marginTop: 14, alignItems: 'center' }}>
        <button className="btn" disabled={page <= 1} onClick={() => setPage(page - 1)}>上一页</button>
        <span style={{ color: 'var(--text3)', fontSize: 12 }}>第 {page} 页</span>
        <button className="btn" data-test="next-page" disabled={endReached}
          onClick={() => setPage(page + 1)}>下一页</button>
        <input className="composer-input pager-input" data-test="page-input" type="number" min={1}
          aria-label="跳转到指定页"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              const v = Math.max(1, parseInt((e.target as HTMLInputElement).value, 10) || 1);
              setEndReached(false);
              setPage(v);
            }
          }} />
      </div>
      {endReached && <div className="state-card" data-test="no-more">没有更多了</div>}
      {dirBoards.length > 0 && (
        <aside className="board-dir" data-test="board-dir" aria-label="其他板块">
          <div className="section-title">其他板块</div>
          <div className="chiprow">
            {dirBoards.map((b) => (
              <a key={b.fid} className="chip" href={`#/board/${b.fid}`}>{b.name}</a>
            ))}
          </div>
        </aside>
      )}
    </section>
  );
}
