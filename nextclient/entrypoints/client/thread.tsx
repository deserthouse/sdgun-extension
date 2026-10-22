// G2 帖子纵向链：主楼（threadView）+ 楼层（commentList）+ 分页 + 只看楼主 + 灯箱。
import { useEffect, useMemo, useState } from 'react';
import { useEndpoint } from '../../lib/queries';
import { sanitizeContent, extractImages } from '../../lib/sanitize';
import { StateBlock, StateBadge } from './StateBlock';

/* eslint-disable @typescript-eslint/no-explicit-any */

function Lightbox({ srcs, index, onClose }: { srcs: string[]; index: number; onClose: () => void }) {
  const [i, setI] = useState(index);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') setI((v) => Math.min(v + 1, srcs.length - 1));
      if (e.key === 'ArrowLeft') setI((v) => Math.max(v - 1, 0));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, srcs.length]);
  return (
    <div data-test="lightbox" onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 2147483000, background: 'rgba(0,0,0,.92)',
        display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <img src={srcs[i]} alt="" referrerPolicy="no-referrer"
        style={{ maxWidth: '94vw', maxHeight: '94vh', objectFit: 'contain' }}
        onClick={(e) => e.stopPropagation()} />
      {srcs.length > 1 && (
        <div style={{ position: 'fixed', bottom: 18, color: '#fff', fontSize: 13 }}
          onClick={(e) => e.stopPropagation()}>
          {i + 1} / {srcs.length}
          <button className="btn" style={{ marginLeft: 10 }} onClick={() => setI((v) => Math.max(v - 1, 0))}>←</button>
          <button className="btn" style={{ marginLeft: 6 }} onClick={() => setI((v) => Math.min(v + 1, srcs.length - 1))}>→</button>
        </div>
      )}
      <button className="btn" data-test="lightbox-close" style={{ position: 'fixed', top: 14, right: 14 }}
        onClick={onClose}>关闭 (Esc)</button>
    </div>
  );
}

function ContentView({ html, onImg }: { html: string; onImg: (srcs: string[], i: number) => void }) {
  const clean = useMemo(() => sanitizeContent(html), [html]);
  useEffect(() => {
    const imgs = [...document.querySelectorAll<HTMLImageElement>('img[data-sdg-content]')];
    imgs.forEach((im, i) => {
      im.dataset.sdgIdx = String(i);
      im.style.maxWidth = '100%';
      im.style.cursor = 'zoom-in';
    });
    const handler = (e: Event) => {
      const t = e.target as HTMLElement;
      if (t.tagName !== 'IMG') return;
      const all = extractImages(clean);
      const i = Number(t.dataset.sdgIdx ?? 0);
      if (all.length) onImg(all, i);
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [clean, onImg]);
  return <div data-sdg-content="1" className="content-html" dangerouslySetInnerHTML={{ __html: clean }} />;
}

export function ThreadPage({ tid }: { tid: string }) {
  const [page, setPage] = useState(1);
  const [onlyOp, setOnlyOp] = useState(false);
  const [lightbox, setLightbox] = useState<{ srcs: string[]; index: number } | null>(null);
  const op = useEndpoint('threadView', { tid });
  const cl = useEndpoint('commentList', onlyOp
    ? { tid, p: page, step: 20, authorid: String((op.data as any)?.data?.user_id ?? '') }
    : { tid, p: page, step: 20 });
  const main = (op.data as any)?.data;
  const floors = ((cl.data as any)?.list ?? []) as any[];
  const totalPage = Number((cl.data as any)?.total_page ?? 1);
  const opUserId = String(main?.user_id ?? '');
  const opName = String(main?.user_name ?? '');

  return (
    <section>
      <p style={{ margin: '0 0 10px', fontSize: 13 }}>
        <a href={`#/board/${String(main?.fid ?? '')}`} style={{ color: 'var(--accent)' }}>
          ‹ {String(main?.forum_name ?? '板块')}
        </a>
      </p>
      <h1 style={{ fontSize: 22, margin: '0 0 10px' }} data-test="thread-title">
        {main?.title ?? '…'}
      </h1>
      <StateBlock state={op.state} fail={op.fail} onRetry={() => op.refetch()} />
      {main && (
        <div className="card" data-test="op-card">
          <div className="card-meta" style={{ marginBottom: 8 }}>
            <strong style={{ color: 'var(--text)' }}>{opName}</strong> · 楼主 · {main.des || ''}
          </div>
          <ContentView html={String(main.content ?? '')}
            onImg={(srcs, index) => setLightbox({ srcs, index })} />
        </div>
      )}

      <div className="chiprow" style={{ alignItems: 'center', marginTop: 14 }}>
        <label style={{ fontSize: 13, color: 'var(--text2)', display: 'flex', gap: 6, cursor: 'pointer' }}>
          <input data-test="only-op" type="checkbox" checked={onlyOp}
            onChange={(e) => { setOnlyOp(e.target.checked); setPage(1); }} />
          只看楼主
        </label>
        <span style={{ fontSize: 12, color: 'var(--text3)' }}>
          共 {String((cl.data as any)?.count ?? '?')} 条 <StateBadge state={cl.state} />
        </span>
      </div>
      <StateBlock state={cl.state} fail={cl.fail} onRetry={() => cl.refetch()} />
      {floors.map((f: any) => (
        <div key={String(f.id ?? f.floor)} className="card floor" data-test="floor">
          <div className="card-meta" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>
              <strong style={{ color: 'var(--text)' }}>{f.user_name}</strong>
              {String(f.is_publisher) === 'true' || f.is_publisher === 1 ? (
                <span className="pin" style={{ marginLeft: 6 }}>楼主</span>) : null}
            </span>
            <span>{f.time} · {f.floor}#</span>
          </div>
          <ContentView html={String(f.content ?? '')}
            onImg={(srcs, index) => setLightbox({ srcs, index })} />
          {Number(f.applaud_count) > 0 && (
            <div className="card-meta">👍 {f.applaud_count}</div>
          )}
        </div>
      ))}
      <div className="chiprow" style={{ justifyContent: 'center', marginTop: 14 }}>
        <button className="btn" disabled={page <= 1} onClick={() => setPage(page - 1)}>上一页</button>
        <span style={{ color: 'var(--text3)', fontSize: 12 }}>第 {page} / {totalPage} 页</span>
        <button className="btn" disabled={page >= totalPage} onClick={() => setPage(page + 1)}>下一页</button>
      </div>
      <ReplyDraft tid={tid} />
      {lightbox && (
        <Lightbox srcs={lightbox.srcs} index={lightbox.index} onClose={() => setLightbox(null)} />
      )}
    </section>
  );
}


// G4 回复草稿：本地持久化（localStorage，按 tid）；真实发布写面封存——
// 提交按钮展示诚实状态（Draft 已保存/未开放），绝不伪造成功。
function ReplyDraft({ tid }: { tid: string }) {
  const key = `sdg2.draft.${tid}`;
  const [text, setText] = useState('');
  const [saved, setSaved] = useState('');
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    const v = localStorage.getItem(key) ?? '';
    if (v) { setText(v); setRestored(true); }
  }, [key]);

  return (
    <div className="card" data-test="reply-draft" style={{ marginTop: 18 }}>
      <div className="card-title" style={{ marginBottom: 8 }}>回复草稿（本机保存）</div>
      <textarea data-test="draft-input" value={text}
        onChange={(e) => { setText(e.target.value); localStorage.setItem(key, e.target.value); setSaved('已保存'); }}
        placeholder="撰写回复草稿（自动保存在本机）…"
        style={{ width: '100%', minHeight: 90, borderRadius: 10, border: '1px solid var(--border2)',
          background: 'var(--surface)', color: 'var(--text)', padding: 10, fontSize: 14,
          boxSizing: 'border-box', resize: 'vertical' }} />
      <div className="chiprow" style={{ marginTop: 10, alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: 'var(--text3)' }}>
          {restored ? '已恢复上次草稿 · ' : ''}{text.length} 字 {saved}
        </span>
        <button className="btn" data-test="draft-clear"
          onClick={() => { localStorage.removeItem(key); setText(''); setRestored(false); setSaved(''); }}>
          清空草稿
        </button>
        <button className="btn" data-test="draft-submit" disabled
          title="真实发布写面封存：发布/回复属用户红线动作，真实写入由用户本人操作"
          onClick={() => { /* 诚实禁用：不伪造提交 */ }}>
          发布（未开放）
        </button>
      </div>
    </div>
  );
}
