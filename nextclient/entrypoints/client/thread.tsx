// G2 帖子纵向链：主楼（threadView）+ 楼层（commentList）+ 分页 + 只看楼主 + 灯箱。
import { useEffect, useMemo, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useEndpoint } from '../../lib/queries';
import { sanitizeContent, extractImages } from '../../lib/sanitize';
import { StateBlock, StateBadge } from './StateBlock';
import { getAuth } from '../../lib/auth';
import { draftKey, GUEST_OWNER } from '../../lib/draft';

/* eslint-disable @typescript-eslint/no-explicit-any */

// E70-06 重构：Radix Dialog 承担焦点陷阱/Esc/回焦/可访问名；图片点击切换
// 原始尺寸与适配模式；←/→ 翻组内图片。
function Lightbox({ srcs, index, onClose }: { srcs: string[]; index: number; onClose: () => void }) {
  const [i, setI] = useState(index);
  const [zoom, setZoom] = useState(false);
  useEffect(() => { setZoom(false); }, [i]);
  return (
    <Dialog.Root open onOpenChange={(o) => { if (!o) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.92)', zIndex: 2147483000 }} />
        <Dialog.Content aria-label={`图片 ${i + 1} / ${srcs.length}`} data-test="lightbox"
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight') setI((v) => Math.min(v + 1, srcs.length - 1));
            if (e.key === 'ArrowLeft') setI((v) => Math.max(v - 1, 0));
          }}
          style={{ position: 'fixed', inset: 0, zIndex: 2147483001, background: 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
          <Dialog.Title style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden',
            clip: 'rect(0 0 0 0)' }}>
            图片 {i + 1} / {srcs.length}
          </Dialog.Title>
          <img src={srcs[i]} alt={`图片 ${i + 1} / ${srcs.length}`} referrerPolicy="no-referrer"
            onClick={() => setZoom((z) => !z)}
            style={zoom
              ? { maxWidth: 'none', maxHeight: 'none', cursor: 'zoom-out',
                  transform: 'translate(0,0)' }
              : { maxWidth: '94vw', maxHeight: '88vh', objectFit: 'contain', cursor: 'zoom-in' }} />
          <div style={{ color: '#fff', fontSize: 13, marginTop: 10 }}>
            {i + 1} / {srcs.length}
            <button className="btn" data-test="lightbox-prev" style={{ marginLeft: 10 }}
              onClick={() => setI((v) => Math.max(v - 1, 0))}>←</button>
            <button className="btn" data-test="lightbox-next" style={{ marginLeft: 6 }}
              onClick={() => setI((v) => Math.min(v + 1, srcs.length - 1))}>→</button>
            <button className="btn" data-test="lightbox-close" style={{ marginLeft: 6 }}
              onClick={onClose}>关闭 (Esc)</button>
            <span style={{ marginLeft: 8, fontSize: 11, opacity: 0.8 }}>
              点击图片切换 100%/适配
            </span>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// E70-06 重构：事件委托绑定在容器 ref 上（不再 document 级）；
// 图片组=本容器清洗后的稳定序列，索引=容器内序号（此前属性挂在 div 上、
// img 查询落空 → 任意图触发多回调且索引恒 0）。
function ContentView({ html, onImg }: { html: string; onImg: (srcs: string[], i: number) => void }) {
  const clean = useMemo(() => sanitizeContent(html), [html]);
  const ref = useRef<HTMLDivElement | null>(null);
  const gallery = useMemo(() => extractImages(clean), [clean]);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.querySelectorAll('img').forEach((im) => {
      im.style.maxWidth = '100%';
      im.style.cursor = 'zoom-in';
    });
    const handler = (e: Event) => {
      const t = e.target as HTMLElement;
      if (t.tagName !== 'IMG' || !gallery.length) return;
      const kids = [...el.querySelectorAll('img')];
      const i = kids.indexOf(t as HTMLImageElement);
      if (i < 0) return;
      const srcs = kids.map((im) => im.getAttribute('src') || '').filter(Boolean);
      const idx = kids.indexOf(t as HTMLImageElement);
      onImg(srcs.length ? srcs : gallery, idx);
    };
    el.addEventListener('click', handler);
    return () => el.removeEventListener('click', handler);
  }, [clean, gallery, onImg]);
  return <div ref={ref} className="content-html" dangerouslySetInnerHTML={{ __html: clean }} />;
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


// G4 回复草稿：owner+tid 键隔离（E70-04 修复）；真实发布写面封存——诚实禁用。
function ReplyDraft({ tid }: { tid: string }) {
  const [owner, setOwner] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [saved, setSaved] = useState('');
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    getAuth().then((a) => setOwner(a ? `u${a.userId}` : GUEST_OWNER)).catch(() => setOwner(GUEST_OWNER));
  }, []);

  const key = owner ? draftKey(owner, tid) : null;

  useEffect(() => {
    if (!key) return;
    // 键切换无条件恢复（含清空）——E70-04：只在新值非空时 setText 会跨帖串留
    const v = localStorage.getItem(key) ?? '';
    setText(v);
    setRestored(v.length > 0);
    setSaved('');
  }, [key]);

  return (
    <div className="card" data-test="reply-draft" style={{ marginTop: 18 }}>
      <div className="card-title" style={{ marginBottom: 8 }}>回复草稿（本机保存）</div>
      <textarea data-test="draft-input" value={text}
        onChange={(e) => { setText(e.target.value); if (key) localStorage.setItem(key, e.target.value); setSaved('已保存'); }}
        placeholder="撰写回复草稿（自动保存在本机）…"
        style={{ width: '100%', minHeight: 90, borderRadius: 10, border: '1px solid var(--border2)',
          background: 'var(--surface)', color: 'var(--text)', padding: 10, fontSize: 14,
          boxSizing: 'border-box', resize: 'vertical' }} />
      <div className="chiprow" style={{ marginTop: 10, alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: 'var(--text3)' }}>
          {restored ? '已恢复上次草稿 · ' : ''}{text.length} 字 {saved}
        </span>
        <button className="btn" data-test="draft-clear"
          onClick={() => { if (key) localStorage.removeItem(key); setText(''); setRestored(false); setSaved(''); }}>
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
