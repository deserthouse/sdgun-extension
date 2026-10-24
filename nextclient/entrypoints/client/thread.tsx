// G2 帖子纵向链：主楼（threadView）+ 楼层（commentList）+ 分页 + 只看楼主 + 灯箱。
import { useEffect, useMemo, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useEndpoint } from '../../lib/queries';
import { sanitizeContent, extractImages } from '../../lib/sanitize';
import { StateBlock, StateBadge } from './StateBlock';
import { getAuth } from '../../lib/auth';
import { draftKey, loadReplyDraftText, saveReplyDraftText, GUEST_OWNER } from '../../lib/draft';
import { runMutation, type MutationState } from '../../lib/mutation';

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
function ContentView({ html, onImg }: {
  html: string;
  onImg: (srcs: string[], i: number, trigger: HTMLElement) => void;
}) {
  const clean = useMemo(() => sanitizeContent(html), [html]);
  const ref = useRef<HTMLDivElement | null>(null);
  const gallery = useMemo(() => extractImages(clean), [clean]);
  // E24-05 修复：统一候选图模型——只收有效 src 的 img，过滤和索引来自同一集合
  const effect = useMemo(() => { return undefined; }, []);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // 只取有有效 src 的 img，构建稳定候选数组
    const candidates: HTMLImageElement[] = [...el.querySelectorAll('img')]
      .filter((im) => (im.getAttribute('src') || '').startsWith('http'));
    candidates.forEach((im) => {
      im.style.maxWidth = '100%';
      im.style.cursor = 'zoom-in';
    });
    const handler = (e: Event) => {
      const t = e.target as HTMLElement;
      if (t.tagName !== 'IMG') return;
      const idx = candidates.indexOf(t as HTMLImageElement);
      if (idx < 0) return; // 非候选图（表情等）不触发灯箱
      const srcs = candidates.map((im) => im.getAttribute('src') || '');
      onImg(srcs, idx, t as HTMLElement); // 索引和数组来自同一集合——不会错位
    };
    el.addEventListener('click', handler);
    return () => el.removeEventListener('click', handler);
  }, [clean, gallery, onImg]);
  return <div ref={ref} className="content-html" dangerouslySetInnerHTML={{ __html: clean }} />;
}

// C1-2 引用块：to_comment 真实形态（tests/probe_out/to_comment_sample_2026-10-25.json）。
// content 同楼层正文一样过 DOMPurify；点击跳被引楼层（同页滚动/跨页走 anchorSearch）。
function QuoteBlock({ q, onJump }: { q: any; onJump: (pid: string) => void }) {
  const clean = useMemo(() => sanitizeContent(String(q.content ?? '')), [q.content]);
  return (
    <blockquote className="quote-block" data-test="quote-block"
      onClick={() => { const pid = String(q.id ?? ''); if (pid) onJump(pid); }}
      title={q.id ? '点击跳转被引用楼层' : undefined}>
      <div className="quote-meta">
        {String(q.user_name ?? '')}{q.floor ? ` · ${String(q.floor)}#` : ''}
        {q.time ? ` · ${String(q.time)}` : ''}
      </div>
      <div className="content-html quote-content" dangerouslySetInnerHTML={{ __html: clean }} />
    </blockquote>
  );
}

// C2-1/C2-2 互动按钮状态机（点赞/关注）：写面封存——产品构建禁用（title 诚实标注）；
// 测试经 __floors.enableSyntheticMutations() 缝启用，走 runMutation 合成端点：
// 乐观 +1 → Confirmed 落定 / Rejected 回滚 / OutcomeUnknown 保留+1 且禁点
// （结果未知不自动重发，防双写——总设计 §4 与 M6-B 同口径）。
function useMutationRun() {
  const [phase, setPhase] = useState<MutationState | 'idle'>('idle');
  const [msg, setMsg] = useState('');
  async function run(endpoint: string, params: Record<string, string | number>,
    onRejected?: (m: string) => void): Promise<MutationState> {
    setPhase('Submitting');
    setMsg('');
    const r = await runMutation({ endpointId: endpoint, params, timeoutMs: 8000 });
    setPhase(r.state);
    if (r.state === 'Rejected') {
      setMsg(r.msg ?? '已驳回');
      onRejected?.(r.msg ?? '已驳回');
    } else if (r.state === 'OutcomeUnknown') {
      setMsg(r.msg ?? '结果未知');
    }
    return r.state;
  }
  return { phase, msg, run, setPhase, setMsg };
}

const SEALED_TITLE = '写面封存：真实写入属用户红线动作，由用户本人操作（测试经合成后端启用）';

function ApplaudButton({ pid, count, isLiked, synthetic }: {
  pid: string; count: number; isLiked: boolean; synthetic: boolean;
}) {
  const [liked, setLiked] = useState(isLiked);
  const [n, setN] = useState(count);
  const { phase, msg, run } = useMutationRun();
  const done = liked || phase === 'Confirmed' || phase === 'OutcomeUnknown';
  async function onClick() {
    if (liked || phase === 'Submitting' || phase === 'Confirmed' || phase === 'OutcomeUnknown') return;
    setLiked(true); // 乐观
    setN((v) => v + 1);
    const st = await run('synthetic.applaudAdd', { id: pid }, () => {
      setLiked(false); // Rejected 回滚
      setN((v) => v - 1);
    });
    if (st === 'Rejected') setN((v) => Math.max(count, v)); // 回滚后不低于初始计数
  }
  return (
    <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
      <button className="btn" data-test={`applaud-${pid}`} disabled={!synthetic || done || phase === 'Submitting'}
        aria-label={liked || phase === 'Confirmed' ? `已点赞（${n}）` : `点赞（${n}）`}
        title={synthetic ? undefined : SEALED_TITLE}
        onClick={onClick}>
        👍 {n}{liked && phase !== 'Submitting' ? ' · 已赞' : phase === 'Submitting' ? ' · 提交中…' : ''}
      </button>
      {phase === 'OutcomeUnknown' && (
        <span style={{ fontSize: 11.5, color: 'var(--accent)' }} data-test={`applaud-unknown-${pid}`}>
          {msg || '结果未知——请勿重复提交'}
        </span>
      )}
      {phase === 'Rejected' && (
        <span style={{ fontSize: 11.5, color: 'var(--text3)' }} data-test={`applaud-rejected-${pid}`}>
          {msg}
        </span>
      )}
    </span>
  );
}

function FollowButton({ userId, name, synthetic }: {
  userId: string; name: string; synthetic: boolean;
}) {
  const { phase, msg, run } = useMutationRun();
  const [followed, setFollowed] = useState(false);
  const done = followed || phase === 'Confirmed' || phase === 'OutcomeUnknown';
  async function onClick() {
    if (done || phase === 'Submitting') return;
    setFollowed(true); // 乐观
    const st = await run('synthetic.userFollowAdd', { id: userId }, () => setFollowed(false));
    if (st === 'Rejected') return;
  }
  return (
    <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
      <button className="btn" data-test="follow-op" disabled={!synthetic || done || phase === 'Submitting'}
        title={synthetic ? undefined : SEALED_TITLE}
        onClick={onClick}>
        {followed && phase !== 'Submitting' ? `已关注 ${name}` : phase === 'Submitting' ? '提交中…' : `关注 ${name}`}
      </button>
      {phase === 'OutcomeUnknown' && (
        <span style={{ fontSize: 11.5, color: 'var(--accent)' }} data-test="follow-unknown">
          {msg || '结果未知——请勿重复提交'}
        </span>
      )}
      {phase === 'Rejected' && (
        <span style={{ fontSize: 11.5, color: 'var(--text3)' }} data-test="follow-rejected">{msg}</span>
      )}
    </span>
  );
}

export function ThreadPage({ tid, pid }: { tid: string; pid?: string }) {
  const [page, setPage] = useState(1);
  const [onlyOp, setOnlyOp] = useState(false);
  const [lightbox, setLightbox] = useState<{
    srcs: string[]; index: number; trigger: HTMLElement | null;
  } | null>(null);
  const [copied, setCopied] = useState('');
  const op = useEndpoint('threadView', { tid });
  const cl = useEndpoint('commentList', onlyOp
    ? { tid, p: page, step: 20, authorid: String((op.data as any)?.data?.user_id ?? '') }
    : { tid, p: page, step: 20 });
  const main = (op.data as any)?.data;
  const floors = ((cl.data as any)?.list ?? []) as any[];
  const totalPage = Number((cl.data as any)?.total_page ?? 1);
  const opUserId = String(main?.user_id ?? '');
  const opName = String(main?.user_name ?? '');

  // 楼层锚点（E24-06 修复）：当前页找不到 → 自动翻页继续找（有界预算）
  const [anchorSearch, setAnchorSearch] = useState<{ pid: string; pagesTried: number } | null>(
    pid ? { pid, pagesTried: 1 } : null);
  const [anchorNotFound, setAnchorNotFound] = useState(false);
  const [synthetic, setSynthetic] = useState(false); // C2：合成互动缝（产品构建恒关）
  useEffect(() => {
    if (!pid) return;
    setAnchorSearch({ pid, pagesTried: 1 });
    setAnchorNotFound(false);
    setPage(1);
  }, [pid]);
  useEffect(() => {
    if (!anchorSearch || anchorNotFound) return;
    const found = floors.some((f: any) => String(f.id) === anchorSearch.pid);
    if (found) {
      setTimeout(() => {
        document.querySelector(`[data-pid="${anchorSearch.pid}"]`)
          ?.scrollIntoView({ block: 'start' });
      }, 200);
      setAnchorSearch(null);
      return;
    }
    if (anchorSearch.pagesTried >= totalPage) {
      setAnchorNotFound(true);
      setAnchorSearch(null);
      return;
    }
    // 有下一页 → 自动翻页继续找
    setPage((p) => p + 1);
    setAnchorSearch((s) => s ? { ...s, pagesTried: s.pagesTried + 1 } : null);
  }, [floors, anchorSearch, anchorNotFound, totalPage]);

  // C1-2 引用跳转：同页直接滚；跨页复用 anchorSearch 自动翻页搜索（E24-06 机制）
  function jumpToPid(jpid: string) {
    const el = document.querySelector(`[data-pid="${jpid}"]`);
    if (el) {
      el.scrollIntoView({ block: 'start' });
      return;
    }
    setAnchorNotFound(false);
    setAnchorSearch({ pid: jpid, pagesTried: 1 });
  }

  // C1-3 复制链接：首选 H5 分享页（PC 免扩展可开，AF-07 先例）；
  // fid 未加载（threadView 未回）时回退 bbs 触屏版 URL（单 tid 服务端自解析板块）。
  async function copyLink() {
    const fid = String(main?.fid ?? '');
    const url = fid
      ? `https://app.sdgun.com.cn/mag/circle/v1/forum/threadWapPage?tid=${tid}&circle_id=${fid}`
      : `https://bbs.sdgun.com.cn/forum.php?mod=viewthread&tid=${tid}&mobile=2`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied('已复制');
    } catch {
      setCopied('复制失败');
    }
    setTimeout(() => setCopied(''), 2000);
  }

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
      <div className="chiprow" data-test="thread-tools" style={{ marginBottom: 12 }}>
        <a className="btn" data-test="reply-entry" href={`#/editor?tid=${tid}`}>回复</a>
        <button className="btn" data-test="copy-link" aria-label="复制帖子链接" onClick={copyLink}>
          复制链接
        </button>
        {copied && (
          <span data-test="copy-feedback" style={{ fontSize: 12, color: 'var(--text3)' }}>
            {copied}
          </span>
        )}
      </div>
      <StateBlock state={op.state} fail={op.fail} onRetry={() => op.refetch()} />
      {main && (
        <div className="card" data-test="op-card">
          <div className="card-meta" style={{ marginBottom: 8, display: 'flex', gap: 10,
            alignItems: 'center', flexWrap: 'wrap' }}>
            <span>
              <strong style={{ color: 'var(--text)' }}>{opName}</strong> · 楼主 · {main.des || ''}
            </span>
            {opUserId && <FollowButton userId={opUserId} name={opName} synthetic={synthetic} />}
          </div>
          <ContentView html={String(main.content ?? '')}
            onImg={(srcs, index, trigger) => setLightbox({ srcs, index, trigger })} />
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
      {anchorNotFound && (
        <div className="state-card" data-test="anchor-not-found">楼层未找到（可能已删除或跨页超出范围）</div>
      )}
      <StateBlock state={cl.state} fail={cl.fail} onRetry={() => cl.refetch()} />
      {floors.map((f: any) => (
        <div key={String(f.id ?? f.floor)} className="card floor" data-test="floor"
          data-pid={String(f.id ?? '')}>
          <div className="card-meta" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>
              <strong style={{ color: 'var(--text)' }}>{f.user_name}</strong>
              {String(f.is_publisher) === 'true' || f.is_publisher === 1 ? (
                <span className="pin" style={{ marginLeft: 6 }}>楼主</span>) : null}
            </span>
            <span>{f.time} · {f.floor}#</span>
          </div>
          {f.to_comment ? <QuoteBlock q={f.to_comment} onJump={jumpToPid} /> : null}
          <ContentView html={String(f.content ?? '')}
            onImg={(srcs, index, trigger) => setLightbox({ srcs, index, trigger })} />
          <div className="card-meta" style={{ marginTop: 8 }}>
            <ApplaudButton pid={String(f.id ?? f.floor ?? '')} count={Number(f.applaud_count) || 0}
              isLiked={f.is_applaud === true || f.is_applaud === 1 || f.is_applaud === '1'}
              synthetic={synthetic} />
          </div>
        </div>
      ))}
      <div className="chiprow" style={{ justifyContent: 'center', marginTop: 14 }}>
        <button className="btn" disabled={page <= 1} onClick={() => setPage(page - 1)}>上一页</button>
        <span style={{ color: 'var(--text3)', fontSize: 12 }}>第 {page} / {totalPage} 页</span>
        <button className="btn" disabled={page >= totalPage} onClick={() => setPage(page + 1)}>下一页</button>
      </div>
      <ReplyDraft tid={tid} />
      {lightbox && (
        <Lightbox srcs={lightbox.srcs} index={lightbox.index}
          onClose={() => {
            // 程序化 open 无 Radix Trigger——Radix 卸载时会把焦点挪回打开时元素（body），
            // 回焦必须在卸载后异步执行（C3-2）
            const t = lightbox.trigger;
            setLightbox(null);
            setTimeout(() => {
              // <img> 无 tabindex 不是可聚焦区域，focus() 会静默无效——
              // 临时 tabIndex=-1 使其程序化可聚焦（键盘用户回到上下文，C3-2）
              if (t) {
                t.tabIndex = -1;
                t.focus();
              }
            }, 0);
          }} />
      )}
      {/* 测试缝：合成互动启用（驱动经 __floors.enableSyntheticMutations()） */}
      <button style={{ display: 'none' }} data-test="floors-enable-synthetic"
        onClick={() => setSynthetic(true)} />
      {(() => {
        (window as { __floors?: unknown }).__floors = {
          enableSyntheticMutations: () => { setSynthetic(true); },
        };
        return null;
      })()}
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
    const v = loadReplyDraftText(key);
    setText(v);
    setRestored(v.length > 0);
    setSaved('');
  }, [key]);

  return (
    <div className="card" data-test="reply-draft" style={{ marginTop: 18 }}>
      <div className="card-title" style={{ marginBottom: 8 }}>回复草稿（本机保存）</div>
      <textarea data-test="draft-input" aria-label="回复草稿输入框" value={text}
        onChange={(e) => { setText(e.target.value); if (key) { saveReplyDraftText(key, e.target.value); } setSaved('已保存'); }}
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
