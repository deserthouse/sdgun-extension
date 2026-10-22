// M6-B 编辑器页：标题/板块/正文/附件占位/预览 + 诚实提交（写面封存）。
// 测试经 __broker.register 合成端点 + host override 走全状态机；产品构建提交禁用。
import { useEffect, useMemo, useRef, useState } from 'react';
import { useEndpoint } from '../../lib/queries';
import { sanitizeContent } from '../../lib/sanitize';
import { draftKey, GUEST_OWNER } from '../../lib/draft';
import { getAuth, type AuthInfo } from '../../lib/auth';
import { runMutation, type MutationState } from '../../lib/mutation';
import { StateBlock } from './StateBlock';

/* eslint-disable @typescript-eslint/no-explicit-any */

type SubmitState =
  | { phase: 'idle' }
  | { phase: 'busy'; state: MutationState }
  | { phase: 'done'; state: MutationState; msg?: string };

export function EditorPage() {
  const tree = useEndpoint('circleTree');
  const [auth, setAuth] = useState<AuthInfo | null>(null);
  const [title, setTitle] = useState('');
  const [board, setBoard] = useState('');
  const [content, setContent] = useState('');
  const [preview, setPreview] = useState(false);
  const [files, setFiles] = useState<string[]>([]);
  const [submit, setSubmit] = useState<SubmitState>({ phase: 'idle' });
  const [synthetic, setSynthetic] = useState(false);

  useEffect(() => {
    getAuth().then(setAuth).catch(() => {});
  }, []);

  const owner = auth ? `u${auth.userId}` : GUEST_OWNER;
  const draftK = draftKey(owner, 'editor');
  const dLoaded = useRef(false);

  useEffect(() => {
    if (dLoaded.current) return;
    dLoaded.current = true;
    const saved = localStorage.getItem(draftK);
    if (saved) {
      try {
        const d = JSON.parse(saved);
        setTitle(d.title ?? '');
        setContent(d.content ?? '');
        setBoard(d.board ?? '');
      } catch { /* 损坏草稿按空处理 */ }
    }
  }, [draftK]);

  function saveDraft(t: string, b: string, c: string) {
    localStorage.setItem(draftK, JSON.stringify({ title: t, board: b, content: c }));
  }

  const boards = useMemo(() => {
    const out: { fid: string; name: string }[] = [];
    for (const g of (tree.data as any)?.list ?? []) {
      for (const c of g.circle_list ?? []) out.push({ fid: String(c.type_value), name: c.name });
    }
    return out;
  }, [tree.data]);

  const canSubmit = title.trim() && content.trim() && board;

  async function doSubmit() {
    if (!canSubmit || submit.phase === 'busy') return;
    setSubmit({ phase: 'busy', state: 'Validating' });
    const r = await runMutation({
      endpointId: 'synthetic.threadAdd',
      validate: () => {
        if (!title.trim()) throw new Error('标题不能为空');
        if (!content.trim()) throw new Error('正文不能为空');
      },
      params: { title, board, content },
      timeoutMs: 8000,
    });
    setSubmit({ phase: 'done', state: r.state, msg: r.msg });
  }

  const stateText: Record<MutationState, string> = {
    Draft: '草稿', Validating: '校验中…', Submitting: '提交中…',
    Confirmed: '已确认（合成后端）', Rejected: '已驳回',
    OutcomeUnknown: '结果未知——请勿重复提交',
  };

  return (
    <div data-test="editor" style={{ maxWidth: 720 }}>
      <div className="card">
        <label style={{ fontSize: 13, color: 'var(--text2)' }} htmlFor="ed-title">标题</label>
        <input id="ed-title" data-test="ed-title" value={title}
          onChange={(e) => { setTitle(e.target.value); saveDraft(e.target.value, board, content); }}
          style={{ width: '100%', padding: '10px 12px', borderRadius: 10,
            border: '1px solid var(--border2)', background: 'var(--surface)',
            color: 'var(--text)', marginTop: 4, boxSizing: 'border-box' }} />
      </div>
      <div className="card">
        <label style={{ fontSize: 13, color: 'var(--text2)' }} htmlFor="ed-board">板块</label>
        <div>
          <StateBlock state={tree.state === 'Data' ? 'Data' : tree.state}
            fail={tree.fail} onRetry={() => tree.refetch()} skeletonRows={1} />
        </div>
        <select id="ed-board" data-test="ed-board" value={board}
          onChange={(e) => { setBoard(e.target.value); saveDraft(title, e.target.value, content); }}
          style={{ marginTop: 6, background: 'var(--surface2)', color: 'var(--text2)',
            border: '1px solid var(--border2)', borderRadius: 8, padding: '6px 10px' }}>
          <option value="">选择板块…</option>
          {boards.map((b) => <option key={b.fid} value={b.fid}>{b.name}</option>)}
        </select>
      </div>
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <label style={{ fontSize: 13, color: 'var(--text2)' }} htmlFor="ed-content">正文</label>
          <button className="btn" data-test="ed-preview"
            onClick={() => setPreview(!preview)}>{preview ? '编辑' : '预览'}</button>
        </div>
        {preview
          ? <div className="content-html" data-test="ed-preview-view"
              dangerouslySetInnerHTML={{ __html: sanitizeContent(content) }} />
          : <textarea id="ed-content" data-test="ed-content" value={content}
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
