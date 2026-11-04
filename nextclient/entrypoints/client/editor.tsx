// 编辑器：撰帖/回复工作区（批D 生产适配器——登录后提交走真实端点；
// agent/离线验证经 host override 指向合成后端；真实写入=账号本人动作）。
import { useEffect, useMemo, useState } from 'react';
import { useEndpoint } from '../../lib/queries';
import { sanitizeContent } from '../../lib/sanitize';
import { draftKey, loadReplyDraftText, saveReplyDraftText, useDraftOwner,
  loadDraft, saveDraftDraft, clearDraft, type EditorDraft } from '../../lib/draft';
import { runMutation, type MutationState } from '../../lib/mutation';
import { verifyPicSecurityCode, captchaImageUrl } from '../../lib/auth';
import { callEndpoint, isFail } from '../../lib/broker';
import { useSession } from '../../lib/session';
import { useRef } from 'react';
import { StateBlock } from './StateBlock';

/* eslint-disable @typescript-eslint/no-explicit-any */

type SubmitState =
  | { phase: 'idle'; state?: undefined }
  | { phase: 'busy'; state: MutationState }
  | { phase: 'done'; state: MutationState; msg?: string };

// tid 模式（C1-5）：从帖子页「回复」进入——无标题/板块选择（目标已定），
// 草稿与帖子页 ReplyDraft 共用 owner+tid 键（loadReplyDraftText 统一格式）。
export function EditorPage({ tid }: { tid?: string }) {
  const [title, setTitle] = useState('');
  const [board, setBoard] = useState('');
  const [content, setContent] = useState('');
  const [preview, setPreview] = useState(false);
  // R1/WP4-B：附件=结构化列表（opId/name/url 随稿持久化——B1104-02）
  const [files, setFiles] = useState<{ opId: string; name: string; url: string }[]>([]);
  // R4-1 附件上传链：选文件→上传（multipart）→URL 引用插入正文→失败可重试
  const [upState, setUpState] = useState<'idle' | 'uploading' | 'done' | 'err'>('idle');
  const [upErr, setUpErr] = useState('');
  const taRef = useRef<HTMLTextAreaElement | null>(null); // 选区感知插入（BU-03）
  const mountedRef = useRef(true);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);
  // R1/W3 竞态根治：异步回调（上传 onResult）读渲染闭包会拿到发起时的旧 files/content，
  // 乱序到达互相覆盖——ref 镜像每渲染同步的最新值，回调一律读 ref
  const filesRef = useRef(files);
  filesRef.current = files;
  const contentRef = useRef(content);
  contentRef.current = content;
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [submit, setSubmit] = useState<SubmitState>({ phase: 'idle' });
  const [flash, setFlash] = useState(false); // E31-03：成功瞬态提示（与 idle 收束解耦）
  const { session } = useSession();
  const authed = session !== 'loading' && session.auth !== null;

  // W1/E28-02：owner 实时派生（身份切换即换键空间）
  const owner = useDraftOwner() ?? '';
  // E31-02：归属门——mutation 发起时冻结 owner+epoch，结果落地前核对仍是同一身份
  const ownRef = useRef<{ owner: string; epoch: string | null }>({ owner: '', epoch: null });
  ownRef.current = { owner, epoch: session === 'loading' ? null : session.epoch };
  const replyMode = Boolean(tid);
  // 批D：回复需 circle_id（=fid），从 threadView 补全
  const tv = useEndpoint('threadView', replyMode && tid ? { tid } : { tid: 0 });
  const fid = String((tv.data as any)?.data?.fid ?? '');
  const draftK = replyMode ? draftKey(owner, tid!) : draftKey(owner, 'editor');
  // R1/E31-07 ReplyTarget：被回复楼层 pid（引用暂存时记录），提交作 reply_id
  const [quotePid, setQuotePid] = useState<string | null>(null);
  // R4-2 写链验证码：CaptchaNeeded → 图码卡 → verify 成功后重提交
  const [capState, setCapState] = useState<{ active: boolean; code: string; err: string }>(
    { active: false, code: '', err: '' });
  // R1/BU-03 @候选：userSearch GET name（API.java:101+Android ProfileRepository 同源）；
  // 300ms 防抖+登录门（游客不点火）；无结果=诚实空态
  const [atOpen, setAtOpen] = useState(false);
  const [atQuery, setAtQuery] = useState('');
  const [atDebounced, setAtDebounced] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setAtDebounced(atQuery.trim()), 300);
    return () => clearTimeout(t);
  }, [atQuery]);
  const atQ = useEndpoint('userSearch', { name: atDebounced },
    { enabled: atOpen && authed && atDebounced !== '' });
  // E24-04 修复：key=null（身份未 ready）→ 不加载也不允许编辑；
  // key 变化 → 无条件恢复存值或清空（不做 dLoaded 单次封死——异步 auth 变化会换 key）
  const identityReady = draftK !== null;

  // R1/WP4-B：统一 v2 草稿恢复（content/title/board/quotePid/attachments 一次重建）
  useEffect(() => {
    if (!draftK) return;
    if (replyMode) {
      const d = loadDraft(draftK);
      let c = d.content;
      // W3/批B：引用回复——帖子页暂存的引用（键含 owner，切换身份自动失效）
      try {
        const qk = `sdg2.quote.${owner}.${tid}`;
        const raw = localStorage.getItem(qk);
        if (raw && !c.trim()) {
          const q = JSON.parse(raw) as { pid?: string; name?: string; text?: string };
          c = `回复 ${q.name ?? ''}(${q.pid ?? ''})：${q.text ?? ''}
`;
          if (q.pid) setQuotePid(String(q.pid)); // R1 ReplyTarget：精确楼层引用
          // R4-4：引用暂存保留（刷新恢复），仅发布成功/清空时删除
        }
      } catch { /* 引用暂存损坏则忽略 */ }
      setContent(c);
      setQuotePid((prev) => (d.quotePid ?? prev));
      setFiles(d.attachments);
      setTitle('');
      setBoard('');
      return;
    }
    const d = loadDraft(draftK);
    setTitle(d.title ?? '');
    setContent(d.content);
    setBoard(d.board ?? '');
    setFiles(d.attachments);
  }, [draftK, replyMode]);

  // R1/WP4-B 统一持久化入口：content/attachments（及可选 title/board）一次写稿
  // ——上传/插入/打字全走这里（B1104-02：程序化插入必须落稿）
  function persistDraft(nextContent: string, nextFiles: typeof files,
    t = title, b = board, qp = quotePid) {
    if (!draftK) return;
    const d: EditorDraft = { v: 2, content: nextContent, attachments: nextFiles };
    if (replyMode) {
      d.quotePid = qp;
      saveDraftDraft(draftK, d);
      return;
    }
    d.title = t;
    d.board = b;
    saveDraftDraft(draftK, d);
  }

  // R1/BU-03 选区感知插入：光标/选区处替换+落稿+焦点恢复（上传/表情/@ 共用）
  function applyInsert(text: string, nextFiles?: typeof files) {
    const ta = taRef.current;
    const cur = contentRef.current; // 最新正文（非渲染闭包——W3 竞态）
    const nf0 = nextFiles ?? filesRef.current;
    let next: string;
    let caret: number;
    if (ta) {
      const start = ta.selectionStart ?? cur.length;
      const end = ta.selectionEnd ?? start;
      next = cur.slice(0, start) + text + cur.slice(end);
      caret = start + text.length;
    } else {
      next = cur + text; // textarea 未挂载（预览态等）→ 追加
      caret = next.length;
    }
    setContent(next);
    setFiles(nf0);
    persistDraft(next, nf0);
    setTimeout(() => {
      const el = taRef.current;
      if (el) { el.focus(); el.setSelectionRange(caret, caret); }
    }, 0);
  }

  function saveDraft(t: string, b: string, c: string) {
    if (!draftK) return;
    if (replyMode) saveReplyDraftText(draftK, c);
    else localStorage.setItem(draftK, JSON.stringify({ title: t, board: b, content: c }));
  }

  // 批D 生产适配器：登录后提交走真实端点（真实写入=账号本人动作）；
  // agent/离线验证经 host override 指向合成后端（驱动口径）。
  // R1/E31-07：发帖模式 circle_id 必须经 threadAddColumnInfoV2 从服务端换取
  //（fid≠circle_id——官 APK ThreadPostActivity 从该响应读 circle_id 回填）
  // enabled 双门：仅发帖模式且已选板时点火（否则占位参数也发请求——r1 B1 反例）
  const colInfo = useEndpoint('threadAddColumnInfo',
    !replyMode && board ? { fid: board, sortid: '' } : undefined,
    { enabled: !replyMode && board !== '' });
  const circleId = String((colInfo.data as any)?.data?.circle_id ?? '');
  const canSubmit = Boolean(authed) &&
    (replyMode ? Boolean(content.trim()) && Boolean(fid)
               : Boolean(title.trim()) && Boolean(content.trim()) && Boolean(board)
                 && Boolean(circleId));

  async function doSubmit() {
    if (!canSubmit || submit.phase === 'busy') return;
    setSubmit({ phase: 'busy', state: 'Validating' });
    // E31-02：冻结发起时归属与已提交快照——迟到结果不得污染新身份 UI/草稿
    const mine = { ...ownRef.current };
    const key0 = draftK;
    const snap = { title, board, content };
    const r = await runMutation({
      endpointId: replyMode ? 'replyAdd' : 'threadAdd',
      validate: () => {
        if (!authed) throw new Error('请先登录');
        if (replyMode) {
          if (!content.trim()) throw new Error('回复内容不能为空');
          if (!fid) throw new Error('未能确定所属板块，请稍后重试');
          return;
        }
        if (!title.trim()) throw new Error('标题不能为空');
        if (!content.trim()) throw new Error('正文不能为空');
        if (!circleId) throw new Error('该板块的发布参数未就绪，请稍后重试');
      },
      params: replyMode
        ? { tid: tid!, reply_id: quotePid ?? '', circle_id: fid, content }
        : { title, content, fid: board, circle_id: circleId },
      timeoutMs: 15000,
    });
    // 归属守卫：身份已换（跨标签登出/换号）→ 整个结果静默丢弃（不 setState/不动草稿）
    if (ownRef.current.owner !== mine.owner || ownRef.current.epoch !== mine.epoch) {
      return;
    }
    // E31-03：成功终态收束——两种模式统一；仅清「已提交的那份」，
    // 提交期间的后续输入保留（不误清新内容）
    if (r.state === 'Confirmed') {
      if (key0) {
        try {
          const raw = localStorage.getItem(key0);
          const d = loadDraft(key0); // v1/v2 兼容读取
          const same = d.content === snap.content
            && (replyMode || (d.title ?? '') === snap.title);
          if (same) clearDraft(key0);
        } catch { /* 损坏草稿不阻塞收束 */ }
      }
      setContent((prev) => (prev === snap.content ? '' : prev));
      if (!replyMode) {
        setTitle((prev) => (prev === snap.title ? '' : prev));
        setBoard((prev) => (prev === snap.board ? '' : prev));
      }
      try {
        const qk0 = replyMode ? `sdg2.quote.${mine.owner}.${tid}` : null;
        if (qk0) localStorage.removeItem(qk0); // R4-4：发布成功清引用暂存
      } catch {}
      setSubmit({ phase: 'idle' }); // 结束态=可开始新内容（防旧「已发布」+满表单并存）
      setFlash(true);
      setTimeout(() => setFlash(false), 3000);
      return;
    }
    // R4-2：写链 1009 → 展开验证码卡（草稿保留，验证后自动重提交）
    if (r.state === 'CaptchaNeeded') {
      setSubmit({ phase: 'idle' });
      setCapState({ active: true, code: '', err: '' });
      return;
    }
    // OutcomeUnknown：保稿+锁提交（明确恢复动作），Rejected/其他：可改后重试
    setSubmit({ phase: 'done', state: r.state, msg: r.msg });
  }

  // R4-2：验证码验证成功 → 自动重提交（归属守卫在 doSubmit 内）
  async function doCaptchaVerify() {
    if (!capState.code.trim()) return;
    setCapState((v) => ({ ...v, err: '' }));
    const v = await verifyPicSecurityCode(capState.code.trim());
    if (!v.ok) {
      setCapState((v0) => ({ ...v0, err: v.msg ?? '验证码不正确' }));
      return;
    }
    setCapState({ active: false, code: '', err: '' });
    await doSubmit();
  }

  const stateText: Record<MutationState, string> = {
    Draft: '草稿', Validating: '校验中…', Submitting: '提交中…',
    Confirmed: '已发布', Rejected: '已驳回', CaptchaNeeded: '需要图形验证',
    OutcomeUnknown: '结果未知——请勿重复提交',
  };

  return (
    <div data-test="editor" style={{ maxWidth: 720 }}>
      {replyMode && (
        <p style={{ fontSize: 13, color: 'var(--text2)', margin: '0 0 12px', overflowWrap: 'anywhere' }} data-test="ed-reply-context">
          回复：{String((tv.data as any)?.data?.title ?? `帖子 ${tid}`)} · 草稿与帖子页共用，发布后以你的账号真实回复
        </p>
      )}
      <div className="composer" data-test="ed-workspace">
        {!replyMode && (
          <div className="composer-field">
            <label className="composer-label" htmlFor="ed-title">标题</label>
            <input id="ed-title" className="composer-input" data-test="ed-title" value={title}
              disabled={!identityReady}
              onChange={(e) => { setTitle(e.target.value); saveDraft(e.target.value, board, content); }} />
          </div>
        )}
        {!replyMode && (
          <div className="composer-field">
            <BoardSelect value={board} identityReady={identityReady}
              onChange={(v) => { setBoard(v); persistDraft(content, files, title, v); }} />
          </div>
        )}
        <div className="composer-field">
          <div className="composer-toolbar">
            <label className="composer-label" style={{ marginBottom: 0 }} htmlFor="ed-content">正文</label>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="btn" data-test="ed-at" title="插入 @提及"
                onClick={() => setAtOpen(!atOpen)}>@</button>
              {['😀', '👍', '🔥', '🎉', '😭', '😡'].map((em) => (
                <button key={em} className="btn" data-test={`ed-emoji-${em.codePointAt(0)}`}
                  title={`插入 ${em}`}
                  onClick={() => applyInsert(em)}>{em}</button>
              ))}
              <button className="btn" data-test="ed-preview"
                onClick={() => setPreview(!preview)}>{preview ? '继续编辑' : '预览'}</button>
            </div>
          </div>
          {preview
            ? <div className="content-html" data-test="ed-preview-view"
                dangerouslySetInnerHTML={{ __html: sanitizeContent(content) }} />
            : <>
                <textarea id="ed-content" ref={taRef} className="composer-area" data-test="ed-content" value={content}
                  disabled={!identityReady}
                  onChange={(e) => { setContent(e.target.value); persistDraft(e.target.value, files); }} />
                {atOpen && (
                  <div className="card" data-test="at-panel" style={{ marginTop: 6, padding: 10 }}>
                    <div className="composer-label">插入 @提及（输入名字片段搜索用户）</div>
                    <input className="composer-input" data-test="at-input" value={atQuery}
                      placeholder="用户名片段…" aria-label="用户搜索输入"
                      onChange={(e) => setAtQuery(e.target.value)} />
                    {atQ.state === 'InitialLoading' && <div className="card-meta">搜索中…</div>}
                    {atQ.state === 'Empty' && <div className="card-meta">没有匹配的用户</div>}
                    {atQ.state === 'RetryableError' && <div className="card-meta">搜索失败（可稍后重试）</div>}
                    {(((atQ.data as any)?.list ?? []) as any[]).map((u: any) => (
                      <button key={String(u.user_id ?? u.id)} className="btn" data-test="at-cand"
                        style={{ display: 'flex', width: '100%', justifyContent: 'space-between', marginTop: 4 }}
                        onClick={() => {
                          applyInsert(`@${String(u.name ?? '')} `);
                          setAtOpen(false);
                          setAtQuery('');
                        }}>
                        <span>{String(u.name ?? '')}</span>
                        <span style={{ color: 'var(--text3)' }}>{String(u.user_id ?? u.id ?? '')}</span>
                      </button>
                    ))}
                  </div>
                )}
              </>}
        </div>
        <div className="composer-field" data-test="ed-attachments">
          <div className="composer-label">附件（图片）</div>
          {files.map((f) => <div key={f.opId} className="card-meta">📎 {f.name}</div>)}
          {upErr && <div className="card-meta" style={{ color: 'var(--accent)' }} data-test="up-error">{upErr}</div>}
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
            data-test="up-file"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (!f) return;
              if (!f.type.startsWith('image/')) {
                setUpState('err'); setUpErr('仅支持图片文件'); return;
              }
              if (f.size > 8 * 1024 * 1024) {
                setUpState('err'); setUpErr('图片超过 8MB 限制'); return;
              }
              setUpState('uploading'); setUpErr('');
              // R1/B1104-01：上传归属门——发起时冻结 owner/epoch/target/opId，
              // 结果落地前逐项复核；不符→零 setState/零草稿写（服务端可能已执行，
              // 只是不进新身份 UI——不声称「未执行」）
              const opId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
              const mine = { ...ownRef.current };
              const target = replyMode ? tid! : 'editor';
              try {
                // B1104-03 官方契约（Android ThreadPostSheet.kt UploadMultipart/
                // jadx LocalFileUpload.onUpload）：type=share / filename=imgs /
                // imgs=文件 / time_stamp
                const r = await callEndpoint<{ url?: string }>('uploadPicNew', {
                  params: { type: 'share', filename: 'imgs', time_stamp: Math.floor(Date.now() / 1000) },
                  file: f, fileField: 'imgs', fileName: f.name,
                });
                if (isFail(r)) throw new Error(r.msg);
                const url = r.url ?? '';
                const drifted = ownRef.current.owner !== mine.owner
                  || ownRef.current.epoch !== mine.epoch
                  || (replyMode ? tid! : 'editor') !== target
                  || !mountedRef.current;
                if (drifted) {
                  return; // 零 UI 写（含「上传成功」提示——那也是新身份的 UI）
                }
                if (url) {
                  const att = { opId, name: f.name, url };
                  const nextFiles = [...filesRef.current, att]; // 最新附件表（W3 乱序）
                  setFiles(nextFiles);
                  applyInsert(`
<img src="${url}" alt="${f.name}">`, nextFiles);
                  setUpState('done');
                } else {
                  setUpState('err'); setUpErr('上传响应缺少图片地址');
                }
              } catch (ex) {
                if (ownRef.current.owner !== mine.owner
                  || ownRef.current.epoch !== mine.epoch
                  || !mountedRef.current) {
                  return; // 迟到失败同样不进新身份 UI
                }
                setUpState('err');
                setUpErr(isFail(ex) ? ex.msg : String((ex as Error).message ?? ex).slice(0, 80));
              }
            }} />
          <button className="btn" data-test="up-pick" disabled={upState === 'uploading'}
            onClick={() => fileRef.current?.click()}>
            {upState === 'uploading' ? '上传中…' : upState === 'err' ? '重试上传' : '添加图片'}
          </button>
          {upState === 'done' && <span className="card-meta" style={{ color: 'var(--ok)' }}>上传成功</span>}
        </div>
        {capState.active && (
          <div className="card" data-test="ed-captcha" style={{ marginTop: 12 }}>
            <div className="composer-label">图形验证（发布前置）</div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <img data-test="ed-cap-img" src={captchaImageUrl()} alt="图形验证码"
                title="点击刷新"
                onClick={(e) => { (e.target as HTMLImageElement).src = captchaImageUrl(); }}
                style={{ height: 40, borderRadius: 6, border: '1px solid var(--border2)' }} />
              <input className="composer-input" data-test="ed-cap-input" value={capState.code}
                style={{ flex: 1 }} placeholder="输入图中字符" aria-label="图形验证码输入框"
                onChange={(e) => setCapState((v) => ({ ...v, code: e.target.value }))} />
              <button className="btn btn-primary" data-test="ed-cap-verify"
                disabled={!capState.code.trim()} onClick={doCaptchaVerify}>验证并发布</button>
            </div>
            {capState.err && (
              <div className="card-meta" style={{ color: 'var(--accent)' }}>{capState.err}</div>
            )}
          </div>
        )}
        <div className="chiprow" style={{ alignItems: 'center', margin: '16px 0 0' }}>
          <button className="btn btn-primary" data-test="ed-submit"
            disabled={!canSubmit || submit.phase === 'busy' || submit.state === 'OutcomeUnknown'}
            title={authed ? undefined : '登录后可发布'}
            onClick={doSubmit}>
            {submit.phase === 'busy' ? stateText[submit.state] : (replyMode ? '发布回复' : '发布')}
          </button>
          {submit.phase === 'done' && submit.state === 'OutcomeUnknown' && (
            <button className="btn" data-test="ed-unknown-reset"
              title="确认帖子状态后开始新内容（原草稿已保留在本机）"
              onClick={() => setSubmit({ phase: 'idle' })}>我已核对，继续</button>
          )}
          {flash && (
            <span data-test="ed-ok-flash" style={{ fontSize: 13, color: 'var(--accent)' }}>已发布 ✓</span>
          )}
          {submit.phase === 'done' && submit.state !== 'Confirmed' && (
            <span data-test="ed-state" style={{ fontSize: 13, color: 'var(--text3)' }}>
              {stateText[submit.state] + (submit.msg ? `：${submit.msg}` : '')}
            </span>
          )}
        </div>
        <p style={{ fontSize: 12, color: 'var(--text3)', margin: '10px 0 0' }}>
          登录后点「发布」即以你的账号真实发表；草稿自动保存在本机。
        </p>
      </div>
      {/* 测试缝：g6b 驱动经 __editor.setBoard 预选板块 */}
      {(() => {
        (window as { __editor?: unknown }).__editor = {
          setBoard: (fid: string) => { setBoard(fid); },
        };
        return null;
      })()}
    </div>
  );
}

// 发帖模式板块选择（circleTree 请求挂本组件——回复模式不挂载即零请求）
function BoardSelect({ value, identityReady, onChange }: {
  value: string; identityReady: boolean; onChange: (v: string) => void;
}) {
  const tree = useEndpoint('circleTree');
  const boards = useMemo(() => {
    const out: { fid: string; name: string }[] = [];
    for (const g of (tree.data as any)?.list ?? []) {
      for (const c of g.circle_list ?? []) out.push({ fid: String(c.type_value), name: c.name });
    }
    return out;
  }, [tree.data]);
  return (
    <>
      <label className="composer-label" htmlFor="ed-board">板块</label>
      <div>
        <StateBlock state={tree.state === 'Data' ? 'Data' : tree.state}
          fail={tree.fail} onRetry={() => tree.refetch()} skeletonRows={1} />
      </div>
      <select id="ed-board" className="composer-input" data-test="ed-board" value={value}
        onChange={(e) => onChange(e.target.value)}>
        <option value="">选择板块…</option>
        {boards.map((b) => <option key={b.fid} value={b.fid}>{b.name}</option>)}
      </select>
    </>
  );
}
