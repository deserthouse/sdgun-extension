// TanStack Query 接入（E1-5）：useEndpoint = broker + 九态。
// 契约：读取 staleTime 5min（暖缓存回访零重复请求）、retry=false（E1-2 锁定）。
// C3-4 ready 守卫：session 建立前（epoch/游客 UA 规则就绪前）查询不点火——
// 首开竞速（首请求裸发被 WAF 偶发拦）的根治，E24 审计缺口关闭。
import { useEffect } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { callEndpoint, deriveState, isFail, type Fail, type NineState } from './broker';
import { useSession } from './session';

function isEmptyData(d: unknown): boolean {
  if (d === null || d === undefined) return false;
  const lst = (d as { list?: unknown }).list;
  return Array.isArray(lst) && lst.length === 0;
}

export function useEndpoint<T>(id: string, params?: Record<string, string | number>,
  opts?: { keepPrev?: boolean; enabled?: boolean; refetchMs?: number }) {
  const { session } = useSession();
  const ready = session !== 'loading' && opts?.enabled !== false; // enabled=false 阻止点火
  // W1/E28-01：私有键空间=epoch+owner——身份切换后旧键失活（迟到回填进不了新键），
  // 旧缓存随 SessionProvider 的 removeQueries 整体作废
  const ownKey = `${session === 'loading' ? '' : (session.auth ? `u${session.auth.userId}:` : 'guest:')}${session === 'loading' ? '' : session.epoch ?? ''}`;
  const q = useQuery<T>({
    queryKey: [id, params ?? {}, ownKey],
    queryFn: ({ signal }) => callEndpoint<T>(id, { params, signal }),
    enabled: ready,
    retry: false,
    staleTime: 5 * 60_000,
    // G1b：可选轮询（未读徽标 60s）——staleTime 之上的显式刷新通道
    ...(opts?.refetchMs ? { refetchInterval: opts.refetchMs } : {}),
    // W2/T3-1：分页类公共读保留上一页数据（翻页不闪骨架）。
    // 私有/身份敏感查询禁用——身份切换时上一身份内容不得残留（E28-01 口径）。
    ...(opts?.keepPrev ? { placeholderData: keepPreviousData } : {}),
  });
  const state: NineState = deriveState({
    isPending: q.isPending,
    isFetching: q.isFetching,
    isStale: q.isStale,
    data: q.data,
    isEmpty: isEmptyData(q.data),
    error: q.error,
  });
  const fail: Fail | null = isFail(q.error) ? q.error : null;
  // F3-1 1001 重登引导：登录态查询被服务端以 code 1001 拒绝（token 失效）→
  // 全局事件（App 挂重登横幅）。游客态的 AuthRequired=「需登录」不属过期，不触发。
  // 不自动清 session（诚实：token 可能仍被部分端点接受，是否重登由用户决定）。
  useEffect(() => {
    if (fail?.kind === 'AuthRequired' && session !== 'loading' && session.auth !== null) {
      try { window.dispatchEvent(new CustomEvent('sdg2:auth-expired')); } catch { /* 非页面环境 */ }
    }
  }, [fail?.kind, fail?.code, session]);
  return { ...q, state, fail };
}
