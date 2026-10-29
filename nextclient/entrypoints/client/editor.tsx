// 编辑器：撰帖/回复工作区（批D 生产适配器——登录后提交走真实端点；
// agent/离线验证经 host override 指向合成后端；真实写入=账号本人动作）。
import { useEffect, useMemo, useState } from 'react';
import { useEndpoint } from '../../lib/queries';
import { sanitizeContent } from '../../lib/sanitize';
import { draftKey, loadReplyDraftText, saveReplyDraftText, useDraftOwner } from '../../lib/draft';
import { runMutation, type MutationState } from '../../lib/mutation';
import { useSession } from '../../lib/session';
import { StateBlock } from './StateBlock';

/* eslint-disable @typescript-eslint/no-explicit-any */

type SubmitState =
  | { phase: 'idle' }
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
  const { session } = useSession();
  const authed = session !== 'loading' && session.auth !== null;

  // W1/E28-02：owner 实时派生（身份切换即换键空间）
  const owner = useDraftOwner() ?? '';
  const replyMode = Boolean(tid);
  // 批D：回复需 circle_id（=fid），从 threadView 补全
  const tv = useEndpoint('threadView', replyMode && tid ? { tid } : { tid: 0 });
  const fid = String((tv.data as any)?.data?.fid ?? '');
  const draftK = replyMode ? draftKey(owner, tid!) : draftKey(owner, 'editor');
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
  const canSubmit = Boolean(authed) &&
    (replyMode ? Boolean(content.trim()) && Boolean(fid)
               : Boolean(title.trim()) && Boolean(content.trim()) && Boolean(board));

  async function doSubmit() {
    if (!canSubmit || submit.phase === 'busy') return;
    setSubmit({ phase: 'busy', state: 'Validating' });
    // 批D：Confirmed=已发布 → 清草稿；OutcomeUnknown=结果未知 → 草稿保留。
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
      },
      params: replyMode
        ? { tid: tid!, reply_id: '', circle_id: fid, content }
        : { title, content, fid: board, circle_id: board },
      timeoutMs: 15000,
    });
    if (replyMode && r.state === 'Confirmed' && draftK) {
      localStorage.removeItem(draftK);
      setContent('');
    }
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
          <button className="btn btn-primary" data-test="ed-submit" disabled={!canSubmit
              || submit.phase === 'busy'}
            title={authed ? undefined : '登录后可发布'}
            onClick={doSubmit}>
            {submit.phase === 'busy' ? stateText[submit.state] : (replyMode ? '发布回复' : '发布')}
          </button>
          <span data-test="ed-state" style={{ fontSize: 13, color: submit.phase === 'done'
              && submit.state === 'Confirmed' ? 'var(--accent)' : 'var(--text3)' }}>
            {submit.phase === 'done' ? stateText[submit.state] + (submit.msg ? `：${submit.msg}` : '') : ''}
          </span>
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
