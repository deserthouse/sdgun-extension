// 编辑器：撰帖/回复工作区（批D 生产适配器——登录后提交走真实端点；
// agent/离线验证经 host override 指向合成后端；真实写入=账号本人动作）。
import { useEffect, useMemo, useState } from 'react';
import { useEndpoint } from '../../lib/queries';
import { sanitizeContent } from '../../lib/sanitize';
import { draftKey, loadReplyDraftText, saveReplyDraftText, useDraftOwner } from '../../lib/draft';
import { runMutation, type MutationState } from '../../lib/mutation';
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
  const [files, setFiles] = useState<string[]>([]);
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
  // E24-04 修复：key=null（身份未 ready）→ 不加载也不允许编辑；
  // key 变化 → 无条件恢复存值或清空（不做 dLoaded 单次封死——异步 auth 变化会换 key）
  const identityReady = draftK !== null;

  useEffect(() => {
    if (!draftK) return;
    if (replyMode) {
      let c = loadReplyDraftText(draftK);
      // W3/批B：引用回复——帖子页暂存的引用（键含 owner，切换身份自动失效）
      try {
        const qk = `sdg2.quote.${owner}.${tid}`;
        const raw = localStorage.getItem(qk);
        if (raw && !c.trim()) {
          const q = JSON.parse(raw) as { pid?: string; name?: string; text?: string };
          c = `回复 ${q.name ?? ''}(${q.pid ?? ''})：${q.text ?? ''}
`;
          if (q.pid) setQuotePid(String(q.pid)); // R1 ReplyTarget：精确楼层引用
          localStorage.removeItem(qk);
        }
      } catch { /* 引用暂存损坏则忽略 */ }
      setContent(c);
      setTitle('');
      setBoard('');
      return;
    }
    try {
      const saved = localStorage.getItem(draftK);
      if (saved) {
        const d = JSON.parse(saved);
        setTitle(d.title ?? '');
        setContent(d.content ?? '');
        setBoard(d.board ?? '');
      } else {
        setTitle('');
        setContent('');
        setBoard('');
      }
    } catch { setTitle(''); setContent(''); setBoard(''); }
  }, [draftK, replyMode]);

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
          const same = replyMode
            ? (raw !== null && (JSON.parse(raw).content ?? '') === snap.content)
            : (raw !== null && JSON.parse(raw).content === snap.content
               && JSON.parse(raw).title === snap.title);
          if (same) localStorage.removeItem(key0);
        } catch { /* 损坏草稿不阻塞收束 */ }
      }
      setContent((prev) => (prev === snap.content ? '' : prev));
      if (!replyMode) {
        setTitle((prev) => (prev === snap.title ? '' : prev));
        setBoard((prev) => (prev === snap.board ? '' : prev));
      }
      setSubmit({ phase: 'idle' }); // 结束态=可开始新内容（防旧「已发布」+满表单并存）
      setFlash(true);
      setTimeout(() => setFlash(false), 3000);
      return;
    }
    // OutcomeUnknown：保稿+锁提交（明确恢复动作），Rejected/其他：可改后重试
    setSubmit({ phase: 'done', state: r.state, msg: r.msg });
  }

  const stateText: Record<MutationState, string> = {
    Draft: '草稿', Validating: '校验中…', Submitting: '提交中…',
    Confirmed: '已发布', Rejected: '已驳回',
    OutcomeUnknown: '结果未知——请勿重复提交',
  };

  return (
    <div data-test="editor" style={{ maxWidth: 720 }}>
      {replyMode && (
        <p style={{ fontSize: 13, color: 'var(--text2)', margin: '0 0 12px' }} data-test="ed-reply-context">
          回复帖子 tid={tid} · 草稿与帖子页共用，发布后以你的账号真实回复
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
              onChange={(v) => { setBoard(v); saveDraft(title, v, content); }} />
          </div>
        )}
        <div className="composer-field">
          <div className="composer-toolbar">
            <label className="composer-label" style={{ marginBottom: 0 }} htmlFor="ed-content">正文</label>
            <button className="btn" data-test="ed-preview"
              onClick={() => setPreview(!preview)}>{preview ? '继续编辑' : '预览'}</button>
          </div>
          {preview
            ? <div className="content-html" data-test="ed-preview-view"
                dangerouslySetInnerHTML={{ __html: sanitizeContent(content) }} />
            : <textarea id="ed-content" className="composer-area" data-test="ed-content" value={content}
                disabled={!identityReady}
                onChange={(e) => { setContent(e.target.value); saveDraft(title, board, e.target.value); }} />}
        </div>
        <div className="composer-field" data-test="ed-attachments">
          <div className="composer-label">附件</div>
          {files.map((f) => <div key={f} className="card-meta">📎 {f}</div>)}
          <button className="btn" disabled title="附件上传即将开放"
            onClick={() => setFiles([...files, '占位附件'])}>添加附件</button>
        </div>
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
