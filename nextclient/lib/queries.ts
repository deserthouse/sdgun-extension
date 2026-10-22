// TanStack Query 接入（E1-5）：useEndpoint = broker + 九态。
// 契约：读取 staleTime 5min（暖缓存回访零重复请求）、retry=false（E1-2 锁定）。
import { useQuery } from '@tanstack/react-query';
import { callEndpoint, deriveState, isFail, type Fail, type NineState } from './broker';

function isEmptyData(d: unknown): boolean {
  if (d === null || d === undefined) return false;
  const lst = (d as { list?: unknown }).list;
  return Array.isArray(lst) && lst.length === 0;
}

export function useEndpoint<T>(id: string, params?: Record<string, string | number>) {
  const q = useQuery<T>({
    queryKey: [id, params ?? {}],
    queryFn: () => callEndpoint<T>(id, { params }),
    retry: false,
    staleTime: 5 * 60_000,
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
