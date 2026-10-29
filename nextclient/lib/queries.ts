// TanStack Query 接入（E1-5）：useEndpoint = broker + 九态。
// 契约：读取 staleTime 5min（暖缓存回访零重复请求）、retry=false（E1-2 锁定）。
// C3-4 ready 守卫：session 建立前（epoch/游客 UA 规则就绪前）查询不点火——
// 首开竞速（首请求裸发被 WAF 偶发拦）的根治，E24 审计缺口关闭。
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { callEndpoint, deriveState, isFail, type Fail, type NineState } from './broker';
import { useSession } from './session';

function isEmptyData(d: unknown): boolean {
  if (d === null || d === undefined) return false;
  const lst = (d as { list?: unknown }).list;
  return Array.isArray(lst) && lst.length === 0;
}

export function useEndpoint<T>(id: string, params?: Record<string, string | number>,
  opts?: { keepPrev?: boolean }) {
  const { session } = useSession();
  const ready = session !== 'loading'; // 失败也放行（session 恒落定，不悬挂）
  // W1/E28-01：私有键空间=epoch+owner——身份切换后旧键失活（迟到回填进不了新键），
  // 旧缓存随 SessionProvider 的 removeQueries 整体作废
  const ownKey = `${session === 'loading' ? '' : (session.auth ? `u${session.auth.userId}:` : 'guest:')}${session === 'loading' ? '' : session.epoch ?? ''}`;
  const q = useQuery<T>({
    queryKey: [id, params ?? {}, ownKey],
    queryFn: ({ signal }) => callEndpoint<T>(id, { params, signal }),
    enabled: ready,
    retry: false,
    staleTime: 5 * 60_000,
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
  return { ...q, state, fail };
}
