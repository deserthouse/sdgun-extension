// G2 帖子纵向链：主楼（threadView）+ 楼层（commentList）+ 分页 + 只看楼主 + 灯箱。
import { useEffect, useMemo, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useEndpoint } from '../../lib/queries';
import { sanitizeContent, extractImages } from '../../lib/sanitize';
import { StateBlock, StateBadge } from './StateBlock';
import { getAuth } from '../../lib/auth';
import { draftKey, loadReplyDraftText, saveReplyDraftText, useDraftOwner } from '../../lib/draft';
import { runMutation, type MutationState } from '../../lib/mutation';
import { formatTime, formatCount } from '../../lib/format';
import { Avatar } from './Avatar';
import { toast } from './toast';
import { useSession } from '../../lib/session';
import { recordHistory } from '../../lib/history';
import { internalRouteFromUrl } from '../../lib/linkmap';

/* eslint-disable @typescript-eslint/no-explicit-any */

// E70-06 重构：Radix Dialog 承担焦点陷阱/Esc/回焦/可访问名；图片点击切换
// 原始尺寸与适配模式；←/→ 翻组内图片。
// F1-2/F1-3：放大态=拖拽平移+滚轮纵向平移（长图）+双击复位；下载原图=fetch blob
// （host_permissions 域内直取）→ a[download]，失败降级新标签打开。
function Lightbox({ srcs, index, onClose }: { srcs: string[]; index: number; onClose: () => void }) {
  const [i, setI] = useState(index);
  const [zoom, setZoom] = useState(false);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const drag = useRef<{ sx: number; sy: number; ox: number; oy: number; moved: boolean } | null>(null);
  const lastMoved = useRef(false);
  useEffect(() => { setZoom(false); setPan({ x: 0, y: 0 }); }, [i]);

  function download() {
    const src = srcs[i];
    let name = `sdgun-image-${i + 1}.jpg`;
    try {
      const seg = new URL(src).pathname.split('/').filter(Boolean).pop();
      if (seg) name = seg;
    } catch { /* 保默认名 */ }
    fetch(src).then((r) => {
      if (!r.ok) throw new Error(String(r.status));
      return r.blob();
    }).then((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      toast('已开始下载', 'ok');
    }).catch(() => {
      toast('下载失败——已尝试新标签打开', 'err');
      try { window.open(src, '_blank'); } catch { /* 弹窗被拦时仅提示 */ }
    });
  }

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
            data-test="lightbox-img" draggable={false}
            onClick={() => {
              if (!lastMoved.current) { setZoom((z) => !z); setPan({ x: 0, y: 0 }); }
            }}
            onDoubleClick={() => { setZoom(false); setPan({ x: 0, y: 0 }); }}
            onWheel={(e) => { if (zoom) setPan((p) => ({ x: p.x, y: p.y - e.deltaY })); }}
            onPointerDown={(e) => {
              if (!zoom) return;
              lastMoved.current = false;
              try { (e.target as HTMLElement).setPointerCapture?.(e.pointerId); } catch { /* 已释放时忽略 */ }
              drag.current = { sx: e.clientX, sy: e.clientY, ox: pan.x, oy: pan.y, moved: false };
            }}
            onPointerMove={(e) => {
              const d = drag.current;
              if (!d) return;
              const dx = e.clientX - d.sx;
              const dy = e.clientY - d.sy;
              if (Math.abs(dx) > 4 || Math.abs(dy) > 4) d.moved = true;
              setPan({ x: d.ox + dx, y: d.oy + dy });
            }}
            onPointerUp={() => {
              lastMoved.current = drag.current?.moved ?? false;
              drag.current = null;
            }}
            style={zoom
              ? { maxWidth: 'none', maxHeight: 'none', cursor: 'grab', touchAction: 'none',
                  transform: `translate(${pan.x}px, ${pan.y}px)` }
              : { maxWidth: '94vw', maxHeight: '88vh', objectFit: 'contain', cursor: 'zoom-in' }} />
          <div style={{ color: '#fff', fontSize: 13, marginTop: 10 }}>
            {i + 1} / {srcs.length}
            <button className="btn" data-test="lightbox-prev" style={{ marginLeft: 10 }}
              onClick={() => setI((v) => Math.max(v - 1, 0))}>←</button>
            <button className="btn" data-test="lightbox-next" style={{ marginLeft: 6 }}
              onClick={() => setI((v) => Math.min(v + 1, srcs.length - 1))}>→</button>
            <button className="btn" data-test="lightbox-download" style={{ marginLeft: 6 }}
              onClick={download}>下载原图</button>
            <button className="btn" data-test="lightbox-close" style={{ marginLeft: 6 }}
              onClick={onClose}>关闭 (Esc)</button>
            <span style={{ marginLeft: 8, fontSize: 11, opacity: 0.8 }}>
              点击切换 100%/适配；放大后拖拽或滚轮平移，双击复位
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

const SEALED_TITLE = '登录后可用（真实写入由你的账号执行）';

function ApplaudButton({ pid, count, isLiked }: {
  pid: string; count: number; isLiked: boolean;
}) {
  const { session } = useSession();
  const authed = session !== 'loading' && session.auth !== null;
  const [liked, setLiked] = useState(isLiked);
  const [n, setN] = useState(count);
  const { phase, msg, run } = useMutationRun();
  // W7-1 取消赞 toggle：Confirmed 落定后再点=取消（contentCancelApplaud）
  const settledLiked = liked && (phase === 'Confirmed' || phase === 'idle' || phase === 'Draft');
  const done = settledLiked || phase === 'OutcomeUnknown';
  async function onClick() {
    if (phase === 'Submitting' || phase === 'Confirmed' || phase === 'OutcomeUnknown') return;
    if (settledLiked) {
      setLiked(false);
      setN((v) => Math.max(0, v - 1));
      const st = await run('contentCancelApplaud', { content_id: pid }, () => {
        setLiked(true);
        setN((v) => v + 1);
      });
      if (st === 'Rejected') setN((v) => Math.max(count, v));
      return;
    }
    setLiked(true); // 乐观
    setN((v) => v + 1);
    const st = await run('contentAddApplaud', { content_id: pid }, () => {
      setLiked(false); // Rejected 回滚
      setN((v) => v - 1);
    });
    if (st === 'Rejected') setN((v) => Math.max(count, v)); // 回滚后不低于初始计数
  }
  return (
    <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
      <button className="btn" data-test={`applaud-${pid}`}
        disabled={!authed || phase === 'Submitting' || phase === 'OutcomeUnknown'}
        aria-label={liked ? `已点赞（${n}），点击取消` : `点赞（${n}）`}
        title={authed ? (liked ? '点击取消点赞' : undefined) : '登录后可点赞（真实写入由你的账号执行）'}
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

export function FollowButton({ userId, name, initial }: {
  userId: string; name: string; initial?: boolean | null;
}) {
  // W7-2/R4b（BU-05）：fansAdd+fansRemove 双向 toggle（removeRelation uid+remove_his=0，
  // W7-2 勘定）；initial=userHome.relation_status 派生（null=未知态诚实标注）；
  // 本人不可关注（BU-05）；Unknown 锁定不自动重发（M6-B 口径）
  const { session } = useSession();
  const authed = session !== 'loading' && session.auth !== null;
  const myId = session === 'loading' ? '' : String(session.auth?.userId ?? '');
  const isSelf = String(userId) === myId && myId !== '';
  const { phase, msg, run } = useMutationRun();
  const [followed, setFollowed] = useState<boolean>(initial === true);
  const unknownInitial = initial === null || initial === undefined;
  const done = followed || phase === 'Confirmed' || phase === 'OutcomeUnknown';
  async function onClick() {
    if (done || phase === 'Submitting') return;
    setFollowed(true); // 乐观
    const st = await run('fansAdd', { uid: userId }, () => setFollowed(false));
    if (st === 'Rejected') setFollowed(false);
  }
  async function onUnfollow() {
    if (!followed || phase === 'Submitting' || phase === 'OutcomeUnknown') return;
    setFollowed(false); // 乐观取消
    const st = await run('fansRemove', { uid: userId, remove_his: 0 }, () => setFollowed(true));
    if (st === 'Rejected') setFollowed(true); // 回滚
  }
  if (isSelf) return null; // 本人：不渲染关注钮
  return (
    <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
      <button className="btn" data-test="follow-op"
        disabled={!authed || phase === 'Submitting' || (followed && phase === 'Confirmed') || phase === 'OutcomeUnknown'}
        title={authed ? (unknownInitial && !followed ? '关注状态未知，点击后以服务端结果为准' : undefined)
          : '登录后可关注（真实写入由你的账号执行）'}
        onClick={followed ? onUnfollow : onClick}>
        {followed && phase !== 'Submitting' ? `已关注 ${name}（点此取消）`
          : phase === 'Submitting' ? '提交中…' : `关注 ${name}`}
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

// B-3（E31-06）主楼简介折叠：>60 字默认收起（作者行层级=头像/名字/徽章/时间独立行，
// 简介不抢正文）；展开/收起显式按钮。
function AuthorBio({ des }: { des: string }) {
  const [open, setOpen] = useState(false);
  const long = des.length > 60;
  if (!long) {
    return <div className="card-sub" data-test="author-bio">{des}</div>;
  }
  return (
    <div className="card-sub" data-test="author-bio" style={{ marginTop: 4 }}>
      {open ? des : `${des.slice(0, 60)}…`}
      <button className="btn" data-test="bio-toggle" aria-expanded={open}
        style={{ marginLeft: 8, padding: '1px 8px', fontSize: 12 }}
        onClick={() => setOpen(!open)}>{open ? '收起' : '展开'}</button>
    </div>
  );
}

// G3 举报 H5 通道（Android MainActivity R2/F17 同构）：userReportView?type=14&
// type_value=base64({"contentId":pid})——外开官方页，agent 零真实举报。
function reportUrl(contentId: string): string {
  let b64 = '';
  try {
    b64 = btoa(JSON.stringify({ contentId }));
  } catch {
    return '';
  }
  return `https://mag1.sdgun.net/mag/user/v1/User/userReportView?type=14&type_value=${
    encodeURIComponent(b64)}`;
}

// G3 投票块（threadView 附带 vote 对象时渲染；VoteListItem 字段静态取证。
// 选项数据源待真帖样本——渲染端全字段缺失容忍，无 vote 对象零渲染）
function VoteBlock({ vote, tid }: { vote: any; tid: string }) {
  const opts: any[] = Array.isArray(vote?.options) ? vote.options : [];
  const { phase, msg, run } = useMutationRun();
  const [picked, setPicked] = useState<string | null>(null);
  const total = Number(vote?.num) || 0;
  if (opts.length === 0) return null;
  return (
    <div className="card" data-test="vote-block" style={{ marginTop: 12 }}>
      <div className="card-title">投票{vote.title ? `：${String(vote.title)}` : ''}
        {Number(vote.num) > 0 ? `（${total} 人参与）` : ''}</div>
      {opts.map((o: any) => {
        const oid = String(o.id ?? '');
        const n = Number(o.num) || 0;
        const pct = total > 0 ? Math.round((n / total) * 100) : 0;
        return (
          <button key={oid} className="btn" data-test={`vote-opt-${oid}`}
            style={{ display: 'flex', justifyContent: 'space-between', width: '100%',
              marginTop: 6, textAlign: 'left' }}
            disabled={phase === 'Submitting' || String(vote.isExpired) === '1'}
            onClick={async () => {
              if (picked || phase === 'Submitting') return;
              setPicked(oid);
              const st = await run('addVote', { content_id: tid, option_id: oid });
              if (st === 'Rejected') setPicked(null);
            }}>
            <span>{picked === oid ? '✓ ' : ''}{String(o.optionText ?? oid)}</span>
            <span style={{ color: 'var(--text3)' }}>{total > 0 ? `${n} · ${pct}%` : ''}</span>
          </button>
        );
      })}
      {phase === 'OutcomeUnknown' && (
        <span data-test="vote-unknown" style={{ fontSize: 12.5, color: 'var(--accent)' }}>
          {msg || '结果未知，请勿重复提交'}</span>
      )}
      {String(vote.isExpired) === '1' && (
        <div className="card-meta">投票已结束</div>
      )}
      <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 6 }}>
        真实投票以你的账号执行；选项形态待真实投票帖核对。
      </p>
    </div>
  );
}

// G7 宽屏右栏·楼层速览（≥1280 渲染；点击跳楼=复用 jumpToPid；楼层名截断）
function FloorRail({ floors, onJump }: { floors: any[]; onJump: (pid: string) => void }) {
  if (floors.length === 0) return null;
  return (
    <aside className="content-rail" data-test="floor-rail" aria-label="楼层速览">
      <div className="section-title" style={{ fontSize: 12 }}>楼层速览</div>
      {floors.slice(0, 40).map((f: any) => {
        const pid = String(f.id ?? '');
        return (
          <a key={pid} className="rail-item" data-test={`rail-${pid}`}
            onClick={(e) => { e.preventDefault(); onJump(pid); }}
            title={String(f.user_name ?? '')}>
            <span>{String(f.user_name ?? '').slice(0, 10)}</span>
            <span className="rf">{String(f.floor ?? '')}#</span>
          </a>
        );
      })}
    </aside>
  );
}

function BackTop() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const on = () => setShow(window.scrollY > 800);
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  if (!show) return null;
  return (
    <button className="btn backtop" data-test="back-top" aria-label="返回顶部"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>↑ 顶部</button>
  );
}

export function ThreadPage({ tid, pid }: { tid: string; pid?: string }) {
  const [page, setPage] = useState(1);
  const [onlyOp, setOnlyOp] = useState(false);
  // F1-1 楼层顺倒序：commentList order 参数（C01a 契约：2=正序/1=倒序，恒显式发送）
  const [order, setOrder] = useState<'1' | '2'>('2');
  const [lightbox, setLightbox] = useState<{
    srcs: string[]; index: number; trigger: HTMLElement | null;
  } | null>(null);
  const op = useEndpoint('threadView', { tid });
  const cl = useEndpoint('commentList', onlyOp
    ? { tid, p: page, step: 20, order, authorid: String((op.data as any)?.data?.user_id ?? '') }
    : { tid, p: page, step: 20, order });
  const main = (op.data as any)?.data;
  const floors = ((cl.data as any)?.list ?? []) as any[];
  // R2-5：阅读位置恢复（仅一次）+ 滚动保存
  const scrollKey = `sdg2.scroll.${tid}`;
  const scrollRestored = useRef(false);
  useEffect(() => {
    const save = () => {
      try { sessionStorage.setItem(scrollKey, String(window.scrollY)); } catch {}
    };
    window.addEventListener('scroll', save, { passive: true });
    return () => window.removeEventListener('scroll', save);
  }, [scrollKey]);
  useEffect(() => {
    if (scrollRestored.current) return;
    if (cl.state !== 'Data' && cl.state !== 'Stale') return;
    const saved = sessionStorage.getItem(scrollKey);
    if (saved && Number(saved) > 0) {
      setTimeout(() => window.scrollTo({ top: Number(saved) }), 300);
    }
    scrollRestored.current = true;
  }, [cl.state, scrollKey]);
  // G2 本地帖历史：标题就绪即记录（纯客户端，零请求）
  useEffect(() => {
    if (main?.title) recordHistory(tid, String(main.title));
  }, [main?.title, tid]);
  const totalPage = Number((cl.data as any)?.total_page ?? 1);
  const opUserId = String(main?.user_id ?? '');
  const opName = String(main?.user_name ?? '');

  // 楼层锚点（E24-06 修复）：当前页找不到 → 自动翻页继续找（有界预算）
  const [anchorSearch, setAnchorSearch] = useState<{ pid: string; pagesTried: number } | null>(
    pid ? { pid, pagesTried: 1 } : null);
  const [anchorNotFound, setAnchorNotFound] = useState(false);
  const draftOwner = useDraftOwner();
  useEffect(() => {
    if (!pid) return;
    setAnchorSearch({ pid, pagesTried: 1 });
    setAnchorNotFound(false);
    setPage(1);
  }, [pid]);
  useEffect(() => {
    if (!anchorSearch || anchorNotFound) return;
    // C5 反例修复：数据未在场不得判越界——首渲染 totalPage 默认 1 会把任何跨页
    // 深链 pid 秒判 not-found（挂载期搜索路径既有套件从未覆盖）
    if (cl.isPending || cl.isFetching) return;
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
      toast('链接已复制', 'ok');
    } catch {
      toast('复制失败', 'err');
    }
  }

  return (
    <section>
      <div className="thread-body">
      <div className="page-header">
        <p className="crumb">
          <a href={`#/board/${String(main?.fid ?? '')}`}>‹ {String(main?.forum_name ?? '板块')}</a>
        </p>
        <h1 className="page-title" data-test="thread-title">{main?.title ?? '…'}</h1>
      </div>
      <div className="chiprow" data-test="thread-tools" style={{ marginBottom: 12 }}>
        <a className="btn" data-test="reply-entry" href={`#/editor?tid=${tid}`}>回复</a>
        <button className="btn" data-test="copy-link" aria-label="复制帖子链接" onClick={copyLink}>
          复制链接
        </button>
      </div>
      <StateBlock state={op.state} fail={op.fail} onRetry={() => op.refetch()} />
      {main && (
        <div className="card" data-test="op-card">
          <div className="card-meta" style={{ marginBottom: 8, display: 'flex', gap: 10,
            alignItems: 'center', flexWrap: 'wrap' }}>
            <Avatar src={main.user_head} name={opName} size={36} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div>
                <strong style={{ color: 'var(--text)' }}>{opName}</strong>
                <span className="pin" style={{ marginLeft: 6 }}>楼主</span>
              </div>
              {(main.create_time ?? main.dateline ?? main.time) != null && (
                <div className="card-meta" data-test="op-time">
                  {/* soak 实测：threadView 时间键=create_time（unix）/create_time_ago */}
                  {formatTime(main.create_time ?? main.dateline ?? main.time)}
                </div>
              )}
            </div>
            {opUserId && <FollowButton userId={opUserId} name={opName} />}
          </div>
          {String(main.des ?? '') && <AuthorBio des={String(main.des)} />}
          {(main as any).vote && <VoteBlock vote={(main as any).vote} tid={tid} />}
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
        <button type="button" data-test="floor-order-asc" aria-pressed={order === '2'}
          className={'chip' + (order === '2' ? ' on' : '')}
          style={order === '2' ? { borderColor: 'var(--accent)', color: 'var(--accent)' } : {}}
          onClick={() => { if (order !== '2') { setOrder('2'); setPage(1); } }}>正序</button>
        <button type="button" data-test="floor-order-desc" aria-pressed={order === '1'}
          className={'chip' + (order === '1' ? ' on' : '')}
          style={order === '1' ? { borderColor: 'var(--accent)', color: 'var(--accent)' } : {}}
          onClick={() => { if (order !== '1') { setOrder('1'); setPage(1); } }}>倒序</button>
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
            <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
              <strong style={{ color: 'var(--text)' }}>{f.user_name}</strong>
              {String(f.is_publisher) === 'true' || f.is_publisher === 1 ? (
                <span className="pin" style={{ marginLeft: 6 }}>楼主</span>) : null}
              {/* F1-5 勋章/认证/用户组图标+IP 属地（字段名=2026-10-15 实采
                  supplemental_surface：medal_pic_url/cert_pic_url/group_ico_src/ip_address） */}
              {String(f.medal_pic_url ?? '') && (
                <img data-test="floor-medal" src={String(f.medal_pic_url)} alt="勋章" title="勋章"
                  referrerPolicy="no-referrer"
                  style={{ height: 14, verticalAlign: '-2px' }} />)}
              {String(f.cert_pic_url ?? '') && (
                <img data-test="floor-cert" src={String(f.cert_pic_url)} alt="认证" title="认证"
                  referrerPolicy="no-referrer"
                  style={{ height: 14, verticalAlign: '-2px' }} />)}
              {String(f.group_ico_src ?? '') && (
                <img data-test="floor-groupico" src={String(f.group_ico_src)} alt="用户组" title="用户组"
                  referrerPolicy="no-referrer"
                  style={{ height: 14, verticalAlign: '-2px' }} />)}
              {String(f.ip_address ?? '') && (
                <span data-test="floor-ip" style={{ fontSize: 11.5, color: 'var(--text3)', marginLeft: 4 }}>
                  IP属地 {String(f.ip_address)}
                </span>)}
            </span>
            <span>{formatTime(f.time)} · {f.floor}#</span>
          </div>
          {f.to_comment ? <QuoteBlock q={f.to_comment} onJump={jumpToPid} /> : null}
          <ContentView html={String(f.content ?? '')}
            onImg={(srcs, index, trigger) => setLightbox({ srcs, index, trigger })} />
          <div className="floor-head">
            <Avatar src={f.user_head} name={f.user_name} size={28} />
            <span className="floor-user">{f.user_name}</span>
          </div>
          <div className="chiprow floor-actions" style={{ marginTop: 8, marginBottom: 0 }}>
            <button className="btn" data-test={`quote-${String(f.id ?? '')}`}
              onClick={() => {
                try {
                  localStorage.setItem(`sdg2.quote.${draftOwner}.${tid}`,
                    JSON.stringify({ pid: String(f.id ?? ''), name: String(f.user_name ?? ''),
                      text: String(f.content ?? '').replace(/<[^>]+>/g, '').slice(0, 80) }));
                } catch { /* 存储异常时引用降级为空 */ }
                location.hash = `#/editor?tid=${tid}`;
              }}>引用回复</button>
            <button className="btn" data-test={`floor-link-${String(f.id ?? '')}`}
              onClick={() => {
                const url = `${location.origin}${location.pathname}#/thread/${tid}/${String(f.id ?? '')}`;
                navigator.clipboard.writeText(url).then(() => toast('楼层链接已复制', 'ok'), () => toast('复制失败', 'err'));
              }}>复制楼层链接</button>
            {/* G3 角色可见性：真实行字段（2026-10-15 实采）can_edit/can_delete/edit_url——
                有权限才渲染入口；编辑优先官方 edit_url（H5 外开），无 URL 时诚实禁用。
                举报=全员可用的官方 H5 通道（Android 同构）。 */}
            {(f.can_edit === true || f.can_edit === 1 || f.can_edit === '1') && (
              f.edit_url
                ? <a className="btn" data-test={`floor-edit-${String(f.id ?? '')}`}
                    href={String(f.edit_url)} target="_blank" rel="noreferrer">编辑</a>
                : <button className="btn" data-test={`floor-edit-${String(f.id ?? '')}`} disabled
                    title="本楼层可编辑，但服务端未提供编辑入口（modthreadkey 链待勘）">编辑</button>
            )}
            {(f.can_delete === true || f.can_delete === 1 || f.can_delete === '1') && (
              <button className="btn" data-test={`floor-del-${String(f.id ?? '')}`} disabled
                title="删除入口待勘定（端点编目缺——如实禁用，不伪造）">删除</button>
            )}
            {(() => { const ru = reportUrl(String(f.id ?? '')); return ru
              ? <a className="btn" data-test={`floor-report-${String(f.id ?? '')}`}
                  href={ru} target="_blank" rel="noreferrer">举报</a>
              : null; })()}
          </div>
          <div className="card-meta" style={{ marginTop: 8 }}>
            <ApplaudButton pid={String(f.id ?? f.floor ?? '')} count={Number(f.applaud_count) || 0}
              isLiked={f.is_applaud === true || f.is_applaud === 1 || f.is_applaud === '1'} />
          </div>
        </div>
      ))}
      <div className="chiprow" style={{ justifyContent: 'center', marginTop: 14 }}>
        <button className="btn" disabled={page <= 1} onClick={() => setPage(page - 1)}>上一页</button>
        <span style={{ color: 'var(--text3)', fontSize: 12 }}>第 {page} / {totalPage} 页</span>
        <button className="btn" disabled={page >= totalPage} onClick={() => setPage(page + 1)}>下一页</button>
      </div>
      <BackTop />
      <ReplyDraft tid={tid} owner={draftOwner} />
      </div>
      <FloorRail floors={floors} onJump={jumpToPid} />
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
    </section>
  );
}


// G4 回复草稿：owner+tid 键隔离（E70-04）；owner 实时派生（W1/E28-02——
// 身份切换即换键，后输入写新账号键，旧账号键保留原文）。
function ReplyDraft({ tid, owner }: { tid: string; owner: string | null }) {
  const [text, setText] = useState('');
  const [saved, setSaved] = useState('');
  const [restored, setRestored] = useState(false);

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
        data-owner={owner ?? ''} disabled={key === null}
        title={key === null ? '正在确认本机身份…' : undefined}
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
        {/* R5/BU-06：帖尾草稿进入同帖编辑器（共用 owner+tid 草稿键，正文不丢） */}
        <a className="btn" data-test="draft-continue" href={`#/editor?tid=${tid}`}
          title="在编辑器中继续编辑并发布（草稿共用）">继续编辑并发布 ↗</a>
      </div>
    </div>
  );
}
