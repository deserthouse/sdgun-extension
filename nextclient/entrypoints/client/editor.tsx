// M6-B 编辑器页：标题/板块/正文/附件占位/预览 + 诚实提交（写面封存）。
// 测试经 __broker.register 合成端点 + host override 走全状态机；产品构建提交禁用。
import { useEffect, useMemo, useState } from 'react';
import { useEndpoint } from '../../lib/queries';
import { sanitizeContent } from '../../lib/sanitize';
import { draftKey, loadReplyDraftText, saveReplyDraftText, useDraftOwner } from '../../lib/draft';
import { runMutation, type MutationState } from '../../lib/mutation';
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
  const [synthetic, setSynthetic] = useState(false);

  // W1/E28-02：owner 实时派生（身份切换即换键空间）
  const owner = useDraftOwner() ?? '';
  const replyMode = Boolean(tid);
  const draftK = replyMode ? draftKey(owner, tid!) : draftKey(owner, 'editor');
  // E24-04 修复：key=null（身份未 ready）→ 不加载也不允许编辑；
  // key 变化 → 无条件恢复存值或清空（不做 dLoaded 单次封死——异步 auth 变化会换 key）
  const identityReady = draftK !== null;

  useEffect(() => {
    if (!draftK) return;
    if (replyMode) {
      const c = loadReplyDraftText(draftK);
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

  const canSubmit = replyMode ? content.trim() : (title.trim() && content.trim() && board);

  async function doSubmit() {
    if (!canSubmit || submit.phase === 'busy') return;
    setSubmit({ phase: 'busy', state: 'Validating' });
    // C2-3：回复模式走 synthetic.replyAdd（tid+content）；Confirmed=已发布（合成）→ 清草稿
    // （已发布内容不应留作草稿）；OutcomeUnknown=结果未知 → 草稿保留。
    const r = await runMutation({
      endpointId: replyMode ? 'synthetic.replyAdd' : 'synthetic.threadAdd',
      validate: () => {
        if (replyMode) {
          if (!content.trim()) throw new Error('回复内容不能为空');
          return;
        }
        if (!title.trim()) throw new Error('标题不能为空');
        if (!content.trim()) throw new Error('正文不能为空');
      },
      params: replyMode ? { tid: tid!, content } : { title, board, content },
      timeoutMs: 8000,
    });
    if (replyMode && r.state === 'Confirmed' && draftK) {
      localStorage.removeItem(draftK);
      setContent('');
    }
    setSubmit({ phase: 'done', state: r.state, msg: r.msg });
  }

  const stateText: Record<MutationState, string> = {
    Draft: '草稿', Validating: '校验中…', Submitting: '提交中…',
    Confirmed: '已确认（合成后端）', Rejected: '已驳回',
    OutcomeUnknown: '结果未知——请勿重复提交',
  };

  return (
    <div data-test="editor" style={{ maxWidth: 720 }}>
      {replyMode && (
        <p style={{ fontSize: 13, color: 'var(--text2)', margin: '0 0 10px' }} data-test="ed-reply-context">
          回复帖子 tid={tid}（草稿与帖子页共用；真实发布属用户红线动作，当前为合成验证通道）
        </p>
      )}
      {!replyMode && (
        <div className="card">
          <label style={{ fontSize: 13, color: 'var(--text2)' }} htmlFor="ed-title">标题</label>
          <input id="ed-title" data-test="ed-title" value={title} disabled={!identityReady}
            onChange={(e) => { setTitle(e.target.value); saveDraft(e.target.value, board, content); }}
            style={{ width: '100%', padding: '10px 12px', borderRadius: 10,
              border: '1px solid var(--border2)', background: 'var(--surface)',
              color: 'var(--text)', marginTop: 4, boxSizing: 'border-box' }} />
        </div>
      )}
      {!replyMode && (
        <BoardSelect value={board} identityReady={identityReady}
          onChange={(v) => { setBoard(v); saveDraft(title, v, content); }} />
      )}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <label style={{ fontSize: 13, color: 'var(--text2)' }} htmlFor="ed-content">正文</label>
          <button className="btn" data-test="ed-preview"
            onClick={() => setPreview(!preview)}>{preview ? '编辑' : '预览'}</button>
        </div>
        {preview
          ? <div className="content-html" data-test="ed-preview-view"
              dangerouslySetInnerHTML={{ __html: sanitizeContent(content) }} />
          : <textarea id="ed-content" data-test="ed-content" value={content} disabled={!identityReady}
              onChange={(e) => { setContent(e.target.value); saveDraft(title, board, e.target.value); }}
              style={{ width: '100%', minHeight: 140, borderRadius: 10,
                border: '1px solid var(--border2)', background: 'var(--surface)',
                color: 'var(--text)', padding: 10, fontSize: 14,
                boxSizing: 'border-box', resize: 'vertical' }} />}
      </div>
      <div className="card" data-test="ed-attachments">
        <div className="card-title" style={{ fontSize: 13 }}>附件队列（占位）</div>
        {files.map((f) => <div key={f} className="card-meta">📎 {f}</div>)}
        <button className="btn" disabled title="上传能力未开放（M6 诚实占位）"
          onClick={() => setFiles([...files, '占位附件'])}>添加附件（未开放）</button>
      </div>
      <div className="chiprow" style={{ alignItems: 'center' }}>
        <button className="btn" data-test="ed-submit" disabled={!canSubmit || submit.phase === 'busy'
            || (!synthetic && true)}
          title={synthetic ? undefined : '真实发布写面封存（测试经合成后端启用）'}
          onClick={doSubmit}>
          {submit.phase === 'busy' ? stateText[submit.state] : '提交'}
        </button>
        <span data-test="ed-state" style={{ fontSize: 13, color: submit.phase === 'done'
            && submit.state === 'Confirmed' ? 'var(--accent)' : 'var(--text3)' }}>
          {submit.phase === 'done' ? stateText[submit.state] + (submit.msg ? `：${submit.msg}` : '') : ''}
        </span>
      </div>
      <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 8 }}>
        真实发布属用户红线动作，产品构建不接写端点；草稿自动保存于本机（{owner} 域）。
      </p>
      {/* 测试缝：合成后端启用（驱动经 __editor.enableSyntheticSubmit()） */}
      <button style={{ display: 'none' }} data-test="ed-enable-synthetic"
        onClick={() => setSynthetic(true)} />
      {(() => {
        (window as { __editor?: unknown }).__editor = {
          enableSyntheticSubmit: () => { setSynthetic(true); },
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
    <div className="card">
      <label style={{ fontSize: 13, color: 'var(--text2)' }} htmlFor="ed-board">板块</label>
      <div>
        <StateBlock state={tree.state === 'Data' ? 'Data' : tree.state}
          fail={tree.fail} onRetry={() => tree.refetch()} skeletonRows={1} />
      </div>
      <select id="ed-board" data-test="ed-board" value={value} onChange={(e) => onChange(e.target.value)}
        style={{ marginTop: 6, background: 'var(--surface2)', color: 'var(--text2)',
          border: '1px solid var(--border2)', borderRadius: 8, padding: '6px 10px' }}>
        <option value="">选择板块…</option>
        {boards.map((b) => <option key={b.fid} value={b.fid}>{b.name}</option>)}
      </select>
    </div>
  );
}
