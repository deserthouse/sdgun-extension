// API broker（E1-4）：contracts/ 登记表驱动的受控调用面。
// 纪律（总设计 §4）：按 endpointId 调用、不接受页面传任意 URL；GET 也过 schema；
// 超时 20s 全程（AbortController）；全局普通读取并发先限 3；错误归类九态失败面。
// 认证头不由本模块携带——E1-4 起由 SW 的 DNR session 规则按登记 host+path 注入（E00-1 口径）。
import { ENDPOINTS } from '../../contracts/api/endpoints';

export type FailKind =
  | 'RetryableError' | 'AuthRequired' | 'PermissionDenied' | 'Unsupported' | 'NetworkError';

export interface Fail {
  kind: FailKind;
  msg: string;
  code?: number;
}

export function isFail(e: unknown): e is Fail {
  return typeof e === 'object' && e !== null && 'kind' in e && 'msg' in e;
}

// 全局并发闸：普通读取先限 3（缺口：认证/变更通道另计，不占普通读取额度）
let active = 0;
const waiters: (() => void)[] = [];

async function withSlot<T>(fn: () => Promise<T>): Promise<T> {
  if (active >= 3) {
    await new Promise<void>((resolve) => waiters.push(resolve));
  }
  active += 1;
  try {
    return await fn();
  } finally {
    active -= 1;
    waiters.shift()?.();
  }
}

export interface CallOpts {
  params?: Record<string, string | number>;
  timeoutMs?: number;
}

// 测试缝：host 覆盖（离线夹具服务器）。产品代码绝不调用 setter。
let hostOverride: string | null = null;

export function setHostOverride(h: string | null): void {
  hostOverride = h;
}

export async function callEndpoint<T = unknown>(id: string, opts: CallOpts = {}): Promise<T> {
  const def = ENDPOINTS[id];
  if (!def) {
    throw { kind: 'Unsupported', msg: `unregistered endpoint: ${id}` } as Fail;
  }
  const url = new URL((hostOverride ?? 'https://' + def.host) + def.path);
  for (const [k, v] of Object.entries(opts.params ?? {})) {
    url.searchParams.set(k, String(v));
  }
  return withSlot(async () => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 20000);
    try {
      const resp = await fetch(url.toString(), {
        method: def.method,
        signal: ctrl.signal,
        headers: def.method === 'POST'
          ? { 'Content-Type': 'application/x-www-form-urlencoded' }
          : undefined,
      });
      if (!resp.ok) {
        throw { kind: 'RetryableError', msg: `HTTP ${resp.status}`, code: resp.status } as Fail;
      }
      const body: unknown = await resp.json().catch(() => null);
      if (body && typeof body === 'object' && 'code' in (body as Record<string, unknown>)) {
        const code = (body as { code: unknown }).code;
        if (code === 1001) {
          throw { kind: 'AuthRequired', msg: '请先登录', code: 1001 } as Fail;
        }
        if (code === 1003) {
          throw { kind: 'PermissionDenied', msg: '无权限', code: 1003 } as Fail;
        }
      }
      const parsed = def.response.safeParse(body);
      if (!parsed.success) {
        throw { kind: 'RetryableError', msg: 'schema mismatch: ' +
          parsed.error.issues[0]?.path.join('.') } as Fail;
      }
      return parsed.data as T;
    } catch (e) {
      if (isFail(e)) throw e;
      if (e instanceof DOMException && e.name === 'AbortError') {
        throw { kind: 'NetworkError', msg: 'timeout' } as Fail;
      }
      throw { kind: 'NetworkError', msg: String((e as Error)?.message ?? e).slice(0, 120) } as Fail;
    } finally {
      clearTimeout(timer);
    }
  });
}

// ---- 九态推导（纯函数；TanStack Query 状态 → 九态）----
export type NineState =
  | 'InitialLoading' | 'Data' | 'Empty' | 'Refreshing' | 'Stale'
  | 'RetryableError' | 'AuthRequired' | 'PermissionDenied' | 'Unsupported';

export interface QueryShape<T> {
  isPending: boolean;
  isFetching: boolean;
  isStale: boolean;
  data: T | undefined;
  isEmpty?: boolean; // 调用方按业务判空（list 长度）
  error: unknown;
}

export function deriveState<T>(q: QueryShape<T>): NineState {
  if (q.error !== null && q.error !== undefined) {
    return isFail(q.error) && (q.error.kind === 'AuthRequired'
      || q.error.kind === 'PermissionDenied' || q.error.kind === 'Unsupported')
      ? q.error.kind
      : 'RetryableError';
  }
  if (q.isPending) return 'InitialLoading';
  if (q.isEmpty) return 'Empty';
  if (q.isFetching) return 'Refreshing';
  if (q.isStale) return 'Stale';
  return 'Data';
}

// 测试缝（rsalab 先例）：离线驱动经 window.__broker 直调
declare global {
  interface Window {
    __broker?: {
      call: typeof callEndpoint;
      deriveState: typeof deriveState;
      setHost: (h: string | null) => void;
    };
  }
}

export function exposeTestSeam(): void {
  if (typeof window !== 'undefined') {
    window.__broker = {
      call: callEndpoint,
      deriveState,
      setHost: setHostOverride,
    };
  }
}
